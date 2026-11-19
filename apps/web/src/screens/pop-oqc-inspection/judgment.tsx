import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import {
  PuButton,
  PuChip,
  PuDialog,
  PuField,
  PuInput,
  PuKv,
  PuNote,
  PuTiles,
  type PuChipTone,
  type PuTileOption,
} from '../../patterns/pop-uniform';
import { isKnownCode, labelOfCode, type CodeOption } from '../oqc-inspection/code-options';
import { CONFIRMED_STATUS } from '../oqc-inspection/inspection-status';
import {
  canConfirm,
  hasQuantityError,
  toTotals,
  validateQuantities,
  type QuantityDraft,
  type QuantityErrors,
  type QuantityTotals,
} from '../oqc-inspection/quantity-draft';
import { toTransitionPreview, type TransitionPreview } from '../oqc-inspection/transition-preview';
import type { InspectionResultRound } from '../oqc-inspection/types';

/*
 * P-04-06 판정 입력(1 수량 입력 › 2 최종 판정) · 저장 확인 창(omf-all-around#109 · #295 POP 통일).
 *
 * ⭐ **판정 규칙은 W-04-03 `ResultFormPane` 과 같다** — 같은 계산 부품(`quantity-draft` ·
 * `transition-preview`)을 쓰고, 저장을 막는 사유의 순서·확인 창을 여는 조건·검사 시각을 창을 여는
 * 순간 한 번 읽는 것(멱등 키)까지 그대로 옮겼다. 다른 것은 배치와 문구뿐이다. 판정 규칙을 고치면
 * 두 곳을 함께 고친다.
 *
 * 저장 단추는 화면 아래 작업 줄에 선다 — 그래서 상태를 훅 하나에 두고, 입력 구획과 작업 줄이 같은
 * 값을 읽는다.
 */

const t = messages.popOqcInspection;

/** 계약이 짚어 줄 수 있는 칸 이름 ↔ 화면의 초안 칸. */
const FIELD_OF: Record<keyof QuantityDraft, string> = {
  accepted: 'acceptedQty',
  rejected: 'rejectedQty',
  held: 'heldQty',
};

export const QUANTITY_KEYS: readonly (keyof QuantityDraft)[] = ['accepted', 'rejected', 'held'];

const DIRECTION_TEXT = {
  release: t.warning.directionRelease,
  hold: t.warning.directionHold,
  pending: t.warning.directionPending,
  unknown: t.warning.directionUnknown,
} as const;

/** 대상 LOT 이 없는 의뢰 = 출하작업지시 OQC — 서버가 집은(피킹) LOT 에 판정을 남긴다(omf-all-around#119 · 서버 P-83). */
const PICKED_DIRECTION_TEXT = {
  release: t.warning.pickedDirectionRelease,
  hold: t.warning.pickedDirectionHold,
  pending: t.warning.pickedDirectionPending,
  unknown: t.warning.directionUnknown,
} as const;

/** 판정 색 — 뜻이 정해진 코드만 색을 갖는다. 모르는 코드는 무채색이다. */
const judgeOf = (code: string): PuTileOption['judge'] =>
  code === 'ACCEPTED' ? 'ok' : code === 'REJECTED' ? 'ng' : code === 'HELD' ? 'hold' : undefined;

export const judgmentTone = (code: string): PuChipTone =>
  code === 'ACCEPTED' ? 'ok' : code === 'REJECTED' ? 'bad' : code === 'HELD' ? 'warn' : 'idle';

export interface PopJudgmentInput {
  /** 입력 구획이 서 있는가(의뢰·회차를 다 받았다). 아니면 `idleReason` 이 저장을 막는다. */
  active: boolean;
  idleReason: string;
  /** 고른 의뢰가 바뀌면 오류 표시·열린 창을 거둔다(관리웹은 폼을 `key` 로 새로 세운다). */
  resetKey: number | null;
  round: InspectionResultRound | null;
  inspectedQty: number;
  draft: QuantityDraft;
  judgmentOptions: CodeOption[];
  judgment: string;
  isSaving: boolean;
  isJustSaved: boolean;
  workerNo: string | null;
  /** 시리얼이 수량과 모순되면 그 이유(omf-all-around#68 · W-04-03 과 같은 규칙). */
  serialBlockedReason?: string | null;
}

export interface PopJudgmentState {
  isLocked: boolean;
  isConfirmed: boolean;
  errors: QuantityErrors;
  totals: QuantityTotals;
  preview: TransitionPreview | null;
  showErrors: boolean;
  /** 저장이 막혔다면 그 이유. 풀렸으면 `null`. */
  blockedReason: string | null;
  /** 확인 창이 열린 순간의 검사 시각. 닫혀 있으면 `null`. */
  openedAt: string | null;
  submit: (event: FormEvent<HTMLFormElement>) => void;
  closeDialog: () => void;
}

