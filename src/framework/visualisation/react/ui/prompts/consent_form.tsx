import { assert, Weak } from '../../../../helpers'
import { PropsUITable, PropsUITableBody, PropsUITableCell, PropsUITableHead, PropsUITableRow } from '../../../../types/elements'
import { PropsUIPromptConsentForm, PropsUIPromptConsentFormTable } from '../../../../types/prompts'
import { Table } from '../elements/table'
import { LabelButton, PrimaryButton } from '../elements/button'
import { BodyLarge, Title4 } from '../elements/text'
import TextBundle from '../../../../text_bundle'
import { Translator } from '../../../../translator'
import { ReactFactoryContext } from '../../factory'
import React from 'react'
import _ from 'lodash'

type Props = Weak<PropsUIPromptConsentForm> & ReactFactoryContext

interface TableContext {
  title: string
  deletedRowCount: number
}

export const ConsentForm = (props: Props): JSX.Element => {
  const tablesIn = React.useRef<Array<PropsUITable & TableContext>>(parseTables(props.tables))
  const metaTables = React.useRef<Array<PropsUITable & TableContext>>(parseTables(props.metaTables))
  const tablesOut = React.useRef<Array<PropsUITable & TableContext>>(tablesIn.current)
  const [waiting, setWaiting] = React.useState<boolean>(false)

  const { locale, resolve } = props
  const cancelButton = Translator.translate(cancelButtonLabel, props.locale)

  function rowCell (dataFrame: any, column: string, row: number): PropsUITableCell {
    const text = String(dataFrame[column][`${row}`])
    return { __type__: 'PropsUITableCell', text: text }
  }

  function headCell (dataFrame: any, column: string): PropsUITableCell {
    return { __type__: 'PropsUITableCell', text: column }
  }

  function columnNames (dataFrame: any): string[] {
    return Object.keys(dataFrame)
  }

  function columnCount (dataFrame: any): number {
    return columnNames(dataFrame).length
  }

  function rowCount (dataFrame: any): number {
    if (columnCount(dataFrame) === 0) {
      return 0
    } else {
      const firstColumn = dataFrame[columnNames(dataFrame)[0]]
      return Object.keys(firstColumn).length - 1
    }
  }

  function rows (data: any): PropsUITableRow[] {
    const result: PropsUITableRow[] = []
    const nRows = rowCount(data)
    for (let row = 0; row <= nRows; row++) {
      const id = `${row}`
      const cells = columnNames(data).map((column: string) => rowCell(data, column, row))
      result.push({ __type__: 'PropsUITableRow', id, cells })
    }
    return result
  }

  function parseTables (tablesData: PropsUIPromptConsentFormTable[]): Array<PropsUITable & TableContext> {
    console.log('parseTables')
    return tablesData.map((table) => parseTable(table))
  }

  function parseTable (tableData: PropsUIPromptConsentFormTable): (PropsUITable & TableContext) {
    const id = tableData.id
    const title = Translator.translate(tableData.title, props.locale)
    const deletedRowCount = 0
    const dataFrame = JSON.parse(tableData.data_frame)
    const headCells = columnNames(dataFrame).map((column: string) => headCell(dataFrame, column))
    const head: PropsUITableHead = { __type__: 'PropsUITableHead', cells: headCells }
    const body: PropsUITableBody = { __type__: 'PropsUITableBody', rows: rows(dataFrame) }

    return { __type__: 'PropsUITable', id, head, body, title, deletedRowCount }
  }

  function renderTable (table: (Weak<PropsUITable> & TableContext), readOnly = false): JSX.Element {
    return (
      <div key={table.id} className='flex flex-col gap-4 mb-4'>
        <Title4 text={table.title} margin='' />
        <Table {...table} readOnly={readOnly} locale={locale} onChange={handleTableChange} />
      </div>
    )
  }

  function handleTableChange (id: string, rows: PropsUITableRow[]): void {
    const tablesCopy = tablesOut.current.slice(0)
    const index = tablesCopy.findIndex(table => table.id === id)
    if (index > -1) {
      const { title, head, body: oldBody, deletedRowCount: oldDeletedRowCount } = tablesCopy[index]
      const body: PropsUITableBody = { __type__: 'PropsUITableBody', rows }
      const deletedRowCount = oldDeletedRowCount + (oldBody.rows.length - rows.length)
      tablesCopy[index] = { __type__: 'PropsUITable', id, head, body, title, deletedRowCount }
    }
    tablesOut.current = tablesCopy
  }

  function handleDonate (): void {
    setWaiting(true)
    const value = serializeConsentData()
    resolve?.({ __type__: 'PayloadJSON', value })
  }

  function handleCancel (): void {
    resolve?.({ __type__: 'PayloadFalse', value: false })
  }

  function serializeConsentData (): string {
    const array = serializeTables().concat(serializeMetaData())
    return JSON.stringify(array)
  }

  function serializeMetaData (): any[] {
    return serializeMetaTables().concat(serializeDeletedMetaData())
  }

  function serializeTables (): any[] {
    return tablesOut.current.map((table) => serializeTable(table))
  }

  function serializeMetaTables (): any[] {
    return metaTables.current.map((table) => serializeTable(table))
  }

  function serializeDeletedMetaData (): any {
    const rawData = tablesOut.current
      .filter(({ deletedRowCount }) => deletedRowCount > 0)
      .map(({ id, deletedRowCount }) => `User deleted ${deletedRowCount} rows from table: ${id}`)

    const data = JSON.stringify(rawData)
    return { user_omissions: data }
  }

  function serializeTable ({ id, head, body: { rows } }: PropsUITable): any {
    const data = rows.map((row) => serializeRow(row, head))
    return { [id]: data }
  }

  function serializeRow (row: PropsUITableRow, head: PropsUITableHead): any {
    assert(row.cells.length === head.cells.length, `Number of cells in row (${row.cells.length}) should be equals to number of cells in head (${head.cells.length})`)
    const keys = head.cells.map((cell) => cell.text)
    const values = row.cells.map((cell) => cell.text)
    return _.fromPairs(_.zip(keys, values))
  }

  return (
    <>
      <BodyLarge text={Translator.translate(props.description ?? description, locale)} />
      <div className='flex flex-col gap-8'>
        {tablesIn.current.map((table) => renderTable(table))}
        <div>
          <BodyLarge margin='' text={Translator.translate(props.donateQuestion ?? donateQuestionLabel, locale)} />
          <div className='flex flex-row gap-4 mt-4 mb-4'>
            <PrimaryButton
              label={Translator.translate(props.donateButton ?? donateButtonLabel, locale)}
              onClick={handleDonate} color='bg-success text-white' spinning={waiting}
            />
            <LabelButton label={cancelButton} onClick={handleCancel} color='text-grey1' />
          </div>
        </div>
      </div>
    </>
  )
}

