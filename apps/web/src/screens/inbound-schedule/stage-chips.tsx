import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { countedGroups } from './stage';
import type { InboundStageCounts, InboundStageGroup } from './types';

const t = messages.inboundSchedule;

/** 더 쓰지 않는 묶음 — 서버가 세어도 늘 0 이다(계약 enum 은 지우지 않았다 · 피처 009 D-7). */
const RETIRED_GROUP: InboundStageGroup = 'RECEIPT';

export interface StageChipsProps {
  counts: InboundStageCounts;
  /** 지금 걸린 묶음. 비면 전부. */
  active: InboundStageGroup | '';
  onChange: (next: InboundStageGroup | '') => void;
}

/**
 * 탭 줄 오른쪽의 **단계 건수 칩** — 「라벨 발행 대기 1 · 검사 대기 4 · 보류 2 · 입고 대기 5 · 적치 대기 3」(C-17 머리 건수).
 * 누르면 그 묶음의 LOT 이 있는 발주만 남고, 다시 누르면 풀린다 — 조건 줄의 조건과 함께 걸린다.
 *
 * **셀 수 없는 묶음은 세우지 않는다.** 서버가 센 묶음은 0 이어도 보인다 — 「보류 0」이 보여야 보류가 없음을 안다.
 * 앞선 서버는 라벨 발행 대기를 세지 않아 그 칩만 빠진다(`countedGroups`).
 * 조건·머리 건수·행 칩은 같은 이름이다(C-17 — `stage.group`).
 */
export const StageChips = ({ counts, active, onChange }: StageChipsProps) => (
  <div className="po-board-stage-chips" role="group" aria-label={t.stage.label}>
    {countedGroups(counts).map((group) => {
      const label = t.stage.group[group];
      const isActive = active === group;

      return (
        <Chip
          key={group}
          /*
           * 「입고 대기」는 늘 0 이다 — 구매 입고는 PDA 적치로 한다(피처 009). 칩 줄의 자리는 남기되 흐리게 둔다(시안 결정).
           */
          {...(group === RETIRED_GROUP ? { className: 'po-board-stage-chip--retired' } : {})}
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
