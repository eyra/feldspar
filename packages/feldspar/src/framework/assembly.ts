import { Bridge } from "./types/modules";
import ReactEngine from "./visualization/react/engine";
import ReactFactory from "./visualization/react/factory";
import { PageFactory } from "./visualization/react/factories/base";
import CommandRouter from './command_router'
import WorkerProcessingEngine from "./processing/worker_engine";

export default class Assembly {
  processingEngine: WorkerProcessingEngine;
  visualizationEngine: ReactEngine;
  router: CommandRouter

  constructor(worker: Worker, bridge: Bridge, factories: PageFactory[] = []) {
    const sessionId = String(Date.now())
    const visualizationFactory = new ReactFactory(factories);
    this.visualizationEngine = new ReactEngine(visualizationFactory);
    this.router = new CommandRouter(bridge, this.visualizationEngine)
    this.processingEngine = new WorkerProcessingEngine(sessionId, worker, this.router);
  }
}
