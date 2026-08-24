import { messages } from '@omf-mes/i18n';
import { Radio, Select, type SelectItems } from '@crefle/web-ui';
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
  onRemainderDispositionChange: (value: WorkOrderCloseRemainderDisposition) => void;
  onVarianceReasonCodeChange: (value: string) => void;
}

export const WorkOrderCloseInputPane = ({
  completionJudgment,
  draft,
  reasonOptions,
  reasonUnavailableReason,
  onRemainderDispositionChange,
  onVarianceReasonCodeChange,
}: WorkOrderCloseInputPaneProps): JSX.Element => {
  const t = messages.workOrderClose.input;
  const reasonId = useId();
  const reasonNoteId = `${reasonId}-note`;
  const remainderGroupName = useId();
  const reasonNote =
    reasonUnavailableReason ?? (reasonOptions.length === 0 ? t.reason.empty : null);
  const classificationMessageKey = CLASSIFICATION_MESSAGE_KEY[completionJudgment];

  return (
    <section aria-label={t.pane} className="pane">
      <h2>{t.heading}</h2>
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
        </fieldset>
      ) : null}
      {completionJudgment !== 'NORMAL' ? (
        <div className="field-cell">
          <label className="field-label" htmlFor={reasonId}>
            {t.reason.label}
          </label>
          <Select
            aria-describedby={reasonNote === null ? undefined : reasonNoteId}
            aria-required
            disabled={reasonNote !== null}
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
