import { useState } from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { renderWithProviders, jsonResponse } from '../../test/api-harness';
import { AutoPlanResult, autoPlanResultCode, type AutoPlanResultFilter } from './auto-plan-result';
import { useWorklistBulk } from './bulk-actions';
import { reasonLabel } from './worklist-chips';
const targets = [1, 2, 3, 4].map((id) => ({
  productionOrderId: id,
  productionOrderNo: `ERP-${id}`,
}));
const Harness = () => {
  const bulk = useWorklistBulk();
  const [filter, setFilter] = useState<AutoPlanResultFilter>(null);
  return (
    <>
      <button onClick={() => void bulk.start('autoPlan', targets)}>시험 실행</button>
      {bulk.run && (
        <AutoPlanResult
          outcomes={bulk.run.outcomes}
          filter={filter}
          onFilterChange={setFilter}
          onClose={bulk.clear}
        />
      )}
    </>
  );
};
describe('생산계획 자동 전개 결과', () => {
  it('실제 응답 코드를 구분하고 미확정 사유를 보존하며 모든 결과를 필터한다', async () => {
    renderWithProviders(<Harness />, {
      fetch: async (request) => {
        expect(request.method).toBe('POST');
        expect(request.headers.get('Idempotency-Key')).toBeTruthy();
        const id = Number(/\/(\d+):auto-plan/.exec(new URL(request.url).pathname)?.[1]);
        if (id === 4)
          return jsonResponse(
            { errors: [{ scope: 'screen', code: 'INVALID', message: '실행 오류' }] },
            { status: 500 },
          );
        return jsonResponse({
          productionOrderId: id,
          outcome: id === 1 ? 'CONFIRMED' : id === 2 ? 'DRAFT' : 'NOT_PLANNED',
          productionPlanId: id === 3 ? null : id,
          reasons:
            id === 2 ? ['LINE_UNKNOWN', 'PLAN_NOT_CONFIRMED'] : id === 3 ? ['ROUTING_MISSING'] : [],
        });
      },
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '시험 실행' }));
    const result = await screen.findByRole('region', { name: '생산계획 자동 전개 결과' });
    for (const label of [
      '계획 확정 1건',
      '미확정 계획 1건',
      '자동 전개 미처리 1건',
      '실행 실패 1건',
    ])
      expect(within(result).getByRole('button', { name: label })).toBeVisible();
    expect(within(result).getAllByRole('row')).toHaveLength(5);
    const draft = within(result).getByText('ERP-2').closest('tr');
    expect(draft).toHaveTextContent(reasonLabel('LINE_UNKNOWN'));
    expect(draft).toHaveTextContent(reasonLabel('PLAN_NOT_CONFIRMED'));
    await user.click(within(result).getByRole('button', { name: '미확정 계획 1건' }));
    expect(within(result).getByText('ERP-2')).toBeVisible();
    expect(within(result).queryByText('ERP-3')).toBeNull();
    await user.click(within(result).getByRole('button', { name: '계획 확정 1건' }));
    expect(within(result).getByText('ERP-1')).toBeVisible();
    expect(within(result).getByRole('link', { name: 'ERP-1 계획 확인' })).toHaveAttribute(
      'href',
      '/production/production-orders/ERP-1',
    );
    await user.click(within(result).getByRole('button', { name: '전체 ERP W/O 조회' }));
    expect(screen.queryByRole('region', { name: '생산계획 자동 전개 결과' })).toBeNull();
  });
  it('기존 캐시의 미확정과 실패 결과도 구분한다', () => {
    expect(autoPlanResultCode({ id: '1', label: 'A', status: 'processed', reason: null })).toBe(
      'CONFIRMED',
    );
    expect(autoPlanResultCode({ id: '2', label: 'B', status: 'failed', reason: '오류' })).toBe(
      'FAILED',
    );
  });
});
