import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import {
  approvalRequestDetailFixture,
  balanceResponseFixturesByItem,
  goodsIssueFixtures,
  goodsIssueLineFixtures,
  goodsIssueLineResponseFixtures,
  goodsIssueResponseFixtures,
  goodsReceiptFixtures,
  goodsReceiptResponseFixtures,
  receiptLineFixtures,
  receiptLineResponseFixtures,
} from './fixtures';
import {
  BALANCE_PAGE_SIZE,
  approvalKeys,
  balanceKeys,
  isIssueNotFound,
  isReceiptNotFound,
  issueKeys,
  receiptKeys,
  useApprovalRequest,
  useGoodsIssueDetail,
  useGoodsIssues,
  useGoodsReceiptDetail,
  useGoodsReceipts,
  useOnHandBalances,
  type ReceiptListQuery,
} from './queries';

const LIST_PATH = '/logistics/goods-receipts';
const DETAIL_PATH = '/logistics/goods-receipts/9001';
const BALANCES_PATH = '/inventory/balances';
const ISSUES_PATH = '/logistics/goods-issues';
const ISSUE_DETAIL_PATH = '/logistics/goods-issues/9501';
const APPROVAL_PATH = '/app/approval-requests';

const listFetch = (): { fetch: ReturnType<typeof createStubFetch>; urls: URL[] } => {
  const urls: URL[] = [];

  const fetch = createStubFetch([
    {
      match: (request) => new URL(request.url).pathname === LIST_PATH,
      respond: (request) => {
        urls.push(new URL(request.url));

        return jsonResponse({
          items: goodsReceiptResponseFixtures,
          page: { page: 1, size: 50, total: goodsReceiptResponseFixtures.length },
        });
      },
    },
  ]);

  return { fetch, urls };
};

describe('receiptKeys', () => {
  /** 조건이 다르면 캐시도 갈린다 — 같으면 앞 조건의 결과가 새 조건의 화면에 그대로 선다. */
  it('조건이 캐시 키에 들어간다', () => {
    expect(receiptKeys.list({ q: 'GR' })).not.toEqual(receiptKeys.list({ q: 'GR-2026' }));
  });

  /** 목록의 앞머리를 따로 둔다 — 상세·잔액과 무효화 범위를 가르기 위해서다. */
  it('앞머리가 목록임을 밝힌다', () => {
    expect(receiptKeys.list({}).slice(0, 2)).toEqual(['disposal-issue-goods-receipts', 'list']);
  });

  /**
   * **목록과 상세의 앞머리가 갈려 있다**(`omf-mes#43` 방지). 하나로 묶으면 목록만 다시
   * 부르려 해도 상세까지 함께 무효화되고, 그때 상세 응답이 새 참조로 오면서 **치던 값이
   * 사라진다.** 초안이 생긴 이 회차부터 그 위험이 실제 피해다.
   */
  it('목록과 상세의 앞머리가 갈려 있다', () => {
    expect(receiptKeys.detail(9001).slice(0, 2)).toEqual([
      'disposal-issue-goods-receipts',
      'detail',
    ]);
    expect(receiptKeys.detail(9001)[1]).not.toBe(receiptKeys.list({})[1]);
  });

  /** 잔액은 **창고와 품목마다** 갈린다 — 한 요청이 그 짝의 잔액만 담기 때문이다. */
  it('잔액 키가 창고와 품목으로 갈린다', () => {
    expect(balanceKeys.onHand(9701, 9301)).not.toEqual(balanceKeys.onHand(9701, 9302));
    expect(balanceKeys.onHand(9701, 9301)).not.toEqual(balanceKeys.onHand(9702, 9301));
  });
});

