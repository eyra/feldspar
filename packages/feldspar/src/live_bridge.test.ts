import { MessageChannel, MessagePort as NodeMessagePort } from 'node:worker_threads'
import { LiveBridge } from './live_bridge'
import CommandRouter from './framework/command_router'
import type ReactEngine from './framework/visualization/react/engine'
import type { CommandSystemDonate, CommandSystemEvent, CommandUIRender, Response } from './framework/types/commands'

const attempt = ' opaque/attempt:001 '
const optIn = { attempt_id: attempt }
const ready = { __type__: 'LivenessReady', ...optIn }
const ping = (sequence: number) => ({ __type__: 'LivenessPing', ...optIn, sequence })
const pong = (sequence: number) => ({ __type__: 'LivenessPong', ...optIn, sequence })
const donation: CommandSystemDonate = { __type__: 'CommandSystemDonate', key: 'example', json_string: '{"value":1}' }
const systemEvent: CommandSystemEvent = { __type__: 'CommandSystemEvent', name: 'finished' }

class WindowHarness {
  parent = {} as Window
  private listeners = new Set<(event: MessageEvent) => void>()

  addEventListener (type: string, listener: (event: MessageEvent) => void): void {
    if (type === 'message') this.listeners.add(listener)
  }

  removeEventListener (type: string, listener: (event: MessageEvent) => void): void {
    if (type === 'message') this.listeners.delete(listener)
  }

  get window (): Window {
    return this as unknown as Window
  }

  message (data: unknown, ports: MessagePort[], source: Window | null = this.parent): void {
    const event = { data, ports, source } as unknown as MessageEvent
    for (const listener of [...this.listeners]) listener(event)
  }
}

interface Channel {
  iframe: MessagePort
  host: NodeMessagePort
  messages: unknown[]
  closed: Promise<void>
  until: (predicate: (message: Record<string, unknown>) => boolean) => Promise<void>
  deliver: (message: unknown) => Promise<void>
}

const cleanups: Array<() => void> = []
const channelClosures: Array<Promise<void>> = []

function channel (): Channel {
  const { port1, port2 } = new MessageChannel()
  const messages: unknown[] = []
  port2.on('message', message => messages.push(message))
  const closed = new Promise<void>(resolve => port2.once('close', resolve))
  const iframeClosed = new Promise<void>(resolve => port1.once('close', resolve))
  channelClosures.push(closed, iframeClosed)
  cleanups.push(() => { port1.close(); port2.close() })
  return {
    iframe: port1 as unknown as MessagePort,
    host: port2,
    messages,
    closed,
    until: async predicate => {
      const matches = (message: unknown): boolean =>
        typeof message === 'object' && message !== null && predicate(message as Record<string, unknown>)
      if (messages.some(matches)) return
      await new Promise<void>(resolve => {
        const listener = (message: unknown): void => {
          if (matches(message)) {
            port2.off('message', listener)
            resolve()
          }
        }
        port2.on('message', listener)
      })
    },
    // Observe delivery on the real receiving port when no liveness reply is expected.
    deliver: async message => {
      const delivered = new Promise<void>(resolve => port1.once('message', () => resolve()))
      port2.postMessage(message)
      await delivered
    },
  }
}

function bridge (connection: Channel, liveness: unknown = optIn): LiveBridge {
  const instance = new LiveBridge(connection.iframe, liveness)
  cleanups.push(() => instance.dispose())
  return instance
}

function register (window: WindowHarness, callback: Parameters<typeof LiveBridge.create>[1]): () => void {
  const dispose = LiveBridge.create(window.window, callback)
  cleanups.push(dispose)
  return dispose
}

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup()
  await Promise.all(channelClosures.splice(0))
})

