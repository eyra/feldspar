import React from 'react'
import { JSX } from 'react'
import { Weak } from '../../../../helpers'
import TextBundle from '../../../../text_bundle'
import { Translator } from '../../../../translator'
import { PropsUITable, PropsUITableRow } from '../../../../types/elements'
import { ReactFactoryContext } from '../../factory'
import { IconLabelButton } from './button'
import { CheckBox } from './check_box'
import { SearchBar } from './search_bar'
import { Caption, Label, Title3 } from './text'
import UndoSvg from '../../../../../assets/images/undo.svg'
import DeleteSvg from '../../../../../assets/images/delete.svg'
import { Pagination } from './pagination'
import { TablePage } from './table_page'
import { TableCards } from './table_cards'
type Props = Weak<PropsUITable> & TableContext & ReactFactoryContext

export interface TableContext {
  id: string
  onChange: (rows: PropsUITableRow[], deletedCount: number) => void
}

interface Visibility {
  undo: boolean
  delete: boolean
  table: boolean
  noData: boolean
  noDataLeft: boolean
  noResults: boolean
}

interface State {
  edit: boolean
  desktopPage: number
  desktopPageCount: number
  mobilePage: number
  mobilePageCount: number
  desktopRows: PropsUITableRow[]
  mobileRows: PropsUITableRow[]
  selected: string[]
  deletedCount: number
  visibility: Visibility
}

