import { createApiClient, type components } from '@omf-mes/api-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse } from '../../test/api-harness';
import { drainReworkResults, enqueueReworkResult, pendingReworkResultCount } from './outbox';

/**
 * 이 큐가 지키는 것은 **되돌릴 수 없는 쓰기**다 — 재작업 실적은 정정 실적을 새로 만들어야
 * 지워진다.
 *
 * ⚠ 실패 판정 자체는 `patterns/outbox-policy.test.ts` 가 본다. 여기서는 **이 큐가 그 판정대로
 * 항목을 남기는가**만 겨눈다.
 */

const PATH = '/production/production-results';

const BODY: components['schemas']['ProductionResultCreate'] = {
  workOrderId: 1001,
  goodQty: 12,
  uomId: 1001,
  resultSourceCode: 'MANUAL' as const,
  occurredAt: '2026-09-03T09:12:00+09:00',
};

const clientWith = (status: number) =>
  createApiClient({
    baseUrl: 'http://api.test',
    fetch: createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === PATH,
        respond: () => jsonResponse({ message: '실패' }, { status }),
      },
    ]),
  }).client;

beforeEach(() => {
  globalThis.localStorage.clear();
});

afterEach(() => {
  globalThis.localStorage.clear();
});

describe('drainReworkResults — 기다리면 풀리는 실패에서 항목을 내리지 않는다', () => {
  /*
   * ⛔ **서버 재기동을 거부로 읽지 않는다.** 읽으면 항목이 큐에서 내려가는데, 화면은 이미
   * 성공을 말한 뒤라 작업자가 남긴 재작업 실적을 되돌릴 방법이 없다.
   */
  it('서버 오류(503)면 큐에 남는다', async () => {
    enqueueReworkResult('900123', BODY);

    await expect(drainReworkResults(clientWith(503))).rejects.toThrow();

    expect(pendingReworkResultCount()).toBe(1);
  });

  it('값이 틀렸다는 거부(409)면 그 건만 내린다 — 기다려도 같은 답이 온다', async () => {
    enqueueReworkResult('900123', BODY);

    const result = await drainReworkResults(clientWith(409));

    expect(result.rejected).toBe(1);
    expect(pendingReworkResultCount()).toBe(0);
  });
});
