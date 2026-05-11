export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVEL_SEVERITY: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

export interface LogEntry {
  level: LogLevel
  message: string
  context?: Record<string, unknown>
  timestamp: string
}

type FlushCallback = (entries: LogEntry[]) => void

export interface Logger {
  log(level: LogLevel, message: string, context?: Record<string, unknown>): void
  flush(): void
}

export class WindowLogSource {
  constructor(logger: Logger) {
    const memoryContext = (): Record<string, unknown> => {
      const perf = performance as any
      if (perf?.memory) {
        return {
          jsHeapSizeLimit: perf.memory.jsHeapSizeLimit,
          totalJSHeapSize: perf.memory.totalJSHeapSize,
          usedJSHeapSize: perf.memory.usedJSHeapSize,
        }
      }
      return {}
    }

    window.addEventListener('error', (event) => {
      logger.log('error', event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.toString(),
        ...memoryContext(),
      })
    })

    window.addEventListener('unhandledrejection', (event) => {
      logger.log('error', `Unhandled promise rejection: ${String(event.reason)}`, {
        reason: String(event.reason),
        ...memoryContext(),
      })
    })
  }
}

export class LogForwarder implements Logger {
  private buffer: LogEntry[] = []
  private readonly onFlush: FlushCallback
  private readonly minLevel: LogLevel

  constructor(onFlush: FlushCallback, minLevel: LogLevel = 'info') {
    this.onFlush = onFlush
    this.minLevel = minLevel
  }

  private capture(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LOG_LEVEL_SEVERITY[level] < LOG_LEVEL_SEVERITY[this.minLevel]) return
    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
    }
    this.buffer.push(entry)
    if (LOG_LEVEL_SEVERITY[level] >= LOG_LEVEL_SEVERITY['error']) {
      this.flush()
    }
  }

  log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    this.capture(level, message, context)
  }

  /**
   * Drains the buffer and delivers all pending entries to the onFlush
   * callback. Error-level entries trigger an automatic flush immediately, so those are
   * never delayed. All other levels rely on the caller.
   */
  flush(): void {
    if (this.buffer.length === 0) return
    const entries = [...this.buffer]
    this.buffer = []
    this.onFlush(entries)
  }
}
