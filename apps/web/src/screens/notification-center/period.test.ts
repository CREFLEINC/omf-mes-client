import { messages } from '@omf-mes/i18n';
import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_PERIOD_DAYS,
  PERIOD_URL_KEYS,
  defaultPeriod,
  hasPeriodKeys,
  readPeriod,
  resolvePeriod,
} from './period';

const t = messages.notificationCenter;

/**
 * 시간대를 **인자로 고정한다.** 실행 환경의 시간대를 그대로 쓰면 이 시험이 코드가 아니라
 * 그 환경을 검사하게 되고, CI와 사람 자리에서 다른 답이 나온다.
 *
 * `getTimezoneOffset()`은 **UTC 기준의 반대 부호**를 준다 — 한국(+09:00)이 `-540`이다.
 */
const at = (offsetMinutes: number, year = 2026, month = 7, day = 6): Date => {
  const made = new Date(year, month, day);
  vi.spyOn(made, 'getTimezoneOffset').mockReturnValue(-offsetMinutes);

  return made;
};

const KST = at(540);

describe('readPeriod', () => {
  it('주소에 기간이 없으면 두 칸이 빈다', () => {
    expect(readPeriod(new URLSearchParams(''))).toEqual({ from: '', to: '' });
  });

  it('주소의 값을 그대로 읽는다 — 깨진 값도 다듬지 않는다', () => {
    // 판정이 「무엇이 잘못됐는지」를 말하려면 사용자가 넣은 값을 그대로 받아야 한다.
    expect(readPeriod(new URLSearchParams('from=2026-02-31&to=오늘'))).toEqual({
      from: '2026-02-31',
      to: '오늘',
    });
  });

  it('주소 키 이름은 상수 한 곳에 있다', () => {
    const params = new URLSearchParams();
    params.set(PERIOD_URL_KEYS.from, '2026-08-01');
    params.set(PERIOD_URL_KEYS.to, '2026-08-07');

    expect(readPeriod(params)).toEqual({ from: '2026-08-01', to: '2026-08-07' });
  });
});

describe('hasPeriodKeys', () => {
  it('키가 하나도 없으면 거짓이다', () => {
    expect(hasPeriodKeys(new URLSearchParams(''))).toBe(false);
    expect(hasPeriodKeys(new URLSearchParams('unread=1'))).toBe(false);
  });

  /**
   * ⭐ **값이 비어도 키가 있으면 참이다.** `readPeriod`는 이 둘을 같은 빈 문자열로 접으므로,
   * 이 판정이 없으면 사용자가 비운 기간을 화면이 기본값으로 덮는다.
   */
  it('값이 비어 있어도 키가 있으면 참이다', () => {
    expect(hasPeriodKeys(new URLSearchParams('from=&to='))).toBe(true);
  });

  it('한쪽 키만 있어도 참이다 — 기간에 손을 댄 상태다', () => {
    expect(hasPeriodKeys(new URLSearchParams('from=2026-08-01'))).toBe(true);
    expect(hasPeriodKeys(new URLSearchParams('to='))).toBe(true);
  });
});

describe('defaultPeriod', () => {
  it('오늘을 마지막 날로 두고 오늘 포함 7일을 고른다', () => {
    expect(defaultPeriod(new Date(2026, 7, 6))).toEqual({ from: '2026-07-31', to: '2026-08-06' });
  });

  it('달과 해의 경계를 넘어도 날짜가 맞다', () => {
    expect(defaultPeriod(new Date(2026, 0, 3))).toEqual({ from: '2025-12-28', to: '2026-01-03' });
  });

  it('윤년의 2월도 그대로 넘어간다', () => {
    expect(defaultPeriod(new Date(2028, 2, 3))).toEqual({ from: '2028-02-26', to: '2028-03-03' });
  });

  it('돌려준 값은 그대로 조회할 수 있다 — 심자마자 막히면 첫 진입이 빈 화면이 된다', () => {
    expect(resolvePeriod(defaultPeriod(new Date(2026, 7, 6)), true, KST).kind).toBe('ready');
  });

  it('기본 일수는 상수 한 곳에 있다 — 다른 값이 맞으면 이 상수만 고친다', () => {
    expect(DEFAULT_PERIOD_DAYS).toBe(7);
  });

  it('오늘을 인자로 받는다 — 함수 안에서 실행 환경의 시각을 읽지 않는다', () => {
    // 같은 인자에 같은 결과다. 안에서 `new Date()`를 부르면 이 단언이 날이 바뀔 때 깨진다.
    expect(defaultPeriod(new Date(2026, 7, 6))).toEqual(defaultPeriod(new Date(2026, 7, 6)));
  });
});