export const usePopJudgment = (input: PopJudgmentInput): PopJudgmentState => {
  const { active, idleReason, resetKey, round, inspectedQty, draft } = input;
  const { judgmentOptions, judgment, isJustSaved, workerNo, serialBlockedReason = null } = input;

  /* 회차가 있다는 사실이 잠그는 근거다(W-04-03 과 같다 — 이 화면은 어떤 회차도 고치지 않는다). */
  const isLocked = round !== null;
  const isConfirmed = round?.statusCode === CONFIRMED_STATUS;
  const errors = validateQuantities(draft);
  const totals = toTotals(draft, inspectedQty);
  const preview = toTransitionPreview(draft, judgment, inspectedQty);
  const [showErrors, setShowErrors] = useState(false);
  const [openedAt, setOpenedAt] = useState<string | null>(null);

  useEffect(() => {
    setShowErrors(false);
    setOpenedAt(null);
  }, [resetKey]);

  /* 성공했을 때만 창을 닫는다 — 실패면 같은 창에서 다시 눌러 같은 멱등 키가 나가야 한다. */
  useEffect(() => {
    if (isJustSaved) setOpenedAt(null);
  }, [isJustSaved]);

  const blockedReason: string | null = !active
    ? idleReason
    : isLocked
      ? isConfirmed
        ? t.bar.blocked.confirmed
        : t.bar.blocked.draftElsewhere
      : workerNo === null
        ? t.bar.blocked.worker
        : !canConfirm(totals)
          ? t.bar.blocked.totals
          : judgmentOptions.length === 0
            ? t.bar.blocked.judgmentOptions
            : judgment === ''
              ? t.bar.blocked.judgment
              : serialBlockedReason;

  return {
    isLocked,
    isConfirmed,
    errors,
    totals,
    preview,
    showErrors,
    blockedReason,
    openedAt,
    submit: (event) => {
      event.preventDefault();
      setShowErrors(true);

      if (hasQuantityError(errors) || blockedReason !== null) return;

      setOpenedAt(new Date().toISOString());
    },
    closeDialog: () => setOpenedAt(null),
  };
};

/** 넣은 수량 요약 줄(검사 · 합격 · 불합격 · 보류). */
export const PopQtySummary = ({
  inspected,
  accepted,
  rejected,
  held,
}: {
  inspected: string;
  accepted: string;
  rejected: string;
  held: string;
}) => (
  <div className="oqc-qsum">
    <span>
      {t.result.summary.inspectedQty} <b>{inspected}</b>
    </span>
    <span>
      {t.result.summary.accepted} <b>{accepted}</b>
    </span>
    <span>
      {t.result.summary.rejected} <b>{rejected}</b>
    </span>
    <span>
      {t.result.summary.held} <b>{held}</b>
    </span>
  </div>
);

export interface PopQuantityStepProps {
  formId: string;
  draft: QuantityDraft;
  onChange: (draft: QuantityDraft) => void;
  disabled: boolean;
  /** 키패드가 지금 넣는 칸. */
  target: keyof QuantityDraft | null;
  onTarget: (key: keyof QuantityDraft) => void;
  fieldErrors: Record<string, string>;
}

/** 1단계 — 합격 · 불합격 · 보류 수량. 숫자는 오른쪽 「수량 키패드」로도 넣는다. */
export const PopQuantityStep = ({
  formId,
  draft,
  onChange,
  disabled,
  target,
  onTarget,
  fieldErrors,
}: PopQuantityStepProps) => (
  <div className="oqc-qgrid">
    {QUANTITY_KEYS.map((key) => {
      const id = `${formId}-${key}`;
      const error = fieldErrors[FIELD_OF[key]];

      return (
        <PuField key={key} label={t.result.fields[key]} htmlFor={id}>
          <PuInput
            id={id}
            numeric
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={draft[key]}
            disabled={disabled}
            target={target === key}
            need={error !== undefined}
            onFocus={() => {
              onTarget(key);
            }}
            onChange={(event) => {
              onChange({ ...draft, [key]: event.target.value });
            }}
          />
          {error !== undefined && <span className="oqc-field-err">{error}</span>}
        </PuField>
      );
    })}
  </div>
);

export interface PopJudgmentStepProps {
  formId: string;
  state: PopJudgmentState;
  /** 재검사면 새로 쌓일 회차 번호, 아니면 `null`. */
  reinspectRound: number | null;
  inspectedQty: number;
  judgmentOptions: CodeOption[];
  judgment: string;
  onJudgmentChange: (code: string) => void;
  disabled: boolean;
  /** 의뢰에 대상 LOT 이 있는가. 없으면 출하작업지시 OQC 다 — 서버가 그 지시가 집은 LOT 에 판정을 남긴다(#119). */
  hasLot: boolean;
  fieldErrors: Record<string, string>;
  /** 「시리얼 검사 기록」 줄 — 출하작업지시 의뢰에서만 부모가 넘긴다(omf-all-around#68). */
  serials?: ReactNode;
}

