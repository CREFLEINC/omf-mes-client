import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useNavigate, type NavigateFunction } from 'react-router';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { pickDate } from '../../test/date-picker';
import type { ExternalCodeDraft } from './external-code-draft';
import {
  bomComponentFixtures,
  bomFixtures,
  buMapFixtures,
  businessUnitFixtures,
  externalCodeFixtures,
  itemFixtures,
  itemResourceMapFixtures,
  partnerFixtures,
  processFixtures,
  routingFixtures,
  routingOperationFixtures,
  uomConversionFixtures,
  uomFixtures,
} from './fixtures';
import { ItemExtendedAttrsScreen } from './screen';

type ItemResourceMapRow = (typeof itemResourceMapFixtures)[number];

const ROUTE = '/master-data/item-extended-attrs';

const ITEMS_PATH = '/mdm/items';
const UOMS_PATH = '/mdm/uoms';
const BUSINESS_UNITS_PATH = '/mdm/business-units';
const buMapsPath = (itemId = 1001): string => `${ITEMS_PATH}/${String(itemId)}/bu-item-maps`;
const uomConversionsPath = (itemId = 1001): string =>
  `${ITEMS_PATH}/${String(itemId)}/uom-conversions`;
const externalCodesPath = (itemId = 1001): string =>
  `${ITEMS_PATH}/${String(itemId)}/external-codes`;
const PARTNERS_PATH = '/mdm/partners';

interface RecordedRequest {
  method: string;
  url: URL;
  headers: Headers;
  body: string;
}

/** 요청을 기록하면서 스텁 규칙으로 응답한다. 규칙에 없는 요청은 하네스가 던져 스텁 누락을 드러낸다. */
const createRecordingFetch = (
  routes: StubRoute[],
): { fetch: StubFetch; requests: RecordedRequest[] } => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch(routes);

  const fetch: StubFetch = async (request) => {
    requests.push({
      method: request.method,
      url: new URL(request.url),
      headers: new Headers(request.headers),
      body: request.method === 'GET' ? '' : await request.clone().text(),
    });

    return stub(request);
  };

  return { fetch, requests };
};

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

interface PageStub {
  page: number;
  size: number;
  total: number;
}

const DEFAULT_PAGE: PageStub = { page: 1, size: 50, total: itemFixtures.length };

const itemListRoute = (items = itemFixtures, pageMeta: PageStub = DEFAULT_PAGE): StubRoute => ({
  match: (request) => isGet(request, ITEMS_PATH),
  respond: () => jsonResponse({ items, page: pageMeta }),
});

/**
 * 품목 상세 — `ETag`가 함께 온다(계약 실측).
 *
 * `editability`는 목 서버가 실제로 주는 어긋난 조합(`codeEditable:false` + `reason:'EDITABLE'`)을
 * 그대로 둔다. **화면이 이 값을 읽지 않는다**는 것이 결정 1이다.
 */
const itemDetailRoute = (itemId = 1001): StubRoute => ({
  match: (request) => isGet(request, `${ITEMS_PATH}/${String(itemId)}`),
  respond: () =>
    jsonResponse(
      {
        item: itemFixtures.find((row) => row.itemId === itemId),
        editability: { codeEditable: false, reason: 'EDITABLE', referenceCount: 3 },
      },
      { headers: { ETag: 'W/"7"' } },
    ),
});

const uomsRoute = (items = uomFixtures): StubRoute => ({
  match: (request) => isGet(request, UOMS_PATH),
  respond: () => jsonResponse({ items, page: { page: 1, size: 50, total: items.length } }),
});

const errorRoute = (pathname: string, status = 500): StubRoute => ({
  match: (request) => new URL(request.url).pathname === pathname,
  respond: () => jsonResponse({ message: '조회에 실패했습니다' }, { status }),
});

const isPut = (request: Request, pathname: string): boolean =>
  request.method === 'PUT' && new URL(request.url).pathname === pathname;

/** 확장 속성 저장 — 성공. 응답에도 `ETag`가 온다(계약 실측). */
const itemSaveRoute = (itemId = 1001): StubRoute => ({
  match: (request) => isPut(request, `${ITEMS_PATH}/${String(itemId)}`),
  respond: () =>
    jsonResponse(
      itemFixtures.find((row) => row.itemId === itemId),
      {
        headers: { ETag: 'W/"8"' },
      },
    ),
});

/** 확장 속성 저장 — 실패. 상태 코드와 본문을 그대로 받는다. */
const itemSaveFailureRoute = (status: number, body: unknown, itemId = 1001): StubRoute => ({
  match: (request) => isPut(request, `${ITEMS_PATH}/${String(itemId)}`),
  respond: () => jsonResponse(body, { status }),
});

/* ── 부속 정보 ─────────────────────────────────────────────────────────────── */

/** 사업부 매핑 목록 — client#602로 `ETag`가 생겼다. 쪽 나눔은 여전히 없다. */
const buMapsRoute = (
  items = buMapFixtures,
  itemId = 1001,
  { withEtag = true } = {},
): StubRoute => ({
  match: (request) => isGet(request, buMapsPath(itemId)),
  respond: () => jsonResponse({ items }, withEtag ? { headers: { ETag: 'W/"1"' } } : {}),
});

/** 사업부 매핑 치환 — 성공. 서버가 행 번호를 새로 매겨 돌려준다. */
const buMapSaveRoute = (items = buMapFixtures, itemId = 1001): StubRoute => ({
  match: (request) => isPut(request, buMapsPath(itemId)),
  respond: () => jsonResponse({ items }),
});

const buMapSaveFailureRoute = (status: number, body: unknown, itemId = 1001): StubRoute => ({
  match: (request) => isPut(request, buMapsPath(itemId)),
  respond: () => jsonResponse(body, { status }),
});

const businessUnitsRoute = (items = businessUnitFixtures): StubRoute => ({
  match: (request) => isGet(request, BUSINESS_UNITS_PATH),
  respond: () => jsonResponse({ items, page: { page: 1, size: 50, total: items.length } }),
});

/**
 * 행 단위 이름 조회(결정 12)의 응답.
 *
 * 픽스처에 없는 번호(9001)는 **404**로 둔다 — 그 행만 「알 수 없음」이 되는지 본다.
 */
const itemDetailByIdRoute = ({ withEtag = true } = {}): StubRoute => ({
  match: (request) =>
    request.method === 'GET' && /^\/mdm\/items\/\d+$/.test(new URL(request.url).pathname),
  respond: (request) => {
    const itemId = Number(new URL(request.url).pathname.split('/').pop());
    const item = itemFixtures.find((row) => row.itemId === itemId);

    if (item === undefined) return jsonResponse({ message: '없는 품목입니다' }, { status: 404 });

    return jsonResponse(
      { item, editability: { codeEditable: false, reason: 'EDITABLE', referenceCount: 3 } },
      /*
       * 토큰 없는 갈래를 만들 수 있어야 한다. 확장 속성 저장은 이 상세의 토큰에 매이므로
       * (§5.3 1행) 토큰이 없으면 저장이 나가지 않아야 하는데, 토큰이 늘 있는 상황만
       * 검사하면 `etagPath`를 잘못 준 코드가 그대로 통과한다.
       */
      withEtag ? { headers: { ETag: 'W/"7"' } } : {},
    );
  },
});

/** 단위 환산 목록 — client#602로 `ETag`가 생겼다. 쪽 나눔은 여전히 없다. */
const uomConversionsRoute = (
  items = uomConversionFixtures,
  itemId = 1001,
  { withEtag = true } = {},
): StubRoute => ({
  match: (request) => isGet(request, uomConversionsPath(itemId)),
  respond: () => jsonResponse({ items }, withEtag ? { headers: { ETag: 'W/"2"' } } : {}),
});

const uomConversionSaveRoute = (items = uomConversionFixtures, itemId = 1001): StubRoute => ({
  match: (request) => isPut(request, uomConversionsPath(itemId)),
  respond: () => jsonResponse({ items }),
});

/** 외부 코드 목록 — client#602로 `ETag`가 생겼다. 쪽 나눔은 여전히 없다. */
const externalCodesRoute = (
  items = externalCodeFixtures,
  itemId = 1001,
  { withEtag = true } = {},
): StubRoute => ({
  match: (request) => isGet(request, externalCodesPath(itemId)),
  respond: () => jsonResponse({ items }, withEtag ? { headers: { ETag: 'W/"3"' } } : {}),
});

const externalCodeSaveRoute = (items = externalCodeFixtures, itemId = 1001): StubRoute => ({
  match: (request) => isPut(request, externalCodesPath(itemId)),
  respond: () => jsonResponse({ items }),
});

const partnersRoute = (items = partnerFixtures): StubRoute => ({
  match: (request) => isGet(request, PARTNERS_PATH),
  respond: () => jsonResponse({ items, page: { page: 1, size: 50, total: items.length } }),
});

/* ── 자재 명세서 ───────────────────────────────────────────────────────────── */

const BOMS_PATH = '/planning/boms';
const setDefaultPath = (bomId: number): string => `${BOMS_PATH}/${String(bomId)}:set-default`;

/** BOM 헤더 목록 — `ETag`도 쪽 나눔도 없다(계약 실측). `parentItemId`가 필수 쿼리다. */
const bomListRoute = (items = bomFixtures): StubRoute => ({
  match: (request) => isGet(request, BOMS_PATH),
  respond: () => jsonResponse({ items }),
});

/** 기본 지정 — 응답은 **지정한 BOM 하나만** 돌려준다(기존 기본의 해제는 응답에 없다). */
const setDefaultRoute = (bomId = 2001): StubRoute => ({
  match: (request) =>
    request.method === 'POST' && new URL(request.url).pathname === setDefaultPath(bomId),
  respond: () =>
    jsonResponse({ ...bomFixtures.find((row) => row.bomId === bomId), isDefault: true }),
});

const setDefaultFailureRoute = (status: number, body: unknown, bomId = 2001): StubRoute => ({
  match: (request) =>
    request.method === 'POST' && new URL(request.url).pathname === setDefaultPath(bomId),
  respond: () => jsonResponse(body, { status }),
});

const componentsPath = (bomId: number): string => `${BOMS_PATH}/${String(bomId)}/components`;

/** 구성품 목록 — **`ETag`가 없다**(계약 실측 L). 쪽 나눔도 없다. */
const bomComponentsRoute = (items = bomComponentFixtures, bomId = 2001): StubRoute => ({
  match: (request) => isGet(request, componentsPath(bomId)),
  respond: () => jsonResponse({ items }),
});

const ROUTINGS_PATH = '/planning/routings';

/** Routing Rev 목록 — `itemId`가 필수 쿼리다. */
const routingsRoute = (items = routingFixtures): StubRoute => ({
  match: (request) => isGet(request, ROUTINGS_PATH),
  respond: () => jsonResponse({ items }),
});

/**
 * Rev별 공정 라인. **Rev마다 요청이 하나씩 나간다** — 계약에 「품목의 공정 라인을 한꺼번에
 * 받는」 오퍼레이션이 없다.
 */
const routingOperationsRoute = (byRoutingId = routingOperationFixtures): StubRoute => ({
  match: (request) =>
    request.method === 'GET' &&
    /^\/planning\/routings\/\d+\/operations$/.test(new URL(request.url).pathname),
  respond: (request) => {
    const routingId = Number(new URL(request.url).pathname.split('/')[3]);

    return jsonResponse({ items: byRoutingId[routingId] ?? [] });
  },
});

const PROCESSES_PATH = '/mdm/processes';

const processesRoute = (items = processFixtures): StubRoute => ({
  match: (request) => isGet(request, PROCESSES_PATH),
  respond: () => jsonResponse({ items, page: { page: 1, size: 50, total: items.length } }),
});

interface SubsidiaryRouteOverrides {
  itemDetail?: StubRoute;
  buMaps?: StubRoute;
  uomConversions?: StubRoute;
  externalCodes?: StubRoute;
}

/**
 * 부속 정보 탭을 그릴 때 필요한 스텁 한 벌. 하나만 빠져도 하네스가 던진다.
 *
 * **덧붙이기로는 갈아 끼울 수 없다.** `createStubFetch`는 **첫 일치**로 응답하므로
 * `[...subsidiaryRoutes(), buMapsRoute(다른 목록)]`은 앞의 규칙이 이겨 덧붙인 쪽이 죽는다 —
 * 테스트가 의도한 자료를 **한 번도 만들지 못한 채 통과한다.**
 * 갈아 끼울 것은 반드시 이 인자로 넘긴다.
 *
 * 다른 품목(`…(items, 1002)`)이나 쓰기(`…SaveRoute()`)는 경로·메서드가 달라 겹치지 않으므로
 * 그대로 덧붙여도 된다.
 */
const subsidiaryRoutes = (overrides: SubsidiaryRouteOverrides = {}): StubRoute[] => [
  itemListRoute(),
  overrides.itemDetail ?? itemDetailByIdRoute(),
  uomsRoute(),
  businessUnitsRoute(),
  partnersRoute(),
  overrides.buMaps ?? buMapsRoute(),
  overrides.uomConversions ?? uomConversionsRoute(),
  overrides.externalCodes ?? externalCodesRoute(),
];

/** UUID 형식인지. 고정 문자열 멱등 키를 쓰면 서버가 400으로 되돌린다(계약 실측). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 주소를 핸들러를 거치지 않고 바꿔 보기 위한 탐침.
 *
 * 하네스가 `MemoryRouter`라 브라우저 히스토리가 없다 — 라우터가 쌓은 칸을 보려면
 * 트리 안에서 `navigate(-1)`을 부르고 그때의 주소를 읽는 수밖에 없다.
 *
 * `go`는 **공유된 링크·주소 직접 편집** 경로다. 화면의 클릭 핸들러가 만들 수 없는 조합
 * (예: 품목만 바뀌고 `bom`은 그대로)을 만들 수 있어야 「주소가 정본이다」가 실제로 검사된다.
 */
interface HistoryProbe {
  search: () => string;
  back: () => void;
  go: (search: string) => void;
}

let probeNavigate: NavigateFunction | null = null;
let probeSearch = '';

const RouterProbe = () => {
  const location = useLocation();

  probeNavigate = useNavigate();
  probeSearch = location.search;

  return null;
};

const CODE_VALUES_PATH = '/mdm/code-values';

/**
 * 코드 그룹별 값 목록. 그룹은 **이름으로** 가리킨다(`codeGroupCode`) — 채번 식별자는 환경마다 다르다.
 * 상태·MES 구분은 합성 코드(`fixtures.ts`)에 합성 이름을 붙인다 — 실제 코드값을 지어내지 않는다.
 */
const CODE_VALUES: Record<string, { code: string; codeName: string }[]> = {
  ITEM_TYPE: [
    { code: 'RAW_MATERIAL', codeName: '원자재' },
    { code: 'FINISHED', codeName: '완제품' },
    { code: 'SYN-TYPE-A', codeName: '합성 유형 A' },
  ],
  MASTER_VERSION_STATUS: [{ code: 'SYN-BOM-STATUS-A', codeName: '합성 상태 A' }],
  MES_CATEGORY: [{ code: 'SYN-MES-CAT-A', codeName: '합성 구분 A' }],
};

/** 코드값 — 좌 목록이 어느 시험이든 부르므로 규칙 맨 뒤에 늘 둔다. 모르는 그룹은 빈 목록이다 */
const codeValuesRoute = (): StubRoute => ({
  match: (request) => isGet(request, CODE_VALUES_PATH),
  respond: (request) => {
    const items = CODE_VALUES[new URL(request.url).searchParams.get('codeGroupCode') ?? ''] ?? [];

    return jsonResponse({ items, page: { page: 1, size: 100, total: items.length } });
  },
});

const codeValueGets = (requests: RecordedRequest[], codeGroupCode: string): RecordedRequest[] =>
  requests.filter(
    (request) =>
      request.url.pathname === CODE_VALUES_PATH &&
      request.url.searchParams.get('codeGroupCode') === codeGroupCode,
  );

const renderScreen = (routes: StubRoute[], search = '') => {
  const { fetch, requests } = createRecordingFetch([...routes, codeValuesRoute()]);

  probeNavigate = null;
  probeSearch = '';

  const { queryClient } = renderWithProviders(
    <>
      <ItemExtendedAttrsScreen />
      <RouterProbe />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  const history: HistoryProbe = {
    search: () => probeSearch,
    back: () => {
      act(() => {
        probeNavigate?.(-1);
      });
    },
    go: (next: string) => {
      act(() => {
        probeNavigate?.(`${ROUTE}${next}`);
      });
    },
  };

  return { requests, queryClient, history, user: userEvent.setup() };
};

const requestsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === pathname);

const itemListPane = (): HTMLElement => screen.getByRole('region', { name: '품목' });
/** 조회 조건의 품목유형 선택칸. */
const typeSelect = (): HTMLElement => screen.getByRole('combobox', { name: '품목유형' });

/** 원본 사실 칸(한 줄) — 오른쪽 구획 머리. 확장 속성 폼은 그 아래 탭이다. */
const itemOriginPane = (): HTMLElement => screen.getByLabelText('품목 원본 정보');

const selectFirstItem = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: 'SYN-ITEM-01 선택' }));
};

/**
 * 원본 구획의 **내용**이 도착할 때까지 기다린다.
 *
 * 구획 자체는 불러오는 중에도 있다(`role="region"`) — 그 상태에는 입력칸도 버튼도 없어
 * 경계 단언이 헛돈다. 값이 실제로 그려진 뒤에 재야 한다.
 */
const findOriginContent = (): Promise<HTMLElement> => screen.findByLabelText('품목코드');

