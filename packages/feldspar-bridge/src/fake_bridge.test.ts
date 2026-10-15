import { FakeBridge } from './index.js'

describe('FakeBridge', () => {
  const originalFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('posts a Donate command to /data-submission as { key, data }', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 })
    globalThis.fetch = fetchMock as unknown as typeof fetch
    jest.spyOn(console, 'log').mockImplementation(() => {})

    await new FakeBridge().handleDataSubmission({ __type__: 'CommandSystemDonate', key: 'run1/summary', json_string: '{"a":1}' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/data-submission')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ key: 'run1/summary', data: '{"a":1}' })
  })

  it('does not throw when the submission fails', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'log').mockImplementation(() => {})

    await expect(
      new FakeBridge().handleDataSubmission({ __type__: 'CommandSystemDonate', key: 'k', json_string: '{}' }),
    ).resolves.toBeUndefined()
  })

  it('accepts Exit, Log and Event commands without throwing', () => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
    const bridge = new FakeBridge()
    expect(() => bridge.send({ __type__: 'CommandSystemExit', code: 0, info: 'done' })).not.toThrow()
    expect(() => bridge.send({ __type__: 'CommandSystemLog', level: 'info', message: 'm', json_string: '{}' })).not.toThrow()
    expect(() => bridge.send({ __type__: 'CommandSystemEvent', name: 'e' })).not.toThrow()
  })
})
