import { FakeHostBridge, KEEPALIVE_MAX_BYTES } from './index.js'

const donate = { __type__: 'CommandSystemDonate', key: 'k', json_string: '{}' } as const

describe('FakeHostBridge', () => {
  const respondWith = (status: number) => jest.fn(async () => new Response('{}', { status }))

  it('posts a donation as { key, data } to the data-submission endpoint', async () => {
    const fetch = respondWith(200)
    const bridge = new FakeHostBridge({ fetch })

    const answer = await bridge.send({ __type__: 'CommandSystemDonate', key: 'run-1/session', json_string: '{"a":1}' })

    expect(answer).toEqual({ success: true, key: 'run-1/session', status: 200 })
    expect(fetch).toHaveBeenCalledWith('/data-submission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'run-1/session', data: '{"a":1}' }),
      keepalive: true,
    })
  })

  it('keeps a donation alive while the page unloads, unless its body is over the keepalive limit', async () => {
    // A donation sent from pagehide (the summary) is otherwise cancelled with the page.
    const fetch = jest.fn<Promise<Response>, [string, RequestInit]>(async () => new Response('{}', { status: 200 }))
    const bridge = new FakeHostBridge({ fetch })
    const body = (data: string) => JSON.stringify({ key: 'k', data })
    const fitting = 'x'.repeat(KEEPALIVE_MAX_BYTES - body('').length)

    await bridge.send({ ...donate, json_string: fitting })
    await bridge.send({ ...donate, json_string: `${fitting}x` })
    // Bytes, not characters: "é" is two bytes in UTF-8.
    await bridge.send({ ...donate, json_string: `${fitting.slice(1)}é` })

    expect(fetch.mock.calls.map(([, init]) => [new TextEncoder().encode(init.body as string).length, init.keepalive])).toEqual([
      [KEEPALIVE_MAX_BYTES, true],
      [KEEPALIVE_MAX_BYTES + 1, false],
      [KEEPALIVE_MAX_BYTES + 1, false],
    ])
  })

  it('keeps the keepalive requests in flight together within the limit, and frees their share once they settle', async () => {
    // Each request stays in flight until the test settles it: with a response, or with a network error.
    const pending: ((response: Response | Error) => void)[] = []
    const fetch = jest.fn<Promise<Response>, [string, RequestInit]>(
      () => new Promise((resolve, reject) => void pending.push((outcome) => (outcome instanceof Error ? reject(outcome) : resolve(outcome)))),
    )
    const bridge = new FakeHostBridge({ fetch })
    const large = (key: string) => ({ __type__: 'CommandSystemDonate', key, json_string: 'x'.repeat(40 * 1024) }) as const
    const keepalive = () => fetch.mock.calls.map(([, init]) => init.keepalive)

    const first = bridge.send(large('k1'))
    const second = bridge.send(large('k2'))
    expect(keepalive()).toEqual([true, false])

    pending[0]!(new Response('{}', { status: 200 }))
    await first
    const third = bridge.send(large('k3'))
    expect(keepalive()).toEqual([true, false, true])

    // A request that fails frees its share as well.
    pending[2]!(new TypeError('Failed to fetch'))
    await third
    void bridge.send(large('k4'))
    expect(keepalive()).toEqual([true, false, true, true])
    pending[1]!(new Response('{}', { status: 200 }))
    await second
  })

  it('rejects a second send for a key while the first is in flight, without posting it', async () => {
    let answer: (response: Response) => void = () => {}
    const fetch = jest.fn<Promise<Response>, [string, RequestInit]>(() => new Promise((resolve) => { answer = resolve }))
    const bridge = new FakeHostBridge({ fetch })
    const first = bridge.send(donate)
    const second = bridge.send(donate)

    await expect(second).rejects.toThrow(/FakeHostBridge: a donation for key k is still waiting/)
    expect(fetch).toHaveBeenCalledTimes(1)
    answer(new Response('{}', { status: 200 }))
    await expect(first).resolves.toMatchObject({ success: true })
    // Answered: the key can be sent again.
    const again = bridge.send(donate)
    answer(new Response('{}', { status: 200 }))
    await expect(again).resolves.toMatchObject({ success: true })
  })

  it('calls the global fetch the way a browser accepts it', async () => {
    // A browser throws "Illegal invocation" when fetch is called as a method of another object.
    const fetch = jest.fn(function (this: unknown) {
      if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation')
      return Promise.resolve(new Response('{}', { status: 200 }))
    })
    const original = globalThis.fetch
    globalThis.fetch = fetch as unknown as typeof globalThis.fetch
    try {
      expect(await new FakeHostBridge().send(donate)).toEqual({ success: true, key: 'k', status: 200 })
    } finally {
      globalThis.fetch = original
    }
  })

  it('answers with an error for an HTTP error or a network failure', async () => {
    expect(await new FakeHostBridge({ fetch: respondWith(500) }).send(donate)).toEqual({
      success: false,
      key: 'k',
      status: 500,
      error: 'HTTP 500',
    })
    const offline = jest.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(await new FakeHostBridge({ fetch: offline }).send(donate)).toEqual({
      success: false,
      key: 'k',
      status: 0,
      error: 'Failed to fetch',
    })
  })

  it('posts nothing for an exit', async () => {
    const fetch = respondWith(200)
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})

    await new FakeHostBridge({ fetch }).send({ __type__: 'CommandSystemExit', code: 0, info: 'completed' })

    expect(fetch).not.toHaveBeenCalled()
    log.mockRestore()
  })
})

