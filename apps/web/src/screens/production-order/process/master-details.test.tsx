import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithProviders } from '../../../test/api-harness';
import { MasterDetails } from './master-details';

const options = [
  { value: '21', label: 'R1 Rev 1' },
  { value: '22', label: 'R2 Rev 2' },
];
const mount = (locked = false) => {
  const change = vi.fn();
  renderWithProviders(
    <MasterDetails
      bomId="11"
      routingId="21"
      itemId={1}
      options={options}
      locked={locked}
      onRoutingChange={change}
    />,
    {
      fetch: async (req) => {
        expect(req.method).toBe('GET');
        if (req.url.endsWith('/boms/11'))
          return jsonResponse({
            bom: { bomCode: 'ERP-SYN', bomVersion: 2, baseQty: 1, baseUomId: 1 },
          });
        if (/\/routings\/\d+$/.test(new URL(req.url).pathname))
          return jsonResponse({
            routing: {
              routingCode: 'R1',
              routingVersion: 1,
              statusCode: 'CONFIRMED',
              isDefault: true,
            },
          });
        if (req.url.endsWith('/operations'))
          return jsonResponse({
            items: [
              {
                routingOperationId: 1,
                operationSeq: 10,
                operationName: req.url.includes('/21/') ? '사출' : '검사',
              },
            ],
          });
        return jsonResponse({ items: [], page: { total: 0 } });
      },
    },
  );
  return change;
};
describe('BOM Routing 본문 상세', () => {
  it('팝업 없이 상세를 표시하고 Routing은 미리 확인한 뒤 적용한다', async () => {
    const change = mount();
    await screen.findByText('ERP-SYN · 개정 2');
    const routing = screen.getByRole('region', { name: 'Routing 상세 정보' });
    await within(routing).findByRole('cell', { name: '사출' });
    await userEvent.setup().click(within(routing).getByRole('combobox', { name: 'Routing 개정' }));
    await userEvent.setup().click(await screen.findByRole('option', { name: /R2 개정 2/ }));
    await within(routing).findByRole('cell', { name: '검사' });
    expect(change).not.toHaveBeenCalled();
    await userEvent
      .setup()
      .click(within(routing).getByRole('button', { name: '이 작업 순서 적용' }));
    expect(change).toHaveBeenCalledExactlyOnceWith('22');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('Routing이 없으면 선택 칸 없이 없는 것과 등록 화면 단추만 보인다', async () => {
    renderWithProviders(
      <MasterDetails
        bomId=""
        routingId=""
        options={[]}
        locked={false}
        orderItemId={91}
        onRoutingChange={vi.fn()}
      />,
      { fetch: async () => jsonResponse({ items: [], page: { total: 0 } }) },
    );
    const routing = screen.getByRole('region', { name: 'Routing 상세 정보' });
    expect(within(routing).getByText('이 품목에 등록된 Routing이 없습니다')).toBeVisible();
    expect(within(routing).queryByRole('combobox', { name: 'Routing 개정' })).toBeNull();
    expect(within(routing).queryByText('Routing 미지정')).toBeNull();
    expect(within(routing).getByRole('link', { name: /Routing 등록 화면 열기/ })).toHaveAttribute(
      'href',
      '/master-data/routing?item=91',
    );
    const bom = screen.getByRole('region', { name: 'BOM 상세 정보' });
    expect(within(bom).getByText('ERP에서 받은 기본 BOM이 없습니다')).toBeVisible();
  });
  it('확정 계획의 상세는 표시하되 개정 변경은 제공하지 않는다', async () => {
    const change = mount(true);
    await screen.findByRole('cell', { name: '사출' });
    expect(screen.queryByRole('combobox', { name: 'Routing 개정' })).toBeNull();
    expect(screen.queryByRole('button', { name: '이 작업 순서 적용' })).toBeNull();
    expect(change).not.toHaveBeenCalled();
  });
});
