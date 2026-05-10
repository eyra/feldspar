let pyScript;

console.log("[ProcessingWorker] Worker loaded");

onmessage = (event) => {
  console.log("[ProcessingWorker] Received event: ", event.data);
  const { eventType } = event.data;
  switch (eventType) {
    case "initialise":
      initialise().then(() => {
        self.postMessage({ eventType: "initialiseDone" });
      });
      break;

    case "firstRunCycle":
      pyScript = self.pyodide.runPython(`port.start(${event.data.sessionId})`);
      runCycle(null);
      break;

    case "nextRunCycle":
      const { response } = event.data;
      unwrap(response).then((userInput) => {
        runCycle(userInput);
      });
      break;

    default:
      console.log("[ProcessingWorker] Received unsupported event: ", eventType);
  }
};

let cycleCount = 0;

function runCycle(payload) {
  const cycleId = ++cycleCount;
  const payloadType = (payload && payload.__type__) || "null";
  console.log("[ProcessingWorker] runCycle " + JSON.stringify(payload));
  self.postMessage({
    eventType: "workerLog",
    level: "debug",
    message: `[Worker] runCycle #${cycleId} starting, payload=${payloadType}`,
  });
  let scriptEvent;
  try {
    scriptEvent = pyScript.send(payload);
  } catch (error) {
    console.error("[ProcessingWorker] Error in pyScript.send:", error);
    self.postMessage({
      eventType: "error",
      error: error.toString(),
      stack: error.stack || "",
    });
    return;
  }
  let commandType = "unknown";
  try {
    if (scriptEvent && typeof scriptEvent.get === "function") {
      commandType = scriptEvent.get("__type__") || "unknown";
    }
  } catch (e) {
    commandType = `unreadable (${e.message})`;
  }
  self.postMessage({
    eventType: "workerLog",
    level: "debug",
    message: `[Worker] runCycle #${cycleId} got command=${commandType}`,
  });
  try {
    self.postMessage({
      eventType: "runCycleDone",
      scriptEvent: scriptEvent.toJs({
        create_proxies: false,
        dict_converter: Object.fromEntries,
      }),
    });
  } catch (error) {
    console.error("[ProcessingWorker] Error in toJs/postMessage:", error);
    self.postMessage({
      eventType: "error",
      error: error.toString(),
      stack: error.stack || "",
    });
  }
}

function unwrap(response) {
  console.log(
    "[ProcessingWorker] unwrap response: " + JSON.stringify(response.payload)
  );
  return new Promise((resolve) => {
    switch (response.payload.__type__) {
      case "PayloadFile":
        copyFileToPyFS(response.payload.value, resolve);
        break;

      default:
        resolve(response.payload);
    }
  });
}

function createAsyncFileReader(file) {
  // Use FileReaderSync for synchronous reading in worker
  const fileReaderSync = new FileReaderSync();

  return {
    readSlice: (start, end) => {
      // Synchronous slice reading
      const blob = file.slice(start, end);
      return fileReaderSync.readAsArrayBuffer(blob);
    },
    size: file.size,
    name: file.name,
  };
}

function copyFileToPyFS(file, resolve) {
  // Create a file reader and pass it directly to Python
  const reader = createAsyncFileReader(file);

  resolve({
    __type__: "PayloadFile",
    value: reader,
  });
}

function initialise() {
  console.log("[ProcessingWorker] initialise");
  return startPyodide()
    .then((pyodide) => {
      self.pyodide = pyodide;
      return loadPackages();
    })
    .then(() => {
      return installPortPackage();
    });
}

function startPyodide() {
  importScripts("https://cdn.jsdelivr.net/pyodide/v0.24.0/full/pyodide.js");

  console.log("[ProcessingWorker] loading Pyodide");
  return loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.0/full/",
  });
}

function loadPackages() {
  console.log("[ProcessingWorker] loading packages");
  return self.pyodide.loadPackage(["micropip", "numpy", "pandas"]);
}

function installPortPackage() {
  console.log("[ProcessingWorker] load port package");
  return self.pyodide.runPythonAsync(`
    import micropip
    await micropip.install("./port-0.0.0-py3-none-any.whl", deps=False)
    import port
  `);
}
