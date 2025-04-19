import React, { JSX } from 'react'
import { PropsUITablePage, PropsUITableRow, PropsUITableHead, PropsUITableCell } from '../../../../types/elements'
import { Weak } from '../../../../helpers'
import { CheckBox } from './check_box'
import TextBundle from '../../../../text_bundle'
import { Translator } from '../../../../translator'

type Props = Weak<PropsUITablePage> & TableContext

export interface TableContext {
  id: string
  edit: boolean
  selected: string[]
  locale: string
  onChange: (selected: string[]) => void
}

export const TablePage = ({ head, rows, id, edit, selected, locale, onChange }: Props): JSX.Element => {
  const copy = prepareCopy(locale)

  function renderHeadRow (props: Weak<PropsUITableHead>): JSX.Element {
    return (
      <tr>
        {edit ? renderHeadCheck() : ''}
        {props.cells.map((cell, index) => renderHeadCell(cell, index))}
      </tr>
    )
  }

  function renderHeadCheck (): JSX.Element {
    const headSelected = selected.length > 0 && selected.length === rows.length
    return (
      <td key='check-head' className='pl-4 w-10'>
        <CheckBox id='-1' selected={headSelected} onSelect={() => handleSelectHead()} />
      </td>
    )
  }

  function renderHeadCell (props: Weak<PropsUITableCell>, index: number): JSX.Element {
    return (
      <th key={`${index}`} className='h-12 px-4 text-left'>
        <div className='font-table-header text-table text-grey1'>{props.text}</div>
      </th>
    )
  }

  function renderRows (): JSX.Element[] {
    return rows.map((row, index) => renderRow(row, index))
  }

  function renderRow (row: PropsUITableRow, rowIndex: number): JSX.Element {
    return (
      <tr key={`${rowIndex}`} className='hover:bg-grey6'>
        {edit ? renderRowCheck(row.id) : ''}
        {row.cells.map((cell, cellIndex) => renderRowCell(cell, cellIndex))}
      </tr>
    )
  }

  function renderRowCheck (rowId: string): JSX.Element {
    const rowSelected = selected.includes(rowId)
    return (
      <td key={`check-${rowId}`} className='pl-4'>
        <CheckBox id={rowId} selected={rowSelected} onSelect={() => handleSelectRow(rowId)} />
      </td>
    )
  }

  function renderRowCell ({ text }: Weak<PropsUITableCell>, cellIndex: number): JSX.Element {
    const body = isValidHttpUrl(text) ? renderRowLink(text) : renderRowText(text)

    return (
      <td key={`${cellIndex}`} className='h-12 px-4'>
        {body}
      </td>
    )
  }

  function renderRowText (text: string): JSX.Element {
    return <div className='font-table-row text-table text-grey1'>{text}</div>
  }

  function renderRowLink (href: string): JSX.Element {
    return (
      <div className='font-table-row text-table text-primary underline'>
        <a href={href} target='_blank' rel='noreferrer' title={href}>{copy.link}</a>
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

  function handleSelectHead (): void {
    const allRowsSelected = selected.length === rows.length
    if (allRowsSelected) {
      handleSelectNone()
    } else {
      handleSelectAll()
    }
  }

  function handleSelectRow (rowId: string): void {
    const newSelected = selected.slice(0)
    const index = newSelected.indexOf(rowId)
    if (index === -1) {
      newSelected.push(rowId)
    } else {
      newSelected.splice(index, 1)
    }

    onChange(newSelected)
  }

  function handleSelectAll (): void {
    const newSelected = rows.map((row) => row.id)
    onChange(newSelected)
  }

  function handleSelectNone (): void {
    onChange([])
  }

  function prepareCopy (locale: string): Copy {
    return {
      link: Translator.translate(link, locale)
    }
  }

  return (
    <table data-testid={`table-${id}`} className='text-grey1 table-fixed divide-y divide-grey4'>
      <thead>
        {renderHeadRow(head)}
      </thead>
      <tbody className='divide-y divide-grey4'>
        {renderRows()}
      </tbody>
    </table>
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
