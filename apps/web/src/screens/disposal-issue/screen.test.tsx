import { messages } from '@omf-mes/i18n';
import type { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { pickRange } from '../../test/date-picker';
import {
  approvalRequestDetailFixture,
  balanceResponseFixturesByItem,
  contradictoryApprovalDetailFixture,
  goodsIssueLineResponseFixtures,
  goodsIssueResponseFixtures,
  goodsReceiptResponseFixtures,
  INTERNAL_IDS,
  itemFixtures,
  locationFixtures,
  lotFixturesByItem,
  receiptLineResponseFixtures,
  SAMPLE_APPROVED_STATUS,
  SAMPLE_DEFECT_WAREHOUSE_TYPE,
  uomFixtures,
  warehouseFixtures,
} from './fixtures';
import { DisposalIssueScreen } from './screen';

const t = messages.disposalIssue;

/**
 * **자리표시 상수만 갈아 끼운다.**
 *
 * 값 목록은 지금 **비어 있고**(`code-options.test.ts`가 그 사실을 고정한다) 비어 있는 동안
 * 화면은 조건 코드를 고를 수 없고 창고를 좁히지 못한다. 그런데 자리표시의 값어치는
 * **채워진 뒤에 무엇이 달라지는가**에 있다 — 그것을 재지 않으면 자리표시는 죽은 가지다.
 *
 * 판정·선택지 만들기·좁힘은 실물 그대로이고 바뀌는 것은 「값 목록이 왔다」는 사실 하나다.
 * 매 테스트 앞에서 빈 배열로 되돌려, 아무것도 채우지 않은 테스트는 **지금의 화면**을 본다.
 */
const { codeValues, defectTypeCodes, approvedStatusCodes } = vi.hoisted(() => ({
  codeValues: {
    issueType: [] as string[],
    sourceDocumentType: [] as string[],
    destinationType: [] as string[],
    disposalAccount: [] as string[],
    reason: [] as string[],
    receiptType: [] as string[],
    status: [] as string[],
    issueStatus: [] as string[],
  },
  defectTypeCodes: [] as string[],
  /**
   * 승인 완료를 뜻하는 상태 코드. **비어 있는 것이 지금의 사실이고**, 채웠을 때 결재 진행
   * 구획의 안내가 달라지는 것을 재는 자리다(전환 감지기).
   */
  approvedStatusCodes: [] as string[],
}));

vi.mock('./code-options', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./code-options')>();

  return {
    ...actual,
    PLACEHOLDER_DISPOSAL_ISSUE_CODES: codeValues,
    DEFECT_WAREHOUSE_TYPE_CODES: defectTypeCodes,
  };
});

/**
 * 승인 축의 자리표시도 같은 방식으로 갈아 끼운다 — **판정은 실물 그대로**이고 바뀌는 것은
 * 「값 목록이 왔다」는 사실 하나다. 채웠을 때 결재 진행 구획이 달라지지 않으면 그 자리표시는
 * 죽은 가지다.
 */
vi.mock('./approval-progress', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./approval-progress')>();

  return { ...actual, APPROVED_APPROVAL_STATUS_CODES: approvedStatusCodes };
});

/** 지어낸 합성 코드. **계약의 `@example` 값을 쓰지 않는다** — 예시가 확정 값으로 읽히면 안 된다. */
const SAMPLE_RECEIPT_TYPE = 'SAMPLE_GR_TYPE_A';
const SAMPLE_RECEIPT_STATUS = 'SAMPLE_GR_STATUS_A';

beforeEach(() => {
  codeValues.receiptType = [];
  codeValues.status = [];
  codeValues.issueType = [];
  codeValues.reason = [];
  codeValues.issueStatus = [];
  defectTypeCodes.length = 0;
  approvedStatusCodes.length = 0;
});

const fillCodeLists = (): void => {
  codeValues.receiptType = [SAMPLE_RECEIPT_TYPE];
  codeValues.status = [SAMPLE_RECEIPT_STATUS];
};

const fillDefectWarehouseTypes = (): void => {
  defectTypeCodes.push(SAMPLE_DEFECT_WAREHOUSE_TYPE);
};

const fillApprovedStatusCodes = (): void => {
  approvedStatusCodes.push(SAMPLE_APPROVED_STATUS);
};

const ROUTE = '/logistics/disposal-issue';
const LIST_PATH = '/logistics/goods-receipts';
const WAREHOUSES_PATH = '/mdm/warehouses';

/** 이 회차가 고른 전표(9001)에 대해 부르는 경로들. */
const DETAIL_PATH = '/logistics/goods-receipts/9001';
const MISSING_DETAIL_PATH = '/logistics/goods-receipts/9002';
const BALANCES_PATH = '/inventory/balances';
const ITEMS_PATH = '/mdm/items';
const UOMS_PATH = '/mdm/uoms';
const LOTS_PATH = '/trace/lots';
const LOCATIONS_PATH = '/mdm/locations';

/** 「처리 이력」 탭이 부르는 경로들. 고른 품의는 9501이고 그 승인 요청은 9521이다. */
const ISSUES_PATH = '/logistics/goods-issues';
const ISSUE_DETAIL_PATH = '/logistics/goods-issues/9501';
const MISSING_ISSUE_DETAIL_PATH = '/logistics/goods-issues/9502';
const APPROVAL_DETAIL_PATH = '/app/approval-requests/9521';

/**
 * 이 회차가 **부르지 않아야 하는** 경로. 뒤 회차에서 쓰이거나 계약에 있으나 이 화면이 쓰지
 * 않는 자리다. **부를 수 있게 스텁을 두는 것이 요점이다** — 부르지 않음을 증명하려면 부를 수
 * 있어야 한다.
 */
const LINES_PATH = '/logistics/goods-receipts/9001/lines';
const ISSUE_LINES_PATH = '/logistics/goods-issues/9501/lines';
/** 승인 요청 **목록**. 이슈 §4가 지시한 경로이나 대상 유형 값이 없어 성립하지 않는다(결정 10). */
const APPROVAL_LIST_PATH = '/app/approval-requests';

const WAREHOUSE_LABEL = 'SAMPLE-WH-01 · 합성 폐기창고 가';
const OTHER_WAREHOUSE_LABEL = 'SAMPLE-WH-02 · 합성 자재창고 나';
const ITEM_LABEL = 'SAMPLE-ITEM-01 · 합성 자재 가';
const UOM_LABEL = 'SAMPLE-UOM-EA · 합성 낱개';
const LOCATION_LABEL = 'SAMPLE-LOC-01 · 합성 적치 가';

/** 라인 전용 경로의 응답에만 있는 수량. 화면이 그 경로를 쓰지 않음을 **두 방향으로** 굳힌다. */
const LINES_ONLY_QTY = 7777;

interface RecordedRequest {
  method: string;
  url: URL;
  /**
   * 쓰기 요청의 본문. 읽기에는 `null`이다.
   *
   * **실제로 나간 요청을 본다.** 이 회차에서는 그 목록에 쓰기가 하나도 없다는 것이 단언이다.
   */
  body: unknown;
}

/**
 * 요청을 기록하면서 스텁 규칙으로 응답한다. 규칙에 없는 요청은 하네스가 던져 스텁 누락을 드러낸다.
 */
const createRecordingFetch = (
  routes: StubRoute[],
): { fetch: StubFetch; requests: RecordedRequest[] } => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch(routes);

  const fetch: StubFetch = async (request) => {
    /* 본문은 한 번만 읽을 수 있다 — 복제해 읽어야 스텁이 같은 요청을 다시 다룰 수 있다. */
    const body: unknown = request.method === 'GET' ? null : await request.clone().json();

    requests.push({ method: request.method, url: new URL(request.url), body });

    return stub(request);
  };

  return { fetch, requests };
};

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const listBody = (
  items: unknown[],
  page: Partial<{ page: number; size: number; total: number }> = {},
) => ({ items, page: { page: 1, size: 50, total: items.length, ...page } });

const listRoute = (
  items: unknown[] = goodsReceiptResponseFixtures,
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isGet(request, LIST_PATH),
  respond: () => jsonResponse(listBody(items, page)),
});

const failingListRoute = (status: number, body: unknown = { message: '' }): StubRoute => ({
  match: (request) => isGet(request, LIST_PATH),
  respond: () => jsonResponse(body, { status }),
});

/**
 * 부를 때마다 **내용이 달라지는** 목록.
 *
 * 다시 부르기가 같은 본문을 돌려주면 캐시가 구조 공유로 **같은 참조를 그대로 유지**해,
 * 「목록 응답이 도착하면 치던 값이 되돌아간다」는 결함이 드러나지 않는다.
 */
const changingListRoute = (): StubRoute => {
  let call = 0;

  return {
    match: (request) => isGet(request, LIST_PATH),
    respond: () => {
      call += 1;

      return jsonResponse(
        listBody(goodsReceiptResponseFixtures, {
          total: goodsReceiptResponseFixtures.length + call,
        }),
      );
    },
  };
};

const warehousesRoute = (
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isGet(request, WAREHOUSES_PATH),
  respond: () => jsonResponse(listBody(warehouseFixtures, page)),
});

const failingWarehousesRoute = (): StubRoute => ({
  match: (request) => isGet(request, WAREHOUSES_PATH),
  respond: () => jsonResponse({ message: '' }, { status: 500 }),
});

const detailBody = (lines: unknown[] = receiptLineResponseFixtures) => ({
  goodsReceipt: goodsReceiptResponseFixtures[0],
  lines,
});

const detailRoute = (lines?: unknown[]): StubRoute => ({
  match: (request) => isGet(request, DETAIL_PATH),
  respond: () => jsonResponse(detailBody(lines)),
});

const failingDetailRoute = (status: number, pathname = DETAIL_PATH): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse({ message: '' }, { status }),
});

/**
 * 부를 때마다 **내용이 달라지는** 상세.
 *
 * 다시 부르기가 같은 본문을 돌려주면 캐시가 구조 공유로 **같은 참조를 그대로 유지**해,
 * 「상세 응답이 도착하면 치던 값이 되돌아간다」는 결함이 드러나지 않는다(감지기 M30).
 *
 * **헤더만 바꾸는 것으로는 모자란다.** 구조 공유는 **부분마다** 견주므로, 라인 내용이 같으면
 * `lines` 배열은 앞의 참조를 그대로 유지한다 — 정리 effect의 의존성에 그 배열을 넣는 결함이
 * 그대로 통과한다(뮤테이션 실측). 그래서 **라인도 함께 달라지게** 한다: 초안이 매인 줄 번호는
 * 그대로 두고, 초안 판정에 쓰이지 않는 **셋째 줄의 입고 수량**만 회차마다 바꾼다.
 */
const changingDetailRoute = (): StubRoute => {
  let call = 0;

  return {
    match: (request) => isGet(request, DETAIL_PATH),
    respond: () => {
      call += 1;

      return jsonResponse({
        goodsReceipt: {
          ...goodsReceiptResponseFixtures[0],
          receiptDatetime: `2026-08-06T09:${String(10 + call).padStart(2, '0')}:00+09:00`,
        },
        lines: receiptLineResponseFixtures.map((line, index) =>
          index === 2 ? { ...line, receiptQty: line.receiptQty + call } : line,
        ),
      });
    },
  };
};

const balancesRoute = (): StubRoute => ({
  match: (request) => isGet(request, BALANCES_PATH),
  respond: (request) => {
    const itemId = Number(new URL(request.url).searchParams.get('itemId'));

    return jsonResponse(listBody(balanceResponseFixturesByItem[itemId] ?? []));
  },
});

/** 참조 다섯 중 **하나만** 실패시킨다 — 넷을 접는 판정의 범위를 재는 자리다. */
const failingReferenceRoute = (pathname: string): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse({ message: '' }, { status: 500 }),
});

const lineReferenceRoutes = (): StubRoute[] => [
  { match: (request) => isGet(request, ITEMS_PATH), respond: () => jsonResponse(listBody(itemFixtures)) },
  { match: (request) => isGet(request, UOMS_PATH), respond: () => jsonResponse(listBody(uomFixtures)) },
  {
    match: (request) => isGet(request, LOTS_PATH),
    respond: (request) => {
      const itemId = Number(new URL(request.url).searchParams.get('itemId'));

      return jsonResponse(listBody(lotFixturesByItem[itemId] ?? []));
    },
  },
  {
    match: (request) => isGet(request, LOCATIONS_PATH),
    respond: () => jsonResponse(listBody(locationFixtures)),
  },
];

const issueListRoute = (
  items: unknown[] = goodsIssueResponseFixtures,
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isGet(request, ISSUES_PATH),
  respond: () => jsonResponse(listBody(items, page)),
});

const failingIssueListRoute = (status: number): StubRoute => ({
  match: (request) => isGet(request, ISSUES_PATH),
  respond: () => jsonResponse({ message: '' }, { status }),
});

const issueDetailBody = (
  lines: unknown[] = goodsIssueLineResponseFixtures,
  issue: unknown = goodsIssueResponseFixtures[0],
) => ({ goodsIssue: issue, lines });

const issueDetailRoute = (
  lines?: unknown[],
  issue?: unknown,
  pathname = ISSUE_DETAIL_PATH,
): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse(issueDetailBody(lines, issue)),
});

