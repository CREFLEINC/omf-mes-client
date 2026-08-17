import { messages } from '@omf-mes/i18n';
import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useNavigate } from 'react-router';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { pickDate } from '../../test/date-picker';
import {
  businessUnitFixtures,
  inboundReceiptDetailBody,
  inboundReceiptLineFixtures,
  inboundReceiptLineResponse,
  inboundReceiptNoLineFixtures,
  inboundReceiptResponse,
  itemFixtures,
  partnerFixtures,
  plantFixtures,
  purchaseOrderDetailBody,
  purchaseOrderLineResponse,
  uomFixtures,
} from './fixtures';
import { PoRegisterScreen } from './screen';

const t = messages.poRegister;

const ROUTE = '/logistics/po-register';
const RECEIPT_PATH = '/logistics/inbound-receipts/9101';
/** 두 번째 초과분 — **주소로 대상을 바꾸는 갈래**에서만 쓴다(리뷰 R-24 감지기). */
const SECOND_RECEIPT_PATH = '/logistics/inbound-receipts/9102';
const PARTNERS_PATH = '/mdm/partners';
const BUSINESS_UNITS_PATH = '/mdm/business-units';
const PLANTS_PATH = '/mdm/plants';
const ITEMS_PATH = '/mdm/items';
const UOMS_PATH = '/mdm/uoms';

/**
 * 발주 쪽 경로 셋.
 *
 * **등록과 목록이 같은 경로를 쓴다** — 갈리는 것은 메서드다. 그래서 「목록을 부르지 않는다」는
 * `GET`으로만 세고, 등록은 `POST`로 센다. 상세(`…/9001`)는 **상신의 잠금 토큰이 나오는 자리**라
 * 목록과 다른 경로이고, 상신은 액션 경로다(계획 결정 10).
 *
 * 결재 진행(`/app/approval-requests`)은 이 화면이 **부르지 않는다는 것을 증명하려고** 두는
 * 경로다 — 스텁을 두지 않으면 하네스가 던져 「부르지 않았다」와 「불렀는데 실패했다」가
 * 구분되지 않는다(계획 결정 11).
 */
const PO_COLLECTION_PATH = '/logistics/purchase-orders';
const PO_DETAIL_PATH = '/logistics/purchase-orders/9001';
const APPROVAL_PATH = '/app/approval-requests';
const SUBMIT_PATH = '/logistics/purchase-orders/9001:request-approval';

/**
 * **등록 201과 상세 200이 서로 다른 토큰을 준다**(둘 다 계약이 `ETag`를 내린다).
 *
 * 두 값을 같게 두면 상신이 어느 경로의 토큰을 실었는지 가릴 수 없다 — 컬렉션 경로에 잘못
 * 앉힌 배선이 「우연히 맞는」 값으로 통과한다(계획 §5.2.1의 함정 · 뮤테이션 M-3).
 */
const CREATE_ETAG = 'W/"po-9001-create"';
const DETAIL_ETAG = 'W/"po-9001-detail"';
const RELOADED_ETAG = 'W/"po-9001-detail-2"';

const ITEM_LABEL = 'SAMPLE-ITEM-01 · 합성 품목 가';
const SUPPLIER_LABEL = 'SAMPLE-SUP-01 · 합성 공급사 가';

/** 화면 어디에도 나와서는 안 되는 내부 번호(FK). 픽스처의 번호 대역을 그대로 쓴다. */
const INTERNAL_IDS = ['9101', '9111', '9112', '9201', '9301', '9401', '9501', '9601'];

interface RecordedRequest {
  method: string;
  url: URL;
  /**
   * 쓰기 요청의 본문. 읽기에는 `null`이다.
   *
   * **실제로 나간 본문을 본다.** 요청 조립 함수를 단위로 검사하는 것만으로는 「화면이 그 함수를
   * 부르지 않고 다른 값을 보냈다」를 잡을 수 없다.
   */
  body: unknown;
  headers: Headers;
}

/**
 * 요청을 기록하면서 스텁 규칙으로 응답한다.
 *
 * `hold`에 든 경로는 **기록한 뒤에** 붙잡아 둔다 — 「보내는 중에 무엇이 잠기는가」를 재려면
 * 응답이 오기 전 상태가 화면에 남아 있어야 한다.
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

const isPost = (request: Request, pathname: string): boolean =>
  request.method === 'POST' && new URL(request.url).pathname === pathname;

const listBody = (items: unknown[]) => ({
  items,
  page: { page: 1, size: 50, total: items.length },
});

const lookupRoute = (pathname: string, items: unknown[]): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse(listBody(items)),
});

const lookupRoutes = (): StubRoute[] => [
  lookupRoute(PARTNERS_PATH, partnerFixtures),
  lookupRoute(BUSINESS_UNITS_PATH, businessUnitFixtures),
  lookupRoute(PLANTS_PATH, plantFixtures),
  lookupRoute(ITEMS_PATH, itemFixtures),
  lookupRoute(UOMS_PATH, uomFixtures),
];

const failingLookupRoute = (pathname: string): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse({ message: '' }, { status: 500 }),
});

const receiptRoute = (lines = inboundReceiptLineFixtures): StubRoute => ({
  match: (request) => isGet(request, RECEIPT_PATH),
  respond: () => jsonResponse(inboundReceiptDetailBody(lines)),
});

const failingReceiptRoute = (status: number): StubRoute => ({
  match: (request) => isGet(request, RECEIPT_PATH),
  respond: () => jsonResponse({ message: '' }, { status }),
});

/**
 * 부를 수 있게 열어 두는 경로. **0건임을 증명하는 것이 목적이다.**
 *
 * 발주 **목록**은 경로를 정확히 맞춰 연다 — `startsWith`로 두면 상세(`…/9001`)까지 함께
 * 삼켜, 상신이 토큰을 얻으려 부르는 조회가 목록 응답을 받는다.
 */
const forbiddenRoutes = (): StubRoute[] => [
  {
    match: (request) => isGet(request, PO_COLLECTION_PATH),
    respond: () => jsonResponse(listBody([])),
  },
  {
    match: (request) => new URL(request.url).pathname.startsWith(APPROVAL_PATH),
    respond: () => jsonResponse(listBody([])),
  },
];

/**
 * 등록이 성공하는 경로. 응답 본문은 계약과 같은 모양(머리 + 라인)이다.
 *
 * **201도 `ETag`를 준다**(계약) — 그 토큰은 **컬렉션 경로**에 앉으므로 상신이 집어 가면 안 된다.
 */
const createRoute = (body: unknown = purchaseOrderDetailBody()): StubRoute => ({
  match: (request) => isPost(request, PO_COLLECTION_PATH),
  respond: () => jsonResponse(body, { status: 201, headers: { ETag: CREATE_ETAG } }),
});

/** 발주 상세 — **상신의 잠금 토큰이 나오는 유일한 자리**다(계획 결정 10). */
const detailRoute = (etags: string[] = [DETAIL_ETAG]): StubRoute => {
  let call = 0;

  return {
    match: (request) => isGet(request, PO_DETAIL_PATH),
    respond: () => {
      const etag = etags[Math.min(call, etags.length - 1)] ?? DETAIL_ETAG;

      call += 1;

      return jsonResponse(purchaseOrderDetailBody(), { headers: { ETag: etag } });
    },
  };
};

const failingDetailRoute = (status: number): StubRoute => ({
  match: (request) => isGet(request, PO_DETAIL_PATH),
  respond: () => jsonResponse({ message: '' }, { status }),
});

/** 상신 202. **응답에 `ETag`가 없다**(계약 실측) — 다음 쓰기의 토큰이 여기서 나오지 않는다. */
const submitRoute = (): StubRoute => ({
  match: (request) => isPost(request, SUBMIT_PATH),
  respond: () => jsonResponse({ approvalRequestId: 9801 }, { status: 202 }),
});

const failingSubmitRoute = (status: number, body: unknown = { message: '' }): StubRoute => ({
  match: (request) => isPost(request, SUBMIT_PATH),
  respond: () => jsonResponse(body, { status }),
});

/**
 * 처음에는 충돌하고 **다음 시도에서는 통과하는** 상신.
 *
 * 409는 「다시 읽으면 풀린다」는 뜻이라, 그것이 실제로 풀리는지 재려면 두 번째 시도가 달라야
 * 한다 — 늘 실패하는 스텁으로는 「눌러도 영영 안 되는」 화면과 구분되지 않는다.
 */
const conflictThenOkSubmitRoute = (): StubRoute => {
  let call = 0;

  return {
    match: (request) => isPost(request, SUBMIT_PATH),
    respond: () => {
      call += 1;

      return call === 1
        ? jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 })
        : jsonResponse({ approvalRequestId: 9801 }, { status: 202 });
    },
  };
};

/**
 * 두 번째 등록이 **다른 전표**를 되돌려 주는 갈래.
 *
 * 대상이 바뀌면 만들어지는 발주도 다른 전표다 — 같은 번호를 되돌려 주면 「올린 전표인가」를
 * 묻는 판정이 우연히 맞아, 늦게 온 성공이 남의 전표 위에 서는 것을 잴 수 없다.
 */
const createRouteSequence = (): StubRoute => {
  let call = 0;

  return {
    match: (request) => isPost(request, PO_COLLECTION_PATH),
    respond: () => {
      call += 1;

      return jsonResponse(
        call === 1
          ? purchaseOrderDetailBody()
          : purchaseOrderDetailBody({ purchaseOrderId: 9002, purchaseOrderNo: 'SAMPLE-PO-9002' }),
        { status: 201, headers: { ETag: CREATE_ETAG } },
      );
    },
  };
};

/** 두 번째 초과분 전표 — 대상을 바꾸는 갈래를 만드는 값이다. */
const secondReceiptRoute = (): StubRoute => ({
  match: (request) => isGet(request, SECOND_RECEIPT_PATH),
  respond: () =>
    jsonResponse(
      inboundReceiptDetailBody(
        [inboundReceiptLineResponse({ inboundReceiptLineId: 9121, receivedQty: 5 })],
        inboundReceiptResponse({ inboundReceiptId: 9102, inboundReceiptNo: 'SAMPLE-IR-9102' }),
      ),
    ),
});

const failingCreateRoute = (status: number, body: unknown = { message: '' }): StubRoute => ({
  match: (request) => isPost(request, PO_COLLECTION_PATH),
  respond: () => jsonResponse(body, { status }),
});

/** 응답이 오지 않는 갈래 — 요청이 전달됐는지 화면이 알 수 없는 자리다. */
const brokenCreateRoute = (): StubRoute => ({
  match: (request) => isPost(request, PO_COLLECTION_PATH),
  respond: () => {
    throw new TypeError('network down');
  },
});

