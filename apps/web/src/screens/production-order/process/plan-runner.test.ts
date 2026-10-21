import { createApiClient } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

import { jsonResponse } from '../../../test/api-harness';
import type { ProductionPlanEditorStateRow } from '../../production-plan/editor-state';
import { runPlanStep } from './plan-runner';

const plan = (id: number, statusCode = 'DRAFT') => ({
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

describe('생산계획 단계 저장과 전개 확정(T-W-C 중간 단계의 확정)', () => {
  it('바뀐 줄을 최신 ETag로 저장한 뒤 확정한다. 행마다 따로 누르지 않는다', async () => {
    const calls: string[] = [];
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetch: async (request) => {
        const url = new URL(request.url);
        calls.push(
          `${request.method} ${url.pathname} ${request.headers.get('If-Match') ?? ''}`.trim(),
        );
        if (request.method === 'GET') return jsonResponse(plan(501), { headers: { ETag: '"v3"' } });
        if (request.method === 'PUT') return jsonResponse(plan(501));
        if (request.method === 'POST' && url.pathname.endsWith(':confirm'))
          return jsonResponse(plan(501, 'CONFIRMED'));
        throw new Error(`unexpected ${request.method} ${url.pathname}`);
      },
    }).client;

    const result = await runPlanStep(
      client,
      [baseRow({ isDirty: true })],
      { productionOrderId: 701, uomId: 1 },
      true,
    );

    expect(result.failures).toEqual([]);
    expect(result.confirmed).toBe(1);
    expect(calls).toEqual([
      'GET /planning/production-plans/501',
      'PUT /planning/production-plans/501 "v3"',
      'GET /planning/production-plans/501',
      'POST /planning/production-plans/501:confirm "v3"',
    ]);
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
