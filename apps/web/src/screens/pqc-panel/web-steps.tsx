import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useRef, type ReactNode } from 'react';

import { InspectionQtyLine, type InspectionQtyStatus } from '../../patterns/inspection-qty-line';
import { InspectionSteps, type InspectionStepItem } from '../../patterns/inspection-steps';
import { isKnownCode, type CodeOption } from '../pqc-inspection/code-options';
import type { DispositionState } from '../pqc-inspection/disposition';
import {
  isAllJudged,
  judgedCount,
  type MeasurementDrafts,
} from '../pqc-inspection/measurement-draft';
import type { MeasurementRow } from '../pqc-inspection/measurement-rows';
import {
  canConfirm,
  formatMicro,
  hasQuantityError,
  toMicro,
  toTotals,
  validateQuantities,
  type QuantityDraft,
} from '../pqc-inspection/quantity-draft';

import { PqcJudgmentFields } from './result-form';
import { WebItemTable } from './web-item-table';

const t = messages.pqcInspectionRegister.web;
const tHub = messages.common.inspectionHub;
const tResult = messages.pqcInspection.result;

const ACCEPTED = 'ACCEPTED';
const REJECTED = 'REJECTED';

/**
 * 수량으로 채울 최종 판정(사용자 지시 2026-10-29 · #197) — IQC 와 같은 규칙. 불합격이 하나라도 있으면 불합격, 검사 수량
 * 전부가 합격이면 합격, 그 밖(보류 등)은 사람이 고른다. 수량이 아닌 값이 있으면 판정하지 않는다.
 */
export const autoJudgmentOf = (draft: QuantityDraft, inspectedQty: number): string | null => {
  if (hasQuantityError(validateQuantities(draft))) return null;
  if ((toMicro(draft.rejected) ?? 0n) > 0n) return REJECTED;
  const totals = toTotals(draft, inspectedQty);
  return totals.kind === 'counted' &&
    totals.matches &&
    (toMicro(draft.accepted) ?? 0n) === totals.inspected
    ? ACCEPTED
    : null;
};

const FIELD_OF: Record<string, keyof QuantityDraft> = {
  acceptedQty: 'accepted',
  rejectedQty: 'rejected',
  heldQty: 'held',
};

export interface PqcWebStepsProps {
  rows: MeasurementRow[];
  drafts: MeasurementDrafts;
  onValueChange: (key: string, value: string) => void;
  onItemJudgmentChange: (key: string, judgment: string) => void;
  itemJudgmentOptions: CodeOption[];
  uomCodeOf: (uomId: number | null) => string | null;
  itemsLoading: boolean;
  /** 적용 검사 기준 — 없으면 ① 검사 항목별 결과 단계를 두지 않는다. */
  inspectionPlanVersionId: number | null;
  inspectedQty: number;
  inspectionRound: number | null;
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
  isLocked: boolean;
  /** 판정 단계 아래 — 검사기준이 없을 때의 「검사 내용」 입력(#135). */
  judgmentBelow?: ReactNode;
}

/**
 * W-03-11 관리웹 입력 단계(사용자 지시 2026-10-29 · #197) — ① 검사 항목별 결과 → ② 검사 수량 입력 → ③ 최종 판정. IQC 와
 * 같은 짜임이다. 값 · 검증 · 저장 규칙은 패널 그대로이고, 보이는 모양과 [확정] 때 자동 판정만 더했다.
 * POP 분할 화면은 이 파일을 쓰지 않는다.
 */
