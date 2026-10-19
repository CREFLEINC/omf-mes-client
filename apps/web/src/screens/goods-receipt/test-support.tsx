/**
 * W-01-10 화면 감지기(작업함 `screen.test.tsx` · 처리 화면 `process-screen.test.tsx`)가 함께 쓰는 스텁과 탐침.
 *
 * 테스트 전용이다 — 런타임 코드는 이 모듈을 참조하지 않는다.
 */
import { screen } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { useLocation, useNavigate, useSearchParams } from 'react-router';

import {
  createStubFetch,
  jsonResponse,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import {
  goodsReceiptResponse,
  inboundReceiptFixtures,
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

export const ROUTE = '/logistics/goods-receipt';
export const LIST_PATH = '/logistics/inbound-receipts';
export const DETAIL_PATH = '/logistics/inbound-receipts/9001';
export const LINES_PATH = '/logistics/inbound-receipts/9001/lines';
export const OTHER_LINES_PATH = '/logistics/inbound-receipts/9002/lines';
/** 이 화면이 PR ②에서 쓸 입고 처리 경로. **지금은 부르지 않는다** — 그것을 증명하려고 스텁을 둔다. */
export const GOODS_RECEIPTS_PATH = '/logistics/goods-receipts';
export const PARTNERS_PATH = '/mdm/partners';
export const PLANTS_PATH = '/mdm/plants';
/** 품목만 번호마다 상세를 부른다 — 경로가 하나가 아니라 번호마다 하나다. */
export const itemPath = (itemId: number): string => `/mdm/items/${String(itemId)}`;
export const UOMS_PATH = '/mdm/uoms';
export const LOTS_PATH = '/trace/lots';
export const WAREHOUSES_PATH = '/mdm/warehouses';
export const LOCATIONS_PATH = '/mdm/locations';
/** 성공 뒤 다시 읽는 자재 LOT. 고른 줄(9401)의 LOT이 9601이다. */
export const LOT_DETAIL_PATH = '/trace/lots/9601';

/**
 * 상세 응답에만 있는 표식. 화면이 입하 상세를 부르지 않는다는 것을 **두 방향으로** 굳힌다 —
 * ① 상세 경로 요청이 0회 ② 이 표식이 화면 어디에도 나타나지 않음.
 * 스텁을 두지 않으면 하네스가 던져 「부르지 않았다」와 「불렀는데 실패했다」가 구분되지 않는다.
 */
export const DETAIL_MARKER = 'IR-2026-900001-FROM-DETAIL';

export const SUPPLIER_LABEL = 'SAMPLE-SUP-01 · 합성 공급사 가';
export const ITEM_LABEL = 'SAMPLE-ITEM-01 · 합성 품목 가';
export const PLANT_LABEL = 'SAMPLE-PLT-01 · 합성 공장 가';
export const UOM_LABEL = 'SAMPLE-EA · 합성 단위 개';

/**
 * 화면 어디에도 나와서는 안 되는 내부 번호(FK).
 *
 * 픽스처의 번호 대역을 그대로 쓴다 — 업무 번호(`IR-2026-900001`·`LOT-2026-900010`)에
 * 이 문자열이 부분으로 들어가지 않도록 대역을 갈라 두었다.
 */
export const INTERNAL_IDS = [
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

export interface RecordedRequest {
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
export const createRecordingFetch = (
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

export const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

export const listBody = (
  items: unknown[],
  page: Partial<{ page: number; size: number; total: number }> = {},
) => ({ items, page: { page: 1, size: 50, total: items.length, ...page } });

export const listRoute = (
  items: unknown[] = inboundReceiptFixtures,
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isGet(request, LIST_PATH),
  respond: () => jsonResponse(listBody(items, page)),
});

export const failingListRoute = (status: number, body: unknown = { message: '' }): StubRoute => ({
  match: (request) => isGet(request, LIST_PATH),
  respond: () => jsonResponse(body, { status }),
});

/**
 * 조건이 걸린 조회에는 그 조건에 맞는 행만 돌려준다.
 * 「고른 전표가 갱신된 결과에 없다」를 실제로 만들어 내는 유일한 방법이다.
 */
export const filteringListRoute = (): StubRoute => ({
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
export const changingListRoute = (): StubRoute => {
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
export const lookupRoute = (
  pathname: string,
  items: unknown[],
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse(listBody(items, page)),
});

/** 자재 LOT은 **품목마다** 부른다 — 요청의 `itemId`에 맞는 것만 돌려준다. */
export const lotsRoute = (): StubRoute => ({
  match: (request) => isGet(request, LOTS_PATH),
  respond: (request) => {
    const itemId = new URL(request.url).searchParams.get('itemId');
    const items =
      itemId === null ? lotFixtures : lotFixtures.filter((lot) => String(lot.itemId) === itemId);

    return jsonResponse(listBody(items));
  },
});

/**
 * 품목 상세. **번호마다 하나씩** 답한다(`GET /mdm/items/{itemId}`) — 응답이
 * `{ item, editability }` 봉투라는 것까지 여기서 굳힌다.
 */
export const itemDetailRoutes = (): StubRoute[] =>
  itemFixtures.map((item) => ({
    match: (request: Request) => isGet(request, itemPath(item.itemId)),
    respond: () => jsonResponse({ item, editability: {} }),
  }));

/** 적치 위치는 **창고마다** 다른 목록이 온다 — 창고를 바꾸면 앞 위치가 뜻을 잃는다. */
export const locationsRoute = (
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
export const lookupRoutes = (): StubRoute[] => [
  lookupRoute(PARTNERS_PATH, partnerFixtures),
  lookupRoute(PLANTS_PATH, plantFixtures),
  ...itemDetailRoutes(),
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
export const changingLinesRoute = (): StubRoute => {
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
export const CHANGED_ITEM_LABEL = 'SAMPLE-ITEM-01 · 합성 품목 가(갱신)';

/**
 * 부를 때마다 **이름이 달라지는** 품목 목록.
 *
 * 다시 부르기가 같은 본문을 돌려주면 캐시가 구조 공유로 **같은 참조를 그대로 유지**해,
 * 「참조가 도착하면 치던 값이 되돌아간다」는 결함이 드러나지 않는다. 첫 응답은 그대로 두어
 * 다른 단언의 기준 이름이 흔들리지 않게 한다.
 */
export const changingItemRoute = (): StubRoute => {
  let call = 0;

  return {
    match: (request) => isGet(request, itemPath(9301)),
    respond: () => {
      call += 1;
      const item = itemFixtures[0] ?? {};

      return jsonResponse({
        item: call === 1 ? item : { ...item, itemName: '합성 품목 가(갱신)' },
        editability: {},
      });
    },
  };
};

/** 입고 처리 뒤 다시 읽는 자재 LOT 상세. **입고 응답에는 LOT 상태가 없다.** */
export const lotDetailRoute = (statusCode = 'SAMPLE_LOT_STATUS_A'): StubRoute => ({
  match: (request) => isGet(request, LOT_DETAIL_PATH),
  respond: () => jsonResponse(lotDetailResponse(statusCode)),
});

export const failingLotDetailRoute = (): StubRoute => ({
  match: (request) => isGet(request, LOT_DETAIL_PATH),
  respond: () => jsonResponse({ message: '' }, { status: 500 }),
});

export const failingLookupRoute = (pathname: string): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse({ message: '' }, { status: 500 }),
});

/** 라인 조회. 고른 전표의 줄만 돌려준다. */
export const linesRoute = (items: unknown[] = inboundReceiptLineFixtures): StubRoute => ({
  match: (request) => isGet(request, LINES_PATH),
  respond: () => jsonResponse({ items }),
});

export const otherLinesRoute = (): StubRoute => ({
  match: (request) => isGet(request, OTHER_LINES_PATH),
  respond: () => jsonResponse({ items: [] }),
});

export const failingLinesRoute = (status = 500): StubRoute => ({
  match: (request) => isGet(request, LINES_PATH),
  respond: () => jsonResponse({ message: '' }, { status }),
});

/**
 * 다시 부르면 **줄 구성이 달라지는** 라인 응답.
 *
 * 전표가 고쳐지거나 다른 사용자가 먼저 처리해 줄이 사라지는 일이 실제로 있다.
 */
export const shrinkingLinesRoute = (): StubRoute => {
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
export const detailRoute = (): StubRoute => ({
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
export const goodsReceiptRoute = (
  overrides: Record<string, unknown> = {},
  lineOverrides: Record<string, unknown> = {},
): StubRoute => ({
  match: (request) =>
    request.method === 'POST' && new URL(request.url).pathname === GOODS_RECEIPTS_PATH,
  respond: () => jsonResponse(goodsReceiptResponse(overrides, lineOverrides), { status: 201 }),
});

/** 입고 처리 실패. 400·403·네트워크 끊김이 서로 다른 안내로 갈려야 한다. */
export const failingGoodsReceiptRoute = (
  status: number,
  body: unknown = { message: '' },
): StubRoute => ({
  match: (request) =>
    request.method === 'POST' && new URL(request.url).pathname === GOODS_RECEIPTS_PATH,
  respond: () => jsonResponse(body, { status }),
});

export const offlineGoodsReceiptRoute = (): StubRoute => ({
  match: (request) =>
    request.method === 'POST' && new URL(request.url).pathname === GOODS_RECEIPTS_PATH,
  respond: () => {
    throw new TypeError('Failed to fetch');
  },
});

/** 이 화면이 닿을 수 있는 경로를 전부 스텁으로 둔 한 벌. */
export const allRoutes = (extra: StubRoute[] = []): StubRoute[] => [
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
export const LocationProbe = () => {
  const location = useLocation();

  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

/**
 * **화면 바깥에서** 주소를 갈아 끼운다. 뒤로가기·앞으로가기·주소 직접 편집이 이 경로다 —
 * 셋 모두 화면의 클릭 핸들러를 거치지 않고 검색 파라미터만 바뀐다.
 */
export const SearchProbe = ({ to }: { to: string }) => {
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
export const BackProbe = () => {
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

export const requestsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === pathname);

export const currentLocation = (): string => screen.getByTestId('location').textContent ?? '';

export type User = ReturnType<typeof userEvent.setup>;
