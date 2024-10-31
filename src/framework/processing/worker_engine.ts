import { CommandHandler, ProcessingEngine } from '../types/modules'
import { CommandSystemEvent, CommandSystemDonate, isCommand, Response, PayloadDonate } from '../types/commands'

export default class WorkerProcessingEngine implements ProcessingEngine {
  sessionId: String
  worker: Worker
  commandHandler: CommandHandler

  resolveInitialized!: () => void
  resolveContinue!: () => void

  constructor (sessionId: string, worker: Worker, commandHandler: CommandHandler) {
    this.sessionId = sessionId
    this.commandHandler = commandHandler
    this.worker = worker
    this.worker.onerror = console.log
    this.worker.onmessage = (event) => {
      console.log(
        '[WorkerProcessingEngine] Received event from worker: ',
        event.data.eventType
      )
      this.handleEvent(event)
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
    console.log('[ReactEngine] received eventType: ', eventType)
    switch (eventType) {
      case 'initialiseDone':
        console.log('[ReactEngine] received: initialiseDone')
        this.resolveInitialized()
        break

      case 'runCycleDone':
        console.log('[ReactEngine] received: event', event.data.scriptEvent)
        this.handleRunCycle(event.data.scriptEvent)
        break
      default:
        console.log(
          '[ReactEngine] received unsupported flow event: ',
          eventType
        )
    }
  }

  start (): void {
    console.log('[WorkerProcessingEngine] started')

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
    if (isCommand(command)) {
      this.commandHandler.onCommand(command).then(
        (response) => {
          switch(response.payload.__type__) {
            case "PayloadDonate":
              const donateCommand = constructDonateCommand(response.payload)
              this.commandHandler.onCommand(donateCommand).then(
                (response) => {
                  this.nextRunCycle(response)
                }
              )
              break

            default:
              this.nextRunCycle(response)
          }
        },
        () => {}
      )
    }
  }
}

function constructDonateCommand(payload: PayloadDonate) {
  const donateCommand: CommandSystemDonate = {
    "__type__": "CommandSystemDonate",
    "key": payload.key,
    "json_string": payload.value,
  }
  return donateCommand
}
