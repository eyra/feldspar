import React, { JSX } from 'react'
import { Checkbox } from '@novasoftwarefoundation/prism-react'
import { PropsUICheckBox } from '../../../../types/elements'

export const CheckBox = ({ id, selected, onSelect, ariaLabel }: PropsUICheckBox & { ariaLabel?: string }): JSX.Element => (
  <Checkbox id={id} checked={selected} onChange={onSelect} aria-label={ariaLabel} />
)