describe('ItemExtendedAttrsScreen — 좌 목록', () => {
  it('화면에 들어오는 즉시 품목을 조회한다 — 계약에 필수 쿼리가 없다', async () => {
    const { requests } = renderScreen([itemListRoute()]);

    expect(await screen.findByRole('button', { name: 'SYN-ITEM-01 선택' })).toBeInTheDocument();
    expect(requestsTo(requests, ITEMS_PATH)).toHaveLength(1);
  });

  it('주소의 조건을 그대로 서버에 싣는다 — 새로고침에 살아남는다', async () => {
    const { requests } = renderScreen([itemListRoute()], '?q=SYN&inactive=1&page=2');

    await waitFor(() => {
      expect(requestsTo(requests, ITEMS_PATH)).toHaveLength(1);
    });

    const query = requestsTo(requests, ITEMS_PATH)[0]!.url.searchParams;
    expect(query.get('q')).toBe('SYN');
    expect(query.get('includeInactive')).toBe('true');
    expect(query.get('page')).toBe('2');
  });

  it('조회 실패에 배너와 다시 시도가 난다', async () => {
    const { requests, user } = renderScreen([errorRoute(ITEMS_PATH)]);

    expect(await screen.findByText('목록을 불러오지 못했습니다')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    await waitFor(() => {
      expect(requestsTo(requests, ITEMS_PATH).length).toBeGreaterThan(1);
    });
  });
});

/**
 * M11 — 품목을 고르기 전에는 우 칸 조회가 0회다.
 *
 * `enabled` 없이 조회하면 경로에 `0`을 실은 상세 요청이 나간다.
 */
describe('ItemExtendedAttrsScreen — 품목 미선택 (M11)', () => {
  it('우 칸 조회 요청이 0회다', async () => {
    const { requests } = renderScreen([itemListRoute()]);

    await screen.findByRole('button', { name: 'SYN-ITEM-01 선택' });

    expect(requestsTo(requests, `${ITEMS_PATH}/1001`)).toHaveLength(0);
    expect(requestsTo(requests, `${ITEMS_PATH}/0`)).toHaveLength(0);
    expect(requestsTo(requests, UOMS_PATH)).toHaveLength(0);
  });

  it('우 칸이 「먼저 고르세요」를 낸다', async () => {
    renderScreen([itemListRoute()]);

    expect(
      await screen.findByText('좌측에서 품목을 고르면 여기에 그 품목의 정보가 보입니다'),
    ).toBeInTheDocument();
  });

  /* 식별자는 1부터 매겨진다 — 어떤 자원도 가리키지 않는 값으로 조회하지 않는다. */
  it('주소의 품목 번호가 이상하면 상세를 조회하지 않는다', async () => {
    const { requests } = renderScreen([itemListRoute()], '?item=abc');

    await screen.findByRole('button', { name: 'SYN-ITEM-01 선택' });

    expect(requests.filter((request) => request.url.pathname.startsWith(`${ITEMS_PATH}/`))).toEqual(
      [],
    );
  });
});

describe('ItemExtendedAttrsScreen — 품목 선택과 원본 구획', () => {
  it('품목을 고르면 주소에 남고 상세를 조회한다', async () => {
    const { requests, history, user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      uomsRoute(),
    ]);

    await selectFirstItem(user);

    await waitFor(() => {
      expect(requestsTo(requests, `${ITEMS_PATH}/1001`)).toHaveLength(1);
    });
    expect(history.search()).toBe('?item=1001');
  });

  it('원본 4열을 값으로 낸다 — 기준 단위는 이름이다', async () => {
    const { user } = renderScreen([itemListRoute(), itemDetailRoute(), uomsRoute()]);

    await selectFirstItem(user);

    const pane = await screen.findByLabelText('품목 원본 정보');
    expect(within(pane).getByLabelText('품목코드')).toHaveTextContent('SYN-ITEM-01');
    /* 단위는 코드만 — 「ERP 연동 현황·이력」의 품목 탭과 같은 표기. */
    await waitFor(() => {
      expect(within(pane).getByLabelText('기준 단위')).toHaveTextContent('SYN-UOM-01');
    });
  });

  /* 한 조작은 주소 갱신을 한 번만 낸다 — 뒤로가기가 사용자가 본 적 없는 중간 상태로 떨어지지 않는다. */
  it('품목을 고른 뒤 뒤로가기 한 번이면 고르기 전 주소로 돌아온다', async () => {
    const { history, user } = renderScreen([itemListRoute(), itemDetailRoute(), uomsRoute()]);

    await selectFirstItem(user);
    await waitFor(() => {
      expect(history.search()).toBe('?item=1001');
    });

    history.back();

    expect(history.search()).toBe('');
  });

  it('상세 조회 실패에 배너와 다시 시도가 난다', async () => {
    const { requests, user } = renderScreen([
      itemListRoute(),
      errorRoute(`${ITEMS_PATH}/1001`),
      uomsRoute(),
    ]);

    await selectFirstItem(user);

    expect(await screen.findByText('목록을 불러오지 못했습니다')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    await waitFor(() => {
      expect(requestsTo(requests, `${ITEMS_PATH}/1001`).length).toBeGreaterThan(1);
    });
  });

  /* 알리지 않으면 이름이 이유 없이 비어 보이고 사용자는 값이 사라진 줄 안다. */
  it('단위 목록이 잘리면 그 사실을 알린다', async () => {
    const { user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      {
        match: (request) => isGet(request, UOMS_PATH),
        respond: () =>
          jsonResponse({ items: uomFixtures, page: { page: 1, size: 50, total: 999 } }),
      },
    ]);

    await selectFirstItem(user);

    expect(
      await screen.findByText(
        '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
      ),
    ).toBeInTheDocument();
  });

  it('단위 목록 조회가 실패하면 그 사실을 알린다', async () => {
    const { user } = renderScreen([itemListRoute(), itemDetailRoute(), errorRoute(UOMS_PATH)]);

    await selectFirstItem(user);

    expect(
      await screen.findByText('선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.'),
    ).toBeInTheDocument();
  });
});

/**
 * M01 — 원본 구획에 쓰기 수단이 없다(화면 수준).
 *
 * 이슈 #14 §6의 첫 번째 함정. 서버가 원본 열의 편집을 막지 않으므로 **화면이 경계를 지킨다.**
 */
describe('ItemExtendedAttrsScreen — 원본 구획에 쓰기 수단이 없다 (M01)', () => {
  it('원본 구획에 폼 컨트롤이 0개다', async () => {
    const { user } = renderScreen([itemListRoute(), itemDetailRoute(), uomsRoute()]);

    await selectFirstItem(user);
    await findOriginContent();

    const pane = itemOriginPane();
    expect(within(pane).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(pane).queryAllByRole('combobox')).toHaveLength(0);
    expect(within(pane).queryAllByRole('checkbox')).toHaveLength(0);
    expect(within(pane).queryAllByRole('switch')).toHaveLength(0);
    expect(within(pane).queryAllByRole('spinbutton')).toHaveLength(0);
  });

  it('원본 구획에 저장 버튼이 없다', async () => {
    const { user } = renderScreen([itemListRoute(), itemDetailRoute(), uomsRoute()]);

    await selectFirstItem(user);
    await findOriginContent();

    expect(within(itemOriginPane()).queryAllByRole('button')).toHaveLength(0);
  });
});

/**
 * M12 — 품목 신규 생성 경로가 없다.
 *
 * 계약에 `POST /mdm/items`가 없다. 좌 목록에 「추가」를 두거나 그 요청을 부르면 잡힌다.
 */
describe('ItemExtendedAttrsScreen — 신규 생성 경로가 없다 (M12)', () => {
  it('화면 어디에서도 품목을 만드는 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen([itemListRoute(), itemDetailRoute(), uomsRoute()]);

    await selectFirstItem(user);
    await findOriginContent();

    expect(requests.filter((request) => request.method !== 'GET')).toEqual([]);
  });

  it('좌 목록에 추가 액션이 없다', async () => {
    renderScreen([itemListRoute()]);

    await screen.findByRole('button', { name: 'SYN-ITEM-01 선택' });

    const labels = within(itemListPane())
      .getAllByRole('button')
      .map((button) => button.textContent ?? '');

    expect(labels.some((label) => label.includes('추가'))).toBe(false);
  });
});

/**
 * M07 — 좌 목록 조건 변경이 선택과 쪽을 비운다.
 *
 * 보이는 행이 달라지는데 선택이 남으면 우 칸의 내용이 어디서 온 것인지 알 수 없다.
 */
describe('ItemExtendedAttrsScreen — 선택 수명 (M07)', () => {
  it('조건을 바꾸면 고른 품목과 쪽이 비워진다', async () => {
    const { history, user } = renderScreen(
      [itemListRoute(), itemDetailRoute(), uomsRoute()],
      '?item=1001&page=3',
    );

    await findOriginContent();

    await user.type(screen.getByRole('textbox', { name: '품목코드·품목명' }), 'SYN');
    await user.click(screen.getByRole('button', { name: '조회' }));

    await waitFor(() => {
      expect(history.search()).toBe('?q=SYN');
    });
  });

  it('미사용 포함을 켜도 고른 품목이 비워진다', async () => {
    const { history, user } = renderScreen(
      [itemListRoute(), itemDetailRoute(), uomsRoute()],
      '?item=1001',
    );

    await findOriginContent();

    await user.click(screen.getByRole('checkbox', { name: '미사용 포함' }));

    await waitFor(() => {
      expect(history.search()).toBe('?inactive=1');
    });
  });

  it('쪽을 옮기면 고른 품목이 비워진다', async () => {
    const { history, user } = renderScreen(
      [itemListRoute(itemFixtures, { page: 1, size: 2, total: 6 }), itemDetailRoute(), uomsRoute()],
      '?item=1001',
    );

    await findOriginContent();

    await user.click(screen.getByRole('button', { name: '다음' }));

    await waitFor(() => {
      expect(history.search()).toBe('?page=2');
    });
  });

  it('조건을 바꾼 뒤에는 우 칸이 다시 「먼저 고르세요」로 돌아온다', async () => {
    const { user } = renderScreen([itemListRoute(), itemDetailRoute(), uomsRoute()], '?item=1001');

    await findOriginContent();

    await user.click(screen.getByRole('checkbox', { name: '미사용 포함' }));

    expect(
      await screen.findByText('좌측에서 품목을 고르면 여기에 그 품목의 정보가 보입니다'),
    ).toBeInTheDocument();
  });
});

/* ── 탭 ─────────────────────────────────────────────────────────────────── */

describe('ItemExtendedAttrsScreen — 탭', () => {
  /* **만든 탭만 넣는다.** 아직 없는 탭을 목록에 두면 「눌러도 빈 화면」이 생긴다. */
  it('만든 탭만 렌더한다', async () => {
    renderScreen([itemListRoute(), itemDetailRoute(), uomsRoute()], '?item=1001');

    await findOriginContent();

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      '확장 속성',
      '부속 정보',
    ]);
  });

  /* 「먼저 고르세요」를 두 번 쌓으면 무엇을 하라는 안내인지 오히려 흐려진다. 품목 / BOM 은 셸 탭 막대가 가른다. */
  it('품목을 고르기 전에는 탭을 렌더하지 않는다', async () => {
    renderScreen([itemListRoute()]);

    await screen.findByRole('button', { name: 'SYN-ITEM-01 선택' });

    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  /* 주소를 손으로 고쳐도 빈 화면이 되지 않아야 한다. */
  it('주소의 탭 값이 이상하면 첫 탭으로 떨어진다', async () => {
    renderScreen([itemListRoute(), itemDetailRoute(), uomsRoute()], '?item=1001&tab=bogus');

    expect(await screen.findByRole('tab', { name: '확장 속성' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  /* 원본 구획이 **탭 밖 맨 위**에 있어야 어느 탭에서도 저장 버튼이 없다는 사실이 보인다(결정 2). */
  it('원본 구획이 탭 밖에 있다', async () => {
    renderScreen([itemListRoute(), itemDetailRoute(), uomsRoute()], '?item=1001');

    await findOriginContent();

    const tabPanel = screen.getByRole('tabpanel', { name: '확장 속성' });
    expect(within(tabPanel).queryByLabelText('품목코드')).not.toBeInTheDocument();
    expect(within(tabPanel).getByRole('region', { name: '확장 속성' })).toBeInTheDocument();
  });
});

/* ── 확장 속성 저장 ─────────────────────────────────────────────────────── */

const findAttrsPane = async (): Promise<HTMLElement> =>
  screen.findByRole('region', { name: '확장 속성' });

/**
 * 폼을 한 군데 고쳐 저장을 연다. 어느 필드를 고쳐도 결과는 같다 — 품목유형과 상관없이 늘 있는 IQC 대상을 바꾼다
 * (LOT 기본크기는 품목유형에 따라 칸이 없다).
 */
const editAndSave = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('switch', { name: 'IQC 대상' }));
  await user.click(screen.getByRole('button', { name: '저장' }));
};

const savedBodies = (requests: RecordedRequest[], itemId = 1001): unknown[] =>
  requests
    .filter(
      (request) =>
        request.method === 'PUT' && request.url.pathname === `${ITEMS_PATH}/${String(itemId)}`,
    )
    .map((request) => JSON.parse(request.body) as unknown);

/** 상세를 몇 번 받았는가. 재조회가 실제로 나갔는지 세는 유일한 근거다. */
const detailGetCount = (requests: RecordedRequest[], itemId = 1001): number =>
  requests.filter(
    (request) =>
      request.method === 'GET' && request.url.pathname === `${ITEMS_PATH}/${String(itemId)}`,
  ).length;

const FORBIDDEN_TEXT = '이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.';
const ERP_SYNC_TEXT =
  '외부 시스템에서 이 항목이 다시 동기화됐습니다. 최신 내용을 불러온 뒤 다시 저장하세요.';
const SHELF_LIFE_REQUIRED_TEXT = '유효기한 관리를 켜면 유효기한(일)을 입력해야 합니다.';

/**
 * M02 — 확장 저장 본문에 원본 4열이 없다.
 * M03 — 본문의 `isActive`가 조회값이다.
 *
 * 서버가 원본 열의 편집을 막지 않는다(계약 실측) — 경계를 지키는 곳이 화면뿐이다.
 */
describe('ItemExtendedAttrsScreen — 저장 본문 (M02·M03)', () => {
  it('계약의 확장 키만 실린다', async () => {
    const { requests, user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      uomsRoute(),
      itemSaveRoute(),
    ]);

    await selectFirstItem(user);
    await findAttrsPane();
    await editAndSave(user);

    await waitFor(() => {
      expect(savedBodies(requests)).toHaveLength(1);
    });

    expect(Object.keys(savedBodies(requests)[0] as object).sort()).toEqual(
      [
        'defaultLotStorageUomId',
        'defaultProductionLotSize',
        'developmentItem',
        'fifoPolicyCode',
        'inspectionRequired',
        'isActive',
        'lotControlled',
        'negativeStockAllowed',
        'nameKo',
        'nameVi',
        'openedShelfLifeHours',
        'serialControlTypeCode',
        'shelfLifeDays',
        'storageConditionCode',
      ].sort(),
    );
  });

  it('원본 4열과 번호를 담지 않는다', async () => {
    const { requests, user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      uomsRoute(),
      itemSaveRoute(),
    ]);

    await selectFirstItem(user);
    await findAttrsPane();
    await editAndSave(user);

    await waitFor(() => {
      expect(savedBodies(requests)).toHaveLength(1);
    });

    const body = savedBodies(requests)[0] as Record<string, unknown>;
    for (const key of ['itemCode', 'itemName', 'itemTypeCode', 'baseUomId', 'itemId']) {
      expect(body).not.toHaveProperty(key);
    }
  });

  /* `true`로 굳히면 미사용 품목이 저장하는 순간 조용히 되살아난다. */
  it('미사용 품목을 저장해도 미사용 그대로 실린다', async () => {
    const { requests, user } = renderScreen(
      [itemListRoute(), itemDetailRoute(1003), uomsRoute(), itemSaveRoute(1003)],
      '?item=1003',
    );

    await findAttrsPane();
    await editAndSave(user);

    await waitFor(() => {
      expect(savedBodies(requests, 1003)).toHaveLength(1);
    });

    expect(savedBodies(requests, 1003)[0]).toHaveProperty('isActive', false);
  });

  it('사용 중인 품목은 사용 중으로 실린다', async () => {
    const { requests, user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      uomsRoute(),
      itemSaveRoute(),
    ]);

    await selectFirstItem(user);
    await findAttrsPane();
    await editAndSave(user);

    await waitFor(() => {
      expect(savedBodies(requests)).toHaveLength(1);
    });

    expect(savedBodies(requests)[0]).toHaveProperty('isActive', true);
  });
});

/**
 * M04 — 유효기한 토글 OFF면 `shelfLifeDays`가 널이다.
 * M05 — 토글 ON에 값이 비면 요청이 나가지 않는다.
 */
describe('ItemExtendedAttrsScreen — 유효기한 (M04·M05)', () => {
  it('토글을 끄고 저장하면 널이 실린다', async () => {
    const { requests, user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      uomsRoute(),
      itemSaveRoute(),
    ]);

    await selectFirstItem(user);
    await findAttrsPane();

    await user.click(screen.getByRole('switch', { name: '유효기한 관리' }));
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(savedBodies(requests)).toHaveLength(1);
    });

    expect(savedBodies(requests)[0]).toHaveProperty('shelfLifeDays', null);
  });

  it('토글이 켜져 있는데 값을 비우면 요청이 나가지 않고 인라인 오류가 난다', async () => {
    const { requests, user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      uomsRoute(),
      itemSaveRoute(),
    ]);

    await selectFirstItem(user);
    await findAttrsPane();

    await user.clear(screen.getByLabelText('유효기한(일)'));
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(
      await screen.findByText('유효기한 관리를 켜면 유효기한(일)을 입력해야 합니다.'),
    ).toBeInTheDocument();
    expect(savedBodies(requests)).toHaveLength(0);
  });
});

/**
 * M14 — 확장 저장에 `If-Match`가 실린다.
 *
 * `etagPath`를 `null`로 주면 토큰 없이 보내고 서버가 400으로 되돌린다(계약 실측 B).
 */
