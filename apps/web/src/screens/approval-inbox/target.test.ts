import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { SCREEN_ROUTES } from './screen-routes';
import { describeOpenBlock, describeTargetName, judgeTargetOpen } from './target';
import type { ApprovalTarget } from './types';

const t = messages.approvalInbox;

/** 대상 하나. **네 갈래를 만드는 축은 `openable`·`screenId`·매핑표 셋뿐이다.** */
const target = (openable: boolean, screenId?: string, displayName = '합성 대상 문서 가') => {
  const made: ApprovalTarget = {
    targetTypeCode: 'SAMPLE-TARGET-A',
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

  it('매핑표에 줄이 생기면 열린다 — 자리표시가 죽은 가지가 아니다', () => {
    /* 전환 감지기(계획 M28). 잠금을 상수로 굳히면 이 단언이 깨진다. */
    expect(judgeTargetOpen(target(true, 'W-99-99'), 9001, FILLED_ROUTES)).toEqual({
      kind: 'open',
      path: '/synthetic/target?syntheticId=9001',
    });
  });

  it('W-03-09 대상은 승인 요청 ID를 정식 선택 키로 전달한다', () => {
    expect(judgeTargetOpen(target(true, 'W-03-09'), 9001, SCREEN_ROUTES)).toEqual({
      kind: 'open',
      path: '/quality/approvals?approvalRequestId=9001',
    });
  });
});

describe('잠긴 사유', () => {
  it('세 갈래의 문구가 서로 다르다', () => {
    const reasons = [
      describeOpenBlock({ kind: 'notOpenable' }),
      describeOpenBlock({ kind: 'noScreenId' }),
      describeOpenBlock({ kind: 'unmapped' }),
    ];

    expect(reasons).toEqual([
      t.target.blockedNotOpenable,
      t.target.blockedNoScreenId,
      t.target.blockedUnmapped,
    ]);
    expect(new Set(reasons).size).toBe(3);
  });

  it('세 문구 모두 무엇이 막혔는지(열기)로 시작한다 — 어느 컨트롤의 사유인지가 먼저다', () => {
    for (const reason of [
      describeOpenBlock({ kind: 'notOpenable' }),
      describeOpenBlock({ kind: 'noScreenId' }),
      describeOpenBlock({ kind: 'unmapped' }),
    ]) {
      expect(reason.startsWith(`${t.target.open}:`)).toBe(true);
    }
  });
});

describe('대상 이름', () => {
  it('서버가 만든 표시명을 그대로 낸다', () => {
    expect(describeTargetName(target(true, 'W-99-99'))).toBe('합성 대상 문서 가');
  });

  it('표시명이 비어 오면 사실을 적는다 — 내부 번호를 대신 내지 않는다', () => {
    const name = describeTargetName(target(true, 'W-99-99', ''));

    expect(name).toBe(t.values.unknownTarget);
    expect(name).not.toContain('9401');
  });

  it('공백만인 표시명도 비어 있는 것과 같이 다룬다', () => {
    expect(describeTargetName(target(true, 'W-99-99', '   '))).toBe(t.values.unknownTarget);
  });

  it('대상 유형 코드는 이름에 섞이지 않는다 — 유형으로 이름을 지어내지 않는다', () => {
    expect(describeTargetName(target(true, 'W-99-99'))).not.toContain('SAMPLE-TARGET-A');
  });
});
