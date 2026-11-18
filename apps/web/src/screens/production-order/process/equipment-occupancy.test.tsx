import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithProviders } from '../../../test/api-harness';
import { EquipmentOccupancy, EquipmentAssignmentPicker } from './equipment-occupancy';
import {
  activeEquipmentAllocations,
  allocationOverlap,
  allocationStatus,
} from './equipment-occupancy-model';
const row = (id: number, overrides = {}) => ({
  workOrderId: id,
  workOrderNo: `WO-${id}`,
  productionPlanId: 1,
  routingOperationId: 1,
  itemId: 1,
  orderQty: 5,
  uomId: 1,
  priorityNo: 1,
  workOrderTypeCode: 'NORMAL',
  statusCode: 'PLANNED',
  plannedEquipmentId: 1,
  productionOrderNo: `ERP-${id}`,
  itemCode: 'ITEM-1',
  routingOperationName: '사출',
  plannedStartAt: '2026-11-23T06:00:00+07:00',
  plannedEndAt: '2026-11-23T11:00:00+07:00',
  ...overrides,
});
const start = '2026-11-23T08:00',
  end = '2026-11-23T17:00';
const fetchFor = (items = [row(2)]) =>
  vi.fn(async (request: Request) => {
    const url = new URL(request.url);
    if (url.pathname.endsWith('/work-orders'))
      return jsonResponse({ items, page: { page: 1, size: 200, total: items.length } });
    if (url.pathname.endsWith('/production-plans/1'))
      return jsonResponse({ productionPlanId: 1, planNo: 'PP-1' });
    if (url.pathname.endsWith('/items/1'))
      return jsonResponse({ item: { itemCode: 'ITEM-1', itemName: '커버 ASSY' } });
    return jsonResponse({ items: [], page: { page: 1, size: 200, total: 0 } });
  });
describe('설비 배정 중복', () => {
  it('자기·취소·마감·완료를 제외하고 진행·중단은 유지한다', () => {
    expect(
      activeEquipmentAllocations(
        [
          row(1),
          row(2),
          row(3, { statusCode: 'CANCELLED' }),
          row(4, { statusCode: 'CLOSED' }),
          row(5, { statusCode: 'COMPLETED' }),
          row(6, { statusCode: 'SUSPENDED' }),
        ],
        1,
      ).map((r) => r.workOrderId),
    ).toEqual([2, 6]);
  });
  it('시간대·전날 시작·자정 넘김을 대조하며 인접 구간은 허용한다', () => {
    expect(
      allocationOverlap(row(2, { plannedStartAt: '2026-11-22T22:00:00+07:00' }), start, end)
        ?.minutes,
    ).toBe(180);
    expect(
      allocationOverlap(
        row(2, { plannedStartAt: '2026-11-23T10:00:00Z', plannedEndAt: '2026-11-23T18:00:00Z' }),
        start,
        end,
      ),
    ).toBeNull();
    expect(
      allocationOverlap(
        row(2, {
          plannedStartAt: '2026-11-23T16:00:00+07:00',
          plannedEndAt: '2026-11-24T00:30:00+07:00',
        }),
        start,
        end,
      )?.minutes,
    ).toBe(60);
  });
  it('누락된 시간을 중복 없음으로 표시하지 않는다', () => {
    expect(allocationStatus([row(2, { plannedEndAt: undefined })], start, end)).toContain('미등록');
    expect(allocationStatus([], end, start)).toBe('계획 시간 확인 필요');
  });
  it('ERP W/O·계획·중복 시간·선택 상세를 표시하고 시작일 하한을 걸지 않는다', async () => {
    const fetch = fetchFor();
    renderWithProviders(
      <EquipmentOccupancy equipmentId={1} selfId={1} start={start} end={end} label="사출기" />,
      { fetch },
    );
    expect(await screen.findByText('PP-1')).toBeInTheDocument();
    expect(await screen.findByText('커버 ASSY')).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent('ERP-2');
    expect(screen.getByRole('table')).toHaveTextContent('2026-11-23 08:00');
    expect(screen.getByRole('table')).toHaveTextContent('3시간 0분');
    const url = new URL(
      fetch.mock.calls.find(([r]) => new URL(r.url).pathname.endsWith('/work-orders'))![0].url,
    );
    expect(url.searchParams.get('plannedEquipmentId')).toBe('1');
    expect(url.searchParams.has('plannedStartFrom')).toBe(false);
  });
  it('실패를 빈 설비로 표시하지 않는다', async () => {
    const fetch = vi.fn(async () => jsonResponse({ message: 'failed' }, { status: 500 }));
    renderWithProviders(
      <EquipmentOccupancy equipmentId={1} selfId={1} start={start} end={end} label="사출기" />,
      { fetch },
    );
    expect(await screen.findByText('설비 배정 내역을 조회하지 못했습니다.')).toBeInTheDocument();
    expect(screen.queryByText('중복 없음')).toBeNull();
  });
  it('중복 설비 내역은 확인하며 선택을 막고 빈 설비는 재조회 후 적용한다', async () => {
    const user = userEvent.setup(),
      onPick = vi.fn();
    const fallback = fetchFor();
    const fetch = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (
        url.pathname.endsWith('/work-orders') &&
        url.searchParams.get('plannedEquipmentId') === '2'
      )
        return jsonResponse({ items: [], page: { page: 1, size: 200, total: 0 } });
      return fallback(request);
    });
    renderWithProviders(
      <EquipmentAssignmentPicker
        source={{
          title: '설비 선택',
          key: ['test'],
          columns: { code: '설비 코드', name: '설비명' },
          search: async () => ({
            items: [
              { id: 1, code: 'EQ-1', name: '사출 1호기' },
              { id: 2, code: 'EQ-2', name: '사출 2호기' },
            ],
            total: 2,
          }),
        }}
        selfId={1}
        start={start}
        end={end}
        onClose={() => {}}
        onPick={onPick}
      />,
      { fetch },
    );
    await user.click(await screen.findByRole('row', { name: 'EQ-1 사출 1호기 배정 내역 확인' }));
    expect(await screen.findByText('PP-1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^선택$/ })).toBeDisabled();
    await user.click(screen.getByRole('row', { name: 'EQ-2 사출 2호기 배정 내역 확인' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /^선택$/ })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: /^선택$/ }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
  });
});
