import { DataSubmissionPageFactory, ScriptHostComponent } from "@eyra/feldspar";
import { HelloWorldFactory } from "./components/hello_world";

function App() {
  // Extract locale from URL query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const locale = urlParams.get('locale') || 'en';

  return (
    <div className="App">
      <ScriptHostComponent
        workerUrl="./py_worker.js"
        locale={locale}
        standalone={import.meta.env.DEV}
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
