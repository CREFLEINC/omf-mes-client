import { messages } from '@omf-mes/i18n';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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
import type { DocumentTypeEntry } from './document-types';
import {
  approvalRequestDetail,
  cancelResult,
  documentProgress,
  documentProgressDetail,
  documentProgressFixtures,
  documentTypeFixtures,
  toDetailResponse,
  toProgressResponse,
} from './fixtures';

const t = messages.documentProgress;

/**
 * 갈아 끼울 수 있는 유형 표.
 *
 * ⭐ **판정·조회·안내는 실물 그대로**이고 바뀌는 것은 「값 목록이 왔다」는 사실 하나다.
 * 채웠을 때 화면이 달라지지 않으면 그 자리표시는 죽은 가지이며, 그것을 재는 것이 이 목의 목적이다.
 */
const documentTypes: DocumentTypeEntry[] = [];

vi.mock('./document-types', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./document-types')>();

  return { ...actual, DOCUMENT_TYPES: documentTypes };
});

/**
 * 갈아 끼울 수 있는 화면 ID → 주소 표.
 *
 * ⭐ **화면이 그 표를 실제로 아래 구획에 넘기는가**를 재기 위해 화면 수준에서 갈아 끼운다.
 * 부품 수준 감지기는 표를 직접 받으므로 이 배선을 지나지 않는다 — 배선이 조용히 끊겨도
 * 부품 감지기는 전부 통과한다.
 */
const screenRoutes: Record<string, string> = {};

vi.mock('./screen-routes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./screen-routes')>();

  return { ...actual, SCREEN_ROUTES: screenRoutes };
});

/**
 * 갈아 끼울 수 있는 **승인 완료 상태 코드** 자리표시.
 *
 * ⭐ **화면이 이 상수를 읽어 구획에 넘기는가**를 재기 위해 화면 수준에서 갈아 끼운다. 부품
 * 수준 감지기는 판정 결과를 prop으로 직접 받으므로 이 배선을 지나지 않는다 — 배선이 조용히
 * 끊겨도(예: 늘 `true`를 넘기면) 부품 감지기는 전부 통과한다.
 *
 * ⛔ **판정 함수는 실물 그대로다** — 바뀌는 것은 「값 목록이 왔다」는 사실 하나다.
 */
const approvedStatusCodes: string[] = [];

vi.mock('./approval-progress', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./approval-progress')>();

  return { ...actual, APPROVED_APPROVAL_STATUS_CODES: approvedStatusCodes };
});

/* 목을 걸고 난 뒤에 화면을 들여온다 — 위에서 들여오면 실물 상수가 먼저 박힌다. */
const { DocumentProgressScreen } = await import('./screen');

const ROUTE = '/logistics/document-progress';
const LIST_PATH = '/logistics/document-progress';

const SELECTABLE_TYPE = 'SYN_DOC_TYPE_A';
const DISABLED_TYPE = 'SYN_DOC_TYPE_C';

beforeEach(() => {
  documentTypes.length = 0;
  locationLog.length = 0;
  approvedStatusCodes.length = 0;

  for (const key of Object.keys(screenRoutes)) delete screenRoutes[key];
});

const fillDocumentTypes = (): void => {
  documentTypes.push(...documentTypeFixtures);
};

interface RecordedRequest {
  method: string;
  url: URL;
  /**
   * 실제로 나간 헤더.
   *
   * **쓰기의 규약이 헤더에 있다** — 멱등 키와 잠금 토큰은 본문에 없으므로, 기록하지 않으면
   * 「어느 경로에서 꺼낸 토큰을 실었는가」를 잴 길이 없다.
   */
  headers: Headers;
  /**
   * 쓰기 요청의 본문. 읽기에는 `null`이다.
   *
   * **실제로 나간 요청을 본다** — 화면이 만들었다고 믿는 것이 아니라 서버가 받을 것을 잰다.
   */
  body: unknown;
  /**
   * 실제로 나간 본문 **글자 그대로**.
   *
   * ⭐ **「본문이 없다」를 재려면 이 자리가 필요하다**(완료 조건 C4-11 — 취소 실행). 파싱한 값만
   * 두면 「아무것도 싣지 않았다」와 「`null`을 실었다」가 같은 모양이 된다.
   */
  rawBody: string;
}

/**
 * 요청을 기록하면서 스텁 규칙으로 응답한다. 규칙에 없는 요청은 하네스가 던져 스텁 누락을 드러낸다.
 *
 * `hold`에 든 경로는 **기록한 뒤에** 붙잡아 둔다 — 「보내는 동안 무엇이 잠기는가」와 「응답이 오기
 * 전에 화면이 무엇을 말하는가」를 재려면 그 상태에 머무를 수 있어야 하고, 요청이 실제로 나갔다는
 * 사실은 기록으로 증명돼야 한다(「아직 안 보냈다」와 「보냈는데 안 왔다」는 다른 상태다).
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
    const rawBody = request.method === 'GET' ? '' : await request.clone().text();

    requests.push({
      method: request.method,
      url: new URL(request.url),
      headers: new Headers(request.headers),
      body: rawBody === '' ? null : JSON.parse(rawBody),
      rawBody,
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

const listBody = (
  items: unknown[],
  page: Partial<{ page: number; size: number; total: number }> = {},
) => ({
  items,
  page: { page: 1, size: 50, total: items.length, ...page },
});

const listRoute = (
  items = documentProgressFixtures,
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isGet(request, LIST_PATH),
  respond: () => jsonResponse(listBody(items.map(toProgressResponse), page)),
});

const failingListRoute = (status: number, body: unknown = { message: '' }): StubRoute => ({
  match: (request) => isGet(request, LIST_PATH),
  respond: () => jsonResponse(body, { status }),
});

/** 고른 문서의 상세 경로. **유형과 번호가 둘 다** 경로에 실린다(계약). */
const detailPathOf = (documentTypeCode: string, documentId: number): string =>
  `${LIST_PATH}/${documentTypeCode}/${String(documentId)}`;

const DETAIL_PATH = detailPathOf(SELECTABLE_TYPE, 9001);

const detailRoute = (detail = documentProgressDetail(), pathname = DETAIL_PATH): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse(toDetailResponse(detail)),
});

const failingDetailRoute = (status: number, pathname = DETAIL_PATH): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse({ message: '상세를 불러오지 못했습니다' }, { status }),
});

const detailRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname.startsWith(`${LIST_PATH}/`));

/* ─────────────────────────────────────────────────────────────────────────────
 * 취소 축(단위 ③)의 자리 — 유형 표의 **취소 리소스 열**이 정하는 경로들
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * ⭐ **취소 리소스가 있는 유형.** 픽스처의 「합성 유형 나」이며 리소스는 `goods-receipts`다.
 *
 * 앞선 회차의 감지기들이 쓰는 「합성 유형 가」에는 **일부러 취소 리소스를 두지 않았다** —
 * 계약의 취소 경로가 셋뿐이라 덮는 유형 중 일부에 취소가 없는 것이 실제 형태이고, 그 유형에서
 * 취소 축이 서지 않는 것(C3-1)이 이 회차가 재야 할 갈래이기 때문이다.
 */
const CANCEL_TYPE = 'SYN_DOC_TYPE_B';

/** 잠금 토큰이 오는 자리 — **진행현황 상세가 아니라 문서 리소스 상세**다(계획 §5-1). */
const CANCEL_RESOURCE_PATH = '/logistics/goods-receipts/9001';
const OTHER_CANCEL_RESOURCE_PATH = '/logistics/goods-receipts/9002';
const REQUEST_CANCEL_PATH = `${CANCEL_RESOURCE_PATH}:request-cancel`;

const CANCEL_DETAIL_PATH = detailPathOf(CANCEL_TYPE, 9001);
const OTHER_CANCEL_DETAIL_PATH = detailPathOf(CANCEL_TYPE, 9002);

/** 리소스 상세 200이 내려 주는 잠금 토큰. **다음 쓰기의 `If-Match`에 이 값이 그대로 실려야 한다.** */
const CANCEL_RESOURCE_ETAG = '"token-9001"';

/** 취소 리소스가 있는 유형의 목록 행. 조건의 유형과 행의 유형이 어긋나지 않게 맞춘다. */
const cancelableRows = documentProgressFixtures.map((row) => ({
  ...row,
  documentTypeCode: CANCEL_TYPE,
}));

const cancelableDetail = (
  progress: Partial<(typeof documentProgressFixtures)[number]> = {},
  /**
   * 상세 뷰 자체의 값 — **취소 요청의 승인 요청 번호가 여기 있다**(단위 ④). 목록 행이 아니라
   * 상세가 그 값을 든다.
   */
  detail: Parameters<typeof documentProgressDetail>[0] = {},
) =>
  documentProgressDetail({
    progress: documentProgress({
      documentTypeCode: CANCEL_TYPE,
      statusCode: 'SYN_STATUS_DETAIL',
      ...progress,
    }),
    ...detail,
  });

/**
 * 리소스 상세 — **본문이 아니라 `ETag` 헤더가 이 조회의 목적이다.**
 *
 * 본문을 비워 두는 것이 그 사실을 그대로 보인다: 화면은 이 응답의 어떤 값도 그리지 않는다.
 */
const cancelResourceRoute = (
  etag = CANCEL_RESOURCE_ETAG,
  pathname = CANCEL_RESOURCE_PATH,
): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse({}, { headers: { ETag: etag } }),
});

const failingCancelResourceRoute = (status: number, message = '리소스 상세 실패'): StubRoute => ({
  match: (request) => isGet(request, CANCEL_RESOURCE_PATH),
  respond: () => jsonResponse({ message }, { status }),
});

/** 취소 요청 202. **응답이 내부 식별자 하나뿐이다** — 화면에 낼 번호가 없다(omf-mes#44). */
const APPROVAL_REQUEST_ID = 9601;

const requestCancelRoute = (): StubRoute => ({
  match: (request) => isPost(request, REQUEST_CANCEL_PATH),
  respond: () => jsonResponse({ approvalRequestId: APPROVAL_REQUEST_ID }, { status: 202 }),
});

const failingRequestCancelRoute = (status: number, body: unknown): StubRoute => ({
  match: (request) => isPost(request, REQUEST_CANCEL_PATH),
  respond: () => jsonResponse(body, { status }),
});

/** 취소 축이 선 화면을 세우는 데 필요한 스텁 한 벌. **부르지 않음을 증명하려면 부를 수 있어야 한다.** */
const cancelRoutes = (overrides: StubRoute[] = []): StubRoute[] => [
  ...overrides,
  listRoute(cancelableRows),
  detailRoute(cancelableDetail(), CANCEL_DETAIL_PATH),
  detailRoute(cancelableDetail(), OTHER_CANCEL_DETAIL_PATH),
  cancelResourceRoute(),
  cancelResourceRoute('"token-9002"', OTHER_CANCEL_RESOURCE_PATH),
  requestCancelRoute(),
];

const requestsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === pathname);

/** 실제로 나간 쓰기. **경로와 method를 함께** 본다 — 한쪽만 세면 다른 경로의 쓰기를 놓친다. */
const writesTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.method === 'POST' && request.url.pathname === pathname);

const cancelPane = (): HTMLElement => screen.getByRole('region', { name: t.cancelRequest.label });

const requestCancelButton = (): HTMLElement =>
  within(cancelPane()).getByRole('button', { name: t.cancelRequest.label });

/**
 * 화면이 **거쳐 간** 주소를 전부 적어 둔다.
 *
 * 마지막 주소만 보면 「정리가 히스토리를 늘렸는가」를 가릴 수 없다 — 정리가 히스토리를 늘린
 * 경우에도 뒤로 간 뒤 정리가 **한 번 더 일어나** 결국 같은 주소로 수렴하기 때문이다. 갈리는 것은
 * **그 사이에 없는 문서 주소를 거쳤는가**이며, 그것은 거쳐 간 자취로만 보인다.
 */
const locationLog: string[] = [];

/** 주소가 실제로 어떻게 바뀌는지 본다. */
const LocationProbe = () => {
  const location = useLocation();
  const current = `${location.pathname}${location.search}`;

  /* 렌더마다 적는다 — 이 화면 시험은 엄격 모드로 그리지 않아 두 번 적히지 않는다. */
  locationLog.push(current);

  return <output data-testid="location">{current}</output>;
};

/**
 * **화면 바깥에서** 주소를 갈아 끼운다. 뒤로가기·앞으로가기·주소 직접 편집이 이 경로다 —
 * 셋 모두 화면의 클릭 핸들러를 거치지 않고 검색 파라미터만 바뀐다.
 *
 * 「목록을 한 번도 부르지 않는다」를 **경로 전체**에서 세려면 이 통로가 있어야 한다.
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
  release: () => void;
  user: ReturnType<typeof userEvent.setup>;
} => {
  const { fetch, requests, release } = createRecordingFetch(routes, hold);

  renderWithProviders(
    <>
      <DocumentProgressScreen />
      <LocationProbe />
      <SearchProbe to={navigateTo} />
      <BackProbe />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, release, user: userEvent.setup() };
};

const listRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === LIST_PATH);

const lastListQuery = (requests: RecordedRequest[]): URLSearchParams => {
  const calls = listRequests(requests);
  const last = calls[calls.length - 1];

  if (last === undefined) throw new Error('목록 요청이 한 번도 나가지 않았다');

  return last.url.searchParams;
};

const locationOf = (): string => screen.getByTestId('location').textContent ?? '';

describe('유형 자리표시가 비어 있는 동안', () => {
  /**
   * ⭐ **경로 전체에서 센다.** 첫 렌더 · 조회 버튼 · 쪽 이동 · 주소 직접 편집 넷 중 어느
   * 하나라도 새면 값 없는 요청이 나간다. 「첫 렌더에서 안 나갔다」만 재면 그 셋이 통째로 샌다.
   */
  it('목록 요청이 한 번도 나가지 않는다', async () => {
    const { requests, user } = renderScreen([], '', `ty=${SELECTABLE_TYPE}&page=2`);

    expect(listRequests(requests)).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: messages.common.search }));
    expect(listRequests(requests)).toHaveLength(0);

    /* 주소를 손으로 고쳐 유형과 쪽을 넣어도 마찬가지다 — 표에 없는 값이기 때문이다. */
    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await waitFor(() => {
      expect(locationOf()).toContain(`ty=${SELECTABLE_TYPE}`);
    });
    expect(listRequests(requests)).toHaveLength(0);

    /* 전체 요청 수로도 확인한다 — 이 화면은 이 회차에 다른 조회도 갖지 않는다. */
    expect(requests).toHaveLength(0);
  });

  /* 빈 표를 내면 사용자는 조건에 맞는 문서가 없는 줄 알고 조건을 넓히며 헤맨다. */
  it('빈 표가 아니라 「선택지 준비 중」 안내가 선다', () => {
    renderScreen([]);

    expect(screen.getByText(t.empty.typesPendingTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
  });

  /* 조건 줄은 감추지 않는다 — 무엇을 고를 수 있게 되는지 화면에서 보여야 한다. */
  it('조건 줄은 그대로 서 있다', () => {
    renderScreen([]);

    expect(screen.getByLabelText(t.fields.documentType)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.common.search })).toBeEnabled();
  });

  /* 조회가 성립하지 않으므로 쪽 이동을 낼 것이 없다. */
  it('쪽 이동이 서지 않는다', () => {
    renderScreen([]);

    expect(screen.queryByRole('navigation', { name: t.pageNav.label })).not.toBeInTheDocument();
  });

  /**
   * ⭐ **상세도 같은 잣대를 탄다.** 주소에 고른 문서가 실려 있어도 유형 표가 비어 있으면
   * 상세 조회가 나가지 않는다 — 잣대가 갈리면 「목록은 못 부르는데 상세만 나가는」 화면이 된다.
   * **경로 전체에서 센다**(첫 렌더 · 주소 직접 편집).
   */
  it('주소에 고른 문서가 실려 있어도 상세를 한 번도 부르지 않는다', async () => {
    const { requests, user } = renderScreen(
      [],
      `?ty=${SELECTABLE_TYPE}&sel=9001`,
      `ty=${SELECTABLE_TYPE}&sel=9002`,
    );

    expect(requests).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await waitFor(() => {
      expect(locationOf()).toContain('sel=9002');
    });

    expect(requests).toHaveLength(0);
  });

  /*
   * 아래 구획 자체를 내지 않는다 — 조회가 성립하지 않아 **고를 대상이 없으므로**,
   * 「고르세요」를 내면 할 수 없는 일을 시키는 안내가 된다.
   */
  it('상세 구획이 서지 않는다', () => {
    renderScreen([]);

    expect(screen.queryByRole('region', { name: t.panes.detail })).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.noSelectionTitle)).not.toBeInTheDocument();
  });
});

