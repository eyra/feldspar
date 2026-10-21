import { connectBridge, FakeHostBridge, LiveHostBridge, reportSize, type HostWindow } from './index.js'
import { waitFor } from './test_helpers.js'

const channels: MessageChannel[] = []
const channel = () => {
  const created = new MessageChannel()
  channels.push(created)
  return created
}
// The next message the host side of a channel receives.
const nextMessage = (port: MessagePort) =>
  new Promise<unknown>((resolve) => port.addEventListener('message', (event) => resolve(event.data), { once: true }))

afterEach(() => {
  for (const { port1, port2 } of channels.splice(0)) {
    port1.close()
    port2.close()
  }
})

describe('LiveHostBridge', () => {
  it('sends the Donate command on the port and resolves with DonateSuccess for its key', async () => {
    const { port1: host, port2 } = channel()
    const bridge = new LiveHostBridge(port2)
    const sent = nextMessage(host)

    const answer = bridge.send({ __type__: 'CommandSystemDonate', key: 'run-1/session', json_string: '{}' })

    expect(await sent).toEqual({ __type__: 'CommandSystemDonate', key: 'run-1/session', json_string: '{}' })
    host.postMessage({ __type__: 'DonateSuccess', key: 'run-1/session', status: 201 })
    await expect(answer).resolves.toEqual({ success: true, key: 'run-1/session', status: 201 })
  })

  it('resolves with an error for DonateError, matched by key', async () => {
    const { port1: host, port2 } = channel()
    const bridge = new LiveHostBridge(port2)
    const a = bridge.send({ __type__: 'CommandSystemDonate', key: 'a', json_string: '{}' })
    const b = bridge.send({ __type__: 'CommandSystemDonate', key: 'b', json_string: '{}' })

    host.postMessage({ __type__: 'DonateError', key: 'b', status: 500, error: 'storage failed' })
    host.postMessage({ __type__: 'DonateSuccess', key: 'a', status: 201 })

    await expect(b).resolves.toEqual({ success: false, key: 'b', status: 500, error: 'storage failed' })
    await expect(a).resolves.toEqual({ success: true, key: 'a', status: 201 })
  })

  it('ignores other messages and answers for unknown keys', async () => {
    const { port1: host, port2 } = channel()
    const bridge = new LiveHostBridge(port2)
    const answer = bridge.send({ __type__: 'CommandSystemDonate', key: 'a', json_string: '{}' })

    host.postMessage({ action: 'resize' })
    host.postMessage({ __type__: 'DonateSuccess', key: 'other', status: 201 })
    host.postMessage({ __type__: 'DonateSuccess', key: 'a', status: 201 })

    await expect(answer).resolves.toEqual({ success: true, key: 'a', status: 201 })
  })

  it('ignores malformed answers, so they do not resolve a pending donation', async () => {
    const { port1: host, port2 } = channel()
    const bridge = new LiveHostBridge(port2)
    const answer = bridge.send({ __type__: 'CommandSystemDonate', key: 'a', json_string: '{}' })

    host.postMessage({ __type__: 'DonateSuccess', key: 'a' })
    host.postMessage({ __type__: 'DonateSuccess', key: 'a', status: '201' })
    host.postMessage({ __type__: 'DonateSuccess', key: 1, status: 201 })
    host.postMessage({ __type__: 'DonateError', key: 'a', status: 500 })
    host.postMessage({ __type__: 'DonateError', key: 'a', status: 500, error: 42 })
    host.postMessage({ __type__: 'DonateError', key: 'a', error: 'storage failed' })
    host.postMessage(null)
    host.postMessage('DonateSuccess')
    host.postMessage({ __type__: 'DonateSuccess', key: 'a', status: 201 })

    await expect(answer).resolves.toEqual({ success: true, key: 'a', status: 201 })
  })

  it('gives the answer for a key to the latest send with that key (a retry)', async () => {
    const { port1: host, port2 } = channel()
    const bridge = new LiveHostBridge(port2)
    void bridge.send({ __type__: 'CommandSystemDonate', key: 'k', json_string: '{}' })
    const retry = bridge.send({ __type__: 'CommandSystemDonate', key: 'k', json_string: '{}' })

    host.postMessage({ __type__: 'DonateSuccess', key: 'k', status: 201 })

    await expect(retry).resolves.toEqual({ success: true, key: 'k', status: 201 })
  })

  // Whether a promise has settled, after the messages already posted have been delivered.
  const settledYet = async (promise: Promise<unknown>) => {
    let settled = false
    void promise.then(() => (settled = true))
    await new Promise((resolve) => setTimeout(resolve, 10))
    return settled
  }

  it('keeps a retry waiting when a late DonateError for the earlier send arrives, and settles it with its own answer', async () => {
    const { port1: host, port2 } = channel()
    const bridge = new LiveHostBridge(port2)
    void bridge.send({ __type__: 'CommandSystemDonate', key: 'k', json_string: '{}' })
    const retry = bridge.send({ __type__: 'CommandSystemDonate', key: 'k', json_string: '{}' })

    host.postMessage({ __type__: 'DonateError', key: 'k', status: 500, error: 'late' })
    expect(await settledYet(retry)).toBe(false)

    host.postMessage({ __type__: 'DonateSuccess', key: 'k', status: 201 })
    await expect(retry).resolves.toEqual({ success: true, key: 'k', status: 201 })
  })

  it('settles a retry with a late DonateSuccess for the earlier send: the same key holds the same data', async () => {
    const { port1: host, port2 } = channel()
    const bridge = new LiveHostBridge(port2)
    const first = bridge.send({ __type__: 'CommandSystemDonate', key: 'k', json_string: '{}' })
    const retry = bridge.send({ __type__: 'CommandSystemDonate', key: 'k', json_string: '{}' })

    host.postMessage({ __type__: 'DonateSuccess', key: 'k', status: 201 })

    await expect(retry).resolves.toEqual({ success: true, key: 'k', status: 201 })
    await expect(first).resolves.toEqual({ success: true, key: 'k', status: 201 })
  })

  it('settles a retry with the second DonateError once no send for the key is waiting for an answer', async () => {
    const { port1: host, port2 } = channel()
    const bridge = new LiveHostBridge(port2)
    void bridge.send({ __type__: 'CommandSystemDonate', key: 'k', json_string: '{}' })
    const retry = bridge.send({ __type__: 'CommandSystemDonate', key: 'k', json_string: '{}' })

    host.postMessage({ __type__: 'DonateError', key: 'k', status: 500, error: 'first' })
    host.postMessage({ __type__: 'DonateError', key: 'k', status: 503, error: 'second' })

    await expect(retry).resolves.toEqual({ success: false, key: 'k', status: 503, error: 'second' })
  })

  it('without acknowledges (the fallback) resolves once posted and logs a DonateError that arrives', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})
    const { port1: host, port2 } = channel()
    const bridge = new LiveHostBridge(port2, { acknowledges: false })
    const sent = nextMessage(host)

    await expect(bridge.send({ __type__: 'CommandSystemDonate', key: 'k', json_string: '{}' })).resolves.toBeUndefined()
    expect(await sent).toMatchObject({ key: 'k' })

    host.postMessage({ __type__: 'DonateError', key: 'k', status: 500, error: 'storage failed' })
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith('[LiveHostBridge] DonateError', {
        __type__: 'DonateError',
        key: 'k',
        status: 500,
        error: 'storage failed',
      }),
    )
    error.mockRestore()
  })

  it('logs a warning for a donate answer that is malformed, instead of dropping it silently', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const { port1: host, port2 } = channel()
    const bridge = new LiveHostBridge(port2)
    const answer = bridge.send({ __type__: 'CommandSystemDonate', key: 'a', json_string: '{}' })

    host.postMessage({ __type__: 'DonateSuccess', key: 'a' })
    host.postMessage({ __type__: 'DonateError', status: 500, error: 'x' })
    host.postMessage({ action: 'resize' })
    host.postMessage({ __type__: 'DonateSuccess', key: 'a', status: 201 })

    await answer
    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn).toHaveBeenNthCalledWith(1, '[LiveHostBridge] Ignoring malformed DonateSuccess for key a')
    expect(warn).toHaveBeenNthCalledWith(2, '[LiveHostBridge] Ignoring malformed DonateError')
    warn.mockRestore()
  })

  it('sends an exit on the port', async () => {
    const { port1: host, port2 } = channel()
    const sent = nextMessage(host)

    await new LiveHostBridge(port2).send({ __type__: 'CommandSystemExit', code: 0, info: 'completed' })

    expect(await sent).toEqual({ __type__: 'CommandSystemExit', code: 0, info: 'completed' })
  })
})

