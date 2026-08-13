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
  goodsReceiptResponseFixtures,
  INTERNAL_IDS,
  SAMPLE_DEFECT_WAREHOUSE_TYPE,
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
const { codeValues, defectTypeCodes } = vi.hoisted(() => ({
  codeValues: {
    issueType: [] as string[],
    sourceDocumentType: [] as string[],
    destinationType: [] as string[],
    disposalAccount: [] as string[],
    reason: [] as string[],
    receiptType: [] as string[],
    status: [] as string[],
  },
  defectTypeCodes: [] as string[],
}));

vi.mock('./code-options', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./code-options')>();

  return {
    ...actual,
    PLACEHOLDER_DISPOSAL_ISSUE_CODES: codeValues,
    DEFECT_WAREHOUSE_TYPE_CODES: defectTypeCodes,
  };
});

/** 지어낸 합성 코드. **계약의 `@example` 값을 쓰지 않는다** — 예시가 확정 값으로 읽히면 안 된다. */
const SAMPLE_RECEIPT_TYPE = 'SAMPLE_GR_TYPE_A';
const SAMPLE_RECEIPT_STATUS = 'SAMPLE_GR_STATUS_A';

beforeEach(() => {
  codeValues.receiptType = [];
  codeValues.status = [];
  defectTypeCodes.length = 0;
});

const fillCodeLists = (): void => {
  codeValues.receiptType = [SAMPLE_RECEIPT_TYPE];
  codeValues.status = [SAMPLE_RECEIPT_STATUS];
};

const fillDefectWarehouseTypes = (): void => {
  defectTypeCodes.push(SAMPLE_DEFECT_WAREHOUSE_TYPE);
};

const ROUTE = '/logistics/disposal-issue';
const LIST_PATH = '/logistics/goods-receipts';
const WAREHOUSES_PATH = '/mdm/warehouses';

/**
 * 이 회차가 **부르지 않아야 하는** 경로. 뒤 회차에서 쓰이거나 다른 화면이 쓰는 자리다.
 * **부를 수 있게 스텁을 두는 것이 요점이다** — 부르지 않음을 증명하려면 부를 수 있어야 한다.
 */
const DETAIL_PATH = '/logistics/goods-receipts/9001';
const LINES_PATH = '/logistics/goods-receipts/9001/lines';
const ISSUES_PATH = '/logistics/goods-issues';
const BALANCES_PATH = '/inventory/balances';
const APPROVAL_PATH = '/app/approval-requests';
const ITEMS_PATH = '/mdm/items';
const UOMS_PATH = '/mdm/uoms';
const LOTS_PATH = '/trace/lots';
const LOCATIONS_PATH = '/mdm/locations';

const WAREHOUSE_LABEL = 'SAMPLE-WH-01 · 합성 폐기창고 가';
const OTHER_WAREHOUSE_LABEL = 'SAMPLE-WH-02 · 합성 자재창고 나';

/** 상세 응답에만 있는 값. 화면이 그 경로를 쓰지 않음을 **두 방향으로** 굳힌다. */
const DETAIL_ONLY_NO = 'GR-2026-999999';

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

/**
 * 이 회차가 부르지 않아야 하는 경로들. **부를 수 있게 둔다** — 스텁이 없으면 하네스가 던져
 * 「부르지 않았다」와 「불렀는데 실패했다」가 구분되지 않는다.
 */
