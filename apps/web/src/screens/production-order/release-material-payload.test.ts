import { createApiClient } from '@omf-mes/api-client';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { jsonResponse } from '../../test/api-harness';
import { releaseWorkOrder } from './release-runner';
describe('배포 자재 환산 본문과 오류 연결', () => {
  const run = async (reject = false) => {
    let sent: unknown;
    const { client } = createApiClient({
      baseUrl: 'http://test',
      fetch: async (request) => {
        if (request.method === 'POST') {
          sent = await request.json();
          return reject
            ? jsonResponse(
                {
                  errors: [
                    {
                      scope: 'field',
                      field: 'materialUomConfirmations[bomComponentId=7].conversionRate',
                      code: 'INVALID',
                      message: '다른 비율이 등록되었습니다.',
                    },
                  ],
                },
                { status: 400 },
              )
            : jsonResponse({});
        }
        if (new URL(request.url).pathname === '/production/work-orders/1')
          return jsonResponse(
            {
              workOrderId: 1,
              productionPlanId: 2,
              itemId: 3,
              uomId: 4,
              orderQty: 10,
              statusCode: 'CONFIRMED',
              productionLineId: 5,
              defaultWipLocationId: 6,
              defaultFgLocationId: 6,
            },
            { headers: { ETag: '"1"' } },
          );
        if (new URL(request.url).pathname === '/planning/production-plans/2')
          return jsonResponse({ planDate: '2099-01-01' });
        return jsonResponse({ itemId: 3, baseUomId: 4, defaultProductionLotSize: 10 });
      },
    });
    const result = await releaseWorkOrder(
      client,
      new QueryClient(),
      { workOrderId: 1, workOrderNo: 'SYN-WO' },
      10,
      'test-key',
      [{ bomComponentId: 7, confirmed: true, conversionRate: 1000 }],
    );
    return { sent, result };
  };
  it('확인값과 직접 입력 비율을 배포 요청에 전달한다', async () => {
    const { sent, result } = await run();
    expect(result.status).toBe('released');
    expect(sent).toEqual({
      lotSize: 10,
      materialUomConfirmations: [{ bomComponentId: 7, confirmed: true, conversionRate: 1000 }],
    });
  });
  it('서버 환산 오류를 자재 행 경로와 함께 보존한다', async () => {
    const { result } = await run(true);
    expect(result.status).toBe('failed');
    expect(result.materialErrors?.[0]?.field).toBe(
      'materialUomConfirmations[bomComponentId=7].conversionRate',
    );
  });
});
