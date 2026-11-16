import { screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { renderWithProviders, jsonResponse } from '../../../test/api-harness';
import { useWeeklyPlanContext } from './weekly-plan-context';
const plan = (id: number, owner: number) => ({
  productionPlanId: id,
  productionOrderId: owner,
  planNo: `PP-${id}`,
  planDate: '2099-01-05',
  plannedQty: 10,
  uomId: 1,
  bomId: 1,
  routingId: 1,
  plannedLineId: 31,
  statusCode: 'CONFIRMED',
  confirmedAt: '2099-01-01',
  remarks: null,
});
const Probe = ({ enabled = true }: { enabled?: boolean }) => {
  const query = useWeeklyPlanContext(1, '2099-01-05', '2099-01-11', enabled, [101]);
  return (
    <div>
      {query.isError
        ? '조회 실패'
        : query.data?.map((p) => (
            <p key={p.productionPlanId}>
              {p.planNo} {p.orderNo}
            </p>
          ))}
    </div>
  );
};
describe('주간 전체 편성 조회', () => {
  it('현재 ERP W/O·다른 공장·취소 계획을 제외하며 기간으로 조회한다', async () => {
    const requests: Request[] = [];
    renderWithProviders(<Probe />, {
      fetch: async (request) => {
        requests.push(request);
        const url = new URL(request.url);
        const page = (items: unknown[]) =>
          jsonResponse({ items, page: { page: 1, size: 100, total: items.length } });
        if (url.pathname === '/planning/production-plans') {
          expect(url.searchParams.get('planDateFrom')).toBe('2099-01-05');
          return page([plan(1, 101), plan(2, 102), plan(3, 103), plan(4, 104)]);
        }
        if (url.pathname.startsWith('/planning/production-orders/')) {
          const id = Number(url.pathname.split('/').at(-1));
          return jsonResponse({
            productionOrderId: id,
            productionOrderNo: `ERP-${id}`,
            plantId: id === 103 ? 2 : 1,
            itemId: 1,
            statusCode: 'RECEIVED',
          });
        }
        if (url.pathname.startsWith('/mdm/items/'))
          return jsonResponse({ item: { itemCode: 'ITEM-1', itemName: '시험 품목' } });
        if (url.pathname === '/production/work-orders') {
          const id = Number(url.searchParams.get('productionOrderId'));
          return page([
            {
              productionPlanId: id === 104 ? 4 : 2,
              statusCode: id === 104 ? 'CANCELLED' : 'RELEASED',
            },
          ]);
        }
        throw new Error(url.pathname);
      },
    });
    expect(await screen.findByText('PP-2 ERP-102')).toBeVisible();
    expect(screen.queryByText(/PP-1|PP-3|PP-4/)).toBeNull();
    expect(requests.every((request) => request.method === 'GET')).toBe(true);
  });
  it('전체 보기 전에는 조회하지 않는다', () => {
    let count = 0;
    renderWithProviders(<Probe enabled={false} />, {
      fetch: async () => {
        count++;
        return jsonResponse({});
      },
    });
    expect(count).toBe(0);
  });
});
