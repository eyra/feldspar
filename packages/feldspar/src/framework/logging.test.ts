import { LogLevel, Logger, WindowLogSource } from './logging'

describe('WindowLogSource', () => {
  const logged: { level: LogLevel, message: string }[] = []
  const logger: Logger = { log: (level, message) => { logged.push({ level, message }) }, flush: () => {} }
  const windowTarget = new EventTarget()

  beforeAll(() => {
    ;(globalThis as any).window = windowTarget
    new WindowLogSource(logger)
  })
  afterAll(() => { delete (globalThis as any).window })
  beforeEach(() => { logged.length = 0 })

  const windowError = (message: string): void => {
    windowTarget.dispatchEvent(Object.assign(new Event('error'), { message }))
  }

  it('does not forward the harmless ResizeObserver loop notification', () => {
    windowError('ResizeObserver loop completed with undelivered notifications.')
    expect(logged).toEqual([])
  })

  it('forwards every other window error as error', () => {
    windowError('Uncaught TypeError: x is undefined')
    windowError('ResizeObserver loop completed with undelivered notifications. And more')
    expect(logged).toEqual([
      { level: 'error', message: 'Uncaught TypeError: x is undefined' },
      { level: 'error', message: 'ResizeObserver loop completed with undelivered notifications. And more' },
    ])
  })
})
