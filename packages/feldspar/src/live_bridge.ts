import { CommandSystem, isCommandSystem, isCommandSystemDonate } from './framework/types/commands'
import { Bridge, ResponseSystemDonate } from './framework/types/modules'

// Response types from the parent (feldspar_app.js)
export interface DonateSuccess {
  __type__: 'DonateSuccess'
  key: string
  status: number
}

export interface DonateError {
  __type__: 'DonateError'
  key: string
  status: number
  error: string
}

export type DonateResponse = DonateSuccess | DonateError

export function isDonateResponse (data: any): data is DonateResponse {
  return data && (data.__type__ === 'DonateSuccess' || data.__type__ === 'DonateError')
}

interface PendingDonation {
  resolve: (result: ResponseSystemDonate) => void
}

export class LiveBridge implements Bridge {
  port: MessagePort
  static initialized = false
  private pendingDonations: Map<string, PendingDonation> = new Map()

  constructor (port: MessagePort) {
    this.port = port
    this.setupResponseListener()
  }

  private setupResponseListener (): void {
    this.port.onmessage = (event) => {
      if (isDonateResponse(event.data)) {
        this.handleDonateResponse(event.data)
      } else {
        this.log('info', 'received unknown message', event.data)
      }
    }
  }

  private handleDonateResponse (response: DonateResponse): void {
    const pending = this.pendingDonations.get(response.key)

    if (response.__type__ === 'DonateSuccess') {
      console.log('[LiveBridge] DonateSuccess:', {
        key: response.key,
        status: response.status
      })
      if (pending) {
        pending.resolve({
          success: true,
          key: response.key,
          status: response.status
        })
      }
    } else {
      console.error('[LiveBridge] DonateError:', {
        key: response.key,
        status: response.status,
        error: response.error
      })
      if (pending) {
        pending.resolve({
          success: false,
          key: response.key,
          status: response.status,
          error: response.error
        })
      }
    }

    this.pendingDonations.delete(response.key)
    this.log('info', `Donation completed, pending: ${this.pendingDonations.size}`)
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

  async send (command: CommandSystem): Promise<ResponseSystemDonate | void> {
    if (!isCommandSystem(command)) {
      this.log('error', 'received unknown command', command)
      return
    }

    // Track pending donations and return promise
    if (isCommandSystemDonate(command)) {
      return new Promise<ResponseSystemDonate>((resolve) => {
        this.pendingDonations.set(command.key, { resolve })
        this.log('info', `Donation started, pending: ${this.pendingDonations.size}`, command)
        this.port.postMessage(command)
      })
    }

    this.log('info', 'send', command)
    this.port.postMessage(command)
  }

  private log (level: 'info' | 'error', ...message: any[]): void {
    const logger = level === 'info' ? console.log : console.error
    logger('[LiveBridge]', ...message)
  }
}
