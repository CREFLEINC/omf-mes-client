import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import {
  itemFixtures,
  LABEL_9301,
  lotReasonFixtures,
  partnerFixtures,
  plantFixtures,
  purchaseOrderDetailBody,
  purchaseOrderFixtures,
  purchaseOrderLineFixtures,
  uomFixtures,
} from './fixtures';
import { poKeys } from './queries';
import { ReceiptRegisterPanel } from './register-panel';
import { DELIVERY_NOTE_NO_MAX } from './validation';

const t = messages.overReceiptSplit;

type SplitRequestBody = components['schemas']['InboundReceiptSplitRequest'];

/** 창을 여는 발주 번호와 그 상세 경로. 창은 이 번호 하나로 선다. */
const PO_ID = 9001;
const detailPath = (purchaseOrderId: number): string =>
  `/logistics/purchase-orders/${String(purchaseOrderId)}`;
const DETAIL_PATH = detailPath(PO_ID);
const SPLIT_PATH = '/logistics/inbound-receipts:split';
const PARTNERS_PATH = '/mdm/partners';
const PLANTS_PATH = '/mdm/plants';
/** 품목만 번호마다 상세를 부른다 — 경로가 하나가 아니라 번호마다 하나다. */
const itemPath = (itemId: number): string => `/mdm/items/${String(itemId)}`;
const UOMS_PATH = '/mdm/uoms';
const CODE_VALUES_PATH = '/mdm/code-values';

/** 창을 연 화면이 넘기는 「함께 다시 읽을 것」 — 시험에서는 합성 키 하나로 본다. */
const BOARD_KEY = ['sample-board'] as const;

const SUPPLIER_LABEL = 'SAMPLE-SUP-01 · 합성 공급사 가';
const UOM_LABEL = 'SAMPLE-EA · 합성 단위 개';
const PLANT_LABEL = 'SAMPLE-PLT-01 · 합성 공장 가';

/**
 * 창 어디에도 나와서는 안 되는 내부 번호(FK).
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
   * 「창이 그 함수를 부르지 않고 다른 값을 보냈다」를 잡을 수 없다.
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

/** 발주 상세 — 머리와 라인을 함께 준다. */
const detailRoute = (
  body: unknown = purchaseOrderDetailBody(),
  pathname: string = DETAIL_PATH,
): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse(body),
});

const failingDetailRoute = (status = 500): StubRoute => ({
  match: (request) => isGet(request, DETAIL_PATH),
  respond: () => jsonResponse({ message: '' }, { status }),
});

/**
 * 다시 부르면 **줄 구성이 달라지는** 상세 응답.
 *
 * 발주가 고쳐지거나 다른 사용자가 먼저 처리해 줄이 사라지는 일이 실제로 있다.
 * 같은 본문을 돌려주면 캐시가 참조를 그대로 유지해 **초안 되돌림이 아예 일어나지 않으므로**,
 * 그 자리를 검사하려면 내용이 실제로 달라져야 한다.
 */
const shrinkingDetailRoute = (): StubRoute => {
  let call = 0;

  return {
    match: (request) => isGet(request, DETAIL_PATH),
    respond: () => {
      call += 1;

      return jsonResponse(
        purchaseOrderDetailBody(
          undefined,
          call === 1 ? purchaseOrderLineFixtures : purchaseOrderLineFixtures.slice(1),
        ),
      );
    },
  };
};

/**
 * 참조 목록 응답. **`page`를 인자로 받는다** — 기본값(`total === items.length`)만 쓰면
 * 「잘렸다」 갈래가 영영 만들어지지 않는다.
 */
const lookupRoute = (
  pathname: string,
  items: unknown[],
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse(listBody(items, page)),
});

const failingLookupRoute = (pathname: string): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse({ message: '' }, { status: 500 }),
});

/**
 * 쪽을 **실제로 나눠 주는** 거래처 목록.
 *
 * ⭐ 한 쪽에 다 담아 주는 스텁은 「끝까지 받는다」를 증명하지 못한다 — 첫 쪽만 받는 창도
 * 그 스텁에서는 전부 통과한다. 거래처는 936건이고 그 너머의 공급사가 「알 수 없음」으로
 * 섰다(omf-all-around#38). **서버가 정한 쪽 크기로 자른다**(요청한 `size`를 쓰지 않는다).
 */
const pagedPartnersRoute = (items: unknown[], serverSize = 1): StubRoute => ({
  match: (request) => isGet(request, PARTNERS_PATH),
  respond: (request) => {
    const page = Number(new URL(request.url).searchParams.get('page') ?? '1');
    const from = (page - 1) * serverSize;

    return jsonResponse({
      items: items.slice(from, from + serverSize),
      page: { page, size: serverSize, total: items.length },
    });
  },
});

/** 코드 사전 — 이 창이 부르는 것은 대체 LOT 사유 하나다. 다른 그룹은 빈 목록으로 답한다. */
const codeValuesRoute = (): StubRoute => ({
  match: (request) => isGet(request, CODE_VALUES_PATH),
  respond: (request) => {
    const group = new URL(request.url).searchParams.get('codeGroupCode');

    return jsonResponse(listBody(group === 'SUBSTITUTE_LOT_REASON' ? lotReasonFixtures : []));
  },
});

/**
 * 품목 상세. **번호마다 하나씩** 답한다(`GET /mdm/items/{itemId}`) — 응답이
 * `{ item, editability }` 봉투라는 것까지 여기서 굳힌다.
 *
 * `failing`에 든 번호는 500, `missing`에 든 번호는 404로 답한다.
 */
const itemDetailRoutes = (failing: number[] = [], missing: number[] = []): StubRoute[] =>
  itemFixtures.map((item) => ({
    match: (request: Request) => isGet(request, itemPath(item.itemId)),
    respond: () => {
      if (missing.includes(item.itemId)) return jsonResponse({ message: '' }, { status: 404 });

      return failing.includes(item.itemId)
        ? jsonResponse({ message: '' }, { status: 500 })
        : jsonResponse({ item, editability: {} });
    },
  }));

/** 참조 넷과 코드 사전. 창이 이름으로 풀 수 있는 정상 상태다. */
const lookupRoutes = (): StubRoute[] => [
  lookupRoute(PARTNERS_PATH, partnerFixtures),
  lookupRoute(PLANTS_PATH, plantFixtures),
  ...itemDetailRoutes(),
  lookupRoute(UOMS_PATH, uomFixtures),
  codeValuesRoute(),
];

/**
 * 만들어진 전표 한 건의 응답 본문.
 *
 * **내부 번호를 함께 담는다** — 창이 그것을 내지 않는다는 것을 검사하려면
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

/* 전표는 늘 한 건이다(서버 장부 P-100) — 초과 몫은 그 전표 줄의 `excessQty` 로 실린다. */
const CREATED_ONE = [createdReceipt(9601, 'IR-2026-900010')];

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

/** 응답 자체가 오지 않는 실패. 상태 코드가 없어 창이 다른 갈래로 다뤄야 한다. */
const offlineSplitRoute = (): StubRoute => ({
  match: isSplitPost,
  respond: () => {
    throw new Error('연결이 끊겼습니다');
  },
});

/**
 * 이 창이 닿을 수 있는 경로를 전부 스텁으로 둔 한 벌.
 *
 * **만들어질 전표를 인자로 받는다** — 같은 경로 규칙을 앞에 한 벌 더 얹어 뒤엣것을 가리면
 * 도달하지 못하는 규칙이 남아, 읽는 사람이 어느 쪽이 응답하는지 세어 봐야 한다.
 */
const allRoutes = (created?: unknown[]): StubRoute[] => [
  detailRoute(),
  splitRoute(created),
  ...lookupRoutes(),
];

interface RenderedPanel {
  requests: RecordedRequest[];
  queryClient: QueryClient;
  release: () => void;
  user: ReturnType<typeof userEvent.setup>;
  onClose: ReturnType<typeof vi.fn>;
  onOpenExcess: ReturnType<typeof vi.fn>;
}

/**
 * 창을 바로 세운다 — 창은 발주 번호 하나와 두 되먹임만 받는다. 어느 화면이 여는지는 이 창의 일이 아니다
 * (입하 예정 조회가 주소 `register=1` 로 연다 — 그 이음매는 그 화면의 시험이 잰다).
 */
const renderPanel = (
  routes: StubRoute[],
  hold: string[] = [],
  purchaseOrderId: number = PO_ID,
): RenderedPanel => {
  const { fetch, requests, release } = createRecordingFetch(routes, hold);
  const onClose = vi.fn();
  const onOpenExcess = vi.fn();

  const { queryClient } = renderWithProviders(
    <ReceiptRegisterPanel
      purchaseOrderId={purchaseOrderId}
      refreshKeys={[BOARD_KEY]}
      onOpenExcess={onOpenExcess}
      onClose={onClose}
    />,
    { fetch },
  );

  return { requests, queryClient, release, user: userEvent.setup(), onClose, onOpenExcess };
};

const requestsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === pathname);

/** 「입하 등록」 창 자체. 확인 창·파기 확인 창은 그 위에 따로 선다. */
const panel = (): HTMLElement => screen.getByRole('dialog', { name: t.title });

const lineTable = (): HTMLElement => within(panel()).getAllByRole('table')[0] as HTMLElement;

const summary = (): HTMLElement => screen.getByRole('group', { name: t.summary.label });

const qtyInput = (lineNo: number): HTMLElement =>
  screen.getByLabelText(t.lineTable.arrivedQtyLabel(lineNo));

/** 라인이 선 뒤 — 수량 칸이 받는다. */
const waitLines = async (): Promise<void> => {
  await screen.findByLabelText(t.lineTable.arrivedQtyLabel(1));
};

