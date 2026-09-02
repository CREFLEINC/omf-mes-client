import { describe, expect, it } from 'vitest';

import { readWorkOrderId, WORK_ORDER_PARAM } from './screen-params';

const params = (value: string | null): URLSearchParams =>
  new URLSearchParams(value === null ? '' : `${WORK_ORDER_PARAM}=${value}`);

describe('readWorkOrderId', () => {
  it('양의 정수를 읽는다', () => {
    expect(readWorkOrderId(params('7801'))).toBe(7801);
  });

  it('키가 없으면 null이다', () => {
    expect(readWorkOrderId(params(null))).toBeNull();
  });

  /*
   * `Number('')`은 0이다 — 자릿수 검사를 먼저 하지 않으면 빈 값이 「작업지시 0번」이 되어
   * 조회가 나간다.
   */
  it('빈 값을 0으로 읽지 않는다', () => {
    expect(readWorkOrderId(params(''))).toBeNull();
  });

  /* `Number(' 12 ')`도 12다 — 공백이 섞인 값을 통과시키면 주소가 정본이라는 말이 흔들린다. */
  it('공백이 섞인 값을 받지 않는다', () => {
    expect(readWorkOrderId(params('%2012%20'))).toBeNull();
  });

  it.each(['0', '-1', '1.5', 'abc', '1e3'])('있을 수 없는 값(%s)은 null이다', (value) => {
    expect(readWorkOrderId(params(value))).toBeNull();
  });

  /* int64 자리를 넘긴 값은 정확히 옮겨지지 않는다 — 조회에 실으면 다른 작업지시를 가리킨다. */
  it('안전 정수 범위를 넘긴 값은 null이다', () => {
    expect(readWorkOrderId(params('9007199254740993'))).toBeNull();
  });
});