const failingIssueDetailRoute = (status: number, pathname = ISSUE_DETAIL_PATH): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse({ message: '' }, { status }),
});

/**
 * 부를 때마다 **내용이 달라지는** 이력 목록·상세·승인 요청.
 *
 * 같은 본문을 돌려주면 캐시가 구조 공유로 같은 참조를 유지해 「다시 불렀는가」가 화면에
 * 드러나지 않는다 — 새로고침이 세 경로를 함께 부르는지 재려면 각자 달라져야 한다.
 */
const changingApprovalRoute = (): StubRoute => {
  let call = 0;

  return {
    match: (request) => isGet(request, APPROVAL_DETAIL_PATH),
    respond: () => {
      call += 1;

      return jsonResponse({
        ...approvalRequestDetailFixture,
        request: {
          ...approvalRequestDetailFixture.request,
          statusCode: `SAMPLE_AP_STATUS_${String(call)}`,
        },
      });
    },
  };
};

const approvalRoute = (detail: unknown = approvalRequestDetailFixture): StubRoute => ({
  match: (request) => isGet(request, APPROVAL_DETAIL_PATH),
  respond: () => jsonResponse(detail),
});

const failingApprovalRoute = (status: number): StubRoute => ({
  match: (request) => isGet(request, APPROVAL_DETAIL_PATH),
  respond: () => jsonResponse({ message: '' }, { status }),
});

/**
 * 이 회차가 부르지 않아야 하는 경로들. **부를 수 있게 둔다** — 스텁이 없으면 하네스가 던져
 * 「부르지 않았다」와 「불렀는데 실패했다」가 구분되지 않는다.
 */
const laterPhaseRoutes = (): StubRoute[] => [
  /* 라인 전용 경로는 상세가 이미 라인을 주므로 부를 이유가 없다 — 응답에 표식을 심어 둔다. */
  {
    match: (request) => isGet(request, LINES_PATH),
    respond: () =>
      jsonResponse(
        listBody([{ ...receiptLineResponseFixtures[0], receiptQty: LINES_ONLY_QTY }]),
      ),
  },
  {
    match: (request) => isGet(request, ISSUE_LINES_PATH),
    respond: () => jsonResponse(listBody(goodsIssueLineResponseFixtures)),
  },
  /* 이슈 §4가 지시한 승인 요청 **목록** 경로. 화면은 이것을 쓰지 않는다(계획 결정 10). */
  {
    match: (request) => isGet(request, APPROVAL_LIST_PATH),
    respond: () => jsonResponse(listBody([])),
  },
  {
    match: (request) => request.method === 'POST' && new URL(request.url).pathname === ISSUES_PATH,
    respond: () => jsonResponse({}, { status: 201 }),
  },
];

/** 이 화면이 닿을 수 있는 경로를 전부 스텁으로 둔 한 벌. */
const allRoutes = (extra: StubRoute[] = []): StubRoute[] => [
  ...extra,
  listRoute(),
  warehousesRoute(),
  detailRoute(),
  balancesRoute(),
  issueListRoute(),
  issueDetailRoute(),
  approvalRoute(),
  ...lineReferenceRoutes(),
  ...laterPhaseRoutes(),
];

/** 주소가 실제로 어떻게 바뀌는지 본다 — 수명 표를 판정할 유일한 근거다. */
const LocationProbe = () => {
  const location = useLocation();

  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

/**
 * **화면 바깥에서** 주소를 갈아 끼운다. 뒤로가기·앞으로가기·주소 직접 편집이 이 경로다.
 */
const SearchProbe = ({ to }: { to: string }) => {
  const [, setSearchParams] = useSearchParams();

  return (
    <button
      type="button"
      onClick={() => {
        setSearchParams(new URLSearchParams(to));
      }}
    >
      주소 이동
    </button>
  );
};

/**
 * 한 칸 뒤로 간다. **히스토리가 몇 칸 늘었는지를 판정하는 유일한 수단**이다 —
 * 기억 라우터는 브라우저 히스토리를 쓰지 않아 `window.history.back()`이 닿지 않는다.
 */
const BackProbe = () => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => {
        void navigate(-1);
      }}
    >
      뒤로
    </button>
  );
};

const renderScreen = (
  routes: StubRoute[],
  search = '',
  navigateTo = '',
): {
  requests: RecordedRequest[];
  queryClient: QueryClient;
  user: ReturnType<typeof userEvent.setup>;
} => {
  const { fetch, requests } = createRecordingFetch(routes);

  const { queryClient } = renderWithProviders(
    <>
      <DisposalIssueScreen />
      <LocationProbe />
      <BackProbe />
      <SearchProbe to={navigateTo} />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, queryClient, user: userEvent.setup() };
};

const requestsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === pathname);

/**
 * 이 회차에 이 화면이 부를 수 있는 경로 **전부**.
 *
 * **여기 없는 경로로 나간 요청은 그 자체가 결함이다** — 경로마다 세는 단언은 **예상 경로 집합
 * 밖으로** 나간 요청을 하나도 보지 못한다. 「고르지 않았는데 상세를 부른다」가 `…/0`처럼
 * 대체값을 단 경로로 나가면 어느 계수에도 걸리지 않는다.
 */
const KNOWN_PATHS = [
  LIST_PATH,
  WAREHOUSES_PATH,
  DETAIL_PATH,
  BALANCES_PATH,
  ITEMS_PATH,
  UOMS_PATH,
  LOTS_PATH,
  LOCATIONS_PATH,
  ISSUES_PATH,
  ISSUE_DETAIL_PATH,
  MISSING_ISSUE_DETAIL_PATH,
  APPROVAL_DETAIL_PATH,
];

const expectNoUnknownPath = (requests: RecordedRequest[]): void => {
  expect(
    requests
      .filter((request) => !KNOWN_PATHS.includes(request.url.pathname))
      .map((request) => `${request.method} ${request.url.pathname}`),
  ).toEqual([]);
};

/**
 * **고른 전표에 매인 조회들.** 「고르기 전에는 부르지 않는다」와 「고르면 한 번 부른다」를
 * 이 목록으로 함께 잰다 — 하나만 세면 나머지가 규칙 밖으로 샌다.
 */
const SELECTION_PATHS = [
  DETAIL_PATH,
  BALANCES_PATH,
  ITEMS_PATH,
  UOMS_PATH,
  LOTS_PATH,
  LOCATIONS_PATH,
];

/**
 * 화면이 **쓸모없는 실패를 만들지 않았는가.**
 *
 * 성립하지 않는 조회를 불러 두면 요청이 나가지 않아도 그 쿼리는 실패로 앉는다 —
 * 요청 수만 세는 단언은 이 자리를 보지 못한다.
 */
const expectNoFailedQuery = (queryClient: QueryClient): void => {
  expect(
    queryClient
      .getQueryCache()
      .getAll()
      .filter((query) => query.state.status === 'error')
      .map((query) => JSON.stringify(query.queryKey)),
  ).toEqual([]);
};

const currentLocation = (): string => screen.getByTestId('location').textContent ?? '';

const listTable = (): HTMLElement => {
  const table = screen.getAllByRole('table')[0];

  if (table === undefined) throw new Error('입고 전표 목록 표가 없다');

  return table;
};

/**
 * 목록의 첫 행이 그려질 때까지 기다린다.
 *
 * **문서 전체가 아니라 목록 표 안에서 본다** — 전표를 고르면 아래 구획의 제목줄에도 같은
 * 입고번호가 서므로, 문서 전체에서 단수로 찾으면 둘이 함께 있는 순간 던진다.
 */
const waitForList = async (): Promise<void> => {
  await waitFor(() => {
    expect(within(listTable()).getByText('GR-2026-900001')).toBeInTheDocument();
  });
};

const selectReceipt = async (
  user: ReturnType<typeof userEvent.setup>,
  goodsReceiptNo: string,
): Promise<void> => {
  await user.click(screen.getByRole('button', { name: t.actions.selectRow(goodsReceiptNo) }));
};

const search = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByRole('button', { name: messages.common.search }));
};

const refresh = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByRole('button', { name: t.actions.refresh }));
};

/**
 * 선택칸을 열고 그 선택지 목록을 돌려준다.
 *
 * **목록 안에서만 본다** — 창고 이름은 표의 창고 칸에도 나오므로 문서 전체에서 찾으면 무엇을
 * 집었는지 알 수 없다. 선택지 문구는 **접근 이름**으로 잰다: 항목마다 장식용 아이콘이 함께
 * 들어 있어 글자를 그대로 이으면 그 아이콘의 이름까지 딸려 온다.
 */
const openOptions = async (
  user: ReturnType<typeof userEvent.setup>,
  label: string,
): Promise<HTMLElement> => {
  await user.click(screen.getByLabelText(label));

  return screen.getByRole('listbox');
};

/** 목록 구획에 내부 번호가 새지 않았는지 본다. 짝이 되는 「이름은 보인다」와 함께 쓴다. */
const expectNoInternalIds = (): void => {
  const pane = screen.getByRole('region', { name: t.panes.list });

  for (const id of INTERNAL_IDS) {
    expect(pane.textContent ?? '').not.toContain(id);
  }
};

describe('DisposalIssueScreen — 첫 진입 조회', () => {
  /*
   * 기본 기간이나 기본 창고를 심으면 첫 요청에 조건이 실리고, 사용자는 왜 그것만 보이는지
   * 화면 어디에서도 읽을 수 없다. 창고를 심는 것은 「이 창고가 폐기 대상 창고다」를 화면이
   * 지어내는 것이기도 하다.
   */
  it('목록 요청이 1회 나가고 조건이 하나도 실리지 않는다', async () => {
    const { requests } = renderScreen(allRoutes());

    await waitForList();

    const list = requestsTo(requests, LIST_PATH);

    expect(list).toHaveLength(1);
    expect(list[0]?.url.searchParams.has('warehouseId')).toBe(false);
    expect(list[0]?.url.searchParams.has('receiptDateFrom')).toBe(false);
    /* 짝 방향 — 조건 자체가 하나도 실리지 않는다. */
    expect([...(list[0]?.url.searchParams.keys() ?? [])]).toEqual([]);
  });

  it('조건을 심지 않고 주소를 그대로 둔다', async () => {
    renderScreen(allRoutes());

    await waitForList();

    expect(currentLocation()).toBe(ROUTE);
  });

  it('결과가 표에 그려지고 배너가 없다', async () => {
    renderScreen(allRoutes());

    await waitForList();

    expect(within(listTable()).getAllByRole('row')).toHaveLength(
      goodsReceiptResponseFixtures.length + 1,
    );
    expect(screen.queryByText(messages.httpError.loadTitle)).not.toBeInTheDocument();
  });

  /** 창고는 첫 진입에 받는다 — 조건 줄과 목록 표가 첫 화면부터 이 이름을 쓴다. */
  it('창고 이름을 첫 진입에 1회 받는다', async () => {
    const { requests } = renderScreen(allRoutes());

    await waitForList();

    expect(requestsTo(requests, WAREHOUSES_PATH)).toHaveLength(1);
    expect(screen.getAllByText(WAREHOUSE_LABEL).length).toBeGreaterThan(0);
  });

  /**
   * **고르기 전에 부르는 경로는 둘뿐이다.** 상세·잔액·라인 참조 넷은 **고른 뒤에** 온다 —
   * 미리 부르면 쓰지 않는 자료를 받는다. **경로 전체를 세어** 예상 밖으로 나간 요청까지 잡는다.
   */
  it('고르기 전에는 목록과 창고 말고 어느 경로도 부르지 않는다', async () => {
    const { requests, queryClient } = renderScreen(allRoutes());

    await waitForList();

    expect(
      requests
        .filter((request) => request.url.pathname !== LIST_PATH)
        .filter((request) => request.url.pathname !== WAREHOUSES_PATH)
        .map((request) => `${request.method} ${request.url.pathname}`),
    ).toEqual([]);
    expectNoUnknownPath(requests);
    expectNoFailedQuery(queryClient);
  });

  /**
   * 이 회차는 대상을 보는 데까지다. 되돌릴 수 없는 쓰기는 확인 창·결과 구획과 함께 와야 하므로
   * 여기서는 어떤 쓰기도 나가지 않는다.
   */
  it('어떤 쓰기 요청도 보내지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await waitForList();
    await selectReceipt(user, 'GR-2026-900001');
    await user.type(screen.getByLabelText(t.fields.q), 'GR');
    await search(user);

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(1);
    });

    expect(requests.map((request) => request.method)).toEqual(requests.map(() => 'GET'));
    /* 본문이 실린 요청도 없다 — method만 세면 다른 경로의 쓰기를 놓친다. */
    expect(requests.map((request) => request.body)).toEqual(requests.map(() => null));
    /* 짝 방향 — 읽기는 실제로 나갔다(아무 요청도 없어서 통과한 것이 아니다). */
    expect(requests.length).toBeGreaterThan(0);
  });

  /** 목록 어느 칸에도 내부 번호가 없다. 짝으로 이름이 실제로 보이는 것을 함께 잰다. */
  it('목록에 내부 번호가 없고 이름은 보인다', async () => {
    renderScreen(allRoutes());

    await waitForList();

    expect(screen.getAllByText(WAREHOUSE_LABEL).length).toBeGreaterThan(0);
    expectNoInternalIds();
  });
});

