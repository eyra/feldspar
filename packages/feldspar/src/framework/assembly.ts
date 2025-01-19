import ReactEngine from './visualization/react/engine'
import ReactFactory from './visualization/react/factory'
import WorkerProcessingEngine from './processing/worker_engine'
import { ProcessingEngine, Bridge } from './types/modules'
import CommandRouter from './command_router'

export default class Assembly {
  visualizationEngine: ReactEngine
  processingEngine: ProcessingEngine
  router: CommandRouter

  constructor (worker: Worker, bridge: Bridge) {
    const sessionId = String(Date.now())
    this.visualizationEngine = new ReactEngine(new ReactFactory())
    this.router = new CommandRouter(bridge, this.visualizationEngine)
    this.processingEngine = new WorkerProcessingEngine(sessionId, worker, this.router)
  }
}
