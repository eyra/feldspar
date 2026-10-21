import type { ResponseSystemDonate } from './answers.js'
import type { HostBridge } from './bridge.js'
import type { CommandSystem, CommandSystemDonate } from './commands.js'

type Fetch = (url: string, init: RequestInit) => Promise<Response>

export interface FakeHostBridgeOptions {
  // Where donations are posted. Default '/data-submission', the stub of the dev server.
  readonly url?: string
  readonly fetch?: Fetch
}

// Calls the global fetch as a plain function: browsers refuse fetch called as a method of
// another object ("Illegal invocation").
const globalFetch: Fetch = async (url, init) => await globalThis.fetch(url, init)

// Browsers refuse a keepalive request whose body, together with the other keepalive requests in
// flight, is over 64 KiB. A donation that does not fit in what is left is posted without
// keepalive.
export const KEEPALIVE_MAX_BYTES = 64 * 1024

// Stands in for the host during development, like FakeBridge: each donation is posted as
// { key, data } to the data-submission endpoint of the dev server. It answers the way Next
// does: success for HTTP 2xx, an error with the status otherwise (0 for a network error).
// Other commands are not sent anywhere; only an exit is logged.
export class FakeHostBridge implements HostBridge {
  readonly #url: string
  readonly #fetch: Fetch
  // Bytes of the keepalive requests still in flight.
  #keepaliveBytes = 0
  // The keys of the donations in flight: one per key at a time.
  readonly #pending = new Set<string>()

  constructor ({ url = '/data-submission', fetch: fetcher = globalFetch }: FakeHostBridgeOptions = {}) {
    this.#url = url
    this.#fetch = fetcher
  }

  async send (command: CommandSystem): Promise<ResponseSystemDonate | undefined> {
    if (command.__type__ === 'CommandSystemExit') console.log(`[FakeHostBridge] exit ${command.code}: ${command.info}`)
    if (command.__type__ !== 'CommandSystemDonate') return undefined
    if (this.#pending.has(command.key)) {
      throw new Error(`FakeHostBridge: a donation for key ${command.key} is still waiting for the host's answer`)
    }
    this.#pending.add(command.key)
    try {
      return await this.#post(command)
    } finally {
      this.#pending.delete(command.key)
    }
  }

  async #post ({ key, json_string: data }: CommandSystemDonate): Promise<ResponseSystemDonate> {
    const body = JSON.stringify({ key, data })
    const bytes = new TextEncoder().encode(body).length
    // Lets a donation sent while the page unloads still arrive.
    const keepalive = this.#keepaliveBytes + bytes <= KEEPALIVE_MAX_BYTES
    if (keepalive) this.#keepaliveBytes += bytes
    try {
      const response = await this.#fetch(this.#url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive
      })
      return response.ok
        ? { success: true, key, status: response.status }
        : { success: false, key, status: response.status, error: `HTTP ${response.status}` }
    } catch (error) {
      return { success: false, key, status: 0, error: error instanceof Error ? error.message : String(error) }
    } finally {
      if (keepalive) this.#keepaliveBytes -= bytes
    }
  }
}
