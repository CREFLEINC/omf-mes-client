import { describe, expect, it } from 'vitest';

import {
  EMPTY_INTERVAL,
  findOverlaps,
  hasIntervalError,
  intervalMinutes,
  readInterval,
  readTimeField,
  toTimeFieldDraft,
  validateInterval,
  type IntervalDraft,
} from './interval';

const draft = (overrides: Partial<IntervalDraft> = {}): IntervalDraft => ({
  ...EMPTY_INTERVAL,
  startedAt: { date: '2026-08-11', time: '14:20' },
  endedAt: { date: '2026-08-11', time: '15:07' },
  ...overrides,
});

const NOW = new Date(2026, 7, 11, 16, 0);

describe('readTimeField', () => {
  it('날짜와 시각 두 칸을 지역 시각 한 순간으로 읽는다', () => {
    const at = readTimeField({ date: '2026-08-11', time: '14:20' });

    /* UTC로 읽히면 이 단언이 무너진다 — 단말 시각을 그대로 쓴다는 규칙이 여기 걸려 있다. */
    expect(at?.getFullYear()).toBe(2026);
    expect(at?.getMonth()).toBe(7);
    expect(at?.getDate()).toBe(11);
    expect(at?.getHours()).toBe(14);
    expect(at?.getMinutes()).toBe(20);
  });

  it('한쪽 칸이 비어 있으면 읽지 않는다', () => {
    expect(readTimeField({ date: '2026-08-11', time: '' })).toBeNull();
    expect(readTimeField({ date: '', time: '14:20' })).toBeNull();
  });

  it('없는 날짜는 다른 달로 넘기지 않고 거절한다', () => {
    expect(readTimeField({ date: '2026-02-30', time: '09:00' })).toBeNull();
  });
});

describe('readInterval', () => {
  it('「아직 진행 중」이면 끝 칸에 글자가 남아 있어도 읽지 않는다', () => {
    const moments = readInterval(draft({ stillOngoing: true }));

    expect(moments.started).not.toBeNull();
    expect(moments.ended).toBeNull();
  });
});

describe('validateInterval', () => {
  it('시작이 비어 있으면 필수로 잡는다', () => {
    const errors = validateInterval(draft({ startedAt: { date: '', time: '' } }), NOW);

    expect(errors.startedAt).toBe('required');
  });

  it('미래 시각은 거절한다', () => {
    const errors = validateInterval(
      draft({ startedAt: { date: '2026-08-11', time: '17:00' } }),
      NOW,
    );

    expect(errors.startedAt).toBe('future');
  });

  it('끝이 시작보다 앞서면 **두 칸에 함께** 표시한다', () => {
    const errors = validateInterval(draft({ endedAt: { date: '2026-08-11', time: '13:00' } }), NOW);

    /* 한쪽에만 붙으면 작업자가 고쳐야 할 쪽을 잘못 짚는다. */
    expect(errors.startedAt).toBe('order');
    expect(errors.endedAt).toBe('order');
    expect(hasIntervalError(errors)).toBe(true);
  });

  it('끝이 없어도 정상이다 — 진행 중은 오류가 아니다', () => {
    const errors = validateInterval(draft({ stillOngoing: true }), NOW);

    expect(hasIntervalError(errors)).toBe(false);
  });

  it('끝 칸에 손을 댔는데 읽히지 않으면 잡는다 — 「비었는가」가 아니라 「읽히는가」다', () => {
    /* 한쪽만 친 것과 다 쳤지만 성립하지 않는 값은 **같은 실수**다 — 둘 다 진행 중이 아니다. */
    expect(
      validateInterval(draft({ endedAt: { date: '2026-08-11', time: '' } }), NOW).endedAt,
    ).toBe('incomplete');

    /* 없는 날짜 — 두 칸이 다 차 있어 「비었는가」 잣대는 이것을 놓친다. */
    expect(
      validateInterval(draft({ endedAt: { date: '2026-02-30', time: '15:00' } }), NOW).endedAt,
    ).toBe('incomplete');

    /* 모양이 깨진 시각도 마찬가지. */
    expect(
      validateInterval(draft({ endedAt: { date: '2026-08-11', time: '25:00' } }), NOW).endedAt,
    ).toBe('incomplete');
  });

  it('「아직 진행 중」이면 끝 칸에 무엇이 남아 있든 잡지 않는다', () => {
    /* 체크가 곧 「이 칸을 읽지 않는다」는 뜻이다 — 남은 글자로 저장을 막으면 체크가 무의미해진다. */
    const errors = validateInterval(
      draft({ endedAt: { date: '2026-02-30', time: '15:00' }, stillOngoing: true }),
      NOW,
    );

    expect(hasIntervalError(errors)).toBe(false);
  });

  it('미래 판정의 여유는 시계의 틱 간격만큼이다 — 그보다 넓히지 않는다', () => {
    /*
     * `[지금]`은 초를 버려 실제보다 늘 이르고, 화면의 시계는 최대 한 틱 뒤처진다. 그래서
     * 여유가 틱 간격과 «같아야» 방금 찍은 지금이 막히지 않는다.
     *
     * ⛔ 그보다 넓히면 **손으로 친 미래 시각이 통과한다** — 앞으로 일어날 정지를 미리 적는 것이
     * 되고, 그 기록은 나중에 아무도 설명하지 못한다.
     */
    const oneMinuteAhead = draft({
      startedAt: { date: '2026-08-11', time: '16:01' },
      endedAt: { date: '', time: '' },
      stillOngoing: true,
    });

    expect(validateInterval(oneMinuteAhead, NOW).startedAt).toBe('future');

    /*
     * 틱 간격(30초) 안쪽은 방금 찍은 것일 수 있으므로 통과한다.
     *
     * ⚠ **기준 시각을 정각으로 두지 않는다.** 정각이면 `[지금]`이 넣는 값과 딱 맞아떨어져
     * 등호로 통과하고, **여유를 0으로 좁혀도** 이 단언이 그대로 통과한다 — 그러면 여유가
     * 사라진 것을 아무도 알아채지 못한다. 시계가 45초에 틱한 상태를 재현해 그 폭을 잰다.
     */
    const tickedAtFortyFive = new Date(2026, 7, 11, 16, 0, 45);
    const justNow = draft({
      startedAt: { date: '2026-08-11', time: '16:01' },
      endedAt: { date: '', time: '' },
      stillOngoing: true,
    });

    expect(validateInterval(justNow, tickedAtFortyFive).startedAt).toBeNull();
  });
});

