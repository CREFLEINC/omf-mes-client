import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { Select } from '../../patterns/select';
import { CODE_GROUPS, toCodeOptions } from './code-options';
import { useCodeValues } from './queries';

const t = messages.common.inspectionHub;

export interface JudgmentFilterProps {
  /** 거르는 종합 판정 — 비면 거르지 않는다. */
  value: string | null;
  onChange: (next: string | null) => void;
}

/**
 * 검사 조회·판정(IQC · PQC · OQC) 스캔 줄의 「종합 판정」 선택칸(omf-all-around#356) — 고르면 바로 조회한다.
 * 확정된 의뢰만 판정이 있어(서버 `overallJudgmentCode`), 값 목록은 공통코드에서 받는다(공유계약 G-6).
 */
export const JudgmentFilter = ({ value, onChange }: JudgmentFilterProps) => {
  const labelId = useId();
  const options = toCodeOptions(useCodeValues(CODE_GROUPS.overallJudgment).data ?? []);

  return (
    <div className="field-cell inspection-judgment-filter">
      <span className="field-label" id={labelId}>
        {t.judgmentFilter}
      </span>
      <Select
        aria-labelledby={labelId}
        value={value ?? ''}
        options={[{ value: '', label: t.judgmentAll }, ...options]}
        onChange={(next) => onChange(next === '' ? null : next)}
      />
    </div>
  );
};
