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

interface Props {
  table: PropsUITable & {
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
        title: string;
        description?: string;
        deletedRowCount: number;
      }
    >(table);

    const handleChange = (rows: PropsUITableRow[], deletedCount: number) => {
      context.onDataSubmissionDataChanged(
        table.id,
        getDataSubmissionData(table.head, rows, deletedCount)
      );
    };

    React.useEffect(() => {
      console.log("ConsentTable useEffect", currentTable);
      context.onDataSubmissionDataChanged(
        table.id,
        getDataSubmissionData(table.head, table.body.rows, 0)
      );
    }, []);

    return (
      <div key={table.id} className="flex flex-col gap-4 mb-20">
        <Title4 text={table.title} margin="" />
        {table.description && <BodyLarge text={table.description} margin="" />}
        <Table
          {...currentTable}
          readOnly={readOnly}
          {...context}
          onChange={handleChange}
        />
      </div>
    );
  }
);

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
  return rows.map((row) => serializeRow(row, head));
}

function serializeRow(row: PropsUITableRow, head: PropsUITableHead): any {
  const keys = head.cells.map((cell) => cell.text);
  const values = row.cells.map((cell) => cell.text);
  return _.fromPairs(_.zip(keys, values));
}

ConsentTable.displayName = "ConsentTable";