describe('useGoodsReceipts', () => {
  const render = (query: ReceiptListQuery) => {
    const { fetch, urls } = listFetch();
    const hook = renderHookWithProviders(() => useGoodsReceipts(query, true), { fetch });

    return { ...hook, urls };
  };

  it('응답을 화면 타입으로 옮긴다', async () => {
    const { result } = render({});

    await waitFor(() => {
      expect(result.current.data?.items).toHaveLength(goodsReceiptFixtures.length);
    });

    expect(result.current.data?.items[0]).toEqual(goodsReceiptFixtures[0]);
  });

  /**
   * **채운 조건만 실린다.** 요청 URL이 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있고,
   * 빈 값을 실으면 서버가 그것을 조건으로 해석한다.
   */
  it('조건이 하나도 없으면 쿼리도 비어 있다', async () => {
    const { result, urls } = render({});

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect([...(urls[0]?.searchParams.keys() ?? [])]).toEqual([]);
  });

  it('채운 조건을 계약 이름 그대로 싣는다', async () => {
    const { result, urls } = render({ warehouseId: 9701, q: 'GR-2026', page: 2 });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(Object.fromEntries(urls[0]?.searchParams ?? [])).toEqual({
      warehouseId: '9701',
      q: 'GR-2026',
      page: '2',
    });
  });

  /** 쪽 크기는 서버 기본값을 쓴다 — 화면이 정하면 그 숫자의 근거를 화면이 갖게 된다. */
  it('쪽 크기를 싣지 않는다', async () => {
    const { result, urls } = render({});

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(urls[0]?.searchParams.has('size')).toBe(false);
  });

  it('실패하면 실패로 앉는다', async () => {
    const fetch = createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === LIST_PATH,
        respond: () => jsonResponse({ message: '' }, { status: 500 }),
      },
    ]);
    const { result } = renderHookWithProviders(() => useGoodsReceipts({}, true), { fetch });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

const recording = (
  routes: StubRoute[],
): { fetch: ReturnType<typeof createStubFetch>; urls: URL[] } => {
  const urls: URL[] = [];
  const stub = createStubFetch(routes);

  return {
    fetch: (request) => {
      urls.push(new URL(request.url));

      return stub(request);
    },
    urls,
  };
};

const detailRoute = (): StubRoute => ({
  match: (request) => new URL(request.url).pathname === DETAIL_PATH,
  respond: () =>
    jsonResponse({
      goodsReceipt: goodsReceiptResponseFixtures[0],
      lines: receiptLineResponseFixtures,
    }),
});

describe('useGoodsReceiptDetail', () => {
  /**
   * **고르기 전에는 부르지 않는다**(감지기 M17). 스텁을 두고도 요청이 0건이어야 「부르지
   * 않았다」와 「불렀는데 실패했다」가 구분된다.
   */
  it('고르기 전에는 요청이 나가지 않는다', async () => {
    const { fetch, urls } = recording([detailRoute()]);
    const { result } = renderHookWithProviders(() => useGoodsReceiptDetail(null, true), { fetch });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    expect(urls).toEqual([]);
    expect(result.current.isError).toBe(false);
  });

  /** **헤더와 라인이 한 번에 온다** — 라인 전용 경로를 따로 부르지 않는다. */
  it('헤더와 라인을 함께 화면 타입으로 옮긴다', async () => {
    const { fetch, urls } = recording([detailRoute()]);
    const { result } = renderHookWithProviders(() => useGoodsReceiptDetail(9001, true), { fetch });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.receipt).toEqual(goodsReceiptFixtures[0]);
    expect(result.current.data?.lines).toEqual(receiptLineFixtures);
    expect(urls).toHaveLength(1);
  });
});

describe('isReceiptNotFound', () => {
  /**
   * **404만 「없다」로 읽는다.** 다른 실패와 갈라야 하는 이유는 사용자가 할 조치가 다르기
   * 때문이다 — 없는 전표는 다시 시도해도 나타나지 않는다.
   */
  it('404가 아니면 없음이 아니다', async () => {
    const build = (status: number) =>
      recording([
        {
          match: (request) => new URL(request.url).pathname === DETAIL_PATH,
          respond: () => jsonResponse({ message: '' }, { status }),
        },
      ]);

    const notFound = renderHookWithProviders(() => useGoodsReceiptDetail(9001, true), {
      fetch: build(404).fetch,
    });
    await waitFor(() => {
      expect(notFound.result.current.isError).toBe(true);
    });
    expect(isReceiptNotFound(notFound.result.current.error)).toBe(true);

    const serverError = renderHookWithProviders(() => useGoodsReceiptDetail(9001, true), {
      fetch: build(500).fetch,
    });
    await waitFor(() => {
      expect(serverError.result.current.isError).toBe(true);
    });
    expect(isReceiptNotFound(serverError.result.current.error)).toBe(false);
  });
});