describe('DisposalIssueScreen — 주소가 조건을 소유한다', () => {
  /** 컴포넌트 상태로만 들고 있으면 새로고침·뒤로가기·공유가 같은 결과를 내지 못한다. */
  it('조회를 누르면 조건이 주소에 실린다', async () => {
    const { user } = renderScreen(allRoutes());

    await waitForList();
    await user.type(screen.getByLabelText(t.fields.q), 'GR-2026');
    await search(user);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=GR-2026`);
    });
  });

  it('기간을 고르면 주소와 요청에 함께 실린다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await waitForList();
    await pickRange(user, screen.getByLabelText(t.fields.period), '2026-08-01', '2026-08-05');
    await search(user);

    await waitFor(() => {
      expect(currentLocation()).toContain('from=2026-08-01');
    });

    const list = requestsTo(requests, LIST_PATH);
    const last = list[list.length - 1];

    expect(last?.url.searchParams.get('receiptDateFrom')).toBe('2026-08-01');
    expect(last?.url.searchParams.get('receiptDateTo')).toBe('2026-08-05');
  });

  /** 조건 여섯이 **전부** 주소에서 오고 요청으로 간다 — 하나만 재면 나머지의 배선이 비어도 지나간다. */
  it('그 주소로 다시 들어가면 같은 조건으로 조회한다', async () => {
    const { requests } = renderScreen(
      allRoutes(),
      '?wh=9701&from=2026-08-01&to=2026-08-05&ty=SAMPLE_TY_A&st=SAMPLE_ST_A&q=GR-2026&page=2',
    );

    await waitForList();

    const list = requestsTo(requests, LIST_PATH);

    expect(list).toHaveLength(1);
    expect(Object.fromEntries(list[0]?.url.searchParams ?? [])).toEqual({
      warehouseId: '9701',
      receiptDateFrom: '2026-08-01',
      receiptDateTo: '2026-08-05',
      receiptTypeCode: 'SAMPLE_TY_A',
      statusCode: 'SAMPLE_ST_A',
      q: 'GR-2026',
      page: '2',
    });
  });

  /* 주소는 손으로 고쳐지는 자리다 — 이상한 값을 그대로 보내면 조회 전체가 실패한다. */
  it('정수가 아닌 조건과 없는 날짜는 요청에 실리지 않는다', async () => {
    const { requests } = renderScreen(
      allRoutes(),
      '?wh=abc&page=0&gr=xyz&q=%20%20&from=2026-02-31&to=2026-13-01',
    );

    await waitForList();

    const list = requestsTo(requests, LIST_PATH);

    expect([...(list[0]?.url.searchParams.keys() ?? [])]).toEqual([]);
    /* 짝 방향 — 실존하는 날짜는 실린다(전부 버려서 통과한 것이 아니다). */
    expect(list).toHaveLength(1);
  });

  it('실존하는 날짜는 요청에 실린다', async () => {
    const { requests } = renderScreen(allRoutes(), '?from=2026-02-28');

    await waitForList();

    expect(requestsTo(requests, LIST_PATH)[0]?.url.searchParams.get('receiptDateFrom')).toBe(
      '2026-02-28',
    );
  });

  /**
   * 입력마다 주소를 갱신하면 글자마다 뒤로가기 기록이 쌓이고, 화면이 조회 조건과 입력을
   * 같은 통로로 다루게 된다.
   */
  it('조건을 치는 동안에는 주소가 바뀌지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await waitForList();
    await user.type(screen.getByLabelText(t.fields.q), 'GR-2026');

    expect(currentLocation()).toBe(ROUTE);
    expect(requestsTo(requests, LIST_PATH)).toHaveLength(1);
  });

  /**
   * 조건과 쪽을 따로 갱신하면 뒤로가기 기록이 두 칸 늘어 사용자가 뒤로 눌렀는데 같은 자리로
   * 돌아온 것처럼 보인다.
   */
  it('조작 한 번에 주소 갱신도 한 번이다', async () => {
    const { user } = renderScreen(allRoutes(), '?page=2');

    await waitForList();
    await user.type(screen.getByLabelText(t.fields.q), 'GR');
    await search(user);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=GR`);
    });

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?page=2`);
    });
  });
});

describe('DisposalIssueScreen — 수명 표', () => {
  /** `page`·`gr`를 남기면 좁아진 결과에 없는 전표를 가리킨 채 주소만 남는다(1행). */
  it('조건을 바꾸면 첫 쪽으로 돌아가고 고른 전표가 풀린다', async () => {
    const { user } = renderScreen(allRoutes(), '?page=2&gr=9001');

    await waitForList();
    await user.type(screen.getByLabelText(t.fields.q), 'GR');
    await search(user);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=GR`);
    });
  });

  it('초기화가 조건·쪽·고른 전표를 함께 비운다', async () => {
    const { user } = renderScreen(allRoutes(), '?q=GR&page=2&gr=9001');

    await waitForList();
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  /** 쪽을 옮기면 보이는 행이 통째로 바뀐다. 고른 전표가 남으면 화면과 어긋난다(3행). */
  it('쪽을 옮기면 고른 전표가 풀린다', async () => {
    const { user } = renderScreen(
      allRoutes([listRoute(goodsReceiptResponseFixtures, { total: 120 })]),
      '?gr=9001',
    );

    await waitForList();
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?page=2`);
    });
  });

  /**
   * **조건이 걸린 상태의 쪽 이동**(3행의 「쪽만 옮긴다」 쪽 방향 · PR ① 검증 관찰 O2).
   *
   * 앞 감지기는 조건이 **없는** 주소에서 쪽 이동을 재므로 「쪽을 옮길 때 조건까지 비운다」는
   * 어긋남을 보지 못한다 — 결과 주소가 어느 쪽이든 `?page=2`로 같기 때문이다. 조건을 걸어
   * 두면 그 어긋남이 주소에서 곧바로 드러나고, **요청에도 그 조건이 그대로 실렸는지**를
   * 함께 잰다(주소만 남고 조회는 안 걸린 상태가 아님을 굳히는 짝).
   */
  it('조건이 걸린 상태에서 쪽을 옮기면 조건은 남고 선택만 풀린다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([listRoute(goodsReceiptResponseFixtures, { total: 120 })]),
      '?wh=9701&q=GR&gr=9001',
    );

    await waitForList();
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?wh=9701&q=GR&page=2`);
    });

    const last = requestsTo(requests, LIST_PATH).at(-1);

    expect(Object.fromEntries(last?.url.searchParams ?? [])).toEqual({
      warehouseId: '9701',
      q: 'GR',
      page: '2',
    });
  });

  /** 고르고 푸는 것은 **보이는 행을 바꾸지 않는다**(4행) — 3쪽에서 하나 골랐다고 1쪽으로 튀면 안 된다. */
  it('전표를 골라도 조건과 쪽은 그대로다', async () => {
    const { user } = renderScreen(
      allRoutes([listRoute(goodsReceiptResponseFixtures, { page: 2, total: 120 })]),
      '?q=GR&page=2',
    );

    await waitForList();
    await selectReceipt(user, 'GR-2026-900001');

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=GR&page=2&gr=9001`);
    });
  });

  it('고른 전표를 다시 누르면 풀린다', async () => {
    const { user } = renderScreen(allRoutes(), '?gr=9001');

    await waitForList();
    await user.click(
      screen.getByRole('button', { name: t.actions.deselectRow('GR-2026-900001') }),
    );

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  /**
   * 되돌림이 목록 응답에 반응하면 사용자가 조건을 치는 도중에 값이 사라진다(`omf-mes#43`).
   * 목록을 **실제로 다시 받은 뒤**에도 치던 값이 남아 있어야 한다(13·14행).
   */
  it('목록이 다시 도착해도 치던 조건이 사라지지 않는다', async () => {
    const { user } = renderScreen(allRoutes([changingListRoute()]));

    await waitForList();
    await user.type(screen.getByLabelText(t.fields.q), 'GR-2026');

    await refresh(user);

    await waitFor(() => {
      expect(screen.getByText(t.pageNav.range(1, 3, 5))).toBeInTheDocument();
    });

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('GR-2026');
  });

  /**
   * 「다시 조회」는 **화면이 보고 있는 조회**를 다시 한다 — 고르기 전에 그것은 목록 하나다.
   *
   * **참조(창고 이름)는 함께 부르지 않는다.** 기준정보는 이 조작으로 달라지지 않고, 다시
   * 부르면 표의 창고 칸이 잠깐 「불러오는 중」으로 되돌아간다. 못 받았을 때의 복구는 목록
   * 구획의 「다시 시도」가 따로 갖는다 — 그 둘을 한 버튼에 묶으면 문구가 적은 대상과 실제로
   * 다시 부르는 대상이 어긋난다.
   */
  it('고르기 전 다시 조회는 목록만 다시 부르고 참조는 건드리지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes([changingListRoute()]));

    await waitForList();

    expect(requestsTo(requests, WAREHOUSES_PATH)).toHaveLength(1);

    await refresh(user);

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH)).toHaveLength(2);
    });

    expect(requestsTo(requests, WAREHOUSES_PATH)).toHaveLength(1);
    /* 고르지 않았으면 상세·잔액은 **가드가 막는 것이 아니라 조회 자체가 없다.** */
    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(0);
    expect(requestsTo(requests, BALANCES_PATH)).toHaveLength(0);
  });

  /** 「다시 조회」는 조건·쪽·선택을 하나도 바꾸지 않는다(14행). */
  it('다시 조회가 조건과 선택을 그대로 둔다', async () => {
    const { requests, user } = renderScreen(allRoutes([changingListRoute()]), '?q=GR&gr=9001');

    await waitForList();
    await refresh(user);

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBe(2);
    });

    expect(currentLocation()).toBe(`${ROUTE}?q=GR&gr=9001`);
  });
});

describe('DisposalIssueScreen — 빈 상태 세 갈래', () => {
  /** 바깥에서 0건을 갈라 내면 `Table.empty`가 닿을 수 없는 가지가 된다. */
  it('결과가 없으면 표의 빈 상태가 맡는다', async () => {
    renderScreen(allRoutes([listRoute([])]));

    expect(await screen.findByText(t.empty.noResultTitle)).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('쪽 밖이면 다른 안내를 낸다', async () => {
    renderScreen(allRoutes([listRoute([], { page: 9, total: 120 })]), '?page=9');

    expect(await screen.findByText(t.empty.beyondLastTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
  });

  /** 셋째 갈래 — 아직 전표를 고르지 않았다. 표가 아니라 아래 구획이 맡는다. */
  it('전표를 고르기 전에는 고르라는 안내가 선다', async () => {
    const { user } = renderScreen(allRoutes());

    await waitForList();

    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();

    /* 짝 방향 — 고르면 그 안내가 사라진다. */
    await selectReceipt(user, 'GR-2026-900001');

    await waitFor(() => {
      expect(screen.queryByText(t.empty.noSelectionTitle)).not.toBeInTheDocument();
    });
  });
});

describe('DisposalIssueScreen — 조회 실패', () => {
  /** **실패를 빈 상태로 보이지 않는다** — 「없습니다」로 내면 자료가 없는 줄 알고 조건을 넓힌다. */
  it('조회 실패는 배너로 내고 빈 상태 문구를 함께 내지 않는다', async () => {
    renderScreen(allRoutes([failingListRoute(500)]));

    expect(await screen.findByText(messages.httpError.loadTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  /** 권한 없음에는 다시 시도를 내지 않는다 — 같은 권한으로 다시 불러도 같은 답이 온다. */
  it('권한 없음에는 다시 시도가 붙지 않는다', async () => {
    renderScreen(allRoutes([failingListRoute(403)]));

    expect(await screen.findByText(messages.httpError.title)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  /** 「버튼이 있다」만 보면 눌러도 아무 일이 없는 버튼을 통과시킨다 — **요청 수가 늘어야 한다.** */
  it('다시 시도를 누르면 그 경로의 요청 수가 는다', async () => {
    const { requests, user } = renderScreen(allRoutes([failingListRoute(500)]));

    await screen.findByText(messages.httpError.loadTitle);

    expect(requestsTo(requests, LIST_PATH)).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH)).toHaveLength(2);
    });
  });

  /** 창고 이름을 못 받아도 **목록은 그대로 산다** — 이름 자리에 사유가 표시된다. */
  it('창고 이름 조회가 실패해도 목록이 산다', async () => {
    const { requests, user } = renderScreen(allRoutes([failingWarehousesRoute()]));

    await waitForList();

    expect(screen.getByText(t.reasons.referencesFailed)).toBeInTheDocument();
    expect(screen.getAllByText(t.values.referenceFailed).length).toBe(
      goodsReceiptResponseFixtures.length,
    );

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, WAREHOUSES_PATH).length).toBe(2);
    });
  });

  /** 잘림은 실패와 다르다 — 다시 불러도 같은 쪽이 오므로 사실만 밝힌다. */
  it('창고 목록이 잘리면 그 사실을 밝힌다', async () => {
    renderScreen(allRoutes([warehousesRoute({ total: 120 })]));

    await waitForList();

    expect(screen.getByText(t.filters.lookupTruncated)).toBeInTheDocument();
    /* 못 불러온 것이 먼저다 — 잘림이 좁힘 안내를 덮는다. */
    expect(screen.queryByText(t.filters.warehouseTypePending)).not.toBeInTheDocument();
  });
});

/**
 * **자리표시의 두 방향.**
 *
 * 값 목록이 비어 있는 지금 무엇이 보이는지와, 채워졌을 때 무엇이 달라지는지를 함께 잰다 —
 * 뒤엣것을 재지 않으면 자리표시는 채워도 살아나지 않는 죽은 가지다.
 */
describe('DisposalIssueScreen — 조건 코드 자리표시', () => {
  it('값 목록이 비면 선택지가 비고 왜 비었는지 밝힌다', async () => {
    renderScreen(allRoutes());

    await waitForList();

    expect(screen.getByLabelText(t.fields.receiptType)).toHaveTextContent(
      messages.pendingCode.placeholder,
    );
    expect(screen.getAllByText(messages.pendingCode.note).length).toBe(2);
  });

  /**
   * **비어 있는 조회 조건 코드는 아무것도 막지 않는다.** 등록 필수 코드와 갈리는 자리다 —
   * 조건은 없어도 조회가 되고, 막으면 화면 전체가 값 확정을 기다리는 상태가 된다.
   */
  it('값 목록이 비어도 조회를 막지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await waitForList();

    expect(screen.getByRole('button', { name: messages.common.search })).not.toBeDisabled();

    await user.type(screen.getByLabelText(t.fields.q), 'GR');
    await search(user);

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH)).toHaveLength(2);
    });
  });

  it('값 목록이 채워지면 선택지가 서고 안내가 사라진다', async () => {
    fillCodeLists();

    const { user } = renderScreen(allRoutes());

    await waitForList();

    expect(screen.queryByText(messages.pendingCode.note)).not.toBeInTheDocument();

    const listbox = await openOptions(user, t.fields.receiptType);

    expect(within(listbox).getAllByRole('option')).toHaveLength(2);
    expect(within(listbox).getByRole('option', { name: t.filters.all })).toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: SAMPLE_RECEIPT_TYPE })).toBeInTheDocument();
  });
});