/** 2단계 — 넣은 수량 요약 · 종합 판정 · 시리얼 검사 기록. 저장은 작업 줄의 [판정 저장](이 폼 제출). */
export const PopJudgmentStep = ({
  formId,
  state,
  reinspectRound,
  inspectedQty,
  judgmentOptions,
  judgment,
  onJudgmentChange,
  disabled,
  hasLot,
  fieldErrors,
  serials,
}: PopJudgmentStepProps) => {
  const { preview, showErrors, errors } = state;
  const quantityError =
    QUANTITY_KEYS.map((key) => fieldErrors[FIELD_OF[key]]).find((error) => error !== undefined) ??
    (showErrors && hasQuantityError(errors) ? t.result.quantityInvalid : undefined);

  return (
    <form
      id={formId}
      className="oqc-jstep"
      aria-label={t.result.judgmentTitle}
      onSubmit={state.submit}
    >
      {reinspectRound !== null && <PuNote>{t.result.reinspectNote(reinspectRound)}</PuNote>}
      {preview !== null && (
        <PopQtySummary
          inspected={String(inspectedQty)}
          accepted={preview.accepted}
          rejected={preview.rejected}
          held={preview.held}
        />
      )}
      {quantityError !== undefined && <PuNote tone="bad">{quantityError}</PuNote>}
      <PuField label={t.result.judgmentStep} required>
        <PuTiles
          label={t.result.judgmentStep}
          cols={3}
          value={judgment === '' ? null : judgment}
          disabled={disabled}
          options={judgmentOptions.map((option) => ({
            value: option.value,
            label: option.label,
            judge: judgeOf(option.value),
          }))}
          onChange={onJudgmentChange}
        />
      </PuField>
      {judgmentOptions.length === 0 && <PuNote tone="warn">{t.result.judgmentUnavailable}</PuNote>}
      {!isKnownCode(judgmentOptions, judgment) && (
        <PuNote tone="warn">{t.result.judgmentUnknown(judgment)}</PuNote>
      )}
      {/*
       * 고른 판정으로 저장하면 LOT 이 어떻게 되는지 한 줄 — 문장은 W-04-03 의 전이 경고와 같다.
       * 피킹·처분 같은 나머지 고지는 확인 창이 맡는다(같은 말을 두 번 하지 않는다).
       */}
      {preview !== null && judgment !== '' && (
        <PuNote tone="warn">
          <span>{(hasLot ? DIRECTION_TEXT : PICKED_DIRECTION_TEXT)[preview.direction]}</span>{' '}
          {t.warning.noAmendment}
        </PuNote>
      )}
      {serials}
    </form>
  );
};

export interface PopConfirmDialogProps {
  inspectionRequestNo: string;
  judgmentOptions: CodeOption[];
  judgment: string;
  inspectedQty: number;
  preview: TransitionPreview | null;
  hasLot: boolean;
  /** 「시리얼 n대 · NG n대」 — 출하작업지시 의뢰에서만. */
  serialSummary?: string;
  saveError: ApiError | null;
  onReload: () => void;
  isSaving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * 저장 확인 창 — ⭐ **쓰기는 이 창의 [판정 저장]에서만 나간다**(W-04-03 `ConfirmDialog` 와 같은 규칙).
 * 저장 중에는 닫히지 않으며, 실패해도 닫지 않는다(같은 멱등 키로 다시 누른다).
 */
export const PopConfirmDialog = ({
  inspectionRequestNo,
  judgmentOptions,
  judgment,
  inspectedQty,
  preview,
  hasLot,
  serialSummary,
  saveError,
  onReload,
  isSaving,
  onClose,
  onConfirm,
}: PopConfirmDialogProps) => {
  const close = (): void => {
    if (!isSaving) onClose();
  };
  const facts = [
    { label: t.confirm.request, value: <span className="pu-mono">{inspectionRequestNo}</span> },
    {
      label: t.confirm.judgment,
      value: (
        <PuChip tone={judgmentTone(judgment)}>{labelOfCode(judgmentOptions, judgment)}</PuChip>
      ),
    },
    { label: t.confirm.inspectedQty, value: String(inspectedQty) },
    ...(preview === null
      ? []
      : [
          { label: t.confirm.accepted, value: preview.accepted },
          { label: t.confirm.rejected, value: preview.rejected },
          { label: t.confirm.held, value: preview.held },
        ]),
    ...(serialSummary === undefined ? [] : [{ label: t.confirm.serials, value: serialSummary }]),
  ];

  return (
    <PuDialog
      title={t.confirm.title}
      onClose={close}
      footer={
        <>
          <PuButton disabled={isSaving} onClick={close}>
            {t.confirm.cancel}
          </PuButton>
          <PuButton variant="primary" disabled={isSaving} onClick={onConfirm}>
            {isSaving ? t.bar.saving : t.confirm.confirm}
          </PuButton>
        </>
      }
    >
      <SaveErrorBanner error={saveError} onReload={onReload} />
      <PuKv cols2 items={facts} />
      {preview !== null && (
        <div className="oqc-confirm-effects">
          <div className="pu-label">{t.confirm.effects}</div>
          <ul>
            <li>
              <b>{(hasLot ? DIRECTION_TEXT : PICKED_DIRECTION_TEXT)[preview.direction]}</b>
            </li>
            <li>{t.warning.picking}</li>
          </ul>
        </div>
      )}
      <PuNote tone="warn">
        <b>{t.confirm.caution}</b> — {t.warning.noAmendment} {t.warning.dispositionPath}
      </PuNote>
    </PuDialog>
  );
};
