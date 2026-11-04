import { TextField, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { useFitColumns } from '../../patterns/column-fit';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useColumnWidths } from '../../patterns/column-resize';

const t = messages.partsIqcInspection;

interface DefectQtyRow {
  defectCodeId: number;
  name: string;
}

export interface DefectQtyTableProps {
  rows: readonly DefectQtyRow[];
  qtys: Readonly<Record<number, string>>;
  onChange: (defectCodeId: number, value: string) => void;
}

/**
 * 불량 유형이 둘 이상일 때 유형별 불량 수량을 표로 받는다(사용자 지시 2026-11-04) — 하나면 외관 불량 수가 곧 그 유형의 수량이라
 * 이 표를 두지 않는다. 비었거나 0 · 소수인 칸은 테두리만 빨갛다. 표 규칙대로 열 폭 끌기 · 순서 바꾸기가 된다.
 */
export const DefectQtyTable = ({ rows, qtys, onChange }: DefectQtyTableProps) => {
  const columns: Column<DefectQtyRow>[] = [
    { key: 'type', header: t.visual.defectQtyTypeColumn, render: (row) => row.name },
    {
      key: 'qty',
      header: t.visual.defectQtyColumn,
      width: '160px',
      render: (row) => {
        const value = qtys[row.defectCodeId] ?? '';
        const qty = Number(value.trim());
        return (
          <TextField
            size="sm"
            fullWidth
            inputMode="numeric"
            aria-label={`${row.name} ${t.visual.defectQtyColumn}`}
            value={value}
            /* 테두리만 빨갛게 — 글은 화면 읽기로만 남긴다(OA 검사 화면 규칙과 같은 클래스). */
            {...(value.trim() === '' || !Number.isInteger(qty) || qty <= 0
              ? {
                  error: t.visual.defectQtyColumn,
                  containerClassName: 'iqc-inspection-border-only',
                }
              : {})}
            trailingIcon={<span>{t.visual.unit}</span>}
            /* 앞자리 0 은 뗀다 — 외관 불량 수와 같은 규칙. */
            onChange={(event) =>
              onChange(row.defectCodeId, event.target.value.replace(/^0+(?=\d)/, ''))
            }
          />
        );
      },
    },
  ];
  const ordered = useColumnOrder('omf-mes:parts-iqc:columns:defect-qty:order', columns);
  const resizable = useColumnWidths('omf-mes:parts-iqc:columns:defect-qty', ordered, {
    fitContent: true,
  });
  const fit = useFitColumns(resizable.columns, { scrollX: true });

  return (
    <div ref={fit.ref} className="parts-iqc-grid-scroll wide-table" style={resizable.style}>
      <table className="parts-iqc-history parts-iqc-defect-qty-table">
        <thead>
          <tr>
            {fit.columns.map((column) => (
              <th key={column.key} scope="col" style={{ width: column.width }}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.defectCodeId}>
              {fit.columns.map((column) => (
                <td key={column.key}>{column.render?.(row, index)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