/**
 * 창 어디에도 내부 번호가 새지 않았는지 본다. 짝이 되는 「이름은 보인다」와 함께 쓴다.
 * 여기서 세는 것은 **사람이 읽는 자리**(창의 글자)뿐이다.
 */
const expectNoInternalIds = (): void => {
  for (const id of INTERNAL_IDS) {
    expect(panel().textContent ?? '').not.toContain(id);
  }
};

describe('ReceiptRegisterPanel — 발주 상세 하나로 선다', () => {
  /* 머리와 라인을 상세 하나로 받는다 — 라인 경로를 따로 부르지 않는다. */
  it('상세를 1회 부르고 제목·발주번호·네 수치가 보인다', async () => {
    const { requests } = renderPanel(allRoutes());

    await waitLines();

    expect(panel()).toBeInTheDocument();
    expect(within(summary()).getByText('PO-2026-900001')).toBeInTheDocument();
    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(1);
    expect(requestsTo(requests, `${DETAIL_PATH}/lines`)).toHaveLength(0);
    expect(within(lineTable()).getByText(t.lineTable.remainingPair('60', '5'))).toBeInTheDocument();
  });

  /* 응답을 기다리는 동안 등록 구획을 열지 않는다 — 무엇을 등록하는지 없는 채로 입력만 받게 된다. */
  it('상세가 오기 전에는 골격만 서고 입력 구획이 없으며 등록 단추가 잠긴다', async () => {
    const { release } = renderPanel(allRoutes(), [DETAIL_PATH]);

    expect(await screen.findByRole('status', { name: t.loading.lines })).toBeInTheDocument();
    expect(screen.queryByLabelText(t.fields.receiptDatetime)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.register })).toBeDisabled();

    release();

    /* 짝 방향 — 오면 실제로 열린다. 「늘 없다」로 통과하지 않게 한다. */
    await waitLines();

    expect(screen.getByLabelText(t.fields.receiptDatetime)).toBeInTheDocument();
  });

  it('라인이 하나도 없는 발주는 그 사실을 말한다', async () => {
    renderPanel([
      detailRoute(purchaseOrderDetailBody(undefined, [])),
      splitRoute(),
      ...lookupRoutes(),
    ]);

    expect(await screen.findByText(t.empty.noLinesTitle)).toBeInTheDocument();
  });

  it('상세 조회에 실패하면 창 안에 배너가 서고 다시 시도로 다시 부른다', async () => {
    const { requests, user } = renderPanel([failingDetailRoute(), splitRoute(), ...lookupRoutes()]);

    await screen.findByText(messages.httpError.loadTitle);

    /* 실패를 「불러오는 중」으로 가리지 않는다. */
    expect(screen.queryByRole('status', { name: t.loading.lines })).not.toBeInTheDocument();

    const before = requestsTo(requests, DETAIL_PATH).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, DETAIL_PATH).length).toBeGreaterThan(before);
    });
  });

  /* 권한 없음은 다시 불러도 같다 — 재시도 수단을 내지 않는다. */
  it('상세가 권한 없음이면 다시 시도를 내지 않는다', async () => {
    renderPanel([failingDetailRoute(403), splitRoute(), ...lookupRoutes()]);

    await screen.findByText(messages.httpError.forbidden);

    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });
});

describe('ReceiptRegisterPanel — 참조 표기 네 갈래', () => {
  it('넷을 모두 이름으로 풀고 어디에도 내부 번호가 없다', async () => {
    renderPanel(allRoutes());

    await waitLines();

    // 짝 방향 — 이름이 실제로 보인다(아무것도 안 그려도 통과하지 않게 한다).
    await waitFor(() => {
      expect(within(summary()).getByText(SUPPLIER_LABEL)).toBeInTheDocument();
    });
    /* 품목은 코드 열·이름 열로 나뉜다. */
    expect(within(lineTable()).getAllByText('SAMPLE-ITEM-01').length).toBeGreaterThan(0);
    expect(within(lineTable()).getAllByText('합성 품목 가').length).toBeGreaterThan(0);
    expect(screen.getAllByText(UOM_LABEL).length).toBeGreaterThan(0);
    expect(within(summary()).getByText(PLANT_LABEL)).toBeInTheDocument();

    expectNoInternalIds();
  });

  /*
   * **M12** — 본 자료가 참조보다 먼저 오는 순간이 실제로 있다(#47).
   * 그때 「알 수 없음」을 내면 정상 값이 잘못된 값으로 읽힌다.
   */
  it('참조가 늦게 와도 그동안 「알 수 없음」이라 하지 않는다', async () => {
    const { release } = renderPanel(allRoutes(), [PARTNERS_PATH]);

    await waitLines();

    expect(within(summary()).getByText(t.values.referenceLoading)).toBeInTheDocument();
    expect(within(summary()).queryByText(t.values.unknown)).not.toBeInTheDocument();

    release();

    // 짝 방향 — 도착하면 이름으로 바뀐다.
    await waitFor(() => {
      expect(within(summary()).getByText(SUPPLIER_LABEL)).toBeInTheDocument();
    });
  });

  /* **M13** — 이름을 못 풀어도 내부 번호를 내지 않는다(#44). */
  it('목록에 없는 참조도 번호가 아니라 문구로 낸다', async () => {
    const other = purchaseOrderFixtures[1];

    renderPanel(
      [
        detailRoute(purchaseOrderDetailBody(other), detailPath(9002)),
        splitRoute(),
        ...lookupRoutes(),
      ],
      [],
      9002,
    );

    await waitLines();

    // 공급사 9102가 이 갈래다 — 목록으로 푸는 참조에만 「목록에 없음」이 선다.
    await waitFor(() => {
      expect(within(summary()).getByText(t.values.unknown)).toBeInTheDocument();
    });
    expectNoInternalIds();
  });

  /*
   * **품목은 줄마다 따로 부른다** — 한 줄이 실패해도 나머지 줄의 이름은 그대로 서야 하고,
   * 실패한 줄에는 번호가 아니라 문구가 와야 한다(#44).
   */
  it('품목 하나를 못 풀어도 나머지 줄의 이름은 그대로 선다', async () => {
    renderPanel([
      detailRoute(),
      splitRoute(),
      lookupRoute(PARTNERS_PATH, partnerFixtures),
      lookupRoute(PLANTS_PATH, plantFixtures),
      ...itemDetailRoutes([9302]),
      lookupRoute(UOMS_PATH, uomFixtures),
      codeValuesRoute(),
    ]);

    await waitLines();

    await waitFor(() => {
      expect(within(lineTable()).getAllByText('합성 품목 가').length).toBeGreaterThan(0);
    });
    expect(within(lineTable()).getByText(t.values.referenceFailed)).toBeInTheDocument();
    expectNoInternalIds();
  });

  /*
   * **없는 품목(404)과 못 받은 품목은 다르다.** 404는 다시 불러도 같은 답이라
   * 「다시 시도」를 세우면 눌러도 영영 풀리지 않는다 — 그 줄만 「알 수 없음」으로 둔다.
   */
  it('없는 품목은 실패가 아니라 알 수 없음이고 다시 시도를 세우지 않는다', async () => {
    renderPanel([
      detailRoute(),
      splitRoute(),
      lookupRoute(PARTNERS_PATH, partnerFixtures),
      lookupRoute(PLANTS_PATH, plantFixtures),
      ...itemDetailRoutes([], [9302]),
      lookupRoute(UOMS_PATH, uomFixtures),
      codeValuesRoute(),
    ]);

    await waitLines();

    await waitFor(() => {
      expect(within(lineTable()).getByText(t.values.unknown)).toBeInTheDocument();
    });
    expect(within(lineTable()).queryByText(t.values.referenceFailed)).not.toBeInTheDocument();
    expect(screen.queryByText(t.reasons.lineReferencesFailed)).not.toBeInTheDocument();
    expectNoInternalIds();
  });

  /* 같은 품목을 실은 줄이 둘이면 요청도 하나다 — 줄 수만큼 부르면 라인이 늘 때 요청이 는다. */
  it('같은 품목을 실은 줄이 여럿이어도 그 품목은 한 번만 묻는다', async () => {
    const { requests } = renderPanel(allRoutes());

    await waitLines();

    await waitFor(() => {
      expect(within(lineTable()).getAllByText('합성 품목 가').length).toBeGreaterThan(0);
    });

    /* 9401·9403이 같은 품목(9301)이다. */
    expect(requestsTo(requests, itemPath(9301))).toHaveLength(1);
  });

  /* 품목은 **라인이 온 뒤에** 그 줄의 번호만 묻는다 — 상세를 기다리는 동안에는 물을 번호가 없다. */
  it('상세가 오기 전에는 품목을 부르지 않는다', async () => {
    const { release, requests } = renderPanel(allRoutes(), [DETAIL_PATH]);

    await screen.findByRole('status', { name: t.loading.lines });

    expect(requestsTo(requests, itemPath(9301))).toHaveLength(0);

    release();

    /* 짝 방향 — 라인이 오면 실제로 묻는다. */
    await waitFor(() => {
      expect(requestsTo(requests, itemPath(9301))).toHaveLength(1);
    });
  });

  /* 라인 구획의 셋(공장·품목·단위) 중 하나만 실패해도 그 구획이 안내와 복구 수단을 낸다. */
  it('단위만 실패해도 라인 구획이 안내와 복구 수단을 낸다', async () => {
    const { requests, user } = renderPanel([
      detailRoute(),
      splitRoute(),
      lookupRoute(PARTNERS_PATH, partnerFixtures),
      lookupRoute(PLANTS_PATH, plantFixtures),
      ...itemDetailRoutes(),
      failingLookupRoute(UOMS_PATH),
      codeValuesRoute(),
    ]);

    await screen.findByText(t.reasons.lineReferencesFailed);

    const before = requestsTo(requests, UOMS_PATH).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, UOMS_PATH).length).toBeGreaterThan(before);
    });
  });

  /* 공급사 이름은 머리줄에 선다 — 옛 화면은 목록이 복구를 맡았으나 창에는 목록이 없어 이 구획이 맡는다. */
  it('공급사만 실패해도 라인 구획이 안내와 복구 수단을 내고, 다시 시도가 거래처를 다시 부른다', async () => {
    const { requests, user } = renderPanel([
      detailRoute(),
      splitRoute(),
      failingLookupRoute(PARTNERS_PATH),
      lookupRoute(PLANTS_PATH, plantFixtures),
      ...itemDetailRoutes(),
      lookupRoute(UOMS_PATH, uomFixtures),
      codeValuesRoute(),
    ]);

    await screen.findByText(t.reasons.lineReferencesFailed);

    const before = requestsTo(requests, PARTNERS_PATH).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, PARTNERS_PATH).length).toBeGreaterThan(before);
    });
  });

  /**
   * ⭐ **거래처는 한 쪽에 들어가지 않는다**(936건 · omf-all-around#38).
   * 서버가 **한 건씩** 나눠 주게 해 두 쪽째에 있는 공급사를 만든다.
   */
  it('거래처가 여러 쪽이면 끝까지 받아 두 쪽째 공급사도 이름으로 낸다', async () => {
    const { requests } = renderPanel([
      detailRoute(),
      splitRoute(),
      /* 9101(9001의 공급사)을 **둘째 쪽**에 둔다. */
      pagedPartnersRoute([...partnerFixtures].reverse()),
      lookupRoute(PLANTS_PATH, plantFixtures),
      ...itemDetailRoutes(),
      lookupRoute(UOMS_PATH, uomFixtures),
      codeValuesRoute(),
    ]);

    await waitFor(() => {
      expect(within(summary()).getByText(SUPPLIER_LABEL)).toBeInTheDocument();
    });

    /* 짝 방향 — 두 쪽을 실제로 불렀다(한 번만 불러 통과한 것이 아니다). */
    const pages = requestsTo(requests, PARTNERS_PATH).map((request) =>
      request.url.searchParams.get('page'),
    );

    expect(pages).toEqual(['1', '2']);
  });
});