describe('유형 표를 채우면 — 조회가 살아난다', () => {
  /**
   * ⭐ **표 한 곳만 채웠는데 화면이 살아난다.** 다른 자리는 하나도 바뀌지 않았다 —
   * 이것이 자리표시가 죽은 가지가 아니라는 증거다.
   */
  it('유형을 고르면 그 값이 질의에 실린다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen([listRoute()]);

    expect(listRequests(requests)).toHaveLength(0);

    await user.click(screen.getByLabelText(t.fields.documentType));
    await user.click(screen.getByRole('option', { name: '합성 유형 가' }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(listRequests(requests)).toHaveLength(1);
    });
    expect(lastListQuery(requests).get('documentTypeCode')).toBe(SELECTABLE_TYPE);
  });

  it('주소에 유형이 실려 들어와도 곧바로 조회한다', async () => {
    fillDocumentTypes();
    const { requests } = renderScreen([listRoute()], `?ty=${SELECTABLE_TYPE}`);

    await waitFor(() => {
      expect(listRequests(requests)).toHaveLength(1);
    });
  });

  /* ⛔ 비활성 유형으로는 요청이 나가지 않는다 — 주소를 손으로 고쳐도 마찬가지다. */
  it('고를 수 없는 유형이 주소에 실려도 조회하지 않는다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen([listRoute()], `?ty=${DISABLED_TYPE}`);

    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(listRequests(requests)).toHaveLength(0);
    expect(screen.getByText(t.empty.noDocumentTypeTitle)).toBeInTheDocument();
  });

  /**
   * ⭐ **고를 수 없는 유형의 사유가 화면에 닿는 유일한 경로**다(착수 이슈 §4의 미결 처리 —
   * 외주 2문서를 「비활성 + 사유 표시」로 다루기로 했다).
   *
   * 이 배선이 조용히 끊겨도 조건 줄은 멀쩡해 보이고 목록도 그대로다 — 사라진 것은 **왜 그 유형을
   * 고를 수 없는지**뿐이라 아무도 모른다. 그래서 화면 수준에서 잰다: 순수 함수 감지기도, 사유를
   * prop으로 직접 받는 조건 줄 감지기도 이 배선을 지나지 않는다.
   */
  it('유형 표에 막힌 줄이 있으면 그 사유가 조건 줄에 글자로 선다', () => {
    fillDocumentTypes();
    renderScreen([listRoute()]);

    expect(screen.getByText(/합성 유형 다: 이 유형에는 상태 컬럼이 없어/)).toBeInTheDocument();
  });

  /* 짝 방향 — 막힌 줄이 없으면 그 안내가 서지 않는다(앞 단언이 늘 참이 아니다). */
  it('막힌 줄이 없으면 그 안내가 서지 않는다', () => {
    documentTypes.push({
      code: SELECTABLE_TYPE,
      label: '합성 유형 가',
      cancelResource: null,
      disabledReason: null,
    });
    renderScreen([listRoute()]);

    expect(screen.queryByText(/고를 수 없는 유형이 있습니다/)).not.toBeInTheDocument();
  });
});

describe('초기화', () => {
  /**
   * ⭐ **초기화가 주소를 비우지 않으면 화면이 두 가지를 말한다.**
   *
   * 조건 줄은 자기 상태를 비워 **빈 것으로 보이는데** 주소가 옛 조건 그대로면 목록도 옛 조건
   * 그대로 남는다(되돌림 effect는 값 기준이라 깨어나지 않는다). 「초기화를 눌렀는데 조건 줄과
   * 목록이 서로 다른 것을 말하는」 상태다.
   *
   * **두 축으로 잰다** — 주소 문자열이 비었는가, 그리고 **요청이 옛 조건으로 다시 나가지
   * 않았는가**. 주소만 재면 요청이 옛 조건으로 나가도 통과한다.
   *
   * ⭐ **여기서 새 요청은 나가지 않는다.** 초기화가 유형까지 비우므로 조회가 성립하지 않는다 —
   * 「조건 없이 다시 나간다」는 유형을 남기는 **아래 짝 시험**의 몫이다.
   */
  it('초기화가 주소의 조건을 비우고 옛 조건으로 다시 나가지 않는다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen(
      [listRoute()],
      `?ty=${SELECTABLE_TYPE}&q=SYN-GR&item=9301&conly=1&page=2`,
    );

    await waitFor(() => {
      expect(listRequests(requests)).toHaveLength(1);
    });
    expect(lastListQuery(requests).get('q')).toBe('SYN-GR');

    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(locationOf()).toBe('/logistics/document-progress');
    });

    /* 유형까지 비워지므로 조회가 성립하지 않아 새 요청이 나가지 않는다 — 옛 조건도 남지 않는다. */
    await waitFor(() => {
      expect(screen.getByText(t.empty.noDocumentTypeTitle)).toBeInTheDocument();
    });
    expect(lastListQuery(requests).get('q')).toBe('SYN-GR');
    expect(listRequests(requests)).toHaveLength(1);
  });

  /* 유형을 남긴 채 나머지만 비우는 경로도 같은 규칙을 탄다 — 이쪽은 **요청이 다시 나간다.** */
  it('초기화 뒤 유형을 다시 고르면 옛 조건 없이 조회한다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen([listRoute()], `?ty=${SELECTABLE_TYPE}&q=SYN-GR`);

    await waitFor(() => {
      expect(listRequests(requests)).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: messages.common.reset }));
    await user.click(screen.getByLabelText(t.fields.documentType));
    await user.click(screen.getByRole('option', { name: '합성 유형 가' }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(listRequests(requests)).toHaveLength(2);
    });

    const query = lastListQuery(requests);

    expect(query.get('documentTypeCode')).toBe(SELECTABLE_TYPE);
    expect(query.has('q')).toBe(false);
  });
});

describe('조회 조건이 질의로 나간다', () => {
  it('취소 가능 조건을 끄면 거짓이 실린다 — 빠지지 않는다', async () => {
    fillDocumentTypes();
    const { requests } = renderScreen([listRoute()], `?ty=${SELECTABLE_TYPE}`);

    await waitFor(() => {
      expect(listRequests(requests)).toHaveLength(1);
    });

    const query = lastListQuery(requests);

    expect(query.has('cancellableOnly')).toBe(true);
    expect(query.get('cancellableOnly')).toBe('false');
  });

  it('취소 가능 조건을 켜면 참이 실린다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen([listRoute()], `?ty=${SELECTABLE_TYPE}`);

    await waitFor(() => {
      expect(listRequests(requests)).toHaveLength(1);
    });

    await user.click(screen.getByRole('checkbox', { name: t.fields.cancellableOnly }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(lastListQuery(requests).get('cancellableOnly')).toBe('true');
    });
  });

  /* 완결된 쌍이 정해진 뒤에만 두 값이 실린다 — 반쪽 기간으로는 요청이 나가지 않는다. */
  it('기간을 고르면 두 값이 함께 실린다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen([listRoute()], `?ty=${SELECTABLE_TYPE}`);

    await waitFor(() => {
      expect(listRequests(requests)).toHaveLength(1);
    });

    await pickRange(user, screen.getByLabelText(t.fields.period), '2026-08-01', '2026-08-05');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      const query = lastListQuery(requests);
      expect(query.get('documentDateFrom')).toBe('2026-08-01');
      expect(query.get('documentDateTo')).toBe('2026-08-05');
    });
  });

  it('번호 조건과 검색어가 실린다', async () => {
    fillDocumentTypes();
    const { requests } = renderScreen(
      [listRoute()],
      `?ty=${SELECTABLE_TYPE}&item=9301&lot=9601&wh=9701&q=SYN-GR`,
    );

    await waitFor(() => {
      expect(listRequests(requests)).toHaveLength(1);
    });

    const query = lastListQuery(requests);

    expect(query.get('itemId')).toBe('9301');
    expect(query.get('lotId')).toBe('9601');
    expect(query.get('warehouseId')).toBe('9701');
    expect(query.get('q')).toBe('SYN-GR');
  });

  /*
   * ⚠ 상태 자리표시가 비어 있어도 **조회를 막지 않는다.** 막으면 상태 값이 확정될 때까지
   * 그 자리가 영영 잠긴다.
   */
  it('상태 자리표시가 비어 있어도 목록이 나온다', async () => {
    fillDocumentTypes();
    const { requests } = renderScreen([listRoute()], `?ty=${SELECTABLE_TYPE}`);

    await waitFor(() => {
      expect(listRequests(requests)).toHaveLength(1);
    });
    expect(lastListQuery(requests).has('statusCode')).toBe(false);
    expect(await screen.findByText('SYN-GR-2026-0001')).toBeInTheDocument();
  });
});

describe('목록이 그려진다', () => {
  it('불러오는 동안 로딩 표시가 선다', async () => {
    fillDocumentTypes();
    renderScreen([listRoute()], `?ty=${SELECTABLE_TYPE}`);

    expect(screen.getByRole('status', { name: t.loading.list })).toBeInTheDocument();

    expect(await screen.findByText('SYN-GR-2026-0001')).toBeInTheDocument();
  });

  it('후속 건수와 취소 가능 여부가 목록 열에서 보인다', async () => {
    fillDocumentTypes();
    renderScreen([listRoute()], `?ty=${SELECTABLE_TYPE}`);

    expect(await screen.findByText('SYN-GR-2026-0002')).toBeInTheDocument();
    expect(screen.getByText(t.blockReasons.SUCCESSOR_EXISTS)).toBeInTheDocument();
    expect(screen.getByText('SYN_UNKNOWN_BLOCK_REASON')).toBeInTheDocument();
    expect(screen.getAllByText(t.cancel.available).length).toBeGreaterThan(0);
  });

  it('0건이면 빈 상태 문구가 보인다', async () => {
    fillDocumentTypes();
    renderScreen([listRoute([])], `?ty=${SELECTABLE_TYPE}`);

    expect(await screen.findByText(t.empty.noResultTitle)).toBeInTheDocument();
  });

  /* 내부 번호가 화면에 나오면 안 된다 — 타입에 자리를 두지 않은 것이 그 방어다. */
  it('내부 식별자가 화면에 나오지 않는다', async () => {
    fillDocumentTypes();
    renderScreen([listRoute()], `?ty=${SELECTABLE_TYPE}`);

    expect(await screen.findByText('SYN-GR-2026-0001')).toBeInTheDocument();
    expect(screen.queryByText('9001')).not.toBeInTheDocument();
    expect(screen.queryByText('9501')).not.toBeInTheDocument();
    expect(screen.queryByText('SYN-SCREEN-01')).not.toBeInTheDocument();
  });
});

describe('쪽 이동', () => {
  it('쪽을 옮기면 주소와 질의가 함께 바뀐다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen(
      [listRoute(documentProgressFixtures, { total: 120 })],
      `?ty=${SELECTABLE_TYPE}`,
    );

    expect(await screen.findByText('SYN-GR-2026-0001')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(locationOf()).toContain('page=2');
    });
    await waitFor(() => {
      expect(lastListQuery(requests).get('page')).toBe('2');
    });
  });

  it('총 건수가 보인다', async () => {
    fillDocumentTypes();
    renderScreen([listRoute(documentProgressFixtures, { total: 120 })], `?ty=${SELECTABLE_TYPE}`);

    expect(await screen.findByText(t.pageNav.range(1, 4, 120))).toBeInTheDocument();
  });

  /* 조건이 바뀌면 첫 쪽으로 되돌린다 — 3쪽을 보다 좁히면 결과가 3쪽에 못 미친다. */
  it('조건이 바뀌면 첫 쪽으로 되돌린다', async () => {
    fillDocumentTypes();
    const { user } = renderScreen(
      [listRoute(documentProgressFixtures, { total: 120 })],
      `?ty=${SELECTABLE_TYPE}&page=2`,
    );

    expect(await screen.findByText('SYN-GR-2026-0001')).toBeInTheDocument();

    await user.type(screen.getByLabelText(t.fields.q), 'SYN-GR');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(locationOf()).not.toContain('page=');
    });
  });

  /**
   * ⭐ **「첫 쪽으로」가 실제로 첫 쪽으로 데려가는지는 화면 수준에서만 잴 수 있다.**
   *
   * 표 감지기는 콜백이 불렸는지만 세므로, 화면이 그 콜백을 **지금 쪽으로** 배선해도 통과한다 —
   * 그러면 사용자는 「첫 쪽으로」를 눌렀는데 같은 빈 쪽에 그대로 머문다.
   */
  it('쪽 밖에서 「첫 쪽으로」를 누르면 주소와 질의가 첫 쪽으로 돌아온다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen(
      [listRoute([], { page: 5, total: 120 })],
      `?ty=${SELECTABLE_TYPE}&page=5`,
    );

    expect(await screen.findByText(t.empty.beyondLastTitle)).toBeInTheDocument();
    expect(lastListQuery(requests).get('page')).toBe('5');

    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));

    await waitFor(() => {
      expect(locationOf()).not.toContain('page=');
    });
    await waitFor(() => {
      expect(lastListQuery(requests).has('page')).toBe(false);
    });
  });
});

