import { messages } from '@omf-mes/i18n';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
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
import {
  blindCountLineResponse,
  CLOSABLE_SUMMARY,
  countDetailBody,
  countFixtures,
  countLineFixtures,
  itemFixtures,
  LOCATION_ID,
  locationFixtures,
  lotFixtures,
  OPENED_COUNT_ID,
  OPENED_COUNT_NO,
  openedCountDetailBody,
  uomFixtures,
  warehouseFixtures,
} from './fixtures';
import { StocktakingScreen } from './screen';
import { OPEN_FIELD_NAMES } from './validation';

const t = messages.stocktaking;

/**
 * **값 목록이 확정된 뒤의 화면**을 이 파일에서 만들어 내기 위한 자리.
 *
 * 자리표시 상수는 지금 **비어 있고**(`code-options.test.ts`가 그 사실을 고정한다) 비어 있는
 * 동안에는 「실사 개시」가 통째로 잠긴다(승인 G1). 그런데 이 PR의 값어치는 **잠금이 풀린 뒤에
 * 무엇이 일어나는가**에 있다 — 요청에 무엇이 실리는지, 전송 중에 무엇이 닫히는지, 성공·실패가
 * 어떻게 보이는지는 배열이 채워진 상태에서만 확인할 수 있다.
 *
 * 그래서 **배열만 갈아 끼운다.** 판정·선택지 만들기·검증은 실물 그대로이고, 바뀌는 것은
 * 「값 목록이 왔다」는 사실 하나다 — 값 목록이 확정되면 실제로 그 한 가지만 달라진다.
 * 매 테스트 앞에서 빈 배열로 되돌려, 아무것도 채우지 않은 테스트는 **지금의 화면**을 본다.
 */
const { codeValues } = vi.hoisted(() => ({
  codeValues: {
    countType: [] as string[],
    status: [] as string[],
    varianceReason: [] as string[],
  },
}));

vi.mock('./code-options', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./code-options')>();

  return { ...actual, PLACEHOLDER_STOCKTAKING_CODES: codeValues };
});

/** 지어낸 합성 코드. **계약의 `@example` 값을 쓰지 않는다** — 예시가 확정 값으로 읽히면 안 된다. */
const SAMPLE_COUNT_TYPE = 'SAMPLE_COUNT_TYPE_D';

const clearCodeLists = (): void => {
  codeValues.countType = [];
  codeValues.status = [];
  codeValues.varianceReason = [];
};

/** 값 목록이 확정된 뒤. **배열만 채운다** — 다른 자리는 손대지 않는다. */
const fillCodeLists = (values: string[] = [SAMPLE_COUNT_TYPE]): void => {
  codeValues.countType = values;
};

beforeEach(clearCodeLists);

const ROUTE = '/logistics/stocktaking';
const LIST_PATH = '/inventory/counts';
const DETAIL_PATH = '/inventory/counts/9001';
const OTHER_DETAIL_PATH = '/inventory/counts/9003';
const OPENED_DETAIL_PATH = `/inventory/counts/${String(OPENED_COUNT_ID)}`;
const MISSING_DETAIL_PATH = '/inventory/counts/9999';
const WAREHOUSES_PATH = '/mdm/warehouses';

const LINES_PATH = '/inventory/counts/9001/lines';
const OTHER_LINES_PATH = '/inventory/counts/9003/lines';
const LOCATIONS_PATH = '/mdm/locations';
const ITEMS_PATH = '/mdm/items';
const UOMS_PATH = '/mdm/uoms';
const LOTS_PATH = '/trace/lots';

/**
 * 이 화면이 **PR ④에서** 부를 경로. **지금은 부르지 않는다** — 그것을 증명하려고 스텁을 둔다.
 *
 * 스텁을 두지 않으면 하네스가 던져 「부르지 않았다」와 「불렀는데 실패했다」가 구분되지 않는다.
 */
const CLOSE_PATH = '/inventory/counts/9001:close';

/**
 * **어느 실사의 것이든** 라인 경로. 번호 자리를 열어 두는 것이 요점이다 —
 * `enabled` 가드가 무너지면 `…/0/lines`·`…/undefined/lines`로 나가는데, `9001` 하나만 세는
 * 단언은 그것을 보지 못한다(PR ① 검증 담당의 승계 3 — 경로 접두 계수를 M33에 그대로 적용).
 */
const LINES_PATH_PATTERN = /^\/inventory\/counts\/[^/]+\/lines$/;

const WAREHOUSE_LABEL = 'SAMPLE-WH-01 · 합성 창고 가';
const INACTIVE_WAREHOUSE_LABEL = 'SAMPLE-WH-03 · 합성 창고 다';

/**
 * 화면 어디에도 나와서는 안 되는 내부 번호(FK).
 *
 * 픽스처의 번호 대역을 그대로 쓴다 — 업무 번호(`IC-2026-900011`)에 이 문자열이 부분으로
 * 들어가지 않도록 대역을 갈라 두었다.
 */
const INTERNAL_IDS = ['9001', '9002', '9003', '9101', '9102', '9103'];

interface RecordedRequest {
  method: string;
  url: URL;
  /**
   * **보낸 헤더를 그대로 담는다.** 「`If-Match`를 보내지 않는다」(C28)는 본문으로는 알 수
   * 없다 — 헤더가 실제로 어떻게 나갔는지 재는 자리가 여기뿐이다.
   */
  headers: Headers;
  /** 읽기에는 본문이 없다. 쓰기만 담는다. */
  body: unknown;
}

/**
 * 요청을 기록하면서 스텁 규칙으로 응답한다. 규칙에 없는 요청은 하네스가 던져 스텁 누락을 드러낸다.
 *
 * `hold`가 고른 요청은 **기록한 뒤에** 붙잡아 둔다 — 「기다리는 동안 무엇이 보이는가」를
 * 판정하려면 응답이 오기 전에 이미 기록돼 있어야 한다.
 *
 * **경로가 아니라 요청으로 고른다.** 실사 목록 조회와 개시가 **같은 경로**(`/inventory/counts`)를
 * 쓰므로 경로만으로 고르면 개시를 붙잡으려다 목록 조회까지 함께 멈춘다 — 그러면 「전송 중」을
 * 만들기 전에 화면이 그려지지 않는다.
 */
const createRecordingFetch = (
  routes: StubRoute[],
  hold: (request: Request) => boolean = () => false,
): { fetch: StubFetch; requests: RecordedRequest[]; release: () => void } => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch(routes);
  let release = (): void => {
    /* 아래 Promise 생성자가 곧바로 채운다. */
  };
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const fetch: StubFetch = async (request) => {
    /* 본문은 한 번만 읽을 수 있다 — 복제해 읽어야 스텁이 그대로 다시 읽을 수 있다. */
    const body: unknown = request.method === 'GET' ? null : await request.clone().json();

    requests.push({
      method: request.method,
      url: new URL(request.url),
      headers: new Headers(request.headers),
      body,
    });

    if (hold(request)) await gate;

    return stub(request);
  };

  return {
    fetch,
    requests,
    release: () => {
      release();
    },
  };
};

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const listBody = (
  items: unknown[],
  page: Partial<{ page: number; size: number; total: number }> = {},
) => ({ items, page: { page: 1, size: 50, total: items.length, ...page } });

const listRoute = (
  items: unknown[] = countFixtures,
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
 * 「목록 응답이 도착하면 고치던 값이 되돌아간다」는 결함이 드러나지 않는다.
 */
const changingListRoute = (): StubRoute => {
  let call = 0;

  return {
    match: (request) => isGet(request, LIST_PATH),
    respond: () => {
      call += 1;

      return jsonResponse(listBody(countFixtures, { total: countFixtures.length + call }));
    },
  };
};

const detailRoute = (
  pathname = DETAIL_PATH,
  body: unknown = countDetailBody(),
): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse(body),
});

/**
 * 9003의 상세. **9001과 값이 하나도 겹치지 않는다.**
 *
 * 겹치면 「다른 실사를 골랐는데 앞 실사의 요약이 그대로 보인다」를 값으로 가려낼 수 없다 —
 * 상세 캐시 키가 실사 번호를 잃으면 정확히 그 일이 난다.
 */
const OTHER_DETAIL_BODY = countDetailBody(
  {
    inventoryCountId: 9003,
    inventoryCountNo: 'IC-2026-900013',
    countTypeCode: 'SAMPLE_COUNT_TYPE_B',
    plannedDate: '2026-08-07',
  },
  { plannedCount: 12, countedCount: 7, uncountedCount: 5, varianceCount: 3 },
);

const missingDetailRoute = (): StubRoute => ({
  match: (request) => isGet(request, MISSING_DETAIL_PATH),
  respond: () => jsonResponse({ message: '' }, { status: 404 }),
});

const failingDetailRoute = (status = 500): StubRoute => ({
  match: (request) => isGet(request, DETAIL_PATH),
  respond: () => jsonResponse({ message: '' }, { status }),
});

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

const isOpenRequest = (request: Request): boolean =>
  request.method === 'POST' && new URL(request.url).pathname === LIST_PATH;

/** 개시 201 — 만들어진 실사가 **목록 셋 어디에도 없는 번호**로 온다. */
const openRoute = (): StubRoute => ({
  match: isOpenRequest,
  respond: () => jsonResponse(openedCountDetailBody(), { status: 201 }),
});

const failingOpenRoute = (status: number, body: unknown = { message: '' }): StubRoute => ({
  match: isOpenRequest,
  respond: () => jsonResponse(body, { status }),
});

/** 응답 자체가 오지 않는 갈래. **다시 보내면 전표가 두 벌 생기는** 유일한 실패다. */
const offlineOpenRoute = (): StubRoute => ({
  match: isOpenRequest,
  respond: () => {
    throw new TypeError('Failed to fetch');
  },
});

/**
 * 첫 개시는 되고 **둘째 개시가 막히는** 갈래.
 *
 * 결과 구획을 세운 **뒤에** 실패하는 순서를 만드는 유일한 수단이다 — 실패 테스트가 늘 빈
 * 화면에서 시작하면 「실패하면 결과 구획을 비운다」(수명 표 12행)가 아무것도 재지 못한다.
 */
const openThenForbiddenRoute = (): StubRoute => {
  let call = 0;

  return {
    match: isOpenRequest,
    respond: () => {
      call += 1;

      return call === 1
        ? jsonResponse(openedCountDetailBody(), { status: 201 })
        : jsonResponse({ message: '' }, { status: 403 });
    },
  };
};

/** 라인 목록 응답. `page.total`이 받은 건수보다 크면 **잘린 것**이다(계획 결정 8). */
const lineListBody = (items: unknown[], total = items.length) => ({
  items,
  page: { page: 1, size: 200, total },
});

const linesRoute = (
  pathname = LINES_PATH,
  items: unknown[] = countLineFixtures,
  total?: number,
): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse(lineListBody(items, total)),
});

/**
 * 부를 때마다 **줄 하나가 사라지는** 라인 목록.
 *
 * 「표에서 사라진 줄의 초안이 요청에 실리지 않는다」(감지기 M46)를 화면 수준에서 만드는 유일한
 * 수단이다 — 초안은 남아 있는데 표의 줄 집합만 줄어드는 상태가 그때 생긴다.
 */
/**
 * 부를 때마다 **내용이 달라지는** 라인 목록.
 *
 * 다시 부르기가 같은 본문을 돌려주면 캐시가 구조 공유로 **같은 참조를 그대로 유지**해,
 * 「라인 응답이 도착하면 치던 값이 되돌아간다」는 결함이 드러나지 않는다 — 되돌림 의존성에
 * 응답 배열을 넣어도 그 배열이 새 참조가 아니면 effect가 돌지 않기 때문이다.
 * 목록에서 같은 함정을 이미 한 번 밟았다(PR ①의 `changingListRoute`).
 *
 * **줄 집합은 그대로 두고 값만 바꾼다** — 줄이 사라지면 다른 규칙(사라진 줄 제외)이 함께 걸려
 * 무엇이 이 테스트를 죽였는지 가릴 수 없다.
 */
const changingLinesRoute = (): StubRoute => {
  let call = 0;

  return {
    match: (request) => isGet(request, LINES_PATH),
    respond: () => {
      call += 1;

      return jsonResponse(
        lineListBody(
          countLineFixtures.map((line) => ({ ...line, varianceQty: (line.varianceQty ?? 0) - call })),
        ),
      );
    },
  };
};

const shrinkingLinesRoute = (): StubRoute => {
  let call = 0;

  return {
    match: (request) => isGet(request, LINES_PATH),
    respond: () => {
      call += 1;

      return jsonResponse(lineListBody(call === 1 ? countLineFixtures : countLineFixtures.slice(0, 2)));
    },
  };
};

const locationsRoute = (
  items: unknown[] = locationFixtures,
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isGet(request, LOCATIONS_PATH),
  respond: () => jsonResponse(listBody(items, page)),
});

const failingLocationsRoute = (): StubRoute => ({
  match: (request) => isGet(request, LOCATIONS_PATH),
  respond: () => jsonResponse({ message: '' }, { status: 500 }),
});

const isReplaceRequest = (request: Request): boolean =>
  request.method === 'PUT' && LINES_PATH_PATTERN.test(new URL(request.url).pathname);

/** 치환 200 — **응답에 `ETag`가 없다**(실측). 그래서 성공 뒤 상세를 다시 읽는다. */
const replaceRoute = (items: unknown[] = countLineFixtures): StubRoute => ({
  match: isReplaceRequest,
  respond: () => jsonResponse(lineListBody(items)),
});

const failingReplaceRoute = (status: number, body: unknown = { message: '' }): StubRoute => ({
  match: isReplaceRequest,
  respond: () => jsonResponse(body, { status }),
});

const offlineReplaceRoute = (): StubRoute => ({
  match: isReplaceRequest,
  respond: () => {
    throw new TypeError('Failed to fetch');
  },
});

/**
 * 첫 저장은 되고 **둘째 저장이 막히는** 갈래.
 *
 * 결과 구획을 세운 **뒤에** 실패하는 순서를 만드는 유일한 수단이다 — 실패 테스트가 늘 빈
 * 화면에서 시작하면 「실패하면 결과 구획을 비운다」(수명 표 14행)가 아무것도 재지 못한다.
 */
const replaceThenForbiddenRoute = (): StubRoute => {
  let call = 0;

  return {
    match: isReplaceRequest,
    respond: () => {
      call += 1;

      return call === 1
        ? jsonResponse(lineListBody(countLineFixtures))
        : jsonResponse({ message: '' }, { status: 403 });
    },
  };
};

/** 라인 표가 이름을 내는 참조 셋. **위치를 고른 뒤에만 불린다.** */
const lineLookupRoutes = (): StubRoute[] => [
  { match: (request) => isGet(request, ITEMS_PATH), respond: () => jsonResponse(listBody(itemFixtures)) },
  { match: (request) => isGet(request, UOMS_PATH), respond: () => jsonResponse(listBody(uomFixtures)) },
  { match: (request) => isGet(request, LOTS_PATH), respond: () => jsonResponse(listBody(lotFixtures)) },
];

/** PR ④의 경로. **부를 수 있게 두는 것이 요점이다** — 부르지 않음을 증명할 수 있어야 한다. */
const closeRoute = (): StubRoute => ({
  match: (request) => request.method === 'POST' && new URL(request.url).pathname === CLOSE_PATH,
  respond: () => jsonResponse(countDetailBody()),
});

/** 이 화면이 닿을 수 있는 경로를 전부 스텁으로 둔 한 벌. */
const allRoutes = (extra: StubRoute[] = []): StubRoute[] => [
  ...extra,
  listRoute(),
  detailRoute(),
  detailRoute(OTHER_DETAIL_PATH, OTHER_DETAIL_BODY),
  /* 개시로 만들어진 실사의 상세 — `ct`가 그리로 옮겨 가면 곧바로 불린다. */
  detailRoute(OPENED_DETAIL_PATH, openedCountDetailBody()),
  missingDetailRoute(),
  warehousesRoute(),
  openRoute(),
  locationsRoute(),
  linesRoute(),
  linesRoute(OTHER_LINES_PATH, []),
  replaceRoute(),
  ...lineLookupRoutes(),
  closeRoute(),
];

/** 주소가 실제로 어떻게 바뀌는지 본다 — 수명 표를 판정할 유일한 근거다. */
const LocationProbe = () => {
  const location = useLocation();

  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

/**
 * **화면 바깥에서** 주소를 갈아 끼운다. 뒤로가기·앞으로가기·주소 직접 편집이 이 경로다 —
 * 셋 모두 화면의 클릭 핸들러를 거치지 않고 검색 파라미터만 바뀐다.
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
  hold: (request: Request) => boolean = () => false,
): {
  requests: RecordedRequest[];
  release: () => void;
  user: ReturnType<typeof userEvent.setup>;
} => {
  const { fetch, requests, release } = createRecordingFetch(routes, hold);

  renderWithProviders(
    <>
      <StocktakingScreen />
      <LocationProbe />
      <BackProbe />
      <SearchProbe to={navigateTo} />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, release, user: userEvent.setup() };
};

const requestsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === pathname);

/**
 * **한 실사에 매달린 경로로 나간 요청 전부.** 경로 하나만 세면 **잘못된 번호로 나간 요청이
 * 「부르지 않았다」를 통과한다** — `enabled` 가드가 무너지면 번호 자리에 `0`이나 `undefined`가
 * 박힌 경로로 나가는데, `/inventory/counts/9001`만 세는 단언은 그것을 보지 못한다.
 *
 * 계획 §5.2가 「요청 계수는 경로 전체를 센다」로 못 박은 자리이고, M13이 이미 그 형태로
 * 구현돼 있다 — M18도 같은 잣대를 쓴다. 접두에는 상세·라인·마감이 모두 걸리며,
 * 이 PR에서는 셋 다 0이어야 하므로 더 엄한 잣대가 맞다.
 */
const COUNT_SCOPED_PREFIX = '/inventory/counts/';

const countScopedRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname.startsWith(COUNT_SCOPED_PREFIX));

const lastQuery = (requests: RecordedRequest[], pathname: string): URLSearchParams | undefined =>
  requestsTo(requests, pathname).at(-1)?.url.searchParams;

const currentLocation = (): string => screen.getByTestId('location').textContent ?? '';

const listTable = (): HTMLElement => screen.getByRole('table');

/**
 * 구획별 조회기.
 *
 * **PR ②부터 같은 이름의 칸이 두 자리에 선다** — 조건 줄의 「창고」·「실사 유형」은 **좁히는
 * 조건**이고 개시 구획의 그것은 **만들 값**이다. 화면 전체에서 이름으로 찾으면 둘이 섞여,
 * 조건을 검사하는 단언이 개시 폼을 보고 통과할 수 있다.
 */
const listPane = (): HTMLElement => screen.getByRole('region', { name: t.panes.list });

const openPane = (): HTMLElement => screen.getByRole('region', { name: t.panes.open });

const detailPane = (): HTMLElement => screen.getByRole('region', { name: t.panes.detail });

const summaryGroup = (): HTMLElement =>
  screen.getByRole('group', { name: t.detail.summaryLabel });

const selectCount = async (
  user: ReturnType<typeof userEvent.setup>,
  inventoryCountNo: string,
): Promise<void> => {
  await user.click(screen.getByRole('button', { name: t.actions.selectRow(inventoryCountNo) }));
};

/**
 * 첫 목록이 그려질 때까지 기다린다. 이 뒤라야 「무엇이 바뀌었는가」를 잴 수 있다.
 *
 * `findAll`을 쓴다 — 고른 실사가 있으면 같은 실사번호가 표와 제목줄에 **둘** 나온다.
 */
const waitForList = async (): Promise<void> => {
  await screen.findAllByText('IC-2026-900011');
};

/**
 * **개시 요청만 센다.** 목록 조회와 **경로가 같으므로**(`/inventory/counts`) 경로만 세면
 * 첫 진입의 GET이 「개시가 나갔다」로 읽힌다 — 요청 0회를 증명하는 단언이 전부 무너진다.
 */
const openRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.method === 'POST' && request.url.pathname === LIST_PATH);

const openButton = (): HTMLElement =>
  within(openPane()).getByRole('button', { name: t.actions.open });

const confirmDialog = (): HTMLElement => screen.getByRole('dialog');

const chooseOption = async (
  user: ReturnType<typeof userEvent.setup>,
  pane: HTMLElement,
  label: string,
  option: string,
): Promise<void> => {
  await user.click(within(pane).getByLabelText(label));
  await user.click(screen.getByRole('option', { name: option }));
};

/** 개시할 수 있는 상태까지 채운다. **값 목록이 채워진 뒤에만 쓸 수 있다**(그전에는 고를 것이 없다). */
const fillOpenDraft = async (
  user: ReturnType<typeof userEvent.setup>,
  plannedDate = '2026-08-12',
): Promise<void> => {
  await chooseOption(user, openPane(), t.fields.countType, SAMPLE_COUNT_TYPE);
  await chooseOption(user, openPane(), t.fields.warehouse, WAREHOUSE_LABEL);

  if (plannedDate !== '') {
    await user.type(within(openPane()).getByLabelText(t.fields.plannedDate), plannedDate);
  }
};

/** 값 목록을 채우고 화면을 띄운 뒤 개시할 수 있는 상태까지 만든다. */
const setupReadyToOpen = async (
  routes: StubRoute[] = allRoutes(),
  search = '',
  navigateTo = '',
  hold: (request: Request) => boolean = () => false,
) => {
  fillCodeLists();

  const rendered = renderScreen(routes, search, navigateTo, hold);

  await waitForList();
  await fillOpenDraft(rendered.user);

  return rendered;
};

/* ── PR ③ — 결과 등록 ──────────────────────────────────────────────────────── */

const SAMPLE_REASON = 'SAMPLE_VARIANCE_REASON_D';

const LOCATION_LABEL = 'SAMPLE-LOC-01 · 합성 위치 가';

/** 참조가 푸는 단위 이름. **「코드 · 이름」**이라 부품 테스트가 주는 짧은 라벨과 다르다. */
const UOM_LABEL = 'SAMPLE-EA · 합성 단위 개';

/** 실사 9001과 위치 9701을 고른 상태의 주소. 라인 표가 열리는 최소 조건이다. */
const AT_LOCATION = `?ct=9001&loc=${String(LOCATION_ID)}`;

/** 값 목록이 확정된 뒤의 차이 사유. **배열만 갈아 끼운다** — 다른 자리는 실물 그대로다. */
const fillReasonList = (values: string[] = [SAMPLE_REASON]): void => {
  codeValues.varianceReason = values;
};

/** 라인 경로로 나간 요청 전부 — **번호 자리를 열어 둔다**(승계 3). */
const lineRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => LINES_PATH_PATTERN.test(request.url.pathname));

const replaceRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  lineRequests(requests).filter((request) => request.method === 'PUT');

const lineTable = (): HTMLElement =>
  within(detailPane()).getAllByRole('table').at(-1) ?? screen.getByRole('table');

const qtyField = (lineNo: number): HTMLElement =>
  screen.getByLabelText(t.lineTable.countedQtyLabel(lineNo));

const saveButton = (): HTMLElement =>
  within(detailPane()).getByRole('button', { name: t.actions.saveLocation });

/** 라인 표가 그려질 때까지 기다린다. 이 뒤라야 표 안 입력을 잴 수 있다. */
const waitForLines = async (): Promise<void> => {
  await screen.findByLabelText(t.lineTable.countedQtyLabel(1));
};

