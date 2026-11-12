import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderHookWithProviders, type StubFetch } from '../../test/api-harness';
import { planBulkCreate } from './bulk-create-plan';
import type { Location } from './types';
import { useBulkCreate } from './use-bulk-create';

const WAREHOUSE_ID = 1;

interface Call {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
  ifMatch: string | null;
}

const pathOf = (request: Request): string => new URL(request.url).pathname;

const created = (locationId: number, code: string, name = code): Location => ({
  locationId,
  warehouseId: WAREHOUSE_ID,
  parentLocationId: null,
  locationCode: code,
  locationName: name,
  isActive: true,
  aliasName: null,
  locationLevelCode: null,
  isLeaf: true,
  systemRoleCode: null,
  hasItemRestriction: false,
});

const stockLocked = () =>
  jsonResponse(
    {
      errors: [
        {
          scope: 'field',
          field: 'parentLocationId',
          code: 'STATE_LOCKED',
          message: '재고가 있는 위치 밑에는 위치를 둘 수 없습니다 — 재고를 먼저 옮깁니다.',
        },
      ],
    },
    { status: 400 },
  );

/**
 * 가짜 서버. 구역 POST 는 id 100, 101 … 을 주고 코드는 요청 이름 그대로(`rename` 이면 다른 코드), 랙은 `fail` 에 든 순번
 * (랙 호출 몇 번째인지, 0부터)이면 실패한다.
 */
const fakeServer = (
  options: {
    failRackCalls?: number[];
    failZoneCalls?: number[];
    renameZone?: Record<string, string>;
  } = {},
) => {
  const calls: Call[] = [];
  let nextId = 100;
  let rackCalls = 0;
  let zoneCalls = 0;
  const fetch = async (request: Request): Promise<Response> => {
    const body = request.method === 'GET' ? null : await request.clone().json();
    calls.push({
      method: request.method,
      path: pathOf(request),
      body,
      ifMatch: request.headers.get('If-Match'),
    });
    const path = pathOf(request);
    if (request.method === 'POST' && path === '/mdm/locations:rack') {
      const call = rackCalls;
      rackCalls += 1;
      if (options.failRackCalls?.includes(call)) return stockLocked();
      return jsonResponse(created(nextId++, 'R'), { status: 201 });
    }
    if (request.method === 'POST' && path === '/mdm/locations') {
      const name = String(body.locationName);
      if (body.parentLocationId === null) {
        const call = zoneCalls;
        zoneCalls += 1;
        if (options.failZoneCalls?.includes(call)) return jsonResponse({}, { status: 503 });
      }
      const code = options.renameZone?.[name] ?? name;
      return jsonResponse(created(nextId++, code, name), { status: 201 });
    }
    if (request.method === 'GET' && /^\/mdm\/locations\/\d+$/.test(path)) {
      const id = Number(path.split('/').pop());
      return jsonResponse(
        { location: created(id, 'X'), editability: { codeEditable: false, reason: 'EDITABLE' } },
        { headers: { ETag: '"5"' } },
      );
    }
    if (request.method === 'PUT') return jsonResponse({ location: created(1, 'X') });
    throw new Error(`스텁에 없는 요청: ${request.method} ${path}`);
  };
  return { fetch, calls };
};

const renderRun = (steps: ReturnType<typeof planBulkCreate>['steps'], fetch: StubFetch) => {
  const rendered = renderHookWithProviders(() => useBulkCreate(WAREHOUSE_ID), { fetch });
  const invalidate = vi.spyOn(rendered.queryClient, 'invalidateQueries');
  return { ...rendered, invalidate, steps };
};

const plan = (zones: number, racks: number, levels: number, cells: number) =>
  planBulkCreate(
    {
      mode: 'newZones',
      zoneCount: zones,
      racksPerZone: racks,
      levelsPerRack: levels,
      cellsPerLevel: cells,
    },
    [],
    new Set(),
  ).steps;

const posts = (calls: Call[]) => calls.filter((call) => call.method === 'POST');