describe('고른 문서의 상세', () => {
  /**
   * ⭐ **상세 경로에 유형과 번호가 둘 다 실린다**(C2-1). 계약이 둘을 열쇠로 쓴다 —
   * 번호만 실으면 유형이 다른 같은 번호의 문서를 부른다.
   */
  it('행을 고르면 유형과 번호가 둘 다 실린 경로로 상세를 부른다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen([listRoute(), detailRoute()], `?ty=${SELECTABLE_TYPE}`);

    expect(await screen.findByText('SYN-GR-2026-0001')).toBeInTheDocument();
    expect(detailRequests(requests)).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: t.actions.selectRow('SYN-GR-2026-0001') }));

    await waitFor(() => {
      expect(detailRequests(requests)).toHaveLength(1);
    });
    expect(detailRequests(requests)[0]?.url.pathname).toBe(DETAIL_PATH);
    /* 고른 문서는 주소가 들고 있다 — 새로고침·공유가 같은 결과를 낸다. */
    await waitFor(() => {
      expect(locationOf()).toContain('sel=9001');
    });
  });

  /**
   * ⭐ **새로고침이 상세도 다시 부른다**(C2-9 · 직전 회차 W-01-07의 지적 사본).
   * 주소만 들고 처음 그리는 경우이며, 대상이 주소에서 나오므로 **목록 응답을 기다리지 않는다.**
   */
  it('주소에 고른 문서가 실려 들어오면 곧바로 상세를 부른다', async () => {
    fillDocumentTypes();
    const { requests } = renderScreen(
      [listRoute(), detailRoute()],
      `?ty=${SELECTABLE_TYPE}&sel=9001`,
    );

    await waitFor(() => {
      expect(detailRequests(requests)).toHaveLength(1);
    });
    expect(detailRequests(requests)[0]?.url.pathname).toBe(DETAIL_PATH);
  });

  /**
   * ⭐ **목록이 실패해도 상세는 선다.** 대상이 주소에서 나오므로 목록 응답에 매이지 않는다 —
   * 매이면 목록이 실패한 동안 고른 문서를 볼 길이 사라진다.
   */
  it('목록이 실패해도 상세는 부르고 아래 구획이 선다', async () => {
    fillDocumentTypes();
    const { requests } = renderScreen(
      [failingListRoute(500), detailRoute()],
      `?ty=${SELECTABLE_TYPE}&sel=9001`,
    );

    await waitFor(() => {
      expect(detailRequests(requests)).toHaveLength(1);
    });
    /* 부르기만 하고 감추면 사용자에게는 아무 소용이 없다 — 구획이 실제로 서는 것까지 잰다. */
    expect(await screen.findByRole('table', { name: t.steps.caption })).toBeInTheDocument();
    expect(screen.getByText(messages.httpError.loadTitle)).toBeInTheDocument();
  });

  /**
   * ⭐ **요약의 근거가 목록 행이 아니라 상세 응답이다**(C2-4). 두 응답의 상태 코드를 일부러
   * 다르게 두어, 목록 행으로 요약을 그리는 결함이 있으면 이 자리에서 갈린다.
   */
  it('요약이 목록 행이 아니라 상세 응답의 값을 보인다', async () => {
    fillDocumentTypes();
    renderScreen(
      [
        listRoute([documentProgress({ statusCode: 'SYN_STATUS_LIST' })]),
        detailRoute(
          documentProgressDetail({
            progress: documentProgress({ statusCode: 'SYN_STATUS_DETAIL' }),
          }),
        ),
      ],
      `?ty=${SELECTABLE_TYPE}&sel=9001`,
    );

    const summary = await screen.findByRole('group', {
      name: t.detail.summary('SYN-GR-2026-0001'),
    });

    expect(within(summary).getByText('SYN_STATUS_DETAIL')).toBeInTheDocument();
    expect(within(summary).queryByText('SYN_STATUS_LIST')).not.toBeInTheDocument();
  });

  it('처리 경과와 후속 목록이 함께 선다', async () => {
    fillDocumentTypes();
    renderScreen([listRoute(), detailRoute()], `?ty=${SELECTABLE_TYPE}&sel=9001`);

    expect(await screen.findByRole('table', { name: t.steps.caption })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: t.successors.caption })).toBeInTheDocument();
    /* 원장 번호는 영업일과 **함께** 보인다(C2-6). */
    expect(screen.getByText(t.ledger.pair('SYN-TX-9001', '2026-08-06'))).toBeInTheDocument();
  });

  /* 고르기 전에는 「고르면 보인다」를 낸다 — 빈 구획을 두면 고장으로 읽힌다. */
  it('고르기 전에는 고르라고 안내한다', async () => {
    fillDocumentTypes();
    renderScreen([listRoute()], `?ty=${SELECTABLE_TYPE}`);

    expect(await screen.findByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  it('다시 누르면 선택이 풀리고 상세 구획이 닫힌다', async () => {
    fillDocumentTypes();
    const { user } = renderScreen([listRoute(), detailRoute()], `?ty=${SELECTABLE_TYPE}&sel=9001`);

    expect(await screen.findByRole('table', { name: t.steps.caption })).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: t.actions.deselectRow('SYN-GR-2026-0001') }),
    );

    await waitFor(() => {
      expect(locationOf()).not.toContain('sel=');
    });
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  /**
   * ⭐ **고르기가 쪽을 유지한다**(수명 표 3행). 3쪽에서 고른 문서의 상세를 보는 동안 목록이
   * 1쪽으로 튀면, 사용자는 보고 있던 줄을 잃고 상세만 3쪽 문서를 가리킨다.
   *
   * **두 축으로 잰다** — 주소의 `page`와 **다시 나간 요청의 질의값**. 주소만 재면 요청이 첫
   * 쪽으로 나가도 통과한다. 해제 축도 같은 자리에서 잰다.
   */
  it('문서를 골랐다 해제해도 보던 쪽이 그대로다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen(
      [listRoute(documentProgressFixtures, { page: 2, total: 120 }), detailRoute()],
      `?ty=${SELECTABLE_TYPE}&page=2`,
    );

    expect(await screen.findByText('SYN-GR-2026-0001')).toBeInTheDocument();
    expect(lastListQuery(requests).get('page')).toBe('2');

    await user.click(screen.getByRole('button', { name: t.actions.selectRow('SYN-GR-2026-0001') }));

    await waitFor(() => {
      expect(locationOf()).toContain('sel=9001');
    });
    expect(locationOf()).toContain('page=2');
    expect(lastListQuery(requests).get('page')).toBe('2');

    await user.click(
      screen.getByRole('button', { name: t.actions.deselectRow('SYN-GR-2026-0001') }),
    );

    await waitFor(() => {
      expect(locationOf()).not.toContain('sel=');
    });
    expect(locationOf()).toContain('page=2');
    expect(lastListQuery(requests).get('page')).toBe('2');
  });

  /**
   * ⭐ **조건이 바뀌면 선택이 저절로 풀린다**(주소를 다시 쓰는 길이 선택 키를 만들지 않는다).
   * 남겨 두면 아래 구획이 **위에 보이지 않는 문서**를 가리킨 채 열려 있다.
   */
  it('조건을 바꿔 조회하면 고른 문서가 풀린다', async () => {
    fillDocumentTypes();
    const { user } = renderScreen([listRoute(), detailRoute()], `?ty=${SELECTABLE_TYPE}&sel=9001`);

    expect(await screen.findByRole('table', { name: t.steps.caption })).toBeInTheDocument();

    await user.type(screen.getByLabelText(t.fields.q), 'SYN-GR');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(locationOf()).not.toContain('sel=');
    });
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  /* 쪽을 옮겨도 같은 규칙이다 — 고른 문서가 그 쪽에 없을 수 있다. */
  it('쪽을 옮기면 고른 문서가 풀린다', async () => {
    fillDocumentTypes();
    const { user } = renderScreen(
      [listRoute(documentProgressFixtures, { total: 120 }), detailRoute()],
      `?ty=${SELECTABLE_TYPE}&sel=9001`,
    );

    expect(await screen.findByRole('table', { name: t.steps.caption })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(locationOf()).toContain('page=2');
    });
    expect(locationOf()).not.toContain('sel=');
  });

  /* 문서·후속을 여는 주소 규약이 아직 없다 — 손잡이를 만들지 않고 사유만 밝힌다(C2-8). */
  it('열기 손잡이가 서지 않고 사유가 보인다', async () => {
    fillDocumentTypes();
    renderScreen([listRoute(), detailRoute()], `?ty=${SELECTABLE_TYPE}&sel=9001`);

    expect(await screen.findByText(t.detail.openBlocked.unmapped)).toBeInTheDocument();
    expect(screen.getByText(t.successors.openBlocked.unmapped)).toBeInTheDocument();
    expect(screen.getByText(t.successors.openBlocked.noScreenId)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.actions.openDocument })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: t.actions.openSuccessor('SYN-GI-2026-0101') }),
    ).not.toBeInTheDocument();
  });

  /**
   * ⭐ **표를 채우면 화면이 그 표를 실제로 넘겼는지 드러난다.** 부품 감지기는 표를 직접 받아
   * 이 배선을 지나지 않으므로, 화면이 빈 표를 대신 넘겨도 부품 쪽은 전부 통과한다.
   * 눌렀을 때 **주소가 실제로 옮겨 가는 것**까지 함께 잰다.
   */
  it('표를 채우면 열기가 서고 눌렀을 때 그 주소로 옮겨 간다', async () => {
    fillDocumentTypes();
    screenRoutes['SYN-SCREEN-01'] = '/logistics/synthetic-document';
    const { user } = renderScreen([listRoute(), detailRoute()], `?ty=${SELECTABLE_TYPE}&sel=9001`);

    await user.click(await screen.findByRole('button', { name: t.actions.openDocument }));

    await waitFor(() => {
      expect(locationOf()).toBe('/logistics/synthetic-document');
    });
  });

  /**
   * ⭐ **캐시 키에 유형이 들어간다.** 번호만 열쇠로 쓰면 유형이 다른 같은 번호의 문서가 한 캐시
   * 항목을 나눠 써, 유형을 바꿔 같은 번호를 고르면 **앞 유형의 상세가 그대로 보인다.**
   */
  it('유형을 바꿔 같은 번호를 고르면 그 유형의 상세가 보인다', async () => {
    fillDocumentTypes();
    const otherType = 'SYN_DOC_TYPE_B';
    const { user } = renderScreen(
      [
        listRoute(),
        detailRoute(),
        detailRoute(
          documentProgressDetail({
            progress: documentProgress({
              documentTypeCode: otherType,
              statusCode: 'SYN_STATUS_OTHER_TYPE',
            }),
          }),
          detailPathOf(otherType, 9001),
        ),
      ],
      `?ty=${SELECTABLE_TYPE}&sel=9001`,
      `ty=${otherType}&sel=9001`,
    );

    const summary = await screen.findByRole('group', {
      name: t.detail.summary('SYN-GR-2026-0001'),
    });

    expect(within(summary).getByText('SYN_STATUS_DETAIL')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await waitFor(() => {
      expect(screen.getByText('SYN_STATUS_OTHER_TYPE')).toBeInTheDocument();
    });
  });
});

describe('상세 조회가 실패하면', () => {
  /**
   * ⭐ **실패를 로딩보다 앞에서 판정한다**(C2-2 · 사본 대조 추가 ①). 먼저 로딩을 보면 실패한
   * 조회가 영원히 「불러오는 중」으로 보이고, 사용자는 기다리면 될 일이라고 읽는다.
   */
  it('「불러오는 중」이 아니라 실패 표시가 보인다', async () => {
    fillDocumentTypes();
    renderScreen([listRoute(), failingDetailRoute(500)], `?ty=${SELECTABLE_TYPE}&sel=9001`);

    expect(await screen.findByText('상세를 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: t.loading.detail })).not.toBeInTheDocument();
  });

  /* ⭐ 상세가 실패해도 **위 목록은 그대로 둔다** — 실패한 것은 고른 문서 한 벌뿐이다. */
  it('목록은 그대로 남는다', async () => {
    fillDocumentTypes();
    renderScreen([listRoute(), failingDetailRoute(500)], `?ty=${SELECTABLE_TYPE}&sel=9001`);

    expect(await screen.findByText('상세를 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.getByText('SYN-GR-2026-0001')).toBeInTheDocument();
  });

  it('다시 시도가 같은 상세를 한 번 더 부른다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen(
      [listRoute(), failingDetailRoute(500)],
      `?ty=${SELECTABLE_TYPE}&sel=9001`,
    );

    expect(await screen.findByText('상세를 불러오지 못했습니다')).toBeInTheDocument();
    expect(detailRequests(requests)).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(detailRequests(requests)).toHaveLength(2);
    });
    expect(detailRequests(requests)[1]?.url.pathname).toBe(DETAIL_PATH);
  });

  /**
   * ⭐ **404는 주소의 선택을 지우고 그 사실을 말한다**(C2-3). 조용히 지우면 사용자는 자기가
   * 누른 것이 왜 열리지 않는지 알 수 없다. **조건은 하나도 바꾸지 않는다** — 없어진 문서 하나
   * 때문에 좁혀 둔 조건까지 되돌리지 않는다.
   */
  it('404면 주소의 선택만 지우고 사실을 말한다', async () => {
    fillDocumentTypes();
    renderScreen(
      [listRoute(), failingDetailRoute(404)],
      `?ty=${SELECTABLE_TYPE}&q=SYN-GR&sel=9001`,
    );

    expect(await screen.findByText(t.empty.detailNotFoundTitle)).toBeInTheDocument();
    await waitFor(() => {
      expect(locationOf()).toBe(`${ROUTE}?ty=${SELECTABLE_TYPE}&q=SYN-GR`);
    });
  });

  /**
   * ⭐ **정리가 뒤로가기 기록을 늘리지 않는다**(사본 체크리스트 1번 · `{ replace: true }`).
   *
   * 늘리면 뒤로 눌렀을 때 **없는 문서를 가리키는 주소로 되돌아가** 같은 정리가 되풀이되고,
   * 사용자는 앞 화면으로 빠져나갈 수 없다. 주소를 바깥에서 갈아 끼워(뒤로가기·주소 직접 편집과
   * 같은 경로) 히스토리가 실제로 몇 칸 쌓였는지를 잰다.
   */
  it('404 정리가 뒤로가기 기록을 늘리지 않는다', async () => {
    fillDocumentTypes();
    const { user } = renderScreen(
      [listRoute(), failingDetailRoute(404)],
      `?ty=${SELECTABLE_TYPE}&q=SYN-GR`,
      `ty=${SELECTABLE_TYPE}&q=SYN-GR&sel=9001`,
    );

    await screen.findByText('SYN-GR-2026-0001');
    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    expect(await screen.findByText(t.empty.detailNotFoundTitle)).toBeInTheDocument();
    await waitFor(() => {
      expect(locationOf()).toBe(`${ROUTE}?ty=${SELECTABLE_TYPE}&q=SYN-GR`);
    });

    /**
     * 여기서부터의 자취만 본다. 정리가 히스토리를 늘렸다면 뒤로 갔을 때 **없는 문서 주소를
     * 한 번 거치고** 거기서 같은 정리가 되풀이된다 — 마지막 주소만 재면 그 되풀이가 같은
     * 자리로 수렴해 감지기가 헛통과한다.
     */
    const mark = locationLog.length;

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    /* 한 칸 뒤로 가면 **없는 문서 주소가 아니라** 그 앞의 조회 상태로 돌아간다. */
    await waitFor(() => {
      expect(locationOf()).toBe(`${ROUTE}?ty=${SELECTABLE_TYPE}&q=SYN-GR`);
    });
    expect(locationLog.slice(mark).filter((entry) => entry.includes('sel='))).toEqual([]);
  });

  /**
   * **새 조회가 없음 안내를 거둔다.** 안내를 끄는 자리가 클릭 핸들러 하나뿐이면 뒤로가기·주소
   * 직접 편집이 그 길을 지나지 않아 문장이 남는다 — 방금 한 조작과 무관한 사정을 화면이 계속
   * 말하게 된다. 그래서 안내를 **조회 조건의 서명**에 맨다.
   */
  /**
   * ⭐ **새 선택도 없음 안내를 거둔다 — 그리고 스스로 해제해도 되살아나지 않는다.**
   *
   * 안내를 세우는 자리만 있고 거두는 자리가 없으면, **같은 조건 안에서** 다른 문서를 골랐다
   * 해제하는 순간 서명이 그대로라 안내가 되살아난다 — 사용자가 스스로 닫은 것을 화면이
   * 「찾을 수 없다」고 말한다. 주소를 쓰는 길이 안내를 함께 거두는지 여기서 잰다.
   */
  it('404 뒤 다른 문서를 골랐다 해제해도 없음 안내가 되살아나지 않는다', async () => {
    fillDocumentTypes();
    const { user } = renderScreen(
      [
        listRoute(),
        failingDetailRoute(404),
        detailRoute(documentProgressDetail(), detailPathOf(SELECTABLE_TYPE, 9002)),
      ],
      `?ty=${SELECTABLE_TYPE}&sel=9001`,
    );

    expect(await screen.findByText(t.empty.detailNotFoundTitle)).toBeInTheDocument();

    /* ① 같은 조건 안에서 다른 문서를 고른다 — 정상 상세가 서고 안내가 사라진다. */
    await user.click(screen.getByRole('button', { name: t.actions.selectRow('SYN-GR-2026-0002') }));

    expect(await screen.findByRole('table', { name: t.steps.caption })).toBeInTheDocument();
    expect(screen.queryByText(t.empty.detailNotFoundTitle)).not.toBeInTheDocument();

    /* ② 사용자가 스스로 해제한다 — 「고르면 보입니다」여야 한다. */
    await user.click(
      screen.getByRole('button', { name: t.actions.deselectRow('SYN-GR-2026-0002') }),
    );

    expect(await screen.findByText(t.empty.noSelectionTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.detailNotFoundTitle)).not.toBeInTheDocument();
  });

  it('새 조회가 없음 안내를 거둔다', async () => {
    fillDocumentTypes();
    const { user } = renderScreen(
      [listRoute(), failingDetailRoute(404)],
      `?ty=${SELECTABLE_TYPE}&sel=9001`,
    );

    expect(await screen.findByText(t.empty.detailNotFoundTitle)).toBeInTheDocument();

    await user.type(screen.getByLabelText(t.fields.q), 'SYN-GR');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(screen.queryByText(t.empty.detailNotFoundTitle)).not.toBeInTheDocument();
    });
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });
});