describe('ReceiptRegisterPanel — 도착 수량과 가르기', () => {
  /** 그 줄번호의 발주 라인 줄에서 P/O 반영·초과분 칸(마지막 둘)을 읽는다. */
  const splitCellsOf = (lineNo: number): string[] => {
    const row = within(lineTable())
      .getAllByRole('row')
      .find(
        (candidate) => within(candidate).queryAllByRole('cell')[0]?.textContent === String(lineNo),
      );

    return within(row as HTMLElement)
      .getAllByRole('cell')
      .slice(-2)
      .map((cell) => cell.textContent ?? '');
  };

  /* 한도(잔량 60 + 허용 5)와 꼭 같은 도착은 전부 P/O 반영이다. */
  it('한도와 같은 수량은 전부 P/O 반영으로 갈린다', async () => {
    const { user } = renderPanel(allRoutes());

    await waitLines();
    await user.type(qtyInput(1), '65');

    expect(splitCellsOf(1)).toEqual(['65', '0']);
  });

  it('한도를 넘으면 넘은 몫만 초과분으로 갈린다', async () => {
    const { user } = renderPanel(allRoutes());

    await waitLines();
    await user.type(qtyInput(1), '66');

    expect(splitCellsOf(1)).toEqual(['65', '1']);
  });

  /* 여러 줄 중 일부만 채우는 것이 정상 경로다 — 나머지 줄은 「이번에 받지 않는다」이다. */
  it('일부 줄만 채워도 그 줄만 갈린다', async () => {
    const { user } = renderPanel(allRoutes());

    await waitLines();
    await user.type(qtyInput(2), '12');

    expect(splitCellsOf(2)).toEqual(['0', '12']);
    expect(within(lineTable()).getAllByText(t.values.notSplit)).toHaveLength(4);
  });

  /*
   * 다 받은 줄(9402 — 허용치 0)에 넣은 수량은 전부 초과 몫이다. 초과 몫만으로 된 줄은 서버가 받지 않아
   * 수량 칸에 사유가 붙는다 — 추가 발주가 오면 그 발주로 받는다.
   */
  it('다 받은 줄에 수량을 넣으면 받을 수 없다는 사유가 붙는다', async () => {
    const { user } = renderPanel(allRoutes());

    await waitLines();
    await user.type(qtyInput(2), '12');

    expect(await screen.findByText(t.errors.qtyNoRoom)).toBeInTheDocument();
  });

  it('세 줄을 모두 채우면 세 줄이 모두 갈린다', async () => {
    const { user } = renderPanel(allRoutes());

    await waitLines();
    await user.type(qtyInput(1), '10');
    await user.type(qtyInput(2), '3');
    await user.type(qtyInput(3), '8');

    expect(splitCellsOf(1)).toEqual(['10', '0']);
    expect(splitCellsOf(2)).toEqual(['0', '3']);
    // 누적 입하가 발주를 넘긴 줄이다 — 서버 한도(발주 + 허용 − 누적 = 3)까지가 P/O 몫이다.
    expect(splitCellsOf(3)).toEqual(['3', '5']);
    expect(within(lineTable()).queryByText(t.values.notSplit)).not.toBeInTheDocument();
  });

  /* **M17의 창 몫** — 잘못 친 값이 계산에 들어가면 P/O 반영·초과분이 둘 다 `NaN`이 된다. */
  it('0을 치면 사유가 붙고 그 줄은 갈리지 않는다', async () => {
    const { user } = renderPanel(allRoutes());

    await waitLines();
    await user.type(qtyInput(1), '0');

    expect(await screen.findByText(t.errors.qtyNotPositive)).toBeInTheDocument();
    /* 세 줄 × P/O 반영·초과분 두 칸 — 어느 줄도 갈리지 않았다. */
    expect(within(lineTable()).getAllByText(t.values.notSplit)).toHaveLength(6);
  });

  /* **M18의 창 몫** — 빈 칸은 「이번에 받지 않는다」이지 잘못이 아니다. */
  it('비워 두면 오류가 아니다', async () => {
    renderPanel(allRoutes());

    await waitLines();

    expect(screen.queryByText(t.errors.qtyNotPositive)).not.toBeInTheDocument();
    expect(screen.queryByText(t.errors.qtyNotNumber)).not.toBeInTheDocument();
  });

  /* 지웠다 다시 치는 도중에도 값이 튀지 않아야 한다. */
  it('쳤다가 지우면 오류가 사라지고 다시 갈리지 않는다', async () => {
    const { user } = renderPanel(allRoutes());

    await waitLines();
    await user.type(qtyInput(1), '0');

    expect(await screen.findByText(t.errors.qtyNotPositive)).toBeInTheDocument();

    await user.clear(qtyInput(1));

    await waitFor(() => {
      expect(screen.queryByText(t.errors.qtyNotPositive)).not.toBeInTheDocument();
    });
  });
});

/**
 * 등록 — **되돌릴 수 없는 쓰기다.**
 *
 * 여기서 잘못 나간 요청은 창이 되돌릴 수 없다(계약의 취소는 승인을 탄다). 그래서
 * 「무엇이 나갔는가」를 **실제로 나간 본문**으로 판정한다.
 */
const RECEIPT_DATETIME = '2026-08-06T09:12';

/** 줄번호 → 그 줄 품목의 사전부착 라벨. 품목코드가 줄의 품목과 같아야 창이 받는다. */
const labelFor = (lineNo: number): string =>
  lineNo === 2
    ? 'SAMPLE-ITEM-02|12|260806|SAMPLE-SUP-01|0001'
    : `SAMPLE-ITEM-01|66|260806|SAMPLE-SUP-01|000${String(lineNo)}`;

/** LOT 을 「라벨 없음 · 기타」로 — 번호 없이 대체 사유를 고른다. */
const markLotMissing = async (
  user: ReturnType<typeof userEvent.setup>,
  lineNo: number,
): Promise<void> => {
  await user.click(screen.getByLabelText(t.lineTable.lotMissingLabel(lineNo)));
  await user.click(screen.getByRole('combobox', { name: t.lineTable.lotReasonLabel(lineNo) }));
  await user.click(screen.getByRole('option', { name: '기타' }));
};

/**
 * 라인 수량·LOT 과 입하 일시를 채운다. 여는 절차와 갈라 둔다 — 등록 뒤에는 창이 열린 채로 다시 채운다.
 * 수량을 넣은 뒤에 서는 LOT 줄(줄마다 하나)에 그 줄 품목의 라벨을 넣는다.
 */
const fillDraft = async (
  user: ReturnType<typeof userEvent.setup>,
  qty: Record<number, string> = { 1: '66' },
): Promise<void> => {
  for (const [lineNo, text] of Object.entries(qty)) {
    await user.type(qtyInput(Number(lineNo)), text);
  }
  for (const lineNo of Object.keys(qty).map(Number)) {
    const lot = screen.queryByLabelText(t.lineTable.lotNoLabel(lineNo));
    if (lot !== null) await user.type(lot, labelFor(lineNo));
  }

  /* 입하 일시는 공장 현지 지금이 미리 들어 있다 — 비우고 고정값을 친다. */
  await user.clear(screen.getByLabelText(t.fields.receiptDatetime));
  await user.type(screen.getByLabelText(t.fields.receiptDatetime), RECEIPT_DATETIME);
};

const setupRegister = async (
  user: ReturnType<typeof userEvent.setup>,
  qty: Record<number, string> = { 1: '66' },
): Promise<void> => {
  await waitLines();
  await fillDraft(user, qty);
};

/** 등록 확인 창 — 「입하 등록」 창 위에 따로 선다. */
const confirmDialog = (): HTMLElement | null =>
  screen.queryByRole('dialog', { name: t.dialog.registerTitle });