/** 그 위치의 전 줄을 **장부와 같은 수량**으로 채운다 — 차이가 없는 위치의 정상 경로다. */
const fillAllQty = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.type(qtyField(1), '100');
  await user.type(qtyField(2), '40');
  await user.type(qtyField(3), '7');
};

/** 위치를 고른 상태로 화면을 띄우고 라인 표까지 기다린다. */
const setupAtLocation = async (
  routes: StubRoute[] = allRoutes(),
  search = AT_LOCATION,
  navigateTo = '',
  hold: (request: Request) => boolean = () => false,
) => {
  const rendered = renderScreen(routes, search, navigateTo, hold);

  await waitForLines();

  return rendered;
};

/* ── PR ④ — 마감·노출 ─────────────────────────────────────────────────────── */

/** 실사 9001을 고른 상태의 주소. 마감 액션이 서는 최소 조건이다(위치는 필요 없다). */
const AT_COUNT = '?ct=9001';

/**
 * 상세가 남기는 **낙관적 잠금 토큰**.
 *
 * 마감은 `If-Match`가 **필수**라(실측 — 목이 토큰 없는 마감을 400으로 되돌린다) 토큰이 없으면
 * 공통 훅이 보내지 않고 멈춘다. 그 갈래를 따로 재려면 **토큰이 있는 판이 기본**이어야 한다.
 */
const DETAIL_ETAG = '"7"';

/** 마감 성공 응답의 상태 코드. **상세와 다른 값**이라 「응답이 준 값을 그대로 낸다」가 관측된다. */
const CLOSED_STATUS = 'SAMPLE_COUNT_STATUS_D';

/**
 * **마감할 수 있는** 상세 + 토큰. 미실사와 차이가 둘 다 0이라야 마감이 열린다(승인 13-6).
 *
 * 기본 상세(15/6)는 마감이 잠긴 판이라 이 화면의 **보통 상태**이고, 이 라우트가 그 예외다.
 */
const closableDetailRoute = (
  pathname = DETAIL_PATH,
  summary: Record<string, unknown> = CLOSABLE_SUMMARY,
  count: Record<string, unknown> = {},
): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () =>
    jsonResponse(countDetailBody(count, summary), { headers: { ETag: DETAIL_ETAG } }),
});

/**
 * **어느 실사의 것이든** 마감 경로. 번호 자리를 열어 두는 것이 요점이다 —
 * `9001` 하나만 세는 단언은 잘못된 번호로 나간 마감을 「부르지 않았다」로 통과시킨다(승계 3).
 */
const CLOSE_PATH_PATTERN = /^\/inventory\/counts\/[^/]+:close$/;

const isCloseRequest = (request: Request): boolean =>
  request.method === 'POST' && CLOSE_PATH_PATTERN.test(new URL(request.url).pathname);

const closeRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter(
    (request) => request.method === 'POST' && CLOSE_PATH_PATTERN.test(request.url.pathname),
  );

/**
 * 마감 200 — **응답에 `ETag`가 없고 상태 코드가 상세와 다르다**(둘 다 실측).
 *
 * 목 서버의 `:close` 200이 `IN_PROGRESS`를 되돌려 주는 것이 「값으로 마감됨을 판정하지
 * 않는다」의 실측 근거다(계획 결정 12). 여기서는 합성 코드로 같은 상황을 만든다.
 */
const closingRoute = (): StubRoute => ({
  match: isCloseRequest,
  respond: () => jsonResponse(countDetailBody({ statusCode: CLOSED_STATUS }, CLOSABLE_SUMMARY)),
});

const failingCloseRoute = (status: number, body: unknown = { message: '' }): StubRoute => ({
  match: isCloseRequest,
  respond: () => jsonResponse(body, { status }),
});

const offlineCloseRoute = (): StubRoute => ({
  match: isCloseRequest,
  respond: () => {
    throw new TypeError('Failed to fetch');
  },
});

const closeButton = (): HTMLElement =>
  within(detailPane()).getByRole('button', { name: t.actions.close });

const closedRegion = (): HTMLElement => screen.getByRole('status', { name: t.result.closedLabel });

/** 마감할 수 있는 실사를 고른 상태로 화면을 띄우고 요약 4칸까지 기다린다. */
const setupClosable = async (
  routes: StubRoute[] = allRoutes([closableDetailRoute(), closingRoute()]),
  search = AT_COUNT,
  navigateTo = '',
  hold: (request: Request) => boolean = () => false,
) => {
  const rendered = renderScreen(routes, search, navigateTo, hold);

  await waitForList();
  await screen.findByRole('group', { name: t.detail.summaryLabel });

  return rendered;
};

/** 확인 창까지 거쳐 마감을 실제로 보낸다. */
const closeCount = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(closeButton());
  await user.click(screen.getByRole('button', { name: t.actions.confirmClose }));
};

describe('StocktakingScreen — 첫 진입 조회', () => {
  /*
   * **M01** — 기본 기간을 심으면 첫 요청에 날짜가 실리고, 사용자는 왜 그 기간만 보이는지
   * 화면 어디에서도 읽을 수 없다(W-01-09가 세운 규칙).
   */
  it('목록 요청이 1회 나가고 조건이 하나도 실리지 않는다', async () => {
    const { requests } = renderScreen(allRoutes());

    await waitForList();

    const list = requestsTo(requests, LIST_PATH);

    expect(list).toHaveLength(1);
    expect(list[0]?.url.searchParams.has('plannedDateFrom')).toBe(false);
    expect(list[0]?.url.searchParams.has('plannedDateTo')).toBe(false);
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

    expect(within(listTable()).getAllByRole('row')).toHaveLength(countFixtures.length + 1);
    expect(screen.queryByText(messages.httpError.loadTitle)).not.toBeInTheDocument();
  });

  /** 창고는 목록 표의 칸이 곧바로 쓰는 이름이라 첫 진입에 함께 받는다. */
  it('창고 목록을 1회 조회하고 미사용까지 받는다', async () => {
    const { requests } = renderScreen(allRoutes());

    await waitForList();

    const warehouses = requestsTo(requests, WAREHOUSES_PATH);

    expect(warehouses).toHaveLength(1);
    expect(warehouses[0]?.url.searchParams.get('includeInactive')).toBe('true');
  });

  /*
   * **M18** — 고른 실사가 없으면 상세를 부를 대상이 없다. `enabled`와 가드를 없애면 번호 자리에
   * `0`이 박힌 경로로 요청이 나간다 — **경로 하나만 세면 그 요청이 「부르지 않았다」를 통과한다.**
   * 그래서 실사에 매달린 경로 전체를 센다(계획 §5.2 · M13과 같은 잣대).
   */
  it('고르지 않았으면 실사에 매달린 어떤 경로도 부르지 않는다', async () => {
    const { requests } = renderScreen(allRoutes());

    await waitForList();

    expect(countScopedRequests(requests)).toHaveLength(0);
    /* 짝 방향 — 목록은 실제로 불렀다(아무 요청도 안 나가서 통과하는 것이 아니다). */
    expect(requestsTo(requests, LIST_PATH)).toHaveLength(1);
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  /*
   * **M13** — **조회하고 고르기만 해서는 어떤 쓰기도 나가지 않는다.** 쓰기 셋과 라인·위치
   * 경로를 스텁으로 두고, **기록된 모든 요청**의 method가 GET인지 본다. 경로 하나만 세면
   * 잘못된 경로로 나간 요청이 「부르지 않았다」를 통과한다.
   *
   * PR ②·③에서 쓰기 둘이 붙었으나 개시는 **확인 창을 거쳐야** 나가고 치환은 **전 줄을 채워야**
   * 나간다 — 이 흐름에는 그 조작이 없으므로 여전히 전부 읽기여야 한다.
   *
   * **잣대를 「0」에서 「의도한 경로만」으로 옮기되 접두 계수를 버리지 않는다**(PR ① 검증 담당의
   * 승계 4). PR ③이 위치 조회를 실제로 부르기 시작해 「위치 경로 0회」는 더 이상 성립하지
   * 않는데, 그때 **경로 하나 세기로 되돌아가면** M-3이 재발한다 — 나간 경로의 **집합**을 통째로
   * 견줘 의도하지 않은 경로가 하나라도 늘면 걸리게 둔다.
   */
  it('어떤 쓰기 요청도 보내지 않고 의도한 경로만 부른다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await waitForList();
    await selectCount(user, 'IC-2026-900011');
    await screen.findByRole('group', { name: t.detail.summaryLabel });
    await screen.findByLabelText(t.fields.location);

    expect(requests).not.toHaveLength(0);
    expect(requests.map((request) => request.method)).toEqual(requests.map(() => 'GET'));

    /* 나간 경로의 집합 그대로. 실사에 매달린 것은 **상세 하나**뿐이다. */
    expect([...new Set(requests.map((request) => request.url.pathname))].sort()).toEqual([
      LIST_PATH,
      DETAIL_PATH,
      LOCATIONS_PATH,
      WAREHOUSES_PATH,
    ].sort());

    /* 짝 방향 — 위치는 실제로 불렀다(부르지 않아서 통과하는 것이 아니다). */
    expect(requestsTo(requests, LOCATIONS_PATH)).toHaveLength(1);
    expect(countScopedRequests(requests).map((request) => request.url.pathname)).toEqual([
      DETAIL_PATH,
    ]);
  });

  /*
   * **C14** — 값 목록이 확정되지 않아 조건의 실사 유형·상태 선택지가 비어 있다.
   * 화면 수준에서도 그 안내가 실제로 붙는지 본다.
   */
  it('실사 유형·상태 선택지가 비어 있고 안내가 붙는다', async () => {
    renderScreen(allRoutes());

    await waitForList();

    /* **조건 줄 안에서만 센다** — 개시 구획의 실사 유형에도 같은 안내가 붙는다(별개의 자리다). */
    expect(within(listPane()).getAllByText(messages.pendingCode.note)).toHaveLength(2);
  });
});

describe('StocktakingScreen — 조건과 주소', () => {
  /* **M02** — 조건을 컴포넌트 상태로만 들고 있으면 새로고침·공유가 같은 결과를 내지 못한다. */
  it('조건을 걸면 주소와 요청에 함께 실린다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await waitForList();

    await user.click(screen.getByRole('checkbox', { name: t.fields.inProgressOnly }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?prog=1`);
    });

    await waitFor(() => {
      expect(lastQuery(requests, LIST_PATH)?.get('inProgressOnly')).toBe('true');
    });
  });

  /* **C03** — 그 주소로 다시 들어가면 같은 조건으로 조회한다. */
  it('주소로 들어가면 그 조건으로 조회한다', async () => {
    const { requests } = renderScreen(
      allRoutes(),
      '?wh=9101&from=2026-08-01&to=2026-08-31&ty=SAMPLE_COUNT_TYPE_A&st=SAMPLE_COUNT_STATUS_A&prog=1',
    );

    await waitForList();

    const query = lastQuery(requests, LIST_PATH);

    expect(query?.get('warehouseId')).toBe('9101');
    expect(query?.get('plannedDateFrom')).toBe('2026-08-01');
    expect(query?.get('plannedDateTo')).toBe('2026-08-31');
    expect(query?.get('countTypeCode')).toBe('SAMPLE_COUNT_TYPE_A');
    expect(query?.get('statusCode')).toBe('SAMPLE_COUNT_STATUS_A');
    expect(query?.get('inProgressOnly')).toBe('true');
  });

  /*
   * **C06** — 주소는 손으로 고쳐지는 자리다. 정수가 아닌 번호를 그대로 실으면 `NaN`이 요청에
   * 실려 조회 전체가 실패하는데, 사용자에게는 「조회가 늘 안 된다」로만 보인다.
   */
  it('이상한 주소값을 요청에 싣지 않는다', async () => {
    const { requests } = renderScreen(allRoutes(), '?wh=abc&page=0&ct=xyz&loc=0&prog=maybe');

    await waitForList();

    const query = lastQuery(requests, LIST_PATH);

    expect([...(query?.keys() ?? [])]).toEqual([]);
    /* 짝 방향 — 고르지 않은 것으로 읽혀 상세도 부르지 않는다. */
    expect(requests.filter((request) => request.url.pathname.startsWith('/inventory/counts/'))).toHaveLength(0);
  });

  /*
   * **M04** — 조건이 바뀌면 고른 실사가 새 결과에 없을 수 있다. `page`·`ct`·`loc`를 남기면
   * 아래 구획이 없는 실사를 가리킨 채 주소만 남는다(수명 표 1행).
   */
  it('조건 변경이 첫 쪽으로 되돌리고 고른 실사·위치를 비운다', async () => {
    const { user } = renderScreen(allRoutes(), '?page=2&ct=9001&loc=9701');

    await waitForList();

    await user.click(screen.getByRole('checkbox', { name: t.fields.inProgressOnly }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?prog=1`);
    });
  });

  it('초기화가 조건과 선택을 모두 비운다', async () => {
    const { user } = renderScreen(allRoutes(), '?wh=9101&prog=1&page=3&ct=9001&loc=9701');

    await waitForList();

    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  /*
   * **M03** — 조건과 쪽을 따로 갱신하면 뒤로가기 기록이 두 칸 늘어, 뒤로 눌렀는데 같은 자리로
   * 돌아온 것처럼 보인다. 한 칸 뒤로 갔을 때 **처음 주소**로 돌아오는지가 그 잣대다.
   */
  it('조작당 주소 갱신이 1회다', async () => {
    const { user } = renderScreen(allRoutes(), '?page=2');

    await waitForList();

    await user.click(screen.getByRole('checkbox', { name: t.fields.inProgressOnly }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?prog=1`);
    });

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?page=2`);
    });
  });

  /* **M15** — 고치는 동안 주소가 바뀌면 글자마다 뒤로가기 기록이 쌓이고 요청도 그만큼 나간다. */
  it('조건을 고치는 동안에는 주소가 바뀌지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await waitForList();

    const before = requestsTo(requests, LIST_PATH).length;

    await user.click(screen.getByRole('checkbox', { name: t.fields.inProgressOnly }));

    expect(currentLocation()).toBe(ROUTE);
    expect(requestsTo(requests, LIST_PATH)).toHaveLength(before);
  });

  /*
   * **M14** — 목록 응답이 도착할 때마다 조건 줄을 되돌리면 사용자가 고르던 값이 사라진다(#43).
   * 응답 본문이 매번 달라 캐시가 새 참조를 내려 주는 상태에서 검사한다.
   */
  it('목록이 다시 도착해도 고치던 조건이 사라지지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes([changingListRoute()]));

    await waitForList();

    await user.click(screen.getByRole('checkbox', { name: t.fields.inProgressOnly }));

    const before = requestsTo(requests, LIST_PATH).length;

    await user.click(screen.getByRole('button', { name: t.actions.refresh }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(before);
    });

    expect(screen.getByRole('checkbox', { name: t.fields.inProgressOnly })).toBeChecked();
  });
});

describe('StocktakingScreen — 쪽 이동', () => {
  /* **M05** — 쪽이 바뀌면 보이는 행이 통째로 달라진다. 고른 실사를 남기면 그 실사가 화면에 없다. */
  it('쪽 이동이 쪽만 옮기고 고른 실사·위치를 비운다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([listRoute(countFixtures, { total: 120 })]),
      '?wh=9101&ct=9001&loc=9701',
    );

    await waitForList();

    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?wh=9101&page=2`);
    });

    await waitFor(() => {
      expect(lastQuery(requests, LIST_PATH)?.get('page')).toBe('2');
    });
  });

  it('쪽 밖이면 첫 쪽 안내를 내고 첫 쪽으로 되돌린다', async () => {
    const { user } = renderScreen(allRoutes([listRoute([], { page: 3, total: 10 })]), '?page=3');

    await screen.findByText(t.empty.beyondLastTitle);

    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  /* **C07** — 결과가 없는 것과 쪽 밖인 것은 사용자가 할 조치가 다르다. */
  it('결과가 없으면 조건을 줄이라고 안내한다', async () => {
    renderScreen(allRoutes([listRoute([])]));

    await screen.findByText(t.empty.noResultTitle);

    expect(screen.queryByText(t.empty.beyondLastTitle)).not.toBeInTheDocument();
  });
});

describe('StocktakingScreen — 조회 실패', () => {
  /*
   * **M07** — 실패를 「없습니다」로 내면 사용자가 자료가 없는 줄 알고 조건을 넓힌다.
   * 실제로는 조회 자체가 되지 않은 것이라 무엇을 해도 결과가 같다.
   */
  it('조회 실패는 배너로 내고 빈 상태 문구를 함께 내지 않는다', async () => {
    renderScreen(allRoutes([failingListRoute(500)]));

    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.beyondLastTitle)).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('권한이 없으면 다시 시도를 내지 않는다', async () => {
    renderScreen(allRoutes([failingListRoute(403)]));

    await screen.findByText(messages.httpError.forbidden);

    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  /* **M09** — 버튼만 두고 다시 부르기를 잇지 않으면 눌러도 아무 일이 없다. 요청 수로 잰다. */
  it('다시 시도를 누르면 그 경로의 요청 수가 는다', async () => {
    const { requests, user } = renderScreen(allRoutes([failingListRoute(500)]));

    await screen.findByText(messages.httpError.loadTitle);

    const before = requestsTo(requests, LIST_PATH).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(before);
    });
  });
});

describe('StocktakingScreen — 실사 고르기와 요약', () => {
  /*
   * **C10** — 고르면 상세를 1회 부르고, 요약 4칸은 **서버가 준 숫자 그대로**다.
   * 라인을 부르지 않는다는 것이 「화면이 세지 않는다」의 구조적 근거다.
   */
  it('실사를 고르면 상세를 1회 부르고 요약 4칸을 그대로 보인다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await waitForList();
    await selectCount(user, 'IC-2026-900011');

    const summary = await screen.findByRole('group', { name: t.detail.summaryLabel });

    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(1);
    expect(within(summary).getByText('40')).toBeInTheDocument();
    expect(within(summary).getByText('25')).toBeInTheDocument();
    expect(within(summary).getByText('15')).toBeInTheDocument();
    expect(within(summary).getByText('6')).toBeInTheDocument();
    expect(requestsTo(requests, LINES_PATH)).toHaveLength(0);
  });

  /*
   * **고른 실사마다 상세 캐시가 갈린다.** 캐시 키가 실사 번호를 잃으면 다른 실사를 골라도
   * ①새 요청이 나가지 않고 ②앞 실사의 요약 4칸이 그대로 남는다 — 그 숫자가 마감 가능
   * 여부를 정하는 값이라(PR ④) 낡은 채로 남으면 **다른 실사의 요약을 보고 마감을 판단**하게 된다.
   *
   * 두 방향을 함께 단언한다 — 요청이 실제로 나갔는가, 그리고 **그 응답의 값이 보이는가.**
   */
  it('다른 실사를 고르면 그 실사를 새로 부르고 요약이 바뀐다', async () => {
    const { requests, user } = renderScreen(allRoutes(), '?ct=9001');

    await screen.findByRole('group', { name: t.detail.summaryLabel });

    expect(within(summaryGroup()).getByText('40')).toBeInTheDocument();

    await selectCount(user, 'IC-2026-900013');

    await waitFor(() => {
      expect(requestsTo(requests, OTHER_DETAIL_PATH)).toHaveLength(1);
    });

    await waitFor(() => {
      expect(within(summaryGroup()).getByText('12')).toBeInTheDocument();
    });

    const summary = summaryGroup();

    expect(within(summary).getByText('7')).toBeInTheDocument();
    expect(within(summary).getByText('5')).toBeInTheDocument();
    expect(within(summary).getByText('3')).toBeInTheDocument();
    /* 앞 실사의 숫자가 한 칸이라도 남아 있으면 안 된다. */
    expect(within(summary).queryByText('40')).not.toBeInTheDocument();
    expect(within(summary).queryByText('25')).not.toBeInTheDocument();
  });

  it('고르면 주소에 실사 번호가 실리고 쪽이 유지된다', async () => {
    const { user } = renderScreen(allRoutes([listRoute(countFixtures, { total: 120 })]), '?page=2');

    await waitForList();
    await selectCount(user, 'IC-2026-900011');

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?page=2&ct=9001`);
    });
  });

  it('다시 누르면 선택이 풀리고 아래 구획이 닫힌다', async () => {
    const { user } = renderScreen(allRoutes(), '?ct=9001');

    await screen.findByRole('group', { name: t.detail.summaryLabel });

    await user.click(
      screen.getByRole('button', { name: t.actions.deselectRow('IC-2026-900011') }),
    );

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });

    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  /*
   * **S1의 근거가 목록 소속이 아니라 상세 200이다**(계획 결정 2). 목록 소속으로 판정하면
   * 조건이 좁아 목록에 없는 실사를 고른 상태가 지워진다 — 개시 직후(PR ②)에 그 일이 실제로 난다.
   */
  it('목록에 없는 실사도 상세가 200이면 열린다', async () => {
    renderScreen(allRoutes([listRoute([])]), '?ct=9001');

    await screen.findByRole('group', { name: t.detail.summaryLabel });

    expect(screen.getByText(t.empty.noResultTitle)).toBeInTheDocument();
    expect(currentLocation()).toBe(`${ROUTE}?ct=9001`);
  });

  it('상세 조회가 404가 아닌 실패면 배너와 다시 시도를 낸다', async () => {
    const { requests, user } = renderScreen(allRoutes([failingDetailRoute(500)]), '?ct=9001');

    await screen.findByText(messages.httpError.loadTitle);

    const before = requestsTo(requests, DETAIL_PATH).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, DETAIL_PATH).length).toBeGreaterThan(before);
    });
    /* 고른 실사를 주소에서 지우지 않는다 — 다시 시도로 풀릴 수 있는 실패다. */
    expect(currentLocation()).toBe(`${ROUTE}?ct=9001`);
  });

  /* **C18** — 블라인드 여부와 상태 코드가 제목줄에서 읽힌다. */
  it('제목줄이 블라인드와 상태 코드를 읽히는 값으로 보인다', async () => {
    renderScreen(
      allRoutes([detailRoute(DETAIL_PATH, countDetailBody({ blindCount: true }))]),
      '?ct=9001',
    );

    const heading = await screen.findByRole('group', { name: t.detail.label });

    expect(within(heading).getByText('예')).toBeInTheDocument();
    expect(within(heading).getByText('SAMPLE_COUNT_STATUS_A')).toBeInTheDocument();
    expect(screen.getByText(t.detail.blindNote)).toBeInTheDocument();
  });
});

