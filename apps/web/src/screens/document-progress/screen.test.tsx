import { messages } from '@omf-mes/i18n';
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
import type { DocumentTypeEntry } from './document-types';
import {
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

/* 목을 걸고 난 뒤에 화면을 들여온다 — 위에서 들여오면 실물 상수가 먼저 박힌다. */
const { DocumentProgressScreen } = await import('./screen');

const ROUTE = '/logistics/document-progress';
const LIST_PATH = '/logistics/document-progress';

const SELECTABLE_TYPE = 'SYN_DOC_TYPE_A';
const DISABLED_TYPE = 'SYN_DOC_TYPE_C';

beforeEach(() => {
  documentTypes.length = 0;
  locationLog.length = 0;

  for (const key of Object.keys(screenRoutes)) delete screenRoutes[key];
});

const fillDocumentTypes = (): void => {
  documentTypes.push(...documentTypeFixtures);
};

interface RecordedRequest {
  method: string;
  url: URL;
}

/** 요청을 기록하면서 스텁 규칙으로 응답한다. 규칙에 없는 요청은 하네스가 던져 스텁 누락을 드러낸다. */
const createRecordingFetch = (
  routes: StubRoute[],
): { fetch: StubFetch; requests: RecordedRequest[] } => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch(routes);

  const fetch: StubFetch = async (request) => {
    requests.push({ method: request.method, url: new URL(request.url) });

    return stub(request);
  };

  return { fetch, requests };
};

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

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
): { requests: RecordedRequest[]; user: ReturnType<typeof userEvent.setup> } => {
  const { fetch, requests } = createRecordingFetch(routes);

  renderWithProviders(
    <>
      <DocumentProgressScreen />
      <LocationProbe />
      <SearchProbe to={navigateTo} />
      <BackProbe />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, user: userEvent.setup() };
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
    documentTypes.push({ code: SELECTABLE_TYPE, label: '합성 유형 가', disabledReason: null });
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
   * **두 축으로 잰다** — 주소 문자열이 비었는가, 그리고 **다시 나간 요청의 질의값**이 실제로
   * 조건을 잃었는가. 주소만 재면 요청이 옛 조건으로 나가도 통과한다.
   */
  it('초기화가 주소의 조건을 비우고 조회도 조건 없이 다시 나간다', async () => {
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
