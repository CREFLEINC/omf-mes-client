import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { HubActions, useHubActionsTarget } from '../../patterns/hub-actions';

const t = messages.inspectionSheetTemplate.list;

/** 사용 여부로 거르기 — 전체 · 사용(기본) · 미사용. */
export type UsageChipValue = 'all' | 'active' | 'inactive';

const OPTIONS: readonly { value: UsageChipValue; label: string }[] = [
  { value: 'all', label: t.usageAll },
  { value: 'active', label: t.usageActive },
  { value: 'inactive', label: t.usageInactive },
];

export interface UsageChipsProps {
  /** 칩마다 붙일 건수. null 이면 이름만 낸다(아직 세지 못함) */
  counts: Record<UsageChipValue, number> | null;
  value: UsageChipValue;
  onChange: (next: UsageChipValue) => void;
}

/**
 * 탭 줄 오른쪽, 좌우 · 상하 배치 단추 왼쪽에 서는 사용 여부 칩 — 검사 기준 탭과 같다(사용자 지시 · #208).
 * 하나만 고른다 — 고른 칩을 다시 눌러도 풀리지 않는다. 탭 묶음 밖에서는 자리가 없어 그리지 않는다.
 */
export const UsageChips = ({ counts, value, onChange }: UsageChipsProps) => {
  const target = useHubActionsTarget();
  if (target === null) return null;

  return (
    <HubActions target={target}>
      <div className="inspection-hub-counts" role="group" aria-label={t.usageLabel}>
        {OPTIONS.map((option) => (
          <Chip
            key={option.value}
            variant="filter"
            size="sm"
            selected={value === option.value}
            aria-pressed={value === option.value}
            onSelectedChange={() => {
              if (value !== option.value) onChange(option.value);
            }}
          >
            {counts === null ? option.label : t.usageCount(option.label, counts[option.value])}
          </Chip>
        ))}
      </div>
    </HubActions>
  );
};
