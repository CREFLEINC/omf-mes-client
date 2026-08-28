import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DetailDialog, type DetailDialogProps } from './detail-dialog';
import type { WorkOrder } from './types';

const t = messages.workOrderProgress.detail;
const blank = messages.workOrderProgress.list.blank;

const workOrder = (overrides: Partial<WorkOrder> = {}): WorkOrder => ({
  workOrderId: 7001,
  workOrderNo: 'SYN-WO-0007',
  productionPlanId: 31,
  routingOperationId: 901,
  itemId: 5001,
  orderQty: 3000,
  uomId: 11,
  workOrderTypeCode: 'SYN_NORMAL',
  statusCode: 'SYN_RUN',
  priorityNo: 1,
  ...overrides,
});

const renderDialog = (overrides: Partial<DetailDialogProps> = {}) => {
  const onClose = vi.fn();

  render(
    <DetailDialog
      workOrder={workOrder()}
      isLoading={false}
      isError={false}
      isOpen
      itemLabel={(id) => `품목 ${id}`}
      onClose={onClose}
      {...overrides}
    />,
  );

  return { onClose, user: userEvent.setup() };
};

const dialog = (): HTMLElement => screen.getByRole('dialog');

describe('DetailDialog', () => {
  it('고른 W/O 의 번호를 제목에 담는다 — 어느 것을 보고 있는지가 사실이다', () => {
    renderDialog();

    expect(dialog()).toHaveAccessibleName(expect.stringContaining('SYN-WO-0007'));
  });

  it('받은 값을 보인다', () => {
    renderDialog();
    const panel = dialog();

    expect(within(panel).getByText('SYN_RUN')).toBeInTheDocument();
    expect(within(panel).getByText('품목 5001')).toBeInTheDocument();
    expect(within(panel).getByText('3000')).toBeInTheDocument();
  });

  it('⛔ 식별자를 그대로 보이지 않고 이름으로 바꾼다', () => {
    renderDialog();

    expect(within(dialog()).queryByText('5001')).not.toBeInTheDocument();
  });

  describe('없는 값', () => {
    it.each([
      ['계획 시작', t.plannedStartAt],
      ['계획 종료', t.plannedEndAt],
      ['완료', t.completedAt],
      ['마감', t.closedAt],
      ['비고', t.remarks],
    ])('%s 이 없으면 「—」로 둔다', (_name, label) => {
      renderDialog();

      expect(within(dialog()).getByText(label).closest('.field-cell')).toHaveTextContent(blank);
    });

    it('있으면 날짜와 시각만 보인다', () => {
      renderDialog({ workOrder: workOrder({ plannedEndAt: '2026-08-04T18:00:00+09:00' }) });

      expect(within(dialog()).getByText('2026-08-04 18:00')).toBeInTheDocument();
    });
  });

  /*
   * ⛔ 없다는 사실을 적지 않으면 「이 W/O 는 실적이 없구나」로 읽힌다 — 실제로는 아직
   * 받아 오지 않은 것이다(A-11).
   */
  it('⛔ 실적 이력·생산LOT·세션이 아직 없다는 것을 적는다', () => {
    renderDialog();

    expect(within(dialog()).getByText(t.historyUnavailable)).toBeInTheDocument();
  });

  describe('열고 닫기', () => {
    it('고른 것이 없으면 창이 열리지 않는다', () => {
      renderDialog({ isOpen: false, workOrder: null });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    /* ⛔ 눌렀는데 아무 일도 없다가 나중에 열리면 두 번 누르게 된다. */
    it('⛔ 받는 중에도 창은 열려 있다', () => {
      renderDialog({ isOpen: true, workOrder: null, isLoading: true });

      expect(dialog()).toBeInTheDocument();
      expect(within(dialog()).getByRole('status')).toHaveTextContent(t.loading);
    });

    it('닫기를 누르면 알린다', async () => {
      const { onClose, user } = renderDialog();

      await user.click(within(dialog()).getByRole('button', { name: t.close }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    /* ⛔ 같은 이름의 컨트롤이 둘이면 화면 읽기 도구에서 어느 것을 부르는지 갈린다. */
    it('⛔ 닫는 버튼이 하나뿐이다', () => {
      renderDialog();

      expect(within(dialog()).getAllByRole('button', { name: t.close })).toHaveLength(1);
    });
  });

  describe('상세를 받지 못했을 때', () => {
    it('⛔ 빈 창으로 두지 않고 실패를 알린다', () => {
      renderDialog({ isError: true, workOrder: null });

      expect(within(dialog()).getByText(t.loadError)).toBeInTheDocument();
    });

    it('실패했으면 값 자리를 그리지 않는다 — 옛 값이 남지 않게', () => {
      renderDialog({ isError: true, workOrder: null });

      expect(within(dialog()).queryByText(t.orderQty)).not.toBeInTheDocument();
    });
  });

  /* 이 화면에는 저장 액션이 없다 — 상세도 읽는 자리다. */
  it('⛔ 고치는 컨트롤을 두지 않는다', () => {
    renderDialog();
    const panel = dialog();

    for (const role of ['textbox', 'checkbox', 'combobox', 'switch'] as const) {
      expect(within(panel).queryAllByRole(role)).toHaveLength(0);
    }
  });
});