const allRoutes = (lines = inboundReceiptLineFixtures): StubRoute[] => [
  receiptRoute(lines),
  ...lookupRoutes(),
  ...forbiddenRoutes(),
];

/** 등록까지 성공하는 한 벌. **승계 한 줄** 갈래를 기본으로 쓴다. */
const registerRoutes = (create: StubRoute = createRoute()): StubRoute[] => [
  create,
  ...allRoutes(SINGLE_LINE),
];

/** 한 줄뿐인 입하 — 대상이 자동으로 확정되는 갈래(계획 결정 4). */
const SINGLE_LINE = [inboundReceiptLineResponse()];

/** 주소가 실제로 어떻게 바뀌는지 본다 — 선택이 주소에 실리는지 판정할 유일한 근거다. */
const LocationProbe = () => {
  const location = useLocation();

  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

/**
 * 주소로 **대상 전표를 바꾼다**.
 *
 * 화면 안에는 `receipt`를 바꾸는 조작이 없고 라우트도 아직 닫혀 있지만, **주소는 잠글 수
 * 없다**(뒤로·앞으로·주소 편집 · 전례가 이름 붙인 자리) — 나가는 중인 쓰기가 그 뒤에 응답을
 * 되돌리는 길이 여기서 열린다.
 */
const TargetSwitchProbe = () => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => {
        void navigate(`${ROUTE}?receipt=9102`);
      }}
    >
      대상 바꾸기
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
  search = '?receipt=9101',
  hold: string[] = [],
): {
  requests: RecordedRequest[];
  release: () => void;
  user: ReturnType<typeof userEvent.setup>;
  /** 재조회를 실제로 일으키는 유일한 수단. 앱에서는 연결 복구가 그 자리다(아래 R-5 감지기) */
  queryClient: QueryClient;
} => {
  const { fetch, requests, release } = createRecordingFetch(routes, hold);

  const { queryClient } = renderWithProviders(
    <>
      <PoRegisterScreen />
      <LocationProbe />
      <BackProbe />
      <TargetSwitchProbe />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, release, user: userEvent.setup(), queryClient };
};

const requestsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === pathname);

/** 메서드까지 가려 센다 — 등록과 목록 조회가 같은 경로를 쓴다. */
const getsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.method === 'GET' && request.url.pathname === pathname);

const createRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter(
    (request) => request.method === 'POST' && request.url.pathname === PO_COLLECTION_PATH,
  );

/** 나간 등록 본문. **실제로 나간 것을 본다** — 조립 함수의 단위 시험이 대신하지 못하는 자리다. */
const lastCreateBody = (requests: RecordedRequest[]): Record<string, unknown> =>
  (createRequests(requests).at(-1)?.body ?? {}) as Record<string, unknown>;

const currentLocation = (): string => screen.getByTestId('location').textContent ?? '';

const sourcePane = (): HTMLElement => screen.getByRole('region', { name: t.panes.source });

const linesPane = (): HTMLElement => screen.getByRole('region', { name: t.panes.lines });

const lineRows = (): HTMLElement[] =>
  within(within(linesPane()).getByRole('table')).getAllByRole('row').slice(1);

const qtyInput = (lineNo: number): HTMLElement =>
  screen.getByLabelText(t.lineTable.orderedQtyLabel(lineNo));

const registerButton = (): HTMLElement => screen.getByRole('button', { name: t.actions.register });

const cancelButton = (): HTMLElement => screen.getByRole('button', { name: t.actions.cancel });

const confirmButton = (): HTMLElement =>
  screen.getByRole('button', { name: new RegExp(t.actions.confirmRegister) });

/** 대상 초과분이 선 뒤에 잰다 — 렌더 전에 「없다」를 재면 늘 통과하는 단언이 된다. */
const waitForSource = async (): Promise<void> => {
  await screen.findByText('SAMPLE-IR-9101');
};

/**
 * 보낼 수 있는 상태로 만든다 — **승계로 채워지지 않는 두 칸만 친다.**
 *
 * 공급사·공장은 넘어온 전표에서 승계되고 라인 1행도 승계값으로 서 있으므로, 사용자가 채울 것은
 * 사업부와 발주일뿐이다.
 */
const fillHeader = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await waitFor(() => {
    expect(screen.getByLabelText(t.fields.supplier)).toHaveTextContent(SUPPLIER_LABEL);
  });

  await user.click(screen.getByLabelText(t.fields.businessUnit));
  await user.click(screen.getByRole('option', { name: 'SAMPLE-BU-01 · 합성 사업부 가' }));
  await pickDate(user, screen.getByLabelText(t.fields.orderDate), '2026-08-17');
};

/** 확인 창을 열고 실행까지 누른다. **두 걸음이 갈려 있어야** 창만 열린 상태도 잴 수 있다. */
const openConfirm = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(registerButton());
};

const submitConfirm = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(confirmButton());
};

const setupAndRegister = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await waitForSource();
  await fillHeader(user);
  await openConfirm(user);
  await submitConfirm(user);
};

const resultPane = (): HTMLElement => screen.getByRole('region', { name: t.result.label });

/** 상신까지 갈 수 있는 한 벌 — 상세와 상신 경로가 함께 열린다. */
const approvalRoutes = (
  submit: StubRoute = submitRoute(),
  detail: StubRoute = detailRoute(),
): StubRoute[] => [detail, submit, ...registerRoutes()];

const reasonInput = (): HTMLElement => within(resultPane()).getByLabelText(t.submit.reason);

const requestApprovalButton = (): HTMLElement =>
  within(resultPane()).getByRole('button', { name: t.actions.requestApproval });

const confirmSubmitButton = (): HTMLElement =>
  screen.getByRole('button', { name: new RegExp(t.actions.confirmSubmit) });

/** 사유를 치고 확인 창을 **연다.** 실행은 갈라 둔다 — 창만 열린 상태도 재야 한다. */
const openSubmitConfirm = async (
  user: ReturnType<typeof userEvent.setup>,
  reason = '초과 입하분 정산 발주',
): Promise<void> => {
  await user.type(reasonInput(), reason);
  await user.click(requestApprovalButton());
};

/** 등록을 마치고 상신 확인 창의 실행까지 누른다. */
const registerAndSubmit = async (
  user: ReturnType<typeof userEvent.setup>,
  reason = '초과 입하분 정산 발주',
): Promise<void> => {
  await setupAndRegister(user);
  await screen.findByText(t.result.createdTitle('SAMPLE-PO-9001'));
  await openSubmitConfirm(user, reason);
  await user.click(confirmSubmitButton());
};

const submitRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === SUBMIT_PATH);

/**
 * 결재 진행 조회를 센다 — **여는 잣대와 세는 잣대를 같은 모양으로** 맞춘다(리뷰 R-28).
 *
 * 스텁은 `startsWith`로 열어 두므로 정확 일치로 세면 `…/approval-requests/9801` 같은 하위
 * 경로 호출을 **스텁은 받아 주고 감지기는 세지 못한다.** 이 단언이 계획 결정 11을 지키는
 * 자리라 그 틈을 남기지 않는다.
 */
const approvalRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname.startsWith(APPROVAL_PATH));

describe('W-01-11 신규 P/O 등록 — 진입 맥락(C1)', () => {
  it('맥락이 있으면 입하 상세를 정확히 1회 부르고 전표와 라인을 보인다', async () => {
    const { requests } = renderScreen(allRoutes());

    await waitForSource();

    expect(requestsTo(requests, RECEIPT_PATH)).toHaveLength(1);
    expect(within(sourcePane()).getByText('SAMPLE_IR_STATUS_A')).toBeInTheDocument();
    expect(within(within(sourcePane()).getByRole('table')).getAllByRole('row')).toHaveLength(3);
  });

  it('품목·단위 이름을 참조 조회로 푼다 — 번호를 대신 내지 않는다', async () => {
    renderScreen(allRoutes());

    await waitForSource();

    await waitFor(() => {
      expect(within(sourcePane()).getByText(ITEM_LABEL)).toBeInTheDocument();
    });
    expect(within(sourcePane()).queryByText('9501')).not.toBeInTheDocument();
  });

  it('사람이 읽는 자리에 내부 번호가 새지 않는다', async () => {
    renderScreen(allRoutes());

    await waitForSource();

    /*
     * **업무 번호는 세지 않는다.** 입하번호(`SAMPLE-IR-9101`)는 사용자가 나중에 이 전표를 찾는
     * 값이라 보이는 것이 맞고, 그 글자 안에 전표 번호와 같은 숫자가 들어 있다.
     * 여기서 세는 것은 **업무 번호 밖에서** 내부 번호가 글자로 나타나는가다.
     */
    const text = (sourcePane().textContent ?? '').split('SAMPLE-IR-9101').join('');

    for (const id of INTERNAL_IDS) expect(text).not.toContain(id);
  });
});

describe('승계(C2)', () => {
  it('라인이 한 줄이면 대상이 확정되고 발주 라인 1행이 승계된 값으로 선다', async () => {
    renderScreen(allRoutes(SINGLE_LINE));

    await waitForSource();

    expect(within(sourcePane()).getByText(t.source.singleLineNote)).toBeInTheDocument();
    expect(lineRows()).toHaveLength(1);
    expect(qtyInput(1)).toHaveValue(12);
    await waitFor(() => {
      expect(within(linesPane()).getByText(ITEM_LABEL)).toBeInTheDocument();
    });
  });

  it('한 줄뿐이면 고르는 버튼을 두지 않는다 — 고를 것이 없다', async () => {
    renderScreen(allRoutes(SINGLE_LINE));

    await waitForSource();

    expect(within(sourcePane()).getByText(t.source.chosen)).toBeInTheDocument();
    expect(
      within(sourcePane()).queryByRole('button', { name: t.source.chooseRow(1) }),
    ).not.toBeInTheDocument();
  });
});

