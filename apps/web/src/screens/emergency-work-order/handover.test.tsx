import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderHookWithProviders, type StubFetch } from '../../test/api-harness';
import { type HandoverTarget, toHandoverTarget, useHandoverRelease } from './handover';
import type { WorkOrder } from './types';
import { EMERGENCY_WORK_ORDER_TYPE_CODE } from './work-order-type';

const DETAIL_PATH = '/production/work-orders/7001';
const RELEASE_PATH = '/production/work-orders/7001:release';
const ETAG = 'W/"3"';

const TARGET: HandoverTarget = { workOrderId: 7001, workOrderNo: 'SYN-WO-0007', orderQty: 200 };

interface Call {
  method: string;
  path: string;
  idempotencyKey: string | null;
  ifMatch: string | null;
  body: unknown;
}

interface StubOptions {
  failDetail?: boolean;
  failRelease?: boolean;
}

const contractError = (status: number): Response =>
  jsonResponse(
    { errors: [{ scope: 'screen', code: 'SYN_CODE', message: '서버 문구' }] },
    { status },
  );

const stub = (options: StubOptions = {}): { calls: Call[]; fetch: StubFetch } => {
  const calls: Call[] = [];

  const fetch: StubFetch = async (request) => {
    const path = new URL(request.url).pathname;
    const body =
      request.method === 'POST'
        ? await request
            .clone()
            .json()
            .catch(() => undefined)
        : undefined;

    calls.push({
      method: request.method,
      path,
      idempotencyKey: request.headers.get('Idempotency-Key'),
      ifMatch: request.headers.get('If-Match'),
      body,
    });

    if (path.endsWith(':release')) {
      return options.failRelease === true
        ? contractError(500)
        : jsonResponse({ workOrderId: 7001, workOrderNo: 'SYN-WO-0007' });
    }

    if (options.failDetail === true) return contractError(500);

    return jsonResponse({ workOrderId: 7001 }, { headers: { ETag: ETAG } });
  };

  return { calls, fetch };
};

const releaseAndSettle = async (
  stubbed: { fetch: StubFetch },
  target: HandoverTarget = TARGET,
  times = 1,
) => {
  const { result } = renderHookWithProviders(() => useHandoverRelease(), { fetch: stubbed.fetch });

  act(() => {
    for (let attempt = 0; attempt < times; attempt += 1) result.current.release(target);
  });
  await waitFor(() => {
    expect(result.current.releasingId).toBeNull();
  });

  return result;
};

describe('toHandoverTarget', () => {
  it('목록의 한 줄에서 배포에 필요한 것만 꺼낸다', () => {
    const workOrder = {
      workOrderId: 7001,
      workOrderNo: 'SYN-WO-0007',
      productionPlanId: 3001,
      routingOperationId: 901,
      itemId: 5001,
      orderQty: 200,
      uomId: 11,
      workOrderTypeCode: EMERGENCY_WORK_ORDER_TYPE_CODE,
      statusCode: 'SYN_CONFIRMED',
      priorityNo: 1,
    } satisfies WorkOrder;

    expect(toHandoverTarget(workOrder)).toEqual(TARGET);
  });
});

