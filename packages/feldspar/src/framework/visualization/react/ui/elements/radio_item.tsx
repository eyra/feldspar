import React, { JSX } from 'react'
import { Radio } from '@novasoftwarefoundation/prism-react'
import { PropsUIRadioItem } from '../../../../types/elements'

export const RadioItem = ({ id, value, selected, onSelect, name }: PropsUIRadioItem & { name?: string }): JSX.Element => (
  <Radio id={`${id}`} data-testid={`radio-${id}`} name={name} value={value} checked={selected} onChange={onSelect}>{value}</Radio>
)