describe('대상 선택(C3·C4)', () => {
  it('라인이 두 줄이면 고르기 전에는 등록이 잠기고 사유가 보인다', async () => {
    renderScreen(allRoutes());

    await waitForSource();

    expect(registerButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.sourceLineNotChosen)).toBeInTheDocument();
    expect(within(linesPane()).queryByRole('table')).not.toBeInTheDocument();
  });

  it('대상을 고르면 주소에 실리고 그 줄이 발주 라인으로 승계된다', async () => {
    const { user } = renderScreen(allRoutes());

    await waitForSource();
    await user.click(screen.getByRole('button', { name: t.source.chooseRow(2) }));

    expect(currentLocation()).toBe(`${ROUTE}?receipt=9101&line=9112`);
    expect(qtyInput(1)).toHaveValue(4);
  });

  it('선택은 뒤로가기 기록을 늘리지 않는다(사본 체크리스트 1번)', async () => {
    const { user } = renderScreen(allRoutes());

    await waitForSource();
    await user.click(screen.getByRole('button', { name: t.source.chooseRow(1) }));
    await user.click(screen.getByRole('button', { name: t.source.chooseRow(2) }));

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    expect(currentLocation()).toBe(`${ROUTE}?receipt=9101&line=9112`);
  });

  it('주소가 가리키는 줄이 목록에 없으면 고르지 않은 것으로 본다', async () => {
    renderScreen(allRoutes(), '?receipt=9101&line=9999');

    await waitForSource();

    expect(registerButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.sourceLineNotChosen)).toBeInTheDocument();
  });

  /**
   * **고를 줄이 하나도 없는 갈래**(리뷰 R-1).
   *
   * 이 갈래에서 「위 구획에서 줄을 하나 고르세요」라고 말하면 사용자가 **할 수 없는 조치**를
   * 지시하게 된다. 사유·빈 상태 둘 다 0행 전용 문구로 갈리는지 재고, 「고르세요」 문구가
   * 화면 어디에도 없는지 함께 잰다.
   */
  it('라인이 0행이면 「고르세요」가 아니라 승계할 줄이 없다고 말한다', async () => {
    renderScreen(allRoutes(inboundReceiptNoLineFixtures));

    await waitForSource();

    expect(screen.getByText(t.actionReasons.noSourceLines)).toBeInTheDocument();
    expect(registerButton()).toBeDisabled();
    /* 대상 구획의 빈 상태와 발주 라인 구획의 빈 상태가 같은 사실을 말한다. */
    expect(screen.getAllByText(t.empty.noSourceLinesTitle)).toHaveLength(2);
    expect(screen.queryByText(t.actionReasons.sourceLineNotChosen)).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.noTargetTitle)).not.toBeInTheDocument();
  });
});

describe('라인 추가·삭제(C5)', () => {
  it('줄을 더할 수 있고 한 줄뿐일 때는 삭제가 잠긴다', async () => {
    const { user } = renderScreen(allRoutes(SINGLE_LINE));

    await waitForSource();

    expect(screen.getByRole('button', { name: t.actions.removeLine(1) })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: t.actions.addLine }));

    expect(lineRows()).toHaveLength(2);
    expect(screen.getByRole('button', { name: t.actions.removeLine(2) })).toBeEnabled();
  });

  /**
   * **가운데 줄을 지워도 뒤 줄의 DOM 노드가 살아남는다**(사본 체크리스트 2번).
   *
   * 행 식별자를 떼면 React key가 인덱스가 되어 뒤 줄의 노드가 대신 지워지고, 그때 친 값이
   * 말없이 다른 줄로 옮겨 붙는다. 포커스가 그 노드에 남는지는 부품 감지기가 잰다 —
   * 여기서는 삭제 버튼을 누르는 조작 자체가 포커스를 가져가므로 값과 노드 동일성을 잰다.
   */
  it('가운데 줄을 지워도 남은 줄의 값이 옮겨 붙지 않는다(사본 체크리스트 2번)', async () => {
    const { user } = renderScreen(allRoutes(SINGLE_LINE));

    await waitForSource();
    await user.click(screen.getByRole('button', { name: t.actions.addLine }));
    await user.click(screen.getByRole('button', { name: t.actions.addLine }));

    await user.type(qtyInput(3), '7');
    const third = qtyInput(3);

    expect(third).toHaveFocus();

    await user.click(screen.getByRole('button', { name: t.actions.removeLine(2) }));

    expect(lineRows()).toHaveLength(2);
    expect(qtyInput(2)).toBe(third);
    expect(qtyInput(2)).toHaveValue(7);
  });
});

describe('발주수량 하한과 경고(C6·C7)', () => {
  it('승계 줄을 승계 수량보다 적게 치면 그 줄에 오류가 붙고 등록이 잠긴다', async () => {
    const { user } = renderScreen(allRoutes(SINGLE_LINE));

    await waitForSource();
    await user.clear(qtyInput(1));
    await user.type(qtyInput(1), '11');

    expect(
      within(lineRows()[0] as HTMLElement).getByText(t.errors.qtyBelowSource(12)),
    ).toBeInTheDocument();
    expect(registerButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.lineInvalid)).toBeInTheDocument();
  });

  it('두 줄이 동시에 오류면 각 줄의 칸이 자기 줄의 오류를 가리킨다(사본 체크리스트 3번)', async () => {
    const { user } = renderScreen(allRoutes(SINGLE_LINE));

    await waitForSource();
    await user.clear(qtyInput(1));
    await user.type(qtyInput(1), '11');
    await user.click(screen.getByRole('button', { name: t.actions.addLine }));
    await user.type(qtyInput(2), '0');

    /* **접근 이름이 아니라 설명을 잰다** — 오류가 자기 줄의 칸에 이어졌는지가 요점이다. */
    expect(qtyInput(1)).toHaveAccessibleDescription(new RegExp(t.errors.qtyBelowSource(12)));
    expect(qtyInput(2)).toHaveAccessibleDescription(new RegExp(t.errors.qtyNotPositive));
  });

  it('초과 허용치가 0보다 크면 경고가 보이되 등록을 막지 않는다', async () => {
    const { user } = renderScreen(allRoutes(SINGLE_LINE));

    await waitForSource();
    await user.clear(screen.getByLabelText(t.lineTable.toleranceOverLabel(1)));
    await user.type(screen.getByLabelText(t.lineTable.toleranceOverLabel(1)), '5');

    expect(screen.getByText(t.warnings.toleranceOverPositive)).toBeInTheDocument();
    expect(screen.queryByText(t.actionReasons.lineInvalid)).not.toBeInTheDocument();
  });
});

describe('맥락 없음과 범위 안내(C8·C9)', () => {
  it('맥락이 없으면 등록이 잠기고 사유가 보이며 입하 상세를 부르지 않는다', async () => {
    const { requests } = renderScreen(allRoutes(), '');

    expect(await screen.findByText(t.empty.noContextTitle)).toBeInTheDocument();
    expect(registerButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.noContext)).toBeInTheDocument();
    expect(requestsTo(requests, RECEIPT_PATH)).toHaveLength(0);
  });

  it('범위 안내는 맥락이 있든 없든 늘 보인다', async () => {
    renderScreen(allRoutes(), '');

    expect(await screen.findByText(t.scope.title)).toBeInTheDocument();
    expect(screen.getByText(t.scope.description)).toBeInTheDocument();
  });

  it('맥락이 있어도 범위 안내가 그대로 선다', async () => {
    renderScreen(allRoutes());

    await waitForSource();

    expect(screen.getByText(t.scope.title)).toBeInTheDocument();
  });
});

describe('이 화면에 두지 않는 것(C10)', () => {
  it('발주 목록·검색·결재 진행이 없다', async () => {
    const { requests } = renderScreen(allRoutes());

    await waitForSource();

    expect(getsTo(requests, PO_COLLECTION_PATH)).toHaveLength(0);
    expect(approvalRequests(requests)).toHaveLength(0);
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('표는 대상 초과분과 발주 라인 둘뿐이다', async () => {
    const { user } = renderScreen(allRoutes());

    await waitForSource();
    await user.click(screen.getByRole('button', { name: t.source.chooseRow(1) }));

    expect(screen.getAllByRole('table')).toHaveLength(2);
  });
});

describe('조회 실패(C11)', () => {
  it('입하 상세가 실패하면 빈 상태가 아니라 배너와 다시 시도가 선다', async () => {
    renderScreen([failingReceiptRoute(500), ...lookupRoutes(), ...forbiddenRoutes()]);

    expect(await screen.findByText(messages.httpError.loadTitle)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.common.retry })).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noContextTitle)).not.toBeInTheDocument();
  });

  it('권한 없음에는 다시 시도를 내지 않는다', async () => {
    renderScreen([failingReceiptRoute(403), ...lookupRoutes(), ...forbiddenRoutes()]);

    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it('조회에 실패하면 등록이 잠기고 사유가 보인다', async () => {
    renderScreen([failingReceiptRoute(500), ...lookupRoutes(), ...forbiddenRoutes()]);

    await screen.findByText(messages.httpError.loadTitle);

    expect(registerButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.sourceNotLoaded)).toBeInTheDocument();
  });

  /**
   * **사업부 단독 실패**(리뷰 R-2).
   *
   * 사업부는 승계 원천이 없는 유일한 필수 값이라 선택지가 비면 채울 방법이 없다.
   * 그 실패에 복구 버튼이 서지 않으면 등록이 `headerIncomplete`로 영구 잠긴다 —
   * 다른 넷은 정상인 상태에서 복구 수단이 실제로 서는지 잰다.
   */
  it('사업부 조회만 실패해도 복구 수단이 선다', async () => {
    const { requests, user } = renderScreen([
      receiptRoute(),
      failingLookupRoute(BUSINESS_UNITS_PATH),
      lookupRoute(PARTNERS_PATH, partnerFixtures),
      lookupRoute(PLANTS_PATH, plantFixtures),
      lookupRoute(ITEMS_PATH, itemFixtures),
      lookupRoute(UOMS_PATH, uomFixtures),
      ...forbiddenRoutes(),
    ]);

    await waitForSource();

    /* 짝 양성 — 다른 넷은 정상이라 이름이 실제로 풀린다. */
    await waitFor(() => {
      expect(within(sourcePane()).getByText(ITEM_LABEL)).toBeInTheDocument();
    });

    expect(screen.getByText(t.reasons.referencesFailed)).toBeInTheDocument();
    expect(
      within(sourcePane()).getByRole('button', { name: messages.common.retry }),
    ).toBeInTheDocument();
    /* 사업부 칸에는 선택지를 불러오지 못했다는 안내가 붙는다. */
    expect(screen.getByText(t.lookups.failed)).toBeInTheDocument();

    /*
     * **복구를 눌러 실제로 다시 부르는지 잰다**(선행 회차 리뷰 R-12 · 관찰 C).
     * 누르기만 하고 아무것도 재지 않으면 그 클릭은 「눌러도 아무 일이 없는 버튼」과 구분되지 않는다.
     */
    const before = requestsTo(requests, BUSINESS_UNITS_PATH).length;

    await user.click(within(sourcePane()).getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, BUSINESS_UNITS_PATH).length).toBeGreaterThan(before);
    });
  });

  it('참조 조회가 실패하면 이름 자리에 사유가 서고 복구 수단이 함께 있다', async () => {
    renderScreen([
      receiptRoute(),
      failingLookupRoute(ITEMS_PATH),
      lookupRoute(PARTNERS_PATH, partnerFixtures),
      lookupRoute(BUSINESS_UNITS_PATH, businessUnitFixtures),
      lookupRoute(PLANTS_PATH, plantFixtures),
      lookupRoute(UOMS_PATH, uomFixtures),
      ...forbiddenRoutes(),
    ]);

    await waitForSource();

    await waitFor(() => {
      expect(within(sourcePane()).getAllByText(t.values.referenceFailed).length).toBeGreaterThan(0);
    });
    expect(screen.getByText(t.reasons.referencesFailed)).toBeInTheDocument();
  });
});