describe('조회에 실패하면', () => {
  it('배너와 「다시 시도」가 서고 다시 시도가 같은 조회를 한 번 더 부른다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen(
      [failingListRoute(500, { message: '일시적인 오류입니다' })],
      `?ty=${SELECTABLE_TYPE}`,
    );

    expect(await screen.findByText('일시적인 오류입니다')).toBeInTheDocument();
    expect(listRequests(requests)).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(listRequests(requests)).toHaveLength(2);
    });
    /* 같은 조건으로 부른다 — 다시 시도가 조건을 바꾸면 사용자가 본 것과 다른 결과가 온다. */
    expect(lastListQuery(requests).get('documentTypeCode')).toBe(SELECTABLE_TYPE);
  });

  /* 실패를 「없습니다」로 보이면 사용자가 자료가 없는 줄 알고 조건을 넓힌다. */
  it('실패를 빈 상태로 보이지 않는다', async () => {
    fillDocumentTypes();
    renderScreen([failingListRoute(500)], `?ty=${SELECTABLE_TYPE}`);

    expect(await screen.findByText(messages.httpError.loadTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  /*
   * ⭐ 계약이 400을 「덮지 않는 문서 유형」으로 따로 적었다 — 일반 실패 문면으로 뭉개면
   * 사용자가 「다시 시도」를 되풀이하는데 몇 번을 눌러도 같은 답이 온다.
   */
  it('덮지 않는 문서 유형(400)은 다른 문면을 낸다', async () => {
    fillDocumentTypes();
    renderScreen(
      [failingListRoute(400, { message: '지원하지 않는 유형' })],
      `?ty=${SELECTABLE_TYPE}`,
    );

    expect(await screen.findByText(t.errors.unsupportedTitle)).toBeInTheDocument();
    expect(screen.queryByText(messages.httpError.loadTitle)).not.toBeInTheDocument();
  });
});

/* ─────────────────────────────────────────────────────────────────────────────
 * 단위 ③ — 취소를 승인에 올린다
 * ────────────────────────────────────────────────────────────────────────── */

const selectCancelTarget = `?ty=${CANCEL_TYPE}&sel=9001`;

describe('취소 리소스가 없는 유형 — C3-1', () => {
  /**
   * ⭐ **취소 조작이 그려지지 않는다.** 유형 표에 취소 리소스가 없으면 나갈 주소 자체가 없다 —
   * 잠긴 버튼도 두지 않는다. 표의 리소스 열이 비어 있는 지금은 **모든 유형이 이 상태**다.
   */
  it('취소 요청 손잡이도 사유 칸도 서지 않는다', async () => {
    fillDocumentTypes();
    renderScreen([listRoute(), detailRoute()], `?ty=${SELECTABLE_TYPE}&sel=9001`);

    await screen.findByRole('region', { name: t.cancelRequest.label });

    expect(
      within(cancelPane()).queryByRole('button', { name: t.cancelRequest.label }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(t.cancelRequest.reason)).not.toBeInTheDocument();
    expect(screen.getByText(t.cancelRequest.unsupportedTitle)).toBeInTheDocument();
  });

  /**
   * ⭐ **잠금 토큰 조회도 나가지 않는다 — 경로 전체에서 센다.** 부를 주소가 없는데 부르면
   * 화면이 없는 문서를 두드리는 것이고, 그 실패가 취소 축을 잠근 채로 남는다.
   */
  it('리소스 상세를 한 번도 부르지 않는다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen(
      [
        listRoute(),
        detailRoute(),
        detailRoute(documentProgressDetail(), detailPathOf(SELECTABLE_TYPE, 9002)),
      ],
      `?ty=${SELECTABLE_TYPE}&sel=9001`,
      `ty=${SELECTABLE_TYPE}&sel=9002`,
    );

    await screen.findByText(t.cancelRequest.unsupportedTitle);
    expect(
      requests.filter((request) => request.url.pathname.startsWith('/logistics/goods-')),
    ).toHaveLength(0);

    /* 주소를 손으로 고쳐 다른 문서로 옮겨도 마찬가지다 — 유형이 같으면 리소스도 없다. */
    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await waitFor(() => {
      expect(locationOf()).toContain('sel=9002');
    });

    expect(
      requests.filter((request) => request.url.pathname.startsWith('/logistics/goods-')),
    ).toHaveLength(0);
  });

  /**
   * ⭐ **표의 리소스 열을 채우면 그것만으로 취소 축이 살아난다.** 다른 자리는 하나도 바뀌지
   * 않았다 — 이것이 자리표시가 죽은 가지가 아니라는 증거다.
   */
  it('리소스가 있는 유형에서는 취소 축이 선다', async () => {
    fillDocumentTypes();
    renderScreen(cancelRoutes(), selectCancelTarget);

    expect(await screen.findByLabelText(t.cancelRequest.reason)).toBeInTheDocument();
    expect(requestCancelButton()).toBeInTheDocument();
    expect(screen.queryByText(t.cancelRequest.unsupportedTitle)).not.toBeInTheDocument();
  });
});

describe('잠금 토큰 — C3-3 · C3-9', () => {
  /**
   * ⭐ **토큰은 리소스 상세에서 온다** — 진행현황 상세의 200에는 `ETag`가 없다(실측).
   * 경로가 어긋나면 보관소가 늘 비어 있어 **눌러도 아무 일이 없는** 화면이 된다.
   */
  it('문서를 고르면 리소스 상세를 부른다', async () => {
    fillDocumentTypes();
    const { requests } = renderScreen(cancelRoutes(), selectCancelTarget);

    await waitFor(() => {
      expect(requestsTo(requests, CANCEL_RESOURCE_PATH)).toHaveLength(1);
    });
  });

  /**
   * ⭐ **리소스 상세 200이 오기 전에는 요청 버튼이 활성되지 않는다**(C3-3).
   * 계약이 `If-Match`를 필수로 두어, 먼저 열면 눌러도 요청이 나가지 않는다.
   */
  it('리소스 상세가 오기 전에는 요청 버튼이 잠긴다', async () => {
    fillDocumentTypes();
    const { requests, release } = renderScreen(cancelRoutes(), selectCancelTarget, '', [
      CANCEL_RESOURCE_PATH,
    ]);

    await screen.findByLabelText(t.cancelRequest.reason);

    /* 요청은 이미 나갔다 — 「아직 안 보냈다」와 「보냈는데 안 왔다」는 다른 상태다. */
    expect(requestsTo(requests, CANCEL_RESOURCE_PATH)).toHaveLength(1);
    expect(requestCancelButton()).toBeDisabled();
    expect(screen.getByText(t.cancelRequest.preparing)).toBeInTheDocument();

    release();

    await waitFor(() => {
      expect(requestCancelButton()).toBeEnabled();
    });
  });

  /**
   * ⭐ **`If-Match` 값이 리소스 상세 응답의 `ETag`와 같다**(C3-9). 값으로 견준다 — 헤더가
   * 실렸는지만 보면 **다른 경로에서 꺼낸 토큰**을 실어도 통과한다.
   */
  it('요청에 멱등 키와 리소스 상세가 준 If-Match가 함께 실린다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen(cancelRoutes(), selectCancelTarget);

    await user.type(await screen.findByLabelText(t.cancelRequest.reason), '잘못 등록했습니다');
    await user.click(requestCancelButton());
    await user.click(screen.getByRole('button', { name: t.cancelDialog.confirm }));

    await waitFor(() => {
      expect(writesTo(requests, REQUEST_CANCEL_PATH)).toHaveLength(1);
    });

    const sent = writesTo(requests, REQUEST_CANCEL_PATH)[0];

    expect(sent?.headers.get('If-Match')).toBe(CANCEL_RESOURCE_ETAG);
    expect(sent?.headers.get('Idempotency-Key') ?? '').toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  /** 본문은 **사유 하나뿐**이다 — 다른 값을 함께 실으면 계약 밖의 요청이 된다. */
  it('본문이 사유 하나뿐이고 다듬은 값이 나간다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen(cancelRoutes(), selectCancelTarget);

    await user.type(await screen.findByLabelText(t.cancelRequest.reason), '  수량 오류  ');
    await user.click(requestCancelButton());
    await user.click(screen.getByRole('button', { name: t.cancelDialog.confirm }));

    await waitFor(() => {
      expect(writesTo(requests, REQUEST_CANCEL_PATH)).toHaveLength(1);
    });

    expect(writesTo(requests, REQUEST_CANCEL_PATH)[0]?.body).toEqual({ reason: '수량 오류' });
  });
});

describe('리소스 상세 실패 — C3-4', () => {
  /**
   * ⭐ **취소 축만 잠기고 화면 배너가 서지 않는다.** 실패한 것은 취소 준비 하나뿐이고
   * 진행현황은 계속 읽을 수 있어야 한다 — 화면을 덮으면 사용자가 쓸 수 있는 것까지 잃는다.
   */
  it.each([
    [403, t.cancelRequest.lockForbiddenTitle],
    [404, t.cancelRequest.lockNotFoundTitle],
    [500, t.cancelRequest.lockFailedTitle],
  ])('%s이면 취소 축만 잠기고 진행현황은 그대로 보인다', async (status, title) => {
    fillDocumentTypes();
    renderScreen(cancelRoutes([failingCancelResourceRoute(status as number)]), selectCancelTarget);

    expect(await screen.findByText(title as string)).toBeInTheDocument();
    expect(requestCancelButton()).toBeDisabled();

    /* 진행현황은 살아 있다 — 경과·후속이 그대로 보인다. */
    expect(screen.getByText(t.steps.caption)).toBeInTheDocument();
    expect(screen.getByText(t.successors.caption)).toBeInTheDocument();
    /* ⛔ 화면 배너(조회 실패)가 서지 않는다. */
    expect(screen.queryByText(messages.httpError.loadTitle)).not.toBeInTheDocument();
  });

  /** 「다시 시도」가 같은 조회를 한 번 더 부른다 — 손잡이가 실제로 일하는지 횟수로 잰다. */
  it('404의 다시 시도가 리소스 상세를 한 번 더 부른다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen(
      cancelRoutes([failingCancelResourceRoute(404)]),
      selectCancelTarget,
    );

    await screen.findByText(t.cancelRequest.lockNotFoundTitle);
    expect(requestsTo(requests, CANCEL_RESOURCE_PATH)).toHaveLength(1);

    await user.click(within(cancelPane()).getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, CANCEL_RESOURCE_PATH)).toHaveLength(2);
    });
  });
});

describe('서버가 막은 문서 — C3-2', () => {
  /**
   * ⭐ **판정 근거가 목록 열과 같은 자리에서 나온다.** 갈리면 목록에서는 「취소 요청 가능」인데
   * 아래에서는 잠긴 화면이 된다.
   */
  it('cancellable이 거짓이면 잠기고 사유 문면이 보인다', async () => {
    fillDocumentTypes();
    renderScreen(
      cancelRoutes([
        detailRoute(
          cancelableDetail({ cancellable: false, cancelBlockedReasonCode: 'SUCCESSOR_EXISTS' }),
          CANCEL_DETAIL_PATH,
        ),
      ]),
      selectCancelTarget,
    );

    await screen.findByLabelText(t.cancelRequest.reason);

    expect(requestCancelButton()).toBeDisabled();
    expect(
      screen.getByText(t.cancelRequest.blocked(t.blockReasons.SUCCESSOR_EXISTS)),
    ).toBeInTheDocument();
  });

  /**
   * ⛔ **막혔다고 잠금 토큰 조회를 막지 않는다.** 취소 요청이 진행 중이면 서버가 `cancellable`을
   * 거짓으로 내리는데, 그때가 바로 **취소 실행**이 토큰을 필요로 하는 순간이다(단위 ④) —
   * 여기서 막으면 그 회차에 실행 버튼이 영영 서지 않는다.
   */
  it('막혀 있어도 리소스 상세는 부른다', async () => {
    fillDocumentTypes();
    const { requests } = renderScreen(
      cancelRoutes([
        detailRoute(
          cancelableDetail({ cancellable: false, cancelBlockedReasonCode: 'CANCEL_IN_PROGRESS' }),
          CANCEL_DETAIL_PATH,
        ),
      ]),
      selectCancelTarget,
    );

    await screen.findByText(t.cancelRequest.blocked(t.blockReasons.CANCEL_IN_PROGRESS));

    expect(requestsTo(requests, CANCEL_RESOURCE_PATH)).toHaveLength(1);
  });
});

describe('사유는 필수다 — C3-5', () => {
  /**
   * ⭐ **빈 사유로는 요청이 나가지 않고 창도 열리지 않는다.** 계약이 `reason`을 필수로 두었고
   * 이 화면에서는 **그 사유가 곧 취소 이력**이다 — 빈 이력은 나중에 아무것도 말하지 않는다.
   */
  it('사유가 비면 창이 열리지 않고 인라인 오류가 선다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen(cancelRoutes(), selectCancelTarget);

    await waitFor(() => {
      expect(requestCancelButton()).toBeEnabled();
    });
    await user.click(requestCancelButton());

    expect(screen.getByText(t.cancelRequest.reasonRequired)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(writesTo(requests, REQUEST_CANCEL_PATH)).toHaveLength(0);
  });

  /** 공백만도 빈 값과 같다 — 서버가 통과시키면 **요약이 빈 승인 요청**이 만들어진다. */
  it('공백만인 사유도 막힌다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen(cancelRoutes(), selectCancelTarget);

    await user.type(await screen.findByLabelText(t.cancelRequest.reason), '   ');
    await user.click(requestCancelButton());

    expect(screen.getByText(t.cancelRequest.reasonRequired)).toBeInTheDocument();
    expect(writesTo(requests, REQUEST_CANCEL_PATH)).toHaveLength(0);
  });

  /**
   * ⭐ **초안은 자기 대상보다 오래 살지 않는다.** 남기면 A 문서에 적은 사유가 B 문서의 칸에 서고,
   * 그대로 올리면 **다른 문서의 사유로 취소가 올라간다** — 이 화면에서는 그 사유가 곧 취소 이력이라
   * 되돌릴 수 없는 잘못이 된다.
   *
   * ⚠ **파기 확인 창을 두지 않았다**(전례 `putaway-rule`의 `navigateWithDraftGuard`). 그 전례의
   * 초안은 서버 값을 되돌릴 기준까지 갖는 **폼 전체**이고 여기는 **칸 하나짜리 글 한 줄**이다 —
   * 대신 사유 칸의 보조 문구가 **일어날 일을 미리 말한다.** 그 짝이 이 감지기다.
   */
  it('다른 문서를 고르면 적던 사유가 따라오지 않는다', async () => {
    fillDocumentTypes();
    const { user } = renderScreen(cancelRoutes(), selectCancelTarget);

    await user.type(await screen.findByLabelText(t.cancelRequest.reason), '9001에 적던 사유');
    await user.click(screen.getByRole('button', { name: t.actions.selectRow('SYN-GR-2026-0002') }));

    await waitFor(() => {
      expect(locationOf()).toContain('sel=9002');
    });

    expect(await screen.findByLabelText(t.cancelRequest.reason)).toHaveValue('');
  });

  /** 미리 말한다 — 「말없이 버린다」와 「규칙대로 버리고 밝힌다」를 가르는 자리다. */
  it('사유가 대상과 함께 사라진다는 사실을 칸이 미리 말한다', async () => {
    fillDocumentTypes();
    renderScreen(cancelRoutes(), selectCancelTarget);

    expect(await screen.findByLabelText(t.cancelRequest.reason)).toHaveAccessibleDescription(
      /다른 문서를 고르면 적던 사유는 남지 않습니다/,
    );
  });

  /* 고쳐 치면 오류가 걷힌다 — 남아 있으면 사용자가 아직 막힌 줄 안다. */
  it('사유를 치면 오류가 걷힌다', async () => {
    fillDocumentTypes();
    const { user } = renderScreen(cancelRoutes(), selectCancelTarget);

    await user.click(await screen.findByLabelText(t.cancelRequest.reason));
    await user.click(requestCancelButton());
    expect(screen.getByText(t.cancelRequest.reasonRequired)).toBeInTheDocument();

    await user.type(screen.getByLabelText(t.cancelRequest.reason), '사유');

    expect(screen.queryByText(t.cancelRequest.reasonRequired)).not.toBeInTheDocument();
  });
});

describe('확인 창이 뜬다 — C3-6', () => {
  /** 창이 대상 문서번호를 말한다 — 고른 뒤 창이 뜨기까지 사이가 있고 여러 문서를 오가며 본다. */
  it('대상 문서번호와 승인·철회 사실을 함께 말한다', async () => {
    fillDocumentTypes();
    const { user } = renderScreen(cancelRoutes(), selectCancelTarget);

    await user.type(await screen.findByLabelText(t.cancelRequest.reason), '사유');
    await user.click(requestCancelButton());

    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText(t.cancelDialog.target('SYN-GR-2026-0001'))).toBeInTheDocument();
    expect(within(dialog).getByText(t.cancelDialog.approval)).toBeInTheDocument();
    expect(within(dialog).getByText(t.cancelDialog.noWithdraw)).toBeInTheDocument();
  });

  /** 확인하기 전에는 아무것도 나가지 않는다 — 창이 형식이 되면 확인 자체가 뜻을 잃는다. */
  it('창을 열기만 해서는 요청이 나가지 않는다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen(cancelRoutes(), selectCancelTarget);

    await user.type(await screen.findByLabelText(t.cancelRequest.reason), '사유');
    await user.click(requestCancelButton());

    expect(writesTo(requests, REQUEST_CANCEL_PATH)).toHaveLength(0);
  });
});

describe('202를 받으면 — C3-10', () => {
  const submitCancel = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
    await user.type(await screen.findByLabelText(t.cancelRequest.reason), '잘못 등록했습니다');
    await user.click(requestCancelButton());
    await user.click(screen.getByRole('button', { name: t.cancelDialog.confirm }));
  };

  /**
   * ⭐ **세 조회를 다시 부른다** — 목록·진행현황 상세·리소스 상세.
   *
   * | 무엇 | 왜 |
   * | --- | --- |
   * | 목록·상세 | 상태와 `cancellable`이 달라진다. 다시 부르지 않으면 「올렸는데 안 올린 것으로 보이는」 화면이 남는다 |
   * | 리소스 상세 | 상신이 `version_no`를 올린다. 202에 `ETag`가 없어 다시 부르지 않으면 다음 쓰기가 **낡은 토큰**으로 나가 409다 |
   *
   * **호출 횟수 증가로** 판정한다 — 화면에 보이는 값만 보면 캐시가 그대로여도 통과한다.
   */
  it('목록·진행현황 상세·리소스 상세를 다시 부른다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen(cancelRoutes(), selectCancelTarget);

    await waitFor(() => {
      expect(requestCancelButton()).toBeEnabled();
    });

    const before = {
      list: listRequests(requests).length,
      detail: requestsTo(requests, CANCEL_DETAIL_PATH).length,
      resource: requestsTo(requests, CANCEL_RESOURCE_PATH).length,
    };

    await submitCancel(user);

    await waitFor(() => {
      expect(listRequests(requests).length).toBeGreaterThan(before.list);
    });
    await waitFor(() => {
      expect(requestsTo(requests, CANCEL_DETAIL_PATH).length).toBeGreaterThan(before.detail);
    });
    await waitFor(() => {
      expect(requestsTo(requests, CANCEL_RESOURCE_PATH).length).toBeGreaterThan(before.resource);
    });
  });

  /**
   * ⛔ **성공 안내에 내부 식별자가 보이지 않는다**(omf-mes#44). 응답에 오는 것이 그 번호뿐이라
   * 화면에 낼 업무 번호가 없다 — 그래서 「올렸습니다」까지만 말한다.
   */
  it('성공 안내에 승인 요청 번호가 보이지 않는다', async () => {
    fillDocumentTypes();
    const { user } = renderScreen(cancelRoutes(), selectCancelTarget);

    await submitCancel(user);

    expect(await screen.findByText(t.cancelRequest.submitted)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(String(APPROVAL_REQUEST_ID)))).not.toBeInTheDocument();
  });

  /** 창이 닫히고 사유가 비워진다 — 남겨 두면 같은 사유로 한 번 더 올리기 쉽다. */
  it('창이 닫히고 사유 칸이 비워진다', async () => {
    fillDocumentTypes();
    const { user } = renderScreen(cancelRoutes(), selectCancelTarget);

    await submitCancel(user);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText(t.cancelRequest.reason)).toHaveValue('');
  });
});

