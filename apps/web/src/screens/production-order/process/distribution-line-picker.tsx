import { Button } from '@crefle/web-ui';
import { Select } from '../../../patterns/select';
import type { PlanLine } from './plan-step';

/**
 * 자동 분배의 생산 라인 선택칸 — 찾기 창 대신 펼침 선택칸(사용자 지시 2026-11-27, 수동 분배 창 · #360 과 같게).
 * 선택지는 이미 조회한 오더별 허용 라인이고, 다섯 개를 넘으면 공용 선택칸이 검색칸을 띄운다.
 */
export const DistributionLinePicker = ({
  label,
  lines,
  value,
  disabled,
  optional = false,
  emptyLabel = '생산 라인 선택',
  onChange,
}: {
  label: string;
  lines: readonly PlanLine[];
  value: string;
  disabled: boolean;
  optional?: boolean;
  emptyLabel?: string;
  onChange: (value: string) => void;
}) => (
  <div className="erp-wo-distribution-line-field">
    <div className="erp-wo-distribution-line-buttons">
      <Select
        size="md"
        aria-label={`${label} 선택`}
        placeholder={emptyLabel}
        options={lines.map((line) => ({
          value: String(line.id),
          label: `${line.name} (${line.code})`,
        }))}
        value={value === '' ? null : value}
        disabled={disabled}
        onChange={onChange}
      />
      {optional && value && (
        <Button
          size="md"
          variant="text"
          aria-label={`${label} 해제`}
          disabled={disabled}
          onClick={() => onChange('')}
        >
          해제
        </Button>
      )}
    </div>
  </div>
);