/** 「입하 등록」을 누르고, 확인 창이 열리면 「등록」까지 누른다. 검증에 막히면 창이 열리지 않는다. */
const clickRegister = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByRole('button', { name: t.actions.register }));

  const dialog = confirmDialog();
  if (dialog === null) return;

  await user.click(within(dialog).getByRole('button', { name: t.actions.confirmRegister }));
};

const splitRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requestsTo(requests, SPLIT_PATH);

/** 마지막으로 나간 등록 본문. **계약 타입으로 읽는다** — 형태가 어긋나면 타입 검사가 잡는다. */
const lastSplitBody = (requests: RecordedRequest[]): SplitRequestBody => {
  const sent = splitRequests(requests);

  expect(sent.length).toBeGreaterThan(0);

  return sent[sent.length - 1]?.body as SplitRequestBody;
};

/** 등록 본문의 줄 하나 — `excessQty` 는 계약 사본 밖이라 생성 타입에 없다(서버 장부 P-100). */
type SentLine = NonNullable<SplitRequestBody['normal']>['lines'][number] & { excessQty?: number };

const sentLines = (body: SplitRequestBody): SentLine[] => (body.normal?.lines ?? []) as SentLine[];

describe('ReceiptRegisterPanel — 누르기 전에는 쓰기가 없다', () => {
  /*
   * **M22** — 등록 단추를 누르기 전에는 어떤 쓰기도 나가지 않는다.
   * **경로 전체로 센다** — 수량·LOT·머리 입력·스캔·잔량 채우기를 모두 지난 뒤에 판정한다.
   */
  it('창을 열고 입력을 마칠 때까지 어떤 쓰기 요청도 보내지 않는다', async () => {
    const { requests, user } = renderPanel(allRoutes());

    await waitLines();
    await within(lineTable()).findAllByText('합성 품목 가');
    await user.type(screen.getByLabelText(t.scan.label), `${LABEL_9301}{Enter}`);
    await user.click(screen.getByRole('button', { name: t.actions.fillRemaining }));
    await user.clear(screen.getByLabelText(t.fields.receiptDatetime));
    await user.type(screen.getByLabelText(t.fields.receiptDatetime), RECEIPT_DATETIME);
    await user.type(screen.getByLabelText(`${t.fields.remarks} ${t.form.optional}`), '합성 비고');

    // 짝 방향 — 실제로 요청이 여럿 나갔다(아무것도 안 부르고 통과하지 않게 한다).
    expect(requests.length).toBeGreaterThan(4);
    expect(requests.every((request) => request.method === 'GET')).toBe(true);
    expect(splitRequests(requests)).toHaveLength(0);
  });
});

describe('ReceiptRegisterPanel — 등록 본문', () => {
  /*
   * **전표는 늘 한 건이다**(서버 장부 P-100). 초과 몫이 있어도 초과분 part 를 만들지 않는다 —
   * 갈래는 늘 `NORMAL_ONLY` 다.
   */
  it('초과 몫이 있어도 정량분 part 하나만 NORMAL_ONLY 로 보낸다', async () => {
    const { requests, user } = renderPanel(allRoutes());

    await setupRegister(user);
    await clickRegister(user);

    await waitFor(() => {
      expect(splitRequests(requests)).toHaveLength(1);
    });

    const body = lastSplitBody(requests);

    expect(body.mode).toBe('NORMAL_ONLY');
    expect(Object.keys(body)).not.toContain('excess');
  });

  /*
   * 9401은 잔량 60 · 허용 5라 한도가 65다 — 66은 **줄 하나 · LOT 하나**로 받고 그중 1을 초과 몫으로 싣는다.
   * 서버가 P/O 라인에는 `receivedQty − excessQty`(65)만 더한다.
   */
  it('한 줄에 도착 수량 전체와 초과 몫, 라벨 하나를 싣는다', async () => {
    const { requests, user } = renderPanel(allRoutes());

    await setupRegister(user);
    await clickRegister(user);

    await waitFor(() => {
      expect(splitRequests(requests)).toHaveLength(1);
    });

    expect(sentLines(lastSplitBody(requests))).toEqual([
      {
        purchaseOrderLineId: 9401,
        itemId: 9301,
        receivedQty: 66,
        uomId: 9501,
        excessQty: 1,
        supplierLotNo: labelFor(1),
        supplierLotMissing: false,
      },
    ]);
  });

  /* 「-OVER」 파생 번호나 「라벨 없음」 우회 없이 사람이 넣은 라벨 그대로다. */
  it('초과 몫이 있어도 LOT 을 파생하거나 라벨 없음으로 바꾸지 않는다', async () => {
    const { requests, user } = renderPanel(allRoutes());

    await setupRegister(user);
    await clickRegister(user);

    await waitFor(() => {
      expect(splitRequests(requests)).toHaveLength(1);
    });

    const [line] = sentLines(lastSplitBody(requests));

    expect(line?.supplierLotNo).toBe(labelFor(1));
    expect(Object.keys(line ?? {})).not.toContain('supplierLotLabelAttached');
    expect(JSON.stringify(lastSplitBody(requests))).not.toContain('-OVER');
  });

  /* 한도 안의 줄에는 `excessQty` 키가 없다 — 「0」을 싣지 않는다. */
  it('한도 안의 줄에는 초과 몫이 실리지 않는다', async () => {
    const { requests, user } = renderPanel(allRoutes());

    await setupRegister(user, { 1: '10' });
    await clickRegister(user);

    await waitFor(() => {
      expect(splitRequests(requests)).toHaveLength(1);
    });

    const [line] = sentLines(lastSplitBody(requests));

    expect(line?.receivedQty).toBe(10);
    expect(Object.keys(line ?? {})).not.toContain('excessQty');
  });

  /* 초과 몫이 있어도 이 전표는 발주에 묶인 정상 입하다 — 예외 유형·사유를 싣지 않는다. */
  it('머리 값이 실리고 예외 유형·사유는 실리지 않는다', async () => {
    const { requests, user } = renderPanel(allRoutes());

    await setupRegister(user);
    await user.type(
      screen.getByLabelText(`${t.fields.deliveryNoteNo} ${t.form.optional}`),
      'SAMPLE-DN-01',
    );
    await clickRegister(user);

    await waitFor(() => {
      expect(splitRequests(requests)).toHaveLength(1);
    });

    const body = lastSplitBody(requests);

    expect(body.normal?.deliveryNoteNo).toBe('SAMPLE-DN-01');
    /* 공급사·공장은 사용자에게 묻지 않고 발주 상세에서 가져간다. */
    expect(body.normal?.supplierId).toBe(9101);
    expect(body.normal?.plantId).toBe(9201);
    expect(Object.keys(body.normal ?? {})).not.toContain('exceptionTypeCode');
    expect(Object.keys(body.normal ?? {})).not.toContain('exceptionReason');
  });

  /*
   * **C24** — 계약이 「영업일과 발생 시각은 바깥에서 한 번만 받는다」고 적었고,
   * 영업일은 **입하 일시의 날짜**에서 나온다(승인 13-5).
   */
  it('영업일과 발생 시각이 바깥에 한 번만 실린다', async () => {
    const { requests, user } = renderPanel(allRoutes());

    await setupRegister(user);
    await clickRegister(user);

    await waitFor(() => {
      expect(splitRequests(requests)).toHaveLength(1);
    });

    const body = lastSplitBody(requests);

    expect(body.businessDate).toBe('2026-08-06');
    expect(body.occurredAt).toMatch(/[+-]\d{2}:\d{2}$/);
    expect(Object.keys(body.normal ?? {})).not.toContain('businessDate');
    expect(Object.keys(body.normal ?? {})).not.toContain('occurredAt');
  });

  /* 계약이 전 쓰기에 멱등 키를 요구한다. 없으면 서버가 400으로 되돌린다. */
  it('멱등 키를 실어 보낸다', async () => {
    const { requests, user } = renderPanel(allRoutes());

    await setupRegister(user);
    await clickRegister(user);

    await waitFor(() => {
      expect(splitRequests(requests)).toHaveLength(1);
    });

    expect(splitRequests(requests)[0]?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe('ReceiptRegisterPanel — 만들어지는 전표는 늘 한 건이다', () => {
  /* 라인이 하나도 실리지 않으면 보낼 수 없다(계약: 최소 1행) — 단추 하나가 잠기고 사유를 낸다. */
  it('수량을 넣지 않으면 등록 단추가 잠기고 사유를 낸다', async () => {
    const { requests, user } = renderPanel(allRoutes());

    await waitLines();

    expect(screen.getByRole('button', { name: t.actions.register })).toBeDisabled();
    expect(screen.getByText(t.actionReasons.noQty)).toBeInTheDocument();
    expect(screen.getByText(t.totals.none)).toBeInTheDocument();

    await clickRegister(user);

    expect(splitRequests(requests)).toHaveLength(0);
  });

  /* 한도 안쪽만 있으면 초과 안내가 없다 — 확인 창에도 고를 것이 없다. */
  it('초과 몫이 없으면 전표 한 건 요약만 서고 확인 창에 고를 것이 없다', async () => {
    const { requests, user } = renderPanel(allRoutes());

    await setupRegister(user, { 1: '10' });

    expect(screen.getByText(t.totals.receipt(1))).toBeInTheDocument();
    expect(screen.queryByText(t.totals.excess(1))).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.register }));

    const dialog = await screen.findByRole('dialog', { name: t.dialog.registerTitle });

    expect(within(dialog).getByText(t.dialog.registerLead(1, 0))).toBeInTheDocument();
    expect(within(dialog).queryAllByRole('checkbox')).toHaveLength(0);

    await user.click(within(dialog).getByRole('button', { name: t.actions.confirmRegister }));

    await waitFor(() => {
      expect(lastSplitBody(requests).mode).toBe('NORMAL_ONLY');
    });
  });

  /* 초과 몫이 있으면 요약과 확인 창이 그 사실을 말한다 — 그래도 전표는 한 건이다. */
  it('초과 몫이 있으면 요약과 확인 창이 그 줄을 밝힌다', async () => {
    const { user } = renderPanel(allRoutes());

    await setupRegister(user);

    expect(screen.getByText(t.totals.receipt(1))).toBeInTheDocument();
    expect(screen.getByText(t.totals.excess(1))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.register }));

    const dialog = await screen.findByRole('dialog', { name: t.dialog.registerTitle });

    expect(within(dialog).getByText(t.dialog.registerLead(1, 1))).toBeInTheDocument();
    expect(within(dialog).getByText(t.dialog.excessOf('65', '1'))).toBeInTheDocument();
    expect(within(dialog).queryAllByRole('checkbox')).toHaveLength(0);
  });

  /*
   * 다 받은 줄(9402 — 한도 0)에 넣은 수량은 전부 초과 몫이라 서버가 받지 않는다. 보내기 전에 막고
   * 그 줄을 짚는다 — 「초과분만 전표」는 더 이상 없다.
   */
  it('다 받은 줄에 수량을 넣었으면 보내지 않고 그 줄을 짚는다', async () => {
    const { requests, user } = renderPanel(allRoutes());

    await setupRegister(user, { 2: '12' });
    await clickRegister(user);

    expect(await screen.findByText(t.errors.lineInvalidBlocked('2'))).toBeInTheDocument();
    expect(confirmDialog()).not.toBeInTheDocument();
    expect(splitRequests(requests)).toHaveLength(0);
  });
});

