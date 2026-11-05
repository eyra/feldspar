import React, { JSX } from 'react'
import { Spinner as PrismSpinner } from '@novasoftwarefoundation/prism-react'
import { Weak } from '../../../../helpers'
import { PropsUISpinner } from '../../../../types/elements'

export const Spinner = ({ spinning = true, color = 'light' }: Weak<PropsUISpinner>): JSX.Element => (
  spinning ? <PrismSpinner id="spinner" size={16} variant={color === 'dark' ? 'accent' : 'inverse'} aria-hidden="true" /> : <></>
)
