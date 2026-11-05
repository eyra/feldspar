import type { ButtonTone } from '@novasoftwarefoundation/prism-react'
import type { Weak } from '../../src/framework/helpers'
import type { PropsUIButtonPrimary, PropsUIButtonSecundary, PropsUIButtonIconLabel, PropsUIButtonLabel } from '../../src/framework/types/elements'

const action = { label: 'Continue', onClick() {} }
const primary: Weak<PropsUIButtonPrimary> = { ...action, tone: 'success' }
const secondary: Weak<PropsUIButtonSecundary> = { ...action, tone: 'warning' }
const label: Weak<PropsUIButtonLabel> = { ...action, tone: 'neutral' }
const iconLabel: Weak<PropsUIButtonIconLabel> = { ...action, icon: 'undo.svg', tone: 'accent' }
const defaultTone: Weak<PropsUIButtonPrimary> = action
const prismTone: ButtonTone = primary.tone!
// @ts-expect-error raw Tailwind color classes are not button props
const legacy: Weak<PropsUIButtonPrimary> = { ...action, color: 'bg-success text-white' }
// @ts-expect-error tones come from Prism's contract
const invalidTone: Weak<PropsUIButtonPrimary> = { ...action, tone: 'green' }
void [primary, secondary, label, iconLabel, defaultTone, prismTone, legacy, invalidTone]
