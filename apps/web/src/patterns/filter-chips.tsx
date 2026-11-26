import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

export interface FilterChipOption {
  value: string;
  label: string;
}

/**
 * 표 위 거르기 칩 한 줄 — 「합격 N」 · 「불합격 N」 …(사용자 지시 2026-10-27 · omf-all-around#185, 「건」은 뺀다 2026-11-25 · #358).
 * 「전체」 칩은 두지 않는다 — 고른 칩을 다시 누르면 전체로 돌아간다. 0건 칩은 고른 칩이 아니면 감춘다(사용자 지시 2026-11-24 · #358).
 * 하나만 고른다. 건수는 부르는 쪽이 거르기 전 전체에서 센다.
 */
export const FilterChips = ({
  label,
  options,
  value,
  countOf,
  onChange,
}: {
  /** 칩 묶음의 접근 이름. */
  label: string;
  options: readonly FilterChipOption[];
  value: string | null;
  countOf: (value: string) => number;
  onChange: (value: string | null) => void;
}) => (
  <div className="filter-chips" role="group" aria-label={label}>
    {options
      .filter((option) => value === option.value || countOf(option.value) !== 0)
      .map((option) => (
        <Chip
          key={option.value}
          variant="filter"
          size="sm"
          selected={value === option.value}
          aria-pressed={value === option.value}
          onSelectedChange={() => onChange(value === option.value ? null : option.value)}
        >
          {messages.common.inspectionHub.count(option.label, countOf(option.value))}
        </Chip>
      ))}
  </div>
);