describe('ItemExtendedAttrsScreen — 저장 헤더 (M14)', () => {
  it('상세 조회가 준 토큰을 If-Match로 되돌려 보낸다', async () => {
    const { requests, user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      uomsRoute(),
      itemSaveRoute(),
    ]);

    await selectFirstItem(user);
    await findAttrsPane();
    await editAndSave(user);

    await waitFor(() => {
      expect(savedBodies(requests)).toHaveLength(1);
    });

    const put = requests.find((request) => request.method === 'PUT')!;
    expect(put.headers.get('If-Match')).toBe('W/"7"');
  });

  /* 고정 문자열 멱등 키를 쓰면 서버가 400으로 되돌린다. */
  /**
   * **형식만 보지 않는다.** 고정 문자열도 UUID 형식일 수 있어서, 형식 단언만으로는
   * 「요청마다 새로 만든다」가 지켜지는지 알 수 없다 — 두 번 저장해 값이 서로 다름을 본다.
   * 같은 키가 두 번 가면 서버가 두 번째 저장을 첫 번째의 재시도로 보고 삼킨다.
   */
  it('멱등 키를 요청마다 새로 만든다', async () => {
    const { requests, user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      uomsRoute(),
      itemSaveRoute(),
    ]);

    await selectFirstItem(user);
    await findAttrsPane();
    await editAndSave(user);

    await waitFor(() => {
      expect(savedBodies(requests)).toHaveLength(1);
    });

    // 저장 성공으로 폼이 기준값으로 돌아간다 — 다시 고쳐야 두 번째 저장이 열린다.
    await editAndSave(user);

    await waitFor(() => {
      expect(savedBodies(requests)).toHaveLength(2);
    });

    const keys = requests
      .filter((request) => request.method === 'PUT')
      .map((request) => request.headers.get('Idempotency-Key'));

    expect(keys).toHaveLength(2);
    for (const key of keys) {
      expect(key).toMatch(UUID);
    }
    expect(keys[0]).not.toBe(keys[1]);
  });
});

/**
 * 계획 §5.4 선택 수명 표 3행 — 「품목 선택 **변경**」.
 *
 * 두 방향을 함께 고정한다. 하나만 두면 반대쪽으로 넘어지기 쉬운 자리다 —
 * 「비우지 않는다」만 두면 남의 실패 배너가 남고, 「비운다」만 두면 재클릭이 입력을 지운다.
 */
describe('ItemExtendedAttrsScreen — 품목 선택 변경 (§5.4 3행)', () => {
  it('다른 품목으로 옮기면 저장 실패 배너와 인라인 오류가 사라진다', async () => {
    const { user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      itemDetailRoute(1002),
      uomsRoute(),
      itemSaveFailureRoute(403, { code: 'FORBIDDEN', message: '권한 없음' }),
    ]);

    await selectFirstItem(user);
    await findAttrsPane();

    // 먼저 서버 실패 배너를 세운다.
    await editAndSave(user);
    await screen.findByText(
      '이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.',
    );

    /*
     * 이어서 로컬 검증 오류를 세운다. 요청이 나가지 않으므로 배너가 그대로 남는다.
     *
     * **이 칸을 품목을 옮길 때까지 다시 건드리지 않는다.** 값을 고치면 그 자리에서 오류가
     * 지워져(`changeAttrsValues`) 「품목 변경이 인라인 오류를 지운다」가 검사되지 않는다 —
     * 오류가 이미 없는 상태를 「사라졌다」로 읽는 헛도는 단언이 된다.
     */
    await user.clear(screen.getByLabelText('유효기한(일)'));
    await user.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('유효기한 관리를 켜면 유효기한(일)을 입력해야 합니다.');

    await user.click(screen.getByRole('button', { name: 'SYN-ITEM-02 선택' }));

    await waitFor(() => {
      expect(
        screen.queryByText(
          '이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.',
        ),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.queryByText('유효기한 관리를 켜면 유효기한(일)을 입력해야 합니다.'),
    ).not.toBeInTheDocument();
  });

  /*
   * 재클릭은 「보이는 행이 달라지는」 조작이 아니다 — 비울 근거가 없다.
   * 비우면 저장하지 않은 입력이 조용히 사라진다(계획 §8 위험 7과 같은 부류).
   */
  it('같은 품목을 다시 눌러도 저장하지 않은 입력이 남는다', async () => {
    const { user } = renderScreen([itemListRoute(), itemDetailRoute(), uomsRoute()], '?item=1001');

    await findAttrsPane();

    await user.type(screen.getByLabelText('생산 LOT 기본크기'), '9');
    expect(screen.getByLabelText('생산 LOT 기본크기')).toHaveValue(5009);

    await user.click(screen.getByRole('button', { name: 'SYN-ITEM-01 선택' }));

    // 값이 서버 값으로 되돌아가면 여기서 잡힌다.
    expect(screen.getByLabelText('생산 LOT 기본크기')).toHaveValue(5009);
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled();
  });

  it('같은 품목을 다시 눌러도 주소가 달라지지 않는다', async () => {
    const { history, user } = renderScreen(
      [itemListRoute(), itemDetailRoute(), uomsRoute()],
      '?item=1001',
    );

    await findAttrsPane();

    await user.click(screen.getByRole('button', { name: 'SYN-ITEM-01 선택' }));

    expect(history.search()).toBe('?item=1001');
  });

  /*
   * **초기화는 클릭이 아니라 고른 품목에 묶여 있다.**
   *
   * 클릭 핸들러에만 두면 뒤로가기·주소 직접 편집으로 품목이 바뀔 때 그 핸들러를 거치지 않아
   * 앞 품목의 실패 배너가 그대로 따라온다 — 사용자는 **지금 품목이** 저장에 실패한 줄 안다.
   */
  it('뒤로가기로 품목이 바뀌면 앞 품목의 저장 실패 배너가 따라오지 않는다', async () => {
    const { history, user } = renderScreen(
      [
        itemListRoute(),
        itemDetailRoute(),
        itemDetailRoute(1002),
        uomsRoute(),
        itemSaveFailureRoute(403, { code: 'FORBIDDEN', message: '권한 없음' }),
        itemSaveFailureRoute(403, { code: 'FORBIDDEN', message: '권한 없음' }, 1002),
      ],
      '?item=1001',
    );

    await findAttrsPane();
    await editAndSave(user);
    await screen.findByText(FORBIDDEN_TEXT);

    // 두 번째 품목에서도 실패시켜, 뒤로 돌아갈 때 배너가 **실제로 떠 있게** 만든다.
    await user.click(screen.getByRole('button', { name: 'SYN-ITEM-02 선택' }));
    await findAttrsPane();
    await editAndSave(user);
    await screen.findByText(FORBIDDEN_TEXT);

    history.back();

    await waitFor(() => {
      expect(history.search()).toBe('?item=1001');
    });
    await waitFor(() => {
      expect(screen.queryByText(FORBIDDEN_TEXT)).not.toBeInTheDocument();
    });
  });

  /*
   * 반대 방향 — **고른 품목이 그대로면 비우지 않는다.**
   * 초기화를 「렌더할 때마다」로 넓히면 입력 도중에 값이 사라지므로 짝으로 고정한다.
   * 검색어 칸은 조회를 걸기 전까지 주소를 바꾸지 않는다 — 화면만 다시 그려지는 조작이다.
   */
  it('고른 품목이 그대로면 화면을 다시 그려도 저장하지 않은 입력이 남는다', async () => {
    const { history, user } = renderScreen(
      [itemListRoute(), itemDetailRoute(), uomsRoute()],
      '?item=1001',
    );

    await findAttrsPane();

    await user.type(screen.getByLabelText('생산 LOT 기본크기'), '9');
    await user.type(screen.getByRole('textbox', { name: '품목코드·품목명' }), 'SYN');

    expect(history.search()).toBe('?item=1001');
    expect(screen.getByLabelText('생산 LOT 기본크기')).toHaveValue(5009);
  });
});

/**
 * M26 — 충돌 문구가 공통 규약 문구다.
 *
 * 이슈 #14 §4의 「배치 충돌 전용 문구를 두지 않는다」는 **이 화면이 자기 문구를 만들지 않는다**는 뜻이다.
 * 원인 구분은 공통 배너가 이미 갖고 있으므로 그것을 그대로 소비하는 것이 유일한 답이다.
 */
describe('ItemExtendedAttrsScreen — 저장 실패 (M26)', () => {
  const saveAndExpect = async (status: number, body: unknown, expected: string) => {
    const { user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      uomsRoute(),
      itemSaveFailureRoute(status, body),
    ]);

    await selectFirstItem(user);
    await findAttrsPane();
    await editAndSave(user);

    expect(await screen.findByText(expected)).toBeInTheDocument();
  };

  it('외부 재수신 충돌을 공통 문구로 낸다', async () => {
    await saveAndExpect(
      409,
      { conflictCause: 'erpSync', message: '충돌' },
      '외부 시스템에서 이 항목이 다시 동기화됐습니다. 최신 내용을 불러온 뒤 다시 저장하세요.',
    );
  });

  it('다른 사용자와의 충돌을 공통 문구로 낸다', async () => {
    await saveAndExpect(
      409,
      { conflictCause: 'user', message: '충돌' },
      '다른 사용자가 먼저 저장했습니다. 최신 내용을 불러온 뒤 다시 저장하세요.',
    );
  });

  it('권한 없음을 공통 문구로 낸다', async () => {
    await saveAndExpect(
      403,
      { code: 'FORBIDDEN', message: '권한 없음' },
      '이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.',
    );
  });

  it('서버 검증 오류를 그 칸 옆에 낸다', async () => {
    const { user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      uomsRoute(),
      itemSaveFailureRoute(400, {
        code: 'VALIDATION_ERROR',
        message: '검증 실패',
        errors: [
          { scope: 'field', field: 'shelfLifeDays', code: 'REQUIRED', message: '서버 검증 문구' },
        ],
      }),
    ]);

    await selectFirstItem(user);
    await findAttrsPane();
    await editAndSave(user);

    expect(await screen.findByText('서버 검증 문구')).toBeInTheDocument();
  });

  /* 재조회로 풀리는 것은 충돌뿐이다 — 다른 오류에 「최신 불러오기」를 내면 입력만 버리게 된다. */
  it('충돌에만 최신 불러오기를 낸다', async () => {
    const { user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      uomsRoute(),
      itemSaveFailureRoute(403, { code: 'FORBIDDEN', message: '권한 없음' }),
    ]);

    await selectFirstItem(user);
    await findAttrsPane();
    await editAndSave(user);

    await screen.findByText(
      '이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.',
    );
    expect(screen.queryByRole('button', { name: '최신 불러오기' })).not.toBeInTheDocument();
  });
});

/**
 * M30 — 저장 성공 후 상세가 무효화된다.
 * 무효화를 빠뜨리면 보관된 토큰이 낡아 그다음 저장이 조용히 막힌다.
 */
describe('ItemExtendedAttrsScreen — 저장 성공 (M30)', () => {
  it('성공하면 목록과 상세를 다시 조회한다', async () => {
    const { requests, user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      uomsRoute(),
      itemSaveRoute(),
    ]);

    await selectFirstItem(user);
    await findAttrsPane();

    const detailsBefore = requestsTo(requests, `${ITEMS_PATH}/1001`).filter(
      (request) => request.method === 'GET',
    ).length;

    await editAndSave(user);

    await waitFor(() => {
      const detailsAfter = requestsTo(requests, `${ITEMS_PATH}/1001`).filter(
        (request) => request.method === 'GET',
      ).length;
      expect(detailsAfter).toBeGreaterThan(detailsBefore);
    });
  });

  it('성공하면 저장이 다시 닫힌다 — 고친 것이 없어진다', async () => {
    const { user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      uomsRoute(),
      itemSaveRoute(),
    ]);

    await selectFirstItem(user);
    await findAttrsPane();
    await editAndSave(user);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    });
  });
});

/**
 * 「취소」 — 기준값으로 되돌리는 조작이다.
 *
 * 세 가지를 한꺼번에 한다(값 복원 · 인라인 오류 소거 · 저장 실패 배너 소거).
 * 셋을 따로 단언해야 하나가 빠졌을 때 어느 것이 빠졌는지 드러난다 —
 * 핸들러를 통째로 비워도 통과하는 상태를 남기지 않는다.
 */
describe('ItemExtendedAttrsScreen — 취소', () => {
  it('고친 값이 기준값으로 돌아온다', async () => {
    const { user } = renderScreen([itemListRoute(), itemDetailRoute(), uomsRoute()], '?item=1001');

    await findAttrsPane();

    await user.type(screen.getByLabelText('생산 LOT 기본크기'), '9');
    expect(screen.getByLabelText('생산 LOT 기본크기')).toHaveValue(5009);

    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(screen.getByLabelText('생산 LOT 기본크기')).toHaveValue(500);
  });

  /* 되돌린 뒤에는 고친 것이 없다 — 저장·취소가 다시 닫혀야 상태와 액션이 어긋나지 않는다. */
  it('취소한 뒤에는 저장과 취소가 다시 닫힌다', async () => {
    const { user } = renderScreen([itemListRoute(), itemDetailRoute(), uomsRoute()], '?item=1001');

    await findAttrsPane();

    await user.type(screen.getByLabelText('생산 LOT 기본크기'), '9');
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
  });

  it('인라인 오류와 저장 실패 배너가 함께 사라진다', async () => {
    const { user } = renderScreen(
      [
        itemListRoute(),
        itemDetailRoute(),
        uomsRoute(),
        itemSaveFailureRoute(403, { code: 'FORBIDDEN', message: '권한 없음' }),
      ],
      '?item=1001',
    );

    await findAttrsPane();

    // 서버 실패 배너를 먼저 세운다.
    await editAndSave(user);
    await screen.findByText(FORBIDDEN_TEXT);

    // 이어서 로컬 검증 오류를 세운다 — 요청이 나가지 않으므로 배너가 그대로 남는다.
    await user.clear(screen.getByLabelText('유효기한(일)'));
    await user.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText(SHELF_LIFE_REQUIRED_TEXT);

    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(screen.queryByText(SHELF_LIFE_REQUIRED_TEXT)).not.toBeInTheDocument();
    expect(screen.queryByText(FORBIDDEN_TEXT)).not.toBeInTheDocument();
  });
});

/**
 * 「최신 불러오기」 — 저장 충돌을 푸는 **유일한** 경로다.
 *
 * 계약이 덮어쓰기 강제를 제공하지 않으므로 최신 값을 받아 다시 입력하는 수밖에 없다.
 * **상세를 실제로 다시 받는지**가 이 액션의 전부다 — 배너만 사라지고 재조회가 없으면
 * 보관된 잠금 토큰이 낡은 채로 남아 다음 저장이 같은 충돌로 또 막힌다.
 */
describe('ItemExtendedAttrsScreen — 최신 불러오기', () => {
  it('상세를 한 번 더 받는다', async () => {
    const { requests, user } = renderScreen(
      [
        itemListRoute(),
        itemDetailRoute(),
        uomsRoute(),
        itemSaveFailureRoute(409, { conflictCause: 'erpSync', message: '충돌' }),
      ],
      '?item=1001',
    );

    await findAttrsPane();

    await editAndSave(user);
    await screen.findByText(ERP_SYNC_TEXT);

    const before = detailGetCount(requests);

    await user.click(screen.getByRole('button', { name: '최신 불러오기' }));

    await waitFor(() => {
      expect(detailGetCount(requests)).toBe(before + 1);
    });
  });

  it('배너가 사라진다', async () => {
    const { user } = renderScreen(
      [
        itemListRoute(),
        itemDetailRoute(),
        uomsRoute(),
        itemSaveFailureRoute(409, { conflictCause: 'erpSync', message: '충돌' }),
      ],
      '?item=1001',
    );

    await findAttrsPane();

    await editAndSave(user);
    await screen.findByText(ERP_SYNC_TEXT);

    await user.click(screen.getByRole('button', { name: '최신 불러오기' }));

    await waitFor(() => {
      expect(screen.queryByText(ERP_SYNC_TEXT)).not.toBeInTheDocument();
    });
  });
});

/* ── 부속 정보 탭 ──────────────────────────────────────────────────────────── */

/**
 * 사업부 매핑 구획의 **표까지** 그려지길 기다린다.
 *
 * 구획 자체는 불러오는 중에도 있다 — 그 상태에는 표가 없어 행을 세는 단언이 헛돈다.
 */
const findBuMapPane = async (): Promise<HTMLElement> => {
  const pane = await screen.findByRole('region', { name: '사업부 매핑' });

  await waitFor(() => {
    expect(
      within(pane).queryByRole('status', { name: '사업부 매핑을 불러오는 중' }),
    ).not.toBeInTheDocument();
  });

  return pane;
};

/** 머리 줄을 뺀 자료 줄 수. 좌 목록 표가 함께 잡히지 않도록 구획 안에서만 센다. */
const buMapRowCount = (pane: HTMLElement): number => within(pane).getAllByRole('row').length - 1;

const buMapBodies = (requests: RecordedRequest[], itemId = 1001): unknown[] =>
  requests
    .filter((request) => request.method === 'PUT' && request.url.pathname === buMapsPath(itemId))
    .map((request) => JSON.parse(request.body) as unknown);

const buMapPuts = (requests: RecordedRequest[], itemId = 1001): RecordedRequest[] =>
  requests.filter(
    (request) => request.method === 'PUT' && request.url.pathname === buMapsPath(itemId),
  );

/** 열려 있는 편집 창. 구획에도 같은 이름의 버튼이 있어 창 안으로 좁혀 찾는다. */
const buMapDialog = (): HTMLElement => screen.getByRole('dialog');

/** 사업부 매핑 한 줄을 창에서 만든다. 확인까지 누르면 **표에만** 반영된다. */
const addBuMapRow = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: '매핑 추가' }));

  const dialog = buMapDialog();

  await user.click(within(dialog).getByLabelText('보내는 사업부'));
  await user.click(screen.getByRole('option', { name: 'SYN-BU-01 · 합성 사업부 A' }));

  await user.click(within(dialog).getByLabelText('받는 사업부'));
  await user.click(screen.getByRole('option', { name: 'SYN-BU-02 · 합성 사업부 B' }));

  await user.type(within(dialog).getByLabelText('대상 품목 검색'), 'SYN');
  await user.click(within(dialog).getByRole('button', { name: '찾기' }));
  await user.click(await within(dialog).findByLabelText('대상 품목'));
  await user.click(screen.getByRole('option', { name: 'SYN-ITEM-01 · 합성 품목 A' }));

  await pickDate(user, within(dialog).getByLabelText('유효 시작'), '2026-05-01');

  await user.click(within(dialog).getByRole('button', { name: '확인' }));
};