describe('LiveBridge liveness protocol', () => {
  it('announces the opaque attempt and echoes both sequence bounds and retransmissions', async () => {
    const connection = channel()
    bridge(connection)
    await connection.until(message => message.__type__ === 'LivenessReady')

    for (const sequence of [1, 2147483647, 1, 2]) connection.host.postMessage(ping(sequence))
    await connection.until(message => message.__type__ === 'LivenessPong' && message.sequence === 2)

    expect(connection.messages).toEqual([ready, pong(1), pong(2147483647), pong(1), pong(2)])
  })

  it('ignores malformed and other-attempt messages before a valid ping barrier', async () => {
    const connection = channel()
    bridge(connection)
    const malformed: unknown[] = [
      null, undefined, false, 'LivenessPing', [], {},
      { ...ping(1), __type__: 'LivenessReady' },
      { ...ping(1), __type__: 'LivenessPong' },
      { ...ping(1), __type__: 'UnknownMessage' },
      { ...ping(1), attempt_id: 'another-attempt' },
      { ...ping(1), attempt_id: '' },
      { ...ping(1), attempt_id: 1 },
      { __type__: 'LivenessPing', sequence: 1 },
      { __type__: 'LivenessPing', ...optIn },
      ...[0, -1, 2147483648, 1.5, NaN, Infinity, '1', null, true].map(sequence => ({ ...ping(1), sequence })),
    ]
    for (const message of malformed) connection.host.postMessage(message)
    connection.host.postMessage(ping(7))
    await connection.until(message => message.__type__ === 'LivenessPong' && message.sequence === 7)

    expect(connection.messages).toEqual([ready, pong(7)])
  })

  it.each([
    ['absent', undefined],
    ['null', null],
    ['non-object', 'enabled'],
    ['missing attempt', {}],
    ['empty attempt', { attempt_id: '' }],
    ['non-string attempt', { attempt_id: 123 }],
  ])('keeps ordinary initialization and commands working with %s opt-in', async (_name, liveness) => {
    const window = new WindowHarness()
    const connection = channel()
    let initialized: LiveBridge | undefined
    register(window, (instance, locale) => {
      expect(locale).toBe('nl')
      initialized = instance as LiveBridge
    })
    window.message({ action: 'live-init', locale: 'nl', liveness }, [connection.iframe])
    expect(initialized).toBeDefined()

    await connection.deliver(ping(1))
    initialized!.send(donation)
    initialized!.send(systemEvent)
    await connection.until(message => message.__type__ === 'CommandSystemEvent')

    expect(connection.messages).toEqual([donation, systemEvent])
  })

  it('answers independently of pending application work without forwarding or resolving it', async () => {
    const connection = channel()
    const instance = bridge(connection)
    let completeRender!: (response: Response) => void
    const pendingRender = new Promise<Response>(resolve => { completeRender = resolve })
    const router = new CommandRouter(instance, { render: () => pendingRender } as unknown as ReactEngine)
    const command: CommandUIRender = { __type__: 'CommandUIRender', page: { __type__: 'PropsUIPageEnd' } }
    let rendered = false
    const rendering = router.onCommand(command).then(response => { rendered = true; return response })

    // Existing donations resolve immediately; there is no donation acknowledgement protocol.
    await expect(router.onCommand(donation)).resolves.toEqual({
      __type__: 'Response', command: donation, payload: { __type__: 'PayloadVoid', value: undefined },
    })
    connection.host.postMessage(systemEvent)
    connection.host.postMessage({ __type__: 'Response', command, payload: { __type__: 'PayloadVoid' } })
    connection.host.postMessage(ping(9))
    await connection.until(message => message.__type__ === 'LivenessPong' && message.sequence === 9)

    expect(rendered).toBe(false)
    expect(connection.messages).toEqual([ready, donation, pong(9)])
    const response: Response = { __type__: 'Response', command, payload: { __type__: 'PayloadVoid', value: undefined } }
    completeRender(response)
    await expect(rendering).resolves.toEqual(response)
  })
})

