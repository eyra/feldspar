import { CommandHandler } from '../types/modules'
import { CommandSystemEvent, isCommand, Response } from '../types/commands'
import { Logger, LogLevel } from '../logging'
import TextBundle from '../text_bundle'
import { Translator } from '../translator'

const VALID_LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error']
const commandDecoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
const payloadEncoder = new TextEncoder()

function decodeCommandStrings (value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return commandDecoder.decode(value)
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      Reflect.set(value, key, decodeCommandStrings(child))
    }
  }
  return value
}

function toLogLevel (value: unknown): LogLevel {
  return VALID_LOG_LEVELS.includes(value as LogLevel) ? (value as LogLevel) : 'info'
}

export default class WorkerProcessingEngine {
  sessionId: String
  locale: string
  worker: Worker
  commandHandler: CommandHandler
  logger?: Logger
  private stopped = false

  resolveInitialized!: () => void
  resolveContinue!: () => void

  constructor (
    sessionId: string,
    locale: string,
    worker: Worker,
    commandHandler: CommandHandler,
    logger?: Logger
  ) {
    this.sessionId = sessionId
    this.locale = locale
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
      if (this.stopped) return
      this.logger?.log('error', `Worker error: ${error.message}`, {
        filename: error.filename,
        lineno: error.lineno,
        colno: error.colno,
      })
      this.exitWithError(error.message)
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
    if (this.stopped) return
    const { eventType } = event.data
    switch (eventType) {
      case 'initialiseDone':
        this.logger?.log('debug', 'Worker initialisation done')
        this.resolveInitialized()
        break

      case 'runCycleDone':
        this.logger?.log('debug', 'Worker run cycle done')
        this.handleRunCycle(decodeCommandStrings(event.data.scriptEvent))
        break

      case 'error':
        this.logger?.log('error', `Python error: ${event.data.error}`, { stack: event.data.stack })
        this.exitWithError(event.data.error)
        return

      case 'workerLog':
        this.logger?.log(toLogLevel(event.data.level), event.data.message)
        break

      default:
        this.logger?.log('warn', `Received unsupported worker event: ${eventType}`)
    }
    this.logger?.flush()
  }

  private exitWithError (error: unknown): void {
    // Use the final exception, not a traceback line or an earlier chained error.
    const message = typeof error === 'string' ? error.trimEnd() : ''
    const detail = message.slice(message.lastIndexOf('\n') + 1)
    const sizeRelated =
      /^(?:PythonError: )?MemoryError(?::.*)?$/.test(detail) ||
      /^(?:PythonError: )?OverflowError: (?:Could not reserve memory block|Maximum recursion level reached)$/.test(detail) ||
      /^(?:Uncaught )?RuntimeError: memory access out of bounds$/.test(detail)
    this.logger?.flush()
    this.handleRunCycle({
      __type__: 'CommandSystemExit',
      code: 1,
      info: Translator.translate(sizeRelated ? dataSizeError : processingError, this.locale)
    })
    this.terminate()
  }

  start (): void {
    this.logger?.log('debug', 'Worker started')
    const waitForInitialization: Promise<void> = this.waitForInitialization()

    waitForInitialization.then(
      () => {
        if (this.stopped) return
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
    this.worker.postMessage({
      eventType: 'firstRunCycle',
      data: { sessionId: this.sessionId, locale: this.locale }
    })
  }

  nextRunCycle (response: Response): void {
    if (this.stopped) return
    // The worker consumes only the answer, not the original render/donate command.
    const { payload } = response
    if (typeof payload.value === 'string') {
      const value = payloadEncoder.encode(payload.value)
      this.worker.postMessage(
        { eventType: 'nextRunCycle', payload: { ...payload, value } },
        [value.buffer]
      )
    } else {
      this.worker.postMessage({ eventType: 'nextRunCycle', payload })
    }
  }

  terminate (): void {
    if (this.stopped) return
    this.stopped = true
    this.worker.onmessage = null
    this.worker.onerror = null
    this.worker.terminate()
  }

  handleRunCycle (command: any): void {
    if (isCommand(command)) {
      this.commandHandler.onCommand(command).then(
        (response) => this.nextRunCycle(response),
        () => {}
      )
    }
  }
}

const processingError = new TextBundle()
  .add('en', 'Data processing failed.')
  .add('de', 'Die Datenverarbeitung ist fehlgeschlagen.')
  .add('it', "L'elaborazione dei dati non è riuscita.")
  .add('es', 'No se han podido procesar los datos.')
  .add('nl', 'De gegevensverwerking is mislukt.')
  .add('ro', 'Prelucrarea datelor a eșuat.')
  .add('lt', 'Duomenų apdoroti nepavyko.')

const dataSizeError = new TextBundle()
  .add('en', 'Data processing failed. The data may be too large to process on this device.')
  .add('de', 'Die Datenverarbeitung ist fehlgeschlagen. Die Daten sind möglicherweise zu umfangreich, um auf diesem Gerät verarbeitet zu werden.')
  .add('it', "L'elaborazione dei dati non è riuscita. I dati potrebbero essere troppo voluminosi per essere elaborati su questo dispositivo.")
  .add('es', 'No se han podido procesar los datos. Es posible que sean demasiado grandes para procesarlos en este dispositivo.')
  .add('nl', 'De gegevensverwerking is mislukt. De gegevens zijn mogelijk te groot om op dit apparaat te verwerken.')
  .add('ro', 'Prelucrarea datelor a eșuat. Este posibil ca volumul datelor să fie prea mare pentru a fi prelucrat pe acest dispozitiv.')
  .add('lt', 'Duomenų apdoroti nepavyko. Duomenų gali būti per daug, kad juos būtų galima apdoroti šiame įrenginyje.')
