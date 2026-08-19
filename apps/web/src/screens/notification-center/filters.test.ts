import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FILTERS,
  DEFAULT_UNREAD_ONLY,
  URL_KEYS,
  readFilters,
  readPage,
  toFilterQuery,
  toSearchParams,
  withPeriod,
} from './filters';

const PERIOD = { from: '2026-08-01', to: '2026-08-07' };

describe('readFilters — 안 읽음만', () => {
  /**
   * ⭐ **켜진 채로 시작한다**(스펙 §4). 형제 화면들의 boolean 조건(`inProgressOnly`·
   * `activeOnly`)은 `=== ON` 한 줄로 읽는데, 그 형태가 참인 이유는 **그쪽 기본값이 꺼짐**이기
   * 때문이다. 그 줄을 그대로 베끼면 이 화면의 기본값이 조용히 뒤집힌다.
   */
  it('키가 없으면 기본값이다', () => {
    expect(readFilters(new URLSearchParams('')).unreadOnly).toBe(DEFAULT_UNREAD_ONLY);
    expect(DEFAULT_UNREAD_ONLY).toBe(true);
  });

  it('끔을 명시하면 꺼진다', () => {
    expect(readFilters(new URLSearchParams('unread=0')).unreadOnly).toBe(false);
  });

  it('켬을 명시하면 켜진다', () => {
    expect(readFilters(new URLSearchParams('unread=1')).unreadOnly).toBe(true);
  });

  it('모르는 값은 기본값으로 본다 — 사용자가 만들지 않은 조건이 걸리면 안 된다', () => {
    expect(readFilters(new URLSearchParams('unread=maybe')).unreadOnly).toBe(DEFAULT_UNREAD_ONLY);
    expect(readFilters(new URLSearchParams('unread=')).unreadOnly).toBe(DEFAULT_UNREAD_ONLY);
  });
});

describe('readFilters — 유형', () => {
  it('키가 없으면 전체다', () => {
    expect(readFilters(new URLSearchParams('')).eventCode).toBe('');
  });

  it('고른 코드를 그대로 읽는다', () => {
    expect(readFilters(new URLSearchParams('ev=SYN-EVENT-01')).eventCode).toBe('SYN-EVENT-01');
  });

  it('공백만 친 값은 조건이 아니다', () => {
    /* 다듬지 않으면 `eventCode: ' '`가 요청에 실리고 선택칸도 빈 값을 고른 것처럼 보인다. */
    expect(readFilters(new URLSearchParams('ev=%20%20')).eventCode).toBe('');
  });

  it('기본 조건이 상수 한 곳에 있다', () => {
    expect(readFilters(new URLSearchParams(''))).toEqual(DEFAULT_FILTERS);
  });
});

describe('readPage', () => {
  it('키가 없으면 첫 쪽이다', () => {
    expect(readPage(new URLSearchParams(''))).toBe(1);
  });

  it('정상 값을 그대로 읽는다', () => {
    expect(readPage(new URLSearchParams('page=3'))).toBe(3);
  });

  it('0·음수·글자는 첫 쪽으로 본다 — 주소는 손으로 고쳐지는 자리다', () => {
    expect(readPage(new URLSearchParams('page=0'))).toBe(1);
    expect(readPage(new URLSearchParams('page=-1'))).toBe(1);
    expect(readPage(new URLSearchParams('page=abc'))).toBe(1);
    expect(readPage(new URLSearchParams('page=1.5'))).toBe(1);
    expect(readPage(new URLSearchParams('page='))).toBe(1);
  });

  /**
   * ⭐ **형제 사본의 판정으로는 이 값이 통과한다.** 전례들은 `/^\d+$/`와 `>= 1`만 보는데,
   * 22자리는 둘 다 만족하면서 `Number`가 `1.1111111111111112e+21`로 바꾼다 — 지수 표기가
   * 그대로 요청에 실려 서버가 읽지 못한다.
   */
  it('자바스크립트 정수 범위를 넘는 쪽 번호는 첫 쪽으로 본다', () => {
    expect(readPage(new URLSearchParams('page=1111111111111111111111'))).toBe(1);
    expect(readPage(new URLSearchParams(`page=${String(Number.MAX_SAFE_INTEGER)}0`))).toBe(1);
  });

  it('안전 정수의 상한 자체는 받는다 — 방어가 정상 값을 막지 않는다', () => {
    expect(readPage(new URLSearchParams(`page=${String(Number.MAX_SAFE_INTEGER)}`))).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });
});

