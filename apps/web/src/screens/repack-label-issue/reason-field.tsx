import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { PopSelect as Select } from '../../patterns/pop-select';
import type { CodeValue } from './types';

const t = messages.repackLabelIssue.issue;

export interface ReasonFieldProps {
  reasons: readonly CodeValue[];
  reasonsFailed: boolean;
  reasonCode: string;
  onReasonChange: (value: string) => void;
  /** 서버가 사유를 지목해 돌려준 말(422). */
  serverError: string | null;
}

/**
 * 재발행 사유 칸 — **인쇄 창 안에 선다**(사용자 지시 2026-09-17). 사유가 필요한 인쇄는 창에서
 * 사유를 고르고 [인쇄]를 누른다. 구획에 늘 서 있으면 최초 발행에도 칸이 자리를 차지했다.
 */
export const ReasonField = ({
  reasons,
  reasonsFailed,
  reasonCode,
  onReasonChange,
  serverError,
}: ReasonFieldProps) => {
  const reasonId = useId();
  const reasonErrorId = useId();

  return (
    <div className="pop-repack-field pop-repack-reason">
      <label htmlFor={reasonId}>{t.reasonLabel}</label>
      <p className="pop-repack-reason-note">{t.reasonRequiredNote}</p>
      <Select
        id={reasonId}
        options={reasons.map((reason) => ({ value: reason.code, label: reason.codeName }))}
        value={reasonCode === '' ? null : reasonCode}
        onChange={onReasonChange}
        placeholder={t.reasonPlaceholder}
        className="pop-repack-select"
        disabled={reasons.length === 0}
        invalid={serverError !== null}
        aria-describedby={serverError === null ? undefined : reasonErrorId}
      />
      {reasonsFailed && <p className="pop-repack-note">{t.reasonsFailed}</p>}
      {!reasonsFailed && reasons.length === 0 && (
        <p className="pop-repack-note">{t.reasonsEmpty}</p>
      )}
      {serverError !== null && (
        <p className="pop-repack-error" id={reasonErrorId} role="alert">
          {serverError}
        </p>
      )}
    </div>
  );
};
