import { CommandSystem, isCommandSystem, isCommandSystemExit } from './framework/types/commands'
import { Bridge } from './framework/types/modules'
import { LogEntry } from './framework/logging'
import { isLiveInit, isLivenessOptions, isLivenessPing } from './framework/types/live_bridge'

export class LiveBridge implements Bridge {
  port: MessagePort
  private static registrations = new WeakMap<Window, () => void>()
  private disposed = false
  private attemptId?: string

  constructor (port: MessagePort, liveness?: unknown) {
    this.port = port
    this.setupLiveness(liveness)
  }

  static create (window: Window, callback: (bridge: Bridge, locale: string) => void): () => void {
    LiveBridge.registrations.get(window)?.()
    let bridge: LiveBridge | undefined
    let disposed = false
    const onInit = (event: MessageEvent): void => {
      console.log('MESSAGE RECEIVED', event)
      if (disposed || event.source !== window.parent ||
          !isLiveInit(event.data) || event.ports.length !== 1) return

      bridge?.dispose()
      bridge = new LiveBridge(event.ports[0], event.data.liveness)
      const locale = event.data.locale
      console.log('LOCALE', locale)
      callback(bridge, locale)
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

  dispose (): void {
    if (this.disposed) return
    this.disposed = true
    this.port.removeEventListener('message', this.onLivenessMessage)
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

  private setupLiveness (liveness: unknown): void {
    if (!isLivenessOptions(liveness)) return
    this.attemptId = liveness.attempt_id
    this.port.addEventListener('message', this.onLivenessMessage)
    this.port.start()
    this.port.postMessage({
      __type__: 'LivenessReady',
      attempt_id: this.attemptId,
    })
  }

  private readonly onLivenessMessage = (event: MessageEvent): void => {
    const data = event.data
    if (this.disposed || !isLivenessPing(data) || data.attempt_id !== this.attemptId) return

    this.port.postMessage({
      __type__: 'LivenessPong',
      attempt_id: this.attemptId,
      sequence: data.sequence,
    })
  }

  private log (level: 'info' | 'error', ...message: any[]): void {
    const logger = level === 'info' ? console.log : console.error
    logger('[LiveBridge]', ...message)
  }
}
