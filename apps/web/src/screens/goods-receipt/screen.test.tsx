import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { QueryClient } from '@tanstack/react-query';
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
  goodsReceiptResponse,
  inboundReceiptFixtures,
  inboundReceiptLine,
  inboundReceiptLineFixtures,
  itemFixtures,
  locationFixtures,
  lotDetailResponse,
  lotFixtures,
  otherLocationFixtures,
  partnerFixtures,
  plantFixtures,
  uomFixtures,
  warehouseFixtures,
} from './fixtures';
import { LOT_PAGE_SIZE } from './lookups';
import { irKeys } from './queries';
import { GoodsReceiptScreen } from './screen';

const t = messages.goodsReceipt;

/**
 * **값 목록이 확정된 뒤의 화면**을 이 파일에서 만들어 내기 위한 자리.
 *
 * 자리표시 상수는 지금 **비어 있고**(`code-options.test.ts`가 그 사실을 고정한다) 비어 있는
 * 동안에는 「입고 처리」가 잠긴다. 그런데 이 화면의 값어치는 **잠금이 풀린 뒤에 무엇이
 * 일어나는가**에 있다 — 요청에 무엇이 실리는지, 전송 중에 무엇이 닫히는지, 성공·실패가
 * 어떻게 보이는지는 배열이 채워진 상태에서만 확인할 수 있다.
 *
 * 그래서 **배열만 갈아 끼운다.** 판정·선택지 만들기·검증은 실물 그대로이고, 바뀌는 것은
 * 「값 목록이 왔다」는 사실 하나다 — 값 목록이 확정되면 실제로 그 한 가지만 달라진다.
 * 매 테스트 앞에서 빈 배열로 되돌려, 아무것도 채우지 않은 테스트는 **지금의 화면**을 본다.
 */
const { codeValues } = vi.hoisted(() => ({
  codeValues: {
    receiptType: [] as string[],
    sourceDocumentType: ['INBOUND_RECEIPT'] as string[],
    qualityStatus: [] as string[],
    inventoryStatus: ['AVAILABLE', 'IN_TRANSIT', 'ON_HOLD', 'BLOCKED'] as string[],
    reason: [] as string[],
  },
}));

vi.mock('./code-options', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./code-options')>();

  return { ...actual, PLACEHOLDER_GOODS_RECEIPT_CODES: codeValues };
});

/** 지어낸 합성 코드. **계약의 `@example` 값을 쓰지 않는다** — 예시가 확정 값으로 읽히면 안 된다. */
const SAMPLE_RECEIPT_TYPE = 'SAMPLE_RECEIPT_TYPE_A';
const SAMPLE_SOURCE_TYPE = 'INBOUND_RECEIPT';
const SAMPLE_QUALITY = 'SAMPLE_QUALITY_A';
/**
 * 재고 상태만 합성값이 아니다. **계약이 값을 넷으로 못박아** 그 밖의 값으로는 요청 본문이
 * 만들어지지 않는다(`gr-request.ts`) — 합성값을 쓰면 「입고 처리」가 눌려도 아무것도 나가지
 * 않아, 이 파일의 쓰기 시험들이 무엇을 재는지 알 수 없게 된다.
 */
const SAMPLE_INVENTORY = 'AVAILABLE';
const SAMPLE_REASON = 'SAMPLE_REASON_A';

const clearCodeLists = (): void => {
  codeValues.receiptType = [];
  codeValues.sourceDocumentType = ['INBOUND_RECEIPT'];
  codeValues.qualityStatus = [];
  codeValues.inventoryStatus = ['AVAILABLE', 'IN_TRANSIT', 'ON_HOLD', 'BLOCKED'];
  codeValues.reason = [];
};

/** 값 목록이 확정된 뒤. **배열만 채운다** — 다른 자리는 손대지 않는다. */
const fillCodeLists = (): void => {
  codeValues.receiptType = [SAMPLE_RECEIPT_TYPE];
  codeValues.sourceDocumentType = [SAMPLE_SOURCE_TYPE];
  codeValues.qualityStatus = [SAMPLE_QUALITY];
  codeValues.inventoryStatus = ['AVAILABLE', 'IN_TRANSIT', 'ON_HOLD', 'BLOCKED'];
  codeValues.reason = [SAMPLE_REASON];
};

beforeEach(clearCodeLists);

const ROUTE = '/logistics/goods-receipt';
const LIST_PATH = '/logistics/inbound-receipts';
const DETAIL_PATH = '/logistics/inbound-receipts/9001';
const LINES_PATH = '/logistics/inbound-receipts/9001/lines';
const OTHER_LINES_PATH = '/logistics/inbound-receipts/9002/lines';
/** 이 화면이 PR ②에서 쓸 입고 처리 경로. **지금은 부르지 않는다** — 그것을 증명하려고 스텁을 둔다. */
const GOODS_RECEIPTS_PATH = '/logistics/goods-receipts';
const PARTNERS_PATH = '/mdm/partners';
const PLANTS_PATH = '/mdm/plants';
const ITEMS_PATH = '/mdm/items';
const UOMS_PATH = '/mdm/uoms';
const LOTS_PATH = '/trace/lots';
const WAREHOUSES_PATH = '/mdm/warehouses';
const LOCATIONS_PATH = '/mdm/locations';
/** 성공 뒤 다시 읽는 자재 LOT. 고른 줄(9401)의 LOT이 9601이다. */
const LOT_DETAIL_PATH = '/trace/lots/9601';

/**
 * 상세 응답에만 있는 표식. 화면이 입하 상세를 부르지 않는다는 것을 **두 방향으로** 굳힌다 —
 * ① 상세 경로 요청이 0회 ② 이 표식이 화면 어디에도 나타나지 않음.
 * 스텁을 두지 않으면 하네스가 던져 「부르지 않았다」와 「불렀는데 실패했다」가 구분되지 않는다.
 */
const DETAIL_MARKER = 'IR-2026-900001-FROM-DETAIL';

const SUPPLIER_LABEL = 'SAMPLE-SUP-01 · 합성 공급사 가';
const ITEM_LABEL = 'SAMPLE-ITEM-01 · 합성 품목 가';
const PLANT_LABEL = 'SAMPLE-PLT-01 · 합성 공장 가';
const UOM_LABEL = 'SAMPLE-EA · 합성 단위 개';

/**
 * 화면 어디에도 나와서는 안 되는 내부 번호(FK).
 *
 * 픽스처의 번호 대역을 그대로 쓴다 — 업무 번호(`IR-2026-900001`·`LOT-2026-900010`)에
 * 이 문자열이 부분으로 들어가지 않도록 대역을 갈라 두었다.
 */
const INTERNAL_IDS = [
  '9001',
  '9002',
  '9003',
  '9101',
  '9102',
  '9201',
  '9202',
  '9301',
  '9302',
  '9401',
  '9402',
  '9403',
  '9404',
  '9501',
  '9601',
  '9602',
  '9603',
];

interface RecordedRequest {
  method: string;
  url: URL;
  /**
   * 쓰기 요청의 본문. 읽기에는 `null`이다.
   *
   * **실제로 나간 요청을 본다.** 이 PR에서는 그 목록에 쓰기가 하나도 없다는 것이 단언이다.
   */
  body: unknown;
}

/**
 * 요청을 기록하면서 스텁 규칙으로 응답한다. 규칙에 없는 요청은 하네스가 던져 스텁 누락을 드러낸다.
 *
 * `hold`에 든 경로는 **기록한 뒤에** 붙잡아 둔다 — 「기다리는 동안 무엇이 보이는가」를
 * 판정하려면 응답이 오기 전에 이미 기록돼 있어야 한다.
 */
const createRecordingFetch = (
  routes: StubRoute[],
  hold: string[] = [],
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
    /* 본문은 한 번만 읽을 수 있다 — 복제해 읽어야 스텁이 같은 요청을 다시 다룰 수 있다. */
    const body: unknown = request.method === 'GET' ? null : await request.clone().json();

    requests.push({ method: request.method, url: new URL(request.url), body });

    if (hold.includes(new URL(request.url).pathname)) await gate;

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
  items: unknown[] = inboundReceiptFixtures,
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
 * 조건이 걸린 조회에는 그 조건에 맞는 행만 돌려준다.
 * 「고른 전표가 갱신된 결과에 없다」를 실제로 만들어 내는 유일한 방법이다.
 */
const filteringListRoute = (): StubRoute => ({
  match: (request) => isGet(request, LIST_PATH),
  respond: (request) => {
    const q = new URL(request.url).searchParams.get('q');
    const items =
      q === null
        ? inboundReceiptFixtures
        : inboundReceiptFixtures.filter((row) => row.inboundReceiptNo.includes(q));

    return jsonResponse(listBody(items));
  },
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
        listBody(inboundReceiptFixtures, { total: inboundReceiptFixtures.length + call }),
      );
    },
  };
};

/**
 * 참조 목록 응답. **`page`를 인자로 받는다** — 기본값(`total === items.length`)만 쓰면
 * 「잘렸다」 갈래가 영영 만들어지지 않아 그 판정이 통째로 검사되지 않는다.
 */
const lookupRoute = (
  pathname: string,
  items: unknown[],
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse(listBody(items, page)),
});

/** 자재 LOT은 **품목마다** 부른다 — 요청의 `itemId`에 맞는 것만 돌려준다. */
const lotsRoute = (): StubRoute => ({
  match: (request) => isGet(request, LOTS_PATH),
  respond: (request) => {
    const itemId = new URL(request.url).searchParams.get('itemId');
    const items =
      itemId === null ? lotFixtures : lotFixtures.filter((lot) => String(lot.itemId) === itemId);

    return jsonResponse(listBody(items));
  },
});

/** 적치 위치는 **창고마다** 다른 목록이 온다 — 창고를 바꾸면 앞 위치가 뜻을 잃는다. */
const locationsRoute = (
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isGet(request, LOCATIONS_PATH),
  respond: (request) => {
    const warehouseId = new URL(request.url).searchParams.get('warehouseId');

    return jsonResponse(
      listBody(warehouseId === '9702' ? otherLocationFixtures : locationFixtures, page),
    );
  },
});

/** 참조 목록 다섯과 확정 입력의 선택지 둘. 화면이 이름으로 풀 수 있는 정상 상태다. */
const lookupRoutes = (): StubRoute[] => [
  lookupRoute(PARTNERS_PATH, partnerFixtures),
  lookupRoute(PLANTS_PATH, plantFixtures),
  lookupRoute(ITEMS_PATH, itemFixtures),
  lookupRoute(UOMS_PATH, uomFixtures),
  lotsRoute(),
  lookupRoute(WAREHOUSES_PATH, warehouseFixtures),
  locationsRoute(),
];

/**
 * 부를 때마다 **고르지 않은 줄의 값이 달라지는** 라인 응답.
 *
 * 고른 줄(9401)은 그대로 두어 **대상은 바뀌지 않은 채 초안 되돌림만 깨어나는** 상태를 만든다 —
 * 확인 창이 열린 동안 라인 응답이 다시 도착하면 실제로 일어나는 일이다.
 */
const changingLinesRoute = (): StubRoute => {
  let call = 0;

  return {
    match: (request) => isGet(request, LINES_PATH),
    respond: () => {
      call += 1;

      return jsonResponse({
        items: inboundReceiptLineFixtures.map((line) =>
          line.inboundReceiptLineId === 9402
            ? { ...line, expiryDate: `2027-08-0${String(call)}` }
            : line,
        ),
      });
    },
  };
};

/** 다시 부르면 품목 이름이 달라진 뒤의 표기. 참조가 **실제로 다시 도착했는지**를 재는 잣대다. */
const CHANGED_ITEM_LABEL = 'SAMPLE-ITEM-01 · 합성 품목 가(갱신)';

/**
 * 부를 때마다 **이름이 달라지는** 품목 목록.
 *
 * 다시 부르기가 같은 본문을 돌려주면 캐시가 구조 공유로 **같은 참조를 그대로 유지**해,
 * 「참조가 도착하면 치던 값이 되돌아간다」는 결함이 드러나지 않는다. 첫 응답은 그대로 두어
 * 다른 단언의 기준 이름이 흔들리지 않게 한다.
 */
const changingItemRoute = (): StubRoute => {
  let call = 0;

  return {
    match: (request) => isGet(request, ITEMS_PATH),
    respond: () => {
      call += 1;

      return jsonResponse(
        listBody(
          call === 1
            ? itemFixtures
            : itemFixtures.map((item) => ({ ...item, itemName: '합성 품목 가(갱신)' })),
        ),
      );
    },
  };
};

/** 입고 처리 뒤 다시 읽는 자재 LOT 상세. **입고 응답에는 LOT 상태가 없다.** */
const lotDetailRoute = (statusCode = 'SAMPLE_LOT_STATUS_A'): StubRoute => ({
  match: (request) => isGet(request, LOT_DETAIL_PATH),
  respond: () => jsonResponse(lotDetailResponse(statusCode)),
});

const failingLotDetailRoute = (): StubRoute => ({
  match: (request) => isGet(request, LOT_DETAIL_PATH),
  respond: () => jsonResponse({ message: '' }, { status: 500 }),
});

const failingLookupRoute = (pathname: string): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse({ message: '' }, { status: 500 }),
});

/** 라인 조회. 고른 전표의 줄만 돌려준다. */
const linesRoute = (items: unknown[] = inboundReceiptLineFixtures): StubRoute => ({
  match: (request) => isGet(request, LINES_PATH),
  respond: () => jsonResponse({ items }),
});

