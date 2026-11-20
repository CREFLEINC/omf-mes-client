import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { RegistrationFilter } from './filters';

const t = messages.terminalProcessMap;

const ENTRIES: readonly { value: Exclude<RegistrationFilter, ''>; label: string }[] = [
  { value: 'registered', label: t.list.registrationComplete },
  { value: 'unregistered', label: t.list.registrationPending },
];

export interface ActiveChipsProps {
  /** [등록, 미등록] 건수 — 아직 모르면 undefined. */
  counts: readonly (number | undefined)[];
  active: RegistrationFilter;
  onChange: (next: RegistrationFilter) => void;
}

/**
 * 등록 · 미등록 라벨(사용자 지시 2026-11-20 · omf-all-around#333) — 사용자 역할 권한 관리의 상태 라벨과 같은 모양.
 * 누르면 그 상태만 보이고 다시 누르면 풀린다. 0건인 라벨은 걸려 있지 않으면 숨긴다(C-6).
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const ActiveChips = ({ counts, active, onChange }: ActiveChipsProps) => {
  const shown = ENTRIES.map((entry, index) => ({ entry, count: counts[index] })).filter(
    ({ entry, count }) => entry.value === active || (count !== undefined && count > 0),
  );

  if (shown.length === 0) return null;

  return (
    <div className="inspection-hub-counts" role="group" aria-label={t.chips.label}>
      {shown.map(({ entry, count }) => {
        const isOn = active === entry.value;

        return (
          <Chip
            key={entry.value}
            variant="filter"
            size="sm"
            selected={isOn}
            aria-pressed={isOn}
            aria-label={isOn ? t.chips.filterOff(entry.label) : t.chips.filterOn(entry.label)}
            onSelectedChange={(selected) => {
              onChange(selected ? entry.value : '');
            }}
          >
            {count === undefined
              ? entry.label
              : messages.common.inspectionHub.count(entry.label, count)}
          </Chip>
        );
      })}
    </div>
  );
};
