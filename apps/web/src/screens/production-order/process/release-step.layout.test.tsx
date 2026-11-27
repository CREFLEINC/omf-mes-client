import { useState } from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { messages } from '@omf-mes/i18n';
import { renderWithProviders } from '../../../test/api-harness';
import { ReleaseStep, toReleaseLines } from './release-step';
import type { OrderWorkOrder } from './queries';

const t = messages.erpWorkOrderFlow.process.release;
const workOrders: OrderWorkOrder[] = [1, 2].map((id) => ({
  workOrderId: id,
  workOrderNo: `WO-${id}`,
  productionPlanId: id,
  operationName: '사출',
  orderQty: 100,
  uomId: 1,
  itemId: 1,
  statusCode: 'PLANNED',
  priorityNo: 1,
}));

describe('배포 대상 상세', () => {
  it('작업지시 선택 변경 시 상세 상단으로 이동하고 최초 로드에는 이동하지 않는다', async () => {
    const previous = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
    const scroll = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scroll,
    });
    try {
      const user = userEvent.setup();
      renderWithProviders(
        <ReleaseStep
          lines={toReleaseLines(workOrders, {}, new Map())}
          uomLabelOf={() => 'EA'}
          failures={[]}
          revealErrors={false}
          onLotSizeChange={() => {}}
        />,
      );
      expect(scroll).not.toHaveBeenCalled();
      await user.click(screen.getByRole('row', { name: 'WO-2 배포 상세' }));
      expect(scroll).toHaveBeenCalledWith({ block: 'start', inline: 'nearest', behavior: 'auto' });
      expect(scroll.mock.instances[0]).toBe(
        screen.getByRole('region', { name: '선택 작업지시 배포 상세' }),
      );
    } finally {
      if (previous) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', previous);
      else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
    }
  });

  it('배포 완료 조회에서 안내만 반복하는 LOT 열은 표시하지 않는다', () => {
    renderWithProviders(
      <ReleaseStep
        readOnly
        lines={toReleaseLines(workOrders, {}, new Map())}
        uomLabelOf={() => 'EA'}
        failures={[]}
        revealErrors={false}
        onLotSizeChange={() => {}}
      />,
    );
    expect(screen.queryByText('배포 결과에서 확인')).toBeNull();
    expect(screen.queryByRole('columnheader', { name: /^LOT$/ })).toBeNull();
  });
  it('행을 선택하면 해당 상세만 표시하고 전체 배포 범위는 유지한다', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ReleaseStep
        lines={toReleaseLines(
          workOrders,
          {},
          new Map([
            [1, 25],
            [2, 50],
          ]),
        )}
        uomLabelOf={() => 'EA'}
        failures={[]}
        revealErrors={false}
        onLotSizeChange={() => {}}
        materialReview={(id) => <p>선택 자재 {id}</p>}
      />,
    );
    const detail = screen.getByRole('region', { name: '선택 작업지시 배포 상세' });
    expect(within(detail).getByText('선택 자재 1')).toBeVisible();
    expect(within(detail).queryByText('선택 자재 2')).toBeNull();
    await user.click(screen.getByRole('row', { name: 'WO-2 배포 상세' }));
    expect(within(detail).getByText('선택 자재 2')).toBeVisible();
    expect(within(detail).queryByText('선택 자재 1')).toBeNull();
    expect(within(detail).getByRole('heading', { name: '선택 작업지시 상세' })).toBeVisible();
    expect(screen.getByText(t.scope(2))).toBeVisible();
    expect(screen.getByText(t.effects.lots(6))).toBeVisible();
  });
  it('LOT 입력 없이 품목 기본값의 생성 수와 전체 배포 범위를 유지한다', async () => {
    const user = userEvent.setup();
    const Harness = () => {
      const [sizes, setSizes] = useState<Record<number, string>>({});
      return (
        <ReleaseStep
          lines={toReleaseLines(
            workOrders,
            sizes,
            new Map([
              [1, 25],
              [2, 50],
            ]),
          )}
          uomLabelOf={() => 'EA'}
          failures={[]}
          revealErrors={false}
          onLotSizeChange={(id, value) => setSizes((current) => ({ ...current, [id]: value }))}
        />
      );
    };
    renderWithProviders(<Harness />);
    expect(screen.getByText(t.scope(2))).toBeVisible();
    expect(screen.queryByText(t.scopeHelp)).toBeNull();
    expect(screen.getByRole('region', { name: '배포 작업지시' })).toBeVisible();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText(t.effects.lots(6))).toBeVisible();
    await user.click(screen.getByRole('row', { name: 'WO-2 배포 상세' }));
    expect(screen.getByRole('row', { name: 'WO-2 배포 상세' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText(t.effects.lots(6))).toBeVisible();
    await user.click(screen.getByRole('row', { name: 'WO-1 배포 상세' }));
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('LOT 크기가 정해지지 않았을 때 생성 LOT 수를 0으로 단정하지 않는다', () => {
    renderWithProviders(
      <ReleaseStep
        lines={toReleaseLines(workOrders, {}, new Map())}
        uomLabelOf={() => 'EA'}
        failures={[]}
        revealErrors={false}
        onLotSizeChange={() => {}}
      />,
    );
    expect(screen.getByText(t.lotsPending)).toBeVisible();
    expect(screen.queryByText(t.effects.lots(0))).not.toBeInTheDocument();
  });
});