const otherLinesRoute = (): StubRoute => ({
  match: (request) => isGet(request, OTHER_LINES_PATH),
  respond: () => jsonResponse({ items: [] }),
});

const failingLinesRoute = (status = 500): StubRoute => ({
  match: (request) => isGet(request, LINES_PATH),
  respond: () => jsonResponse({ message: '' }, { status }),
});

/**
 * 다시 부르면 **줄 구성이 달라지는** 라인 응답.
 *
 * 전표가 고쳐지거나 다른 사용자가 먼저 처리해 줄이 사라지는 일이 실제로 있다.
 */
const shrinkingLinesRoute = (): StubRoute => {
  let call = 0;

  return {
    match: (request) => isGet(request, LINES_PATH),
    respond: () => {
      call += 1;

      return jsonResponse({
        items: call === 1 ? inboundReceiptLineFixtures : inboundReceiptLineFixtures.slice(1),
      });
    },
  };
};

/**
 * 입하 상세 스텁. **부를 수 있게 두는 것이 요점이다** —
 * 스텁이 없으면 하네스가 던져 「부르지 않았다」를 증명할 수 없다.
 */
const detailRoute = (): StubRoute => ({
  match: (request) => isGet(request, DETAIL_PATH),
  respond: () =>
    jsonResponse({
      inboundReceipt: { ...(inboundReceiptFixtures[0] ?? {}), inboundReceiptNo: DETAIL_MARKER },
      lines: [],
    }),
});

/**
 * 입고 처리(쓰기) 스텁.
 *
 * **부를 수 있게 두는 것이 요점이다** — 「확인하기 전에는 부르지 않는다」를 증명하려면
 * 부를 수 있는 자리가 있어야 한다. 응답은 계약 형태 그대로여서, 결과 구획이 무엇을 읽는지가
 * 스텁에서 드러난다.
 */
const goodsReceiptRoute = (
  overrides: Record<string, unknown> = {},
  lineOverrides: Record<string, unknown> = {},
): StubRoute => ({
  match: (request) =>
    request.method === 'POST' && new URL(request.url).pathname === GOODS_RECEIPTS_PATH,
  respond: () => jsonResponse(goodsReceiptResponse(overrides, lineOverrides), { status: 201 }),
});

/** 입고 처리 실패. 400·403·네트워크 끊김이 서로 다른 안내로 갈려야 한다. */
const failingGoodsReceiptRoute = (status: number, body: unknown = { message: '' }): StubRoute => ({
  match: (request) =>
    request.method === 'POST' && new URL(request.url).pathname === GOODS_RECEIPTS_PATH,
  respond: () => jsonResponse(body, { status }),
});

const offlineGoodsReceiptRoute = (): StubRoute => ({
  match: (request) =>
    request.method === 'POST' && new URL(request.url).pathname === GOODS_RECEIPTS_PATH,
  respond: () => {
    throw new TypeError('Failed to fetch');
  },
});

/** 이 화면이 닿을 수 있는 경로를 전부 스텁으로 둔 한 벌. */
const allRoutes = (extra: StubRoute[] = []): StubRoute[] => [
  ...extra,
  listRoute(),
  linesRoute(),
  otherLinesRoute(),
  detailRoute(),
  goodsReceiptRoute(),
  lotDetailRoute(),
  ...lookupRoutes(),
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
  hold: string[] = [],
): {
  requests: RecordedRequest[];
  queryClient: QueryClient;
  release: () => void;
  user: ReturnType<typeof userEvent.setup>;
} => {
  const { fetch, requests, release } = createRecordingFetch(routes, hold);

  const { queryClient } = renderWithProviders(
    <>
      <GoodsReceiptScreen />
      <LocationProbe />
      <BackProbe />
      <SearchProbe to={navigateTo} />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, queryClient, release, user: userEvent.setup() };
};

const requestsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === pathname);

const currentLocation = (): string => screen.getByTestId('location').textContent ?? '';

const listTable = (): HTMLElement => screen.getAllByRole('table')[0] as HTMLElement;

const lineTable = (): HTMLElement => screen.getAllByRole('table')[1] as HTMLElement;

const selectReceipt = async (
  user: ReturnType<typeof userEvent.setup>,
  inboundReceiptNo: string,
): Promise<void> => {
  await user.click(screen.getByRole('button', { name: t.actions.selectRow(inboundReceiptNo) }));
};

const selectLine = async (
  user: ReturnType<typeof userEvent.setup>,
  lineNo: number,
): Promise<void> => {
  await user.click(screen.getByRole('button', { name: t.actions.selectLine(lineNo) }));
};

/**
 * 두 구획 어디에도 내부 번호가 새지 않았는지 본다. 짝이 되는 「이름은 보인다」와 함께 쓴다.
 *
 * **주소는 세지 않는다.** 고른 전표·라인의 번호는 주소 키(`ir`·`line`)로 실리는데, 그것은
 * 표시가 아니라 주소 지정 수단이다 — 새로고침·뒤로가기·공유가 같은 대상을 열려면 어딘가에
 * 실려야 하고, 사용자 대면 번호로는 라인 경로를 조립할 수 없다(계약이 내부 번호를 받는다).
 */
const expectNoInternalIds = (): void => {
  const panes = [
    screen.getByRole('region', { name: t.panes.list }),
    screen.getByRole('region', { name: t.panes.lines }),
  ];

  for (const pane of panes) {
    for (const id of INTERNAL_IDS) {
      expect(pane.textContent ?? '').not.toContain(id);
    }
  }
};

describe('GoodsReceiptScreen — 첫 진입 조회', () => {
  /*
   * **M01** — 기본 기간을 심으면 첫 요청에 날짜가 실리고, 사용자는 왜 그 기간만 보이는지
   * 화면 어디에서도 읽을 수 없다(W-01-09가 세운 규칙).
   */
  it('목록 요청이 1회 나가고 날짜 조건이 실리지 않는다', async () => {
    const { requests } = renderScreen(allRoutes());

    await screen.findAllByText('IR-2026-900001');

    const list = requestsTo(requests, LIST_PATH);

    expect(list).toHaveLength(1);
    expect(list[0]?.url.searchParams.has('receiptDateFrom')).toBe(false);
    expect(list[0]?.url.searchParams.has('receiptDateTo')).toBe(false);
    /* 짝 방향 — 조건 자체가 하나도 실리지 않는다. */
    expect([...(list[0]?.url.searchParams.keys() ?? [])]).toEqual([]);
  });

  it('조건을 심지 않고 주소를 그대로 둔다', async () => {
    renderScreen(allRoutes());

    await screen.findAllByText('IR-2026-900001');

    expect(currentLocation()).toBe(ROUTE);
  });

  it('결과가 표에 그려지고 배너가 없다', async () => {
    renderScreen(allRoutes());

    await screen.findAllByText('IR-2026-900001');

    expect(within(listTable()).getAllByRole('row')).toHaveLength(inboundReceiptFixtures.length + 1);
    expect(screen.queryByText(messages.httpError.loadTitle)).not.toBeInTheDocument();
  });

  /* 상세가 주는 헤더 값은 목록 행에 이미 들어 있다 — 부르면 같은 값을 한 번 더 받는다. */
  it('입하 상세를 부르지 않는다', async () => {
    const { requests } = renderScreen(allRoutes());

    await screen.findAllByText('IR-2026-900001');

    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(0);
    expect(screen.queryByText(DETAIL_MARKER)).not.toBeInTheDocument();
  });

  /*
   * **M20 · C20** — 이 PR은 대상을 고르는 데까지다. 되돌릴 수 없는 쓰기는 결과 구획과
   * 함께 나가야 하므로(계획 §5.0) 여기서는 어떤 쓰기도 나가지 않는다.
   */
  it('어떤 쓰기 요청도 보내지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findAllByText('IR-2026-900001');
    await selectReceipt(user, 'IR-2026-900001');
    await screen.findAllByText(ITEM_LABEL);
    await selectLine(user, 1);

    await waitFor(() => {
      expect(currentLocation()).toContain('line=9401');
    });

    expect(requestsTo(requests, GOODS_RECEIPTS_PATH)).toHaveLength(0);
    expect(requests.map((request) => request.method)).toEqual(requests.map(() => 'GET'));
    /* 본문이 실린 요청도 없다 — method만 세면 다른 경로의 쓰기를 놓친다. */
    expect(requests.map((request) => request.body)).toEqual(requests.map(() => null));
    /* 짝 방향 — 읽기는 실제로 나갔다(아무 요청도 없어서 통과한 것이 아니다). */
    expect(requests.length).toBeGreaterThan(0);
  });

  /*
   * **M19 · C12** — 라인 표가 쓰는 참조 셋(품목·단위·자재 LOT)은 아래 구획만 쓴다.
   * 그 표 자체가 라인 응답을 기다리므로 미리 받아 둘 이득이 없고, 고르기 전에 부르면
   * 어느 요청이 무엇을 위한 것인지 가릴 수 없고 첫 진입의 요청 수가 이유 없이 는다.
   */
  it('품목·단위·자재 LOT을 전표를 고르기 전에 부르지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findAllByText('IR-2026-900001');

    expect(requestsTo(requests, ITEMS_PATH)).toHaveLength(0);
    expect(requestsTo(requests, UOMS_PATH)).toHaveLength(0);
    expect(requestsTo(requests, LOTS_PATH)).toHaveLength(0);

    // 짝 방향 — 고르면 실제로 부른다(스텁이 있으므로 「부를 수 있었다」가 성립한다).
    await selectReceipt(user, 'IR-2026-900001');

    await waitFor(() => {
      expect(requestsTo(requests, ITEMS_PATH).length).toBeGreaterThan(0);
      expect(requestsTo(requests, UOMS_PATH).length).toBeGreaterThan(0);
      expect(requestsTo(requests, LOTS_PATH).length).toBeGreaterThan(0);
    });
  });

  /*
   * **공장만 미리 받는다.** 제목줄은 **목록 응답만으로** 곧바로 그려지므로(고른 행에 값이 있다)
   * 고른 뒤에 부르기 시작하면 제목줄만 한 박자 늦게 채워진다 — 라인 표가 쓰는 셋과 사정이 다르다.
   */
  it('공급사와 공장은 첫 진입에 부른다', async () => {
    const { requests } = renderScreen(allRoutes());

    await screen.findAllByText('IR-2026-900001');

    expect(requestsTo(requests, PARTNERS_PATH)).toHaveLength(1);
    expect(requestsTo(requests, PLANTS_PATH)).toHaveLength(1);
  });

  /* 자재 LOT은 번호 목록으로 조회할 수단이 없어 **품목마다** 부른다. */
  it('자재 LOT을 라인의 품목마다 한 번씩 부른다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findAllByText('IR-2026-900001');
    await selectReceipt(user, 'IR-2026-900001');

    await waitFor(() => {
      expect(requestsTo(requests, LOTS_PATH)).toHaveLength(2);
    });

    expect(
      requestsTo(requests, LOTS_PATH)
        .map((request) => request.url.searchParams.get('itemId'))
        .sort(),
    ).toEqual(['9301', '9302']);
  });

  /*
   * **R-1의 완화 층** — 자재 LOT은 다섯 중 유일한 거래 기록이라 가장 잘리기 쉽다.
   * 쪽 크기를 실어 잘림 **빈도**를 낮춘다. 보장이 아니므로 잘림 표식이 따로 있다.
   *
   * 짝 방향으로 **다른 참조에는 싣지 않는다**를 함께 단언한다 — 그래야 이 값이
   * 「자재 LOT에만 필요한 완화」임이 고정된다.
   */
  it('자재 LOT에만 쪽 크기를 싣는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findAllByText('IR-2026-900001');
    await selectReceipt(user, 'IR-2026-900001');

    await waitFor(() => {
      expect(requestsTo(requests, LOTS_PATH).length).toBeGreaterThan(0);
    });

    for (const request of requestsTo(requests, LOTS_PATH)) {
      expect(request.url.searchParams.get('size')).toBe(String(LOT_PAGE_SIZE));
    }

    for (const path of [PARTNERS_PATH, PLANTS_PATH, ITEMS_PATH, UOMS_PATH, LIST_PATH]) {
      for (const request of requestsTo(requests, path)) {
        expect(request.url.searchParams.has('size')).toBe(false);
      }
    }
  });

  /* **C21** — 조회 조건의 상태 선택지는 비어 있고 왜 비어 있는지 안내가 붙는다. */
  it('상태 선택지가 비어 있고 안내가 붙는다', async () => {
    renderScreen(allRoutes());

    await screen.findAllByText('IR-2026-900001');

    const status = screen.getByLabelText(t.fields.status);

    expect(status.getAttribute('aria-describedby')).toBe(
      screen.getByText(messages.pendingCode.note).getAttribute('id'),
    );
  });
});

