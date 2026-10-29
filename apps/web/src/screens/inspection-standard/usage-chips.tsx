import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { HubActions, useHubActionsTarget } from '../../patterns/hub-actions';
import type { PlanFilters } from './types';

const t = messages.inspectionStandard.filters;

/** 사용 여부로 거르기 — 전체(미사용 포함) · 사용(기본) · 미사용만. */
export type PlanUsage = 'all' | 'active' | 'inactive';

const OPTIONS: readonly { value: PlanUsage; label: string }[] = [
  { value: 'all', label: t.usageAll },
  { value: 'active', label: t.usageActive },
  { value: 'inactive', label: t.usageInactive },
];

export const usageOf = (filters: PlanFilters): PlanUsage =>
  filters.inactiveOnly ? 'inactive' : filters.includeInactive ? 'all' : 'active';

export const withUsage = (filters: PlanFilters, usage: PlanUsage): PlanFilters => ({
  ...filters,
  includeInactive: usage !== 'active',
  inactiveOnly: usage === 'inactive',
});

export interface UsageChipsProps {
  value: PlanUsage;
  onChange: (next: PlanUsage) => void;
}

/**
 * 탭 줄 오른쪽, 좌우 · 상하 배치 단추 왼쪽에 서는 사용 여부 칩(사용자 지시 · #208).
 * 하나만 고른다 — 고른 칩을 다시 눌러도 풀리지 않는다(셋 중 하나는 늘 켜져 있다).
 * 탭 묶음 밖(탭 막대가 없는 화면 · 화면만 그린 시험)에서는 자리가 없어 그리지 않는다.
 */
export const UsageChips = ({ value, onChange }: UsageChipsProps) => {
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
            {option.label}
          </Chip>
        ))}
      </div>
    </HubActions>
  );
};