describe('DisposalIssueScreen — 폐기 대상 창고 좁힘', () => {
  /**
   * 지금은 **좁히지 못한다.** 창고 유형의 값 목록이 없어 「이 창고가 폐기 대상 창고인가」를
   * 화면이 물을 수 없다 — 전체를 보이고 그 사실을 밝힌다.
   */
  it('자리표시가 비면 전체 창고를 보이고 그 사실을 밝힌다', async () => {
    const { user } = renderScreen(allRoutes());

    await waitForList();

    expect(screen.getByText(t.filters.warehouseTypePending)).toBeInTheDocument();

    const listbox = await openOptions(user, t.fields.warehouse);

    expect(within(listbox).getAllByRole('option')).toHaveLength(3);
    expect(within(listbox).getByRole('option', { name: WAREHOUSE_LABEL })).toBeInTheDocument();
    /* 미사용 창고도 선택지에 남는다 — 빼면 그 창고로 들어온 과거 입고를 찾을 길이 사라진다. */
    expect(
      within(listbox).getByRole('option', {
        name: `${OTHER_WAREHOUSE_LABEL}${t.values.inactiveSuffix}`,
      }),
    ).toBeInTheDocument();
  });

  /** **전환** — 배열이 채워지면 그 유형만 남고 안내가 사라진다. */
  it('자리표시를 채우면 그 유형만 남고 안내가 사라진다', async () => {
    fillDefectWarehouseTypes();

    const { user } = renderScreen(allRoutes());

    await waitForList();

    expect(screen.queryByText(t.filters.warehouseTypePending)).not.toBeInTheDocument();

    const listbox = await openOptions(user, t.fields.warehouse);

    expect(within(listbox).getAllByRole('option')).toHaveLength(2);
    expect(within(listbox).getByRole('option', { name: WAREHOUSE_LABEL })).toBeInTheDocument();
    expect(
      within(listbox).queryByRole('option', {
        name: `${OTHER_WAREHOUSE_LABEL}${t.values.inactiveSuffix}`,
      }),
    ).not.toBeInTheDocument();
  });

  /**
   * **좁힌 뒤에도 목록 표의 이름은 전부 풀린다.** 조건 없이 조회하면 다른 창고의 입고가 함께
   * 오는데, 좁힌 목록으로 이름을 풀면 그 전표의 창고가 **「목록에 없음」으로 찍힌다**
   * (`omf-mes#47`이 금지한 표기).
   */
  it('좁힌 뒤에도 다른 창고의 입고 이름이 풀린다', async () => {
    fillDefectWarehouseTypes();

    renderScreen(allRoutes());

    await waitForList();

    expect(within(listTable()).getByText(OTHER_WAREHOUSE_LABEL)).toBeInTheDocument();
  });

  /** 좁힘은 **선택지 하나**에서만 일어난다 — 요청에 창고 유형 조건을 실어 좁히지 않는다. */
  it('좁힘을 요청 조건으로 만들지 않는다', async () => {
    fillDefectWarehouseTypes();

    const { requests } = renderScreen(allRoutes());

    await waitForList();

    expect(requestsTo(requests, WAREHOUSES_PATH)[0]?.url.searchParams.has('warehouseTypeCode')).toBe(
      false,
    );
    expect(requestsTo(requests, LIST_PATH)[0]?.url.searchParams.has('warehouseId')).toBe(false);
  });

  /**
   * **좁힘 밖 창고를 주소로 걸었을 때 — 표 쪽과 대칭인 칩 쪽 규칙.**
   *
   * 좁힘이 살아난 뒤에도 주소는 사람이 직접 고칠 수 있고, 그렇게 걸린 창고는 **선택지에 없다.**
   * 그때 화면이 그 조건을 말할 수 있는 자리는 **조건 칩 하나뿐**이므로, 칩의 이름 풀이가
   * **좁히지 않은 참조**를 써야 한다. 좁힌 목록으로 풀면 칩이 「창고: 알 수 없음」으로 서는데,
   * 그 문구는 *값이 잘못됐다*는 뜻이라 사용자가 반대로 읽는다(`omf-mes#47`이 금지한 표기).
   *
   * 「선택칸에는 서지 않지만 조건은 걸려 있고 칩이 그것을 이름으로 말한다」가 이 화면이
   * 그 상황을 받아들일 만하다고 판정한 근거다 — 그 문장을 이 감지기가 잰다.
   */
  it('좁힘 밖 창고를 주소로 걸어도 칩이 이름으로 말한다', async () => {
    fillDefectWarehouseTypes();

    const { requests, user } = renderScreen(allRoutes(), '?wh=9702');

    await waitForList();

    /* ① 칩이 그 창고를 **이름으로** 말한다 — 번호도 「알 수 없음」도 아니다. */
    expect(screen.getByText(t.filters.chipWarehouse(OTHER_WAREHOUSE_LABEL))).toBeInTheDocument();
    expect(
      screen.queryByText(t.filters.chipWarehouse(t.values.unknown)),
    ).not.toBeInTheDocument();

    /* ② 조건은 실제로 걸려 있다 — 칩만 뜨고 조회는 그대로인 상태가 아니다. */
    expect(requestsTo(requests, LIST_PATH)[0]?.url.searchParams.get('warehouseId')).toBe('9702');

    /* ③ 그런데 선택칸 선택지에는 없다 — 좁힘이 살아 있다는 짝 방향. */
    const listbox = await openOptions(user, t.fields.warehouse);

    expect(
      within(listbox).queryByRole('option', {
        name: `${OTHER_WAREHOUSE_LABEL}${t.values.inactiveSuffix}`,
      }),
    ).not.toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: WAREHOUSE_LABEL })).toBeInTheDocument();
  });
});

describe('DisposalIssueScreen — 조건 칩', () => {
  it('걸린 조건을 이름으로 보이고 ×가 그 조건만 푼다', async () => {
    const { user } = renderScreen(allRoutes(), '?wh=9701&q=GR-2026');

    await waitForList();

    expect(screen.getByText(t.filters.chipWarehouse(WAREHOUSE_LABEL))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.filters.chipRemoveWarehouse }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=GR-2026`);
    });
  });

  /** 이름을 못 풀어도 **번호를 대신 내지 않는다**(`omf-mes#44`). */
  it('이름을 못 푼 창고 조건에도 번호를 내지 않는다', async () => {
    renderScreen(allRoutes(), '?wh=9799');

    await waitForList();

    expect(screen.getByText(t.filters.chipWarehouse(t.values.unknown))).toBeInTheDocument();
    expectNoInternalIds();
  });
});

/** 아래 구획(고른 전표) 안에서만 본다 — 위 목록 표에도 같은 글자가 있다. */
const linesPane = (): HTMLElement => screen.getByRole('region', { name: t.panes.lines });

const qtyInput = (ordinal: number): HTMLElement =>
  screen.getByRole('textbox', { name: t.lineTable.disposalQtyLabel(ordinal) });

const lineCheckbox = (ordinal: number): HTMLElement =>
  screen.getByRole('checkbox', { name: t.lineTable.selectLabel(ordinal) });

/** 고른 전표의 라인이 실제로 그려질 때까지 기다린다. */
const waitForLines = async (): Promise<void> => {
  await screen.findByRole('checkbox', { name: t.lineTable.selectLabel(1) });
};

describe('DisposalIssueScreen — 고른 전표의 상세 조회', () => {
  /**
   * **고르기 전에는 부르지 않고, 고르면 각각 한 번씩 부른다**(감지기 M17·M20·M21).
   *
   * **경로 전체를 세어** 판정한다 — 「고르지 않았는데 부른다」가 `…/0`처럼 대체값을 단 경로로
   * 나가면 경로마다 세는 단언은 그것을 하나도 보지 못한다.
   */
  it('고르기 전에는 0회, 고른 뒤에 1회씩 부른다', async () => {
    const { requests, queryClient, user } = renderScreen(allRoutes());

    await waitForList();

    for (const path of SELECTION_PATHS) {
      expect(requestsTo(requests, path)).toHaveLength(0);
    }

    await selectReceipt(user, 'GR-2026-900001');
    await waitForLines();

    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(1);
    expect(requestsTo(requests, ITEMS_PATH)).toHaveLength(1);
    expect(requestsTo(requests, UOMS_PATH)).toHaveLength(1);
    expect(requestsTo(requests, LOCATIONS_PATH)).toHaveLength(1);
    expectNoUnknownPath(requests);
    expectNoFailedQuery(queryClient);
  });

  /**
   * **라인 전용 경로를 부르지 않는다** — 상세가 헤더와 라인을 함께 준다.
   * 짝 방향으로 그 응답에만 있는 수량이 화면에 없음을 함께 잰다.
   */
  it('라인 전용 경로를 부르지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();

    expect(requestsTo(requests, LINES_PATH)).toHaveLength(0);
    expect(document.body.textContent ?? '').not.toContain(String(LINES_ONLY_QTY));
  });

  /** 주소로 곧바로 들어와도 같다 — `gr`는 경로 조각이라 목록과 무관하게 상세를 부른다. */
  it('주소에 실린 전표로 곧바로 상세를 부른다', async () => {
    const { requests } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();

    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(1);
  });

  /**
   * **잔액은 품목마다 한 번**이다(감지기 M21). 라인이 셋이고 그중 둘이 같은 품목이므로
   * 라인마다 부르면 셋이 된다 — 그 어긋남을 이 픽스처가 드러낸다.
   */
  it('잔액을 품목마다 한 번만 부르고 조건 넷을 싣는다', async () => {
    const { requests } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();

    await waitFor(() => {
      expect(requestsTo(requests, BALANCES_PATH)).toHaveLength(2);
    });

    const itemIds = requestsTo(requests, BALANCES_PATH)
      .map((request) => request.url.searchParams.get('itemId'))
      .sort();

    expect(itemIds).toEqual(['9301', '9302']);

    for (const request of requestsTo(requests, BALANCES_PATH)) {
      expect(request.url.searchParams.get('groupBy')).toBe('LOT');
      expect(request.url.searchParams.get('includeZero')).toBe('true');
      expect(request.url.searchParams.get('warehouseId')).toBe('9701');
    }
  });

  /**
   * **잔액·위치의 창고는 「고른 전표의 창고」다** — 조건 줄의 창고가 아니다.
   *
   * 조건에 다른 창고(9702)를 걸어 두고 그 창고가 **아닌** 전표(9001 → 창고 9701)를 고른다.
   * 조건 줄의 값을 쓰면 **남의 창고 잔액이 상한이 되고**, 값 목록이 확정돼 선택지가 좁혀지는
   * 순간 그 어긋남이 조용히 커진다(PR ①의 창고 좁힘과 맞물리는 자리다).
   */
  it('잔액과 위치는 조건 줄의 창고가 아니라 고른 전표의 창고로 부른다', async () => {
    const { requests } = renderScreen(allRoutes(), '?wh=9702&gr=9001');

    await waitForLines();

    await waitFor(() => {
      expect(requestsTo(requests, BALANCES_PATH).length).toBeGreaterThan(0);
    });

    for (const request of requestsTo(requests, BALANCES_PATH)) {
      expect(request.url.searchParams.get('warehouseId')).toBe('9701');
    }

    expect(requestsTo(requests, LOCATIONS_PATH)[0]?.url.searchParams.get('warehouseId')).toBe(
      '9701',
    );
    /* 짝 방향 — 목록 조회에는 조건 줄의 창고가 그대로 실려 있다. */
    expect(requestsTo(requests, LIST_PATH)[0]?.url.searchParams.get('warehouseId')).toBe('9702');
  });

  /**
   * **「다시 조회」가 상세와 잔액도 함께 부른다**(감지기 M18 · W-01-07 Major의 형태).
   * 목록만 다시 부르면 아래 구획이 낡은 채로 남아 **이미 없어진 자재를 폐기하려 한다.**
   */
  it('다시 조회가 목록·상세·잔액을 함께 부른다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([changingListRoute(), changingDetailRoute()]),
      '?gr=9001',
    );

    await waitForLines();

    await waitFor(() => {
      expect(requestsTo(requests, BALANCES_PATH)).toHaveLength(2);
    });

    await refresh(user);

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH)).toHaveLength(2);
      expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(2);
      expect(requestsTo(requests, BALANCES_PATH)).toHaveLength(4);
    });

    /* 참조는 그대로다 — 기준정보는 이 조작으로 달라지지 않는다. */
    expect(requestsTo(requests, ITEMS_PATH)).toHaveLength(1);
    expect(requestsTo(requests, WAREHOUSES_PATH)).toHaveLength(1);
  });
});