describe('GoodsReceiptScreen — 조건과 주소', () => {
  /* **M02 · C03** — 조건을 화면 상태로만 들고 있으면 새로고침·공유가 다른 결과를 낸다. */
  it('주소의 조건이 요청 쿼리에 그대로 실린다', async () => {
    const { requests } = renderScreen(
      allRoutes(),
      '?sup=9101&from=2026-08-01&to=2026-08-31&st=SAMPLE_IR_STATUS_A&q=IR-2026',
    );

    await screen.findAllByText('IR-2026-900001');

    const query = requestsTo(requests, LIST_PATH)[0]?.url.searchParams;

    expect(query?.get('supplierId')).toBe('9101');
    expect(query?.get('receiptDateFrom')).toBe('2026-08-01');
    expect(query?.get('receiptDateTo')).toBe('2026-08-31');
    expect(query?.get('statusCode')).toBe('SAMPLE_IR_STATUS_A');
    expect(query?.get('q')).toBe('IR-2026');
  });

  it('조건 줄에서 조회하면 주소와 요청에 함께 나타난다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findAllByText('IR-2026-900001');
    await user.type(screen.getByLabelText(t.fields.q), 'IR-2026-900002');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH)).toHaveLength(2);
    });

    expect(currentLocation()).toContain('q=IR-2026-900002');
    expect(requestsTo(requests, LIST_PATH)[1]?.url.searchParams.get('q')).toBe('IR-2026-900002');
  });

  /*
   * **M03 · C04** — 조건과 쪽을 따로 갱신하면 뒤로가기 기록이 두 칸 늘어
   * 사용자가 뒤로 눌렀는데 같은 자리로 돌아온 것처럼 보인다.
   */
  it('조회 한 번에 히스토리가 한 칸만 늘어난다', async () => {
    const { user } = renderScreen(allRoutes(), '?page=2');

    await screen.findAllByText('IR-2026-900001');
    await user.type(screen.getByLabelText(t.fields.q), 'IR-2026-900002');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(currentLocation()).toContain('q=IR-2026-900002');
    });

    // 한 칸만 늘었으면 뒤로 한 번에 처음 주소로 돌아온다.
    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?page=2`);
    });
  });

  /* **M04** — 조건이 바뀌면 그 결과에 없을 수 있는 선택을 남기지 않는다(수명 표 1행). */
  it('조건 변경이 쪽과 고른 전표·라인을 함께 비운다', async () => {
    const { user } = renderScreen(allRoutes(), '?page=2&ir=9001&line=9401');

    await screen.findAllByText('IR-2026-900001');
    await user.type(screen.getByLabelText(t.fields.q), 'IR-2026');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=IR-2026`);
    });
  });

  it('초기화가 조건과 선택을 모두 비운다', async () => {
    const { user } = renderScreen(allRoutes(), '?sup=9101&q=IR&ir=9001&line=9401');

    await screen.findAllByText('IR-2026-900001');
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  /* **M05** — 쪽을 옮기면 보이는 행이 통째로 달라진다. 앞 쪽의 선택을 남기지 않는다(수명 표 3행). */
  it('쪽 이동이 고른 전표·라인을 비운다', async () => {
    const { user } = renderScreen(
      [
        listRoute(inboundReceiptFixtures, { page: 1, size: 2, total: 6 }),
        linesRoute(),
        otherLinesRoute(),
        detailRoute(),
        goodsReceiptRoute(),
        ...lookupRoutes(),
      ],
      '?sup=9101&ir=9001&line=9401',
    );

    await screen.findAllByText('IR-2026-900001');
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?sup=9101&page=2`);
    });
  });

  /*
   * **M09의 화면 몫** — 정수가 아닌 번호를 그대로 보내면 조회 전체가 400으로 실패하고,
   * 사용자에게는 「조회가 늘 안 된다」로만 보인다.
   */
  it('정수가 아닌 조건과 선택은 요청에 실리지 않는다', async () => {
    const { requests } = renderScreen(allRoutes(), '?sup=abc&page=0&ir=xyz&line=0&from=2026-13-01');

    await screen.findAllByText('IR-2026-900001');

    const query = requestsTo(requests, LIST_PATH)[0]?.url.searchParams;

    expect(query?.has('supplierId')).toBe(false);
    expect(query?.has('page')).toBe(false);
    expect(query?.has('receiptDateFrom')).toBe(false);
    /* 고른 전표가 없는 것으로 읽혀 아래 구획은 「고르면 보인다」다 — 라인 조회도 나가지 않는다. */
    expect(requestsTo(requests, LINES_PATH)).toHaveLength(0);
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  /*
   * **M15** — 조건 줄 입력이 주소를 바꾸면 글자마다 뒤로가기 기록이 쌓이고,
   * 반쯤 지운 검색어로 요청이 나간다.
   */
  it('조건을 치는 동안 주소가 바뀌지 않고 요청도 늘지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findAllByText('IR-2026-900001');
    await user.type(screen.getByLabelText(t.fields.q), 'IR-2026-9');

    expect(currentLocation()).toBe(ROUTE);
    expect(requestsTo(requests, LIST_PATH)).toHaveLength(1);
  });

  /*
   * **M14 · #43** — 목록 응답이 도착해 부모가 다시 그려질 때 조건 줄이 참조로 되돌림을
   * 판정하면 **치던 값이 사라진다.** 이 PR에서 사용자가 치는 자리는 조건 줄뿐이고,
   * 같은 형태의 되돌림이 PR ②의 초안에서 다시 나온다.
   */
  it('목록이 다시 도착해도 치던 조건이 사라지지 않는다', async () => {
    const { requests, queryClient, user } = renderScreen([
      changingListRoute(),
      linesRoute(),
      otherLinesRoute(),
      detailRoute(),
      goodsReceiptRoute(),
      ...lookupRoutes(),
    ]);

    await screen.findAllByText('IR-2026-900001');
    /* 첫 응답이 적용된 것을 눈에 보이는 값으로 확인한다 — 전체 건수가 부를 때마다 는다. */
    await screen.findByText(t.pageNav.range(1, 3, 4));

    await user.type(screen.getByLabelText(t.fields.q), 'IR-2026-9');

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: irKeys.lists });
    });

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(1);
    });

    /*
     * **새 응답이 실제로 화면에 적용될 때까지 기다린다.** 요청이 나간 것만 보고 단언하면
     * 다시 그려지기 전에 검사해 **어떤 되돌림 결함도 통과시킨다**(늘 참인 단언).
     */
    await screen.findByText(t.pageNav.range(1, 3, 5));

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('IR-2026-9');
  });
});

describe('GoodsReceiptScreen — 조회 실패', () => {
  /*
   * **M07 · C08** — 실패를 「없습니다」로 내면 사용자가 자료가 없는 줄 알고 조건을 넓힌다.
   * 실제로는 조회 자체가 되지 않은 것이라 무엇을 해도 결과가 같다.
   */
  it('조회 실패는 배너로 내고 빈 상태 문구를 함께 내지 않는다', async () => {
    renderScreen([failingListRoute(500), ...lookupRoutes(), goodsReceiptRoute()]);

    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.beyondLastTitle)).not.toBeInTheDocument();
  });

  it('조회가 실패해도 조건 줄은 남는다', async () => {
    renderScreen([failingListRoute(500), ...lookupRoutes(), goodsReceiptRoute()]);

    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.getByRole('button', { name: messages.common.search })).toBeInTheDocument();
  });

  /* **C08** — 같은 권한으로 다시 불러도 같은 답이 온다. 헛돌게 하지 않는다. */
  it('권한이 없으면 다시 시도를 내지 않는다', async () => {
    renderScreen([failingListRoute(403), ...lookupRoutes(), goodsReceiptRoute()]);

    await screen.findByText(messages.httpError.forbidden);

    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  /* **M08 · C09** — 「버튼이 있다」만 보면 눌러도 아무 일이 없는 버튼을 통과시킨다. */
  it('다시 시도를 누르면 그 경로의 요청 수가 는다', async () => {
    const { requests, user } = renderScreen([
      failingListRoute(500),
      ...lookupRoutes(),
      goodsReceiptRoute(),
    ]);

    await screen.findByText(messages.httpError.loadTitle);

    const before = requestsTo(requests, LIST_PATH).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(before);
    });
  });

  it('라인 조회 실패는 아래 구획의 배너로 낸다', async () => {
    const { user } = renderScreen([
      listRoute(),
      failingLinesRoute(),
      otherLinesRoute(),
      detailRoute(),
      goodsReceiptRoute(),
      ...lookupRoutes(),
    ]);

    await screen.findAllByText('IR-2026-900001');
    await selectReceipt(user, 'IR-2026-900001');

    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.queryByText(t.empty.noLinesTitle)).not.toBeInTheDocument();
  });

  /*
   * 고른 번호는 있는데 목록을 못 받았다. 골격을 내면 **기다리라고 말하는데 기다려서 풀리지 않는다** —
   * 제목줄이 쓰는 전표의 값이 목록 응답에만 있어 구획을 열 수 없다.
   */
  it('목록이 실패하면 고른 전표를 열 수 없다고 밝힌다', async () => {
    renderScreen([failingListRoute(500), ...lookupRoutes(), goodsReceiptRoute()], '?ir=9001');

    await screen.findByText(t.empty.listFailedTitle);

    expect(screen.queryByRole('status', { name: t.loading.lines })).not.toBeInTheDocument();
  });
});

describe('GoodsReceiptScreen — 전표 고르기', () => {
  /* **C10 · C16** — 고르면 라인을 1회 조회하고 그 사실이 주소에 남는다. */
  it('전표를 고르면 라인을 1회 조회하고 주소에 실린다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findAllByText('IR-2026-900001');
    await selectReceipt(user, 'IR-2026-900001');

    await screen.findAllByText(ITEM_LABEL);

    expect(requestsTo(requests, LINES_PATH)).toHaveLength(1);
    expect(currentLocation()).toBe(`${ROUTE}?ir=9001`);
  });

  /* 새로고침·공유가 같은 전표를 연다 — 주소만 주어져도 아래 구획이 열린다. */
  it('주소에 고른 전표가 있으면 곧바로 라인이 열린다', async () => {
    renderScreen(allRoutes(), '?ir=9001');

    await screen.findAllByText(ITEM_LABEL);

    expect(screen.getByRole('group', { name: t.summary.label })).toBeInTheDocument();
  });

  /* 고르고 푸는 것은 보이는 행을 바꾸지 않는다(수명 표 4행). */
  it('전표를 고르고 풀어도 조건과 쪽이 그대로다', async () => {
    const { user } = renderScreen(
      [
        listRoute(inboundReceiptFixtures, { page: 2, size: 2, total: 6 }),
        linesRoute(),
        otherLinesRoute(),
        detailRoute(),
        goodsReceiptRoute(),
        ...lookupRoutes(),
      ],
      '?sup=9101&page=2',
    );

    await screen.findAllByText('IR-2026-900001');
    await selectReceipt(user, 'IR-2026-900001');

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?sup=9101&page=2&ir=9001`);
    });

    await user.click(screen.getByRole('button', { name: t.actions.deselectRow('IR-2026-900001') }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?sup=9101&page=2`);
    });
  });

  /* 다른 전표로 옮기면 앞 전표의 라인 선택은 뜻을 잃는다(수명 표 4행). */
  it('다른 전표를 고르면 고른 라인이 풀린다', async () => {
    const { user } = renderScreen(allRoutes(), '?ir=9001&line=9401');

    await screen.findAllByText(ITEM_LABEL);
    await selectReceipt(user, 'IR-2026-900002');

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?ir=9002`);
    });
  });

  /*
   * **M17 · C18** — 갱신된 결과에 고른 전표가 없으면 주소에서 정리한다.
   * **클릭 핸들러가 아니라 고른 식별자에 묶여야** 주소 직접 편집·뒤로가기에서도 샌다.
   */
  it('결과에 없는 전표는 주소에서 정리된다', async () => {
    renderScreen(
      [
        filteringListRoute(),
        linesRoute(),
        otherLinesRoute(),
        detailRoute(),
        goodsReceiptRoute(),
        ...lookupRoutes(),
      ],
      '?q=IR-2026-900002&ir=9001&line=9401',
    );

    await screen.findByText('IR-2026-900002');

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=IR-2026-900002`);
    });

    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  /*
   * **M18** — 조회를 기다리는 동안에는 행이 비어 있다. 가드가 없으면 「고른 전표가 사라졌다」로
   * 읽혀 아래 구획이 깜빡 닫히고 주소에서 선택이 사라진다.
   */
  it('목록 응답 전에는 고른 전표를 지우지 않는다', async () => {
    const { release } = renderScreen(allRoutes(), '?ir=9001', '', [LIST_PATH]);

    await screen.findByRole('status', { name: t.loading.lines });

    expect(currentLocation()).toBe(`${ROUTE}?ir=9001`);
    expect(screen.queryByText(t.empty.noSelectionTitle)).not.toBeInTheDocument();

    release();

    await screen.findAllByText(ITEM_LABEL);

    expect(currentLocation()).toBe(`${ROUTE}?ir=9001`);
  });
});

describe('GoodsReceiptScreen — 라인 고르기', () => {
  /* **C13 · M12의 화면 몫** — 자재 LOT이 없는 줄은 계약이 요구하는 값을 만들 수 없다. */
  it('자재 LOT이 없는 줄은 고를 수 없고 사유가 보인다', async () => {
    renderScreen(allRoutes(), '?ir=9001');

    await screen.findAllByText(ITEM_LABEL);

    expect(screen.getByRole('button', { name: t.actions.selectLine(3) })).toBeDisabled();
    expect(screen.getByText(t.reasons.lineNoLot)).toBeInTheDocument();
    /* 짝 방향 — 고를 수 있는 줄은 실제로 열려 있다. */
    expect(screen.getByRole('button', { name: t.actions.selectLine(1) })).toBeEnabled();
  });

  /* **C14** — 계약이 `exclusiveMinimum: 0`이라 0도 보낼 수 없다. */
  it('입하 수량이 0 이하인 줄은 고를 수 없고 다른 사유가 보인다', async () => {
    renderScreen(allRoutes(), '?ir=9001');

    await screen.findAllByText(ITEM_LABEL);

    expect(screen.getByRole('button', { name: t.actions.selectLine(4) })).toBeDisabled();
    expect(screen.getByText(t.reasons.lineQtyNotPositive)).toBeInTheDocument();
  });

  it('라인을 고르면 주소에 실리고 고른 줄의 제목줄이 열린다', async () => {
    const { user } = renderScreen(allRoutes(), '?ir=9001');

    await screen.findAllByText(ITEM_LABEL);
    await selectLine(user, 1);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?ir=9001&line=9401`);
    });

    expect(screen.getByRole('group', { name: t.lineSummary.label })).toBeInTheDocument();
    /* 줄을 고르면 그 아래에 확정 입력이 열린다 — 고른 줄이 그 입력의 대상이다. */
    expect(screen.getByRole('region', { name: t.panes.post })).toBeInTheDocument();
  });

  /*
   * **짝 방향** — 확정 입력은 **고른 줄 아래에만** 있다. 대상이 없는데 창고·코드를 받으면
   * 그 입력이 무엇에 대한 것인지 화면이 말할 수 없고, 줄을 고르는 순간 그 값이 사라진다
   * (수명 표 5행). 있음만 단언하면 조건을 통째로 지워 늘 내게 만들어도 통과한다.
   */
  it('줄을 고르기 전에는 확정 입력을 그리지 않는다', async () => {
    renderScreen(allRoutes(), '?ir=9001');

    // 선행 긍정 — 아래 구획이 실제로 열려 있다(아무것도 안 그려서 통과한 것이 아니다).
    await screen.findAllByText(ITEM_LABEL);

    expect(screen.queryByRole('region', { name: t.panes.post })).not.toBeInTheDocument();
  });

  /* **M16 · C15** — 한 줄만 고른다. 둘째를 고르면 앞 선택이 풀린다. */
  it('둘째 줄을 고르면 앞 선택이 풀린다', async () => {
    const { user } = renderScreen(allRoutes(), '?ir=9001');

    await screen.findAllByText(ITEM_LABEL);
    await selectLine(user, 1);

    await waitFor(() => {
      expect(currentLocation()).toContain('line=9401');
    });

    await selectLine(user, 2);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?ir=9001&line=9402`);
    });

    /* 해제 버튼이 하나뿐이다 — 둘이면 두 줄이 함께 골라져 있는 것이다. */
    expect(within(lineTable()).getAllByRole('button', { name: /선택 해제$/ })).toHaveLength(1);
  });

  it('고른 줄을 다시 누르면 풀린다', async () => {
    const { user } = renderScreen(allRoutes(), '?ir=9001&line=9401');

    await screen.findAllByText(ITEM_LABEL);
    await user.click(screen.getByRole('button', { name: t.actions.deselectLine(1) }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?ir=9001`);
    });

    expect(screen.queryByRole('group', { name: t.lineSummary.label })).not.toBeInTheDocument();
  });

  /* 라인을 고르고 푸는 것은 조건·쪽·고른 전표를 건드리지 않는다(수명 표 5행). */
  it('라인 고르기가 조건과 고른 전표를 건드리지 않는다', async () => {
    const { user } = renderScreen(allRoutes(), '?sup=9101&ir=9001');

    await screen.findAllByText(ITEM_LABEL);
    await selectLine(user, 1);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?sup=9101&ir=9001&line=9401`);
    });
  });

  /* **M17의 라인 몫 · C18** — 갱신된 라인에 그 줄이 없으면 주소에서 정리한다. */
  it('라인 목록에 없는 줄은 주소에서 정리된다', async () => {
    renderScreen(allRoutes(), '?ir=9001&line=9499');

    await screen.findAllByText(ITEM_LABEL);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?ir=9001`);
    });
  });

  /* 주소를 손으로 고쳐 고를 수 없는 줄을 가리키는 경우도 같은 자리에서 정리된다. */
  it('고를 수 없는 줄을 가리키면 주소에서 정리된다', async () => {
    renderScreen(allRoutes(), '?ir=9001&line=9403');

    await screen.findAllByText(ITEM_LABEL);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?ir=9001`);
    });

    expect(screen.queryByRole('group', { name: t.lineSummary.label })).not.toBeInTheDocument();
  });

  /* 라인 응답 전에 정리하면 새로고침 직후 고른 줄이 주소에서 사라진다. */
  it('라인 응답 전에는 고른 줄을 지우지 않는다', async () => {
    const { release } = renderScreen(allRoutes(), '?ir=9001&line=9401', '', [LINES_PATH]);

    await screen.findByRole('status', { name: t.loading.lines });

    expect(currentLocation()).toBe(`${ROUTE}?ir=9001&line=9401`);

    release();

    await screen.findAllByText(ITEM_LABEL);

    expect(currentLocation()).toBe(`${ROUTE}?ir=9001&line=9401`);
  });

  /*
   * **C17** — 목록 재조회·참조 도착이 고른 라인을 되돌리면 「고르던 것이 사라진다」가 된다.
   * 이 PR에서 고른 것은 주소가 들고 있어 응답에 반응하지 않는다.
   */
  it('목록이 다시 도착해도 고른 라인이 풀리지 않는다', async () => {
    const { queryClient } = renderScreen(
      [
        changingListRoute(),
        linesRoute(),
        otherLinesRoute(),
        detailRoute(),
        goodsReceiptRoute(),
        ...lookupRoutes(),
      ],
      '?ir=9001&line=9401',
    );

    await screen.findAllByText(ITEM_LABEL);
    await screen.findByText(t.pageNav.range(1, 3, 4));

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: irKeys.lists });
    });

    /* 새 목록이 실제로 적용된 뒤에 본다 — 적용 전에 검사하면 늘 참인 단언이 된다. */
    await screen.findByText(t.pageNav.range(1, 3, 5));

    expect(screen.getByRole('group', { name: t.lineSummary.label })).toBeInTheDocument();
    expect(currentLocation()).toBe(`${ROUTE}?ir=9001&line=9401`);
  });

  /* 라인이 실제로 사라지면 정리된다 — 위 단언이 「늘 참」이 아님을 짝으로 보인다. */
  it('다시 부른 라인에서 사라진 줄은 정리된다', async () => {
    const { queryClient } = renderScreen(
      [
        listRoute(),
        shrinkingLinesRoute(),
        otherLinesRoute(),
        detailRoute(),
        goodsReceiptRoute(),
        ...lookupRoutes(),
      ],
      '?ir=9001&line=9401',
    );

    await screen.findAllByText(ITEM_LABEL);

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: irKeys.lines(9001) });
    });

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?ir=9001`);
    });
  });
});

