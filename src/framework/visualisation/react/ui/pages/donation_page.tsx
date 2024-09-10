import React from 'react'
import { Weak } from '../../../../helpers'
import TextBundle from '../../../../text_bundle'
import { Translator } from '../../../../translator'
import { Translatable } from '../../../../types/elements'
import { PropsUIPageDonation } from '../../../../types/pages'
import { isPropsUIPromptConfirm, isPropsUIPromptConsentForm, isPropsUIPromptFileInput, isPropsUIPromptNumberInput, isPropsUIPromptProgress, isPropsUIPromptRadioInput } from '../../../../types/prompts'
import { ReactFactoryContext } from '../../factory'
import { Title1 } from '../elements/text'
import { Confirm } from '../prompts/confirm'
import { ConsentForm } from '../prompts/consent_form'
import { FileInput } from '../prompts/file_input'
import { Progress } from '../prompts/progress'
import { RadioInput } from '../prompts/radio_input'
import { Page } from './templates/page'
import { NumberInput } from '../prompts/number_input'

type Props = Weak<PropsUIPageDonation> & ReactFactoryContext

export const DonationPage = (props: Props): JSX.Element => {
  const { title } = prepareCopy(props)
  const { locale } = props

  function renderBody (props: Props): JSX.Element {
    const context = { locale: locale, resolve: props.resolve }
    const body = props.body
    
    if (isPropsUIPromptNumberInput(body)) {
      return <NumberInput {...body} {...context} />
    }
    if (isPropsUIPromptFileInput(body)) {
      return <FileInput {...body} {...context} />
    }
    if (isPropsUIPromptProgress(body)) {
      return <Progress {...body} {...context} />
    }
    if (isPropsUIPromptConfirm(body)) {
      return <Confirm {...body} {...context} />
    }
    if (isPropsUIPromptConsentForm(body)) {
      return <ConsentForm {...body} {...context} />
    }
    if (isPropsUIPromptRadioInput(body)) {
      return <RadioInput {...body} {...context} />
    }

    throw new TypeError('Unknown body type')
  }

  const body: JSX.Element = (
    <>
      <Title1 text={title} />
      {renderBody(props)}
    </>
  )

  return (
    <Page
      body={body}
    />
  )
}

interface Copy {
  title: string
  forwardButton: string
}

function prepareCopy ({ header: { title }, locale }: Props): Copy {
  return {
    title: Translator.translate(title, locale),
    forwardButton: Translator.translate(forwardButtonLabel(), locale)
  }
}

const forwardButtonLabel = (): Translatable => {
  return new TextBundle()
    .add('en', 'Skip')
    .add('de', 'Überspringen')
    .add('nl', 'Overslaan')
}
