import { TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactElement } from 'react';

import { formatMicro, toTotals, validateQuantities, type QuantityDraft } from './quantity-draft';
import type { InspectionResultRound } from './types';

/**
 * 수량 판정 구획 — **합계 제약이 이 구획을 지배한다.**
 *
 * ```
 * 합격 + 불합격 + 보류 = 검사수량
 * ```
 *
 * 세 칸을 손으로 넣고 합계·잔여를 실시간으로 보인다. ⛔ **자동 계산을 만들지 않는다** —
 * 어느 칸을 자동으로 채울지가 아직 정해지지 않았다(스펙 §8-4). 편의를 먼저 얹으면 규칙이
 * 정해질 때 사용자가 이미 익힌 동작을 뒤집어야 한다.
 *
 * ⛔ **확정된 회차는 고칠 수 있는 것처럼 보이지 않게 한다.** 이전 회차는 정정하지 않고
 * 재검사로 새 회차를 쌓는다(§5-3). 잠근 이유를 사유로 함께 밝힌다.
 *
 * ⚠ **저장 단추가 아직 없다.** 계약의 `inspectorId` 를 화면이 채울 수 없어(로그인 사용자와
 * 작업자가 다른 번호 공간이다 — omf-mes#173) 쓰기를 다음 회차로 미뤘다. 누를 수 없는 단추를
 * 미리 두지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.iqcInspection.result;

export interface ResultFormPaneProps {
  /** 편집할 회차. 아직 아무도 손대지 않은 의뢰면 `null` */
  round: InspectionResultRound | null;
  /** 검사수량 — 회차가 있으면 그 값, 없으면 의뢰의 입하 등록 수량이다(§4-B 「자동」) */
  inspectedQty: number;
  draft: QuantityDraft;
  onChange: (draft: QuantityDraft) => void;
}

export const ResultFormPane = ({ round, inspectedQty, draft, onChange }: ResultFormPaneProps) => {
  const isConfirmed = round?.statusCode === '확정';
  const errors = validateQuantities(draft);
  const totals = toTotals(draft, inspectedQty);

  /**
   * 합계 상태를 한 문장으로. **모자란 양·넘긴 양을 숫자로 말한다** — 「맞지 않습니다」만
   * 내면 사용자가 세 칸을 다시 더해 봐야 한다.
   */
  const totalsNote = totals.matches
    ? t.matched
    : totals.remaining > 0n
      ? t.short(formatMicro(totals.remaining))
      : t.over(formatMicro(-totals.remaining));

  const field = (key: keyof QuantityDraft, label: string, invalid: boolean): ReactElement => (
    <TextField
      label={label}
      inputMode="decimal"
      value={draft[key]}
      disabled={isConfirmed}
      disabledReason={isConfirmed ? t.confirmed : undefined}
      error={invalid ? t.quantityInvalid : undefined}
      onChange={(event) => onChange({ ...draft, [key]: event.target.value })}
    />
  );

  return (
    <section aria-label={t.heading}>
      <p className="field-note">{round === null ? t.notStarted : t.round(round.inspectionRound)}</p>

      <dl className="filter-bar">
        <div className="field-cell">
          <dt className="field-label">{t.fields.inspectedQty}</dt>
          <dd>{String(inspectedQty)}</dd>
        </div>
      </dl>

      <div className="form-grid">
        {field('accepted', t.fields.accepted, errors.accepted)}
        {field('rejected', t.fields.rejected, errors.rejected)}
        {field('held', t.fields.held, errors.held)}
      </div>

      <dl className="filter-bar">
        <div className="field-cell">
          <dt className="field-label">{t.sum}</dt>
          <dd>{formatMicro(totals.sum)}</dd>
        </div>
        <div className="field-cell">
          <dt className="field-label">{t.remaining}</dt>
          <dd>{formatMicro(totals.remaining)}</dd>
        </div>
      </dl>

      <p className="field-note">{totalsNote}</p>
    </section>
  );
};
