import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { HandoverPane, type HandoverPaneProps } from './handover-pane';
import type { WorkOrder } from './types';
import { EMERGENCY_WORK_ORDER_TYPE_CODE } from './work-order-type';

const t = messages.emergencyWorkOrder.handover;

const workOrder = (overrides: Partial<WorkOrder> = {}): WorkOrder => ({
  workOrderId: 7001,
  workOrderNo: 'SYN-WO-0007',
  productionPlanId: 3001,
  routingOperationId: 901,
  itemId: 5001,
  orderQty: 200,
  uomId: 11,
  workOrderTypeCode: EMERGENCY_WORK_ORDER_TYPE_CODE,
  statusCode: 'SYN_CONFIRMED',
  priorityNo: 1,
  remarks: '고객 긴급 요청',
  ...overrides,
});

const renderPane = (overrides: Partial<HandoverPaneProps> = {}) => {
  const onRelease = vi.fn();

  render(
    <HandoverPane
      workOrders={[workOrder()]}
      total={1}
      isError={false}
      releasingId={null}
      releasedNo={null}
      failure={null}
      uomLabel={() => 'EA'}
      onRelease={onRelease}
      {...overrides}
    />,
  );

  return { onRelease, user: userEvent.setup() };
};

const pane = (): HTMLElement | null => screen.queryByRole('region', { name: t.title });

describe('HandoverPane', () => {
  /*
   * ⚠ **빈 목록이 정상이다.** 늘 서 있으면 밀린 상태처럼 읽혀, 정작 진짜 밀렸을 때 눈에 띄지
   * 않는다 — 경고가 늘 켜져 있으면 경고가 아니다.
   */
  it('⚠ 밀린 것이 없으면 구획을 세우지 않는다 — 「없습니다」도 적지 않는다', () => {
    renderPane({ workOrders: [], total: 0 });

    expect(pane()).not.toBeInTheDocument();
  });

  it('아직 받지 못했으면 세우지 않는다', () => {
    renderPane({ workOrders: undefined, total: undefined });

    expect(pane()).not.toBeInTheDocument();
  });

  /*
   * ⛔ **못 받은 것과 없는 것은 다르다.** 감추면 「밀린 것이 없다」와 구별되지 않아, 배포 안 된
   * 지시가 남아 있는데 화면이 조용해진다.
   */
  it('⛔ 받지 못했으면 그 사실을 알린다 — 「없음」으로 두지 않는다', () => {
    renderPane({ workOrders: undefined, total: undefined, isError: true });

    expect(within(pane() as HTMLElement).getByText(t.loadError)).toBeInTheDocument();
  });

  it('있으면 번호·수량·사유를 보인다', () => {
    renderPane();

    expect(screen.getByRole('cell', { name: 'SYN-WO-0007' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '200 EA' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '고객 긴급 요청' })).toBeInTheDocument();
  });

  /* 사유를 비운 채 발행된 것도 있다 — 빈 칸을 「사유 없음」으로 단정하지 않는다. */
  it('사유가 비어 있으면 자리만 둔다', () => {
    renderPane({ workOrders: [workOrder({ remarks: '   ' })] });

    expect(screen.getByRole('cell', { name: t.reasonEmpty })).toBeInTheDocument();
  });

  /*
   * ⛔ **새로 발행하지 말라고 말해야 한다.** 「배포되지 않음」만 적으면 사용자는 새로 발행하고,
   * 그러면 같은 지시가 둘이 된다.
   */
  it('⛔ 새로 발행하면 지시가 둘이 된다는 사실을 적는다', () => {
    renderPane();

    expect(within(pane() as HTMLElement).getByText(t.lead)).toBeInTheDocument();
  });

  it('배포 재시도를 누르면 그 줄의 대상을 넘긴다', async () => {
    const { onRelease, user } = renderPane();

    await user.click(screen.getByRole('button', { name: t.retry }));

    expect(onRelease).toHaveBeenCalledWith({
      workOrderId: 7001,
      workOrderNo: 'SYN-WO-0007',
      orderQty: 200,
    });
  });

  /* ⛔ 되돌릴 수 없는 쓰기다 — 나가 있는 동안 다른 줄도 함께 잠근다. */
  it('⛔ 배포가 나가 있는 동안에는 어느 줄도 누를 수 없다', () => {
    renderPane({
      workOrders: [workOrder(), workOrder({ workOrderId: 7002, workOrderNo: 'SYN-WO-0008' })],
      total: 2,
      releasingId: 7001,
    });

    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled();
    }
  });

  it('배포 중인 줄은 그 사실을 말한다', () => {
    renderPane({ releasingId: 7001 });

    expect(screen.getByRole('button', { name: t.retrying })).toBeInTheDocument();
  });

  it('배포까지 가면 그 번호를 알린다', () => {
    renderPane({ releasedNo: 'SYN-WO-0007' });

    expect(screen.getByText(t.released('SYN-WO-0007'))).toBeInTheDocument();
  });

  /*
   * ⛔ **보내지 못한 것과 답을 못 받은 것을 갈라 말한다.** 「안 됐다」고 단언했다가 실제로
   * 됐으면 사용자가 두 번 배포한다.
   */
  it('⛔ 보내지 못한 것은 단언하고, 답을 못 받은 것은 단언하지 않는다', () => {
    renderPane({ failure: { workOrderNo: 'SYN-WO-0007', step: 'notSent' } });
    expect(screen.getByText(t.notSent('SYN-WO-0007'))).toBeInTheDocument();

    renderPane({ failure: { workOrderNo: 'SYN-WO-0007', step: 'unknown' } });
    expect(screen.getByText(t.releaseUnknown('SYN-WO-0007'))).toBeInTheDocument();
  });

  /* ⚠ 말하지 않으면 「이게 전부」로 읽어, 밀린 지시가 더 있는데 다 치웠다고 믿는다. */
  it('⚠ 목록이 잘렸으면 그 사실을 말한다', () => {
    renderPane({ total: 25 });

    expect(screen.getByText(t.truncated(1, 25))).toBeInTheDocument();
  });

  it('잘리지 않았으면 그 안내를 내지 않는다', () => {
    renderPane({ total: 1 });

    expect(screen.queryByText(t.truncated(1, 1))).not.toBeInTheDocument();
  });

  /* A-11 — 여기 없는 것을 밝힌다. 없는 이유까지 적어야 다른 데를 찾아보지 않는다. */
  it('품목명이 여기 없다는 사실을 적는다', () => {
    renderPane();

    expect(within(pane() as HTMLElement).getByText(t.itemNotShown)).toBeInTheDocument();
  });

  /* ⛔ 이 구획의 지시는 이미 만들어져 있다 — 낼 수 있는 액션은 배포뿐이다. */
  it('⛔ 여기서 새로 발행하거나 되돌리는 컨트롤을 두지 않는다', () => {
    renderPane();

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName(t.retry);
  });
});