describe('useOnHandBalances', () => {
  const balancesRoute = (): StubRoute => ({
    match: (request) => new URL(request.url).pathname === BALANCES_PATH,
    respond: (request) => {
      const itemId = Number(new URL(request.url).searchParams.get('itemId'));
      const items = balanceResponseFixturesByItem[itemId] ?? [];

      return jsonResponse({ items, page: { page: 1, size: 50, total: items.length } });
    },
  });

  /**
   * **전표를 고르기 전에는 부르지 않는다**(감지기 M20). 창고 번호가 상세 응답에서 오므로
   * 그전에는 조건을 만들 수 없다 — `?? 0`으로 메우면 **없는 창고의 조건으로 요청이 나간다.**
   */
  it('창고가 없으면 요청이 나가지 않고 실패로도 앉지 않는다', async () => {
    const { fetch, urls } = recording([balancesRoute()]);
    const { result } = renderHookWithProviders(() => useOnHandBalances(null, [9301]), { fetch });

    await waitFor(() => {
      expect(result.current.items).toEqual([]);
    });

    expect(urls).toEqual([]);
    expect(result.current.isError).toBe(false);
  });

  /**
   * **품목마다 한 번 부른다**(감지기 M21). 같은 품목의 줄이 여럿이어도 요청은 한 번이다 —
   * 라인마다 부르면 같은 품목이 둘일 때 두 번 나간다.
   */
  it('품목마다 한 번 부르고 조건 넷을 싣는다', async () => {
    const { fetch, urls } = recording([balancesRoute()]);
    const { result } = renderHookWithProviders(
      () => useOnHandBalances(9701, [9301, 9301, 9302]),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.items).toHaveLength(2);
    });

    expect(urls).toHaveLength(2);
    expect(Object.fromEntries(urls[0]?.searchParams ?? [])).toEqual({
      warehouseId: '9701',
      itemId: '9301',
      groupBy: 'LOT',
      includeZero: 'true',
      size: String(BALANCE_PAGE_SIZE),
    });
  });

  /** 잔액 줄을 화면 타입으로 옮긴다 — **가용 수량은 옮기지 않는다**(`types.ts`). */
  it('품목별로 나눠 담는다', async () => {
    const { fetch } = recording([balancesRoute()]);
    const { result } = renderHookWithProviders(() => useOnHandBalances(9701, [9301, 9302]), {
      fetch,
    });

    await waitFor(() => {
      expect(result.current.items.every((item) => !item.isLoading)).toBe(true);
    });

    expect(result.current.items.map((item) => item.itemId)).toEqual([9301, 9302]);
    expect(result.current.items[0]?.entries).toEqual([
      { groupBy: 'LOT', lotId: 9601, onHandQty: 80, uomId: 9801 },
      { groupBy: 'LOT', lotId: 9602, onHandQty: 0, uomId: 9801 },
    ]);
  });

  /**
   * **한 품목의 실패를 전체 실패로 뭉치지 않는다.** 뭉치면 멀쩡히 받은 품목의 줄까지 상한을
   * 잃는다 — 그 줄들은 화면이 막아 줄 수 있는데도 못 막게 된다.
   */
  it('한 품목이 실패해도 다른 품목의 잔액은 남는다', async () => {
    const { fetch } = recording([
      {
        match: (request) => new URL(request.url).pathname === BALANCES_PATH,
        respond: (request) => {
          const itemId = Number(new URL(request.url).searchParams.get('itemId'));

          if (itemId === 9302) return jsonResponse({ message: '' }, { status: 500 });

          const items = balanceResponseFixturesByItem[itemId] ?? [];

          return jsonResponse({ items, page: { page: 1, size: 50, total: items.length } });
        },
      },
    ]);
    const { result } = renderHookWithProviders(() => useOnHandBalances(9701, [9301, 9302]), {
      fetch,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.items[0]?.isError).toBe(false);
    expect(result.current.items[0]?.entries).toHaveLength(2);
    expect(result.current.items[1]?.isError).toBe(true);
  });

  /** 잘림은 **줄의 사실을 모아** 접어 올린다 — 두 자리에서 각각 재면 한쪽만 고쳐진다. */
  it('한 품목이라도 잘리면 전체가 잘린 것이다', async () => {
    const { fetch } = recording([
      {
        match: (request) => new URL(request.url).pathname === BALANCES_PATH,
        respond: () =>
          jsonResponse({
            items: balanceResponseFixturesByItem[9301] ?? [],
            page: { page: 1, size: 50, total: 500 },
          }),
      },
    ]);
    const { result } = renderHookWithProviders(() => useOnHandBalances(9701, [9301]), { fetch });

    await waitFor(() => {
      expect(result.current.truncated).toBe(true);
    });

    expect(result.current.items[0]?.truncated).toBe(true);
  });
});