describe('DisposalIssueScreen — 상세가 없는 전표', () => {
  /**
   * **404면 「찾을 수 없습니다」이고 `gr`를 주소에서 정리한다**(수명 표 5행 · 감지기 M19).
   * 남기면 빈 구획이 서고, 사용자는 자기가 무엇을 눌렀는지 되짚을 수 없다.
   */
  it('404면 안내가 서고 고른 전표가 주소에서 정리된다', async () => {
    renderScreen(allRoutes([failingDetailRoute(404)]), '?q=GR&gr=9001');

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeInTheDocument();

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=GR`);
    });

    /* 조건은 하나도 바꾸지 않는다 — 없어진 전표 하나 때문에 좁혀 둔 조건까지 되돌리지 않는다. */
    expect(screen.queryByText(t.empty.noSelectionTitle)).not.toBeInTheDocument();
  });

  /**
   * **정리가 뒤로가기 기록을 늘리지 않는다**(전례 감지기 이식 — 리뷰 t2 Major ①).
   *
   * 늘리면 뒤로 눌렀을 때 **없는 전표를 가리키는 주소로 되돌아가** 같은 정리가 되풀이되고,
   * 사용자는 **앞 화면으로 빠져나갈 수 없다.** 주소를 바깥에서 갈아 끼워(뒤로가기·주소 직접
   * 편집과 같은 경로) 히스토리가 실제로 몇 칸 쌓였는지를 잰다.
   */
  it('404 정리가 뒤로가기 기록을 늘리지 않는다', async () => {
    const { user } = renderScreen(
      allRoutes([failingDetailRoute(404, MISSING_DETAIL_PATH)]),
      '?q=GR',
      'gr=9002',
    );

    await waitForList();
    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeInTheDocument();

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    /* 한 칸 뒤로 가면 **없는 전표 주소가 아니라** 그 앞의 조회 상태로 돌아간다. */
    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=GR`);
    });
  });

  /**
   * **새 조회·초기화가 안내를 거둔다**(리뷰 t2 Minor ③).
   *
   * 안내를 끄는 자리가 클릭 핸들러 하나뿐이면, 404로 안내가 선 뒤 조건을 바꿔 조회하거나
   * 초기화를 눌러도 그 문장이 화면에 남는다 — **방금 한 조작과 무관한 사정을 화면이 계속
   * 말한다.** 지적 ①과 같은 뿌리(핸들러에만 두면 다른 경로가 샌다)다.
   */
  it('새 조회와 초기화가 없음 안내를 거둔다', async () => {
    const { user } = renderScreen(
      allRoutes([failingDetailRoute(404, MISSING_DETAIL_PATH)]),
      '?gr=9002',
    );

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeInTheDocument();

    await user.type(screen.getByLabelText(t.fields.q), 'GR');
    await search(user);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=GR`);
    });

    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  it('초기화도 없음 안내를 거둔다', async () => {
    const { user } = renderScreen(
      allRoutes([failingDetailRoute(404, MISSING_DETAIL_PATH)]),
      '?q=GR&gr=9002',
    );

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });

    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
  });

  /**
   * **안내는 자기 사정보다 오래 살지 않는다 — 주소로 오간 경우에도**(전례 이식분의 짝 감지기).
   *
   * 안내를 거두는 자리가 클릭 핸들러뿐이면 **뒤로가기·앞으로가기·주소 직접 편집**으로 `gr`가
   * 다시 생기는 경로가 통째로 샌다. 화면이 안내를 그리는 조건은 「고른 전표가 없다」이므로
   * 전표를 고른 동안에는 어긋남이 **가려져 있다가**, 그 전표를 놓는 순간 **아무것도 404가
   * 아닌데 「찾을 수 없습니다」가 되살아난다.** 그래서 셋을 이어서 잰다:
   * 404 → 주소로 **성한 전표** 고르기 → 뒤로 눌러 **선택 놓기**.
   */
  it('주소로 성한 전표를 고른 뒤 놓아도 없음 안내가 되살아나지 않는다', async () => {
    const { user } = renderScreen(
      allRoutes([failingDetailRoute(404, MISSING_DETAIL_PATH)]),
      '?gr=9002',
      'gr=9001',
    );

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeInTheDocument();

    /* 클릭 핸들러를 거치지 않는 길로 성한 전표를 고른다. */
    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await waitForLines();

    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();

    /* 다시 핸들러를 거치지 않고 선택을 놓는다 — 안내를 그리는 조건이 되살아나는 자리다. */
    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });

    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  /** 다시 고르면 안내가 사라진다 — 「없다」가 화면에 눌어붙지 않는다. */
  it('다시 고르면 없음 안내가 사라진다', async () => {
    const { user } = renderScreen(
      allRoutes([failingDetailRoute(404, MISSING_DETAIL_PATH)]),
      '?gr=9002',
    );

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeInTheDocument();

    await selectReceipt(user, 'GR-2026-900001');
    await waitForLines();

    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
  });

  /**
   * **404가 아닌 실패를 「없다」로 말하지 않는다.** 500은 다시 시도로 풀릴 수 있고 사용자가
   * 할 조치가 다르다 — 고른 전표를 주소에서 지우면 그 조치를 할 대상이 사라진다.
   */
  it('500이면 선택을 정리하지 않는다', async () => {
    renderScreen(allRoutes([failingDetailRoute(500)]), '?gr=9001');

    await waitForList();

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?gr=9001`);
    });

    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
  });

  /**
   * **물류 상세에 403 갈래를 만들지 않는다**(완료 조건 C20). 계약의 응답은 200과 404 둘뿐이라
   * 만들면 닿을 수 없는 가지가 된다 — 403이 와도 「없다」로 말하지 않는다.
   */
  it('403에도 없음 안내를 내지 않는다', async () => {
    renderScreen(allRoutes([failingDetailRoute(403)]), '?gr=9001');

    await waitForList();

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?gr=9001`);
    });

    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
  });
});

describe('DisposalIssueScreen — 라인 표와 폐기 수량', () => {
  /**
   * **스펙 5열의 나머지 셋이 이 구획에 있다**(승인 기록 정정 2) — 품목·자재 LOT·보유 수량.
   * 위 표가 내는 입고번호·입고일과 함께 다섯이 한 화면에서 읽힌다.
   */
  it('제목줄과 라인 표가 서고 참조를 이름으로 푼다', async () => {
    renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();

    const pane = linesPane();

    expect(within(pane).getByText('GR-2026-900001')).toBeInTheDocument();
    expect(within(pane).getAllByText(ITEM_LABEL).length).toBeGreaterThan(0);
    expect(within(pane).getByText('SAMPLE-LOT-0001')).toBeInTheDocument();
    expect(within(pane).getAllByText(LOCATION_LABEL).length).toBeGreaterThan(0);
    expect(within(pane).getByText(t.lineTable.receiptQtyPair(100, UOM_LABEL))).toBeInTheDocument();
  });

  /**
   * **좁힘이 살아나도 제목줄은 이름으로 말한다**(`omf-mes#47` 방지 · PR ① 창고 좁힘과 맞물림).
   *
   * 값 목록이 확정돼 선택지가 폐기 대상 유형으로 좁혀진 상태에서, **좁힘 밖 창고**(9702)의
   * 전표를 상세가 내려 준다. 제목줄이 **좁힌 목록으로** 이름을 풀면 정상 창고가
   * 「알 수 없음」으로 찍히는데, 그 문구는 *값이 잘못됐다*는 뜻이라 사용자가 반대로 읽는다.
   */
  it('좁힘 밖 창고의 전표를 골라도 제목줄이 이름으로 말한다', async () => {
    fillDefectWarehouseTypes();

    const { user } = renderScreen(
      allRoutes([
        {
          match: (request) => isGet(request, DETAIL_PATH),
          respond: () =>
            jsonResponse({
              goodsReceipt: { ...goodsReceiptResponseFixtures[0], warehouseId: 9702 },
              lines: receiptLineResponseFixtures,
            }),
        },
      ]),
      '?gr=9001',
    );

    await waitForLines();

    const pane = linesPane();

    expect(within(pane).getByText(OTHER_WAREHOUSE_LABEL)).toBeInTheDocument();
    expect(within(pane).queryByText(t.values.unknown)).not.toBeInTheDocument();

    /* 짝 방향 — 좁힘은 살아 있다. 좁혀지는 자리는 **선택지 하나**이지 이름 풀이가 아니다. */
    const options = await openOptions(user, t.fields.warehouse);

    expect(
      within(options)
        .getAllByRole('option')
        .map((option) => option.getAttribute('aria-label') ?? option.textContent),
    ).not.toContain(OTHER_WAREHOUSE_LABEL);
  });

  /** **짝 단언** — 이름이 보이는 것을 먼저 재고 내부 번호가 없음을 잰다(`omf-mes#44`). */
  it('아래 구획 어디에도 내부 번호가 없다', async () => {
    renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();

    const pane = linesPane();

    expect(within(pane).getByText('GR-2026-900001')).toBeInTheDocument();

    for (const id of INTERNAL_IDS) {
      expect(pane.textContent ?? '').not.toContain(id);
    }
  });

  /** **빈 칸으로 시작한다**(완료 조건 C26 · 감지기 M26) — 전량 폐기가 기본값처럼 보이면 안 된다. */
  it('폐기 수량 칸이 빈 칸으로 시작한다', async () => {
    renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();

    for (const ordinal of [1, 2, 3]) {
      expect(qtyInput(ordinal)).toHaveValue('');
    }
  });

  /** **가용 45가 아니라 보유 80**을 상한으로 쓴다(완료 조건 C23 · 감지기 M22). */
  it('보유 수량을 상한으로 쓰고 가용 수량을 쓰지 않는다', async () => {
    const { user } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();

    await screen.findByText(t.lineTable.onHandQtyPair(80, UOM_LABEL));

    await user.click(lineCheckbox(1));
    await user.type(qtyInput(1), '41');

    /* 가용(45)을 상한으로 썼다면 41은 통과하고 46은 막힌다 — 둘 다 통과해야 옳다. */
    expect(screen.queryByText(t.errors.qtyOverOnHand(45))).not.toBeInTheDocument();
    expect(screen.queryByText(t.errors.qtyOverOnHand(80))).not.toBeInTheDocument();
    expect(screen.getByText(t.selection.summary(1, 41, UOM_LABEL))).toBeInTheDocument();

    await user.clear(qtyInput(1));
    await user.type(qtyInput(1), '81');

    expect(await screen.findByText(t.errors.qtyOverOnHand(80))).toBeInTheDocument();
  });

  /** 줄 선택과 수량이 **짝**이다(완료 조건 C27) — 고른 줄에 수량이 없으면 다음 단계가 막힌다. */
  it('고른 줄의 수량이 비면 그 사유가 선다', async () => {
    const { user } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();
    await user.click(lineCheckbox(1));

    expect(screen.getByText(t.reasons.selectQtyMissing)).toBeInTheDocument();

    await user.type(qtyInput(1), '5');

    await waitFor(() => {
      expect(screen.queryByText(t.reasons.selectQtyMissing)).not.toBeInTheDocument();
    });

    expect(screen.getByText(t.selection.summary(1, 5, UOM_LABEL))).toBeInTheDocument();
  });

  /** **고르지 않은 줄의 수량은 합계에 들어가지 않는다**(감지기 M28). */
  it('고르지 않은 줄에 친 수량은 요약에 들어가지 않는다', async () => {
    const { user } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();
    await user.click(lineCheckbox(1));
    await user.type(qtyInput(1), '5');
    await user.type(qtyInput(2), '7');

    expect(screen.getByText(t.selection.summary(1, 5, UOM_LABEL))).toBeInTheDocument();
    expect(screen.queryByText(t.selection.summary(2, 12, UOM_LABEL))).not.toBeInTheDocument();
  });

  /** **단위가 섞이면 합치지 않는다**(완료 조건 C28 · 감지기 M29) — 줄 수는 그대로 낸다. */
  it('단위가 다른 줄을 함께 고르면 합계를 내지 않는다', async () => {
    const { user } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();
    await user.click(lineCheckbox(1));
    await user.type(qtyInput(1), '5');
    await user.click(lineCheckbox(3));
    await user.type(qtyInput(3), '2');

    expect(screen.getByText(t.selection.summaryMixedUom(2))).toBeInTheDocument();
    expect(screen.queryByText(t.selection.summary(2, 7, UOM_LABEL))).not.toBeInTheDocument();
  });

  /** 보류 표식은 **막지 않고 알린다** — 보류·차단된 자재를 덜어 내는 것이 이 화면의 주 용도다. */
  it('보류인 LOT도 고를 수 있다', async () => {
    const { user } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();

    expect(await screen.findByText(t.values.lotHeld)).toBeInTheDocument();

    await user.click(lineCheckbox(2));
    await user.type(qtyInput(2), '3');

    /* 보유가 0으로 **확인된** 줄이라 상한이 걸린다 — 표식이 아니라 수량이 막는다. */
    expect(screen.getByText(t.errors.qtyOverOnHand(0))).toBeInTheDocument();
  });

  /**
   * **상한을 확인하지 못한 줄은 막지 않는다**(완료 조건 C24 · 감지기 M23).
   * 잔액이 실패해도 선택·입력이 살아 있고 「막지 않는다」 안내가 선다.
   */
  it('잔액 조회가 실패해도 선택과 입력이 막히지 않는다', async () => {
    const { user } = renderScreen(
      allRoutes([
        {
          match: (request) => isGet(request, BALANCES_PATH),
          respond: () => jsonResponse({ message: '' }, { status: 500 }),
        },
      ]),
      '?gr=9001',
    );

    await waitForLines();

    expect(await screen.findByText(t.reasons.balancesFailed)).toBeInTheDocument();
    expect(screen.getByText(t.reasons.onHandUnknownNote)).toBeInTheDocument();
    expect(screen.getAllByText(t.values.onHandUnknown).length).toBeGreaterThan(0);

    await user.click(lineCheckbox(1));
    await user.type(qtyInput(1), '99999');

    expect(screen.getByText(t.selection.summary(1, 99999, UOM_LABEL))).toBeInTheDocument();
    expect(screen.queryByText(t.reasons.selectQtyInvalid)).not.toBeInTheDocument();
  });

  /** 잔액 실패의 복구는 **잔액만** 다시 부른다 — 문구가 적은 대상과 부르는 대상이 같아야 한다. */
  it('잔액 「다시 시도」가 잔액만 다시 부른다', async () => {
    let failing = true;

    const { requests, user } = renderScreen(
      allRoutes([
        {
          match: (request) => isGet(request, BALANCES_PATH),
          respond: (request) => {
            if (failing) return jsonResponse({ message: '' }, { status: 500 });

            const itemId = Number(new URL(request.url).searchParams.get('itemId'));

            return jsonResponse(listBody(balanceResponseFixturesByItem[itemId] ?? []));
          },
        },
      ]),
      '?gr=9001',
    );

    await waitForLines();
    await screen.findByText(t.reasons.balancesFailed);

    failing = false;
    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(screen.queryByText(t.reasons.balancesFailed)).not.toBeInTheDocument();
    });

    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(1);
    expect(requestsTo(requests, LIST_PATH)).toHaveLength(1);
  });

  /** 라인이 0건인 전표도 있다 — 표의 빈 상태가 맡는다(바깥에서 0건을 가르지 않는다). */
  it('라인이 0건이면 표의 빈 상태가 맡는다', async () => {
    renderScreen(allRoutes([detailRoute([])]), '?gr=9001');

    expect(await screen.findByText(t.empty.noLinesTitle)).toBeInTheDocument();
    expect(within(linesPane()).getByRole('table')).toBeInTheDocument();
  });
});

