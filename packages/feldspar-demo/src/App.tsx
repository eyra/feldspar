import { FeldsparComponent } from "@eyra/feldspar";
import React from "react";

function App() {
  return (
    <div className="App">
      <FeldsparComponent workerUrl="/py_worker.js" standalone={true} />
    </div>
  );
}

export default App;
