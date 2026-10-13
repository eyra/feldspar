import { isInstanceOf } from './guards.js'

export type CommandSystem =
  CommandSystemDonate |
  CommandSystemEvent |
  CommandSystemExit |
  CommandSystemLog

export function isCommandSystem (arg: any): arg is CommandSystem {
  return isCommandSystemDonate(arg) || isCommandSystemEvent(arg) || isCommandSystemExit(arg) || isCommandSystemLog(arg)
}

export interface CommandSystemDonate {
  __type__: 'CommandSystemDonate'
  key: string
  json_string: string
}
export function isCommandSystemDonate (arg: any): arg is CommandSystemDonate {
  return isInstanceOf<CommandSystemDonate>(arg, 'CommandSystemDonate', ['key', 'json_string'])
}

export interface CommandSystemEvent {
  __type__: 'CommandSystemEvent'
  name: string
}
export function isCommandSystemEvent (arg: any): arg is CommandSystemEvent {
  return isInstanceOf<CommandSystemEvent>(arg, 'CommandSystemEvent', ['name'])
}

export interface CommandSystemExit {
  __type__: 'CommandSystemExit'
  code: number
  info: string
}
export function isCommandSystemExit (arg: any): arg is CommandSystemExit {
  return isInstanceOf<CommandSystemExit>(arg, 'CommandSystemExit', ['code', 'info'])
}

export interface CommandSystemLog {
  __type__: 'CommandSystemLog'
  level: string
  message: string
  /** @deprecated Temporary for backwards compatibility, will be removed in future */
  json_string: string
}
export function isCommandSystemLog (arg: any): arg is CommandSystemLog {
  return isInstanceOf<CommandSystemLog>(arg, 'CommandSystemLog', ['level', 'message', 'json_string'])
}
