import { NETWORK_ERROR, normalizeApiError } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

import { MAX_AUTO_ATTEMPTS, isRejected, retryDelayOf } from './outbox-policy';
import { ApiRequestError } from './request';

/**
 * ⭐ **이 판정이 큐의 심장이다.** 통신 실패를 거부로 오판하면 **되돌릴 수 없는 쓰기가 조용히
 * 사라지고**, 거부를 통신 실패로 오판하면 큐가 영원히 비지 않아 뒤에 쌓인 정상 건까지 막힌다.
 */
describe('isRejected — 기다리면 풀리는가, 아닌가', () => {
  it('통신이 끊긴 것은 거부가 아니다 — 기다리면 풀린다', () => {
    expect(isRejected(new ApiRequestError(NETWORK_ERROR))).toBe(false);
  });

  /*
   * ⛔ **서버가 「지금은 못 받는다」고 한 것을 「이것은 안 된다」로 읽지 않는다.** 거부로 읽으면
   * 항목이 큐에서 내려가는데, 화면은 이미 성공을 말하고 입력을 비운 뒤다.
   */
  it('서버 재기동·과부하·시간초과는 거부가 아니다', () => {
    for (const status of [408, 429, 500, 502, 503, 504]) {
      expect(isRejected(new ApiRequestError({ kind: 'http', status }))).toBe(false);
    }
  });

  it('값이 틀렸다는 4xx 는 거부다 — 기다려도 같은 답이 온다', () => {
    for (const status of [400, 401, 403, 404, 409, 422]) {
      expect(isRejected(new ApiRequestError({ kind: 'http', status }))).toBe(true);
    }
  });

  it('서버가 값을 되돌린 것은 거부다', () => {
    const rejection = new ApiRequestError({
      kind: 'validation',
      errors: [{ scope: 'field', field: 'qty', code: 'RANGE', message: '범위를 벗어났다' }],
    });

    expect(isRejected(rejection)).toBe(true);
  });

  /* 무엇이 잘못됐는지 말해 주지 못하는 실패를 무한히 재전송하면 큐가 그 한 건에 막힌다. */
  it('상태 코드를 모르는 실패는 거부로 다룬다', () => {
    expect(isRejected(new ApiRequestError({ kind: 'http', status: 0 }))).toBe(true);
  });

  it('요청 경로 밖의 예외도 거부로 다룬다', () => {
    expect(isRejected(new Error('알 수 없음'))).toBe(true);
  });

  /*
   * ⭐ **#789 가 막은 구멍** — 봉투에 담겨 온 5xx.
   *
   * 서버가 「잠시 뒤 풀린다」는 실패를 계약 오류 봉투(`errors[]`)에 담아 보내도, 정규화가
   * 상태 코드를 먼저 보므로 `http` 로 남는다. 그래서 이 판정이 상태를 보고 「기다림」으로
   * 읽는다 — 담긴 것이 큐에 남는다.
   *
   * ⛔ **정규화를 거쳐 확인한다.** `ApiRequestError` 에 갈래를 직접 넣으면 정작 고친 자리
   * (`normalizeApiError` 의 순서)를 통과하지 않아 되돌아가도 이 시험이 깨지지 않는다.
   */
  it.each([500, 503, 429, 408])(
    '%i 이 계약 오류 봉투로 와도 거부가 아니다 — 담긴 것을 큐에 남긴다',
    (status) => {
      const enveloped = new ApiRequestError(
        normalizeApiError(status, {
          errors: [{ scope: 'screen', code: 'UNAVAILABLE', message: '잠시 뒤 다시' }],
        }),
      );

      expect(isRejected(enveloped)).toBe(false);
    },
  );

  it('400 이 계약 오류 봉투로 오면 그대로 거부다 — 기다려도 풀리지 않는다', () => {
    const enveloped = new ApiRequestError(
      normalizeApiError(400, {
        errors: [{ scope: 'field', field: 'quantity', code: 'REQUIRED', message: '필수' }],
      }),
    );

    expect(isRejected(enveloped)).toBe(true);
  });
});

describe('retryDelayOf — 기다림은 늘리되 상한을 둔다', () => {
  it('시도마다 두 배로 늘린다', () => {
    expect(retryDelayOf(1)).toBe(5_000);
    expect(retryDelayOf(2)).toBe(10_000);
    expect(retryDelayOf(3)).toBe(20_000);
  });

  it('아무리 늘어도 1분을 넘지 않는다', () => {
    expect(retryDelayOf(10)).toBe(60_000);
    expect(retryDelayOf(100)).toBe(60_000);
  });

  /* 상한에 닿기까지의 총 대기가 몇 분 단위로 벌어지지 않게 한다 — 너무 길면 「멈췄다」는 말이 늦다. */
  it('상한에 닿기까지의 총 대기가 3분을 넘지 않는다', () => {
    let total = 0;
    for (let tried = 1; tried < MAX_AUTO_ATTEMPTS; tried += 1) total += retryDelayOf(tried);

    expect(total).toBeLessThanOrEqual(180_000);
  });
});