export const Table = ({ id, head, body, readOnly = false, locale, onChange }: Props): JSX.Element => {
  const query = React.useRef<string[]>([])
  const alteredRows = React.useRef<PropsUITableRow[]>(body.rows)
  const filteredRows = React.useRef<PropsUITableRow[]>(alteredRows.current)
  const desktopPageSize = 7
  const mobilePageSize = 1

  const initialState: State = {
    edit: false,
    desktopPage: 0,
    desktopPageCount: getPageCount(desktopPageSize),
    desktopRows: updateRows(0, desktopPageSize),
    mobilePage: 0,
    mobilePageCount: getPageCount(mobilePageSize),
    mobileRows: updateRows(0, mobilePageSize),
    selected: [],
    deletedCount: 0,
    visibility: {
      delete: false,
      undo: false,
      table: filteredRows.current.length > 0,
      noData: filteredRows.current.length === 0,
      noDataLeft: false,
      noResults: false
    }
  }

  const [state, setState] = React.useState<State>(initialState)

  const copy = prepareCopy(locale)

  function display (element: keyof Visibility): string {
    return visible(element) ? '' : 'hidden'
  }

  function visible (element: keyof Visibility): boolean {
    if (typeof state.visibility[element] === 'boolean') {
      return state.visibility[element]
    }
    return false
  }

  function getPageCount (pageSize: number): number {
    if (filteredRows.current.length === 0) {
      return 0
    }

    return Math.ceil(filteredRows.current.length / pageSize)
  }

  function updateRows (currentPage: number, pageSize: number): PropsUITableRow[] {
    const offset = currentPage * pageSize
    return filteredRows.current.slice(offset, offset + pageSize)
  }

  function filterRows (): PropsUITableRow[] {
    if (query.current.length === 0) {
      return alteredRows.current
    }
    return alteredRows.current.filter((row) => matchRow(row, query.current))
  }

  function matchRow (row: PropsUITableRow, query: string[]): boolean {
    const rowText = row.cells.map((cell) => cell.text).join(' ')
    return query.find((word) => !rowText.includes(word)) === undefined
  }

  function handleSelectedChange (selected: string[]): void {
    setState((state) => {
      return { ...state, selected }
    })
  }

  function handleDeleteRow (rowId: string): void {
    deleteRows([rowId])
  }

  function handleDeleteSelected (): void {
    const currentSelectedRows = state.selected.slice(0)
    if (currentSelectedRows.length === 0) return

    deleteRows(currentSelectedRows)
  }

  function deleteRows (rows: String[]): void {
    const newAlteredRows = alteredRows.current.slice(0)

    for (const rowId of rows) {
      const index = newAlteredRows.findIndex((row) => row.id === rowId)
      if (index !== -1) {
        newAlteredRows.splice(index, 1)
      }
    }

    alteredRows.current = newAlteredRows
    filteredRows.current = filterRows()

    setState((state) => {
      const desktopPageCount = getPageCount(desktopPageSize)
      const desktopPage = Math.max(0, Math.min(desktopPageCount - 1, state.desktopPage))
      const desktopRows = updateRows(desktopPage, desktopPageSize)
      const mobilePageCount = getPageCount(mobilePageSize)
      const mobilePage = Math.max(0, Math.min(mobilePageCount - 1, state.mobilePage))
      const mobileRows = updateRows(mobilePage, mobilePageSize)
      const deletedCount = body.rows.length - alteredRows.current.length
      const visibility = {
        ...state.visibility,
        undo: deletedCount > 0,
        table: filteredRows.current.length > 0,
        noData: false,
        noDataLeft: alteredRows.current.length === 0,
        noResults: alteredRows.current.length > 0 && filteredRows.current.length === 0
      }
      return { ...state, desktopPage, desktopPageCount, desktopRows, mobilePage, mobilePageCount, mobileRows, deletedCount, selected: [], visibility }
    })

    onChange(alteredRows.current, state.deletedCount)
  }

  function handleUndo (): void {
    alteredRows.current = body.rows
    filteredRows.current = filterRows()
    setState((state) => {
      const desktopPageCount = getPageCount(desktopPageSize)
      const desktopPage = Math.min(desktopPageCount, state.desktopPage)
      const desktopRows = updateRows(desktopPage, desktopPageSize)
      const mobilePageCount = getPageCount(mobilePageSize)
      const mobilePage = Math.min(mobilePageCount, state.mobilePage)
      const mobileRows = updateRows(mobilePage, mobilePageSize)

      const visibility = {
        ...state.visibility,
        undo: false,
        table: filteredRows.current.length > 0,
        noData: false,
        noDataLeft: false,
        noResults: filteredRows.current.length === 0
      }
      return { ...state, desktopPage, desktopPageCount, desktopRows, mobilePage, mobilePageCount, mobileRows, deletedCount: 0, selected: [], visibility }
    })

    onChange(body.rows, 0)
  }

  function handleSearch (newQuery: string[]): void {
    query.current = newQuery
    filteredRows.current = filterRows()
    setState((state) => {
      const desktopPageCount = getPageCount(desktopPageSize)
      const desktopPage = Math.min(desktopPageCount, state.desktopPage)
      const desktopRows = updateRows(desktopPage, desktopPageSize)
      const mobilePageCount = getPageCount(mobilePageSize)
      const mobilePage = Math.min(mobilePageCount, state.mobilePage)
      const mobileRows = updateRows(mobilePage, mobilePageSize)
      const visibility = {
        ...state.visibility,
        table: filteredRows.current.length > 0,
        noData: body.rows.length === 0,
        noDataLeft: body.rows.length > 0 && alteredRows.current.length === 0,
        noResults: body.rows.length > 0 && alteredRows.current.length > 0 && filteredRows.current.length === 0
      }
      return { ...state, desktopPage, desktopPageCount, desktopRows, mobilePage, mobilePageCount, mobileRows, visibility }
    })
  }

  function handleDesktopPageChange (page: number): void {
    setState((state) => {
      const desktopRows = updateRows(page, desktopPageSize)
      return { ...state, desktopPage: page, desktopRows }
    })
  }

  function handleMobilePageChange (page: number): void {
    setState((state) => {
      const mobileRows = updateRows(page, mobilePageSize)
      return { ...state, mobilePage: page, mobileRows }
    })
  }

  function handleEditToggle (): void {
    setState((state) => {
      const edit = !state.edit
      const visibility = {
        ...state.visibility,
        delete: edit
      }
      return { ...state, edit, visibility }
    })
  }

  return (
    <>
      <div className='flex flex-col gap-4'>
        {/* Desktop header */}
        <div className='hidden sm:block'>
          <div className='flex flex-row gap-4 items-center'>
            {/* Desktop pagination */}
            <div className={`${body.rows.length <= desktopPageSize ? 'hidden' : ''} `}>
              <Pagination pageCount={state.desktopPageCount} page={state.desktopPage} pageWindowLegSize={3} onChange={handleDesktopPageChange} />
            </div>
            <div className='flex-grow' />

            {/* Desktop pages */}
            <Caption text={copy.desktopPages} color='text-grey2' margin='' />

            {/* Desktop search */}
            <div>
              <SearchBar placeholder={copy.searchPlaceholder} onSearch={(query) => handleSearch(query)} />
            </div>
          </div>
        </div>

        {/* Mobile header */}
        <div className='block sm:hidden'>
          <div className='flex flex-row gap-4'>
            {/* Mobile search */}
            <div className='w-full'>
              <SearchBar placeholder={copy.searchPlaceholder} onSearch={(query) => handleSearch(query)} />
            </div>
          </div>
        </div>

        {/* Desktop body */}
        {state.desktopRows.length > 0 && (
          <div className='hidden sm:block'>
            <div className={`flex flex-col ${display('table')}`}>
              <TablePage head={head} rows={state.desktopRows} id={id} edit={state.edit} selected={state.selected} locale={locale} onChange={handleSelectedChange} />
            </div>
          </div>
        )}

        {/* Mobile body */}
        {state.mobileRows.length > 0 && (
          <div className='block sm:hidden'>
            <TableCards head={head} rows={state.mobileRows} locale={locale} onDelete={handleDeleteRow} key={id} />
          </div>
        )}

        {/* No data */}
        <div className={`flex flex-col justify-center items-center w-full h-[200px] sm:h-table bg-grey6 ${display('noData')}`}>
          <Title3 text={copy.noData} color='text-grey3' margin='' />
        </div>

        {/* No data left */}
        <div className={`flex flex-col justify-center items-center w-full h-[200px] sm:h-table bg-grey6 ${display('noDataLeft')}`}>
          <Title3 text={copy.noDataLeft} color='text-grey3' margin='' />
        </div>

        {/* No search results */}
        <div className={`flex flex-col justify-center items-center w-full h-[200px] sm:h-table bg-grey6 ${display('noResults')}`}>
          <Title3 text={copy.noResults} color='text-grey3' margin='' />
        </div>

        {/* Desktop footer */}
        <div className='hidden sm:block'>
          <div className={`flex flex-row items-center gap-6 mt-2 h-8 ${body.rows.length === 0 ? 'hidden' : ''} `}>
            <div className='flex flex-row gap-4 items-center'>
              <CheckBox id='edit' selected={state.edit} onSelect={handleEditToggle} />
              <Label text={copy.edit} margin='mt-1px' />
            </div>

            {/* Delete selected */}
            <div className={`${display('delete')} mt-1px`}>
              <IconLabelButton label={copy.delete} color='text-delete' icon={DeleteSvg} onClick={handleDeleteSelected} />
            </div>
            <div className='flex-grow' />
            {/* Number of deleted rows */}
            <Label text={copy.deleted} />
            {/* Undo button */}
            <div className={`${display('undo')}`}>
              <IconLabelButton label={copy.undo} color='text-primary' icon={UndoSvg} onClick={handleUndo} />
            </div>
          </div>
        </div>

        {/* Mobile footer */}
        <div className='block sm:hidden'>
          <div className='flex flex-col gap-4'>
            {state.deletedCount > 0 &&
              <div className='flex flex-row gap-4 items-center'>
                {/* Number of deleted rows */}
                <Label text={copy.deleted} />
                <div className='flex-grow' />
                {/* Undo button */}
                <div className={`${display('undo')}`}>
                  <IconLabelButton label={copy.undo} color='text-primary' icon={UndoSvg} onClick={handleUndo} />
                </div>
              </div>}

            <div className='flex flex-col gap-4 items-center'>
              {/* Mobile pagination */}
              <div className={`${body.rows.length <= mobilePageSize ? 'hidden' : ''} `}>
                <Pagination pageCount={state.mobilePageCount} page={state.mobilePage} pageWindowLegSize={2} onChange={handleMobilePageChange} />
              </div>
              {/* Number of pages */}
              <Caption text={copy.mobilePages} color='text-grey2' margin='' />
            </div>
          </div>
        </div>
      </div>
    </>
  )

  function prepareCopy (locale: string): Copy {
    return {
      edit: Translator.translate(editLabel, locale),
      undo: Translator.translate(undoLabel, locale),
      noData: Translator.translate(noDataLabel, locale),
      noDataLeft: Translator.translate(noDataLeftLabel, locale),
      noResults: Translator.translate(noResultsLabel, locale),
      desktopPages: Translator.translate(pagesLabel(state.desktopPageCount), locale),
      mobilePages: Translator.translate(pagesLabel(state.mobilePageCount), locale),
      delete: Translator.translate(deleteLabel, locale),
      deleted: Translator.translate(deletedLabel(body.rows.length - alteredRows.current.length), locale),
      searchPlaceholder: Translator.translate(searchPlaceholder, locale)
    }
  }
}