describe('LiveBridge initialization and lifetime', () => {
  it('accepts only parent live-init messages with a nonempty locale and exactly one port', async () => {
    const window = new WindowHarness()
    const rejected = channel()
    const accepted = channel()
    const callback = jest.fn()
    register(window, callback)
    const valid = { action: 'live-init', locale: 'en', liveness: optIn }

    for (const data of [null, undefined, 'live-init', {}, { ...valid, action: 'other' },
      { action: 'live-init' }, { ...valid, locale: '' }, { ...valid, locale: 1 }]) {
      window.message(data, [rejected.iframe])
    }
    window.message(valid, [rejected.iframe], null)
    window.message(valid, [rejected.iframe], {} as Window)
    window.message(valid, [rejected.iframe], window.window)
    window.message(valid, [])
    window.message(valid, [rejected.iframe, accepted.iframe])
    expect(callback).not.toHaveBeenCalled()

    window.message(valid, [accepted.iframe])
    await accepted.until(message => message.__type__ === 'LivenessReady')
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback.mock.calls[0][1]).toBe('en')
    accepted.host.postMessage(ping(1))
    await accepted.until(message => message.__type__ === 'LivenessPong')
    expect(accepted.messages).toEqual([ready, pong(1)])
  })

  it('replaces an active attempt and stops queued old replies while the new attempt remains live', async () => {
    const window = new WindowHarness()
    const old = channel()
    const current = channel()
    const bridges: LiveBridge[] = []
    register(window, instance => {
      // The old bridge must already be inert when the replacement callback runs.
      bridges[0]?.send(donation)
      bridges.push(instance as LiveBridge)
    })
    window.message({ action: 'live-init', locale: 'en', liveness: optIn }, [old.iframe])
    await old.until(message => message.__type__ === 'LivenessReady')

    old.host.postMessage(ping(1))
    const next = { attempt_id: 'next-attempt' }
    window.message({ action: 'live-init', locale: 'nl', liveness: next }, [current.iframe])
    await old.closed
    bridges[0].send(donation)
    bridges[0].sendLogs([{ level: 'info', message: 'stale', timestamp: '2026-01-01T00:00:00Z' }])
    current.host.postMessage({ ...ping(3), ...next })
    await current.until(message => message.__type__ === 'LivenessPong')

    expect(bridges).toHaveLength(2)
    expect(old.messages).toEqual([ready])
    expect(current.messages).toEqual([
      { __type__: 'LivenessReady', ...next },
      { __type__: 'LivenessPong', ...next, sequence: 3 },
    ])
  })

  it('does not let an obsolete registration disposer tear down its replacement', async () => {
    const window = new WindowHarness()
    const old = channel()
    const current = channel()
    const oldCallback = jest.fn()
    const currentCallback = jest.fn()
    const disposeOld = register(window, oldCallback)
    window.message({ action: 'live-init', locale: 'en', liveness: optIn }, [old.iframe])
    await old.until(message => message.__type__ === 'LivenessReady')

    const disposeCurrent = register(window, currentCallback)
    await old.closed
    disposeOld()
    window.message({ action: 'live-init', locale: 'en', liveness: optIn }, [current.iframe])
    await current.until(message => message.__type__ === 'LivenessReady')
    disposeOld()
    current.host.postMessage(ping(4))
    await current.until(message => message.__type__ === 'LivenessPong')
    expect(oldCallback).toHaveBeenCalledTimes(1)
    expect(currentCallback).toHaveBeenCalledTimes(1)
    expect(current.messages).toEqual([ready, pong(4)])

    disposeCurrent()
    await current.closed
    const ignored = channel()
    window.message({ action: 'live-init', locale: 'en', liveness: optIn }, [ignored.iframe])
    expect(currentCallback).toHaveBeenCalledTimes(1)
  })

  it('closes a disposed bridge and ignores queued pings, later commands and logs', async () => {
    const connection = channel()
    const instance = bridge(connection)
    await connection.until(message => message.__type__ === 'LivenessReady')
    connection.host.postMessage(ping(1))
    instance.dispose()
    instance.dispose()
    instance.send(donation)
    instance.sendLogs([{ level: 'info', message: 'after disposal', timestamp: '2026-01-01T00:00:00Z' }])
    await connection.closed

    expect(connection.messages).toEqual([ready])
  })

  it('delivers system exit before closing and suppresses subsequent traffic', async () => {
    const connection = channel()
    const instance = bridge(connection)
    await connection.until(message => message.__type__ === 'LivenessReady')
    const exit = { __type__: 'CommandSystemExit' as const, code: 0, info: 'done' }
    connection.host.postMessage(ping(1))
    instance.send(exit)
    instance.send(systemEvent)
    instance.sendLogs([{ level: 'info', message: 'after exit', timestamp: '2026-01-01T00:00:00Z' }])
    await connection.closed

    expect(connection.messages).toEqual([ready, exit])
  })
})
