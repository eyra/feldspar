import React from 'react'
import { JSX } from 'react'
import { Weak } from '../../../../helpers'
import { Translator } from '../../../../translator'
import { ReactFactoryContext } from '../../factory'
import { PropsUIPromptProgress } from '../../../../types/prompts'
import { ProgressBar } from '../elements/progress_bar'

type Props = Weak<PropsUIPromptProgress> & ReactFactoryContext

export const Progress = (props: Props): JSX.Element => {
  const { resolve, percentage } = props
  const { description, message } = prepareCopy(props)

  function autoResolve (): void {
    resolve?.({ __type__: 'PayloadTrue', value: true })
  }

  // No user action possible, resolve directly to give control back to script
  autoResolve()

  return (
    <>
      <div className='flex flex-col gap-8'>
        <div className='text-bodylarge font-body text-grey1 text-left'>
          {description}
        </div>
        <div className='p-6 border-grey4 border-2 rounded flex flex-col gap-4'>
          {percentage !== undefined && <ProgressBar percentage={percentage} />}
          <div className='flex-wrap text-bodylarge font-body text-grey2 text-left truncate'>
            {message}
          </div>
        </div>
      </div>
    </>
  )
}

interface Copy {
  description: string
  message: string
}

function prepareCopy ({ description, message, locale }: Props): Copy {
  return {
    description: Translator.translate(description, locale),
    message: message
  }
}