export const PqcWebSteps = ({
  rows,
  drafts,
  onValueChange,
  onItemJudgmentChange,
  itemJudgmentOptions,
  uomCodeOf,
  itemsLoading,
  inspectionPlanVersionId,
  inspectedQty,
  inspectionRound,
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
}: PqcWebStepsProps) => {
  const withUnit = (value: string): string => (uomCode === null ? value : `${value} ${uomCode}`);
  const errors = validateQuantities(draft);
  const totals = toTotals(draft, inspectedQty);
  const serverErrorOf = (key: keyof QuantityDraft): string | undefined => {
    const entry = Object.entries(FIELD_OF).find(([, local]) => local === key);
    return entry === undefined ? undefined : fieldErrors[entry[0]];
  };

  /*
   * 화면이 채운 판정 — 근거가 사라지면 비운다. 사람이 고른 판정 · 저장돼 되살린 판정은 건드리지 않는다(IQC 와 같다).
   */
  const autoFilled = useRef<string | null>(null);
  const setJudgment = (code: string): void => {
    onJudgmentChange(code);
    if (code !== REJECTED) onDispositionChange(null);
  };
  const applyAuto = (next: QuantityDraft): void => {
    if (isLocked || (autoFilled.current === null && judgment !== '')) return;
    const expected = autoJudgmentOf(next, inspectedQty);
    if (expected !== null && isKnownCode(judgmentOptions, expected)) {
      autoFilled.current = expected;
      if (expected !== judgment) setJudgment(expected);
    } else if (autoFilled.current !== null && judgment === autoFilled.current) {
      autoFilled.current = null;
      setJudgment('');
    }
  };

  const status: InspectionQtyStatus =
    totals.kind !== 'counted'
      ? { kind: 'uncountable' }
      : {
          kind: totals.remaining < 0n ? 'over' : 'short',
          total: withUnit(formatMicro(totals.inspected)),
          amount: withUnit(
            formatMicro(totals.remaining < 0n ? -totals.remaining : totals.remaining),
          ),
          isZero: totals.remaining === 0n,
        };
  const qtyText = (raw: string): string => withUnit(raw.trim() === '' ? '0' : raw);
  const confirmButton = (confirm: () => void): ReactNode => (
    <Button type="button" size="md" onClick={confirm}>
      {tHub.stepConfirm}
    </Button>
  );

  const steps: InspectionStepItem[] = [
    ...(inspectionPlanVersionId === null
      ? []
      : [
          {
            title: t.items.heading,
            done: rows.length > 0 && isAllJudged(rows, drafts),
            summary: t.items.progress(judgedCount(rows, drafts), rows.length),
            render: (confirm: () => void) => (
              <WebItemTable
                inStep
                rows={rows}
                drafts={drafts}
                onValueChange={onValueChange}
                onJudgmentChange={onItemJudgmentChange}
                judgmentOptions={itemJudgmentOptions}
                uomCodeOf={uomCodeOf}
                isLoading={itemsLoading}
                isLocked={isLocked}
                inspectionPlanVersionId={inspectionPlanVersionId}
                footer={isLocked ? null : confirmButton(confirm)}
              />
            ),
          },
        ]),
    {
      title: t.quantity.heading,
      done: canConfirm(totals),
      attention: Object.keys(FIELD_OF).some((name) => fieldErrors[name] !== undefined),
      summary: tHub.qtySummary(
        qtyText(draft.accepted),
        qtyText(draft.rejected),
        qtyText(draft.held),
      ),
      render: (confirm) => (
        <InspectionQtyLine
          uomCode={uomCode}
          disabled={isLocked}
          status={status}
          /* 수량이 아닌 값이 남으면 넘어가지 않는다 — 합계가 덜 맞아도 넘어간다(IQC 와 같다). */
          confirmDisabled={totals.kind !== 'counted'}
          onConfirm={
            isLocked
              ? null
              : () => {
                  applyAuto(draft);
                  confirm();
                }
          }
          /*
           * 검사 수량은 입력받지 않는다(사용자 지시 2026-10-29 · #197) — 서버가 의뢰를 만들 때 검사기준의 전수 · 샘플링 설정으로
           * 정한 의뢰 수량(작성중 회차면 그 회차의 값)이고, 오른쪽 「전체 N EA 중」에 보인다. IQC 와 같다.
           */
          fields={[
            ...(
              [
                ['accepted', t.quantity.accepted],
                ['rejected', t.quantity.rejected],
                ['held', t.quantity.held],
              ] as const
            ).map(([key, label]) => ({
              key,
              kind: key,
              label,
              value: draft[key],
              onChange: (raw: string) => {
                const next = { ...draft, [key]: raw };
                onChange(next);
                applyAuto(next);
              },
              error:
                serverErrorOf(key) ??
                (showErrors && errors[key] ? tResult.quantityInvalid : undefined),
            })),
          ]}
        >
          {inspectionRound !== null && (
            <p className="field-note">{t.quantity.round(inspectionRound)}</p>
          )}
          {errorBanner}
        </InspectionQtyLine>
      ),
    },
    {
      title: t.judgment.heading,
      done: judgment !== '',
      summary: judgmentOptions.find((option) => option.value === judgment)?.label ?? judgment,
      render: () => (
        <>
          <PqcJudgmentFields
            judgmentOptions={judgmentOptions}
            judgment={judgment}
            onJudgmentChange={(code) => {
              autoFilled.current = null;
              onJudgmentChange(code);
            }}
            disposition={disposition}
            onDispositionChange={onDispositionChange}
            rejected={draft.rejected}
            isLocked={isLocked}
          />
          {judgmentBelow}
        </>
      ),
    },
  ];

  return <InspectionSteps steps={steps} showAll={isLocked} />;
};
