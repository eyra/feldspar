let pyScript;
let encodeCommandStrings;
const payloadDecoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

console.log("[ProcessingWorker] Worker loaded");

onmessage = (event) => {
  console.log("[ProcessingWorker] Received event:", event.data.eventType);
  const { eventType } = event.data;
  switch (eventType) {
    case "initialise":
      initialise().then(() => {
        self.postMessage({ eventType: "initialiseDone" });
      });
      break;

    case "firstRunCycle":
      pyScript = self.pyodide.runPython(`port.start(${JSON.stringify(event.data.data)})`);
      runCycle(null);
      break;

    case "nextRunCycle":
      const { payload } = event.data;
      unwrap(payload).then((userInput) => {
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
  console.log("[ProcessingWorker] runCycle", payloadType);
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
    const encodedEvent = encodeCommandStrings(scriptEvent);
    scriptEvent.destroy();
    scriptEvent = encodedEvent;
    const command = scriptEvent.toJs({
      create_pyproxies: false,
      dict_converter: Object.fromEntries,
    });
    const buffers = new Set();
    collectBuffers(command, buffers);
    self.postMessage(
      { eventType: "runCycleDone", scriptEvent: command },
      [...buffers]
    );
  } catch (error) {
    console.error("[ProcessingWorker] Error in toJs/postMessage:", error);
    self.postMessage({
      eventType: "error",
      error: error.toString(),
      stack: error.stack || "",
    });
  } finally {
    // The transferred buffers are owned JS copies, not views of WASM memory.
    // Release the Python command and its encoded strings immediately.
    scriptEvent.destroy();
  }
}

function collectBuffers(value, buffers) {
  if (value instanceof Uint8Array) {
    buffers.add(value.buffer);
  } else if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      collectBuffers(child, buffers);
    }
  }
}

function unwrap(payload) {
  if (payload.value instanceof Uint8Array) {
    payload.value = payloadDecoder.decode(payload.value);
  }
  return new Promise((resolve) => {
    switch (payload.__type__) {
      case "PayloadFile":
        copyFileToPyFS(payload.value, resolve);
        break;

      default:
        resolve(payload);
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
    .then(() => installPortPackage())
    .then(() => {
      encodeCommandStrings = self.pyodide.runPython(
        "from port.main import encode_command_strings; encode_command_strings"
      );
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
