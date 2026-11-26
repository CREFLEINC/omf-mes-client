import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithProviders, jsonResponse } from '../../../test/api-harness';
import { BomTable, RoutingTable } from './revision-tables';

const availabilityFetch = (fail: boolean) => async (req: Request) => {
  if (req.method !== 'POST') return fetch(req);
  expect(new URL(req.url).pathname).toBe('/planning/boms:material-availability');
  if (fail) return jsonResponse({ message: 'synthetic failure' }, { status: 500 });
  const body = (await req.json()) as {
    plantId: number;
    lines: { bomComponentId: number; quantity: number }[];
  };
  expect(body.plantId).toBe(7);
  return jsonResponse({
    items: body.lines.map((line) => ({
      ...line,
      itemId: line.bomComponentId,
      itemCode: `MAT-${line.bomComponentId}`,
      itemName: `자재 ${line.bomComponentId}`,
      requiredQty: line.bomComponentId * line.quantity,
      bomUomCode: line.bomComponentId === 3 ? 'GR' : 'EA',
      stockUomCode: line.bomComponentId === 3 ? 'KG' : 'EA',
      requiredStockQty: line.bomComponentId === 3 ? 0.03 : line.bomComponentId * line.quantity,
      availableQty: 25,
      statusCode:
        line.bomComponentId === 2 ? 'NOT_COMPARABLE' : line.bomComponentId > 2 ? 'SHORT' : 'ENOUGH',
    })),
  });
};
const fetch = async (req: Request) => {
  expect(req.method).toBe('GET');
  const path = new URL(req.url).pathname;
  if (path.endsWith('/components'))
    return jsonResponse({
      items: Array.from({ length: 23 }, (_, i) => ({
        bomComponentId: i + 1,
        componentItemId: i + 1,
        sequenceNo: i + 1,
        erpChildItemSeq: i,
        requiredQty: i + 1,
        uomId: 1,
        scrapRate: 0,
        isMandatory: true,
        lotTraceRequired: false,
        backflushAllowed: false,
      })),
    });
  if (path === '/planning/boms/1')
    return jsonResponse({ bom: { bomCode: 'ERP-SYN', bomVersion: 1, baseQty: 1, baseUomId: 1 } });
  if (path === '/mdm/uoms')
    return jsonResponse({
      items: [{ uomId: 1, uomCode: 'EA' }],
      page: { page: 1, size: 20, total: 1 },
    });
  if (path.startsWith('/mdm/items/')) {
    const id = Number(path.split('/').at(-1));
    return jsonResponse({
      item: {
        itemId: id,
        itemCode: `MAT-${id}`,
        itemName: id === 1 ? '자재 1 【 원문-100 】' : `자재 ${id}`,
      },
    });
  }
  if (path.endsWith('/operations'))
    return jsonResponse({
      items: Array.from({ length: 23 }, (_, i) => ({
        routingOperationId: i + 1,
        processId: 1,
        operationSeq: (i + 1) * 10,
        operationName: `공정 ${i + 1}`,
        nameKo: `한국어 공정 ${i + 1}`,
        nameVi: `Cong doan ${i + 1}`,
        equipmentRequired: true,
        moldRequired: false,
        materialInputManaged: true,
        productionResultManaged: true,
        inspectionManaged: true,
        isOutsourced: false,
        outputLotRequired: false,
        mesManaged: true,
        standardCycleTimeSec: 20,
        standardYieldRate: 0.98,
      })),
    });
  if (path === '/mdm/processes/1')
    return jsonResponse({ process: { processCode: 'PROC-1', processName: '공정' } });
  return jsonResponse({ routing: { routingCode: 'R1', routingVersion: 1 } });
};
describe('대량 BOM Routing 표', () => {
  it('BOM은 순번 열 없이 10행씩 표시하고 코드·명칭 고정과 행 수 변경을 유지한다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BomTable id={1} />, { fetch });
    const table = await screen.findByRole('table', { name: 'BOM 구성' });
    await within(table).findByRole('cell', { name: 'MAT-1' });
    expect(within(table).getAllByRole('row')).toHaveLength(11);
    expect(within(table).queryByRole('columnheader', { name: 'ERP 순번' })).toBeNull();
    expect(within(table).queryByRole('columnheader', { name: 'MES 표시 순서' })).toBeNull();
    expect(within(table).getByRole('cell', { name: 'MAT-1' })).toHaveClass('fixed-code');
    expect(within(table).getByRole('cell', { name: '자재 1 【 원문-100 】' })).toHaveClass(
      'fixed-name',
    );
    expect(within(table).getByRole('cell', { name: '자재 1 【 원문-100 】' }).textContent).toBe(
      '자재 1 【 원문-100 】',
    );
    await user.click(screen.getByRole('button', { name: '다음' }));
    await within(table).findByRole('cell', { name: 'MAT-11' });
    expect(within(table).queryByRole('cell', { name: 'MAT-1' })).toBeNull();
    await user.click(screen.getByRole('combobox', { name: 'BOM 구성 표시 행 수' }));
    await user.click(screen.getByRole('option', { name: '20' }));
    expect(within(table).getAllByRole('row')).toHaveLength(21);
    await within(table).findByRole('cell', { name: 'MAT-1' });
  });
  it('Routing 공정 순서는 다음 페이지에서도 이어지고 실제 공정 코드를 조회한다', async () => {
    renderWithProviders(<RoutingTable id={1} />, { fetch });
    const table = await screen.findByRole('table', { name: 'Routing 공정' });
    await within(table).findAllByRole('cell', { name: 'PROC-1' });
    await userEvent.setup().click(screen.getByRole('button', { name: '다음' }));
    const row = within(table).getByRole('cell', { name: '공정 11' }).closest('tr')!;
    expect(within(row).getByRole('cell', { name: '11' })).toBeVisible();
    expect(within(table).getByRole('columnheader', { name: '순서' })).toBeVisible();
    expect(within(table).queryByRole('columnheader', { name: '검사 관리' })).toBeNull();
    expect(within(row).getAllByRole('cell')).toHaveLength(
      within(table).getAllByRole('columnheader').length,
    );
    expect(within(row).getByRole('cell', { name: '한국어 공정 11' })).toBeVisible();
    expect(within(row).getByRole('cell', { name: 'Cong doan 11' })).toBeVisible();
    expect(within(row).getByRole('cell', { name: '20초' })).toBeVisible();
  });
  it('공장·수량을 주면 필요 수량·가용 수량·재고 상태 칸을 더하고 부족은 경고로만 보인다', async () => {
    renderWithProviders(<BomTable id={1} plantId={7} quantity={10} />, {
      fetch: availabilityFetch(false),
    });
    const table = await screen.findByRole('table', { name: 'BOM 구성' });
    expect(within(table).getByRole('columnheader', { name: '필요 수량' })).toBeVisible();
    expect(within(table).getByRole('columnheader', { name: '가용 수량' })).toBeVisible();
    expect(within(table).getByRole('columnheader', { name: '재고 상태' })).toBeVisible();
    const first = (await within(table).findByRole('cell', { name: 'MAT-1' })).closest('tr')!;
    expect(await within(first).findByText('충분')).toBeVisible();
    expect(within(first).getByRole('cell', { name: '10 EA' })).toBeVisible();
    expect(within(first).getByRole('cell', { name: '25 EA' })).toBeVisible();
    const second = within(table).getByRole('cell', { name: 'MAT-2' }).closest('tr')!;
    expect(within(second).getByText('재고 정보 확인 불가')).toBeVisible();
    const third = within(table).getByRole('cell', { name: 'MAT-3' }).closest('tr')!;
    expect(within(third).getByText('부족')).toBeVisible();
    expect(within(third).getByRole('cell', { name: '30 GR (0.03 KG)' })).toBeVisible();
    expect(screen.getByText(/필요 수량은 10 EA 기준이고/)).toBeVisible();
  });
  it('가용 수량 조회에 실패하면 0 이 아니라 조회 실패와 다시 조회를 보인다', async () => {
    renderWithProviders(<BomTable id={1} plantId={7} quantity={10} />, {
      fetch: availabilityFetch(true),
    });
    const table = await screen.findByRole('table', { name: 'BOM 구성' });
    expect(await screen.findByText('가용 수량을 조회하지 못했습니다.')).toBeVisible();
    expect(screen.getByRole('button', { name: '다시 조회' })).toBeVisible();
    const first = (await within(table).findByRole('cell', { name: 'MAT-1' })).closest('tr')!;
    expect(within(first).getAllByText('조회 실패').length).toBeGreaterThan(0);
    expect(within(first).queryByText(/^0 /)).toBeNull();
  });
  it('공장이나 수량이 없으면 가용 칸 없이 기존 표 그대로다', async () => {
    renderWithProviders(<BomTable id={1} quantity={10} />, { fetch });
    const table = await screen.findByRole('table', { name: 'BOM 구성' });
    expect(within(table).queryByRole('columnheader', { name: '가용 수량' })).toBeNull();
  });
});
