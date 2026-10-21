import type { CommandSystem } from './commands.js'
import type { ResponseSystemDonate } from './answers.js'
import type { LogEntry } from './logging.js'

export interface Bridge {
  send: (command: CommandSystem) => void
  sendLogs: (entries: LogEntry[]) => void
}

// A bridge that gives the host's answer to a donation (see connectBridge). Bridge stays as
// it is for the apps that use LiveBridge.create.
export interface HostBridge {
  // Resolves a donation with the host's answer (DonateSuccess or DonateError), and any other
  // command with undefined once sent.
  send: (command: CommandSystem) => Promise<ResponseSystemDonate | undefined>
}