const laterPhaseRoutes = (): StubRoute[] => [
  {
    match: (request) => isGet(request, DETAIL_PATH),
    respond: () =>
      jsonResponse({
        goodsReceipt: { ...goodsReceiptResponseFixtures[0], goodsReceiptNo: DETAIL_ONLY_NO },
        lines: [],
      }),
  },
  { match: (request) => isGet(request, LINES_PATH), respond: () => jsonResponse(listBody([])) },
  { match: (request) => isGet(request, BALANCES_PATH), respond: () => jsonResponse(listBody([])) },
  { match: (request) => isGet(request, APPROVAL_PATH), respond: () => jsonResponse(listBody([])) },
  { match: (request) => isGet(request, ITEMS_PATH), respond: () => jsonResponse(listBody([])) },
  { match: (request) => isGet(request, UOMS_PATH), respond: () => jsonResponse(listBody([])) },
  { match: (request) => isGet(request, LOTS_PATH), respond: () => jsonResponse(listBody([])) },
  { match: (request) => isGet(request, LOCATIONS_PATH), respond: () => jsonResponse(listBody([])) },
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
const KNOWN_PATHS = [LIST_PATH, WAREHOUSES_PATH];

const expectNoUnknownPath = (requests: RecordedRequest[]): void => {
  expect(
    requests
      .filter((request) => !KNOWN_PATHS.includes(request.url.pathname))
      .map((request) => `${request.method} ${request.url.pathname}`),
  ).toEqual([]);
};

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

    await screen.findByText('GR-2026-900001');

    const list = requestsTo(requests, LIST_PATH);

    expect(list).toHaveLength(1);
    expect(list[0]?.url.searchParams.has('warehouseId')).toBe(false);
    expect(list[0]?.url.searchParams.has('receiptDateFrom')).toBe(false);
    /* 짝 방향 — 조건 자체가 하나도 실리지 않는다. */
    expect([...(list[0]?.url.searchParams.keys() ?? [])]).toEqual([]);
  });

  it('조건을 심지 않고 주소를 그대로 둔다', async () => {
    renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');

    expect(currentLocation()).toBe(ROUTE);
  });

  it('결과가 표에 그려지고 배너가 없다', async () => {
    renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');

    expect(within(listTable()).getAllByRole('row')).toHaveLength(
      goodsReceiptResponseFixtures.length + 1,
    );
    expect(screen.queryByText(messages.httpError.loadTitle)).not.toBeInTheDocument();
  });

  /** 창고는 첫 진입에 받는다 — 조건 줄과 목록 표가 첫 화면부터 이 이름을 쓴다. */
  it('창고 이름을 첫 진입에 1회 받는다', async () => {
    const { requests } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');

    expect(requestsTo(requests, WAREHOUSES_PATH)).toHaveLength(1);
    expect(screen.getAllByText(WAREHOUSE_LABEL).length).toBeGreaterThan(0);
  });

  /**
   * **이 회차가 부르는 경로는 둘뿐이다.** 상세·라인·잔액·승인·참조 넷은 그 값을 실제로 읽는
   * 회차에 온다 — 지금 부르면 쓰지 않는 자료를 받는다. **경로 전체를 세어** 예상 밖으로 나간
   * 요청까지 잡는다.
   */
  it('목록과 창고 말고는 어느 경로도 부르지 않는다', async () => {
    const { requests, queryClient, user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await selectReceipt(user, 'GR-2026-900001');

    await waitFor(() => {
      expect(currentLocation()).toContain('gr=9001');
    });

    expectNoUnknownPath(requests);
    expectNoFailedQuery(queryClient);
    /* 짝 방향 — 상세 응답에만 있는 값이 화면 어디에도 없다. */
    expect(document.body.textContent ?? '').not.toContain(DETAIL_ONLY_NO);
  });

  /**
   * 이 회차는 대상을 보는 데까지다. 되돌릴 수 없는 쓰기는 확인 창·결과 구획과 함께 와야 하므로
   * 여기서는 어떤 쓰기도 나가지 않는다.
   */
  it('어떤 쓰기 요청도 보내지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
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

    await screen.findByText('GR-2026-900001');

    expect(screen.getAllByText(WAREHOUSE_LABEL).length).toBeGreaterThan(0);
    expectNoInternalIds();
  });
});

