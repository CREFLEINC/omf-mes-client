import { Progress, Radio, RadioGroup, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactElement, type ReactNode } from 'react';

import { isKnownCode, type CodeOption } from '../pqc-inspection/code-options';
import { canChooseDisposition, type DispositionState } from '../pqc-inspection/disposition';
import {
  formatMicro,
  toMicro,
  toTotals,
  validateQuantities,
  type QuantityDraft,
} from '../pqc-inspection/quantity-draft';

const t = messages.pqcInspectionRegister.web;
const tResult = messages.pqcInspection.result;
const tDisposition = messages.pqcInspection.disposition;
const unknownValue = messages.pqcInspection.emptyValue;

type PadTarget = { key: keyof QuantityDraft | 'inspected'; label: string };

export interface ResultFormProps {
  inspectedDraft: string;
  onInspectedChange: (raw: string) => void;
  inspectedQty: number;
  /** 총 검사 수량(의뢰 수량) — 「검사 수량 입력」 제목 줄 오른쪽 끝에 낸다(#133 과 같다). */
  targetQty: number;
  /** 이어 쓰거나 확정된 회차 번호. 회차가 아직 없으면 `null` — 아무것도 보이지 않는다(#133 과 같다). */
  inspectionRound?: number | null;
  uomCode: string | null;
  draft: QuantityDraft;
  onChange: (draft: QuantityDraft) => void;
  fieldErrors: Record<string, string>;
  errorBanner?: ReactNode;
  showErrors: boolean;
  judgmentOptions: CodeOption[];
  judgment: string;
  onJudgmentChange: (code: string) => void;
  disposition: DispositionState;
  onDispositionChange: (choice: DispositionState) => void;
  /** POP 분할 화면과 같은 꼴을 맞추려 받는다 — 관리웹에는 화면 키패드가 없어 쓰지 않는다. */
  onPadFieldChange: (target: PadTarget | null) => void;
  isLocked: boolean;
  /** 판정 칸 아래 자리 — 검사기준이 없을 때의 「검사 내용」 입력(#135). */
  judgmentBelow?: ReactNode;
}

const FIELD_OF: Record<string, keyof QuantityDraft> = {
  acceptedQty: 'accepted',
  rejectedQty: 'rejected',
  heldQty: 'held',
};

const rejectedMicro = (raw: string): bigint | null => (raw.trim() === '' ? 0n : toMicro(raw));

/** 종합 판정 「불합격」 코드 — 이때만 불합격 처분 칸을 보인다(#135 · 담당자 지시). */
const REJECTED_JUDGMENT = 'REJECTED';

const toDisposition = (value: string): DispositionState =>
  value === 'REWORK' || value === 'SCRAP' ? value : null;

/**
 * W-03-11 관리웹 결과 입력(omf-all-around#135) — IQC 판정 화면(#133)과 같은 짜임이다.
 * 「검사 수량 입력」(검사 수량 · 합격 · 불합격 · 보류 + 입력 현황 막대) → 「판정」(최종 판정 · 불합격 처분).
 * ⛔ 계산·검증·저장 규칙은 그대로다 — 합계는 `toTotals`, 칸 오류는 `validateQuantities` 가 정한다. 보이는 모양만 바꾼다.
 * POP 분할 화면은 `split-result-form.tsx` 를 쓴다 — 이 파일은 관리웹만 쓴다.
 */