describe('ReceiptRegisterPanel — 머리 입력과 수량을 고치기 전에는 보내지 않는다', () => {
  /* 계약 필수인데 입력칸이 있는 유일한 값이다. 비면 전표의 입하 일시를 만들 수 없다. */
  it('입하 일시가 비면 인라인 오류를 내고 보내지 않는다', async () => {
    const { requests, user } = renderPanel(allRoutes());

    await waitLines();
    await user.type(qtyInput(1), '66');
    /* 공장 현지 지금이 미리 들어 있다 — 비워야 「비면」이 된다. */
    await user.clear(screen.getByLabelText(t.fields.receiptDatetime));

    await clickRegister(user);

    expect(await screen.findByText(t.errors.receiptDatetimeRequired)).toBeInTheDocument();
    expect(splitRequests(requests)).toHaveLength(0);
  });

  /*
   * **C26** — 계약이 100자로 정했다. 붙여넣기로 들어오는 값이라 `user.paste`로 만든다 —
   * 이 칸에 `maxLength`를 두지 않은 이유가 바로 그것이다(조용히 자르면 다른 번호가 실린다).
   */
  it('거래명세서번호 101자는 인라인 오류이고 요청이 나가지 않는다', async () => {
    const { requests, user } = renderPanel(allRoutes());

    await setupRegister(user);
    await user.click(screen.getByLabelText(`${t.fields.deliveryNoteNo} ${t.form.optional}`));
    await user.paste('A'.repeat(101));

    await clickRegister(user);

    expect(
      await screen.findByText(t.errors.deliveryNoteNoTooLong(DELIVERY_NOTE_NO_MAX)),
    ).toBeInTheDocument();
    expect(splitRequests(requests)).toHaveLength(0);
  });

  /* 짝 방향 — 100자는 통과한다. 경계 한쪽만 보면 부등호 방향이 남는다. */
  it('거래명세서번호 100자는 그대로 나간다', async () => {
    const { requests, user } = renderPanel(allRoutes());

    await setupRegister(user);
    await user.click(screen.getByLabelText(`${t.fields.deliveryNoteNo} ${t.form.optional}`));
    await user.paste('A'.repeat(100));

    await clickRegister(user);

    await waitFor(() => {
      expect(splitRequests(requests)).toHaveLength(1);
    });

    expect(lastSplitBody(requests).normal?.deliveryNoteNo).toBe('A'.repeat(100));
  });

  /*
   * 사유가 붙은 줄을 그대로 두고 보내면 **그 줄만 빠진 전표**가 만들어진다 —
   * 되돌릴 수 없는 쓰기라 빠뜨린 줄을 나중에 알아채도 창이 고칠 수 없다.
   */
  it('고치지 않은 수량이 남아 있으면 보내지 않고 사유를 낸다', async () => {
    const { requests, user } = renderPanel(allRoutes());

    /* `0`은 계약이 막는 값이다(`exclusiveMinimum: 0`). */
    await setupRegister(user, { 1: '66', 2: '0' });

    /* 짝 방향 — 1번 줄이 갈려 있어 단추 자체는 열려 있다. */
    expect(screen.getByRole('button', { name: t.actions.register })).toBeEnabled();

    await clickRegister(user);

    expect(await screen.findByText(t.errors.lineInvalidBlocked('2'))).toBeInTheDocument();
    expect(splitRequests(requests)).toHaveLength(0);
  });

  /* 고치면 안내가 사라진다 — 남아 있으면 무엇이 아직 막혔는지 알 수 없다. */
  it('수량을 고치면 막았다는 안내가 사라진다', async () => {
    const { user } = renderPanel(allRoutes());

    await setupRegister(user, { 1: '66', 2: '0' });
    await clickRegister(user);

    expect(await screen.findByText(t.errors.lineInvalidBlocked('2'))).toBeInTheDocument();

    await user.clear(qtyInput(2));

    await waitFor(() => {
      expect(screen.queryByText(t.errors.lineInvalidBlocked('2'))).not.toBeInTheDocument();
    });
  });
});

describe('ReceiptRegisterPanel — 전송 중', () => {
  /*
   * **M37 · C27** — 공통 쓰기 훅이 호출마다 새 멱등 키를 만들어 연타가 그대로 전표 두 벌이
   * 된다. 서버가 재전송으로 보지 못하므로 **창이 두 번째 요청 자체를 막아야** 한다.
   */
  it('전송 중에는 연타해도 요청이 1회다', async () => {
    const { requests, release, user } = renderPanel(allRoutes(), [SPLIT_PATH]);

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

  it('전송 중에는 등록과 취소가 모두 잠긴다', async () => {
    const { requests, release, user } = renderPanel(allRoutes(), [SPLIT_PATH]);

    await setupRegister(user);
    await clickRegister(user);

    await waitFor(() => {
      expect(splitRequests(requests)).toHaveLength(1);
    });

    expect(screen.getByRole('button', { name: t.actions.register })).toBeDisabled();
    expect(screen.getByRole('button', { name: messages.common.cancel })).toBeDisabled();

    release();
  });

  /*
   * **보내는 중에는 창을 닫지 못한다.** 닫히면 결과를 받을 자리가 사라져, 전표가 만들어졌는지
   * 사용자가 알 수 없다 — 되돌릴 수 없는 쓰기에서 가장 비싼 혼선이다. 머리 ×와 Esc 둘 다 본다.
   */
  it('전송 중에는 머리 ×·Esc 로도 창이 닫히지 않는다', async () => {
    const { onClose, requests, release, user } = renderPanel(allRoutes(), [SPLIT_PATH]);

    await setupRegister(user);
    await clickRegister(user);

    await waitFor(() => {
      expect(splitRequests(requests)).toHaveLength(1);
    });

    await user.click(within(panel()).getByRole('button', { name: messages.common.close }));
    fireEvent(panel(), new Event('cancel', { cancelable: true }));

    expect(onClose).not.toHaveBeenCalled();
    /* 버릴지도 묻지 않는다 — 보내는 중에는 닫는 길 자체가 없다. */
    expect(screen.queryByRole('dialog', { name: t.dialog.discardTitle })).not.toBeInTheDocument();

    release();

    /* 짝 방향 — 응답이 오면 결과가 그 창에 선다. */
    expect(await screen.findByText(t.result.count(1))).toBeInTheDocument();
  });
});

describe('ReceiptRegisterPanel — 등록 성공', () => {
  /* 만들어질 전표를 스텁 한 벌에 실어 넘긴다 — 같은 경로 규칙을 두 벌 두지 않는다. */
  const renderSuccess = (created: unknown[] = CREATED_ONE) => renderPanel(allRoutes(created));

  /* **M42의 창 몫** — 나중에 조회할 업무 번호와 건수가 결과 자리에 남는다. */
  it('만들어진 전표 번호와 건수가 보인다', async () => {
    const { user } = renderSuccess();

    await setupRegister(user);
    await clickRegister(user);

    expect(await screen.findByText(t.result.count(1))).toBeInTheDocument();
    expect(screen.getByText('IR-2026-900010')).toBeInTheDocument();
  });

  /*
   * **M40의 창 몫 · C29** — 응답에는 내부 번호가 들어 있는데 창 어디에도 나오지 않는다.
   * 짝 방향(전표 번호는 보인다)을 선행으로 둔다.
   */
  it('성공 표시에 내부 번호가 없다', async () => {
    const { user } = renderSuccess();

    await setupRegister(user);
    await clickRegister(user);

    await screen.findByText('IR-2026-900010');

    const result = screen.getByRole('status', { name: t.panes.result });

    for (const id of ['9601', '9101', '9201', '9401']) {
      expect(result.textContent ?? '').not.toContain(id);
    }
  });

  /*
   * **M38** — 초안을 비우는 것은 **이중 제출 완화의 한 층**이다.
   * 비우지 않으면 성공한 뒤에도 같은 수량이 남아 한 번 더 보낼 수 있다.
   * 창은 **열린 채다** — 등록 결과를 그 자리에서 확인해야 한다.
   */
  it('성공하면 초안이 비고 창은 열린 채다', async () => {
    const { onClose, user } = renderSuccess();

    await setupRegister(user);

    /* 짝 방향 — 실제로 값이 들어가 있다. */
    expect(qtyInput(1)).toHaveValue(66);
    expect(screen.getByLabelText(t.fields.receiptDatetime)).toHaveValue(RECEIPT_DATETIME);

    await clickRegister(user);
    await screen.findByText(t.result.count(1));

    await waitFor(() => {
      expect(qtyInput(1)).toHaveValue(null);
    });

    /* 머리는 기본값으로 돌아간다 — 입하 일시는 공장 현지 지금이라 친 값과 다르다. */
    expect(screen.getByLabelText(t.fields.receiptDatetime)).not.toHaveValue(RECEIPT_DATETIME);
    /* 초안이 비면 LOT 줄도 접힌다. */
    expect(screen.queryByLabelText(t.lineTable.lotNoLabel(1))).not.toBeInTheDocument();
    expect(panel()).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  /*
   * **M39** — 등록 뒤 같은 발주의 누적 입하가 늘었다. 다시 부르지 않으면
   * 창이 **등록 전 숫자**를 그대로 보이면서 「P/O 반영 · 초과분」을 그 값으로 계산한다.
   */
  it('성공하면 발주 상세를 다시 부른다', async () => {
    const { requests, user } = renderSuccess();

    await setupRegister(user);

    const before = requestsTo(requests, DETAIL_PATH).length;

    await clickRegister(user);
    await screen.findByText(t.result.count(1));

    await waitFor(() => {
      expect(requestsTo(requests, DETAIL_PATH).length).toBeGreaterThan(before);
    });
  });

  /*
   * 창을 연 화면의 표(입하 예정의 받은 수량·진행, 초과분 목록)도 바뀌었다 — 부르는 쪽이 준 키를
   * 함께 걷어야 창을 닫았을 때 그 표가 등록 전 숫자로 남지 않는다.
   */
  it('성공하면 창을 연 화면이 준 키도 다시 읽게 한다', async () => {
    const { queryClient, user } = renderSuccess();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    await setupRegister(user);

    /* 짝 방향 — 누르기 전에는 걷지 않는다. */
    expect(invalidate).not.toHaveBeenCalledWith(expect.objectContaining({ queryKey: BOARD_KEY }));

    await clickRegister(user);
    await screen.findByText(t.result.count(1));

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: BOARD_KEY }));
    });
  });
});