describe('DisposalIssueScreen — 주소가 조건을 소유한다', () => {
  /** 컴포넌트 상태로만 들고 있으면 새로고침·뒤로가기·공유가 같은 결과를 내지 못한다. */
  it('조회를 누르면 조건이 주소에 실린다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await user.type(screen.getByLabelText(t.fields.q), 'GR-2026');
    await search(user);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=GR-2026`);
    });
  });

  it('기간을 고르면 주소와 요청에 함께 실린다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
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

    await screen.findByText('GR-2026-900001');

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

    await screen.findByText('GR-2026-900001');

    const list = requestsTo(requests, LIST_PATH);

    expect([...(list[0]?.url.searchParams.keys() ?? [])]).toEqual([]);
    /* 짝 방향 — 실존하는 날짜는 실린다(전부 버려서 통과한 것이 아니다). */
    expect(list).toHaveLength(1);
  });

  it('실존하는 날짜는 요청에 실린다', async () => {
    const { requests } = renderScreen(allRoutes(), '?from=2026-02-28');

    await screen.findByText('GR-2026-900001');

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

    await screen.findByText('GR-2026-900001');
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

    await screen.findByText('GR-2026-900001');
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

    await screen.findByText('GR-2026-900001');
    await user.type(screen.getByLabelText(t.fields.q), 'GR');
    await search(user);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=GR`);
    });
  });

  it('초기화가 조건·쪽·고른 전표를 함께 비운다', async () => {
    const { user } = renderScreen(allRoutes(), '?q=GR&page=2&gr=9001');

    await screen.findByText('GR-2026-900001');
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

    await screen.findByText('GR-2026-900001');
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?page=2`);
    });
  });

  /** 고르고 푸는 것은 **보이는 행을 바꾸지 않는다**(4행) — 3쪽에서 하나 골랐다고 1쪽으로 튀면 안 된다. */
  it('전표를 골라도 조건과 쪽은 그대로다', async () => {
    const { user } = renderScreen(
      allRoutes([listRoute(goodsReceiptResponseFixtures, { page: 2, total: 120 })]),
      '?q=GR&page=2',
    );

    await screen.findByText('GR-2026-900001');
    await selectReceipt(user, 'GR-2026-900001');

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=GR&page=2&gr=9001`);
    });
  });

  it('고른 전표를 다시 누르면 풀린다', async () => {
    const { user } = renderScreen(allRoutes(), '?gr=9001');

    await screen.findByText('GR-2026-900001');
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

    await screen.findByText('GR-2026-900001');
    await user.type(screen.getByLabelText(t.fields.q), 'GR-2026');

    await refresh(user);

    await waitFor(() => {
      expect(screen.getByText(t.pageNav.range(1, 3, 5))).toBeInTheDocument();
    });

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('GR-2026');
  });

  /**
   * 「다시 조회」는 **화면이 보고 있는 조회**를 다시 한다 — 이 회차에 그것은 목록 하나다.
   *
   * **참조(창고 이름)는 함께 부르지 않는다.** 기준정보는 이 조작으로 달라지지 않고, 다시
   * 부르면 표의 창고 칸이 잠깐 「불러오는 중」으로 되돌아간다. 못 받았을 때의 복구는 목록
   * 구획의 「다시 시도」가 따로 갖는다 — 그 둘을 한 버튼에 묶으면 문구가 적은 대상과 실제로
   * 다시 부르는 대상이 어긋난다.
   */
  it('다시 조회가 목록만 다시 부르고 참조는 건드리지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes([changingListRoute()]));

    await screen.findByText('GR-2026-900001');

    expect(requestsTo(requests, WAREHOUSES_PATH)).toHaveLength(1);

    await refresh(user);

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH)).toHaveLength(2);
    });

    expect(requestsTo(requests, WAREHOUSES_PATH)).toHaveLength(1);
  });

  /** 「다시 조회」는 조건·쪽·선택을 하나도 바꾸지 않는다(14행). */
  it('다시 조회가 조건과 선택을 그대로 둔다', async () => {
    const { requests, user } = renderScreen(allRoutes([changingListRoute()]), '?q=GR&gr=9001');

    await screen.findByText('GR-2026-900001');
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

    await screen.findByText('GR-2026-900001');

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

    await screen.findByText('GR-2026-900001');

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

    await screen.findByText('GR-2026-900001');

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

    await screen.findByText('GR-2026-900001');

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

    await screen.findByText('GR-2026-900001');

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

    await screen.findByText('GR-2026-900001');

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

    await screen.findByText('GR-2026-900001');

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

    await screen.findByText('GR-2026-900001');

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

    await screen.findByText('GR-2026-900001');

    expect(within(listTable()).getByText(OTHER_WAREHOUSE_LABEL)).toBeInTheDocument();
  });

  /** 좁힘은 **선택지 하나**에서만 일어난다 — 요청에 창고 유형 조건을 실어 좁히지 않는다. */
  it('좁힘을 요청 조건으로 만들지 않는다', async () => {
    fillDefectWarehouseTypes();

    const { requests } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');

    expect(requestsTo(requests, WAREHOUSES_PATH)[0]?.url.searchParams.has('warehouseTypeCode')).toBe(
      false,
    );
    expect(requestsTo(requests, LIST_PATH)[0]?.url.searchParams.has('warehouseId')).toBe(false);
  });
});

describe('DisposalIssueScreen — 조건 칩', () => {
  it('걸린 조건을 이름으로 보이고 ×가 그 조건만 푼다', async () => {
    const { user } = renderScreen(allRoutes(), '?wh=9701&q=GR-2026');

    await screen.findByText('GR-2026-900001');

    expect(screen.getByText(t.filters.chipWarehouse(WAREHOUSE_LABEL))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.filters.chipRemoveWarehouse }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=GR-2026`);
    });
  });

  /** 이름을 못 풀어도 **번호를 대신 내지 않는다**(`omf-mes#44`). */
  it('이름을 못 푼 창고 조건에도 번호를 내지 않는다', async () => {
    renderScreen(allRoutes(), '?wh=9799');

    await screen.findByText('GR-2026-900001');

    expect(screen.getByText(t.filters.chipWarehouse(t.values.unknown))).toBeInTheDocument();
    expectNoInternalIds();
  });
});
