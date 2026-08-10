import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { QueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import {
  itemFixtures,
  partnerFixtures,
  plantFixtures,
  purchaseOrderFixtures,
  purchaseOrderLineFixtures,
  uomFixtures,
} from './fixtures';
import { poKeys } from './queries';
import { OverReceiptSplitScreen } from './screen';
import { DELIVERY_NOTE_NO_MAX } from './validation';

const t = messages.overReceiptSplit;

type SplitRequestBody = components['schemas']['InboundReceiptSplitRequest'];

const ROUTE = '/logistics/over-receipt-split';
const LIST_PATH = '/logistics/purchase-orders';
const DETAIL_PATH = '/logistics/purchase-orders/9001';
const LINES_PATH = '/logistics/purchase-orders/9001/lines';
const OTHER_LINES_PATH = '/logistics/purchase-orders/9002/lines';
/** 이 화면이 PR ②에서 쓸 등록 경로. **지금은 부르지 않는다** — 그것을 증명하려고 스텁을 둔다. */
const SPLIT_PATH = '/logistics/inbound-receipts:split';
const PARTNERS_PATH = '/mdm/partners';
const PLANTS_PATH = '/mdm/plants';
const ITEMS_PATH = '/mdm/items';
const UOMS_PATH = '/mdm/uoms';

/**
 * 상세 응답에만 있는 표식. 화면이 발주 상세를 부르지 않는다는 것을 **두 방향으로** 굳힌다 —
 * ① 상세 경로 요청이 0회 ② 이 표식이 화면 어디에도 나타나지 않음.
 * 스텁을 두지 않으면 하네스가 던져 「부르지 않았다」와 「불렀는데 실패했다」가 구분되지 않는다.
 */
const DETAIL_MARKER = 'PO-2026-900001-FROM-DETAIL';

const SUPPLIER_LABEL = 'SAMPLE-SUP-01 · 합성 공급사 가';
const ITEM_LABEL = 'SAMPLE-ITEM-01 · 합성 품목 가';
const UOM_LABEL = 'SAMPLE-EA · 합성 단위 개';
const PLANT_LABEL = 'SAMPLE-PLT-01 · 합성 공장 가';

/**
 * 화면 어디에도 나와서는 안 되는 내부 번호(FK).
 *
 * 픽스처의 번호 대역을 그대로 쓴다 — 발주번호(`PO-2026-900001`)에 이 문자열이 부분으로
 * 들어가지 않도록 대역을 갈라 두었다.
 */
const INTERNAL_IDS = ['9001', '9002', '9003', '9101', '9102', '9201', '9401', '9402', '9403'];

interface RecordedRequest {
  method: string;
  url: URL;
  /**
   * 쓰기 요청의 본문. 읽기에는 `null`이다.
   *
   * **실제로 나간 본문을 본다.** 요청 조립 함수를 단위로 검사하는 것만으로는
   * 「화면이 그 함수를 부르지 않고 다른 값을 보냈다」를 잡을 수 없다.
   */
  body: unknown;
  headers: Headers;
}

/**
 * 요청을 기록하면서 스텁 규칙으로 응답한다. 규칙에 없는 요청은 하네스가 던져 스텁 누락을 드러낸다.
 *
 * `hold`에 든 경로는 **기록한 뒤에** 붙잡아 둔다 — 「보내는 중에 몇 번 나갔는가」를
 * 세려면 응답이 오기 전에 이미 기록돼 있어야 한다.
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

    requests.push({
      method: request.method,
      url: new URL(request.url),
      body,
      headers: request.headers,
    });

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
  items: unknown[] = purchaseOrderFixtures,
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
 * 「고른 발주가 갱신된 결과에 없다」를 실제로 만들어 내는 유일한 방법이다.
 */
const filteringListRoute = (): StubRoute => ({
  match: (request) => isGet(request, LIST_PATH),
  respond: (request) => {
    const q = new URL(request.url).searchParams.get('q');
    const items =
      q === null
        ? purchaseOrderFixtures
        : purchaseOrderFixtures.filter((row) => row.purchaseOrderNo.includes(q));

    return jsonResponse(listBody(items));
  },
});

/**
 * 부를 때마다 **내용이 달라지는** 목록.
 *
 * 다시 부르기가 같은 본문을 돌려주면 캐시가 구조 공유로 **같은 참조를 그대로 유지**해,
 * 「목록 응답을 되돌림 의존성에 넣었다」는 결함이 드러나지 않는다 —
 * 목록이 실제로 달라지는 경우(다른 사용자가 그 사이에 등록했다)를 만들어야 그 결함이 잡힌다.
 */
const changingListRoute = (): StubRoute => {
  let call = 0;

  return {
    match: (request) => isGet(request, LIST_PATH),
    respond: () => {
      call += 1;

      return jsonResponse(
        listBody(purchaseOrderFixtures, { total: purchaseOrderFixtures.length + call }),
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

/** 참조 목록 넷. 화면이 이름으로 풀 수 있는 정상 상태다. */
const lookupRoutes = (): StubRoute[] => [
  lookupRoute(PARTNERS_PATH, partnerFixtures),
  lookupRoute(PLANTS_PATH, plantFixtures),
  lookupRoute(ITEMS_PATH, itemFixtures),
  lookupRoute(UOMS_PATH, uomFixtures),
];

const failingLookupRoute = (pathname: string): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse({ message: '' }, { status: 500 }),
});

/** 라인 조회. 고른 발주의 줄만 돌려준다. */
const linesRoute = (items: unknown[] = purchaseOrderLineFixtures): StubRoute => ({
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
 * 발주가 고쳐지거나 다른 사용자가 먼저 처리해 줄이 사라지는 일이 실제로 있다.
 * 같은 본문을 돌려주면 캐시가 참조를 그대로 유지해 **초안 되돌림이 아예 일어나지 않으므로**,
 * 그 자리를 검사하려면 내용이 실제로 달라져야 한다.
 */
const shrinkingLinesRoute = (): StubRoute => {
  let call = 0;

  return {
    match: (request) => isGet(request, LINES_PATH),
    respond: () => {
      call += 1;

      return jsonResponse({
        items: call === 1 ? purchaseOrderLineFixtures : purchaseOrderLineFixtures.slice(1),
      });
    },
  };
};

/**
 * 발주 상세 스텁. **부를 수 있게 두는 것이 요점이다** —
 * 스텁이 없으면 하네스가 던져 「부르지 않았다」를 증명할 수 없다.
 */
const detailRoute = (): StubRoute => ({
  match: (request) => isGet(request, DETAIL_PATH),
  respond: () =>
    jsonResponse({
      purchaseOrder: { ...(purchaseOrderFixtures[0] ?? {}), purchaseOrderNo: DETAIL_MARKER },
      lines: [],
    }),
});

/**
 * 만들어진 전표 한 건의 응답 본문.
 *
 * **내부 번호를 함께 담는다** — 화면이 그것을 내지 않는다는 것을 검사하려면
 * 응답에 실제로 들어 있어야 한다. 담지 않으면 그 단언이 늘 참이 된다.
 */
const createdReceipt = (inboundReceiptId: number, inboundReceiptNo: string) => ({
  inboundReceiptId,
  inboundReceiptNo,
  supplierId: 9101,
  plantId: 9201,
  receiptDatetime: '2026-08-06T09:12:00+09:00',
  statusCode: 'SAMPLE_IR_STATUS_A',
});

const CREATED_ONE = [createdReceipt(9601, 'IR-2026-900010')];
const CREATED_TWO = [createdReceipt(9601, 'IR-2026-900010'), createdReceipt(9602, 'IR-2026-900011')];

const isSplitPost = (request: Request): boolean =>
  request.method === 'POST' && new URL(request.url).pathname === SPLIT_PATH;

/**
 * 등록 경로 스텁. **부를 수 있게 두는 것이 요점이다** —
 * 「부르지 않았다」를 증명하려면 부를 수 있는 스텁이 있어야 한다.
 */
const splitRoute = (created: unknown[] = CREATED_ONE): StubRoute => ({
  match: isSplitPost,
  respond: () => jsonResponse({ created }, { status: 201 }),
});

const failingSplitRoute = (status: number, body: unknown = { message: '' }): StubRoute => ({
  match: isSplitPost,
  respond: () => jsonResponse(body, { status }),
});

/** 응답 자체가 오지 않는 실패. 상태 코드가 없어 화면이 다른 갈래로 다뤄야 한다. */
const offlineSplitRoute = (): StubRoute => ({
  match: isSplitPost,
  respond: () => {
    throw new Error('연결이 끊겼습니다');
  },
});

/** 이 화면이 닿을 수 있는 경로를 전부 스텁으로 둔 한 벌. */
const allRoutes = (): StubRoute[] => [
  listRoute(),
  linesRoute(),
  otherLinesRoute(),
  detailRoute(),
  splitRoute(),
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
 *
 * 화면은 `useSearchParams`가 주는 값만 읽으므로 **셋을 구분하지 못한다.**
 * 그래서 이 한 부품이 세 경로를 모두 대신한다 — 정리 절차가 핸들러에 들어 있으면 여기서 샌다.
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
      <OverReceiptSplitScreen />
      <LocationProbe />
      <BackProbe />
      <SearchProbe to={navigateTo} />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, queryClient, release, user: userEvent.setup() };
};

/**
 * 응답을 붙잡아 두는 렌더. 「조회를 기다리는 동안」과 「참조가 늦게 오는 순서」를
 * 실제로 만들어야 그 사이의 표기를 판정할 수 있다.
 *
 * `hold`에 든 경로만 붙잡고 나머지는 곧바로 응답한다.
 */
const renderScreenHolding = (
  routes: StubRoute[],
  hold: string[],
  search = '',
): { release: () => void; user: ReturnType<typeof userEvent.setup> } => {
  const stub = createStubFetch(routes);
  let release = (): void => {
    /* 아래 Promise 생성자가 곧바로 채운다. */
  };
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const fetch: StubFetch = async (request) => {
    if (hold.includes(new URL(request.url).pathname)) await gate;

    return stub(request);
  };

  renderWithProviders(
    <>
      <OverReceiptSplitScreen />
      <LocationProbe />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { release, user: userEvent.setup() };
};

const requestsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === pathname);

const currentLocation = (): string => screen.getByTestId('location').textContent ?? '';

const listTable = (): HTMLElement => screen.getAllByRole('table')[0] as HTMLElement;

const lineTable = (): HTMLElement => screen.getAllByRole('table')[1] as HTMLElement;

const qtyInput = (lineNo: number): HTMLElement =>
  screen.getByLabelText(t.lineTable.arrivedQtyLabel(lineNo));

const selectPo = async (
  user: ReturnType<typeof userEvent.setup>,
  purchaseOrderNo: string,
): Promise<void> => {
  await user.click(screen.getByRole('button', { name: t.actions.selectRow(purchaseOrderNo) }));
};

/**
 * 두 구획 어디에도 내부 번호가 새지 않았는지 본다. 짝이 되는 「이름은 보인다」와 함께 쓴다.
 *
 * **주소는 세지 않는다.** 고른 발주의 번호는 주소 키(`po`)로 실리는데, 그것은 표시가 아니라
 * 주소 지정 수단이다 — 새로고침·뒤로가기·공유가 같은 발주를 열려면 어딘가에 실려야 하고,
 * 사용자 대면 번호(발주번호)로는 라인 경로를 조립할 수 없다(계약이 내부 번호를 받는다).
 * 여기서 세는 것은 **사람이 읽는 자리**뿐이다.
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

describe('OverReceiptSplitScreen — 첫 진입 조회', () => {
  /*
   * **M01** — 계약 기본이 `false`라 싣지 않으면 이미 입하가 끝난 발주까지 온다.
   * 이 화면의 대상은 아직 받을 것이 남은 발주다.
   */
  it('목록 요청이 1회 나가고 미완료만이 실린다', async () => {
    const { requests } = renderScreen(allRoutes());

    await screen.findByText('PO-2026-900001');

    const list = requestsTo(requests, LIST_PATH);

    expect(list).toHaveLength(1);
    expect(list[0]?.url.searchParams.get('openOnly')).toBe('true');
  });

  it('조건을 심지 않고 주소를 그대로 둔다', async () => {
    renderScreen(allRoutes());

    await screen.findByText('PO-2026-900001');

    expect(currentLocation()).toBe(ROUTE);
  });

  it('결과가 표에 그려지고 배너가 없다', async () => {
    renderScreen(allRoutes());

    await screen.findByText('PO-2026-900001');

    expect(within(listTable()).getAllByRole('row')).toHaveLength(
      purchaseOrderFixtures.length + 1,
    );
    expect(screen.queryByText(messages.httpError.loadTitle)).not.toBeInTheDocument();
  });

  /* 상세가 주는 헤더 값은 목록 행에 이미 들어 있다 — 부르면 같은 값을 한 번 더 받는다. */
  it('발주 상세를 부르지 않는다', async () => {
    const { requests } = renderScreen(allRoutes());

    await screen.findByText('PO-2026-900001');

    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(0);
    expect(screen.queryByText(DETAIL_MARKER)).not.toBeInTheDocument();
  });

  /*
   * **M21** — 단위는 아래 구획만 쓴다. 고르기 전에 부르면 어느 요청이 무엇을 위한 것인지
   * 가릴 수 없고 첫 진입의 요청 수가 이유 없이 는다.
   */
  it('단위 참조를 발주를 고르기 전에 부르지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findByText('PO-2026-900001');

    expect(requestsTo(requests, UOMS_PATH)).toHaveLength(0);

    // 짝 방향 — 고르면 실제로 부른다(스텁이 있으므로 「부를 수 있었다」가 성립한다).
    await selectPo(user, 'PO-2026-900001');

    await waitFor(() => {
      expect(requestsTo(requests, UOMS_PATH).length).toBeGreaterThan(0);
    });
  });
});

describe('OverReceiptSplitScreen — 조건과 주소', () => {
  /* **M02** — 조건을 화면 상태로만 들고 있으면 새로고침·공유가 다른 결과를 낸다. */
  it('주소의 조건이 요청 쿼리에 그대로 실린다', async () => {
    const { requests } = renderScreen(allRoutes(), '?sup=9101&q=PO-2026-9&open=0');

    await screen.findByText('PO-2026-900001');

    const query = requestsTo(requests, LIST_PATH)[0]?.url.searchParams;

    expect(query?.get('supplierId')).toBe('9101');
    expect(query?.get('q')).toBe('PO-2026-9');
    expect(query?.has('openOnly')).toBe(false);
  });

  it('조건 줄에서 조회하면 주소와 요청에 함께 나타난다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findByText('PO-2026-900001');
    await user.type(screen.getByLabelText(t.fields.q), 'PO-2026-900002');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH)).toHaveLength(2);
    });

    expect(currentLocation()).toContain('q=PO-2026-900002');
    expect(requestsTo(requests, LIST_PATH)[1]?.url.searchParams.get('q')).toBe('PO-2026-900002');
  });

  /*
   * **M03** — 조건과 쪽을 따로 갱신하면 뒤로가기 기록이 두 칸 늘어
   * 사용자가 뒤로 눌렀는데 같은 자리로 돌아온 것처럼 보인다.
   */
  it('조회 한 번에 히스토리가 한 칸만 늘어난다', async () => {
    const { user } = renderScreen(allRoutes(), '?page=2');

    await screen.findByText('PO-2026-900001');
    await user.type(screen.getByLabelText(t.fields.q), 'PO-2026-900002');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(currentLocation()).toContain('q=PO-2026-900002');
    });

    // 한 칸만 늘었으면 뒤로 한 번에 처음 주소로 돌아온다.
    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?page=2`);
    });
  });

  /* **M06의 화면 몫** — 정수가 아닌 번호를 그대로 보내면 조회 전체가 400으로 실패한다. */
  it('정수가 아닌 조건과 쪽은 요청에 실리지 않는다', async () => {
    const { requests } = renderScreen(allRoutes(), '?sup=abc&page=0');

    await screen.findByText('PO-2026-900001');

    const query = requestsTo(requests, LIST_PATH)[0]?.url.searchParams;

    expect(query?.has('supplierId')).toBe(false);
    expect(query?.has('page')).toBe(false);
  });

  /* 알 수 없는 `po`는 「고르지 않았다」로 본다 — 라인 조회가 나가면 404가 돌아온다. */
  it('알 수 없는 po는 고르지 않은 것으로 보고 라인을 부르지 않는다', async () => {
    const { requests } = renderScreen(allRoutes(), '?po=xyz');

    await screen.findByText(t.empty.noSelectionTitle);

    expect(requestsTo(requests, LINES_PATH)).toHaveLength(0);
  });

  it('초기화는 조건을 기본으로 되돌린다', async () => {
    const { user } = renderScreen(allRoutes(), '?sup=9101&q=PO-2026-9&open=0');

    await screen.findByText('PO-2026-900001');
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });
});

describe('OverReceiptSplitScreen — 쪽 이동', () => {
  it('쪽을 옮기면 주소와 요청이 함께 바뀐다', async () => {
    const { requests, user } = renderScreen([
      listRoute(purchaseOrderFixtures, { total: 120 }),
      ...allRoutes().slice(1),
    ]);

    await screen.findByText('PO-2026-900001');
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(currentLocation()).toContain('page=2');
    });

    expect(requestsTo(requests, LIST_PATH)[1]?.url.searchParams.get('page')).toBe('2');
  });

  /* 기본값을 주소에 적으면 같은 화면의 주소가 두 가지가 된다. */
  it('첫 쪽으로 돌아오면 page 키가 주소에서 사라진다', async () => {
    const { user } = renderScreen(
      [listRoute(purchaseOrderFixtures, { page: 2, total: 120 }), ...allRoutes().slice(1)],
      '?page=2',
    );

    await screen.findByText('PO-2026-900001');
    await user.click(screen.getByRole('button', { name: t.actions.prevPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  /* **M07의 화면 몫** — 결과는 있는데 이 쪽에는 없다. 「결과가 없다」와 조치가 다르다. */
  it('쪽 밖이면 첫 쪽으로 가는 안내가 보인다', async () => {
    const { user } = renderScreen(
      [listRoute([], { page: 9, total: 45 }), ...allRoutes().slice(1)],
      '?page=9',
    );

    await screen.findByText(t.empty.beyondLastTitle);

    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  it('결과가 0건이면 빈 상태 안내가 보인다', async () => {
    renderScreen([listRoute([], { total: 0 }), ...allRoutes().slice(1)]);

    expect(await screen.findByText(t.empty.noResultTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.beyondLastTitle)).not.toBeInTheDocument();
  });
});

describe('OverReceiptSplitScreen — 조회 실패', () => {
  /*
   * **M08** — 실패를 「없습니다」로 내면 사용자가 자료가 없는 줄 알고 조건을 넓힌다.
   * 실제로는 조회 자체가 되지 않은 것이라 무엇을 해도 결과가 같다.
   */
  it('조회에 실패하면 배너가 나오고 빈 상태 문구는 나오지 않는다', async () => {
    renderScreen([failingListRoute(500), ...allRoutes().slice(1)]);

    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.beyondLastTitle)).not.toBeInTheDocument();
  });

  /* **M09** — 「버튼이 있다」만 보면 눌러도 아무 일이 없는 버튼을 통과시킨다. */
  it('다시 시도를 누르면 그 경로의 요청 수가 는다', async () => {
    const { requests, user } = renderScreen([failingListRoute(500), ...allRoutes().slice(1)]);

    await screen.findByText(messages.httpError.loadTitle);

    const before = requestsTo(requests, LIST_PATH).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(before);
    });
  });

  it('권한이 없으면 다시 시도를 내지 않는다', async () => {
    renderScreen([failingListRoute(403), ...allRoutes().slice(1)]);

    await screen.findByText(messages.httpError.forbidden);

    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  /*
   * **목록 실패 + 주소에 고른 발주**. 목록이 실패하면 행 목록이 빈 채로 남아 고른 행을 찾을 수 없고,
   * 정리 effect도 결과를 못 받아 물러난다. 그 자리에서 골격을 내면 **기다리라고 말하는데
   * 기다려서 풀리지 않고**, 실제로 나간 라인 조회의 실패까지 로딩이 덮는다.
   */
  it('목록이 실패한 채 발주가 골라져 있으면 아래 구획이 골격에 갇히지 않는다', async () => {
    renderScreen(
      [failingListRoute(500), ...allRoutes().slice(1)],
      '?po=9001',
    );

    await screen.findByText(t.empty.listFailedTitle);

    expect(screen.queryByRole('status', { name: t.loading.lines })).not.toBeInTheDocument();
    // 「고르지 않았다」로 말하지 않는다 — 사용자는 골랐고, 막힌 것은 목록이다.
    expect(screen.queryByText(t.empty.noSelectionTitle)).not.toBeInTheDocument();
  });

  /* 라인까지 실패해도 마찬가지다 — 그 실패가 「불러오는 중」으로 가려지면 안 된다. */
  it('목록과 라인이 함께 실패해도 로딩으로 가리지 않는다', async () => {
    renderScreen(
      [
        failingListRoute(500),
        failingLinesRoute(),
        otherLinesRoute(),
        detailRoute(),
        splitRoute(),
        ...lookupRoutes(),
      ],
      '?po=9001',
    );

    await screen.findByText(t.empty.listFailedTitle);

    expect(screen.queryByRole('status', { name: t.loading.lines })).not.toBeInTheDocument();
    // 짝 방향 — 목록 실패 배너는 그대로 있어 복구 수단이 사라지지 않는다.
    expect(screen.getByRole('button', { name: messages.common.retry })).toBeInTheDocument();
  });

  it('라인 조회에 실패하면 아래 구획에 배너가 나온다', async () => {
    const { requests, user } = renderScreen([
      listRoute(),
      failingLinesRoute(),
      otherLinesRoute(),
      detailRoute(),
      splitRoute(),
      ...lookupRoutes(),
    ]);

    await screen.findByText('PO-2026-900001');
    await selectPo(user, 'PO-2026-900001');

    await screen.findByText(messages.httpError.loadTitle);

    const before = requestsTo(requests, LINES_PATH).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, LINES_PATH).length).toBeGreaterThan(before);
    });
  });
});

describe('OverReceiptSplitScreen — 발주를 고르면 라인이 보인다', () => {
  it('라인을 1회 부르고 네 수치가 보인다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findByText('PO-2026-900001');
    await selectPo(user, 'PO-2026-900001');

    await screen.findByText(t.lineTable.orderedPair(100, 40));

    expect(requestsTo(requests, LINES_PATH)).toHaveLength(1);
    expect(within(lineTable()).getByText(t.lineTable.remainingPair(60, 5))).toBeInTheDocument();
    expect(currentLocation()).toContain('po=9001');
  });

  /* 보이는 행이 그대로다 — 3쪽에서 하나 골랐다고 1쪽으로 튀면 안 된다(수명 표 4행). */
  it('고르는 것이 쪽과 조건을 건드리지 않는다', async () => {
    const { user } = renderScreen(
      [listRoute(purchaseOrderFixtures, { page: 2, total: 120 }), ...allRoutes().slice(1)],
      '?q=PO-2026-9&page=2',
    );

    await screen.findByText('PO-2026-900001');
    await selectPo(user, 'PO-2026-900001');

    await waitFor(() => {
      expect(currentLocation()).toContain('po=9001');
    });

    expect(currentLocation()).toContain('q=PO-2026-9');
    expect(currentLocation()).toContain('page=2');
  });

  it('다시 누르면 선택이 풀리고 아래 구획이 닫힌다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('PO-2026-900001');
    await selectPo(user, 'PO-2026-900001');

    await screen.findByText(t.lineTable.orderedPair(100, 40));

    await user.click(
      screen.getByRole('button', { name: t.actions.deselectRow('PO-2026-900001') }),
    );

    await screen.findByText(t.empty.noSelectionTitle);

    expect(currentLocation()).not.toContain('po=');
  });

  /* 아래 구획의 빈 상태 두 갈래 — 안 고름 / 라인 없음. */
  it('라인이 하나도 없는 발주는 「고르지 않았다」와 다르게 말한다', async () => {
    const { user } = renderScreen([
      listRoute(),
      linesRoute([]),
      otherLinesRoute(),
      detailRoute(),
      splitRoute(),
      ...lookupRoutes(),
    ]);

    await screen.findByText('PO-2026-900001');
    await selectPo(user, 'PO-2026-900001');

    await screen.findByText(t.empty.noLinesTitle);

    expect(screen.queryByText(t.empty.noSelectionTitle)).not.toBeInTheDocument();
  });

  /*
   * **M20** — 응답을 기다리는 동안 빈 목록으로 판정하면 아래 구획이 깜빡 닫히고,
   * 주소의 `po`까지 지워져 새로고침으로 연 화면이 저절로 접힌다.
   */
  it('목록 응답 전에는 고른 발주를 지우지 않는다', async () => {
    const { release } = renderScreenHolding(allRoutes(), [LIST_PATH], '?po=9001');

    await screen.findByRole('status', { name: t.loading.lines });

    expect(currentLocation()).toContain('po=9001');
    expect(screen.queryByText(t.empty.noSelectionTitle)).not.toBeInTheDocument();

    release();

    await screen.findByText(t.lineTable.orderedPair(100, 40));

    expect(currentLocation()).toContain('po=9001');
  });
});

describe('OverReceiptSplitScreen — 참조 표기 네 갈래', () => {
  it('넷을 모두 이름으로 풀고 어디에도 내부 번호가 없다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('PO-2026-900001');
    await selectPo(user, 'PO-2026-900001');

    await screen.findByText(t.lineTable.orderedPair(100, 40));

    // 짝 방향 — 이름이 실제로 보인다(아무것도 안 그려도 통과하지 않게 한다).
    expect(within(listTable()).getAllByText(SUPPLIER_LABEL).length).toBeGreaterThan(0);
    expect(within(lineTable()).getAllByText(ITEM_LABEL).length).toBeGreaterThan(0);
    expect(screen.getAllByText(t.lineTable.uomNote(UOM_LABEL)).length).toBeGreaterThan(0);
    expect(screen.getByText(PLANT_LABEL)).toBeInTheDocument();

    expectNoInternalIds();
  });

  /*
   * **M12** — 본 자료가 참조보다 먼저 오는 순간이 실제로 있다(#47).
   * 그때 「알 수 없음」을 내면 정상 값이 잘못된 값으로 읽힌다.
   */
  it('참조가 늦게 와도 그동안 「알 수 없음」이라 하지 않는다', async () => {
    const { release } = renderScreenHolding(allRoutes(), [PARTNERS_PATH]);

    await screen.findByText('PO-2026-900001');

    expect(within(listTable()).getAllByText(t.values.referenceLoading).length).toBeGreaterThan(0);
    expect(within(listTable()).queryByText(t.values.unknown)).not.toBeInTheDocument();

    release();

    // 짝 방향 — 도착하면 이름으로 바뀐다.
    await waitFor(() => {
      expect(within(listTable()).getAllByText(SUPPLIER_LABEL).length).toBeGreaterThan(0);
    });
  });

  /* **M13** — 이름을 못 풀어도 내부 번호를 내지 않는다(#44). */
  it('목록에 없는 참조도 번호가 아니라 문구로 낸다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('PO-2026-900002');
    await selectPo(user, 'PO-2026-900001');

    await screen.findByText(t.lineTable.orderedPair(100, 40));

    // 공급사 9102(목록에 없음)와 품목 9302(목록에 없음)가 함께 이 갈래로 간다.
    expect(screen.getAllByText(t.values.unknown).length).toBeGreaterThan(1);
    expectNoInternalIds();
  });

  it('참조 조회가 실패하면 그 구획이 사유와 복구 수단을 낸다', async () => {
    const { requests, user } = renderScreen([
      listRoute(),
      linesRoute(),
      otherLinesRoute(),
      detailRoute(),
      splitRoute(),
      failingLookupRoute(PARTNERS_PATH),
      lookupRoute(PLANTS_PATH, plantFixtures),
      lookupRoute(ITEMS_PATH, itemFixtures),
      lookupRoute(UOMS_PATH, uomFixtures),
    ]);

    await screen.findByText('PO-2026-900001');
    await screen.findByText(t.reasons.referencesFailed);

    const before = requestsTo(requests, PARTNERS_PATH).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, PARTNERS_PATH).length).toBeGreaterThan(before);
    });
  });

  /* 아래 구획의 셋 중 하나만 실패해도 그 구획이 안내를 낸다. */
  it('단위만 실패해도 아래 구획이 안내와 복구 수단을 낸다', async () => {
    const { requests, user } = renderScreen([
      listRoute(),
      linesRoute(),
      otherLinesRoute(),
      detailRoute(),
      splitRoute(),
      lookupRoute(PARTNERS_PATH, partnerFixtures),
      lookupRoute(PLANTS_PATH, plantFixtures),
      lookupRoute(ITEMS_PATH, itemFixtures),
      failingLookupRoute(UOMS_PATH),
    ]);

    await screen.findByText('PO-2026-900001');
    await selectPo(user, 'PO-2026-900001');

    await screen.findByText(t.reasons.lineReferencesFailed);

    const before = requestsTo(requests, UOMS_PATH).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, UOMS_PATH).length).toBeGreaterThan(before);
    });
  });

  /* 선택지가 잘렸으면 사용자가 「그런 공급사가 없다」로 결론짓지 않게 밝힌다. */
  it('공급사 선택지가 잘렸으면 조건 줄이 그 사실을 밝힌다', async () => {
    renderScreen([
      listRoute(),
      linesRoute(),
      otherLinesRoute(),
      detailRoute(),
      splitRoute(),
      lookupRoute(PARTNERS_PATH, partnerFixtures, { total: partnerFixtures.length + 1 }),
      lookupRoute(PLANTS_PATH, plantFixtures),
      lookupRoute(ITEMS_PATH, itemFixtures),
      lookupRoute(UOMS_PATH, uomFixtures),
    ]);

    expect(await screen.findByText(t.filters.lookupTruncated)).toBeInTheDocument();
  });

  /*
   * **짝 방향** — 잘리지 않았으면 밝히지 않는다. 이 단언이 없으면 「받은 건수와 전체가 같아도
   * 잘렸다고 본다」는 판정이 통과해, **완전한 목록에도 상시 거짓 경고**가 붙는다.
   * 사용자에게는 「이 선택지는 믿을 수 없다」로 읽히므로 무해한 어긋남이 아니다.
   */
  it('선택지가 잘리지 않았으면 그 안내를 내지 않는다', async () => {
    renderScreen(allRoutes());

    // 짝 방향 — 선택지가 실제로 그려진 뒤에 판정한다(아직 안 왔으면 안내도 없다).
    await screen.findByText('PO-2026-900001');
    await waitFor(() => {
      expect(screen.getAllByText(SUPPLIER_LABEL).length).toBeGreaterThan(0);
    });

    expect(screen.queryByText(t.filters.lookupTruncated)).not.toBeInTheDocument();
  });
});

describe('OverReceiptSplitScreen — 도착 수량과 가르기', () => {
  const selectAndWait = async (
    user: ReturnType<typeof userEvent.setup>,
  ): Promise<void> => {
    await screen.findByText('PO-2026-900001');
    await selectPo(user, 'PO-2026-900001');
    await screen.findByText(t.lineTable.orderedPair(100, 40));
  };

  /* 한도(잔량 60 + 허용 5)와 꼭 같은 도착은 전부 정량분이다. */
  it('한도와 같은 수량은 전부 정량분으로 갈린다', async () => {
    const { user } = renderScreen(allRoutes());

    await selectAndWait(user);
    await user.type(qtyInput(1), '65');

    expect(within(lineTable()).getByText(t.lineTable.splitPair(65, 0))).toBeInTheDocument();
  });

  it('한도를 넘으면 넘은 몫만 초과분으로 갈린다', async () => {
    const { user } = renderScreen(allRoutes());

    await selectAndWait(user);
    await user.type(qtyInput(1), '66');

    expect(within(lineTable()).getByText(t.lineTable.splitPair(65, 1))).toBeInTheDocument();
  });

  /* 여러 줄 중 일부만 채우는 것이 정상 경로다 — 나머지 줄은 「이번에 받지 않는다」이다. */
  it('일부 줄만 채워도 그 줄만 갈린다', async () => {
    const { user } = renderScreen(allRoutes());

    await selectAndWait(user);
    await user.type(qtyInput(2), '12');

    expect(within(lineTable()).getByText(t.lineTable.splitPair(0, 12))).toBeInTheDocument();
    expect(within(lineTable()).getAllByText(t.values.notSplit)).toHaveLength(2);
  });

  /* 전 라인이 정량 안쪽인 경우와 전 라인이 초과뿐인 경우가 둘 다 정상 입력이다. */
  it('세 줄을 모두 채우면 세 줄이 모두 갈린다', async () => {
    const { user } = renderScreen(allRoutes());

    await selectAndWait(user);
    await user.type(qtyInput(1), '10');
    await user.type(qtyInput(2), '3');
    await user.type(qtyInput(3), '8');

    expect(within(lineTable()).getByText(t.lineTable.splitPair(10, 0))).toBeInTheDocument();
    expect(within(lineTable()).getByText(t.lineTable.splitPair(0, 3))).toBeInTheDocument();
    // 잔량이 음수인 줄이다 — 허용치 5까지가 정량분이다.
    expect(within(lineTable()).getByText(t.lineTable.splitPair(5, 3))).toBeInTheDocument();
    expect(within(lineTable()).queryByText(t.values.notSplit)).not.toBeInTheDocument();
  });

  /* **M17의 화면 몫** — 잘못 친 값이 계산에 들어가면 정량·초과가 둘 다 `NaN`이 된다. */
  it('0을 치면 사유가 붙고 그 줄은 갈리지 않는다', async () => {
    const { user } = renderScreen(allRoutes());

    await selectAndWait(user);
    await user.type(qtyInput(1), '0');

    expect(await screen.findByText(t.errors.qtyNotPositive)).toBeInTheDocument();
    expect(within(lineTable()).getAllByText(t.values.notSplit)).toHaveLength(3);
  });

  /* **M18의 화면 몫** — 빈 칸은 「이번에 받지 않는다」이지 잘못이 아니다. */
  it('비워 두면 오류가 아니다', async () => {
    const { user } = renderScreen(allRoutes());

    await selectAndWait(user);

    expect(screen.queryByText(t.errors.qtyNotPositive)).not.toBeInTheDocument();
    expect(screen.queryByText(t.errors.qtyNotNumber)).not.toBeInTheDocument();
  });

  /* 지웠다 다시 치는 도중에도 값이 튀지 않아야 한다. */
  it('쳤다가 지우면 오류가 사라지고 다시 갈리지 않는다', async () => {
    const { user } = renderScreen(allRoutes());

    await selectAndWait(user);
    await user.type(qtyInput(1), '0');

    expect(await screen.findByText(t.errors.qtyNotPositive)).toBeInTheDocument();

    await user.clear(qtyInput(1));

    await waitFor(() => {
      expect(screen.queryByText(t.errors.qtyNotPositive)).not.toBeInTheDocument();
    });
  });
});

describe('OverReceiptSplitScreen — 초안의 수명', () => {
  const selectAndType = async (
    user: ReturnType<typeof userEvent.setup>,
    text = '66',
  ): Promise<void> => {
    await screen.findByText('PO-2026-900001');
    await selectPo(user, 'PO-2026-900001');
    await screen.findByText(t.lineTable.orderedPair(100, 40));
    await user.type(qtyInput(1), text);
  };

  /**
   * 초안을 버리게 되는 조작은 **확인 창을 거친다.** 친 수량이 말없이 사라지면
   * 사용자는 무엇을 잃었는지도 알 수 없다.
   *
   * 여기서 확인 버튼을 찾지 못하면 그 자체로 실패한다 — 「확인 없이 버렸다」가 곧 결함이다.
   */
  const confirmDiscard = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
    await user.click(await screen.findByRole('button', { name: t.actions.discardDraft }));
  };

  /* **M11** — 입력마다 주소를 바꾸면 글자 하나에 뒤로가기 기록이 한 칸씩 쌓인다. */
  it('수량 입력이 주소를 바꾸지 않는다', async () => {
    const { user } = renderScreen(allRoutes());

    await selectAndType(user);

    expect(currentLocation()).toBe(`${ROUTE}?po=9001`);
  });

  /*
   * **M11의 나머지 절반** — 위 단언은 주소의 **문자열 값**만 본다. 같은 값으로 갱신하면
   * 값은 그대로이고 **히스토리만 글자마다 한 칸씩 쌓이는데**, M11이 막으려던 결함이 정확히
   * 그것이라 값 단언으로는 닿지 않는다.
   *
   * 그래서 히스토리 **길이**를 본다 — 두 글자를 친 뒤 뒤로 한 번에 고르기 이전으로 돌아오면
   * 입력이 기록을 늘리지 않은 것이다(M03이 쓰는 것과 같은 형태).
   */
  it('수량을 여러 글자 쳐도 뒤로 한 번에 고르기 이전으로 돌아온다', async () => {
    const { user } = renderScreen(allRoutes());

    // 두 글자다 — 한 글자면 기록이 한 칸만 늘어 「고르기」와 구분되지 않는다.
    await selectAndType(user, '66');

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });

    // 짝 방향 — 실제로 고르기 이전 상태다(주소만 되돌고 구획이 열려 있으면 안 된다).
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  /*
   * **M10** — 되돌림을 목록 응답이나 파생 객체에 반응시키면, 목록이 다시 오는 순간
   * 사용자가 치던 수량이 사라진다(#43의 입력 형).
   */
  it('목록을 다시 불러 내용이 달라져도 치던 수량이 사라지지 않는다', async () => {
    const { requests, queryClient, user } = renderScreen([
      changingListRoute(),
      ...allRoutes().slice(1),
    ]);

    await selectAndType(user);

    const before = requestsTo(requests, LIST_PATH).length;

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: poKeys.lists });
    });

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(before);
    });

    // 짝 방향 — 목록이 실제로 갱신됐다(같은 응답이면 참조가 그대로라 결함이 드러나지 않는다).
    await screen.findByText(
      t.pageNav.range(1, purchaseOrderFixtures.length, purchaseOrderFixtures.length + 2),
    );

    expect(qtyInput(1)).toHaveValue(66);
  });

  /* 같은 자리의 다른 경로 — 참조가 늦게 도착해 부모가 다시 그려질 때다. */
  it('참조가 늦게 도착해도 치던 수량이 사라지지 않는다', async () => {
    const { release, user } = renderScreenHolding(allRoutes(), [PARTNERS_PATH], '?po=9001');

    await screen.findByText(t.lineTable.orderedPair(100, 40));
    await user.type(qtyInput(1), '66');

    release();

    await waitFor(() => {
      expect(screen.getAllByText(SUPPLIER_LABEL).length).toBeGreaterThan(0);
    });

    expect(qtyInput(1)).toHaveValue(66);
  });

  /*
   * **M04** — 조건이 바뀌면 그 수량은 뜻을 잃는다. 초안이 남으면 다른 발주의 라인에
   * 앞 발주의 수량이 실린다.
   */
  it('조건을 바꾸면 쪽·선택·초안이 함께 비워진다', async () => {
    const { user } = renderScreen([
      filteringListRoute(),
      ...allRoutes().slice(1),
    ], '?page=2');

    await selectAndType(user);

    await user.type(screen.getByLabelText(t.fields.q), 'PO-2026-9');
    await user.click(screen.getByRole('button', { name: messages.common.search }));
    await confirmDiscard(user);

    await screen.findByText(t.empty.noSelectionTitle);

    expect(currentLocation()).toBe(`${ROUTE}?q=PO-2026-9`);
  });

  /* **M05** — 다른 쪽에는 다른 행이 온다. 초안이 남으면 없는 라인의 수량이 남는다. */
  it('쪽을 옮기면 선택과 초안이 함께 비워진다', async () => {
    const { user } = renderScreen([
      listRoute(purchaseOrderFixtures, { total: 120 }),
      ...allRoutes().slice(1),
    ]);

    await selectAndType(user);

    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));
    await confirmDiscard(user);

    await screen.findByText(t.empty.noSelectionTitle);

    expect(currentLocation()).toBe(`${ROUTE}?page=2`);
  });

  /* 다른 발주를 고르면 그 발주의 라인으로 초안이 새로 만들어진다(수명 표 4행). */
  it('다른 발주를 고르면 앞 발주의 수량이 남지 않는다', async () => {
    const { user } = renderScreen(allRoutes());

    await selectAndType(user);
    await selectPo(user, 'PO-2026-900002');
    await confirmDiscard(user);

    await screen.findByText(t.empty.noLinesTitle);

    expect(currentLocation()).toContain('po=9002');
    expect(screen.queryByLabelText(t.lineTable.arrivedQtyLabel(1))).not.toBeInTheDocument();
  });

  /*
   * **수명 표 4행의 짝 방향** — 위의 「사라지지 않는다」 셋만으로는 **되돌림을 아예 없앤**
   * 변경이 통과한다. 「되돌리지 말아야 할 때 되돌리지 않는다」와 「되돌려야 할 때 되돌린다」는
   * 서로를 대신하지 못하며, 한쪽만 두면 항상-참에 가까운 단언이 된다(계획 §5.2).
   *
   * **같은 발주로 되돌아오는 경로를 쓴다** — 라인 응답이 캐시에서 그대로 오므로
   * 되돌림을 깨우는 것은 고른 발주의 변화뿐이다. 다른 발주를 고르는 경로(위)로는
   * 라인 자체가 달라져 이 자리가 검사되지 않는다.
   */
  it('해제했다가 같은 발주를 다시 고르면 앞서 친 수량이 되살아나지 않는다', async () => {
    const { user } = renderScreen(allRoutes());

    await selectAndType(user, '66');

    // 짝 방향 — 되살아나지 않는다를 말하려면 먼저 실제로 들어가 있어야 한다.
    expect(qtyInput(1)).toHaveValue(66);

    await user.click(
      screen.getByRole('button', { name: t.actions.deselectRow('PO-2026-900001') }),
    );
    await confirmDiscard(user);
    await screen.findByText(t.empty.noSelectionTitle);

    await selectPo(user, 'PO-2026-900001');
    await screen.findByText(t.lineTable.orderedPair(100, 40));

    expect(qtyInput(1)).toHaveValue(null);
  });

  /*
   * **M19** — 갱신된 결과에 고른 발주가 없으면 주소에서 정리한다.
   * **주소 직접 편집·뒤로가기가 이 경로다** — 정리를 클릭 핸들러에 두면 통째로 샌다.
   */
  it('결과에 없는 선택은 주소가 밖에서 바뀌어도 정리된다', async () => {
    const { user } = renderScreen(
      [filteringListRoute(), ...allRoutes().slice(1)],
      '',
      'q=PO-2026-900002&po=9001',
    );

    await screen.findByText('PO-2026-900001');
    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await waitFor(() => {
      expect(currentLocation()).not.toContain('po=');
    });

    expect(currentLocation()).toContain('q=PO-2026-900002');
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });
});

describe('OverReceiptSplitScreen — 누르기 전에는 쓰기가 없다', () => {
  /*
   * **M22** — 등록 버튼을 누르기 전에는 어떤 쓰기도 나가지 않는다.
   * **경로 전체로 센다** — 어느 한 조작에서만 새는 쓰기를 놓치지 않으려면
   * 조회·쪽 이동·고르기·수량 입력을 모두 지난 뒤에 판정해야 한다.
   */
  it('조회부터 수량 입력까지 어떤 쓰기 요청도 보내지 않는다', async () => {
    const { requests, user } = renderScreen([
      listRoute(purchaseOrderFixtures, { total: 120 }),
      ...allRoutes().slice(1),
    ]);

    await screen.findByText('PO-2026-900001');

    await user.type(screen.getByLabelText(t.fields.q), 'PO-2026-9');
    await user.click(screen.getByRole('button', { name: messages.common.search }));
    await waitFor(() => {
      expect(currentLocation()).toContain('q=PO-2026-9');
    });

    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));
    await waitFor(() => {
      expect(currentLocation()).toContain('page=2');
    });

    await selectPo(user, 'PO-2026-900001');
    await screen.findByText(t.lineTable.orderedPair(100, 40));
    await user.type(qtyInput(1), '66');

    // 짝 방향 — 실제로 요청이 여럿 나갔다(아무것도 안 부르고 통과하지 않게 한다).
    expect(requests.length).toBeGreaterThan(4);
    expect(requests.every((request) => request.method === 'GET')).toBe(true);
    expect(requestsTo(requests, SPLIT_PATH)).toHaveLength(0);
  });

  /*
   * **등록 구획은 대상을 고른 뒤에만 열린다.** 고르기 전에 폼을 내면 무엇을 등록하는지
   * 없는 채로 입력만 받게 된다 — 그 값은 어느 발주에도 묶이지 않는다.
   */
  it('발주를 고르기 전에는 등록 구획이 없다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('PO-2026-900001');

    expect(
      screen.queryByRole('button', { name: t.actions.registerBoth }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(t.fields.receiptDatetime)).not.toBeInTheDocument();

    /* 짝 방향 — 고르면 실제로 열린다. 「늘 없다」로 통과하지 않게 한다. */
    await selectPo(user, 'PO-2026-900001');
    await screen.findByText(t.lineTable.orderedPair(100, 40));

    expect(screen.getByRole('button', { name: t.actions.registerBoth })).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.receiptDatetime)).toBeInTheDocument();
  });
});

/**
 * 등록 — **되돌릴 수 없는 쓰기다.**
 *
 * 여기서 잘못 나간 요청은 화면이 되돌릴 수 없다(계약의 취소는 승인을 탄다). 그래서
 * 「무엇이 나갔는가」를 **실제로 나간 본문**으로 판정한다 — 요청 조립 함수를 단위로만
 * 검사하면 「화면이 그 함수를 부르지 않았다」를 잡을 수 없다.
 */
const RECEIPT_DATETIME = '2026-08-06T09:12';

/** 라인 수량과 입하 일시를 채운다. 고르는 절차와 갈라 둔다 — 등록 뒤에는 다시 고르지 않는다. */
const fillDraft = async (
  user: ReturnType<typeof userEvent.setup>,
  qty: Record<number, string> = { 1: '66' },
): Promise<void> => {
  for (const [lineNo, text] of Object.entries(qty)) {
    await user.type(qtyInput(Number(lineNo)), text);
  }

  await user.type(screen.getByLabelText(t.fields.receiptDatetime), RECEIPT_DATETIME);
};

const setupRegister = async (
  user: ReturnType<typeof userEvent.setup>,
  qty: Record<number, string> = { 1: '66' },
): Promise<void> => {
  await screen.findByText('PO-2026-900001');
  await selectPo(user, 'PO-2026-900001');
  await screen.findByText(t.lineTable.orderedPair(100, 40));
  await fillDraft(user, qty);
};

const clickRegister = async (
  user: ReturnType<typeof userEvent.setup>,
  label: string = t.actions.registerBoth,
): Promise<void> => {
  await user.click(screen.getByRole('button', { name: label }));
};

const splitRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requestsTo(requests, SPLIT_PATH);

/** 마지막으로 나간 등록 본문. **계약 타입으로 읽는다** — 형태가 어긋나면 타입 검사가 잡는다. */
const lastSplitBody = (requests: RecordedRequest[]): SplitRequestBody => {
  const sent = splitRequests(requests);

  expect(sent.length).toBeGreaterThan(0);

  return sent[sent.length - 1]?.body as SplitRequestBody;
};

describe('OverReceiptSplitScreen — 세 갈래 등록', () => {
  /*
   * **M25** — 버튼과 갈래가 1:1이다. 늘 `BOTH`를 보내면 「정량분만 받기로 했다」는
   * 판단이 요청에서 사라져 받지 않기로 한 초과분까지 전표가 된다.
   */
  it.each([
    [t.actions.registerBoth, 'BOTH'],
    [t.actions.registerNormalOnly, 'NORMAL_ONLY'],
    [t.actions.registerExcessOnly, 'EXCESS_ONLY'],
  ])('%s를 누르면 %s가 실린다', async (label, mode) => {
    const { requests, user } = renderScreen(allRoutes());

    await setupRegister(user);
    await clickRegister(user, label);

    await waitFor(() => {
      expect(splitRequests(requests)).toHaveLength(1);
    });

    expect(lastSplitBody(requests).mode).toBe(mode);
  });

  it('분리 등록은 두 part를 함께 보낸다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await setupRegister(user);
    await clickRegister(user);

    await waitFor(() => {
      expect(splitRequests(requests)).toHaveLength(1);
    });

    const body = lastSplitBody(requests);

    /* 9401은 잔량 60 · 허용 5라 한도가 65다 — 66은 정량 65 · 초과 1로 갈린다. */
    expect(body.normal?.lines).toEqual([
      {
        purchaseOrderLineId: 9401,
        itemId: 9301,
        receivedQty: 65,
        uomId: 9501,
        supplierLotMissing: false,
      },
    ]);
    expect(body.excess?.lines).toEqual([
      { itemId: 9301, receivedQty: 1, uomId: 9501, supplierLotMissing: false },
    ]);
  });

  /*
   * **M23의 화면 몫** — 이슈 §6이 금지한 경로다. 단위 검사만으로는 화면이 다른 값을
   * 조립해 보내는 경우를 잡을 수 없어 **실제로 나간 본문**으로 본다.
   */
  it('초과분 라인에는 발주 라인 번호가 실리지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await setupRegister(user);
    await clickRegister(user);

    await waitFor(() => {
      expect(splitRequests(requests)).toHaveLength(1);
    });

    const body = lastSplitBody(requests);

    expect(Object.keys(body.excess?.lines[0] ?? {})).not.toContain('purchaseOrderLineId');
    /* 짝 방향 — 정량분에는 실린다. 「양쪽에서 뺐다」로 통과하지 않게 한다. */
    expect(body.normal?.lines[0]?.purchaseOrderLineId).toBe(9401);
  });

  /* 같은 도착을 나눈 것이라 머리 값이 갈리면 안 된다. 예외 사유만 초과분에 붙는다. */
  it('머리 값은 두 part에 같이 실리고 초과 사유는 초과분에만 실린다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await setupRegister(user);
    await user.type(screen.getByLabelText(t.fields.deliveryNoteNo), 'SAMPLE-DN-01');
    await user.type(screen.getByLabelText(t.fields.exceptionReason), '합성 사유');
    await clickRegister(user);

    await waitFor(() => {
      expect(splitRequests(requests)).toHaveLength(1);
    });

    const body = lastSplitBody(requests);

    expect(body.normal?.deliveryNoteNo).toBe('SAMPLE-DN-01');
    expect(body.excess?.deliveryNoteNo).toBe('SAMPLE-DN-01');
    expect(body.normal?.supplierId).toBe(body.excess?.supplierId);
    expect(body.excess?.exceptionReason).toBe('합성 사유');
    expect(Object.keys(body.normal ?? {})).not.toContain('exceptionReason');
  });

  /*
   * **C24** — 계약이 「영업일과 발생 시각은 바깥에서 한 번만 받는다」고 적었고,
   * 영업일은 **입하 일시의 날짜**에서 나온다(승인 13-5).
   */
  it('영업일과 발생 시각이 바깥에 한 번만 실린다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await setupRegister(user);
    await clickRegister(user);

    await waitFor(() => {
      expect(splitRequests(requests)).toHaveLength(1);
    });

    const body = lastSplitBody(requests);

    expect(body.businessDate).toBe('2026-08-06');
    expect(body.occurredAt).toMatch(/[+-]\d{2}:\d{2}$/);
    expect(Object.keys(body.normal ?? {})).not.toContain('businessDate');
    expect(Object.keys(body.excess ?? {})).not.toContain('occurredAt');
  });

  /* 계약이 전 쓰기에 멱등 키를 요구한다. 없으면 서버가 400으로 되돌린다. */
  it('멱등 키를 실어 보낸다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await setupRegister(user);
    await clickRegister(user);

    await waitFor(() => {
      expect(splitRequests(requests)).toHaveLength(1);
    });

    expect(splitRequests(requests)[0]?.headers.get('Idempotency-Key')).toMatch(
      /^[0-9a-f-]{36}$/i,
    );
  });
});

describe('OverReceiptSplitScreen — 보낼 수 없는 조합', () => {
  const blockedButton = (label: string): HTMLElement =>
    screen.getByRole('button', { name: label });

  /* **M29의 화면 몫** — 라인이 하나도 없으면 어느 갈래로도 보낼 수 없다(계약: 최소 1행). */
  it('수량을 넣지 않으면 세 버튼이 모두 잠기고 같은 사유를 낸다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findByText('PO-2026-900001');
    await selectPo(user, 'PO-2026-900001');
    await screen.findByText(t.lineTable.orderedPair(100, 40));

    expect(blockedButton(t.actions.registerBoth)).toBeDisabled();
    expect(blockedButton(t.actions.registerNormalOnly)).toBeDisabled();
    expect(blockedButton(t.actions.registerExcessOnly)).toBeDisabled();
    expect(screen.getAllByText(t.actionReasons.noQty)).toHaveLength(3);

    await clickRegister(user);

    expect(splitRequests(requests)).toHaveLength(0);
  });

  /*
   * **M27의 화면 몫** — 초과분이 없는데 분리 등록이 열리면 `excess` 없는 `BOTH`가 나간다.
   * 목 서버는 그것을 201로 통과시키므로(실측) 막는 곳은 화면뿐이다.
   */
  it('초과분이 없으면 분리 등록만 잠긴다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    /* 한도(65) 안쪽이라 전부 정량분이다. */
    await setupRegister(user, { 1: '10' });

    expect(blockedButton(t.actions.registerBoth)).toBeDisabled();
    expect(screen.getByText(t.actionReasons.bothNeedsExcess)).toBeInTheDocument();
    /* 짝 방향 — 정량분만 저장은 열려 있다. 「전부 잠갔다」로 통과하지 않게 한다. */
    expect(blockedButton(t.actions.registerNormalOnly)).toBeEnabled();

    await clickRegister(user);

    expect(splitRequests(requests)).toHaveLength(0);
  });

  /* 반대쪽 — 9402는 꼭 맞게 받았고 허용치가 0이라 도착한 전부가 초과분이다. */
  it('정량분이 없으면 정량분만 저장이 잠긴다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await setupRegister(user, { 2: '12' });

    expect(blockedButton(t.actions.registerNormalOnly)).toBeDisabled();
    expect(screen.getByText(t.actionReasons.normalOnlyNeedsNormal)).toBeInTheDocument();
    expect(blockedButton(t.actions.registerExcessOnly)).toBeEnabled();

    await clickRegister(user, t.actions.registerNormalOnly);

    expect(splitRequests(requests)).toHaveLength(0);
  });
});

describe('OverReceiptSplitScreen — 머리 입력과 수량을 고치기 전에는 보내지 않는다', () => {
  /* 계약 필수인데 입력칸이 있는 유일한 값이다. 비면 두 part의 입하 일시를 만들 수 없다. */
  it('입하 일시가 비면 인라인 오류를 내고 보내지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findByText('PO-2026-900001');
    await selectPo(user, 'PO-2026-900001');
    await screen.findByText(t.lineTable.orderedPair(100, 40));
    await user.type(qtyInput(1), '66');

    await clickRegister(user);

    expect(await screen.findByText(t.errors.receiptDatetimeRequired)).toBeInTheDocument();
    expect(splitRequests(requests)).toHaveLength(0);
  });

  /*
   * **C26** — 계약이 100자로 정했다. 붙여넣기로 들어오는 값이라 `user.paste`로 만든다 —
   * 이 칸에 `maxLength`를 두지 않은 이유가 바로 그것이다(조용히 자르면 다른 번호가 실린다).
   */
  it('거래명세서번호 101자는 인라인 오류이고 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await setupRegister(user);
    await user.click(screen.getByLabelText(t.fields.deliveryNoteNo));
    await user.paste('A'.repeat(101));

    await clickRegister(user);

    expect(
      await screen.findByText(t.errors.deliveryNoteNoTooLong(DELIVERY_NOTE_NO_MAX)),
    ).toBeInTheDocument();
    expect(splitRequests(requests)).toHaveLength(0);
  });

  /* 짝 방향 — 100자는 통과한다. 경계 한쪽만 보면 부등호 방향이 남는다. */
  it('거래명세서번호 100자는 그대로 나간다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await setupRegister(user);
    await user.click(screen.getByLabelText(t.fields.deliveryNoteNo));
    await user.paste('A'.repeat(100));

    await clickRegister(user);

    await waitFor(() => {
      expect(splitRequests(requests)).toHaveLength(1);
    });

    expect(lastSplitBody(requests).normal?.deliveryNoteNo).toBe('A'.repeat(100));
  });

  /*
   * 사유가 붙은 줄을 그대로 두고 보내면 **그 줄만 빠진 전표**가 만들어진다 —
   * 되돌릴 수 없는 쓰기라 빠뜨린 줄을 나중에 알아채도 화면이 고칠 수 없다.
   */
  it('고치지 않은 수량이 남아 있으면 보내지 않고 사유를 낸다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    /* `0`은 계약이 막는 값이다(`exclusiveMinimum: 0`). 숫자 칸이라 글자는 아예 들어가지 않는다. */
    await setupRegister(user, { 1: '66', 2: '0' });

    /* 짝 방향 — 1번 줄이 갈려 있어 버튼 자체는 열려 있다. */
    expect(screen.getByRole('button', { name: t.actions.registerBoth })).toBeEnabled();

    await clickRegister(user);

    expect(await screen.findByText(t.errors.qtyInvalidBlocked)).toBeInTheDocument();
    expect(splitRequests(requests)).toHaveLength(0);
  });

  /* 고치면 안내가 사라진다 — 남아 있으면 무엇이 아직 막혔는지 알 수 없다. */
  it('수량을 고치면 막았다는 안내가 사라진다', async () => {
    const { user } = renderScreen(allRoutes());

    await setupRegister(user, { 1: '66', 2: '0' });
    await clickRegister(user);

    expect(await screen.findByText(t.errors.qtyInvalidBlocked)).toBeInTheDocument();

    await user.clear(qtyInput(2));

    await waitFor(() => {
      expect(screen.queryByText(t.errors.qtyInvalidBlocked)).not.toBeInTheDocument();
    });
  });
});

describe('OverReceiptSplitScreen — 전송 중', () => {
  /*
   * **M37 · C27** — 공통 쓰기 훅이 호출마다 새 멱등 키를 만들어 연타가 그대로 전표 두 벌이
   * 된다. 서버가 재전송으로 보지 못하므로 **화면이 두 번째 요청 자체를 막아야** 한다.
   */
  it('전송 중에는 연타해도 요청이 1회다', async () => {
    const { requests, release, user } = renderScreen(allRoutes(), '', '', [SPLIT_PATH]);

    await setupRegister(user);
    await clickRegister(user);

    await waitFor(() => {
      expect(splitRequests(requests)).toHaveLength(1);
    });

    await clickRegister(user);
    await clickRegister(user);

    expect(splitRequests(requests)).toHaveLength(1);

    release();
  });

  it('전송 중에는 세 버튼과 취소가 모두 잠긴다', async () => {
    const { requests, release, user } = renderScreen(allRoutes(), '', '', [SPLIT_PATH]);

    await setupRegister(user);
    await clickRegister(user);

    await waitFor(() => {
      expect(splitRequests(requests)).toHaveLength(1);
    });

    expect(screen.getByRole('button', { name: t.actions.registerBoth })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.registerNormalOnly })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.registerExcessOnly })).toBeDisabled();
    expect(screen.getByRole('button', { name: messages.common.cancel })).toBeDisabled();

    release();
  });

  /*
   * **대상을 바꾸는 길도 함께 닫는다.** 열어 두면 사용자가 초안을 버리고 다른 발주로 옮긴 뒤
   * **앞 발주의 등록 결과가 지금 보는 발주의 맥락에** 나타난다 — 중복 전송은 없지만
   * 「무엇이 어느 발주에 등록됐는가」가 화면에서 흐려진다. 되돌릴 수 없는 쓰기에서 가장 비싼 혼선이다.
   */
  it('전송 중에는 목록 선택·조회·쪽 이동도 잠긴다', async () => {
    const { requests, release, user } = renderScreen(
      [listRoute(purchaseOrderFixtures, { total: 120 }), ...allRoutes()],
      '',
      '',
      [SPLIT_PATH],
    );

    await setupRegister(user);
    await clickRegister(user);

    await waitFor(() => {
      expect(splitRequests(requests)).toHaveLength(1);
    });

    expect(
      screen.getByRole('button', { name: t.actions.selectRow('PO-2026-900002') }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: messages.common.search })).toBeDisabled();
    expect(screen.getByRole('button', { name: messages.common.reset })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.nextPage })).toBeDisabled();

    release();
  });

  /*
   * 짝 방향 — 응답이 오면 길이 다시 열린다. 닫힌 채로 남으면 등록을 마친 사용자가
   * 다음 발주로 갈 방법이 없다.
   */
  it('응답이 오면 목록 조작이 다시 열린다', async () => {
    const { requests, release, user } = renderScreen(
      [listRoute(purchaseOrderFixtures, { total: 120 }), ...allRoutes()],
      '',
      '',
      [SPLIT_PATH],
    );

    await setupRegister(user);
    await clickRegister(user);

    await waitFor(() => {
      expect(splitRequests(requests)).toHaveLength(1);
    });

    release();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: t.actions.selectRow('PO-2026-900002') }),
      ).toBeEnabled();
    });

    expect(screen.getByRole('button', { name: messages.common.search })).toBeEnabled();
    expect(screen.getByRole('button', { name: t.actions.nextPage })).toBeEnabled();
  });

  /*
   * 눈에 보이는 컨트롤을 전부 잠가도 디자인 시스템이 잠금을 받지 않는 자리(조건 칩의 ×)가
   * 남는다. 그 길로 들어와도 대상이 바뀌지 않는다 — **주소가 그대로임을 값으로 본다.**
   */
  it('전송 중에는 조건 칩을 지워도 대상이 바뀌지 않는다', async () => {
    const { requests, release, user } = renderScreen(
      [filteringListRoute(), ...allRoutes()],
      '?q=PO-2026-900001',
      '',
      [SPLIT_PATH],
    );

    await screen.findByText('PO-2026-900001');
    await selectPo(user, 'PO-2026-900001');
    await screen.findByText(t.lineTable.orderedPair(100, 40));
    await fillDraft(user);
    await clickRegister(user);

    await waitFor(() => {
      expect(splitRequests(requests)).toHaveLength(1);
    });

    const before = currentLocation();

    await user.click(screen.getByRole('button', { name: t.filters.chipRemoveQ }));

    expect(currentLocation()).toBe(before);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    release();
  });
});

describe('OverReceiptSplitScreen — 등록 성공', () => {
  /* 앞에 둔 규칙이 먼저 맞는다 — 기본 등록 스텁을 가린다. */
  const renderSuccess = (created: unknown[] = CREATED_TWO) =>
    renderScreen([splitRoute(created), ...allRoutes()]);

  /* **M42의 화면 몫** — 두 건이 만들어졌다는 것이 이 화면의 요점이다. */
  it('만들어진 전표 번호가 전부 보이고 건수가 밝혀진다', async () => {
    const { user } = renderSuccess();

    await setupRegister(user);
    await clickRegister(user);

    expect(await screen.findByText(t.result.count(2))).toBeInTheDocument();
    expect(screen.getByText('IR-2026-900010')).toBeInTheDocument();
    expect(screen.getByText('IR-2026-900011')).toBeInTheDocument();
  });

  it('한 건만 만들어져도 건수를 밝힌다', async () => {
    const { user } = renderSuccess(CREATED_ONE);

    await setupRegister(user);
    await clickRegister(user, t.actions.registerNormalOnly);

    expect(await screen.findByText(t.result.count(1))).toBeInTheDocument();
  });

  /*
   * **M40의 화면 몫 · C29** — 응답에는 내부 번호가 들어 있는데 화면 어디에도 나오지 않는다.
   * 짝 방향(전표 번호는 보인다)을 선행으로 둔다.
   */
  it('성공 표시에 내부 번호가 없다', async () => {
    const { user } = renderSuccess();

    await setupRegister(user);
    await clickRegister(user);

    await screen.findByText('IR-2026-900010');

    const result = screen.getByRole('status', { name: t.panes.result });

    for (const id of ['9601', '9602']) {
      expect(result.textContent ?? '').not.toContain(id);
    }
  });

  /*
   * **M38 · 수명 표 8행** — 초안을 비우는 것은 **이중 제출 완화의 한 층**이다.
   * 비우지 않으면 성공한 뒤에도 같은 수량이 남아 한 번 더 보낼 수 있다.
   * 고른 발주는 **유지한다** — 등록 결과를 그 자리에서 확인해야 한다.
   */
  it('성공하면 초안이 비고 고른 발주는 유지된다', async () => {
    const { user } = renderSuccess();

    await setupRegister(user);

    /* 짝 방향 — 실제로 값이 들어가 있다. */
    expect(qtyInput(1)).toHaveValue(66);
    expect(screen.getByLabelText(t.fields.receiptDatetime)).toHaveValue(RECEIPT_DATETIME);

    await clickRegister(user);
    await screen.findByText(t.result.count(2));

    await waitFor(() => {
      expect(qtyInput(1)).toHaveValue(null);
    });

    expect(screen.getByLabelText(t.fields.receiptDatetime)).toHaveValue('');
    expect(currentLocation()).toContain('po=9001');
    expect(screen.getByText(t.lineTable.orderedPair(100, 40))).toBeInTheDocument();
  });

  /*
   * **M39 · 수명 표 8행** — 등록 뒤 같은 발주의 누적 입하가 늘었다. 다시 부르지 않으면
   * 화면이 **등록 전 숫자**를 그대로 보이면서 「정량 · 초과」를 그 값으로 계산한다.
   */
  it('성공하면 라인을 다시 부른다', async () => {
    const { requests, user } = renderSuccess();

    await setupRegister(user);

    const before = requestsTo(requests, LINES_PATH).length;

    await clickRegister(user);
    await screen.findByText(t.result.count(2));

    await waitFor(() => {
      expect(requestsTo(requests, LINES_PATH).length).toBeGreaterThan(before);
    });
  });
});

describe('OverReceiptSplitScreen — 등록 실패 3갈래', () => {
  const renderFailing = (route: StubRoute) => renderScreen([route, ...allRoutes()]);

  const VALIDATION_BODY = {
    errors: [
      { scope: 'field', field: 'deliveryNoteNo', code: 'INVALID', message: '합성 서버 문구' },
    ],
  };

  /* **M43** — 실패했는데 입력을 지우면 사용자가 처음부터 다시 친다(수명 표 9행). */
  it('검증 실패는 서버 문구를 내고 입력이 남는다', async () => {
    const { user } = renderFailing(failingSplitRoute(400, VALIDATION_BODY));

    await setupRegister(user);
    await clickRegister(user);

    expect(await screen.findByText('합성 서버 문구')).toBeInTheDocument();
    expect(qtyInput(1)).toHaveValue(66);
    expect(screen.getByLabelText(t.fields.receiptDatetime)).toHaveValue(RECEIPT_DATETIME);
  });

  /*
   * **M46** — 권한 없음은 다시 시도해도 풀리지 않는다. 재시도 수단을 내면
   * 사용자가 같은 실패를 되풀이한다.
   */
  it('권한 없음은 그 사유를 내고 다시 시도를 권하지 않는다', async () => {
    const { user } = renderFailing(failingSplitRoute(403));

    await setupRegister(user);
    await clickRegister(user);

    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
    expect(screen.queryByText(t.notes.registerRecheck)).not.toBeInTheDocument();
  });

  /*
   * **M45 · C32** — 응답을 받지 못했으면 등록됐는지 알 수 없다. 확인 없이 다시 보내면
   * 같은 입하가 전표 두 벌로 남는다 — 공통 문구만으로는 그 위험이 전해지지 않는다.
   */
  it('응답이 없으면 확인 안내가 함께 나온다', async () => {
    const { user } = renderFailing(offlineSplitRoute());

    await setupRegister(user);
    await clickRegister(user);

    expect(await screen.findByText(messages.httpError.offline)).toBeInTheDocument();
    expect(screen.getByText(t.notes.registerRecheck)).toBeInTheDocument();
  });

  /* 세 갈래의 문구가 서로 다르다 — 같은 문구를 쓰면 사용자가 할 조치를 가릴 수 없다. */
  it('검증 실패에는 연결 안내를 내지 않는다', async () => {
    const { user } = renderFailing(failingSplitRoute(400, VALIDATION_BODY));

    await setupRegister(user);
    await clickRegister(user);

    await screen.findByText('합성 서버 문구');

    expect(screen.queryByText(messages.httpError.offline)).not.toBeInTheDocument();
    expect(screen.queryByText(messages.httpError.forbidden)).not.toBeInTheDocument();
  });

  /*
   * **M44 · C31** — 부분 실패가 없는 한 트랜잭션이라 건별 결과를 그리지 않는다.
   * 앞선 성공의 번호가 남아 있으면 「일부는 됐다」로 읽힌다.
   */
  it('성공한 뒤 다시 실패하면 결과 구획이 사라진다', async () => {
    let shouldFail = false;
    const { user } = renderScreen([
      {
        match: isSplitPost,
        respond: () =>
          shouldFail
            ? jsonResponse(VALIDATION_BODY, { status: 400 })
            : jsonResponse({ created: CREATED_TWO }, { status: 201 }),
      },
      ...allRoutes(),
    ]);

    await setupRegister(user);
    await clickRegister(user);
    await screen.findByText(t.result.count(2));

    shouldFail = true;

    /* 성공으로 초안이 비었으니 다시 채운다 — 고른 발주는 그대로다(수명 표 8행). */
    await fillDraft(user);
    await clickRegister(user);

    await screen.findByText('합성 서버 문구');

    expect(screen.queryByRole('status', { name: t.panes.result })).not.toBeInTheDocument();
    expect(screen.queryByText('IR-2026-900010')).not.toBeInTheDocument();
  });
});

describe('OverReceiptSplitScreen — 취소와 초안 파기 확인', () => {
  /*
   * **M47** — 이 화면의 「취소」는 저장 전 복귀다. 계약의 입하 취소는 승인을 타며
   * 이 화면이 부를 수 있는 것이 아니다.
   *
   * **요청 수 자체를 센다.** 「쓰기가 나가지 않았다」만 보면 취소 경로에 붙인 조회
   * (되돌리려고 다시 부르기 같은 것)가 그대로 통과한다 — 취소는 **아무것도 부르지 않는다.**
   */
  it('취소는 어떤 요청도 보내지 않고 선택을 비운다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findByText('PO-2026-900001');
    await selectPo(user, 'PO-2026-900001');
    await screen.findByText(t.lineTable.orderedPair(100, 40));

    /* 짝 방향 — 여기까지 실제로 요청이 여럿 나갔다(아무것도 안 부르고 통과하지 않게 한다). */
    expect(requests.length).toBeGreaterThan(3);

    const before = requests.length;

    await user.click(screen.getByRole('button', { name: messages.common.cancel }));

    await screen.findByText(t.empty.noSelectionTitle);

    expect(currentLocation()).not.toContain('po=');
    expect(requests.slice(before)).toHaveLength(0);
  });

  /* **C33** — 친 값이 있으면 확인을 받는다. 말없이 사라지면 무엇을 잃었는지도 알 수 없다. */
  it('초안이 있으면 취소가 확인 창을 거친다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await setupRegister(user);
    await user.click(screen.getByRole('button', { name: messages.common.cancel }));

    /* 아직 아무것도 잃지 않았다 — 창이 뜬 것만으로 초안이 사라지면 확인의 뜻이 없다. */
    expect(screen.getByRole('dialog', { name: t.dialog.discardTitle })).toBeInTheDocument();
    expect(qtyInput(1)).toHaveValue(66);

    await user.click(screen.getByRole('button', { name: t.actions.discardDraft }));

    await screen.findByText(t.empty.noSelectionTitle);

    expect(currentLocation()).not.toContain('po=');
    expect(splitRequests(requests)).toHaveLength(0);
  });

  it('계속 입력을 누르면 아무것도 잃지 않는다', async () => {
    const { user } = renderScreen(allRoutes());

    await setupRegister(user);
    await user.click(screen.getByRole('button', { name: messages.common.cancel }));
    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: t.dialog.discardTitle }),
      ).not.toBeInTheDocument();
    });

    expect(qtyInput(1)).toHaveValue(66);
    expect(screen.getByLabelText(t.fields.receiptDatetime)).toHaveValue(RECEIPT_DATETIME);
    expect(currentLocation()).toContain('po=9001');
  });

  /* 머리 입력만 채워도 버릴 것이 있다 — 라인 수량만 보면 나머지가 말없이 사라진다. */
  it('머리 입력만 채워도 확인을 받는다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('PO-2026-900001');
    await selectPo(user, 'PO-2026-900001');
    await screen.findByText(t.lineTable.orderedPair(100, 40));
    await user.type(screen.getByLabelText(t.fields.remarks), '합성 비고');

    await user.click(screen.getByRole('button', { name: messages.common.cancel }));

    expect(screen.getByRole('dialog', { name: t.dialog.discardTitle })).toBeInTheDocument();
  });

  /*
   * **사라진 줄의 초안은 함께 사라진다**(수명 표 4행 — 초안은 라인 응답으로 새로 만든다).
   *
   * 초안은 특정 줄에 묶여 있다. 그 줄이 없어졌는데 값이 남으면 **화면에 보이지 않는 값** 때문에
   * 확인 창이 뜬다 — 사용자는 무엇을 버리라는 것인지 알 수 없고, 그 값은 어디에도 실리지 않는다.
   * 라인 응답을 되돌림 신호에서 빼면 이 자리가 그대로 재현된다.
   */
  it('라인 목록이 달라져 줄이 사라지면 그 줄의 초안도 사라진다', async () => {
    const { queryClient, user } = renderScreen([shrinkingLinesRoute(), ...allRoutes()]);

    await screen.findByText('PO-2026-900001');
    await selectPo(user, 'PO-2026-900001');
    await screen.findByText(t.lineTable.orderedPair(100, 40));
    await user.type(qtyInput(1), '66');

    /* 짝 방향 — 실제로 값이 들어가 있다. */
    expect(qtyInput(1)).toHaveValue(66);

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: poKeys.lines(9001) });
    });

    /* 1번 줄이 사라졌다 — 남은 줄만 보인다. */
    await waitFor(() => {
      expect(screen.queryByLabelText(t.lineTable.arrivedQtyLabel(1))).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: messages.common.cancel }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(currentLocation()).not.toContain('po=');
  });

  /* 짝 방향 — 버릴 것이 없으면 확인을 받지 않는다. 늘 물으면 사용자가 읽지 않고 누른다. */
  it('버릴 것이 없으면 확인 창이 뜨지 않는다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('PO-2026-900001');
    await selectPo(user, 'PO-2026-900001');
    await screen.findByText(t.lineTable.orderedPair(100, 40));

    await user.click(screen.getByRole('button', { name: messages.common.cancel }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /* **M36의 화면 몫 · C34** — 창 안 선택 목록이 잘리는 결함이 걸릴 자리를 만들지 않는다. */
  it('확인 창에 선택칸이 없다', async () => {
    const { user } = renderScreen(allRoutes());

    await setupRegister(user);
    await user.click(screen.getByRole('button', { name: messages.common.cancel }));

    const dialog = screen.getByRole('dialog', { name: t.dialog.discardTitle });

    expect(within(dialog).getByText(messages.common.discardChangesConfirm)).toBeInTheDocument();
    expect(within(dialog).queryAllByRole('combobox')).toHaveLength(0);
  });
});

describe('OverReceiptSplitScreen — 신규 P/O 등록', () => {
  /* **M48 · C35** — 갈 곳이 아직 없다. 자리를 두되 사유를 밝히고 이동시키지 않는다. */
  it('잠겨 있고 사유가 보이며 어떤 경로로도 이동하지 않는다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('PO-2026-900001');
    await selectPo(user, 'PO-2026-900001');
    await screen.findByText(t.lineTable.orderedPair(100, 40));

    const before = currentLocation();
    const target = screen.getByRole('button', { name: t.actions.createPurchaseOrder });

    expect(target).toBeDisabled();
    expect(
      screen.getByText(t.actionReasons.createPurchaseOrderUnavailable),
    ).toBeInTheDocument();

    await user.click(target);

    expect(currentLocation()).toBe(before);
    expect(
      within(screen.getByRole('region', { name: t.panes.register })).queryAllByRole('link'),
    ).toHaveLength(0);
  });
});
