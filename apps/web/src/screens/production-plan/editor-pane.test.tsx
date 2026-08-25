import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { ProductionPlanEditorPane, type ProductionPlanEditorRow } from './editor-pane';

const row = (overrides: Partial<ProductionPlanEditorRow> = {}): ProductionPlanEditorRow => ({
  key: 'plan-101',
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

describe('ProductionPlanEditorPane', () => {
  it('계획 필드와 일치하는 합계를 한 표에 보인다', () => {
    renderPane([
      row(),
      row({ key: 'plan-102', planNo: 'PLAN-102', draft: { ...row().draft, plannedQty: '40' } }),
    ]);

    expect(screen.getByRole('table', { name: 'P/O 생산계획 편집 표' })).toBeVisible();
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
    expect(screen.getByText('P/O 수량보다 40 EA 부족합니다.')).toBeVisible();
    renderPane([
      row({ key: 'over', planNo: 'PLAN-OVER', draft: { ...row().draft, plannedQty: '120' } }),
    ]);
    expect(screen.getByText('P/O 수량보다 20 EA 초과합니다.')).toBeVisible();
    renderPane([]);
    expect(screen.getByText('계획을 1건 이상 추가해야 전개할 수 있습니다.')).toBeVisible();
  });

  it('잘못된 수량은 합계를 숫자로 지어내지 않는다', () => {
    renderPane([
      row({ draft: { ...row().draft, plannedQty: '' }, errors: { plannedQty: 'REQUIRED' } }),
    ]);

    expect(screen.getByText('합계 계산 불가')).toBeVisible();
    expect(screen.getByText('계획 수량 오류를 먼저 수정하세요.')).toBeVisible();
    expect(screen.getByText('필수 값입니다.')).toBeVisible();
  });

  it('확정된 계획은 편집·삭제를 잠그고 이유를 보인다', () => {
    renderPane([row({ confirmed: true, statusCode: 'CONFIRMED' })]);

    expect(screen.getByText('확정 · 편집 불가')).toBeVisible();
    expect(screen.getByRole('spinbutton', { name: 'PLAN-101 계획수량' })).toBeDisabled();
    expect(screen.getByText('확정된 계획은 수정할 수 없습니다.')).toBeVisible();
    expect(screen.getByRole('button', { name: '삭제' })).toBeDisabled();
  });
});
