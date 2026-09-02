import { NETWORK_ERROR } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

import { ApiRequestError } from '../../patterns/request';
import { isRejected, isSendableEntry } from './outbox';

/**
 * 이 큐가 지키는 것은 **되돌릴 수 없는 쓰기**다 — 실적은 정정 실적을 새로 만들어야 지워진다.
 * 여기서는 화면을 세우지 않고 **갈래 판정** 둘을 직접 겨눈다.
 */

describe('isRejected — 기다리면 풀리는가, 아닌가', () => {
  /*
   * ⭐ **이 판정이 큐의 심장이다.** 통신 실패를 거부로 오판하면 **실적이 조용히 사라지고**,
   * 거부를 통신 실패로 오판하면 큐가 영원히 비지 않아 그 뒤에 쌓인 정상 건까지 막힌다.
   */
  it('통신이 끊긴 것은 거부가 아니다 — 기다리면 풀린다', () => {
    expect(isRejected(new ApiRequestError(NETWORK_ERROR))).toBe(false);
  });

  it('서버가 값을 되돌린 것은 거부다 — 기다려도 풀리지 않는다', () => {
    const rejection = new ApiRequestError({
      kind: 'validation',
      errors: [{ scope: 'field', field: 'goodQty', code: 'RANGE', message: '범위를 벗어났다' }],
    });

    expect(isRejected(rejection)).toBe(true);
  });

  it('단말 게이팅 거부(403)도 거부다 — 다시 보내도 같은 답이 온다', () => {
    expect(isRejected(new ApiRequestError({ kind: 'http', status: 403 }))).toBe(true);
  });

  it('요청 경로 밖의 예외는 거부로 다룬다 — 재시도로 큐를 막지 않는다', () => {
    expect(isRejected(new Error('알 수 없음'))).toBe(true);
  });
});

describe('isSendableEntry — 저장소에서 읽은 값을 믿지 않는다', () => {
  const body = {
    workOrderId: 1001,
    goodQty: 120,
    uomId: 10,
    resultSourceCode: 'MANUAL',
    occurredAt: '2026-09-02T09:12:00+09:00',
  };

  const entry = { idempotencyKey: 'key-1', workerNo: '900123', body };

  it('갖출 것을 갖춘 항목은 보낼 수 있다', () => {
    expect(isSendableEntry(entry)).toBe(true);
  });

  it('멱등 키가 비면 보내지 않는다 — 재전송이 새 실적이 된다', () => {
    expect(isSendableEntry({ ...entry, idempotencyKey: '' })).toBe(false);
  });

  /*
   * ⭐ **사번은 헤더로만 나가므로 본문 검사로는 걸러지지 않는다.** 없으면 서버가 그대로
   * 거부하고, 그 거부는 화면이 이미 성공을 말한 뒤에 온다.
   */
  it('사번이 없으면 보내지 않는다 — 없으면 서버가 거부한다', () => {
    expect(isSendableEntry({ idempotencyKey: 'key-1', body })).toBe(false);
    expect(isSendableEntry({ ...entry, workerNo: '' })).toBe(false);
  });

  it('계약이 필수로 둔 칸이 빠지면 보내지 않는다', () => {
    const required = ['workOrderId', 'goodQty', 'uomId', 'resultSourceCode', 'occurredAt'];

    for (const field of required) {
      const broken: Record<string, unknown> = { ...body };
      delete broken[field];

      expect(isSendableEntry({ ...entry, body: broken })).toBe(false);
    }
  });

  it('객체가 아닌 값은 보내지 않는다', () => {
    expect(isSendableEntry(null)).toBe(false);
    expect(isSendableEntry('key-1')).toBe(false);
    expect(isSendableEntry({ ...entry, body: null })).toBe(false);
  });
});