interface Copy {
  edit: string
  undo: string
  noData: string
  noDataLeft: string
  noResults: string
  desktopPages: string
  mobilePages: string
  delete: string
  deleted: string
  searchPlaceholder: string
}

const searchPlaceholder = new TextBundle()
  .add("en", "Search")
  .add("de", "Suchen")
  .add("it", "Cerca")
  .add("nl", "Zoeken");

const noDataLabel = new TextBundle()
  .add("en", "No data found")
  .add("de", "Keine Daten gefunden")
  .add("it", "Nessun dato trovato")
  .add("nl", "Geen gegevens gevonden");

const noDataLeftLabel = new TextBundle()
  .add("en", "All data removed")
  .add("de", "Alle Daten gelöscht")
  .add("it", "Tutti i dati rimossi")
  .add("nl", "Alle gegevens verwijderd");

const noResultsLabel = new TextBundle()
  .add("en", "No search results")
  .add("de", "Keine Suchergebnisse")
  .add("it", "Nessun risultato di ricerca")
  .add("nl", "Geen zoek resultaten");

const editLabel = new TextBundle()
  .add("en", "Adjust")
  .add("de", "Anpassen")
  .add("it", "Regola")
  .add("nl", "Aanpassen");

const undoLabel = new TextBundle()
  .add("en", "Undo")
  .add("de", "Rückgängig machen")
  .add("it", "Annulla")
  .add("nl", "Ongedaan maken");

