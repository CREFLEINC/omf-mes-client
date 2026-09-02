import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ExpansionState } from './expansion';
import { ExpansionPane, type ExpansionPaneProps } from './expansion-pane';
import type { Bom, Routing, RoutingOperation } from './types';

const t = messages.emergencyWorkOrder.expansion;

const bom = (overrides: Partial<Bom> = {}): Bom => ({
  bomId: 71,
  parentItemId: 5001,
  bomCode: 'SYN-BOM-0001',
  bomVersion: 3,
  statusCode: 'SYN_ACTIVE',
  isDefault: true,
  effectiveFrom: '2026-01-01',
  baseQty: 1,
  baseUomId: 11,
  ...overrides,
});

const routing = (overrides: Partial<Routing> = {}): Routing => ({
  routingId: 31,
  itemId: 5001,
  routingCode: 'SYN-RT-0001',
  routingVersion: 2,
  statusCode: 'SYN_ACTIVE',
  isDefault: true,
  ...overrides,
});

const operation = (overrides: Partial<RoutingOperation> = {}): RoutingOperation => ({
  routingOperationId: 901,
  routingId: 31,
  operationSeq: 10,
  processId: 41,
  operationName: '사출',
  mesManaged: true,
  materialInputManaged: true,
  productionResultManaged: true,
  inspectionManaged: false,
  isOutsourced: false,
  outputLotRequired: true,
  equipmentRequired: false,
  moldRequired: false,
  ...overrides,
});

const READY: ExpansionState = {
  kind: 'ready',
  bom: bom(),
  routing: routing(),
  operations: [
    operation(),
    operation({ routingOperationId: 902, operationSeq: 20, operationName: '조립' }),
  ],
};

const renderPane = (overrides: Partial<ExpansionPaneProps> = {}) => {
  const onSelectRouting = vi.fn();

  render(
    <ExpansionPane
      state={READY}
      orderQtyText="200"
      selectedRoutingId={31}
      onSelectRouting={onSelectRouting}
      {...overrides}
    />,
  );

  return { onSelectRouting, region: screen.getByRole('region', { name: t.title }) };
};

describe('ExpansionPane', () => {
  it('BOM 과 Routing 을 개정까지 함께 보인다 — 어느 판으로 나가는지가 사실이다', () => {
    const { region } = renderPane();

    expect(within(region).getByText(/SYN-BOM-0001/)).toHaveTextContent('3');
    expect(within(region).getByText(/SYN-RT-0001/)).toHaveTextContent('2');
  });

  it('공정을 순서·이름·수량으로 보인다', () => {
    const { region } = renderPane();
    const rows = within(region).getAllByRole('row');

    expect(rows.length).toBeGreaterThan(2);
    expect(within(region).getByText('사출')).toBeInTheDocument();
    expect(within(region).getByText('조립')).toBeInTheDocument();
    expect(within(region).getAllByText('200')).toHaveLength(2);
  });

  it('⚠ LOT 을 화면이 나눈 사실을 밝힌다 — 조용히 정하지 않는다', () => {
    const { region } = renderPane();

    expect(within(region).getByText(t.lotNotice)).toBeInTheDocument();
  });

  describe('개정 고르기', () => {
    const NEEDS: ExpansionState = {
      kind: 'needsRevision',
      routings: [
        routing(),
        routing({ routingId: 32, routingVersion: 3, statusCode: 'SYN_OBSOLETE' }),
      ],
    };

    it('고를 개정을 전부 내준다', async () => {
      const { onSelectRouting, region } = renderPane({ state: NEEDS, selectedRoutingId: null });
      const user = userEvent.setup();

      await user.click(within(region).getByLabelText(t.revisionLabel));
      await user.click(screen.getByRole('option', { name: /SYN-RT-0001 개정 3/ }));

      expect(onSelectRouting).toHaveBeenCalledWith(32);
    });

    it('⛔ 개정의 상태를 값 옆에 그대로 보인다 — 지우지 않고 보고 고르게 한다', async () => {
      const { region } = renderPane({ state: NEEDS, selectedRoutingId: null });
      const user = userEvent.setup();

      await user.click(within(region).getByLabelText(t.revisionLabel));

      expect(screen.getByRole('option', { name: /SYN_OBSOLETE/ })).toBeInTheDocument();
    });

    /*
     * ⚠ **여럿이면 알리고, 화면이 대신 고르지 않는다.** 「최신」을 골라 주면 사용자가 고른
     * 적 없는 개정으로 되돌릴 수 없는 지시가 나간다.
     */
    it('⚠ 쓸 수 있는 개정이 여럿이면 그 사실과 개수를 알린다', () => {
      const { region } = renderPane({ state: NEEDS, selectedRoutingId: null });

      expect(within(region).getByText(t.revisionMultiple(2))).toBeInTheDocument();
    });

    it('⛔ 하나뿐이면 「직접 고르세요」로 다그치지 않는다 — 고를 것이 없다', () => {
      const { region } = renderPane({
        state: { kind: 'needsRevision', routings: [routing()] },
        selectedRoutingId: null,
      });

      expect(within(region).queryByText(t.revisionMultiple(1))).not.toBeInTheDocument();
    });

    /*
     * ⭐ **자재 명세는 자동, 공정 순서는 수동.** 적지 않으면 일관성 없는 화면으로 읽히고,
     * 사용자가 규칙을 스스로 지어낸다.
     */
    it('⭐ 자재 명세와 동작이 갈리는 이유를 적는다', () => {
      const { region } = renderPane({ state: NEEDS, selectedRoutingId: null });

      expect(within(region).getByText(t.revisionChoiceReason)).toBeInTheDocument();
    });
  });

  describe('아직 볼 것이 없을 때', () => {
    it('고르기 전에는 무엇을 하면 되는지 적는다', () => {
      const { region } = renderPane({ state: { kind: 'idle' } });

      expect(within(region).getByText(t.selectItem)).toBeInTheDocument();
    });

    it('받는 중임을 알린다', () => {
      const { region } = renderPane({ state: { kind: 'loading' } });

      expect(within(region).getByRole('status')).toHaveTextContent(t.loading);
    });

    it('조회 실패를 알린다 — 빈 표로 두지 않는다', () => {
      const { region } = renderPane({ state: { kind: 'error' } });

      expect(within(region).getByText(t.loadError)).toBeInTheDocument();
    });

    it.each([
      ['고르기 전', { kind: 'idle' } as ExpansionState],
      ['받는 중', { kind: 'loading' } as ExpansionState],
      ['조회 실패', { kind: 'error' } as ExpansionState],
      ['BOM 없음', { kind: 'blocked', reason: 'bomMissing' } as ExpansionState],
    ])('⛔ %s 에는 전개 표를 그리지 않는다 — 없는 것을 있는 것처럼 두지 않는다', (_name, state) => {
      const { region } = renderPane({ state });

      expect(within(region).queryByRole('table')).not.toBeInTheDocument();
    });
  });

  /*
   * 막힌 사유는 발행 버튼 옆 한 곳에서만 말한다. 여기서도 말하면 한쪽만 고쳐질 때 화면이
   * 스스로와 어긋난다 — 이 구획은 「무엇이 펼쳐졌는가」만 맡는다.
   */
  it('⛔ 막힌 사유를 여기서 되풀이하지 않는다 — 사유는 한 곳에서만 말한다', () => {
    const { region } = renderPane({ state: { kind: 'blocked', reason: 'bomMissing' } });
    const lock = messages.emergencyWorkOrder.lock;

    expect(within(region).queryByText(lock.blocked.bomMissing)).not.toBeInTheDocument();
  });
});