/**
 * 부속 자원의 조회는 **부속 정보 탭에 들어왔을 때** 켠다.
 *
 * 품목을 고르기만 하고 확장 속성만 보는 동안 세 목록을 받아 둘 이유가 없다.
 * 하위 탭마다 켜지 않는 이유는 §5.4의 「세 초안은 함께 산다」와 같다 —
 * 하위 탭을 옮길 때마다 새로 받으면 편집 중이던 초안이 서버 응답으로 되감긴다.
 */
describe('ItemExtendedAttrsScreen — 부속 조회 시점', () => {
  it('확장 속성 탭에서는 부속을 조회하지 않는다', async () => {
    const { requests } = renderScreen(subsidiaryRoutes(), '?item=1001');

    await findOriginContent();

    expect(requestsTo(requests, buMapsPath())).toHaveLength(0);
    expect(requestsTo(requests, BUSINESS_UNITS_PATH)).toHaveLength(0);
  });

  /* 계약이 경로에 `itemId`를 요구한다 — `enabled` 없이 부르면 `0`을 실은 요청이 나간다. */
  it('품목을 고르기 전에는 부속 탭 주소여도 조회하지 않는다', async () => {
    const { requests } = renderScreen(subsidiaryRoutes(), '?tab=sub');

    await screen.findByRole('button', { name: 'SYN-ITEM-01 선택' });

    expect(requestsTo(requests, buMapsPath())).toHaveLength(0);
    expect(requestsTo(requests, buMapsPath(0))).toHaveLength(0);
  });

  it('부속 정보 탭에 들어가면 사업부 매핑을 조회한다', async () => {
    const { requests } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    await findBuMapPane();

    await waitFor(() => {
      expect(requestsTo(requests, buMapsPath())).toHaveLength(1);
    });
  });

  /* 하위 탭을 옮길 때마다 새로 받으면 초안이 서버 응답으로 되감긴다. */
  it('하위 탭을 옮겨도 사업부 매핑을 다시 받지 않는다', async () => {
    const { requests, user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    await findBuMapPane();
    await waitFor(() => {
      expect(requestsTo(requests, buMapsPath())).toHaveLength(1);
    });

    await user.click(screen.getByRole('tab', { name: '단위 환산' }));
    await user.click(screen.getByRole('tab', { name: '사업부 매핑' }));

    expect(requestsTo(requests, buMapsPath())).toHaveLength(1);
  });
});

describe('ItemExtendedAttrsScreen — 부속 하위 탭', () => {
  it('하위 탭 셋을 낸다', async () => {
    renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    await findBuMapPane();

    const subTabs = screen.getAllByRole('tab').map((tab) => tab.textContent);
    expect(subTabs).toContain('사업부 매핑');
    expect(subTabs).toContain('단위 환산');
    expect(subTabs).toContain('외부 코드');
  });

  /* 「빈 조건·기본값은 키 자체를 두지 않는다」를 하위 탭에도 적용한다. */
  it('기본 하위 탭은 주소에 쓰지 않고, 다른 하위 탭은 주소에 남는다', async () => {
    const { history, user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    await findBuMapPane();
    expect(history.search()).toBe('?item=1001&tab=sub');

    await user.click(screen.getByRole('tab', { name: '외부 코드' }));

    await waitFor(() => {
      expect(history.search()).toBe('?item=1001&tab=sub&sub=ext');
    });
  });

  /* 주소를 손으로 고쳐도 빈 화면이 되지 않아야 한다. */
  it('주소의 하위 탭 값이 이상하면 첫 하위 탭으로 떨어진다', async () => {
    renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub&sub=bogus');

    expect(await screen.findByRole('tab', { name: '사업부 매핑' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  /* 조건을 고칠 때마다 첫 하위 탭으로 튕기면 어디를 보고 있었는지 잃는다. */
  it('조건을 바꿔도 하위 탭이 남는다', async () => {
    const { history, user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub&sub=ext');

    await findOriginContent();

    await user.click(screen.getByRole('checkbox', { name: '미사용 포함' }));

    await waitFor(() => {
      expect(history.search()).toBe('?tab=sub&sub=ext&inactive=1');
    });
  });
});

/**
 * M09 — 탭 변경이 **아무것도 비우지 않는다.**
 *
 * 앞선 화면(W-06-06)은 탭마다 좌 목록이 통째로 달라 전부 비웠다. 여기는 반대다 —
 * 세 탭이 전부 「지금 고른 품목」의 다른 면이라 비울 근거가 없다.
 * W-06-06의 규칙을 그대로 옮기는 뮤테이션이 여기서 잡힌다.
 */
describe('ItemExtendedAttrsScreen — 탭 변경이 아무것도 비우지 않는다 (M09)', () => {
  it('탭을 옮겨도 고른 품목과 조건이 그대로다', async () => {
    const { history, user } = renderScreen(subsidiaryRoutes(), '?q=SYN&item=1001');

    await findOriginContent();

    await user.click(screen.getByRole('tab', { name: '부속 정보' }));

    await waitFor(() => {
      expect(history.search()).toBe('?q=SYN&item=1001&tab=sub');
    });
    expect(await screen.findByLabelText('품목코드')).toHaveTextContent('SYN-ITEM-01');
  });

  it('탭을 옮겨도 확장 폼의 저장하지 않은 입력이 남는다', async () => {
    const { user } = renderScreen(subsidiaryRoutes(), '?item=1001');

    await findAttrsPane();

    await user.type(screen.getByLabelText('생산 LOT 기본크기'), '9');

    await user.click(screen.getByRole('tab', { name: '부속 정보' }));
    await findBuMapPane();
    await user.click(screen.getByRole('tab', { name: '확장 속성' }));

    expect(await screen.findByLabelText('생산 LOT 기본크기')).toHaveValue(5009);
  });

  /* 탭을 옮겼다고 저장 실패 배너까지 지우면 사용자가 실패 사실을 못 본 채 넘어간다. */
  it('탭을 옮겨도 저장 실패 배너가 남는다', async () => {
    const { user } = renderScreen(
      [
        ...subsidiaryRoutes(),
        itemSaveFailureRoute(403, { code: 'FORBIDDEN', message: '권한 없음' }),
      ],
      '?item=1001',
    );

    await findAttrsPane();
    await editAndSave(user);
    await screen.findByText(FORBIDDEN_TEXT);

    await user.click(screen.getByRole('tab', { name: '부속 정보' }));
    await findBuMapPane();
    await user.click(screen.getByRole('tab', { name: '확장 속성' }));

    expect(await screen.findByText(FORBIDDEN_TEXT)).toBeInTheDocument();
  });
});

/**
 * M10 · C12 — 탭을 떠났다 돌아와도 **저장하지 않은 초안이 남는다.**
 *
 * 초안을 탭 안 페인이 소유하면 탭을 옮기는 순간 언마운트되어 조용히 사라진다.
 * 그래서 초안은 화면이 소유한다(§5.4).
 */
describe('ItemExtendedAttrsScreen — 초안 수명 (M10·C12)', () => {
  it('탭을 떠났다 돌아와도 만든 줄이 남는다', async () => {
    const { user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    const pane = await findBuMapPane();
    await addBuMapRow(user);

    expect(buMapRowCount(pane)).toBe(3); // 서버 2 + 새로 만든 1

    await user.click(screen.getByRole('tab', { name: '확장 속성' }));
    await findAttrsPane();
    await user.click(screen.getByRole('tab', { name: '부속 정보' }));

    expect(buMapRowCount(await findBuMapPane())).toBe(3);
  });

  it('하위 탭을 떠났다 돌아와도 만든 줄이 남는다', async () => {
    const { user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    await findBuMapPane();
    await addBuMapRow(user);

    await user.click(screen.getByRole('tab', { name: '외부 코드' }));
    await user.click(screen.getByRole('tab', { name: '사업부 매핑' }));

    expect(buMapRowCount(await findBuMapPane())).toBe(3);
  });

  /*
   * M08 — 반대 방향. 품목이 달라지면 초안은 남을 자리가 없다.
   * 남기면 **다른 품목의 부속 행**을 지금 품목에 저장하게 된다.
   */
  it('품목을 바꾸면 초안이 비워진다 (M08)', async () => {
    const { user } = renderScreen(
      [...subsidiaryRoutes(), buMapsRoute([], 1002)],
      '?item=1001&tab=sub',
    );

    const pane = await findBuMapPane();
    await addBuMapRow(user);
    expect(buMapRowCount(pane)).toBe(3);

    await user.click(screen.getByRole('button', { name: 'SYN-ITEM-02 선택' }));

    await waitFor(() => {
      expect(screen.getByText('등록된 사업부 매핑이 없습니다')).toBeInTheDocument();
    });
  });

  /*
   * **열려 있던 편집 창도 함께 닫힌다.**
   *
   * 초안·폼은 조회 응답에서 다시 세워지므로 스스로 낫지만 **열린 창은 낫지 않는다** —
   * 남겨 두면 앞 품목의 줄을 지금 품목의 표에 확인해 넣게 된다.
   * 창이 떠 있는 동안 좌 목록은 덮여 있으므로 주소로만 품목이 바뀔 수 있다.
   */
  it('품목이 바뀌면 열려 있던 편집 창이 닫힌다 (M08)', async () => {
    const { history, user } = renderScreen(
      [...subsidiaryRoutes(), buMapsRoute([], 1002), uomConversionsRoute([], 1002)],
      '?item=1002&tab=sub',
    );

    await findBuMapPane();
    await user.click(screen.getByRole('button', { name: 'SYN-ITEM-01 선택' }));

    await findBuMapPane();
    await user.click(screen.getByRole('button', { name: '매핑 추가' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    history.back();

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.queryByLabelText('보내는 사업부')).not.toBeInTheDocument();
  });

  /* 뒤로가기도 같은 규칙이다 — 초기화가 클릭 핸들러에만 있으면 이 경로가 새어 나간다. */
  it('뒤로가기로 품목이 바뀌어도 초안이 따라오지 않는다 (M08)', async () => {
    const { history, user } = renderScreen(
      [...subsidiaryRoutes(), buMapsRoute([], 1002)],
      '?item=1002&tab=sub',
    );

    await findBuMapPane();
    await screen.findByText('등록된 사업부 매핑이 없습니다');

    await user.click(screen.getByRole('button', { name: 'SYN-ITEM-01 선택' }));
    const pane = await findBuMapPane();
    await addBuMapRow(user);
    expect(buMapRowCount(pane)).toBe(3);

    history.back();

    await waitFor(() => {
      expect(history.search()).toBe('?item=1002&tab=sub');
    });
    await waitFor(() => {
      expect(screen.getByText('등록된 사업부 매핑이 없습니다')).toBeInTheDocument();
    });
  });
});

/**
 * C08·C09·C10 · M15·M16·M17·M18 — 전체 치환의 본문·횟수·헤더.
 *
 * 서버가 남는 키를 막지 않으므로(계약 실측) 경계를 지키는 곳이 화면뿐이다.
 */
describe('ItemExtendedAttrsScreen — 사업부 매핑 치환 (M15~M18)', () => {
  it('치환 본문에 서버 식별자와 itemId가 없다 (M15·M16)', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), buMapSaveRoute()],
      '?item=1001&tab=sub',
    );

    const pane = await findBuMapPane();
    await addBuMapRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(buMapBodies(requests)).toHaveLength(1);
    });

    const body = buMapBodies(requests)[0] as { maps: Record<string, unknown>[] };
    expect(body.maps).toHaveLength(3);

    for (const map of body.maps) {
      expect(Object.keys(map).sort()).toEqual([
        'effectiveFrom',
        'effectiveTo',
        'fromBusinessUnitId',
        'toBusinessUnitId',
        'toItemId',
      ]);
    }
  });

  /* 계약: 「fromItemId 는 경로의 itemId 로 고정한다」 — 경로가 정본이다. */
  it('경로에 품목 번호가 실리고 본문에는 실리지 않는다 (M16)', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), buMapSaveRoute()],
      '?item=1001&tab=sub',
    );

    const pane = await findBuMapPane();
    await addBuMapRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(buMapPuts(requests)).toHaveLength(1);
    });

    expect(buMapPuts(requests)[0]?.url.pathname).toBe('/mdm/items/1001/bu-item-maps');
    expect(buMapPuts(requests)[0]?.body).not.toContain('fromItemId');
    expect(buMapPuts(requests)[0]?.body).not.toContain('itemId');
  });

  /*
   * client#602 — **이 목록 조회의 `ETag`가 `If-Match`로 실린다.** 예전에는 계약에 이 쓰기의
   * 그 파라미터 자체가 없고 목록 조회도 `ETag`를 주지 않아 보내지 않았다.
   */
  it('치환 저장이 1회이고 목록 조회의 ETag를 If-Match로 되돌려 보낸다', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), buMapSaveRoute()],
      '?item=1001&tab=sub',
    );

    const pane = await findBuMapPane();
    await addBuMapRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(buMapPuts(requests)).toHaveLength(1);
    });

    const put = buMapPuts(requests)[0]!;
    expect(put.headers.get('If-Match')).toBe('W/"1"');
    expect(put.headers.get('Idempotency-Key')).toMatch(UUID);
  });

  /*
   * M18 — 행을 전부 지우면 **빈 배열**을 보낸다.
   * 요청을 생략하면 「지우려 했는데 그대로 남는」 상태가 된다.
   */
  it('행을 전부 지우면 빈 배열을 보낸다 (M18)', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), buMapSaveRoute([])],
      '?item=1001&tab=sub',
    );

    const pane = await findBuMapPane();

    for (const button of within(pane).getAllByRole('button', { name: /매핑 삭제$/ })) {
      await user.click(button);
    }
    // 빈 표에는 빈 상태 줄이 들어가므로 줄 수가 아니라 빈 상태 문구로 잰다.
    expect(within(pane).getByText('등록된 사업부 매핑이 없습니다')).toBeInTheDocument();

    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(buMapBodies(requests)).toHaveLength(1);
    });

    expect(buMapBodies(requests)[0]).toEqual({ maps: [] });
  });

  it('성공하면 목록을 다시 조회한다', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), buMapSaveRoute()],
      '?item=1001&tab=sub',
    );

    await findBuMapPane();
    await waitFor(() => {
      expect(requestsTo(requests, buMapsPath())).toHaveLength(1);
    });

    await addBuMapRow(user);
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(requestsTo(requests, buMapsPath()).filter((r) => r.method === 'GET')).toHaveLength(2);
    });
  });

  /*
   * **한 자원을 저장해도 나머지 둘은 다시 받지 않는다.**
   * 함께 무효화하면 편집 중이던 다른 초안이 서버 응답으로 되감긴다 — `subsidiaryKeys`가
   * 자원마다 키를 나눈 이유가 이것이다.
   */
  it('사업부 매핑 저장이 단위 환산·외부 코드를 다시 받게 하지 않는다', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), buMapSaveRoute()],
      '?item=1001&tab=sub',
    );

    const pane = await findBuMapPane();
    await waitFor(() => {
      expect(requestsTo(requests, uomConversionsPath())).toHaveLength(1);
    });
    expect(requestsTo(requests, externalCodesPath())).toHaveLength(1);

    await addBuMapRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(buMapPuts(requests)).toHaveLength(1);
    });
    expect(requestsTo(requests, uomConversionsPath())).toHaveLength(1);
    expect(requestsTo(requests, externalCodesPath())).toHaveLength(1);
  });

  /*
   * 창의 확인은 **저장이 아니다.** 확인만으로 요청이 나가면 전체 치환이라는 규약이 깨지고,
   * 사용자가 표를 확인하기 전에 서버가 바뀐다.
   */
  it('창의 확인만으로는 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), buMapSaveRoute()],
      '?item=1001&tab=sub',
    );

    await findBuMapPane();
    await addBuMapRow(user);

    expect(buMapPuts(requests)).toHaveLength(0);
  });

  /* 되돌리기는 서버가 준 목록으로 되돌리는 것이다 — 화면 수준에서 실제로 되돌아가는지 본다. */
  it('취소하면 만든 줄이 사라지고 저장이 다시 닫힌다', async () => {
    const { user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    const pane = await findBuMapPane();
    await addBuMapRow(user);
    expect(buMapRowCount(pane)).toBe(3);

    await user.click(within(pane).getByRole('button', { name: '취소' }));

    expect(buMapRowCount(pane)).toBe(2);
    expect(within(pane).getByRole('button', { name: '저장' })).toBeDisabled();
  });

  /* 저장 실패는 이 화면 전용 문구를 만들지 않는다 — 공통 배너를 그대로 소비한다(M26). */
  it('403이 공통 배너 문구로 난다 (M26)', async () => {
    const { user } = renderScreen(
      [
        ...subsidiaryRoutes(),
        buMapSaveFailureRoute(403, { code: 'FORBIDDEN', message: '권한 없음' }),
      ],
      '?item=1001&tab=sub',
    );

    const pane = await findBuMapPane();
    await addBuMapRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    expect(await screen.findByText(FORBIDDEN_TEXT)).toBeInTheDocument();
  });

  /*
   * 이 쓰기에는 낙관적 잠금이 없다 — 충돌이라는 갈래 자체가 없으므로
   * 「최신 불러오기」를 내면 사용자에게 없는 원인을 짚어 주게 된다.
   */
  it('부속 저장 실패에는 최신 불러오기를 내지 않는다', async () => {
    const { user } = renderScreen(
      [
        ...subsidiaryRoutes(),
        buMapSaveFailureRoute(403, { code: 'FORBIDDEN', message: '권한 없음' }),
      ],
      '?item=1001&tab=sub',
    );

    const pane = await findBuMapPane();
    await addBuMapRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await screen.findByText(FORBIDDEN_TEXT);
    expect(screen.queryByRole('button', { name: '최신 불러오기' })).not.toBeInTheDocument();
  });
});

