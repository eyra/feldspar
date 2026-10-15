import { LiveBridge } from './index.js'

function nextMessage(port: MessagePort): Promise<unknown> {
  return new Promise((resolve) => {
    port.onmessage = (event) => resolve(event.data)
  })
}

describe('LiveBridge', () => {
  beforeEach(() => {
    LiveBridge.initialized = false
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => jest.restoreAllMocks())

  it('delivers a Donate command over the MessageChannel unchanged', async () => {
    const { port1, port2 } = new MessageChannel()
    const received = nextMessage(port2)
    const command = { __type__: 'CommandSystemDonate', key: 'run1/summary', json_string: '{"a":1}' } as const

    new LiveBridge(port1).send(command)

    expect(await received).toEqual(command)
    port1.close()
    port2.close()
  })

  it('does not send values that are not system commands', () => {
    const { port1, port2 } = new MessageChannel()
    const postMessage = jest.spyOn(port1, 'postMessage')

    new LiveBridge(port1).send({ __type__: 'Nonsense' } as never)

    expect(postMessage).not.toHaveBeenCalled()
    port1.close()
    port2.close()
  })

  it('creates the bridge once on live-init and ignores later live-init messages', () => {
    const { port1, port2 } = new MessageChannel()
    const listeners: Array<(event: unknown) => void> = []
    const fakeWindow = { addEventListener: (_: string, l: (event: unknown) => void) => listeners.push(l) } as unknown as Window
    const callback = jest.fn()

    LiveBridge.create(fakeWindow, callback)
    const init = { data: { action: 'live-init', locale: 'nl' }, ports: [port1] }
    listeners[0](init)
    listeners[0](init)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback.mock.calls[0][0]).toBeInstanceOf(LiveBridge)
    expect(callback.mock.calls[0][1]).toBe('nl')
    port1.close()
    port2.close()
  })

  it('ignores messages that are not live-init', () => {
    const listeners: Array<(event: unknown) => void> = []
    const fakeWindow = { addEventListener: (_: string, l: (event: unknown) => void) => listeners.push(l) } as unknown as Window
    const callback = jest.fn()

    LiveBridge.create(fakeWindow, callback)
    listeners[0]({ data: { action: 'something-else' }, ports: [] })

    expect(callback).not.toHaveBeenCalled()
  })
})
