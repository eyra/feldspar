import { isDonateAnswer, type DonateError, type DonateSuccess, type ResponseSystemDonate } from './answers.js'
import type { HostBridge, HostBridgeOptions } from './bridge.js'
import type { CommandSystem, CommandSystemDonate } from './commands.js'

// The sends for one key that wait for the host's answer: their resolvers, how many of them the
// host has not answered yet, and the command to send again on a new channel.
interface Waiting {
  readonly resolvers: Array<(answer: ResponseSystemDonate) => void>
  outstanding: number
  command: CommandSystemDonate
}

export interface LiveHostBridgeOptions extends HostBridgeOptions {
  // The locale the host sent with live-init.
  readonly locale?: string
}

// Talks to the host over the MessageChannel it hands over with 'live-init': commands go out
// with postMessage, and the host answers each donation with DonateSuccess or DonateError on the
// same port. Answers carry only the key, not which send they answer, and may arrive in any
// order. Without acknowledges (the fallback) send() resolves once posted, and a DonateError
// that arrives is only logged. Usually created by connectBridge.
export class LiveHostBridge implements HostBridge {
  readonly acknowledges: boolean
  readonly locale: string | undefined
  #port: MessagePort
  readonly #waiting = new Map<string, Waiting>()

  constructor (port: MessagePort, { acknowledges = true, locale }: LiveHostBridgeOptions = {}) {
    this.acknowledges = acknowledges
    this.locale = locale
    this.#port = port
    this.#listen()
  }

  // The host can hand over a new channel (live-init again). The old channel will not answer, so
  // each donation still waiting is sent again on the new one, once per key, and keeps waiting.
  // Failing it instead would lose a donation that may already be on its retry.
  replacePort (port: MessagePort): void {
    this.#port.onmessage = null
    this.#port = port
    this.#listen()
    for (const waiting of this.#waiting.values()) {
      waiting.outstanding = 1
      this.#port.postMessage(waiting.command)
    }
  }

  async send (command: CommandSystem): Promise<ResponseSystemDonate | undefined> {
    if (command.__type__ !== 'CommandSystemDonate' || !this.acknowledges) {
      this.#port.postMessage(command)
      return undefined
    }
    return await new Promise((resolve) => {
      // A retry sends the same data under the same key while the earlier send may still be
      // answered late, so both wait on the key together (see #answer).
      const waiting = this.#waiting.get(command.key) ?? { resolvers: [], outstanding: 0, command }
      waiting.resolvers.push(resolve)
      waiting.outstanding += 1
      waiting.command = command
      this.#waiting.set(command.key, waiting)
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

  // An answer settles the sends waiting on its key. A success settles them all: the host
  // stored the data, and every send with that key carries the same data. An error settles
  // them only once no other send for the key is still unanswered, so a late error for an
  // attempt that timed out does not end a retry that may still succeed.
  #answer (answer: DonateSuccess | DonateError): void {
    const waiting = this.#waiting.get(answer.key)
    if (waiting === undefined) {
      if (answer.__type__ === 'DonateError') console.error('[LiveHostBridge] DonateError', answer)
      return
    }
    waiting.outstanding = Math.max(0, waiting.outstanding - 1)
    if (answer.__type__ === 'DonateError' && waiting.outstanding > 0) return
    this.#waiting.delete(answer.key)
    const result: ResponseSystemDonate =
      answer.__type__ === 'DonateSuccess'
        ? { success: true, key: answer.key, status: answer.status }
        : { success: false, key: answer.key, status: answer.status, error: answer.error }
    for (const resolve of waiting.resolvers) resolve(result)
  }
}