/**
 * 편집 창은 **열 때만 마운트한다.**
 * 디자인 시스템 `Dialog`는 닫혀도 내용이 DOM에 남아, 항상 렌더하면 지난 값이 살아 있다.
 */
describe('ItemExtendedAttrsScreen — 사업부 매핑 편집 창', () => {
  it('열기 전에는 창의 입력칸이 DOM에 없다', async () => {
    renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    await findBuMapPane();

    expect(screen.queryByLabelText('보내는 사업부')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('닫으면 창의 입력칸이 DOM에서 사라진다', async () => {
    const { user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    await findBuMapPane();
    await user.click(screen.getByRole('button', { name: '매핑 추가' }));
    expect(screen.getByLabelText('보내는 사업부')).toBeInTheDocument();

    await user.click(within(buMapDialog()).getByRole('button', { name: '취소' }));

    expect(screen.queryByLabelText('보내는 사업부')).not.toBeInTheDocument();
  });

  /* 창이 서버 값을 그대로 들고 열려야 사용자가 무엇을 고치는지 안다. */
  it('수정을 누르면 그 줄의 값이 창에 들어온다', async () => {
    const { user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    const pane = await findBuMapPane();
    await user.click(within(pane).getAllByRole('button', { name: /매핑 수정$/ })[0]!);

    expect(within(buMapDialog()).getByLabelText('유효 시작')).toHaveTextContent('2026-01-01');
  });

  /* 로컬 검증에서 막힌 줄은 표에 들어가지 않는다 — 저장 시점에야 거부되면 안 된다. */
  it('같은 사업부를 고르면 표에 들어가지 않는다', async () => {
    const { user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    await findBuMapPane();
    await user.click(screen.getByRole('button', { name: '매핑 추가' }));

    const dialog = buMapDialog();
    await user.click(within(dialog).getByLabelText('보내는 사업부'));
    await user.click(screen.getByRole('option', { name: 'SYN-BU-01 · 합성 사업부 A' }));
    await user.click(within(dialog).getByLabelText('받는 사업부'));
    await user.click(screen.getByRole('option', { name: 'SYN-BU-01 · 합성 사업부 A' }));
    await pickDate(user, within(dialog).getByLabelText('유효 시작'), '2026-05-01');

    await user.click(within(dialog).getByRole('button', { name: '확인' }));

    expect(
      screen.getByText('보내는 사업부와 받는 사업부는 서로 달라야 합니다.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

/** 결정 12 — 번호를 화면에 내지 않는다. 행마다 상세를 부르되 캐시 키를 공유한다. */
describe('ItemExtendedAttrsScreen — 대상 품목 이름 (결정 12)', () => {
  it('대상 품목을 번호가 아니라 이름으로 낸다', async () => {
    renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    await findBuMapPane();

    expect(await screen.findByText('SYN-ITEM-02 · 합성 품목 B')).toBeInTheDocument();
    expect(screen.queryByText('1002')).not.toBeInTheDocument();
  });

  /* 한 행이 실패했다고 나머지 행까지 이름을 잃으면 안 된다. */
  it('이름을 얻지 못한 행만 「알 수 없음」이다', async () => {
    renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    await findBuMapPane();

    expect(await screen.findByText('알 수 없음')).toBeInTheDocument();
    expect(screen.getByText('SYN-ITEM-02 · 합성 품목 B')).toBeInTheDocument();
    expect(screen.queryByText('9001')).not.toBeInTheDocument();
  });

  /*
   * 고른 품목의 상세와 **같은 캐시 키**를 쓴다 — 같은 번호를 두 번 받지 않는다.
   * 여기서 1002는 표의 행이 가리키는 품목이고, 좌 목록에도 있다.
   */
  it('같은 품목을 여러 번 받지 않는다', async () => {
    const { requests } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    await findBuMapPane();
    await screen.findByText('SYN-ITEM-02 · 합성 품목 B');

    expect(requestsTo(requests, `${ITEMS_PATH}/1002`)).toHaveLength(1);
  });
});

/* ── 부속 정보 · 단위 환산 ─────────────────────────────────────────────────── */

const findUomConversionPane = async (): Promise<HTMLElement> => {
  const pane = await screen.findByRole('region', { name: '단위 환산' });

  await waitFor(() => {
    expect(
      within(pane).queryByRole('status', { name: '단위 환산을 불러오는 중' }),
    ).not.toBeInTheDocument();
  });

  return pane;
};

const uomConversionBodies = (requests: RecordedRequest[], itemId = 1001): unknown[] =>
  requests
    .filter(
      (request) => request.method === 'PUT' && request.url.pathname === uomConversionsPath(itemId),
    )
    .map((request) => JSON.parse(request.body) as unknown);

const uomConversionPuts = (requests: RecordedRequest[], itemId = 1001): RecordedRequest[] =>
  requests.filter(
    (request) => request.method === 'PUT' && request.url.pathname === uomConversionsPath(itemId),
  );

/** 단위 환산 하위 탭으로 옮긴다. */
const openUomConversionTab = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('tab', { name: '단위 환산' }));

  return findUomConversionPane();
};

/** 단위 환산 한 줄을 창에서 만든다. 확인까지 누르면 표에만 반영된다. */
const addUomConversionRow = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: '환산 추가' }));

  const dialog = screen.getByRole('dialog');

  await user.click(within(dialog).getByLabelText('변환 전 단위'));
  await user.click(screen.getByRole('option', { name: 'SYN-UOM-01 · 합성 단위 A' }));

  await user.click(within(dialog).getByLabelText('변환 후 단위'));
  await user.click(screen.getByRole('option', { name: 'SYN-UOM-03 · 합성 단위 C' }));

  await user.type(within(dialog).getByLabelText('환산 비율'), '1.5');
  await pickDate(user, within(dialog).getByLabelText('유효 시작'), '2026-05-01');

  await user.click(within(dialog).getByRole('button', { name: '확인' }));
};

describe('ItemExtendedAttrsScreen — 단위 환산 조회 시점', () => {
  it('확장 속성 탭에서는 단위 환산을 조회하지 않는다', async () => {
    const { requests } = renderScreen(subsidiaryRoutes(), '?item=1001');

    await findOriginContent();

    expect(requestsTo(requests, uomConversionsPath())).toHaveLength(0);
  });

  /* 세 초안이 함께 살아야 하므로 부속 탭에 들어올 때 셋을 함께 받는다(§5.4). */
  it('부속 정보 탭에 들어가면 사업부 매핑과 함께 조회한다', async () => {
    const { requests } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    await findBuMapPane();

    await waitFor(() => {
      expect(requestsTo(requests, uomConversionsPath())).toHaveLength(1);
    });
  });
});

/**
 * C08·C09·C10 · M15~M18 — 단위 환산의 전체 치환.
 *
 * 세 부속 자원이 **같은 규칙**을 지킨다. 하나만 검사하면 나머지 둘이 규칙을 어겨도 드러나지 않아
 * 자원마다 같은 단언을 되풀이한다(결정 6 — 셋은 서로를 알지 않는다).
 */
describe('ItemExtendedAttrsScreen — 단위 환산 치환 (M15~M18)', () => {
  it('치환 본문에 서버 식별자와 itemId가 없다 (M15·M16)', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), uomConversionSaveRoute()],
      '?item=1001&tab=sub&sub=uom',
    );

    const pane = await findUomConversionPane();
    await addUomConversionRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(uomConversionBodies(requests)).toHaveLength(1);
    });

    const body = uomConversionBodies(requests)[0] as { conversions: Record<string, unknown>[] };
    expect(body.conversions).toHaveLength(3);

    for (const conversion of body.conversions) {
      expect(Object.keys(conversion).sort()).toEqual([
        'conversionRate',
        'effectiveFrom',
        'effectiveTo',
        'fromUomId',
        'toUomId',
      ]);
    }
    expect(uomConversionPuts(requests)[0]?.body).not.toContain('itemId');
  });

  it('치환 저장이 1회이고 목록 조회의 ETag를 If-Match로 되돌려 보낸다', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), uomConversionSaveRoute()],
      '?item=1001&tab=sub&sub=uom',
    );

    const pane = await findUomConversionPane();
    await addUomConversionRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(uomConversionPuts(requests)).toHaveLength(1);
    });

    const put = uomConversionPuts(requests)[0]!;
    expect(put.url.pathname).toBe('/mdm/items/1001/uom-conversions');
    expect(put.headers.get('If-Match')).toBe('W/"2"');
    expect(put.headers.get('Idempotency-Key')).toMatch(UUID);
  });

  it('행을 전부 지우면 빈 배열을 보낸다 (M18)', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), uomConversionSaveRoute([])],
      '?item=1001&tab=sub&sub=uom',
    );

    const pane = await findUomConversionPane();

    for (const button of within(pane).getAllByRole('button', { name: /환산 삭제$/ })) {
      await user.click(button);
    }
    expect(within(pane).getByText('등록된 단위 환산이 없습니다')).toBeInTheDocument();

    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(uomConversionBodies(requests)).toHaveLength(1);
    });

    expect(uomConversionBodies(requests)[0]).toEqual({ conversions: [] });
  });

  /* 소수점 여덟 자리는 값의 일부다 — 옮기다 잃으면 사용자가 넣지 않은 값이 저장된다. */
  it('소수점 여덟 자리가 본문까지 그대로 간다', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), uomConversionSaveRoute()],
      '?item=1001&tab=sub&sub=uom',
    );

    const pane = await findUomConversionPane();
    await user.click(within(pane).getAllByRole('button', { name: /환산 수정$/ })[1]!);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '확인' }));
    await user.click(within(pane).getAllByRole('button', { name: /환산 삭제$/ })[0]!);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(uomConversionBodies(requests)).toHaveLength(1);
    });

    const body = uomConversionBodies(requests)[0] as { conversions: { conversionRate: number }[] };
    expect(body.conversions[0]?.conversionRate).toBe(0.00012345);
  });

  /**
   * F4 — `numeric(18,8)`의 가장 작은 값은 `String`으로 옮기면 `"1e-8"`이 된다.
   *
   * **표기만 펴고 값은 그대로다.** 표에 십진으로 보이는지와 본문에 같은 값이 실리는지를
   * 함께 잰다 — 한쪽만 보면 자릿수를 반올림하는 구현도 통과한다.
   */
  it('아주 작은 환산 비율이 표와 본문에서 값을 잃지 않는다', async () => {
    const { requests, user } = renderScreen(
      [
        ...subsidiaryRoutes({
          uomConversions: uomConversionsRoute([
            { ...uomConversionFixtures[0]!, itemUomConversionId: 4009, conversionRate: 1e-8 },
            uomConversionFixtures[1]!,
          ]),
        }),
        uomConversionSaveRoute(),
      ],
      '?item=1001&tab=sub&sub=uom',
    );

    const pane = await findUomConversionPane();

    /* 갈아 끼운 자료가 실제로 그려졌는가 — 기본 목록에는 없는 값으로 잰다(F6 교훈). */
    expect(within(pane).getByText('0.00000001')).toBeInTheDocument();
    expect(within(pane).queryByText('1e-8')).not.toBeInTheDocument();

    /* 이 줄을 고치지 않는다 — 다른 줄을 지워 저장을 여는 것으로 충분하다. */
    await user.click(within(pane).getAllByRole('button', { name: /환산 삭제$/ })[1]!);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(uomConversionBodies(requests)).toHaveLength(1);
    });

    const body = uomConversionBodies(requests)[0] as { conversions: { conversionRate: number }[] };
    expect(body.conversions).toHaveLength(1);
    expect(body.conversions[0]?.conversionRate).toBe(1e-8);
  });

  it('창의 확인만으로는 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), uomConversionSaveRoute()],
      '?item=1001&tab=sub&sub=uom',
    );

    await findUomConversionPane();
    await addUomConversionRow(user);

    expect(uomConversionPuts(requests)).toHaveLength(0);
  });

  it('취소하면 만든 줄이 사라지고 저장이 다시 닫힌다', async () => {
    const { user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub&sub=uom');

    const pane = await findUomConversionPane();
    await addUomConversionRow(user);
    expect(within(pane).getAllByRole('row')).toHaveLength(4);

    await user.click(within(pane).getByRole('button', { name: '취소' }));

    expect(within(pane).getAllByRole('row')).toHaveLength(3);
    expect(within(pane).getByRole('button', { name: '저장' })).toBeDisabled();
  });

  it('성공하면 목록을 다시 조회한다', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), uomConversionSaveRoute()],
      '?item=1001&tab=sub&sub=uom',
    );

    const pane = await findUomConversionPane();
    await waitFor(() => {
      expect(requestsTo(requests, uomConversionsPath())).toHaveLength(1);
    });

    await addUomConversionRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(
        requestsTo(requests, uomConversionsPath()).filter((r) => r.method === 'GET'),
      ).toHaveLength(2);
    });
  });

  /*
   * **한 자원을 저장해도 나머지 둘은 다시 받지 않는다.**
   * 함께 무효화하면 편집 중이던 다른 초안이 서버 응답으로 되감긴다.
   */
  it('단위 환산 저장이 사업부 매핑을 다시 받게 하지 않는다', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), uomConversionSaveRoute()],
      '?item=1001&tab=sub&sub=uom',
    );

    const pane = await findUomConversionPane();
    await waitFor(() => {
      expect(requestsTo(requests, buMapsPath())).toHaveLength(1);
    });

    await addUomConversionRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(uomConversionPuts(requests)).toHaveLength(1);
    });
    expect(requestsTo(requests, buMapsPath())).toHaveLength(1);
  });
});

/**
 * §5.4 — **세 초안은 서로 다른 자원이라 함께 산다.**
 * 하위 탭을 옮기는 것은 「보이는 행이 달라지는」 조작이 아니다.
 */