describe('intervalMinutes', () => {
  it('끝이 있으면 분으로 잰다', () => {
    expect(intervalMinutes(readInterval(draft()))).toBe(47);
  });

  it('진행 중이면 **0이 아니라 산출 불가**다', () => {
    expect(intervalMinutes(readInterval(draft({ stillOngoing: true })))).toBeNull();
  });
});

describe('toTimeFieldDraft', () => {
  it('한 자리 수를 두 자리로 채워 브라우저 입력이 읽는 모양으로 낸다', () => {
    expect(toTimeFieldDraft(new Date(2026, 0, 5, 9, 7))).toEqual({
      date: '2026-01-05',
      time: '09:07',
    });
  });
});

describe('findOverlaps', () => {
  const existing = [
    { startedAt: '2026-08-11T13:05:00+09:00', endedAt: '2026-08-11T13:20:00+09:00' },
    { startedAt: '2026-08-11T09:40:00+09:00', endedAt: '2026-08-11T10:30:00+09:00' },
  ];

  it('구간이 겹치면 그 건들을 낸다 — 막지는 않는다', () => {
    const moments = readInterval(
      draft({
        startedAt: { date: '2026-08-11', time: '13:10' },
        endedAt: { date: '2026-08-11', time: '13:30' },
      }),
    );

    expect(findOverlaps(existing, moments)).toHaveLength(1);
  });

  it('경계가 맞닿은 것은 겹침이 아니다', () => {
    const moments = readInterval(
      draft({
        startedAt: { date: '2026-08-11', time: '13:20' },
        endedAt: { date: '2026-08-11', time: '13:40' },
      }),
    );

    /* 연달아 선 두 구간을 겹쳤다고 하면 경고가 늘 떠 있어 진짜 겹침을 가린다. */
    expect(findOverlaps(existing, moments)).toHaveLength(0);
  });

  it('끝이 없는 새 구간은 이후의 모든 구간과 겹친다', () => {
    const moments = readInterval(
      draft({ startedAt: { date: '2026-08-11', time: '09:00' }, stillOngoing: true }),
    );

    expect(findOverlaps(existing, moments)).toHaveLength(2);
  });

  it('열려 있는 기존 구간은 그 뒤 어느 구간과도 겹친다', () => {
    const moments = readInterval(
      draft({
        startedAt: { date: '2026-08-11', time: '20:00' },
        endedAt: { date: '2026-08-11', time: '20:10' },
      }),
    );

    expect(
      findOverlaps([{ startedAt: '2026-08-11T19:00:00+09:00', endedAt: null }], moments),
    ).toHaveLength(1);
  });

  it('시작을 읽을 수 없으면 아무것도 겹치지 않는다', () => {
    expect(findOverlaps(existing, { started: null, ended: null })).toHaveLength(0);
  });
});