describe('ReceiptRegisterPanel — 등록 실패 3갈래', () => {
  const renderFailing = (route: StubRoute) => renderPanel([route, ...allRoutes()]);

  const VALIDATION_BODY = {
    errors: [
      { scope: 'field', field: 'deliveryNoteNo', code: 'INVALID', message: '합성 서버 문구' },
    ],
  };

  /* **M43** — 실패했는데 입력을 지우면 사용자가 처음부터 다시 친다. */
  it('검증 실패는 서버 문구를 내고 입력이 남는다', async () => {
    const { user } = renderFailing(failingSplitRoute(400, VALIDATION_BODY));

    await setupRegister(user);
    await clickRegister(user);

    expect(await screen.findByText('합성 서버 문구')).toBeInTheDocument();
    expect(qtyInput(1)).toHaveValue(66);
    expect(screen.getByLabelText(t.fields.receiptDatetime)).toHaveValue(RECEIPT_DATETIME);
  });

  /**
   * **서버 필드 오류는 그 칸에 붙는다.**
   *
   * 「문구가 창 어딘가에 있다」만 보면 창이 아는 필드 목록(`knownFields`)이 끊겨
   * 같은 문구가 통째로 **배너로** 옮겨 가도 통과한다. 배너는 「무엇을 고쳐야 하는지」를 가리키지 못한다.
   */
  it('서버가 준 필드 오류가 그 입력칸에 붙는다', async () => {
    const { user } = renderFailing(failingSplitRoute(400, VALIDATION_BODY));

    await setupRegister(user);
    await clickRegister(user);

    await screen.findByText('합성 서버 문구');

    const field = screen.getByLabelText(`${t.fields.deliveryNoteNo} ${t.form.optional}`);

    expect(field).toHaveAccessibleDescription(/합성 서버 문구/);
    expect(field).toHaveAttribute('aria-invalid', 'true');
  });

  /* 짝 방향 — **인라인으로 소화한 오류는 배너로 두 번 나오지 않는다.** */
  it('인라인으로 소화한 오류는 배너에 나오지 않는다', async () => {
    const { user } = renderFailing(failingSplitRoute(400, VALIDATION_BODY));

    await setupRegister(user);
    await clickRegister(user);

    await screen.findByText('합성 서버 문구');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  /*
   * 짝 방향 — **창이 모르는 필드는 배너로 올라간다.** 인라인으로 낼 자리를 고를 수 없어
   * 삼키면 어디에도 보이지 않는 오류가 된다.
   */
  it('창이 모르는 필드의 오류는 배너로 올라간다', async () => {
    const { user } = renderFailing(
      failingSplitRoute(400, {
        errors: [
          {
            scope: 'field',
            field: 'lines[0].receivedQty',
            code: 'INVALID',
            message: '합성 라인 문구',
          },
        ],
      }),
    );

    await setupRegister(user);
    await clickRegister(user);

    const banner = await screen.findByRole('alert');

    expect(banner).toHaveTextContent('합성 라인 문구');
    expect(
      screen.getByLabelText(`${t.fields.deliveryNoteNo} ${t.form.optional}`),
    ).not.toHaveAttribute('aria-invalid', 'true');
  });

  /* **고치면 걷힌다.** 남아 있으면 방금 고친 값이 여전히 잘못된 것으로 읽힌다. */
  it('그 칸을 다시 치면 서버가 준 오류가 걷힌다', async () => {
    const { user } = renderFailing(failingSplitRoute(400, VALIDATION_BODY));

    await setupRegister(user);
    await clickRegister(user);

    await screen.findByText('합성 서버 문구');

    await user.type(screen.getByLabelText(`${t.fields.deliveryNoteNo} ${t.form.optional}`), 'A');

    await waitFor(() => {
      expect(screen.queryByText('합성 서버 문구')).not.toBeInTheDocument();
    });

    expect(
      screen.getByLabelText(`${t.fields.deliveryNoteNo} ${t.form.optional}`),
    ).not.toHaveAttribute('aria-invalid', 'true');
  });

  /* 짝 방향 — **다른 칸을 고치는 것으로는 걷히지 않는다.** */
  it('다른 칸을 고쳐도 그 오류는 남는다', async () => {
    const { user } = renderFailing(failingSplitRoute(400, VALIDATION_BODY));

    await setupRegister(user);
    await clickRegister(user);

    await screen.findByText('합성 서버 문구');

    await user.type(screen.getByLabelText(`${t.fields.remarks} ${t.form.optional}`), '합성 비고');

    expect(screen.getByText('합성 서버 문구')).toBeInTheDocument();
  });

  /* **M46** — 권한 없음은 다시 시도해도 풀리지 않는다. 재시도 수단을 내면 같은 실패를 되풀이한다. */
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
    const { user } = renderPanel([
      {
        match: isSplitPost,
        respond: () =>
          shouldFail
            ? jsonResponse(VALIDATION_BODY, { status: 400 })
            : jsonResponse({ created: CREATED_ONE }, { status: 201 }),
      },
      ...allRoutes(),
    ]);

    await setupRegister(user);
    await clickRegister(user);
    await screen.findByText(t.result.count(1));

    shouldFail = true;

    /* 성공으로 초안이 비었으니 다시 채운다 — 창은 그대로다. */
    await fillDraft(user);
    await clickRegister(user);

    await screen.findByText('합성 서버 문구');

    expect(screen.queryByRole('status', { name: t.panes.result })).not.toBeInTheDocument();
    expect(screen.queryByText('IR-2026-900010')).not.toBeInTheDocument();
  });
});