describe('발주 정보', () => {
  it('공급사·공장은 넘어온 전표에서 승계되고 사업부·발주일은 비어 있다', async () => {
    const { user } = renderScreen(allRoutes(SINGLE_LINE));

    await waitForSource();

    await waitFor(() => {
      expect(screen.getByLabelText(t.fields.supplier)).toHaveTextContent(SUPPLIER_LABEL);
    });
    /* 사업부는 승계할 원천이 없다 — 어떤 사업부도 골라져 있지 않아야 한다. */
    expect(screen.getByLabelText(t.fields.businessUnit)).not.toHaveTextContent('합성 사업부 가');
    expect(registerButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.headerIncomplete)).toBeInTheDocument();

    /* 더한 줄은 비어 있다 — **잘못 친 값이 아직 안 친 칸보다 먼저** 사유가 된다. */
    await user.click(screen.getByRole('button', { name: t.actions.addLine }));

    expect(screen.getByText(t.actionReasons.lineInvalid)).toBeInTheDocument();
  });

  it('승계값과 다른 공급사를 고르면 경고가 보이되 막지 않는다', async () => {
    const { user } = renderScreen(allRoutes(SINGLE_LINE));

    await waitForSource();
    await waitFor(() => {
      expect(screen.getByLabelText(t.fields.supplier)).toHaveTextContent(SUPPLIER_LABEL);
    });

    await user.click(screen.getByLabelText(t.fields.supplier));
    await user.click(screen.getByRole('option', { name: 'SAMPLE-SUP-02 · 합성 공급사 나' }));

    expect(screen.getByText(t.warnings.supplierChanged)).toBeInTheDocument();
    expect(screen.queryByText(t.actionReasons.lineInvalid)).not.toBeInTheDocument();
  });

  /**
   * **값을 다 채우면 등록이 열린다.**
   *
   * 앞 회차에서는 이 자리가 「아직 보낼 수 없다」였다 — 보낼 자리가 없었기 때문이다. 그 사유가
   * 사라졌으니 감지기도 **삭제하지 않고 새 사실로 다시 쓴다**: 버튼이 열리고 **잠긴 사유가 화면
   * 어디에도 서지 않는다**(사유가 남으면 열린 버튼 옆에서 「할 수 없다」를 읽는다).
   */
  it('값을 다 채우면 등록이 열리고 잠긴 사유가 사라진다', async () => {
    const { user } = renderScreen(registerRoutes());

    await waitForSource();
    await fillHeader(user);

    expect(registerButton()).toBeEnabled();
    expect(screen.queryByText(t.actionReasons.headerIncomplete)).not.toBeInTheDocument();
    expect(screen.queryByText(t.actionReasons.lineInvalid)).not.toBeInTheDocument();
    expect(screen.queryByText(t.actionReasons.alreadyRegistered)).not.toBeInTheDocument();
    expect(registerButton()).not.toHaveAccessibleDescription();
  });

  /**
   * **빈 필수 칸의 오류가 곧바로 그 칸에 선다**(완료 조건 C12).
   *
   * 이 화면은 필수가 비면 등록이 **잠긴다** — 「누른 뒤에 보인다」 규율을 쓸 수 없다(누를 수
   * 없으므로 영영 보이지 않는다). 잠금 사유는 「필수 항목을 채우세요」라고만 말하므로 어느 칸인지
   * 함께 보여야 한다.
   */
  it('필수가 비면 등록이 잠기고 그 칸에 인라인 오류가 붙는다', async () => {
    renderScreen(registerRoutes());

    await waitForSource();

    expect(registerButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.headerIncomplete)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.businessUnit)).toHaveAccessibleDescription(
      new RegExp(t.errors.businessUnitRequired),
    );
    expect(screen.getByLabelText(t.fields.orderDate)).toHaveAccessibleDescription(
      new RegExp(t.errors.orderDateRequired),
    );
    /* 짝 방향 — 승계로 채워진 칸에는 오류가 붙지 않는다. */
    expect(screen.getByLabelText(t.fields.supplier)).not.toHaveAccessibleDescription(
      new RegExp(t.errors.supplierRequired),
    );
  });

  /**
   * **2행·미선택 갈래에서도 헤더는 승계값으로 선다**(선행 회차 검증 권고 B).
   *
   * 승계 원천은 **전표의 값**(공급사·공장)이라 어느 줄을 고르는지와 무관하다 — 고르기 전에
   * 비워 두면 사용자가 이미 정해진 값을 다시 고르게 되고, 대상을 고른 순간 값이 덮이면
   * 그때 친 값이 사라진다. 등록은 여전히 잠겨 있다(고른 줄이 없다).
   */
  it('라인이 두 줄이고 아직 고르지 않았어도 공급사·공장이 승계돼 보인다', async () => {
    renderScreen(allRoutes());

    await waitForSource();

    await waitFor(() => {
      expect(screen.getByLabelText(t.fields.supplier)).toHaveTextContent(SUPPLIER_LABEL);
    });
    expect(screen.getByLabelText(t.fields.plant)).toHaveTextContent('SAMPLE-PLT-01 · 합성 공장 가');
    expect(registerButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.sourceLineNotChosen)).toBeInTheDocument();
  });

  it('ERP 발주번호와 상태 입력칸을 두지 않는다(계획 결정 6·7)', async () => {
    renderScreen(allRoutes(SINGLE_LINE));

    await waitForSource();

    expect(screen.getByLabelText(t.fields.supplier)).toBeInTheDocument();
    expect(screen.queryByLabelText(/ERP/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/상태/)).not.toBeInTheDocument();
  });
});

describe('등록 확인 창(C13)', () => {
  it('등록을 누르면 확인 창이 서고 요청은 아직 나가지 않는다', async () => {
    const { requests, user } = renderScreen(registerRoutes());

    await waitForSource();
    await fillHeader(user);
    await openConfirm(user);

    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText(SUPPLIER_LABEL)).toBeVisible();
    expect(within(dialog).getByText(t.dialog.lineCount(1))).toBeVisible();
    expect(within(dialog).getByText('12')).toBeVisible();
    expect(createRequests(requests)).toHaveLength(0);
  });

  /** **확인을 거치지 않으면 아무것도 나가지 않는다** — 창을 닫는 것이 취소다. */
  it('확인 창을 닫으면 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen(registerRoutes());

    await waitForSource();
    await fillHeader(user);
    await openConfirm(user);
    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(createRequests(requests)).toHaveLength(0);
  });

  /** 확인 창의 요약이 **친 값에서 나온다** — 줄을 더하면 줄 수와 합계가 함께 따라간다. */
  it('줄을 더하면 확인 창의 줄 수와 합계가 함께 바뀐다', async () => {
    const { user } = renderScreen(registerRoutes());

    await waitForSource();
    await user.click(screen.getByRole('button', { name: t.actions.addLine }));
    await user.click(screen.getByLabelText(t.lineTable.itemLabel(2)));
    await user.click(
      screen.getByRole('option', { name: 'SAMPLE-ITEM-03 · 합성 품목 다 (미사용)' }),
    );
    await user.click(screen.getByLabelText(t.lineTable.uomLabel(2)));
    await user.click(screen.getByRole('option', { name: 'SAMPLE-EA · 합성 단위 개' }));
    await user.type(qtyInput(2), '8');
    await fillHeader(user);
    await openConfirm(user);

    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText(t.dialog.lineCount(2))).toBeVisible();
    expect(within(dialog).getByText('20')).toBeVisible();
    /* 두 줄의 단위가 같으므로 「단위가 갈린다」는 서지 않는다. */
    expect(within(dialog).queryByText(t.dialog.mixedUom)).not.toBeInTheDocument();
  });
});

describe('등록 요청(C14~C18)', () => {
  it('확인하면 등록이 정확히 1회 나가고 경로가 컬렉션이다', async () => {
    const { requests, user } = renderScreen(registerRoutes());

    await setupAndRegister(user);

    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(1);
    });
    expect(createRequests(requests)[0]?.url.pathname).toBe(PO_COLLECTION_PATH);
  });

  /**
   * **멱등 키는 실리고 잠금 토큰은 실리지 않는다**(완료 조건 C15).
   *
   * 계약 parameters에 `If-Match`가 없고 응답에 409가 없다 — 새 전표라 견줄 판이 없다. 화면이
   * 들고 있는 토큰은 **넘어온 입하 전표**의 것이라, 실으면 서로 다른 자원의 버전을 비교한다.
   */
  it('멱등 키를 싣고 If-Match는 싣지 않는다', async () => {
    const { requests, user } = renderScreen(registerRoutes());

    await setupAndRegister(user);

    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(1);
    });

    const sent = createRequests(requests)[0];

    expect(sent?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/i);
    expect(sent?.headers.has('If-Match')).toBe(false);
  });

  /** **서버가 정하는 값을 화면이 싣지 않는다**(완료 조건 C16). */
  it('본문에 전표번호·상태·ERP 발주번호가 없다', async () => {
    const { requests, user } = renderScreen(registerRoutes());

    await setupAndRegister(user);

    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(1);
    });

    const keys = Object.keys(lastCreateBody(requests));

    expect(keys).toContain('supplierId');
    expect(keys).not.toContain('purchaseOrderNo');
    expect(keys).not.toContain('statusCode');
    expect(keys).not.toContain('erpPurchaseOrderNo');
  });

  /** **승계 근거가 본문에 실린다**(완료 조건 C18) — 계약이 헤더에 한 자리를 둔 이유다. */
  it('고른 줄의 번호가 승계 근거로 실린다', async () => {
    const { requests, user } = renderScreen(registerRoutes());

    await setupAndRegister(user);

    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(1);
    });
    expect(lastCreateBody(requests).sourceInboundReceiptLineId).toBe(9111);
  });

  /**
   * **라인 전체가 한 요청에 실린다**(완료 조건 C17 · 착수 이슈 §6 ⑤ · 뮤테이션 M-2).
   *
   * 첫 줄만 싣거나 줄마다 요청을 나누면 서버의 한 트랜잭션 약속이 깨진다 — 요청 횟수와
   * 배열 길이를 **함께** 잰다.
   */
  it('라인이 세 줄이면 본문에 세 줄이 실리고 요청은 한 번이다', async () => {
    const { requests, user } = renderScreen(registerRoutes());

    await waitForSource();

    for (const lineNo of [2, 3]) {
      await user.click(screen.getByRole('button', { name: t.actions.addLine }));
      await user.click(screen.getByLabelText(t.lineTable.itemLabel(lineNo)));
      await user.click(
        screen.getByRole('option', { name: 'SAMPLE-ITEM-03 · 합성 품목 다 (미사용)' }),
      );
      await user.click(screen.getByLabelText(t.lineTable.uomLabel(lineNo)));
      await user.click(screen.getByRole('option', { name: 'SAMPLE-EA · 합성 단위 개' }));
      await user.type(qtyInput(lineNo), '4');
    }

    await fillHeader(user);
    await openConfirm(user);
    await submitConfirm(user);

    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(1);
    });

    const lines = lastCreateBody(requests).lines as { orderedQty: number }[];

    expect(lines).toHaveLength(3);
    expect(lines.map((line) => line.orderedQty)).toEqual([12, 4, 4]);
  });
});

