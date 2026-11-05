import type { Column } from '@crefle/web-ui';
import type { ReactNode } from 'react';
import { useColumnWidths } from '../../../patterns/column-resize';
import { useFitColumns } from '../../../patterns/column-fit';
import { SelectableTable, type SelectableTableProps } from '../../../patterns/selectable-table';

export const AdjustableTable = <T,>({
  storageKey,
  columns,
  ...props
}: SelectableTableProps<T> & { storageKey: string }) => {
  const resized = useColumnWidths(
    storageKey,
    columns.map((col) => ({
      ...col,
      align: 'start' as const,
      width: col.width?.endsWith('rem') ? `${Number.parseFloat(col.width) * 16}px` : col.width,
    })),
  );
  const fit = useFitColumns(resized.columns, { scrollX: true });
  return (
    <div ref={fit.ref} className="erp-wo-adjustable-table" style={resized.style}>
      <SelectableTable {...props} columns={fit.columns} />
    </div>
  );
};

export const AdjustableNativeTable = ({
  storageKey,
  labels,
  widths,
  className,
  children,
}: {
  storageKey: string;
  labels: ReactNode[];
  widths: number[];
  className?: string;
  children: ReactNode;
}) => {
  const resized = useColumnWidths(
    storageKey,
    labels.map((header, index): Column<unknown> => ({
      key: String(index),
      header,
      width: `${widths[index] ?? 120}px`,
    })),
  );
  const fit = useFitColumns(resized.columns, { scrollX: true });
  return (
    <div ref={fit.ref} className="erp-wo-adjustable-table" style={resized.style}>
      <table className={className} style={{ width: '100%', minWidth: 'var(--col-floor)' }}>
        <colgroup>
          {fit.columns.map((col) => (
            <col key={col.key} style={{ width: col.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {fit.columns.map((col) => (
              <th key={col.key} scope="col">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        {children}
      </table>
    </div>
  );
};
