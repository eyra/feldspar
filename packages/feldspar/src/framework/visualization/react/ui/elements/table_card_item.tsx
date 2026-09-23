import React, { JSX } from 'react'
import { PropsUITableCardItem } from '../../../../types/elements'
import { Weak } from '../../../../helpers'
import TextBundle from '../../../../text_bundle'
import { Translator } from '../../../../translator'
import { TableCellText } from './table_cell_text'

type Props = Weak<PropsUITableCardItem> & TableCardItemContext

export interface TableCardItemContext {
  locale: string
}

export const TableCardItem = ({ title, description, locale }: Props): JSX.Element => {
  const copy = prepareCopy(locale)

  const body = isValidHttpUrl(description.text)
    ? renderCardItemLink(description.text)
    : <TableCellText text={description.text} field={title.text} locale={locale} />


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
    <div className='w-full min-w-0 flex flex-col items-left gap-2'>
      <div className='font-card text-left text-card-key [overflow-wrap:anywhere]'>{title.text}</div>
      <div className='min-w-0 font-card text-left text-card-value'>{body}</div>
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
  .add("es", "Visite la URL")
  .add("nl", "Bezoek URL")
  .add("ro", "Vizitați URL-ul")
  .add("lt", "Apsilankyti URL");
