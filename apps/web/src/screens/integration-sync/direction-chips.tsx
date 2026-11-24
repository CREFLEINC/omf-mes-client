import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { HubActions, useHubActionsTarget } from '../../patterns/hub-actions';
import { directionName } from './message-labels';
import { useDirectionCounts, type MessageListQuery } from './queries';

const t = messages.integrationSync.table;
const hubText = messages.common.inspectionHub;

/** 계약이 닫은 두 방향. 「전체」(빈 값)는 맨 앞에 붙인다. */
const CODES = ['', 'INBOUND', 'OUTBOUND'] as const;

interface DirectionChipsProps {
  /** 지금 걸린 조회 조건(쪽 제외) — 건수는 여기서 방향만 바꿔 센다. 기간이 없으면 `null`. */
  query: MessageListQuery | null;
  /** 지금 고른 방향(빈 값이면 전체). */
  value: string;
  onChange: (code: string) => void;
}

/**
 * 위 줄 송수신 구분 라벨 「전체 N · 수신 N · 송신 N」(사용자 지시 2026-11-24 · #358).
 * 검사 조회·판정의 판정 라벨과 같은 자리 · 모양 — 누르면 그 방향으로 바로 거르고, 「전체」는 거르기를 푼다.
 * 조회 상자의 「송수신 구분 선택」과 같은 조건을 바꾼다. **0건인 라벨은 세우지 않는다**(고른 라벨은 0건이어도 둔다).
 */
export const DirectionChips = ({ query, value, onChange }: DirectionChipsProps) => {
  const target = useHubActionsTarget();
  const counts = useDirectionCounts(query, CODES);
  const group = (
    <div className="inspection-hub-counts" role="group" aria-label={t.directionChips}>
      {CODES.map((code, index) => {
        const isActive = value === code;
        const count = counts[index];
        if (code !== '' && count === 0 && !isActive) return null;
        const label = code === '' ? t.directionAll : directionName(code);

        return (
          <Chip
            key={code}
            variant="filter"
            size="sm"
            selected={isActive}
            aria-pressed={isActive}
            onSelectedChange={() => onChange(code)}
          >
            {count === undefined ? label : hubText.count(label, count)}
          </Chip>
        );
      })}
    </div>
  );

  return target === null ? group : <HubActions target={target}>{group}</HubActions>;
};
