import { messages } from '@omf-mes/i18n';
import { Radio, Select, TextArea, type SelectItems } from '@crefle/web-ui';
import { type JSX, useId } from 'react';

import type {
  WorkOrderCloseInputDraft,
  WorkOrderCloseRemainderDisposition,
} from './close-input-draft';
import type { WorkOrderCloseCompletionJudgment } from './close-readiness';

const CLASSIFICATION_MESSAGE_KEY = {
  UNDER: 'SHORTFALL',
  NORMAL: 'EXACT',
  OVER: 'OVERAGE',
} as const satisfies Record<WorkOrderCloseCompletionJudgment, 'SHORTFALL' | 'EXACT' | 'OVERAGE'>;

export interface WorkOrderCloseInputPaneProps {
  completionJudgment: WorkOrderCloseCompletionJudgment;
  draft: WorkOrderCloseInputDraft;
  reasonOptions: SelectItems;
  reasonUnavailableReason: string | null;
  /** 사유가 W/O 에 이미 실린 값(LOT 마감 때 고른 것)으로 미리 골라져 있는가 */
  isReasonPrefilled: boolean;
  onRemainderDispositionChange: (value: WorkOrderCloseRemainderDisposition) => void;
  onVarianceReasonCodeChange: (value: string) => void;
  onRemarksChange: (value: string) => void;
}

export const WorkOrderCloseInputPane = ({
  completionJudgment,
  draft,
  reasonOptions,
  reasonUnavailableReason,
  isReasonPrefilled,
  onRemainderDispositionChange,
  onVarianceReasonCodeChange,
  onRemarksChange,
}: WorkOrderCloseInputPaneProps): JSX.Element => {
  const t = messages.workOrderClose.input;
  const reasonId = useId();
  const reasonNoteId = `${reasonId}-note`;
  const remainderGroupName = useId();
  const carryOverNoteId = `${remainderGroupName}-note`;
  const reasonNote =
    reasonUnavailableReason ??
    (reasonOptions.length === 0 ? t.reason.empty : isReasonPrefilled ? t.reason.prefilled : null);
  const classificationMessageKey = CLASSIFICATION_MESSAGE_KEY[completionJudgment];

  return (
    <section aria-label={t.pane} className="pane work-order-close-input-pane">
      <h2 className="pane-title">{t.heading}</h2>
      <div className="field-cell">
        <span className="field-label">{t.classification.label}</span>
        <span>{t.classification[classificationMessageKey]}</span>
      </div>
      {completionJudgment === 'NORMAL' ? <p className="field-note">{t.exactNote}</p> : null}
      {completionJudgment === 'UNDER' ? (
        <fieldset className="field-cell">
          <legend className="field-label">{t.remainder.legend}</legend>
          <div className="check-group">
            <Radio
              checked={draft.remainderDisposition === 'CARRY_OVER'}
              aria-describedby={carryOverNoteId}
              name={remainderGroupName}
              value="CARRY_OVER"
              onChange={() => onRemainderDispositionChange('CARRY_OVER')}
            >
              {t.remainder.CARRY_OVER}
            </Radio>
            <Radio
              checked={draft.remainderDisposition === 'WRITE_OFF'}
              name={remainderGroupName}
              value="WRITE_OFF"
              onChange={() => onRemainderDispositionChange('WRITE_OFF')}
            >
              {t.remainder.WRITE_OFF}
            </Radio>
          </div>
          <p className="field-note" id={carryOverNoteId}>
            {t.remainder.carryOverNote(messages.productionOrder.menuPath)}
          </p>
        </fieldset>
      ) : null}
      {/* 소멸은 다른 전표를 만들지 않는다 — 고른 이유는 마감 비고(remarks)와 처분 코드에만 남는다. */}
      {completionJudgment === 'UNDER' && draft.remainderDisposition === 'WRITE_OFF' ? (
        <TextArea
          label={t.remarks.label}
          value={draft.remarks}
          rows={2}
          fullWidth
          placeholder={t.remarks.placeholder}
          helperText={t.remarks.help}
          onChange={(event) => onRemarksChange(event.target.value)}
        />
      ) : null}
      {completionJudgment !== 'NORMAL' ? (
        <div className="field-cell">
          <label className="field-label" htmlFor={reasonId}>
            {t.reason.label}
          </label>
          <Select
            aria-describedby={reasonNote === null ? undefined : reasonNoteId}
            aria-required
            disabled={reasonUnavailableReason !== null || reasonOptions.length === 0}
            id={reasonId}
            options={reasonOptions}
            placeholder={t.reason.placeholder}
            value={draft.varianceReasonCode === '' ? null : draft.varianceReasonCode}
            onChange={onVarianceReasonCodeChange}
          />
          {reasonNote === null ? null : (
            <p className="field-note" id={reasonNoteId}>
              {reasonNote}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
};
