import { Weak } from '../../../../helpers'
import * as React from 'react'
import { Translatable } from '../../../../types/elements'
import TextBundle from '../../../../text_bundle'
import { Translator } from '../../../../translator'
import { ReactFactoryContext } from '../../factory'
import { PropsUIPromptNumberInput } from '../../../../types/prompts'
import { PrimaryButton } from '../elements/button'

type Props = Weak<PropsUIPromptNumberInput> & ReactFactoryContext

export const NumberInput = (props: Props): JSX.Element => {
  const [waiting, setWaiting] = React.useState<boolean>(false)
  const defaultInputNumber = "10"
  const [inputNumber, setInputNumber] = React.useState<string>(defaultInputNumber)

  const { resolve } = props
  const { description, continueButton } = prepareCopy(props)

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setInputNumber(event.target.value)
  }

  function handleContinue (): void {
    if (inputNumber !== undefined && !waiting) {
      setWaiting(true)
      resolve?.({ __type__: 'PayloadNumber', value: Number(inputNumber) })
    }
  }

  return (
    <>
      <div id='select-panel'>
        <div className='flex-wrap text-bodylarge font-body text-grey1 text-left'>
          {description}
        </div>
        <div className='mt-8' />
        <input 
          className="p-2 w-[200px] text-grey1 text-bodymedium font-body pl-3 border-2 border-solid border-grey4 focus:outline-none rounded h-44px" 
          id='input' 
          type='number' 
          defaultValue={defaultInputNumber} 
          onChange={handleInputChange} 
        />
        <div className='mt-8' />
        <div className='flex flex-row gap-4'>
          <PrimaryButton label={continueButton} onClick={handleContinue} spinning={waiting}/>
        </div>
      </div>
    </>
  )
}

interface Copy {
  description: string
  continueButton: string
}

function prepareCopy ({ description, locale }: Props): Copy {
  return {
    description: Translator.translate(description, locale),
    continueButton: Translator.translate(continueButtonLabel(), locale)
  }
}

const continueButtonLabel = (): Translatable => {
  return new TextBundle()
    .add('en', 'Continue')
}

