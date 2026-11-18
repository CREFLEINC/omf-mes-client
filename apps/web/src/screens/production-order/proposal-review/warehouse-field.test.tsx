import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, jsonResponse } from '../../../test/api-harness';
import { ProposalWarehouseField } from './warehouse-field';
import { previewProposals } from './preview';
const value = () => ({ ...structuredClone(previewProposals[0]!), plantId: 1 });
describe('proposal receipt warehouse', () => {
  it('requires an explicit acknowledgement and applies the automatic arrival location to every operation', async () => {
    const user = userEvent.setup();
    const row = value();
    const onChange = vi.fn();
    renderWithProviders(
      <ProposalWarehouseField
        row={row}
        plan={row.plans[0]!}
        disabled={false}
        onChange={onChange}
      />,
      {
        fetch: async (input) => {
          const url = new URL((input as Request).url);
          return url.pathname === '/mdm/warehouses'
            ? jsonResponse({
                items: [
                  {
                    warehouseId: 82,
                    warehouseCode: 'WH-B',
                    warehouseName: '생산품 창고 B',
                    plantId: 1,
                    isActive: true,
                    warehouseTypeCode: 'FG',
                    isDefect: false,
                    isExternal: false,
                  },
                ],
                page: { page: 1, size: 50, total: 1 },
              })
            : jsonResponse({
                items: [
                  {
                    locationId: 62,
                    warehouseId: 82,
                    locationCode: 'SYS-WHOLE',
                    locationName: '창고 전체',
                    isActive: true,
                    systemRoleCode: 'WAREHOUSE_WHOLE',
                  },
                ],
                page: { page: 1, size: 200, total: 1 },
              });
        },
      },
    );
    expect(
      screen.queryByRole('button', { name: '생산품 입고 창고 지우기' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '생산품 입고 창고' }));
    const picker = await screen.findByRole('dialog', { name: '생산품 입고 창고 선택' });
    await user.click(await within(picker).findByText('생산품 창고 B'));
    await user.click(within(picker).getByRole('button', { name: '선택' }));
    const dialog = await screen.findByRole('dialog', { name: '생산품 입고 창고 변경' });
    expect(dialog).toHaveTextContent('MES와 ERP의 재고 위치가 달라집니다');
    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: '변경 적용' })).toBeEnabled(),
    );
    await user.click(within(dialog).getByRole('button', { name: '변경 적용' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        fgWarehouseOverride: { warehouseId: 82, erpMismatchAcknowledged: true },
      }),
    );
    expect(
      onChange.mock.calls[0]![0].operations.every(
        (op: { resources: { defaultFgLocationId: { id: number } } }) =>
          op.resources.defaultFgLocationId.id === 62,
      ),
    ).toBe(true);
  });
  it('SL_CD linkage failure cannot be bypassed by changing warehouses', () => {
    const row = value();
    row.erpStorage = { ...row.erpStorage!, warehouse: null, reasonCode: 'FG_WAREHOUSE_UNMAPPED' };
    renderWithProviders(
      <ProposalWarehouseField row={row} plan={row.plans[0]!} disabled={false} onChange={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: '생산품 입고 창고' })).not.toBeInTheDocument();
  });
});