describe('StocktakingScreen — 참조 풀이', () => {
  /*
   * **M10 · #47** — 참조가 본 조회보다 늦게 오는 순간이 실제로 있다. 그때 「알 수 없음」을 내면
   * *값이 잘못됐다*는 뜻이 되어 사용자에게 반대로 읽힌다.
   */
  it('참조가 아직 오지 않았으면 알 수 없음으로 내지 않는다', async () => {
    const { release } = renderScreen(allRoutes(), '', '', (request) =>
      isGet(request, WAREHOUSES_PATH),
    );

    await waitForList();

    expect(screen.getAllByText(t.values.referenceLoading)).toHaveLength(countFixtures.length);
    expect(screen.queryByText(t.values.unknown)).not.toBeInTheDocument();

    release();

    await screen.findAllByText(WAREHOUSE_LABEL);
  });

  /*
   * **M11 · #44** — 이름을 못 풀어도 번호를 내지 않는다. 9002의 창고(9102)는 참조 목록에 없다.
   * 짝 방향으로 「이름이 보인다」를 함께 단언한다 — 아무것도 안 그려도 통과하지 않게.
   */
  it('이름을 못 풀어도 화면 어디에도 내부 번호가 없다', async () => {
    const { user } = renderScreen(allRoutes());

    await waitForList();
    await selectCount(user, 'IC-2026-900011');
    await screen.findByRole('group', { name: t.detail.summaryLabel });

    /* 표의 두 줄(9001·9003)과 제목줄 하나 — 건수를 못 박아야 「이름이 보인다」가 실제 단언이 된다. */
    expect(screen.getAllByText(WAREHOUSE_LABEL)).toHaveLength(3);
    expect(screen.getByText(t.values.unknown)).toBeInTheDocument();

    const panes = [
      screen.getByRole('region', { name: t.panes.list }),
      screen.getByRole('region', { name: t.panes.detail }),
    ];

    for (const pane of panes) {
      for (const id of INTERNAL_IDS) {
        expect(pane.textContent ?? '').not.toContain(id);
      }
    }
  });

  /*
   * **C12** — 목록이 앞쪽만 오면 고를 수 없는 값이 생기는데, 밝히지 않으면 사용자가
   * 「그런 창고가 없다」로 결론짓는다.
   */
  it('창고 목록이 잘리면 그 사실을 밝힌다', async () => {
    renderScreen(allRoutes([warehousesRoute({ total: 40 })]));

    await waitForList();

    /*
     * **창고를 고르는 자리가 둘이라 둘 다 밝혀야 한다**(PR ②에서 개시 구획이 붙었다).
     * 한쪽만 밝히면 다른 쪽에서는 찾는 창고가 없는 것이 「그런 창고가 없다」로 읽힌다 —
     * 개시 쪽에서 그렇게 읽히면 사용자는 엉뚱한 창고로 되돌릴 수 없는 실사를 만든다.
     */
    expect(within(listPane()).getByText(t.filters.lookupTruncated)).toBeInTheDocument();
    expect(within(openPane()).getByText(t.filters.lookupTruncated)).toBeInTheDocument();
  });

  it('참조 조회가 실패하면 사유를 내고 다시 시도가 요청을 늘린다', async () => {
    const { requests, user } = renderScreen(allRoutes([failingWarehousesRoute()]));

    await waitForList();

    expect(screen.getByText(t.reasons.warehouseReferenceFailed)).toBeInTheDocument();

    const before = requestsTo(requests, WAREHOUSES_PATH).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, WAREHOUSES_PATH).length).toBeGreaterThan(before);
    });
  });

  /** 미사용 창고를 선택지에서 빼지 않고 표식만 붙인다 — 빼면 그 실사를 찾을 방법이 사라진다. */
  it('미사용 창고를 선택지에 남기고 표식을 붙인다', async () => {
    const { user } = renderScreen(allRoutes());

    await waitForList();

    await user.click(within(listPane()).getByLabelText(t.fields.warehouse));

    expect(
      screen.getByText(`${INACTIVE_WAREHOUSE_LABEL}${t.values.inactiveSuffix}`),
    ).toBeInTheDocument();
  });
});

describe('StocktakingScreen — 다시 조회', () => {
  /*
   * **M17** — 목록만 다시 부르면 요약 4칸이 낡은 채로 남아 갱신된 값과 갱신되지 않은 값이
   * 한 화면에 섞인다(W-01-07의 Major 지적). 요약은 마감 가능 여부를 정하는 값이라(PR ④)
   * 낡으면 그 판단 자체가 낡는다.
   */
  it('고른 실사가 있으면 목록과 상세를 함께 다시 부른다', async () => {
    const { requests, user } = renderScreen(allRoutes(), '?ct=9001');

    await screen.findByRole('group', { name: t.detail.summaryLabel });

    const listBefore = requestsTo(requests, LIST_PATH).length;
    const detailBefore = requestsTo(requests, DETAIL_PATH).length;
    const before = currentLocation();

    await user.click(screen.getByRole('button', { name: t.actions.refresh }));

    await waitFor(() => {
      expect(requestsTo(requests, DETAIL_PATH).length).toBeGreaterThan(detailBefore);
    });

    expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(listBefore);
    /* 다시 조회는 조건·선택을 하나도 바꾸지 않는다(수명 표 10행). */
    expect(currentLocation()).toBe(before);
  });

  /*
   * **같은 규칙이 라인까지 닿는다**(PR ③에서 늘어난 축). 라인을 빼고 다시 부르면 **다른
   * 사람이 그 위치를 치환한 뒤에도 화면의 줄 집합이 낡은 채로 남고**, 낡은 줄로 저장하면
   * 없어진 줄을 되살리거나 새 줄을 미실사로 되돌린다 — 치환이 파괴적이라 목록·상세보다
   * 결과가 더 나쁘다.
   */
  it('위치까지 골랐으면 라인도 함께 다시 부른다', async () => {
    const { requests, user } = await setupAtLocation();

    const listBefore = requestsTo(requests, LIST_PATH).length;
    const detailBefore = requestsTo(requests, DETAIL_PATH).length;
    const linesBefore = lineRequests(requests).filter((request) => request.method === 'GET').length;

    await user.click(screen.getByRole('button', { name: t.actions.refresh }));

    await waitFor(() => {
      expect(
        lineRequests(requests).filter((request) => request.method === 'GET').length,
      ).toBeGreaterThan(linesBefore);
    });

    /* 셋이 함께 간다 — 하나만 빠져도 낡은 값과 새 값이 한 화면에 섞인다. */
    expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(listBefore);
    expect(requestsTo(requests, DETAIL_PATH).length).toBeGreaterThan(detailBefore);
  });

  /*
   * 짝 방향 — **고른 실사가 없으면 상세를 부를 대상이 없다.** 이 단언이 없으면
   * 「전부 다시 부른다」가 「아무 때나 부른다」로 넓어져도 드러나지 않는다.
   */
  it('고르지 않았으면 다시 조회가 실사에 매달린 경로를 부르지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await waitForList();

    const listBefore = requestsTo(requests, LIST_PATH).length;

    await user.click(screen.getByRole('button', { name: t.actions.refresh }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(listBefore);
    });

    /* 번호 자리가 무엇으로 채워지든 잡는다 — 경로 하나만 세면 `…/0`이 빠져나간다. */
    expect(countScopedRequests(requests)).toHaveLength(0);
  });

  /** 아무것도 하지 않는 동안 요청이 늘지 않는다 — 이 화면은 스스로 갱신하지 않는다. */
  it('아무것도 하지 않으면 요청이 늘지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await waitForList();

    const before = requestsTo(requests, LIST_PATH).length;

    await user.click(within(listPane()).getByLabelText(t.fields.warehouse));
    await user.keyboard('{Escape}');

    expect(requestsTo(requests, LIST_PATH)).toHaveLength(before);
  });
});

describe('StocktakingScreen — 그 실사가 없을 때', () => {
  /*
   * **C15 · 정정 1-2의 「404 안내」 열** — 상세가 404면 주소에서 고른 실사와 위치를 정리하고,
   * **무엇이 왜 사라졌는지**를 안내로 남긴다.
   *
   * **정리가 끝난 뒤에 판정한다.** 정리 전 렌더에서는 상세가 404라는 사실만으로도 안내가
   * 그려지므로, 그 시점에 `findByText`로 해소되는 단언은 **안내의 수명을 재지 못한다** —
   * 안내 상태를 세우지 않아도(또는 세우고 곧바로 지워도) 통과한다.
   * 지켜야 하는 것은 「`ct`가 사라진 뒤에도 안내가 남는가」이고, 그 짝이 「미선택 문구가
   * 나오지 않는가」다. 주소를 지운 뒤 「아직 고르지 않았다」로 되돌아가면 사용자는 자기가
   * 무엇을 눌렀는지 되짚을 수 없다.
   */
  it('상세가 404면 주소를 정리하고 그 뒤에도 안내가 남는다', async () => {
    renderScreen(allRoutes(), '?wh=9101&ct=9999&loc=9701');

    await screen.findByText(t.empty.notFoundTitle);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?wh=9101`);
    });

    expect(screen.getByText(t.empty.notFoundTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noSelectionTitle)).not.toBeInTheDocument();
  });

  /*
   * **M20** — 정리를 클릭 핸들러에 두면 **뒤로가기·앞으로가기·주소 직접 편집이 통째로 샌다.**
   * 화면 바깥에서 주소만 갈아 끼워 그 경로를 만든다.
   *
   * 여기서도 **정리가 끝난 뒤**에 안내의 잔존을 함께 본다 — 두 경로(첫 진입·주소 편집)가
   * 같은 수명을 지켜야 한다.
   */
  it('주소만 바뀌어 없는 실사를 가리켜도 정리되고 안내가 남는다', async () => {
    const { user } = renderScreen(allRoutes(), '', 'ct=9999');

    await waitForList();

    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await screen.findByText(t.empty.notFoundTitle);

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });

    expect(screen.getByText(t.empty.notFoundTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noSelectionTitle)).not.toBeInTheDocument();
  });

  /*
   * **수명 표 1·2·3행의 「404 안내 = 비운다」.** 「세운다」와 「남는다」만 지키면 반쪽이다 —
   * 안내를 거두는 자리가 무너지면, 조건을 바꿔 새 결과를 멀쩡히 받은 뒤에도 아래 구획에
   * 「고른 실사를 찾을 수 없습니다」가 **계속 서 있다.** 그 안내가 무엇을 가리키는지 화면
   * 어디에서도 읽을 수 없고, 거두는 다른 경로는 실사를 다시 고르는 것뿐이다.
   *
   * 세 조작(조건 변경·초기화·쪽 이동)이 **`applyQuery` 한 자리를 함께 지난다.** 그래서
   * 서로 다른 호출부 둘(조건 줄의 「조회」 · 쪽 이동의 「다음」)을 골라 그 자리를 양쪽에서 센다.
   */
  it('404 안내 뒤 조건을 바꿔 조회하면 안내를 거둔다', async () => {
    const { user } = renderScreen(allRoutes(), '?ct=9999');

    await screen.findByText(t.empty.notFoundTitle);

    await user.click(screen.getByRole('checkbox', { name: t.fields.inProgressOnly }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?prog=1`);
    });

    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
    /* 짝 — 아래 구획이 사라지는 것이 아니라 「아직 고르지 않았다」로 돌아온다. */
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  it('404 안내 뒤 쪽을 옮기면 안내를 거둔다', async () => {
    const { user } = renderScreen(
      allRoutes([listRoute(countFixtures, { total: 120 })]),
      '?ct=9999',
    );

    await screen.findByText(t.empty.notFoundTitle);

    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?page=2`);
    });

    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  /* 정리한 뒤 다른 실사를 고르면 앞의 안내를 거둔다 — 남으면 요약 옆에 「없습니다」가 함께 선다. */
  it('다시 고르면 없음 안내를 거둔다', async () => {
    const { user } = renderScreen(allRoutes(), '?ct=9999');

    await screen.findByText(t.empty.notFoundTitle);

    await selectCount(user, 'IC-2026-900011');

    await screen.findByRole('group', { name: t.detail.summaryLabel });

    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
  });
});

describe('StocktakingScreen — 개시가 잠겨 있는 동안', () => {
  /*
   * **M23 · C19 · 승인 G1** — 실사 유형이 요청 필수인데 값 목록이 확정되지 않았다. 화면이
   * 그럴듯한 값을 지어내면 사용자는 고를 수 있다고 믿는데 서버는 그 값을 모르고, **되돌릴 수
   * 없는 전표**에 그 코드가 실린다 — 그래서 개시가 통째로 잠기고 사유가 보인다.
   */
  it('유형 선택지가 비어 있으면 개시가 잠기고 사유가 보인다', async () => {
    const { requests } = renderScreen(allRoutes());

    await waitForList();

    expect(openButton()).toBeDisabled();
    expect(openButton()).toHaveAccessibleDescription(t.actionReasons.openCodeListPending);
    expect(openRequests(requests)).toHaveLength(0);
  });

  /* 사유는 **감추지 않고 항상 보이는 글자**로 둔다 — 툴팁만으로는 키보드 사용자가 닿을 수 없다. */
  it('잠긴 사유가 화면에 글자로 서 있다', async () => {
    renderScreen(allRoutes());

    await waitForList();

    expect(within(openPane()).getByText(t.actionReasons.openCodeListPending)).toBeInTheDocument();
  });

  /*
   * **C20** — 값 목록이 차도 칸이 비면 잠긴 채이고, **사유가 칸마다 다르다.**
   * 「무엇이 막혔는지」가 갈리지 않으면 사용자가 어디를 고쳐야 하는지 알 수 없다.
   */
  it('값 목록이 차면 사유가 「고르세요」로 바뀐다', async () => {
    fillCodeLists();

    renderScreen(allRoutes());

    await waitForList();

    expect(openButton()).toBeDisabled();
    expect(openButton()).not.toHaveAccessibleDescription(t.actionReasons.openCodeListPending);
    expect(openButton()).toHaveAccessibleDescription(t.actionReasons.openNeedsCountType);
  });

  it('창고만 비면 창고를 가리킨다', async () => {
    fillCodeLists();

    const { user } = renderScreen(allRoutes());

    await waitForList();
    await chooseOption(user, openPane(), t.fields.countType, SAMPLE_COUNT_TYPE);

    expect(openButton()).toBeDisabled();
    expect(openButton()).toHaveAccessibleDescription(t.actionReasons.openNeedsWarehouse);
  });

  it('계획일만 비면 계획일을 가리킨다', async () => {
    fillCodeLists();

    const { user } = renderScreen(allRoutes());

    await waitForList();
    await chooseOption(user, openPane(), t.fields.countType, SAMPLE_COUNT_TYPE);
    await chooseOption(user, openPane(), t.fields.warehouse, WAREHOUSE_LABEL);

    expect(openButton()).toBeDisabled();
    expect(openButton()).toHaveAccessibleDescription(t.actionReasons.openNeedsPlannedDate);
  });

  /*
   * **M19 · C19의 전환** — 값 목록이 확정될 때 고칠 자리가 `code-options.ts`의 배열 하나뿐이라는
   * 것이 이 화면의 설계다. **배열만 채우고 다른 자리를 손대지 않은 채** 개시가 열리는지 고정한다.
   */
  it('선택지가 차고 값을 다 채우면 개시가 열린다', async () => {
    const { requests } = await setupReadyToOpen();

    expect(openButton()).not.toBeDisabled();
    /* 짝 방향 — 열렸다고 저절로 나가지는 않는다. */
    expect(openRequests(requests)).toHaveLength(0);
    expect(within(openPane()).queryByText(t.actionReasons.openCodeListPending)).not.toBeInTheDocument();
  });

  /*
   * **M22 · C22** — 공백만 친 유형 코드를 보내지 않는다. 계약에 코드 `minLength`가 없어
   * **목 서버가 빈 문자열도 201로 통과시킨다**(실측) — 막는 곳이 화면뿐이다.
   */
  it('공백만인 유형 코드를 고르면 잠긴 채로 남는다', async () => {
    /* 값 목록이 공백만 담아 온 상태 — 사용자는 그것을 고를 수 있고, 보이는 글자는 없다. */
    fillCodeLists([' ']);

    const { requests, user } = renderScreen(allRoutes());

    await waitForList();
    await user.click(within(openPane()).getByLabelText(t.fields.countType));

    const options = screen.getAllByRole('option');

    expect(options).toHaveLength(1);

    await user.click(options[0] as HTMLElement);
    await chooseOption(user, openPane(), t.fields.warehouse, WAREHOUSE_LABEL);
    await user.type(within(openPane()).getByLabelText(t.fields.plannedDate), '2026-08-12');

    expect(openButton()).toBeDisabled();
    expect(openButton()).toHaveAccessibleDescription(t.actionReasons.openNeedsCountType);
    expect(openRequests(requests)).toHaveLength(0);
  });

  /*
   * **M-4** — **버튼이 열려 있는데도 보낼 수 없는 상태**가 실제로 있다. 버튼의 잠금은
   * 「비어 있는가」만 보고(`openBlockReason`), 형식·길이는 `validateOpenDraft`가 본다 —
   * 그래서 고른 코드가 상한을 넘으면 **버튼은 열린 채로 남는다.**
   *
   * 그 상태에서 눌렀을 때 **창을 열지 않고 그 칸에 오류를 붙이는 것**이 `requestOpen`의
   * 사전 판정이다. 판정이 없으면 확인 창이 먼저 뜨고, 사용자는 상한을 넘은 코드를 확인한 뒤
   * **되돌릴 수 없는 전표**를 보내려다 서버 400을 받는다 — 확인 창이 거짓 안심을 준다.
   */
  it('버튼이 열려 있어도 코드가 상한을 넘으면 창이 열리지 않는다', async () => {
    const tooLongCode = 'A'.repeat(51);

    fillCodeLists([tooLongCode]);

    const { requests, user } = renderScreen(allRoutes());

    await waitForList();
    await chooseOption(user, openPane(), t.fields.countType, tooLongCode);
    await chooseOption(user, openPane(), t.fields.warehouse, WAREHOUSE_LABEL);
    await user.type(within(openPane()).getByLabelText(t.fields.plannedDate), '2026-08-12');

    /* 짝 방향 — 버튼은 실제로 열려 있다(잠겨 있어서 창이 안 뜨는 것이 아니다). */
    expect(openButton()).not.toBeDisabled();

    await user.click(openButton());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(openPane()).getByText(t.errors.codeTooLong(50))).toBeInTheDocument();
    expect(openRequests(requests)).toHaveLength(0);
  });

  /*
   * **C21의 첫 층** — 계획일 칸이 **달력에 없는 날짜를 값으로 받지 않는다.** 네이티브
   * `type="date"`가 그것을 걸러 값이 비고, 그 뒤는 「계획일을 넣으세요」 사유가 맡는다.
   *
   * 둘째 층인 인라인 오류(`validateOpenDraft`)는 **이 층이 없는 브라우저**를 위한 것이라
   * 여기서는 재지 않는다 — 단위 테스트가 그 판정을 고정한다(M25).
   */
  it('달력에 없는 계획일은 칸이 값으로 받지 않고 잠긴 채로 남는다', async () => {
    fillCodeLists();

    const { requests, user } = renderScreen(allRoutes());

    await waitForList();
    await chooseOption(user, openPane(), t.fields.countType, SAMPLE_COUNT_TYPE);
    await chooseOption(user, openPane(), t.fields.warehouse, WAREHOUSE_LABEL);
    await user.type(within(openPane()).getByLabelText(t.fields.plannedDate), '2026-02-31');

    expect(within(openPane()).getByLabelText(t.fields.plannedDate)).toHaveValue('');
    expect(openButton()).toBeDisabled();
    expect(openButton()).toHaveAccessibleDescription(t.actionReasons.openNeedsPlannedDate);
    expect(openRequests(requests)).toHaveLength(0);
  });
});

describe('StocktakingScreen — 개시 확인 창', () => {
  /*
   * **M24 · C23** — 확인 창이 먼저 뜨고 **확인하기 전에는 요청이 0회**다. 개시는 되돌릴 수
   * 없으므로 버튼에서 곧바로 보내면 사용자가 무엇을 보냈는지 볼 기회 자체가 없다.
   */
  it('개시를 누르면 창이 먼저 뜨고 요청이 나가지 않는다', async () => {
    const { requests, user } = await setupReadyToOpen();

    await user.click(openButton());

    expect(confirmDialog()).toBeInTheDocument();
    expect(openRequests(requests)).toHaveLength(0);
  });

  /*
   * **C24** — 창이 **보낼 값 넷**을 그대로 보인다. 창고는 이름으로 풀려 오고 번호는 어디에도
   * 없다(#44). 블라인드는 읽히는 말로 온다.
   */
  it('창이 초안의 값 넷을 그대로 보인다', async () => {
    const { user } = await setupReadyToOpen();

    await user.click(within(openPane()).getByRole('checkbox', { name: t.fields.blindCount }));
    await user.click(openButton());

    const dialog = confirmDialog();

    expect(within(dialog).getByText(SAMPLE_COUNT_TYPE)).toBeInTheDocument();
    expect(within(dialog).getByText(WAREHOUSE_LABEL)).toBeInTheDocument();
    expect(within(dialog).getByText('2026-08-12')).toBeInTheDocument();
    expect(within(dialog).getByText(t.values.blindYes)).toBeInTheDocument();
    expect(within(dialog).getByText(t.dialog.openIrreversible)).toBeInTheDocument();
    expect(dialog.textContent ?? '').not.toContain('9101');
  });

  /* **C25** — 창 안에 선택칸이 없다(#45가 걸릴 자리를 만들지 않는다). 화면에서도 확인한다. */
  it('창 안에 선택칸이 없다', async () => {
    const { user } = await setupReadyToOpen();

    await user.click(openButton());

    expect(within(confirmDialog()).getByText(SAMPLE_COUNT_TYPE)).toBeInTheDocument();
    expect(within(confirmDialog()).queryAllByRole('combobox')).toHaveLength(0);
  });

  /* 닫으면 요청이 나가지 않고 **초안이 그대로 남는다** — 고칠 것이 있어 닫는 것이다. */
  it('계속 입력을 누르면 창만 닫히고 초안이 남는다', async () => {
    const { requests, user } = await setupReadyToOpen();

    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(openRequests(requests)).toHaveLength(0);
    expect(within(openPane()).getByLabelText(t.fields.countType)).toHaveTextContent(
      SAMPLE_COUNT_TYPE,
    );
  });

  /*
   * **M27 · C27** — 창이 **열린 채 주소로 대상이 바뀌면 창이 닫히고 요청이 0회**다
   * (W-01-10 리뷰 R-1). 뒤로가기·앞으로가기·주소 직접 편집은 클릭 핸들러를 거치지 않으므로
   * 핸들러에 창 닫기를 두면 그 경로가 통째로 샌다.
   */
  it('창이 열린 채 주소로 대상이 바뀌면 창이 닫힌다', async () => {
    const { requests, user } = await setupReadyToOpen(allRoutes(), '', 'ct=9003');

    await user.click(openButton());

    expect(confirmDialog()).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(openRequests(requests)).toHaveLength(0);
  });

  /*
   * **R-3 — 창 수명은 「주소 전체」에 묶인다**(수명 표 1~6행).
   *
   * 위 테스트가 바꾸는 것은 **`ct` 하나**라, effect의 축을 `selectedCountId`로 좁혀도 통과한다 —
   * 그러면 **`ct`가 없는 상태(S0)에서 조건·쪽만 바뀔 때** 창이 그대로 남는다. 수명 표는
   * 조건 변경·초기화·쪽 이동에도 「닫는다」라고 적혀 있으므로 **축마다 하나씩** 센다.
   *
   * 형태는 PR ① R-2(조건 되돌림 6축 `it.each`)가 세운 것을 그대로 쓴다 — **범위 있는 규칙은
   * 잣대도 같은 범위로 세운다.** 좁은 앵커 하나로 갈음하면 잣대가 규칙보다 좁아진다.
   *
   * **`ct`가 없는 주소에서 시작한다** — 그래야 「`ct`가 바뀌어서 닫혔다」로 통과하지 않는다.
   */
  it.each<[string, (user: ReturnType<typeof userEvent.setup>) => Promise<void>]>([
    [
      '조건 변경·조회',
      async (user) => {
        await user.click(
          within(listPane()).getByRole('checkbox', { name: t.fields.inProgressOnly }),
        );
        await user.click(within(listPane()).getByRole('button', { name: messages.common.search }));
      },
    ],
    [
      '초기화',
      async (user) => {
        await user.click(within(listPane()).getByRole('button', { name: messages.common.reset }));
      },
    ],
    [
      '쪽 이동',
      async (user) => {
        await user.click(screen.getByRole('button', { name: t.actions.nextPage }));
      },
    ],
    [
      '실사 고르기',
      async (user) => {
        await selectCount(user, 'IC-2026-900011');
      },
    ],
  ])('창이 열린 채 %s가 일어나면 창이 닫힌다', async (_label, act) => {
    fillCodeLists();

    /* 쪽 이동 축을 위해 갈 곳이 남은 목록을 준다 — 「다음」이 잠겨 있으면 그 축을 못 잰다. */
    const { requests, user } = renderScreen(
      allRoutes([listRoute(countFixtures, { total: 120 })]),
      '?wh=9101',
    );

    await waitForList();
    await fillOpenDraft(user);
    await user.click(openButton());

    /* 짝 방향 — 조작 전에는 실제로 열려 있었다(원래 안 열려서 통과하는 것이 아니다). */
    expect(confirmDialog()).toBeInTheDocument();

    await act(user);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(openRequests(requests)).toHaveLength(0);
  });

  /*
   * 두 겹의 둘째 — **보내는 자리가 스스로 한 번 더 본다**(계획 결정 3의 구현 규칙 4).
   * 창이 열린 사이 초안이 보낼 수 없는 상태가 되면, 창의 확인 버튼을 눌러도 **창을 닫고
   * 보내지 않는다.** 「버튼이 막았으니 여기서는 안 봐도 된다」는 창이 그 사이를 벌려 놓았으므로
   * 성립하지 않는다.
   */
  it('창이 열린 사이 초안이 보낼 수 없게 되면 확인해도 보내지 않는다', async () => {
    const { requests, user } = await setupReadyToOpen();

    await user.click(openButton());

    /* 창이 열린 채 계획일이 비워진다 — 버튼의 판정은 창을 열 때의 것이라 이미 낡았다. */
    await user.clear(within(openPane()).getByLabelText(t.fields.plannedDate));
    await user.click(screen.getByRole('button', { name: t.actions.confirmOpen }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(openRequests(requests)).toHaveLength(0);
    /* 짝 방향 — 초안은 남아 있어 사용자가 이어서 고칠 수 있다. */
    expect(within(openPane()).getByLabelText(t.fields.countType)).toHaveTextContent(
      SAMPLE_COUNT_TYPE,
    );
  });
});

describe('StocktakingScreen — 개시 요청', () => {
  /*
   * **아래 단언들이 딛고 선 전제를 먼저 고정한다.** 개시로 만들어지는 실사가 목록 셋 가운데
   * 하나와 겹치면 「방금 만든 실사가 지금 조건의 목록에 없어도 아래 구획이 열린다」가 무엇을
   * 재는지 알 수 없게 된다 — 목록에 있어서 열린 것인지 상세가 200이라 열린 것인지 갈리지 않는다.
   */
  it('개시로 만들어지는 실사가 목록 셋과 겹치지 않는다', () => {
    expect(countFixtures.map((count) => count.inventoryCountId)).not.toContain(OPENED_COUNT_ID);
  });

  /*
   * **취소가 개시보다 앞에 선다.** 되돌릴 수 없는 것이 손 가까이 있으면 안 된다 —
   * 두 버튼의 차례가 뒤집히면 서둘러 누르는 손이 개시에 먼저 닿는다.
   */
  it('취소가 실사 개시보다 앞에 선다', async () => {
    await setupReadyToOpen();

    const cancel = within(openPane()).getByRole('button', { name: messages.common.cancel });
    const following = cancel.compareDocumentPosition(openButton()) & Node.DOCUMENT_POSITION_FOLLOWING;

    expect(following).not.toBe(0);
  });

  /*
   * **C28** — 요청 본문이 넷이고 **`If-Match`를 보내지 않는다.** 이 오퍼레이션에는 낙관적
   * 잠금이 아예 없어(실측) 빈 토큰을 실으면 계약 위반이 된다. `Idempotency-Key`는 전 쓰기에
   * 필수라 늘 실린다.
   */
  it('본문이 넷이고 If-Match를 보내지 않는다', async () => {
    const { requests, user } = await setupReadyToOpen();

    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: t.actions.confirmOpen }));

    await waitFor(() => {
      expect(openRequests(requests)).toHaveLength(1);
    });

    const sent = openRequests(requests)[0];

    expect(sent?.body).toEqual({
      countTypeCode: SAMPLE_COUNT_TYPE,
      warehouseId: 9101,
      plannedDate: '2026-08-12',
      blindCount: false,
    });
    expect(sent?.headers.has('If-Match')).toBe(false);
    expect(sent?.headers.get('Idempotency-Key')).not.toBeNull();
  });

  /*
   * **C29** — 성공하면 `ct`가 **새 실사로** 옮겨지고, `loc`와 개시 초안이 비고, 결과 구획이
   * 채워지고, 목록이 다시 조회된다. **방금 만든 실사가 지금 조건의 목록에 없어도** 아래 구획이
   * 열린다 — 단계를 목록 소속이 아니라 상세 200으로 판정하기 때문이다(계획 결정 2).
   */
  it('성공하면 새 실사로 옮겨 가고 결과와 요약이 함께 선다', async () => {
    const { requests, user } = await setupReadyToOpen(allRoutes(), '?wh=9101&loc=9701');

    const listBefore = requestsTo(requests, LIST_PATH).filter(
      (request) => request.method === 'GET',
    ).length;

    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: t.actions.confirmOpen }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?wh=9101&ct=${String(OPENED_COUNT_ID)}`);
    });

    /*
     * 결과 구획이 업무 번호를 내고, **아래 구획 안에** 선다(계획 §5.5 배치) — 바로 위에
     * 그 실사의 제목줄과 요약이 함께 서서 「무엇을 만들었고 지금 어떤 상태인가」가 이어진다.
     */
    expect(
      within(detailPane()).getByRole('status', { name: t.result.label }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('status', { name: t.result.label })).getByText(OPENED_COUNT_NO),
    ).toBeInTheDocument();

    /* 새 실사의 상세를 부르고 그 요약이 아래 구획에 선다(9001의 40·25와 겹치지 않는 숫자다). */
    await waitFor(() => {
      expect(requestsTo(requests, OPENED_DETAIL_PATH)).toHaveLength(1);
    });

    const summary = within(detailPane()).getByRole('group', { name: t.detail.summaryLabel });

    /* 갓 만든 실사라 계획 라인과 미실사가 같은 수다 — 둘 다 그려진다. */
    expect(within(summary).getAllByText('31')).toHaveLength(2);
    /* 앞 실사의 숫자가 남아 있지 않다 — 요약이 실제로 새 실사의 것이다. */
    expect(within(summary).queryByText('40')).not.toBeInTheDocument();

    /* 목록이 다시 조회된다 — 방금 만든 전표가 목록에 나타나야 한다. */
    await waitFor(() => {
      expect(
        requestsTo(requests, LIST_PATH).filter((request) => request.method === 'GET').length,
      ).toBeGreaterThan(listBefore);
    });

    /* 초안이 비워진다 — 남으면 같은 값으로 한 번 더 보낼 수 있다(중복 전송 완화의 한 층). */
    expect(within(openPane()).getByLabelText(t.fields.plannedDate)).toHaveValue('');
    expect(openButton()).toBeDisabled();
  });

  /*
   * **M26 · C26** — 전송 중에는 **대상을 바꾸는 길이 모두 잠기고** 연타해도 요청이 1회다.
   * 열어 두면 사용자가 다른 실사·조건·쪽으로 옮긴 뒤 앞 요청의 결과가 그 맥락에 나타나고,
   * 공통 쓰기 훅이 호출마다 새 멱등 키를 만들어 두 번째 요청이 **새 전표**가 된다.
   */
  it('전송 중에는 대상을 바꿀 수 없고 연타해도 요청이 1회다', async () => {
    const { requests, release, user } = await setupReadyToOpen(
      allRoutes(),
      '',
      '',
      isOpenRequest,
    );

    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: t.actions.confirmOpen }));

    await waitFor(() => {
      expect(openRequests(requests)).toHaveLength(1);
    });

    expect(openButton()).toBeDisabled();
    expect(within(listPane()).getByRole('button', { name: messages.common.search })).toBeDisabled();
    expect(
      within(listPane()).getByRole('button', { name: t.actions.selectRow('IC-2026-900011') }),
    ).toBeDisabled();
    expect(within(openPane()).getByLabelText(t.fields.countType)).toBeDisabled();
    /*
     * **취소도 함께 잠긴다.** 이 한 줄이 `requestDiscardOpenDraft`의 핸들러 가드를 「등가」로
     * 분류한 **전제**다 — 그 가드가 닿을 수 없는 것은 이 버튼이 잠겨 있기 때문이므로, 이 겹이
     * 무방비면 **두 겹이 함께 조용히 사라진다.** 그러면 전송 중 취소 → 파기가 결과 구획과
     * 실패 배너를 지워 **지금 무엇이 나가는 중인지 화면이 말하지 못한다.**
     */
    expect(
      within(openPane()).getByRole('button', { name: messages.common.cancel }),
    ).toBeDisabled();

    /* 잠금을 우회하는 길(핸들러 직접 호출)로도 대상이 바뀌지 않는다. */
    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    expect(openRequests(requests)).toHaveLength(1);

    release();

    await waitFor(() => {
      expect(currentLocation()).toContain(`ct=${String(OPENED_COUNT_ID)}`);
    });
  });

  /*
   * **M-5 · M26의 둘째 겹** — 위 테스트가 재는 것은 **컨트롤 잠금**(눈에 보이는 첫째 겹)이다.
   * 그 겹만으로는 모자란 자리가 실재한다: **조건 칩의 ×는 디자인 시스템이 잠금을 받지 않아**
   * (`StatusChipProps`에 `disabled`가 없다 — 실측) 전송 중에도 눌린다.
   *
   * 그 길로 들어오면 조건이 바뀌면서 `ct`가 풀리고, 잠시 뒤 도착한 **앞 요청의 결과가 다른
   * 조건의 맥락에 나타난다.** 그래서 `applyQuery`가 스스로 한 번 더 막는다 — 이 테스트는
   * **경로 가드 단독**을 겨눈다(컨트롤 잠금은 이 경로에 아예 없다).
   */
  it('전송 중에는 잠금을 받지 않는 조건 칩의 ×로도 대상이 바뀌지 않는다', async () => {
    const { requests, release, user } = await setupReadyToOpen(
      allRoutes(),
      '?wh=9101',
      '',
      isOpenRequest,
    );

    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: t.actions.confirmOpen }));

    await waitFor(() => {
      expect(openRequests(requests)).toHaveLength(1);
    });

    const before = currentLocation();
    const listBefore = requestsTo(requests, LIST_PATH).filter(
      (request) => request.method === 'GET',
    ).length;
    const removeChip = within(listPane()).getByRole('button', {
      name: t.filters.chipRemoveWarehouse,
    });

    /* 짝 방향 — 이 버튼은 실제로 눌린다(잠겨 있어서 아무 일도 안 나는 것이 아니다). */
    expect(removeChip).not.toBeDisabled();

    await user.click(removeChip);

    expect(currentLocation()).toBe(before);
    expect(
      requestsTo(requests, LIST_PATH).filter((request) => request.method === 'GET'),
    ).toHaveLength(listBefore);

    release();

    await waitFor(() => {
      expect(currentLocation()).toContain(`ct=${String(OPENED_COUNT_ID)}`);
    });
  });
});

