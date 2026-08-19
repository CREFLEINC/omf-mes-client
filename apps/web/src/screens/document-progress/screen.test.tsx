import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useSearchParams } from 'react-router';
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
import { documentProgressFixtures, documentTypeFixtures, toProgressResponse } from './fixtures';

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

/* 목을 걸고 난 뒤에 화면을 들여온다 — 위에서 들여오면 실물 상수가 먼저 박힌다. */
const { DocumentProgressScreen } = await import('./screen');

const ROUTE = '/logistics/document-progress';
const LIST_PATH = '/logistics/document-progress';

const SELECTABLE_TYPE = 'SYN_DOC_TYPE_A';
const DISABLED_TYPE = 'SYN_DOC_TYPE_C';

beforeEach(() => {
  documentTypes.length = 0;
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

/** 주소가 실제로 어떻게 바뀌는지 본다. */
const LocationProbe = () => {
  const location = useLocation();

  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
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