const donateQuestionLabel = new TextBundle()
  .add('en', 'Do you want to donate the above data?')
  .add('de', 'Möchten Sie die oben genannten Daten spenden?')
  .add('nl', 'Wilt u de bovenstaande gegevens doneren?')

const donateButtonLabel = new TextBundle()
  .add('en', 'Yes, donate')
  .add('de', 'Ja, spenden')
  .add('nl', 'Ja, doneer')

const cancelButtonLabel = new TextBundle()
  .add('en', 'No')
  .add('de', 'Nein')
  .add('nl', 'Nee')

const description = new TextBundle()
  .add('en', 'Determine whether you would like to donate the data below. Carefully check the data and adjust when required. With your donation you contribute to the previously described research. Thank you in advance.')
  .add('de', 'Legen Sie fest, ob Sie die untenstehenden Daten spenden möchten. Überprüfen Sie die Daten sorgfältig und passen Sie sie bei Bedarf an. Mit Ihrer Spende tragen Sie zur zuvor beschriebenen Forschung bei. Vielen Dank im Voraus.')
  .add('nl', 'Bepaal of u de onderstaande gegevens wilt doneren. Bekijk de gegevens zorgvuldig en pas zo nodig aan. Met uw donatie draagt u bij aan het eerder beschreven onderzoek. Alvast hartelijk dank.')
