import { Command, Response, CommandSystem } from './commands'

export interface ProcessingEngine {
  start: () => void
  commandHandler: CommandHandler
  terminate: () => void
}

export interface Bridge {
  send: (command: CommandSystem) => void
}

export interface CommandHandler {
  onCommand: (command: Command) => Promise<Response>
}
