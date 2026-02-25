import { truncateRows } from './truncation';
import { PropsUITableRow } from '../types/elements';

function makeRows(count: number): PropsUITableRow[] {
  return Array.from({ length: count }, (_, i) => ({
    __type__: 'PropsUITableRow' as const,
    id: `row-${i}`,
    cells: [{ __type__: 'PropsUITableCell' as const, text: `value-${i}` }],
  }));
}

describe('truncateRows', () => {
  it('should not truncate rows under max limit', () => {
    const rows = makeRows(100);
    const result = truncateRows(rows, 500);

    expect(result.truncatedRows.length).toBe(100);
    expect(result.truncatedRowCount).toBe(0);
  });

  it('should not truncate rows at exactly max limit', () => {
    const rows = makeRows(500);
    const result = truncateRows(rows, 500);

    expect(result.truncatedRows.length).toBe(500);
    expect(result.truncatedRowCount).toBe(0);
  });

  it('should truncate rows over max limit', () => {
    const rows = makeRows(1000);
    const result = truncateRows(rows, 500);

    expect(result.truncatedRows.length).toBe(500);
    expect(result.truncatedRowCount).toBe(500);
  });

  it('should keep the first N rows when truncating', () => {
    const rows = makeRows(100);
    const result = truncateRows(rows, 10);

    expect(result.truncatedRows[0].id).toBe('row-0');
    expect(result.truncatedRows[9].id).toBe('row-9');
  });

  it('should handle empty rows array', () => {
    const rows: PropsUITableRow[] = [];
    const result = truncateRows(rows, 500);

    expect(result.truncatedRows.length).toBe(0);
    expect(result.truncatedRowCount).toBe(0);
  });

  it('should use default MAX_ROWS when not specified', () => {
    const rows = makeRows(100);
    const result = truncateRows(rows);

    expect(result.truncatedRows.length).toBe(100);
    expect(result.truncatedRowCount).toBe(0);
  });
});