describe('StocktakingScreen — 개시 실패', () => {
  /*
   * **C30** — 실패가 **세 갈래**이고 문구가 서로 다르며 **입력이 남는다.**
   * **409 갈래가 없다** — 이 오퍼레이션에는 낙관적 잠금이 없어 충돌이 나오지 않는다.
   */
  it.each<[string, number, string]>([
    ['검증 실패', 400, '창고를 확인하세요.'],
    ['권한 없음', 403, messages.httpError.forbidden],
  ])('%s면 그 사유를 내고 입력이 남는다', async (_label, status, expected) => {
    const body =
      status === 400
        ? { errors: [{ scope: 'screen', code: 'INVALID', message: '창고를 확인하세요.' }] }
        : { message: '' };

    const { requests, user } = await setupReadyToOpen(
      allRoutes([failingOpenRoute(status, body)]),
    );

    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: t.actions.confirmOpen }));

    expect(await screen.findByText(expected)).toBeInTheDocument();

    /* 입력이 남는다 — 실패했는데 지우면 처음부터 다시 친다. */
    expect(within(openPane()).getByLabelText(t.fields.plannedDate)).toHaveValue('2026-08-12');
    expect(openRequests(requests)).toHaveLength(1);

    /* 결과 구획이 서지 않는다 — 앞 성공의 번호가 남으면 오해한다. */
    expect(screen.queryByRole('status', { name: t.result.label })).not.toBeInTheDocument();
    /* 409 갈래가 없다 — 「최신 불러오기」가 뜰 자리가 없다. */
    expect(screen.queryByRole('button', { name: messages.conflict.reloadAction })).not.toBeInTheDocument();
    /*
     * **R-2 · 수명 표 12행** — 실패해도 **확인 창은 닫혀 있다.** 성공 경로에서는 주소가
     * 바뀌면서 창 수명 effect가 우연히 닫아 주지만 **실패 경로에는 그 우연이 없다** —
     * 남으면 실패 배너 위에 활성인 「실사 개시 실행」이 서 있고(전송 중 잠금은 응답이
     * 도착하면 풀린다) 다시 누르는 순간 새 멱등 키로 **두 벌째 전표**가 나간다.
     */
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /*
   * **응답을 받지 못한 갈래에만 한 줄을 더한다**(중복 전송 완화의 셋째 층). 공통 문구는
   * 「다시 시도하세요」로 끝나는데, 확인 없이 다시 보내면 같은 창고에 전표가 두 벌 생긴다.
   */
  it('응답이 오지 않으면 다시 보내기 전에 확인하라고 밝힌다', async () => {
    const { user } = await setupReadyToOpen(allRoutes([offlineOpenRoute()]));

    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: t.actions.confirmOpen }));

    expect(await screen.findByText(messages.httpError.offline)).toBeInTheDocument();
    expect(screen.getByText(t.notes.openRecheck)).toBeInTheDocument();
    /* **R-2** — 응답이 오지 않은 갈래에서도 창은 닫혀 있다(여기가 두 벌째 전표에 가장 가깝다). */
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /*
   * **M-6 · 수명 표 12행** — 실패하면 **결과 구획을 비운다.** 이 명제는 **앞선 개시가
   * 성공한 뒤에 실패하는 순서**로만 잴 수 있다 — 빈 화면에서 시작하는 실패 테스트는 결과
   * 구획이 원래 없으므로 아무것도 재지 못한다.
   *
   * 무너지면 방금 만든 실사번호가 **실패 배너 옆에 그대로 서 있고**, 사용자는 둘째 개시도
   * 성공한 것으로 읽는다 — 되돌릴 수 없는 전표를 하나 더 만들려 들 이유가 생긴다.
   */
  it('앞선 개시가 성공한 뒤 실패하면 결과 구획을 거둔다', async () => {
    const { user } = await setupReadyToOpen(allRoutes([openThenForbiddenRoute()]));

    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: t.actions.confirmOpen }));

    /* 첫 개시는 성공한다 — 결과 구획이 실제로 선다. */
    expect(
      await screen.findByRole('status', { name: t.result.label }),
    ).toBeInTheDocument();

    /* 성공이 초안을 비웠으므로 둘째 개시를 위해 다시 채운다. */
    await fillOpenDraft(user);
    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: t.actions.confirmOpen }));

    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: t.result.label })).not.toBeInTheDocument();

    /*
     * **거두는 것은 「방금 만들었다」는 결과뿐이다.** 첫 실사는 실제로 있고 `ct`가 그것을
     * 가리키므로 제목줄에는 그대로 남는다 — 둘을 뭉개면 「실패했으니 앞서 만든 것도 없다」로
     * 읽히고, 사용자는 있는 전표를 한 번 더 만들려 든다.
     */
    expect(within(detailPane()).getByText(OPENED_COUNT_NO)).toBeInTheDocument();
    /* **R-2** — 둘째 시도가 실패한 뒤에도 창은 닫혀 있다. */
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /*
   * **R-1 · 서버가 준 실패 상태의 수명**(수명 표 「서버 실패」 열).
   *
   * 기존 400 감지기는 응답을 `scope: 'screen'`으로 태워 **배너 갈래만** 지난다 — 그래서
   * `OPEN_FIELD_NAMES` ↔ `OPEN_FORM_FIELDS` ↔ `open-form`의 `fieldErrors[…]`로 이어지는
   * **인라인 배선 전체가 한 번도 실행되지 않았다.** 여기서 `scope: 'field'` 한 갈래를 태워
   * 그 배선의 **세 매듭**을 잇달아 센다.
   *
   * 무너지면 서버가 「창고를 확인하세요」라고 콕 집어 주는데 화면은 그것을 배너로만 내고,
   * 사용자는 **어느 칸이 문제인지 모른 채** 되돌릴 수 없는 개시를 다시 시도한다.
   */
  it('서버가 준 필드 오류가 그 칸에 붙고, 고치면 걷히고, 버리면 배너까지 사라진다', async () => {
    const serverMessage = '창고를 확인하세요.';
    const { user } = await setupReadyToOpen(
      allRoutes([
        failingOpenRoute(400, {
          errors: [
            {
              scope: 'field',
              field: OPEN_FIELD_NAMES.warehouse,
              code: 'INVALID',
              message: serverMessage,
            },
          ],
        }),
      ]),
    );

    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: t.actions.confirmOpen }));

    /* ① 그 칸 옆에 선다 — 배너가 아니다. 창고 선택칸이 `invalid`로 표시된다. */
    expect(await within(openPane()).findByText(serverMessage)).toBeInTheDocument();
    expect(within(openPane()).getByLabelText(t.fields.warehouse)).toBeInvalid();
    /*
     * 배너에는 그 문구가 없다 — 인라인으로 소화한 것을 배너로 또 내면 같은 오류가 두 번
     * 보이고, 사용자는 칸이 둘 잘못된 줄 안다.
     */
    expect(within(openPane()).getAllByText(serverMessage)).toHaveLength(1);

    /* ② 그 칸을 다시 고치면 걷힌다 — 남으면 이미 고친 값 옆에 붉은 글씨가 서 있다. */
    await chooseOption(user, openPane(), t.fields.warehouse, WAREHOUSE_LABEL);

    expect(within(openPane()).queryByText(serverMessage)).not.toBeInTheDocument();
    expect(within(openPane()).getByLabelText(t.fields.warehouse)).not.toBeInvalid();
  });

  /*
   * **R-1의 셋째 매듭** — 초안을 버리면 **실패 배너까지 함께 거둔다**(`open.reset()`).
   * 「버린다」는 앞서 한 시도를 통째로 물리는 것이라, 오류가 남으면 무엇이 지금 상태인지
   * 화면이 말할 수 없다. 배너 갈래로 태워 **배너와 필드 오류가 같은 조작에 함께** 사라지는지 본다.
   */
  it('실패한 뒤 초안을 버리면 배너와 필드 오류가 함께 사라진다', async () => {
    const serverMessage = '창고를 확인하세요.';
    const { user } = await setupReadyToOpen(
      allRoutes([
        failingOpenRoute(400, {
          errors: [
            { scope: 'screen', code: 'INVALID', message: '보낼 수 없는 값이 있습니다.' },
            {
              scope: 'field',
              field: OPEN_FIELD_NAMES.warehouse,
              code: 'INVALID',
              message: serverMessage,
            },
          ],
        }),
      ]),
    );

    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: t.actions.confirmOpen }));

    /* 짝 방향 — 배너와 인라인이 실제로 **갈려서** 함께 서 있다. */
    expect(await screen.findByText('보낼 수 없는 값이 있습니다.')).toBeInTheDocument();
    expect(within(openPane()).getByText(serverMessage)).toBeInTheDocument();

    await user.click(within(openPane()).getByRole('button', { name: messages.common.cancel }));
    await user.click(screen.getByRole('button', { name: t.actions.discardDraft }));

    expect(screen.queryByText('보낼 수 없는 값이 있습니다.')).not.toBeInTheDocument();
    expect(within(openPane()).queryByText(serverMessage)).not.toBeInTheDocument();
  });

  /* 짝 방향 — 응답이 온 실패에는 그 한 줄을 붙이지 않는다. 붙이면 늘 참인 안내가 된다. */
  it('응답이 온 실패에는 그 안내를 붙이지 않는다', async () => {
    const { user } = await setupReadyToOpen(allRoutes([failingOpenRoute(403)]));

    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: t.actions.confirmOpen }));

    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.queryByText(t.notes.openRecheck)).not.toBeInTheDocument();
  });
});

describe('StocktakingScreen — 개시 초안의 수명', () => {
  /*
   * **#43** — 이 화면의 개시 초안에는 **되돌림 effect가 아예 없다.** 목록 응답이 도착해도
   * 치던 값이 사라지지 않는다(수명 표 9행). 목록을 부를 때마다 내용이 달라지는 스텁을 쓴다 —
   * 같은 본문이 오면 캐시가 참조를 그대로 유지해 결함이 드러나지 않는다.
   */
  it('목록 응답이 도착해도 개시 초안이 남는다', async () => {
    fillCodeLists();

    const { user } = renderScreen(allRoutes([changingListRoute()]));

    await waitForList();
    await fillOpenDraft(user);

    await user.click(screen.getByRole('button', { name: t.actions.refresh }));

    await waitFor(() => {
      expect(openButton()).not.toBeDisabled();
    });
    expect(within(openPane()).getByLabelText(t.fields.plannedDate)).toHaveValue('2026-08-12');
    expect(within(openPane()).getByLabelText(t.fields.countType)).toHaveTextContent(
      SAMPLE_COUNT_TYPE,
    );
  });

  /*
   * **수명 표 1~5행** — 조건을 바꾸거나 실사를 골라도 개시 초안은 남는다. 개시 초안이 가리키는
   * 것은 **만들 실사**이지 위에서 고른 실사가 아니다 — 조건을 좁혀 창고를 찾아본 뒤 그 창고로
   * 개시하는 것이 정상 경로라, 목록을 만지는 동안 입력이 사라지면 그 경로가 막힌다.
   */
  it('조건을 바꾸거나 실사를 골라도 개시 초안이 남는다', async () => {
    const { user } = await setupReadyToOpen();

    await user.click(within(listPane()).getByRole('checkbox', { name: t.fields.inProgressOnly }));
    await user.click(within(listPane()).getByRole('button', { name: messages.common.search }));
    await selectCount(user, 'IC-2026-900011');

    await screen.findByRole('group', { name: t.detail.summaryLabel });

    expect(within(openPane()).getByLabelText(t.fields.plannedDate)).toHaveValue('2026-08-12');
    expect(openButton()).not.toBeDisabled();
  });

  /*
   * **수명 표 17행** — 취소는 초안을 버린다. **버리기 전에 확인을 받는다**(계획 결정 15):
   * 친 값이 말없이 사라지면 무엇을 잃었는지도 알 수 없다.
   */
  it('취소를 누르면 파기 확인 창을 거쳐 초안이 비워진다', async () => {
    const { user } = await setupReadyToOpen();

    await user.click(within(openPane()).getByRole('button', { name: messages.common.cancel }));

    expect(screen.getByText(messages.common.discardChangesConfirm)).toBeInTheDocument();
    /* 확인하기 전에는 아직 남아 있다. */
    expect(within(openPane()).getByLabelText(t.fields.plannedDate)).toHaveValue('2026-08-12');

    await user.click(screen.getByRole('button', { name: t.actions.discardDraft }));

    expect(within(openPane()).getByLabelText(t.fields.plannedDate)).toHaveValue('');
    expect(openButton()).toBeDisabled();
  });

  /* 아무것도 잃지 않는 조작에까지 확인을 받으면 확인 창이 의미를 잃고 읽지 않고 누르게 된다. */
  it('버릴 것이 없으면 확인 창을 띄우지 않는다', async () => {
    fillCodeLists();

    const { user } = renderScreen(allRoutes());

    await waitForList();
    await user.click(within(openPane()).getByRole('button', { name: messages.common.cancel }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('StocktakingScreen — 결과 구획의 수명', () => {
  const openOne = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: t.actions.confirmOpen }));
    await screen.findByRole('status', { name: t.result.label });
  };

  /*
   * **수명 표 1~4행** — 결과는 「방금 **이 실사를** 개시했다」이지 「이 실사가 개시된 것이다」가
   * 아니다. 대상이 바뀌었는데 남으면 사용자는 방금 고른 실사를 방금 만든 것으로 읽는다.
   */
  it('다른 실사를 고르면 결과 구획이 사라진다', async () => {
    const { user } = await setupReadyToOpen();

    await openOne(user);
    await selectCount(user, 'IC-2026-900013');

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: t.result.label })).not.toBeInTheDocument();
    });
  });

  /* 주소로 대상이 바뀌는 길(뒤로가기·직접 편집)도 같은 규칙이 닿아야 한다. */
  it('주소로 대상이 바뀌어도 결과 구획이 사라진다', async () => {
    const { user } = await setupReadyToOpen(allRoutes(), '', 'ct=9003');

    await openOne(user);
    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: t.result.label })).not.toBeInTheDocument();
    });
  });

  /* **수명 표 10행** — 「다시 조회」는 값을 버리려고 누르는 것이 아니다. 결과가 남는다. */
  it('다시 조회해도 결과 구획이 남는다', async () => {
    const { user } = await setupReadyToOpen();

    await openOne(user);
    await user.click(screen.getByRole('button', { name: t.actions.refresh }));

    expect(screen.getByRole('status', { name: t.result.label })).toBeInTheDocument();
  });
});