describe('400을 받으면 — C3-11 · C3-12', () => {
  const submitWith = async (routes: StubRoute[]) => {
    fillDocumentTypes();
    const rendered = renderScreen(cancelRoutes(routes), selectCancelTarget);

    await rendered.user.type(await screen.findByLabelText(t.cancelRequest.reason), '사유');
    await rendered.user.click(requestCancelButton());
    await rendered.user.click(screen.getByRole('button', { name: t.cancelDialog.confirm }));

    return rendered;
  };

  /**
   * ⭐ **후속 때문에 막힌 400은 후속 목록을 다시 부른다**(C3-11). 그 400은 **후속이 생겼다는
   * 사실의 통지**이며, 다시 부르지 않으면 화면이 「후속 때문에 막혔다」라고 말하면서 후속을
   * 하나도 보이지 않는다. **호출 횟수 증가로** 판정한다.
   */
  it('SUCCESSOR_EXISTS면 진행현황 상세를 다시 부른다', async () => {
    const { requests } = await submitWith([
      failingRequestCancelRoute(400, {
        errors: [{ scope: 'screen', code: 'SUCCESSOR_EXISTS', message: '후속 문서가 있습니다' }],
      }),
    ]);

    await screen.findByText(t.cancelRequest.successorBlocked);

    await waitFor(() => {
      expect(requestsTo(requests, CANCEL_DETAIL_PATH).length).toBeGreaterThan(1);
    });
  });

  /**
   * ⛔ **문면에 「승인」이라는 낱말이 들어가지 않는다.** 이 단계는 승인을 **올리는** 단계이고
   * 아직 승인이 없다 — 「승인은 유효하지만…」은 취소 **실행**(단위 ④)의 문면이며 여기에 쓰면
   * 있지도 않은 승인을 있다고 말하게 된다.
   */
  it('후속 문면이 승인을 말하지 않는다', async () => {
    await submitWith([
      failingRequestCancelRoute(400, {
        errors: [{ scope: 'screen', code: 'SUCCESSOR_EXISTS', message: '후속 문서가 있습니다' }],
      }),
    ]);

    expect(await screen.findByText(t.cancelRequest.successorBlocked)).toBeInTheDocument();
    expect(t.cancelRequest.successorBlocked).not.toContain('승인');
  });

  /**
   * ⭐ **그 밖의 400은 서버 문구를 그대로 낸다**(C3-12). 계약이 이 400에 네 사유를 함께 적었고
   * 코드가 붙은 것은 후속 하나뿐이라, 화면이 가르면 원인을 지어내게 된다.
   */
  it('그 밖의 400은 서버 문구가 그대로 보이고 후속 문면이 서지 않는다', async () => {
    await submitWith([
      failingRequestCancelRoute(400, {
        errors: [
          { scope: 'screen', code: 'ALREADY_CANCELLED', message: '이미 취소된 문서입니다.' },
        ],
      }),
    ]);

    expect(await screen.findByText('이미 취소된 문서입니다.')).toBeInTheDocument();
    expect(screen.queryByText(t.cancelRequest.successorBlocked)).not.toBeInTheDocument();
  });

  /** 그 밖의 400은 상세를 다시 부르지도 않는다 — 후속이 생겼다는 통지가 아니기 때문이다. */
  it('그 밖의 400은 진행현황 상세를 다시 부르지 않는다', async () => {
    const { requests } = await submitWith([
      failingRequestCancelRoute(400, {
        errors: [{ scope: 'screen', code: 'NO_APPROVAL_ROUTE', message: '결재선이 없습니다.' }],
      }),
    ]);

    await screen.findByText('결재선이 없습니다.');

    expect(requestsTo(requests, CANCEL_DETAIL_PATH)).toHaveLength(1);
  });

  /**
   * ⭐ **사유 칸에 붙는 서버 오류는 배너가 아니라 칸 옆에 선다**(공유계약 G-1).
   *
   * 이 화면이 소유한 입력칸이 사유 하나뿐이라, 그 이름을 아는 필드에서 빼면 **고칠 칸이 있는
   * 오류가 배너로 밀려나** 사용자가 어디를 고쳐야 하는지 알 수 없다.
   */
  it('사유 필드 오류는 사유 칸 옆에 붙는다', async () => {
    await submitWith([
      failingRequestCancelRoute(400, {
        errors: [
          { scope: 'field', field: 'reason', code: 'TOO_SHORT', message: '사유가 짧습니다.' },
        ],
      }),
    ]);

    expect(await screen.findByText('사유가 짧습니다.')).toBeInTheDocument();

    /* 칸과 **이어져 있어야** 한다 — 배너로 밀려나면 이 이음이 없다. */
    expect(screen.getByLabelText(t.cancelRequest.reason)).toHaveAccessibleDescription(
      /사유가 짧습니다\./,
    );
  });

  /**
   * ⭐ **「돌아가기」로 창을 닫으면 서버 거절이 걷힌다 — 나가는 중이 아닐 때다.**
   *
   * 그 거절은 **방금 보낸 요청에 대한 답**이다 — 사용자가 스스로 물러난 뒤에도 남으면, 다음에 무엇을
   * 눌러도 낡은 문구가 새 조작 위에 서서 무엇 때문에 막혔는지 흐려진다.
   *
   * ⚠ **걷히는 것은 이 길(idle)뿐이다.** `resetIfIdle`는 **나가는 중이면 물러나므로**, Escape로
   * 창이 닫힌 뒤 도착한 거절은 걷히지 않고 그대로 선다 — 그 갈래는 아래 「나가는 중 닫힌 뒤…」가
   * 잰다. 두 길을 한 감지기로 합치면 어느 쪽이 참인지 가릴 수 없다.
   *
   * ⚠ **닫힌 뒤 「비어 있다」를 함께 재지 않는다** — 화면이 잡은 오류가 서버 거절을 덮으므로
   * (`local ?? server`) 그 자리에서는 **걷었든 안 걷었든 같은 그림**이 되어 감지기가 헛통과한다.
   * 그래서 **화면이 잡은 오류가 없는 순간**에 잰다.
   */
  it('창을 닫으면 서버 거절이 걷힌다', async () => {
    const { user } = await submitWith([
      failingRequestCancelRoute(400, {
        errors: [
          { scope: 'field', field: 'reason', code: 'TOO_SHORT', message: '사유가 짧습니다.' },
        ],
      }),
    ]);

    await screen.findByText('사유가 짧습니다.');

    await user.click(screen.getByRole('button', { name: t.cancelDialog.keepEditing }));

    expect(screen.queryByText('사유가 짧습니다.')).not.toBeInTheDocument();
    /* 짝 방향 — 칸은 그대로 있다(구획째 사라져서 문구가 없어진 것이 아니다). */
    expect(screen.getByLabelText(t.cancelRequest.reason)).toBeInTheDocument();
  });

  /**
   * ⭐ **나가는 중 창이 닫힌 뒤 도착한 거절 위에 화면이 잡은 오류가 선다** — 두 오류가 **함께 서는
   * 유일한 경로**이고, 그래서 `local ?? server`의 차례가 실제로 갈리는 자리다.
   *
   * 그 경로는 이 슬라이스가 스스로 못박은 길로 열린다:
   *
   * | 걸음 | 무엇이 일어나나 |
   * | :-: | --- |
   * | ① | 보낸다 — `isSaving`이 참이 된다 |
   * | ② | **Escape로 창이 닫힌다**(막을 수 없는 길 — C3-8) → `closeCancelDialog`가 `resetIfIdle`를 부르는데 **나가는 중이라 물러난다**(걷지 않는다) |
   * | ③ | 400 필드 오류가 도착 → **창이 닫힌 채** 서버 거절이 사유 칸에 선다 |
   * | ④ | 칸을 비운다 → 서버 거절은 그대로다(글자를 칠 때 걷지 않기로 했다) |
   * | ⑤ | 비운 채 다시 누른다 → 화면이 잡은 오류가 함께 선다 ⇒ **차례가 답을 가른다** |
   *
   * ⛔ **차례가 뒤집히면** 칸이 비어 있는데 「사유가 짧습니다」가 남아, 사용자는 더 길게 쓰려 하며
   * 정작 비어 있는 칸을 보지 못한다.
   *
   * ⚠ 이 감지기는 **내가 r2에서 「등가」로 잘못 판정했던 자리**다 — `resetIfIdle`가 나가는 중에는
   * 걷지 않는다는 사실(내가 C3-8로 세운 규율)을 수명 표에서 빠뜨렸다.
   */
  it('나가는 중 창이 닫힌 뒤 도착한 거절 위에 필수 오류가 선다', async () => {
    fillDocumentTypes();
    const { requests, release, user } = renderScreen(
      cancelRoutes([
        failingRequestCancelRoute(400, {
          errors: [
            { scope: 'field', field: 'reason', code: 'TOO_SHORT', message: '사유가 짧습니다.' },
          ],
        }),
      ]),
      selectCancelTarget,
      '',
      [REQUEST_CANCEL_PATH],
    );

    await user.type(await screen.findByLabelText(t.cancelRequest.reason), '짧은 사유');
    await user.click(requestCancelButton());
    await user.click(screen.getByRole('button', { name: t.cancelDialog.confirm }));

    await waitFor(() => {
      expect(writesTo(requests, REQUEST_CANCEL_PATH)).toHaveLength(1);
    });

    /* ② 나가는 중에 Escape — 여기서 `resetIfIdle`가 물러난다. */
    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    release();

    /* ③ 창이 닫힌 채 서버 거절이 칸에 선다 — 걷혔다면 여기서 멈춘다. */
    expect(await screen.findByText('사유가 짧습니다.')).toBeInTheDocument();

    /* ④⑤ 비우고 다시 누른다 — 두 오류가 함께 서는 순간이다. */
    await user.clear(screen.getByLabelText(t.cancelRequest.reason));
    await user.click(requestCancelButton());

    expect(screen.getByText(t.cancelRequest.reasonRequired)).toBeInTheDocument();
    expect(screen.queryByText('사유가 짧습니다.')).not.toBeInTheDocument();
  });

  /**
   * 걷힌 뒤에도 **화면이 잡은 오류는 제 자리에 선다** — 걷는 규약이 새 오류까지 삼키면 사용자는
   * 왜 안 나가는지 알 수 없다.
   */
  it('걷힌 뒤 비운 채 다시 누르면 필수 오류가 선다', async () => {
    const { user } = await submitWith([
      failingRequestCancelRoute(400, {
        errors: [
          { scope: 'field', field: 'reason', code: 'TOO_SHORT', message: '사유가 짧습니다.' },
        ],
      }),
    ]);

    await screen.findByText('사유가 짧습니다.');

    await user.click(screen.getByRole('button', { name: t.cancelDialog.keepEditing }));
    await user.clear(screen.getByLabelText(t.cancelRequest.reason));
    await user.click(requestCancelButton());

    expect(screen.getByText(t.cancelRequest.reasonRequired)).toBeInTheDocument();
  });

  /** 실패해도 **창을 닫지 않는다** — 닫으면 무엇이 막았는지 모른 채 같은 버튼을 다시 누른다. */
  it.each([403, 404, 409])('%s에서도 창이 열린 채 배너로 이유를 말한다', async (status) => {
    await submitWith([
      failingRequestCancelRoute(status, { message: `합성 실패 ${String(status)}` }),
    ]);

    const dialog = await screen.findByRole('dialog');

    await waitFor(() => {
      expect(within(dialog).getByRole('alert')).toBeInTheDocument();
    });
  });
});