describe('GoodsReceiptScreen — 빈 상태', () => {
  /* **C07** — 네 갈래이고 사용자가 할 조치가 서로 다르다. */
  it('조건에 맞는 결과가 없으면 결과 없음을 낸다', async () => {
    renderScreen([listRoute([]), ...lookupRoutes(), goodsReceiptRoute()]);

    await screen.findByText(t.empty.noResultTitle);

    expect(screen.queryByText(t.empty.beyondLastTitle)).not.toBeInTheDocument();
  });

  it('결과는 있는데 이 쪽에 없으면 첫 쪽 안내를 낸다', async () => {
    const { user } = renderScreen(
      [listRoute([], { page: 5, size: 50, total: 120 }), ...lookupRoutes(), goodsReceiptRoute()],
      '?page=5',
    );

    await screen.findByText(t.empty.beyondLastTitle);

    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  it('전표를 고르지 않았으면 고르라고 안내한다', async () => {
    renderScreen(allRoutes());

    await screen.findAllByText('IR-2026-900001');

    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  it('라인이 없는 전표는 라인 없음을 낸다', async () => {
    renderScreen(allRoutes(), '?ir=9002');

    await screen.findByText(t.empty.noLinesTitle);

    expect(screen.queryByText(t.empty.noSelectionTitle)).not.toBeInTheDocument();
  });
});

describe('GoodsReceiptScreen — 참조 풀이', () => {
  /*
   * **M10 · #47** — 본 자료가 참조 목록보다 먼저 오는 순간이 실제로 있다.
   * 미도착을 「알 수 없음」으로 내면 정상 값이 잘못된 값으로 보인다.
   */
  it('참조가 아직 오지 않았으면 알 수 없음으로 내지 않는다', async () => {
    const { release } = renderScreen(allRoutes(), '', '', [PARTNERS_PATH]);

    await screen.findAllByText('IR-2026-900001');

    expect(within(listTable()).getAllByText(t.values.referenceLoading).length).toBeGreaterThan(0);
    expect(within(listTable()).queryByText(t.values.unknown)).not.toBeInTheDocument();

    release();

    await screen.findAllByText(SUPPLIER_LABEL);
  });

  /*
   * **M11 · #44** — 이름을 못 풀어도 번호를 내지 않는다. 짝 방향으로 「풀린 이름은 보인다」를
   * 함께 단언해 아무것도 안 그려도 통과하지 않게 한다.
   */
  it('참조 다섯이 풀린 뒤에도 내부 번호가 화면에 없다', async () => {
    const { user } = renderScreen(allRoutes(), '?ir=9001');

    await screen.findAllByText(ITEM_LABEL);
    await selectLine(user, 1);

    await screen.findByRole('group', { name: t.lineSummary.label });

    expect(screen.getAllByText(SUPPLIER_LABEL).length).toBeGreaterThan(0);
    expect(screen.getAllByText(PLANT_LABEL).length).toBeGreaterThan(0);
    expect(screen.getAllByText('LOT-2026-900010').length).toBeGreaterThan(0);
    expect(screen.getAllByText(t.lineTable.receivedQtyPair(100, UOM_LABEL)).length).toBeGreaterThan(
      0,
    );

    expectNoInternalIds();
  });

  it('참조 목록에 없는 값은 알 수 없음이고 번호를 내지 않는다', async () => {
    renderScreen(allRoutes());

    await screen.findByText('IR-2026-900002');

    // 9002의 공급사(9102)는 참조 목록에 없다.
    expect(within(listTable()).getByText(t.values.unknown)).toBeInTheDocument();
    expectNoInternalIds();
  });

  it.each([
    ['공급사', PARTNERS_PATH, t.reasons.referencesFailed, t.panes.list],
    ['공장', PLANTS_PATH, t.reasons.lineReferencesFailed, t.panes.lines],
    ['품목', ITEMS_PATH, t.reasons.lineReferencesFailed, t.panes.lines],
    ['단위', UOMS_PATH, t.reasons.lineReferencesFailed, t.panes.lines],
    ['자재 LOT', LOTS_PATH, t.reasons.lineReferencesFailed, t.panes.lines],
  ])(
    '%s 참조가 실패하면 그 이름이 보이는 구획에 사유와 복구 경로가 있다',
    async (_label, path, note, paneName) => {
      renderScreen(
        [
          /* 실패 규칙을 **앞에** 둔다 — 스텁은 먼저 맞는 규칙을 쓴다. */
          failingLookupRoute(path),
          listRoute(),
          linesRoute(),
          otherLinesRoute(),
          detailRoute(),
          goodsReceiptRoute(),
          ...lookupRoutes(),
        ],
        '?ir=9001',
      );

      await screen.findByText(note);

      const pane = screen.getByRole('region', { name: paneName });

      /*
       * 이름 자리에 사유가 실제로 나타나는지 본다. 단위처럼 다른 값과 한 칸에 묶여 나오는
       * 자리가 있어(「100 이름을 불러오지 못했습니다」) 텍스트 노드로 딱 맞춰 찾을 수 없다.
       */
      expect(pane.textContent ?? '').toContain(t.values.referenceFailed);
      expect(within(pane).getByRole('button', { name: messages.common.retry })).toBeInTheDocument();
    },
  );

  /*
   * 복구 경로가 **그 참조를 실제로 다시 부르는지**까지 본다 — 「버튼이 있다」만 보면
   * 눌러도 아무 일이 없는 버튼을 통과시킨다.
   */
  it('아래 구획의 다시 시도가 라인 참조를 다시 부른다', async () => {
    const { requests, user } = renderScreen(
      [
        listRoute(),
        linesRoute(),
        otherLinesRoute(),
        detailRoute(),
        goodsReceiptRoute(),
        lookupRoute(PARTNERS_PATH, partnerFixtures),
        lookupRoute(PLANTS_PATH, plantFixtures),
        lookupRoute(UOMS_PATH, uomFixtures),
        lotsRoute(),
        failingLookupRoute(ITEMS_PATH),
      ],
      '?ir=9001',
    );

    await screen.findByText(t.reasons.lineReferencesFailed);

    const before = requestsTo(requests, ITEMS_PATH).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, ITEMS_PATH).length).toBeGreaterThan(before);
    });
  });

  /*
   * **R-1** — 자재 LOT이 잘리면 그 뒤의 정상 LOT이 「알 수 없음」으로 찍히는데, 이 화면은
   * 그 문구를 「값이 잘못됐다는 신호」로 정의해 두었다. 잘렸다는 사실이 화면에 나와야
   * 사용자가 정상 값을 잘못된 값으로 읽지 않는다.
   */
  it('자재 LOT 목록이 잘리면 라인 구획이 그 사실을 밝힌다', async () => {
    renderScreen(
      [
        listRoute(),
        linesRoute(),
        otherLinesRoute(),
        detailRoute(),
        goodsReceiptRoute(),
        lookupRoute(PARTNERS_PATH, partnerFixtures),
        lookupRoute(PLANTS_PATH, plantFixtures),
        lookupRoute(ITEMS_PATH, itemFixtures),
        lookupRoute(UOMS_PATH, uomFixtures),
        /* 서버가 「전체 500건 중 이만큼」이라고 답한다 — 쪽 크기를 실어도 잘릴 수 있다. */
        lookupRoute(LOTS_PATH, lotFixtures, { total: 500 }),
      ],
      '?ir=9001',
    );

    await screen.findByText(t.reasons.lineReferencesTruncated);
  });

  /* 짝 방향 — 잘리지 않으면 내지 않는다. 늘 뜨는 안내는 읽히지 않는다. */
  it('자재 LOT 목록이 잘리지 않으면 그 안내를 내지 않는다', async () => {
    renderScreen(allRoutes(), '?ir=9001');

    await screen.findAllByText('LOT-2026-900010');

    expect(screen.queryByText(t.reasons.lineReferencesTruncated)).not.toBeInTheDocument();
  });

  /* 잘림을 밝히지 않으면 불완전한 목록을 완전한 것으로 읽는다. */
  it('공급사 선택지가 잘리면 잘림 표식이 붙는다', async () => {
    renderScreen([
      listRoute(),
      linesRoute(),
      otherLinesRoute(),
      detailRoute(),
      goodsReceiptRoute(),
      lookupRoute(PARTNERS_PATH, partnerFixtures, { total: 500 }),
      lookupRoute(PLANTS_PATH, plantFixtures),
      lookupRoute(ITEMS_PATH, itemFixtures),
      lookupRoute(UOMS_PATH, uomFixtures),
      lotsRoute(),
    ]);

    await screen.findByText(t.filters.lookupTruncated);
  });

  /*
   * 라인이 참조보다 먼저 오는 순서를 실제로 만든다 — LOT 이름이 아직 없을 때
   * 「알 수 없음」이 아니라 「이름 불러오는 중」이 보여야 한다.
   */
  it('자재 LOT 이름이 늦게 와도 알 수 없음으로 내지 않는다', async () => {
    /*
     * **품목이 전부 풀리는 줄 하나만 둔다.** 여러 줄을 쓰면 참조 목록에 없는 품목의
     * 「알 수 없음」이 함께 나와, LOT 칸이 무엇을 내는지 이 단언이 가리지 못한다.
     */
    const { release } = renderScreen(
      [
        listRoute(),
        linesRoute([inboundReceiptLine()]),
        otherLinesRoute(),
        detailRoute(),
        goodsReceiptRoute(),
        ...lookupRoutes(),
      ],
      '?ir=9001',
      '',
      [LOTS_PATH],
    );

    await screen.findAllByText(ITEM_LABEL);

    expect(within(lineTable()).getByText(t.values.referenceLoading)).toBeInTheDocument();
    expect(within(lineTable()).queryByText(t.values.unknown)).not.toBeInTheDocument();

    release();

    await screen.findAllByText('LOT-2026-900010');
  });

  /* LOT이 **없는** 것과 이름을 못 푼 것은 다르다 — 없는 줄은 빈 값 표기이고 사유가 따로 붙는다. */
  it('자재 LOT이 없는 줄은 알 수 없음이 아니라 빈 값 표기다', async () => {
    renderScreen(
      [
        listRoute(),
        linesRoute([inboundReceiptLine({ lotId: null })]),
        otherLinesRoute(),
        detailRoute(),
        goodsReceiptRoute(),
        ...lookupRoutes(),
      ],
      '?ir=9001',
    );

    await screen.findAllByText(ITEM_LABEL);

    expect(within(lineTable()).getByText(t.values.empty)).toBeInTheDocument();
    expect(within(lineTable()).queryByText(t.values.unknown)).not.toBeInTheDocument();
    expect(screen.getByText(t.reasons.lineNoLot)).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------------ *
 * 입고 처리 — 되돌릴 수 없는 쓰기
 * ------------------------------------------------------------------------ */

type GoodsReceiptCreate = components['schemas']['GoodsReceiptCreate'];

const RECEIPT_DATETIME = '2026-08-06T09:12';

const WAREHOUSE_LABEL = 'SAMPLE-WH-01 · 합성 창고 가';
const OTHER_WAREHOUSE_LABEL = 'SAMPLE-WH-02 · 합성 창고 나';
const LOCATION_LABEL = 'SAMPLE-LOC-A1 · 합성 열 가1';
const OTHER_LOCATION_LABEL = 'SAMPLE-LOC-B · 합성 구역 나';

/**
 * 결과 구획 어디에도 나와서는 안 되는 내부 번호.
 *
 * 입고 전표 대역(9900대)·창고(9700대)·위치(9800대)뿐 아니라 **입하 전표와 라인 대역까지**
 * 함께 본다 — 결과 구획이 내는 원천 문서 자리가 그 번호로 새기 가장 쉬운 자리다.
 * 업무 번호(`GR-2026-800001`·`IR-2026-900001`)에는 이 문자열들이 부분으로 들어가지 않는다.
 */
const POST_INTERNAL_IDS = [...INTERNAL_IDS, '9901', '9902', '9903', '9701', '9702', '9801', '9802'];

const postRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === GOODS_RECEIPTS_PATH);

/** 마지막으로 나간 요청 본문. **계약 타입으로 읽는다** — 형태가 어긋나면 타입 검사가 잡는다. */
const lastPostBody = (requests: RecordedRequest[]): GoodsReceiptCreate => {
  const sent = postRequests(requests);

  expect(sent.length).toBeGreaterThan(0);

  return sent[sent.length - 1]?.body as GoodsReceiptCreate;
};

const chooseOption = async (
  user: ReturnType<typeof userEvent.setup>,
  fieldLabel: string,
  optionLabel: string,
): Promise<void> => {
  await user.click(screen.getByRole('combobox', { name: fieldLabel }));
  await user.click(screen.getByRole('option', { name: optionLabel }));
};

/** 확정 구획이 열릴 때까지 — 전표를 고르고 줄을 고른다. */
const openPostPane = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await screen.findAllByText(ITEM_LABEL);
  await selectLine(user, 1);
  await screen.findByRole('region', { name: t.panes.post });
};

/** 코드 넷을 고른다. 사유는 계약상 선택이라 채우지 않는다. */
const chooseRequiredCodes = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await chooseOption(user, t.fields.receiptType, SAMPLE_RECEIPT_TYPE);
  await chooseOption(user, t.fields.sourceDocumentType, SAMPLE_SOURCE_TYPE);
  await chooseOption(user, t.fields.qualityStatus, SAMPLE_QUALITY);
  await chooseOption(user, t.fields.inventoryStatus, SAMPLE_INVENTORY);
};

/** 보낼 수 있는 상태까지 채운다 — 창고·위치·코드 넷·입고 일시. */
const fillDraft = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await chooseOption(user, t.fields.warehouse, WAREHOUSE_LABEL);
  await chooseOption(user, t.fields.location, LOCATION_LABEL);
  await chooseRequiredCodes(user);
  await user.type(screen.getByLabelText(t.fields.receiptDatetime), RECEIPT_DATETIME);
};

