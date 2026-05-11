import { PropsUITableRow } from '../types/elements';

export const MAX_ROWS = 50000;

export function truncateRows(rows: PropsUITableRow[], maxRows: number = MAX_ROWS) {
  const truncatedRowCount = Math.max(0, rows.length - maxRows);
  const truncatedRows = rows.slice(0, maxRows);
  return { truncatedRows, truncatedRowCount };
}
