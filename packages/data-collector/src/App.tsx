import { DataSubmissionPageFactory, ScriptHostComponent } from "@eyra/feldspar";
import { HelloWorldFactory } from "./components/hello_world";

function App() {
  return (
    <div className="App">
      <ScriptHostComponent
        workerUrl="./py_worker.js"
        standalone={import.meta.env.DEV}
        factories={[
          new DataSubmissionPageFactory({
            promptFactories: [new HelloWorldFactory()],
          }),
        ]}
        logLevel={import.meta.env.DEV ? "debug" : "info"}
      />
    </div>
  );
}

export default App;