describe('StocktakingScreen — 위치와 라인 조회', () => {
  /*
   * **감지기 M33 · 완료 조건 C31** — 실사를 고르기 전에는 위치를, 위치를 고르기 전에는 라인을
   * 부르지 않는다.
   *
   * **경로 하나를 세지 않는다**(PR ① 검증 담당의 승계 3). `enabled` 가드가 무너지면 번호 자리에
   * `0`이나 `undefined`가 박힌 경로로 나가는데, `…/9001/lines`만 세는 단언은 그것을 보지
   * 못한다 — 번호 자리를 연 무늬로 **경로 전체**를 센다.
   */
  it('실사를 고르기 전에는 위치도 라인도 부르지 않는다', async () => {
    const { requests } = renderScreen(allRoutes());

    await waitForList();

    expect(requestsTo(requests, LOCATIONS_PATH)).toHaveLength(0);
    expect(lineRequests(requests)).toHaveLength(0);
    /* 짝 방향 — 목록은 실제로 불렀다(아무 요청도 안 나가서 통과하는 것이 아니다). */
    expect(requestsTo(requests, LIST_PATH)).toHaveLength(1);
  });

  it('위치를 고르기 전에는 라인을 부르지 않는다', async () => {
    const { requests } = renderScreen(allRoutes(), '?ct=9001');

    await screen.findByLabelText(t.fields.location);
    await waitFor(() => {
      expect(requestsTo(requests, LOCATIONS_PATH)).toHaveLength(1);
    });

    expect(lineRequests(requests)).toHaveLength(0);
    expect(screen.getByText(t.empty.noLocationTitle)).toBeInTheDocument();
  });

  /** 라인 표가 쓰는 참조 셋도 **위치를 고른 뒤에** 부른다 — 미리 받아 둘 이득이 없다. */
  it('위치를 고르기 전에는 라인 표의 참조 셋을 부르지 않는다', async () => {
    const { requests } = renderScreen(allRoutes(), '?ct=9001');

    await screen.findByLabelText(t.fields.location);

    for (const path of [ITEMS_PATH, UOMS_PATH, LOTS_PATH]) {
      expect(requestsTo(requests, path)).toHaveLength(0);
    }
  });

  /*
   * **완료 조건 C32·C33 · 감지기 M44** — 라인 요청에 `locationId`와 쪽 크기만 실리고
   * **좁히는 조건이 실리지 않는다.** 좁혀 받은 목록으로 치환하면 나머지가 미실사로 되돌아간다 —
   * 이 화면에서 가장 큰 사고 경로라 요청 URL에서 직접 잰다.
   */
  it('라인 요청에 좁히는 조건이 실리지 않는다', async () => {
    const { requests } = await setupAtLocation();

    const query = lastQuery(requests, LINES_PATH);

    expect([...(query?.keys() ?? [])].sort()).toEqual(['locationId', 'size']);
    expect(query?.get('locationId')).toBe(String(LOCATION_ID));
    expect(Number(query?.get('size'))).toBeGreaterThan(0);

    for (const narrowing of ['uncountedOnly', 'varianceOnly', 'itemId']) {
      expect(query?.has(narrowing)).toBe(false);
    }
  });

  /** 위치를 고르면 주소에 실려 새로고침·공유가 같은 위치를 연다. 고른 실사는 그대로 남는다. */
  it('위치를 고르면 주소에 실리고 고른 실사가 남는다', async () => {
    const { user } = await setupAtLocation();

    expect(currentLocation()).toContain('ct=9001');
    expect(currentLocation()).toContain(`loc=${String(LOCATION_ID)}`);

    await user.click(screen.getByLabelText(t.fields.location));
    await user.click(screen.getByRole('option', { name: t.values.locationNotChosen }));

    await waitFor(() => {
      expect(currentLocation()).not.toContain('loc=');
    });
    expect(currentLocation()).toContain('ct=9001');
  });

  /*
   * **위치 참조 복원**(PR ① 계획 정정 1 · 승계 1) — 위치가 창고와 **같은 4갈래 기계**로 붙고,
   * 어느 갈래에도 내부 번호가 없다(완료 조건 C11 · #44).
   */
  it('위치 이름이 참조로 풀리고 번호가 보이지 않는다', async () => {
    await setupAtLocation();

    /* 짝 방향 — 이름은 실제로 보인다. */
    expect(screen.getAllByText(LOCATION_LABEL).length).toBeGreaterThan(0);

    /*
     * **구획 안에서만 센다.** 주소에는 `loc=9701`이 실려 있어야 하고(새로고침·공유가 같은
     * 위치를 열어야 한다) 그것을 비추는 것은 테스트의 주소 표시기다 — 화면이 내는 텍스트와
     * 섞으면 #44를 재는 단언이 자기 하네스에 걸린다.
     */
    expect(detailPane().textContent ?? '').not.toContain(String(LOCATION_ID));
  });

  it('위치 목록을 불러오지 못하면 사유와 다시 시도가 선다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([failingLocationsRoute()]),
      '?ct=9001',
    );

    await screen.findByText(t.reasons.locationReferenceFailed);

    const before = requestsTo(requests, LOCATIONS_PATH).length;

    await user.click(
      within(detailPane()).getByRole('button', { name: messages.common.retry }),
    );

    await waitFor(() => {
      expect(requestsTo(requests, LOCATIONS_PATH).length).toBeGreaterThan(before);
    });
  });

  /** **감지기 M34** — 그 위치에 줄이 없는 갈래는 표의 `empty`가 맡는다. */
  it('그 위치에 라인이 없으면 표의 빈 상태가 보인다', async () => {
    renderScreen(allRoutes([linesRoute(LINES_PATH, [])]), AT_LOCATION);

    await screen.findByText(t.empty.noLinesTitle);

    expect(within(detailPane()).getAllByRole('table').length).toBeGreaterThan(0);
  });

  it('라인 조회가 실패하면 빈 상태가 아니라 배너를 낸다', async () => {
    renderScreen(
      allRoutes([
        { match: (request) => isGet(request, LINES_PATH), respond: () => jsonResponse({ message: '' }, { status: 500 }) },
      ]),
      AT_LOCATION,
    );

    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.queryByText(t.empty.noLinesTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.noLocationTitle)).not.toBeInTheDocument();
  });

  /*
   * **완료 조건 C49 · 감지기 M49** — 이력 구획은 비활성이고 **어떤 요청도 보내지 않는다.**
   * 조회를 붙여 두면 아무도 읽지 않는 응답이 오가고, 그 경로가 나중에 「이미 되는 것」으로 읽힌다.
   */
  it('이력 구획이 비활성이고 요청을 늘리지 않는다', async () => {
    /*
     * **위치를 고르기 전에 잰다.** 라인 표가 열린 뒤에는 참조 셋이 이미 나가 있어, 이력에
     * 조회를 붙여도 **이미 부르는 경로**를 하나 더 부르는 것이 되어 집합이 그대로다 —
     * 그 상태에서 세면 이 단언이 무엇도 재지 못한다.
     */
    const { requests } = renderScreen(allRoutes(), '?ct=9001');

    await screen.findByLabelText(t.fields.location);
    await waitFor(() => {
      expect(requestsTo(requests, LOCATIONS_PATH)).toHaveLength(1);
    });

    const historyButton = within(
      screen.getByRole('group', { name: t.history.label }),
    ).getByRole('button', { name: t.history.action });

    expect(historyButton).toBeDisabled();

    /* 나간 경로의 **집합 그대로** — 이력이 쓸 만한 경로가 하나도 늘지 않았다. */
    expect([...new Set(requests.map((request) => request.url.pathname))].sort()).toEqual(
      [LIST_PATH, DETAIL_PATH, WAREHOUSES_PATH, LOCATIONS_PATH].sort(),
    );
  });
});

describe('StocktakingScreen — 라인 초안', () => {
  /*
   * **완료 조건 C35 · 감지기 M32** — 위치를 열면 실물 수량 칸이 **전부 빈 칸**이다.
   * 서버가 준 값으로 채워 두면 사용자가 그대로 저장하는 순간 세지 않은 줄이 「0개를 셌다」가 된다.
   */
  it('위치를 열면 실물 수량 칸이 전부 빈 칸이다', async () => {
    await setupAtLocation();

    /* 짝 방향 — 서버는 실제로 값을 줬다(없어서 비어 보이는 것이 아니다). */
    expect(countLineFixtures[0]?.countedQty).toBe(98);

    for (const lineNo of [1, 2, 3]) {
      expect(qtyField(lineNo)).toHaveValue('');
    }
  });

  it('친 값이 그 줄에만 남는다', async () => {
    const { user } = await setupAtLocation();

    await user.type(qtyField(2), '40');

    expect(qtyField(1)).toHaveValue('');
    expect(qtyField(2)).toHaveValue('40');
    expect(qtyField(3)).toHaveValue('');
  });

  /*
   * **감지기 M35 · #43** — 되돌림 축이 **`loc` 하나뿐**임을 여러 축으로 센다
   * (PR ② 승계의 격상 규칙: 범위 있는 규칙은 잣대도 같은 범위로).
   *
   * 라인 응답·목록 응답·참조 응답이 도착해도, 개시 초안을 쳐도 라인 초안은 그대로여야 한다 —
   * 되돌림 의존성에 그중 하나라도 들어가면 **치던 값이 사라진다.**
   */
  it.each<[string, (user: ReturnType<typeof userEvent.setup>) => Promise<void>]>([
    [
      '다시 조회로 라인·상세·목록이 함께 와도',
      async (user) => {
        await user.click(screen.getByRole('button', { name: t.actions.refresh }));
      },
    ],
    [
      '라인 표의 참조를 다시 불러도',
      async (user) => {
        await user.click(
          within(detailPane()).getByRole('button', { name: messages.common.retry }),
        );
      },
    ],
    [
      '개시 초안을 쳐도',
      async (user) => {
        await user.type(within(openPane()).getByLabelText(t.fields.plannedDate), '2026-08-12');
      },
    ],
  ])('%s 라인 초안이 남는다', async (_label, act) => {
    /*
     * **라인 응답이 부를 때마다 달라지게 둔다.** 같은 본문이 오면 캐시가 구조 공유로 같은
     * 참조를 유지해, 되돌림 의존성에 응답을 넣어도 effect가 돌지 않는다 — 그러면 이 단언이
     * 무엇도 재지 못한다(PR ①의 `changingListRoute`가 목록에서 같은 함정을 밟은 자리).
     */
    const { user } = await setupAtLocation(
      allRoutes([
        changingLinesRoute(),
        { match: (request) => isGet(request, LOTS_PATH), respond: () => jsonResponse({ message: '' }, { status: 500 }) },
      ]),
    );

    await user.type(qtyField(1), '98');
    await act(user);

    await waitFor(() => {
      expect(qtyField(1)).toHaveValue('98');
    });
  });

  /*
   * **수명 표 5행 — 반대 방향.** 위치가 바뀌면 초안은 뜻을 잃는다.
   * 남으면 다른 위치의 같은 순번 줄에 앞 위치의 수량이 실린다.
   */
  it('위치를 바꾸면 라인 초안이 비워진다', async () => {
    const { user } = await setupAtLocation();

    await user.type(qtyField(1), '98');

    await user.click(screen.getByLabelText(t.fields.location));
    await user.click(screen.getByRole('option', { name: t.values.locationNotChosen }));

    await waitFor(() => {
      expect(currentLocation()).not.toContain('loc=');
    });

    await user.click(screen.getByLabelText(t.fields.location));
    await user.click(screen.getByRole('option', { name: LOCATION_LABEL }));

    await waitForLines();

    expect(qtyField(1)).toHaveValue('');
  });

  /** 취소는 **버릴 것이 있을 때만** 확인을 받고, 그 창은 라인 초안만 버린다. */
  it('취소를 누르면 확인 창을 거쳐 라인 초안만 버린다', async () => {
    fillCodeLists();

    const { user } = await setupAtLocation();

    await user.type(within(openPane()).getByLabelText(t.fields.plannedDate), '2026-08-12');
    await user.type(qtyField(1), '98');

    await user.click(within(detailPane()).getByRole('button', { name: messages.common.cancel }));
    await user.click(screen.getByRole('button', { name: t.actions.discardDraft }));

    expect(qtyField(1)).toHaveValue('');
    /* 개시 초안은 남는다 — 서로 다른 것을 가리키는 두 초안이다. */
    expect(within(openPane()).getByLabelText(t.fields.plannedDate)).toHaveValue('2026-08-12');
  });

  /*
   * **감지기 M42** — 파기 확인 창이 열린 채 **주소로 대상이 바뀌면** 창이 닫힌다.
   *
   * **축을 열거해 각각 센다**(PR ② 승계의 격상 규칙). PR ②는 넷이었고 위치가 생기면서
   * **다섯**이 됐다 — 「위치 고르기」가 늘어난 축이다. 좁은 앵커 하나로 갈음하면 나머지 축이
   * 그대로 빠져나간다.
   */
  it.each<[string, string]>([
    ['조건 변경·조회', 'wh=9101'],
    ['초기화', ''],
    ['쪽 이동', 'page=2'],
    ['실사 고르기', 'ct=9003'],
    ['위치 고르기', `ct=9001&loc=9702`],
  ])('파기 창이 열린 채 %s가 일어나면 창이 닫힌다', async (_label, to) => {
    const { user } = await setupAtLocation(allRoutes(), AT_LOCATION, to);

    await user.type(qtyField(1), '98');
    await user.click(within(detailPane()).getByRole('button', { name: messages.common.cancel }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});

describe('StocktakingScreen — 블라인드 실사', () => {
  /**
   * 블라인드 실사를 고른 상태. 상세는 `blindCount: true`이고 라인 응답에는 **장부·차이 수량이
   * 아예 오지 않는다**(계약 설명 — 결정 4 · 어긋남 1).
   */
  const blindRoutes = (): StubRoute[] =>
    allRoutes([
      detailRoute(DETAIL_PATH, countDetailBody({ blindCount: true })),
      linesRoute(
        LINES_PATH,
        countLineFixtures.map((line) => {
          const { systemQty: _s, varianceQty: _v, ...rest } = line;

          return rest;
        }),
      ),
    ]);

  /*
   * **완료 조건 C42 · 감지기 M30** — 화면이 실사 헤더의 블라인드 여부를 표로 **실제로
   * 넘기는가.** 부품 테스트는 `isBlind` prop을 직접 주므로 그 배선이 끊겨도 통과한다.
   */
  it('장부 수량 열과 차이 열이 함께 없다', async () => {
    renderScreen(blindRoutes(), AT_LOCATION);

    await waitForLines();

    expect(within(lineTable()).queryByText(t.lineTable.systemQty)).not.toBeInTheDocument();
    expect(within(lineTable()).queryByText(t.lineTable.variance)).not.toBeInTheDocument();
    /* 짝 방향 — 나머지 열은 그대로 있다(표가 통째로 사라져서 통과하는 것이 아니다). */
    expect(within(lineTable()).getByText(t.lineTable.countedQty)).toBeInTheDocument();
    expect(within(lineTable()).getByText(t.lineTable.reason)).toBeInTheDocument();
  });

  /*
   * **완료 조건 C39** — 블라인드에서는 **사유를 필수로 만들지 않는다.** 장부가 없어 견줄 값이
   * 없는데 없는 값을 0으로 보고 판정하면 **전 줄이 차이 있는 줄**이 되어, 코드 목록이 확정되지
   * 않은 지금은 블라인드 실사의 저장이 통째로 막힌다.
   */
  /*
   * **M-10(검증 담당 지적) — 「블라인드는 헤더가 정한다」의 갈리는 상태.**
   *
   * 지금까지의 픽스처에서는 블라인드 헤더와 `systemQty` 부재가 **늘 함께** 와서, 헤더로 판정하든
   * 줄마다 판정하든 같은 답이 나왔다 — 두 판정을 가를 자료가 없었다.
   *
   * **계약과 런타임이 어긋나는 자리를 그대로 만든다**(결정 4 · 어긋남 1): `systemQty`는
   * `required`인데 설명은 「블라인드 실사에서는 내려보내지 않는다」다. **비블라인드 실사인데
   * 어떤 줄의 수량이 빠져 오는** 상태가 그 어긋남의 실물이고, 그때 줄마다 판정하면
   * **장부·차이 열이 통째로 사라진다** — 사용자는 열이 왜 없는지 화면 어디에서도 읽을 수 없다.
   *
   * 열은 **실사 헤더가 정하고**, 값이 빠진 줄은 **그 줄이 사정을 밝힌다**. 둘은 다른 층이다.
   */
  it.each<[string, unknown[], number]>([
    [
      '첫 줄만 빠져 와도',
      [blindCountLineResponse(), countLineFixtures[1], countLineFixtures[2]],
      2,
    ],
    /*
     * **전 줄이 빠져 오는 판까지 센다.** 「첫 줄로 판정」·「하나라도 빠지면」은 위 판이 잡지만
     * **「전 줄이 빠져야 블라인드」**는 빠져나간다 — 규칙이 「헤더가 정한다」이므로 잣대도
     * 줄 판정이 취할 수 있는 **형태 전체**를 덮어야 한다(승계의 격상 규칙).
     */
    [
      '전 줄이 빠져 와도',
      [
        blindCountLineResponse(),
        blindCountLineResponse({ inventoryCountLineId: 9402, lineNo: 2, lotId: null }),
        blindCountLineResponse({ inventoryCountLineId: 9403, lineNo: 3, uomId: 9502 }),
      ],
      6,
    ],
  ])('비블라인드 헤더에서는 %s 두 열이 남는다', async (_label, items, notProvidedCount) => {
    renderScreen(
      allRoutes([
        detailRoute(DETAIL_PATH, countDetailBody({ blindCount: false })),
        linesRoute(LINES_PATH, items),
      ]),
      AT_LOCATION,
    );

    await waitForLines();

    /* 헤더가 비블라인드이므로 두 열은 그대로 있다. */
    expect(within(lineTable()).getByText(t.lineTable.systemQty)).toBeInTheDocument();
    expect(within(lineTable()).getByText(t.lineTable.variance)).toBeInTheDocument();

    /*
     * 짝 방향 — 값이 빠진 줄은 **그 두 칸에서** 사정을 밝힌다(열이 사라져서 통과하는 것이
     * 아니다). 줄마다 두 칸이므로 건수가 줄 수의 두 배다.
     */
    expect(screen.getAllByText(t.values.qtyNotProvided)).toHaveLength(notProvidedCount);
  });

  /*
   * 짝 방향의 나머지 절반 — **값이 온 줄은 그대로 읽힌다.** 위 두 판이 「없음」만 세므로
   * 이 단언이 없으면 「전 줄이 없음으로 찍혀도」 통과한다.
   * 단위는 참조가 푸는 「코드 · 이름」이다(부품 테스트가 주는 짧은 라벨과 다르다).
   */
  it('값이 온 줄의 장부 수량은 단위와 함께 읽힌다', async () => {
    renderScreen(
      allRoutes([
        detailRoute(DETAIL_PATH, countDetailBody({ blindCount: false })),
        linesRoute(LINES_PATH, [
          blindCountLineResponse(),
          countLineFixtures[1],
          countLineFixtures[2],
        ]),
      ]),
      AT_LOCATION,
    );

    await waitForLines();

    expect(await screen.findByText(t.lineTable.qtyWithUom('40', UOM_LABEL))).toBeInTheDocument();
  });

  /*
   * **리뷰 R-1(Major)이 고친 자리 — 블라인드는 열뿐 아니라 규칙에도 헤더가 정한다.**
   *
   * 계약에서 `systemQty`는 **필수**이고 「블라인드에서는 내려보내지 않는다」는 **설명문**뿐이다
   * (결정 4 · 어긋남 1) — **스키마를 따르는 서버는 블라인드에서도 값을 보낸다.**
   * 그때 줄의 값으로만 사유 필수를 끊으면 화면은 **열은 감춰 놓고 전 줄에 사유를 요구하고**,
   * 코드 목록이 확정되지 않은 지금은 **블라인드 실사의 저장이 통째로 막힌다** —
   * 사용자는 장부도 차이도 볼 수 없어 왜 막혔는지 화면 어디에서도 읽을 수 없다.
   */
  it('장부가 실려 와도 블라인드 헤더면 사유를 요구하지 않는다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([
        detailRoute(DETAIL_PATH, countDetailBody({ blindCount: true })),
        /* **값이 실려 온다** — 열은 감춰지지만 줄에는 장부 수량이 그대로 있다. */
        linesRoute(LINES_PATH, countLineFixtures),
      ]),
      AT_LOCATION,
    );

    await waitForLines();

    /* 열은 헤더가 정한 대로 감춰진다. */
    expect(within(lineTable()).queryByText(t.lineTable.systemQty)).not.toBeInTheDocument();

    /* 장부(100·40·7)와 **다른** 값을 친다 — 줄로 판정하면 전 줄이 차이 있는 줄이 된다. */
    await user.type(qtyField(1), '98');
    await user.type(qtyField(2), '41');
    await user.type(qtyField(3), '0');

    expect(screen.queryByText(t.actionReasons.saveReasonListPending)).not.toBeInTheDocument();
    expect(saveButton()).not.toBeDisabled();

    await user.click(saveButton());

    await waitFor(() => {
      expect(replaceRequests(requests)).toHaveLength(1);
    });
  });

  /*
   * **짝 방향** — 같은 줄·같은 입력이 **비블라인드 헤더**에서는 사유를 요구한다.
   * 이 단언이 없으면 「사유 판정을 통째로 없앤다」가 위 테스트를 통과한다.
   */
  it('같은 줄이라도 비블라인드 헤더면 사유를 요구한다', async () => {
    const { user } = renderScreen(
      allRoutes([
        detailRoute(DETAIL_PATH, countDetailBody({ blindCount: false })),
        linesRoute(LINES_PATH, countLineFixtures),
      ]),
      AT_LOCATION,
    );

    await waitForLines();

    await user.type(qtyField(1), '98');
    await user.type(qtyField(2), '41');
    await user.type(qtyField(3), '0');

    expect(screen.getByText(t.actionReasons.saveReasonListPending)).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it('사유 선택지가 비어 있어도 전 줄만 채우면 저장이 열린다', async () => {
    const { requests, user } = renderScreen(blindRoutes(), AT_LOCATION);

    await waitForLines();
    await user.type(qtyField(1), '98');
    await user.type(qtyField(2), '41');
    await user.type(qtyField(3), '0');

    expect(screen.queryByText(t.actionReasons.saveReasonListPending)).not.toBeInTheDocument();
    expect(saveButton()).not.toBeDisabled();

    await user.click(saveButton());

    await waitFor(() => {
      expect(replaceRequests(requests)).toHaveLength(1);
    });
  });
});

describe('StocktakingScreen — 저장 잠금', () => {
  /*
   * **완료 조건 C36 · 감지기 M38** — 전 줄을 채우기 전에는 저장이 잠기고 **남은 줄 수**가
   * 사유에 보인다. 눌러도 요청이 나가지 않는다(버튼이 잠겨 있어서 통과하는 것이 아니라,
   * 요청 수를 함께 센다).
   */
  it('전 줄을 채우기 전에는 저장이 잠기고 남은 줄 수가 보인다', async () => {
    const { requests, user } = await setupAtLocation();

    expect(saveButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.saveIncompleteQty(3))).toBeInTheDocument();

    await user.type(qtyField(1), '100');

    expect(screen.getByText(t.actionReasons.saveIncompleteQty(2))).toBeInTheDocument();

    await user.click(saveButton());

    expect(replaceRequests(requests)).toHaveLength(0);
  });

  /** **완료 조건 C37** — 0은 허용되고 음수는 막힌다. 계약이 `minimum: 0`이다. */
  it('0으로 전 줄을 채우면 저장이 열리고 음수는 막힌다', async () => {
    const { user } = await setupAtLocation();

    await user.type(qtyField(1), '0');
    await user.type(qtyField(2), '0');
    await user.type(qtyField(3), '0');

    /* 세 줄 다 장부와 달라져 사유가 필요하다 — 0이 「형식 오류」로 막힌 것이 아니다. */
    expect(screen.getByText(t.actionReasons.saveReasonListPending)).toBeInTheDocument();

    await user.clear(qtyField(1));
    await user.type(qtyField(1), '-1');

    expect(screen.getByText(t.actionReasons.saveInvalidQty(1))).toBeInTheDocument();
  });

  /*
   * **완료 조건 C38 · 감지기 M40 · 승인 G1** — 차이가 있는 줄이 있으면 사유 목록이 비어 있는
   * 동안 저장이 막히고, **배열이 차면 열린다.** 값이 확정되면 `code-options.ts`의 배열만
   * 채우면 된다는 약속이 이 전환이다.
   */
  it('차이가 있으면 사유 목록이 빌 때 막히고 차면 열린다', async () => {
    const { user } = await setupAtLocation();

    await user.type(qtyField(1), '98');
    await user.type(qtyField(2), '40');
    await user.type(qtyField(3), '7');

    expect(saveButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.saveReasonListPending)).toBeInTheDocument();

    /* 배열만 갈아 끼우고 화면을 다시 띄운다 — 실제로 값이 확정되면 이 한 가지만 달라진다. */
    cleanup();
    fillReasonList();

    const filled = await setupAtLocation();

    await filled.user.type(qtyField(1), '98');
    await filled.user.type(qtyField(2), '40');
    await filled.user.type(qtyField(3), '7');

    expect(screen.getByText(t.actionReasons.saveNeedsReason(1))).toBeInTheDocument();

    await filled.user.click(screen.getByLabelText(t.lineTable.reasonLabel(1)));
    await filled.user.click(screen.getByRole('option', { name: SAMPLE_REASON }));

    expect(saveButton()).not.toBeDisabled();
  });

  /*
   * **승인 G1의 갈림이 실물이 되는 자리** — 차이가 **없는** 위치는 사유 목록이 비어 있어도
   * 그대로 저장된다. 개시가 통째로 막히는 것(`countTypeCode`는 요청 필수)과 갈리는 지점이다.
   */
  it('차이가 없는 위치는 사유 목록이 비어 있어도 저장이 열린다', async () => {
    const { requests, user } = await setupAtLocation();

    await fillAllQty(user);

    expect(saveButton()).not.toBeDisabled();

    await user.click(saveButton());

    await waitFor(() => {
      expect(replaceRequests(requests)).toHaveLength(1);
    });
  });

  /*
   * **완료 조건 C34 · 감지기 M31** — 잘리면 **표식이 보이고 저장이 차단된다.**
   * 전 줄을 채웠어도 막힌다: 못 받은 줄은 채울 수조차 없기 때문이다.
   */
  it('라인이 잘리면 전 줄을 채워도 저장이 막힌다', async () => {
    const { requests, user } = await setupAtLocation(
      allRoutes([linesRoute(LINES_PATH, countLineFixtures, countLineFixtures.length + 1)]),
    );

    await fillAllQty(user);

    expect(screen.getByText(t.reasons.linesTruncated)).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.saveTruncated)).toBeInTheDocument();

    await user.click(saveButton());

    expect(replaceRequests(requests)).toHaveLength(0);
  });

  /*
   * **감지기 M37** — 줄이 하나도 없으면 보내지 않는다. 빈 배열은 그 위치를 통째로 미실사로
   * 되돌리는 요청이고 목 서버는 그것을 200으로 받는다(실측). 막는 곳이 화면뿐이다.
   */
  it('그 위치에 줄이 없으면 저장이 막힌다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([linesRoute(LINES_PATH, [])]),
      AT_LOCATION,
    );

    await screen.findByText(t.empty.noLinesTitle);

    expect(saveButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.saveNoLines)).toBeInTheDocument();

    await user.click(saveButton());

    expect(replaceRequests(requests)).toHaveLength(0);
  });

  /*
   * **승계 교훈 — 「버튼이 열려 있는데 보낼 수 없는 상태」를 만들어 본다**(완료 조건 C40).
   * 값 목록은 서버가 내려주므로 **51자짜리 코드가 선택지에 실릴 수 있다.**
   */
  it('사유가 50자를 넘으면 인라인 오류가 붙고 요청이 나가지 않는다', async () => {
    const tooLong = 'A'.repeat(51);

    cleanup();
    fillReasonList([tooLong]);

    const { requests, user } = await setupAtLocation();

    await user.type(qtyField(1), '98');
    await user.type(qtyField(2), '40');
    await user.type(qtyField(3), '7');

    await user.click(screen.getByLabelText(t.lineTable.reasonLabel(1)));
    await user.click(screen.getByRole('option', { name: tooLong }));

    expect(screen.getByText(t.errors.codeTooLong(50))).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();

    await user.click(saveButton());

    expect(replaceRequests(requests)).toHaveLength(0);
  });
});

