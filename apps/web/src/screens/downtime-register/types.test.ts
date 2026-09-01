import { describe, expect, it } from 'vitest';

import { resolveSaveBlock } from './action-bar';
import { reasonName, reasonsOfCategory } from './downtime-reasons';
import { breakdown, downtime, ongoingDowntime } from './fixtures';
import { byStartedAtDesc, fromPending, startedOn } from './today-rows';
import { isOngoing, toBreakdownView, toDowntimeView } from './types';

describe('toDowntimeView · isOngoing', () => {
  it('끝 시각이 있으면 진행 중이 아니다', () => {
    expect(isOngoing(toDowntimeView(downtime()))).toBe(false);
  });

  it('끝 시각이 비어 있으면 진행 중이다 — 별도 상태 값을 보지 않는다', () => {
    expect(isOngoing(toDowntimeView(ongoingDowntime()))).toBe(true);
  });

  it('칸 자체가 빠져 온 응답도 진행 중으로 읽는다', () => {
    const { endedAt: _endedAt, ...withoutField } = downtime();

    /* `undefined`가 판정을 지나치면 끝나지 않은 구간이 끝난 것으로 보인다. */
    expect(isOngoing(toDowntimeView(withoutField))).toBe(true);
  });

  it('서버가 낸 길이를 그대로 옮긴다 — 화면이 다시 계산하지 않는다', () => {
    expect(toDowntimeView(downtime({ durationMinutes: 50 })).durationMinutes).toBe(50);
    expect(toDowntimeView(ongoingDowntime()).durationMinutes).toBeNull();
  });
});

describe('toBreakdownView', () => {
  it('정지 시각을 모르는 고장은 제안할 것이 없다', () => {
    expect(toBreakdownView(breakdown({ stoppedAt: null })).stoppedAt).toBeNull();
  });
});

describe('resolveSaveBlock', () => {
  const base = {
    workerNo: 'SAMPLE-1',
    equipmentId: 1,
    gate: 'allowed' as const,
    hasOngoing: false,
  };

  it('전부 갖춰지면 막지 않는다', () => {
    expect(resolveSaveBlock(base)).toBeNull();
  });

  it('사번을 모르면 그것부터 말한다 — 쓰기가 서버에서 거부되는 사유다', () => {
    expect(resolveSaveBlock({ ...base, workerNo: null, equipmentId: null })).toBe('worker-missing');
  });

  it('게이팅을 판정하지 못한 것과 닫힌 것을 가른다', () => {
    expect(resolveSaveBlock({ ...base, gate: 'unavailable' })).toBe('gate-unavailable');
    expect(resolveSaveBlock({ ...base, gate: 'denied' })).toBe('gate-denied');
    /* 단말을 모르는 것도 「통과」가 아니다. */
    expect(resolveSaveBlock({ ...base, gate: 'unidentified' })).toBe('gate-denied');
    expect(resolveSaveBlock({ ...base, gate: 'checking' })).toBe('gate-checking');
  });

  it('진행 중 구간이 있으면 새로 시작할 수 없다', () => {
    expect(resolveSaveBlock({ ...base, hasOngoing: true })).toBe('ongoing-exists');
  });
});

describe('today-rows', () => {
  it('아직 안 나간 건은 멱등키를 이름으로 쓴다 — 순번을 쓰면 앞 건이 나갈 때 이름이 밀린다', () => {
    const row = fromPending('key-1', {
      equipmentId: 1,
      reasonCode: 'MOLD_CHANGE',
      startedAt: '2026-08-11T09:40:00+09:00',
    });

    expect(row.key).toBe('pending:key-1');
    /* 서버가 보지 못한 건이라 저장된 길이가 없다. */
    expect(row.durationMinutes).toBeNull();
  });

  it('사유 코드는 임시 목록의 이름으로 풀되, 없으면 코드를 그대로 보인다', () => {
    expect(
      fromPending('k', {
        equipmentId: 1,
        reasonCode: 'MOLD_CHANGE',
        startedAt: '2026-08-11T09:40:00+09:00',
      }).reasonLabel,
    ).toBe('금형 교체');

    expect(
      fromPending('k', {
        equipmentId: 1,
        reasonCode: 'UNKNOWN_CODE',
        startedAt: '2026-08-11T09:40:00+09:00',
      }).reasonLabel,
    ).toBe('UNKNOWN_CODE');
  });

  it('오늘 시작한 것만 남기고, 늦게 시작한 것이 위로 온다', () => {
    const rows = [
      {
        key: 'a',
        startedAt: '2026-08-11T09:40:00+09:00',
        endedAt: null,
        durationMinutes: null,
        reasonLabel: '',
      },
      {
        key: 'b',
        startedAt: '2026-08-11T13:05:00+09:00',
        endedAt: null,
        durationMinutes: null,
        reasonLabel: '',
      },
      {
        key: 'c',
        startedAt: '2026-08-10T13:05:00+09:00',
        endedAt: null,
        durationMinutes: null,
        reasonLabel: '',
      },
    ];

    const today = rows.filter((row) => startedOn(row, '2026-08-11')).sort(byStartedAtDesc);

    expect(today.map((row) => row.key)).toEqual(['b', 'a']);
  });
});

describe('자리표시 사유 목록', () => {
  it('대분류가 소분류를 좁힌다', () => {
    expect(reasonsOfCategory('EQUIPMENT').length).toBeGreaterThan(0);
    /* 모르는 대분류에 목록을 지어내지 않는다. */
    expect(reasonsOfCategory('NOT_A_CATEGORY')).toHaveLength(0);
    expect(reasonsOfCategory(null)).toHaveLength(0);
  });

  it('임시 목록에 없는 코드는 이름을 지어내지 않는다', () => {
    expect(reasonName('MOLD_CHANGE')).toBe('금형 교체');
    expect(reasonName('UNKNOWN_CODE')).toBeNull();
  });
});
