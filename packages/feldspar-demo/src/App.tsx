import { DataSubmissionPageFactory, FeldsparComponent } from "@eyra/feldspar";
import { HelloWorldFactory } from "./components/hello_world";

function App() {
  return (
    <div className="App">
      <FeldsparComponent
        workerUrl="./py_worker.js"
        standalone={process.env.NODE_ENV !== "production"}
        factories={[
          new DataSubmissionPageFactory({
            promptFactories: [new HelloWorldFactory()],
          }),
        ]}
      />
    </div>
  );
}

export default App;