/**
 * **전송 중 잠금**(완료 조건 C19 · 계획 결정 16).
 *
 * 응답이 오기 전 상태에서 조작 자리가 하나라도 열려 있으면 그 자리가 전표 한 벌이다 —
 * 공통 쓰기 훅이 호출마다 새 멱등 키를 만들어 서버에는 다른 요청으로 보인다.
 */
describe('전송 중(C19)', () => {
  it('보내는 중에는 폼·등록·취소·대상 선택이 모두 잠기고 사유가 보인다', async () => {
    const { requests, release, user } = renderScreen(registerRoutes(), '?receipt=9101', [
      PO_COLLECTION_PATH,
    ]);

    await setupAndRegister(user);

    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(1);
    });

    expect(screen.getAllByText(t.actionReasons.saving).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(t.fields.businessUnit)).toBeDisabled();
    expect(qtyInput(1)).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.addLine })).toBeDisabled();
    expect(registerButton()).toBeDisabled();
    expect(cancelButton()).toBeDisabled();
    /* 확인 창의 실행 버튼도 잠긴다 — 창은 아직 열려 있다(실패했을 때 사유를 낼 자리다). */
    expect(confirmButton()).toBeDisabled();

    release();

    await screen.findByText(t.result.createdTitle('SAMPLE-PO-9001'));
  });

  /**
   * **「닫혀도 나가는 요청이 무너지지 않게」의 본체**(완료 조건 C13의 셋째 방어).
   *
   * Escape는 막을 수 없다 — native `<dialog>`가 `cancel`을 내고 디자인 시스템이 그것을 닫기
   * 요청으로 무조건 잇는다. 규율이 실제로 걸리는 것은 **나가는 중**이다: 그때 `onClose`가
   * `reset()`을 부르면 공통 훅의 옵저버가 떨어져 **성공도 잠금 해제도 오지 않는다.** 그러면
   * 사용자는 만들어진 전표를 못 본 채 폼이 다시 열린 화면을 보고 한 번 더 등록한다 —
   * **전표 두 벌**이다. 그 함수가 창만 내린다는 사실에 잣대가 없으면, 다음 사람이 거기에
   * 「닫으면 정리한다」를 더해도 시험이 조용히 통과한다(전례 `iqc-skip-approval`·`approval-inbox`).
   *
   * jsdom은 Escape 키를 native 취소로 잇지 않으므로 브라우저가 내는 이벤트를 직접 만든다.
   */
  it('전송 중 Escape로 창이 닫혀도 등록 결과가 살아 있다', async () => {
    const { requests, release, user } = renderScreen(registerRoutes(), '?receipt=9101', [
      PO_COLLECTION_PATH,
    ]);

    await setupAndRegister(user);

    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(1);
    });

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    /* ① 창을 닫는 것이 요청을 다시 내지도, 되돌리지도 않는다. */
    expect(createRequests(requests)).toHaveLength(1);
    /* ② 잠금이 살아 있다 — 요청은 아직 날아가는 중이다. */
    expect(registerButton()).toBeDisabled();
    expect(screen.getAllByText(t.actionReasons.saving).length).toBeGreaterThan(0);

    release();

    /* ③ 성공이 사라지지 않는다 — 결과 구획이 실제로 선다. */
    expect(await screen.findByText(t.result.createdTitle('SAMPLE-PO-9001'))).toBeVisible();
    /* ④ 성공 뒤 잠금·사유도 그대로 온다 — 창을 닫은 것이 그 길을 끊지 않았다. */
    expect(screen.getAllByText(t.actionReasons.alreadyRegistered).length).toBeGreaterThan(0);
    expect(createRequests(requests)).toHaveLength(1);
  });

  /** 두 번 눌러도 **요청은 한 번**이다 — 잠금이 표시만이면 두 번째 클릭이 그대로 통한다. */
  it('실행 버튼을 두 번 눌러도 요청은 한 번이다', async () => {
    const { requests, release, user } = renderScreen(registerRoutes(), '?receipt=9101', [
      PO_COLLECTION_PATH,
    ]);

    await setupAndRegister(user);

    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(1);
    });

    await user.click(confirmButton());

    expect(createRequests(requests)).toHaveLength(1);

    release();

    await screen.findByText(t.result.createdTitle('SAMPLE-PO-9001'));
  });
});

describe('등록 성공(C20·C21·C23·C24)', () => {
  it('결과 구획에 전표번호와 등록 시점의 상태가 서고 확인 창이 닫힌다', async () => {
    const { user } = renderScreen(registerRoutes());

    await setupAndRegister(user);

    await screen.findByText(t.result.createdTitle('SAMPLE-PO-9001'));

    expect(within(resultPane()).getByText('SAMPLE_PO_STATUS_A')).toBeVisible();
    expect(within(resultPane()).getByText(t.result.createdStatusCode)).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /** **ERP 번호가 채워져 오는 갈래.** 목이 계약 예시값을 채워 주는 것과 같은 모양이다. */
  it('ERP 발주번호가 오면 그 값이 보인다', async () => {
    const { user } = renderScreen(registerRoutes());

    await setupAndRegister(user);

    await screen.findByText(t.result.createdTitle('SAMPLE-PO-9001'));

    expect(within(resultPane()).getByText('SAMPLE-EPO-9001')).toBeVisible();
    expect(within(resultPane()).queryByText(t.result.erpUnmatched)).not.toBeInTheDocument();
  });

  /** **비어 오는 갈래**(미결 #1의 처리 · `omf-mes#72`) — 두 갈래를 모두 잰다. */
  it('ERP 발주번호가 비어 오면 미매칭 표식과 안내가 선다', async () => {
    const { user } = renderScreen(
      registerRoutes(createRoute(purchaseOrderDetailBody({ erpPurchaseOrderNo: null }))),
    );

    await setupAndRegister(user);

    await screen.findByText(t.result.createdTitle('SAMPLE-PO-9001'));

    expect(within(resultPane()).getByText(t.result.erpUnmatched)).toBeVisible();
    expect(within(resultPane()).getByText(t.result.erpUnmatchedNote)).toBeVisible();
  });

  /** 서버가 되돌려 준 **줄 수**를 낸다 — 화면이 보낸 줄을 되비추지 않는다. */
  it('서버가 저장한 줄 수를 낸다', async () => {
    const { user } = renderScreen(
      registerRoutes(
        createRoute(
          purchaseOrderDetailBody({}, [
            purchaseOrderLineResponse(),
            purchaseOrderLineResponse({ purchaseOrderLineId: 9702, lineNo: 2 }),
          ]),
        ),
      ),
    );

    await setupAndRegister(user);

    expect(await screen.findByText(t.result.lineCount(2))).toBeVisible();
  });

  /**
   * **성공 뒤 폼과 등록이 잠긴다**(완료 조건 C24 · 계획 결정 12).
   *
   * 잠그지 않으면 두 번 누르는 것이 그대로 전표 두 벌이 되고, 이 화면에는 되돌릴 경로가 없다.
   * 사유는 **다시 시작할 자리**를 가리킨다 — 되돌릴 수단을 지어내지 않는다.
   */
  it('성공 뒤 폼·등록·취소·대상 선택이 잠기고 사유가 다시 시작할 자리를 가리킨다', async () => {
    const { user } = renderScreen(
      registerRoutes(createRoute(purchaseOrderDetailBody())),
      '?receipt=9101',
    );

    await setupAndRegister(user);

    await screen.findByText(t.result.createdTitle('SAMPLE-PO-9001'));

    expect(screen.getAllByText(t.actionReasons.alreadyRegistered).length).toBeGreaterThan(0);
    expect(registerButton()).toBeDisabled();
    expect(cancelButton()).toBeDisabled();
    expect(screen.getByLabelText(t.fields.businessUnit)).toBeDisabled();
    expect(qtyInput(1)).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.addLine })).toBeDisabled();
  });

  /**
   * **등록 한 번이 상신을 만들지 않는다**(완료 조건 C23 · 착수 이슈 §6 ③ · 계획 결정 9).
   *
   * 주 사본이 된 전례는 한 버튼이 등록+상신 두 요청을 이었다 — 그 형태를 베끼면 이 화면이
   * 착수 이슈를 어긴다. 요청 로그와 화면을 **함께** 잰다.
   *
   * **앞 회차의 「결과 구획에 버튼이 하나도 없다」를 이 사실로 다시 썼다**(정책 §8.1 — 지우지
   * 않는다). 상신이 붙은 지금 그 자리에는 「승인 요청」이 서지만, **버튼이 서는 것과 요청이
   * 나가는 것은 다르다** — 등록만으로는 상신도 상세 조회도 0건이다.
   */
  it('등록만으로는 상신 요청이 나가지 않는다 — 자리는 서고 요청은 0건', async () => {
    const { requests, user } = renderScreen(approvalRoutes());

    await setupAndRegister(user);

    await screen.findByText(t.result.createdTitle('SAMPLE-PO-9001'));

    expect(requestsTo(requests, SUBMIT_PATH)).toHaveLength(0);
    expect(approvalRequests(requests)).toHaveLength(0);
    expect(getsTo(requests, PO_DETAIL_PATH)).toHaveLength(0);
    expect(createRequests(requests)).toHaveLength(1);
    /* 짝 — 상신 자리는 등록 뒤에 실제로 선다(계획 결정 9의 나머지 반쪽). */
    expect(requestApprovalButton()).toBeVisible();
  });

  /** 이 화면은 발주 **목록을 조회하지 않는다** — 등록 성공이 없는 목록을 다시 부르지 않는다. */
  it('등록 뒤에도 발주 목록을 조회하지 않는다', async () => {
    const { requests, user } = renderScreen(registerRoutes());

    await setupAndRegister(user);

    await screen.findByText(t.result.createdTitle('SAMPLE-PO-9001'));

    expect(getsTo(requests, PO_COLLECTION_PATH)).toHaveLength(0);
  });

  /**
   * **입하 상세를 다시 부르지 않는다.** 다시 부르면 같은 응답이 새 참조로 와 승계 초안이 다시
   * 서고(수명 표 6행), 사용자가 방금 등록한 값과 화면의 값이 갈린다.
   */
  it('등록 뒤에 입하 상세를 다시 부르지 않는다', async () => {
    const { requests, user } = renderScreen(registerRoutes());

    await setupAndRegister(user);

    await screen.findByText(t.result.createdTitle('SAMPLE-PO-9001'));

    expect(requestsTo(requests, RECEIPT_PATH)).toHaveLength(1);
  });
});

