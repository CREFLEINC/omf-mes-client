import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages, setLocale } from '@omf-mes/i18n';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { SessionProvider } from '../../patterns/session';
import {
  A,
  P3,
  P4,
  backwardTreeOf,
  newCalls,
  startsOf,
  traceStubRoutes,
  type TraceStubOptions,
} from '../../patterns/trace-tree/trace-fixtures';
import { createStubFetch, renderWithProviders } from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import { ProductTraceScreen } from './screen';

const t = messages.traceTree;

const Location = () => {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};
const search = () => new URLSearchParams(screen.getByTestId('location').textContent?.split('?')[1]);

const setup = (route = '/production/product-trace', options: Partial<TraceStubOptions> = {}) => {
  const calls = newCalls();
  renderWithProviders(
    <SessionProvider>
      <ProductTraceScreen />
      <Location />
    </SessionProvider>,
    {
      route,
      session: { ...SYNTHETIC_SESSION, permissions: ['W-02-13', 'W-02-14'] },
      fetch: createStubFetch(
        traceStubRoutes(
          {
            direction: 'BACKWARD',
            recent: [P3, P4],
            lotNos: { 303: P3.lot.lotNo, 304: P4.lot.lotNo },
            starts: {
              [P3.lot.lotNo]: startsOf('PRODUCT_LOT_NO', P3.lot.lotNo, [P3]),
              'SH-SYN-0001': startsOf('SHIPMENT_NO', 'SH-SYN-0001', [P3, P4]),
              'SN-1': startsOf('SERIAL_NO', 'SN-1', [P3], { serialNo: 'SN-1' }),
              [A.lot.lotNo]: startsOf('MATERIAL_LOT_NO', A.lot.lotNo, [A], {
                otherDirection: true,
              }),
            },
            tree: (lotId, serialNo) =>
              lotId === P4.lot.lotId
                ? {
                    ...backwardTreeOf(lotId, P4.lot.lotNo),
                    endRows: [],
                    edges: [],
                    nodes: backwardTreeOf(lotId, P4.lot.lotNo).nodes.slice(0, 1),
                    rootShipments: [],
                  }
                : backwardTreeOf(lotId, P3.lot.lotNo, serialNo),
            ...options,
          },
          calls,
        ),
      ),
    },
  );
  return { calls, user: userEvent.setup() };
};

const listTable = () =>
  within(screen.getByRole('region', { name: t.list.pane })).getByRole('table');
const listRows = () => within(listTable()).getAllByRole('row').slice(1);
const scanBox = () => screen.getByLabelText(t.product.scanLabel);
const detail = () => screen.getByRole('region', { name: t.detail.pane });

