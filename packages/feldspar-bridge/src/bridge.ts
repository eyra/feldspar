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
  // True when send() resolves a donation with the host's answer (DonateSuccess or
  // DonateError); false when the host does not answer and send() resolves once sent.
  readonly acknowledges: boolean
  send: (command: CommandSystem) => Promise<ResponseSystemDonate | undefined>
}

export interface HostBridgeOptions {
  // Whether to wait for the host's answers to donations. Default true: Next answers every
  // Donate. False is a fallback (fire-and-forget) for a host that does not answer.
  readonly acknowledges?: boolean
}