describe('등록 실패 네 갈래(C25)', () => {
  const VALIDATION_BODY = {
    errors: [{ scope: 'field', field: 'plantId', code: 'INVALID', message: '합성 서버 문구' }],
  };

  /** 서버 필드 오류는 **그 칸에** 붙는다. 배너로 옮겨 가면 무엇을 고칠지 가리키지 못한다. */
  it('검증 실패는 그 칸에 붙고 확인 창이 닫히지 않는다', async () => {
    const { user } = renderScreen(registerRoutes(failingCreateRoute(400, VALIDATION_BODY)));

    await setupAndRegister(user);

    expect(await screen.findByText('합성 서버 문구')).toBeVisible();
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByLabelText(t.fields.plant)).toHaveAccessibleDescription(/합성 서버 문구/);
  });

  it('권한 없음은 권한 문구를 내고 확인 창이 닫히지 않는다', async () => {
    const { user } = renderScreen(registerRoutes(failingCreateRoute(403)));

    await setupAndRegister(user);

    expect(await screen.findByText(messages.httpError.forbidden)).toBeVisible();
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  /**
   * 409도 갈래로 갈리되 **「최신 불러오기」는 내지 않는다.**
   *
   * 등록에는 잠글 대상이 없다(계약에 `If-Match`도 409도 없다) — 재조회 수단을 내면 사용자가
   * 그것을 눌러 입력만 버린다.
   */
  it('저장 충돌은 충돌 문구를 내되 「최신 불러오기」가 없다', async () => {
    const { user } = renderScreen(
      registerRoutes(failingCreateRoute(409, { conflictCause: 'user', message: '' })),
    );

    await setupAndRegister(user);

    expect(await screen.findByText(messages.conflict.user)).toBeVisible();
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: messages.conflict.reloadAction }),
    ).not.toBeInTheDocument();
  });

  /**
   * **응답이 오지 않은 요청은 「실패」가 아니다.** 훅이 호출마다 새 멱등 키를 만들어, 그대로 다시
   * 보내면 서버에는 다른 요청으로 보인다 — 전표가 두 벌 남는 자리다.
   */
  it('응답 없음에는 확인할 수 없다는 안내가 함께 붙는다', async () => {
    const { user } = renderScreen(registerRoutes(brokenCreateRoute()));

    await setupAndRegister(user);

    expect(await screen.findByText(messages.httpError.offline)).toBeVisible();
    expect(screen.getByText(t.notes.networkUnconfirmed)).toBeVisible();
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  /** 짝 방향 — 서버가 거절한 갈래에는 그 안내가 붙지 않는다. 늘 붙으면 경고가 배경이 된다. */
  it('서버가 거절한 갈래에는 그 안내가 없다', async () => {
    const { user } = renderScreen(registerRoutes(failingCreateRoute(403)));

    await setupAndRegister(user);

    await screen.findByText(messages.httpError.forbidden);

    expect(screen.queryByText(t.notes.networkUnconfirmed)).not.toBeInTheDocument();
  });

  /** 실패했는데 입력을 지우면 사용자가 처음부터 다시 친다 — **친 값이 남는다.** */
  it('실패해도 친 값과 결과 없음이 그대로다', async () => {
    const { user } = renderScreen(registerRoutes(failingCreateRoute(403)));

    await setupAndRegister(user);

    await screen.findByText(messages.httpError.forbidden);

    expect(screen.getByLabelText(t.fields.businessUnit)).toHaveTextContent('합성 사업부 가');
    expect(qtyInput(1)).toHaveValue(12);
    expect(screen.queryByRole('region', { name: t.result.label })).not.toBeInTheDocument();
  });

  /**
   * **고친 칸의 서버 오류가 사라진다**(부 사본 `changeHeader`와 같은 형태).
   *
   * 화면이 잡은 오류는 **빈 칸에만** 생기므로, 400을 받은 칸을 **유효한 값으로 고치면** 로컬
   * 오류가 걷히면서 서버 오류가 되살아난다 — 방금 고친 칸에 붉은 글씨와 `aria-invalid`가 남고
   * 사용자는 무엇을 더 고쳐야 하는지 알 수 없다. 지워지는 시점이 다음 저장뿐이면 그 사이가
   * 통째로 거짓말이 된다.
   *
   * **짝 방향을 함께 잰다** — 고치지 않은 칸의 서버 오류는 그대로 남는다(전부 지우면 무엇이
   * 남았는지 알 수 없다).
   */
  it('400을 받은 칸을 고치면 그 칸의 서버 문구만 사라진다', async () => {
    const TWO_FIELD_BODY = {
      errors: [
        { scope: 'field', field: 'supplierId', code: 'INVALID', message: '합성 공급사 서버 문구' },
        { scope: 'field', field: 'plantId', code: 'INVALID', message: '합성 공장 서버 문구' },
      ],
    };
    const { user } = renderScreen(registerRoutes(failingCreateRoute(400, TWO_FIELD_BODY)));

    await setupAndRegister(user);

    await screen.findByText('합성 공급사 서버 문구');
    expect(screen.getByLabelText(t.fields.supplier)).toHaveAccessibleDescription(
      /합성 공급사 서버 문구/,
    );

    /* 창을 닫고 폼으로 돌아간다 — 고칠 자리는 창 안이 아니라 폼이다. */
    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));
    await user.click(screen.getByLabelText(t.fields.supplier));
    await user.click(screen.getByRole('option', { name: 'SAMPLE-SUP-02 · 합성 공급사 나' }));

    expect(screen.queryByText('합성 공급사 서버 문구')).not.toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.supplier)).not.toHaveAttribute('aria-invalid', 'true');
    /* 짝 방향 — 고치지 않은 칸의 오류는 남는다. */
    expect(screen.getByText('합성 공장 서버 문구')).toBeVisible();
  });

  /** 실패한 뒤 **다시 보낼 수 있다** — 잠금이 실패에 걸려 남으면 사용자가 화면을 떠나야 한다. */
  it('실패한 뒤 다시 보낼 수 있다', async () => {
    let attempts = 0;
    const flakyRoute: StubRoute = {
      match: (request) => isPost(request, PO_COLLECTION_PATH),
      respond: () => {
        attempts += 1;

        return attempts === 1
          ? jsonResponse({ message: '' }, { status: 403 })
          : jsonResponse(purchaseOrderDetailBody(), { status: 201 });
      },
    };
    const { requests, user } = renderScreen(registerRoutes(flakyRoute));

    await setupAndRegister(user);
    await screen.findByText(messages.httpError.forbidden);

    await submitConfirm(user);

    await screen.findByText(t.result.createdTitle('SAMPLE-PO-9001'));
    expect(createRequests(requests)).toHaveLength(2);
  });
});

describe('취소와 버리기 확인 창(C26)', () => {
  /** **친 값이 없으면 창을 열지 않는다** — 아무것도 잃지 않는 조작에 확인을 받으면 창이 형식이 된다. */
  it('친 값이 없으면 취소가 잠기고 사유가 보인다', async () => {
    const { user } = renderScreen(registerRoutes());

    await waitForSource();

    expect(cancelButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.nothingToDiscard)).toBeInTheDocument();

    await user.click(cancelButton());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('친 값이 있으면 취소가 버리기 확인 창을 연다', async () => {
    const { user } = renderScreen(registerRoutes());

    await waitForSource();
    await fillHeader(user);

    expect(cancelButton()).toBeEnabled();

    await user.click(cancelButton());

    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByText(t.dialog.discardLead)).toBeVisible();
  });

  /** 라인만 고쳐도 **버릴 것이 있다** — 머리만 보면 친 수량이 확인 없이 사라진다. */
  it('라인만 고쳐도 취소가 열린다', async () => {
    const { user } = renderScreen(registerRoutes());

    await waitForSource();
    await user.clear(qtyInput(1));
    await user.type(qtyInput(1), '20');

    expect(cancelButton()).toBeEnabled();
  });

  /** 버리면 **승계 상태로 되세운다** — 빈 폼이 아니라 넘어온 초과분에서 승계된 값이다. */
  it('버리기를 확정하면 승계 상태로 돌아간다', async () => {
    const { requests, user } = renderScreen(registerRoutes());

    await waitForSource();
    await fillHeader(user);
    await user.clear(qtyInput(1));
    await user.type(qtyInput(1), '30');

    await user.click(cancelButton());
    await user.click(screen.getByRole('button', { name: t.actions.discardDraft }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.businessUnit)).not.toHaveTextContent('합성 사업부 가');
    expect(qtyInput(1)).toHaveValue(12);
    /* 승계값은 그대로 남는다 — 「빈 폼으로 되돌린다」가 아니다. */
    expect(screen.getByLabelText(t.fields.supplier)).toHaveTextContent(SUPPLIER_LABEL);
    /* 서버를 부르지 않는다 — 이 조작은 보내기 전 복귀다. */
    expect(createRequests(requests)).toHaveLength(0);
  });

  /** 계속 입력을 고르면 **아무것도 버리지 않는다.** */
  it('계속 입력을 고르면 친 값이 남는다', async () => {
    const { user } = renderScreen(registerRoutes());

    await waitForSource();
    await fillHeader(user);

    await user.click(cancelButton());
    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));

    expect(screen.getByLabelText(t.fields.businessUnit)).toHaveTextContent('합성 사업부 가');
  });
});

/**
 * **등록과 상신은 별개 동작이다**(착수 이슈 §6 ③ · 계획 결정 9).
 *
 * 등록이 끝나야 상신 자리가 서고, 그 자리에서 사유를 적어야 올릴 수 있다.
 */