describe('나가는 중 — C3-13의 두 축', () => {
  const submitAndHold = async () => {
    fillDocumentTypes();
    const rendered = renderScreen(
      cancelRoutes(),
      selectCancelTarget,
      `ty=${CANCEL_TYPE}&sel=9002`,
      [REQUEST_CANCEL_PATH],
    );

    await rendered.user.type(await screen.findByLabelText(t.cancelRequest.reason), '사유');
    await rendered.user.click(requestCancelButton());
    await rendered.user.click(screen.getByRole('button', { name: t.cancelDialog.confirm }));

    return rendered;
  };

  /**
   * ⭐ **① 잠금은 전역이다.** 창이 열려 있는 동안은 모달이 화면 안 조작을 막지만, **Escape로
   * 창이 닫히면**(막을 수 없는 길) 목록이 다시 눌린다 — 그때 대상이 바뀌면 앞 요청의 결과가
   * 지금 보는 맥락에 나타나고, 둘째 요청을 낼 길도 열린다.
   */
  it('창이 닫혀도 나가는 동안 다른 행을 고를 수 없다', async () => {
    const { requests, user } = await submitAndHold();

    await waitFor(() => {
      expect(writesTo(requests, REQUEST_CANCEL_PATH)).toHaveLength(1);
    });

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    const before = requestsTo(requests, OTHER_CANCEL_DETAIL_PATH).length;
    const handle = screen.getByRole('button', { name: t.actions.selectRow('SYN-GR-2026-0002') });

    expect(handle).toBeDisabled();
    await user.click(handle);

    expect(locationOf()).toContain('sel=9001');
    expect(requestsTo(requests, OTHER_CANCEL_DETAIL_PATH)).toHaveLength(before);
  });

  /**
   * ⭐ **① 잠금은 주소를 갈아 끼우는 문 하나가 진다.** 앞 감지기는 표 손잡이의 **보이는 잠금**을
   * 재지만, 조건 줄·쪽 이동은 그 손잡이를 지나지 않는다 — 잠그는 자리가 손잡이뿐이면 「조회」
   * 한 번에 대상이 바뀌고 앞 요청의 결과가 새 맥락에 나타난다.
   *
   * **주소가 실제로 달라지는 조작으로 잰다** — 같은 조건으로 다시 조회하면 주소가 그대로라
   * 잠금이 없어도 아무 일이 일어나지 않아 감지기가 헛통과한다.
   */
  it('창이 닫혀도 나가는 동안 조건을 다시 조회할 수 없다', async () => {
    const { requests, user } = await submitAndHold();

    await waitFor(() => {
      expect(writesTo(requests, REQUEST_CANCEL_PATH)).toHaveLength(1);
    });

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    const before = listRequests(requests).length;

    await user.type(screen.getByLabelText(t.fields.q), 'SYN-GR');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(locationOf()).not.toContain('q=SYN-GR');
    expect(listRequests(requests)).toHaveLength(before);
  });

  /**
   * ⭐ **잠긴 이유가 화면에 있다** — 잠금의 짝이다(전례 `putaway-rule`의 `savingLock`).
   *
   * 조건 줄의 「조회」는 **컨트롤 자체가 잠기지 않으므로** 눌러도 아무 일이 없는 버튼이 된다.
   * 그 상태에서 이유가 화면 어디에도 없으면 사용자는 화면이 고장 난 것으로 읽는다 — 이 슬라이스가
   * 다른 자리에서 스스로 경고한 「증상이 **눌러도 아무 일이 없다**라 알아채기 어렵다」와 같은 형태다.
   *
   * **앞 감지기와 이어 붙이지 않고 따로 잰다** — 앞은 「막혔는가」, 여기는 「왜 막혔는지 말하는가」다.
   */
  it('창이 닫혀도 잠긴 이유가 화면에 선다', async () => {
    const { requests } = await submitAndHold();

    await waitFor(() => {
      expect(writesTo(requests, REQUEST_CANCEL_PATH)).toHaveLength(1);
    });

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    /* 「조회」는 여전히 눌린다 — 그래서 이유가 더 필요하다. */
    expect(screen.getByRole('button', { name: messages.common.search })).toBeEnabled();
    expect(screen.getByText(t.notes.lock.request)).toBeInTheDocument();
  });

  /**
   * ⭐ **⛔ 그 이유가 취소 구획 **밖**에 있다** — 전례가 「없으면 이렇게 된다」까지 적어 둔 자리다.
   *
   * 구획은 대상이 풀리면 사라지는데(나가는 중 바깥 주소 이동으로 `sel`이 빠진다) 잠금은 요청이
   * 끝날 때까지 남는다. 구획 안에 두면 **구획이 사라진 채 잠긴 갈래**에서 잠긴 이유가 통째로
   * 없어지고, 진행 표시조차 대상 매임으로 걸러져 남는 단서가 하나도 없다.
   */
  it('취소 구획이 사라져도 잠긴 이유는 남는다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen(
      cancelRoutes(),
      selectCancelTarget,
      /* 고른 문서를 아예 뗀다 — 상세 구획이 「고르면 보입니다」가 되어 취소 구획이 사라진다. */
      `ty=${CANCEL_TYPE}`,
      [REQUEST_CANCEL_PATH],
    );

    await user.type(await screen.findByLabelText(t.cancelRequest.reason), '사유');
    await user.click(requestCancelButton());
    await user.click(screen.getByRole('button', { name: t.cancelDialog.confirm }));

    await waitFor(() => {
      expect(writesTo(requests, REQUEST_CANCEL_PATH)).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: t.cancelRequest.label })).not.toBeInTheDocument();
    });

    /* 구획이 없어도 이유가 남는다 — 이것이 자리를 구획 밖에 둔 이유다. */
    expect(screen.getByText(t.notes.lock.request)).toBeInTheDocument();
  });

  /** 짝 방향 — 나가는 중이 아니면 그 줄이 서지 않는다. 늘 떠 있는 안내는 읽히지 않는다. */
  it('나가는 중이 아니면 잠김 안내가 서지 않는다', async () => {
    fillDocumentTypes();
    renderScreen(cancelRoutes(), selectCancelTarget);

    await screen.findByLabelText(t.cancelRequest.reason);

    /* **두 문면 다** 서지 않는다 — 갈래를 나눈 뒤 한쪽만 재면 나머지가 늘 떠 있어도 통과한다. */
    expect(screen.queryByText(t.notes.lock.request)).not.toBeInTheDocument();
    expect(screen.queryByText(t.notes.lock.execute)).not.toBeInTheDocument();
  });

  /**
   * ⭐ **② 표시는 대상에만 그려진다.** 바깥 주소 이동(뒤로가기·주소 직접 편집)은 잠금 문을
   * 지나지 않아 **나가는 중에도 대상이 바뀔 수 있는데**, 그때 진행 표시가 따라오면 손대지도 않은
   * 문서가 「요청 중」이라고 말한다.
   *
   * 앞 감지기와 **같은 축으로 합쳐 재지 않는다** — 잠금은 화면 안 조작을, 표시는 바깥 이동을
   * 지난 뒤의 그림을 잰다.
   */
  it('바깥 주소 이동으로 대상이 바뀌면 진행 표시가 따라오지 않는다', async () => {
    const { requests, user } = await submitAndHold();

    await waitFor(() => {
      expect(writesTo(requests, REQUEST_CANCEL_PATH)).toHaveLength(1);
    });

    /* 나가는 중인 대상(9001)에서는 진행 표시가 돈다 — 짝 방향이 있어야 뒤 단언이 뜻을 갖는다. */
    expect(screen.getByRole('button', { name: t.cancelDialog.confirm })).toHaveAttribute(
      'aria-busy',
      'true',
    );

    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await waitFor(() => {
      expect(locationOf()).toContain('sel=9002');
    });

    /* 창은 대상의 것이라 함께 닫힌다. 남은 구획의 손잡이에 진행 표시가 붙지 않는다. */
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(requestCancelButton()).not.toHaveAttribute('aria-busy', 'true');
    });
  });

  /**
   * ⭐ **창이 Escape로 닫혀도 후처리가 무너지지 않는다**(C3-8). `reset()`을 곧바로 부르면
   * 나가는 중인 요청의 되먹임이 통째로 오지 않는다 — 요청은 서버에 갔는데 화면만 없던 일로 친다.
   */
  it('창을 Escape로 닫아도 성공 후처리가 그대로 온다', async () => {
    const { requests, release } = await submitAndHold();

    await waitFor(() => {
      expect(writesTo(requests, REQUEST_CANCEL_PATH)).toHaveLength(1);
    });

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    release();

    expect(await screen.findByText(t.cancelRequest.submitted)).toBeInTheDocument();
    /* 무효화도 함께 온다 — 되먹임이 끊겼으면 리소스 상세가 다시 나가지 않는다. */
    await waitFor(() => {
      expect(requestsTo(requests, CANCEL_RESOURCE_PATH).length).toBeGreaterThan(1);
    });
  });

  /**
   * ⭐ **인라인 오류도 매임을 지난다.** 나가는 중에 바깥 주소 이동으로 대상이 바뀌면 정리는
   * 요청을 끊지 않으려고 물러서는데(`resetIfIdle`), 그 뒤 도착한 거절 사유가 매임을 지나지
   * 않으면 **손대지도 않은 문서의 사유 칸에 남의 거절 사유가 붙는다.**
   *
   * 배너만 감추고 인라인을 놓치는 것이 이 자리의 흔한 반쪽이라, 칸 쪽을 따로 잰다.
   */
  it('대상이 바뀐 뒤 도착한 사유 오류가 새 대상의 칸에 붙지 않는다', async () => {
    fillDocumentTypes();
    const { requests, release, user } = renderScreen(
      cancelRoutes([
        failingRequestCancelRoute(400, {
          errors: [
            { scope: 'field', field: 'reason', code: 'TOO_SHORT', message: '사유가 짧습니다.' },
          ],
        }),
      ]),
      selectCancelTarget,
      `ty=${CANCEL_TYPE}&sel=9002`,
      [REQUEST_CANCEL_PATH],
    );

    await user.type(await screen.findByLabelText(t.cancelRequest.reason), '사유');
    await user.click(requestCancelButton());
    await user.click(screen.getByRole('button', { name: t.cancelDialog.confirm }));

    await waitFor(() => {
      expect(writesTo(requests, REQUEST_CANCEL_PATH)).toHaveLength(1);
    });

    /* 나가는 중에 바깥 주소 이동으로 대상이 바뀐다 — 잠금 문을 지나지 않는 길이다. */
    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await waitFor(() => {
      expect(locationOf()).toContain('sel=9002');
    });

    release();

    /* 거절이 도착했다 — 도착 자체는 확인하고(요청이 살아 있다), 새 대상에는 그리지 않는다. */
    await waitFor(() => {
      expect(requestCancelButton()).toBeEnabled();
    });
    expect(screen.queryByText('사유가 짧습니다.')).not.toBeInTheDocument();
  });

  /** 창이 닫혀 있으면 실패 배너가 **구획으로 옮겨 온다** — 자리 배타. */
  it('창이 닫힌 뒤 도착한 실패는 구획에 선다', async () => {
    fillDocumentTypes();
    const { requests, release, user } = renderScreen(
      cancelRoutes([failingRequestCancelRoute(500, { message: '합성 서버 오류' })]),
      selectCancelTarget,
      '',
      [REQUEST_CANCEL_PATH],
    );

    await user.type(await screen.findByLabelText(t.cancelRequest.reason), '사유');
    await user.click(requestCancelButton());
    await user.click(screen.getByRole('button', { name: t.cancelDialog.confirm }));

    await waitFor(() => {
      expect(writesTo(requests, REQUEST_CANCEL_PATH)).toHaveLength(1);
    });

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    release();

    expect(await screen.findByText('합성 서버 오류')).toBeInTheDocument();
    expect(within(cancelPane()).getByRole('alert')).toBeInTheDocument();
  });
});

/* ─────────────────────────────────────────────────────────────────────────────
 * 승인 진행과 취소 실행(단위 ④) — C4-1 ~ C4-16
 *
 * ⛔ **이 회차의 쓰기는 원장에서 수량을 되돌린다.** 그래서 여기 감지기들이 재는 것은 대체로
 * 「하지 않는다」이다 — 부르지 않는다 · 막지 않는다 · 권하지 않는다 · 따라오지 않는다.
 * ────────────────────────────────────────────────────────────────────────── */

/** 진행 중인 취소 요청의 승인 요청 **내부 식별자**. 화면에 나오면 안 되는 값이다(omf-mes#44). */
const CANCEL_APPROVAL_REQUEST_ID = 9501;
const APPROVAL_PATH = `/app/approval-requests/${String(CANCEL_APPROVAL_REQUEST_ID)}`;

const EXECUTE_CANCEL_PATH = `${CANCEL_RESOURCE_PATH}:cancel`;

const approvalRoute = (detail = approvalRequestDetail()): StubRoute => ({
  match: (request) => isGet(request, APPROVAL_PATH),
  respond: () => jsonResponse(detail),
});

/**
 * 서버 문구를 **화면 문면과 다른 글자로** 둔다 — 같으면 「서버 문구가 그대로 보인다」와
 * 「화면 문면이 섰다」를 가릴 수 없다.
 */
const failingApprovalRoute = (status: number, message = '합성 승인 조회 오류'): StubRoute => ({
  match: (request) => isGet(request, APPROVAL_PATH),
  respond: () => jsonResponse({ message }, { status }),
});

/**
 * 승인 요청의 **어떤 주소든** 받는 규칙.
 *
 * ⭐ **`/app/approval-requests/0`처럼 나가면 안 되는 주소까지 받는다.** 스텁이 받아 주지 않으면
 * 하네스가 던져 「요청이 나갔다」가 실패로 보이지만, 그것은 **부르지 않았다는 증명이 아니다** —
 * 받아 준 뒤 **기록이 0건임을 세는** 것이 증명이다.
 */
const anyApprovalRoute: StubRoute = {
  match: (request) =>
    request.method === 'GET' && new URL(request.url).pathname.startsWith('/app/approval-requests/'),
  respond: () => jsonResponse({ message: '이 주소는 나가면 안 된다' }, { status: 500 }),
};

const executeCancelRoute = (result = cancelResult()): StubRoute => ({
  match: (request) => isPost(request, EXECUTE_CANCEL_PATH),
  respond: () => jsonResponse(result),
});

const failingExecuteCancelRoute = (status: number, body: unknown): StubRoute => ({
  match: (request) => isPost(request, EXECUTE_CANCEL_PATH),
  respond: () => jsonResponse(body, { status }),
});

/** 취소 요청이 **진행 중인** 문서의 상세. 승인 진행 구획과 실행 축이 이 값으로 산다. */
const requestedDetail = (
  cancelApprovalRequestId: number | null = CANCEL_APPROVAL_REQUEST_ID,
  progress: Partial<(typeof documentProgressFixtures)[number]> = {},
) => cancelableDetail(progress, { cancelApprovalRequestId });

/**
 * 실행 축이 선 화면을 세우는 스텁 한 벌.
 *
 * **부르지 않음을 증명하려면 부를 수 있어야 한다** — 승인·실행 경로를 늘 깔아 둔다.
 */
const executeRoutes = (
  overrides: StubRoute[] = [],
  detail = requestedDetail(),
  /**
   * 주소를 손으로 고쳐 옮겨 갈 **다른 문서**의 상세. 기본은 고른 문서와 같은 모양이다 —
   * 「부르지 않는다」를 경로 전체에서 셀 때는 이쪽도 요청 없는 문서라야 한다.
   */
  otherDetail = detail,
): StubRoute[] => [
  ...overrides,
  listRoute(cancelableRows),
  detailRoute(detail, CANCEL_DETAIL_PATH),
  detailRoute(otherDetail, OTHER_CANCEL_DETAIL_PATH),
  cancelResourceRoute(),
  cancelResourceRoute('"token-9002"', OTHER_CANCEL_RESOURCE_PATH),
  requestCancelRoute(),
  approvalRoute(),
  executeCancelRoute(),
];

const approvalPane = (): HTMLElement => screen.getByRole('region', { name: t.approval.label });

const executePane = (): HTMLElement => screen.getByRole('region', { name: t.executeCancel.label });

const executeButton = (): HTMLElement =>
  within(executePane()).getByRole('button', { name: t.executeCancel.label });

const approvalRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname.startsWith('/app/approval-requests/'));

/** 확인 창을 지나 실행을 보낸다. **창을 거치지 않는 길은 화면에 없다.** */
const confirmExecute = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(executeButton());
  await user.click(screen.getByRole('button', { name: t.executeDialog.confirm }));
};

describe('승인 진행 조회를 부르는 조건 — C4-1 · C4-2', () => {
  /**
   * ⭐ **경로 전체에서 센다**(직전 회차의 지적 사본). 첫 렌더 · 다른 문서 고르기 · 주소 직접
   * 편집 어느 길로도 나가면 안 된다 — 나가면 `/app/approval-requests/null`처럼 뜻 없는 요청이
   * 서버에 닿는다.
   */
  it('취소 요청이 없으면 승인 진행을 한 번도 부르지 않는다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen(
      executeRoutes([anyApprovalRoute], cancelableDetail()),
      selectCancelTarget,
      `ty=${CANCEL_TYPE}&sel=9002`,
    );

    expect(await screen.findByText(t.approval.notSubmittedTitle)).toBeInTheDocument();
    expect(approvalRequests(requests)).toHaveLength(0);

    /* 주소를 손으로 고쳐 다른 문서로 옮겨도 마찬가지다 — 그 길은 클릭 핸들러를 지나지 않는다. */
    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await waitFor(() => {
      expect(locationOf()).toContain('sel=9002');
    });

    expect(approvalRequests(requests)).toHaveLength(0);
  });

  /**
   * ⛔ **없는 값을 메워 부르지 않는다.** 0·음수·소수로 부르면 남의 요청을 열거나 헛돈다 —
   * 그리고 화면은 「요청이 없다」가 아니라 **「확인할 수 없다」**고 말한다: 값이 실려 왔다는 것은
   * 요청이 있었을 수 있다는 뜻이다.
   */
  it.each([0, -1, 1.5])('조회할 수 없는 값(%s)이면 부르지 않고 그 사실을 말한다', async (raw) => {
    fillDocumentTypes();
    const { requests } = renderScreen(
      executeRoutes([anyApprovalRoute], requestedDetail(raw)),
      selectCancelTarget,
    );

    expect(await screen.findByText(t.approval.unusableTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.approval.notSubmittedTitle)).not.toBeInTheDocument();
    expect(approvalRequests(requests)).toHaveLength(0);

    /*
     * ⭐ **그런데 실행 버튼은 선다** — 조회의 조건과 버튼의 조건은 **다른 물음**이다(계획 §5-2).
     * 실행은 이 값을 쓰지 않고 `/logistics/{리소스}/{번호}:cancel`로 나가므로, 조회 하나가
     * 막혔다는 이유로 실행 자체가 사라지면 **값이 이상하게 온 문서는 영영 되돌릴 수 없다.**
     *
     * ⚠ 이 한 줄이 없으면 그 결정을 **순수 층 한 벌**만 지킨다 — 화면이 `hasCancelRequest`의
     * 답을 실제로 그 자리에 나르는지는 아무도 세지 않는다(검증 F-T4-1).
     */
    expect(executeButton()).toBeInTheDocument();
  });

  /** 짝 방향 — 쓸 수 있는 값이면 **그 번호의 주소로** 나간다. 아니면 위 단언이 「늘 안 부른다」다. */
  it('쓸 수 있는 값이면 그 번호의 승인 요청을 부른다', async () => {
    fillDocumentTypes();
    const { requests } = renderScreen(executeRoutes(), selectCancelTarget);

    await waitFor(() => {
      expect(approvalRequests(requests)).toHaveLength(1);
    });

    expect(approvalRequests(requests)[0]?.url.pathname).toBe(APPROVAL_PATH);
  });
});

