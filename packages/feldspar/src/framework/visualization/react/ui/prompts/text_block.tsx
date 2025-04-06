import * as React from 'react'
import { JSX } from 'react'
import { Weak } from '../../../../helpers'
import { Translatable } from '../../../../types/elements'
import { PropsUIPromptText } from '../../../../types/prompts'
import TextBundle from '../../../../text_bundle'
import { Translator } from '../../../../translator'
import { ReactFactoryContext } from '../../factory'
import { BodyLarge, Title3 } from '../elements/text'

type Props = Weak<PropsUIPromptText> & ReactFactoryContext

interface Copy {
  text: string
  title?: string
}

export const TextBlock = (props: Props): JSX.Element => {
  const { text, title } = prepareCopy(props)

  return (
    <>
      <div className='my-8'>
        {title && (
          <>
            <Title3 text={title} margin='mb-4' />
          </>
        )}
        <BodyLarge text={text} margin='' />
      </div>
    </>
  )
}

function prepareCopy ({ text, title, locale }: Props): Copy {
  return {
    text: Translator.translate(text, locale),
    title: title ? Translator.translate(title, locale) : undefined
  }
}