import React, { JSX } from 'react'
import { PropsUITablePage } from '../../../../types/elements'
import { Weak } from '../../../../helpers'
import { TableCard } from './table_card'

type Props = Weak<PropsUITablePage> & TableContext

export interface TableContext {
  locale: string
  onDelete: (rowId: string) => void
}

export const TableCards = ({ head, rows, locale, onDelete }: Props): JSX.Element => {
  return (
    <div className='flex flex-col gap-4 px-4'>
      {rows.map((row, index) => <TableCard row={row} headCells={head.cells} locale={locale} onDelete={onDelete} key={`${index}`} />)}
    </div>
  )
}
