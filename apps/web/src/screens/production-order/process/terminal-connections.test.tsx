import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, jsonResponse } from '../../../test/api-harness';
import { TerminalConnections } from './terminal-connections';
const workOrder = {
  workOrderId: 10,
  workOrderNo: 'WO-10',
  productionPlanId: 1,
  operationName: '사출',
  processId: 2,
  plannedEquipmentId: 9,
  orderQty: 10,
  uomId: 1,
  itemId: 1,
  statusCode: 'PLANNED',
  priorityNo: 1,
};
const terminal = (id: number, plantId = 1, equipmentId: number | null = 9) => ({
  terminalId: id,
  terminalCode: `POP-${id}`,
  plantId,
  equipmentId,
  equipmentCode: 'EQ9',
  equipmentName: '사출기',
  terminalTypeCode: 'POP',
  statusCode: 'RUNNING',
  isActive: true,
});
describe('배포 연결 단말기 조회', () => {
  it('설비 또는 공정이 연결된 같은 공장 단말기와 실행 권한을 표시한다', async () => {
    const fetch = vi.fn(async (request: Request) => {
      expect(request.method).toBe('GET');
      const url = new URL(request.url);
      if (url.pathname.endsWith('/equipments/9'))
        return jsonResponse({
          equipment: { equipmentId: 9, equipmentCode: 'EQ9', equipmentName: '사출기' },
        });
      if (url.pathname.endsWith('/terminals'))
        return jsonResponse({
          items: [terminal(1), terminal(2, 1, 99), terminal(3, 2)],
          page: { page: 1, size: 200, total: 3 },
        });
      return jsonResponse({
        items: [{ processId: 2, processName: '사출', canStartWork: true, canInputResult: true }],
      });
    });
    renderWithProviders(<TerminalConnections plantId={1} workOrder={workOrder} />, { fetch });
    const table = await screen.findByRole('table');
    expect(table).toHaveTextContent('POP-1');
    expect(table).toHaveTextContent('POP-2');
    expect(table).not.toHaveTextContent('POP-3');
    expect(table).toHaveTextContent('작업 시작');
    expect(table).toHaveTextContent('실적 입력');
    expect(screen.queryByRole('columnheader', { name: '연결 기준' })).toBeNull();
  });
  it('공정 조회 실패를 미연결로 단정하지 않고 재조회할 수 있다', async () => {
    let fail = true;
    const fetch = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (url.pathname.endsWith('/equipments/9'))
        return jsonResponse({
          equipment: { equipmentId: 9, equipmentCode: 'EQ9', equipmentName: '사출기' },
        });
      if (url.pathname.endsWith('/terminals'))
        return jsonResponse({ items: [terminal(1)], page: { page: 1, size: 200, total: 1 } });
      return fail
        ? jsonResponse({ errors: [] }, { status: 403 })
        : jsonResponse({ items: [{ processId: 2, canStartWork: false }] });
    });
    renderWithProviders(<TerminalConnections plantId={1} workOrder={workOrder} />, { fetch });
    expect(await screen.findByText(/구성을 모두 조회하지 못했습니다/)).toBeVisible();
    expect(screen.getByRole('table')).toHaveTextContent('조회 실패');
    fail = false;
    await userEvent.setup().click(screen.getByRole('button', { name: '단말기 다시 조회' }));
    expect(await screen.findByText('실행 권한 미설정')).toBeVisible();
  });
  it('단말기가 없고 설비가 미배정이면 재조회 시 설비를 조회하지 않는다', async () => {
    const fetch = vi.fn(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe('/mdm/terminals');
      return jsonResponse({ items: [], page: { page: 1, size: 200, total: 0 } });
    });
    renderWithProviders(
      <TerminalConnections plantId={1} workOrder={{ ...workOrder, plannedEquipmentId: null }} />,
      { fetch },
    );
    await screen.findByText('설비 또는 공정에 연결된 단말기가 없습니다.');
    await userEvent.setup().click(screen.getByRole('button', { name: '단말기 다시 조회' }));
    expect(screen.getByText('미배정')).toBeVisible();
  });
  it('공정 정보가 없으면 전체 연결 없음으로 판단하지 않는다', async () => {
    renderWithProviders(
      <TerminalConnections
        plantId={1}
        workOrder={{ ...workOrder, plannedEquipmentId: null, processId: undefined }}
      />,
      { fetch: async () => jsonResponse({ items: [], page: { page: 1, size: 200, total: 0 } }) },
    );
    expect(await screen.findByText('공정 연결 정보 확인 필요')).toBeVisible();
    expect(screen.queryByText('설비 또는 공정에 연결된 단말기가 없습니다.')).toBeNull();
  });
});
