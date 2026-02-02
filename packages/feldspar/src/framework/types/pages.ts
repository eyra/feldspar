import { isInstanceOf } from '../helpers'
import { PromptFactory } from '../visualization/react/ui/prompts/factory'
import { PropsUIHeader } from './elements'
import { PropsUIPromptFileInput, PropsUIPromptProgress, PropsUIPromptConfirm, PropsUIPromptConsentForm, PropsUIPromptRadioInput } from './prompts'

export type PropsUIPage =
  PropsUIPageSplashScreen |
  PropsUIPageDataSubmission |
  PropsUIPageEnd |
  PropsUIPageError

export function isPropsUIPage (arg: any): arg is PropsUIPage {
  return (
    isPropsUIPageDataSubmission(arg) ||
    isPropsUIPageEnd(arg) ||
    isPropsUIPageError(arg)
  )
}

export interface PropsUIPageSplashScreen {
  __type__: 'PropsUIPageSplashScreen'
}

export interface PropsUIPageDataSubmission {
  __type__: 'PropsUIPageDataSubmission'
  platform: string
  header: PropsUIHeader
  body: (PropsUIPromptFileInput | PropsUIPromptProgress | PropsUIPromptConfirm | PropsUIPromptConsentForm | PropsUIPromptRadioInput)[]
  promptFactories?: PromptFactory[]
}
export function isPropsUIPageDataSubmission (arg: any): arg is PropsUIPageDataSubmission {
  return isInstanceOf<PropsUIPageDataSubmission>(arg, 'PropsUIPageDataSubmission', ['platform', 'header', 'body'])
}

export interface PropsUIPageEnd {
  __type__: 'PropsUIPageEnd'
}
export function isPropsUIPageEnd (arg: any): arg is PropsUIPageEnd {
  return isInstanceOf<PropsUIPageEnd>(arg, 'PropsUIPageEnd', [])
}

export interface PropsUIPageError {
  __type__: 'PropsUIPageError'
  message: string
}
export function isPropsUIPageError (arg: any): arg is PropsUIPageError {
  return isInstanceOf<PropsUIPageError>(arg, 'PropsUIPageError', ['message'])
}