describe('issueKeys · approvalKeys', () => {
  it('이력 조건이 캐시 키에 들어간다', () => {
    expect(issueKeys.list({ q: 'GI' })).not.toEqual(issueKeys.list({ q: 'GI-2026' }));
  });

  /** 목록·상세의 앞머리를 갈라 둔다 — 목록만 다시 부르려는데 상세까지 무효화되면 안 된다. */
  it('목록과 상세의 앞머리가 갈려 있다', () => {
    expect(issueKeys.list({}).slice(0, 2)).toEqual(['disposal-issue-goods-issues', 'list']);
    expect(issueKeys.detail(9501).slice(0, 2)).toEqual(['disposal-issue-goods-issues', 'detail']);
  });

  /** 입고 쪽 키와 겹치지 않는다 — 겹치면 한쪽 무효화가 다른 탭의 조회를 함께 끌고 간다. */
  it('입고 전표 키와 갈려 있다', () => {
    expect(issueKeys.list({})[0]).not.toBe(receiptKeys.list({})[0]);
  });

  it('승인 요청 키가 요청마다 갈린다', () => {
    expect(approvalKeys.detail(9521)).not.toEqual(approvalKeys.detail(9522));
  });

  /**
   * **잔액 뿌리가 짝별 키를 전부 덮는다.** 전기 성공 뒤 이 하나를 무효화해야 화면이 그때 들고
   * 있던 품목만이 아니라 잔액 전체가 낡은 것으로 표시된다.
   */
  it('잔액 뿌리가 짝별 키의 앞머리다', () => {
    expect(balanceKeys.onHand(9701, 9301).slice(0, balanceKeys.all.length)).toEqual([
      ...balanceKeys.all,
    ]);
  });

  /** 출고·승인 키와 겹치지 않는다 — 겹치면 한쪽 무효화가 남의 조회를 함께 끌고 간다. */
  it('잔액 뿌리가 출고·승인 키와 갈려 있다', () => {
    expect(balanceKeys.all[0]).not.toBe(issueKeys.all[0]);
    expect(balanceKeys.all[0]).not.toBe(approvalKeys.all[0]);
  });
});

describe('useGoodsIssues', () => {
  const issueListFetch = (): { fetch: ReturnType<typeof createStubFetch>; urls: URL[] } => {
    const urls: URL[] = [];

    const fetch = createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === ISSUES_PATH,
        respond: (request) => {
          urls.push(new URL(request.url));

          return jsonResponse({
            items: goodsIssueResponseFixtures,
            page: { page: 1, size: 50, total: goodsIssueResponseFixtures.length },
          });
        },
      },
    ]);

    return { fetch, urls };
  };

  it('응답을 화면 타입으로 옮긴다', async () => {
    const { fetch } = issueListFetch();
    const { result } = renderHookWithProviders(() => useGoodsIssues({}, true), { fetch });

    await waitFor(() => {
      expect(result.current.data?.items).toEqual(goodsIssueFixtures);
    });
  });

  /** 탭이 서지 않은 동안에는 부르지 않는다 — 보이지 않는 탭의 조회가 나가면 헛돈다. */
  it('열려 있지 않으면 요청이 나가지 않는다', async () => {
    const { fetch, urls } = issueListFetch();
    const { result } = renderHookWithProviders(() => useGoodsIssues({}, false), { fetch });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    expect(urls).toHaveLength(0);
    /* 성립하지 않는 조회를 실패로 앉히지도 않는다. */
    expect(result.current.isError).toBe(false);
  });

  it('채운 조건을 계약 이름 그대로 싣는다', async () => {
    const { fetch, urls } = issueListFetch();

    renderHookWithProviders(
      () => useGoodsIssues({ issuedAtFrom: '2026-08-01', statusCode: 'CODE_C', page: 2 }, true),
      { fetch },
    );

    await waitFor(() => {
      expect(urls).toHaveLength(1);
    });

    const query = urls[0]?.searchParams;

    expect(query?.get('issuedAtFrom')).toBe('2026-08-01');
    expect(query?.get('statusCode')).toBe('CODE_C');
    expect(query?.get('page')).toBe('2');
    /* 쪽 크기는 서버 기본값을 쓴다. */
    expect(query?.has('size')).toBe(false);
  });
});

