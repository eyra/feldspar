import { CommandHandler } from '../types/modules'
import { CommandSystemEvent, isCommand, isCommandSystemLog, Response } from '../types/commands'
import { Logger, LogLevel } from '../logging'

export default class WorkerProcessingEngine {
  sessionId: String
  worker: Worker
  commandHandler: CommandHandler
  logger?: Logger

  resolveInitialized!: () => void
  resolveContinue!: () => void

  constructor (
    sessionId: string,
    worker: Worker,
    commandHandler: CommandHandler,
    logger?: Logger
  ) {
    this.sessionId = sessionId
    this.commandHandler = commandHandler
    this.worker = worker
    this.logger = logger
    this.initWorkerEventHandlers()
  }

  private initWorkerEventHandlers (): void {
    this.worker.onmessage = (event) => {
      this.logger?.log('debug', `Received event from worker: ${event.data.eventType}`)
      this.handleEvent(event)
    }
    this.worker.onerror = (error) => {
      this.logger?.log('error', `Worker error: ${error.message}`, {
        filename: error.filename,
        lineno: error.lineno,
        colno: error.colno,
      })
    }
  }

  sendSystemEvent (name: string): void {
    const command: CommandSystemEvent = { __type__: 'CommandSystemEvent', name }
    this.commandHandler.onCommand(command).then(
      () => {},
      () => {}
    )
  }

  handleEvent (event: any): void {
    const { eventType } = event.data
    switch (eventType) {
      case 'initialiseDone':
        this.logger?.log('debug', 'Worker initialisation done')
        this.resolveInitialized()
        break

      case 'runCycleDone':
        this.logger?.log('debug', 'Worker run cycle done')
        this.handleRunCycle(event.data.scriptEvent)
        break

      case 'error':
        this.logger?.log('error', `Python error: ${event.data.error}`, { stack: event.data.stack })
        break

      default:
        this.logger?.log('warn', `Received unsupported worker event: ${eventType}`)
    }
    this.logger?.flush()
  }

  start (): void {
    this.logger?.log('debug', 'Worker started')
    const waitForInitialization: Promise<void> = this.waitForInitialization()

    waitForInitialization.then(
      () => {
        this.sendSystemEvent('initialized')
        this.firstRunCycle()
      },
      () => {}
    )
  }

  async waitForInitialization (): Promise<void> {
    return await new Promise<void>((resolve) => {
      this.resolveInitialized = resolve
      this.logger?.log('debug', 'Waiting for worker initialisation')
      this.worker.postMessage({ eventType: 'initialise' })
    })
  }

  firstRunCycle (): void {
    this.worker.postMessage({ eventType: 'firstRunCycle', sessionId: this.sessionId })
  }

  nextRunCycle (response: Response): void {
    this.worker.postMessage({ eventType: 'nextRunCycle', response })
  }

  terminate (): void {
    this.worker.terminate()
  }

  handleRunCycle (command: any): void {
    if (isCommandSystemLog(command)) {
      this.logger?.log(command.level as LogLevel, command.message)
      this.nextRunCycle({ __type__: 'Response', command, payload: { __type__: 'PayloadVoid', value: undefined } })
    } else if (isCommand(command)) {
      this.commandHandler.onCommand(command).then(
        (response) => this.nextRunCycle(response),
        () => {}
      )
    }
  }
}
