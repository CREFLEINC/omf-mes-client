import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';

import { GoodsIssueQrScreen } from './screen';

/**
 * **QR 발행 대기 목록**(ISSUE-QR-01 D5) — 자재창고 담당은 관리자 웹을 쓸 수 없어, 이 목록이
 * 없으면 **출고번호를 이미 아는 사람만** 이 화면을 쓸 수 있었다.
 *
 * ⛔ **「대기 없음」을 함부로 말하지 않는다.** 서버에 미발행 축이 없어 화면이 최근 창만 훑는다 —
 *    그 사실을 화면이 늘 적는지까지 잰다.
 */

const t = messages.goodsIssueQr;
const ROUTE = '/pop/goods-issue-qr?workerNo=3391';

const issue = (goodsIssueId: number, goodsIssueNo: string, issuedAt: string) => ({
  goodsIssueId,
  goodsIssueNo,
  issueTypeCode: 'PRODUCTION',
  sourceDocumentTypeCode: 'PICKING_ORDER',
  sourceDocumentId: 1,
  sourceWarehouseId: 1,
  issuedAt,
  statusCode: 'POSTED',
  destinationTypeCode: 'LOCATION',
  destinationId: 5,
});

const lineOf = (goodsIssueId: number, goodsIssueLineId: number, lotId: number) => ({
  goodsIssueLineId,
  goodsIssueId,
  lineNo: 1,
  itemId: 10,
  lotId,
  issueQty: 100,
  uomId: 30,
  sourceLocationId: 40,
});

interface Options {
  /** 전표 목록. 기본은 두 건. */
  issues?: ReturnType<typeof issue>[];
  /** 라인별 발행 횟수. 없으면 0(미발행)으로 본다. */
  issueCounts?: Record<number, number>;
  /** 라인별 마지막 인쇄 결과. 발행 횟수가 있을 때만 뜻이 있다. */
  printOutcomes?: Record<number, 'PENDING' | 'SUCCEEDED' | 'FAILED'>;
  listFails?: boolean;
  summaryFails?: boolean;
  /** 서버가 말한 총계. 받은 수보다 크면 창 밖에 더 있다. */
  total?: number;
  requests?: string[];
}

const ISSUES = [
  issue(901, 'GI-20260916-0001', '2026-09-16T01:00:00Z'),
  issue(902, 'GI-20260916-0002', '2026-09-16T02:00:00Z'),
];

const routes = (options: Options): StubRoute[] => {
  const issues = options.issues ?? ISSUES;

  return [
    {
      match: (request) => new URL(request.url).pathname === '/logistics/goods-issues',
      respond: (request) => {
        options.requests?.push(request.url);

        return options.listFails === true
          ? jsonResponse({ message: '조회 실패' }, { status: 500 })
          : jsonResponse({
              items: issues,
              page: { page: 1, size: 20, total: options.total ?? issues.length },
            });
      },
    },
    {
      match: (request) =>
        /\/logistics\/goods-issues\/\d+\/lines$/.test(new URL(request.url).pathname),
      respond: (request) => {
        const goodsIssueId = Number(new URL(request.url).pathname.split('/').at(-2));

        return jsonResponse({
          items: [lineOf(goodsIssueId, goodsIssueId - 900, goodsIssueId - 880)],
        });
      },
    },
    {
      match: (request) => new URL(request.url).pathname === '/app/document-issues/summary',
      respond: (request) => {
        if (options.summaryFails === true) {
          return jsonResponse({ message: '조회 실패' }, { status: 500 });
        }

        /*
         * ⚠ **두 직렬화 형태를 다 읽는다** — `targetIds=1&targetIds=2` 와 `targetIds=1,2` 중
         *   어느 쪽인지 계약이 정하지 않았다. 한 형태만 읽으면 스텁이 조용히 빈 답을 주고
         *   **걸러지지 않은 목록이 시험을 통과한다**(처음에 그렇게 짜서 걸렸다).
         */
        const ids = new URL(request.url).searchParams
          .getAll('targetIds')
          .flatMap((raw) => raw.split(','))
          .map(Number)
          .filter((value) => Number.isFinite(value));

        return jsonResponse({
          items: ids.map((targetId) => ({
            targetTypeCode: 'GOODS_ISSUE_LINE',
            targetId,
            issueCount: options.issueCounts?.[targetId] ?? 0,
            lastPrintOutcome: options.printOutcomes?.[targetId] ?? null,
          })),
        });
      },
    },
    {
      match: (request) => /^\/mdm\/items\/\d+$/.test(new URL(request.url).pathname),
      respond: () =>
        jsonResponse({
          item: { itemId: 10, itemCode: 'A5C1M50101', itemName: '샘플 품목', isActive: true },
          editability: {},
        }),
    },
    {
      match: (request) => new URL(request.url).pathname.startsWith('/trace/lots/'),
      respond: (request) => {
        const lotId = Number(new URL(request.url).pathname.split('/').pop());

        return jsonResponse({
          lot: {
            lotId,
            lotNo: `SEED-S230-A0${String(lotId - 20)}`,
            itemId: 10,
            lotTypeCode: 'NEW',
            plantId: 1,
            initialQty: 100,
            uomId: 30,
            statusCode: 'AVAILABLE',
            lifecycleStatusCode: 'ACTIVE',
          },
        });
      },
    },
    {
      /* 재발행 사유 목록 — 비어 있으면 화면이 「사유 값이 없다」로 말해 재발행 안내를 덮는다. */
      match: (request) => new URL(request.url).pathname === '/mdm/code-values',
      respond: () =>
        jsonResponse({
          items: [
            {
              codeValueId: 1,
              codeGroupId: 1,
              code: 'PRINT_FAILURE',
              codeName: '인쇄 실패',
              displayOrder: 1,
              isActive: true,
            },
          ],
          page: { page: 1, size: 50, total: 1 },
        }),
    },
    {
      match: (request) => new URL(request.url).pathname === '/mdm/uoms',
      respond: () =>
        jsonResponse({
          items: [{ uomId: 30, uomCode: 'EA', uomName: '개', isActive: true }],
          page: { page: 1, size: 50, total: 1 },
        }),
    },
    /* 나머지 조회는 이 감지기의 관심사가 아니다 — 늘 빈 답을 주고 비켜 둔다. */
    {
      match: () => true,
      respond: () => jsonResponse({ items: [], page: { page: 1, size: 50, total: 0 } }),
    },
  ];
};

