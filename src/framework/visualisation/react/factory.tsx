
import { EndPage } from './ui/pages/end_page'
import { isPropsUIPageEnd, isPropsUIPageDonation, PropsUIPage } from '../../types/pages'
import { DonationPage } from './ui/pages/donation_page'
import { Payload } from '../../types/commands'

export interface ReactFactoryContext {
  locale: string
  resolve?: (payload: Payload) => void
}

export default class ReactFactory {
  createPage (page: PropsUIPage, context: ReactFactoryContext): JSX.Element {
    if (isPropsUIPageEnd(page)) {
      return <EndPage {...page} {...context} />
    }
    if (isPropsUIPageDonation(page)) {
      return <DonationPage {...page} {...context} />
    }
    throw TypeError('Unknown page: ' + JSON.stringify(page))
  }
}
