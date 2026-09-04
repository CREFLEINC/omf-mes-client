import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, type StubRoute } from '../../test/api-harness';
import { createApiClient } from '@omf-mes/api-client';

import {
  confirmPacking,
  createHandlingUnit,
  type ConfirmPackingInput,
  type CreateHandlingUnitInput,
} from './mutations';
import type { PackedLine } from './types';

const BASE_URL = 'http://api.test';

const line = (overrides: Partial<PackedLine> = {}): PackedLine => ({
  shipmentLotAllocationId: 9001,
  itemId: 5001,
  itemCode: 'SYN-FG-1001',
  lotId: 8001,
  lotNo: 'SYN-LOT-000123450',
  uomId: 920001,
  qty: 120,
  remaining: 180,
  ...overrides,
});

const OPEN_UNIT = { handlingUnitId: 4001, handlingUnitNo: 'SYN-CTN-0091', etag: '"7"' };

const input = (overrides: Partial<ConfirmPackingInput> = {}): ConfirmPackingInput => ({
  handlingUnit: OPEN_UNIT,
  lines: [line()],
  workerNo: '3391',
  now: new Date('2026-08-12T10:22:00+09:00'),
  ...overrides,
});

const createInput = (
  overrides: Partial<CreateHandlingUnitInput> = {},
): CreateHandlingUnitInput => ({
  handlingUnitTypeCode: 'CARTON',
  parentHandlingUnitId: null,
  warehouseId: 1001,
  workerNo: '3391',
  ...overrides,
});

const handlingUnitBody = {
  handlingUnit: {
    handlingUnitId: 4001,
    handlingUnitNo: 'SYN-CTN-0091',
    handlingUnitTypeCode: 'CARTON',
    statusCode: 'SYN-OPEN',
  },
  contents: [],
};

const pathOf = (request: Request): string => new URL(request.url).pathname;

interface Recorded {
  method: string;
  path: string;
  headers: Headers;
  body: unknown;
}

/** 세 단계를 모두 받아 «순서대로» 담는다. 실패를 넣고 싶으면 상태 코드를 준다. */
const harness = (
  statuses: { create?: number; pack?: number; link?: number } = {},
): { calls: Recorded[]; client: ReturnType<typeof createApiClient> } => {
  const calls: Recorded[] = [];

  const record = async (request: Request): Promise<void> => {
    calls.push({
      method: request.method,
      path: pathOf(request),
      headers: request.headers,
      body: request.body === null ? null : await request.clone().json(),
    });
  };

  const routes: StubRoute[] = [
    {
      match: (request) =>
        request.method === 'POST' && pathOf(request) === '/inventory/handling-units',
      respond: (request) => {
        void record(request);

        return jsonResponse(handlingUnitBody, {
          status: statuses.create ?? 201,
          headers: { ETag: '"7"' },
        });
      },
    },
    {
      match: (request) => pathOf(request) === '/inventory/handling-units/4001:pack',
      respond: (request) => {
        void record(request);

        return jsonResponse(handlingUnitBody, { status: statuses.pack ?? 200 });
      },
    },
    {
      match: (request) => pathOf(request).startsWith('/logistics/shipment-lot-allocations/'),
      respond: (request) => {
        void record(request);

        return jsonResponse({ shipmentLotAllocationId: 9001 }, { status: statuses.link ?? 200 });
      },
    },
  ];

  return {
    calls,
    client: createApiClient({ baseUrl: BASE_URL, fetch: createStubFetch(routes) }),
  };
};

describe('createHandlingUnit', () => {
  it('번호와 낙관적 잠금 토큰을 돌려준다 — 번호는 ③ 구획이, 토큰은 확정이 쓴다', async () => {
    const { calls, client } = harness();

    const unit = await createHandlingUnit(client.client, createInput());

    expect(unit).toEqual({ handlingUnitId: 4001, handlingUnitNo: 'SYN-CTN-0091', etag: '"7"' });
    expect(calls).toHaveLength(1);
  });

  it('취급 단위 생성 본문에 창고를 «반드시» 싣는다 — 비우면 포장이 어디 있는지 사라진다', async () => {
    const { calls, client } = harness();

    await createHandlingUnit(client.client, createInput({ parentHandlingUnitId: 4000 }));

    expect(calls[0]?.body).toEqual({
      handlingUnitTypeCode: 'CARTON',
      parentHandlingUnitId: 4000,
      warehouseId: 1001,
    });
  });

  it('상위 포장을 고르지 않으면 그 칸을 «보내지 않는다» — 비어 있음과 없음은 다르다', async () => {
    const { calls, client } = harness();

    await createHandlingUnit(client.client, createInput());

    expect(calls[0]?.body).not.toHaveProperty('parentHandlingUnitId');
  });
});

describe('confirmPacking', () => {
  it('두 단계를 «순서대로» 부른다 — 포장 확정 → 배분 연결', async () => {
    const { calls, client } = harness();

    await confirmPacking(client.client, input());

    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      'POST /inventory/handling-units/4001:pack',
      'PUT /logistics/shipment-lot-allocations/9001',
    ]);
  });

  it('⛔ 확정 시점에 취급 단위를 «다시 만들지 않는다» — 담는 동안 이미 만들어 두었다', async () => {
    const { calls, client } = harness();

    await confirmPacking(client.client, input());

    expect(calls.some((call) => call.path === '/inventory/handling-units')).toBe(false);
  });

  it('포장 확정이 실패하면 배분을 잇지 않는다', async () => {
    const { calls, client } = harness({ pack: 409 });

    await expect(confirmPacking(client.client, input())).rejects.toThrow();
    expect(calls.map((call) => call.path)).toEqual(['/inventory/handling-units/4001:pack']);
  });

  it('포장 확정에 만들 때 받은 ETag 를 If-Match 로 싣는다 — 잠그는 단위가 취급 단위다', async () => {
    const { calls, client } = harness();

    await confirmPacking(client.client, input());

    expect(calls[0]?.headers.get('If-Match')).toBe('"7"');
  });

  it('세 요청 모두 사번을 싣고 멱등 키는 «단계마다 다르다»', async () => {
    const { calls, client } = harness();

    await confirmPacking(client.client, input());

    for (const call of calls) {
      expect(call.headers.get('X-Worker-No')).toBe('3391');
      expect(call.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/i);
    }

    const keys = new Set(calls.map((call) => call.headers.get('Idempotency-Key')));
    expect(keys.size).toBe(calls.length);
  });

  it('포장 본문에 담긴 것과 «언제 일어난 일인가»가 함께 실린다', async () => {
    const { calls, client } = harness();

    await confirmPacking(client.client, input());

    expect(calls[0]?.body).toMatchObject({
      contents: [{ itemId: 5001, lotId: 8001, qty: 120, uomId: 920001 }],
      businessDate: '2026-08-12',
    });
    expect((calls[0]?.body as { occurredAt: string }).occurredAt).toBe(
      new Date('2026-08-12T10:22:00+09:00').toISOString(),
    );
  });

  it('담긴 줄마다 배분을 잇는다 — 한 줄이라도 빠지면 그 LOT 은 포장에 매이지 않는다', async () => {
    const { calls, client } = harness();

    await confirmPacking(
      client.client,
      input({ lines: [line(), line({ shipmentLotAllocationId: 9002, lotId: 8002 })] }),
    );

    expect(calls.filter((call) => call.method === 'PUT').map((call) => call.path)).toEqual([
      '/logistics/shipment-lot-allocations/9001',
      '/logistics/shipment-lot-allocations/9002',
    ]);
  });
});
