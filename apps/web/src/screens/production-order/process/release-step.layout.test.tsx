import { useState } from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { messages } from '@omf-mes/i18n';
import { renderWithProviders } from '../../../test/api-harness';
import { ReleaseStep, toReleaseLines } from './release-step';
import type { OrderWorkOrder } from './queries';
import type { SectionCheck } from './release-checks';

const t = messages.erpWorkOrderFlow.process.release;
const c = t.checks;
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
    /* 상세 머리는 고른 작업지시 번호다. 반영 사항은 고른 작업지시와 상관없이 전체 값이다. */
    expect(within(detail).getByRole('heading', { name: 'WO-2' })).toBeVisible();
    expect(screen.getByText(t.count(2))).toBeVisible();
    expect(screen.getByText(t.effects.lotsValue(6))).toBeVisible();
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
    expect(screen.getByText(t.count(2))).toBeVisible();
    expect(screen.getByText(t.effects.statusValue(2))).toBeVisible();
    expect(screen.getByRole('region', { name: '배포 작업지시' })).toBeVisible();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText(t.effects.lotsValue(6))).toBeVisible();
    await user.click(screen.getByRole('row', { name: 'WO-2 배포 상세' }));
    expect(screen.getByRole('row', { name: 'WO-2 배포 상세' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText(t.effects.lotsValue(6))).toBeVisible();
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
    expect(screen.getByText(t.effects.lotsPending)).toBeVisible();
    expect(screen.queryByText(t.effects.lotsValue(0))).not.toBeInTheDocument();
  });

  it('확인이 필요한 작업지시를 목록의 확인 칸과 건수로 보이고, 상세는 그 줄만 펼친 채로 연다', async () => {
    const user = userEvent.setup();
    const checkOf = (id: number): SectionCheck =>
      id === 1
        ? { state: 'warn', summary: [c.materialKinds(4)], alerts: [c.materialShort(1)] }
        : { state: 'ok', summary: [c.materialKinds(2)] };
    renderWithProviders(
      <ReleaseStep
        lines={toReleaseLines(workOrders, {}, new Map())}
        uomLabelOf={() => 'EA'}
        failures={[]}
        revealErrors={false}
        onLotSizeChange={() => {}}
        materialReview={(id) => <p>선택 자재 {id}</p>}
        materialCheckOf={checkOf}
      />,
    );
    expect(screen.getByText(t.needsCheck(1))).toBeVisible();
    const first = screen.getByRole('row', { name: 'WO-1 배포 상세' });
    const second = screen.getByRole('row', { name: 'WO-2 배포 상세' });
    expect(
      within(first).getByRole('img', { name: `${c.columns.material} ${c.warn}` }),
    ).toBeVisible();
    expect(
      within(second).getByRole('img', { name: `${c.columns.material} ${c.ok}` }),
    ).toBeVisible();
    /* 계획일을 모르는 작업지시의 계획 칸은 이상 없음이다(지난 계획일만 확인 필요). */
    expect(within(first).getByRole('img', { name: `${c.columns.plan} ${c.ok}` })).toBeVisible();

    const detail = within(screen.getByRole('region', { name: '선택 작업지시 배포 상세' }));
    const material = () => detail.getByRole('button', { name: new RegExp(c.material) });
    expect(material()).toHaveAttribute('aria-expanded', 'true');
    expect(material()).toHaveTextContent(c.materialShort(1));
    expect(detail.getByText('선택 자재 1')).toBeVisible();
    expect(detail.getByRole('button', { name: new RegExp(c.plan) })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    /* 이상 없는 작업지시로 옮기면 그 줄은 요약만 남는다. 손수 펼치면 작업지시를 바꿔도 펼친 채다. */
    await user.click(second);
    expect(material()).toHaveAttribute('aria-expanded', 'false');
    expect(material()).toHaveTextContent(c.materialKinds(2));
    expect(detail.queryByText('선택 자재 2')).toBeNull();
    await user.click(material());
    expect(detail.getByText('선택 자재 2')).toBeVisible();
    await user.click(first);
    expect(detail.getByText('선택 자재 1')).toBeVisible();
  });

  it('자재가 없는 작업지시는 회색 「대상 없음」 표시와 칩 하나만 두고 펼치지 않는다', () => {
    renderWithProviders(
      <ReleaseStep
        lines={toReleaseLines(workOrders, {}, new Map())}
        uomLabelOf={() => 'EA'}
        failures={[]}
        revealErrors={false}
        onLotSizeChange={() => {}}
        materialReview={(id) => <p>선택 자재 {id}</p>}
        materialCheckOf={() => ({ state: 'none', summary: [c.materialNone] })}
      />,
    );
    const first = screen.getByRole('row', { name: 'WO-1 배포 상세' });
    expect(
      within(first).getByRole('img', { name: `${c.columns.material} ${c.none}` }),
    ).toBeVisible();
    const detail = within(screen.getByRole('region', { name: '선택 작업지시 배포 상세' }));
    expect(detail.getByText(c.materialNone)).toBeVisible();
    expect(detail.queryByRole('button', { name: new RegExp(c.material) })).toBeNull();
    expect(detail.queryByText('선택 자재 1')).toBeNull();
    /* 대상 없음은 확인 필요로 세지 않는다. */
    expect(screen.queryByText(t.needsCheck(1))).toBeNull();
    expect(screen.queryByText(t.needsCheck(2))).toBeNull();
  });

  it('계획일이 지난 작업지시는 계획 칸이 확인 필요다 — 배포한 뒤에는 따지지 않는다', () => {
    const props = {
      lines: toReleaseLines(workOrders, {}, new Map()),
      uomLabelOf: () => 'EA',
      failures: [],
      revealErrors: false,
      onLotSizeChange: () => {},
      planDateOf: (planId: number) => (planId === 1 ? '2000-01-01' : null),
    };
    const { unmount } = renderWithProviders(<ReleaseStep {...props} />);
    const first = screen.getByRole('row', { name: 'WO-1 배포 상세' });
    expect(within(first).getByRole('img', { name: `${c.columns.plan} ${c.warn}` })).toBeVisible();
    expect(screen.getByText(c.planPast)).toBeVisible();
    expect(screen.getByText(t.needsCheck(1))).toBeVisible();
    unmount();

    renderWithProviders(<ReleaseStep {...props} readOnly />);
    expect(screen.queryByText(t.needsCheck(1))).toBeNull();
    expect(screen.queryByText(c.planPast)).toBeNull();
  });
});
