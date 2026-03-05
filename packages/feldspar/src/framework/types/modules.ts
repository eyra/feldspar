import { Command, Response, CommandSystem } from './commands'
import { LogEntry } from '../logging'

export interface Bridge {
  send: (command: CommandSystem) => void
  sendLogs: (entries: LogEntry[]) => void
}

export interface CommandHandler {
  onCommand: (command: Command) => Promise<Response>
}
