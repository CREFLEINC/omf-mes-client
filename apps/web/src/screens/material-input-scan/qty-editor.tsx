import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { applyKeypadKey, PuInput, PuKeypad, PuSection, PuUnit } from '../../patterns/pop-uniform';
import { validateQty } from './input-qty';

const t = messages.materialInputScan;

/**
 * 친 수량의 문제를 문장으로 옮긴다. **빈 칸은 아직 오류가 아니다** — 담자마자 붉은 글씨가
 * 뜨면 작업자가 무언가 잘못한 것으로 읽는다(C-7).
 */
const qtyError = (draft: string): string | undefined => {
  const problem = validateQty(draft);
  if (problem === null || problem === 'empty') return undefined;

  return t.scanned.qtyProblems[problem];
};

export interface QtySectionProps {
  /** 지금 넣는 LOT. 투입 중(스캔하고 아직 기록하지 않음)일 때만 칸과 키패드가 켜진다. 아니면 `null`. */
  lot: { lotId: number; lotNo: string } | null;
  /** 칸의 값(입력 중인 투입 수량). */
  qty: string;
  /** 칸 옆과 제목 줄 오른쪽 단위 — 넣는 자재 → 고른 자재 → 작업지시 단위. 모르면 빈 문자열. */
  uom: string;
  onQtyChange: (lotId: number, value: string) => void;
}

/**
 * 오른쪽 「투입 수량」 구획(POP 통일 규칙 8 — 키패드는 맨 오른쪽 열).
 *
 * 칸과 키패드는 담긴 LOT이 투입 중일 때만 켜진다 — 입력은 스캔에서만 시작한다(PI-29). 스캔하면 잔량이
 * 미리 채워지고(PI-05) 작업자가 고칠 수 있다(「미전송」이면 고친 양을 보낸다, PI-26). 소수점 키는 두지
 * 않는다(사용자 지시 2026-09-19, omf-all-around#35). 기록은 아래 작업 줄 [투입 등록]이 한다.
 */
export const QtySection = ({ lot, qty, uom, onQtyChange }: QtySectionProps) => {
  const titleId = useId();
  const errorId = useId();
  const isOn = lot !== null;
  const value = isOn ? qty : '';
  const error = isOn ? qtyError(value) : undefined;

  return (
    <PuSection
      title={
        <>
          {t.qty.title}
          <span className="req" aria-hidden>
            {' *'}
          </span>
        </>
      }
      labelId={titleId}
      meta={uom === '' ? undefined : <span className="pu-help">{t.qty.unit(uom)}</span>}
      split
      className="mi-qty"
      bodyClassName="mi-qty-body"
    >
      <div className="mi-qty-top">
        <div className="pu-row">
          <PuInput
            numeric
            target={isOn}
            need={error !== undefined}
            disabled={!isOn}
            aria-label={lot === null ? t.qty.title : t.scanned.qtyLabel(lot.lotNo)}
            aria-describedby={error === undefined ? undefined : errorId}
            placeholder="0"
            value={value}
            inputMode="decimal"
            autoComplete="off"
            onChange={(event) => {
              if (lot !== null) onQtyChange(lot.lotId, event.target.value);
            }}
          />
          <PuUnit>{uom === '' ? '—' : uom}</PuUnit>
        </div>
        {error !== undefined && (
          <p id={errorId} className="mi-qty-err">
            {error}
          </p>
        )}
      </div>
      <PuKeypad
        targetLabel={isOn ? t.qty.title : null}
        decimal={false}
        disabled={!isOn}
        onKey={(key) => {
          if (lot !== null) onQtyChange(lot.lotId, applyKeypadKey(qty, key, { decimal: false }));
        }}
        onClearAll={() => {
          if (lot !== null) onQtyChange(lot.lotId, '');
        }}
      />
    </PuSection>
  );
};
