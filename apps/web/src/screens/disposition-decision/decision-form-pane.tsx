import { Button, Radio, RadioGroup, TextArea } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { lookupDisplayLabel } from '../../patterns/lookup-display';
import { SaveErrorBanner } from '../../patterns/master';
import {
  SORT,
  sortSelectionError,
  type DecisionFormErrors,
  type DecisionFormValue,
} from './decision-form';
import type { DispositionOption } from './disposition-codes';
import type { DispositionLookup } from './lookups';
import { SortSplitPane } from './sort-split-pane';
import { formatQty, type NonconformanceLotRow } from './types';

/** 특채 칸 — 고르면 특채 요청 팝업을 연다(요청 → W-03-09 결재 → 적용). */
export interface ConcessionOption {
  lockReason?: string | undefined;
  onRequest: () => void;
}

export interface DecisionFormPaneProps {
  value: DecisionFormValue;
  errors: DecisionFormErrors;
  /** 남은 수량(조회 시점 참고값) — 처분 수량은 이 값 전부로 고정한다(FR-038). 모르면 「—」. */
  remainingQty?: number | undefined;
  /** 판정 컨트롤 전체를 잠그는 사유. 없으면 잠그지 않는다. */
  lockReason: string | undefined;
  /**
   * ⭐ 적용 여부를 모르는 저장이 남아 있다. **잠그되 빠져나갈 길을 함께 낸다** — 길이 없으면
   * 사용자는 새로고침으로 나가고, 그 순간 멱등 키가 사라져 이중 실행 위험이 되살아난다.
   */
  isUncertain: boolean;
  onCheckOutcome: () => void;
  dispositionOptions: DispositionOption[];
  /**
   * 여러 유형을 함께 막는 이유를 위 상자(특채 상자)가 이미 말할 때 그 이유 — 유형 칸마다 되풀이하지 않는다.
   * 칸은 그대로 잠기고, 읽는 이유(`aria-describedby`)도 그대로 남는다(omf-all-around#275).
   */
  sharedLockReason?: string | undefined;
  /** 특채 칸. 없으면 두지 않는다. */
  concession?: ConcessionOption | undefined;
  uomId: number | undefined;
  uoms: DispositionLookup;
  /** 부적합의 자재 관리 LOT — 효과 문구의 수와 선별 고르기에 쓴다. */
  lots?: readonly NonconformanceLotRow[] | undefined;
  inboundLotNo?: string | null | undefined;
  inspectionRequestNo?: string | null | undefined;
  writeError: ApiError | null;
  isSaving: boolean;
  canCancel: boolean;
  onChange: (value: DecisionFormValue) => void;
  onSave: () => void;
  onCancel: () => void;
  onReload: () => void;
}

const WHOLE_CODES = ['NORMAL', 'SCRAP', 'REWORK'] as const;
type WholeCode = (typeof WHOLE_CODES)[number];
const isWholeCode = (code: string): code is WholeCode =>
  (WHOLE_CODES as readonly string[]).includes(code);

/**
 * 처분 판정 카드(005 · mockups/W0310-After.html) — 유형 칸 다섯(정상 · 폐기 · 재작업 · 선별 · 특채)과 고른 유형의 칸.
 * 정상 · 폐기 · 재작업은 남은 수량 전부(잠긴 칸) · 판정 하나가 자재 관리 LOT 전부에. 선별은 불량 자재 관리 LOT 고르기.
 * 특채는 요청 팝업으로 연다(#223 팝업 그대로).
 */
