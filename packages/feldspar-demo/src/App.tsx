import { FeldsparComponent } from "@eyra/feldspar";
import React from "react";

function App() {
  return (
    <div className="App">
      <FeldsparComponent workerUrl="/worker.js" standalone={true} />
    </div>
  );
}

export default App;
