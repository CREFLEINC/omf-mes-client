import { Chip, Icon, IconButton, TextField, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

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
  /** 유형별 수량 합계가 맞아야 할 수 — 외관 불량 수(불합격 수량) */
  target: number;
  onChange: (defectCodeId: number, value: string) => void;
  /** 줄 끝 휴지통 — 그 유형을 뺀다 */
  onRemove: (defectCodeId: number) => void;
}

/**
 * 불량 유형이 둘 이상일 때 유형별 불량 수량을 표로 받는다(사용자 지시 2026-11-04) — 하나면 외관 불량 수가 곧 그 유형의 수량이라
 * 이 표를 두지 않는다. 비었거나 0 · 소수인 칸은 테두리만 빨갛다. 표 규칙대로 열 폭 끌기 · 순서 바꾸기가 된다.
 * 표 오른쪽에 유형별 합계와 어긋남 라벨을 둔다(사용자 시안 2026-11-04).
 */
export const DefectQtyTable = ({ rows, qtys, target, onChange, onRemove }: DefectQtyTableProps) => {
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
    /* 고른 유형 칩 대신 줄 끝 휴지통으로 뺀다(사용자 지시 2026-11-04). */
    {
      key: 'remove',
      header: '',
      width: '56px',
      render: (row) => (
        <IconButton
          icon="delete"
          size="sm"
          aria-label={t.visual.removeDefectType(row.name)}
          onClick={() => onRemove(row.defectCodeId)}
        />
      ),
    },
  ];
  const sum = rows.reduce((total, row) => {
    const qty = Number((qtys[row.defectCodeId] ?? '').trim());
    return total + (Number.isInteger(qty) && qty > 0 ? qty : 0);
  }, 0);
  const mismatch = target > 0 && sum !== target;
  const ordered = useColumnOrder('omf-mes:parts-iqc:columns:defect-qty:order', columns);
  const resizable = useColumnWidths('omf-mes:parts-iqc:columns:defect-qty', ordered, {
    fitContent: false,
  });
  /*
   * 상자 폭 맞춤(useFitColumns)은 두지 않는다 — 옆 합계와 폭을 나누는 칸이라 잰 폭이 표를 다시 넓힌다.
   * 폭 없는 「불량 유형」 열이 남는 폭을 받는다.
   */
  const fit = { columns: resizable.columns };

  return (
    <div className="parts-iqc-defect-qty-wrap">
      <div className="parts-iqc-grid-scroll" style={resizable.style}>
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
      {/* 표 오른쪽 — 유형별 합계 · 어긋나면 「수량 불일치」 라벨(사용자 시안 2026-11-04). */}
      <div className="parts-iqc-defect-sum" data-mismatch={mismatch ? '' : undefined}>
        <span className="parts-iqc-defect-sum-label">{t.visual.defectSumLabel}</span>
        <strong>{t.visual.defectSumValue(sum, target)}</strong>
        {mismatch && (
          <Chip
            variant="status"
            size="sm"
            status="error"
            leadingIcon={<Icon name="error" size={16} aria-hidden />}
          >
            {t.visual.defectSumMismatchChip}
          </Chip>
        )}
      </div>
    </div>
  );
};
