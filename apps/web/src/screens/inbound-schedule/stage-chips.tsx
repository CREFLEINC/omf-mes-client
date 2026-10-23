import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { STAGE_GROUPS } from './stage';
import type { InboundStageCounts, InboundStageGroup } from './types';

const t = messages.inboundSchedule;

export interface StageChipsProps {
  counts: InboundStageCounts;
  /** 지금 걸린 묶음. 비면 전부. */
  active: InboundStageGroup | '';
  onChange: (next: InboundStageGroup | '') => void;
}

/**
 * 탭 줄 오른쪽의 **단계 건수 칩** — 「검사 대기 4 · 보류 2 · 입고 대기 5 · 적치 대기 3」(C-17 머리 건수).
 * 누르면 그 묶음의 LOT 이 있는 발주만 남고, 다시 누르면 풀린다 — 조건 줄의 조건과 함께 걸린다.
 *
 * **셀 수 없는 묶음은 세우지 않는다.** 네 묶음을 다 늘어놓되 0 인 것도 보인다 — 「보류 0」이 보여야 보류가 없음을 안다.
 * 조건·머리 건수·행 칩은 같은 이름이다(C-17 — `stage.group`).
 */
export const StageChips = ({ counts, active, onChange }: StageChipsProps) => (
  <div className="po-board-stage-chips" role="group" aria-label={t.stage.label}>
    {STAGE_GROUPS.map((group) => {
      const label = t.stage.group[group];
      const isActive = active === group;

      return (
        <Chip
          key={group}
          variant="filter"
          size="sm"
          selected={isActive}
          aria-pressed={isActive}
          aria-label={isActive ? t.stage.filterOff(label) : t.stage.filterOn(label)}
          onSelectedChange={(selected) => {
            onChange(selected ? group : '');
          }}
        >
          {t.stage.groupCount(label, counts[group] ?? 0)}
        </Chip>
      );
    })}
  </div>
);