describe('승인 진행 구획이 선다 — C4-3 · C4-4 · C4-5 · C4-6', () => {
  /** 단계 노드가 **응답의 `stepNo`** 다 — 배선까지 지나 화면에 그 번호가 선다. */
  it('단계 노드가 응답의 번호로 그려진다', async () => {
    fillDocumentTypes();
    renderScreen(executeRoutes(), selectCancelTarget);

    await screen.findByRole('region', { name: t.approval.label });

    for (const stepNo of ['11', '12', '13']) {
      expect(await within(approvalPane()).findByText(stepNo)).toBeInTheDocument();
    }
  });

  /** 승인 요청의 **내부 식별자**가 화면 어디에도 나오지 않는다(omf-mes#44). */
  it('승인 요청의 내부 번호가 화면에 나오지 않는다', async () => {
    fillDocumentTypes();
    renderScreen(executeRoutes(), selectCancelTarget);

    await within(await screen.findByRole('region', { name: t.approval.label })).findByText(
      'SYN-AP-2026-0001',
    );

    expect(
      screen.queryByText(new RegExp(String(CANCEL_APPROVAL_REQUEST_ID))),
    ).not.toBeInTheDocument();
  });

  /**
   * ⭐ **403에는 「다시 시도」가 없고 404에는 있다**(C4-3). 권한은 다시 눌러도 같은 답이 오지만,
   * 404는 방금 올린 요청이 승인 축에 아직 안 보이는 순간이라 다시 부르면 달라질 수 있다.
   */
  it('403이면 다시 시도가 없다', async () => {
    fillDocumentTypes();
    renderScreen(executeRoutes([failingApprovalRoute(403)]), selectCancelTarget);

    await screen.findByText(t.approval.forbiddenTitle);

    expect(
      within(approvalPane()).queryByRole('button', { name: messages.common.retry }),
    ).not.toBeInTheDocument();
  });

  it('404면 다시 시도가 승인 진행을 한 번 더 부른다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen(
      executeRoutes([failingApprovalRoute(404)]),
      selectCancelTarget,
    );

    await screen.findByText(t.approval.notFoundTitle);
    const before = approvalRequests(requests).length;

    await user.click(within(approvalPane()).getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(approvalRequests(requests).length).toBeGreaterThan(before);
    });
  });

  /**
   * ⭐ **어느 갈래에서도 화면 배너를 세우지 않는다**(C4-4). 승인 진행은 판단을 돕는 자료이지
   * 실행의 전제가 아니다 — 못 읽었다고 화면 전체가 실패로 보이면 사용자는 진행현황과 후속
   * 목록까지 못 믿게 된다.
   */
  it('승인 진행이 실패해도 진행현황과 취소 축이 그대로 보인다', async () => {
    fillDocumentTypes();
    renderScreen(executeRoutes([failingApprovalRoute(500)]), selectCancelTarget);

    await screen.findByText(t.approval.loadFailedTitle);

    /* 실패 표시는 승인 구획 **안**에만 있다. */
    expect(within(approvalPane()).getByText(t.approval.loadFailedTitle)).toBeInTheDocument();
    expect(screen.getByText(t.steps.caption)).toBeInTheDocument();
    expect(screen.getByLabelText(t.cancelRequest.reason)).toBeInTheDocument();
    expect(executeButton()).toBeInTheDocument();
  });

  /**
   * ⭐ **자리표시가 빈 동안 판정하지 않고 그 사실을 말한다**(C4-6). 짐작해 「승인되었습니다」를
   * 내면 이 화면에서는 **되돌릴 수 없는 실행**을 권하는 것이 된다.
   */
  it('승인 완료 자리표시가 비어 있으면 판정하지 못한다고 말한다', async () => {
    fillDocumentTypes();
    renderScreen(
      executeRoutes([approvalRoute(approvalRequestDetail({ statusCode: 'SYN_APPROVED' }))]),
      selectCancelTarget,
    );

    expect(await screen.findByText(t.approval.unjudgeableNote)).toBeInTheDocument();
    expect(screen.queryByText(t.approval.approvedNote)).not.toBeInTheDocument();
  });

  /**
   * ⭐ **자리표시를 채우면 화면이 저절로 달라진다.** 다른 자리는 하나도 바뀌지 않았다 —
   * 이것이 그 상수가 죽은 가지가 아니라는 증거이자, **화면이 그 값을 실제로 넘기고 있다**는
   * 증거다(부품 감지기는 이 배선을 지나지 않는다).
   */
  it('자리표시를 채우면 승인 문면이 선다', async () => {
    fillDocumentTypes();
    approvedStatusCodes.push('SYN_APPROVED');
    renderScreen(
      executeRoutes([approvalRoute(approvalRequestDetail({ statusCode: 'SYN_APPROVED' }))]),
      selectCancelTarget,
    );

    expect(await screen.findByText(t.approval.approvedNote)).toBeInTheDocument();
    expect(screen.queryByText(t.approval.unjudgeableNote)).not.toBeInTheDocument();
  });
});

describe('실행 버튼의 근거 — C4-7 · C4-8', () => {
  /**
   * ⭐ **`cancellable`이 거짓이어도 선다.** 취소 요청이 진행 중이면 서버가 그 값을 거짓으로
   * 내리는데(`CANCEL_IN_PROGRESS`) **그때가 바로 실행이 필요한 때다** — 그 값으로 버튼을 세우면
   * 실행 버튼이 영영 서지 않는다.
   */
  it('cancellable이 거짓이어도 요청이 있으면 실행 버튼이 선다', async () => {
    fillDocumentTypes();
    renderScreen(
      executeRoutes(
        [],
        requestedDetail(CANCEL_APPROVAL_REQUEST_ID, {
          cancellable: false,
          cancelBlockedReasonCode: 'CANCEL_IN_PROGRESS',
        }),
      ),
      selectCancelTarget,
    );

    await waitFor(() => {
      expect(executeButton()).toBeEnabled();
    });

    /* 짝 — 같은 화면에서 취소 **요청** 버튼은 잠겨 있다. 두 버튼의 근거가 서로 다르다. */
    expect(requestCancelButton()).toBeDisabled();
  });

  /** 요청이 없으면 버튼을 그리지 않고 무엇을 하면 서는지 말한다. */
  it('요청이 없으면 실행 버튼을 그리지 않는다', async () => {
    fillDocumentTypes();
    renderScreen(executeRoutes([anyApprovalRoute], cancelableDetail()), selectCancelTarget);

    await screen.findByRole('region', { name: t.executeCancel.label });

    expect(
      within(executePane()).queryByRole('button', { name: t.executeCancel.label }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(t.executeCancel.notRequestedNote)).toBeInTheDocument();
  });

  /**
   * ⭐ **승인 완료 자리표시가 비어 있어도 잠기지 않는다**(C4-8). 잠금의 정본은 서버이고 계약이
   * 「승인 전이면 400」이라 적었다 — 모르는 것을 「아니다」로 접으면 승인된 건까지 실행할 수 없어
   * 화면이 통째로 무용해진다.
   */
  it('승인 완료를 판정하지 못해도 실행 버튼이 잠기지 않는다', async () => {
    fillDocumentTypes();
    renderScreen(executeRoutes(), selectCancelTarget);

    await screen.findByText(t.approval.unjudgeableNote);

    expect(executeButton()).toBeEnabled();
  });

  /** 자리표시가 찼고 그 요청이 **승인이 아니어도** 잠기지 않는다 — 같은 이유다. */
  it('승인 상태가 아니어도 실행 버튼이 잠기지 않는다', async () => {
    fillDocumentTypes();
    approvedStatusCodes.push('SYN_APPROVED');
    renderScreen(executeRoutes(), selectCancelTarget);

    await screen.findByRole('region', { name: t.approval.label });

    expect(screen.queryByText(t.approval.approvedNote)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(executeButton()).toBeEnabled();
    });
  });

  /**
   * ⭐ **승인 진행을 아예 읽지 못해도 잠기지 않는다** — 위 셋과 같은 규율의 가장 거친 갈래다.
   */
  it('승인 진행을 못 읽어도 실행 버튼이 잠기지 않는다', async () => {
    fillDocumentTypes();
    renderScreen(executeRoutes([failingApprovalRoute(403)]), selectCancelTarget);

    await screen.findByText(t.approval.forbiddenTitle);

    expect(executeButton()).toBeEnabled();
  });

  /** ⛔ 취소 경로가 없는 유형에는 승인 진행도 실행도 그리지 않는다 — 진행할 승인 자체가 없다. */
  it('취소 경로가 없는 유형에는 두 구획이 서지 않는다', async () => {
    fillDocumentTypes();
    renderScreen([listRoute(), detailRoute()], `?ty=${SELECTABLE_TYPE}&sel=9001`);

    await screen.findByText(t.cancelRequest.unsupportedTitle);

    expect(screen.queryByRole('region', { name: t.approval.label })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: t.executeCancel.label })).not.toBeInTheDocument();
  });
});

describe('실행 확인 창 — C4-9 · C4-10 · C4-11', () => {
  /** 창을 열기만 해서는 아무것도 나가지 않는다 — 확인이 형식이 아니라는 것을 요청 수로 잰다. */
  it('창을 열기만 해서는 실행이 나가지 않는다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen(executeRoutes(), selectCancelTarget);

    await waitFor(() => {
      expect(executeButton()).toBeEnabled();
    });
    await user.click(executeButton());

    expect(screen.getByRole('dialog', { name: t.executeDialog.title })).toBeInTheDocument();
    expect(writesTo(requests, EXECUTE_CANCEL_PATH)).toHaveLength(0);
  });

  /** 창이 **대상 문서번호**를 말한다 — 화면이 고른 문서와 창이 확인하는 문서가 같아야 한다. */
  it('창이 고른 문서의 번호를 말한다', async () => {
    fillDocumentTypes();
    const { user } = renderScreen(executeRoutes(), selectCancelTarget);

    await waitFor(() => {
      expect(executeButton()).toBeEnabled();
    });
    await user.click(executeButton());

    expect(screen.getByText(t.executeDialog.target('SYN-GR-2026-0001'))).toBeInTheDocument();
  });

  /**
   * ⭐ **헤더 둘이 실리고 본문이 없다**(C4-11). `If-Match` 값이 **리소스 상세 응답의 `ETag`** 와
   * 같은지 **값으로** 견준다 — 액션 경로에서 꺼내면 늘 비어 요청이 아예 나가지 않는다.
   */
  it('멱등 키와 리소스 상세가 준 If-Match가 실리고 본문이 없다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen(executeRoutes(), selectCancelTarget);

    await waitFor(() => {
      expect(executeButton()).toBeEnabled();
    });
    await confirmExecute(user);

    await waitFor(() => {
      expect(writesTo(requests, EXECUTE_CANCEL_PATH)).toHaveLength(1);
    });

    const sent = writesTo(requests, EXECUTE_CANCEL_PATH)[0];

    expect(sent?.headers.get('Idempotency-Key')).not.toBeNull();
    expect(sent?.headers.get('If-Match')).toBe(CANCEL_RESOURCE_ETAG);
    expect(sent?.rawBody).toBe('');
  });

  /**
   * ⭐ **리소스 상세 200이 오기 전에는 실행할 수 없다** — 계약이 `If-Match`를 필수로 두어
   * 토큰 없이 열면 **눌러도 아무 일이 없는** 자리가 된다.
   */
  it('리소스 상세가 오기 전에는 실행 버튼이 잠긴다', async () => {
    fillDocumentTypes();
    const { release } = renderScreen(executeRoutes(), selectCancelTarget, '', [
      CANCEL_RESOURCE_PATH,
    ]);

    await screen.findByRole('region', { name: t.executeCancel.label });

    expect(executeButton()).toBeDisabled();
    expect(screen.getByText(t.executeCancel.preparing)).toBeInTheDocument();

    release();

    await waitFor(() => {
      expect(executeButton()).toBeEnabled();
    });
  });
});

describe('실행 200 — C4-12', () => {
  /**
   * ⭐ **역트랜잭션 번호가 영업일과 함께 선다.** 원장 조회는 영업일이 키의 일부라 번호만 내면
   * 사용자가 **찾을 수 없는데 찾을 수 있는 것처럼** 보인다.
   */
  it('reversed가 참이면 역트랜잭션 번호와 영업일이 함께 보인다', async () => {
    fillDocumentTypes();
    const { user } = renderScreen(executeRoutes(), selectCancelTarget);

    await waitFor(() => {
      expect(executeButton()).toBeEnabled();
    });
    await confirmExecute(user);

    expect(await screen.findByText(t.executionResult.reversedTitle)).toBeInTheDocument();
    expect(screen.getByText(t.ledger.pair('SYN-TX-9501', '2026-08-07'))).toBeInTheDocument();
  });

  /** 짝 갈래 — 전기 전 취소면 원장에 아무것도 생기지 않았다고 말한다. */
  it('reversed가 거짓이면 다른 문면이 선다', async () => {
    fillDocumentTypes();
    const { user } = renderScreen(
      executeRoutes([
        executeCancelRoute(
          cancelResult({
            reversed: false,
            reversalTransactionNo: null,
            reversalBusinessDate: null,
          }),
        ),
      ]),
      selectCancelTarget,
    );

    await waitFor(() => {
      expect(executeButton()).toBeEnabled();
    });
    await confirmExecute(user);

    expect(await screen.findByText(t.executionResult.notReversedTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.executionResult.reversedTitle)).not.toBeInTheDocument();
  });

  /** 성공하면 창이 닫히고 안내가 뜬다 — 열린 채로 두면 사용자가 한 번 더 누른다. */
  it('성공하면 창이 닫히고 안내가 뜬다', async () => {
    fillDocumentTypes();
    const { user } = renderScreen(executeRoutes(), selectCancelTarget);

    await waitFor(() => {
      expect(executeButton()).toBeEnabled();
    });
    await confirmExecute(user);

    expect(await screen.findByText(t.executeCancel.executed)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  /**
   * ⭐ **무효화 셋이 완성됐다** — 상태(진행현황)·토큰(리소스 상세)·**승인 진행**이 동시에
   * 달라지는 유일한 조작이다. 하나라도 빠지면 실행이 끝난 화면이 실행 전 사실을 계속 말한다.
   * **호출 횟수 증가로** 판정한다 — 화면에 보이는 값만 보면 캐시가 그대로여도 통과한다.
   */
  it('목록·진행현황 상세·리소스 상세·승인 진행을 다시 부른다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen(executeRoutes(), selectCancelTarget);

    await waitFor(() => {
      expect(executeButton()).toBeEnabled();
    });

    const before = {
      list: listRequests(requests).length,
      detail: requestsTo(requests, CANCEL_DETAIL_PATH).length,
      resource: requestsTo(requests, CANCEL_RESOURCE_PATH).length,
      approval: approvalRequests(requests).length,
    };

    await confirmExecute(user);

    await waitFor(() => {
      expect(listRequests(requests).length).toBeGreaterThan(before.list);
    });
    await waitFor(() => {
      expect(requestsTo(requests, CANCEL_DETAIL_PATH).length).toBeGreaterThan(before.detail);
    });
    await waitFor(() => {
      expect(requestsTo(requests, CANCEL_RESOURCE_PATH).length).toBeGreaterThan(before.resource);
    });
    await waitFor(() => {
      expect(approvalRequests(requests).length).toBeGreaterThan(before.approval);
    });
  });

  /**
   * ⭐ **취소 요청(202)도 승인 진행을 다시 부른다** — 앞 회차가 「조회가 없어 무효화할 대상이
   * 없다」며 미뤄 둔 자리다. 상신으로 **생기는 것**이 그 승인 요청이므로, 다시 부르지 않으면
   * 「올렸는데 승인 진행이 옛 값인」 화면이 남는다.
   */
  it('취소 요청 202도 승인 진행을 다시 부른다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen(executeRoutes(), selectCancelTarget);

    await waitFor(() => {
      expect(requestCancelButton()).toBeEnabled();
    });

    const before = approvalRequests(requests).length;

    await user.type(screen.getByLabelText(t.cancelRequest.reason), '사유');
    await user.click(requestCancelButton());
    await user.click(screen.getByRole('button', { name: t.cancelDialog.confirm }));

    await waitFor(() => {
      expect(approvalRequests(requests).length).toBeGreaterThan(before);
    });
  });
});

describe('실행 400 — C4-13 · C4-14', () => {
  const successorBlocked = {
    errors: [{ scope: 'screen', code: 'SUCCESSOR_EXISTS', message: '후속 문서가 있습니다' }],
  };

  const executeWith = async (routes: StubRoute[]) => {
    fillDocumentTypes();
    const rendered = renderScreen(executeRoutes(routes), selectCancelTarget);

    await waitFor(() => {
      expect(executeButton()).toBeEnabled();
    });
    await confirmExecute(rendered.user);

    return rendered;
  };

  /**
   * ⭐ **승인은 그대로 유효하다**(계획 §3 ⓔ · 공유계약 J-8). 막힌 것은 실행이고 요청은 살아 있다.
   */
  it('SUCCESSOR_EXISTS면 승인이 유효하다고 말한다', async () => {
    await executeWith([failingExecuteCancelRoute(400, successorBlocked)]);

    expect(await screen.findByText(t.blockedExecution.title)).toBeInTheDocument();
  });

  /**
   * ⛔ **「다시 요청하세요」류 권유가 없다.** 화면이 새 요청을 권하면 사용자가 **같은 승인을
   * 두 번** 받게 되고, 그 사이 원본 요청은 진행 중인 채 남는다. **창 전체 글자**를 훑는다.
   */
  it('새 요청을 다시 올리라고 권하지 않는다', async () => {
    await executeWith([failingExecuteCancelRoute(400, successorBlocked)]);

    await screen.findByText(t.blockedExecution.title);

    const text = screen.getByRole('dialog').textContent ?? '';

    for (const forbidden of ['다시 요청', '다시 올리', '재요청', '새로 요청']) {
      expect(text).not.toContain(forbidden);
    }
  });

  /**
   * ⭐ **진행현황 상세를 다시 부른다** — 그 400은 「승인을 기다리는 사이에 후속이 생겼다」는
   * 통지다. 다시 부르지 않으면 화면이 「후속 때문에 막혔다」라고 말하면서 후속을 하나도 보이지
   * 않는다. **호출 횟수 증가로** 판정한다.
   */
  it('SUCCESSOR_EXISTS면 진행현황 상세를 다시 부른다', async () => {
    const { requests } = await executeWith([failingExecuteCancelRoute(400, successorBlocked)]);

    await screen.findByText(t.blockedExecution.title);

    await waitFor(() => {
      expect(requestsTo(requests, CANCEL_DETAIL_PATH).length).toBeGreaterThan(1);
    });
  });

  /** 다시 부른 후속이 실패한 **그 자리**에 보인다 — 위 표까지 되돌아가 찾지 않아도 된다. */
  it('걸린 후속의 문서번호가 그 자리에 보인다', async () => {
    await executeWith([failingExecuteCancelRoute(400, successorBlocked)]);

    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText(/SYN-GI-2026-0101/)).toBeInTheDocument();
  });

  /**
   * ⛔ **그 밖의 400에는 그 문면을 쓰지 않는다**(C4-14). 승인 전에 온 400에 「승인은 유효하지만」을
   * 붙이면 **거짓**이고, 잔액이 음수가 되는 400에 붙이면 사용자가 후속을 찾아 헤맨다.
   */
  it('그 밖의 400은 서버 문구가 그대로 보이고 승인 문면이 서지 않는다', async () => {
    await executeWith([
      failingExecuteCancelRoute(400, {
        errors: [{ scope: 'screen', code: '', message: '승인이 끝나지 않았습니다' }],
      }),
    ]);

    expect(await screen.findByText('승인이 끝나지 않았습니다')).toBeInTheDocument();
    expect(screen.queryByText(t.blockedExecution.title)).not.toBeInTheDocument();
  });

  /** 그 밖의 400에서는 진행현황을 다시 부르지 않는다 — 후속이 생겼다는 통지가 아니다. */
  it('그 밖의 400은 진행현황 상세를 다시 부르지 않는다', async () => {
    const { requests } = await executeWith([
      failingExecuteCancelRoute(400, {
        errors: [{ scope: 'screen', code: '', message: '승인이 끝나지 않았습니다' }],
      }),
    ]);

    await screen.findByText('승인이 끝나지 않았습니다');

    expect(requestsTo(requests, CANCEL_DETAIL_PATH)).toHaveLength(1);
  });

  /**
   * ⭐ **실패에도 창이 닫히지 않는다**(C4-15). 닫으면 사용자는 무엇이 막았는지 모른 채 같은
   * 버튼을 다시 누른다 — 되돌릴 수 없는 조작이라 더 그렇다.
   */
  it('실패해도 창이 닫히지 않고 배너로 이유가 보인다', async () => {
    await executeWith([failingExecuteCancelRoute(403, { message: '합성 권한 오류' })]);

    /* 403은 공통 규약 문구로 옮긴다(`SaveErrorBanner`) — 화면이 그 갈래를 지어내지 않는다. */
    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: t.executeDialog.title })).toBeInTheDocument();
  });
});