describe('W-02-14 제품 기준 역추적', () => {
  it('Q2 · US3-2 열면 최근 목록에 「출하」·「입고」가 함께 서고 아무것도 고르지 않는다', async () => {
    setup();
    await waitFor(() => expect(listRows()).toHaveLength(2));
    expect(within(listTable()).getByText(t.list.sortKinds.SHIPPED)).toBeInTheDocument();
    expect(within(listTable()).getByText(t.list.sortKinds.RECEIVED)).toBeInTheDocument();
    expect(within(detail()).getByText(t.detail.pickTitle)).toBeInTheDocument();
  });

  it('Q9 · US2-1 P3 를 스캔하면 골라져 계보 · 투입 원자재 LOT(공급사 · 공급사 LOT · IQC) · 요약의 출하가 선다', async () => {
    const { calls, user } = setup();
    await waitFor(() => expect(listRows()).toHaveLength(2));
    await user.type(scanBox(), `${P3.lot.lotNo}{Enter}`);
    await waitFor(() => expect(search().get('lot')).toBe(String(P3.lot.lotId)));
    const tree = await within(detail()).findByRole('table', { name: t.tree.caption });
    expect(within(tree).getByText('IL-1')).toBeInTheDocument();
    const end = within(detail()).getByRole('table', { name: t.product.endTitle });
    expect(within(end).getByText('공급사 S, SUP-A')).toBeInTheDocument();
    expect(within(end).getByTitle(/^입하일 (2026-)?11-01$/)).toHaveTextContent('IL-1');
    expect(within(end).getByText('합격')).toBeInTheDocument();
    expect(within(detail()).getByText(/SH-SYN-0001/)).toBeInTheDocument();
    expect(calls.trees.at(-1)?.pathname).toBe('/trace/backward-tree');
    expect(calls.trees.at(-1)?.searchParams.has('serialNo')).toBe(false);
  });

  it('Q10 · US2-2 출하번호를 스캔하면 배분 LOT 들이 들어오고(줄에 출하번호) 고르지 않는다', async () => {
    const { user } = setup();
    await waitFor(() => expect(listRows()).toHaveLength(2));
    await user.type(scanBox(), 'SH-SYN-0001{Enter}');
    await waitFor(() =>
      expect(
        within(listTable()).getAllByText(`${t.matchedBy.SHIPMENT_NO} SH-SYN-0001`),
      ).toHaveLength(2),
    );
    expect(search().has('lot')).toBe(false);
  });

  it('Q10 · US2-3 시리얼을 스캔하면 그 LOT 이 골라지고 serialNo 로 불러 계보 맨 위가 시리얼이다', async () => {
    const { calls, user } = setup();
    await waitFor(() => expect(listRows()).toHaveLength(2));
    await user.type(scanBox(), 'SN-1{Enter}');
    await waitFor(() => expect(search().get('serial')).toBe('SN-1'));
    expect(search().get('lot')).toBe(String(P3.lot.lotId));
    const tree = await within(detail()).findByRole('table', { name: t.tree.caption });
    expect(calls.trees.at(-1)?.searchParams.get('serialNo')).toBe('SN-1');
    const firstRow = within(tree).getAllByRole('row')[1] as HTMLElement;
    expect(within(firstRow).getByText(t.tree.stages.SERIAL)).toBeInTheDocument();
    expect(within(firstRow).getByText('SN-1')).toBeInTheDocument();
  });

  it('US2-5 · Q16 투입 기록이 없으면 「투입 자재 기록이 없습니다」', async () => {
    setup(`/production/product-trace?lot=${String(P4.lot.lotId)}`);
    expect(await within(detail()).findByText(t.product.endEmpty)).toBeInTheDocument();
  });

  it('Q13 자재 LOT 번호는 「자재 기준 생산 추적에서 열기」를 보이고 목록은 그대로', async () => {
    const { user } = setup();
    await waitFor(() => expect(listRows()).toHaveLength(2));
    await user.type(scanBox(), `${A.lot.lotNo}{Enter}`);
    expect(await screen.findByText(t.product.otherTitle)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.product.otherOpen })).toBeInTheDocument();
    expect(listRows()).toHaveLength(2);
  });

  it('US4-1 시리얼로 들어온 줄은 내보낼 때 시리얼을 함께 보낸다', async () => {
    const { calls, user } = setup();
    await waitFor(() => expect(listRows()).toHaveLength(2));
    await user.type(scanBox(), 'SN-1{Enter}');
    await waitFor(() => expect(search().get('serial')).toBe('SN-1'));
    await user.click(screen.getByRole('button', { name: t.export }));
    await waitFor(() => expect(calls.exports).toHaveLength(1));
    const body = (await calls.exports[0]?.clone().json()) as {
      lotIds: number[];
      serialNos: Record<string, string>;
    };
    expect(body.lotIds).toEqual([P3.lot.lotId]);
    expect(body.serialNos).toEqual({ [String(P3.lot.lotId)]: 'SN-1' });
    expect(calls.exports[0]?.url).toContain('/trace/backward-exports');
  });

  it('US4-1 앱이 베트남어면 내보내기 파일 언어도 vi 로 보낸다', async () => {
    setLocale('vi');
    try {
      const { calls, user } = setup();
      await waitFor(() => expect(listRows()).toHaveLength(2));
      await user.click(screen.getByRole('button', { name: t.export }));
      await waitFor(() => expect(calls.exports).toHaveLength(1));
      const body = (await calls.exports[0]?.clone().json()) as { language: string };
      expect(body.language).toBe('vi');
    } finally {
      setLocale('ko');
    }
  });

  /* 피처 016 · 시안 ④ — 계보 W/O 줄은 번호 뒤에 공정 순번(「W/O WO-… · 공정 30」). */
  it('US2-6 · Q13 계보의 W/O 줄은 번호 뒤에 공정 순번을 붙인다', async () => {
    setup(`/production/product-trace?lot=${String(P3.lot.lotId)}`, {
      tree: (lotId, serialNo) => {
        const base = backwardTreeOf(lotId, P3.lot.lotNo, serialNo);
        return {
          ...base,
          nodes: base.nodes.map((node) =>
            node.workOrder === undefined
              ? node
              : { ...node, workOrder: { ...node.workOrder, operationSeq: 30 } },
          ),
        };
      },
    });
    const tree = await within(detail()).findByRole('table', { name: t.tree.caption });
    expect(within(tree).getByText('WO-SYN-0002')).toBeInTheDocument();
    expect(within(tree).getByText('· 공정 30')).toBeInTheDocument();
  });
});
