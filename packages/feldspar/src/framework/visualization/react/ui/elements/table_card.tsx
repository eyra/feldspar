import React, { JSX } from 'react'
import { PropsUITableCard } from '../../../../types/elements'
import { Weak } from '../../../../helpers'
import { IconButton } from './button'
import TextBundle from '../../../../text_bundle'
import { Translator } from '../../../../translator'
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
    <div className='flex flex-row w-full p-4 border border-grey4 bg-white rounded-lg shadow-2xl '>
      <div className='w-full min-w-0 flex flex-col items-left gap-4'>
        {cells.map(([title, description], index) => <TableCardItem title={title} description={description} locale={locale} key={`${index}`} />)}
      </div>
      <div className='grow' />
      <div className='shrink-0'>
        <IconButton ariaLabel={Translator.translate(deleteRow, locale)} icon={DeleteSvg} onClick={() => onDelete(row.id)} />
      </div>
    </div>
  )
}

const deleteRow = new TextBundle().add('en', 'Delete row').add('nl', 'Verwijder rij').add('de', 'Zeile löschen').add('it', 'Elimina riga').add('es', 'Eliminar fila').add('ro', 'Șterge rândul').add('lt', 'Ištrinti eilutę')
