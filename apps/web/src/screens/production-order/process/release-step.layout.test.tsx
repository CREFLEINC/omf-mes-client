import { useState } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
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
    expect(screen.getByText(t.scopeHelp)).toBeVisible();
    expect(screen.getByRole('region', { name: '배포 작업지시' })).toBeVisible();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText(t.effects.lots(6))).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'WO-2 상세 확인' }));
    expect(screen.getByRole('button', { name: 'WO-2 상세 확인' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText(t.effects.lots(6))).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'WO-1 상세 확인' }));
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
