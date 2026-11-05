import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithProviders, jsonResponse } from '../../../test/api-harness';
import { BomTable, RoutingTable } from './revision-tables';

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
        inspectionManaged: false,
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
    expect(within(row).getByRole('cell', { name: '한국어 공정 11' })).toBeVisible();
    expect(within(row).getByRole('cell', { name: 'Cong doan 11' })).toBeVisible();
    expect(within(row).getByRole('cell', { name: '20초' })).toBeVisible();
  });
});