const postButton = (): HTMLElement => screen.getByRole('button', { name: t.actions.post });

const clickPost = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(postButton());
};

const confirmPost = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByRole('button', { name: t.actions.confirmPost }));
};

/** 값 목록이 확정된 뒤의 화면을 열고 보낼 수 있는 상태까지 채운다. */
const setupReadyToPost = async (
  routes: StubRoute[] = allRoutes(),
  hold: string[] = [],
  search = '?ir=9001',
): Promise<ReturnType<typeof renderScreen>> => {
  fillCodeLists();

  const rendered = renderScreen(routes, search, '', hold);

  await openPostPane(rendered.user);
  await fillDraft(rendered.user);

  return rendered;
};

describe('GoodsReceiptScreen — 코드 목록이 확정되지 않은 지금', () => {
  /**
   * **G1** — 값 목록이 없으니 고를 수 있는 값도 없다. 그 상태에서 「고르세요」라고 말하면
   * 사용자가 자기가 놓친 것을 찾다가 화면을 고장으로 읽는다.
   */
  it('입고 처리가 잠기고 코드 목록이 확정되지 않았다는 사유가 붙는다', async () => {
    const { user, requests } = renderScreen(allRoutes(), '?ir=9001');

    await openPostPane(user);

    expect(postButton()).toBeDisabled();
    expect(postButton()).toHaveAccessibleDescription(t.actionReasons.postCodeListPending);
    expect(postRequests(requests)).toHaveLength(0);
  });

  it('운영 코드 세 칸이 비어 있고 왜 비었는지 밝힌다', async () => {
    const { user } = renderScreen(allRoutes(), '?ir=9001');

    await openPostPane(user);

    const pane = screen.getByRole('region', { name: t.panes.post });

    expect(within(pane).getAllByText(messages.pendingCode.note)).toHaveLength(3);
  });
});

/**
 * **G1의 전환 — 배열이 차면 입고 처리가 살아난다.**
 *
 * 값 목록이 확정될 때 고칠 자리가 `code-options.ts`의 배열 하나뿐이라는 것이 이 화면의
 * 설계다. 배열만 채우고 다른 자리를 손대지 않은 채 화면이 열리는지를 여기서 고정한다.
 */
describe('GoodsReceiptScreen — 코드 목록이 채워지면', () => {
  it('사유가 「목록 미확정」에서 「값을 고르세요」로 바뀐다', async () => {
    fillCodeLists();

    const { user } = renderScreen(allRoutes(), '?ir=9001');

    await openPostPane(user);

    expect(postButton()).toBeDisabled();
    expect(postButton()).not.toHaveAccessibleDescription(t.actionReasons.postCodeListPending);
    expect(postButton()).toHaveAccessibleDescription(t.actionReasons.postNeedsWarehouse);
  });

  it('준비 중 안내가 사라지고 코드를 고를 수 있다', async () => {
    fillCodeLists();

    const { user } = renderScreen(allRoutes(), '?ir=9001');

    await openPostPane(user);

    /*
     * 확정 구획 안에서만 본다 — 조회 조건의 상태 선택지는 별개의 자리표시라 그대로 비어 있다
     * (그 값 목록은 이 화면이 채우는 것이 아니다).
     */
    const pane = screen.getByRole('region', { name: t.panes.post });

    expect(within(pane).queryByText(messages.pendingCode.note)).not.toBeInTheDocument();

    await chooseOption(user, t.fields.qualityStatus, SAMPLE_QUALITY);

    expect(screen.getByRole('combobox', { name: t.fields.qualityStatus })).toHaveTextContent(
      SAMPLE_QUALITY,
    );
  });

  /* 다 채우면 실제로 열린다 — 여기까지 와야 「차면 활성」이 값으로 고정된다. */
  it('필요한 값을 다 채우면 입고 처리가 열린다', async () => {
    const { requests } = await setupReadyToPost();

    expect(postButton()).not.toBeDisabled();
    /* 짝 방향 — 열렸다고 저절로 나가지는 않는다. */
    expect(postRequests(requests)).toHaveLength(0);
  });

  /* **M24 · C26** — 목 서버는 빈 문자열도 201로 통과시킨다(실측). 막는 곳이 화면뿐이다. */
  it('필수 코드가 하나라도 비면 잠긴 채로 사유가 바뀐다', async () => {
    fillCodeLists();

    const { user } = renderScreen(allRoutes(), '?ir=9001');

    await openPostPane(user);
    await chooseOption(user, t.fields.warehouse, WAREHOUSE_LABEL);
    await chooseOption(user, t.fields.location, LOCATION_LABEL);
    await chooseOption(user, t.fields.receiptType, SAMPLE_RECEIPT_TYPE);

    expect(postButton()).toBeDisabled();
    expect(postButton()).toHaveAccessibleDescription(t.actionReasons.postNeedsCodes);
  });
});

