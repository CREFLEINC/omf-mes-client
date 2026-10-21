import { createApiClient } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

import { jsonResponse } from '../../../test/api-harness';
import type { ProductionPlanEditorStateRow } from '../../production-plan/editor-state';
import { deletePlan, runPlanStep } from './plan-runner';

const plan = (id: number, statusCode = 'DRAFT', versionNo = 4) => ({
  productionPlanId: id,
  productionOrderId: 701,
  planNo: `PP-${String(id)}`,
  planDate: '2026-10-21',
  plannedQty: 300,
  uomId: 1,
  bomId: 11,
  routingId: 21,
  plannedLineId: 2,
  statusCode,
  versionNo,
});

const baseRow = (
  overrides: Partial<ProductionPlanEditorStateRow>,
): ProductionPlanEditorStateRow => ({
  key: 'plan-501',
  displayNo: 1,
  planNo: 'PP-501',
  statusCode: 'DRAFT',
  confirmed: false,
  isPending: false,
  isDirty: false,
  productionPlanId: 501,
  versionNo: 3,
  baseline: {
    planDate: '2026-10-21',
    plannedQty: 300,
    bomId: 11,
    routingId: 21,
    plannedLineId: null,
    remarks: null,
  },
  draft: {
    planDate: '2026-10-21',
    plannedQty: '300',
    bomId: '11',
    routingId: '21',
    plannedLineId: '2',
    remarks: '',
  },
  errors: {},
  ...overrides,
});

interface Call {
  method: string;
  path: string;
  ifMatch: string | null;
}

/** 서버 판이 `serverVersion`인 계획 501. If-Match가 다르면 409(충돌)로 돌려준다. */
const stubServer = (serverVersion: number) => {
  const calls: Call[] = [];
  let version = serverVersion;
  const client = createApiClient({
    baseUrl: 'http://api.test',
    fetch: async (request) => {
      const url = new URL(request.url);
      const ifMatch = request.headers.get('If-Match');
      calls.push({ method: request.method, path: url.pathname, ifMatch });
      if (ifMatch !== String(version)) {
        return jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 });
      }
      version += 1;
      if (request.method === 'PUT') return jsonResponse(plan(501, 'DRAFT', version));
      if (request.method === 'POST' && url.pathname.endsWith(':confirm'))
        return jsonResponse(plan(501, 'CONFIRMED', version));
      if (request.method === 'DELETE') return new Response(null, { status: 204 });
      throw new Error(`unexpected ${request.method} ${url.pathname}`);
    },
  }).client;
  return { client, calls };
};

describe('생산계획 단계 저장과 전개 확정(T-W-C 중간 단계의 확정)', () => {
  it('바뀐 줄을 불러온 시점의 판으로 저장하고, 확정은 저장 응답의 판으로 보낸다', async () => {
    const { client, calls } = stubServer(3);

    const result = await runPlanStep(
      client,
      [baseRow({ isDirty: true })],
      { productionOrderId: 701, uomId: 1 },
      true,
    );

    expect(result.failures).toEqual([]);
    expect(result.confirmed).toBe(1);
    expect(calls).toEqual([
      { method: 'PUT', path: '/planning/production-plans/501', ifMatch: '3' },
      { method: 'POST', path: '/planning/production-plans/501:confirm', ifMatch: '4' },
    ]);
  });

  it('불러온 뒤 서버 계획이 바뀌었으면 409를 실패로 돌려주고 덮어쓰지도 확정하지도 않는다', async () => {
    const { client, calls } = stubServer(5);

    const result = await runPlanStep(
      client,
      [baseRow({ isDirty: true })],
      { productionOrderId: 701, uomId: 1 },
      true,
    );

    expect(result.confirmed).toBe(0);
    expect(result.saved).toEqual([]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.error?.kind).toBe('conflict');
    expect(calls).toEqual([
      { method: 'PUT', path: '/planning/production-plans/501', ifMatch: '3' },
    ]);
  });

  it('고치지 않은 줄의 확정도 불러온 판으로 보내 바뀐 계획을 확정하지 않는다', async () => {
    const { client } = stubServer(5);

    const result = await runPlanStep(
      client,
      [baseRow({})],
      { productionOrderId: 701, uomId: 1 },
      true,
    );

    expect(result.confirmed).toBe(0);
    expect(result.failures[0]?.error?.kind).toBe('conflict');
  });

  it('판을 모르는 줄은 빈 If-Match를 보내지 않고 다시 불러오기를 안내한다', async () => {
    const { client, calls } = stubServer(3);

    const result = await runPlanStep(
      client,
      [baseRow({ isDirty: true, versionNo: null })],
      { productionOrderId: 701, uomId: 1 },
      false,
    );

    expect(calls).toEqual([]);
    expect(result.failures[0]?.error?.kind).toBe('validation');
  });

  it('삭제도 불러온 판으로 잠근다. 판이 다르면 409, 판이 없으면 보내지 않는다', async () => {
    const stale = stubServer(5);
    expect((await deletePlan(stale.client, 501, 3))?.kind).toBe('conflict');

    const fresh = stubServer(3);
    expect(await deletePlan(fresh.client, 501, 3)).toBeNull();

    const unknown = stubServer(3);
    expect((await deletePlan(unknown.client, 501, null))?.kind).toBe('validation');
    expect(unknown.calls).toEqual([]);
  });

  it('잘못된 줄이 있으면 아무것도 확정하지 않는다', async () => {
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetch: async () => {
        throw new Error('보내면 안 된다');
      },
    }).client;
    const row = baseRow({
      productionPlanId: null,
      baseline: null,
      planNo: null,
      draft: {
        planDate: '',
        plannedQty: '300',
        bomId: '11',
        routingId: '21',
        plannedLineId: '2',
        remarks: '',
      },
    });

    const result = await runPlanStep(client, [row], { productionOrderId: 701, uomId: 1 }, true);

    expect(result.confirmed).toBe(0);
    expect(result.failures[0]?.errors.planDate).toBeDefined();
  });
});