describe('상신 자리와 사유(C27)', () => {
  /** 등록 **전에는** 올릴 대상 자체가 없다 — 잠긴 버튼을 미리 세워 두지 않는다. */
  it('등록 전에는 사유 칸도 승인 요청 버튼도 없다', async () => {
    const { user } = renderScreen(approvalRoutes());

    await waitForSource();
    await fillHeader(user);

    /* 짝 양성 — 화면은 다 그려졌고 등록은 열려 있다. */
    expect(registerButton()).toBeEnabled();
    expect(screen.queryByLabelText(t.submit.reason)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: t.actions.requestApproval }),
    ).not.toBeInTheDocument();
  });

  /**
   * **공백만인 사유는 빈 값과 같다**(완료 조건 C27).
   *
   * 목이 공백만을 202로 통과시키므로(실측) 막는 곳이 화면뿐이다 — 통과하면 결재함 목록의
   * 요약이 빈 요청이 올라간다.
   */
  it('사유가 공백만이면 승인 요청이 잠기고 사유가 보이며 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen(approvalRoutes());

    await setupAndRegister(user);
    await screen.findByText(t.result.createdTitle('SAMPLE-PO-9001'));

    expect(requestApprovalButton()).toBeDisabled();
    expect(within(resultPane()).getByText(t.actionReasons.reasonRequired)).toBeVisible();

    await user.type(reasonInput(), '   ');

    expect(requestApprovalButton()).toBeDisabled();

    await user.click(requestApprovalButton());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(submitRequests(requests)).toHaveLength(0);
    expect(getsTo(requests, PO_DETAIL_PATH)).toHaveLength(0);
  });

  /** 사유를 적으면 열린다 — 짝 방향. 「늘 잠긴다」로 통과하지 않게 한다. */
  it('사유를 적으면 승인 요청이 열리고 잠긴 사유가 사라진다', async () => {
    const { user } = renderScreen(approvalRoutes());

    await setupAndRegister(user);
    await screen.findByText(t.result.createdTitle('SAMPLE-PO-9001'));

    await user.type(reasonInput(), '정산');

    expect(requestApprovalButton()).toBeEnabled();
    expect(
      within(resultPane()).queryByText(t.actionReasons.reasonRequired),
    ).not.toBeInTheDocument();
  });

  /** 확인 창은 **친 사유에서 나온 글자**를 보인다 — 창이 다시 다듬거나 뽑지 않는다. */
  it('확인 창이 사유 전문과 첫 줄을 나눠 보인다', async () => {
    const { user } = renderScreen(approvalRoutes());

    await setupAndRegister(user);
    await screen.findByText(t.result.createdTitle('SAMPLE-PO-9001'));

    await user.type(reasonInput(), '  요약 줄  ');
    await user.click(requestApprovalButton());

    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText('SAMPLE-PO-9001')).toBeVisible();
    expect(
      within(within(dialog).getByRole('region', { name: t.dialog.reasonFirstLine })).getByText(
        '요약 줄',
      ),
    ).toBeVisible();
    expect(within(dialog).getByText(t.dialog.submitApprover)).toBeVisible();
  });
});

/**
 * **상신은 요청 둘을 잇는다**(완료 조건 C28 · 계획 결정 10) — 상세로 토큰을 얻고 그 토큰으로
 * 올린다. 등록 201이 준 토큰은 **컬렉션 경로**에 앉아 있어 쓸 수 없다.
 */
describe('상신 요청(C28·C29)', () => {
  it('상세 조회 → 상신 순으로 2회 나가고 If-Match가 상세 응답의 ETag와 같다', async () => {
    const { requests, user } = renderScreen(approvalRoutes());

    await registerAndSubmit(user);

    await waitFor(() => {
      expect(submitRequests(requests)).toHaveLength(1);
    });

    const detailCalls = getsTo(requests, PO_DETAIL_PATH);
    const submitted = submitRequests(requests)[0];

    expect(detailCalls).toHaveLength(1);
    /* 순서 — 토큰을 얻기 전에 올리면 계약 위반(목이 400으로 되돌린다). */
    expect(requests.indexOf(detailCalls[0] as RecordedRequest)).toBeLessThan(
      requests.indexOf(submitted as RecordedRequest),
    );
    expect(submitted?.headers.get('If-Match')).toBe(DETAIL_ETAG);
    /* **등록이 준 토큰이 아니다** — 뮤테이션 M-3이 겨누는 자리. */
    expect(submitted?.headers.get('If-Match')).not.toBe(CREATE_ETAG);
    expect(submitted?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/i);
  });

  /**
   * **본문이 사유 하나뿐이다**(완료 조건 C29 · 착수 이슈 §6 ④).
   *
   * 승인 유형·승인자·결재선을 화면이 보내지 않는다 — 계약에 자리가 없고, 승인 주체는 결재선
   * 정의가 정한다.
   */
  it('상신 본문의 키가 사유 하나이고 앞뒤 공백이 다듬어져 있다', async () => {
    const { requests, user } = renderScreen(approvalRoutes());

    await registerAndSubmit(user, '  정산 발주  ');

    await waitFor(() => {
      expect(submitRequests(requests)).toHaveLength(1);
    });

    const body = (submitRequests(requests)[0]?.body ?? {}) as Record<string, unknown>;

    expect(Object.keys(body)).toEqual(['reason']);
    expect(body.reason).toBe('정산 발주');
  });

  /**
   * **상세와 상신 사이의 틈에서도 두 번 나가지 않는다.**
   *
   * 실행을 누르면 상세 GET이 먼저 나가는데 그 응답이 오기 전에는 쓰기 훅이 아직 나가는 중이
   * 아니다 — 그 틈에 한 번 더 누르면 연쇄가 두 벌 돌고, 공통 훅이 호출마다 새 멱등 키를
   * 만들어 결재 요청이 두 건이 된다.
   */
  it('상세를 붙잡아 둔 사이에 두 번 눌러도 상신은 한 번만 나간다', async () => {
    const { requests, release, user } = renderScreen(approvalRoutes(), '?receipt=9101', [
      PO_DETAIL_PATH,
    ]);

    await setupAndRegister(user);
    await screen.findByText(t.result.createdTitle('SAMPLE-PO-9001'));
    await openSubmitConfirm(user);
    await user.click(confirmSubmitButton());

    /* 상세가 붙잡힌 동안 창의 두 버튼이 잠긴다 — 실행 버튼만 잠그면 닫고 다시 누른다. */
    expect(confirmSubmitButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.keepEditing })).toBeDisabled();

    await user.click(confirmSubmitButton());
    release();

    await waitFor(() => {
      expect(submitRequests(requests)).toHaveLength(1);
    });
    expect(getsTo(requests, PO_DETAIL_PATH)).toHaveLength(1);
  });

  /** 나가는 중에는 **사유 칸도 함께 잠긴다** — 보내는 글자와 화면의 글자가 갈리면 안 된다. */
  it('상신이 나가는 중에는 사유 칸이 잠기고 사유가 보인다', async () => {
    const { release, user } = renderScreen(approvalRoutes(), '?receipt=9101', [PO_DETAIL_PATH]);

    await setupAndRegister(user);
    await screen.findByText(t.result.createdTitle('SAMPLE-PO-9001'));
    await openSubmitConfirm(user);
    await user.click(confirmSubmitButton());

    expect(reasonInput()).toBeDisabled();
    expect(within(resultPane()).getByText(t.actionReasons.submitting)).toBeVisible();

    release();
  });
});

/**
 * **올린 뒤에는 결재함이 정본이다**(완료 조건 C30 · 계획 결정 11).
 */
describe('상신 성공(C30)', () => {
  it('결재에 올렸다고 말하고 결재함을 가리키며 확인 창이 닫힌다', async () => {
    const { user } = renderScreen(approvalRoutes());

    await registerAndSubmit(user);

    await screen.findByText(t.result.submittedTitle('SAMPLE-PO-9001'));

    expect(within(resultPane()).getByText(t.result.submittedDescription)).toBeVisible();
    /* 전표번호는 남는다 — 사용자가 옮겨 적는 값이다. */
    expect(within(resultPane()).getByText('SAMPLE-PO-9001')).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /**
   * **결재 대기 목록·진행 단계를 두지 않고 그 조회도 하지 않는다**(착수 이슈 §6 ③).
   *
   * 음성 단언 앞에 **짝 양성**을 세운다 — 올라간 뒤의 화면을 실제로 그린 상태에서 잰다.
   */
  it('결재 진행을 조회하지도 그리지도 않는다', async () => {
    const { requests, user } = renderScreen(approvalRoutes());

    await registerAndSubmit(user);

    await screen.findByText(t.result.submittedTitle('SAMPLE-PO-9001'));

    expect(approvalRequests(requests)).toHaveLength(0);
    expect(within(resultPane()).queryAllByRole('table')).toHaveLength(0);
    expect(within(resultPane()).queryAllByRole('list')).toHaveLength(0);
  });

  /**
   * **상세 키 무효화가 재조회를 부르지 않는다.** 이 화면에는 그 키를 보는 구획이 없다 —
   * 무효화는 다음 쓰기가 낡은 토큰을 쓰지 않게 하려는 것이고, 응답을 다시 그리려는 것이 아니다.
   */
  it('올린 뒤에 상세를 다시 부르지 않고 입하 상세도 그대로다', async () => {
    const { requests, user } = renderScreen(approvalRoutes());

    await registerAndSubmit(user);

    await screen.findByText(t.result.submittedTitle('SAMPLE-PO-9001'));

    expect(getsTo(requests, PO_DETAIL_PATH)).toHaveLength(1);
    expect(requestsTo(requests, RECEIPT_PATH)).toHaveLength(1);
  });

  /** 올린 뒤에는 **다시 올릴 칸과 버튼을 두지 않는다** — 그 자리는 결재함 안내가 대신한다. */
  it('올린 뒤에는 사유 칸과 승인 요청 버튼이 사라진다', async () => {
    const { user } = renderScreen(approvalRoutes());

    await registerAndSubmit(user);

    await screen.findByText(t.result.submittedTitle('SAMPLE-PO-9001'));

    expect(screen.queryByLabelText(t.submit.reason)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: t.actions.requestApproval }),
    ).not.toBeInTheDocument();
  });
});

/**
 * **상신이 실패해도 전표는 남는다**(완료 조건 C31).
 *
 * 통째로 실패라고 말하면 사용자가 처음부터 다시 만들어 전표가 두 벌 남는다.
 */
