import { CommandSystem, isCommandSystem, isCommandSystemExit } from './framework/types/commands'
import { Bridge } from './framework/types/modules'
import { LogEntry } from './framework/logging'

interface LivenessOptions {
  attempt_id: string
}

interface LivenessPing extends LivenessOptions {
  __type__: 'FeldsparLivenessPing'
  sequence: number
}

interface LiveInit {
  action: 'live-init'
  locale: string
  liveness?: unknown
}

function isLivenessOptions (value: unknown): value is LivenessOptions {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const options = value as Partial<LivenessOptions>
  return typeof options.attempt_id === 'string' &&
    options.attempt_id.trim().length > 0
}

export class LiveBridge implements Bridge {
  private static registrations = new WeakMap<Window, () => void>()
  private disposed = false
  private readonly attemptId?: string

  constructor (readonly port: MessagePort, liveness?: unknown) {
    if (isLivenessOptions(liveness)) {
      this.attemptId = liveness.attempt_id
      port.addEventListener('message', this.onMessage)
      port.start()
      port.postMessage({
        __type__: 'FeldsparLivenessReady',
        attempt_id: this.attemptId,
      })
    }
  }

  static create (window: Window, callback: (bridge: Bridge, locale: string) => void): () => void {
    LiveBridge.registrations.get(window)?.()
    let bridge: LiveBridge | undefined
    let disposed = false
    const onInit = (event: MessageEvent): void => {
      const data = event.data as Partial<LiveInit> | null
      if (disposed || event.source !== window.parent ||
          typeof data !== 'object' || data === null || Array.isArray(data) ||
          data.action !== 'live-init' || typeof data.locale !== 'string' ||
          data.locale.trim().length === 0 || event.ports.length !== 1) return

      bridge?.dispose()
      bridge = new LiveBridge(event.ports[0], data.liveness)
      callback(bridge, data.locale)
    }
    const dispose = (): void => {
      if (disposed) return
      disposed = true
      window.removeEventListener('message', onInit)
      bridge?.dispose()
      if (LiveBridge.registrations.get(window) === dispose) {
        LiveBridge.registrations.delete(window)
      }
    }
    window.addEventListener('message', onInit)
    LiveBridge.registrations.set(window, dispose)
    return dispose
  }

  private readonly onMessage = (event: MessageEvent): void => {
    const data = event.data as Partial<LivenessPing> | null
    if (this.disposed || typeof data !== 'object' || data === null || Array.isArray(data) ||
        data.__type__ !== 'FeldsparLivenessPing' ||
        data.attempt_id !== this.attemptId ||
        typeof data.sequence !== 'number' || !Number.isInteger(data.sequence) ||
        data.sequence < 1 || data.sequence > 2147483647) return

    this.port.postMessage({
      __type__: 'FeldsparLivenessPong',
      attempt_id: this.attemptId,
      sequence: data.sequence,
    })
  }

  dispose (): void {
    if (this.disposed) return
    this.disposed = true
    this.port.removeEventListener('message', this.onMessage)
    this.port.close()
  }

  send (command: CommandSystem): void {
    if (this.disposed) return
    if (isCommandSystem(command)) {
      this.log('info', 'send', command)
      this.port.postMessage(command)
      if (isCommandSystemExit(command)) this.dispose()
    } else {
      this.log('error', 'received unknown command', command)
    }
  }

  sendLogs (entries: LogEntry[]): void {
    if (this.disposed) return
    entries.forEach(entry => {
      this.port.postMessage({
        __type__: 'CommandSystemLog',
        level: entry.level,
        message: entry.message,
        json_string: JSON.stringify({ level: entry.level, message: entry.message }),
      })
    })
  }

  private log (level: 'info' | 'error', ...message: any[]): void {
    const logger = level === 'info' ? console.log : console.error
    logger('[LiveBridge]', ...message)
  }
}
