import { Button, DatePicker, Icon, Radio, RadioGroup, TextArea } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { lookupDisplayLabel } from '../../patterns/lookup-display';
import { SaveErrorBanner } from '../../patterns/master';
import {
  CONCESSION,
  SORT,
  sortSelectionError,
  toBusinessDate,
  withDispositionType,
  type DecisionFormErrors,
  type DecisionFormValue,
} from './decision-form';
import { dispositionTypeLabel, type DispositionOption } from './disposition-codes';
import type { DispositionLookup } from './lookups';
import { SortSplitPane, sortQtyValues } from './sort-split-pane';
import { formatQty, type NonconformanceLotRow } from './types';

/**
 * 막힌 처분 유형의 이유를 눈에 보일 줄로 묶는다 — 모든 유형이 같은 이유면 이유만, 일부면 「선별: …」처럼 유형 이름을 앞에.
 * 이유 문장이 이미 유형 이름을 말하면(「선별은 …」) 앞에 다시 붙이지 않는다(#352 사용자 지시 문구).
 * 화면이 「처분 판정」 제목 오른쪽 안내 라벨로 보인다(#352 사용자 지시). 칸마다 읽는 이유는 이 창이 감춘 글로 잇는다.
 */
export const typeLockLines = (options: readonly DispositionOption[]): string[] => {
  const notes = options.flatMap((option) =>
    option.lockReason === undefined ? [] : [{ label: option.label, reason: option.lockReason }],
  );
  return [...new Set(notes.map((note) => note.reason))].map((reason) => {
    const labels = notes.filter((note) => note.reason === reason).map((note) => note.label);
    return labels.length === options.length || labels.every((label) => reason.includes(label))
      ? reason
      : `${labels.join(', ')}: ${reason}`;
  });
};

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
  /** 고를 처분 유형 — 폐기 · 선별 · 특채(#352). 특채를 고르면 아래에 적용 기간 칸이 펼쳐진다. */
  dispositionOptions: DispositionOption[];
  /** 지금 날짜 — 특채 적용 시작일의 처음 값. 시험이 고정할 수 있게 받는다. */
  today?: Date | undefined;
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
  today,
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
  const reasonBlockId = useId();
  const validFromId = useId();
  const validToId = useId();
  const todayText = toBusinessDate(today ?? new Date());
  const isConcession = value.dispositionTypeCode === CONCESSION;
  /*
   * 선별을 고르면 양품 · 불량 수량 칸을 고른 LOT 대로 바로 채운다(아직 안 골랐으면 전부 양품 · 불량 0 · omf-all-around#354 사용자 지시).
   * 선별에서 벗어나면 두 칸을 비운다 — 다른 유형에선 보이지도 보내지도 않는 값이다.
   */
  const pickType = (code: string): void => {
    const next = withDispositionType(value, code, todayText);
    onChange(
      code === SORT
        ? { ...next, ...sortQtyValues(lots, next.sortLotIds) }
        : { ...next, goodQty: '', defectQty: '' },
    );
  };
  const isLocked = lockReason !== undefined;
  const reasonMissing = value.reason.trim() === '';
  const isSort = value.dispositionTypeCode === SORT;
  const uomLabel = uomId === undefined ? '' : lookupDisplayLabel(uoms, uomId);
  const remainingText =
    remainingQty === undefined
      ? formatQty(undefined)
      : `${formatQty(remainingQty)}${uomLabel === '' ? '' : ` ${uomLabel}`}`;
  const effect = isConcession
    ? ''
    : isWholeCode(value.dispositionTypeCode)
      ? value.dispositionTypeCode === 'REWORK' &&
        inboundLotNo !== null &&
        inboundLotNo !== undefined
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

  const lockNotes = dispositionOptions
    .map((option) => ({
      id: `${optionHintId}-${option.value}`,
      label: option.label,
      reason: option.lockReason,
    }))
    .flatMap((note) => (note.reason === undefined ? [] : [{ ...note, reason: note.reason }]));
  const optionCount = dispositionOptions.length;
  /*
   * 고를 수 있는 유형이 하나도 없으면(종결 · 특채 결재 중 등) 저장 · 사유 입력도 잠근다 — 눌러도 「처분을 선택하세요」만
   * 나오는 단추를 두지 않는다. 이유는 위 막힘 글이 말한다(omf-all-around#275).
   */
  const noSelectableType =
    optionCount > 0 && lockNotes.length === optionCount && value.dispositionTypeCode === '';
  const noTypeReasonId = lockNotes[0]?.id;

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
           * 특채도 같은 라디오다 — 팝업 없이 아래에 적용 기간 칸이 펼쳐진다(#352 사용자 지시).
           */}
          <RadioGroup
            name="disposition-type"
            orientation="horizontal"
            className="disposition-type-options"
            value={value.dispositionTypeCode}
            disabled={isLocked || dispositionOptions.length === 0}
            aria-labelledby={groupLabelId}
            aria-describedby={isLocked ? lockReasonId : undefined}
            onChange={pickType}
          >
            {dispositionOptions.map((option) => {
              const hintId = `${optionHintId}-${option.value}`;
              return (
                <div
                  key={option.value}
                  className="disposition-type-option"
                  data-selected={value.dispositionTypeCode === option.value ? 'true' : undefined}
                  data-locked={option.lockReason === undefined ? undefined : 'true'}
                  onClick={(event) => {
                    /*
                     * 고른 칸을 한 번 더 누르면 선택을 푼다(omf-all-around#352 사용자 지시). 라디오는 이미 고른 칸에서
                     * change 를 내지 않아 클릭으로 본다 — 이름표를 눌러도 입력칸 클릭이 한 번 더 오므로 입력칸 클릭만 센다.
                     */
                    if (
                      event.target instanceof HTMLInputElement &&
                      value.dispositionTypeCode === option.value
                    ) {
                      pickType('');
                    }
                  }}
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
          {errors.dispositionTypeCode !== undefined && (
            <span className="field-error">{errors.dispositionTypeCode}</span>
          )}
        </div>

        {/*
         * 처분 수량 = 남은 수량 전부 — 입력하지 않는다(FR-038 · 일부 판정 없음). 바꿀 수 없는 값이라 글로 보인다.
         * 선별을 골라도 같은 자리에 그대로 둔다 — 유형을 바꿀 때 칸이 사라졌다 나타나지 않게(omf-all-around#354 사용자 지시).
         */}
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
          {errors.decisionQty !== undefined && (
            <span className="field-error disposition-qty-error">{errors.decisionQty}</span>
          )}
        </div>
      </div>

      {/* 특채 — 요청 팝업에 있던 적용 기간 칸을 판정 칸 아래에(#352 사용자 지시). 수량은 위 처분 수량(남은 수량 전부), 사유는 아래 판정 사유. */}
      {isConcession && (
        <div
          className="disposition-concession-fields"
          role="group"
          aria-label={t.concession.requestHeading}
        >
          <div className="field-cell">
            <span className="field-label">
              <label htmlFor={validFromId}>{t.concession.validFrom}</label>
              <span className="required-mark" aria-hidden="true">
                {' *'}
              </span>
            </span>
            <DatePicker
              id={validFromId}
              value={value.validFrom === '' ? null : value.validFrom}
              max={value.validTo === '' ? undefined : value.validTo}
              disabled={isLocked}
              onChange={(next) => onChange({ ...value, validFrom: next ?? '' })}
            />
            {errors.validFrom !== undefined && (
              <span className="field-error">{errors.validFrom}</span>
            )}
          </div>
          <div className="field-cell">
            <label className="field-label" htmlFor={validToId}>
              {t.concession.validTo}
            </label>
            <DatePicker
              id={validToId}
              clearable
              placeholder={t.concession.validToPlaceholder}
              value={value.validTo === '' ? null : value.validTo}
              min={value.validFrom === '' ? undefined : value.validFrom}
              disabled={isLocked}
              onChange={(next) => onChange({ ...value, validTo: next ?? '' })}
            />
            {errors.validTo !== undefined && <span className="field-error">{errors.validTo}</span>}
          </div>
        </div>
      )}

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

      {/* 판정 사유는 필수 — 비어 있으면 저장 단추를 잠그고 그 이유를 단추에 잇는다(#352 사용자 지시). */}
      {reasonMissing && (
        <span id={reasonBlockId} className="visually-hidden">
          {t.form.reasonRequired}
        </span>
      )}
      <div className="form-actions disposition-decision-actions">
        {/* 고른 유형으로 저장하면 생기는 일 — 정보 라벨로 취소 단추 왼쪽에(omf-all-around#352 사용자 지시). */}
        {effect !== undefined && (
          <span id={qtyNoteId} className="iqc-inspection-action-note" data-tone="info">
            <Icon name="info" size={14} aria-hidden />
            {t.form.wholeEffect(lots.length, dispositionTypeLabel(value.dispositionTypeCode))}
          </span>
        )}
        {/* 선별 — 고른 LOT · 나머지 LOT 가 어떻게 되는지를 같은 자리에(omf-all-around#354 사용자 지시). */}
        {isSort && (
          <span className="iqc-inspection-action-note" data-tone="info">
            <Icon name="info" size={14} aria-hidden />
            {t.sort.selectNote}
          </span>
        )}
        <Button variant="outlined" disabled={!canCancel || isSaving} onClick={onCancel}>
          {t.actions.cancel}
        </Button>
        <Button
          disabled={
            isLocked || isSaving || sortBlock !== undefined || noSelectableType || reasonMissing
          }
          aria-describedby={
            saveDescribedBy ??
            (noSelectableType ? noTypeReasonId : reasonMissing ? reasonBlockId : undefined)
          }
          onClick={onSave}
        >
          {t.actions.save}
        </Button>
      </div>
    </div>
  );
};