describe('ItemExtendedAttrsScreen — 하위 탭 사이의 초안 수명', () => {
  it('두 하위 탭의 초안이 동시에 살아 있다', async () => {
    const { user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    const buPane = await findBuMapPane();
    await addBuMapRow(user);
    expect(buMapRowCount(buPane)).toBe(3);

    const uomPane = await openUomConversionTab(user);
    await addUomConversionRow(user);
    expect(within(uomPane).getAllByRole('row')).toHaveLength(4);

    await user.click(screen.getByRole('tab', { name: '사업부 매핑' }));

    expect(buMapRowCount(await findBuMapPane())).toBe(3);
  });

  /* 반대 방향 — 품목이 달라지면 **셋 다** 비워진다. */
  it('품목을 바꾸면 두 하위 탭의 초안이 함께 비워진다', async () => {
    const { user } = renderScreen(
      [...subsidiaryRoutes(), buMapsRoute([], 1002), uomConversionsRoute([], 1002)],
      '?item=1001&tab=sub',
    );

    await findBuMapPane();
    await addBuMapRow(user);
    await openUomConversionTab(user);
    await addUomConversionRow(user);

    await user.click(screen.getByRole('button', { name: 'SYN-ITEM-02 선택' }));

    await waitFor(() => {
      expect(screen.getByText('등록된 단위 환산이 없습니다')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('tab', { name: '사업부 매핑' }));
    await waitFor(() => {
      expect(screen.getByText('등록된 사업부 매핑이 없습니다')).toBeInTheDocument();
    });
  });
});

/* ── 부속 정보 · 외부 코드 ─────────────────────────────────────────────────── */

const findExternalCodePane = async (): Promise<HTMLElement> => {
  const pane = await screen.findByRole('region', { name: '외부 코드' });

  await waitFor(() => {
    expect(
      within(pane).queryByRole('status', { name: '외부 코드를 불러오는 중' }),
    ).not.toBeInTheDocument();
  });

  return pane;
};

const externalCodeBodies = (requests: RecordedRequest[], itemId = 1001): unknown[] =>
  requests
    .filter(
      (request) => request.method === 'PUT' && request.url.pathname === externalCodesPath(itemId),
    )
    .map((request) => JSON.parse(request.body) as unknown);

const externalCodePuts = (requests: RecordedRequest[], itemId = 1001): RecordedRequest[] =>
  requests.filter(
    (request) => request.method === 'PUT' && request.url.pathname === externalCodesPath(itemId),
  );

/** 외부 코드 한 줄을 창에서 만든다. 확인까지 누르면 표에만 반영된다. */
const addExternalCodeRow = async (
  user: ReturnType<typeof userEvent.setup>,
  systemCode: ExternalCodeDraft['externalSystemCode'] = 'EQUIPMENT_STANDARD_IF',
) => {
  await user.click(screen.getByRole('button', { name: '외부 코드 추가' }));

  const dialog = screen.getByRole('dialog');

  await user.click(within(dialog).getByLabelText('외부 시스템'));
  await user.click(within(dialog).getByRole('option', { name: systemCode }));
  await user.type(within(dialog).getByLabelText('외부 품목코드'), 'SYN-EXT-ITEM-09');

  await user.click(within(dialog).getByRole('button', { name: '확인' }));
};

describe('ItemExtendedAttrsScreen — 외부 코드 조회 시점', () => {
  it('확장 속성 탭에서는 외부 코드와 거래처를 조회하지 않는다', async () => {
    const { requests } = renderScreen(subsidiaryRoutes(), '?item=1001');

    await findOriginContent();

    expect(requestsTo(requests, externalCodesPath())).toHaveLength(0);
    expect(requestsTo(requests, PARTNERS_PATH)).toHaveLength(0);
  });

  it('부속 정보 탭에 들어가면 셋을 함께 조회한다', async () => {
    const { requests } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    await findBuMapPane();

    await waitFor(() => {
      expect(requestsTo(requests, externalCodesPath())).toHaveLength(1);
    });
    expect(requestsTo(requests, buMapsPath())).toHaveLength(1);
    expect(requestsTo(requests, uomConversionsPath())).toHaveLength(1);
  });
});

/** C08·C09·C10 · M15~M18 — 외부 코드의 전체 치환. 셋째 자원도 같은 규칙을 지킨다. */
describe('ItemExtendedAttrsScreen — 외부 코드 치환 (M15~M18)', () => {
  it('치환 본문에 서버 식별자와 itemId가 없다 (M15·M16)', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), externalCodeSaveRoute()],
      '?item=1001&tab=sub&sub=ext',
    );

    const pane = await findExternalCodePane();
    await addExternalCodeRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(externalCodeBodies(requests)).toHaveLength(1);
    });

    const body = externalCodeBodies(requests)[0] as { externalCodes: Record<string, unknown>[] };
    expect(body.externalCodes).toHaveLength(3);

    for (const code of body.externalCodes) {
      expect(Object.keys(code).sort()).toEqual([
        'externalItemCode',
        'externalSystemCode',
        'partnerId',
      ]);
    }
    expect(externalCodePuts(requests)[0]?.body).not.toContain('itemId');
  });

  it('치환 저장이 1회이고 목록 조회의 ETag를 If-Match로 되돌려 보낸다', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), externalCodeSaveRoute()],
      '?item=1001&tab=sub&sub=ext',
    );

    const pane = await findExternalCodePane();
    await addExternalCodeRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(externalCodePuts(requests)).toHaveLength(1);
    });

    const put = externalCodePuts(requests)[0]!;
    expect(put.url.pathname).toBe('/mdm/items/1001/external-codes');
    expect(put.headers.get('If-Match')).toBe('W/"3"');
    expect(put.headers.get('Idempotency-Key')).toMatch(UUID);
  });

  it('행을 전부 지우면 빈 배열을 보낸다 (M18)', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), externalCodeSaveRoute([])],
      '?item=1001&tab=sub&sub=ext',
    );

    const pane = await findExternalCodePane();

    for (const button of within(pane).getAllByRole('button', { name: /외부 코드 삭제$/ })) {
      await user.click(button);
    }
    expect(within(pane).getByText('등록된 외부 코드가 없습니다')).toBeInTheDocument();

    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(externalCodeBodies(requests)).toHaveLength(1);
    });

    expect(externalCodeBodies(requests)[0]).toEqual({ externalCodes: [] });
  });

  /* 계약이 「비우면 (전체)」를 널로 표현한다(A-7) — 빈 문자열을 그대로 보내면 형식 위반이다. */
  it('거래처를 비운 줄은 널로 실린다', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), externalCodeSaveRoute()],
      '?item=1001&tab=sub&sub=ext',
    );

    const pane = await findExternalCodePane();
    await addExternalCodeRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(externalCodeBodies(requests)).toHaveLength(1);
    });

    const body = externalCodeBodies(requests)[0] as {
      externalCodes: { externalSystemCode: string; partnerId: number | null }[];
    };
    const added = body.externalCodes.find(
      (code) => code.externalSystemCode === 'EQUIPMENT_STANDARD_IF',
    );
    expect(added?.partnerId).toBeNull();
  });

  it('창의 확인만으로는 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), externalCodeSaveRoute()],
      '?item=1001&tab=sub&sub=ext',
    );

    await findExternalCodePane();
    await addExternalCodeRow(user);

    expect(externalCodePuts(requests)).toHaveLength(0);
  });

  it('취소하면 만든 줄이 사라지고 저장이 다시 닫힌다', async () => {
    const { user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub&sub=ext');

    const pane = await findExternalCodePane();
    await addExternalCodeRow(user);
    expect(within(pane).getAllByRole('row')).toHaveLength(4);

    await user.click(within(pane).getByRole('button', { name: '취소' }));

    expect(within(pane).getAllByRole('row')).toHaveLength(3);
    expect(within(pane).getByRole('button', { name: '저장' })).toBeDisabled();
  });

  it('성공하면 목록을 다시 조회한다', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), externalCodeSaveRoute()],
      '?item=1001&tab=sub&sub=ext',
    );

    const pane = await findExternalCodePane();
    await waitFor(() => {
      expect(requestsTo(requests, externalCodesPath())).toHaveLength(1);
    });

    await addExternalCodeRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(
        requestsTo(requests, externalCodesPath()).filter((r) => r.method === 'GET'),
      ).toHaveLength(2);
    });
  });

  /* 셋째 자원도 자기 키만 무효화한다 — 세 자원 모두 같은 방향으로 잠근다. */
  it('외부 코드 저장이 사업부 매핑·단위 환산을 다시 받게 하지 않는다', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), externalCodeSaveRoute()],
      '?item=1001&tab=sub&sub=ext',
    );

    const pane = await findExternalCodePane();
    await waitFor(() => {
      expect(requestsTo(requests, buMapsPath())).toHaveLength(1);
    });
    expect(requestsTo(requests, uomConversionsPath())).toHaveLength(1);

    await addExternalCodeRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(externalCodePuts(requests)).toHaveLength(1);
    });
    expect(requestsTo(requests, buMapsPath())).toHaveLength(1);
    expect(requestsTo(requests, uomConversionsPath())).toHaveLength(1);
  });

  it('403이 공통 배너 문구로 난다 (M26)', async () => {
    const { user } = renderScreen(
      [
        ...subsidiaryRoutes(),
        {
          match: (request: Request) => isPut(request, externalCodesPath()),
          respond: () => jsonResponse({ code: 'FORBIDDEN', message: '권한 없음' }, { status: 403 }),
        },
      ],
      '?item=1001&tab=sub&sub=ext',
    );

    const pane = await findExternalCodePane();
    await addExternalCodeRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    expect(await screen.findByText(FORBIDDEN_TEXT)).toBeInTheDocument();
  });
});

/**
 * M29 — **이 화면 최대의 중복 함정**을 화면 수준에서 잡는다.
 * `COALESCE(partner_id,0)` 접기(A-7) — 거래처를 비운 두 줄은 서버에게 같은 짝이다.
 */