/**
 * 대기 구획 안에서만 찾는다.
 *
 * ⚠ 화면에는 전표 라인 표도 함께 서 있어(전표를 고르기 전에는 비어 있다) 범위를 좁히지 않으면
 *   **그 빈 표의 줄을 읽는다** — 처음에 그렇게 짜서 걸렸다.
 */
const pendingPane = (): HTMLElement => screen.getByRole('region', { name: t.pending.sectionLabel });

const render = (options: Options = {}) =>
  renderWithProviders(<GoodsIssueQrScreen />, {
    fetch: createStubFetch(routes(options)),
    route: ROUTE,
  });

describe('QR 발행 대기 목록', () => {
  it('미발행 라인을 최근 전표부터 세운다', async () => {
    render();

    await screen.findByText('GI-20260916-0002');

    /* 최근(02:00)이 위로 온다 — 계약이 차례를 약속하지 않으므로 화면이 세운다. */
    const body = within(pendingPane()).getAllByRole('row').slice(1);

    expect(within(body[0] as HTMLElement).getByText('GI-20260916-0002')).toBeTruthy();
    expect(within(body[1] as HTMLElement).getByText('GI-20260916-0001')).toBeTruthy();
  });

  it('품목·LOT 을 번호가 아니라 이름으로 낸다', async () => {
    render();

    /* 두 줄이 같은 품목이라 여러 건이 선다 — 「이름으로 나온다」가 재려는 것이다. */
    expect(await screen.findAllByText('A5C1M50101 · 샘플 품목')).toHaveLength(2);
    expect(screen.getByText('SEED-S230-A02')).toBeTruthy();
    /* ⛔ 내부 번호를 대신 찍지 않는다. */
    expect(screen.queryByText('10')).toBeNull();
  });

  /* ⛔ 이미 찍은 라인을 대기로 세우면 같은 라벨을 두 번 붙인다. */
  it('이미 발행된 라인은 대기로 세우지 않는다', async () => {
    render({ issueCounts: { 1: 1, 2: 1 } });

    expect(await screen.findByText(t.pending.allIssued(2))).toBeTruthy();
    expect(screen.queryByText('GI-20260916-0001')).toBeNull();
  });

  /*
   * ⭐⭐ **찍혔는가로 가른다 — 발행됐는가가 아니다**(사용자 결정 2026-09-16 · D8). 발행 기록이
   *    남아도 인쇄가 실패했으면 **현장에 라벨이 없다.** 목록에서 빼면 담당은 그 사실을 알 길이
   *    없다(계약도 「FAILED 면 화면이 재발행을 권한다」고 적었다).
   */
  it('인쇄가 실패한 라인도 대기로 세우고 미발행과 갈라 보인다', async () => {
    render({ issueCounts: { 2: 1 }, printOutcomes: { 2: 'FAILED' } });

    const failedRow = (await screen.findByText('GI-20260916-0002')).closest('tr');
    expect(within(failedRow as HTMLElement).getByText(t.pending.statusPrintFailed(1))).toBeTruthy();

    const freshRow = screen.getByText('GI-20260916-0001').closest('tr');
    expect(within(freshRow as HTMLElement).getByText(t.pending.statusNotIssued)).toBeTruthy();
  });

  /* 잘 찍힌 것은 다시 세우지 않는다 — 세우면 같은 라벨을 두 번 붙인다. */
  it('인쇄가 성공한 라인은 목록에서 빠진다', async () => {
    render({ issueCounts: { 2: 1 }, printOutcomes: { 2: 'SUCCEEDED' } });

    expect(await screen.findByText('GI-20260916-0001')).toBeTruthy();
    expect(screen.queryByText('GI-20260916-0002')).toBeNull();
  });

  /*
   * ⛔ **보고가 아직 안 온 것은 실패가 아니다.** 실패로 보면 방금 잘 찍은 라벨을 다시 찍게 한다.
   */
  it('인쇄 결과를 아직 보고받지 못한 라인은 세우지 않는다', async () => {
    render({ issueCounts: { 2: 1 }, printOutcomes: { 2: 'PENDING' } });

    expect(await screen.findByText('GI-20260916-0001')).toBeTruthy();
    expect(screen.queryByText('GI-20260916-0002')).toBeNull();
  });

  /*
   * ⭐ 회차가 이미 올라간 라인이라 다시 찍으려면 **재발행 사유**가 필요하다(계약: 사유 없으면
   *    422). 목록에서 바로 들어갔을 때 그 칸이 열려 있어야 담당이 막히지 않는다.
   */
  it('인쇄 실패 라인으로 들어가면 재발행 사유 칸이 열려 있다', async () => {
    const user = userEvent.setup();
    render({ issueCounts: { 2: 1 }, printOutcomes: { 2: 'FAILED' } });

    const row = (await screen.findByText('GI-20260916-0002')).closest('tr');
    await user.click(within(row as HTMLElement).getByRole('button', { name: t.pending.pick }));

    expect(await screen.findByText(t.reissue.label)).toBeTruthy();
    /* 요약이 새 대상으로 다시 오는 사이에는 「현황을 모른다」가 선다 — 확정될 때까지 기다린다. */
    expect(await screen.findByText(t.reissue.required)).toBeTruthy();
  });

  it('창 안에 아무것도 없으면 그렇게 말한다', async () => {
    render({ issues: [] });

    expect(await screen.findByText(t.pending.empty)).toBeTruthy();
  });

  /*
   * ⛔ **「없다」와 「못 받았다」를 같은 말로 하지 않는다**(공유계약 G-3). 조회가 실패했는데
   *    「대기 없음」이라 말하면 담당은 찍을 것이 없다고 믿고 화면을 떠난다.
   */
  it('목록 조회가 실패하면 「대기 없음」이라 말하지 않는다', async () => {
    render({ listFails: true });

    expect(await screen.findByText(t.pending.failed)).toBeTruthy();
    expect(screen.queryByText(t.pending.empty)).toBeNull();
  });

  it('발행 현황을 못 받으면 대기로 세우지 않는다 — 다시 찍게 만들지 않는다', async () => {
    render({ summaryFails: true });

    expect(await screen.findByText(t.pending.failed)).toBeTruthy();
    expect(screen.queryByText('GI-20260916-0001')).toBeNull();
  });

  /* ⚠ 목록이 훑는 창을 늘 적는다 — 「없다」와 「창 밖에 있다」가 같아 보이면 안 된다. */
  it('무엇을 훑었는지 창을 적는다', async () => {
    render();

    expect(await screen.findByText(/최근 7일/u)).toBeTruthy();
  });

  it('창 밖에 더 있으면 그 사실을 말한다', async () => {
    render({ total: 50 });

    expect(await screen.findByText(t.pending.truncated)).toBeTruthy();
  });

  it('자재 인계 출고만, 전기된 것만 묻는다', async () => {
    const requests: string[] = [];
    render({ requests });

    await screen.findByText('GI-20260916-0002');

    const asked = new URL(requests[0] ?? 'http://x/').searchParams;
    expect(asked.get('statusCode')).toBe('POSTED');
    expect(asked.get('issueTypeCode')).toBe('PRODUCTION');

    /*
     * ⛔⛔ **날짜 형식까지 잰다.** 계약의 `issuedAtFrom` 은 `format: date` 다 — date-time 을
     *    보내면 서버가 **400** 으로 되돌리고 목록이 통째로 빈다(실측 2026-09-16 ·
     *    `must match format "date"` · ISSUE-QR-01 D6). 전에는 「값이 있는가」까지만 봐서
     *    **틀린 형식이 그대로 통과했다.**
     */
    expect(asked.get('issuedAtFrom')).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
  });

  /*
   * ⛔ **UTC 로 자르지 않는다.** 한국 시각 오전 9시 이전을 UTC 로 자르면 **전날**이 되어 아침에
   *    찍는 담당에게 창이 하루 어긋난다 — 단말 현지 날짜로 잘라야 한다.
   */
  it('창 시작일을 단말 현지 날짜로 자른다', async () => {
    const requests: string[] = [];
    render({ requests });

    await screen.findByText('GI-20260916-0002');

    const from = new URL(requests[0] ?? 'http://x/').searchParams.get('issuedAtFrom') ?? '';
    const expected = new Date();
    expected.setDate(expected.getDate() - 7);
    const pad = (value: number) => String(value).padStart(2, '0');

    expect(from).toBe(
      `${String(expected.getFullYear())}-${pad(expected.getMonth() + 1)}-${pad(expected.getDate())}`,
    );
  });

  /*
   * ⭐ **고르면 그 라인이 선택된 채 전표로 들어간다**(D5 배치 · D3). 들어가서 다시 고르게 하면
   *    목록에서 고른 뜻이 사라진다.
   */
  it('행을 고르면 그 전표로 들어가고 라인이 선택돼 있다', async () => {
    const user = userEvent.setup();
    render();

    const row = (await screen.findByText('GI-20260916-0002')).closest('tr');
    await user.click(within(row as HTMLElement).getByRole('button', { name: t.pending.pick }));

    /* 전표 화면으로 바뀐다 — 대기 목록은 사라진다(두 목록을 겹치지 않는다). */
    await waitFor(() => {
      expect(screen.queryByText(t.pending.sectionLabel)).toBeNull();
    });
    /* 고른 그 라인 하나만 [선택]이 눌린 상태로 선다. */
    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: messages.goodsIssueQr.lines.pick, pressed: true }),
      ).toHaveLength(1);
    });
  });

  /*
   * ⭐ **전표를 고르기 전에는 전표 구획이 서지 않는다**(사용자 지시 2026-09-16 · D9). 라인
   *    목록·발행 대상·미리보기·발행 단추는 전표 하나에 매인 것이라, 전표가 없으면 **빈 표와
   *    잠긴 단추**만 남아 대기 목록이 쓸 자리를 차지한다.
   */
  it('전표에 들어가기 전에는 라인 목록·발행 대상·발행 단추가 없다', async () => {
    render();

    await screen.findByText('GI-20260916-0002');

    expect(screen.queryByText(t.lines.sectionLabel)).toBeNull();
    expect(screen.queryByText(t.target.sectionLabel)).toBeNull();
    expect(screen.queryByRole('button', { name: t.action.issue })).toBeNull();
    /* 빈 전표 안내도 뜨지 않는다 — 고른 전표가 없으니 할 말이 아니다. */
    expect(screen.queryByText(t.lines.empty)).toBeNull();
  });

  it('전표에 들어가면 라인 목록·발행 대상·발행 단추가 선다', async () => {
    const user = userEvent.setup();
    render();

    const row = (await screen.findByText('GI-20260916-0002')).closest('tr');
    await user.click(within(row as HTMLElement).getByRole('button', { name: t.pending.pick }));

    expect(await screen.findByText(t.lines.sectionLabel)).toBeTruthy();
    expect(screen.getByText(t.target.sectionLabel)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.action.issue })).toBeTruthy();
  });

  it('대기 목록으로 돌아오면 전표 구획이 다시 사라진다', async () => {
    const user = userEvent.setup();
    render();

    const row = (await screen.findByText('GI-20260916-0002')).closest('tr');
    await user.click(within(row as HTMLElement).getByRole('button', { name: t.pending.pick }));
    await screen.findByRole('button', { name: t.pending.back });

    await user.click(screen.getByRole('button', { name: t.pending.back }));

    await screen.findByText(t.pending.sectionLabel);
    expect(screen.queryByText(t.lines.sectionLabel)).toBeNull();
    expect(screen.queryByRole('button', { name: t.action.issue })).toBeNull();
  });

  it('전표에서 대기 목록으로 되돌아온다', async () => {
    const user = userEvent.setup();
    render();

    const row = (await screen.findByText('GI-20260916-0002')).closest('tr');
    await user.click(within(row as HTMLElement).getByRole('button', { name: t.pending.pick }));
    await screen.findByRole('button', { name: t.pending.back });

    await user.click(screen.getByRole('button', { name: t.pending.back }));

    expect(await screen.findByText(t.pending.sectionLabel)).toBeTruthy();
  });
});
