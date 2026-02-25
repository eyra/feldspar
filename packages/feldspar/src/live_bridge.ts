import { CommandSystem, isCommandSystem } from './framework/types/commands'
import { Bridge } from './framework/types/modules'
import { LogEntry } from './framework/logging'

export class LiveBridge implements Bridge {
  port: MessagePort
  static initialized = false

  constructor (port: MessagePort) {
    this.port = port
  }

  static create (window: Window, callback: (bridge: Bridge, locale: string) => void): void {
    window.addEventListener('message', (event) => {
      console.log('MESSAGE RECEIVED', event)
      // Ensure initialization happens only once
      if (event.data.action === 'live-init' && !LiveBridge.initialized) {
        LiveBridge.initialized = true
        const bridge = new LiveBridge(event.ports[0])
        const locale = event.data.locale
        console.log('LOCALE', locale)
        callback(bridge, locale)
      }
    })
  }

  send (command: CommandSystem): void {
    if (isCommandSystem(command)) {
      this.log('info', 'send', command)
      this.port.postMessage(command)
    } else {
      this.log('error', 'received unknown command', command)
    }
  }

  sendLogs (entries: LogEntry[]): void {
    entries.forEach(entry => {
      this.port.postMessage({
        __type__: 'monitor:log',
        json_string: JSON.stringify(entry),
      })
    })
  }

  private log (level: 'info' | 'error', ...message: any[]): void {
    const logger = level === 'info' ? console.log : console.error
    logger('[LiveBridge]', ...message)
  }
}