describe('ItemExtendedAttrsScreen — 외부 코드 중복 (M29)', () => {
  it('거래처를 비운 같은 외부 시스템 줄은 표에 들어가지 않는다', async () => {
    const { user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub&sub=ext');

    const pane = await findExternalCodePane();

    /* 픽스처 5502가 거래처를 비운 `TRACKING_SYSTEM`다 — 같은 코드를 거래처 없이 하나 더 만든다. */
    await addExternalCodeRow(user, 'TRACKING_SYSTEM');

    expect(screen.getByText(/거래처를 비운 줄끼리도 같은 줄로 봅니다/)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(within(pane).getAllByRole('row')).toHaveLength(3);
  });

  /* 반대 방향 — 거래처가 다르면 같은 외부 시스템이어도 만들 수 있다. */
  it('거래처가 다르면 같은 외부 시스템 줄을 만들 수 있다', async () => {
    const { user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub&sub=ext');

    const pane = await findExternalCodePane();

    await user.click(screen.getByRole('button', { name: '외부 코드 추가' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByLabelText('외부 시스템'));
    await user.click(within(dialog).getByRole('option', { name: 'TRACKING_SYSTEM' }));
    await user.click(within(dialog).getByLabelText('거래처'));
    await user.click(screen.getByRole('option', { name: 'SYN-PARTNER-01 · 합성 거래처 A' }));
    await user.type(within(dialog).getByLabelText('외부 품목코드'), 'SYN-EXT-ITEM-09');
    await user.click(within(dialog).getByRole('button', { name: '확인' }));

    expect(within(pane).getAllByRole('row')).toHaveLength(4);
  });
});

/**
 * §5.4 — 세 초안이 **함께 산다.** 하위 탭 셋을 모두 고친 뒤 왕복해도 남아야 하고,
 * 품목이 바뀌면 셋 다 비워져야 한다.
 */
describe('ItemExtendedAttrsScreen — 부속 초안 세 벌 (C12)', () => {
  it('세 하위 탭의 초안이 동시에 살아 있다', async () => {
    const { user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    await findBuMapPane();
    await addBuMapRow(user);

    await openUomConversionTab(user);
    await addUomConversionRow(user);

    await user.click(screen.getByRole('tab', { name: '외부 코드' }));
    const extPane = await findExternalCodePane();
    await addExternalCodeRow(user);

    expect(within(extPane).getAllByRole('row')).toHaveLength(4);

    await user.click(screen.getByRole('tab', { name: '단위 환산' }));
    expect(within(await findUomConversionPane()).getAllByRole('row')).toHaveLength(4);

    await user.click(screen.getByRole('tab', { name: '사업부 매핑' }));
    expect(buMapRowCount(await findBuMapPane())).toBe(3);
  });

  it('확장 속성 탭을 다녀와도 세 초안이 남는다', async () => {
    const { user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub&sub=ext');

    await findExternalCodePane();
    await addExternalCodeRow(user);

    await user.click(screen.getByRole('tab', { name: '확장 속성' }));
    await findAttrsPane();
    await user.click(screen.getByRole('tab', { name: '부속 정보' }));

    expect(within(await findExternalCodePane()).getAllByRole('row')).toHaveLength(4);
  });

  it('품목을 바꾸면 세 초안이 함께 비워진다 (M08)', async () => {
    const { user } = renderScreen(
      [
        ...subsidiaryRoutes(),
        buMapsRoute([], 1002),
        uomConversionsRoute([], 1002),
        externalCodesRoute([], 1002),
      ],
      '?item=1001&tab=sub&sub=ext',
    );

    await findExternalCodePane();
    await addExternalCodeRow(user);

    await user.click(screen.getByRole('button', { name: 'SYN-ITEM-02 선택' }));

    await waitFor(() => {
      expect(screen.getByText('등록된 외부 코드가 없습니다')).toBeInTheDocument();
    });
  });
});

/**
 * client#602(핵심) — **부속 치환 셋도 이제 확장 속성과 같이 잠금 토큰에 매인다.**
 *
 * 예전에는 계약에 이 쓰기들의 `If-Match` 파라미터 자체가 없고 목록 조회도 `ETag`를 주지
 * 않아 토큰 없이도 저장이 나갔다(M17). 지금은 각 목록 조회 자체가 `ETag`를 주고 저장이
 * `If-Match`를 요구한다 — `etagPath`가 그 토큰을 찾지 못하면 `useMasterWrite`가
 * **요청을 보내지 않고 멈춘다.**
 *
 * **토큰이 있는 상황만 검사하면 이 결함이 통과한다.** 그래서 여기서는 네 조회(품목 상세 +
 * 부속 셋) 모두 **토큰 없는 응답**을 준다.
 */
describe('ItemExtendedAttrsScreen — 부속 치환도 확장 속성처럼 잠금 토큰에 매인다 (client#602)', () => {
  const tokenlessRoutes = (): StubRoute[] => [
    itemListRoute(),
    itemDetailByIdRoute({ withEtag: false }),
    uomsRoute(),
    businessUnitsRoute(),
    partnersRoute(),
    buMapsRoute(buMapFixtures, 1001, { withEtag: false }),
    uomConversionsRoute(uomConversionFixtures, 1001, { withEtag: false }),
    externalCodesRoute(externalCodeFixtures, 1001, { withEtag: false }),
    buMapSaveRoute(),
    uomConversionSaveRoute(),
    externalCodeSaveRoute(),
  ];

  it('목록 조회에 잠금 토큰이 없으면 사업부 매핑 저장이 나가지 않는다', async () => {
    const { requests, user } = renderScreen(tokenlessRoutes(), '?item=1001&tab=sub');

    const pane = await findBuMapPane();
    await addBuMapRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(buMapPuts(requests)).toHaveLength(0);
    });
    expect(
      await screen.findByText('최신 정보를 불러오는 중입니다. 잠시 뒤 다시 저장하세요.'),
    ).toBeInTheDocument();
  });

  it('목록 조회에 잠금 토큰이 없으면 단위 환산 저장이 나가지 않는다', async () => {
    const { requests, user } = renderScreen(tokenlessRoutes(), '?item=1001&tab=sub&sub=uom');

    const pane = await findUomConversionPane();
    await addUomConversionRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(uomConversionPuts(requests)).toHaveLength(0);
    });
    expect(
      await screen.findByText('최신 정보를 불러오는 중입니다. 잠시 뒤 다시 저장하세요.'),
    ).toBeInTheDocument();
  });

  it('목록 조회에 잠금 토큰이 없으면 외부 코드 저장이 나가지 않는다', async () => {
    const { requests, user } = renderScreen(tokenlessRoutes(), '?item=1001&tab=sub&sub=ext');

    const pane = await findExternalCodePane();
    await addExternalCodeRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(externalCodePuts(requests)).toHaveLength(0);
    });
    expect(
      await screen.findByText('최신 정보를 불러오는 중입니다. 잠시 뒤 다시 저장하세요.'),
    ).toBeInTheDocument();
  });

  /*
   * 확장 속성도 같은 규칙이다(§5.3 1행) — 부속 셋과 함께 네 쓰기가 모두 토큰에 매인다.
   */
  it('상세에 잠금 토큰이 없으면 확장 속성 저장은 나가지 않는다', async () => {
    const { requests, user } = renderScreen([...tokenlessRoutes(), itemSaveRoute()], '?item=1001');

    await findAttrsPane();
    await editAndSave(user);

    await waitFor(() => {
      expect(savedBodies(requests)).toHaveLength(0);
    });
    expect(
      await screen.findByText('최신 정보를 불러오는 중입니다. 잠시 뒤 다시 저장하세요.'),
    ).toBeInTheDocument();
  });
});

/**
 * M29(사업부 매핑 몫) — **계약에 없는 중복 검사를 만들지 않는다.**
 *
 * 계약이 이 표에 유일 제약을 적지 않았다(구별 제약·짝 제약만 있다). 화면이 없는 제약을
 * 흉내 내면 **서버가 허용하는 값을 화면이 막는다**(W-06-02 결정 9 승계 · 계획 §13-11).
 * 단위 환산·외부 코드에는 중복 검사가 있어, 셋을 나란히 만들다 보면 이 표에도 옮겨 붙기 쉽다.
 */
describe('ItemExtendedAttrsScreen — 사업부 매핑은 중복을 막지 않는다 (M29)', () => {
  it('서버에 있는 줄과 같은 짝을 하나 더 만들 수 있다', async () => {
    const { user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    const pane = await findBuMapPane();
    expect(buMapRowCount(pane)).toBe(2);

    /* 픽스처 3001과 **네 값이 모두 같은** 줄이다 — 서버는 이것을 받는다. */
    await user.click(screen.getByRole('button', { name: '매핑 추가' }));
    const dialog = buMapDialog();

    await user.click(within(dialog).getByLabelText('보내는 사업부'));
    await user.click(screen.getByRole('option', { name: 'SYN-BU-01 · 합성 사업부 A' }));
    await user.click(within(dialog).getByLabelText('받는 사업부'));
    await user.click(screen.getByRole('option', { name: 'SYN-BU-02 · 합성 사업부 B' }));
    await user.type(within(dialog).getByLabelText('대상 품목 검색'), 'SYN');
    await user.click(within(dialog).getByRole('button', { name: '찾기' }));
    await user.click(await within(dialog).findByLabelText('대상 품목'));
    await user.click(screen.getByRole('option', { name: 'SYN-ITEM-02 · 합성 품목 B' }));
    await pickDate(user, within(dialog).getByLabelText('유효 시작'), '2026-01-01');

    await user.click(within(dialog).getByRole('button', { name: '확인' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(buMapRowCount(pane)).toBe(3);
    expect(screen.queryByText(/이미 있습니다|겹친 줄/)).not.toBeInTheDocument();
  });

  /* 저장까지 막히지 않아야 한다 — 판정은 서버 몫이고 400이 배너로 온다. */
  it('같은 짝이 둘이어도 저장이 열려 있다', async () => {
    const first = buMapFixtures[0]!;
    const { user } = renderScreen(
      [
        ...subsidiaryRoutes({
          buMaps: buMapsRoute([first, { ...first, itemBuItemMapId: 3009 }]),
        }),
        buMapSaveRoute(),
      ],
      '?item=1001&tab=sub',
    );

    const pane = await findBuMapPane();

    /*
     * **겹친 두 줄이 실제로 그려졌는지 먼저 잰다.** 스텁을 갈아 끼우지 못하면
     * 기본 목록(겹치지 않는 두 줄)이 그려지는데, 줄 수만 세면 둘 다 2라 구분되지 않는다 —
     * 두 줄이 **같은 값**을 내는지로 잰다.
     */
    expect(buMapRowCount(pane)).toBe(2);
    expect(within(pane).getAllByText('SYN-ITEM-02 · 합성 품목 B')).toHaveLength(2);
    expect(within(pane).getAllByText('2026-01-01 ~ 2026-12-31')).toHaveLength(2);

    await user.click(within(pane).getAllByRole('button', { name: /매핑 삭제$/ })[0]!);

    expect(within(pane).getByRole('button', { name: '저장' })).toBeEnabled();
    expect(within(pane).getByRole('button', { name: '저장' })).not.toHaveAttribute(
      'aria-describedby',
    );
  });
});

/**
 * 선택 목록 안내는 **주인이 하나**다.
 *
 * 단위 목록은 원본 구획의 기준 단위와 단위 환산 표가 함께 쓴다. 두 자리가 각각 안내를 내면
 * 단위 환산 하위 탭에서만 같은 문구가 둘로 보이고, 사용자는 서로 다른 두 가지 실패로 읽는다.
 */
describe('ItemExtendedAttrsScreen — 선택 목록 안내의 주인 (F1)', () => {
  const failingUomsRoute = (): StubRoute => ({
    match: (request) => isGet(request, UOMS_PATH),
    respond: () => jsonResponse({ message: '조회에 실패했습니다' }, { status: 500 }),
  });

  /** 실패한 단위 목록으로 화면을 그린다. `subsidiaryRoutes()`의 규칙이 이기지 않도록 직접 조립한다. */
  const routesWithFailingUoms = (): StubRoute[] => [
    itemListRoute(),
    itemDetailByIdRoute(),
    failingUomsRoute(),
    businessUnitsRoute(),
    partnersRoute(),
    buMapsRoute(),
    uomConversionsRoute(),
    externalCodesRoute(),
  ];

  const LOAD_FAILED_TEXT = '선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.';

  it('단위 환산 하위 탭에서도 안내가 하나뿐이다', async () => {
    renderScreen(routesWithFailingUoms(), '?item=1001&tab=sub&sub=uom');

    await findUomConversionPane();

    expect(await screen.findAllByText(LOAD_FAILED_TEXT)).toHaveLength(1);
  });

  /*
   * 반대 방향 — **다른 탭에서도 사라지지 않는다.**
   * 원본 구획의 기준 단위는 어느 탭에서나 보이므로, 안내를 확장 속성 탭으로 좁히면
   * 나머지 탭에서 「알 수 없음」만 남고 이유가 사라진다.
   */
  it.each([
    ['확장 속성', '?item=1001'],
    ['사업부 매핑', '?item=1001&tab=sub'],
    ['외부 코드', '?item=1001&tab=sub&sub=ext'],
  ])('%s 에서도 안내가 하나 보인다', async (_name, search) => {
    renderScreen(routesWithFailingUoms(), search);

    expect(await screen.findAllByText(LOAD_FAILED_TEXT)).toHaveLength(1);
  });
});

/**
 * F2 — 이름을 받는 중인 상태가 **창에서도** 표와 같아야 한다.
 *
 * 표는 「이름 불러오는 중」인데 창만 「알 수 없음」이면 사용자는 창을 여는 순간
 * 값이 사라진 것으로 읽는다.
 */
describe('ItemExtendedAttrsScreen — 대상 품목 이름의 로딩 갈래 (F2)', () => {
  /** 대상 품목 상세만 응답을 늦춰 「받는 중」 상태를 만든다. */
  const pendingItemDetailRoute = (): StubRoute => ({
    match: (request) =>
      request.method === 'GET' && /^\/mdm\/items\/\d+$/.test(new URL(request.url).pathname),
    respond: (request) => {
      const itemId = Number(new URL(request.url).pathname.split('/').pop());

      /* 고른 품목(1001)은 즉시 준다 — 그것이 없으면 화면 자체가 그려지지 않는다. */
      if (itemId === 1001) {
        return jsonResponse(
          {
            item: itemFixtures[0],
            editability: { codeEditable: false, reason: 'EDITABLE', referenceCount: 3 },
          },
          { headers: { ETag: 'W/"7"' } },
        );
      }

      return new Response(new ReadableStream(), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  it('이름을 받는 중이면 창의 선택칸도 「알 수 없음」이 아니다', async () => {
    const { user } = renderScreen(
      subsidiaryRoutes({ itemDetail: pendingItemDetailRoute() }),
      '?item=1001&tab=sub',
    );

    const pane = await findBuMapPane();
    expect(within(pane).getAllByText('이름 불러오는 중').length).toBeGreaterThan(0);

    await user.click(within(pane).getAllByRole('button', { name: /매핑 수정$/ })[0]!);

    const dialog = buMapDialog();
    await user.click(within(dialog).getByLabelText('대상 품목'));

    expect(screen.queryByRole('option', { name: '알 수 없음' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: '이름 불러오는 중' })).toBeInTheDocument();
  });
});

/* ── 자재 명세서 탭 ────────────────────────────────────────────────────────── */

interface BomRouteOverrides {
  itemDetail?: StubRoute;
  bomList?: StubRoute;
}

/**
 * 자재 명세서 탭을 그릴 때 필요한 스텁 한 벌.
 *
 * **덧붙이기로는 갈아 끼울 수 없다**(F6 교훈) — `createStubFetch`는 첫 일치로 응답하므로
 * 갈아 끼울 것은 반드시 이 인자로 넘긴다. 쓰기(`setDefaultRoute()`)는 메서드가 달라
 * 겹치지 않으므로 그대로 덧붙여도 된다.
 */
const bomRoutes = (overrides: BomRouteOverrides = {}): StubRoute[] => [
  itemListRoute(),
  overrides.itemDetail ?? itemDetailByIdRoute(),
  uomsRoute(),
  overrides.bomList ?? bomListRoute(),
];

const findBomListPane = async (): Promise<HTMLElement> => {
  const pane = await screen.findByRole('region', { name: '자재 명세서 목록' });

  await waitFor(() => {
    expect(
      within(pane).queryByRole('status', { name: '자재 명세서를 불러오는 중' }),
    ).not.toBeInTheDocument();
  });

  return pane;
};

/** `/planning/boms` 아래로 나간 **모든 쓰기**. 기본 지정 말고는 하나도 없어야 한다(M20). */
const bomWrites = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter(
    (request) => request.method !== 'GET' && request.url.pathname.startsWith(BOMS_PATH),
  );

const bomListGets = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.method === 'GET' && request.url.pathname === BOMS_PATH);

/* ── 자재 명세서 · 헤더 구획과 구성품 ─────────────────────────────────────── */

interface BomDetailRouteOverrides extends BomRouteOverrides {
  components?: StubRoute;
  routings?: StubRoute;
  routingOperations?: StubRoute;
}

/**
 * 헤더 구획·구성품 표까지 그릴 때 필요한 스텁 한 벌.
 *
 * **덧붙이기로는 갈아 끼울 수 없다**(F6 교훈) — 갈아 끼울 것은 이 인자로 넘긴다.
 */
const bomDetailRoutes = (overrides: BomDetailRouteOverrides = {}): StubRoute[] => [
  ...bomRoutes(overrides),
  overrides.components ?? bomComponentsRoute(),
  overrides.routings ?? routingsRoute(),
  overrides.routingOperations ?? routingOperationsRoute(),
  processesRoute(),
];

const findBomDetailPane = (): Promise<HTMLElement> =>
  screen.findByRole('region', { name: '자재 명세서 정보' });

const findBomComponentPane = async (): Promise<HTMLElement> => {
  const pane = await screen.findByRole('region', { name: '구성품' });

  await waitFor(() => {
    expect(
      within(pane).queryByRole('status', { name: '구성품을 불러오는 중' }),
    ).not.toBeInTheDocument();
  });

  return pane;
};

const openFirstBom = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'SYN-BOM-01 · Rev 1 구성품 보기' }));

  return findBomComponentPane();
};

const componentGets = (requests: RecordedRequest[], bomId = 2001): RecordedRequest[] =>
  requests.filter(
    (request) => request.method === 'GET' && request.url.pathname === componentsPath(bomId),
  );

/**
 * 자재 명세서 번호를 가리지 않고 **모든** 구성품 목록 요청.
 *
 * 「고르기 전에는 0회」를 특정 번호로만 세면 `enabled`를 뺀 코드가 그대로 통과한다 —
 * 그때 나가는 것은 `bomId=0`을 실은 요청이라 다른 경로이기 때문이다.
 */
const anyComponentGets = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter(
    (request) =>
      request.method === 'GET' && /^\/planning\/boms\/\d+\/components$/.test(request.url.pathname),
  );

const routingOperationGets = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter(
    (request) =>
      request.method === 'GET' &&
      /^\/planning\/routings\/\d+\/operations$/.test(request.url.pathname),
  );

/** 서버처럼 `bomCode`로 거르는 헤더 목록 — 화면이 조건을 실제로 실어 보내는지 결과로 확인한다. */
const bomListByCodeRoute = (): StubRoute => ({
  match: (request) => isGet(request, BOMS_PATH),
  respond: (request) => {
    const bomCode = new URL(request.url).searchParams.get('bomCode');

    return jsonResponse({
      items:
        bomCode === null ? bomFixtures : bomFixtures.filter((row) => row.bomCode.includes(bomCode)),
    });
  },
});

/**
 * 원본 구획의 품목유형 — 좌 목록과 같은 코드 그룹 `ITEM_TYPE`의 이름을 낸다.
 * 고르는 자리가 아니라 표시하는 자리라 미사용 유형도 받는다.
 */
describe('ItemExtendedAttrsScreen — 원본 구획의 품목유형 이름', () => {
  it('품목유형을 코드 그룹의 이름으로 내고 미사용 유형도 받는다', async () => {
    const { requests } = renderScreen(
      [itemListRoute(), itemDetailRoute(), uomsRoute()],
      '?item=1001',
    );

    await findOriginContent();

    await waitFor(() => {
      expect(within(itemOriginPane()).getByLabelText('품목유형')).toHaveTextContent('완제품');
    });
    expect(
      codeValueGets(requests, 'ITEM_TYPE').some(
        (request) => request.url.searchParams.get('includeInactive') === 'true',
      ),
    ).toBe(true);
  });

  it('유형 목록 조회가 실패하면 코드 그대로 낸다', async () => {
    const { requests } = renderScreen(
      [itemListRoute(), itemDetailRoute(), uomsRoute(), errorRoute(CODE_VALUES_PATH)],
      '?item=1001',
    );

    await findOriginContent();
    // 원본 구획용(미사용 포함) 조회가 실패로 끝난 뒤에 잰다.
    await waitFor(() => {
      expect(
        codeValueGets(requests, 'ITEM_TYPE').some(
          (request) => request.url.searchParams.get('includeInactive') === 'true',
        ),
      ).toBe(true);
    });

    expect(within(itemOriginPane()).getByLabelText('품목유형')).toHaveTextContent('FINISHED');
  });
});

/**
 * MES 구분(`mesCategoryCode`) — 시스템 소유 값이라 편집 본문에 자리가 없다.
 * 원본 사실 칸에 값 표기로 두고 이름은 코드 그룹 `MES_CATEGORY`에서 받는다.
 */
describe('ItemExtendedAttrsScreen — MES 구분', () => {
  it('원본 사실 칸에 코드 그룹의 이름으로 낸다', async () => {
    const { requests } = renderScreen(
      [itemListRoute(), itemDetailRoute(), uomsRoute()],
      '?item=1001',
    );

    await findAttrsPane();

    await waitFor(() => {
      expect(within(itemOriginPane()).getByLabelText('MES 구분')).toHaveTextContent('합성 구분 A');
    });
    expect(codeValueGets(requests, 'MES_CATEGORY')).toHaveLength(1);
  });

  it('저장 본문에 싣지 않는다 — 편집 계약에 자리가 없다', async () => {
    const { requests, user } = renderScreen(
      [itemListRoute(), itemDetailRoute(), uomsRoute(), itemSaveRoute()],
      '?item=1001',
    );

    await findAttrsPane();
    await editAndSave(user);

    await waitFor(() => {
      expect(savedBodies(requests)).toHaveLength(1);
    });
    expect(savedBodies(requests)[0]).not.toHaveProperty('mesCategoryCode');
  });
});

/* ── 구성품 확장 열 편집 ──────────────────────────────────────────────────── */

const componentDetailPath = (bomId: number, bomComponentId: number): string =>
  `${componentsPath(bomId)}/${String(bomComponentId)}`;

/**
 * 구성품 행 상세 — **`ETag`가 여기에만 온다**(계약 실측 M).
 * 목록 조회에는 없으므로 이 조회가 저장의 유일한 토큰 출처다.
 */
const componentDetailRoute = ({ withEtag = true } = {}): StubRoute => ({
  match: (request) =>
    request.method === 'GET' &&
    /^\/planning\/boms\/\d+\/components\/\d+$/.test(new URL(request.url).pathname),
  respond: (request) => {
    const bomComponentId = Number(new URL(request.url).pathname.split('/').pop());
    const component = bomComponentFixtures.find((row) => row.bomComponentId === bomComponentId);

    if (component === undefined)
      return jsonResponse({ message: '없는 구성품입니다' }, { status: 404 });

    return jsonResponse(
      {
        bomComponent: component,
        editability: { codeEditable: false, reason: 'RECEIVED_FROM_ERP', referenceCount: 0 },
      },
      withEtag ? { headers: { ETag: 'W/"3"' } } : {},
    );
  },
});

const componentSaveRoute = (): StubRoute => ({
  match: (request) =>
    request.method === 'PUT' &&
    /^\/planning\/boms\/\d+\/components\/\d+$/.test(new URL(request.url).pathname),
  respond: (request) => {
    const bomComponentId = Number(new URL(request.url).pathname.split('/').pop());

    return jsonResponse(
      bomComponentFixtures.find((row) => row.bomComponentId === bomComponentId),
      { headers: { ETag: 'W/"4"' } },
    );
  },
});

const componentSaveFailureRoute = (status: number, body: unknown): StubRoute => ({
  match: (request) =>
    request.method === 'PUT' &&
    /^\/planning\/boms\/\d+\/components\/\d+$/.test(new URL(request.url).pathname),
  respond: () => jsonResponse(body, { status }),
});

interface ComponentEditRouteOverrides extends BomDetailRouteOverrides {
  componentDetail?: StubRoute;
}

/**
 * 구성품 편집까지 그릴 때 필요한 스텁 한 벌.
 * **덧붙이기로는 갈아 끼울 수 없다**(F6 교훈) — 갈아 끼울 것은 이 인자로 넘긴다.
 */
const componentEditRoutes = (overrides: ComponentEditRouteOverrides = {}): StubRoute[] => [
  ...bomDetailRoutes(overrides),
  overrides.componentDetail ?? componentDetailRoute(),
];

const componentDetailGets = (
  requests: RecordedRequest[],
  bomId = 2001,
  bomComponentId = 7001,
): RecordedRequest[] =>
  requests.filter(
    (request) =>
      request.method === 'GET' &&
      request.url.pathname === componentDetailPath(bomId, bomComponentId),
  );

const componentPuts = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter(
    (request) =>
      request.method === 'PUT' &&
      /^\/planning\/boms\/\d+\/components\/\d+$/.test(request.url.pathname),
  );

const componentBodies = (requests: RecordedRequest[]): Record<string, unknown>[] =>
  componentPuts(requests).map((request) => JSON.parse(request.body) as Record<string, unknown>);

/** 첫 구성품의 편집 창을 연다. **여는 것이 곧 행 상세 조회를 켜는 것이다.** */
const openComponentDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(
    screen.getByRole('button', { name: '1. SYN-ITEM-02 · 합성 품목 B 확장 열 수정' }),
  );

  return screen.findByRole('dialog');
};

/* ── 화면 전체 (작업 9 · 통합) ────────────────────────────────────────────── */

/** 세 탭과 하위 탭 셋을 모두 그릴 수 있는 스텁 한 벌. */
const wholeScreenRoutes = (): StubRoute[] => [
  ...componentEditRoutes(),
  businessUnitsRoute(),
  partnersRoute(),
  buMapsRoute(),
  uomConversionsRoute(),
  externalCodesRoute(),
];

/** 확장 속성 → 부속 정보(하위 탭 셋) 순으로 화면을 훑는다. BOM 은 다른 탭(bom-screen.test.tsx)이다. */
const walkWholeScreen = async (user: ReturnType<typeof userEvent.setup>) => {
  await findOriginContent();
  await findAttrsPane();

  await user.click(screen.getByRole('tab', { name: '부속 정보' }));
  await findBuMapPane();
  await openUomConversionTab(user);
  await user.click(screen.getByRole('tab', { name: '외부 코드' }));
  await findExternalCodePane();
};

describe('ItemExtendedAttrsScreen — 화면 전체', () => {
  /** C04 — 계약에 `POST /mdm/items`가 없다. 품목은 외부 정본이고 여기서 만들지 않는다. */
  it('세 탭을 모두 돌아도 품목을 새로 만드는 요청이 0회다 (C04)', async () => {
    const { requests, user } = renderScreen(wholeScreenRoutes(), '?item=1001');

    await walkWholeScreen(user);

    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(0);
  });

  /**
   * C03 · M01 — **원본 구획은 어느 탭에서도 값 표기뿐이다.**
   * 탭 밖에 있으므로 탭을 옮겨도 같아야 한다(결정 2).
   */
  it.each([
    ['확장 속성', '?item=1001'],
    ['부속 정보', '?item=1001&tab=sub'],
  ])('%s 탭에서도 원본 구획에 쓰기 수단이 없다 (M01)', async (_name, search) => {
    renderScreen(wholeScreenRoutes(), search);

    await findOriginContent();

    const origin = itemOriginPane();
    expect(within(origin).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(origin).queryAllByRole('combobox')).toHaveLength(0);
    expect(within(origin).queryAllByRole('switch')).toHaveLength(0);
    expect(within(origin).queryAllByRole('button')).toHaveLength(0);
  });

  /**
   * C11 · M13 — **주소가 조건·탭·선택의 정본이다.**
   * 새로고침·공유가 같은 화면을 내는지, 주소 한 벌로 통째로 확인한다.
   */
  it('주소 한 벌이 조건·탭·하위 탭·선택을 모두 되살린다', async () => {
    const { requests } = renderScreen(
      wholeScreenRoutes(),
      '?tab=sub&sub=ext&q=SYN&inactive=1&item=1001',
    );

    await findExternalCodePane();

    /* 좌 목록의 조건이 서버로 그대로 나갔다. */
    const list = requestsTo(requests, ITEMS_PATH)[0]!;
    expect(list.url.searchParams.get('q')).toBe('SYN');
    expect(list.url.searchParams.get('includeInactive')).toBe('true');

    /* 고른 탭·하위 탭·품목이 그대로 열려 있다. */
    expect(screen.getByRole('tab', { name: '부속 정보' })).toHaveAttribute('aria-selected', 'true');
    expect(within(itemOriginPane()).getByLabelText('품목코드')).toHaveTextContent('SYN-ITEM-01');
  });

  /* 품목 유형 조건 — 주소의 `type`이 서버의 `itemTypeCode`로 나가고, 선택지는 코드 그룹에서 받는다. */
  it('주소의 품목 유형을 itemTypeCode 로 보내고 선택칸은 코드 그룹의 이름을 낸다', async () => {
    const { requests } = renderScreen([itemListRoute()], '?type=FINISHED');

    await screen.findByRole('button', { name: 'SYN-ITEM-01 선택' });

    const list = requestsTo(requests, ITEMS_PATH)[0]!;
    expect(list.url.searchParams.get('itemTypeCode')).toBe('FINISHED');
    await waitFor(() => {
      expect(codeValueGets(requests, 'ITEM_TYPE')).toHaveLength(1);
    });
    await waitFor(() => {
      expect(typeSelect()).toHaveTextContent('완제품');
    });
  });

  /* 고객이 지운 유형처럼 목록에 없는 코드가 주소에 실려 오면 지어내지 않고 코드 그대로 낸다. */
  it('유형 목록에 없는 코드는 선택칸에 코드 그대로 낸다', async () => {
    const { requests } = renderScreen([itemListRoute()], '?type=SYN-TYPE-X');

    await screen.findByRole('button', { name: 'SYN-ITEM-01 선택' });
    await waitFor(() => {
      expect(codeValueGets(requests, 'ITEM_TYPE')).toHaveLength(1);
    });

    expect(typeSelect()).toHaveTextContent('SYN-TYPE-X');
  });

  /* 유형 목록을 받지 못해도 걸린 조건은 보여야 한다 — 코드로 물러난다. */
  it('유형 목록 조회가 실패하면 선택칸에 코드 그대로 낸다', async () => {
    const { requests } = renderScreen(
      [itemListRoute(), errorRoute(CODE_VALUES_PATH)],
      '?type=FINISHED',
    );

    await screen.findByRole('button', { name: 'SYN-ITEM-01 선택' });
    await waitFor(() => {
      expect(codeValueGets(requests, 'ITEM_TYPE')).toHaveLength(1);
    });

    expect(typeSelect()).toHaveTextContent('FINISHED');
  });
});

/* ── 설비·금형 매핑 ───────────────────────────────────────────────────────── */

const RESOURCE_MAPS_PATH = '/mdm/item-resource-maps';

const paged = (items: unknown[]) => ({ items, page: { page: 1, size: 200, total: items.length } });

const resourceMapRoutes = (rows = itemResourceMapFixtures): StubRoute[] => [
  ...subsidiaryRoutes(),
  processesRoute(),
  {
    match: (request) => isGet(request, '/mdm/plants'),
    respond: () =>
      jsonResponse(
        paged([
          { plantId: 9001, plantCode: 'SYN-PLANT-01', plantName: '합성 공장', isActive: true },
        ]),
      ),
  },
  {
    match: (request) => isGet(request, '/mdm/equipments'),
    respond: () =>
      jsonResponse(
        paged([
          {
            equipmentId: 8001,
            plantId: 9001,
            equipmentCode: 'SYN-EQ-01',
            equipmentName: '합성 설비 A',
            productionLineId: null,
            isActive: true,
          },
        ]),
      ),
  },
  {
    match: (request) => isGet(request, '/mdm/molds'),
    respond: () =>
      jsonResponse(
        paged([
          {
            moldId: 8501,
            plantId: 9001,
            moldCode: 'SYN-MOLD-01',
            moldName: '합성 금형 A',
            isActive: true,
          },
          {
            moldId: 8503,
            plantId: 9001,
            moldCode: 'SYN-MOLD-03',
            moldName: '합성 금형 C',
            isActive: true,
          },
        ]),
      ),
  },
  {
    match: (request) => isGet(request, RESOURCE_MAPS_PATH),
    respond: () => jsonResponse({ items: rows }),
  },
  {
    match: (request) =>
      request.method === 'POST' && new URL(request.url).pathname === RESOURCE_MAPS_PATH,
    respond: () => jsonResponse(itemResourceMapFixtures[1], { status: 201 }),
  },
  {
    match: (request) =>
      request.method === 'PUT' &&
      new URL(request.url).pathname.startsWith(`${RESOURCE_MAPS_PATH}/`),
    respond: () => jsonResponse(itemResourceMapFixtures[0], { headers: { ETag: '4' } }),
  },
];

const resourceMapWrites = (requests: RecordedRequest[], method: 'POST' | 'PUT') =>
  requests.filter(
    (request) => request.method === method && request.url.pathname.startsWith(RESOURCE_MAPS_PATH),
  );

const findResourceMapPane = () => screen.findByRole('region', { name: '설비·금형' });

/** 금형 칸을 눌러 찾기 창을 열고 한 줄을 골라 확인한다. */
const pickMold = async (
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  code: string,
): Promise<void> => {
  await user.click(within(dialog).getByLabelText('금형'));
  const picker = await screen.findByRole('dialog', { name: '금형 선택' });
  await user.click(await within(picker).findByRole('checkbox', { name: code }));
  await user.click(within(picker).getByRole('button', { name: '선택' }));
};

describe('ItemExtendedAttrsScreen — 설비·금형 매핑', () => {
  it('하위 탭에 「설비·금형」이 있다', async () => {
    renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    expect(await screen.findByRole('tab', { name: '설비·금형' })).toBeInTheDocument();
  });

  /* 다른 하위 탭에서는 받지 않는다 — 공장·설비·금형 목록까지 덩달아 받게 된다. */
  it('다른 하위 탭에서는 매핑을 조회하지 않는다', async () => {
    const { requests } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub&sub=uom');

    await screen.findByRole('region', { name: '단위 환산' });

    expect(requests.some((request) => request.url.pathname === RESOURCE_MAPS_PATH)).toBe(false);
  });

  it('하나뿐인 공장으로 사용 중지한 줄까지 조회해 표에 낸다', async () => {
    const { requests } = renderScreen(resourceMapRoutes(), '?item=1001&tab=sub&sub=res');

    const pane = await findResourceMapPane();
    expect(await within(pane).findByText('SYN-EQ-01 · 합성 설비 A')).toBeInTheDocument();

    const get = requests.find((request) => request.url.pathname === RESOURCE_MAPS_PATH)!;
    expect(Object.fromEntries(get.url.searchParams)).toEqual({
      itemId: '1001',
      plantId: '9001',
      includeInactive: 'true',
    });
  });

  it('등록은 POST 한 번이고 공장·품목을 싣고 If-Match가 없다', async () => {
    const { requests, user } = renderScreen(resourceMapRoutes([]), '?item=1001&tab=sub&sub=res');

    const pane = await findResourceMapPane();
    await within(pane).findByText('등록된 설비·금형이 없습니다');
    await user.click(within(pane).getByRole('button', { name: '추가' }));

    const dialog = await screen.findByRole('dialog', {
      name: '설비·금형 추가 · SYN-PLANT-01 · 합성 공장',
    });
    /* 창을 열기만 해서는 설비·금형 목록을 받지 않는다 — 찾기 창을 열어야 서버에 묻는다. */
    expect(
      requests.some((request) => ['/mdm/equipments', '/mdm/molds'].includes(request.url.pathname)),
    ).toBe(false);

    await pickMold(user, dialog, 'SYN-MOLD-03');
    await user.click(within(dialog).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(resourceMapWrites(requests, 'POST')).toHaveLength(1);
    });

    const post = resourceMapWrites(requests, 'POST')[0]!;
    expect(JSON.parse(post.body)).toEqual({
      plantId: 9001,
      itemId: 1001,
      processId: null,
      equipmentId: null,
      moldId: 8503,
      isDefault: false,
      priorityNo: 100,
      remarks: null,
    });
    expect(post.headers.get('Idempotency-Key')).toMatch(UUID);
    expect(post.headers.has('If-Match')).toBe(false);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('서버가 화면 범위 중복으로 거부하면 창 안 배너에 화면의 중복 문구가 난다', async () => {
    const duplicate: StubRoute = {
      match: (request) =>
        request.method === 'POST' && new URL(request.url).pathname === RESOURCE_MAPS_PATH,
      respond: () =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'screen',
                code: 'UNIQUE_VIOLATION',
                message: '같은 품목·공정·설비·금형 매핑이 이미 있습니다.',
                uniqueScope: ['plantId', 'itemId', 'processId', 'equipmentId', 'moldId'],
              },
            ],
          },
          { status: 400 },
        ),
    };
    const { user } = renderScreen(
      [duplicate, ...resourceMapRoutes([])],
      '?item=1001&tab=sub&sub=res',
    );

    const pane = await findResourceMapPane();
    await within(pane).findByText('등록된 설비·금형이 없습니다');
    await user.click(within(pane).getByRole('button', { name: '추가' }));

    const dialog = await screen.findByRole('dialog', {
      name: '설비·금형 추가 · SYN-PLANT-01 · 합성 공장',
    });
    await pickMold(user, dialog, 'SYN-MOLD-03');
    await user.click(within(dialog).getByRole('button', { name: '저장' }));

    expect(
      await within(dialog).findByText('같은 공정·설비·금형 줄이 이미 있습니다.'),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText('같은 품목·공정·설비·금형 매핑이 이미 있습니다.')).toBeNull();
  });

  it('수정은 그 줄의 versionNo를 If-Match로 보낸다', async () => {
    const { requests, user } = renderScreen(resourceMapRoutes(), '?item=1001&tab=sub&sub=res');

    const pane = await findResourceMapPane();
    await user.click(
      await within(pane).findByRole('button', {
        name: 'SYN-PROC-01 · 합성 공정 가 / SYN-EQ-01 / SYN-MOLD-01 수정',
      }),
    );

    const dialog = await screen.findByRole('dialog', {
      name: '설비·금형 수정 · SYN-PLANT-01 · 합성 공장',
    });
    await user.clear(within(dialog).getByLabelText('비고'));
    await user.click(within(dialog).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(resourceMapWrites(requests, 'PUT')).toHaveLength(1);
    });

    const put = resourceMapWrites(requests, 'PUT')[0]!;
    expect(put.url.pathname).toBe('/mdm/item-resource-maps/6001');
    expect(put.headers.get('If-Match')).toBe('3');
    expect(JSON.parse(put.body)).toEqual({
      processId: 3001,
      equipmentId: 8001,
      moldId: 8501,
      isDefault: true,
      priorityNo: 10,
      remarks: null,
    });
  });

  it('자동 배정은 바꾸는 칸만 싣고 그 줄의 versionNo로 잠근다', async () => {
    const { requests, user } = renderScreen(resourceMapRoutes(), '?item=1001&tab=sub&sub=res');

    const pane = await findResourceMapPane();
    await user.click(
      await within(pane).findByRole('button', { name: '전체 공정 / SYN-MOLD-02 자동 배정 지정' }),
    );

    await waitFor(() => {
      expect(resourceMapWrites(requests, 'PUT')).toHaveLength(1);
    });

    const put = resourceMapWrites(requests, 'PUT')[0]!;
    expect(put.url.pathname).toBe('/mdm/item-resource-maps/6002');
    expect(put.headers.get('If-Match')).toBe('1');
    expect(JSON.parse(put.body)).toEqual({ isDefault: true });
  });

  it('다시 사용은 isActive만 바꾼다', async () => {
    const { requests, user } = renderScreen(resourceMapRoutes(), '?item=1001&tab=sub&sub=res');

    const pane = await findResourceMapPane();
    await user.click(
      await within(pane).findByRole('button', {
        name: 'SYN-PROC-01 · 합성 공정 가 / SYN-EQ-02 다시 사용',
      }),
    );

    await waitFor(() => {
      expect(resourceMapWrites(requests, 'PUT')).toHaveLength(1);
    });

    const put = resourceMapWrites(requests, 'PUT')[0]!;
    expect(put.headers.get('If-Match')).toBe('5');
    expect(JSON.parse(put.body)).toEqual({ isActive: true });
  });
});

