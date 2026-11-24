import { messages } from '@omf-mes/i18n';
import { Radio, TextArea, type SelectItems } from '@crefle/web-ui';
import { type JSX, useId } from 'react';

import { InfoLabel, InfoTip } from '../../patterns/info-tip';
import { Select } from '../../patterns/select';
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
  const remarksId = useId();
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
      {completionJudgment === 'UNDER' ? (
        <fieldset className="field-cell">
          <legend className="field-label">
            {t.remainder.legend}
            <span className="required-mark" aria-hidden="true">
              {' *'}
            </span>
          </legend>
          <div className="check-group">
            {/* 이월 W/O 가 저절로 서지 않는다는 것은 「이월」 바로 옆 ⓘ 로 둔다(관리웹 정리 시안 A). */}
            <span className="work-order-close-option-info">
              <Radio
                checked={draft.remainderDisposition === 'CARRY_OVER'}
                name={remainderGroupName}
                value="CARRY_OVER"
                onChange={() => onRemainderDispositionChange('CARRY_OVER')}
              >
                {t.remainder.CARRY_OVER}
              </Radio>
              <InfoTip text={t.remainder.carryOverNote(messages.productionOrder.menuPath)} />
            </span>
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
      {/* 소멸은 다른 전표를 만들지 않는다 — 고른 이유는 마감 비고(remarks)와 처분 코드에만 남는다. */}
      {completionJudgment === 'UNDER' && draft.remainderDisposition === 'WRITE_OFF' ? (
        <div className="field-cell">
          {/* 소멸이 무엇을 남기는지는 라벨 옆 ⓘ 로 — 칸 아래에 펴 두지 않는다(관리웹 정리 시안 A). */}
          <InfoLabel htmlFor={remarksId} label={t.remarks.label} info={t.remarks.help} />
          <TextArea
            id={remarksId}
            value={draft.remarks}
            rows={2}
            fullWidth
            placeholder={t.remarks.placeholder}
            onChange={(event) => onRemarksChange(event.target.value)}
          />
        </div>
      ) : null}
      {completionJudgment !== 'NORMAL' ? (
        <div className="field-cell">
          <span className="field-label">
            <label htmlFor={reasonId}>{t.reason.label}</label>
            <span className="required-mark" aria-hidden="true">
              {' *'}
            </span>
          </span>
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