// A window inside an iframe whose parent records what the Tool posts to it. With `height`, it
// also has a document and a ResizeObserver whose callback the test can trigger.
function iframeWindow(height?: { value: number }) {
  const target = new EventTarget()
  const posted: unknown[] = []
  const observers: { callback: () => void; observed: unknown[]; disconnected: boolean }[] = []
  class FakeResizeObserver {
    readonly record: (typeof observers)[number]
    constructor(callback: () => void) {
      this.record = { callback, observed: [], disconnected: false }
      observers.push(this.record)
    }
    observe(element: unknown) {
      this.record.observed.push(element)
    }
    disconnect() {
      this.record.disconnected = true
    }
  }
  const body = {} as Element
  const documentElement = { getBoundingClientRect: () => ({ height: height?.value ?? 0 }) } as Element
  const win: HostWindow = {
    addEventListener: (type, listener) => target.addEventListener(type, listener as EventListener),
    parent: { postMessage: (message) => posted.push(message) },
    ...(height && {
      document: { body, documentElement },
      ResizeObserver: FakeResizeObserver as unknown as typeof ResizeObserver,
    }),
  }
  // Delivers a message as if posted by `source` (default: the parent, i.e. the host).
  const hostSends = (data: unknown, ports: MessagePort[] = [], source: unknown = win.parent) => {
    const event = new MessageEvent('message', { data, ports })
    Object.defineProperty(event, 'source', { value: source })
    return target.dispatchEvent(event)
  }
  return { win, posted, hostSends, observers, body }
}

