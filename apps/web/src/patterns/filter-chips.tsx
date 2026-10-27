import { Chip } from '@crefle/web-ui';

export interface FilterChipOption {
  /** `null` 은 「전체」(거르지 않음). */
  value: string | null;
  label: string;
}

/**
 * 표 위 거르기 칩 한 줄 — 「전체 N」 · 「합격 N」 …(사용자 지시 2026-10-27 · omf-all-around#185).
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
  countOf: (value: string | null) => number;
  onChange: (value: string | null) => void;
}) => (
  <div className="filter-chips" role="group" aria-label={label}>
    {options.map((option) => (
      <Chip
        key={option.value ?? 'all'}
        variant="filter"
        size="sm"
        selected={value === option.value}
        aria-pressed={value === option.value}
        onSelectedChange={() => onChange(option.value)}
      >
        {`${option.label} ${String(countOf(option.value))}`}
      </Chip>
    ))}
  </div>
);
