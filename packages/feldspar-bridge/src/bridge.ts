import type { CommandSystem } from './commands.js'
import type { LogEntry } from './logging.js'

export interface Bridge {
  send: (command: CommandSystem) => void
  sendLogs: (entries: LogEntry[]) => void
}