describe('GoodsReceiptScreen — 창고와 적치 위치', () => {
  /* **M22 · C22** — 계약이 위치 조회에 창고를 필수로 요구한다. 없이 부르면 422가 온다(실측). */
  it('창고를 고르기 전에는 위치를 부르지 않는다', async () => {
    fillCodeLists();

    const { user, requests } = renderScreen(allRoutes(), '?ir=9001');

    await openPostPane(user);

    expect(requestsTo(requests, LOCATIONS_PATH)).toHaveLength(0);

    await chooseOption(user, t.fields.warehouse, WAREHOUSE_LABEL);

    /* 짝 방향 — 고른 뒤에는 실제로 부른다(스텁이 있는데도 0회가 아니다). */
    await waitFor(() => {
      expect(requestsTo(requests, LOCATIONS_PATH).length).toBeGreaterThan(0);
    });
    expect(requestsTo(requests, LOCATIONS_PATH)[0]?.url.searchParams.get('warehouseId')).toBe(
      '9701',
    );
  });

  /*
   * **M23 · C22** — 위치는 창고에 속한다. 창고를 바꾸면 앞서 고른 위치는 **다른 창고의 자리**라
   * 그대로 보내면 물건이 없는 곳에 재고가 잡힌다. 코드·일시는 창고와 무관하므로 남긴다.
   */
  it('창고를 바꾸면 위치만 비우고 코드와 일시는 남긴다', async () => {
    const { user } = await setupReadyToPost();

    expect(screen.getByRole('combobox', { name: t.fields.location })).toHaveTextContent(
      LOCATION_LABEL,
    );
    expect(postButton()).not.toBeDisabled();

    await chooseOption(user, t.fields.warehouse, OTHER_WAREHOUSE_LABEL);

    /*
     * **보이는 글자만 보면 모자란다.** 앞 창고의 위치 번호가 남아 있어도 새 목록에 없어
     * 트리거는 자리표시로 보인다 — 그런데 그 값은 요청에 그대로 실린다. 「위치를 고르세요」로
     * 다시 잠기는지까지 봐야 값이 실제로 비워졌음이 고정된다.
     */
    expect(screen.getByRole('combobox', { name: t.fields.location })).not.toHaveTextContent(
      LOCATION_LABEL,
    );
    expect(postButton()).toBeDisabled();
    expect(postButton()).toHaveAccessibleDescription(t.actionReasons.postNeedsLocation);

    /* 코드·일시는 창고와 무관하므로 남는다 — 함께 지우면 사용자가 처음부터 다시 넣는다. */
    expect(screen.getByRole('combobox', { name: t.fields.receiptType })).toHaveTextContent(
      SAMPLE_RECEIPT_TYPE,
    );
    expect(screen.getByLabelText(t.fields.receiptDatetime)).toHaveValue(RECEIPT_DATETIME);
  });

  /* 새 창고에서 다시 고르면 **그 창고의 위치**가 요청에 실린다 — 앞 위치가 아니다. */
  it('창고를 바꾼 뒤 고른 위치가 요청에 실린다', async () => {
    const { user, requests } = await setupReadyToPost();

    await chooseOption(user, t.fields.warehouse, OTHER_WAREHOUSE_LABEL);
    await chooseOption(user, t.fields.location, OTHER_LOCATION_LABEL);
    await clickPost(user);
    await confirmPost(user);

    await waitFor(() => {
      expect(postRequests(requests)).toHaveLength(1);
    });

    expect(lastPostBody(requests).lines[0]?.destinationLocationId).toBe(9811);
  });

  it('창고를 바꾸면 그 창고의 위치 목록이 온다', async () => {
    const { user } = await setupReadyToPost();

    await chooseOption(user, t.fields.warehouse, OTHER_WAREHOUSE_LABEL);
    await user.click(screen.getByRole('combobox', { name: t.fields.location }));

    expect(await screen.findByRole('option', { name: OTHER_LOCATION_LABEL })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: LOCATION_LABEL })).not.toBeInTheDocument();
  });

  /* **C24** — 잘린 목록을 완전한 것으로 읽으면 「그런 창고가 없다」로 결론짓는다. */
  it('창고 목록이 잘리면 그 사실을 밝힌다', async () => {
    fillCodeLists();

    const { user } = renderScreen(
      allRoutes([lookupRoute(WAREHOUSES_PATH, warehouseFixtures, { total: 40 })]),
      '?ir=9001',
    );

    await openPostPane(user);

    expect(screen.getByRole('combobox', { name: t.fields.warehouse })).toHaveAccessibleDescription(
      t.filters.lookupTruncated,
    );
  });

  /*
   * **오는 중과 없음을 가른다.** 창고를 고른 직후 위치 목록이 오는 동안 선택칸은 선택지
   * 0건으로 그려지는데, 밝히지 않으면 「이 창고에는 위치가 없다」로 읽힌다.
   */
  it('위치 목록이 오는 동안 그 사실을 밝힌다', async () => {
    fillCodeLists();

    const { user, release } = renderScreen(allRoutes(), '?ir=9001', '', [LOCATIONS_PATH]);

    await openPostPane(user);
    await chooseOption(user, t.fields.warehouse, WAREHOUSE_LABEL);

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: t.fields.location })).toHaveAccessibleDescription(
        t.filters.lookupLoading,
      );
    });

    await act(async () => {
      release();
    });

    /* 짝 방향 — 도착하면 안내를 거둔다. 늘 뜨는 안내는 아무것도 말하지 않는다. */
    await waitFor(() => {
      expect(screen.queryByText(t.filters.lookupLoading)).not.toBeInTheDocument();
    });
  });

  /* **C29** — 요청에 싣는 공장은 입하 전표의 값이다. 어긋나면 눈에 보이되 막지는 않는다. */
  it('고른 창고의 공장이 전표와 다르면 그 사실을 밝힌다', async () => {
    const { user } = await setupReadyToPost();

    expect(screen.queryByText(t.notes.warehousePlantDiffers)).not.toBeInTheDocument();

    await chooseOption(user, t.fields.warehouse, OTHER_WAREHOUSE_LABEL);

    expect(screen.getByText(t.notes.warehousePlantDiffers)).toBeInTheDocument();
    expect(
      screen.getByText(t.notes.warehousePlant('SAMPLE-PLT-02 · 합성 공장 나')),
    ).toBeInTheDocument();
  });
});

describe('GoodsReceiptScreen — 제출 확인 창', () => {
  /* **M32 · C35** — 버튼에서 곧바로 보내면 되돌릴 수 없는 전표가 확인 없이 만들어진다. */
  it('입고 처리를 눌러도 확인 전에는 요청이 나가지 않는다', async () => {
    const { user, requests } = await setupReadyToPost();

    await clickPost(user);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(postRequests(requests)).toHaveLength(0);
  });

  it('확인 창이 보낼 값과 함께 움직이는 다섯 가지를 밝힌다', async () => {
    const { user } = await setupReadyToPost();

    await clickPost(user);

    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText('IR-2026-900001')).toBeInTheDocument();
    expect(within(dialog).getByText(WAREHOUSE_LABEL)).toBeInTheDocument();
    expect(within(dialog).getByText(LOCATION_LABEL)).toBeInTheDocument();
    expect(within(dialog).getByText(SAMPLE_RECEIPT_TYPE)).toBeInTheDocument();
    expect(within(dialog).getByText(t.dialog.submitEffects)).toBeInTheDocument();
  });

  /* **M30 · C36** — 창 본문이 선택 목록을 자르는 결함(#45)에 걸릴 자리를 만들지 않는다. */
  it('확인 창 안에 선택칸이 없다', async () => {
    const { user } = await setupReadyToPost();

    await clickPost(user);

    const dialog = screen.getByRole('dialog');

    expect(within(dialog).queryAllByRole('combobox')).toHaveLength(0);
    /* 짝 방향 — 폼에는 선택칸이 그대로 있다(창만 비어 있다). */
    expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0);
  });

  /**
   * **확인 창이 열린 채 대상이 바뀌는 경로.**
   *
   * 뒤로가기·앞으로가기·주소 직접 편집은 클릭 핸들러를 거치지 않아 전송 중 잠금도 경로 가드도
   * 닿지 않는다. 창이 남으면 **사용자가 확인한 줄과 실제로 나가는 줄이 갈리고**, 초안이 함께
   * 비워지므로 빈 코드·번호 0으로 되돌릴 수 없는 전표가 나간다.
   */
  it('확인 창이 열린 채 주소로 줄이 바뀌면 창이 닫힌다', async () => {
    fillCodeLists();

    const { user, requests } = renderScreen(allRoutes(), '?ir=9001&line=9401', 'ir=9001&line=9402');

    await screen.findAllByText(ITEM_LABEL);
    await fillDraft(user);
    await clickPost(user);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await waitFor(() => {
      expect(currentLocation()).toContain('line=9402');
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(postRequests(requests)).toHaveLength(0);
  });

  /**
   * **짝 방향이자 마지막 겹** — 창이 어떤 이유로든 남더라도 **보내는 자리가 한 번 더 본다.**
   * 「버튼이 막았으니 여기서는 안 봐도 된다」가 성립하려면 버튼과 전송 사이에 상태가 바뀔 수
   * 없어야 하는데, 확인 창이 그 사이를 벌려 놓는다.
   */
  it('대상이 바뀐 뒤에는 확인을 눌러도 요청이 나가지 않는다', async () => {
    fillCodeLists();

    const { user, requests } = renderScreen(allRoutes(), '?ir=9001&line=9401', 'ir=9001&line=9402');

    await screen.findAllByText(ITEM_LABEL);
    await fillDraft(user);
    await clickPost(user);
    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await waitFor(() => {
      expect(currentLocation()).toContain('line=9402');
    });

    /* 창이 닫혔으므로 확인 버튼이 없다 — 대신 새 대상의 입고 처리가 잠겨 있음을 본다. */
    expect(screen.queryByRole('button', { name: t.actions.confirmPost })).not.toBeInTheDocument();
    expect(postButton()).toBeDisabled();
    expect(postButton()).toHaveAccessibleDescription(t.actionReasons.postNeedsWarehouse);
    expect(postRequests(requests)).toHaveLength(0);
  });

  /**
   * **보내는 자리의 재검사가 홀로 서는 자리.**
   *
   * 라인 응답이 다시 도착하면 초안이 되돌아간다(수명 표 7·9행의 짝 — 대상이 그대로라
   * 창을 닫는 effect는 깨어나지 않는다). 즉 **창은 열려 있는데 초안은 비어 있는 상태**가
   * 실제로 만들어진다. 여기서 확인을 누르면, 보내는 자리가 다시 보지 않는 한
   * 빈 코드·번호 0으로 되돌릴 수 없는 전표가 나간다.
   */
  it('확인 창이 열린 동안 초안이 비워지면 확인해도 요청이 나가지 않는다', async () => {
    fillCodeLists();

    const { user, queryClient, requests } = renderScreen(
      allRoutes([changingLinesRoute()]),
      '?ir=9001&line=9401',
    );

    await screen.findAllByText(ITEM_LABEL);
    await fillDraft(user);
    await clickPost(user);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: irKeys.lines(9001) });
    });
    /* 새 라인 응답이 실제로 적용된 뒤에 본다 — 적용 전에 검사하면 늘 참인 단언이 된다. */
    await screen.findByText('2027-08-02');

    /* 대상은 그대로다 — 창을 닫는 effect가 깨어나지 않았음을 값으로 밝힌다. */
    expect(currentLocation()).toContain('line=9401');

    await confirmPost(user);

    expect(postRequests(requests)).toHaveLength(0);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    /* 짝 방향 — 왜 나가지 않았는지가 화면에 남는다. */
    expect(postButton()).toBeDisabled();
    expect(postButton()).toHaveAccessibleDescription(t.actionReasons.postNeedsWarehouse);
  });

  /* 대상이 그대로면 창이 남아 있어야 한다 — 늘 닫으면 확인 창 자체가 쓸모없어진다. */
  it('대상이 그대로면 확인 창이 남는다', async () => {
    const { user } = await setupReadyToPost();

    await clickPost(user);
    await user.type(screen.getByLabelText(t.fields.remarks), '합');

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('계속 입력을 누르면 창이 닫히고 요청이 나가지 않는다', async () => {
    const { user, requests } = await setupReadyToPost();

    await clickPost(user);
    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(postRequests(requests)).toHaveLength(0);
    /* 짝 방향 — 입력은 그대로 남아 있다. */
    expect(screen.getByLabelText(t.fields.receiptDatetime)).toHaveValue(RECEIPT_DATETIME);
  });
});

