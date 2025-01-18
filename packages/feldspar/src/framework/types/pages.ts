import { isInstanceOf } from '../helpers'
import { PropsUIHeader } from './elements'
import { PropsUIPromptFileInput, PropsUIPromptProgress, PropsUIPromptConfirm, PropsUIPromptConsentForm, PropsUIPromptRadioInput } from './prompts'

export type PropsUIPage =
  PropsUIPageSplashScreen |
  PropsUIPageDonation |
  PropsUIPageEnd

export function isPropsUIPage (arg: any): arg is PropsUIPage {
  return (
    isPropsUIPageDonation(arg) ||
    isPropsUIPageEnd(arg)
  )
}

export interface PropsUIPageSplashScreen {
  __type__: 'PropsUIPageSplashScreen'
}

export interface PropsUIPageDonation {
  __type__: 'PropsUIPageDonation'
  platform: string
  header: PropsUIHeader
  body: PropsUIPromptFileInput | PropsUIPromptProgress | PropsUIPromptConfirm | PropsUIPromptConsentForm | PropsUIPromptRadioInput
}
export function isPropsUIPageDonation (arg: any): arg is PropsUIPageDonation {
  return isInstanceOf<PropsUIPageDonation>(arg, 'PropsUIPageDonation', ['platform', 'header', 'body'])
}

export interface PropsUIPageEnd {
  __type__: 'PropsUIPageEnd'
}
export function isPropsUIPageEnd (arg: any): arg is PropsUIPageEnd {
  return isInstanceOf<PropsUIPageEnd>(arg, 'PropsUIPageEnd', [])
}