export const ResultForm = ({
  inspectedDraft,
  onInspectedChange,
  inspectedQty,
  targetQty,
  inspectionRound = null,
  uomCode,
  draft,
  onChange,
  fieldErrors,
  errorBanner,
  showErrors,
  judgmentOptions,
  judgment,
  onJudgmentChange,
  disposition,
  onDispositionChange,
  isLocked,
  judgmentBelow,
}: ResultFormProps) => {
  const judgmentId = useId();
  const dispositionName = useId();
  const dispositionLabelId = useId();
  const errors = validateQuantities(draft);
  const totals = toTotals(draft, inspectedQty);
  const inspectedInvalid = inspectedDraft.trim() !== '' && toMicro(inspectedDraft) === null;
  const canChoose = canChooseDisposition(rejectedMicro(draft.rejected));

  const serverErrorOf = (key: keyof QuantityDraft): string | undefined => {
    const entry = Object.entries(FIELD_OF).find(([, local]) => local === key);

    return entry === undefined ? undefined : fieldErrors[entry[0]];
  };

  const withUnit = (value: string): string => (uomCode === null ? value : `${value} ${uomCode}`);

  /* 입력 현황 — 계산은 `toTotals` 그대로, 보이는 값만 정한다(진행 노랑 · 완료 초록 · 초과 빨강 · #133 과 같다). */
  const isOver = totals.kind === 'counted' && totals.remaining < 0n;
  const isDone = totals.kind === 'counted' && totals.matches;
  const sumText = totals.kind === 'counted' ? formatMicro(totals.sum) : unknownValue;
  const inspectedText =
    totals.kind === 'counted' ? withUnit(formatMicro(totals.inspected)) : unknownValue;
  const overText = isOver ? withUnit(formatMicro(-totals.remaining)) : '';
  const progress =
    totals.kind === 'uncountable'
      ? { value: 0, tone: 'idle' as const }
      : isDone
        ? { value: 100, tone: 'success' as const }
        : isOver
          ? { value: 100, tone: 'error' as const }
          : {
              value:
                totals.inspected > 0n ? Number((totals.sum * 10000n) / totals.inspected) / 100 : 0,
              tone: 'warning' as const,
            };

  const field = (
    label: string,
    value: string,
    error: string | undefined,
    onValue: (raw: string) => void,
  ): ReactElement => (
    <div className="pqc-web-qty-field">
      <TextField
        label={label}
        inputMode="decimal"
        value={value}
        disabled={isLocked}
        error={error}
        onChange={(event) => onValue(event.target.value)}
      />
      {uomCode !== null && <span className="pqc-web-qty-unit">{uomCode}</span>}
    </div>
  );

  const quantityField = (key: keyof QuantityDraft, label: string, invalid: boolean): ReactElement =>
    field(
      label,
      draft[key],
      serverErrorOf(key) ?? (showErrors && invalid ? tResult.quantityInvalid : undefined),
      (raw) => onChange({ ...draft, [key]: raw }),
    );

  return (
    <>
      {/* ── 검사 수량 입력 — 검사 수량을 합격 · 불합격 · 보류로 나눈 결과와 그 입력 현황 ── */}
      <section className="pqc-web-section" aria-label={t.quantity.heading}>
        <div className="pqc-web-section-head">
          <h3>{t.quantity.heading}</h3>
          {inspectionRound !== null && (
            <p className="field-note">{t.quantity.round(inspectionRound)}</p>
          )}
          {/* 총 검사 수량은 제목 줄 오른쪽 끝에 — IQC 판정 화면(#133)과 같은 자리·모양이다. */}
          <dl className="pqc-web-qty-base">
            <dt className="pqc-web-progress-label">{t.quantity.targetQty}</dt>
            <dd>{withUnit(String(targetQty))}</dd>
          </dl>
        </div>

        {errorBanner}

        <div className="pqc-web-qty" data-over={isOver ? '' : undefined}>
          {field(
            t.quantity.inspectedQty,
            inspectedDraft,
            showErrors && inspectedInvalid ? tResult.quantityInvalid : undefined,
            onInspectedChange,
          )}
          {quantityField('accepted', t.quantity.accepted, errors.accepted)}
          {quantityField('rejected', t.quantity.rejected, errors.rejected)}
          {quantityField('held', t.quantity.held, errors.held)}
        </div>

        <div
          className="pqc-web-progress"
          data-state={isOver ? 'over' : isDone ? 'done' : undefined}
        >
          <div className="pqc-web-progress-row">
            <span className="pqc-web-progress-sum">
              <span className="pqc-web-progress-label">{t.quantity.entered} </span>
              {totals.kind === 'counted' ? `${sumText} / ${inspectedText}` : sumText}
            </span>
            <span className="pqc-web-progress-status">
              {isOver ? (
                t.quantity.overBy(overText)
              ) : (
                <>
                  <span className="pqc-web-progress-label">{t.quantity.remaining} </span>
                  {totals.kind === 'counted'
                    ? withUnit(formatMicro(totals.remaining))
                    : unknownValue}
                </>
              )}
            </span>
          </div>
          <Progress
            value={progress.value}
            tone={progress.tone}
            label={t.quantity.progressLabel}
            valueText={`${sumText} / ${inspectedText}`}
          />
          {isOver && <p className="field-note">{t.quantity.overNote(overText)}</p>}
        </div>
      </section>

      {/* ── 판정 — 최종 판정과 불합격 처분 ── */}
      <section className="pqc-web-section" aria-label={t.judgment.heading}>
        <h3>{t.judgment.heading}</h3>

        <div className="pqc-web-judgment">
          <div className="field-cell pqc-web-judgment-field" data-judgment={judgment || undefined}>
            <span className="field-label">
              <label htmlFor={judgmentId}>{t.judgment.label}</label>
              <span className="required-mark" aria-hidden="true">
                {' *'}
              </span>
            </span>
            <Select
              id={judgmentId}
              options={judgmentOptions}
              value={judgment}
              placeholder={
                judgmentOptions.length === 0 ? tResult.judgmentUnavailable : t.judgment.placeholder
              }
              disabled={isLocked || judgmentOptions.length === 0}
              onChange={(code) => {
                onJudgmentChange(code);
                /* 불합격이 아니면 처분 칸이 사라진다 — 앞서 고른 처분이 숨은 채 남지 않게 거둔다. */
                if (code !== REJECTED_JUDGMENT) onDispositionChange(null);
              }}
            />
            {judgmentOptions.length > 0 && !isKnownCode(judgmentOptions, judgment) && (
              <p className="field-note">{tResult.judgmentUnknown(judgment)}</p>
            )}
          </div>

          {/* 불합격 처분은 판정이 「불합격」일 때만 보인다. 고를 수 있는 조건(불합격 수량)은 그대로다. */}
          {judgment === REJECTED_JUDGMENT && (
            <div className="field-cell pqc-web-disposition-field">
              <span className="field-label" id={dispositionLabelId}>
                {tDisposition.heading}
              </span>
              <span className="pqc-web-disposition-note">{tDisposition.note}</span>
              <RadioGroup
                className="pqc-web-disposition"
                name={dispositionName}
                value={disposition ?? ''}
                disabled={isLocked || !canChoose}
                aria-labelledby={dispositionLabelId}
                onChange={(value) =>
                  onDispositionChange(value === '' ? null : toDisposition(value))
                }
              >
                <Radio value="REWORK">{tDisposition.rework}</Radio>
                <Radio value="SCRAP">{tDisposition.scrap}</Radio>
              </RadioGroup>
            </div>
          )}
        </div>
        {judgmentBelow}
      </section>
    </>
  );
};
