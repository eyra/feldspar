import { Command, Response, CommandSystem } from './commands'

export interface ResponseSystemDonate {
  success: boolean
  key: string
  status: number
  error?: string
}

export interface Bridge {
  send: (command: CommandSystem) => Promise<ResponseSystemDonate | void>
}

export interface CommandHandler {
  onCommand: (command: Command) => Promise<Response>
}
