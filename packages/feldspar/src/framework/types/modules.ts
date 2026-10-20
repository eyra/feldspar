import { Command, Response } from './commands'

export type { Bridge } from '../bridge'

export interface CommandHandler {
  onCommand: (command: Command) => Promise<Response>
}
