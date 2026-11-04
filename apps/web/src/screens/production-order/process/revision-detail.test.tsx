import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithProviders } from '../../../test/api-harness';
import { RevisionDetailButton } from './revision-detail';

describe('선택 개정 읽기 전용 상세', () => {
  it('선택 전에는 조회하지 않고 Routing을 공정 순서대로 표시한다', async () => {
    const fetch = vi.fn(async (request: Request) => {
      expect(request.method).toBe('GET');
      return jsonResponse({
        items: [
          {
            routingOperationId: 2,
            operationSeq: 20,
            operationName: '검사',
            inspectionManaged: true,
            standardYieldRate: 0.95,
          },
          {
            routingOperationId: 1,
            operationSeq: 10,
            operationName: '사출',
            equipmentRequired: true,
            standardCycleTimeSec: 12,
          },
        ],
      });
    });
    renderWithProviders(
      <RevisionDetailButton kind="Routing" value="7" itemId={91} label="R7 (Rev 2)" />,
      {
        fetch,
      },
    );
    expect(fetch).not.toHaveBeenCalled();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Routing 상세 보기' }));
    const dialog = screen.getByRole('dialog', { name: 'Routing 상세' });
    await within(dialog).findByText('사출');
    const rows = within(dialog).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('사출');
    expect(within(rows[1]!).getAllByRole('cell')[0]).toHaveTextContent('10');
    const link = within(dialog).getByRole('link', { name: 'Routing 관리 화면 열기 (새 탭)' });
    expect(link).toHaveAttribute('href', '/master-data/routing?item=91&rev=7');
    expect(link).toHaveAttribute('target', '_blank');
    expect(rows[2]).toHaveTextContent('검사');
    expect(rows[2]).toHaveTextContent('95%');
    await user.click(within(dialog).getAllByRole('button', { name: '닫기' }).at(-1)!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('BOM 기준 수량과 자재 소요량·단위를 표시한다', async () => {
    const fetch = vi.fn(async (request: Request) => {
      expect(request.method).toBe('GET');
      const path = new URL(request.url).pathname;
      if (path.endsWith('/components'))
        return jsonResponse({
          items: [
            {
              bomComponentId: 1,
              componentItemId: 9,
              requiredQty: 2.5,
              uomId: 3,
              scrapRate: 0.02,
              isMandatory: true,
              sequenceNo: 1,
            },
          ],
        });
      if (path.includes('/boms/'))
        return jsonResponse({ bom: { bomCode: 'B7', bomVersion: 2, baseQty: 100, baseUomId: 3 } });
      if (path.includes('/items/'))
        return jsonResponse({ item: { itemCode: 'MAT9', itemName: '원료' } });
      return jsonResponse({
        items: [{ uomId: 3, uomCode: 'KG', uomName: '킬로그램' }],
        page: { total: 1 },
      });
    });
    renderWithProviders(<RevisionDetailButton kind="BOM" value="7" />, { fetch });
    await userEvent.setup().click(screen.getByRole('button', { name: 'BOM 상세 보기' }));
    const dialog = screen.getByRole('dialog', { name: 'BOM 상세' });
    await within(dialog).findByText(/원료/);
    expect(dialog).toHaveTextContent(/기준 수량\s*100/);
    expect(dialog).toHaveTextContent('2.5');
    expect(dialog).toHaveTextContent('2%');
    expect(dialog).not.toHaveTextContent('환산한 값이 아닙니다');
  });
  it('개정이 없으면 상세 버튼을 사용할 수 없다', () => {
    renderWithProviders(<RevisionDetailButton kind="BOM" value="" />);
    expect(screen.getByRole('button', { name: 'BOM 상세 보기' })).toBeDisabled();
  });
});