describe('ReceiptRegisterPanel — 닫기와 초안 파기 확인', () => {
  /*
   * **M47** — 이 창의 「취소」는 저장 전 닫기다. 계약의 입하 취소는 승인을 타며
   * 이 창이 부를 수 있는 것이 아니다.
   *
   * **요청 수 자체를 센다.** 「쓰기가 나가지 않았다」만 보면 닫는 길에 붙인 조회가
   * 그대로 통과한다 — 닫기는 **아무것도 부르지 않는다.**
   */
  it('버릴 것이 없으면 「취소」가 곧바로 닫고 어떤 요청도 보내지 않는다', async () => {
    const { onClose, requests, user } = renderPanel(allRoutes());

    await waitLines();

    /* 짝 방향 — 여기까지 실제로 요청이 여럿 나갔다. */
    expect(requests.length).toBeGreaterThan(3);

    const before = requests.length;

    await user.click(screen.getByRole('button', { name: messages.common.cancel }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: t.dialog.discardTitle })).not.toBeInTheDocument();
    expect(requests.slice(before)).toHaveLength(0);
  });

  /* 머리 ×도 같은 길이다 — 버릴 것이 없으면 묻지 않는다. 늘 물으면 사용자가 읽지 않고 누른다. */
  it('버릴 것이 없으면 머리 ×도 묻지 않고 닫는다', async () => {
    const { onClose, user } = renderPanel(allRoutes());

    await waitLines();
    await user.click(within(panel()).getByRole('button', { name: messages.common.close }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: t.dialog.discardTitle })).not.toBeInTheDocument();
  });

  /* **C33** — 친 값이 있으면 확인을 받는다. 말없이 사라지면 무엇을 잃었는지도 알 수 없다. */
  it('초안이 있으면 「취소」가 확인 창을 거친다', async () => {
    const { onClose, requests, user } = renderPanel(allRoutes());

    await setupRegister(user);
    await user.click(screen.getByRole('button', { name: messages.common.cancel }));

    /* 아직 아무것도 잃지 않았다 — 창이 뜬 것만으로 닫히면 확인의 뜻이 없다. */
    expect(screen.getByRole('dialog', { name: t.dialog.discardTitle })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(qtyInput(1)).toHaveValue(66);

    await user.click(screen.getByRole('button', { name: t.actions.discardDraft }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(splitRequests(requests)).toHaveLength(0);
  });

  /* Esc(디자인 시스템 창의 `cancel`)도 같은 길을 탄다 — 초안이 있으면 묻는다. */
  it('초안이 있으면 Esc 도 확인 창을 거친다', async () => {
    const { onClose, user } = renderPanel(allRoutes());

    await setupRegister(user);
    fireEvent(panel(), new Event('cancel', { cancelable: true }));

    expect(await screen.findByRole('dialog', { name: t.dialog.discardTitle })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('계속 입력을 누르면 아무것도 잃지 않는다', async () => {
    const { onClose, user } = renderPanel(allRoutes());

    await setupRegister(user);
    await user.click(screen.getByRole('button', { name: messages.common.cancel }));
    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: t.dialog.discardTitle })).not.toBeInTheDocument();
    });

    expect(qtyInput(1)).toHaveValue(66);
    expect(screen.getByLabelText(t.fields.receiptDatetime)).toHaveValue(RECEIPT_DATETIME);
    expect(onClose).not.toHaveBeenCalled();
  });

  /* 머리 입력만 채워도 버릴 것이 있다 — 라인 수량만 보면 나머지가 말없이 사라진다. */
  it('머리 입력만 채워도 확인을 받는다', async () => {
    const { onClose, user } = renderPanel(allRoutes());

    await waitLines();
    await user.type(screen.getByLabelText(`${t.fields.remarks} ${t.form.optional}`), '합성 비고');

    await user.click(screen.getByRole('button', { name: messages.common.cancel }));

    expect(screen.getByRole('dialog', { name: t.dialog.discardTitle })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  /*
   * **사라진 줄의 초안은 함께 사라진다**(초안은 상세 응답의 라인으로 새로 만든다).
   *
   * 초안은 특정 줄에 묶여 있다. 그 줄이 없어졌는데 값이 남으면 **창에 보이지 않는 값** 때문에
   * 확인 창이 뜬다 — 사용자는 무엇을 버리라는 것인지 알 수 없고, 그 값은 어디에도 실리지 않는다.
   */
  it('라인 목록이 달라져 줄이 사라지면 그 줄의 초안도 사라진다', async () => {
    const { onClose, queryClient, user } = renderPanel([
      shrinkingDetailRoute(),
      splitRoute(),
      ...lookupRoutes(),
    ]);

    await waitLines();
    await user.type(qtyInput(1), '66');

    /* 짝 방향 — 실제로 값이 들어가 있다. */
    expect(qtyInput(1)).toHaveValue(66);

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: poKeys.detail(PO_ID) });
    });

    /* 1번 줄이 사라졌다 — 남은 줄만 보인다. */
    await waitFor(() => {
      expect(screen.queryByLabelText(t.lineTable.arrivedQtyLabel(1))).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: messages.common.cancel }));

    expect(screen.queryByRole('dialog', { name: t.dialog.discardTitle })).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  /* **M36의 창 몫 · C34** — 창 안 선택 목록이 잘리는 결함이 걸릴 자리를 만들지 않는다. */
  it('확인 창에 선택칸이 없다', async () => {
    const { user } = renderPanel(allRoutes());

    await setupRegister(user);
    await user.click(screen.getByRole('button', { name: messages.common.cancel }));

    const dialog = screen.getByRole('dialog', { name: t.dialog.discardTitle });

    expect(within(dialog).getByText(messages.common.discardChangesConfirm)).toBeInTheDocument();
    expect(within(dialog).queryAllByRole('combobox')).toHaveLength(0);
  });
});

/**
 * **초과분 연결로 가는 길** — 초과 몫은 P/O 에 들어가지 않고 ERP 가 만들 추가 발주를 기다린다(서버 장부 P-100).
 * 연결은 같은 「입하 예정 조회」의 연결 창이 한다 — 이 창은 등록 결과에서 그 사실을 밝히고 그리로 가는
 * 단추만 세운다. 어디로 가는지는 부르는 쪽이 정한다(`onOpenExcess`).
 *
 * 등록 전에는 길이 없다 — 연결할 초과분이 아직 없다. 초과 몫을 실은 등록 뒤에만 선다.
 */
describe('ReceiptRegisterPanel — 초과분 연결로 가는 길', () => {
  const resultPane = (): HTMLElement => screen.getByRole('status', { name: t.panes.result });

  /* 한도 안의 등록은 연결할 것이 없다 — 길이 서면 할 일이 남은 것처럼 읽힌다. */
  it('초과 몫이 없는 등록 결과에는 연결 단추가 없다', async () => {
    const { user } = renderPanel(allRoutes());

    expect(screen.queryByRole('button', { name: t.result.goLinkExcess })).not.toBeInTheDocument();

    await setupRegister(user, { 1: '10' });
    await clickRegister(user);

    await screen.findByText(t.result.count(1));

    /* 짝 양성 — 결과 구획은 실제로 섰고 전표번호도 그대로 보인다. */
    expect(within(resultPane()).getByText('IR-2026-900010')).toBeInTheDocument();
    expect(within(resultPane()).queryAllByRole('button')).toHaveLength(0);
  });

  /* 초과 몫을 실었으면 어느 줄에 얼마가 남았는지와 연결할 자리가 결과에 선다. */
  it('초과 몫을 실은 등록 결과에는 그 몫과 연결 단추가 서고, 누르면 방금 만든 전표로 연결 창을 연다', async () => {
    const { onClose, onOpenExcess, user } = renderPanel(allRoutes());

    await setupRegister(user);
    await clickRegister(user);

    await screen.findByText(t.result.count(1));

    expect(
      within(resultPane()).getByText(t.result.excessWaiting(t.result.excessLine(1, '1'))),
    ).toBeInTheDocument();

    await user.click(within(resultPane()).getByRole('button', { name: t.result.goLinkExcess }));

    expect(onOpenExcess).toHaveBeenCalledWith('IR-2026-900010');
    /* 창을 바꾸는 것은 부르는 쪽의 일이다 — 이 창이 따로 닫지 않는다. */
    expect(onClose).not.toHaveBeenCalled();
  });

  /*
   * **실은 초과 몫이 앞 등록에서 눌어붙지 않는다.** 창은 성공한 뒤에도 열려 있으므로 한 창에서
   * 두 번 등록하는 것은 실제 조작이다. 앞의 초과 몫을 매 제출마다 새로 적지 않으면 뒤의 한도 안 등록에
   * 연결 길이 되살아난다. 단추가 섰다가 **사라지는 것**까지 한 시험에서 본다.
   */
  it('초과 몫을 실은 뒤 한도 안으로 다시 등록하면 연결 단추가 사라진다', async () => {
    const { user } = renderPanel(allRoutes());

    await setupRegister(user);
    await clickRegister(user);

    await screen.findByText(t.result.count(1));

    /* 짝 양성 — 첫 등록에서는 길이 실제로 섰다. */
    expect(within(resultPane()).getAllByRole('button')).toHaveLength(1);

    /* 성공하면 초안이 비므로 같은 창에서 다시 채워 넣는다. */
    await fillDraft(user, { 1: '10' });
    await clickRegister(user);

    await waitFor(() => {
      expect(within(resultPane()).queryAllByRole('button')).toHaveLength(0);
    });

    /* 짝 양성 — 둘째 등록의 결과 구획도 실제로 서 있다(「구획이 사라져서 통과」를 막는다). */
    expect(within(resultPane()).getByText('IR-2026-900010')).toBeInTheDocument();
  });

  /* **C36** — 결과 구획 글자에 내부 번호가 없다. 응답에는 들어 있다(`createdReceipt`). */
  it('단추가 선 뒤에도 결과 구획 글자에 내부 번호가 없다', async () => {
    const { user } = renderPanel(allRoutes());

    await setupRegister(user);
    await clickRegister(user);

    await screen.findByText(t.result.count(1));

    /* 짝 양성 — 업무 번호는 실제로 보인다. */
    expect(within(resultPane()).getByText('IR-2026-900010')).toBeInTheDocument();

    for (const id of ['9601', '9101', '9201', '9401']) {
      expect(resultPane().textContent ?? '').not.toContain(id);
    }
  });
});

/**
 * 라벨 스캔 · 등록 확인 · LOT 필수 · 잔량 채우기 — 상용 MES 관점의 보강(2026-10-21).
 */
