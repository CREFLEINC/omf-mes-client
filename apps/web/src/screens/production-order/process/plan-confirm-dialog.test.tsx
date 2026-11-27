import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PlanConfirmDialog, type PlanConfirmGroup } from './plan-confirm-dialog';

const group = (overrides: Partial<PlanConfirmGroup> = {}): PlanConfirmGroup => ({
  orderNo: 'PO-ERP-PLANWO-01',
  plans: [{ key: 'a', planNo: 'PP-1', planDate: '2026-11-27', quantity: '100 EA' }],
  operations: ['사출', '조립'],
  ...overrides,
});

describe('PlanConfirmDialog (#360 확인 팝업 시안)', () => {
  it('한 건이면 ERP W/O 한 줄 · 사실 상자 · 생길 작업지시 수 · 파란 안내를 낸다', async () => {
    const onConfirm = vi.fn();
    render(
      <PlanConfirmDialog
        groups={[group()]}
        running={false}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: '생산계획을 확정할까요?' });
    expect(within(dialog).getByText('PO-ERP-PLANWO-01')).toBeInTheDocument();
    expect(within(dialog).getByText('2026-11-27')).toBeInTheDocument();
    expect(within(dialog).getByText('100 EA')).toBeInTheDocument();
    expect(within(dialog).getByText('사출, 조립')).toBeInTheDocument();
    expect(within(dialog).getByText('작업지시 2건')).toBeInTheDocument();
    expect(within(dialog).getByText('확정된 생산계획은 수정할 수 없습니다.')).toBeInTheDocument();
    expect(within(dialog).queryByText(/일부만 완료될 수 있습니다/)).not.toBeInTheDocument();

    await userEvent.setup().click(within(dialog).getByRole('button', { name: '계획 확정' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('여러 건이면 표로 보이고 일부만 완료될 수 있다는 안내를 더한다', () => {
    render(
      <PlanConfirmDialog
        groups={[
          group({
            plans: [
              { key: 'a', planNo: 'PP-1', planDate: '2026-11-27', quantity: '60 EA' },
              { key: 'b', planNo: null, planDate: '2026-11-28', quantity: '40 EA' },
            ],
          }),
        ]}
        running={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByRole('row')).toHaveLength(3);
    expect(within(dialog).getByText('신규 계획')).toBeInTheDocument();
    expect(within(dialog).getByText('작업지시 4건')).toBeInTheDocument();
    expect(
      within(dialog).getByText('ERP W/O와 계획별로 처리하므로 일부만 완료될 수 있습니다.'),
    ).toBeInTheDocument();
  });

  it('공정을 못 받았으면 작업지시 수를 지어내지 않는다', () => {
    render(
      <PlanConfirmDialog
        groups={[group({ operations: [] })]}
        running={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.queryByText(/작업지시 \d+건/)).not.toBeInTheDocument();
    expect(screen.getByText('공정 정보 확인 필요')).toBeInTheDocument();
  });
});