describe('DisposalIssueScreen — 줄 초안의 수명', () => {
  /**
   * **전표를 바꾸면 줄·수량 초안이 비고, 응답 도착으로는 비지 않는다**(감지기 M30 · 두 방향).
   *
   * 응답 배열을 정리 effect의 의존성에 넣으면 갱신이 도착할 때마다 **치던 값이 사라진다**
   * (`omf-mes#43`). 다시 부르기가 **내용이 달라지는** 응답을 주어야 그 결함이 드러난다 —
   * 같은 본문이면 캐시가 구조 공유로 같은 참조를 유지해 effect가 깨어나지 않는다.
   */
  it('다시 조회로 상세가 새로 도착해도 고른 줄과 친 수량이 남는다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([changingListRoute(), changingDetailRoute()]),
      '?gr=9001',
    );

    await waitForLines();
    await user.click(lineCheckbox(1));
    await user.type(qtyInput(1), '5');

    await refresh(user);

    await waitFor(() => {
      expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(2);
    });

    expect(lineCheckbox(1)).toBeChecked();
    expect(qtyInput(1)).toHaveValue('5');
  });

  /** 짝 방향 — **전표가 바뀌면 비운다.** 앞 전표의 수량이 남으면 남의 전표의 수량이 실린다. */
  it('전표를 바꾸면 고른 줄과 친 수량이 비워진다', async () => {
    const { user } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();
    await user.click(lineCheckbox(1));
    await user.type(qtyInput(1), '5');

    /* 같은 전표를 풀었다 다시 고르는 것도 「대상이 바뀐 것」이다. */
    await user.click(
      screen.getByRole('button', { name: t.actions.deselectRow('GR-2026-900001') }),
    );

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });

    await selectReceipt(user, 'GR-2026-900001');
    await waitForLines();

    expect(lineCheckbox(1)).not.toBeChecked();
    expect(qtyInput(1)).toHaveValue('');
  });

  /** 조건을 바꾸면 `gr`가 풀리므로 초안도 함께 사라진다(수명 표 1행). */
  it('조건을 바꾸면 줄 초안도 사라진다', async () => {
    const { user } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();
    await user.click(lineCheckbox(1));
    await user.type(qtyInput(1), '5');

    await user.type(screen.getByLabelText(t.fields.q), 'GR');
    await search(user);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=GR`);
    });

    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });
});

describe('DisposalIssueScreen — 이 회차에도 쓰기가 없다', () => {
  /**
   * **기록된 모든 요청의 method가 `GET`이다**(완료 조건 C30). 줄을 고르고 수량을 치고
   * 다시 조회까지 해도 쓰기가 하나도 나가지 않는다.
   */
  it('줄을 고르고 수량을 쳐도 어떤 쓰기 요청도 보내지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes([changingDetailRoute()]), '?gr=9001');

    await waitForLines();
    await user.click(lineCheckbox(1));
    await user.type(qtyInput(1), '5');
    await user.click(lineCheckbox(3));
    await user.type(qtyInput(3), '2');
    await refresh(user);

    await waitFor(() => {
      expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(2);
    });

    expect(requests.map((request) => request.method)).toEqual(requests.map(() => 'GET'));
    expectNoUnknownPath(requests);
  });
});

/* ─────────────────────────  「처리 이력」 탭  ───────────────────────── */

const HISTORY_SEARCH = '?tab=history';

const historyListPane = (): HTMLElement =>
  screen.getByRole('region', { name: t.panes.historyList });

const historyDetailPane = (): HTMLElement =>
  screen.getByRole('region', { name: t.panes.historyDetail });

const historyTable = (): HTMLElement => {
  const table = within(historyListPane()).getAllByRole('table')[0];

  if (table === undefined) throw new Error('처리 이력 목록 표가 없다');

  return table;
};

const waitForIssueList = async (): Promise<void> => {
  await waitFor(() => {
    expect(within(historyTable()).getByText('GI-2026-950001')).toBeInTheDocument();
  });
};

const selectIssue = async (
  user: ReturnType<typeof userEvent.setup>,
  goodsIssueNo: string,
): Promise<void> => {
  await user.click(screen.getByRole('button', { name: t.actions.selectIssueRow(goodsIssueNo) }));
};

const openTab = async (
  user: ReturnType<typeof userEvent.setup>,
  label: string,
): Promise<void> => {
  await user.click(screen.getByRole('tab', { name: label }));
};

/** 고른 품의의 라인이 실제로 그려질 때까지 기다린다. */
const waitForIssueLines = async (): Promise<void> => {
  await within(historyDetailPane()).findByText('SAMPLE-LOT-0001');
};

describe('DisposalIssueScreen — 탭 둘', () => {
  it('탭이 둘이고 이름이 스펙 문면 그대로다', async () => {
    renderScreen(allRoutes());

    await waitForList();

    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: t.tabs.disposal })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: t.tabs.history })).toBeInTheDocument();
  });

  /**
   * **결재는 이 화면이 하지 않는다**(승인 기록 정정 1-2). 밝히지 않으면 사용자가 여기서
   * 결재할 수 있다고 믿고 있지도 않은 승인 버튼을 찾아 헤맨다.
   */
  it('탭 줄에 결재를 어디서 하는지 적는다', async () => {
    renderScreen(allRoutes());

    await waitForList();

    expect(screen.getByText(t.tabs.note)).toBeInTheDocument();
  });

  /** 감지기 M32 — 탭을 컴포넌트 상태로만 들고 있으면 이 단언이 무너진다. */
  it('탭 전환이 주소에 실리고 그 주소로 다시 들어가면 같은 탭이 열린다', async () => {
    const { user } = renderScreen(allRoutes());

    await waitForList();
    await openTab(user, t.tabs.history);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}${HISTORY_SEARCH}`);
    });

    await waitForIssueList();

    renderScreen(allRoutes(), HISTORY_SEARCH);

    expect(screen.getAllByRole('tab', { selected: true })[0]).toHaveAccessibleName(t.tabs.history);
  });

  /** 기본값을 주소에 적으면 같은 화면의 주소가 두 가지가 된다. */
  it('기본 탭은 주소에 적히지 않는다', async () => {
    const { user } = renderScreen(allRoutes(), HISTORY_SEARCH);

    await waitForIssueList();
    await openTab(user, t.tabs.disposal);

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  /**
   * 감지기 M37 — **활성 탭의 `content`에만 내용을 담는다.** 디자인 시스템 `Tabs`는 패널을 전부
   * 렌더하고 비활성만 `hidden`으로 감춘다(구현 실측). **두 방향으로 잰다.**
   *
   * **역할(role)로 재지 않고 DOM을 직접 센다.** `getByRole`은 `hidden`이 붙은 가지를 접근성
   * 트리에서 빼므로, 두 패널에 내용을 다 담아도 역할 질의로는 **잡히지 않는다**(뮤테이션
   * 실측 — 이 감지기가 처음 형태로는 죽지 않았다). 그런데 숨은 패널은 **DOM에 그대로 있고**
   * 그 안의 표·조회·입력칸이 함께 살아 있다 — 그 사실을 재려면 문서를 세는 수밖에 없다.
   */
  it('비활성 탭의 내용이 DOM에 없다', async () => {
    const paneCount = (label: string): number =>
      document.querySelectorAll(`section[aria-label="${label}"]`).length;

    const { user } = renderScreen(allRoutes());

    await waitForList();

    expect(paneCount(t.panes.list)).toBe(1);
    expect(paneCount(t.panes.historyList)).toBe(0);
    expect(paneCount(t.panes.historyDetail)).toBe(0);

    await openTab(user, t.tabs.history);
    await waitForIssueList();

    expect(paneCount(t.panes.historyList)).toBe(1);
    expect(paneCount(t.panes.list)).toBe(0);
    expect(paneCount(t.panes.lines)).toBe(0);
  });

  /**
   * 같은 규칙의 다른 관측 경로 — **숨은 탭의 표가 문서에 남지 않는다.**
   *
   * 구획을 세는 것만으로는 「구획은 없는데 표만 남는」 형태를 놓친다. 표가 남으면 그 표의
   * 행·버튼이 문서에 살아 있어 자동화·보조기술이 닿고, 같은 이름의 컨트롤이 둘이 된다.
   */
  it('비활성 탭의 표가 문서에 남지 않는다', async () => {
    const { user } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();

    /* 발의 탭: 대상 목록 표 + 라인 표 둘뿐이다. */
    expect(document.querySelectorAll('table')).toHaveLength(2);

    await openTab(user, t.tabs.history);
    await waitForIssueList();

    /* 이력 탭: 이력 목록 표 하나뿐이다(품의를 고르지 않아 라인 표가 없다). */
    expect(document.querySelectorAll('table')).toHaveLength(1);
  });

  /**
   * 감지기 M38 — **보이지 않는 탭의 조회는 나가지 않는다.** 두 탭의 조건과 선택이 한 주소에
   * 함께 살아 있어 값만으로는 조회가 성립하므로, 탭을 조회의 조건으로 넘기지 않으면 숨은 탭의
   * 목록이 배경에서 왕복한다. **경로 전체를 세어** 판정한다.
   */
  it('발의 탭에 있는 동안 출고 목록을 부르지 않는다', async () => {
    const { requests } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();

    expect(requestsTo(requests, ISSUES_PATH)).toHaveLength(0);
    expect(requestsTo(requests, ISSUE_DETAIL_PATH)).toHaveLength(0);
    expect(requestsTo(requests, APPROVAL_DETAIL_PATH)).toHaveLength(0);
    expectNoUnknownPath(requests);
  });

  it('이력 탭에 있는 동안 입고 목록·상세·잔액을 부르지 않는다', async () => {
    const { requests } = renderScreen(allRoutes(), `${HISTORY_SEARCH}&gr=9001&gi=9501`);

    await waitForIssueLines();

    expect(requestsTo(requests, LIST_PATH)).toHaveLength(0);
    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(0);
    expect(requestsTo(requests, BALANCES_PATH)).toHaveLength(0);
    expectNoUnknownPath(requests);
  });

  /** 「다시 조회」도 그 탭의 것만 부른다 — 버튼 하나로 규칙이 깨지면 안 된다. */
  it('이력 탭의 다시 조회가 입고 목록을 부르지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes(), HISTORY_SEARCH);

    await waitForIssueList();
    await refresh(user);

    await waitFor(() => {
      expect(requestsTo(requests, ISSUES_PATH).length).toBeGreaterThan(1);
    });

    expect(requestsTo(requests, LIST_PATH)).toHaveLength(0);
  });

  /**
   * 감지기 M39 — **탭 전환은 아무것도 비우지 않는다**(수명 표 8행). 탭은 보는 자리를 바꿀 뿐
   * 대상을 바꾸지 않는다 — 두 대상이 각자 살아 있어야 「발의해 놓고 이력에서 이어서 다룬다」가
   * 성립한다.
   */
  it('탭을 오갔다 돌아와도 두 선택과 줄 초안이 그대로다', async () => {
    const { user } = renderScreen(allRoutes(), '?gr=9001&gi=9501');

    await waitForLines();
    await user.click(lineCheckbox(1));
    await user.type(qtyInput(1), '5');

    await openTab(user, t.tabs.history);
    await waitForIssueLines();

    /* 이력 탭에서도 고른 품의가 그대로 열린다. */
    expect(within(historyDetailPane()).getByText('GI-2026-950001')).toBeInTheDocument();

    await openTab(user, t.tabs.disposal);
    await waitForLines();

    expect(lineCheckbox(1)).toBeChecked();
    expect(qtyInput(1)).toHaveValue('5');
    expect(currentLocation()).toBe(`${ROUTE}?gr=9001&gi=9501`);
  });

  it('탭 전환이 이력 조건과 대상 조건을 함께 나른다', async () => {
    const { user } = renderScreen(allRoutes(), '?q=GR&iq=GI');

    await waitForList();
    await openTab(user, t.tabs.history);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?tab=history&q=GR&iq=GI`);
    });
  });
});

describe('DisposalIssueScreen — 이력 조건', () => {
  /** 감지기 M33 — 조건을 컴포넌트 상태로만 들고 있으면 이 단언이 무너진다. */
  it('이력 조건이 주소에 실리고 요청에 계약 이름으로 나간다', async () => {
    const { requests, user } = renderScreen(allRoutes(), HISTORY_SEARCH);

    await waitForIssueList();
    await user.type(screen.getByLabelText(t.historyFields.q), 'GI-2026');
    await search(user);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?tab=history&iq=GI-2026`);
    });

    await waitFor(() => {
      expect(requestsTo(requests, ISSUES_PATH)).toHaveLength(2);
    });

    expect(requestsTo(requests, ISSUES_PATH)[1]?.url.searchParams.get('q')).toBe('GI-2026');
  });

  it('첫 진입에는 조건이 하나도 실리지 않는다', async () => {
    const { requests } = renderScreen(allRoutes(), HISTORY_SEARCH);

    await waitForIssueList();

    const issueRequests = requestsTo(requests, ISSUES_PATH);

    expect(issueRequests).toHaveLength(1);
    expect([...(issueRequests[0]?.url.searchParams.keys() ?? [])]).toEqual([]);
  });

  /**
   * 감지기 M34 — **이력 조건이 바뀌면 고른 품의가 함께 풀린다**(수명 표 9행). 조건이 좁아지면
   * 그 품의가 새 결과에 없을 수 있다.
   */
  it('이력 조건을 바꾸면 고른 품의가 풀린다', async () => {
    const { user } = renderScreen(allRoutes(), `${HISTORY_SEARCH}&gi=9501`);

    await waitForIssueLines();
    await user.type(screen.getByLabelText(t.historyFields.q), 'GI');
    await search(user);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?tab=history&iq=GI`);
    });

    expect(within(historyDetailPane()).getByText(t.empty.historyNoSelectionTitle)).toBeInTheDocument();
  });

  it('초기화도 고른 품의를 푼다', async () => {
    const { user } = renderScreen(allRoutes(), `${HISTORY_SEARCH}&iq=GI&gi=9501`);

    await waitForIssueLines();
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?tab=history`);
    });
  });

  /**
   * **범위 있는 규칙은 잣대도 같은 범위로.** 이력 조건을 바꾸는 것은 대상 탭의 선택과 조건을
   * 건드리는 일이 아니다 — 함께 지우면 이력을 한 번 훑었다고 발의하던 것이 사라진다.
   */
  it('이력 조건 변경이 대상 조건과 고른 전표를 건드리지 않는다', async () => {
    const { user } = renderScreen(allRoutes(), `${HISTORY_SEARCH}&q=GR&gr=9001`);

    await waitForIssueList();
    await user.type(screen.getByLabelText(t.historyFields.q), 'GI');
    await search(user);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?tab=history&q=GR&iq=GI&gr=9001`);
    });
  });

  it('이력 쪽 이동이 그 탭의 쪽만 옮기고 품의 선택을 푼다', async () => {
    const { user } = renderScreen(
      allRoutes([issueListRoute(goodsIssueResponseFixtures, { total: 120 })]),
      `${HISTORY_SEARCH}&page=3&gi=9501`,
    );

    await waitForIssueLines();
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?tab=history&page=3&ipage=2`);
    });
  });
});