export const DecisionFormPane = ({
  value,
  errors,
  remainingQty,
  lockReason,
  isUncertain,
  onCheckOutcome,
  dispositionOptions,
  sharedLockReason,
  concession,
  uomId,
  uoms,
  lots = [],
  inboundLotNo,
  inspectionRequestNo,
  writeError,
  isSaving,
  canCancel,
  onChange,
  onSave,
  onCancel,
  onReload,
}: DecisionFormPaneProps) => {
  const t = messages.dispositionDecision;
  const groupLabelId = useId();
  const lockReasonId = useId();
  const qtyNoteId = useId();
  const qtyId = useId();
  const optionHintId = useId();
  const sortBlockId = useId();
  const isLocked = lockReason !== undefined;
  const isSort = value.dispositionTypeCode === SORT;
  const uomLabel = uomId === undefined ? '' : lookupDisplayLabel(uoms, uomId);
  const remainingText =
    remainingQty === undefined
      ? formatQty(undefined)
      : `${formatQty(remainingQty)}${uomLabel === '' ? '' : ` ${uomLabel}`}`;
  const effect = isWholeCode(value.dispositionTypeCode)
    ? value.dispositionTypeCode === 'REWORK' && inboundLotNo !== null && inboundLotNo !== undefined
      ? t.form.reworkInboundEffect(inboundLotNo)
      : t.form.effect[value.dispositionTypeCode]
    : undefined;
  /* 선별은 고른 LOT 이 없거나 전부면 저장을 잠근다 — 전부는 보이는 오류, 없음은 가린 이유로 단추에 잇는다. */
  const sortBlock = isSort ? sortSelectionError(value.sortLotIds, lots.length) : undefined;
  const isAllSelected = isSort && lots.length > 0 && value.sortLotIds.length >= lots.length;
  const saveDescribedBy = isLocked
    ? lockReasonId
    : sortBlock === undefined
      ? undefined
      : sortBlockId;

  const lockNotes = [
    ...dispositionOptions.map((option) => ({
      id: `${optionHintId}-${option.value}`,
      label: option.label,
      reason: option.lockReason,
    })),
    ...(concession === undefined
      ? []
      : [
          {
            id: `${optionHintId}-CONCESSION`,
            label: t.values.dispositionType.CONCESSION,
            reason: concession.lockReason,
          },
        ]),
  ].flatMap((note) => (note.reason === undefined ? [] : [{ ...note, reason: note.reason }]));
  const optionCount = dispositionOptions.length + (concession === undefined ? 0 : 1);
  /*
   * 고를 수 있는 유형이 하나도 없으면(종결 · 특채 결재 중 등) 저장 · 사유 입력도 잠근다 — 눌러도 「처분을 선택하세요」만
   * 나오는 단추를 두지 않는다. 이유는 위 막힘 글이 말한다(omf-all-around#275).
   */
  const noSelectableType =
    optionCount > 0 && lockNotes.length === optionCount && value.dispositionTypeCode === '';
  const noTypeReasonId = lockNotes[0]?.id;
  const visibleLockLines = [
    ...new Set(
      lockNotes.map((note) => note.reason).filter((reason) => reason !== sharedLockReason),
    ),
  ].map((reason) => {
    const labels = lockNotes.filter((note) => note.reason === reason).map((note) => note.label);
    return labels.length === optionCount ? reason : `${labels.join(', ')}: ${reason}`;
  });

  return (
    <div className="disposition-decision-form" role="group" aria-label={t.panes.decision}>
      <SaveErrorBanner error={writeError} onReload={onReload} />

      {/* 처분 유형 왼쪽 | 처분 수량 오른쪽 한 줄(사용자 시안 · omf-all-around#275). 선별이면 수량 대신 아래에 고르기 칸. */}
      <div className="disposition-decision-top">
        <div className="field-cell disposition-type-cell">
          <span className="field-label" id={groupLabelId}>
            {t.form.dispositionLabel}
            <span className="required-mark" aria-hidden="true">
              {' *'}
            </span>
          </span>
          {/*
           * 유형은 같은 폭 칸으로 한 줄에, 좁으면 줄을 바꾼다 — 고른 칸만 강조한다(omf-all-around#275).
           * 막힌 유형은 잠그고 그 이유를 칸 줄 아래에 단다(G-2 · 감추지 않는다).
           * 특채는 라디오가 아니라 요청 팝업을 여는 단추다(결재가 붙는 별도 길).
           */}
          <RadioGroup
            name="disposition-type"
            orientation="horizontal"
            className="disposition-type-options"
            value={value.dispositionTypeCode}
            disabled={isLocked || dispositionOptions.length === 0}
            aria-labelledby={groupLabelId}
            aria-describedby={isLocked ? lockReasonId : undefined}
            onChange={(next) => onChange({ ...value, dispositionTypeCode: next })}
          >
            {dispositionOptions.map((option) => {
              const hintId = `${optionHintId}-${option.value}`;
              return (
                <div
                  key={option.value}
                  className="disposition-type-option"
                  data-selected={value.dispositionTypeCode === option.value ? 'true' : undefined}
                  data-locked={option.lockReason === undefined ? undefined : 'true'}
                >
                  <Radio
                    value={option.value}
                    disabled={option.lockReason !== undefined}
                    aria-describedby={option.lockReason === undefined ? undefined : hintId}
                  >
                    {option.label}
                  </Radio>
                </div>
              );
            })}
            {concession !== undefined && (
              <div
                className="disposition-type-option"
                data-locked={concession.lockReason === undefined ? undefined : 'true'}
              >
                <Button
                  variant="text"
                  size="sm"
                  className="disposition-type-concession"
                  aria-label={t.concession.request}
                  aria-describedby={
                    concession.lockReason === undefined ? undefined : `${optionHintId}-CONCESSION`
                  }
                  disabled={isLocked || concession.lockReason !== undefined}
                  onClick={concession.onRequest}
                >
                  {/* 다른 칸의 라디오 동그라미와 줄을 맞추는 빈 동그라미(모양만). */}
                  <span className="disposition-type-concession-mark" aria-hidden="true" />
                  {t.values.dispositionType.CONCESSION}
                </Button>
              </div>
            )}
          </RadioGroup>
          {/*
           * 막힌 이유 — 칸마다 읽는 이유(`aria-describedby`)는 눈에 감춘 글로 두고, 눈에는 같은 이유를 한 줄로 묶어 보인다.
           * 모든 유형이 같은 이유면 이유만, 일부면 「선별: …」처럼 유형 이름을 앞에. 위 특채 상자가 이미 말한 이유는 눈에 보이지
           * 않는다(omf-all-around#275).
           */}
          {lockNotes.map(({ id, reason }) => (
            <span key={id} id={id} className="visually-hidden">
              {reason}
            </span>
          ))}
          {visibleLockLines.map((line) => (
            <span key={line} className="disposition-type-hint" aria-hidden="true">
              {line}
            </span>
          ))}
          {errors.dispositionTypeCode !== undefined && (
            <span className="field-error">{errors.dispositionTypeCode}</span>
          )}
        </div>

        {!isSort && (
          /* 처분 수량 = 남은 수량 전부 — 입력하지 않는다(FR-038 · 일부 판정 없음). 바꿀 수 없는 값이라 글로 보인다. */
          <div className="disposition-qty-card">
            <label className="field-label" htmlFor={qtyId}>
              {t.form.qtyLabel}
            </label>
            <div className="disposition-qty-line">
              <output
                id={qtyId}
                className="disposition-qty-value"
                aria-describedby={[
                  isLocked ? lockReasonId : '',
                  effect === undefined ? '' : qtyNoteId,
                ]
                  .filter((id) => id !== '')
                  .join(' ')}
              >
                {remainingText}
              </output>
            </div>
            {/* 고른 유형으로 저장하면 생기는 일 한 줄(omf-all-around#275). */}
            {effect !== undefined && (
              <span id={qtyNoteId} className="field-note disposition-qty-note">
                {t.form.wholeEffect(lots.length, effect)}
              </span>
            )}
            {errors.decisionQty !== undefined && (
              <span className="field-error disposition-qty-error">{errors.decisionQty}</span>
            )}
          </div>
        )}
      </div>

      {isSort && (
        <SortSplitPane
          lots={lots}
          value={value}
          errors={errors}
          disabled={isLocked}
          describedBy={isLocked ? lockReasonId : undefined}
          allSelectedId={sortBlockId}
          uomLabel={uomLabel}
          inspectionRequestNo={inspectionRequestNo}
          onChange={onChange}
        />
      )}

      {/* ⛔ 디자인 시스템에 여러 줄 입력이 없다 — 토큰을 입힌 후보 부품을 쓴다(DS #74). */}
      <div className="disposition-reason-field">
        <TextArea
          label={t.form.reasonLabel}
          value={value.reason}
          placeholder={t.form.reasonPlaceholder}
          required
          fullWidth
          rows={2}
          disabled={isLocked || noSelectableType}
          aria-describedby={isLocked ? lockReasonId : noSelectableType ? noTypeReasonId : undefined}
          error={errors.reason}
          onChange={(event) => onChange({ ...value, reason: event.target.value })}
        />
      </div>

      {isLocked && (
        <div className="form-actions">
          <p id={lockReasonId} className="field-note form-actions-secondary">
            {lockReason}
          </p>
          {isUncertain && (
            <Button variant="outlined" size="sm" onClick={onCheckOutcome}>
              {t.form.checkOutcome}
            </Button>
          )}
        </div>
      )}
      {/* 선별에서 하나도 고르지 않았을 때 저장 단추가 읽을 이유(전부 고름은 위 오류 문구가 같은 id 를 쓴다). */}
      {!isLocked && sortBlock !== undefined && !isAllSelected && (
        <span id={sortBlockId} className="visually-hidden">
          {sortBlock}
        </span>
      )}

      <div className="form-actions disposition-decision-actions">
        <Button variant="outlined" disabled={!canCancel || isSaving} onClick={onCancel}>
          {t.actions.cancel}
        </Button>
        <Button
          disabled={isLocked || isSaving || sortBlock !== undefined || noSelectableType}
          aria-describedby={saveDescribedBy ?? (noSelectableType ? noTypeReasonId : undefined)}
          onClick={onSave}
        >
          {isSort ? t.sort.save : t.actions.save}
        </Button>
      </div>
    </div>
  );
};