describe('GoodsReceiptScreen — 실제로 나가는 요청', () => {
  it('확인하면 요청이 딱 한 번 나간다', async () => {
    const { user, requests } = await setupReadyToPost();

    await clickPost(user);
    await confirmPost(user);

    await waitFor(() => {
      expect(postRequests(requests)).toHaveLength(1);
    });
    expect(postRequests(requests)[0]?.method).toBe('POST');
  });

  /* **M28 · C29** — 창고에서 공장을 끌어오면 사용자가 모르는 채 공장이 바뀐다. */
  it('공장이 고른 입하 전표의 값이다', async () => {
    const { user, requests } = await setupReadyToPost();

    await clickPost(user);
    await confirmPost(user);
    await waitFor(() => {
      expect(postRequests(requests)).toHaveLength(1);
    });

    expect(lastPostBody(requests).plantId).toBe(9201);
    expect(lastPostBody(requests).warehouseId).toBe(9701);
  });

  /* **M29 · C30 · C31 · C32** — 라인 값은 입하 라인 그대로이고 원천 연결이 실린다. */
  it('라인 값이 입하 라인 그대로이고 원천이 고른 전표를 가리킨다', async () => {
    const { user, requests } = await setupReadyToPost();

    await clickPost(user);
    await confirmPost(user);
    await waitFor(() => {
      expect(postRequests(requests)).toHaveLength(1);
    });

    const body = lastPostBody(requests);

    expect(body.sourceDocumentId).toBe(9001);
    expect(body.lines).toEqual([
      {
        inboundReceiptLineId: 9401,
        itemId: 9301,
        lotId: 9601,
        receiptQty: 100,
        uomId: 9501,
        qualityStatusCode: SAMPLE_QUALITY,
        inventoryStatusCode: SAMPLE_INVENTORY,
        destinationLocationId: 9802,
      },
    ]);
  });

  /* **M44 · M45 · M46 · C33 · C34** */
  it('영업일이 입고 일시에서 나오고 발생 시각을 싣지 않으며 일시에 offset이 붙는다', async () => {
    const { user, requests } = await setupReadyToPost();

    await clickPost(user);
    await confirmPost(user);
    await waitFor(() => {
      expect(postRequests(requests)).toHaveLength(1);
    });

    const body = lastPostBody(requests);

    expect(body.businessDate).toBe('2026-08-06');
    expect(Object.keys(body)).not.toContain('occurredAt');
    expect(/[+-]\d{2}:\d{2}$/.test(body.receiptDatetime)).toBe(true);
  });

  it('사유와 비고를 넣지 않으면 그 키를 싣지 않는다', async () => {
    const { user, requests } = await setupReadyToPost();

    await clickPost(user);
    await confirmPost(user);
    await waitFor(() => {
      expect(postRequests(requests)).toHaveLength(1);
    });

    const keys = Object.keys(lastPostBody(requests));

    expect(keys).not.toContain('reasonCode');
    expect(keys).not.toContain('remarks');
    /* 짝 방향 — 필수 키는 실제로 실린다. */
    expect(keys).toContain('receiptTypeCode');
  });

  /* **C27** — 상한을 넘긴 코드는 확인 창을 열지도 않고 요청도 만들지 않는다. */
  it('코드가 상한을 넘으면 인라인 오류를 내고 창을 열지 않는다', async () => {
    codeValues.receiptType = ['S'.repeat(51)];
    codeValues.sourceDocumentType = [SAMPLE_SOURCE_TYPE];
    codeValues.qualityStatus = [SAMPLE_QUALITY];
    codeValues.inventoryStatus = [SAMPLE_INVENTORY];

    const { user, requests } = renderScreen(allRoutes(), '?ir=9001');

    await openPostPane(user);
    await chooseOption(user, t.fields.warehouse, WAREHOUSE_LABEL);
    await chooseOption(user, t.fields.location, LOCATION_LABEL);
    await chooseOption(user, t.fields.receiptType, 'S'.repeat(51));
    await chooseOption(user, t.fields.sourceDocumentType, SAMPLE_SOURCE_TYPE);
    await chooseOption(user, t.fields.qualityStatus, SAMPLE_QUALITY);
    await chooseOption(user, t.fields.inventoryStatus, SAMPLE_INVENTORY);
    await user.type(screen.getByLabelText(t.fields.receiptDatetime), RECEIPT_DATETIME);
    await clickPost(user);

    expect(screen.getByText(t.errors.codeTooLong(50))).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(postRequests(requests)).toHaveLength(0);
  });

  /*
   * **계약이 모르는 재고 상태 코드가 선택지에 실려도 되돌릴 수 없는 쓰기는 나가지 않는다.**
   *
   * 값 목록은 확정되면 서버가 준 것을 그대로 옮기는데 계약은 값을 넷으로 좁혔다 — 그 밖의
   * 값이 오면 조립이 본문을 만들지 않고(`gr-request.ts`), 화면은 그 `null`을 받아 **보내지
   * 않는다.** 화면 쪽 갈래가 없으면 `null`이 그대로 요청 본문으로 나간다.
   */
  it('계약이 모르는 재고 상태 코드로는 요청이 나가지 않는다', async () => {
    fillCodeLists();
    codeValues.inventoryStatus = ['SAMPLE_INVENTORY_A'];

    const { user, requests } = renderScreen(allRoutes(), '?ir=9001');

    await openPostPane(user);
    await chooseOption(user, t.fields.warehouse, WAREHOUSE_LABEL);
    await chooseOption(user, t.fields.location, LOCATION_LABEL);
    await chooseOption(user, t.fields.receiptType, SAMPLE_RECEIPT_TYPE);
    await chooseOption(user, t.fields.sourceDocumentType, SAMPLE_SOURCE_TYPE);
    await chooseOption(user, t.fields.qualityStatus, SAMPLE_QUALITY);
    await chooseOption(user, t.fields.inventoryStatus, 'SAMPLE_INVENTORY_A');
    await user.type(screen.getByLabelText(t.fields.receiptDatetime), RECEIPT_DATETIME);

    await clickPost(user);
    /* 짝 양성 — 확인 창은 실제로 열린다. 화면이 막는 자리는 여기가 아니다. */
    await screen.findByRole('dialog');
    await confirmPost(user);

    /* 음성 단언을 짝 양성과 같은 시점에 잰다 — 창이 닫힌 뒤에 「나가지 않았다」를 본다. */
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(postRequests(requests)).toHaveLength(0);
  });

  /*
   * **되돌아가는 갈래에서도 앞 성공의 결과 구획을 남기지 않는다**(수명 표 11행).
   *
   * 본문이 만들어지지 않아 아무것도 나가지 않았는데 **앞 전표의 번호가 결과 구획에 그대로**
   * 있으면, 사용자는 방금 누른 처리가 그 번호를 만들었다고 읽는다 — 되돌릴 수 없는 쓰기
   * 화면에서 가장 나쁜 오해다. 그래서 앞 결과를 비우는 자리가 **되돌아가는 갈래보다 앞**에
   * 있어야 한다. 이 감지기가 그 차례를 고정한다(리뷰 R-M2).
   */
  it('계약이 모르는 코드로 다시 처리하면 앞 성공의 결과 구획이 남지 않는다', async () => {
    fillCodeLists();
    codeValues.inventoryStatus = [SAMPLE_INVENTORY, 'SAMPLE_INVENTORY_A'];

    const { user, requests } = renderScreen(allRoutes(), '?ir=9001');

    await openPostPane(user);
    await fillDraft(user);
    await clickPost(user);
    await confirmPost(user);

    /* 선행 양성 — 첫 처리는 실제로 성공했고 결과 구획에 번호가 섰다. */
    await screen.findByRole('status', { name: t.result.label });
    expect(screen.getByText('GR-2026-800001')).toBeInTheDocument();

    /* 두 번째 시도 — 이번엔 계약이 모르는 값을 고른다(성공 뒤 초안은 비어 있다 · 수명 표 10행). */
    await chooseOption(user, t.fields.warehouse, WAREHOUSE_LABEL);
    await chooseOption(user, t.fields.location, LOCATION_LABEL);
    await chooseOption(user, t.fields.receiptType, SAMPLE_RECEIPT_TYPE);
    await chooseOption(user, t.fields.sourceDocumentType, SAMPLE_SOURCE_TYPE);
    await chooseOption(user, t.fields.qualityStatus, SAMPLE_QUALITY);
    await chooseOption(user, t.fields.inventoryStatus, 'SAMPLE_INVENTORY_A');
    await user.type(screen.getByLabelText(t.fields.receiptDatetime), RECEIPT_DATETIME);

    await clickPost(user);
    await confirmPost(user);

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: t.result.label })).not.toBeInTheDocument();
    });
    /* 짝 방향 — 결과가 사라진 것은 새 전표가 나가서가 아니다. 두 번째 요청은 없다. */
    expect(postRequests(requests)).toHaveLength(1);
  });
});

describe('GoodsReceiptScreen — 전송 중 잠금', () => {
  /* **M33 · C38** — 공통 쓰기 훅이 호출마다 새 멱등 키를 만들어 연타가 전표 두 벌이 된다. */
  it('전송 중에 다시 눌러도 요청이 늘지 않는다', async () => {
    const { user, requests, release } = await setupReadyToPost(allRoutes(), [GOODS_RECEIPTS_PATH]);

    await clickPost(user);
    await confirmPost(user);

    await waitFor(() => {
      expect(postRequests(requests)).toHaveLength(1);
    });

    await user.click(postButton());

    /*
     * **버튼이 잠겼다는 것만으로는 모자란다.** 잠금이 풀리면 다음에 일어나는 일은 확인 창이
     * 열리는 것이고, 거기서 확인하면 둘째 요청이 나간다 — 창이 아예 열리지 않는 것까지 봐야
     * 「연타해도 한 번」이 값으로 고정된다.
     */
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(postRequests(requests)).toHaveLength(1);
    expect(postButton()).toBeDisabled();

    await act(async () => {
      release();
    });
  });

  /*
   * **M34 · C38** — 대상을 바꾸는 길까지 닫는다. 열어 두면 앞 전표의 처리 결과가
   * 지금 보는 전표의 맥락에 나타난다.
   */
  it('전송 중에는 대상을 바꾸는 길이 모두 닫힌다', async () => {
    const { user, requests, release } = await setupReadyToPost(allRoutes(), [GOODS_RECEIPTS_PATH]);

    await clickPost(user);
    await confirmPost(user);

    await waitFor(() => {
      expect(postRequests(requests)).toHaveLength(1);
    });

    expect(
      screen.getByRole('button', { name: t.actions.selectRow('IR-2026-900002') }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.deselectLine(1) })).toBeDisabled();
    expect(screen.getByRole('button', { name: messages.common.search })).toBeDisabled();
    expect(screen.getByRole('button', { name: messages.common.reset })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.nextPage })).toBeDisabled();
    expect(screen.getByRole('button', { name: messages.common.cancel })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: t.fields.warehouse })).toBeDisabled();

    await act(async () => {
      release();
    });
  });

  /*
   * **M34의 경로 가드** — 조건 칩의 ×는 디자인 시스템이 잠금을 받지 않는다.
   * 그 길로 들어와도 주소가 바뀌지 않아야 한다.
   */
  it('전송 중에는 조건 칩의 ×로도 대상이 바뀌지 않는다', async () => {
    const { user, requests, release } = await setupReadyToPost(
      allRoutes([filteringListRoute()]),
      [GOODS_RECEIPTS_PATH],
      '?ir=9001&q=IR-2026-900001',
    );

    await clickPost(user);
    await confirmPost(user);
    await waitFor(() => {
      expect(postRequests(requests)).toHaveLength(1);
    });

    const before = currentLocation();

    /* 칩의 ×는 디자인 시스템이 잠금을 받지 않는다 — 화면의 경로 가드가 막는 유일한 자리다. */
    await user.click(screen.getByRole('button', { name: t.filters.chipRemoveQ }));

    expect(currentLocation()).toBe(before);
    /*
     * **주소가 그대로인 것만으로는 모자란다.** 가드가 없으면 초안이 있으니 파기 확인 창이
     * 뜨는데, 그 창에서 확인하면 그때 대상이 바뀐다 — 주소는 아직 그대로다.
     * 창이 아예 뜨지 않는 것까지 봐야 「전송 중에는 그 길이 닫혀 있다」가 고정된다.
     */
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await act(async () => {
      release();
    });
  });
});