describe('DisposalIssueScreen — 대상 조건의 범위', () => {
  /*
   * **수명 표 1~3행의 거울 방향**(리뷰 t3 Major ①).
   *
   * 이력 쪽 범위는 「이력 조건 변경이 대상 조건과 고른 전표를 건드리지 않는다」가 이미 재고
   * 있었으나, **대상 쪽 범위를 재는 잣대가 없었다.** 한쪽만 있으면 「범위 있는 규칙은 잣대도
   * 같은 범위로」가 절반만 지켜지고, `toScreenParams`는 인자 일곱을 받는 한 문이라 **인자 하나를
   * 손으로 더하는 것만으로** 「대상 조건을 바꿨더니 이력 조건까지 사라졌다」가 만들어진다.
   *
   * 세 조작을 **각각** 잰다 — 조건 변경·초기화·쪽 이동이 수명 표에서 서로 다른 행이고,
   * 실제로도 `applyQuery`를 부르는 자리가 셋이라 한 자리만 고쳐지는 일이 생긴다.
   */
  it('대상 조건 변경이 이력 조건과 고른 품의를 건드리지 않는다', async () => {
    const { user } = renderScreen(allRoutes(), '?iq=GI&gr=9001&gi=9501');

    await waitForList();
    await user.type(screen.getByLabelText(t.fields.q), 'GR');
    await search(user);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=GR&iq=GI&gi=9501`);
    });
  });

  it('대상 초기화가 이력 조건과 고른 품의를 건드리지 않는다', async () => {
    const { user } = renderScreen(allRoutes(), '?q=GR&iq=GI&gr=9001&gi=9501');

    await waitForList();
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?iq=GI&gi=9501`);
    });
  });

  it('대상 쪽 이동이 이력 조건과 고른 품의를 건드리지 않는다', async () => {
    const { user } = renderScreen(
      allRoutes([listRoute(goodsReceiptResponseFixtures, { total: 120 })]),
      '?iq=GI&gr=9001&gi=9501',
    );

    await waitForList();
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?page=2&iq=GI&gi=9501`);
    });
  });
});

describe('DisposalIssueScreen — 고른 품의의 상세 조회', () => {
  /** 감지기 M35 — 고르기 전에 부르면 이 단언이 무너진다. **경로 전체를 세어** 판정한다. */
  it('고르기 전에는 부르지 않고 고르면 한 번 부른다', async () => {
    const { requests, user } = renderScreen(allRoutes(), HISTORY_SEARCH);

    await waitForIssueList();

    expect(requestsTo(requests, ISSUE_DETAIL_PATH)).toHaveLength(0);
    expect(requestsTo(requests, APPROVAL_DETAIL_PATH)).toHaveLength(0);

    await selectIssue(user, 'GI-2026-950001');
    await waitForIssueLines();

    expect(requestsTo(requests, ISSUE_DETAIL_PATH)).toHaveLength(1);
    expectNoUnknownPath(requests);
  });

  it('고른 품의의 값과 라인이 그려진다', async () => {
    renderScreen(allRoutes(), `${HISTORY_SEARCH}&gi=9501`);

    await waitForIssueLines();

    const pane = historyDetailPane();

    expect(within(pane).getByText('GI-2026-950001')).toBeInTheDocument();
    expect(within(pane).getByText('2026-08-08 14:20')).toBeInTheDocument();
    expect(within(pane).getByText(WAREHOUSE_LABEL)).toBeInTheDocument();
    expect(within(pane).getByText(ITEM_LABEL)).toBeInTheDocument();
    expect(within(pane).getByText(t.values.posted)).toBeInTheDocument();
    expect(within(pane).getByText(t.values.notPosted)).toBeInTheDocument();
  });

  /** 감지기 M36 — 없는 품의를 가리키는 주소는 정리한다(수명 표 11행). */
  it('출고 상세가 404면 안내가 서고 gi를 주소에서 정리한다', async () => {
    renderScreen(
      allRoutes([failingIssueDetailRoute(404, MISSING_ISSUE_DETAIL_PATH)]),
      `${HISTORY_SEARCH}&gi=9502`,
    );

    expect(await screen.findByText(t.empty.issueNotFoundTitle)).toBeVisible();

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?tab=history`);
    });
  });

  it('404 정리가 대상 탭의 조건과 선택을 건드리지 않는다', async () => {
    renderScreen(
      allRoutes([failingIssueDetailRoute(404, MISSING_ISSUE_DETAIL_PATH)]),
      `${HISTORY_SEARCH}&q=GR&gr=9001&gi=9502`,
    );

    await screen.findByText(t.empty.issueNotFoundTitle);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?tab=history&q=GR&gr=9001`);
    });
  });

  /** 감지기 M41 — 목록만 다시 부르면 갱신된 값과 낡은 값이 한 화면에 섞인다. */
  it('다시 조회가 이력 목록·상세·승인 요청을 함께 부른다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([changingApprovalRoute()]),
      `${HISTORY_SEARCH}&gi=9501`,
    );

    await waitForIssueLines();

    expect(requestsTo(requests, ISSUES_PATH)).toHaveLength(1);
    expect(requestsTo(requests, ISSUE_DETAIL_PATH)).toHaveLength(1);
    expect(requestsTo(requests, APPROVAL_DETAIL_PATH)).toHaveLength(1);

    await refresh(user);

    await waitFor(() => {
      expect(requestsTo(requests, ISSUES_PATH)).toHaveLength(2);
    });
    await waitFor(() => {
      expect(requestsTo(requests, ISSUE_DETAIL_PATH)).toHaveLength(2);
    });
    await waitFor(() => {
      expect(requestsTo(requests, APPROVAL_DETAIL_PATH)).toHaveLength(2);
    });
  });

  it('이력 목록 조회 실패는 배너와 다시 시도를 낸다', async () => {
    const { requests, user } = renderScreen(allRoutes([failingIssueListRoute(500)]), HISTORY_SEARCH);

    expect(await screen.findByText(messages.httpError.loadTitle)).toBeInTheDocument();
    /* 실패를 빈 상태로 오인시키지 않는다 — 짝으로 단언한다. */
    expect(screen.queryByText(t.empty.historyNoResultTitle)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, ISSUES_PATH).length).toBeGreaterThan(1);
    });
  });
});

describe('DisposalIssueScreen — 이력 라인 표의 참조 실패', () => {
  /*
   * **넷 중 어느 하나가 실패해도 사유와 「다시 시도」가 선다**(리뷰 t3 Minor ②).
   *
   * 안내 문구가 품목·단위·자재 LOT·위치 **넷을 함께** 적고 「다시 시도」가 **넷을 함께** 부르므로,
   * 판정도 같은 범위여야 문구와 조치가 어긋나지 않는다. 접기를 하나로 좁히면 나머지 셋이
   * 실패했을 때 **복구 경로가 통째로 사라진다** — 품목만 보고 판정하는 형태가 그 결함이다.
   *
   * **품목이 아닌 축 둘로 잰다.** 품목으로만 재면 「`items.isError` 하나만 본다」는 결함이
   * 그대로 통과한다.
   */
  it('자재 LOT만 실패해도 사유와 다시 시도가 선다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([failingReferenceRoute(LOTS_PATH)]),
      `${HISTORY_SEARCH}&gi=9501`,
    );

    const pane = historyDetailPane();

    expect(await within(pane).findByText(t.reasons.lineReferencesFailed)).toBeVisible();

    await user.click(within(pane).getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, LOTS_PATH).length).toBeGreaterThan(1);
    });
  });

  it('위치만 실패해도 사유가 선다', async () => {
    renderScreen(
      allRoutes([failingReferenceRoute(LOCATIONS_PATH)]),
      `${HISTORY_SEARCH}&gi=9501`,
    );

    expect(
      await within(historyDetailPane()).findByText(t.reasons.lineReferencesFailed),
    ).toBeVisible();
  });

  /** 짝 방향 — 다섯이 다 성공하면 사유도 「다시 시도」도 서지 않는다. */
  it('참조가 다 성공하면 사유가 서지 않는다', async () => {
    renderScreen(allRoutes(), `${HISTORY_SEARCH}&gi=9501`);

    await waitForIssueLines();

    expect(
      within(historyDetailPane()).queryByText(t.reasons.lineReferencesFailed),
    ).not.toBeInTheDocument();
  });
});

describe('DisposalIssueScreen — 결재 진행', () => {
  /**
   * 감지기 M43·M44 — **값이 있을 때만 부르고, 그 값을 그대로 경로에 옮긴다**(계획 결정 10).
   * `enabled`를 없애면 `/app/approval-requests/0`이 나가고, 값을 가공하면 남의 요청을 연다.
   */
  it('승인 요청 값이 있으면 한 번 부르고 경로 조각이 응답 값과 같다', async () => {
    const { requests } = renderScreen(allRoutes(), `${HISTORY_SEARCH}&gi=9501`);

    await waitForIssueLines();

    const approvalRequests = requestsTo(requests, APPROVAL_DETAIL_PATH);

    expect(approvalRequests).toHaveLength(1);
    /* 응답이 실어 준 값과 **문자열로 같다** — 접두어도 변환도 없다. */
    expect(approvalRequests[0]?.url.pathname).toBe(
      `/app/approval-requests/${String(goodsIssueResponseFixtures[0]?.approvalRequestId)}`,
    );
    expectNoUnknownPath(requests);
  });

  /**
   * 감지기 M43의 반대 방향 — 값이 없으면 **부르지 않고** 그 사실을 말한다(A0).
   * `?? 0`으로 메우면 있지도 않은 요청을 여는 요청이 나간다.
   */
  it('미상신 품의에는 승인 조회가 나가지 않고 그 사실을 밝힌다', async () => {
    const { requests } = renderScreen(
      allRoutes([
        issueDetailRoute(goodsIssueLineResponseFixtures, goodsIssueResponseFixtures[1], MISSING_ISSUE_DETAIL_PATH),
      ]),
      `${HISTORY_SEARCH}&gi=9502`,
    );

    expect(await screen.findByText(t.progress.notSubmittedTitle)).toBeVisible();

    expect(
      requests.filter((request) => request.url.pathname.startsWith('/app/approval-requests')),
    ).toHaveLength(0);
    expectNoUnknownPath(requests);
  });

  /**
   * **이슈 §4가 지시한 목록 경로를 쓰지 않는다**(계획 §5.4-3 · 결정 10). 대상 유형 코드의 값
   * 목록이 확정되지 않아 조건을 실을 수 없고, 대상 번호만 실으면 유형이 다른 문서의 요청이 섞인다.
   */
  it('승인 요청 목록 경로로는 부르지 않는다', async () => {
    const { requests } = renderScreen(allRoutes(), `${HISTORY_SEARCH}&gi=9501`);

    await waitForIssueLines();

    expect(requestsTo(requests, APPROVAL_LIST_PATH)).toHaveLength(0);
    /* 짝 방향 — 대신 상세 경로로는 실제로 불렀다. */
    expect(requestsTo(requests, APPROVAL_DETAIL_PATH)).toHaveLength(1);
  });

  it('결재 진행이 세로 단계로 그려지고 서버가 준 단계 번호가 선다', async () => {
    renderScreen(allRoutes(), `${HISTORY_SEARCH}&gi=9501`);

    await waitForIssueLines();

    const progress = await screen.findByRole('group', { name: t.progress.label });

    expect(within(progress).getByText(t.progress.position(4, 4))).toBeInTheDocument();
    expect(within(progress).getByText('합성 승인자 가')).toBeInTheDocument();
    /*
     * **노드에 서버가 준 단계 번호가 선다**(검증 t3 관찰 ①). 픽스처의 단계 번호가 비연속(1·4)이라
     * 배열 인덱스+1로 다시 매기는 결함이 여기서 값으로 갈린다 — 연속이면 가려진다.
     */
    expect(within(progress).getByText('4')).toBeInTheDocument();
    expect(within(progress).getByText('SAMPLE_DECISION_A')).toBeInTheDocument();
    expect(within(progress).getByText(t.progress.waitingCurrent)).toBeInTheDocument();
  });

  /**
   * 감지기 M47 — **위치는 서버가 준 두 수 그대로다.** 배열을 훑어 다시 세면 모순 응답에서
   * 서버와 갈리고, 갈리는 순간 화면이 서버가 말하지 않은 것을 말하게 된다.
   */
  it('서버 값과 배열 재계산이 어긋나는 응답에서도 서버 값을 따른다', async () => {
    renderScreen(
      allRoutes([approvalRoute(contradictoryApprovalDetailFixture)]),
      `${HISTORY_SEARCH}&gi=9501`,
    );

    const progress = await screen.findByRole('group', { name: t.progress.label });

    expect(within(progress).getByText(t.progress.position(3, 3))).toBeInTheDocument();
    /* 짝 방향 — 배열을 세어 만든 값(1 / 1)이 아니다. */
    expect(within(progress).queryByText(t.progress.position(1, 1))).not.toBeInTheDocument();
  });

  it('상신 사유 전문이 줄 단위로 보인다', async () => {
    renderScreen(allRoutes(), `${HISTORY_SEARCH}&gi=9501`);

    const reason = await screen.findByRole('group', { name: t.progress.reasonPane });

    expect(reason.querySelectorAll('p')).toHaveLength(3);
    expect(within(reason).getByText('합성 폐기 사유 첫 줄')).toBeInTheDocument();
    expect(within(reason).getByText('둘째 문단 — 근거를 적는 자리')).toBeInTheDocument();
  });

  /**
   * **이력 탭의 두 구획 어디에도 내부 번호가 없다**(`omf-mes#44`).
   *
   * 이 탭이 특히 위험하다 — 출고 상세 응답이 **승인 요청 식별자를 실어 오고** 화면은 그 값으로
   * 조회를 한다. 조회에 쓰는 값이 그리는 값으로 새는 것은 한 줄이면 되는 일이라, 부품 시험만으로
   * 두지 않고 **실제 응답이 도는 화면 수준에서도** 짝으로 잰다.
   */
  it('이력 목록과 고른 품의 구획에 내부 번호가 없다', async () => {
    renderScreen(allRoutes(), `${HISTORY_SEARCH}&gi=9501`);

    await waitForIssueLines();

    /* 짝 방향 — 업무 번호와 이름은 실제로 보인다(아무것도 안 그려서 통과한 것이 아니다). */
    expect(within(historyListPane()).getByText('GI-2026-950001')).toBeInTheDocument();
    expect(within(historyDetailPane()).getByText(ITEM_LABEL)).toBeInTheDocument();

    for (const pane of [historyListPane(), historyDetailPane()]) {
      for (const id of INTERNAL_IDS) {
        expect(pane.textContent ?? '').not.toContain(id);
      }
    }
  });

  /** 결재 진행에도 내부 번호가 새지 않는다(`omf-mes#44`) — 짝으로 단언한다. */
  it('결재 진행 구획에 내부 번호가 없다', async () => {
    renderScreen(allRoutes(), `${HISTORY_SEARCH}&gi=9501`);

    const progress = await screen.findByRole('group', { name: t.progress.label });

    expect(within(progress).getByText('AP-2026-800001')).toBeInTheDocument();

    for (const id of INTERNAL_IDS) {
      expect(progress.textContent ?? '').not.toContain(id);
    }
  });
});

