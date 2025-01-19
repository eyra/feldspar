import ReactEngine from './visualisation/react/engine'
import ReactFactory from './visualisation/react/factory'
import WorkerProcessingEngine from './processing/worker_engine'
import { ProcessingEngine, Bridge } from './types/modules'
import CommandRouter from './command_router'

export default class Assembly {
  visualisationEngine: ReactEngine
  processingEngine: ProcessingEngine
  router: CommandRouter

  constructor (worker: Worker, bridge: Bridge) {
    const sessionId = String(Date.now())
    this.visualisationEngine = new ReactEngine(new ReactFactory())
    this.router = new CommandRouter(bridge, this.visualisationEngine)
    this.processingEngine = new WorkerProcessingEngine(sessionId, worker, this.router)
  }
}
