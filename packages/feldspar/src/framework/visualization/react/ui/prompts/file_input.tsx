
import React, { JSX } from 'react'
import { Weak } from '../../../../helpers'
import { Translatable } from '../../../../types/elements'
import TextBundle from '../../../../text_bundle'
import { Translator } from '../../../../translator'
import { ReactFactoryContext } from '../../factory'
import { PropsUIPromptFileInput } from '../../../../types/prompts'
import { PrimaryButton } from '../elements/button'
import { BodyLarge, BodySmall } from '../elements/text'

type Props = Weak<PropsUIPromptFileInput> & ReactFactoryContext

export const FileInput = (props: Props): JSX.Element => {
  const [waiting, setWaiting] = React.useState<boolean>(false)
  const [selectedFile, setSelectedFile] = React.useState<File>()
  const input = React.useRef<HTMLInputElement>(null)

  const { resolve } = props
  const { description, note, placeholder, extensions, selectButton, continueButton } = prepareCopy(props)

  function handleClick (): void {
    input.current?.click()
  }

  function handleSelect (event: React.ChangeEvent<HTMLInputElement>): void {
    const files = event.target.files
    if (files != null && files.length > 0) {
      setSelectedFile(files[0])
    } else {
      console.log('[FileInput] Error selecting file: ' + JSON.stringify(files))
    }
  }

  function handleConfirm (): void {
    if (selectedFile !== undefined && !waiting) {
      setWaiting(true)
      resolve?.({ __type__: 'PayloadFile', value: selectedFile })
    }
  }

  return (
    <>
      <div id='select-panel'>
        <div className='flex-wrap text-bodylarge font-body text-grey1 text-left'>
          {description}
        </div>
        <div className='mt-8' />
        <div className='p-6 border-grey4 border-2 rounded'>
          <input ref={input} id='input' type='file' className='hidden' accept={extensions} onChange={handleSelect} />
          <div className='flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-center'>
            <BodyLarge text={selectedFile?.name ?? placeholder} margin='' color={selectedFile === undefined ? 'text-grey2' : 'textgrey1'} />
            <div className='flex-grow' />
            <div className='flex-wrap'>
              <div className='flex flex-row'>
                <PrimaryButton onClick={handleClick} label={selectButton} color='bg-tertiary text-grey1' />
              </div>
            </div>
          </div>
        </div>
        <div className='mt-4' />
        <div className={`${selectedFile === undefined ? 'opacity-30' : 'opacity-100'}`}>
          <BodySmall text={note} margin='' />
          <div className='mt-8' />
          <div className='flex flex-row gap-4'>
            <PrimaryButton label={continueButton} onClick={handleConfirm} enabled={selectedFile !== undefined} spinning={waiting} />
          </div>
        </div>
      </div>
    </>
  )
}

interface Copy {
  description: string
  note: string
  placeholder: string
  extensions: string
  selectButton: string
  continueButton: string
}

function prepareCopy ({ description, extensions, locale }: Props): Copy {
  return {
    description: Translator.translate(description, locale),
    note: Translator.translate(note(), locale),
    placeholder: Translator.translate(placeholder(), locale),
    extensions: extensions,
    selectButton: Translator.translate(selectButtonLabel(), locale),
    continueButton: Translator.translate(continueButtonLabel(), locale)
  }
}

const continueButtonLabel = (): Translatable => {
  return new TextBundle()
    .add('en', 'Continue')
    .add('de', 'Weiter')
    .add('it', 'Continua')
    .add('nl', 'Verder')
}

const selectButtonLabel = (): Translatable => {
  return new TextBundle()
    .add('en', 'Choose file')
    .add('de', 'Datei auswählen')
    .add('it', 'Scegli file')
    .add('nl', 'Kies bestand')
}

const note = (): Translatable => {
  return new TextBundle()
    .add('en', 'Note: The process to extract the correct data from the file is done on your own device. No data is stored or sent yet.')
    .add('de', 'Hinweis: Der Prozess zur Extraktion der richtigen Daten aus der Datei erfolgt auf Ihrem eigenen Gerät. Es werden noch keine Daten gespeichert oder gesendet.')
    .add('it', 'Nota: Il processo per estrarre i dati corretti dal file viene eseguito sul Suo dispositivo. Nessun dato viene ancora memorizzato o inviato.')
    .add('nl', 'Let op: Het proces om de juiste gegevens uit het bestand te halen wordt uitgevoerd op uw eigen apparaat. Er worden nog geen gegevens opgeslagen of verzonden.')
}

const placeholder = (): Translatable => {
  return new TextBundle()
    .add('en', 'E.g. data.zip')
    .add('de', 'Z.B. data.zip')
    .add('it', 'Esempio: data.zip')
    .add('nl', 'Voorbeeld: data.zip')
}
