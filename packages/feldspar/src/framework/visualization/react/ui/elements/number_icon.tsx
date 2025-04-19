import React from 'react'
import { JSX } from 'react'
import { PropsUINumberIcon } from '../../../../types/elements'

type Props = PropsUINumberIcon

export const NumberIcon = ({ number }: Props): JSX.Element => {
  function centerCorrection (number: number): string {
    switch (number) {
      case 1:
        return 'mr-1px'
      case 4:
        return 'mr-1px'
      default:
        return ''
    }
  }

  return (
    <div className={`flex-shrink-0 icon w-6 h-6 font-caption text-caption text-white bg-primary rounded-full flex items-center ${centerCorrection(number)}`}>
      <span className='text-center w-full mt-1px'>{number}</span>
    </div>
  )
}
