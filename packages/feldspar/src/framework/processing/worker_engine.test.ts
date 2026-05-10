import WorkerProcessingEngine from './worker_engine'
import { Logger, LogLevel } from '../logging'
import { Command, Response } from '../types/commands'
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
  flushCount = 0
  log (level: LogLevel, message: string, context?: Record<string, unknown>): void {
    this.entries.push({ level, message, context })
  }
  flush (): void {
    this.flushCount++
  }
}

class FakeHandler implements CommandHandler {
  async onCommand (_command: Command): Promise<Response> {
    return { __type__: 'Response', command: _command, payload: { __type__: 'PayloadVoid', value: undefined } }
  }
}

function makeEngine (): { engine: WorkerProcessingEngine, logger: FakeLogger, worker: FakeWorker } {
  const worker = new FakeWorker()
  const logger = new FakeLogger()
  const engine = new WorkerProcessingEngine('s1', worker as unknown as Worker, new FakeHandler(), logger)
  return { engine, logger, worker }
}

describe('WorkerProcessingEngine.handleEvent', () => {
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

  it('routes worker error events as error log with stack context', () => {
    const { engine, logger } = makeEngine()
    engine.handleEvent({ data: { eventType: 'error', error: 'KeyError', stack: 'trace' } })
    expect(logger.entries).toContainEqual({
      level: 'error',
      message: 'Python error: KeyError',
      context: { stack: 'trace' },
    })
  })

  it('flushes the logger after handling each event', () => {
    const { engine, logger } = makeEngine()
    expect(logger.flushCount).toBe(0)
    engine.handleEvent({ data: { eventType: 'workerLog', level: 'info', message: 'one' } })
    expect(logger.flushCount).toBe(1)
    engine.handleEvent({ data: { eventType: 'error', error: 'boom', stack: '' } })
    expect(logger.flushCount).toBe(2)
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