describe('실행의 대상 매임과 잠금 — C4-16', () => {
  /** 다른 문서로 옮기면 앞 문서의 실행 결과가 따라오지 않는다. */
  it('다른 행을 고르면 실행 결과가 따라오지 않는다', async () => {
    fillDocumentTypes();
    const { user } = renderScreen(executeRoutes(), selectCancelTarget);

    await waitFor(() => {
      expect(executeButton()).toBeEnabled();
    });
    await confirmExecute(user);

    await screen.findByText(t.executionResult.reversedTitle);

    await user.click(screen.getByRole('button', { name: t.actions.selectRow('SYN-GR-2026-0002') }));

    await waitFor(() => {
      expect(locationOf()).toContain('sel=9002');
    });
    expect(screen.queryByText(t.executionResult.reversedTitle)).not.toBeInTheDocument();
  });

  /**
   * ⭐ **나가는 중에 바깥 주소 이동으로 대상이 바뀐 뒤 도착한 성공**이 새 대상에 붙지 않는다.
   *
   * 이 길이 매임의 요점이다 — 정리 effect는 대상이 바뀐 **그 순간**에 이미 지나갔고, 그 뒤에
   * 도착한 성공이 상태를 **새로** 채운다. 성공 때 「지금 대상」을 읽는 구현은 여기서 갈린다:
   * 손대지도 않은 문서가 「원장에 역트랜잭션이 생겼습니다」라고 말한다.
   */
  it('나가는 중 대상이 바뀌면 도착한 결과가 새 대상에 서지 않는다', async () => {
    fillDocumentTypes();
    const { requests, release, user } = renderScreen(
      executeRoutes(),
      selectCancelTarget,
      `ty=${CANCEL_TYPE}&sel=9002`,
      [EXECUTE_CANCEL_PATH],
    );

    await waitFor(() => {
      expect(executeButton()).toBeEnabled();
    });
    await confirmExecute(user);

    await waitFor(() => {
      expect(writesTo(requests, EXECUTE_CANCEL_PATH)).toHaveLength(1);
    });

    /* Escape로 창을 닫는다 — 막을 수 없는 길이고, 그 뒤에야 바깥 주소 이동이 가능해진다. */
    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await waitFor(() => {
      expect(locationOf()).toContain('sel=9002');
    });

    release();

    /* 성공은 도착한다 — 안내가 그 증거다. 그러나 결과는 새 대상에 그려지지 않는다. */
    expect(await screen.findByText(t.executeCancel.executed)).toBeInTheDocument();
    expect(screen.queryByText(t.executionResult.reversedTitle)).not.toBeInTheDocument();
  });

  /**
   * ⭐ **나가는 중에 대상이 바뀐 뒤 도착한 실패**가 새 대상의 구획에 서지 않는다.
   *
   * ⚠ **정리 effect만으로는 막히지 않는 길이다.** 대상이 바뀔 때 `resetCancelEditing`이 돌지만
   * 그 안의 `resetIfIdle`는 **나가는 중이면 물러난다** — 그 뒤에 도착한 거절은 훅에 그대로 앉는다.
   * 그래서 매임(`isExecuteResultMine`)이 **그리는 자리에서** 한 번 더 걸러야 한다: 걸러지지 않으면
   * 손대지도 않은 문서에 **되돌릴 수 없는 조작이 실패했다**는 배너가 선다.
   *
   * (앞 회차가 사유 칸에서 같은 형태의 오판을 겪었다 — 「걷는 함수의 걷지 않는 조건을 먼저 연다」.)
   */
  it('나가는 중 대상이 바뀌면 도착한 실패가 새 대상의 구획에 서지 않는다', async () => {
    fillDocumentTypes();
    const { requests, release, user } = renderScreen(
      executeRoutes([failingExecuteCancelRoute(500, { message: '합성 실행 서버 오류' })]),
      selectCancelTarget,
      `ty=${CANCEL_TYPE}&sel=9002`,
      [EXECUTE_CANCEL_PATH],
    );

    await waitFor(() => {
      expect(executeButton()).toBeEnabled();
    });
    await confirmExecute(user);

    await waitFor(() => {
      expect(writesTo(requests, EXECUTE_CANCEL_PATH)).toHaveLength(1);
    });

    /* Escape로 창을 닫는다 — 막을 수 없는 길이고, 그 뒤에야 바깥 주소 이동이 가능해진다. */
    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await waitFor(() => {
      expect(locationOf()).toContain('sel=9002');
    });

    release();

    /*
     * 거절이 **도착했다**는 것을 먼저 잡는다(잠금이 풀리는 것이 그 증거다) — 도착 전에 「없다」를
     * 재면 아직 아무것도 없는 화면에서 늘 통과하는 단언이 된다(사본 체크리스트 9번).
     */
    await waitFor(() => {
      expect(executeButton()).toBeEnabled();
    });
    expect(screen.queryByText('합성 실행 서버 오류')).not.toBeInTheDocument();
  });

  /**
   * ⭐ **잠금 문면이 무엇이 나가는 중인지 말한다**(단위 ④에서 갈래를 나눈 자리). 앞 회차의 한
   * 문장은 「취소 요청」만 말해 **실행 중에는 거짓**이었다.
   */
  it('실행이 나가는 중이면 실행 문면이 서고 요청 문면은 서지 않는다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen(executeRoutes(), selectCancelTarget, '', [
      EXECUTE_CANCEL_PATH,
    ]);

    await waitFor(() => {
      expect(executeButton()).toBeEnabled();
    });
    await confirmExecute(user);

    await waitFor(() => {
      expect(writesTo(requests, EXECUTE_CANCEL_PATH)).toHaveLength(1);
    });

    expect(screen.getByText(t.notes.lock.execute)).toBeInTheDocument();
    expect(screen.queryByText(t.notes.lock.request)).not.toBeInTheDocument();
  });

  /** 짝 방향 — 요청이 나가는 중이면 요청 문면이다. 두 갈래가 실제로 갈리는지 함께 잰다. */
  it('요청이 나가는 중이면 요청 문면이 서고 실행 문면은 서지 않는다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen(executeRoutes(), selectCancelTarget, '', [
      REQUEST_CANCEL_PATH,
    ]);

    await waitFor(() => {
      expect(requestCancelButton()).toBeEnabled();
    });

    await user.type(screen.getByLabelText(t.cancelRequest.reason), '사유');
    await user.click(requestCancelButton());
    await user.click(screen.getByRole('button', { name: t.cancelDialog.confirm }));

    await waitFor(() => {
      expect(writesTo(requests, REQUEST_CANCEL_PATH)).toHaveLength(1);
    });

    expect(screen.getByText(t.notes.lock.request)).toBeInTheDocument();
    expect(screen.queryByText(t.notes.lock.execute)).not.toBeInTheDocument();
  });

  /**
   * ⭐ **진행 표시(스피너)의 축이 잠금의 축과 다르다 — 배선을 화면에서 잰다.**
   *
   * ```
   * isCancelLocked      = cancelWrite.isSaving || executeWrite.isSaving   // 전역·두 쓰기
   * isExecuteSavingMine = executeWrite.isSaving && isExecuteResultMine    // 실행·대상 매임
   * ```
   *
   * ⚠ **부품 감지기는 이 배선을 지나지 않는다** — 부품은 두 축을 prop으로 **직접** 받으므로,
   * 화면이 그 자리에 전역 잠금을 꽂아도 부품 시험은 전부 통과한다(리뷰 M-1의 뮤턴트가 577건을
   * 통과한 이유다). 그래서 **화면 층에서** 두 갈래를 각각 잰다.
   *
   * ⛔ **되돌릴 수 없는 조작이라 특히 무겁다**: 버튼이 「지금 나가는 중」이라고 잘못 말하면
   * 사용자는 눌렀는지 아닌지를 그 표시로 판단한다.
   *
   * 갈래 ① — **다른 조작**(취소 요청)이 나가는 중일 때.
   */
  it('취소 요청이 나가는 중이어도 실행 버튼은 돌지 않는다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen(executeRoutes(), selectCancelTarget, '', [
      REQUEST_CANCEL_PATH,
    ]);

    await waitFor(() => {
      expect(requestCancelButton()).toBeEnabled();
    });

    await user.type(screen.getByLabelText(t.cancelRequest.reason), '사유');
    await user.click(requestCancelButton());
    await user.click(screen.getByRole('button', { name: t.cancelDialog.confirm }));

    await waitFor(() => {
      expect(writesTo(requests, REQUEST_CANCEL_PATH)).toHaveLength(1);
    });

    /* Escape로 창을 닫는다 — 창이 덮고 있으면 아래 구획의 손잡이를 볼 수 없다. */
    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    /* 짝 양성 — 나가는 중인 **그 조작**의 손잡이는 돈다. 없으면 뒤 단언이 뜻을 잃는다. */
    expect(requestCancelButton()).toHaveAttribute('aria-busy', 'true');

    /* ⭐ 실행은 **잠기되 돌지 않는다** — 두 축이 갈리는 자리가 정확히 여기다. */
    expect(executeButton()).toBeDisabled();
    expect(executeButton()).not.toHaveAttribute('aria-busy');
  });

  /** 갈래 ①의 짝 방향 — 실행이 나가는 중이면 **실행 손잡이만** 돈다. */
  it('실행이 나가는 중이면 실행 버튼만 돈다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen(executeRoutes(), selectCancelTarget, '', [
      EXECUTE_CANCEL_PATH,
    ]);

    await waitFor(() => {
      expect(executeButton()).toBeEnabled();
    });
    await confirmExecute(user);

    await waitFor(() => {
      expect(writesTo(requests, EXECUTE_CANCEL_PATH)).toHaveLength(1);
    });

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(executeButton()).toHaveAttribute('aria-busy', 'true');
    expect(requestCancelButton()).not.toHaveAttribute('aria-busy');
  });

  /**
   * 갈래 ② — **바깥 주소 이동으로 대상이 바뀐 뒤.**
   *
   * 그 길은 잠금 문을 지나지 않아 **나가는 중에도 대상이 바뀔 수 있는데**, 진행 표시가 따라오면
   * **손대지도 않은 문서**의 실행 손잡이가 「지금 되돌리는 중」이라고 말한다.
   *
   * ⚠ 앞 회차가 세운 같은 이름의 감지기는 마지막 단언이 **요청 축 손잡이**라 이 자리를 덮지
   * 않는다 — 축이 다르면 감지기도 따로 세운다.
   */
  it('나가는 중 대상이 바뀌면 새 대상의 실행 버튼이 돌지 않는다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen(
      executeRoutes(),
      selectCancelTarget,
      `ty=${CANCEL_TYPE}&sel=9002`,
      [EXECUTE_CANCEL_PATH],
    );

    await waitFor(() => {
      expect(executeButton()).toBeEnabled();
    });
    await confirmExecute(user);

    await waitFor(() => {
      expect(writesTo(requests, EXECUTE_CANCEL_PATH)).toHaveLength(1);
    });

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    /* 짝 양성 — 아직 그 대상이라 돈다. */
    expect(executeButton()).toHaveAttribute('aria-busy', 'true');

    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await waitFor(() => {
      expect(locationOf()).toContain('sel=9002');
    });

    /* ⭐ 대상이 바뀌었다 — 요청은 아직 나가는 중이지만(잠김) 이 문서의 손잡이는 돌지 않는다. */
    await waitFor(() => {
      expect(executeButton()).not.toHaveAttribute('aria-busy');
    });
    expect(executeButton()).toBeDisabled();
  });

  /**
   * ⭐ **실행이 나가는 중에는 취소 요청도 잠긴다** — 한 잠금이 두 쓰기를 함께 덮는다.
   * 잠그지 않으면 되돌리는 요청과 되돌리는 실행이 겹쳐 나간다.
   */
  it('실행이 나가는 중에는 다른 조작이 잠긴다', async () => {
    fillDocumentTypes();
    const { requests, user } = renderScreen(executeRoutes(), selectCancelTarget, '', [
      EXECUTE_CANCEL_PATH,
    ]);

    await waitFor(() => {
      expect(executeButton()).toBeEnabled();
    });
    await confirmExecute(user);

    await waitFor(() => {
      expect(writesTo(requests, EXECUTE_CANCEL_PATH)).toHaveLength(1);
    });

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(requestCancelButton()).toBeDisabled();
    expect(executeButton()).toBeDisabled();

    /* 다른 행을 눌러도 대상이 바뀌지 않는다 — 잠금 문이 주소를 갈아 끼우지 않는다. */
    await user.click(screen.getByRole('button', { name: t.actions.selectRow('SYN-GR-2026-0002') }));
    expect(locationOf()).toContain('sel=9001');
  });

  /**
   * ⭐ **Escape로 창이 닫혀도 후처리가 무너지지 않는다**(C4-10의 화면 쪽 절반). 나가는 요청을
   * 끊지 않으므로 성공 안내와 결과가 그대로 온다.
   */
  it('창을 Escape로 닫아도 성공 후처리가 그대로 온다', async () => {
    fillDocumentTypes();
    const { requests, release, user } = renderScreen(executeRoutes(), selectCancelTarget, '', [
      EXECUTE_CANCEL_PATH,
    ]);

    await waitFor(() => {
      expect(executeButton()).toBeEnabled();
    });
    await confirmExecute(user);

    await waitFor(() => {
      expect(writesTo(requests, EXECUTE_CANCEL_PATH)).toHaveLength(1);
    });

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    release();

    expect(await screen.findByText(t.executeCancel.executed)).toBeInTheDocument();
    expect(await screen.findByText(t.executionResult.reversedTitle)).toBeInTheDocument();
  });

  /** 창이 닫혀 있으면 실패 배너가 **구획으로 옮겨 온다** — 자리 배타. */
  it('창이 닫힌 뒤 도착한 실패는 실행 구획에 선다', async () => {
    fillDocumentTypes();
    const { requests, release, user } = renderScreen(
      executeRoutes([failingExecuteCancelRoute(500, { message: '합성 실행 서버 오류' })]),
      selectCancelTarget,
      '',
      [EXECUTE_CANCEL_PATH],
    );

    await waitFor(() => {
      expect(executeButton()).toBeEnabled();
    });
    await confirmExecute(user);

    await waitFor(() => {
      expect(writesTo(requests, EXECUTE_CANCEL_PATH)).toHaveLength(1);
    });

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    release();

    expect(await screen.findByText('합성 실행 서버 오류')).toBeInTheDocument();
    expect(within(executePane()).getByRole('alert')).toBeInTheDocument();
  });
});
