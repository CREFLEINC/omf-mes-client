import { Button, Dialog, Icon, TextField } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { isKnownCode, labelOfCode, type CodeOption } from '../oqc-inspection/code-options';
import { CONFIRMED_STATUS } from '../oqc-inspection/inspection-status';
import {
  canConfirm,
  formatMicro,
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
 * P-04-06 판정 입력 · 바닥 저장 띠 · 저장 확인 창(omf-all-around#109 UI/UX 개선).
 *
 * ⭐ **판정 규칙은 W-04-03 `ResultFormPane` 과 같다** — 같은 계산 부품(`quantity-draft` ·
 * `transition-preview`)을 쓰고, 저장을 막는 사유의 순서·확인 창을 여는 조건·검사 시각을 창을 여는
 * 순간 한 번 읽는 것(멱등 키)까지 그대로 옮겼다. 다른 것은 배치와 문구뿐이다. 판정 규칙을 고치면
 * 두 곳을 함께 고친다.
 *
 * POP 은 저장 단추가 화면 바닥 띠에 선다(다른 POP 화면과 같은 자리) — 그래서 상태를 훅 하나에
 * 두고, 입력 구획과 바닥 띠가 같은 값을 읽는다.
 */

const t = messages.popOqcInspection;
const unknownValue = messages.oqcInspection.queue.emptyValue;

/** 계약이 짚어 줄 수 있는 칸 이름 ↔ 화면의 초안 칸. */
const FIELD_OF: Record<keyof QuantityDraft, string> = {
  accepted: 'acceptedQty',
  rejected: 'rejectedQty',
  held: 'heldQty',
};

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

/** 판정 단추의 색 — 뜻이 정해진 코드만 색을 갖는다. 모르는 코드는 무채색이다. */
const toneOf = (code: string): 'accepted' | 'rejected' | 'held' | 'neutral' =>
  code === 'ACCEPTED'
    ? 'accepted'
    : code === 'REJECTED'
      ? 'rejected'
      : code === 'HELD'
        ? 'held'
        : 'neutral';

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
  const { judgmentOptions, judgment, isJustSaved, workerNo } = input;

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
              : null;

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

export interface PopJudgmentFormProps {
  formId: string;
  state: PopJudgmentState;
  isReinspecting: boolean;
  round: InspectionResultRound | null;
  inspectedQty: number;
  draft: QuantityDraft;
  onChange: (draft: QuantityDraft) => void;
  judgmentOptions: CodeOption[];
  judgment: string;
  onJudgmentChange: (code: string) => void;
  isSaving: boolean;
  fieldErrors: Record<string, string>;
  /** 의뢰에 대상 LOT 이 있는가. 없으면 출하작업지시 OQC 다 — 서버가 그 지시가 집은 LOT 에 판정을 남긴다(#119). */
  hasLot: boolean;
  /** 회차 이력 등 입력 구획 아래에 붙는 것. */
  children?: ReactNode;
}

export const PopJudgmentForm = ({
  formId,
  state,
  isReinspecting,
  round,
  inspectedQty,
  draft,
  onChange,
  judgmentOptions,
  judgment,
  onJudgmentChange,
  isSaving,
  fieldErrors,
  hasLot,
  children,
}: PopJudgmentFormProps) => {
  const { isLocked, isConfirmed, errors, totals, preview, showErrors } = state;
  const lockNoteId = `${formId}-lock`;
  const disabled = isLocked || isSaving;

  const roundLabel = isReinspecting
    ? t.result.reinspectRound
    : round === null
      ? t.result.firstRound
      : t.result.round(round.inspectionRound);

  /* 셀 수 없으면 합계를 말하지 않는다 — 0 으로 읽은 합은 거짓이다(W-04-03 과 같다). */
  const totalsState =
    totals.kind === 'uncountable'
      ? 'uncountable'
      : totals.matches
        ? 'matched'
        : totals.remaining > 0n
          ? 'short'
          : 'over';
  const totalsNote =
    totals.kind === 'uncountable'
      ? t.result.uncountable
      : totals.matches
        ? t.result.matched
        : totals.remaining > 0n
          ? t.result.short(formatMicro(totals.remaining))
          : t.result.over(formatMicro(-totals.remaining));

  const field = (key: keyof QuantityDraft, label: string) => (
    <TextField
      label={label}
      size="xl"
      inputMode="decimal"
      autoComplete="off"
      value={draft[key]}
      disabled={disabled}
      aria-describedby={isLocked ? lockNoteId : undefined}
      error={
        fieldErrors[FIELD_OF[key]] ??
        (showErrors && errors[key] ? t.result.quantityInvalid : undefined)
      }
      onChange={(event) => onChange({ ...draft, [key]: event.target.value })}
    />
  );

  return (
    <form
      id={formId}
      className="pop-oqc-form"
      aria-label={t.result.heading}
      onSubmit={state.submit}
    >
      <div className="pop-oqc-form__head">
        <h3>{t.result.heading}</h3>
        <span className="pop-oqc-round">{roundLabel}</span>
      </div>

      {isReinspecting && (
        <p className="field-note">
          {t.result.reinspectNote} {t.result.reinspectReasonPending}
        </p>
      )}

      {isLocked && (
        <p className="pop-oqc-lock" id={lockNoteId}>
          <Icon name="lock" size={20} aria-hidden />
          <span>{isConfirmed ? t.result.confirmed : t.result.draftElsewhere}</span>
        </p>
      )}

      <section className="pop-oqc-step" aria-label={t.result.quantityStep}>
        <p className="pop-oqc-step__title">
          <span className="pop-oqc-step__no" aria-hidden>
            1
          </span>
          <span>{t.result.quantityStep}</span>
          <span className="pop-oqc-step__hint">{t.result.quantityHint}</span>
        </p>
        <div className="pop-oqc-qty">
          {field('accepted', t.result.fields.accepted)}
          {field('rejected', t.result.fields.rejected)}
          {field('held', t.result.fields.held)}
        </div>
        <div
          className={[
            'pop-oqc-total',
            {
              short: 'pop-oqc-total--short',
              uncountable: 'pop-oqc-total--uncountable',
              matched: 'pop-oqc-total--matched',
              over: 'pop-oqc-total--over',
            }[totalsState],
          ].join(' ')}
        >
          <dl>
            <div>
              <dt>{t.result.inspectedQty}</dt>
              <dd className="pop-oqc-num">{String(inspectedQty)}</dd>
            </div>
            <div>
              <dt>{t.result.sum}</dt>
              <dd className="pop-oqc-num">
                {totals.kind === 'counted' ? formatMicro(totals.sum) : unknownValue}
              </dd>
            </div>
            <div>
              <dt>{t.result.remaining}</dt>
              <dd className="pop-oqc-num">
                {totals.kind === 'counted' ? formatMicro(totals.remaining) : unknownValue}
              </dd>
            </div>
          </dl>
          {!isLocked && (
            <p role="status">
              <Icon
                name={totalsState === 'matched' ? 'check_circle' : 'info'}
                size={20}
                aria-hidden
              />
              <span>{totalsNote}</span>
            </p>
          )}
        </div>
      </section>

      <section className="pop-oqc-step" aria-label={t.result.judgmentStep}>
        <p className="pop-oqc-step__title">
          <span className="pop-oqc-step__no" aria-hidden>
            2
          </span>
          <span>{t.result.judgmentStep}</span>
          <span className="pop-oqc-step__hint">{t.result.judgmentHint}</span>
        </p>
        <div role="group" aria-label={t.result.judgmentStep} className="pop-oqc-judge-row">
          {judgmentOptions.map((option) => {
            const pressed = option.value === judgment;

            return (
              <button
                key={option.value}
                type="button"
                className={[
                  'pop-oqc-judge',
                  {
                    accepted: 'pop-oqc-judge--accepted',
                    rejected: 'pop-oqc-judge--rejected',
                    held: 'pop-oqc-judge--held',
                    neutral: 'pop-oqc-judge--neutral',
                  }[toneOf(option.value)],
                ].join(' ')}
                aria-pressed={pressed}
                disabled={disabled}
                onClick={() => onJudgmentChange(option.value)}
              >
                {pressed && <Icon name="check_circle" size={24} aria-hidden />}
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
        {judgmentOptions.length === 0 && (
          <p className="field-note">{t.result.judgmentUnavailable}</p>
        )}
        {!isKnownCode(judgmentOptions, judgment) && (
          <p className="field-note">{t.result.judgmentUnknown(judgment)}</p>
        )}
      </section>

      {/*
       * 저장 전에 LOT 이 어떻게 되는지 한 줄로 보인다 — 조건은 W-04-03 의 전이 경고와 같다(잠기지 않았고
       * 셀 수 있을 때). 피킹·처분 같은 나머지 고지는 확인 창이 맡는다(같은 말을 두 번 하지 않는다).
       */}
      {!isLocked && preview !== null && (
        <section className="pop-oqc-effect" aria-label={t.warning.title}>
          <p className="pop-oqc-effect__lead">
            <Icon name="warning" size={20} aria-hidden />
            <span>{(hasLot ? DIRECTION_TEXT : PICKED_DIRECTION_TEXT)[preview.direction]}</span>
          </p>
          <p className="pop-oqc-effect__sub">{t.warning.noAmendment}</p>
        </section>
      )}

      {children}
    </form>
  );
};

export interface PopJudgmentBarProps {
  formId: string;
  state: PopJudgmentState;
  isSaving: boolean;
  isJustSaved: boolean;
  saveError: ApiError | null;
  onReload: () => void;
  isReinspecting: boolean;
  onStartReinspection: () => void;
  onCancelReinspection: () => void;
}

/** 화면 바닥 띠 — 지금 저장할 수 있는지와 그 이유가 늘 같은 자리에 선다. */
export const PopJudgmentBar = ({
  formId,
  state,
  isSaving,
  isJustSaved,
  saveError,
  onReload,
  isReinspecting,
  onStartReinspection,
  onCancelReinspection,
}: PopJudgmentBarProps) => {
  const { isLocked, blockedReason, showErrors, errors, openedAt } = state;
  const invalid = showErrors && hasQuantityError(errors);
  const canSave = blockedReason === null && !isSaving;

  const note = isSaving ? (
    <p className="pop-oqc-bar-note">{t.bar.saving}</p>
  ) : isJustSaved ? (
    <p className="pop-oqc-bar-note pop-oqc-bar-note--success">
      <Icon name="check_circle" size={24} aria-hidden />
      <span>{t.bar.saved}</span>
    </p>
  ) : saveError !== null && openedAt === null ? (
    <SaveErrorBanner error={saveError} onReload={onReload} />
  ) : invalid ? (
    <p className="pop-oqc-bar-note pop-oqc-bar-note--blocked">
      <Icon name="error" size={24} aria-hidden />
      <span>{t.bar.blocked.invalid}</span>
    </p>
  ) : blockedReason !== null ? (
    <p className="pop-oqc-bar-note pop-oqc-bar-note--blocked">
      <Icon name="info" size={24} aria-hidden />
      <span>{blockedReason}</span>
    </p>
  ) : (
    <p className="pop-oqc-bar-note pop-oqc-bar-note--ready">
      <Icon name="check_circle" size={24} aria-hidden />
      <span>{t.bar.ready}</span>
    </p>
  );

  return (
    <div className="pop-action-bar">
      <div className="pop-action-note" aria-live="polite">
        {note}
      </div>
      {/* 검사성적서 발행 — 자리를 두되 잠근 채 사유를 함께 둔다(W-04-03 과 같다). 늘 보이는 바닥 띠에 둔다. */}
      <Button type="button" size="2xl" variant="text" className="pop-oqc-coa" disabled>
        <span>{t.bar.coaIssue}</span>
        <span className="pop-oqc-coa__note">{t.bar.coaPending}</span>
      </Button>
      {isLocked ? (
        <Button type="button" size="2xl" variant="outlined" onClick={onStartReinspection}>
          {t.bar.reinspect}
        </Button>
      ) : (
        <>
          {isReinspecting && (
            <Button
              type="button"
              size="2xl"
              variant="outlined"
              disabled={isSaving}
              onClick={onCancelReinspection}
            >
              {t.bar.reinspectCancel}
            </Button>
          )}
          <Button type="submit" form={formId} size="2xl" variant="filled" disabled={!canSave}>
            {isSaving ? t.bar.saving : t.bar.save}
          </Button>
        </>
      )}
    </div>
  );
};

export interface PopConfirmDialogProps {
  inspectionRequestNo: string;
  judgmentOptions: CodeOption[];
  judgment: string;
  inspectedQty: number;
  preview: TransitionPreview | null;
  hasLot: boolean;
  saveError: ApiError | null;
  onReload: () => void;
  isSaving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * 저장 확인 창 — ⭐ **쓰기는 이 창의 [판정 저장]에서만 나간다**(W-04-03 `ConfirmDialog` 와 같은 규칙).
 * 바깥을 눌러도 닫히지 않고, 저장 중에는 닫히지 않으며, 실패해도 닫지 않는다(같은 멱등 키로 다시 누른다).
 */
export const PopConfirmDialog = ({
  inspectionRequestNo,
  judgmentOptions,
  judgment,
  inspectedQty,
  preview,
  hasLot,
  saveError,
  onReload,
  isSaving,
  onClose,
  onConfirm,
}: PopConfirmDialogProps) => (
  <Dialog
    open
    size="lg"
    className="pop-oqc-confirm"
    closeOnBackdropClick={false}
    showCloseButton={false}
    title={t.confirm.title}
    footer={
      <>
        <Button size="xl" disabled={isSaving} variant="outlined" onClick={onClose}>
          {t.confirm.cancel}
        </Button>
        <Button size="xl" loading={isSaving} variant="filled" onClick={onConfirm}>
          {t.confirm.confirm}
        </Button>
      </>
    }
    onClose={() => {
      if (!isSaving) onClose();
    }}
  >
    <SaveErrorBanner error={saveError} onReload={onReload} />
    <dl className="pop-oqc-confirm__facts">
      <div>
        <dt>{t.confirm.request}</dt>
        <dd>{inspectionRequestNo}</dd>
      </div>
      <div>
        <dt>{t.confirm.judgment}</dt>
        <dd className={`pop-oqc-confirm__judgment pop-oqc-confirm__judgment--${toneOf(judgment)}`}>
          {labelOfCode(judgmentOptions, judgment)}
        </dd>
      </div>
    </dl>
    {preview !== null && (
      <dl className="pop-oqc-confirm__qty">
        <div>
          <dt>{t.confirm.inspectedQty}</dt>
          <dd className="pop-oqc-num">{String(inspectedQty)}</dd>
        </div>
        <div>
          <dt>{t.confirm.accepted}</dt>
          <dd className="pop-oqc-num">{preview.accepted}</dd>
        </div>
        <div>
          <dt>{t.confirm.rejected}</dt>
          <dd className="pop-oqc-num">{preview.rejected}</dd>
        </div>
        <div>
          <dt>{t.confirm.held}</dt>
          <dd className="pop-oqc-num">{preview.held}</dd>
        </div>
      </dl>
    )}
    {preview !== null && (
      <section className="pop-oqc-confirm__block" aria-label={t.confirm.effects}>
        <h4>{t.confirm.effects}</h4>
        <ul>
          <li>
            <strong>{(hasLot ? DIRECTION_TEXT : PICKED_DIRECTION_TEXT)[preview.direction]}</strong>
          </li>
          <li>{t.warning.picking}</li>
        </ul>
      </section>
    )}
    <section
      className="pop-oqc-confirm__block pop-oqc-confirm__block--caution"
      aria-label={t.confirm.caution}
    >
      <h4>
        <Icon name="warning" size={20} aria-hidden />
        <span>{t.confirm.caution}</span>
      </h4>
      <ul>
        <li>
          <strong>{t.warning.noAmendment}</strong>
        </li>
        <li>{t.warning.dispositionPath}</li>
      </ul>
    </section>
  </Dialog>
);
