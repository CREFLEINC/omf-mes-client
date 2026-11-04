import { Chip, Icon, IconButton, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

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
 * 불량 유형이 둘 이상일 때 유형별 불량 수량을 받는 상자(사용자 시안 2026-11-04) — 하나면 외관 불량 수가 곧 그 유형의 수량이라
 * 이 상자를 두지 않는다. 머리 줄에 제목과 입력 합계 · 어긋나면 「불일치」 라벨, 줄마다 유형 이름 · 수량 칸 · 휴지통.
 * 비었거나 0 · 소수인 칸은 테두리만 빨갛다.
 */
export const DefectQtyTable = ({ rows, qtys, target, onChange, onRemove }: DefectQtyTableProps) => {
  const sum = rows.reduce((total, row) => {
    const qty = Number((qtys[row.defectCodeId] ?? '').trim());
    return total + (Number.isInteger(qty) && qty > 0 ? qty : 0);
  }, 0);
  const mismatch = target > 0 && sum !== target;

  return (
    <section className="parts-iqc-defect-qty-box" aria-labelledby="parts-iqc-defect-qty-title">
      <div className="parts-iqc-defect-qty-head">
        <h4 id="parts-iqc-defect-qty-title">{t.visual.defectQtyTitle}</h4>
        <div className="parts-iqc-defect-sum" data-mismatch={mismatch ? '' : undefined}>
          <span className="parts-iqc-defect-sum-label">{t.visual.defectSumLabel}</span>
          <strong>{t.visual.defectSumValue(sum, target)}</strong>
          {mismatch && <span aria-hidden="true">·</span>}
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
      <ul className="parts-iqc-defect-qty-list">
        {rows.map((row) => {
          const value = qtys[row.defectCodeId] ?? '';
          const qty = Number(value.trim());
          return (
            <li key={row.defectCodeId}>
              <span className="parts-iqc-defect-qty-name">{row.name}</span>
              <TextField
                size="sm"
                inputMode="numeric"
                aria-label={`${row.name} ${t.visual.defectQtyColumn}`}
                value={value}
                /* 테두리만 빨갛게 — 글은 화면 읽기로만 남긴다(OA 검사 화면 규칙과 같은 클래스). */
                {...(value.trim() === '' || !Number.isInteger(qty) || qty <= 0
                  ? {
                      error: t.visual.defectQtyColumn,
                      containerClassName: 'iqc-inspection-border-only parts-iqc-defect-qty-input',
                    }
                  : { containerClassName: 'parts-iqc-defect-qty-input' })}
                trailingIcon={<span>{t.visual.unit}</span>}
                /* 앞자리 0 은 뗀다 — 외관 불량 수와 같은 규칙. */
                onChange={(event) =>
                  onChange(row.defectCodeId, event.target.value.replace(/^0+(?=\d)/, ''))
                }
              />
              <IconButton
                icon="delete"
                size="sm"
                aria-label={t.visual.removeDefectType(row.name)}
                onClick={() => onRemove(row.defectCodeId)}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
};