describe('ReceiptRegisterPanel — 라벨 스캔과 LOT', () => {
  const scanBox = (): HTMLElement => screen.getByLabelText(t.scan.label);

  const openLines = async (): Promise<void> => {
    await waitLines();
    /* 품목 상세가 와야 라벨의 품목코드로 줄을 찾는다. */
    await within(lineTable()).findAllByText('합성 품목 가');
  };

  it('라인이 서면 스캔 칸이 초점을 받고, 라벨을 스캔하면 그 줄의 수량·LOT 이 찬다', async () => {
    const { user } = renderPanel(allRoutes());

    await openLines();

    expect(scanBox()).toHaveFocus();

    await user.type(scanBox(), `${LABEL_9301}{Enter}`);

    expect(qtyInput(1)).toHaveValue(66);
    expect(screen.getByLabelText(t.lineTable.lotNoLabel(1))).toHaveValue(LABEL_9301);
    expect(scanBox()).toHaveValue('');
    expect(screen.getByText(t.scan.added(1, '66'))).toBeInTheDocument();
  });

  /* 줄 하나에 라벨 하나다 — 같은 품목의 빈 줄(9403)을 채운 뒤에는 더 담지 않고 그 사실을 말한다. */
  it('같은 품목의 줄이 모두 LOT 을 가졌으면 다음 라벨은 담지 않는다', async () => {
    const { user } = renderPanel(allRoutes());

    await openLines();
    await user.type(scanBox(), `${LABEL_9301}{Enter}`);
    await user.type(scanBox(), 'SAMPLE-ITEM-01|2|260806|SAMPLE-SUP-01|0002{Enter}');

    expect(screen.getByLabelText(t.lineTable.lotNoLabel(3))).toHaveValue(
      'SAMPLE-ITEM-01|2|260806|SAMPLE-SUP-01|0002',
    );

    await user.type(scanBox(), 'SAMPLE-ITEM-01|5|260806|SAMPLE-SUP-01|0003{Enter}');

    expect(screen.getByText(t.scan.lotFilled(1))).toBeInTheDocument();
    expect(qtyInput(1)).toHaveValue(66);
    expect(screen.getByLabelText(t.lineTable.lotNoLabel(1))).toHaveValue(LABEL_9301);
  });

  it('라벨이 아니면 담지 않고 칸 아래에 사유를 낸다', async () => {
    const { user } = renderPanel(allRoutes());

    await openLines();
    await user.type(scanBox(), 'not-a-label{Enter}');

    expect(screen.getByText(t.scan.invalid)).toBeInTheDocument();
    expect(qtyInput(1)).toHaveValue(null);
  });

  /* 서버가 LOT 번호 없는 줄을 받지 않는다 — 창이 먼저 막고 그 줄을 짚는다. */
  it('수량만 넣고 LOT 을 비우면 등록하지 않고 LOT 칸에 사유가 붙는다', async () => {
    const { requests, user } = renderPanel(allRoutes());

    await openLines();
    await user.type(qtyInput(1), '10');
    await clickRegister(user);

    expect(await screen.findByText(t.errors.lineInvalidBlocked('1'))).toBeInTheDocument();
    expect(screen.getByText(t.errors.lotRequired)).toBeInTheDocument();
    expect(splitRequests(requests)).toHaveLength(0);
  });

  it('「잔량으로 채우기」는 잔량이 남은 빈 줄만 채운다', async () => {
    const { user } = renderPanel(allRoutes());

    await openLines();
    await user.type(qtyInput(3), '8');
    await user.click(screen.getByRole('button', { name: t.actions.fillRemaining }));

    expect(qtyInput(1)).toHaveValue(60);
    /* 9402 는 잔량 0 — 채우지 않는다. 9403 은 이미 친 값이 남는다. */
    expect(qtyInput(2)).toHaveValue(null);
    expect(qtyInput(3)).toHaveValue(8);
  });

  /*
   * 초과 몫이 있어도 예외 유형·초과 사유를 묻지 않는다 — 이 전표는 발주에 묶인 정상 입하이고, 초과 몫은
   * 나중에 추가 발주에 연결한다. 예외 유형 사전도 부르지 않는다.
   */
  it('초과 몫이 있어도 예외 유형·초과 사유 칸이 없고 그 사전을 부르지 않는다', async () => {
    const { requests, user } = renderPanel(allRoutes());

    await openLines();
    await user.type(qtyInput(1), '66');

    expect(screen.queryByRole('combobox', { name: /예외 유형/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/초과 사유/)).not.toBeInTheDocument();
    expect(
      requestsTo(requests, CODE_VALUES_PATH).map((request) =>
        request.url.searchParams.get('codeGroupCode'),
      ),
    ).not.toContain('INBOUND_RECEIPT_EXCEPTION_TYPE');
  });

  /* 라벨 없음을 켜면 대체 사유를 첫 선택지(라벨 없음)로 미리 채운다 — 어차피 하나를 골라야 한다. */
  it('라벨 없음을 켜면 대체 사유가 첫 선택지로 미리 찬다', async () => {
    const { user } = renderPanel(allRoutes());

    await openLines();
    await user.type(qtyInput(1), '66');
    await user.click(screen.getByLabelText(t.lineTable.lotMissingLabel(1)));

    expect(screen.getByRole('combobox', { name: t.lineTable.lotReasonLabel(1) })).toHaveTextContent(
      '라벨 없음',
    );
  });

  /* 라벨 없이 받은 줄도 보낼 수 있다 — 번호 없음 + 대체 사유로 실린다. */
  it('라벨 없음 · 대체 사유로 등록하면 그 모양으로 실린다', async () => {
    const { requests, user } = renderPanel(allRoutes());

    await openLines();
    await user.type(qtyInput(1), '66');
    await markLotMissing(user, 1);
    await user.clear(screen.getByLabelText(t.fields.receiptDatetime));
    await user.type(screen.getByLabelText(t.fields.receiptDatetime), RECEIPT_DATETIME);
    await clickRegister(user);

    await waitFor(() => {
      expect(splitRequests(requests)).toHaveLength(1);
    });

    expect(sentLines(lastSplitBody(requests))[0]).toMatchObject({
      receivedQty: 66,
      excessQty: 1,
      supplierLotMissing: true,
      substituteLotReasonCode: 'OTHER',
    });
  });
});

describe('ReceiptRegisterPanel — 등록 확인 창', () => {
  it('등록 단추는 바로 보내지 않고 무엇이 나가는지 보이는 창을 연다', async () => {
    const { requests, user } = renderPanel(allRoutes());

    await setupRegister(user);
    await user.click(screen.getByRole('button', { name: t.actions.register }));

    const dialog = await screen.findByRole('dialog', { name: t.dialog.registerTitle });

    expect(within(dialog).getByText(t.dialog.registerLead(1, 1))).toBeInTheDocument();
    /* 줄 하나에 LOT 하나 — 파생 번호 없이 넣은 라벨 그대로다. */
    expect(within(dialog).getByText(t.dialog.lotOf(labelFor(1)))).toBeInTheDocument();
    expect(within(dialog).queryByText(/-OVER/)).not.toBeInTheDocument();
    expect(within(dialog).getByText(t.dialog.excessOf('65', '1'))).toBeInTheDocument();
    expect(within(dialog).getByText(t.dialog.registerIrreversible)).toBeInTheDocument();
    expect(splitRequests(requests)).toHaveLength(0);
  });

  it('「돌아가기」는 보내지 않고 입력을 그대로 둔다', async () => {
    const { onClose, requests, user } = renderPanel(allRoutes());

    await setupRegister(user);
    await user.click(screen.getByRole('button', { name: t.actions.register }));
    await user.click(await screen.findByRole('button', { name: t.actions.backToEdit }));

    expect(confirmDialog()).not.toBeInTheDocument();
    expect(splitRequests(requests)).toHaveLength(0);
    expect(qtyInput(1)).toHaveValue(66);
    /* 확인 창만 닫힌다 — 「입하 등록」 창은 그대로다. */
    expect(panel()).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('누르기 전 요약이 전표 한 건의 줄 수와 초과분이 있는 줄 수를 말한다', async () => {
    const { user } = renderPanel(allRoutes());

    await setupRegister(user);

    expect(screen.getByText(t.totals.receipt(1))).toBeInTheDocument();
    expect(screen.getByText(t.totals.excess(1))).toBeInTheDocument();
  });
});

describe('ReceiptRegisterPanel — 단계 안내', () => {
  const hint = (): HTMLElement =>
    within(screen.getByRole('navigation', { name: t.guide.label })).getByText(/./, {
      selector: '.ors-guide-hint',
    });

  /* 창은 발주를 받아 서므로 「발주 선택」은 처음부터 끝난 단계다 — 라인이 서면 곧바로 수량 단계다. */
  it('단계 안내가 창 상태를 따라 수량 → 입하 정보 → 등록으로 간다', async () => {
    const { user } = renderPanel(allRoutes());

    await waitLines();
    expect(hint()).toHaveTextContent(t.guide.hints.lines);

    await user.type(qtyInput(1), '66');
    /* 수량은 들어갔지만 LOT 이 비어 있다 — 아직 수량·LOT 단계다. */
    expect(hint()).toHaveTextContent(t.guide.hints.lines);

    /* 입하 일시를 비워 두면 머리 입력이 모자라다 — 입하 정보 단계. */
    await user.clear(screen.getByLabelText(t.fields.receiptDatetime));
    await user.type(screen.getByLabelText(t.lineTable.lotNoLabel(1)), labelFor(1));
    expect(hint()).toHaveTextContent(t.guide.hints.info);

    /* 초과 몫이 있어도 더 적을 것이 없다 — 입하 일시만 채우면 등록 단계다. */
    await user.type(screen.getByLabelText(t.fields.receiptDatetime), RECEIPT_DATETIME);
    expect(hint()).toHaveTextContent(t.guide.hints.register);
  });

  /* 상세를 기다리는 동안에는 받을 발주가 아직 서지 않았다 — 그 사이만 「발주 선택」 단계다. */
  it('상세가 오기 전에는 발주 단계이고 오면 수량 단계로 넘어간다', async () => {
    const { release } = renderPanel(allRoutes(), [DETAIL_PATH]);

    await screen.findByRole('status', { name: t.loading.lines });
    expect(hint()).toHaveTextContent(t.guide.hints.select);

    release();

    await waitLines();
    expect(hint()).toHaveTextContent(t.guide.hints.lines);
  });

  /* 입하 일시는 공장 현지 지금이 미리 들어 있다 — 수량과 LOT 만 넣으면 곧바로 등록 단계다. */
  it('수량과 LOT 만 넣으면 곧바로 등록 단계다', async () => {
    const { user } = renderPanel(allRoutes());

    await waitLines();
    await user.type(qtyInput(1), '66');
    await user.type(screen.getByLabelText(t.lineTable.lotNoLabel(1)), labelFor(1));

    expect(hint()).toHaveTextContent(t.guide.hints.register);
  });
});
