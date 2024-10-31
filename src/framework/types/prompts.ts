import { isInstanceOf } from '../helpers'
import { PropsUIRadioItem, Text } from './elements'

export type PropsUIPrompt =
  PropsUIPromptFileInput |
  PropsUIPromptProgress |
  PropsUIPromptRadioInput |
  PropsUIPromptConsentForm |
  PropsUIPromptConfirm

export function isPropsUIPrompt (arg: any): arg is PropsUIPrompt {
  return isPropsUIPromptFileInput(arg) ||
    isPropsUIPromptRadioInput(arg) ||
    isPropsUIPromptConsentForm(arg)
}

export interface PropsUIPromptConfirm {
  __type__: 'PropsUIPromptConfirm'
  text: Text
  ok: Text
  cancel: Text
}
export function isPropsUIPromptConfirm (arg: any): arg is PropsUIPromptConfirm {
  return isInstanceOf<PropsUIPromptConfirm>(arg, 'PropsUIPromptConfirm', ['text', 'ok', 'cancel'])
}

export interface PropsUIPromptFileInput {
  __type__: 'PropsUIPromptFileInput'
  description: Text
  extensions: string
}
export function isPropsUIPromptFileInput (arg: any): arg is PropsUIPromptFileInput {
  return isInstanceOf<PropsUIPromptFileInput>(arg, 'PropsUIPromptFileInput', ['description', 'extensions'])
}

export interface PropsUIPromptProgress {
  __type__: 'PropsUIPromptProgress'
  description: Text
  message: string
  percentage?: number
}
export function isPropsUIPromptProgress (arg: any): arg is PropsUIPromptProgress {
  return isInstanceOf<PropsUIPromptProgress>(arg, 'PropsUIPromptProgress', ['description', 'message'])
}

export interface PropsUIPromptRadioInput {
  __type__: 'PropsUIPromptRadioInput'
  title: Text
  description: Text
  items: PropsUIRadioItem[]
}
export function isPropsUIPromptRadioInput (arg: any): arg is PropsUIPromptRadioInput {
  return isInstanceOf<PropsUIPromptRadioInput>(arg, 'PropsUIPromptRadioInput', ['title', 'description', 'items'])
}
export interface PropsUIPromptConsentForm {
  __type__: 'PropsUIPromptConsentForm'
  description?: Text
  donateQuestion?: Text
  donateButton?: Text
  id: string
  tables: PropsUIPromptConsentFormTable[]
  metaTables: PropsUIPromptConsentFormTable[]
}
export function isPropsUIPromptConsentForm (arg: any): arg is PropsUIPromptConsentForm {
  return isInstanceOf<PropsUIPromptConsentForm>(arg, 'PropsUIPromptConsentForm', ['id', 'tables', 'metaTables'])
}

export interface PropsUIPromptConsentFormTable {
  __type__: 'PropsUIPromptConsentFormTable'
  id: string
  title: Text
  description: Text
  data_frame: any
}
export function isPropsUIPromptConsentFormTable (arg: any): arg is PropsUIPromptConsentFormTable {
  return isInstanceOf<PropsUIPromptConsentFormTable>(arg, 'PropsUIPromptConsentFormTable', ['id', 'title', 'description', 'data_frame'])
}
