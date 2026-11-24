import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { HubActions, useHubActionsTarget } from '../../patterns/hub-actions';

const t = messages.defectCauseCode.usage;

/** 사용 여부로 거르기 — 전체(미사용 포함 · 라벨 없음) · 사용(기본) · 미사용만. */
export type CodeUsage = 'all' | 'active' | 'inactive';

/* 「전체」 라벨은 두지 않는다 — 고른 라벨을 다시 누르면 전체로 돌아간다(사용자 지시 2026-11-24). */
const OPTIONS: readonly { value: Exclude<CodeUsage, 'all'>; label: string }[] = [
  { value: 'active', label: t.active },
  { value: 'inactive', label: t.inactive },
];

export interface UsageChipsProps {
  /** 칩마다 붙일 건수. null 이면 이름만 낸다(아직 세지 못함) */
  counts: Record<CodeUsage, number> | null;
  value: CodeUsage;
  onChange: (next: CodeUsage) => void;
}

/**
 * 탭 줄 오른쪽, 좌우·상하 배치 단추 왼쪽에 서는 사용 여부 칩(사용자 지시 2026-10-29 · #209).
 * 「전체」 없이 「사용 N건 · 미사용 N건」 — 고른 라벨을 다시 누르면 전체(미사용 포함)로 풀린다. 0건 라벨은 감춘다(고른 라벨은
 * 남긴다 · 사용자 지시 2026-11-24).
 * 탭 묶음 밖(탭 막대가 없는 화면 · 화면만 그린 시험)에서는 자리가 없어 그리지 않는다. 사용 여부는 이 칩만 바꾼다 —
 * 조회 카드의 「미사용 포함」 확인칸은 걷었다(사용자 지시 · #209).
 */
export const UsageChips = ({ counts, value, onChange }: UsageChipsProps) => {
  const target = useHubActionsTarget();
  if (target === null) return null;

  return (
    <HubActions target={target}>
      <div className="inspection-hub-counts defect-cause-usage" role="group" aria-label={t.label}>
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
            {counts === null ? option.label : t.count(option.label, counts[option.value])}
          </Chip>
        ))}
      </div>
    </HubActions>
  );
};