describe('useBulkCreate', () => {
  it('US1-2 ⭐ 구역 → 그 구역의 랙 순서로 차례로 부르고, 끝나면 목록을 무효로 한다', async () => {
    const server = fakeServer();
    const { result, invalidate, steps } = renderRun(plan(2, 2, 4, 10), server.fetch);

    await act(() => result.current.run(steps));

    expect(posts(server.calls).map((call) => [call.path, call.body?.parentLocationId])).toEqual([
      ['/mdm/locations', null],
      ['/mdm/locations:rack', 100],
      ['/mdm/locations:rack', 100],
      ['/mdm/locations', null],
      ['/mdm/locations:rack', 103],
      ['/mdm/locations:rack', 103],
    ]);
    expect(posts(server.calls)[0]?.body).toEqual({
      warehouseId: WAREHOUSE_ID,
      parentLocationId: null,
      locationName: 'Z01',
      aliasName: null,
    });
    expect(posts(server.calls)[1]?.body).toEqual({
      parentLocationId: 100,
      levelCount: 4,
      cellCountPerLevel: 10,
    });
    expect(result.current.state).toEqual({ status: 'done' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['locations'] });
  });

  it('US1-4 층 0 이면 랙은 POST /mdm/locations(상위 = 구역, 이름 = 코드)', async () => {
    const server = fakeServer();
    const { result, steps } = renderRun(plan(1, 2, 0, 0), server.fetch);

    await act(() => result.current.run(steps));

    expect(posts(server.calls).map((call) => call.body)).toEqual([
      { warehouseId: WAREHOUSE_ID, parentLocationId: null, locationName: 'Z01', aliasName: null },
      {
        warehouseId: WAREHOUSE_ID,
        parentLocationId: 100,
        locationName: 'Z01-R001',
        aliasName: null,
      },
      {
        warehouseId: WAREHOUSE_ID,
        parentLocationId: 100,
        locationName: 'Z01-R002',
        aliasName: null,
      },
    ]);
    expect(server.calls.some((call) => call.method === 'PUT')).toBe(false);
  });

  it('US1-2 서버가 다른 코드를 붙이면(동시 생성) 이름을 그 코드로 PUT 한다(If-Match)', async () => {
    const server = fakeServer({ renameZone: { Z01: 'Z02' } });
    const { result, steps } = renderRun(plan(1, 1, 1, 1), server.fetch);

    await act(() => result.current.run(steps));

    const put = server.calls.find((call) => call.method === 'PUT');
    expect(put?.path).toBe('/mdm/locations/100');
    expect(put?.ifMatch).toBe('"5"');
    expect(put?.body).toEqual({ locationName: 'Z02', aliasName: null });
  });

  it('US1-7 ⭐ 랙이 실패해도 다음 단계를 계속하고, 다시 부르면 남은 것만 만든다', async () => {
    const server = fakeServer({ failRackCalls: [1] });
    const { result, steps } = renderRun(plan(1, 3, 1, 1), server.fetch);

    await act(() => result.current.run(steps));

    expect(posts(server.calls)).toHaveLength(4);
    expect(result.current.state).toEqual({
      status: 'partial',
      failures: [
        {
          code: 'Z01-R002',
          reason: '재고가 있는 위치 밑에는 위치를 둘 수 없습니다 — 재고를 먼저 옮깁니다.',
        },
      ],
      failedRacks: 1,
      /* 구역 1 + 랙 2 × (랙 · 층 · 셀 3) */
      created: 7,
    });

    server.calls.length = 0;
    await act(() => result.current.run(steps));

    /* 남은 랙 하나만 — 구역은 다시 만들지 않고 만든 구역 id 를 쓴다. */
    expect(posts(server.calls).map((call) => [call.path, call.body?.parentLocationId])).toEqual([
      ['/mdm/locations:rack', 100],
    ]);
    expect(result.current.state).toEqual({ status: 'done' });
  });

  it('US1-7 구역이 실패하면 그 구역의 랙은 건너뛰고 실패로 센다 — 다음 구역은 계속', async () => {
    const server = fakeServer({ failZoneCalls: [0] });
    const { result, steps } = renderRun(plan(2, 2, 1, 1), server.fetch);

    await act(() => result.current.run(steps));

    expect(posts(server.calls).map((call) => [call.path, call.body?.parentLocationId])).toEqual([
      ['/mdm/locations', null],
      ['/mdm/locations', null],
      ['/mdm/locations:rack', 100],
      ['/mdm/locations:rack', 100],
    ]);
    await waitFor(() => expect(result.current.state.status).toBe('partial'));
    expect(result.current.state).toMatchObject({
      failures: [{ code: 'Z01' }],
      failedRacks: 2,
      created: 7,
    });

    server.calls.length = 0;
    await act(() => result.current.run(steps));
    expect(posts(server.calls).map((call) => call.path)).toEqual([
      '/mdm/locations',
      '/mdm/locations:rack',
      '/mdm/locations:rack',
    ]);
  });

  it('US1-2 실행 중에는 진행(n/m)을 알린다', async () => {
    let release: (() => void) | undefined;
    const server = fakeServer();
    const gated = async (request: Request): Promise<Response> => {
      if (pathOf(request) === '/mdm/locations:rack') {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      return server.fetch(request);
    };
    const { result, steps } = renderRun(plan(1, 1, 1, 1), gated);

    let running: Promise<void> | undefined;
    act(() => {
      running = result.current.run(steps);
    });
    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'running', done: 1, total: 2 }),
    );
    release?.();
    await act(() => running!);
    expect(result.current.state).toEqual({ status: 'done' });
  });
});