describe('StocktakingScreen — 치환 요청', () => {
  /*
   * **완료 조건 C44·C45** — 본문이 넷이고 `lines`가 **표에 있는 전 줄**이며 값이 표의 줄에서
   * 온다. 단위 테스트가 조립을 재고, 여기서는 **실제로 나간 본문**을 잰다.
   */
  it('보낸 본문이 위치·영업일·발생 시각·전 줄이다', async () => {
    const { requests, user } = await setupAtLocation();

    await fillAllQty(user);
    await user.click(saveButton());

    await waitFor(() => {
      expect(replaceRequests(requests)).toHaveLength(1);
    });

    const body = replaceRequests(requests)[0]?.body as {
      locationId: number;
      businessDate: string;
      occurredAt: string;
      lines: { inventoryCountLineId: number; countedQty: number }[];
    };

    expect(Object.keys(body).sort()).toEqual([
      'businessDate',
      'lines',
      'locationId',
      'occurredAt',
    ]);
    expect(body.locationId).toBe(LOCATION_ID);
    expect(body.lines).toHaveLength(countLineFixtures.length);
    expect(body.lines.map((line) => line.inventoryCountLineId)).toEqual(
      countLineFixtures.map((line) => line.inventoryCountLineId),
    );
    expect(body.lines.map((line) => line.countedQty)).toEqual([100, 40, 7]);
  });

  /*
   * **완료 조건 C46** — 낙관적 잠금이 **선택**이다(실측). 상세 조회가 토큰을 남겼으면 싣는다.
   * 개시(`If-Match` 없음)·마감(필수)과 갈리는 자리다.
   */
  it('상세가 준 토큰을 If-Match에 싣는다', async () => {
    const { requests, user } = await setupAtLocation(
      allRoutes([
        {
          match: (request) => isGet(request, DETAIL_PATH),
          respond: () => jsonResponse(countDetailBody(), { headers: { ETag: '"7"' } }),
        },
      ]),
    );

    await fillAllQty(user);
    await user.click(saveButton());

    await waitFor(() => {
      expect(replaceRequests(requests)).toHaveLength(1);
    });

    expect(replaceRequests(requests)[0]?.headers.get('If-Match')).toBe('"7"');
    expect(replaceRequests(requests)[0]?.headers.get('Idempotency-Key')).not.toBeNull();
  });

  /**
   * **토큰이 없어도 보낸다.** 계약이 「오프라인에서도 쓰는 오퍼레이션에서는 선택이다」라 적었고
   * (현장 단말이 같은 경로를 쓴다), 공통 훅의 「없으면 멈춘다」 규약을 그대로 쓰면 이 화면은
   * 토큰이 없다는 이유로 **저장 자체를 못 한다.**
   */
  it('토큰이 없어도 보낸다', async () => {
    const { requests, user } = await setupAtLocation();

    await fillAllQty(user);
    await user.click(saveButton());

    await waitFor(() => {
      expect(replaceRequests(requests)).toHaveLength(1);
    });

    expect(replaceRequests(requests)[0]?.headers.has('If-Match')).toBe(false);
    expect(screen.queryByText(messages.save.staleToken)).not.toBeInTheDocument();
  });

  /*
   * **감지기 M46** — 표에서 **사라진 줄**의 초안은 실리지 않는다. 다시 조회로 줄 집합이 줄어든
   * 뒤에도 초안 키는 남아 있는데, 요청 조립이 표의 줄과 교차로 걸러 낸다.
   */
  it('표에서 사라진 줄은 요청에 실리지 않는다', async () => {
    const { requests, user } = await setupAtLocation(allRoutes([shrinkingLinesRoute()]));

    await fillAllQty(user);
    await user.click(screen.getByRole('button', { name: t.actions.refresh }));

    await waitFor(() => {
      expect(screen.queryByLabelText(t.lineTable.countedQtyLabel(3))).not.toBeInTheDocument();
    });

    /* 남은 두 줄의 초안은 그대로다(수명 표 10행) — 그래서 곧바로 저장할 수 있다. */
    expect(qtyField(1)).toHaveValue('100');

    await user.click(saveButton());

    await waitFor(() => {
      expect(replaceRequests(requests)).toHaveLength(1);
    });

    const body = replaceRequests(requests)[0]?.body as {
      lines: { inventoryCountLineId: number }[];
    };

    expect(body.lines).toHaveLength(2);
    expect(body.lines.map((line) => line.inventoryCountLineId)).not.toContain(9403);
  });
});

describe('StocktakingScreen — 저장 성공', () => {
  const saveOne = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
    await fillAllQty(user);
    await user.click(saveButton());
    await screen.findByRole('status', { name: t.result.savedLabel });
  };

  /*
   * **완료 조건 C47 · 감지기 M47 · 승인 13-7** — 성공 뒤 **상세와 라인을 함께** 다시 읽는다.
   * 치환 200 응답에 `ETag`가 없어(실측) 마감의 `If-Match`가 낡고 요약 4칸도 낡는다 —
   * 라인만 다시 부르면 **요약이 낡은 채로 마감 버튼의 활성 여부를 정한다.**
   */
  it('성공 뒤 상세와 라인을 함께 다시 읽는다', async () => {
    const { requests, user } = await setupAtLocation();

    const detailBefore = requestsTo(requests, DETAIL_PATH).length;
    const linesBefore = lineRequests(requests).filter((request) => request.method === 'GET').length;

    await saveOne(user);

    await waitFor(() => {
      expect(requestsTo(requests, DETAIL_PATH).length).toBeGreaterThan(detailBefore);
    });
    await waitFor(() => {
      expect(
        lineRequests(requests).filter((request) => request.method === 'GET').length,
      ).toBeGreaterThan(linesBefore);
    });
  });

  /** 초안이 비고 `loc`가 유지된다(수명 표 13행) — 방금 무엇을 저장했는지 화면에 남는다. */
  it('성공하면 초안이 비고 고른 위치가 남는다', async () => {
    const { user } = await setupAtLocation();

    await saveOne(user);

    expect(currentLocation()).toContain(`loc=${String(LOCATION_ID)}`);
    expect(qtyField(1)).toHaveValue('');
  });

  /** 결과 구획이 **서버가 되돌려 준 줄 수**와 위치 이름을 낸다. */
  it('결과 구획이 치환한 위치와 줄 수를 낸다', async () => {
    const { user } = await setupAtLocation();

    await saveOne(user);

    const result = screen.getByRole('status', { name: t.result.savedLabel });

    expect(within(result).getByText(LOCATION_LABEL)).toBeInTheDocument();
    expect(
      within(result).getByText(t.result.savedCount(countLineFixtures.length)),
    ).toBeInTheDocument();
  });

  /*
   * **수명 표 5행 — 결과가 매이는 축이 둘이다.** 같은 실사 안에서 위치만 옮겨도 앞 위치의
   * 저장 결과가 사라져야 한다. 축을 `ct` 하나로 두면 새 위치의 라인 표 아래에 그대로 서 있다.
   */
  it('위치를 바꾸면 저장 결과가 사라진다', async () => {
    const { user } = await setupAtLocation();

    await saveOne(user);

    await user.click(screen.getByLabelText(t.fields.location));
    await user.click(screen.getByRole('option', { name: t.values.locationNotChosen }));

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: t.result.savedLabel })).not.toBeInTheDocument();
    });
  });

  /** **수명 표 10행** — 「다시 조회」는 값을 버리려고 누르는 것이 아니다. 결과가 남는다. */
  it('다시 조회해도 저장 결과가 남는다', async () => {
    const { user } = await setupAtLocation();

    await saveOne(user);
    await user.click(screen.getByRole('button', { name: t.actions.refresh }));

    expect(screen.getByRole('status', { name: t.result.savedLabel })).toBeInTheDocument();
  });
});

