import React, { JSX } from 'react'
import { PropsUITableCardItem } from '../../../../types/elements'
import { Weak } from '../../../../helpers'
import TextBundle from '../../../../text_bundle'
import { Translator } from '../../../../translator'

type Props = Weak<PropsUITableCardItem> & TableCardItemContext

export interface TableCardItemContext {
  locale: string
}

export const TableCardItem = ({ title, description, locale }: Props): JSX.Element => {
  const copy = prepareCopy(locale)

  const body = isValidHttpUrl(description.text)
    ? renderCardItemLink(description.text)
    : renderCardItemText(description.text)

  function renderCardItemText (text: string): JSX.Element {
    return <div className='font-table-row text-table text-grey1'>{text}</div>
  }

  function renderCardItemLink (href: string): JSX.Element {
    return (
      <div className='font-table-row text-table text-primary underline'>
        <a href={href} target='_blank' rel='noreferrer' title={href}>
          {copy.link}
        </a>
      </div>
    )
  }

  function isValidHttpUrl (value: string): boolean {
    let url
    try {
      url = new URL(value)
    } catch (_) {
      return false
    }
    return url.protocol === 'http:' || url.protocol === 'https:'
  }

  function prepareCopy (locale: string): Copy {
    return {
      link: Translator.translate(link, locale)
    }
  }

  return (
    <div className='w-full flex flex-col items-left gap-2'>
      <div className='font-card text-left text-card-key'>{title.text}</div>
      <div className='font-card text-left text-card-value'>{body}</div>
    </div>
  )
}

interface Copy {
  link: String
}

const link = new TextBundle()
  .add("en", "Visit URL")
  .add("de", "URL besuchen")
  .add("it", "Visita URL")
  .add("nl", "Bezoek URL");
