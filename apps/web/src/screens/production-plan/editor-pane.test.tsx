import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/api-harness';
import { ProductionPlanEditorPane, type ProductionPlanEditorRow } from './editor-pane';
const row = (overrides: Partial<ProductionPlanEditorRow> = {}): ProductionPlanEditorRow => ({
  key: 'plan-101',
  displayNo: 1,
  planNo: 'PLAN-101',
  statusCode: 'DRAFT',
  confirmed: false,
  isPending: false,
  draft: {
    planDate: '2026-08-26',
    plannedQty: '60',
    bomId: '701',
    routingId: '801',
    plannedLineId: '901',
    remarks: '주간',
  },
  errors: {},
  ...overrides,
});
const options = {
  bomOptions: [{ value: '701', label: 'BOM-A · Rev 1' }],
  routingOptions: [{ value: '801', label: 'ROUTE-A · Rev 2' }],
  lineOptions: [{ value: '901', label: '1라인' }],
};
const renderPane = (
  rows: ProductionPlanEditorRow[],
  callbacks = {
    onAdd: vi.fn(),
    onChange: vi.fn(),
    onRemove: vi.fn(),
  },
) => {
  renderWithProviders(
    <ProductionPlanEditorPane
      rows={rows}
      orderQty={100}
      uomLabel="EA"
      {...options}
      {...callbacks}
    />,
  );
  return callbacks;
};
const expectBanner = (title: string, role: string, icon: string) => {
  const banner = screen.getByText(title).closest('[role]');
  expect(banner).toHaveAttribute('role', role);
  expect(within(banner as HTMLElement).getByText(icon)).toBeInTheDocument();
};
describe('ProductionPlanEditorPane', () => {
  it('계획 필드와 일치하는 합계를 한 표에 보인다', () => {
    renderPane([
      row(),
      row({ key: 'plan-102', planNo: 'PLAN-102', draft: { ...row().draft, plannedQty: '40' } }),
    ]);
    expect(screen.getByText('100 / 100 EA')).toBeVisible();
    expect(screen.getByText('계획 수량 합계가 P/O 수량과 일치합니다.')).toBeVisible();
  });
  it('행 추가·수량 편집·라인 해제·삭제를 소유자에게 전달한다', async () => {
    const user = userEvent.setup();
    const callbacks = renderPane([row()]);
    await user.click(screen.getByRole('button', { name: '+ 계획 추가' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'PLAN-101 계획수량' }), {
      target: { value: '75' },
    });
    const tableRow = screen.getByText('PLAN-101').closest('tr');
    expect(tableRow).not.toBeNull();
    await user.click(
      within(tableRow as HTMLElement).getByRole('combobox', { name: 'PLAN-101 라인' }),
    );
    await user.click(screen.getByRole('option', { name: '미지정' }));
    await user.click(within(tableRow as HTMLElement).getByRole('button', { name: '삭제' }));
    expect(callbacks.onAdd).toHaveBeenCalledTimes(1);
    expect(callbacks.onChange).toHaveBeenCalledWith('plan-101', 'plannedQty', '75');
    expect(callbacks.onChange).toHaveBeenCalledWith('plan-101', 'plannedLineId', '');
    expect(callbacks.onRemove).toHaveBeenCalledWith('plan-101');
  });
  it('미달은 정보, 초과는 경고, 0건은 차단으로 구분한다', () => {
    renderPane([row()]);
    expectBanner('P/O 수량보다 40 EA 부족합니다.', 'status', 'info');
    renderPane([
      row({ key: 'over', planNo: 'PLAN-OVER', draft: { ...row().draft, plannedQty: '120' } }),
    ]);
    expectBanner('P/O 수량보다 20 EA 초과합니다.', 'alert', 'warning');
    renderPane([]);
    expectBanner('계획을 1건 이상 추가해야 전개할 수 있습니다.', 'alert', 'error');
  });
  it('잘못된 수량은 합계를 숫자로 지어내지 않는다', () => {
    renderPane([
      row({ draft: { ...row().draft, plannedQty: '' }, errors: { plannedQty: 'REQUIRED' } }),
    ]);
    expect(screen.getByText('합계 계산 불가')).toBeVisible();
    expect(screen.getByText('계획 수량 오류를 먼저 수정하세요.')).toBeVisible();
    expect(screen.getByText('필수 값입니다.')).toBeVisible();
  });
  it('확정 또는 저장 중인 계획은 모든 편집·삭제를 잠근다', () => {
    renderPane([
      row({ confirmed: true, statusCode: 'CONFIRMED' }),
      row({ key: 'pending', planNo: 'PLAN-PENDING', isPending: true }),
    ]);
    const confirmed = screen.getByText('확정 · 편집 불가').closest('tr') as HTMLElement;
    const pending = screen.getByText('저장 중').closest('tr') as HTMLElement;
    for (const lockedRow of [confirmed, pending]) {
      for (const role of ['button', 'combobox'] as const) {
        expect(
          within(lockedRow)
            .getAllByRole(role)
            .every((item) => item.hasAttribute('disabled')),
        ).toBe(true);
      }
      expect(within(lockedRow).getByRole('spinbutton')).toBeDisabled();
      expect(within(lockedRow).getByRole('textbox')).toBeDisabled();
    }
    expect(screen.getByText('확정된 계획은 수정할 수 없습니다.')).toBeVisible();
    expect(within(pending).getByRole('button', { name: '삭제' })).toHaveAttribute('aria-busy');
  });
  it('신규 행 이름을 구분하고 선택 오류를 해당 입력과 연결한다', () => {
    renderPane([
      row({
        key: 'new-1',
        displayNo: 1,
        planNo: null,
        errors: { bomId: 'REQUIRED', planDate: 'INVALID_DATE' },
      }),
      row({ key: 'new-2', displayNo: 2, planNo: null }),
    ]);
    const firstBom = screen.getByRole('combobox', { name: '신규 계획 1 BOM Rev' });
    const firstDate = screen.getByRole('button', { name: '신규 계획 1 계획일' });
    expect(screen.getByRole('combobox', { name: '신규 계획 2 BOM Rev' })).toBeVisible();
    expect(firstBom).toHaveAttribute('aria-required', 'true');
    expect(firstBom).toHaveAttribute('aria-describedby', 'new-1-bomId-error');
    expect(screen.getByText('필수 값입니다.')).toHaveAttribute('id', 'new-1-bomId-error');
    expect(firstDate).toHaveAttribute('aria-describedby', 'new-1-planDate-error');
    expect(screen.getByText('올바른 날짜를 선택하세요.')).toHaveAttribute(
      'id',
      'new-1-planDate-error',
    );
  });
});