describe('StocktakingScreen — 저장 실패', () => {
  /*
   * **완료 조건 C48** — 실패가 **네 갈래**이고 문구가 서로 다르며 **입력이 남는다.**
   * 개시(세 갈래)와 갈리는 자리는 **409**다 — 낙관적 잠금이 선택으로나마 있기 때문이다.
   */
  it.each<[string, number, string]>([
    ['검증 실패', 400, '실물 수량을 확인하세요.'],
    ['권한 없음', 403, messages.httpError.forbidden],
    ['저장 충돌', 409, messages.conflict.user],
  ])('%s면 그 사유를 내고 입력이 남는다', async (_label, status, expected) => {
    const body =
      status === 400
        ? { errors: [{ scope: 'screen', code: 'INVALID', message: '실물 수량을 확인하세요.' }] }
        : status === 409
          ? { conflictCause: 'user' }
          : { message: '' };

    const { user } = await setupAtLocation(allRoutes([failingReplaceRoute(status, body)]));

    await fillAllQty(user);
    await user.click(saveButton());

    await screen.findByText(expected);

    expect(qtyField(1)).toHaveValue('100');
    expect(screen.queryByRole('status', { name: t.result.savedLabel })).not.toBeInTheDocument();
  });

  /*
   * **훑기로 찾은 사각** — 서버가 **줄에 붙는 필드 오류**를 주는 갈래.
   *
   * 이 화면은 표 안 입력칸을 줄마다 갖는데 계약이 **줄마다의 오류를 어떤 이름으로 주는지
   * 정하지 않았다**(실측). 그래서 화면이 아는 필드를 두지 않고 **전부 배너로 올린다**
   * (`queries.ts`의 `knownFields: []`). 그 목록에 이름을 하나라도 채우면 그 오류가 인라인으로
   * 분류되는데 **인라인으로 낼 자리가 없어 조용히 사라진다** — 사용자에게는 「저장을 눌렀는데
   * 아무 일도 없다」로 보인다. 개시 폼(PR ②)과 정반대로 가는 자리라 잣대를 세워 둔다.
   */
  it('서버가 줄에 붙인 필드 오류도 삼키지 않고 배너로 낸다', async () => {
    const { user } = await setupAtLocation(
      allRoutes([
        failingReplaceRoute(400, {
          errors: [
            {
              scope: 'field',
              code: 'INVALID',
              field: 'countedQty',
              message: '2번 줄 실물 수량을 확인하세요.',
            },
          ],
        }),
      ]),
    );

    await fillAllQty(user);
    await user.click(saveButton());

    expect(await screen.findByText('2번 줄 실물 수량을 확인하세요.')).toBeInTheDocument();
  });

  it('응답이 오지 않으면 다시 보내기 전에 확인하라고 밝힌다', async () => {
    const { user } = await setupAtLocation(allRoutes([offlineReplaceRoute()]));

    await fillAllQty(user);
    await user.click(saveButton());

    await screen.findByText(t.notes.saveRecheck);

    expect(qtyField(1)).toHaveValue('100');
  });

  /*
   * **짝 방향 — 응답이 온 실패에는 그 한 줄을 붙이지 않는다**(개시가 세운 형태).
   *
   * 붙이면 **늘 참인 안내**가 된다: 서버가 400으로 「이 값은 못 받는다」고 답한 경우에도
   * 「저장됐는지 다시 조회로 확인하세요」가 서서, 사용자는 **나가지도 않은 저장**을 확인하러
   * 간다. 응답 없음 갈래만 재는 단언은 이 뒤집힘을 보지 못한다 — 갈래를 가르는 것이
   * 이 한 줄의 전부이므로 양쪽을 함께 센다.
   */
  it('응답이 온 실패에는 그 안내를 붙이지 않는다', async () => {
    const { user } = await setupAtLocation(allRoutes([failingReplaceRoute(403)]));

    await fillAllQty(user);
    await user.click(saveButton());

    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.queryByText(t.notes.saveRecheck)).not.toBeInTheDocument();
  });

  /*
   * **감지기 M48** — **409에만** 「최신 불러오기」를 낸다. 다시 읽어야 풀리는 것은 충돌뿐이고,
   * 다른 오류에 내면 사용자가 **입력만 버리게 된다.**
   */
  it.each<[string, number, boolean]>([
    ['저장 충돌', 409, true],
    ['검증 실패', 400, false],
    ['권한 없음', 403, false],
  ])('%s에서 최신 불러오기가 %s', async (_label, status, shown) => {
    const body = status === 409 ? { conflictCause: 'user' } : { message: '' };

    const { user } = await setupAtLocation(allRoutes([failingReplaceRoute(status, body)]));

    await fillAllQty(user);
    await user.click(saveButton());

    await screen.findByRole('alert');

    const reload = screen.queryByRole('button', { name: messages.conflict.reloadAction });

    expect(reload === null).toBe(!shown);
  });

  /*
   * **승계 교훈 — 「성공 뒤 실패」 순서를 만든다.** 실패 테스트가 늘 빈 화면에서 시작하면
   * 「실패하면 결과 구획을 비운다」(수명 표 14행)가 아무것도 재지 못한다.
   */
  it('성공한 뒤 실패하면 결과 구획이 비고 창이 서 있지 않다', async () => {
    const { user } = await setupAtLocation(allRoutes([replaceThenForbiddenRoute()]));

    await fillAllQty(user);
    await user.click(saveButton());
    await screen.findByRole('status', { name: t.result.savedLabel });

    await fillAllQty(user);
    await user.click(saveButton());

    await screen.findByText(messages.httpError.forbidden);

    expect(screen.queryByRole('status', { name: t.result.savedLabel })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('StocktakingScreen — 저장 중 잠금', () => {
  /*
   * **감지기 M41의 첫째 겹 — 컨트롤 잠금.** 전송 중에는 대상을 바꾸는 길과 표 안 두 칸이
   * 함께 잠기고, 연타해도 요청이 1회다(공통 훅이 호출마다 새 멱등 키를 만든다 — 이슈 #55).
   */
  it('저장 중에는 대상을 바꿀 수 없고 연타해도 요청이 1회다', async () => {
    const { requests, release, user } = await setupAtLocation(
      allRoutes(),
      AT_LOCATION,
      '',
      isReplaceRequest,
    );

    await fillAllQty(user);
    await user.click(saveButton());

    await waitFor(() => {
      expect(replaceRequests(requests)).toHaveLength(1);
    });

    expect(saveButton()).toBeDisabled();
    expect(screen.getByLabelText(t.fields.location)).toBeDisabled();
    expect(qtyField(1)).toBeDisabled();
    expect(screen.getByLabelText(t.lineTable.reasonLabel(1))).toBeDisabled();
    expect(within(listPane()).getByRole('button', { name: messages.common.search })).toBeDisabled();
    expect(
      within(listPane()).getByRole('button', { name: t.actions.deselectRow('IC-2026-900011') }),
    ).toBeDisabled();
    expect(
      within(detailPane()).getByRole('button', { name: messages.common.cancel }),
    ).toBeDisabled();

    await user.click(saveButton());

    expect(replaceRequests(requests)).toHaveLength(1);

    release();

    await screen.findByRole('status', { name: t.result.savedLabel });
  });

  /*
   * **M-9(검증 담당 지적) — 「어느 쓰기가 나가는 중인가」도 축이다.**
   *
   * 저장 버튼에는 잠금 겹이 **셋**이다: `loading={replace.isSaving}`(설치본 `Button`이
   * `disabled`와 합친다 — 실측) · `|| isLocked` · `submitSave`의 핸들러 가드.
   * **치환이 나가는 중**에는 셋이 서로를 덮어 하나를 빼도 관측되지 않는다(정상적 다중 방어).
   * 그런데 **개시가 나가는 중**에는 `loading`이 거짓이라 **`|| isLocked` 하나만** 남는다 —
   * 그 판을 재는 자리가 없으면 겹 하나가 조용히 사라져도 아무도 모른다.
   *
   * 무너지면 개시가 나가는 동안 저장을 눌러 **되돌릴 수 없는 쓰기와 파괴적 쓰기가 동시에**
   * 나간다. 공통 훅이 호출마다 새 멱등 키를 만들어 서버는 둘을 별개의 요청으로 본다.
   *
   * **`submitSave`의 `isLocked` 가드를 「등가」로 분류하는 전제도 이 단언이다** — 첫째 겹이
   * 여기서 고정돼야 둘째 겹을 등가로 둘 수 있다(승계 규칙: 첫째 겹의 감지기를 먼저 확인한다).
   */
  it('개시가 나가는 중에도 저장 버튼이 잠긴다', async () => {
    fillCodeLists();

    const { requests, release, user } = await setupAtLocation(
      allRoutes(),
      AT_LOCATION,
      '',
      isOpenRequest,
    );

    await fillAllQty(user);

    /* 짝 방향 — 보내기 전에는 열려 있다(늘 잠겨 있어서 통과하는 것이 아니다). */
    expect(saveButton()).not.toBeDisabled();

    await fillOpenDraft(user);
    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: t.actions.confirmOpen }));

    await waitFor(() => {
      expect(openRequests(requests)).toHaveLength(1);
    });

    expect(saveButton()).toBeDisabled();

    /*
     * **치환은 나가는 중이 아니다.** 이 줄이 이 테스트의 요점이다 — `loading` 겹이 서 있지
     * 않은 판이라 `|| isLocked` 하나만 재고 있다.
     */
    expect(replaceRequests(requests)).toHaveLength(0);

    /* 표 안 두 칸과 위치 선택칸도 같은 이유로 함께 잠긴다. */
    expect(qtyField(1)).toBeDisabled();
    expect(screen.getByLabelText(t.fields.location)).toBeDisabled();

    release();

    await waitFor(() => {
      expect(currentLocation()).toContain(`ct=${String(OPENED_COUNT_ID)}`);
    });
  });

  /*
   * **리뷰 R-4가 고친 자리 — 전송 중 주소 편집.**
   *
   * 전송 중 잠금은 컨트롤과 핸들러 두 겹인데 **뒤로가기·앞으로가기·주소 직접 편집은 그 둘을
   * 다 거치지 않는다**(W-01-10 R-1이 확인 창으로 실증한 형태). 그 길로 위치가 풀리면
   * 응답이 뒤에 도착해 **클릭 시점 클로저의 옛 위치**로 결과를 세우고, 「위치를 고르면 라인이
   * 보입니다」 빈 상태 **아래에 앞 위치의 저장 결과**가 선다.
   *
   * 결과 정리 effect는 이 갈래를 잡지 못한다 — 주소가 바뀐 시점에 이미 돌았고 그때 결과는
   * 비어 있었다(`submitSave`가 비웠다). **세우는 자리**가 대상을 한 번 더 대조해야 한다.
   */
  it('저장 중 주소로 위치가 풀리면 앞 위치의 결과가 서지 않는다', async () => {
    const { requests, release, user } = await setupAtLocation(
      allRoutes(),
      AT_LOCATION,
      'ct=9001',
      isReplaceRequest,
    );

    await fillAllQty(user);
    await user.click(saveButton());

    await waitFor(() => {
      expect(replaceRequests(requests)).toHaveLength(1);
    });

    const detailBefore = requestsTo(requests, DETAIL_PATH).length;

    /* 잠금 두 겹을 다 거치지 않는 길 — 주소만 바뀐다. */
    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await screen.findByText(t.empty.noLocationTitle);

    release();

    /* 응답이 도착해 성공 처리가 끝난 것을 **긍정 단언**으로 기다린다(무효화가 상세를 다시 부른다). */
    await waitFor(() => {
      expect(requestsTo(requests, DETAIL_PATH).length).toBeGreaterThan(detailBefore);
    });

    expect(screen.queryByRole('status', { name: t.result.savedLabel })).not.toBeInTheDocument();
    /* 짝 방향 — 화면은 「위치를 고르지 않았다」를 그대로 말하고 있다. */
    expect(screen.getByText(t.empty.noLocationTitle)).toBeInTheDocument();
  });

  /*
   * **감지기 M41의 둘째 겹 — 경로 가드 단독.** 조건 칩의 ×는 디자인 시스템이 잠금을 받지 않아
   * (`StatusChipProps`에 `disabled`가 없다 — 실측) 전송 중에도 눌린다. 그 길로 들어오면 조건이
   * 바뀌면서 `ct`·`loc`가 풀리고 **앞 요청의 결과가 다른 맥락에 나타난다.**
   */
  it('저장 중에는 잠금을 받지 않는 조건 칩의 ×로도 대상이 바뀌지 않는다', async () => {
    const { requests, release, user } = await setupAtLocation(
      allRoutes(),
      `${AT_LOCATION}&wh=9101`,
      '',
      isReplaceRequest,
    );

    await fillAllQty(user);
    await user.click(saveButton());

    await waitFor(() => {
      expect(replaceRequests(requests)).toHaveLength(1);
    });

    const before = currentLocation();
    const removeChip = within(listPane()).getByRole('button', {
      name: t.filters.chipRemoveWarehouse,
    });

    /* 짝 방향 — 이 버튼은 실제로 눌린다(잠겨 있어서 아무 일도 안 나는 것이 아니다). */
    expect(removeChip).not.toBeDisabled();

    await user.click(removeChip);

    expect(currentLocation()).toBe(before);

    release();

    await screen.findByRole('status', { name: t.result.savedLabel });
  });
});

describe('StocktakingScreen — 마감 잠금과 활성', () => {
  /*
   * **완료 조건 C51·C52·C53 · 감지기 M54·M55** — 마감은 **요약 두 숫자로만** 열린다.
   *
   * 계획 §11.4가 지목한 요약 네 벌을 그대로 센다. 화면 수준에서 재는 이유는 **잣대가 요약에서
   * 버튼까지 이어져 있는지**가 여기서만 관측되기 때문이다 — 단위 테스트는 판정 함수가 옳다는
   * 것까지만 말하고, 그 답이 실제로 버튼에 닿았는지는 말하지 않는다.
   */
  it.each<[string, Record<string, number>, string | null]>([
    ['둘 다 0이면', CLOSABLE_SUMMARY, null],
    ['미실사가 남으면', { ...CLOSABLE_SUMMARY, uncountedCount: 60 }, t.actionReasons.closeUncounted(60)],
    ['차이가 남으면', { ...CLOSABLE_SUMMARY, varianceCount: 12 }, t.actionReasons.closeVariance(12)],
    [
      '둘 다 남으면',
      { ...CLOSABLE_SUMMARY, uncountedCount: 60, varianceCount: 12 },
      t.actionReasons.closeUncounted(60),
    ],
  ])('%s 마감이 그에 맞게 열리고 잠긴다', async (_label, summary, reason) => {
    await setupClosable(allRoutes([closableDetailRoute(DETAIL_PATH, summary), closingRoute()]));

    if (reason === null) {
      expect(closeButton()).not.toBeDisabled();
      expect(closeButton().getAttribute('aria-describedby')).toBeNull();

      return;
    }

    expect(closeButton()).toBeDisabled();
    expect(within(detailPane()).getByText(reason)).toBeInTheDocument();
    /* 잠긴 컨트롤은 포커스를 받지 못한다 — 사유를 이어 두어야 읽힌다(배치 규범 4). */
    expect(closeButton().getAttribute('aria-describedby')).not.toBeNull();
  });

  /*
   * **상태 코드로 분기하지 않는다**(공유계약 G-2 · 계획 결정 2). 요약이 같으면 상태 코드가
   * 달라도 판정이 같아야 한다 — 값 집합이 확정되지 않아(`omf-mes#64`) 코드로 「마감할 수 있는
   * 상태」를 가르면 값이 정해질 때 **조용히 틀린다.**
   *
   * 픽스처가 실제로 쓰는 코드 둘로 센다. 한 값만 재면 그 값에만 붙는 분기를 넣어도 통과한다.
   */
  it.each(['SAMPLE_COUNT_STATUS_A', 'SAMPLE_COUNT_STATUS_B'])(
    '상태 코드가 %s여도 요약이 조건을 채우면 마감이 열린다',
    async (statusCode) => {
      await setupClosable(
        allRoutes([
          closableDetailRoute(DETAIL_PATH, CLOSABLE_SUMMARY, { statusCode }),
          closingRoute(),
        ]),
      );

      /* 짝 방향 — 그 코드가 실제로 화면에 서 있다(다른 실사를 보고 통과하는 것이 아니다). */
      expect(within(detailPane()).getByText(statusCode)).toBeInTheDocument();
      expect(closeButton()).not.toBeDisabled();
    },
  );

  /*
   * **계약이 필수라 말한 값이 응답에서 빠져 오는 판**(승계 — 라인의 장부 수량에서 이미 겪은
   * 어긋남). 마감 판정의 근거가 요약 4칸뿐이라, 건수가 수로 오지 않으면 `> 0`이 조용히 거짓이
   * 되어 **마감이 열린다** — 되돌릴 수 없는 쓰기가 근거 없이 나가는 길이다.
   *
   * 두 축을 갈라 센다. 화면 배선에도 만드는 것이 요점이다 — 단위에만 두면 그 방어가 버튼까지
   * 닿았는지 아무도 모른다.
   */
  it.each(['uncountedCount', 'varianceCount'])(
    '요약에서 %s가 빠져 오면 마감이 잠긴다',
    async (field) => {
      const partial: Record<string, number> = { ...CLOSABLE_SUMMARY };

      delete partial[field];

      await setupClosable(
        allRoutes([
          {
            /*
             * **요약 묶음을 통째로 갈아 끼운다.** 픽스처의 덮어쓰기 통로로는 키를 뺄 수 없다 —
             * 기본값 위에 얹는 구조라 빠뜨린 키가 기본값으로 되메워진다.
             */
            match: (request) => isGet(request, DETAIL_PATH),
            respond: () =>
              jsonResponse(
                { ...countDetailBody({}, CLOSABLE_SUMMARY), summary: partial },
                { headers: { ETag: DETAIL_ETAG } },
              ),
          },
          closingRoute(),
        ]),
      );

      expect(closeButton()).toBeDisabled();
      expect(
        within(detailPane()).getByText(t.actionReasons.closeSummaryUnavailable),
      ).toBeInTheDocument();
    },
  );

  /*
   * **짝 방향** — 같은 화면에서 값이 다 오면 열린다. 이것이 없으면 「늘 잠긴다」로 바꿔도
   * 위 단언들이 전부 통과한다.
   */
  it('요약이 다 오면 같은 화면에서 마감이 열린다', async () => {
    await setupClosable();

    expect(closeButton()).not.toBeDisabled();
    expect(
      within(detailPane()).queryByText(t.actionReasons.closeSummaryUnavailable),
    ).not.toBeInTheDocument();
  });

  /* 마감은 **실사 하나에 대한 것**이라 위치를 고르지 않아도 자리에 있다(단계 S1). */
  it('위치를 고르지 않아도 마감 액션이 서 있다', async () => {
    await setupClosable();

    expect(closeButton()).toBeInTheDocument();
    expect(screen.getByText(t.empty.noLocationTitle)).toBeInTheDocument();
  });
});

describe('StocktakingScreen — 마감 확인 창', () => {
  /*
   * **완료 조건 C54** — 확인 창이 먼저 뜨고 **확인하기 전에는 요청이 0회**다.
   * 마감은 되돌릴 수 없으므로 버튼에서 곧바로 보내면 무엇을 마감하는지 볼 기회 자체가 없다.
   */
  it('마감을 누르면 창이 먼저 뜨고 요청이 나가지 않는다', async () => {
    const { requests, user } = await setupClosable();

    await user.click(closeButton());

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(closeRequests(requests)).toHaveLength(0);
  });

  /*
   * **완료 조건 C55** — 창이 **요약 4칸과 되돌릴 수 없음**을 밝히고 **선택칸이 없다**(#45).
   * 부품 테스트가 창의 구성을 재고, 여기서는 **화면이 실제로 그 값을 넘겼는지**를 잰다.
   */
  it('창이 마감할 실사와 요약 4칸을 보이고 선택칸이 없다', async () => {
    const { user } = await setupClosable();

    await user.click(closeButton());

    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText('IC-2026-900011')).toBeInTheDocument();
    expect(within(dialog).getByText(WAREHOUSE_LABEL)).toBeInTheDocument();
    expect(within(dialog).getAllByText(t.detail.countValue(40))).toHaveLength(2);
    expect(within(dialog).getAllByText(t.detail.countValue(0))).toHaveLength(2);
    expect(within(dialog).getByText(t.dialog.closeIrreversible)).toBeInTheDocument();
    expect(within(dialog).queryAllByRole('combobox')).toHaveLength(0);
    /* **#44** — 창 어디에도 내부 번호가 없다. */
    expect(dialog.textContent ?? '').not.toContain('9101');
  });

  it('마감하지 않음을 누르면 창만 닫히고 요청이 나가지 않는다', async () => {
    const { requests, user } = await setupClosable();

    await user.click(closeButton());
    await user.click(screen.getByRole('button', { name: t.actions.keepCounting }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(closeRequests(requests)).toHaveLength(0);
    /* 짝 방향 — 마감은 여전히 할 수 있다(창만 닫혔다). */
    expect(closeButton()).not.toBeDisabled();
  });

  /*
   * **완료 조건 C60 · 감지기 M52** — 창이 **열린 채 대상이 바뀌면 창이 닫히고 요청이 0회**다
   * (W-01-10 리뷰 R-1). 뒤로가기·앞으로가기·주소 직접 편집은 클릭 핸들러를 거치지 않으므로
   * 핸들러에 창 닫기를 두면 그 경로가 통째로 샌다.
   *
   * **축이 다섯이다** — 파기 창(M42)이 이미 다섯으로 늘어난 자리이고 마감 창도 같다.
   * 「위치 고르기」를 빠뜨리면 **같은 실사 안에서 위치만 옮기는** 조작이 사각으로 남는다:
   * 그때도 확인 창은 닫혀야 한다(수명 표 5행).
   */
  it.each<[string, (user: ReturnType<typeof userEvent.setup>) => Promise<void>]>([
    [
      '조건 변경·조회',
      async (user) => {
        await user.click(
          within(listPane()).getByRole('checkbox', { name: t.fields.inProgressOnly }),
        );
        await user.click(within(listPane()).getByRole('button', { name: messages.common.search }));
      },
    ],
    [
      '초기화',
      async (user) => {
        await user.click(within(listPane()).getByRole('button', { name: messages.common.reset }));
      },
    ],
    [
      '쪽 이동',
      async (user) => {
        await user.click(screen.getByRole('button', { name: t.actions.nextPage }));
      },
    ],
    [
      '실사 고르기',
      async (user) => {
        await selectCount(user, 'IC-2026-900013');
      },
    ],
    [
      '위치 고르기',
      async (user) => {
        await chooseOption(user, detailPane(), t.fields.location, LOCATION_LABEL);
      },
    ],
  ])('창이 열린 채 %s가 일어나면 창이 닫힌다', async (_label, act) => {
    const { requests, user } = await setupClosable(
      allRoutes([
        closableDetailRoute(),
        closableDetailRoute(OTHER_DETAIL_PATH, CLOSABLE_SUMMARY, { inventoryCountId: 9003 }),
        closingRoute(),
        listRoute(countFixtures, { total: 120 }),
      ]),
      `${AT_COUNT}&wh=9101`,
    );

    await user.click(closeButton());

    /* 짝 방향 — 조작 전에는 실제로 열려 있었다(원래 안 열려서 통과하는 것이 아니다). */
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await act(user);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(closeRequests(requests)).toHaveLength(0);
  });

  /*
   * **창이 「가려진」 것과 「닫힌」 것을 가른다.**
   *
   * 위 다섯 축 가운데 조건 변경·초기화·쪽 이동은 `ct`를 비우는데, 그러면 상세가 사라지면서
   * 창도 **함께 보이지 않게 된다** — 수명 규칙이 없어도 그 세 축의 단언은 통과한다.
   * 창의 열림 상태가 남아 있는지는 **대상을 다시 고르는 순간** 드러난다: 남아 있으면 상세가
   * 돌아오면서 **확인 창이 다른 맥락에 되붙는다.** 사용자는 자기가 언제 연 창인지 모른 채
   * 「실사 마감 실행」을 누른다.
   */
  it('조건을 바꿔 실사가 풀린 뒤 다시 골라도 마감 창이 서지 않는다', async () => {
    const { requests, user } = await setupClosable();

    await user.click(closeButton());

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(within(listPane()).getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    /* 같은 실사를 다시 고른다 — 상세가 돌아오면 가려져 있던 창이 되살아난다. */
    await selectCount(user, 'IC-2026-900011');

    await screen.findByRole('group', { name: t.detail.summaryLabel });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(closeRequests(requests)).toHaveLength(0);
  });

  /*
   * 두 겹의 둘째 — **보내는 자리가 스스로 한 번 더 본다**(계획 결정 3의 구현 규칙 4).
   *
   * 창이 열린 사이 **상세가 다시 도착해 요약이 바뀌면** 버튼의 판정은 이미 낡았다. 다른
   * 사람이 그 위치를 치환하면 미실사·차이가 되살아나는데, 그대로 보내면 **조건을 못 채운
   * 실사가 되돌릴 수 없이 마감된다.** 「다시 조회」는 주소를 바꾸지 않아 창 수명 effect가
   * 닫아 주지 않는다 — 그래서 이 겹이 필요하다.
   */
  it('창이 열린 사이 요약이 조건을 잃으면 확인해도 보내지 않는다', async () => {
    let call = 0;

    const { requests, user } = await setupClosable(
      allRoutes([
        {
          match: (request) => isGet(request, DETAIL_PATH),
          respond: () => {
            call += 1;

            return jsonResponse(
              countDetailBody(
                {},
                call === 1 ? CLOSABLE_SUMMARY : { ...CLOSABLE_SUMMARY, uncountedCount: 3 },
              ),
              { headers: { ETag: DETAIL_ETAG } },
            );
          },
        },
        closingRoute(),
      ]),
    );

    await user.click(closeButton());
    await user.click(screen.getByRole('button', { name: t.actions.refresh }));

    await screen.findByText(t.actionReasons.closeUncounted(3));

    await user.click(screen.getByRole('button', { name: t.actions.confirmClose }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(closeRequests(requests)).toHaveLength(0);
  });
});

describe('StocktakingScreen — 마감 요청', () => {
  /*
   * **완료 조건 C56 · 감지기 M56** — 본문이 `businessDate` 하나이고 **`If-Match`가 실린다.**
   *
   * 세 쓰기의 잠금 규약이 여기서 갈린다 — 개시는 헤더 자체가 없고(C28), 치환은 있으면 싣고
   * (C46), 마감은 **없으면 보내지 않는다.** 토큰은 **상세 조회가 남긴 것**이다(치환·마감
   * 200에 `ETag`가 없다 — 실왕복 재확인).
   */
  it('본문이 영업일 하나이고 상세가 준 토큰을 If-Match에 싣는다', async () => {
    const { requests, user } = await setupClosable();

    await closeCount(user);

    await waitFor(() => {
      expect(closeRequests(requests)).toHaveLength(1);
    });

    const sent = closeRequests(requests)[0];

    expect(Object.keys(sent?.body as Record<string, unknown>)).toEqual(['businessDate']);
    expect(sent?.headers.get('If-Match')).toBe(DETAIL_ETAG);
    expect(sent?.headers.get('Idempotency-Key')).not.toBeNull();
    /* 마감이 나간 경로가 그 실사의 것이다 — 번호 자리가 어긋나면 이 단언이 걸린다. */
    expect(sent?.url.pathname).toBe(CLOSE_PATH);
  });

  /*
   * **완료 조건 C56의 반쪽 — 토큰이 없으면 보내지 않고 안내한다.**
   *
   * 치환과 **정반대**다(C46 — 없어도 보낸다). 계약이 마감에서는 `If-Match`를 필수로 요구하고
   * 목이 토큰 없는 마감을 400으로 되돌리는 것을 실왕복으로 확인했다 — 빈 토큰을 실어 보내면
   * **되돌릴 수 없는 쓰기가 계약 위반으로 나갔다가 거절된다.** 공통 훅의 `staleToken` 경로가
   * 그 자리를 맡는다.
   */
  it('상세가 토큰을 남기지 않았으면 보내지 않고 안내한다', async () => {
    const { requests, user } = await setupClosable(
      allRoutes([
        /* `ETag` 헤더가 없는 상세 — 다른 값은 그대로다. */
        {
          match: (request) => isGet(request, DETAIL_PATH),
          respond: () => jsonResponse(countDetailBody({}, CLOSABLE_SUMMARY)),
        },
        closingRoute(),
      ]),
    );

    await closeCount(user);

    expect(await screen.findByText(messages.save.staleToken)).toBeInTheDocument();
    expect(closeRequests(requests)).toHaveLength(0);
    /* 결과 구획이 서지 않는다 — 보내지 않았는데 마감된 것처럼 보이면 안 된다. */
    expect(screen.queryByRole('status', { name: t.result.closedLabel })).not.toBeInTheDocument();
  });
});

describe('StocktakingScreen — 마감 성공', () => {
  /*
   * **완료 조건 C57 · 감지기 M59** — 성공하면 **응답이 준 상태 코드를 그대로** 보인다.
   *
   * 실측 근거가 있다: 목 서버의 `:close` 200 응답이 `IN_PROGRESS`를 되돌려 준다. 화면이 값으로
   * 「마감됨」을 판정했다면 그 자리에서 거짓말을 한다. 여기서는 상세(`SAMPLE_COUNT_STATUS_A`)와
   * **다른 코드**가 응답으로 와, 화면이 어느 쪽을 내는지 값으로 갈린다.
   */
  it('마감 결과가 응답의 상태 코드와 요약을 그대로 낸다', async () => {
    const { user } = await setupClosable();

    await closeCount(user);

    const result = await screen.findByRole('status', { name: t.result.closedLabel });

    expect(within(result).getByText('IC-2026-900011')).toBeInTheDocument();
    expect(within(result).getByText(CLOSED_STATUS)).toBeInTheDocument();
    expect(within(result).getAllByText(t.detail.countValue(40))).toHaveLength(2);

    /*
     * **#44 · 감지기 M57** — 짝 방향. 업무 번호가 보이는 것만 재면 그 자리에 **내부 번호를
     * 대신 넣는** 뮤턴트가 「업무 번호가 없다」로만 걸린다 — 무엇이 대신 섰는지도 재야
     * 그 자리가 번호가 새는 경로인지 아닌지 갈린다.
     */
    for (const internalId of INTERNAL_IDS) {
      expect(result.textContent ?? '').not.toContain(internalId);
    }
  });

  /*
   * **완료 조건 C57 · 감지기 M60** — 마감 뒤 **편집이 닫힌다**(단계 S3).
   *
   * `loc`가 주소에서 빠지고 위치 선택칸과 라인 표가 사라진다. 컨트롤을 잠그는 것으로 그치지
   * 않는 이유는 잠금 겹이 하나라도 뚫리면 **되돌릴 수 없이 마감한 실사의 라인이 다시
   * 치환되기** 때문이다.
   */
  it('마감하면 고른 위치가 풀리고 편집 구획이 닫힌다', async () => {
    const { user } = await setupClosable(
      allRoutes([closableDetailRoute(), closingRoute()]),
      `${AT_COUNT}&loc=${String(LOCATION_ID)}`,
    );

    await waitForLines();
    await closeCount(user);

    await screen.findByRole('status', { name: t.result.closedLabel });

    expect(currentLocation()).not.toContain('loc=');
    expect(screen.getByText(t.empty.closedTitle)).toBeInTheDocument();
    expect(screen.queryByLabelText(t.fields.location)).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(t.lineTable.countedQtyLabel(1)),
    ).not.toBeInTheDocument();
    expect(
      within(detailPane()).queryByRole('button', { name: t.actions.saveLocation }),
    ).not.toBeInTheDocument();
    /* 고른 실사는 그대로다(수명 표 15행) — 무엇을 마감했는지 화면에 남아야 결과를 읽는다. */
    expect(currentLocation()).toContain('ct=9001');
    expect(
      within(screen.getByRole('group', { name: t.detail.label })).getByText('IC-2026-900011'),
    ).toBeInTheDocument();

    /*
     * **주소가 바뀐 뒤에도 결과가 서 있다.** 앞의 `findBy`는 결과가 **나타나기만** 하면
     * 통과한다 — 마감 결과를 방금 비운 `loc`에 매어 두면 결과 정리 effect가 곧바로 거둬
     * 가는데, 그 사라짐은 나타남을 기다린 단언에 잡히지 않는다. 마감 성공이 `loc`를 비우는
     * 것과 결과가 **`loc` 없는 상태에 매이는 것**은 한 짝이라 여기서 함께 잰다.
     */
    expect(closedRegion()).toBeInTheDocument();
  });

  /*
   * **닫힌 구획은 요청도 보내지 않는다**(이력 구획이 세운 규칙 · 완료 조건 C49와 같은 성질).
   *
   * 마감 성공이 `loc`를 비우지만 **주소 직접 편집으로 되살릴 수 있다** — 그때 라인과 참조
   * 셋이 다시 나가면 아무도 읽지 않는 응답이 오가고, 그 경로가 나중에 「이미 되는 것」으로
   * 읽힌다. 편집이 닫힌 것이 컨트롤의 사정이 아니라 **조회의 사정**이기도 하다는 뜻이다.
   */
  it('마감 뒤 주소로 위치를 되살려도 라인을 부르지 않는다', async () => {
    const { requests, user } = await setupClosable(
      allRoutes([closableDetailRoute(), closingRoute()]),
      AT_COUNT,
      `ct=9001&loc=${String(LOCATION_ID)}`,
    );

    await closeCount(user);
    await screen.findByRole('status', { name: t.result.closedLabel });

    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await waitFor(() => {
      expect(currentLocation()).toContain(`loc=${String(LOCATION_ID)}`);
    });

    expect(lineRequests(requests)).toHaveLength(0);
    expect(requestsTo(requests, ITEMS_PATH)).toHaveLength(0);
    expect(screen.getByText(t.empty.closedTitle)).toBeInTheDocument();
  });

  /*
   * **다시 마감하지 못한다.** 마감은 되돌릴 수 없으므로 두 벌째 요청이 나가면 서버가 400
   * `STATE_LOCKED`로 되돌리는데, 그 전에 화면이 막는 것이 옳다 — 공통 훅이 호출마다 새 멱등
   * 키를 만들어 서버는 둘을 별개의 요청으로 본다(이슈 #55).
   */
  it('마감한 실사는 다시 마감할 수 없고 사유가 보인다', async () => {
    const { requests, user } = await setupClosable();

    await closeCount(user);
    await screen.findByRole('status', { name: t.result.closedLabel });

    expect(closeButton()).toBeDisabled();
    expect(within(detailPane()).getByText(t.actionReasons.closeAlreadyClosed)).toBeInTheDocument();
    expect(closeRequests(requests)).toHaveLength(1);
  });

  /*
   * **마감 플래그가 그 실사에 매여 있다**(수명 표 4행). 다른 실사를 고르면 결과가 사라지고
   * **그 실사는 마감할 수 있다** — 플래그가 화면 전체의 것이면 한 번 마감한 뒤로는 아무
   * 실사도 마감할 수 없게 된다.
   */
  it('다른 실사를 고르면 마감 결과가 사라지고 그 실사는 마감할 수 있다', async () => {
    const { user } = await setupClosable(
      allRoutes([
        closableDetailRoute(),
        closableDetailRoute(OTHER_DETAIL_PATH, CLOSABLE_SUMMARY, { inventoryCountId: 9003 }),
        closingRoute(),
      ]),
    );

    await closeCount(user);
    await screen.findByRole('status', { name: t.result.closedLabel });

    await selectCount(user, 'IC-2026-900013');

    /*
     * **새 실사의 상세가 도착한 뒤에 잰다.** 결과 구획은 주소가 바뀌는 즉시 사라지지만 마감
     * 버튼은 상세가 와야 그려진다 — 사라짐만 기다리고 버튼을 동기로 찾으면 **아직 스켈레톤인
     * 판에서만 깨지는** 잣대가 된다.
     */
    await waitFor(() => {
      expect(closeButton()).not.toBeDisabled();
    });

    expect(screen.queryByRole('status', { name: t.result.closedLabel })).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.closedTitle)).not.toBeInTheDocument();
  });

  /*
   * **목록과 상세를 다시 읽는다.** 마감으로 상태 코드와 요약이 바뀌므로 둘 다 낡는다 —
   * 목록을 두면 마감한 실사가 「진행 중」으로 보이고, 상세를 두면 요약이 마감 전 값으로 남는다.
   *
   * **요청 수로 잰다** — 같은 본문이 돌아오면 캐시가 구조 공유로 참조를 유지해 값 비교로는
   * 다시 읽었는지 알 수 없다.
   */
  it('마감 성공 뒤 목록과 상세를 다시 부른다', async () => {
    const { requests, user } = await setupClosable();

    const listBefore = requestsTo(requests, LIST_PATH).length;
    const detailBefore = requestsTo(requests, DETAIL_PATH).length;

    await closeCount(user);
    await screen.findByRole('status', { name: t.result.closedLabel });

    /*
     * **둘을 한 기다림 안에서 잰다.** 무효화 둘이 함께 나가지만 도착 차례는 정해져 있지 않다 —
     * 하나만 기다리고 다른 하나를 동기로 단언하면 **차례가 뒤집힌 판에서만 깨지는** 잣대가 된다.
     */
    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(listBefore);
      expect(requestsTo(requests, DETAIL_PATH).length).toBeGreaterThan(detailBefore);
    });
  });

  /* 「다시 조회」는 대상을 바꾸지 않는다 — 마감 결과가 남는다(수명 표 10행). */
  it('다시 조회해도 마감 결과가 남는다', async () => {
    const { user } = await setupClosable();

    await closeCount(user);
    await screen.findByRole('status', { name: t.result.closedLabel });

    await user.click(screen.getByRole('button', { name: t.actions.refresh }));

    expect(closedRegion()).toBeInTheDocument();
  });
});