describe('DisposalIssueScreen — 결재 진행을 못 읽었을 때', () => {
  /**
   * **화면 배너를 세우지 않고 위 두 구획은 그대로 산다**(수명 표 26행 · 완료 조건 C41).
   * 결재 진행은 판단을 돕는 자료이지 이 품의를 다루는 전제가 아니다.
   */
  it('403이어도 품의 정보와 라인이 그대로 서고 화면 배너가 없다', async () => {
    renderScreen(allRoutes([failingApprovalRoute(403)]), `${HISTORY_SEARCH}&gi=9501`);

    await waitForIssueLines();

    const pane = historyDetailPane();

    expect(await within(pane).findByText(t.progress.forbiddenTitle)).toBeVisible();
    expect(within(pane).getByText('GI-2026-950001')).toBeInTheDocument();
    expect(within(pane).getByText(ITEM_LABEL)).toBeInTheDocument();
    expect(screen.queryByText(messages.httpError.loadTitle)).not.toBeInTheDocument();
    /* 403에는 다시 시도를 내지 않는다 — 같은 권한으로 다시 불러도 같은 답이 온다. */
    expect(within(pane).queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it('404·500에는 다시 시도가 있고 누르면 다시 부른다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([failingApprovalRoute(500)]),
      `${HISTORY_SEARCH}&gi=9501`,
    );

    await waitForIssueLines();

    const pane = historyDetailPane();

    expect(await within(pane).findByText(t.progress.loadFailedTitle)).toBeVisible();

    await user.click(within(pane).getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, APPROVAL_DETAIL_PATH).length).toBeGreaterThan(1);
    });
  });

  it('못 읽어도 할 수 있는 일이 달라지지 않는다는 사실을 밝힌다', async () => {
    renderScreen(allRoutes([failingApprovalRoute(404)]), `${HISTORY_SEARCH}&gi=9501`);

    expect(await screen.findByText(t.progress.loadFailedNote)).toBeVisible();
  });
});

describe('DisposalIssueScreen — 승인 뒤에 남은 일', () => {
  /**
   * **계약이 못 박은 사실이라 늘 선다.** 승인은 상태만 바꾸고 재고는 전기가 움직인다 —
   * 승인만 받아 놓고 잊는 일을 막는 자리다(이슈 §6).
   */
  it('승인이 재고를 차감하지 않는다는 사실이 보인다', async () => {
    renderScreen(allRoutes(), `${HISTORY_SEARCH}&gi=9501`);

    expect(await screen.findByText(t.progress.postSeparateNote)).toBeVisible();
  });

  /** 자리표시가 비어 있는 지금은 화면이 승인 완료를 판정하지 못한다 — 그 사실을 밝힌다. */
  it('자리표시가 비어 있으면 판정하지 못한다고 말한다', async () => {
    renderScreen(allRoutes(), `${HISTORY_SEARCH}&gi=9501`);

    expect(await screen.findByText(t.progress.unjudgeableNote)).toBeVisible();
    expect(screen.queryByText(t.progress.approvedNotPostedNote)).not.toBeInTheDocument();
  });

  /**
   * **전환 감지기** — 자리표시를 채우면 승인된 품의에 안내가 서고 판정 불가 안내가 사라진다.
   * 채워졌을 때 살아나는 것을 재지 않으면 그 자리표시는 죽은 가지다.
   */
  it('자리표시를 채우면 승인 뒤 안내가 선다', async () => {
    fillApprovedStatusCodes();

    renderScreen(
      allRoutes([issueDetailRoute(goodsIssueLineResponseFixtures.map((line) => ({ ...line, inventoryTransactionLineId: null })))]),
      `${HISTORY_SEARCH}&gi=9501`,
    );

    expect(await screen.findByText(t.progress.approvedNotPostedNote)).toBeVisible();
    expect(screen.queryByText(t.progress.unjudgeableNote)).not.toBeInTheDocument();
  });

  /**
   * **이미 전기된 전표에 「재고는 아직 차감되지 않았습니다」는 거짓이다.** 승인 자리표시가
   * 채워져 있어도 라인이 원장에 갔으면 그 문장을 내지 않는다.
   */
  it('이미 전기된 전표에는 승인 뒤 안내를 내지 않는다', async () => {
    fillApprovedStatusCodes();

    renderScreen(allRoutes(), `${HISTORY_SEARCH}&gi=9501`);

    await waitForIssueLines();

    expect(await screen.findByText(t.progress.postSeparateNote)).toBeVisible();
    expect(screen.queryByText(t.progress.approvedNotPostedNote)).not.toBeInTheDocument();
  });
});

describe('DisposalIssueScreen — 이력 탭에도 쓰기가 없다', () => {
  /**
   * **기록된 모든 요청의 method가 `GET`이다**(완료 조건 C48). 탭을 오가고 품의를 고르고
   * 다시 조회까지 해도 쓰기가 하나도 나가지 않는다.
   */
  it('탭을 오가고 품의를 골라도 어떤 쓰기 요청도 보내지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();
    await openTab(user, t.tabs.history);
    await waitForIssueList();
    await selectIssue(user, 'GI-2026-950001');
    await waitForIssueLines();
    await refresh(user);

    await waitFor(() => {
      expect(requestsTo(requests, ISSUES_PATH).length).toBeGreaterThan(1);
    });

    expect(requests.map((request) => request.method)).toEqual(requests.map(() => 'GET'));
    expectNoUnknownPath(requests);
  });
});
