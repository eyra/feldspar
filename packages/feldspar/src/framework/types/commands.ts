import { isInstanceOf } from '../helpers'
import { isPropsUIPage, PropsUIPage } from './pages'
import { CommandSystem, isCommandSystem } from '../bridge'

export type {
  CommandSystem,
  CommandSystemDonate,
  CommandSystemEvent,
  CommandSystemExit,
  CommandSystemLog
} from '../bridge'
export {
  isCommandSystem,
  isCommandSystemDonate,
  isCommandSystemEvent,
  isCommandSystemExit,
  isCommandSystemLog
} from '../bridge'

export interface Table {
  __type__: 'Table'
  id: string
  title: Text
  data: any
}
export function isTable (arg: any): arg is Table {
  return isInstanceOf<Table>(arg, 'Table', ['id', 'title', 'data'])
}

export interface Response {
  __type__: 'Response'
  command: Command
  payload: Payload
}
export function isResponse (arg: any): arg is Response {
  return isInstanceOf<Response>(arg, 'Response', ['command', 'payload']) && isCommand(arg.command)
}

export type Payload =
  PayloadResolved |
  PayloadRejected

export type PayloadRejected =
  PayloadFalse |
  PayloadError

export interface PayloadFalse {
  __type__: 'PayloadFalse'
  value: false
}

export interface PayloadError {
  __type__: 'PayloadError'
  value: string
}

export type PayloadResolved =
  PayloadVoid |
  PayloadTrue |
  PayloadString |
  PayloadFile |
  PayloadJSON

export interface PayloadVoid {
  __type__: 'PayloadVoid'
  value: undefined
}

export interface PayloadTrue {
  __type__: 'PayloadTrue'
  value: true
}

export interface PayloadString {
  __type__: 'PayloadString'
  value: string
}

export interface PayloadFile {
  __type__: 'PayloadFile'
  value: File
}

export interface PayloadJSON {
  __type__: 'PayloadJSON'
  value: string
}
export function isPayloadJSON (arg: any): arg is PayloadJSON {
  return isInstanceOf<PayloadJSON>(arg, 'PayloadJSON', ['value'])
}

export type Command =
  CommandUI |
  CommandSystem

export function isCommand (arg: any): arg is Command {
  return isCommandUI(arg) || isCommandSystem(arg)
}

export type CommandUI =
  CommandUIRender

export function isCommandUI (arg: any): arg is CommandUI {
  return isCommandUIRender(arg)
}

export interface CommandUIRender {
  __type__: 'CommandUIRender'
  page: PropsUIPage
}
export function isCommandUIRender (arg: any): arg is CommandUIRender {
  return isInstanceOf<CommandUIRender>(arg, 'CommandUIRender', ['page']) && isPropsUIPage(arg.page)
}
