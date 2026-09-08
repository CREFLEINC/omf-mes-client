import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { createApiClient } from '@omf-mes/api-client';

import {
  confirmPacking,
  createHandlingUnit,
  keptCreateKey,
  keptPackingAttempt,
  useHandlingUnitCreate,
  usePackingConfirm,
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

const CONFIRMED_AT = new Date('2026-08-12T10:22:00+09:00');

const input = (overrides: Partial<ConfirmPackingInput> = {}): ConfirmPackingInput => {
  const base: ConfirmPackingInput = {
    handlingUnit: OPEN_UNIT,
    lines: [line()],
    workerNo: '3391',
    attempt: keptPackingAttempt(null, { handlingUnit: OPEN_UNIT, lines: [line()] }, CONFIRMED_AT),
    ...overrides,
  };

  return overrides.lines === undefined
    ? base
    : {
        ...base,
        attempt: keptPackingAttempt(
          null,
          { handlingUnit: base.handlingUnit, lines: base.lines },
          CONFIRMED_AT,
        ),
        ...overrides,
      };
};

const createInput = (
  overrides: Partial<CreateHandlingUnitInput> = {},
): CreateHandlingUnitInput => ({
  handlingUnitTypeCode: 'CARTON',
  parentHandlingUnitId: null,
  warehouseId: 1001,
  workerNo: '3391',
  idempotencyKey: 'SYN-KEY-CREATE',
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
): {
  calls: Recorded[];
  client: ReturnType<typeof createApiClient>;
  fetch: ReturnType<typeof createStubFetch>;
} => {
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

  const fetch = createStubFetch(routes);

  return { calls, fetch, client: createApiClient({ baseUrl: BASE_URL, fetch }) };
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

  it('두 요청 모두 사번을 싣고 멱등 키는 «단계마다 다르다»', async () => {
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

describe('멱등 키 — 재전송에도 갈리지 않는다', () => {
  it('같은 포장을 다시 확정하면 «같은 키»가 나간다 — 통신이 끊긴 뒤 다시 눌러도 재시도로 읽힌다', async () => {
    const variables = { handlingUnit: OPEN_UNIT, lines: [line()] };
    const first = keptPackingAttempt(null, variables, new Date('2026-08-12T10:22:00+09:00'));
    const second = keptPackingAttempt(first, variables, new Date('2026-08-12T10:22:40+09:00'));

    const failed = harness({ pack: 503 });
    await expect(
      confirmPacking(failed.client.client, { ...input(), attempt: first }),
    ).rejects.toThrow();

    const retried = harness();
    await confirmPacking(retried.client.client, { ...input(), attempt: second });

    expect(retried.calls[0]?.headers.get('Idempotency-Key')).toBe(
      failed.calls[0]?.headers.get('Idempotency-Key'),
    );
  });

  it('본문도 «그대로» 다시 나간다 — 발생 시각이 갈리면 서버가 다른 쓰기로 본다', () => {
    const variables = { handlingUnit: OPEN_UNIT, lines: [line()] };
    const first = keptPackingAttempt(null, variables, new Date('2026-08-12T10:22:00+09:00'));
    const second = keptPackingAttempt(first, variables, new Date('2026-08-12T10:22:40+09:00'));

    expect(second.now).toBe(first.now);
  });

  it('담은 것이 달라지면 «새 키»를 준다 — 줄을 더하고 누른 것은 다른 쓰기다', () => {
    const first = keptPackingAttempt(
      null,
      { handlingUnit: OPEN_UNIT, lines: [line()] },
      new Date('2026-08-12T10:22:00+09:00'),
    );
    const second = keptPackingAttempt(
      first,
      { handlingUnit: OPEN_UNIT, lines: [line(), line({ shipmentLotAllocationId: 9002 })] },
      new Date('2026-08-12T10:23:00+09:00'),
    );

    expect(second.packKey).not.toBe(first.packKey);
  });

  it('수량만 고쳐 다시 눌러도 «새 키»다 — 담은 양이 달라졌으면 다른 쓰기다', () => {
    const first = keptPackingAttempt(
      null,
      { handlingUnit: OPEN_UNIT, lines: [line({ qty: 120 })] },
      new Date('2026-08-12T10:22:00+09:00'),
    );
    const second = keptPackingAttempt(
      first,
      { handlingUnit: OPEN_UNIT, lines: [line({ qty: 60 })] },
      new Date('2026-08-12T10:23:00+09:00'),
    );

    expect(second.packKey).not.toBe(first.packKey);
    expect(second.linkKeys[9001]).not.toBe(first.linkKeys[9001]);
  });

  it('배분 연결 키는 줄마다 따로이면서 재전송에는 그대로다', () => {
    const variables = {
      handlingUnit: OPEN_UNIT,
      lines: [line(), line({ shipmentLotAllocationId: 9002 })],
    };
    const first = keptPackingAttempt(null, variables, new Date('2026-08-12T10:22:00+09:00'));
    const second = keptPackingAttempt(first, variables, new Date('2026-08-12T10:22:40+09:00'));

    expect(first.linkKeys[9001]).not.toBe(first.linkKeys[9002]);
    expect(second.linkKeys[9001]).toBe(first.linkKeys[9001]);
  });

  it('취급 단위 생성도 다시 눌러 같은 키로 나간다 — 되돌릴 수 없는 빈 포장이 두 벌 생기지 않는다', () => {
    const variables = {
      handlingUnitTypeCode: 'CARTON',
      parentHandlingUnitId: null,
      warehouseId: 1001,
    };
    const first = keptCreateKey(null, variables);
    const second = keptCreateKey(first, variables);
    const other = keptCreateKey(first, { ...variables, handlingUnitTypeCode: 'PALLET' });

    expect(second.key).toBe(first.key);
    expect(other.key).not.toBe(first.key);
  });

  it('생성 요청은 받은 키를 그대로 싣는다', async () => {
    const { calls, client } = harness();

    await createHandlingUnit(client.client, createInput({ idempotencyKey: 'SYN-KEY-42' }));

    expect(calls[0]?.headers.get('Idempotency-Key')).toBe('SYN-KEY-42');
  });
});

describe('멱등 키의 수명 — 서버에 «닿으면» 버린다', () => {
  it('포장 하나를 끝내고 «같은 유형으로» 다음 포장을 시작하면 새 키로 나간다', async () => {
    const { calls, fetch: stub } = harness();
    const variables = {
      handlingUnitTypeCode: 'CARTON',
      parentHandlingUnitId: null,
      warehouseId: 1001,
      workerNo: '3391',
    };

    const { result } = renderHookWithProviders(() => useHandlingUnitCreate(), { fetch: stub });

    await result.current.mutateAsync(variables);
    await result.current.mutateAsync(variables);

    /*
     * ⛔ 앞 포장의 키가 남아 있으면 서버가 재시도로 보고 **이미 닫힌 포장을 돌려준다** —
     * 다음 물건이 그 포장에 담기고, 이 화면에는 되돌릴 조작이 없다(§5-6).
     */
    expect(calls[1]?.headers.get('Idempotency-Key')).not.toBe(
      calls[0]?.headers.get('Idempotency-Key'),
    );
  });

  it('확정이 서버에 닿으면 다음 확정은 새 키로 나간다', async () => {
    const { calls, fetch: stub } = harness();
    const variables = { handlingUnit: OPEN_UNIT, lines: [line()], workerNo: '3391' };

    const { result } = renderHookWithProviders(
      () => usePackingConfirm({ shipmentId: 7001, onSuccess: () => undefined }),
      { fetch: stub },
    );

    await result.current.mutateAsync(variables);
    await result.current.mutateAsync(variables);

    const packKeys = calls
      .filter((call) => call.path.endsWith(':pack'))
      .map((call) => call.headers.get('Idempotency-Key'));

    expect(packKeys).toHaveLength(2);
    expect(packKeys[1]).not.toBe(packKeys[0]);
  });
});
