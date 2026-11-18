import { createApiClient } from '@omf-mes/api-client';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { jsonResponse } from '../../test/api-harness';
import { releaseWorkOrder, unreleasedWorkOrdersOf } from './release-runner';
const page = (items: unknown[]) => ({ items, page: { page: 1, size: 200, total: items.length } });
describe('과거 미배포 계획 배포 차단', () => {
  it('상세를 다시 읽은 계획일이 지났으면 배포 POST를 보내지 않는다', async () => {
    const writes: string[] = [];
    const { client } = createApiClient({
      baseUrl: 'http://test',
      fetch: async (request) => {
        if (request.method !== 'GET') writes.push(request.url);
        if (new URL(request.url).pathname === '/production/work-orders/1')
          return jsonResponse(
            {
              workOrderId: 1,
              workOrderNo: 'WO-1',
              productionPlanId: 10,
              statusCode: 'CONFIRMED',
              itemId: 1,
              uomId: 1,
              orderQty: 10,
            },
            { headers: { ETag: '"1"' } },
          );
        return jsonResponse({ productionPlanId: 10, planDate: '2000-01-01' });
      },
    });
    const result = await releaseWorkOrder(
      client,
      new QueryClient(),
      { workOrderId: 1, workOrderNo: 'WO-1' },
      10,
    );
    expect(result.status).toBe('skipped');
    expect(result.reason).toContain('계획일이 지났습니다');
    expect(writes).toEqual([]);
  });
  it('같은 ERP W/O에 과거 미배포 계획이 있으면 오늘 계획만 골라 일괄 배포하지 않는다', async () => {
    const { client } = createApiClient({
      baseUrl: 'http://test',
      fetch: async (request) => {
        if (new URL(request.url).pathname === '/production/work-orders')
          return jsonResponse(
            page([
              {
                workOrderId: 1,
                workOrderNo: 'WO-1',
                productionPlanId: 10,
                statusCode: 'CONFIRMED',
              },
              {
                workOrderId: 2,
                workOrderNo: 'WO-2',
                productionPlanId: 20,
                statusCode: 'CONFIRMED',
              },
            ]),
          );
        return jsonResponse(
          page([
            { productionPlanId: 10, planDate: '2000-01-01' },
            { productionPlanId: 20, planDate: '2099-01-01' },
          ]),
        );
      },
    });
    await expect(unreleasedWorkOrdersOf(client, 1)).rejects.toMatchObject({
      apiError: { kind: 'validation', errors: [expect.objectContaining({ field: 'planDate' })] },
    });
  });
});

it('작업지시 없는 과거 작성중 계획도 ERP W/O 일괄 배포를 막는다', async () => {
  const { client } = createApiClient({
    baseUrl: 'http://test',
    fetch: async (request) =>
      new URL(request.url).pathname === '/production/work-orders'
        ? jsonResponse(page([{ workOrderId: 1, productionPlanId: 10, statusCode: 'CONFIRMED' }]))
        : jsonResponse(
            page([
              { productionPlanId: 10, planDate: '2099-01-01', confirmedAt: '2026-11-01' },
              { productionPlanId: 20, planDate: '2000-01-01', confirmedAt: null },
            ]),
          ),
  });
  await expect(unreleasedWorkOrdersOf(client, 1)).rejects.toMatchObject({
    apiError: {
      kind: 'validation',
      errors: [
        expect.objectContaining({ message: expect.stringContaining('계획일이 지났습니다') }),
      ],
    },
  });
});
it.each(['누락', '잘림'])('계획 조회가 불완전하면 배포를 허용하지 않는다 (%s)', async (kind) => {
  const { client } = createApiClient({
    baseUrl: 'http://test',
    fetch: async (request) => {
      const url = new URL(request.url);
      if (url.pathname === '/production/work-orders')
        return jsonResponse(
          page([{ workOrderId: 1, productionPlanId: 10, statusCode: 'CONFIRMED' }]),
        );
      if (kind === '누락') return jsonResponse(page([]));
      return jsonResponse({
        items:
          url.searchParams.get('page') === '1'
            ? [{ productionPlanId: 10, planDate: '2099-01-01' }]
            : [],
        page: { page: Number(url.searchParams.get('page')), size: 1, total: 2 },
      });
    },
  });
  await expect(unreleasedWorkOrdersOf(client, 1)).rejects.toMatchObject({
    apiError: { kind: 'validation', errors: [expect.objectContaining({ code: 'INVALID' })] },
  });
});
