import type { HostBridge, HostBridgeOptions } from './bridge.js'
import { FakeHostBridge } from './fake_host_bridge.js'
import { LiveHostBridge } from './live_host_bridge.js'
import { reportSize } from './resize.js'

// The parts of window the bridge uses, so tests can pass a stand-in.
export interface HostWindow {
  addEventListener: (type: 'message', listener: (event: MessageEvent) => void) => void
  readonly parent: { postMessage: (message: unknown, targetOrigin: string) => void }
  // For the resize messages; a stand-in can leave them out.
  readonly document?: { readonly body: Element, readonly documentElement: Element }
  readonly ResizeObserver?: typeof ResizeObserver
}

// How long an app in an iframe waits for the host's 'live-init'.
export const LIVE_INIT_TIMEOUT_MS = 10_000

export interface ConnectOptions extends HostBridgeOptions {
  // The window to connect from. Default: the global window.
  readonly window?: HostWindow
  // How long to wait for the host's 'live-init'. Default LIVE_INIT_TIMEOUT_MS (10 000 ms).
  readonly liveInitTimeoutMs?: number
}

// Every line connectBridge logs starts with this, so the handshake is easy to find in the
// browser console. Other messages the window receives are normal and not logged.
const LOG = '[connectBridge]'

// A message from the host that hands over the channel: { action: 'live-init', locale, ... }.
function isLiveInit (data: unknown): data is { action: 'live-init', locale?: unknown } {
  return typeof data === 'object' && data !== null && (data as { action?: unknown }).action === 'live-init'
}

// Only the host (our parent) may hand over the channel. No origin check: the app does not
// know the host's origin.
function fromHost (event: MessageEvent, win: HostWindow): boolean {
  return event.source === (win.parent as unknown)
}

// Connects to the host. Inside an iframe it listens for 'live-init', then announces the app
// with 'app-loaded' (Next sets up the channel only after that message) and reports its height.
// It resolves once the host hands over the MessageChannel, after telling the host on it that
// the app is initialized (Next shows the app only then). A later 'live-init' moves the bridge
// to the new channel. Rejects when no 'live-init' comes within liveInitTimeoutMs. Outside an
// iframe (the dev server) it uses the FakeHostBridge. Rejects at once for an invalid
// liveInitTimeoutMs, so a configuration error shows at start-up.
export async function connectBridge ({
  window: win = window,
  acknowledges = true,
  liveInitTimeoutMs = LIVE_INIT_TIMEOUT_MS
}: ConnectOptions = {}): Promise<HostBridge> {
  if (typeof liveInitTimeoutMs !== 'number' || !Number.isFinite(liveInitTimeoutMs) || liveInitTimeoutMs < 0) {
    throw new Error(`connectBridge: liveInitTimeoutMs must be a finite number of milliseconds >= 0, got ${String(liveInitTimeoutMs)}`)
  }
  if ((win.parent as unknown) === win) {
    console.info(`${LOG} Not inside an iframe: using the FakeHostBridge`)
    return new FakeHostBridge({ acknowledges })
  }
  return await new Promise((resolve, reject) => {
    let bridge: LiveHostBridge | undefined
    let timedOut = false

    const onTimeout = (): void => {
      timedOut = true
      const message = `No live-init from the host within ${liveInitTimeoutMs} ms`
      console.error(`${LOG} ${message}`)
      reject(new Error(message))
    }
    const timer = setTimeout(onTimeout, liveInitTimeoutMs)

    // The first live-init connects; a later one moves the bridge to the new channel.
    const handleLiveInit = (port: MessagePort, locale: unknown): void => {
      if (bridge !== undefined) {
        console.info(`${LOG} live-init again: replacing the port`)
        bridge.replacePort(port)
        return
      }
      clearTimeout(timer)
      console.info(`${LOG} live-init accepted: connected to the host`)
      bridge = new LiveHostBridge(port, { acknowledges, locale: typeof locale === 'string' ? locale : undefined })
      port.postMessage({ __type__: 'CommandSystemEvent', name: 'initialized' })
      resolve(bridge)
    }

    const onMessage = (event: MessageEvent): void => {
      if (!isLiveInit(event.data)) return
      if (timedOut) return console.warn(`${LOG} Ignoring live-init: it came after the time-out`)
      if (!fromHost(event, win)) return console.warn(`${LOG} Ignoring live-init: not from the parent window`)
      const port = event.ports[0]
      if (port === undefined) return console.warn(`${LOG} Ignoring live-init: it carries no port`)
      handleLiveInit(port, event.data.locale)
    }

    win.addEventListener('message', onMessage)
    win.parent.postMessage({ action: 'app-loaded' }, '*')
    console.info(`${LOG} Sent app-loaded; waiting up to ${liveInitTimeoutMs} ms for live-init`)
    reportSize(win)
  })
}
