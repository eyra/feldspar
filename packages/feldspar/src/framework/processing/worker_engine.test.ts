import WorkerProcessingEngine from './worker_engine'
import { Logger, LogLevel, LogForwarder } from '../logging'
import { Command, CommandSystemExit, Response, isCommandSystemExit } from '../types/commands'
import { CommandHandler } from '../types/modules'

class FakeWorker {
  onmessage: ((event: any) => void) | null = null
  onerror: ((error: any) => void) | null = null
  postMessage = (): void => {}
  terminate = (): void => {}
  addEventListener = (): void => {}
  removeEventListener = (): void => {}
  dispatchEvent = (): boolean => true
}

class FakeLogger implements Logger {
  entries: Array<{ level: LogLevel, message: string, context?: Record<string, unknown> }> = []
  log (level: LogLevel, message: string, context?: Record<string, unknown>): void {
    this.entries.push({ level, message, context })
  }
  flush (): void {}
}

class FakeHandler implements CommandHandler {
  async onCommand (_command: Command): Promise<Response> {
    return { __type__: 'Response', command: _command, payload: { __type__: 'PayloadVoid', value: undefined } }
  }
}

function makeEngine (): { engine: WorkerProcessingEngine, logger: FakeLogger, worker: FakeWorker } {
  const worker = new FakeWorker()
  const logger = new FakeLogger()
  const engine = new WorkerProcessingEngine('s1', 'en', worker as unknown as Worker, new FakeHandler(), logger)
  return { engine, logger, worker }
}

function exitInfo (error: string, locale = 'en', native = false): string {
  const { engine, worker } = makeEngine()
  engine.locale = locale
  const exits: CommandSystemExit[] = []
  engine.commandHandler = {
    async onCommand (command: Command): Promise<Response> {
      if (isCommandSystemExit(command)) exits.push(command)
      return { __type__: 'Response', command, payload: { __type__: 'PayloadVoid', value: undefined } }
    }
  }
  if (native) {
    worker.onerror?.({ message: error })
  } else {
    engine.handleEvent({ data: { eventType: 'error', error } })
  }
  expect(exits).toEqual([
    expect.objectContaining({ code: 1, info: expect.any(String) })
  ])
  return exits[0].info
}