describe('resolvePeriod — 조회하지 않는 갈래', () => {
  it('주소에 기간이 아예 없으면 비어 있는 것으로 본다 — 사용자가 잘못한 것이 없다', () => {
    expect(resolvePeriod({ from: '', to: '' }, false, KST)).toEqual({ kind: 'empty' });
  });

  /**
   * ⭐ 「키가 없다」와 「키는 있고 값이 비었다」는 **정반대 사태**다. 값만 보면 둘 다 빈
   * 문자열이라, 이 둘을 접으면 사용자가 비운 기간을 화면이 곧바로 덮어쓴다.
   */
  it('키는 있는데 값이 비었으면 덮을 자리가 아니다 — 비운 것이 사용자의 뜻이다', () => {
    expect(resolvePeriod({ from: '', to: '' }, true, KST)).toEqual({
      kind: 'blocked',
      reason: t.reasons.periodIncomplete,
    });
  });

  it('없는 날짜는 막는다 — 자릿수만 보면 통과해 그대로 요청에 실린다', () => {
    expect(resolvePeriod({ from: '2026-02-31', to: '2026-08-06' }, true, KST)).toEqual({
      kind: 'blocked',
      reason: t.reasons.periodInvalid,
    });
    expect(resolvePeriod({ from: '2026-08-01', to: '2026-13-01' }, true, KST)).toEqual({
      kind: 'blocked',
      reason: t.reasons.periodInvalid,
    });
  });

  it('형식이 깨진 값도 같은 갈래다', () => {
    expect(resolvePeriod({ from: '2026-8-1', to: '2026-08-06' }, true, KST).kind).toBe('blocked');
    expect(resolvePeriod({ from: '20260801', to: '2026-08-06' }, true, KST).kind).toBe('blocked');
    expect(resolvePeriod({ from: '2026-08-01', to: '오늘' }, true, KST).kind).toBe('blocked');
  });

  it('한쪽만 채운 기간은 막는다 — 빈 쪽을 화면이 지어 채우지 않는다', () => {
    expect(resolvePeriod({ from: '2026-08-01', to: '' }, true, KST)).toEqual({
      kind: 'blocked',
      reason: t.reasons.periodIncomplete,
    });
    expect(resolvePeriod({ from: '', to: '2026-08-06' }, true, KST)).toEqual({
      kind: 'blocked',
      reason: t.reasons.periodIncomplete,
    });
  });

  /**
   * ⭐ **「없는 값」과 「틀린 값」을 같은 문구로 두지 않는다**(공유계약 G-9).
   *
   * 한쪽만 비운 사람이 넣은 날짜는 멀쩡하다 — 그 사람에게 「올바른 날짜가 아닙니다 · 둘 다
   * 다시 고르세요」라고 말하면 사실도 아니고 할 일도 늘린다.
   */
  it('빈 값과 틀린 값이 서로 다른 사유를 낸다', () => {
    const missing = resolvePeriod({ from: '2026-08-01', to: '' }, true, KST);
    const invalid = resolvePeriod({ from: '2026-08-01', to: '2026-02-31' }, true, KST);

    expect(missing.kind).toBe('blocked');
    expect(invalid.kind).toBe('blocked');
    expect(missing).not.toEqual(invalid);
  });

  it('빈 값이 틀린 값보다 앞선다 — 비어 있는 쪽을 날짜 탓으로 말하지 않는다', () => {
    /* 한쪽은 비었고 반대쪽은 없는 날짜다. 사용자가 먼저 할 일은 비운 쪽을 채우는 것이다. */
    expect(resolvePeriod({ from: '', to: '2026-02-31' }, true, KST)).toEqual({
      kind: 'blocked',
      reason: t.reasons.periodIncomplete,
    });
  });

  it('종료가 시작보다 앞서면 다른 사유를 낸다 — 순서 문제를 날짜 문제로 말하지 않는다', () => {
    expect(resolvePeriod({ from: '2026-08-06', to: '2026-08-01' }, true, KST)).toEqual({
      kind: 'blocked',
      reason: t.reasons.periodReversed,
    });
  });

  it('역전은 해가 바뀌어도 판정된다 — 문자열 앞자리로만 보면 놓친다', () => {
    expect(resolvePeriod({ from: '2026-01-02', to: '2025-12-31' }, true, KST).kind).toBe('blocked');
  });

  it('없는 날짜가 뒤집힘보다 앞선다 — 순서를 바꿔도 여전히 조회되지 않는 값이다', () => {
    expect(resolvePeriod({ from: '2026-02-31', to: '2026-01-01' }, true, KST)).toEqual({
      kind: 'blocked',
      reason: t.reasons.periodInvalid,
    });
  });
});

