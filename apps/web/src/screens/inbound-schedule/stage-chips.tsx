import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { chipGroups } from './stage';
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
 * 탭 줄 오른쪽의 **단계 건수 칩** — 「라벨 발행 대기 1건 · 검사 대기 4건 · 보류 2건 · 적치 대기 3건」(C-17 머리 건수 · #358).
 * 누르면 그 묶음의 LOT 이 있는 발주만 남고, 다시 누르면 풀린다 — 조건 줄의 조건과 함께 걸린다.
 *
 * **수가 있는 묶음만 세운다**(`chipGroups`) — 0 인 칩은 늘 서 있어도 할 일이 없다는 말뿐이라 걷었다(관리웹 화면 정리 시안 A ·
 * 2026-11-20). 지금 걸린 칩은 0 이 돼도 남겨 눌러 풀 수 있다.
 * 조건·머리 건수·행 칩은 같은 이름이다(C-17 — `stage.group`).
 */
export const StageChips = ({ counts, active, onChange }: StageChipsProps) => (
  <div className="po-board-stage-chips" role="group" aria-label={t.stage.label}>
    {chipGroups(counts, active).map((group) => {
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
          {t.stage.chipCount(label, counts[group] ?? 0)}
        </Chip>
      );
    })}
  </div>
);