describe('useHandoverRelease', () => {
  /*
   * ⚠ **토큰을 들고 있지 않다.** 이 W/O 가 만들어진 순간을 이 화면은 보지 못했다 — 다른
   * 사람이, 다른 단말에서, 혹은 새로고침 전에 만들었다. 그래서 상세로 얻는다.
   */
  it('⚠ 상세로 토큰을 얻고 배포한다 — 만들어진 순간을 보지 못한 W/O 다', async () => {
    const stubbed = stub();
    await releaseAndSettle(stubbed);

    expect(stubbed.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      `GET ${DETAIL_PATH}`,
      `POST ${RELEASE_PATH}`,
    ]);
    expect(stubbed.calls[1]?.ifMatch).toBe(ETAG);
  });

  /*
   * ⛔ **LOT 크기는 지시수량 전량이다.** 이 화면에는 그것을 받을 칸이 없고, 비우고 서버
   * 기본값에 맡기지도 않는다 — 원천 없는 기본값이라 이미 한 번 걷어낸 자리다.
   */
  it('⛔ 지시수량 전량을 한 슬롯으로 보낸다 — 값을 비우거나 지어내지 않는다', async () => {
    const stubbed = stub();
    await releaseAndSettle(stubbed);

    expect(stubbed.calls[1]?.body).toEqual({ lotSize: 200 });
  });

  it('배포까지 가면 그 번호를 알린다', async () => {
    const result = await releaseAndSettle(stub());

    expect(result.current.releasedNo).toBe('SYN-WO-0007');
    expect(result.current.failure).toBeNull();
  });

  /*
   * ⛔ **되돌릴 수 없는 쓰기의 마지막 문.** 같은 틱에 두 번 눌러도, 여러 줄을 잇따라 눌러도
   * 나가는 요청은 하나다.
   */
  it('⛔ 같은 틱에 두 번 눌러도 한 번만 나간다', async () => {
    const stubbed = stub();
    await releaseAndSettle(stubbed, TARGET, 2);

    expect(stubbed.calls.filter((call) => call.path.endsWith(':release'))).toHaveLength(1);
  });

  /*
   * ⭐ **어디서 멈췄는지가 사용자에게 하는 말을 가른다.** 보내지도 못한 것은 단언해도 되지만,
   * 보냈는데 답을 못 받은 것을 「안 됐다」고 말하면 거짓일 수 있다 — 실제로 배포됐는데
   * 사용자가 다시 눌러 이중 배포를 시도하게 된다.
   */
  it('⛔ 토큰을 못 얻으면 «보내지 못함» 이다 — 단언해도 되는 자리', async () => {
    const result = await releaseAndSettle(stub({ failDetail: true }));

    expect(result.current.failure).toEqual({ workOrderNo: 'SYN-WO-0007', step: 'notSent' });
  });

  it('⛔ 보낸 뒤 실패하면 «불명» 이다 — 안 됐다고 단언하지 않는다', async () => {
    const result = await releaseAndSettle(stub({ failRelease: true }));

    expect(result.current.failure).toEqual({ workOrderNo: 'SYN-WO-0007', step: 'unknown' });
    expect(result.current.releasedNo).toBeNull();
  });

  it('⛔ 다시 시도해도 같은 키로 나간다 — 이중 배포가 열리지 않게', async () => {
    const stubbed = stub({ failRelease: true });
    const { result } = renderHookWithProviders(() => useHandoverRelease(), {
      fetch: stubbed.fetch,
    });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      act(() => {
        result.current.release(TARGET);
      });
      await waitFor(() => {
        expect(result.current.releasingId).toBeNull();
      });
    }

    const keys = stubbed.calls
      .filter((call) => call.path.endsWith(':release'))
      .map((call) => call.idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  /*
   * ⛔ **끝난 키로 다음 쓰기가 나가면 안 된다.** 서버는 계약대로 «끝난 키»에 대해 실행 없이
   * 앞 응답을 되돌려 주는데, 화면은 그것을 성공으로 읽는다 — **아무 일도 없었는데 배포됐다고
   * 단언**하게 된다. 실패했을 때 키를 유지하는 것과 성공했을 때 버리는 것은 짝이다.
   */
  it('⛔ 배포가 끝난 뒤에는 같은 W/O 라도 새 키로 나간다 — 끝난 키를 물려주지 않는다', async () => {
    const stubbed = stub();
    const { result } = renderHookWithProviders(() => useHandoverRelease(), {
      fetch: stubbed.fetch,
    });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      act(() => {
        result.current.release(TARGET);
      });
      await waitFor(() => {
        expect(result.current.releasedNo).toBe('SYN-WO-0007');
      });
    }

    const keys = stubbed.calls
      .filter((call) => call.path.endsWith(':release'))
      .map((call) => call.idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('⛔ 수량을 읽을 수 없으면 아무것도 보내지 않는다', async () => {
    const stubbed = stub();
    await releaseAndSettle(stubbed, { ...TARGET, orderQty: 0 });

    expect(stubbed.calls).toHaveLength(0);
  });
});