describe('StocktakingScreen — 조정 등록', () => {
  /*
   * **완료 조건 C58 · 감지기 M58** — 「조정 등록」은 **자리만 두고 이동시키지 않는다**
   * (착수 이슈 §5 ⚠). W-01-12는 이번에 나가지 않았고 승인 계약도 없다.
   *
   * 부품 테스트가 비활성과 사유를 재고, 여기서는 **눌러도 어디로도 가지 않음**을 잰다 —
   * 주소가 그대로이고 링크가 없다는 두 축이다.
   */
  it('조정 등록을 눌러도 주소가 바뀌지 않고 링크가 없다', async () => {
    const { user } = await setupClosable();

    await closeCount(user);

    const result = await screen.findByRole('status', { name: t.result.closedLabel });
    const action = within(result).getByRole('button', { name: t.actions.adjustment });
    const before = currentLocation();

    expect(action).toBeDisabled();

    await user.click(action);

    expect(currentLocation()).toBe(before);
    expect(within(result).queryAllByRole('link')).toHaveLength(0);
    expect(within(detailPane()).getByText(t.actionReasons.adjustmentPending)).toBeInTheDocument();
  });
});

describe('StocktakingScreen — 마감 실패', () => {
  /*
   * **완료 조건 C59** — 실패가 **네 갈래**이고 문구가 서로 다르다.
   *
   * 400에는 갈래가 하나 더 있다 — **상태 잠김**(`STATE_LOCKED`). 세션 밖에서 이미 마감된
   * 실사를 고르면 화면은 그것을 모르고(단계 전이 표 — 상태 코드로 분기하지 않는다) 서버가
   * 그 사유와 함께 되돌린다. 다시 읽어도 풀리지 않는 상태라 검증 실패와 문구가 갈려야 한다.
   */
  it.each<[string, number, unknown, string]>([
    [
      '검증 실패',
      400,
      { errors: [{ scope: 'screen', code: 'INVALID', message: '미실사가 남아 있습니다.' }] },
      '미실사가 남아 있습니다.',
    ],
    [
      '상태 잠김',
      400,
      { errors: [{ scope: 'screen', code: 'STATE_LOCKED', message: '이미 마감된 실사입니다.' }] },
      messages.stateLocked.title,
    ],
    ['권한 없음', 403, { message: '' }, messages.httpError.forbidden],
    ['저장 충돌', 409, { conflictCause: 'user' }, messages.conflict.user],
  ])('%s면 그 사유를 낸다', async (_label, status, body, expected) => {
    const { requests, user } = await setupClosable(
      allRoutes([closableDetailRoute(), failingCloseRoute(status, body)]),
    );

    await closeCount(user);

    expect(await screen.findByText(expected)).toBeInTheDocument();
    expect(closeRequests(requests)).toHaveLength(1);

    /* 실패했으니 결과 구획이 서지 않는다. */
    expect(screen.queryByRole('status', { name: t.result.closedLabel })).not.toBeInTheDocument();
    /* 창은 닫혀 있다 — 남으면 실패 배너 위에 활성인 「실사 마감 실행」이 서 있게 된다. */
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    /* 마감하지 못했으니 편집도 닫히지 않는다(수명 표 16행 — 마감 플래그를 세우지 않는다). */
    expect(screen.queryByText(t.empty.closedTitle)).not.toBeInTheDocument();
  });

  /*
   * **감지기와 같은 성질 — 409에만 「최신 불러오기」를 낸다.** 다시 읽어야 풀리는 것은 충돌뿐이고,
   * **상태 잠김에 내면 눌러도 풀리지 않는 길**을 가리킨다.
   */
  it.each<[string, number, unknown, boolean]>([
    ['저장 충돌', 409, { conflictCause: 'user' }, true],
    ['검증 실패', 400, { message: '' }, false],
    [
      '상태 잠김',
      400,
      { errors: [{ scope: 'screen', code: 'STATE_LOCKED', message: '이미 마감된 실사입니다.' }] },
      false,
    ],
    ['권한 없음', 403, { message: '' }, false],
  ])('%s에서 최신 불러오기가 %s', async (_label, status, body, shown) => {
    const { user } = await setupClosable(
      allRoutes([closableDetailRoute(), failingCloseRoute(status, body)]),
    );

    await closeCount(user);
    await screen.findByRole('alert');

    const reload = screen.queryByRole('button', { name: messages.conflict.reloadAction });

    expect(reload === null).toBe(!shown);
  });

  /*
   * **응답을 받지 못한 갈래에만 한 줄을 더한다.** 개시와 같은 무게다 — 다시 여는 오퍼레이션이
   * 없어 두 번 마감되면 되돌릴 수 없다. 저장(치환)과 갈리는 자리이며 그 갈림이 문구에 있다.
   */
  it('응답이 오지 않으면 다시 보내기 전에 확인하라고 밝힌다', async () => {
    const { user } = await setupClosable(
      allRoutes([closableDetailRoute(), offlineCloseRoute()]),
    );

    await closeCount(user);

    expect(await screen.findByText(messages.httpError.offline)).toBeInTheDocument();
    expect(screen.getByText(t.notes.closeRecheck)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /*
   * **짝 방향 — 응답이 온 실패에는 그 한 줄을 붙이지 않는다**(개시가 세운 형태).
   *
   * 마감에서 그 뒤집힘은 특히 비싸다: 「이미 마감됐는지 확인한 뒤 시도하세요」가 **권한이
   * 없어 애초에 나가지도 못한** 실패에까지 서면, 사용자는 마감되지 않은 실사를 마감된 것으로
   * 의심하고 목록을 뒤진다 — 되돌릴 수 없는 조작이라 그 의심의 값이 크다.
   */
  it('응답이 온 실패에는 그 안내를 붙이지 않는다', async () => {
    const { user } = await setupClosable(
      allRoutes([closableDetailRoute(), failingCloseRoute(403)]),
    );

    await closeCount(user);

    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.queryByText(t.notes.closeRecheck)).not.toBeInTheDocument();
  });

  /*
   * **서버가 필드에 붙인 오류도 삼키지 않는다**(승계 — `knownFields`의 갈림).
   *
   * 마감이 보내는 값은 `businessDate` 하나인데 **그 값을 넣는 입력칸이 화면에 없다**(실행
   * 시각에서 파생한다). 이름을 `knownFields`에 채우면 그 오류가 인라인으로 분류되는데
   * **붙일 칸이 없어 조용히 사라진다** — 사용자에게는 「마감을 눌렀는데 아무 일도 없다」로
   * 보인다. 치환과 결론은 같지만 이유가 다른 자리라 잣대를 따로 세운다.
   */
  it('서버가 영업일에 붙인 필드 오류도 삼키지 않고 배너로 낸다', async () => {
    const { user } = await setupClosable(
      allRoutes([
        closableDetailRoute(),
        failingCloseRoute(400, {
          errors: [
            {
              scope: 'field',
              code: 'INVALID',
              field: 'businessDate',
              message: '영업일이 마감 기간을 벗어났습니다.',
            },
          ],
        }),
      ]),
    );

    await closeCount(user);

    expect(await screen.findByText('영업일이 마감 기간을 벗어났습니다.')).toBeInTheDocument();
  });

  /*
   * **승계 교훈 — 「성공 뒤 실패」 순서를 만든다.** 실패 테스트가 늘 빈 화면에서 시작하면
   * 「실패하면 결과 구획을 비운다」(수명 표 16행)가 아무것도 재지 못한다.
   *
   * 마감은 성공하면 다시 누를 수 없으므로(플래그가 막는다) **앞선 저장이 세운 결과** 위에서
   * 마감을 실패시킨다 — 같은 대상에서 결과 구획이 실제로 거둬지는 유일한 순서다.
   */
  it('앞선 저장이 성공한 뒤 마감이 실패하면 결과 구획이 비고 창이 서 있지 않다', async () => {
    const { user } = await setupClosable(
      allRoutes([closableDetailRoute(), failingCloseRoute(403)]),
      `${AT_COUNT}&loc=${String(LOCATION_ID)}`,
    );

    await waitForLines();
    await fillAllQty(user);
    await user.click(saveButton());

    /* 저장 결과가 실제로 선다 — 이 뒤라야 「거둔다」를 잴 수 있다. */
    await screen.findByRole('status', { name: t.result.savedLabel });

    await closeCount(user);

    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: t.result.savedLabel })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('StocktakingScreen — 마감 중 잠금', () => {
  /*
   * **감지기 M51의 첫째 겹 — 컨트롤 잠금.** 전송 중에는 대상을 바꾸는 길이 함께 잠기고,
   * 연타해도 요청이 1회다(공통 훅이 호출마다 새 멱등 키를 만든다 — 이슈 #55).
   *
   * 마감이 특히 아픈 자리다: 두 벌이 나가면 **되돌릴 수 없는 조작이 두 번** 일어난다.
   */
  it('마감 중에는 대상을 바꿀 수 없고 연타해도 요청이 1회다', async () => {
    const { requests, release, user } = await setupClosable(
      allRoutes([closableDetailRoute(), closingRoute()]),
      `${AT_COUNT}&loc=${String(LOCATION_ID)}`,
      '',
      isCloseRequest,
    );

    await waitForLines();
    await closeCount(user);

    await waitFor(() => {
      expect(closeRequests(requests)).toHaveLength(1);
    });

    expect(closeButton()).toBeDisabled();
    expect(screen.getByLabelText(t.fields.location)).toBeDisabled();
    expect(qtyField(1)).toBeDisabled();
    expect(saveButton()).toBeDisabled();
    expect(within(listPane()).getByRole('button', { name: messages.common.search })).toBeDisabled();
    expect(
      within(listPane()).getByRole('button', { name: t.actions.deselectRow('IC-2026-900011') }),
    ).toBeDisabled();

    await user.click(closeButton());

    expect(closeRequests(requests)).toHaveLength(1);

    release();

    await screen.findByRole('status', { name: t.result.closedLabel });
  });

  /*
   * **감지기 M51의 둘째 겹 — 경로 가드 단독.** 조건 칩의 ×는 디자인 시스템이 잠금을 받지 않아
   * (`StatusChipProps`에 `disabled`가 없다 — 실측) 전송 중에도 눌린다. 그 길로 들어오면
   * 조건이 바뀌면서 `ct`가 풀리고 **앞 요청의 결과가 다른 맥락에 나타난다.**
   */
  it('마감 중에는 잠금을 받지 않는 조건 칩의 ×로도 대상이 바뀌지 않는다', async () => {
    const { requests, release, user } = await setupClosable(
      allRoutes([closableDetailRoute(), closingRoute()]),
      `${AT_COUNT}&wh=9101`,
      '',
      isCloseRequest,
    );

    await closeCount(user);

    await waitFor(() => {
      expect(closeRequests(requests)).toHaveLength(1);
    });

    const before = currentLocation();
    const removeChip = within(listPane()).getByRole('button', {
      name: t.filters.chipRemoveWarehouse,
    });

    /* 짝 방향 — 이 버튼은 실제로 눌린다(잠겨 있어서 아무 일도 안 나는 것이 아니다). */
    expect(removeChip).not.toBeDisabled();

    await user.click(removeChip);

    expect(currentLocation()).toBe(before);

    release();

    await screen.findByRole('status', { name: t.result.closedLabel });
  });

  /*
   * **「어느 쓰기가 나가는 중인가」도 축이다 — 이제 셋이다**(검증 담당 승계).
   *
   * 버튼마다 잠금 겹이 여럿인데 `loading`은 **자기 쓰기가 나갈 때만** 참이라, 다른 쓰기가
   * 나가는 판에서는 `isLocked` 하나가 홀로 막는다. 그 판을 재지 않으면 겹 하나가 조용히
   * 사라져도 아무도 모른다 — 무너지면 **되돌릴 수 없는 쓰기 둘이 동시에** 나간다.
   *
   * 개시·치환 두 축을 갈라 센다. 한 축만 재면 다른 축의 잠금을 지워도 잡히지 않는다.
   */
  it.each<
    [string, (request: Request) => boolean, (user: ReturnType<typeof userEvent.setup>) => Promise<void>]
  >([
    [
      '개시가',
      isOpenRequest,
      async (user) => {
        await fillOpenDraft(user);
        await user.click(openButton());
        await user.click(screen.getByRole('button', { name: t.actions.confirmOpen }));
      },
    ],
    [
      '치환이',
      isReplaceRequest,
      async (user) => {
        await fillAllQty(user);
        await user.click(saveButton());
      },
    ],
  ])('%s 나가는 중에도 마감 버튼이 잠긴다', async (_label, hold, act) => {
    fillCodeLists();

    const { requests, release, user } = await setupClosable(
      allRoutes([closableDetailRoute(), closingRoute()]),
      `${AT_COUNT}&loc=${String(LOCATION_ID)}`,
      '',
      hold,
    );

    await waitForLines();

    /* 짝 방향 — 보내기 전에는 열려 있다(늘 잠겨 있어서 통과하는 것이 아니다). */
    expect(closeButton()).not.toBeDisabled();

    await act(user);

    await waitFor(() => {
      expect(requests.filter((request) => request.method !== 'GET')).toHaveLength(1);
    });

    expect(closeButton()).toBeDisabled();
    /* 마감은 나가는 중이 아니다 — 자기 `loading` 겹이 서 있지 않은 판이라는 것이 요점이다. */
    expect(closeRequests(requests)).toHaveLength(0);

    release();
  });

  /*
   * **역방향 — 마감이 나가는 중에는 저장이 잠긴다.** 위 판의 짝이며, 셋째 쓰기가 생기면서
   * 이 축이 실제로 늘었다. 무너지면 마감이 나가는 동안 **파괴적 치환**이 함께 나간다.
   */
  it('마감이 나가는 중에는 저장 버튼도 잠긴다', async () => {
    const { requests, release, user } = await setupClosable(
      allRoutes([closableDetailRoute(), closingRoute()]),
      `${AT_COUNT}&loc=${String(LOCATION_ID)}`,
      '',
      isCloseRequest,
    );

    await waitForLines();
    await fillAllQty(user);

    /* 짝 방향 — 마감을 보내기 전에는 저장이 열려 있다. */
    expect(saveButton()).not.toBeDisabled();

    await closeCount(user);

    await waitFor(() => {
      expect(closeRequests(requests)).toHaveLength(1);
    });

    expect(saveButton()).toBeDisabled();
    expect(replaceRequests(requests)).toHaveLength(0);

    release();

    await screen.findByRole('status', { name: t.result.closedLabel });
  });

  /*
   * **전송 중 주소 편집**(리뷰 R-4가 고친 자리의 마감 판).
   *
   * 전송 중 잠금은 컨트롤과 핸들러 두 겹인데 뒤로가기·앞으로가기·주소 직접 편집은 그 둘을 다
   * 거치지 않는다. 그 길로 대상이 바뀌면 응답이 뒤에 도착해 **앞 실사의 마감 결과**가 지금
   * 보는 실사 아래에 선다.
   *
   * **다만 「마감했다」는 사실은 남는다** — 마감은 되돌릴 수 없으므로 되돌아왔을 때 다시
   * 마감하려 드는 길이 열려 있으면 안 된다. 결과 구획과 플래그의 수명이 여기서 갈린다.
   */
  it('마감 중 주소로 대상이 바뀌면 앞 실사의 결과가 서지 않는다', async () => {
    const { requests, release, user } = await setupClosable(
      allRoutes([
        closableDetailRoute(),
        closableDetailRoute(OTHER_DETAIL_PATH, CLOSABLE_SUMMARY, { inventoryCountId: 9003 }),
        closingRoute(),
      ]),
      AT_COUNT,
      'ct=9003',
      isCloseRequest,
    );

    await closeCount(user);

    await waitFor(() => {
      expect(closeRequests(requests)).toHaveLength(1);
    });

    /* 잠금 두 겹을 다 거치지 않는 길 — 주소만 바뀐다. */
    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await waitFor(() => {
      expect(currentLocation()).toContain('ct=9003');
    });

    const listBefore = requestsTo(requests, LIST_PATH).length;

    release();

    /* 응답이 도착해 성공 처리가 끝난 것을 **긍정 단언**으로 기다린다(무효화가 목록을 다시 부른다). */
    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(listBefore);
    });

    expect(screen.queryByRole('status', { name: t.result.closedLabel })).not.toBeInTheDocument();

    /* 짝 방향 — 지금 보는 실사(9003)는 마감할 수 있다(그 상세가 도착한 뒤에 잰다). */
    await waitFor(() => {
      expect(closeButton()).not.toBeDisabled();
    });

    /*
     * **그러나 마감한 사실은 남아 있다.** 되돌아온 9001은 이미 마감됐으므로 다시 마감할 수
     * 없어야 한다 — 결과 구획은 「지금 보는 것에 대한 말」이라 대상이 바뀌면 사라지지만,
     * 마감은 **되돌릴 수 없는 사실**이라 대상이 바뀌어도 남는다. 두 수명이 갈리는 자리다.
     */
    await selectCount(user, 'IC-2026-900011');

    await waitFor(() => {
      expect(closeButton()).toBeDisabled();
    });
    expect(within(detailPane()).getByText(t.actionReasons.closeAlreadyClosed)).toBeInTheDocument();
    expect(closeRequests(requests)).toHaveLength(1);
  });
});
