import { Button, TextField } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useState, type FormEvent, type ReactElement } from 'react';

import { SaveErrorBanner } from '../../patterns/master';

import {
  formatMicro,
  hasQuantityError,
  toTotals,
  validateQuantities,
  type QuantityDraft,
} from './quantity-draft';
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
 * ⛔ **검사자·단말을 보내지 않는다.** 계약에서 사라졌다 — 검사자는 로그인한 주체에서 서버가
 * 정하는 값이라 화면이 만들 수 없고, 세션 값을 실으면 품질 감사 기록에 엉뚱한 사람이 남는다
 * (omf-mes#173). 단말도 같다.
 *
 * ⭐ **합계가 맞지 않아도 저장된다.** 임시 저장은 판정을 확정하는 것이 아니라 하던 일을 남기는
 * 것이고, 계약도 「작성중」에는 합계 제약을 걸지 않는다(스펙 §6). **막는 것은 수량이 아닌 값이
 * 남아 있을 때뿐이다** — 보낼 수 없는 값이라서지 합계 때문이 아니다.
 *
 * ⛔ **오류를 타이핑마다 보이지 않는다.** 「0.5」를 치는 정상 경로가 `0` → `0.` → `0.5` 라,
 * 가운데 한 글자 동안 「수량이 아니다」가 뜨면 맞게 치는 사람에게 틀렸다고 말하는 셈이다.
 * 조건 줄(`queue-filter-bar.tsx`)과 같은 규율로 **저장을 누른 뒤부터** 보인다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.iqcInspection.result;
const unknownValue = messages.iqcInspection.queue.emptyValue;

export interface ResultFormPaneProps {
  /** 편집할 회차. 아직 아무도 손대지 않은 의뢰면 `null` */
  round: InspectionResultRound | null;
  /** 검사수량 — 회차가 있으면 그 값, 없으면 의뢰의 입하 등록 수량이다(§4-B 「자동」) */
  inspectedQty: number;
  draft: QuantityDraft;
  onChange: (draft: QuantityDraft) => void;
  onSave: () => void;
  isSaving: boolean;
  /** 마지막 저장이 성공했는가. 눌렀는데 아무 일도 없어 보이지 않게 한 줄로 알린다 */
  isSaved: boolean;
  /** 서버가 칸을 짚어 준 오류. 로컬 검증 결과와 합쳐 그 칸에 낸다 */
  fieldErrors: Record<string, string>;
  saveError: ApiError | null;
  /** 충돌일 때 「최신 불러오기」를 낸다. 재조회로 풀리지 않는 오류에는 배너가 내지 않는다 */
  onReload: () => void;
}

/** 계약이 짚어 줄 수 있는 칸 이름 ↔ 화면의 초안 칸. */
const FIELD_OF: Record<string, keyof QuantityDraft> = {
  acceptedQty: 'accepted',
  rejectedQty: 'rejected',
  heldQty: 'held',
};

export const ResultFormPane = ({
  round,
  inspectedQty,
  draft,
  onChange,
  onSave,
  isSaving,
  isSaved,
  fieldErrors,
  saveError,
  onReload,
}: ResultFormPaneProps) => {
  const isConfirmed = round?.statusCode === '확정';
  const errors = validateQuantities(draft);
  const totals = toTotals(draft, inspectedQty);
  const [showErrors, setShowErrors] = useState(false);

  /**
   * 저장. **합계가 맞지 않아도 보낸다** — 막는 것은 보낼 수 없는 값이 남아 있을 때뿐이다.
   */
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setShowErrors(true);

    if (hasQuantityError(errors)) return;

    onSave();
  };

  /** 서버가 짚어 준 칸 오류를 화면의 칸 이름으로 옮긴다. */
  const serverErrorOf = (key: keyof QuantityDraft): string | undefined => {
    const entry = Object.entries(FIELD_OF).find(([, local]) => local === key);

    return entry === undefined ? undefined : fieldErrors[entry[0]];
  };

  /**
   * 합계 상태를 한 문장으로. **모자란 양·넘긴 양을 숫자로 말한다** — 「맞지 않습니다」만
   * 내면 사용자가 세 칸을 다시 더해 봐야 한다.
   *
   * ⛔ **셀 수 없으면 아무 말도 하지 않는다.** 한 칸이라도 수량이 아니면 합계는 알 수 없는
   * 것이고, 그때 「일치합니다」든 「모자랍니다」든 내면 **거짓을 말하는 것**이다. 무엇을
   * 고쳐야 하는지는 그 칸의 오류가 이미 말한다.
   */
  const totalsNote =
    totals.kind === 'uncountable'
      ? null
      : totals.matches
        ? t.matched
        : totals.remaining > 0n
          ? t.short(formatMicro(totals.remaining))
          : t.over(formatMicro(-totals.remaining));

  const field = (key: keyof QuantityDraft, label: string, invalid: boolean): ReactElement => (
    <TextField
      label={label}
      inputMode="decimal"
      value={draft[key]}
      disabled={isConfirmed || isSaving}
      disabledReason={isConfirmed ? t.confirmed : undefined}
      /* 서버가 짚어 준 것을 먼저 낸다 — 그쪽이 이 값에 대해 더 아는 쪽이다. */
      error={serverErrorOf(key) ?? (showErrors && invalid ? t.quantityInvalid : undefined)}
      onChange={(event) => onChange({ ...draft, [key]: event.target.value })}
    />
  );

  return (
    <form aria-label={t.heading} onSubmit={submit}>
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
        {/* 셀 수 없을 때 0으로 읽은 합을 보이면 그 숫자 자체가 거짓이다. 없음 표시를 낸다. */}
        <div className="field-cell">
          <dt className="field-label">{t.sum}</dt>
          <dd>{totals.kind === 'counted' ? formatMicro(totals.sum) : unknownValue}</dd>
        </div>
        <div className="field-cell">
          <dt className="field-label">{t.remaining}</dt>
          <dd>{totals.kind === 'counted' ? formatMicro(totals.remaining) : unknownValue}</dd>
        </div>
      </dl>

      {totalsNote !== null && <p className="field-note">{totalsNote}</p>}

      <SaveErrorBanner error={saveError} onReload={onReload} />

      {/*
       * ⛔ **확정된 회차에는 저장 자리를 만들지 않는다**(공유계약 G-23 — 누를 수 있는데 아무
       * 일도 없는 컨트롤을 두지 않는다). 이전 회차는 정정하지 않고 재검사로 새 회차를 쌓는다.
       */}
      {!isConfirmed && (
        <div className="form-actions">
          {/* 눌렀는데 아무 일도 없어 보이지 않게 결과를 한 줄로 알린다. */}
          {isSaved && <p className="field-note form-actions-secondary">{t.saved}</p>}
          {showErrors && hasQuantityError(errors) && (
            <p className="field-note form-actions-secondary">{t.saveBlockedByInvalid}</p>
          )}
          <Button type="submit" variant="filled" size="sm" disabled={isSaving}>
            {isSaving ? t.saving : t.save}
          </Button>
        </div>
      )}
    </form>
  );
};
