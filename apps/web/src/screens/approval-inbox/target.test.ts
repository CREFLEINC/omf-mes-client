import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { SCREEN_ROUTES } from './screen-routes';
import { describeTargetName, judgeTargetOpen } from './target';
import type { ApprovalTarget } from './types';

const t = messages.approvalInbox;

/** 대상 하나. **네 갈래를 만드는 축은 `openable`·`screenId`·매핑표 셋뿐이다.** */
const target = (openable: boolean, screenId?: string, displayName = '합성 대상 문서 가') => {
  const made: ApprovalTarget = {
    targetTypeCode: 'INBOUND_LOT',
    targetId: 9401,
    displayName,
    openable,
    ...(screenId === undefined ? {} : { screenId }),
  };

  return made;
};

const FILLED_ROUTES = {
  'W-99-99': { path: '/synthetic/target', selectionKey: 'syntheticId' },
} as const;

describe('대상 열기 판정', () => {
  it('계약이 열 수 없다고 하면 그것으로 잠긴다 — 화면 ID가 있어도 마찬가지다', () => {
    expect(judgeTargetOpen(target(false, 'W-99-99'), 9001, FILLED_ROUTES)).toEqual({
      kind: 'notOpenable',
    });
  });

  it('열 수 있다는데 화면 ID가 없으면 그 사실로 잠긴다', () => {
    /* 스키마상 가능한 조합이다 — `openable`은 required이고 `screenId`는 아니다. */
    expect(judgeTargetOpen(target(true), 9001, FILLED_ROUTES)).toEqual({ kind: 'noScreenId' });
  });

  it('화면 ID가 빈 문자열이어도 없는 것과 같이 다룬다', () => {
    expect(judgeTargetOpen(target(true, ''), 9001, FILLED_ROUTES)).toEqual({ kind: 'noScreenId' });
  });

  it('화면 ID가 매핑표에 없으면 그 사실로 잠긴다', () => {
    expect(judgeTargetOpen(target(true, 'W-99-98'), 9001, FILLED_ROUTES)).toEqual({
      kind: 'unmapped',
    });
  });

  it('현재 표에 없는 화면 ID의 대상은 잠긴다', () => {
    expect(judgeTargetOpen(target(true, 'W-99-99'), 9001, SCREEN_ROUTES)).toEqual({
      kind: 'unmapped',
    });
  });

  it('객체 프로토타입 이름도 매핑되지 않은 대상으로 잠긴다', () => {
    expect(judgeTargetOpen(target(true, 'constructor'), 9001, SCREEN_ROUTES)).toEqual({
      kind: 'unmapped',
    });
  });

  it('매핑표에 줄이 생기면 열린다 — 자리표시가 죽은 가지가 아니다', () => {
    /* 전환 감지기(계획 M28). 잠금을 상수로 굳히면 이 단언이 깨진다. */
    expect(judgeTargetOpen(target(true, 'W-99-99'), 9001, FILLED_ROUTES)).toEqual({
      kind: 'open',
      path: '/synthetic/target?syntheticId=9001',
    });
  });

  it('W-04-02 대상은 승인 요청 ID를 정식 선택 키로 전달한다', () => {
    expect(judgeTargetOpen(target(true, 'W-04-02'), 9001, SCREEN_ROUTES)).toEqual({
      kind: 'open',
      path: '/shipment/shipment-schedule?approvalRequestId=9001',
    });
  });
});
