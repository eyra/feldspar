import React, { JSX } from 'react'
import { Button } from '@novasoftwarefoundation/prism-react'
import { Weak } from '../../../../helpers'
import { PropsUIButtonBack, PropsUIButtonForward, PropsUIButtonIcon, PropsUIButtonIconBack, PropsUIButtonIconForward, PropsUIButtonIconLabel, PropsUIButtonLabel, PropsUIButtonPrimary, PropsUIButtonSecundary } from '../../../../types/elements'
import BackSvg from '../../../../../assets/images/back.svg'
import ForwardSvg from '../../../../../assets/images/forward.svg'

export const PrimaryButton = ({ label, spinning = false, enabled = true, tone = 'accent', onClick }: Weak<PropsUIButtonPrimary>): JSX.Element => (
  <Button type="button" variant="primary" tone={tone}
    disabled={!enabled || spinning} loading={spinning} aria-busy={spinning || undefined} onClick={onClick}>
    <span id="confirm-button">{label}</span>
  </Button>
)
export const SecondaryButton = ({ label, tone = 'danger', onClick }: Weak<PropsUIButtonSecundary>): JSX.Element => (
  <Button type="button" variant="secondary" tone={tone} onClick={onClick}>{label}</Button>
)
export const BackButton = ({ label, onClick }: Weak<PropsUIButtonBack>): JSX.Element => <IconLabelButton icon={BackSvg} label={label} onClick={onClick} />
export const ForwardButton = ({ label, onClick }: Weak<PropsUIButtonForward>): JSX.Element => <IconLabelButton icon={ForwardSvg} label={label} onClick={onClick} alignment="right" />
export const BackIconButton = ({ onClick, ariaLabel = 'Previous page' }: Weak<PropsUIButtonIconBack> & { ariaLabel?: string }): JSX.Element => <IconButton icon={BackSvg} ariaLabel={ariaLabel} onClick={onClick} />
export const ForwardIconButton = ({ onClick, ariaLabel = 'Next page' }: Weak<PropsUIButtonIconForward> & { ariaLabel?: string }): JSX.Element => <IconButton icon={ForwardSvg} ariaLabel={ariaLabel} onClick={onClick} />
export const IconButton = ({ icon, onClick, ariaLabel }: Weak<PropsUIButtonIcon> & { ariaLabel?: string }): JSX.Element => (
  <Button type="button" variant="icon" tone="neutral" aria-label={ariaLabel} onClick={onClick} icon={<img src={icon} alt="" />} />
)
export const IconLabelButton = ({ icon, label, tone = 'neutral', alignment = 'left', onClick }: Weak<PropsUIButtonIconLabel>): JSX.Element => (
  <Button type="button" variant="text" padded={false} tone={tone} onClick={onClick}
    icon={<img src={icon} alt="" />} iconPosition={alignment === 'left' ? 'start' : 'end'}>{label}</Button>
)
export const LabelButton = ({ label, tone = 'neutral', onClick }: Weak<PropsUIButtonLabel>): JSX.Element => (
  <Button type="button" variant="text" tone={tone} onClick={onClick}><span id="confirm-button">{label}</span></Button>
)