// A window that is not inside an iframe: its parent is itself.
function topWindow() {
  const postMessage = jest.fn()
  const top = {
    addEventListener: jest.fn(),
    postMessage,
    document: { body: {} as Element, documentElement: {} as Element },
  }
  return { win: Object.assign(top, { parent: top }), postMessage }
}

describe('connectBridge', () => {
  // connectBridge logs the handshake; keep the test output quiet and let tests check the lines.
  let info: jest.SpiedFunction<typeof console.info>
  let warn: jest.SpiedFunction<typeof console.warn>
  let error: jest.SpiedFunction<typeof console.error>
  beforeEach(() => {
    info = jest.spyOn(console, 'info').mockImplementation(() => {})
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    error = jest.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    jest.restoreAllMocks()
  })
  // The lines logged at a level that contain the prefix and a keyword.
  const logged = (spy: jest.SpiedFunction<(...args: unknown[]) => void>, keyword: RegExp) =>
    spy.mock.calls.map((args) => args.map(String).join(' ')).filter((line) => line.startsWith('[connectBridge]') && keyword.test(line))

  it('uses the FakeHostBridge outside an iframe', async () => {
    const bridge = await connectBridge({ window: topWindow().win, acknowledges: false })
    expect(bridge).toBeInstanceOf(FakeHostBridge)
    expect(bridge.acknowledges).toBe(false)
  })

  it('announces the app, resolves with a LiveHostBridge on live-init, and sends nothing on the port itself', async () => {
    const { win, posted, hostSends } = iframeWindow()
    const { port1: host, port2 } = channel()
    let connected = false
    const connecting = connectBridge({ window: win }).then((bridge) => {
      connected = true
      return bridge
    })
    expect(posted).toEqual([{ action: 'app-loaded' }])
    hostSends({ action: 'something-else' })
    await Promise.resolve()
    expect(connected).toBe(false)
    hostSends({ action: 'live-init', locale: 'nl' }, [port2])

    const bridge = await connecting
    expect(bridge).toBeInstanceOf(LiveHostBridge)
    expect(bridge.acknowledges).toBe(true)
    expect((bridge as LiveHostBridge).locale).toBe('nl')
    // The app sends 'initialized' itself; the first message on the port is the donation.
    const sent = nextMessage(host)
    void bridge.send({ __type__: 'CommandSystemDonate', key: 'k', json_string: '{}' })
    expect(await sent).toMatchObject({ __type__: 'CommandSystemDonate', key: 'k' })
  })

  it('ignores a later live-init and keeps the first channel', async () => {
    const { win, hostSends } = iframeWindow()
    const first = channel()
    const second = channel()
    const connecting = connectBridge({ window: win })
    hostSends({ action: 'live-init', locale: 'nl' }, [first.port2])
    const bridge = await connecting
    const received: unknown[] = []
    second.port1.onmessage = (event) => { received.push(event.data) }
    const before = bridge.send({ __type__: 'CommandSystemDonate', key: 'before', json_string: '{}' })

    hostSends({ action: 'live-init', locale: 'nl' }, [second.port2])

    const sentBefore = nextMessage(first.port1)
    expect(await sentBefore).toMatchObject({ key: 'before' })
    const sentAfter = nextMessage(first.port1)
    void bridge.send({ __type__: 'CommandSystemDonate', key: 'after', json_string: '{}' })
    expect(await sentAfter).toMatchObject({ key: 'after' })
    first.port1.postMessage({ __type__: 'DonateSuccess', key: 'before', status: 201 })
    await expect(before).resolves.toEqual({ success: true, key: 'before', status: 201 })
    expect(received).toEqual([])
  })

  it('reports the height after app-loaded, so the host is already being listened to', async () => {
    const { win, posted, hostSends } = iframeWindow({ value: 720 })
    const connecting = connectBridge({ window: win })

    expect(posted).toEqual([{ action: 'app-loaded' }, { action: 'resize', height: 720 }])
    hostSends({ action: 'live-init', locale: 'nl' }, [channel().port2])
    await connecting
  })

  it('rejects when no live-init comes within 10 seconds, and ignores a later one', async () => {
    jest.useFakeTimers()
    try {
      const { win, hostSends } = iframeWindow()
      const connecting = connectBridge({ window: win })
      const outcome = connecting.then(
        () => 'connected',
        (error: Error) => error.message,
      )

      await jest.advanceTimersByTimeAsync(9_999)
      hostSends({ action: 'something-else' })
      await jest.advanceTimersByTimeAsync(1)
      hostSends({ action: 'live-init', locale: 'nl' }, [channel().port2])

      expect(await outcome).toBe('No live-init from the host within 10000 ms')
    } finally {
      jest.useRealTimers()
    }
  })

  it('ignores a live-init from another source, and rejects after the time-out', async () => {
    jest.useFakeTimers()
    try {
      const { win, hostSends } = iframeWindow()
      const connecting = connectBridge({ window: win })
      const outcome = connecting.then(
        () => 'connected',
        (error: Error) => error.message,
      )

      hostSends({ action: 'live-init', locale: 'nl' }, [channel().port2], {})
      hostSends({ action: 'live-init', locale: 'nl' }, [channel().port2], null)
      await jest.advanceTimersByTimeAsync(10_000)

      expect(await outcome).toBe('No live-init from the host within 10000 ms')
    } finally {
      jest.useRealTimers()
    }
  })

  it('does not replace the channel for a later live-init from another source', async () => {
    const { win, hostSends } = iframeWindow()
    const first = channel()
    const second = channel()
    const connecting = connectBridge({ window: win })
    hostSends({ action: 'live-init', locale: 'nl' }, [first.port2])
    const bridge = await connecting

    hostSends({ action: 'live-init', locale: 'nl' }, [second.port2], {})

    const sent = nextMessage(first.port1)
    void bridge.send({ __type__: 'CommandSystemDonate', key: 'k', json_string: '{}' })
    expect(await sent).toMatchObject({ key: 'k' })
  })

  it('clears the live-init time-out once connected', async () => {
    jest.useFakeTimers()
    try {
      const { win, hostSends } = iframeWindow()
      const connecting = connectBridge({ window: win })
      hostSends({ action: 'live-init', locale: 'nl' }, [channel().port2])
      await connecting

      expect(jest.getTimerCount()).toBe(0)
    } finally {
      jest.useRealTimers()
    }
  })

  it('waits the configured liveInitTimeoutMs for live-init', async () => {
    jest.useFakeTimers()
    try {
      const { win } = iframeWindow()
      let outcome: unknown
      void connectBridge({ window: win, liveInitTimeoutMs: 2_500 }).catch((error: Error) => (outcome = error.message))

      await jest.advanceTimersByTimeAsync(2_499)
      expect(outcome).toBeUndefined()
      await jest.advanceTimersByTimeAsync(1)
      expect(outcome).toBe('No live-init from the host within 2500 ms')
    } finally {
      jest.useRealTimers()
    }
  })

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('fails at once for an invalid liveInitTimeoutMs (%s)', async (value) => {
    const { win, posted } = iframeWindow()

    await expect(connectBridge({ window: win, liveInitTimeoutMs: value })).rejects.toThrow(/connectBridge: liveInitTimeoutMs/)
    await expect(connectBridge({ window: topWindow().win, liveInitTimeoutMs: value })).rejects.toThrow(
      /connectBridge: liveInitTimeoutMs/,
    )
    expect(posted).toEqual([])
  })

  describe('logs the handshake for troubleshooting', () => {
    it('logs the standalone FakeHostBridge', async () => {
      await connectBridge({ window: topWindow().win })

      expect(logged(info, /FakeHostBridge/)).toHaveLength(1)
    })

    it('logs app-loaded and the accepted live-init, and stays quiet about other messages', async () => {
      const { win, hostSends } = iframeWindow()
      const connecting = connectBridge({ window: win })
      hostSends({ action: 'something-else' })
      hostSends({ action: 'live-init', locale: 'nl' }, [channel().port2])
      await connecting

      expect(logged(info, /app-loaded/)).toHaveLength(1)
      expect(logged(info, /accepted/i)).toHaveLength(1)
      expect(warn).not.toHaveBeenCalled()
      expect(error).not.toHaveBeenCalled()
    })

    it('warns about a later live-init once connected', async () => {
      const { win, hostSends } = iframeWindow()
      const connecting = connectBridge({ window: win })
      hostSends({ action: 'live-init', locale: 'nl' }, [channel().port2])
      await connecting
      hostSends({ action: 'live-init', locale: 'nl' }, [channel().port2])

      expect(logged(warn, /ignor.*already connected/i)).toHaveLength(1)
      expect(logged(info, /replac/i)).toHaveLength(0)
    })

    it('warns about a live-init from another source and one without a port', async () => {
      const { win, hostSends } = iframeWindow()
      const connecting = connectBridge({ window: win })
      hostSends({ action: 'live-init', locale: 'nl' }, [channel().port2], {})
      hostSends({ action: 'live-init', locale: 'nl' })
      hostSends({ action: 'live-init', locale: 'nl' }, [channel().port2])
      await connecting

      expect(logged(warn, /ignor.*parent/i)).toHaveLength(1)
      expect(logged(warn, /ignor.*port/i)).toHaveLength(1)
    })

    it('logs the time-out as an error', async () => {
      jest.useFakeTimers()
      try {
        const { win } = iframeWindow()
        const outcome = connectBridge({ window: win, liveInitTimeoutMs: 500 }).catch(() => 'rejected')
        await jest.advanceTimersByTimeAsync(500)

        expect(await outcome).toBe('rejected')
        expect(logged(error, /500 ms/)).toHaveLength(1)
      } finally {
        jest.useRealTimers()
      }
    })
  })
})

describe('reportSize', () => {
  it('posts the height at the start and whenever the body changes size, until stopped', () => {
    const height = { value: 720 }
    const { win, posted, observers, body } = iframeWindow(height)

    const stop = reportSize(win)
    height.value = 900
    observers[0]!.callback()
    stop()

    expect(posted).toEqual([
      { action: 'resize', height: 720 },
      { action: 'resize', height: 900 },
    ])
    expect(observers[0]!.observed).toEqual([body])
    expect(observers[0]!.disconnected).toBe(true)
  })

  it('posts nothing outside an iframe', () => {
    const { win, postMessage } = topWindow()

    reportSize(win)

    expect(postMessage).not.toHaveBeenCalled()
  })
})
