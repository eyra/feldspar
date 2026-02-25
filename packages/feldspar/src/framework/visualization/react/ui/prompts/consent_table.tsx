import {
  PropsUITable,
  PropsUITableHead,
  PropsUITableRow,
} from "../../../../types/elements";
import { Table } from "../elements/table";
import { BodyLarge, Title4 } from "../elements/text";
import React, {
  JSX,
  forwardRef,
  useImperativeHandle,
  MutableRefObject,
} from "react";
import {
  DataSubmissionData,
  DataSubmissionProvider,
} from "../../../../types/data_submission";
import _ from "lodash";
import { PromptContext } from "./factory";
import { NumberIcon } from '../elements/number_icon'
import { truncateRows, MAX_ROWS } from '../../../../utils/truncation'

interface Props {
  table: PropsUITable & {
    number: number;
    title: string;
    description?: string;
    deletedRowCount: number;
  };
  readOnly?: boolean;
  context: PromptContext;
  onChange: (id: string, rows: PropsUITableRow[]) => void;
}

export interface ConsentTableHandle extends DataSubmissionProvider {}

export const ConsentTable = forwardRef<ConsentTableHandle | null, Props>(
  ({ table, readOnly = false, context, onChange }, ref): JSX.Element => {
    const [currentTable, setCurrentTable] = React.useState<
      PropsUITable & {
        number: number;
        title: string;
        description?: string;
        deletedRowCount: number;
      }
    >(truncatedTable(table));

    const handleChange = (rows: PropsUITableRow[], deletedCount: number) => {
      context.onDataSubmissionDataChanged(
        table.id,
        getDataSubmissionData(table.head, rows, deletedCount)
      );
    };

    React.useEffect(() => {
      console.log("ConsentTable useEffect", currentTable);
      const { truncatedRows, truncatedRowCount } = truncateRows(table.body.rows ?? []);
      if (truncatedRowCount > 0) {
        console.warn(`ConsentTable "${table.id}" initial data exceeds ${MAX_ROWS} rows. Truncating.`);
      }

      setCurrentTable(truncatedTable(table));

      context.onDataSubmissionDataChanged(
        table.id,
        getDataSubmissionData(table.head, truncatedRows, truncatedRowCount)
      );
    }, [table]);

    return (
      <div key={table.id} className='flex flex-col gap-4 mb-20'>
        <div className='flex flex-row gap-4 items-center'>
          <NumberIcon number={currentTable.number} />
          <div className='pt-2px'>
            <Title4 text={currentTable.title} margin='' />
          </div>
        </div>
        <Table
          {...currentTable}
          readOnly={readOnly}
          locale={context.locale}
          onChange={handleChange}
          id={currentTable.id}
          key={currentTable.id}
        />
      </div>
    );
  }
);

function truncatedTable(
  t: PropsUITable & {
    number: number;
    title: string;
    description?: string;
    deletedRowCount: number;
  }
) {
  const rows = t.body?.rows ?? [];
  const { truncatedRows, truncatedRowCount } = truncateRows(rows);
  return {
    ...t,
    body: { ...t.body, rows: truncatedRows },
    deletedRowCount: (t.deletedRowCount ?? 0) + truncatedRowCount,
  };
}

function getDataSubmissionData(
  head: PropsUITableHead,
  rows: PropsUITableRow[],
  deletedRowCount: number
): DataSubmissionData {
  return {
    data: serializeTableData(head, rows),
    metadata: {
      deletedRowCount,
    },
  };
}

function serializeTableData(
  head: PropsUITableHead,
  rows: PropsUITableRow[]
): any[] {
  const limited = rows.slice(0, MAX_ROWS);
  return limited.map((row) => serializeRow(row, head));
}

function serializeRow(row: PropsUITableRow, head: PropsUITableHead): any {
  const keys = head.cells.map((cell) => cell.text);
  const values = row.cells.map((cell) => cell.text);
  return _.fromPairs(_.zip(keys, values));
}

ConsentTable.displayName = "ConsentTable";