describe('GoodsReceiptScreen — 성공', () => {
  const succeed = async (
    routes: StubRoute[] = allRoutes(),
  ): Promise<ReturnType<typeof renderScreen>> => {
    const rendered = await setupReadyToPost(routes);

    await clickPost(rendered.user);
    await confirmPost(rendered.user);
    await screen.findByRole('status', { name: t.result.label });

    return rendered;
  };

  /* **C39** — 무엇이 만들어졌는지 번호와 상태로 보인다. 값으로 분기하지 않는다. */
  it('입고번호와 상태 코드가 보인다', async () => {
    await succeed();

    expect(screen.getByText('GR-2026-800001')).toBeInTheDocument();
    expect(screen.getByText('SAMPLE_GR_STATUS_A')).toBeInTheDocument();
  });

  /* **M47 · C39** — 초안은 비우고 고른 전표·라인은 남긴다. 결과를 읽으려면 대상이 있어야 한다. */
  it('초안을 비우고 고른 전표와 라인은 남긴다', async () => {
    await succeed();

    expect(currentLocation()).toBe(`${ROUTE}?ir=9001&line=9401`);
    expect(screen.getByLabelText(t.fields.receiptDatetime)).toHaveValue('');
    expect(screen.getByRole('combobox', { name: t.fields.warehouse })).not.toHaveTextContent(
      WAREHOUSE_LABEL,
    );
  });

  /* 성공하면 그 줄의 상태가 달라졌을 수 있다 — 라인을 다시 부른다. */
  it('성공하면 라인을 다시 부른다', async () => {
    const { requests } = await succeed();

    await waitFor(() => {
      expect(requestsTo(requests, LINES_PATH).length).toBeGreaterThan(1);
    });
  });

  /*
   * **M38 · C42** — 입고 응답에 LOT 상태가 없다(실측). 화면 이름의 「Release」가 실제로
   * 걸렸는지 값으로 확인하는 유일한 자리다.
   */
  it('성공하면 자재 LOT을 다시 조회해 상태를 그대로 보인다', async () => {
    const { requests } = await succeed();

    await waitFor(() => {
      expect(requestsTo(requests, LOT_DETAIL_PATH)).toHaveLength(1);
    });
    expect(await screen.findByText('SAMPLE_LOT_STATUS_A')).toBeInTheDocument();
  });

  /**
   * **짝 방향** — 「성공한 뒤에만」이 이 결정의 절반이다. 전표·줄을 고르는 것만으로 부르면
   * 「Release가 걸렸다」의 증거가 되지 못한다(입고 처리 전의 상태를 보여 주게 된다).
   * 이 슬라이스는 같은 갈래의 「부르지 않는다」를 전부 요청 수로 고정한다.
   */
  it('성공하기 전에는 자재 LOT을 다시 부르지 않는다', async () => {
    const { user, requests } = await setupReadyToPost();

    /* 줄을 고르고 확정 입력까지 다 채운 상태다 — 그래도 아직 부르지 않는다. */
    expect(requestsTo(requests, LOT_DETAIL_PATH)).toHaveLength(0);

    await clickPost(user);
    await confirmPost(user);
    await screen.findByRole('status', { name: t.result.label });

    /* 짝 방향 — 성공한 뒤에는 실제로 부른다(스텁이 있는데도 0회가 아니다). */
    await waitFor(() => {
      expect(requestsTo(requests, LOT_DETAIL_PATH)).toHaveLength(1);
    });
  });

  /* 실패한 뒤에도 부르지 않는다 — 만들어지지 않은 전표의 증거를 찾을 이유가 없다. */
  it('실패한 뒤에도 자재 LOT을 다시 부르지 않는다', async () => {
    const { user, requests } = await setupReadyToPost(allRoutes([failingGoodsReceiptRoute(400)]));

    await clickPost(user);
    await confirmPost(user);
    await screen.findByText(messages.httpError.title);

    expect(requestsTo(requests, LOT_DETAIL_PATH)).toHaveLength(0);
  });

  it('자재 LOT 재조회가 실패하면 그 사실을 밝힌다', async () => {
    await succeed(allRoutes([failingLotDetailRoute()]));

    expect(await screen.findByText(t.result.lotStatusFailed)).toBeInTheDocument();
  });

  /* **C40** — 결과 어디에도 내부 번호가 없다. 짝 방향으로 업무 번호는 실제로 보인다. */
  it('결과에 내부 번호가 없다', async () => {
    await succeed();

    const pane = screen.getByRole('status', { name: t.result.label });

    expect(within(pane).getByText('GR-2026-800001')).toBeInTheDocument();
    for (const id of POST_INTERNAL_IDS) {
      expect(pane.textContent ?? '').not.toContain(id);
    }
  });

  /* **C43** — 원장은 유무만, 잔액은 확인하지 않는다는 사실을 밝힌다. */
  it('원장 유무를 내고 잔액은 확인하지 않는다고 밝힌다', async () => {
    await succeed();

    expect(screen.getByText(t.result.ledgerAll)).toBeInTheDocument();
    expect(screen.getByText(t.result.balanceNote)).toBeInTheDocument();
  });

  it('원장 라인이 오지 않으면 그 사실을 따로 말한다', async () => {
    await succeed(allRoutes([goodsReceiptRoute({}, { inventoryTransactionLineId: null })]));

    expect(screen.getByText(t.result.ledgerNone)).toBeInTheDocument();
    expect(screen.queryByText(t.result.ledgerAll)).not.toBeInTheDocument();
  });

  /* **M36 · C41** — 참이면 「적재」라고만 말한다. 「전송」이 아니다. */
  it('ERP 적재가 참이면 대기열에 적재됐다고 말한다', async () => {
    await succeed(allRoutes([goodsReceiptRoute({ erpMessageQueued: true })]));

    expect(screen.getByText(t.result.erpQueued)).toBeInTheDocument();
    expect(screen.queryByText(t.result.erpNotQueued)).not.toBeInTheDocument();
    expect(screen.queryByText(t.result.erpUnknown)).not.toBeInTheDocument();
  });

  /* 조건부 승인으로 들어온 건이 여기다 — 참과 뭉개면 승인자가 반영된 줄로 오해한다. */
  it('ERP 적재가 거짓이면 따로 말한다', async () => {
    await succeed(allRoutes([goodsReceiptRoute({ erpMessageQueued: false })]));

    expect(screen.getByText(t.result.erpNotQueued)).toBeInTheDocument();
    expect(screen.queryByText(t.result.erpQueued)).not.toBeInTheDocument();
  });

  /* **M35 · C41** — 응답에 키가 없는 갈래. 없음을 참으로 읽으면 가장 나쁜 오해가 생긴다. */
  it('ERP 적재 값이 응답에 없으면 알 수 없다고 말한다', async () => {
    await succeed();

    expect(screen.getByText(t.result.erpUnknown)).toBeInTheDocument();
    expect(screen.queryByText(t.result.erpQueued)).not.toBeInTheDocument();
  });

  it('결과 어디에도 「전송 완료」가 없다', async () => {
    await succeed(allRoutes([goodsReceiptRoute({ erpMessageQueued: true })]));

    expect(screen.getByRole('status', { name: t.result.label }).textContent ?? '').not.toContain(
      '전송 완료',
    );
  });

  /* **M53 · C47** — 원천 문서 보기는 비활성이고 어떤 경로로도 이동하지 않는다. */
  it('원천 문서 보기가 비활성이고 주소를 바꾸지 않는다', async () => {
    const { user } = await succeed();

    const before = currentLocation();
    const button = screen.getByRole('button', { name: t.actions.viewSourceDocument });

    expect(button).toBeDisabled();

    await user.click(button);

    expect(currentLocation()).toBe(before);
  });

  /* 대상을 바꾸면 결과도 비운다 — 남으면 지금 고른 전표의 결과로 읽힌다(수명 표 4행). */
  it('대상을 바꾸면 결과 구획이 사라진다', async () => {
    const { user } = await succeed();

    await selectReceipt(user, 'IR-2026-900002');

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: t.result.label })).not.toBeInTheDocument();
    });
  });
});

describe('GoodsReceiptScreen — 실패 세 갈래', () => {
  const fail = async (route: StubRoute): Promise<ReturnType<typeof renderScreen>> => {
    const rendered = await setupReadyToPost(allRoutes([route]));

    await clickPost(rendered.user);
    await confirmPost(rendered.user);

    return rendered;
  };

  /* **M48 · M49 · C44** — 실패했는데 입력을 지우면 처음부터 다시 친다. */
  it('검증 실패에도 입력이 남고 결과 구획이 생기지 않는다', async () => {
    await fail(
      failingGoodsReceiptRoute(400, {
        errors: [{ scope: 'field', field: 'remarks', code: 'INVALID', message: '합성 서버 오류' }],
      }),
    );

    expect(await screen.findByText('합성 서버 오류')).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.receiptDatetime)).toHaveValue(RECEIPT_DATETIME);
    expect(screen.queryByRole('status', { name: t.result.label })).not.toBeInTheDocument();
  });

  /* **M51** — 같은 권한으로 다시 불러도 같은 답이 온다. 재시도를 권하지 않는다. */
  it('권한 없음은 다른 문구이고 다시 시도를 내지 않는다', async () => {
    await fail(failingGoodsReceiptRoute(403));

    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.queryByText(t.notes.postRecheck)).not.toBeInTheDocument();
    /* **M49** — ①~④는 한 트랜잭션이라 부분 실패가 없다. 건별 결과를 그릴 것이 없다. */
    expect(screen.queryByRole('status', { name: t.result.label })).not.toBeInTheDocument();
  });

  /*
   * **M50 · C45** — 공통 문구는 「다시 시도하세요」로 끝나는데, 확인 없이 다시 보내면
   * 같은 입하가 입고 전표 두 벌로 남는다.
   */
  it('응답을 받지 못하면 등록 여부를 확인하라는 안내가 함께 나온다', async () => {
    await fail(offlineGoodsReceiptRoute());

    expect(await screen.findByText(messages.httpError.offline)).toBeInTheDocument();
    expect(screen.getByText(t.notes.postRecheck)).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: t.result.label })).not.toBeInTheDocument();
  });

  it('검증 실패에는 그 안내가 붙지 않는다', async () => {
    await fail(failingGoodsReceiptRoute(400));

    expect(await screen.findByText(messages.httpError.title)).toBeInTheDocument();
    expect(screen.queryByText(t.notes.postRecheck)).not.toBeInTheDocument();
    expect(screen.queryByRole('status', { name: t.result.label })).not.toBeInTheDocument();
  });

  /* 실패한 뒤 고치고 다시 보낼 수 있어야 한다 — 막히면 처음부터 다시 친다. */
  it('실패한 뒤 다시 보낼 수 있다', async () => {
    const { user, requests } = await fail(failingGoodsReceiptRoute(400));

    await screen.findByText(messages.httpError.title);
    await clickPost(user);
    await confirmPost(user);

    await waitFor(() => {
      expect(postRequests(requests)).toHaveLength(2);
    });
  });
});

describe('GoodsReceiptScreen — 취소와 파기 확인', () => {
  /* **M52 · C46** — 이 화면의 「취소」는 보내기 전 복귀다. 서버를 부르지 않는다. */
  it('취소는 서버를 부르지 않고 고른 줄과 초안을 푼다', async () => {
    const { user, requests } = await setupReadyToPost();

    await user.click(screen.getByRole('button', { name: messages.common.cancel }));
    await user.click(screen.getByRole('button', { name: t.actions.discardDraft }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?ir=9001`);
    });
    expect(postRequests(requests)).toHaveLength(0);
    expect(screen.queryByRole('region', { name: t.panes.post })).not.toBeInTheDocument();
  });

  /* 친 값이 말없이 사라지면 무엇을 잃었는지도 알 수 없다. */
  it('초안이 있으면 대상을 바꾸기 전에 파기 확인을 받는다', async () => {
    const { user } = await setupReadyToPost();

    await selectReceipt(user, 'IR-2026-900002');

    expect(screen.getByText(messages.common.discardChangesConfirm)).toBeInTheDocument();
    /* 아직 바뀌지 않았다 — 확인해야 바뀐다. */
    expect(currentLocation()).toContain('ir=9001');
  });

  it('계속 입력을 고르면 대상이 그대로 남는다', async () => {
    const { user } = await setupReadyToPost();

    await selectReceipt(user, 'IR-2026-900002');
    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));

    expect(currentLocation()).toContain('ir=9001');
    expect(screen.getByLabelText(t.fields.receiptDatetime)).toHaveValue(RECEIPT_DATETIME);
  });

  it('버리기를 고르면 대상이 바뀌고 초안이 사라진다', async () => {
    const { user } = await setupReadyToPost();

    await selectReceipt(user, 'IR-2026-900002');
    await user.click(screen.getByRole('button', { name: t.actions.discardDraft }));

    await waitFor(() => {
      expect(currentLocation()).toContain('ir=9002');
    });
  });

  /* **M31 · C36** — 파기 확인 창에도 선택칸이 없다. */
  it('파기 확인 창 안에 선택칸이 없다', async () => {
    const { user } = await setupReadyToPost();

    await selectReceipt(user, 'IR-2026-900002');

    expect(within(screen.getByRole('dialog')).queryAllByRole('combobox')).toHaveLength(0);
  });

  /* 아무것도 잃지 않는 조작에까지 확인을 받으면 확인 창이 의미를 잃는다. */
  it('초안이 비어 있으면 확인 없이 대상을 바꾼다', async () => {
    fillCodeLists();

    const { user } = renderScreen(allRoutes(), '?ir=9001');

    await openPostPane(user);
    await selectReceipt(user, 'IR-2026-900002');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(currentLocation()).toContain('ir=9002');
    });
  });
});

describe('GoodsReceiptScreen — 초안이 사라지지 않는다', () => {
  /*
   * **M15** — 코드를 고르는 것은 조회가 아니다. 주소에 실으면 글자마다 뒤로가기 기록이 쌓이고,
   * 화면이 조회 조건과 입력을 같은 통로로 다루게 된다.
   */
  it('확정 입력이 주소를 바꾸지 않고 조회도 다시 부르지 않는다', async () => {
    const { user, requests } = await setupReadyToPost();

    const listCallsBefore = requestsTo(requests, LIST_PATH).length;

    expect(currentLocation()).toBe(`${ROUTE}?ir=9001&line=9401`);
    expect(requestsTo(requests, LIST_PATH)).toHaveLength(listCallsBefore);

    await user.type(screen.getByLabelText(t.fields.remarks), '합성 비고');

    expect(currentLocation()).toBe(`${ROUTE}?ir=9001&line=9401`);
    expect(requestsTo(requests, LIST_PATH)).toHaveLength(listCallsBefore);
  });

  /*
   * **M14 · C17** — 되돌림을 목록 응답이나 파생 객체에 반응시키면 코드를 고르는 도중에
   * 값이 사라진다(#43). 되돌림의 신호는 **고른 줄과 라인 응답 둘뿐**이다.
   */
  it('목록이 다시 도착해도 확정 입력이 되돌아가지 않는다', async () => {
    fillCodeLists();

    const { user, queryClient } = renderScreen(
      [
        changingListRoute(),
        linesRoute(),
        otherLinesRoute(),
        detailRoute(),
        goodsReceiptRoute(),
        lotDetailRoute(),
        ...lookupRoutes(),
      ],
      '?ir=9001',
    );

    await openPostPane(user);
    await fillDraft(user);
    /* 첫 목록이 실제로 적용된 뒤에 다시 부른다 — 기준이 없으면 「다시 왔다」를 셀 수 없다. */
    await screen.findByText(t.pageNav.range(1, 3, 4));

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: irKeys.lists });
    });

    /* 새 목록이 실제로 적용된 뒤에 본다 — 적용 전에 검사하면 늘 참인 단언이 된다. */
    await screen.findByText(t.pageNav.range(1, 3, 5));

    expect(screen.getByLabelText(t.fields.receiptDatetime)).toHaveValue(RECEIPT_DATETIME);
    expect(screen.getByRole('combobox', { name: t.fields.warehouse })).toHaveTextContent(
      WAREHOUSE_LABEL,
    );
    expect(screen.getByRole('combobox', { name: t.fields.receiptType })).toHaveTextContent(
      SAMPLE_RECEIPT_TYPE,
    );
  });

  /* 참조가 늦게 도착하는 것도 같다 — 이름이 채워지는 것이 입력을 지울 이유가 되지 않는다. */
  it('참조가 다시 도착해도 확정 입력이 되돌아가지 않는다', async () => {
    fillCodeLists();

    const { user, queryClient } = renderScreen(allRoutes([changingItemRoute()]), '?ir=9001');

    await openPostPane(user);
    await fillDraft(user);

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['goods-receipt-lookups'] });
    });

    /* 새 이름이 실제로 적용된 뒤에 본다 — 적용 전에 검사하면 늘 참인 단언이 된다. */
    await screen.findAllByText(CHANGED_ITEM_LABEL);

    expect(screen.getByLabelText(t.fields.receiptDatetime)).toHaveValue(RECEIPT_DATETIME);
    expect(screen.getByRole('combobox', { name: t.fields.warehouse })).toHaveTextContent(
      WAREHOUSE_LABEL,
    );
  });
});
