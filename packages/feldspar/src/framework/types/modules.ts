import { Command, Response, CommandSystem } from './commands'

export interface Bridge {
  send: (command: CommandSystem) => void
}

export interface CommandHandler {
  onCommand: (command: Command) => Promise<Response>
}