describe('WorkerProcessingEngine.handleEvent', () => {
  it.each([
    'PythonError: Traceback (most recent call last):\n  File "script.py", line 1\nMemoryError: allocation failed\n',
    'PythonError: Traceback (most recent call last):\nOverflowError: Could not reserve memory block\n',
    'OverflowError: Maximum recursion level reached',
    'RuntimeError: memory access out of bounds'
  ])('uses the data-size guidance for the observed failure %s', error => {
    const generic = exitInfo('ValueError: invalid input')
    const sizeRelated = exitInfo('MemoryError')
    expect(sizeRelated).not.toBe(generic)
    expect(exitInfo(error)).toBe(sizeRelated)
  })

  it('recognizes the native browser wrapper around a WASM bounds failure', () => {
    expect(exitInfo('Uncaught RuntimeError: memory access out of bounds', 'en', true))
      .toBe(exitInfo('MemoryError'))
  })

  it.each([
    'ValueError: MemoryError in supplied text',
    'OverflowError: int too large to convert to float',
    'RuntimeError: unreachable',
    'MemoryError: earlier failure\n\nDuring handling of the above exception:\nTypeError: unrelated final failure'
  ])('keeps the generic exit for an unrelated failure %s', error => {
    expect(exitInfo(error)).toBe(exitInfo('ValueError: invalid input'))
  })

  it('localizes both failure categories using the participant locale', () => {
    const englishGeneric = exitInfo('ValueError')
    const englishSize = exitInfo('MemoryError')
    const dutchGeneric = exitInfo('ValueError', 'nl')
    const dutchSize = exitInfo('MemoryError', 'nl')
    const germanSize = exitInfo('MemoryError', 'de')
    expect(dutchGeneric).not.toBe(englishGeneric)
    expect(dutchSize).not.toBe(englishSize)
    expect(dutchSize).not.toBe(dutchGeneric)
    expect(germanSize).not.toBe(englishSize)
    expect(germanSize).not.toBe(dutchSize)
  })

  it('preserves leading BOMs and multibyte donation text when decoding worker bytes', () => {
    const { engine } = makeEngine()
    const received: Command[] = []
    engine.commandHandler = {
      async onCommand (command: Command): Promise<Response> {
        received.push(command)
        return { __type__: 'Response', command, payload: { __type__: 'PayloadVoid', value: undefined } }
      }
    }
    const command: Command = {
      __type__: 'CommandSystemDonate',
      key: '\uFEFFdonnées',
      json_string: JSON.stringify({ text: '日本語 — \u{1F680}', empty: '' })
    }
    const encoder = new TextEncoder()

    engine.handleEvent({
      data: {
        eventType: 'runCycleDone',
        scriptEvent: {
          __type__: encoder.encode(command.__type__),
          key: encoder.encode(command.key),
          json_string: encoder.encode(command.json_string)
        }
      }
    })

    expect(received).toEqual([command])
  })

  it('routes workerLog events through logger with the provided level', () => {
    const { engine, logger } = makeEngine()
    engine.handleEvent({ data: { eventType: 'workerLog', level: 'debug', message: 'starting cycle' } })
    expect(logger.entries).toContainEqual({ level: 'debug', message: 'starting cycle', context: undefined })
  })

  it('falls back to info for unknown workerLog levels', () => {
    const { engine, logger } = makeEngine()
    engine.handleEvent({ data: { eventType: 'workerLog', level: 'banana', message: 'oops' } })
    expect(logger.entries).toContainEqual({ level: 'info', message: 'oops', context: undefined })
  })

  it('accepts each valid LogLevel without falling back', () => {
    const { engine, logger } = makeEngine()
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
    for (const level of levels) {
      engine.handleEvent({ data: { eventType: 'workerLog', level, message: `at-${level}` } })
    }
    expect(logger.entries.map(e => e.level)).toEqual(levels)
  })

  it('reports a fatal failure before one abnormal exit and ignores late work', async () => {
    const { engine, worker } = makeEngine()
    const delivered: unknown[] = []
    engine.logger = new LogForwarder(entries => delivered.push(...entries))
    worker.postMessage = jest.fn()
    const pending: Command = { __type__: 'CommandSystemDonate', key: 'pending', json_string: '{}' }
    let finish!: (response: Response) => void
    engine.commandHandler = {
      onCommand (command: Command): Promise<Response> {
        delivered.push(command)
        return new Promise(resolve => {
          if (command === pending) finish = resolve
        })
      }
    }
    const nativeError = worker.onerror
    engine.handleEvent({ data: { eventType: 'runCycleDone', scriptEvent: pending } })
    engine.handleEvent({ data: { eventType: 'error', error: 'MemoryError: private input', stack: 'trace' } })
    engine.handleEvent({ data: { eventType: 'error', error: 'duplicate failure' } })
    nativeError?.({ message: 'duplicate native failure' })
    engine.handleEvent({ data: { eventType: 'runCycleDone', scriptEvent: pending } })
    finish({ __type__: 'Response', command: pending, payload: { __type__: 'PayloadVoid', value: undefined } })
    await Promise.resolve()

    const relevant = delivered.filter(value => {
      const item = value as { level?: string; __type__?: string }
      return item.level === 'error' || item.__type__ === 'CommandSystemExit'
    })
    expect(relevant).toEqual([
      expect.objectContaining({ level: 'error', message: expect.stringContaining('MemoryError'), context: { stack: 'trace' } }),
      expect.objectContaining({ __type__: 'CommandSystemExit', code: 1, info: expect.not.stringContaining('private input') })
    ])
    expect(delivered.filter(value => value === pending)).toHaveLength(1)
    expect(worker.postMessage).not.toHaveBeenCalled()
  })

  it('reports an uncaught worker failure before exiting without exposing its details', () => {
    const { engine, worker } = makeEngine()
    const delivered: unknown[] = []
    engine.logger = new LogForwarder(entries => delivered.push(...entries))
    engine.commandHandler = {
      async onCommand (command: Command): Promise<Response> {
        delivered.push(command)
        return { __type__: 'Response', command, payload: { __type__: 'PayloadVoid', value: undefined } }
      }
    }

    worker.onerror?.({ message: 'RuntimeError: private input', filename: 'worker.js', lineno: 4, colno: 2 })

    expect(delivered).toEqual([
      expect.objectContaining({ level: 'error', message: expect.stringContaining('RuntimeError') }),
      expect.objectContaining({ __type__: 'CommandSystemExit', code: 1, info: expect.not.stringContaining('private input') })
    ])
  })

  it('does not treat an error-level script log as a fatal runtime failure', () => {
    const { engine } = makeEngine()
    const delivered: unknown[] = []
    engine.logger = new LogForwarder(entries => delivered.push(...entries))
    engine.commandHandler = {
      async onCommand (command: Command): Promise<Response> {
        delivered.push(command)
        return { __type__: 'Response', command, payload: { __type__: 'PayloadVoid', value: undefined } }
      }
    }
    const command: Command = { __type__: 'CommandSystemDonate', key: 'continued', json_string: '{}' }

    engine.handleEvent({ data: { eventType: 'workerLog', level: 'error', message: 'Handled by script' } })
    engine.handleEvent({ data: { eventType: 'runCycleDone', scriptEvent: command } })

    expect(delivered).toContainEqual(expect.objectContaining({ level: 'error' }))
    expect(delivered).toContain(command)
    expect(delivered).not.toContainEqual(expect.objectContaining({ __type__: 'CommandSystemExit' }))
  })

  it('logs a warn for an unsupported event type', () => {
    const { engine, logger } = makeEngine()
    engine.handleEvent({ data: { eventType: 'mysteryEvent' } })
    expect(logger.entries).toContainEqual({
      level: 'warn',
      message: 'Received unsupported worker event: mysteryEvent',
      context: undefined,
    })
  })
})