describe('resolvePeriod — 보내는 값', () => {
  it('시작은 그날 00:00:00, 종료는 그날 23:59:59다', () => {
    /*
     * 계약이 `date-time`을 받는다 — 날짜만 보내면 형식이 맞지 않는다.
     * 종료를 00:00:00으로 만들면 마지막 날에 온 알림이 통째로 빠진다.
     */
    expect(resolvePeriod({ from: '2026-08-01', to: '2026-08-06' }, true, KST)).toEqual({
      kind: 'ready',
      query: {
        occurredFrom: '2026-08-01T00:00:00+09:00',
        occurredTo: '2026-08-06T23:59:59+09:00',
      },
    });
  });

  it('같은 날 하루만 고른 것도 조회할 수 있다', () => {
    expect(resolvePeriod({ from: '2026-08-06', to: '2026-08-06' }, true, KST)).toEqual({
      kind: 'ready',
      query: {
        occurredFrom: '2026-08-06T00:00:00+09:00',
        occurredTo: '2026-08-06T23:59:59+09:00',
      },
    });
  });

  it('오프셋 0은 +00:00으로 적는다 — 시간대가 없으면 같은 글자가 지역마다 다른 순간이 된다', () => {
    const state = resolvePeriod({ from: '2026-08-01', to: '2026-08-01' }, true, at(0));

    expect(state).toEqual({
      kind: 'ready',
      query: {
        occurredFrom: '2026-08-01T00:00:00+00:00',
        occurredTo: '2026-08-01T23:59:59+00:00',
      },
    });
  });

  it('UTC 서쪽은 부호를 그대로 낸다', () => {
    const state = resolvePeriod({ from: '2026-08-01', to: '2026-08-02' }, true, at(-300));

    expect(state).toEqual({
      kind: 'ready',
      query: {
        occurredFrom: '2026-08-01T00:00:00-05:00',
        occurredTo: '2026-08-02T23:59:59-05:00',
      },
    });
  });

  it('30분 단위 오프셋도 분까지 적는다', () => {
    const state = resolvePeriod({ from: '2026-08-01', to: '2026-08-02' }, true, at(330));

    expect(state).toEqual({
      kind: 'ready',
      query: {
        occurredFrom: '2026-08-01T00:00:00+05:30',
        occurredTo: '2026-08-02T23:59:59+05:30',
      },
    });
  });

  it('지금을 인자로 받는다 — 함수 안에서 실행 환경의 시각을 읽지 않는다', () => {
    /*
     * 같은 기간·같은 시간대에는 「언제 불렀는가」가 결과를 바꾸지 못한다.
     * 안에서 `new Date()`를 부르면 그 값이 쿼리에 새어 들어와 이 단언이 깨진다.
     */
    const morning = at(540, 2026, 7, 6);
    const evening = at(540, 2026, 11, 31);

    expect(resolvePeriod({ from: '2026-08-01', to: '2026-08-06' }, true, morning)).toEqual(
      resolvePeriod({ from: '2026-08-01', to: '2026-08-06' }, true, evening),
    );
  });
});
