import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { PopSelect as Select } from '../../patterns/pop-select';
import { PuField, PuNote, PuTiles } from '../../patterns/pop-uniform';
import type { CodeValue } from './types';

const t = messages.repackLabelIssue.issue;

/** 이만큼까지는 타일로 고른다(규칙 7). 넘으면 고르기 창. */
const TILE_LIMIT = 6;

export interface ReasonFieldProps {
  reasons: readonly CodeValue[];
  reasonsFailed: boolean;
  reasonCode: string;
  onReasonChange: (value: string) => void;
  /** 서버가 사유를 지목해 돌려준 말(422). */
  serverError: string | null;
}

/**
 * 재인쇄 사유 칸 — **인쇄 창 안에 선다**(사용자 지시 2026-09-17). 사유가 필요한 인쇄는 창에서
 * 사유를 고르고 [재인쇄]를 누른다.
 */
export const ReasonField = ({
  reasons,
  reasonsFailed,
  reasonCode,
  onReasonChange,
  serverError,
}: ReasonFieldProps) => {
  const reasonId = useId();
  const options = reasons.map((reason) => ({ value: reason.code, label: reason.codeName }));

  return (
    <PuField label={t.reasonLabel} required htmlFor={reasonId}>
      {options.length <= TILE_LIMIT ? (
        options.length > 0 && (
          <PuTiles
            label={t.reasonLabel}
            cols={2}
            options={options}
            value={reasonCode === '' ? null : reasonCode}
            onChange={onReasonChange}
          />
        )
      ) : (
        <Select
          id={reasonId}
          aria-label={t.reasonLabel}
          options={options}
          value={reasonCode === '' ? null : reasonCode}
          onChange={onReasonChange}
          placeholder={t.reasonPlaceholder}
          invalid={serverError !== null || reasonCode === ''}
        />
      )}
      {reasonsFailed && <PuNote tone="warn">{t.reasonsFailed}</PuNote>}
      {!reasonsFailed && reasons.length === 0 && <PuNote tone="warn">{t.reasonsEmpty}</PuNote>}
      {serverError !== null && <PuNote tone="bad">{serverError}</PuNote>}
    </PuField>
  );
};
