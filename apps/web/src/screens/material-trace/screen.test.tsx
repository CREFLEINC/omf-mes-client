import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ko, messages, vi } from '@omf-mes/i18n';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { SessionProvider } from '../../patterns/session';
import {
  PLANT,
  PLANT2,
  A,
  B,
  C,
  P3,
  forwardTreeOf,
  lonelyTreeOf,
  newCalls,
  startsOf,
  traceStubRoutes,
  type TraceStubOptions,
} from '../../patterns/trace-tree/trace-fixtures';
import { createStubFetch, renderWithProviders } from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import { MaterialTraceScreen, fateColumnWidth } from './screen';

const t = messages.traceTree;

const Location = () => {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};
const search = () => new URLSearchParams(screen.getByTestId('location').textContent?.split('?')[1]);

const setup = (
  route = '/production/material-trace',
  options: Partial<TraceStubOptions> = {},
  permissions = ['W-02-13', 'W-02-14'],
) => {
  const calls = newCalls();
  const lotNos: Record<number, string> = { 201: A.lot.lotNo, 202: B.lot.lotNo, 203: C.lot.lotNo };
  renderWithProviders(
    <SessionProvider>
      <MaterialTraceScreen />
      <Location />
    </SessionProvider>,
    {
      route,
      session: { ...SYNTHETIC_SESSION, scopes: [], permissions },
      fetch: createStubFetch(
        traceStubRoutes(
          {
            direction: 'FORWARD',
            recent: [A, B, C],
            lotNos,
            starts: {
              [A.lot.lotNo]: startsOf('MATERIAL_LOT_NO', A.lot.lotNo, [A]),
              [B.lot.lotNo]: startsOf('MATERIAL_LOT_NO', B.lot.lotNo, [B]),
              [C.lot.lotNo]: startsOf('MATERIAL_LOT_NO', C.lot.lotNo, [C]),
              'IL-1': startsOf('INBOUND_LOT_NO', 'IL-1', [A, C]),
              [P3.lot.lotNo]: startsOf('PRODUCT_LOT_NO', P3.lot.lotNo, [P3], {
                otherDirection: true,
              }),
            },
            tree: (lotId) =>
              lotId === C.lot.lotId
                ? lonelyTreeOf(lotId, C.lot.lotNo)
                : forwardTreeOf(lotId, lotId === B.lot.lotId ? B.lot.lotNo : A.lot.lotNo),
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
const scanBox = () => screen.getByLabelText(t.material.scanLabel);
const detail = () => screen.getByRole('region', { name: t.detail.pane });

describe('W-02-13 자재 기준 생산 추적', () => {
  it('Q1 · US3-1 열면 최근 목록이 서고 아무것도 고르지 않는다', async () => {
    setup();
    await waitFor(() => expect(listRows()).toHaveLength(3));
    expect(screen.getByText(t.list.recentTitle)).toBeInTheDocument();
    expect(within(detail()).getByText(t.detail.pickTitle)).toBeInTheDocument();
    expect(screen.getByText(t.material.recentFoot)).toBeInTheDocument();
    expect(search().has('lot')).toBe(false);
  });

  it('Q3 · US1-1 A 를 스캔하면 목록이 A 하나로 바뀌고 골라져 계보 · 영향 제품 LOT 이 선다', async () => {
    const { calls, user } = setup();
    await waitFor(() => expect(listRows()).toHaveLength(3));
    await user.type(scanBox(), `${A.lot.lotNo}{Enter}`);

    await waitFor(() => expect(search().get('lot')).toBe(String(A.lot.lotId)));
    await waitFor(() => expect(listRows()).toHaveLength(1));
    expect(screen.getByText(t.list.scanTitle)).toBeInTheDocument();
    /* 계보 — 반제품 P1 을 지나 출하까지 [보기] 없이 */
    const tree = await within(detail()).findByRole('table', { name: t.tree.caption });
    expect(within(tree).getByText('WO-SYN-0002')).toBeInTheDocument();
    expect(within(tree).getByText('SH-SYN-0001')).toBeInTheDocument();
    expect(within(tree).getByText(t.tree.stages.SEMI_LOT)).toBeInTheDocument();
    /* 요약 — 입하 LOT · 공급사 · 공급사 LOT · IQC 결과 */
    const summary = within(detail()).getByRole('region', { name: t.detail.base });
    expect(within(summary).getByText('SUP-A')).toBeInTheDocument();
    expect(within(summary).getByText('합격')).toBeInTheDocument();
    /* 영향 제품 LOT — 완제품(출하) · 반제품 P2(재고), 반제품 P1 은 없음 */
    const end = within(detail()).getByRole('table', { name: t.material.endTitle });
    expect(within(end).getByText('고객 X SH-SYN-0001')).toBeInTheDocument();
    expect(within(end).getByText('생산창고 (WH-P) / L-02 (L-02)')).toBeInTheDocument();
    expect(within(end).queryByTitle('PL-SYN-0001-A01')).toBeNull();
    expect(calls.trees).toHaveLength(1);
    expect(calls.trees[0]?.searchParams.get('lotId')).toBe(String(A.lot.lotId));
  });

  it('Q5 · US3-3 이어 스캔하면 쌓이고, 이미 있는 LOT 은 더하지 않고 고른다', async () => {
    const { user } = setup();
    await waitFor(() => expect(listRows()).toHaveLength(3));
    await user.type(scanBox(), `${A.lot.lotNo}{Enter}`);
    await waitFor(() => expect(listRows()).toHaveLength(1));
    await user.clear(scanBox());
    await user.type(scanBox(), `${B.lot.lotNo}{Enter}`);
    await waitFor(() => expect(listRows()).toHaveLength(2));
    await waitFor(() => expect(search().get('lot')).toBe(String(B.lot.lotId)));
    await user.clear(scanBox());
    await user.type(scanBox(), `${A.lot.lotNo}{Enter}`);
    await waitFor(() => expect(search().get('lot')).toBe(String(A.lot.lotId)));
    expect(listRows()).toHaveLength(2);
  });

  it('Q6 · US3-4 입하 LOT 번호는 그 LOT 들을 넣고 고르지 않는다', async () => {
    const { user } = setup();
    await waitFor(() => expect(listRows()).toHaveLength(3));
    await user.type(scanBox(), 'IL-1{Enter}');
    await waitFor(() => expect(listRows()).toHaveLength(2));
    expect(within(listTable()).getAllByText(`${t.matchedBy.INBOUND_LOT_NO} IL-1`)).toHaveLength(2);
    expect(search().has('lot')).toBe(false);
  });

  it('목록에서 다른 줄을 고르면 그 LOT 으로 다시 부른다', async () => {
    const { calls, user } = setup();
    await waitFor(() => expect(listRows()).toHaveLength(3));
    await user.click(listRows()[1] as HTMLElement);
    await waitFor(() =>
      expect(calls.trees.at(-1)?.searchParams.get('lotId')).toBe(String(B.lot.lotId)),
    );
    await user.click(listRows()[0] as HTMLElement);
    await waitFor(() =>
      expect(calls.trees.at(-1)?.searchParams.get('lotId')).toBe(String(A.lot.lotId)),
    );
  });

  it('Q19 · US1-5 접기 · 펴기는 다시 부르지 않고, 계보의 LOT 번호를 누르면 목록에 더해 고른다', async () => {
    const { calls, user } = setup(`/production/material-trace?lot=${String(A.lot.lotId)}`, {
      starts: {
        [A.lot.lotNo]: startsOf('MATERIAL_LOT_NO', A.lot.lotNo, [A]),
        'PL-SYN-0001-A01': startsOf('MATERIAL_LOT_NO', 'PL-SYN-0001-A01', [
          {
            ...A,
            lot: { ...A.lot, lotId: 301, lotNo: 'PL-SYN-0001-A01', lotTypeCode: 'PRODUCTION' },
          },
        ]),
      },
    });
    const tree = await within(detail()).findByRole('table', { name: t.tree.caption });
    const before = calls.trees.length;
    await user.click(within(tree).getByRole('button', { name: t.tree.collapse('WO-SYN-0001') }));
    expect(within(tree).queryByText('SH-SYN-0001')).toBeNull();
    await user.click(within(tree).getByRole('button', { name: t.tree.expand('WO-SYN-0001') }));
    expect(within(tree).getByText('SH-SYN-0001')).toBeInTheDocument();
    expect(calls.trees).toHaveLength(before);

    await user.click(within(tree).getByRole('button', { name: 'PL-SYN-0001-A01' }));
    await waitFor(() => expect(search().get('lot')).toBe('301'));
    expect(listRows()).toHaveLength(2);
  });

  it('FR-003 주소 ?lot= 로 들어오면 그 LOT 을 목록에 넣고 고른다', async () => {
    setup(`/production/material-trace?lot=${String(B.lot.lotId)}`);
    await waitFor(() => expect(listRows()).toHaveLength(1));
    expect(within(listTable()).getByText(B.lot.lotNo)).toBeInTheDocument();
    expect(
      await within(detail()).findByRole('table', { name: t.tree.caption }),
    ).toBeInTheDocument();
  });

  it('US1-4 · Q16 투입되지 않은 LOT 은 「아직 생산에 투입되지 않았습니다」', async () => {
    setup(`/production/material-trace?lot=${String(C.lot.lotId)}`);
    expect(await within(detail()).findByText(t.material.endEmpty)).toBeInTheDocument();
  });

  it('Q15 상한에 걸린 계보는 「더 있습니다 — 일부만 보입니다」', async () => {
    setup(`/production/material-trace?lot=${String(A.lot.lotId)}`, {
      tree: (lotId) => ({
        ...forwardTreeOf(lotId, A.lot.lotNo),
        limit: { exceeded: true, maxDepthReached: false, lotCount: 5001, lotCap: 5000 },
      }),
    });
    expect(await within(detail()).findByText(t.detail.partialTitle)).toBeInTheDocument();
  });

  it('Q18 영향 제품 LOT 줄을 고르면 계보에서 그 LOT 까지 펴고 표시한다', async () => {
    const { user } = setup(`/production/material-trace?lot=${String(A.lot.lotId)}`);
    const tree = await within(detail()).findByRole('table', { name: t.tree.caption });
    await user.click(within(detail()).getByRole('button', { name: t.tree.collapseAll }));
    expect(within(tree).queryByText('SH-SYN-0001')).toBeNull();
    const end = within(detail()).getByRole('table', { name: t.material.endTitle });
    await user.click(within(end).getByRole('row', { name: t.end.openRow('PL-SYN-0002-A01') }));
    expect(within(tree).getByText(t.tree.located)).toBeInTheDocument();
    expect(within(tree).getByText('PL-SYN-0002-A01')).toBeInTheDocument();
  });

  it('Q13 제품 LOT 번호는 목록을 바꾸지 않고 「제품 기준 역추적에서 열기」를 보인다', async () => {
    const { user } = setup();
    await waitFor(() => expect(listRows()).toHaveLength(3));
    await user.type(scanBox(), `${P3.lot.lotNo}{Enter}`);
    expect(await screen.findByText(t.material.otherTitle)).toBeInTheDocument();
    expect(listRows()).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: t.material.otherOpen }));
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        `/production/product-trace?lot=${String(P3.lot.lotId)}`,
      ),
    );
  });

  it('Q14 없는 번호는 「찾을 수 없는 번호입니다」, 목록 · 고른 LOT 그대로', async () => {
    const { user } = setup();
    await waitFor(() => expect(listRows()).toHaveLength(3));
    await user.type(scanBox(), 'NOPE{Enter}');
    expect(await screen.findByText(t.scan.notFoundTitle)).toBeInTheDocument();
    expect(listRows()).toHaveLength(3);
  });

  it('Q8 [최근 목록으로]는 스캔 목록과 고른 LOT 을 지운다', async () => {
    const { user } = setup();
    await waitFor(() => expect(listRows()).toHaveLength(3));
    await user.type(scanBox(), `${A.lot.lotNo}{Enter}`);
    await waitFor(() => expect(listRows()).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: t.backToRecent }));
    await waitFor(() => expect(listRows()).toHaveLength(3));
    expect(search().has('lot')).toBe(false);
    expect(within(detail()).getByText(t.detail.pickTitle)).toBeInTheDocument();
  });

  it('Q7 공급사 + 기간 조건(주소) — 「150개 중 100개」, [더 보기]가 다음 쪽을 붙인다', async () => {
    const page = (n: number) =>
      Array.from({ length: n === 1 ? 100 : 50 }, (_, index) => ({
        ...A,
        lot: {
          ...A.lot,
          lotId: 1000 + (n - 1) * 100 + index,
          lotNo: `L-${String(n)}-${String(index)}`,
        },
        sortDateKind: 'INBOUND' as const,
      }));
    const { calls, user } = setup(
      '/production/material-trace?partner=7&from=2026-10-26&to=2026-11-24',
      {
        condition: page,
        conditionTotal: 150,
      },
    );
    await waitFor(() => expect(listRows()).toHaveLength(100));
    expect(screen.getByText(t.list.ofTotal(100, 150))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.list.more(50, 50) }));
    await waitFor(() => expect(listRows()).toHaveLength(150));
    expect(calls.lists.at(-1)?.searchParams.get('page')).toBe('2');
    expect(search().has('lot')).toBe(false);
  });

  it('US4-1 [엑셀 내보내기]는 지금 목록의 LOT 을 서버에 보낸다', async () => {
    const { calls, user } = setup();
    await waitFor(() => expect(listRows()).toHaveLength(3));
    await user.click(screen.getByRole('button', { name: t.export }));
    await waitFor(() => expect(calls.exports).toHaveLength(1));
    const body = (await calls.exports[0]?.clone().json()) as {
      lotIds: number[];
      plantId: number;
      language: string;
    };
    expect(body.lotIds).toEqual([A.lot.lotId, B.lot.lotId, C.lot.lotId]);
    expect(body.plantId).toBe(8401);
    /* 파일 언어는 화면 언어 */
    expect(body.language).toBe('ko');
  });

  it('US3-7 · Q8 [최근 목록으로]는 최근 100 밖의 고른 LOT 을 다시 목록에 넣지 않고 선택을 푼다', async () => {
    const outside = { ...A, lot: { ...A.lot, lotId: 999, lotNo: 'OUT-0001' } };
    const { user } = setup('/production/material-trace?lot=999', {
      lotNos: { 999: 'OUT-0001' },
      starts: { 'OUT-0001': startsOf('MATERIAL_LOT_NO', 'OUT-0001', [outside]) },
    });
    await waitFor(() => expect(listRows()).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: t.backToRecent }));
    await waitFor(() => expect(search().has('lot')).toBe(false));
    await waitFor(() => expect(listRows()).toHaveLength(3));
    expect(screen.getByText(t.list.recentTitle)).toBeInTheDocument();
    expect(within(detail()).getByText(t.detail.pickTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.list.scanTitle)).toBeNull();
  });

  it('Q21 · SC-005 여러 공장 계정이 공장 없이 ?lot= 으로 들어오면 그 LOT 의 공장으로 연다', async () => {
    const { calls } = setup(`/production/material-trace?lot=${String(B.lot.lotId)}`, {
      plants: [PLANT, PLANT2],
      lotPlants: { [B.lot.lotId]: PLANT2.plantId },
    });
    await waitFor(() => expect(search().get('plant')).toBe(String(PLANT2.plantId)));
    await waitFor(() => expect(calls.trees.length).toBeGreaterThan(0));
    expect(
      calls.trees.every((url) => url.searchParams.get('plantId') === String(PLANT2.plantId)),
    ).toBe(true);
    expect(within(listTable()).getByText(B.lot.lotNo)).toBeInTheDocument();
  });

  it('권한 없이 열면 다시 시도 대신 권한 안내', async () => {
    setup('/production/material-trace', { forbidden: true });
    expect(await screen.findByText(t.material.forbidden)).toBeInTheDocument();
    expect(screen.queryByText(t.list.loadFailed)).toBeNull();
  });

  it('Q13 제품 기준 권한이 없으면 [제품 기준 역추적에서 열기]를 두지 않는다', async () => {
    const { user } = setup('/production/material-trace', {}, ['W-02-13']);
    await waitFor(() => expect(listRows()).toHaveLength(3));
    await user.type(scanBox(), `${P3.lot.lotNo}{Enter}`);
    expect(await screen.findByText(t.material.otherTitle)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.material.otherOpen })).toBeNull();
  });

  /* 피처 016 — 공정 반제품: 계보 단계 「반제품 LOT · 공정 10」, 투입 전 반제품은 최종 LOT 「다음 공정 투입 전」 · 「남은 n」. */
  it('US2-6 · Q14 투입 전(일부 투입 포함) 공정 반제품은 계보에 공정이 붙고 최종 LOT 에 「다음 공정 투입 전」 · 남은 수량으로 선다', async () => {
    const wipLot = {
      lotId: 302,
      lotNo: 'PL-SYN-0001-A02',
      lotTypeCode: 'WIP',
      statusCode: 'NORMAL',
      lifecycleStatusCode: 'ACTIVE',
      operationSeq: 10,
      processName: '가공',
    };
    setup(`/production/material-trace?lot=${String(A.lot.lotId)}`, {
      tree: (lotId) => {
        const base = forwardTreeOf(lotId, A.lot.lotNo);
        return {
          ...base,
          nodes: base.nodes
            .filter((node) => node.nodeKey !== 'K:302:5')
            .map((node) => (node.nodeKey === 'L:302' ? { ...node, lot: wipLot } : node)),
          edges: base.edges.filter((edge) => edge.to !== 'K:302:5'),
          endRows: base.endRows.map((row) =>
            row.lot.lotId === 302
              ? {
                  ...row,
                  lot: wipLot,
                  fate: 'WIP_PENDING' as const,
                  stock: [],
                  wipRemainingQty: 40,
                }
              : row,
          ),
        };
      },
    });
    const tree = await within(detail()).findByRole('table', { name: t.tree.caption });
    expect(within(tree).getByText('반제품 LOT · 공정 10')).toBeInTheDocument();

    const end = within(detail()).getByRole('table', { name: t.material.endTitle });
    expect(within(end).getByText(t.end.fates.WIP_PENDING)).toBeInTheDocument();
    /* 일부만 투입된 반제품도 선다 — 행선지는 서버가 센 남은 수량(실적 180 이 아님). */
    expect(within(end).getByText('남은 40 EA')).toBeInTheDocument();
    expect(within(end).getByText('반제품 · 공정 10 반제품 1')).toBeInTheDocument();
  });

  /*
   * 실제 앱 확인 2026-11-26 — 80px 현황 칸에서 「다음 공정 투입 전」이 잘렸고(1차), 모든 운명의 최장 vi 이름으로 넓히자
   * 상세 창 1440 에서 행선지 칸이 밀려 머리가 글자 단위로 끊겼다(2차). 폭은 지금 목록에 나온 운명 기준이다.
   */
  it('Q14 현황 칸은 목록에 나온 운명 이름이 들어가고, vi 반제품 목록에서도 행선지 칸을 밀어내지 않는다', () => {
    const ko14 = [ko.traceTree.end.fates.WIP_PENDING, ko.traceTree.end.fates.CONSUMED_OUT];
    const vi14 = [vi.traceTree.end.fates.WIP_PENDING, vi.traceTree.end.fates.CONSUMED_OUT];
    /* 칩 103px(실측) + 칸 여백 */
    expect(fateColumnWidth(ko14)).toBeGreaterThanOrEqual(103 + 24);
    /* 상세 창(1440, 약 660px)에서 행선지 칸에 120px 이상 남는다 — 첫 칸 180 · 출하일 72 · 수량 88 · 상태 64 */
    expect(660 - 180 - 72 - 88 - 64 - fateColumnWidth(vi14)).toBeGreaterThanOrEqual(120);
    /* 나오지 않은 운명은 폭을 늘리지 않는다 */
    expect(fateColumnWidth([ko.traceTree.end.fates.SHIPPED])).toBe(80);
  });
});
