import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { LookupEntry } from './types';

const t = messages.usersRoles;

export interface UserStatusChipsProps {
  statuses: LookupEntry[];
  /** 상태마다의 건수 — `statuses` 와 같은 순서. 받기 전이면 `undefined`. */
  counts: readonly (number | undefined)[];
  /** 걸린 재직 상태. 없으면 `''`. */
  active: string;
  onChange: (next: string) => void;
  /** 묶음 이름 — 주지 않으면 「재직 상태」(역할 탭은 「사용 상태」 · #333). */
  label?: string;
}

/**
 * 탭 줄 오른쪽 재직 상태 칩(omf-all-around#333) — 수입검사의 「대기 · 진행 · 완료」 칩과 같은 모양 · 자리.
 * 누르면 그 상태만, 다시 누르면 푼다. **0건 · 아직 모르는 상태는 세우지 않는다**(사용자 지시) — 다만 걸려 있는
 * 칩은 0건이어도 남겨 풀 수 있게 한다.
 */
export const UserStatusChips = ({
  statuses,
  counts,
  active,
  onChange,
  label = t.statusChips.label,
}: UserStatusChipsProps) => {
  const shown = statuses
    .map((status, index) => ({ status, count: counts[index] }))
    .filter(({ status, count }) => status.value === active || (count !== undefined && count > 0));

  if (shown.length === 0) return null;

  return (
    <div className="inspection-hub-counts" role="group" aria-label={label}>
      {shown.map(({ status, count }) => {
        const isActive = active === status.value;

        return (
          <Chip
            key={status.value}
            variant="filter"
            size="sm"
            selected={isActive}
            aria-pressed={isActive}
            aria-label={
              isActive
                ? t.statusChips.filterOff(status.label)
                : t.statusChips.filterOn(status.label)
            }
            onSelectedChange={(selected) => {
              onChange(selected ? status.value : '');
            }}
          >
            {count === undefined
              ? status.label
              : messages.common.inspectionHub.count(status.label, count)}
          </Chip>
        );
      })}
    </div>
  );
};