describe('상신 실패(C31)', () => {
  it('검증 실패는 전표를 남기고 다시 올릴 길을 주며 창이 닫히지 않는다', async () => {
    const { user } = renderScreen(approvalRoutes(failingSubmitRoute(400)));

    await registerAndSubmit(user);

    expect(await screen.findByText(t.result.submitFailedTitle('SAMPLE-PO-9001'))).toBeVisible();
    expect(within(resultPane()).getByText(t.result.submitFailedDescription)).toBeVisible();
    expect(within(resultPane()).getByText('SAMPLE-PO-9001')).toBeVisible();
    /* 친 사유가 남아 있어야 **다시 올릴 길**이 실제 길이 된다. */
    expect(reasonInput()).toHaveValue('초과 입하분 정산 발주');
    expect(requestApprovalButton()).toBeEnabled();
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  /** 서버가 사유 칸에 준 오류는 **그 칸에** 붙는다 — 배너로 옮기면 무엇을 고칠지 가리키지 못한다. */
  it('사유에 대한 서버 오류는 사유 칸에 붙는다', async () => {
    const { user } = renderScreen(
      approvalRoutes(
        failingSubmitRoute(400, {
          errors: [{ scope: 'field', field: 'reason', code: 'INVALID', message: '합성 사유 문구' }],
        }),
      ),
    );

    await registerAndSubmit(user);

    expect(await screen.findByText('합성 사유 문구')).toBeVisible();
    expect(reasonInput()).toHaveAccessibleDescription(/합성 사유 문구/);
    /*
     * **인라인으로 소화된 실패도 실패다.** 배너로 올라오지 않았다고 「아직 아무 일도 없었다」로
     * 그리면 상신이 한 번 튕긴 사실이 화면 어디에도 남지 않는다.
     */
    expect(screen.getByText(t.result.submitFailedTitle('SAMPLE-PO-9001'))).toBeVisible();
  });

  it('권한 없음은 권한 문구를 내고 창이 닫히지 않는다', async () => {
    const { user } = renderScreen(approvalRoutes(failingSubmitRoute(403)));

    await registerAndSubmit(user);

    expect(await screen.findByText(messages.httpError.forbidden)).toBeVisible();
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  /**
   * **409는 다시 읽으면 풀린다** — 이 화면은 상신 때마다 상세를 다시 부르므로 다시 누르면
   * 실제로 새 토큰으로 나간다(완료 조건 C31).
   */
  it('저장 충돌에는 「최신 불러오기」가 서고 다시 누르면 새 토큰으로 올라간다', async () => {
    const { requests, user } = renderScreen(
      approvalRoutes(conflictThenOkSubmitRoute(), detailRoute([DETAIL_ETAG, RELOADED_ETAG])),
    );

    await registerAndSubmit(user);

    expect(await screen.findByText(messages.conflict.user)).toBeVisible();
    expect(screen.getByRole('button', { name: messages.conflict.reloadAction })).toBeVisible();
    expect(screen.getByRole('dialog')).toBeVisible();

    await user.click(confirmSubmitButton());

    await screen.findByText(t.result.submittedTitle('SAMPLE-PO-9001'));

    const submitted = submitRequests(requests);

    expect(submitted).toHaveLength(2);
    expect(submitted[0]?.headers.get('If-Match')).toBe(DETAIL_ETAG);
    expect(submitted[1]?.headers.get('If-Match')).toBe(RELOADED_ETAG);
    expect(getsTo(requests, PO_DETAIL_PATH)).toHaveLength(2);
  });

  /** 「최신 불러오기」는 **토큰만 다시 받는다** — 친 사유가 사라지지 않는다. */
  it('「최신 불러오기」를 눌러도 친 사유가 남는다', async () => {
    const { requests, user } = renderScreen(
      approvalRoutes(failingSubmitRoute(409, { conflictCause: 'user', message: '' })),
    );

    await registerAndSubmit(user);

    await screen.findByText(messages.conflict.user);
    await user.click(screen.getByRole('button', { name: messages.conflict.reloadAction }));

    await waitFor(() => {
      expect(getsTo(requests, PO_DETAIL_PATH)).toHaveLength(2);
    });
    expect(reasonInput()).toHaveValue('초과 입하분 정산 발주');
  });

  /**
   * **토큰을 얻지 못하면 보내지 않는다**(계획 결정 10 · 공통 훅의 규율).
   *
   * 빈 `If-Match`는 계약 위반이라 서버가 400으로 되돌린다 — 사용자가 고칠 수 없는 오류다.
   */
  it('상세를 못 부르면 상신을 보내지 않고 그 사실을 말한다', async () => {
    const { requests, user } = renderScreen(approvalRoutes(submitRoute(), failingDetailRoute(500)));

    await registerAndSubmit(user);

    expect(await screen.findByText(messages.save.staleToken)).toBeVisible();
    expect(submitRequests(requests)).toHaveLength(0);
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  /**
   * **Escape로 창이 닫혀도 나가는 상신이 무너지지 않는다**(사본 체크리스트 5번의 셋째 방어 ·
   * 화면 겹).
   *
   * 부품은 「Escape를 상신으로 잇지 않는다」를 재고, 여기서는 **닫힌 뒤에도 결과가 도착하는가**를
   * 잰다 — 창의 `onClose`가 쓰기를 되돌리면(`reset`) 나가는 요청의 되먹임이 통째로 사라진다.
   */
  it('전송 중 Escape로 창이 닫혀도 상신 결과가 도착한다', async () => {
    const { requests, release, user } = renderScreen(approvalRoutes(), '?receipt=9101', [
      PO_DETAIL_PATH,
    ]);

    await setupAndRegister(user);
    await screen.findByText(t.result.createdTitle('SAMPLE-PO-9001'));
    await openSubmitConfirm(user);
    await user.click(confirmSubmitButton());

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(resultPane()).getByText(t.actionReasons.submitting)).toBeVisible();

    release();

    await screen.findByText(t.result.submittedTitle('SAMPLE-PO-9001'));

    expect(submitRequests(requests)).toHaveLength(1);
  });

  /**
   * **늦게 도착한 성공이 남의 전표 위에 서지 않는다**(리뷰 R-24 · 전례 `disposal-issue`의 매임 축).
   *
   * 나가는 중인 쓰기를 끊지 않는 것이 이 화면의 규율이라(`resetIfIdle`), 대상을 바꾼 **뒤에**
   * 202가 도착하는 길이 실재한다 — **주소는 잠글 수 없다.** 그때 「올렸다」를 깃발로만 들고
   * 있으면 **올린 적 없는 전표 위에** 성공 갈래가 서고, 그 갈래에서는 사유 칸과 버튼이 서지
   * 않아 그 전표를 올릴 길까지 사라진다.
   *
   * 짝 양성으로 **새 대상의 결과 구획이 실제로 선다**를 함께 잰다 — 「아무것도 안 그려서
   * 통과」를 막는다.
   */
  it('보내는 동안 주소로 대상을 바꾸면 뒤늦게 온 성공이 새 전표 위에 서지 않는다', async () => {
    const { requests, release, user } = renderScreen(
      [
        secondReceiptRoute(),
        detailRoute(),
        submitRoute(),
        createRouteSequence(),
        ...allRoutes(SINGLE_LINE),
      ],
      '?receipt=9101',
      [SUBMIT_PATH],
    );

    await setupAndRegister(user);
    await screen.findByText(t.result.createdTitle('SAMPLE-PO-9001'));
    await openSubmitConfirm(user);
    await user.click(confirmSubmitButton());

    await waitFor(() => {
      expect(submitRequests(requests)).toHaveLength(1);
    });

    /* 상신이 붙잡힌 채 대상이 바뀐다 — 정리 effect가 여기서 지나간다. */
    await user.click(screen.getByRole('button', { name: '대상 바꾸기' }));
    await screen.findByText('SAMPLE-IR-9102');

    release();

    /* 뒤늦은 202가 도착한 뒤 **새 대상에서** 등록까지 마친다. */
    await fillHeader(user);
    await openConfirm(user);
    await submitConfirm(user);

    await screen.findByText(t.result.createdTitle('SAMPLE-PO-9002'));

    expect(screen.queryByText(t.result.submittedTitle('SAMPLE-PO-9002'))).not.toBeInTheDocument();
    expect(screen.queryByText(t.result.submittedDescription)).not.toBeInTheDocument();
    /* 올릴 길도 남아 있다 — 성공 갈래가 서면 이 둘이 사라진다. */
    expect(reasonInput()).toBeVisible();
    expect(requestApprovalButton()).toBeVisible();
    expect(submitRequests(requests)).toHaveLength(1);
  });
});

/**
 * **재조회가 친 값을 되돌리지 않는다**(오케스트레이터 로그 T3 이관 ① · 검증 T1 r2 권고 A).
 *
 * 머리 초안의 되돌림 축이 응답 객체(`sourceData`)가 되면, 같은 전표를 다시 받는 것만으로 사용자가
 * 친 사업부·발주일이 말없이 사라진다. 실경로는 **연결 복구 재조회**다 — 앱 기본값이
 * `refetchOnReconnect: true`라 사용자가 아무것도 하지 않아도 일어난다.
 *
 * **호출 횟수에 따라 내용까지 달라지는 스텁**을 쓴다(사본 체크리스트 11번). 같은 값을 다시 주면
 * 조회 캐시가 구조를 공유해 참조가 그대로라 축이 무엇이든 아무 일도 일어나지 않는다 — 그 스텁으로는
 * 이 결함을 잡을 수 없다.
 */
describe('재조회와 친 값(이관 ①)', () => {
  it('다른 줄의 값이 달라져 와도 친 값과 고른 줄의 초안이 남는다', async () => {
    let call = 0;
    const changingReceiptRoute: StubRoute = {
      match: (request) => isGet(request, RECEIPT_PATH),
      respond: () => {
        call += 1;

        /* 둘째 응답은 **고르지 않은 줄**만 달라진다 — 승계 원천(공급사·공장)은 그대로다. */
        return jsonResponse(
          inboundReceiptDetailBody([
            inboundReceiptLineResponse(),
            inboundReceiptLineResponse({
              inboundReceiptLineId: 9112,
              lineNo: 2,
              itemId: 9502,
              receivedQty: call === 1 ? 4 : 7,
            }),
          ]),
        );
      },
    };

    const { requests, queryClient, user } = renderScreen(
      [changingReceiptRoute, ...lookupRoutes(), ...forbiddenRoutes()],
      '?receipt=9101&line=9111',
    );

    await waitForSource();
    await fillHeader(user);
    await user.clear(qtyInput(1));
    await user.type(qtyInput(1), '20');

    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ['po-register', 'source-receipt', 9101] });
    });

    /* 짝 양성 — 재조회가 실제로 일어났고 바뀐 값이 대상 구획에 도착했다. */
    expect(requestsTo(requests, RECEIPT_PATH)).toHaveLength(2);
    await waitFor(() => {
      expect(within(sourcePane()).getByText('7')).toBeInTheDocument();
    });

    expect(screen.getByLabelText(t.fields.businessUnit)).toHaveTextContent('합성 사업부 가');
    expect(screen.getByLabelText(t.fields.supplier)).toHaveTextContent(SUPPLIER_LABEL);
    expect(qtyInput(1)).toHaveValue(20);
  });
});
