import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { HubActions, useHubActionsTarget } from '../../patterns/hub-actions';

const t = messages.inspectionSheetTemplate.list;

/** 사용 여부로 거르기 — 전체(라벨 없음) · 사용(기본) · 미사용. */
export type UsageChipValue = 'all' | 'active' | 'inactive';

/* 「전체」 라벨은 두지 않는다 — 고른 라벨을 다시 누르면 전체로 돌아간다(사용자 지시 2026-11-24). */
const OPTIONS: readonly { value: Exclude<UsageChipValue, 'all'>; label: string }[] = [
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
 * 「전체」 없이 「사용 N건 · 미사용 N건」 — 고른 라벨을 다시 누르면 전체(미사용 포함)로 풀린다. 0건 라벨은 감춘다(고른 라벨은
 * 남긴다 · 사용자 지시 2026-11-24).
 * 탭 묶음 밖에서는 자리가 없어 그리지 않는다.
 */
export const UsageChips = ({ counts, value, onChange }: UsageChipsProps) => {
  const target = useHubActionsTarget();
  if (target === null) return null;

  return (
    <HubActions target={target}>
      <div className="inspection-hub-counts" role="group" aria-label={t.usageLabel}>
        {OPTIONS.filter(
          (option) => value === option.value || counts === null || counts[option.value] !== 0,
        ).map((option) => (
          <Chip
            key={option.value}
            variant="filter"
            size="sm"
            selected={value === option.value}
            aria-pressed={value === option.value}
            onSelectedChange={() => {
              onChange(value === option.value ? 'all' : option.value);
            }}
          >
            {counts === null ? option.label : t.usageCount(option.label, counts[option.value])}
          </Chip>
        ))}
      </div>
    </HubActions>
  );
};
