import React, { JSX } from 'react'
import { PropsUITableCard } from '../../../../types/elements'
import { Weak } from '../../../../helpers'
import { IconButton } from './button'
import DeleteSvg from '../../../../../assets/images/delete.svg'
import { TableCardItem } from './table_card_item'

export interface TableCardContext {
  locale: string
  onDelete: (rowId: string) => void
}

type Props = Weak<PropsUITableCard> & TableCardContext

export const TableCard = ({ row, headCells, locale, onDelete }: Props): JSX.Element => {
  const cells = headCells.map((cell, cellIndex) => [cell, row.cells[cellIndex]])

  return (
    <div className='flex flex-row w-full p-4 border border-grey4 bg-white rounded-lg shadow-[0px_5px_20px_0px_rgba(0,0,0,0.10)] '>
      <div className='w-full flex flex-col items-left gap-4'>
        {cells.map(([title, description], index) => <TableCardItem title={title} description={description} locale={locale} key={`${index}`} />)}
      </div>
      <div className='flex-grow' />
      <div className='flex-shrink-0'>
        <IconButton icon={DeleteSvg} onClick={() => onDelete(row.id)} />
      </div>
    </div>
  )
}