const deleteLabel = new TextBundle()
  .add("en", "Delete selected")
  .add("de", "Auswahl löschen")
  .add("it", "Elimina selezione")
  .add("nl", "Verwijder selectie");

function deletedNoneRowLabel(): TextBundle {
  return new TextBundle()
    .add("en", "No adjustments")
    .add("de", "Keine Anpassungen")
    .add("it", "Nessuna modifica")
    .add("nl", "Geen aanpassingen");
}

function deletedRowLabel(amount: number): TextBundle {
  return new TextBundle()
    .add("en", `${amount} row deleted`)
    .add("de", `${amount} Zeile gelöscht`)
    .add("it", `${amount} Riga eliminata`)
    .add("nl", `${amount} rij verwijderd`);
}

function deletedRowsLabel(amount: number): TextBundle {
  return new TextBundle()
    .add("en", `${amount} rows deleted`)
    .add("de", `${amount} Zeilen gelöscht`)
    .add("it", `${amount} Righe eliminate`)
    .add("nl", `${amount} rijen verwijderd`);
}

function deletedLabel(amount: number): TextBundle {
  if (amount === 0) return deletedNoneRowLabel();
  if (amount === 1) return deletedRowLabel(amount);
  return deletedRowsLabel(amount);
}

function singlePageLabel(): TextBundle {
  return new TextBundle()
    .add("en", "1 page")
    .add("de", "1 Seite")
    .add("it", "1 pagina")
    .add("nl", "1 pagina");
}

function multiplePagesLabel(amount: number): TextBundle {
  return new TextBundle()
    .add("en", `${amount} pages`)
    .add("de", `${amount} Seiten`)
    .add("it", `${amount} pagine`)
    .add("nl", `${amount} pagina's`);
}

function pagesLabel (amount: number): TextBundle {
  if (amount === 1) return singlePageLabel()
  return multiplePagesLabel(amount)
}