describe('toSearchParams', () => {
  it('기간은 늘 싣는다 — 계약이 필수로 두어 비어 있을 수 없다', () => {
    expect(toSearchParams(PERIOD, DEFAULT_FILTERS, 1).toString()).toBe(
      'from=2026-08-01&to=2026-08-07',
    );
  });

  it('기본값은 주소에 적지 않는다 — 같은 화면의 주소가 두 가지가 되면 안 된다', () => {
    const params = toSearchParams(PERIOD, DEFAULT_FILTERS, 1);

    expect(params.has(URL_KEYS.unreadOnly)).toBe(false);
    expect(params.has(URL_KEYS.eventCode)).toBe(false);
    expect(params.has(URL_KEYS.page)).toBe(false);
  });

  it('기본과 다른 「안 읽음만」은 주소에 적는다', () => {
    const params = toSearchParams(PERIOD, { unreadOnly: false, eventCode: '' }, 1);

    expect(params.get(URL_KEYS.unreadOnly)).toBe('0');
  });

  it('고른 유형과 옮긴 쪽을 주소에 적는다', () => {
    const params = toSearchParams(PERIOD, { unreadOnly: true, eventCode: 'SYN-EVENT-01' }, 3);

    expect(params.get(URL_KEYS.eventCode)).toBe('SYN-EVENT-01');
    expect(params.get(URL_KEYS.page)).toBe('3');
  });

  it('공백만 친 유형은 주소에 남기지 않는다', () => {
    expect(
      toSearchParams(PERIOD, { unreadOnly: true, eventCode: '  ' }, 1).has(URL_KEYS.eventCode),
    ).toBe(false);
  });

  it('읽고 다시 쓰면 같은 조건이 된다', () => {
    const params = toSearchParams(PERIOD, { unreadOnly: false, eventCode: 'SYN-EVENT-02' }, 4);

    expect(readFilters(params)).toEqual({ unreadOnly: false, eventCode: 'SYN-EVENT-02' });
    expect(readPage(params)).toBe(4);
  });
});

describe('toFilterQuery', () => {
  /** ⭐ 「전체」에 `unreadOnly=false`를 실으면 요청 URL이 조건이 걸린 것처럼 보인다. */
  it('「전체」에는 키 자체를 싣지 않는다', () => {
    expect(toFilterQuery({ unreadOnly: false, eventCode: '' })).toEqual({});
  });

  it('「안 읽음만」이 켜지면 참을 싣는다', () => {
    expect(toFilterQuery({ unreadOnly: true, eventCode: '' })).toEqual({ unreadOnly: true });
  });

  it('고른 유형을 싣는다', () => {
    expect(toFilterQuery({ unreadOnly: false, eventCode: 'SYN-EVENT-01' })).toEqual({
      eventCode: 'SYN-EVENT-01',
    });
  });

  it('공백만 친 유형은 싣지 않는다', () => {
    expect(toFilterQuery({ unreadOnly: false, eventCode: '   ' })).toEqual({});
  });

  it('쪽 크기를 만들지 않는다 — 서버 기본값을 쓴다', () => {
    expect(toFilterQuery({ unreadOnly: true, eventCode: 'SYN-EVENT-01' })).not.toHaveProperty(
      'size',
    );
  });
});

describe('withPeriod', () => {
  it('기간 두 키를 주소에 심는다', () => {
    const next = withPeriod(new URLSearchParams(''), PERIOD);

    expect(next.get(URL_KEYS.from)).toBe('2026-08-01');
    expect(next.get(URL_KEYS.to)).toBe('2026-08-07');
  });

  it('이미 있던 기간은 덮어쓴다', () => {
    const next = withPeriod(new URLSearchParams('from=2026-01-01&to=2026-01-02'), PERIOD);

    expect(next.toString()).toBe('from=2026-08-01&to=2026-08-07');
  });

  it('기간과 상관없는 조건 키를 지우지 않는다 — 기본값을 채우는 김에 조건이 사라지면 안 된다', () => {
    /*
     * ⭐ 새 `URLSearchParams`를 만들어 넣는 형태(전례 `integration-sync/screen.tsx`)를 그대로
     * 베끼면 이 단언이 깨진다. 조건이 늘어난 이 회차부터 손실이 실제로 커진다.
     */
    const next = withPeriod(new URLSearchParams('unread=0&ev=SYN-EVENT-01&page=3'), PERIOD);

    expect(next.get('unread')).toBe('0');
    expect(next.get('ev')).toBe('SYN-EVENT-01');
    expect(next.get('page')).toBe('3');
  });

  it('받은 주소를 바꾸지 않는다 — 부르는 쪽이 든 값이 몰래 달라지면 안 된다', () => {
    const params = new URLSearchParams('unread=0');

    withPeriod(params, PERIOD);

    expect(params.toString()).toBe('unread=0');
  });
});
