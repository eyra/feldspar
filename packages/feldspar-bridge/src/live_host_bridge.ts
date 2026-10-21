import { isDonateAnswer, type DonateError, type DonateSuccess, type ResponseSystemDonate } from './answers.js'
import type { HostBridge } from './bridge.js'
import type { CommandSystem } from './commands.js'

export interface LiveHostBridgeOptions {
  // The locale the host sent with live-init.
  readonly locale?: string
}

// Talks to the host over the MessageChannel it hands over with 'live-init': commands go out
// with postMessage, and the host answers each donation with DonateSuccess or DonateError on the
// same port. Answers carry only the key, so one donation per key may wait at a time: a second
// send for that key rejects until the host has answered. There is no time-out: if the host
// never answers, the key stays blocked. A DonateError for a key nothing waits on is logged.
// Usually created by connectBridge.
export class LiveHostBridge implements HostBridge {
  readonly locale: string | undefined
  readonly #port: MessagePort
  readonly #waiting = new Map<string, (answer: ResponseSystemDonate) => void>()

  constructor (port: MessagePort, { locale }: LiveHostBridgeOptions = {}) {
    this.locale = locale
    this.#port = port
    this.#listen()
  }

  async send (command: CommandSystem): Promise<ResponseSystemDonate | undefined> {
    if (command.__type__ !== 'CommandSystemDonate') {
      this.#port.postMessage(command)
      return undefined
    }
    if (this.#waiting.has(command.key)) {
      throw new Error(`LiveHostBridge: a donation for key ${command.key} is still waiting for the host's answer`)
    }
    return await new Promise((resolve) => {
      this.#waiting.set(command.key, resolve)
      this.#port.postMessage(command)
    })
  }

  #listen (): void {
    this.#port.onmessage = (event: MessageEvent) => {
      const answer: unknown = event.data
      if (isDonateAnswer(answer)) return this.#answer(answer)
      const { __type__, key } = (answer ?? {}) as { __type__?: unknown, key?: unknown }
      if (__type__ === 'DonateSuccess' || __type__ === 'DonateError') {
        console.warn(`[LiveHostBridge] Ignoring malformed ${__type__}${typeof key === 'string' ? ` for key ${key}` : ''}`)
      }
    }
  }

  // An answer settles the one send waiting on its key.
  #answer (answer: DonateSuccess | DonateError): void {
    const resolve = this.#waiting.get(answer.key)
    if (resolve === undefined) {
      if (answer.__type__ === 'DonateError') console.error('[LiveHostBridge] DonateError', answer)
      return
    }
    this.#waiting.delete(answer.key)
    resolve(
      answer.__type__ === 'DonateSuccess'
        ? { success: true, key: answer.key, status: answer.status }
        : { success: false, key: answer.key, status: answer.status, error: answer.error }
    )
  }
}
