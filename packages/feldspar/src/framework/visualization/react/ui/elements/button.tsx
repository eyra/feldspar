import React, { JSX } from 'react'
import { Button, type ButtonTone } from '@novasoftwarefoundation/prism-react'
import { Weak } from '../../../../helpers'
import { PropsUIButtonBack, PropsUIButtonForward, PropsUIButtonIcon, PropsUIButtonIconBack, PropsUIButtonIconForward, PropsUIButtonIconLabel, PropsUIButtonLabel, PropsUIButtonPrimary, PropsUIButtonSecundary } from '../../../../types/elements'
import BackSvg from '../../../../../assets/images/back.svg'
import ForwardSvg from '../../../../../assets/images/forward.svg'

// Keep Python-supplied color classes compatible while letting Prism own built-in tones.
function toneFor(color: string | undefined, fallback: ButtonTone): ButtonTone {
  if (color?.includes('tertiary')) return 'highlight'
  if (color?.includes('delete') || color?.includes('error')) return 'danger'
  if (color?.includes('success')) return 'success'
  if (color?.includes('warning')) return 'warning'
  if (color?.includes('primary')) return 'accent'
  return fallback
}

export const PrimaryButton = ({ label, spinning = false, enabled = true, color, onClick }: Weak<PropsUIButtonPrimary>): JSX.Element => (
  <Button type="button" variant="primary" tone={toneFor(color, 'accent')} className={color}
    disabled={!enabled || spinning} loading={spinning} aria-busy={spinning || undefined} onClick={onClick}>
    <span id="confirm-button">{label}</span>
  </Button>
)
export const SecondaryButton = ({ label, color, onClick }: Weak<PropsUIButtonSecundary>): JSX.Element => (
  <Button type="button" variant="secondary" tone={toneFor(color, 'danger')} className={color} onClick={onClick}>{label}</Button>
)
export const BackButton = ({ label, onClick }: Weak<PropsUIButtonBack>): JSX.Element => <IconLabelButton icon={BackSvg} label={label} onClick={onClick} />
export const ForwardButton = ({ label, onClick }: Weak<PropsUIButtonForward>): JSX.Element => <IconLabelButton icon={ForwardSvg} label={label} onClick={onClick} alignment="right" />
export const BackIconButton = ({ onClick, ariaLabel = 'Previous page' }: Weak<PropsUIButtonIconBack> & { ariaLabel?: string }): JSX.Element => <IconButton icon={BackSvg} ariaLabel={ariaLabel} onClick={onClick} />
export const ForwardIconButton = ({ onClick, ariaLabel = 'Next page' }: Weak<PropsUIButtonIconForward> & { ariaLabel?: string }): JSX.Element => <IconButton icon={ForwardSvg} ariaLabel={ariaLabel} onClick={onClick} />
export const IconButton = ({ icon, onClick, ariaLabel }: Weak<PropsUIButtonIcon> & { ariaLabel?: string }): JSX.Element => (
  <Button type="button" variant="icon" tone="neutral" aria-label={ariaLabel} onClick={onClick} icon={<img src={icon} alt="" />} />
)
export const IconLabelButton = ({ icon, label, color, alignment = 'left', onClick }: Weak<PropsUIButtonIconLabel>): JSX.Element => (
  <Button type="button" variant="text" padded={false} tone={toneFor(color, 'neutral')} className={color} onClick={onClick}
    icon={<img src={icon} alt="" />} iconPosition={alignment === 'left' ? 'start' : 'end'}>{label}</Button>
)
export const LabelButton = ({ label, color, onClick }: Weak<PropsUIButtonLabel>): JSX.Element => (
  <Button type="button" variant="text" tone={toneFor(color, 'neutral')} className={color} onClick={onClick}><span id="confirm-button">{label}</span></Button>
)