describe('useGoodsIssueDetail', () => {
  const detailRoute = (): StubRoute => ({
    match: (request) => new URL(request.url).pathname === ISSUE_DETAIL_PATH,
    respond: () =>
      jsonResponse({
        goodsIssue: goodsIssueResponseFixtures[0],
        lines: goodsIssueLineResponseFixtures,
      }),
  });

  it('고르기 전에는 요청이 나가지 않는다', async () => {
    const urls: URL[] = [];
    const fetch = createStubFetch([
      {
        match: (request) => {
          urls.push(new URL(request.url));

          return true;
        },
        respond: () => jsonResponse({}),
      },
    ]);

    const { result } = renderHookWithProviders(() => useGoodsIssueDetail(null, true), { fetch });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    expect(urls).toHaveLength(0);
  });

  /** 탭이 서지 않은 동안에는 고른 품의가 있어도 부르지 않는다. */
  it('열려 있지 않으면 고른 품의가 있어도 부르지 않는다', async () => {
    const urls: URL[] = [];
    const fetch = createStubFetch([
      {
        match: (request) => {
          urls.push(new URL(request.url));

          return true;
        },
        respond: () => jsonResponse({}),
      },
    ]);

    renderHookWithProviders(() => useGoodsIssueDetail(9501, false), { fetch });

    await waitFor(() => {
      expect(urls).toHaveLength(0);
    });
  });

  it('헤더와 라인을 함께 화면 타입으로 옮긴다', async () => {
    const fetch = createStubFetch([detailRoute()]);
    const { result } = renderHookWithProviders(() => useGoodsIssueDetail(9501, true), { fetch });

    await waitFor(() => {
      expect(result.current.data?.issue).toEqual(goodsIssueFixtures[0]);
    });

    expect(result.current.data?.lines).toEqual(goodsIssueLineFixtures);
  });
});

describe('useApprovalRequest', () => {
  const approvalRoute = (): { route: StubRoute; urls: URL[] } => {
    const urls: URL[] = [];

    return {
      urls,
      route: {
        match: (request) => new URL(request.url).pathname.startsWith(APPROVAL_PATH),
        respond: (request) => {
          urls.push(new URL(request.url));

          return jsonResponse(approvalRequestDetailFixture);
        },
      },
    };
  };

  /**
   * **값이 없으면 부르지 않는다**(계획 결정 10). `?? 0`으로 메우면
   * `/app/approval-requests/0`이 나가 남의 요청을 열거나 헛돈다.
   */
  it('상신되지 않은 품의에는 요청이 나가지 않는다', async () => {
    const { route, urls } = approvalRoute();
    const { result } = renderHookWithProviders(
      () => useApprovalRequest({ kind: 'notSubmitted' }, true),
      { fetch: createStubFetch([route]) },
    );

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    expect(urls).toHaveLength(0);
    expect(result.current.isError).toBe(false);
  });

  it('쓸 수 없는 값에도 요청이 나가지 않는다', async () => {
    const { route, urls } = approvalRoute();

    renderHookWithProviders(() => useApprovalRequest({ kind: 'unusable' }, true), {
      fetch: createStubFetch([route]),
    });

    await waitFor(() => {
      expect(urls).toHaveLength(0);
    });
  });

  /** **서버가 준 식별자를 그대로 경로 조각으로 옮긴다** — 가공하면 다른 요청을 연다. */
  it('받은 값을 그대로 경로에 싣는다', async () => {
    const { route, urls } = approvalRoute();
    const { result } = renderHookWithProviders(
      () => useApprovalRequest({ kind: 'submitted', approvalRequestId: 9521 }, true),
      { fetch: createStubFetch([route]) },
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(approvalRequestDetailFixture);
    });

    expect(urls).toHaveLength(1);
    expect(urls[0]?.pathname).toBe('/app/approval-requests/9521');
  });

  it('열려 있지 않으면 부르지 않는다', async () => {
    const { route, urls } = approvalRoute();

    renderHookWithProviders(
      () => useApprovalRequest({ kind: 'submitted', approvalRequestId: 9521 }, false),
      { fetch: createStubFetch([route]) },
    );

    await waitFor(() => {
      expect(urls).toHaveLength(0);
    });
  });
});

describe('isIssueNotFound', () => {
  const failing = (status: number): StubRoute => ({
    match: (request) => new URL(request.url).pathname === ISSUE_DETAIL_PATH,
    respond: () => jsonResponse({ message: '' }, { status }),
  });

  it('404면 없음이다', async () => {
    const { result } = renderHookWithProviders(() => useGoodsIssueDetail(9501, true), {
      fetch: createStubFetch([failing(404)]),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(isIssueNotFound(result.current.error)).toBe(true);
  });

  it('404가 아니면 없음이 아니다', async () => {
    const { result } = renderHookWithProviders(() => useGoodsIssueDetail(9501, true), {
      fetch: createStubFetch([failing(500)]),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(isIssueNotFound(result.current.error)).toBe(false);
  });
});
