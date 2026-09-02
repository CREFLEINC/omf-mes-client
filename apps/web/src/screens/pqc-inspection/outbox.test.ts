import { describe, expect, it } from 'vitest';

import { NETWORK_ERROR } from '@omf-mes/api-client';

import { ApiRequestError } from '../../patterns/request';

import { isRejected, isSendableEntry } from './outbox';

/**
 * 이 큐가 지키는 것은 **되돌릴 수 없는 쓰기**다. 화면 시험이 「끊긴 채 저장」과 「새로고침을
 * 넘는 멱등 키」를 덮으므로, 여기서는 화면을 세우지 않고 **갈래 판정** 둘을 직접 겨눈다.
 */

describe('isRejected — 기다리면 풀리는가, 아닌가', () => {
  /*
   * ⭐ **이 판정이 큐의 심장이다.** 통신 실패를 거부로 오판하면 **기록이 조용히 사라지고**,
   * 거부를 통신 실패로 오판하면 큐가 영원히 비지 않아 그 뒤에 쌓인 정상 건까지 막힌다.
   */
  /*
   * ⚠ **날것의 `TypeError` 를 넣어 보지 않는다.** 큐가 실제로 받는 값은 `runRequest` 가
   * 정규화한 것이라, 응답이 없는 실패는 언제나 이 모양으로 온다 — 날것으로 시험하면 통과해도
   * 실제 경로를 지키지 못한다.
   */
  it('통신이 끊긴 것은 거부가 아니다 — 기다리면 풀린다', () => {
    expect(isRejected(new ApiRequestError(NETWORK_ERROR))).toBe(false);
  });

  it('서버가 값을 되돌린 것은 거부다 — 기다려도 풀리지 않는다', () => {
    const rejection = new ApiRequestError({
      kind: 'validation',
      errors: [{ scope: 'field', field: 'acceptedQty', code: 'RANGE', message: '범위를 벗어났다' }],
    });

    expect(isRejected(rejection)).toBe(true);
  });

  it('권한 거부도 거부다 — 다시 보내도 같은 답이 온다', () => {
    expect(isRejected(new ApiRequestError({ kind: 'http', status: 403 }))).toBe(true);
  });

  /*
   * ⚠ **요청 경로 «밖»에서 생긴 예외는 거부로 다룬다.** `toApiError` 가 그런 값을
   * `network` 로 접지 않기 때문이다(연결 문제로 오인시키면 사용자가 할 수 없는 조치를 한다).
   *
   * ⭐ 그래서 큐에서 내려가는데, **조용히 사라지지는 않는다** — 화면이 거부를 배너로 올리고
   * 「저장했습니다」를 거둔다. 무한 재시도로 큐를 막는 것보다 이쪽이 낫다.
   */
  it('요청 경로 밖의 예외는 거부로 다룬다 — 재시도로 큐를 막지 않는다', () => {
    expect(isRejected(new Error('알 수 없음'))).toBe(true);
  });
});

describe('isSendableEntry — 저장소에서 읽은 값을 믿지 않는다', () => {
  const body = {
    inspectionRequestId: 1001,
    inspectedQty: 30,
    acceptedQty: 28,
    rejectedQty: 2,
    heldQty: 0,
    uomId: 10,
    inspectedAt: '2026-09-02T10:00:00+09:00',
    statusCode: '작성중',
  };

  it('계약이 필수로 둔 것이 갖춰지면 보낼 수 있다', () => {
    expect(isSendableEntry({ idempotencyKey: 'k-1', body })).toBe(true);
  });

  /* ⛔ 키가 없으면 재전송이 **새 검사 결과**가 된다 — 보내지 않는 편이 낫다. */
  it('멱등 키가 없으면 보내지 않는다', () => {
    expect(isSendableEntry({ body })).toBe(false);
    expect(isSendableEntry({ idempotencyKey: '', body })).toBe(false);
  });

  it('본문이 없거나 객체가 아니면 보내지 않는다', () => {
    expect(isSendableEntry({ idempotencyKey: 'k-1' })).toBe(false);
    expect(isSendableEntry({ idempotencyKey: 'k-1', body: 'x' })).toBe(false);
  });

  /* 수량이 문자열로 굳어 있는 판이 저장소에 남아 있을 수 있다 — 그대로 보내면 서버가
   * 무엇을 기록할지 화면이 알 수 없다. */
  it('수량이 수치가 아니면 보내지 않는다', () => {
    expect(isSendableEntry({ idempotencyKey: 'k-1', body: { ...body, acceptedQty: '28' } })).toBe(
      false,
    );
  });

  it('검사 시각이 없으면 보내지 않는다 — 언제 잰 것인지 모르는 판정은 기록이 아니다', () => {
    const { inspectedAt: _dropped, ...withoutTime } = body;

    expect(isSendableEntry({ idempotencyKey: 'k-1', body: withoutTime })).toBe(false);
  });

  it('객체가 아닌 것은 전부 걸러 낸다', () => {
    expect(isSendableEntry(null)).toBe(false);
    expect(isSendableEntry('k-1')).toBe(false);
    expect(isSendableEntry(undefined)).toBe(false);
  });
});