/**
 * 줄 쓰기는 목록의 `versionNo`로 잠근다 — 쓰고 나면 목록을 다시 받아야 다음 쓰기가 새 판을 쓴다.
 * 목록 조회와 `PUT`의 응답을 차례대로 바꿔 가며 그 흐름을 잰다.
 */
describe('ItemExtendedAttrsScreen — 설비·금형 매핑의 판 갱신', () => {
  const [defaultRow, commonRow, inactiveRow] = itemResourceMapFixtures as [
    ItemResourceMapRow,
    ItemResourceMapRow,
    ItemResourceMapRow,
  ];

  /** 목록은 `lists`를 차례로 내고 마지막 것을 되풀이한다. `PUT`도 `puts`를 같은 식으로 낸다. */
  const sequencedRoutes = (
    lists: ItemResourceMapRow[][],
    puts: (() => Response)[],
  ): StubRoute[] => {
    let listCall = 0;
    let putCall = 0;

    return [
      {
        match: (request) => isGet(request, RESOURCE_MAPS_PATH),
        respond: () => {
          const items = lists[Math.min(listCall, lists.length - 1)]!;
          listCall += 1;
          return jsonResponse({ items });
        },
      },
      {
        match: (request) =>
          request.method === 'PUT' &&
          new URL(request.url).pathname.startsWith(`${RESOURCE_MAPS_PATH}/`),
        respond: () => {
          const respond = puts[Math.min(putCall, puts.length - 1)]!;
          putCall += 1;
          return respond();
        },
      },
      /* 스텁은 앞의 것이 이긴다 — 기본 목록·`PUT` 규칙보다 먼저 둔다. */
      ...resourceMapRoutes(),
    ];
  };

  const conflict = () => jsonResponse({ conflictCause: 'user', message: '충돌' }, { status: 409 });
  const saved = () => jsonResponse(defaultRow, { headers: { ETag: '9' } });

  const listGets = (requests: RecordedRequest[]) =>
    requests.filter(
      (request) => request.method === 'GET' && request.url.pathname === RESOURCE_MAPS_PATH,
    );

  const rowWithText = (pane: HTMLElement, text: string): HTMLElement => {
    const row = within(pane)
      .getAllByRole('row')
      .find((item) => within(item).queryByText(text) !== null);
    if (row === undefined) throw new Error(`${text} 줄이 없습니다`);
    return row;
  };

  it('자동 배정 뒤 목록을 다시 받고 앞의 ★ 표시가 사라진다', async () => {
    const afterSetDefault = [
      { ...commonRow, isDefault: true, versionNo: commonRow.versionNo + 1 },
      { ...defaultRow, isDefault: false, versionNo: defaultRow.versionNo + 1 },
      inactiveRow,
    ];
    const { requests, user } = renderScreen(
      sequencedRoutes([itemResourceMapFixtures, afterSetDefault], [saved]),
      '?item=1001&tab=sub&sub=res',
    );

    const pane = await findResourceMapPane();
    const setDefault = await within(pane).findByRole('button', {
      name: '전체 공정 / SYN-MOLD-02 자동 배정 지정',
    });
    /* 자동 배정 줄이 맨 위로 뛰면 ★가 옮겨 간 것이 보이지 않는다 — 줄 순서는 그대로여야 한다. */
    const rowOrder = (): string[] =>
      within(pane)
        .getAllByRole('row')
        .slice(1)
        .map((row) =>
          within(row)
            .getAllByRole('cell')
            .slice(1, 4)
            .map((cell) => cell.textContent)
            .join(' | '),
        );
    const before = rowOrder();
    await user.click(setDefault);

    await waitFor(() => {
      expect(listGets(requests)).toHaveLength(2);
    });
    await waitFor(() => {
      expect(within(rowWithText(pane, 'SYN-EQ-01 · 합성 설비 A')).queryByText('★')).toBeNull();
    });
    expect(
      within(rowWithText(pane, 'SYN-MOLD-02 · 합성 금형 B')).getByText('★'),
    ).toBeInTheDocument();
    expect(rowOrder()).toEqual(before);
  });

  it('편집 창의 저장이 충돌하면 창에 안내가 나고, 최신 불러오기가 창을 닫고 목록을 다시 받는다', async () => {
    const { requests, user } = renderScreen(
      sequencedRoutes([itemResourceMapFixtures], [conflict]),
      '?item=1001&tab=sub&sub=res',
    );

    const pane = await findResourceMapPane();
    await user.click(
      await within(pane).findByRole('button', {
        name: 'SYN-PROC-01 · 합성 공정 가 / SYN-EQ-01 / SYN-MOLD-01 수정',
      }),
    );

    const dialog = await screen.findByRole('dialog', {
      name: '설비·금형 수정 · SYN-PLANT-01 · 합성 공장',
    });
    await user.clear(within(dialog).getByLabelText('비고'));
    await user.click(within(dialog).getByRole('button', { name: '저장' }));

    expect(
      await within(dialog).findByText(
        '다른 사용자가 먼저 저장했습니다. 최신 내용을 불러온 뒤 다시 저장하세요.',
      ),
    ).toBeInTheDocument();
    expect(listGets(requests)).toHaveLength(1);

    await user.click(within(dialog).getByRole('button', { name: '최신 불러오기' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(listGets(requests)).toHaveLength(2);
    });
  });

  it('줄 작업이 충돌하면 표 위에 안내가 나고, 다시 받은 뒤 같은 버튼은 새 판으로 나간다', async () => {
    const refreshed = [
      defaultRow,
      { ...commonRow, versionNo: commonRow.versionNo + 4 },
      inactiveRow,
    ];
    const { requests, user } = renderScreen(
      sequencedRoutes([itemResourceMapFixtures, refreshed], [conflict, saved]),
      '?item=1001&tab=sub&sub=res',
    );

    const pane = await findResourceMapPane();
    const setDefaultName = '전체 공정 / SYN-MOLD-02 자동 배정 지정';
    await user.click(await within(pane).findByRole('button', { name: setDefaultName }));

    expect(
      await within(pane).findByText(
        '다른 사용자가 먼저 저장했습니다. 최신 내용을 불러온 뒤 다시 저장하세요.',
      ),
    ).toBeInTheDocument();
    expect(resourceMapWrites(requests, 'PUT')[0]?.headers.get('If-Match')).toBe(
      String(commonRow.versionNo),
    );

    await user.click(within(pane).getByRole('button', { name: '최신 불러오기' }));

    await waitFor(() => {
      expect(listGets(requests)).toHaveLength(2);
    });
    await waitFor(() => {
      expect(within(pane).getByRole('button', { name: setDefaultName })).toBeEnabled();
    });

    await user.click(within(pane).getByRole('button', { name: setDefaultName }));

    await waitFor(() => {
      expect(resourceMapWrites(requests, 'PUT')).toHaveLength(2);
    });
    expect(resourceMapWrites(requests, 'PUT')[1]?.headers.get('If-Match')).toBe(
      String(commonRow.versionNo + 4),
    );
  });
});
