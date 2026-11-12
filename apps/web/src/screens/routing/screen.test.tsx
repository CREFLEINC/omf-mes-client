import { messages } from '@omf-mes/i18n';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  processFixtures,
  routingFixtures,
  routingOperationFixtures,
} from './fixtures';
import { SessionProvider } from '../../patterns/session';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import { RoutingScreen } from './screen';
import type { Routing } from './types';

const ROUTE = '/master-data/routing';

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

const listBody = (items: unknown[], total = items.length): unknown => ({
  items,
  page: { page: 1, size: 20, total },
});

const itemListRoute = (items = itemFixtures, total = items.length): StubRoute => ({
  match: (request) => isGet(request, '/mdm/items'),
  respond: () => jsonResponse(listBody(items, total)),
});

const revisionListRoute = (items = routingFixtures): StubRoute => ({
  match: (request) => isGet(request, '/planning/routings'),
  respond: () => jsonResponse({ items }),
});

const DEFAULT_EDITABILITY = { codeEditable: true, reason: 'EDITABLE' as const };

interface EditabilityStub {
  codeEditable: boolean;
  reason: 'EDITABLE' | 'REFERENCED' | 'NOT_COUNTABLE' | 'RECEIVED_FROM_ERP';
  referenceCount?: number | null;
}

const routingDetailRoute = (
  routing: Routing = routingFixtures[0]!,
  editability: EditabilityStub = DEFAULT_EDITABILITY,
  etag = '"7"',
): StubRoute => ({
  match: (request) => isGet(request, `/planning/routings/${String(routing.routingId)}`),
  respond: () => jsonResponse({ routing, editability }, { headers: { ETag: etag } }),
});

/**
 * 개정 목록은 상세 카드의 「이력 관리」 탭에 있다(#231). 개정을 골랐거나 등록 중이면 카드가 「설정」 탭으로 열리므로,
 * Rev 줄을 보거나 누르려면 이 탭으로 옮긴다.
 */
const openHistory = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(await screen.findByRole('tab', { name: 'Rev 이력' }));
};

const renderScreen = (routes: StubRoute[], search = '') => {
  const { fetch, requests } = createRecordingFetch(routes);
  /* 앱처럼 데이터 라우터로 감싼다 — 저장하지 않은 편집의 이동 확인이 그 위에서만 선다. */
  const { router } = renderWithProviders(
    /* 「검사 기준 수정」 · 「라우팅 조회」가 권한을 본다 — 권한 목록이 없는 세션이라 다 열린다. */
    <SessionProvider>
      <RoutingScreen />
    </SessionProvider>,
    {
      session: SYNTHETIC_SESSION,
      fetch,
      route: `${ROUTE}${search}`,
      dataRouter: true,
    },
  );

  return { requests, router, user: userEvent.setup() };
};

const requestsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === pathname);

/** 품목 목록 요청 — 진행 상태 칩의 건수 요청(size=1 · #231)은 뺀다. */
const itemRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requestsTo(requests, '/mdm/items').filter(
    (request) => request.url.searchParams.get('size') !== '1',
  );

const revisionRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requestsTo(requests, '/planning/routings');

/**
 * 헤더와 공정 라인은 저장 버튼을 하나씩 따로 갖는다(두 요청의 실패 갈래가 다르다).
 * 이름만으로 조회하면 어느 구획의 버튼인지 갈리지 않으므로 구획으로 좁힌다.
 */
const headerRegion = (): HTMLElement => screen.getByRole('region', { name: 'Routing 정보' });

/** 설정 탭 맨 아래 취소 · 저장 · 확정 · 폐기 줄(#231) — 기본 정보 · 공정 구성을 함께 다룬다. */
const actionsRegion = (): HTMLElement => screen.getByRole('region', { name: '편집 단추' });

describe('RoutingScreen — 품목 검색·선택', () => {
  it('서버 응답의 품목을 표에 그린다', async () => {
    renderScreen([itemListRoute()]);

    expect(await screen.findByRole('button', { name: 'ITM-001' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ITM-002' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ITM-003' })).toBeInTheDocument();
  });

  it('검색어와 진행 상태 「미등록」이 요청 쿼리에 실린다', async () => {
    const { requests, user } = renderScreen([itemListRoute()]);
    await screen.findByRole('button', { name: 'ITM-001' });

    await user.click(screen.getByRole('button', { name: /^미등록/ }));
    /* 품목은 칸에서 바로 검색해 고른다 — 고른 품목코드가 검색어가 된다(#231). */
    await user.click(screen.getByLabelText('품목 검색'));
    await user.click(await screen.findByRole('option', { name: 'ITM-002 · 브래킷' }));
    await user.click(screen.getByRole('button', { name: '조회' }));

    /* 검색 칸의 후보 요청(검색어 없음)도 같은 경로라, 조회로 나간 목록 요청(검색어 있음)만 본다. */
    const last = itemRequests(requests)
      .filter((request) => request.url.searchParams.has('q'))
      .at(-1);
    expect(last?.url.searchParams.get('q')).toBe('ITM-002');
    expect(last?.url.searchParams.get('hasRouting')).toBe('false');
  });

  it('진행 상태가 「전체」면 hasRouting · latestRoutingStatus 를 싣지 않는다 — true는 뜻이 정반대가 된다', async () => {
    const { requests } = renderScreen([itemListRoute()]);
    await screen.findByRole('button', { name: 'ITM-001' });

    const first = itemRequests(requests)[0];
    expect(first?.url.searchParams.has('hasRouting')).toBe(false);
    expect(first?.url.searchParams.has('latestRoutingStatus')).toBe(false);
  });

  /* 진행 상태 칩(#231) — 작성중 · 확정 · 폐기는 가장 최근 Rev 의 상태로 서버가 거른다. 칩은 주소(status)에 남는다. */
  it('진행 상태 칩 「작성중」을 누르면 latestRoutingStatus=DRAFT 로 조회하고 주소에 남는다', async () => {
    const { requests, router, user } = renderScreen([itemListRoute()]);
    await screen.findByRole('button', { name: 'ITM-001' });

    await user.click(screen.getByRole('button', { name: /^작성중/ }));

    await waitFor(() => {
      expect(itemRequests(requests).at(-1)?.url.searchParams.get('latestRoutingStatus')).toBe(
        'DRAFT',
      );
    });
    expect(itemRequests(requests).at(-1)?.url.searchParams.has('hasRouting')).toBe(false);
    expect(router?.state.location.search).toContain('status=DRAFT');
    expect(screen.getByRole('button', { name: /^작성중/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('조회 조건은 URL에 남는다 — 새로고침·공유가 같은 결과를 낸다', async () => {
    const { requests } = renderScreen([itemListRoute()], '?q=ITM&noRouting=1');
    await screen.findByRole('button', { name: 'ITM-001' });

    const first = itemRequests(requests)[0];
    expect(first?.url.searchParams.get('q')).toBe('ITM');
    expect(first?.url.searchParams.get('hasRouting')).toBe('false');
    expect(screen.getByRole('button', { name: /^미등록/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('조회에 실패하면 표와 빈 상태 대신 오류 배너와 다시 시도가 뜬다', async () => {
    renderScreen([
      {
        match: (request) => isGet(request, '/mdm/items'),
        respond: () => jsonResponse({ message: '' }, { status: 500 }),
      },
    ]);

    expect(await screen.findByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('등록된 품목이 없습니다')).not.toBeInTheDocument();
    // 서버가 빈 message를 줘도 배너에 제목만 남으면 안 된다 — 무엇을 하라는 안내가 사라진다.
    expect(
      screen.getByText('잠시 뒤 재시도하세요. 지속적인 요청 불가 시 담당자에게 문의하세요.'),
    ).toBeInTheDocument();
  });

  it('다시 시도를 누르면 목록 요청이 한 번 더 나간다', async () => {
    const { requests, user } = renderScreen([
      {
        match: (request) => isGet(request, '/mdm/items'),
        respond: () => jsonResponse({ message: '' }, { status: 500 }),
      },
    ]);

    await user.click(await screen.findByRole('button', { name: '다시 시도' }));

    expect(itemRequests(requests).length).toBeGreaterThan(1);
  });

  /* 잘림 안내 대신 쪽 이동 줄로 나머지 쪽을 본다(#231). */
  it('전체 건수가 받은 건수보다 많으면 쪽 이동 줄이 전체 건수와 쪽 수를 보인다', async () => {
    renderScreen([itemListRoute(itemFixtures, 120)]);

    expect(await screen.findByText('총 120건')).toBeInTheDocument();
    expect(screen.getByText('1 / 6')).toBeInTheDocument();
    expect(screen.queryByText(/조건을 좁혀 조회하세요/)).not.toBeInTheDocument();
  });

  /* 고르기 전 상세 칸은 안내 상자 하나만이다 — 개정 목록 · 기본 정보 · 공정 라인 칸을 비워 세우지 않는다(#231). */
  it('품목을 고르기 전에는 상세 칸에 「품목을 선택하세요」 상자 하나만 낸다', async () => {
    renderScreen([itemListRoute()]);
    await screen.findByRole('button', { name: 'ITM-001' });

    expect(screen.getAllByText('품목을 선택하세요')).toHaveLength(1);
    expect(screen.queryByRole('region', { name: 'Rev 목록' })).not.toBeInTheDocument();
  });

  it('품목을 고르면 작성중 개정을 바로 연다(#231)', async () => {
    const { router } = renderScreen([itemListRoute(), revisionListRoute()], '?item=5001');

    const card = await screen.findByRole('region', { name: '공정 경로' });
    expect(within(card).getByRole('tab', { name: '설정' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await waitFor(() => {
      expect(router?.state.location.search).toContain('rev=7003');
    });
  });

  it('작성중이 없으면 가장 최근 확정 개정을 연다(#231)', async () => {
    const noDraft = routingFixtures.filter((row) => row.statusCode !== 'DRAFT');
    const { router } = renderScreen([itemListRoute(), revisionListRoute(noDraft)], '?item=5001');

    await waitFor(() => {
      expect(router?.state.location.search).toContain('rev=7002');
    });
  });

  it('작성중 · 확정 개정이 없으면 이력 관리 탭(개정 목록)으로 열리고, 설정 탭은 「개정을 선택하세요」 상자 하나만 낸다', async () => {
    const obsoleteOnly = routingFixtures.map((row) => ({ ...row, statusCode: 'OBSOLETE' }));
    const { user } = renderScreen([itemListRoute(), revisionListRoute(obsoleteOnly)], '?item=5001');

    expect(await screen.findByRole('region', { name: 'Rev 목록' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Rev 이력' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('품목을 선택하세요')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: '설정' }));
    expect(screen.getAllByText('개정을 선택하세요')).toHaveLength(1);
  });

  it('URL의 item으로 선택이 복원된다', async () => {
    renderScreen([itemListRoute()], '?item=5002');

    expect(await screen.findByRole('button', { name: 'ITM-002' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });
});

describe('RoutingScreen — Rev 목록 조회·선택', () => {
  /*
   * 품목 목록의 「기본 Rev」 열이 보이는 품목마다 Rev 목록을 받는다(#231) — 그래도 itemId 없는 요청은 없다
   * (계약이 itemId를 필수로 둔다).
   */
  it('Rev 요청은 언제나 itemId를 싣고, 품목 목록의 품목마다 한 번씩 나간다', async () => {
    const { requests } = renderScreen([itemListRoute(), revisionListRoute()]);
    await screen.findByRole('button', { name: 'ITM-001' });

    await waitFor(() => {
      expect(revisionRequests(requests)).toHaveLength(itemFixtures.length);
    });
    expect(
      revisionRequests(requests).every((request) => request.url.searchParams.has('itemId')),
    ).toBe(true);
  });

  it('품목 목록에 기본 Rev 열을 보이고, 유효 날짜 열은 없다(#231)', async () => {
    renderScreen([itemListRoute(), revisionListRoute()]);
    await screen.findByRole('button', { name: 'ITM-001' });

    const itemPane = screen.getByRole('region', { name: '품목' });
    expect(within(itemPane).getByRole('columnheader', { name: /기본 Rev/ })).toBeInTheDocument();
    expect((await within(itemPane).findAllByText('Rev 2')).length).toBeGreaterThan(0);
    expect(within(itemPane).queryByRole('columnheader', { name: /유효/ })).toBeNull();
  });

  it('품목을 고르면 itemId를 실은 Rev 요청이 나가고 목록이 그려진다', async () => {
    const { requests, user } = renderScreen([itemListRoute(), revisionListRoute()]);

    await user.click(await screen.findByRole('button', { name: 'ITM-001' }));

    await openHistory(user);
    expect(await screen.findByRole('button', { name: 'Rev 3 상세 보기' })).toBeInTheDocument();
    expect(
      revisionRequests(requests).some(
        (request) => request.url.searchParams.get('itemId') === '5001',
      ),
    ).toBe(true);
  });

  it('품목을 바꾸면 이전 품목의 Rev 선택이 지워진다', async () => {
    const { user } = renderScreen([itemListRoute(), revisionListRoute()], '?item=5001&rev=7002');

    await openHistory(user);
    expect(await screen.findByRole('button', { name: 'Rev 2 상세 보기' })).toHaveAttribute(
      'aria-current',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'ITM-002' }));

    await openHistory(user);
    expect(screen.getByRole('button', { name: 'Rev 2 상세 보기' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  /* 상세 보기는 창으로 연다 — 설정 탭으로 넘어가지 않고, 보고 있는 Rev 와 주소도 그대로다(사용자 지시 · #231). */
  it('상세 보기를 누르면 그 Rev 의 정보와 공정 구성을 창으로 보이고, 설정 탭 · 주소 · 선택은 그대로다', async () => {
    const { user, router } = renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(),
        operationListRoute(7003),
        operationListRoute(7002, routingOperationFixtures.slice(0, 1)),
        processListRoute(),
      ],
      '?item=5001&rev=7003',
    );
    if (router === null) throw new Error('데이터 라우터가 없습니다');

    await openHistory(user);
    await user.click(await screen.findByRole('button', { name: 'Rev 2 상세 보기' }));

    const dialog = await screen.findByRole('dialog', { name: 'Rev 2 상세' });
    expect(await within(dialog).findByText('1차 사출')).toBeInTheDocument();
    expect(within(dialog).queryByText('2차 조립')).toBeNull();
    /* 보기만 한다 — 공정 추가 · 공정 연결 · 편집 · 저장 단추가 없다. */
    for (const name of ['공정 추가', '공정 연결', '저장', '1번 공정 수정']) {
      expect(within(dialog).queryByRole('button', { name })).toBeNull();
    }
    await user.click(within(dialog).getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('dialog', { name: 'Rev 2 상세' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Rev 이력' })).toHaveAttribute('aria-selected', 'true');
    expect(router.state.location.search).toContain('rev=7003');
    expect(screen.getByRole('button', { name: 'Rev 3 상세 보기' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('Rev가 0건이면 빈 상태를 낸다', async () => {
    renderScreen([itemListRoute(), revisionListRoute([])], '?item=5001');

    expect(await screen.findByText('등록된 Rev가 없습니다')).toBeInTheDocument();
  });

  it('Rev 조회에 실패하면 목록 대신 오류 배너가 나온다', async () => {
    renderScreen(
      [
        itemListRoute(),
        {
          match: (request) => isGet(request, '/planning/routings'),
          respond: () => jsonResponse({ message: 'Rev를 불러오지 못했습니다.' }, { status: 500 }),
        },
      ],
      '?item=5001',
    );

    expect(await screen.findByText('Rev를 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.queryByText('등록된 Rev가 없습니다')).not.toBeInTheDocument();
  });
});

describe('RoutingScreen — 헤더 상세 조회와 상태 잠금', () => {
  it('Rev를 고르면(품목만 고르면 작성중 Rev 가 자동으로 열린다) 상세 요청이 나가고 폼이 응답 값으로 채워진다', async () => {
    const { requests } = renderScreen(
      [itemListRoute(), revisionListRoute(), routingDetailRoute()],
      '?item=5001',
    );

    expect(await screen.findByLabelText('Routing 코드')).toHaveValue('STANDARD');
    /* 유효 시작일 · 종료일은 입력받지 않는다(#231). */
    expect(screen.queryByLabelText('유효시작')).toBeNull();
    expect(requestsTo(requests, '/planning/routings/7003')).toHaveLength(1);
  });

  it('상세 조회에 실패하면 폼 대신 오류 배너가 나온다', async () => {
    renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        {
          match: (request) => isGet(request, '/planning/routings/7003'),
          respond: () => jsonResponse({ message: '상세를 불러오지 못했습니다.' }, { status: 500 }),
        },
      ],
      '?item=5001&rev=7003',
    );

    expect(await screen.findByText('상세를 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Routing 코드')).not.toBeInTheDocument();
  });

  /* 확정 Rev 는 경고 상자 없이 읽기 전용 값 — 카드 머리 「Rev · 상태」가 잠금을 말한다(#231). */
  it('확정 Rev에서는 Routing 코드를 읽기 전용 값으로 내고 경고 상자 · 취소 · 저장 · 확정이 없다', async () => {
    renderScreen(
      [itemListRoute(), revisionListRoute(), routingDetailRoute(routingFixtures[1])],
      '?item=5001&rev=7002',
    );

    expect(await screen.findByLabelText('Routing 코드')).toHaveAttribute('aria-readonly', 'true');
    expect(
      screen.queryByText('확정된 Rev는 수정할 수 없습니다. 변경하려면 신규 Rev를 발행하세요.'),
    ).not.toBeInTheDocument();
    const actions = actionsRegion();
    expect(within(actions).queryByRole('button', { name: '저장' })).toBeNull();
    expect(within(actions).queryByRole('button', { name: '취소' })).toBeNull();
    expect(within(actions).queryByRole('button', { name: '확정' })).toBeNull();
    expect(within(actions).getByRole('button', { name: '폐기' })).toBeEnabled();
    /* 신규 Rev 발행은 카드 머리 오른쪽(#231). */
    const card = screen.getByRole('region', { name: '공정 경로' });
    expect(within(card).getByRole('button', { name: '신규 Rev 발행' })).toBeInTheDocument();
  });

  it('작성중 Rev에서는 헤더를 편집할 수 있다', async () => {
    renderScreen(
      [itemListRoute(), revisionListRoute(), routingDetailRoute()],
      '?item=5001&rev=7003',
    );

    expect(await screen.findByLabelText('Routing 코드')).toBeEnabled();
  });

  /*
   * 판정의 주인은 codeEditable이다 — 목 서버도 실서버도 codeEditable=false에
   * reason=EDITABLE인 어긋난 조합을 실제로 내려준다.
   */
  it('codeEditable이 거짓이면 Routing 코드만 읽기 전용이 되고 「사용 중 · 변경 불가」 라벨에 사유가 이어진다', async () => {
    renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(routingFixtures[0], { codeEditable: false, reason: 'EDITABLE' }),
      ],
      '?item=5001&rev=7003',
    );

    const value = await screen.findByLabelText('Routing 코드');
    expect(value).toHaveAttribute('aria-readonly', 'true');
    expect(screen.getByText('사용 중 · 변경 불가')).toBeInTheDocument();
    expect(value).toHaveAccessibleDescription(
      '지금은 코드를 바꿀 수 없습니다. 변경이 필요하면 담당자에게 문의하세요.',
    );
    /* 작성중이라 저장 · 확정 줄은 그대로다. */
    expect(within(actionsRegion()).getByRole('button', { name: '저장' })).toBeInTheDocument();
  });

  it('고른 품목을 헤더에 값으로 밝힌다', async () => {
    renderScreen(
      [itemListRoute(), revisionListRoute(), routingDetailRoute()],
      '?item=5001&rev=7003',
    );

    /* 설정 탭 요약 줄에 품목코드 · 품목명을 칸을 나눠 보인다(#231). */
    const card = await screen.findByRole('region', { name: '공정 경로' });
    expect((await within(card).findByText('품목코드')).parentElement).toHaveTextContent(
      '품목코드ITM-001',
    );
    expect(within(card).getByText('품목명').parentElement).toHaveTextContent('품목명하우징 커버');
  });

  it('상세 카드 머리에 품목과 「Rev · 상태」 칩을 보이고, 설정 탭으로 연다(#231)', async () => {
    renderScreen(
      [itemListRoute(), revisionListRoute(), routingDetailRoute()],
      '?item=5001&rev=7003',
    );

    const card = await screen.findByRole('region', { name: '공정 경로' });
    expect(await within(card).findByText('Rev 3 · 작성중')).toBeInTheDocument();
    expect(within(card).getByRole('tab', { name: '설정' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    /* 「기본 정보」 상자 · 제목은 없다 — Routing 코드는 한 줄로(#231). */
    expect(within(card).queryByRole('heading', { name: '기본 정보' })).toBeNull();
    expect(await within(card).findByLabelText('Routing 코드')).toBeInTheDocument();
    expect(within(card).getByRole('heading', { name: /공정 구성/ })).toBeInTheDocument();
  });

  it('고친 값은 취소로 기준값으로 되돌아간다', async () => {
    const { user } = renderScreen(
      [itemListRoute(), revisionListRoute(), routingDetailRoute()],
      '?item=5001&rev=7003',
    );

    const code = await screen.findByLabelText('Routing 코드');
    await user.type(code, '-X');
    expect(code).toHaveValue('STANDARD-X');

    await user.click(within(actionsRegion()).getByRole('button', { name: '취소' }));

    expect(screen.getByLabelText('Routing 코드')).toHaveValue('STANDARD');
  });
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const headerSaveRoute = (
  respond: StubRoute['respond'] = () => jsonResponse(routingFixtures[0]),
): StubRoute => ({
  match: (request) =>
    request.method === 'PUT' && new URL(request.url).pathname === '/planning/routings/7003',
  respond,
});

const renderDraftHeader = (extraRoutes: StubRoute[] = []) =>
  renderScreen(
    [itemListRoute(), revisionListRoute(), routingDetailRoute(), ...extraRoutes],
    '?item=5001&rev=7003',
  );

describe('RoutingScreen — 헤더 저장', () => {
  it('로컬 검증에 걸리면 요청이 나가지 않는다', async () => {
    const { requests, user } = renderDraftHeader([headerSaveRoute()]);

    await user.clear(await screen.findByLabelText('Routing 코드'));
    await user.click(within(actionsRegion()).getByRole('button', { name: '저장' }));

    expect(await screen.findByText('필수 입력 항목입니다.')).toBeInTheDocument();
    expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(0);
  });

  it('저장하면 멱등 키와 상세 경로에서 꺼낸 If-Match를 실어 보낸다', async () => {
    const { requests, user } = renderDraftHeader([headerSaveRoute()]);

    await user.type(await screen.findByLabelText('Routing 코드'), '-B');
    await user.click(within(actionsRegion()).getByRole('button', { name: '저장' }));

    await screen.findByText('저장했습니다');

    const put = requests.find((request) => request.method === 'PUT');
    expect(put?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    expect(put?.headers.get('If-Match')).toBe('"7"');
    expect(JSON.parse(put?.body ?? '{}')).toEqual({
      routingCode: 'STANDARD-B',
      effectiveFrom: '2026-03-01',
      effectiveTo: null,
    });
  });

  it('저장 충돌은 원인별 문구와 「최신 불러오기」로 낸다', async () => {
    const { user } = renderDraftHeader([
      headerSaveRoute(() => jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 })),
    ]);

    await user.type(await screen.findByLabelText('Routing 코드'), '-B');
    await user.click(within(actionsRegion()).getByRole('button', { name: '저장' }));

    expect(
      await screen.findByText(
        '다른 사용자가 먼저 저장했습니다. 최신 내용을 불러온 뒤 다시 저장하세요.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '최신 불러오기' })).toBeInTheDocument();
  });

  /*
   * 상태 잠김은 재조회해도 풀리지 않는다 — 「최신 불러오기」를 내면 입력만 버리게 된다.
   */
  it('상태 잠김은 「최신 불러오기」 없는 배너로 낸다', async () => {
    const { user } = renderDraftHeader([
      headerSaveRoute(() =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'screen',
                code: 'STATE_LOCKED',
                message: '확정된 Rev는 수정할 수 없습니다.',
              },
            ],
          },
          { status: 400 },
        ),
      ),
    ]);

    await user.type(await screen.findByLabelText('Routing 코드'), '-B');
    await user.click(within(actionsRegion()).getByRole('button', { name: '저장' }));

    expect(await screen.findByText('지금은 저장할 수 없는 상태입니다')).toBeInTheDocument();
    expect(screen.getByText('확정된 Rev는 수정할 수 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '최신 불러오기' })).not.toBeInTheDocument();
  });

  it('화면이 아는 필드의 400 오류는 그 입력칸 옆에 낸다', async () => {
    const { user } = renderDraftHeader([
      headerSaveRoute(() =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'field',
                field: 'routingCode',
                code: 'UNIQUE_VIOLATION',
                message: '이미 사용 중인 코드입니다.',
              },
            ],
          },
          { status: 400 },
        ),
      ),
    ]);

    await user.type(await screen.findByLabelText('Routing 코드'), '-B');
    await user.click(within(actionsRegion()).getByRole('button', { name: '저장' }));

    expect(await screen.findByText('이미 사용 중인 코드입니다.')).toBeInTheDocument();
  });

  /*
   * 목 서버도 실서버도 화면이 모르는 필드명을 내려준다. 삼키면 어디에도 보이지 않는 오류가 생긴다.
   */
  it('화면이 모르는 필드의 400 오류는 배너로 올린다', async () => {
    const { user } = renderDraftHeader([
      headerSaveRoute(() =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'field',
                field: 'unknownColumn',
                code: 'STANDARD',
                message: '알 수 없는 항목이 거부됐습니다.',
              },
            ],
          },
          { status: 400 },
        ),
      ),
    ]);

    await user.type(await screen.findByLabelText('Routing 코드'), '-B');
    await user.click(within(actionsRegion()).getByRole('button', { name: '저장' }));

    expect(await screen.findByText('알 수 없는 항목이 거부됐습니다.')).toBeInTheDocument();
  });

  it('저장에 성공하면 고친 것이 없는 상태로 돌아간다', async () => {
    const { user } = renderDraftHeader([
      headerSaveRoute(() => jsonResponse({ ...routingFixtures[0], routingCode: 'STANDARD-B' })),
    ]);

    await user.type(await screen.findByLabelText('Routing 코드'), '-B');
    await user.click(within(actionsRegion()).getByRole('button', { name: '저장' }));

    await screen.findByText('저장했습니다');
    expect(within(actionsRegion()).getByRole('button', { name: '저장' })).toBeDisabled();
  });
});

const operationListRoute = (routingId = 7003, items = routingOperationFixtures): StubRoute => ({
  match: (request) => isGet(request, `/planning/routings/${String(routingId)}/operations`),
  respond: () => jsonResponse({ items }),
});

const processListRoute = (items = processFixtures, total = items.length): StubRoute => ({
  match: (request) => isGet(request, '/mdm/processes'),
  respond: () => jsonResponse(listBody(items, total)),
});

describe('RoutingScreen — 공정 라인 조회·표시', () => {
  /* 작성중 · 확정 개정이 없으면(폐기뿐) 자동으로 열 개정이 없다 — 고르기 전에는 라인을 묻지 않는다. */
  it('Rev를 고르기 전에는 라인 요청이 나가지 않는다', async () => {
    const obsoleteOnly = routingFixtures.map((row) => ({ ...row, statusCode: 'OBSOLETE' }));
    const { requests } = renderScreen(
      [itemListRoute(), revisionListRoute(obsoleteOnly), processListRoute()],
      '?item=5001',
    );
    await screen.findByRole('button', { name: 'Rev 3 상세 보기' });

    expect(requestsTo(requests, '/planning/routings/7003/operations')).toHaveLength(0);
  });

  it('Rev를 고르면(품목만 고르면 작성중 Rev 가 자동으로 열린다) 라인 요청이 나가고 표가 그려진다', async () => {
    const { requests } = renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(),
        operationListRoute(),
        processListRoute(),
      ],
      '?item=5001',
    );

    expect(await screen.findByText('1차 사출')).toBeInTheDocument();
    expect(requestsTo(requests, '/planning/routings/7003/operations')).toHaveLength(1);
    expect(requestsTo(requests, '/mdm/processes')[0]?.url.searchParams.get('includeInactive')).toBe(
      'true',
    );
  });

  /*
   * 서버 채번은 서버 재량이다. 그 값을 그대로 보이면 사용자가 그것을 자료로 읽는다.
   */
  it('서버가 순서 값 10·20을 줘도 표시 번호는 1·2다', async () => {
    renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(),
        operationListRoute(),
        processListRoute(),
      ],
      '?item=5001&rev=7003',
    );

    await screen.findByText('1차 사출');

    const operations = screen.getByRole('region', { name: '공정 라인' });
    const rows = within(operations).getAllByRole('row').slice(1);
    expect(within(rows[0] as HTMLElement).getByText('1')).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText('2')).toBeInTheDocument();
    expect(within(operations).queryByText('10')).not.toBeInTheDocument();
    expect(within(operations).queryByText('20')).not.toBeInTheDocument();
  });

  it('공정 id를 선택 목록의 이름으로 옮겨 보인다', async () => {
    renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(),
        operationListRoute(),
        processListRoute(),
      ],
      '?item=5001&rev=7003',
    );

    const operations = await screen.findByRole('region', { name: '공정 라인' });
    expect(await within(operations).findByText('사출')).toBeInTheDocument();
    expect(within(operations).getByText('조립')).toBeInTheDocument();
  });

  it('공정 선택 목록이 실패하면 원시 id 대신 실패 상태를 보인다', async () => {
    renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(),
        operationListRoute(),
        {
          match: (request) => isGet(request, '/mdm/processes'),
          respond: () => jsonResponse({ message: '공정 선택 목록 실패' }, { status: 500 }),
        },
      ],
      '?item=5001&rev=7003',
    );

    const operations = await screen.findByRole('region', { name: '공정 라인' });
    expect(
      await within(operations).findAllByText(messages.common.reference.failed),
    ).not.toHaveLength(0);
    expect(within(operations).queryByText('9001')).not.toBeInTheDocument();
  });

  it('라인이 0건이면 빈 상태를 낸다', async () => {
    renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(),
        operationListRoute(7003, []),
        processListRoute(),
      ],
      '?item=5001&rev=7003',
    );

    expect(await screen.findByText('등록된 공정이 없습니다')).toBeInTheDocument();
  });

  it('라인 조회에 실패하면 표 대신 오류 배너가 나온다', async () => {
    renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(),
        {
          match: (request) => isGet(request, '/planning/routings/7003/operations'),
          respond: () => jsonResponse({ message: '공정을 불러오지 못했습니다.' }, { status: 500 }),
        },
        processListRoute(),
      ],
      '?item=5001&rev=7003',
    );

    expect(await screen.findByText('공정을 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.queryByText('등록된 공정이 없습니다')).not.toBeInTheDocument();
  });

  it('공정 선택 목록이 잘리면 그 사실을 표 위에 낸다', async () => {
    renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(),
        operationListRoute(),
        processListRoute(processFixtures, 120),
      ],
      '?item=5001&rev=7003',
    );

    expect(
      await screen.findByText(
        '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
      ),
    ).toBeInTheDocument();
  });
});

const OPERATIONS_PATH = '/planning/routings/7003/operations';

const operationSaveRoute = (
  respond: StubRoute['respond'] = () => jsonResponse({ items: routingOperationFixtures }),
): StubRoute => ({
  match: (request) => request.method === 'PUT' && new URL(request.url).pathname === OPERATIONS_PATH,
  respond,
});

const renderDraftOperations = (extraRoutes: StubRoute[] = []) =>
  renderScreen(
    [
      itemListRoute(),
      revisionListRoute(),
      routingDetailRoute(),
      operationListRoute(),
      processListRoute(),
      ...extraRoutes,
      /* 삭제 아이콘은 선후행을 확인한 뒤에야 풀린다 — 관계 없는 Rev 를 기본으로 둔다. */
      dependencyListRoute(),
    ],
    '?item=5001&rev=7003',
  );

const operationsRegion = (): HTMLElement => screen.getByRole('region', { name: '공정 라인' });

const removeOperationButton = async (displayNo: number): Promise<HTMLElement> => {
  const button = within(operationsRegion()).getByRole('button', {
    name: `${String(displayNo)}번 공정 삭제`,
  });
  await waitFor(() => expect(button).toBeEnabled());

  return button;
};

const operationRows = (): HTMLElement[] => within(operationsRegion()).getAllByRole('row').slice(1);

const operationNames = (): string[] =>
  operationRows().map((row) => within(row).getAllByRole('cell')[2]?.textContent ?? '');

const savePuts = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter(
    (request) => request.method === 'PUT' && request.url.pathname === OPERATIONS_PATH,
  );

/** 저장 본문의 `operations` 배열. 계약이 그 키 하나만 받는다. */
interface SavedOperation {
  routingOperationId?: number;
  routingId: number;
  operationSeq: number;
  processId: number;
  operationName: string;
}

const savedOperations = (request: RecordedRequest | undefined): SavedOperation[] =>
  (JSON.parse(request?.body ?? '{"operations":[]}') as { operations: SavedOperation[] }).operations;

describe('RoutingScreen — 공정 라인 편집과 일괄 저장', () => {
  /*
   * 이 화면의 핵심 규약(공유계약 A-5)이다. 순서 컬럼에 유일 제약이 있어 행을 하나씩 저장하면
   * 중간 상태가 반드시 제약을 위반한다 — 이동은 초안만 바꾸고 저장은 한 번뿐이어야 한다.
   * 요청 횟수를 세는 것이 그 규약을 지키는 유일한 자동 수단이다.
   */
  it('순서를 세 번 바꿔도 저장 요청이 나가지 않는다', async () => {
    const { requests, user } = renderDraftOperations([operationSaveRoute()]);
    await screen.findByText('1차 사출');

    const down = () =>
      within(operationRows()[0] as HTMLElement).getByRole('button', { name: '아래로 이동' });
    const up = () =>
      within(operationRows()[1] as HTMLElement).getByRole('button', { name: '위로 이동' });

    await user.click(down());
    await user.click(up());
    await user.click(down());

    expect(operationNames()).toEqual(['2차 조립', '1차 사출']);
    expect(savePuts(requests)).toHaveLength(0);
  });

  it('저장을 누르면 요청이 정확히 한 번 나가고 순서 값을 1부터 다시 매긴다', async () => {
    const { requests, user } = renderDraftOperations([operationSaveRoute()]);
    await screen.findByText('1차 사출');

    await user.click(
      within(operationRows()[0] as HTMLElement).getByRole('button', { name: '아래로 이동' }),
    );
    await user.click(within(actionsRegion()).getByRole('button', { name: '저장' }));

    await screen.findByText('저장했습니다');

    const puts = savePuts(requests);
    expect(puts).toHaveLength(1);
    expect(puts[0]?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    /* 계약이 이 경로에 If-Match를 요구하지 않는다 — 실으면 규약을 지어내는 것이다. */
    expect(puts[0]?.headers.get('If-Match')).toBeNull();

    const operations = savedOperations(puts[0]);
    expect(operations.map((item) => item.operationSeq)).toEqual([1, 2]);
    expect(operations.map((item) => item.operationName)).toEqual(['2차 조립', '1차 사출']);
    /* 전체 치환은 행 교체가 아니다 — 식별자를 버리면 진행 중 작업지시가 참조하던 행이 사라진다. */
    expect(operations.map((item) => item.routingOperationId)).toEqual([8002, 8001]);
  });

  /** 외주 공정(#231) — 공정 편집 창에서 켠 값이 저장 본문에 실린다. `draftId`(화면 전용 키)는 안 싣는다. */
  it('공정 편집 창에서 외주 공정을 켜면 저장 본문에 true 로 실리고 화면 전용 키는 실리지 않는다', async () => {
    const { requests, user } = renderDraftOperations([operationSaveRoute()]);
    await screen.findByText('1차 사출');

    await user.click(
      within(operationRows()[0] as HTMLElement).getByRole('button', { name: '1번 공정 수정' }),
    );
    await user.click(await screen.findByRole('checkbox', { name: '외주 공정' }));
    await user.click(screen.getByRole('button', { name: '확인' }));
    await user.click(within(actionsRegion()).getByRole('button', { name: '저장' }));
    await screen.findByText('저장했습니다');

    const body = savePuts(requests)[0]?.body ?? '';
    expect(body).toContain('"isOutsourced":true');
    expect(body).toContain('"isOutsourced":false');
    expect(body).not.toContain('draftId');
  });

  /*
   * 서버 채번은 서버 재량이다. 응답을 정본으로 다시 세우되 표시 번호는 여전히 위치다.
   */
  it('저장에 성공하면 표를 응답 목록으로 다시 세운다', async () => {
    const { user } = renderDraftOperations([
      operationSaveRoute(() =>
        jsonResponse({
          items: [
            { ...routingOperationFixtures[1], operationSeq: 30 },
            { ...routingOperationFixtures[0], operationSeq: 40 },
          ],
        }),
      ),
    ]);
    await screen.findByText('1차 사출');

    await user.click(
      within(operationRows()[0] as HTMLElement).getByRole('button', { name: '아래로 이동' }),
    );
    await user.click(within(actionsRegion()).getByRole('button', { name: '저장' }));
    await screen.findByText('저장했습니다');

    expect(operationNames()).toEqual(['2차 조립', '1차 사출']);
    const region = operationsRegion();
    expect(within(region).queryByText('30')).not.toBeInTheDocument();
    expect(within(region).queryByText('40')).not.toBeInTheDocument();
    expect(within(operationRows()[0] as HTMLElement).getByText('1')).toBeInTheDocument();
  });

  it('저장에 실패하면 배너로 알리고 바꾼 순서를 잃지 않는다', async () => {
    const { user } = renderDraftOperations([
      operationSaveRoute(() =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'field',
                field: 'operationSeq',
                code: 'STANDARD',
                message: '순서가 겹칩니다.',
              },
            ],
          },
          { status: 400 },
        ),
      ),
    ]);
    await screen.findByText('1차 사출');

    await user.click(
      within(operationRows()[0] as HTMLElement).getByRole('button', { name: '아래로 이동' }),
    );
    await user.click(within(actionsRegion()).getByRole('button', { name: '저장' }));

    /* 어느 행의 오류인지 계약이 알려 주지 않는다 — 인라인으로 낼 수 없어 배너로 올린다. */
    expect(await screen.findByText('순서가 겹칩니다.')).toBeInTheDocument();
    expect(operationNames()).toEqual(['2차 조립', '1차 사출']);
  });

  it('상태 잠김은 「최신 불러오기」 없는 배너로 낸다', async () => {
    const { user } = renderDraftOperations([
      operationSaveRoute(() =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'screen',
                code: 'STATE_LOCKED',
                message: '확정된 Rev는 수정할 수 없습니다.',
              },
            ],
          },
          { status: 400 },
        ),
      ),
    ]);
    await screen.findByText('1차 사출');

    await user.click(
      within(operationRows()[0] as HTMLElement).getByRole('button', { name: '아래로 이동' }),
    );
    await user.click(within(actionsRegion()).getByRole('button', { name: '저장' }));

    expect(await screen.findByText('지금은 저장할 수 없는 상태입니다')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '최신 불러오기' })).not.toBeInTheDocument();
  });

  it('공정을 추가하면 표에만 반영되고 저장 요청은 나가지 않는다', async () => {
    const { requests, user } = renderDraftOperations([operationSaveRoute()]);
    await screen.findByText('1차 사출');

    await user.click(within(operationsRegion()).getByRole('button', { name: '공정 추가' }));

    await user.type(await screen.findByLabelText('공정명'), '3차 검사');
    await user.click(screen.getByRole('combobox', { name: '공정' }));
    await user.click(await screen.findByRole('option', { name: '조립' }));
    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(operationNames()).toEqual(['1차 사출', '2차 조립', '3차 검사']);
    expect(savePuts(requests)).toHaveLength(0);
  });

  /* PQC 대상은 품목이다 — 머리에 이 품목의 PQC 검사 기준을 보이고, 없으면 대상이 아니라고 보인다(사용자 지시 2026-11-05). */
  it('머리에 이 품목의 PQC 검사 기준을 보인다', async () => {
    const { requests, router, user } = renderDraftOperations([
      {
        match: (request) => isGet(request, '/quality/inspection-plans'),
        respond: () =>
          jsonResponse(
            listBody([
              {
                inspectionPlanId: 3101,
                inspectionPlanCode: 'PQC-5001',
                inspectionPlanName: '하우징 공정검사',
                itemId: 5001,
              },
            ]),
          ),
      },
    ]);

    const label = await screen.findByText('PQC-5001 · 하우징 공정검사');
    expect(headerRegion()).toContainElement(label);
    const asked = requestsTo(requests, '/quality/inspection-plans')[0];
    expect(asked?.url.searchParams.get('inspectionTypeCode')).toBe('PQC');
    expect(asked?.url.searchParams.get('itemId')).toBe('5001');

    /* 옆 「검사 기준 수정」은 그 기준을 검사 기준 화면에서 연다(사용자 지시 2026-11-05). */
    await user.click(within(headerRegion()).getByRole('button', { name: '검사 기준 수정' }));
    expect(router?.state.location.pathname).toBe('/master-data/inspection-standard');
    expect(router?.state.location.search).toBe('?plan=3101&edit=1');
  });

  it('품목 PQC 검사 기준이 없으면 PQC 대상이 아니라고 보이고 「검사 기준 등록」으로 등록 창을 연다', async () => {
    const { router, user } = renderDraftOperations([
      {
        match: (request) => isGet(request, '/quality/inspection-plans'),
        respond: () => jsonResponse(listBody([])),
      },
    ]);

    expect(await screen.findByText('검사 기준 미지정')).toBeInTheDocument();
    await user.click(within(headerRegion()).getByRole('button', { name: '검사 기준 등록' }));
    expect(router?.state.location.pathname).toBe('/master-data/inspection-standard');
    expect(router?.state.location.search).toBe('?new=PQC&newItem=5001');
  });

  it('새 행은 식별자 없이 저장 본문에 실린다', async () => {
    const { requests, user } = renderDraftOperations([operationSaveRoute()]);
    await screen.findByText('1차 사출');

    await user.click(within(operationsRegion()).getByRole('button', { name: '공정 추가' }));
    await user.type(await screen.findByLabelText('공정명'), '3차 검사');
    await user.click(screen.getByRole('combobox', { name: '공정' }));
    await user.click(await screen.findByRole('option', { name: '조립' }));
    await user.click(screen.getByRole('button', { name: '확인' }));

    await user.click(within(actionsRegion()).getByRole('button', { name: '저장' }));
    await screen.findByText('저장했습니다');

    const operations = savedOperations(savePuts(requests)[0]);
    expect(operations).toHaveLength(3);
    expect(operations[2]?.operationName).toBe('3차 검사');
    expect('routingOperationId' in (operations[2] ?? {})).toBe(false);
  });

  it('편집 창의 검증에 걸리면 표에 반영되지 않는다', async () => {
    const { user } = renderDraftOperations([operationSaveRoute()]);
    await screen.findByText('1차 사출');

    await user.click(within(operationsRegion()).getByRole('button', { name: '공정 추가' }));
    await user.click(await screen.findByRole('button', { name: '확인' }));

    expect(await screen.findAllByText('필수 입력 항목입니다.')).toHaveLength(2);
    expect(operationNames()).toEqual(['1차 사출', '2차 조립']);
  });

  /** 퍼센트로 넣은 수율은 100배 오입력이다 — 표에 들어오기 전에 막는다. */
  it('표준 수율이 100% 를 넘으면 표에 반영되지 않는다', async () => {
    const { user } = renderDraftOperations([operationSaveRoute()]);
    await screen.findByText('1차 사출');

    await user.click(
      within(operationRows()[0] as HTMLElement).getByRole('button', { name: '1번 공정 수정' }),
    );

    const rate = await screen.findByLabelText('표준 수율(%)');
    expect(rate).toHaveValue(98);
    fireEvent.change(rate, { target: { value: '120' } });
    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(await screen.findByText('표준 수율은 0~100 사이로 입력하세요.')).toBeInTheDocument();
    expect(within(operationRows()[0] as HTMLElement).getByText('98%')).toBeInTheDocument();
  });

  it('행을 수정하면 자리를 지킨 채 값만 바뀐다', async () => {
    const { user } = renderDraftOperations([operationSaveRoute()]);
    await screen.findByText('1차 사출');

    await user.click(
      within(operationRows()[0] as HTMLElement).getByRole('button', { name: '1번 공정 수정' }),
    );
    await user.type(await screen.findByLabelText('공정명'), '(개정)');
    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(operationNames()).toEqual(['1차 사출(개정)', '2차 조립']);
  });

  it('행을 지우면 표에서 사라지고 저장 요청은 나가지 않는다', async () => {
    const { requests, user } = renderDraftOperations([operationSaveRoute()]);
    await screen.findByText('1차 사출');

    await user.click(await removeOperationButton(1));

    expect(operationNames()).toEqual(['2차 조립']);
    expect(savePuts(requests)).toHaveLength(0);
  });

  it('취소를 누르면 서버에서 받은 목록으로 되돌아간다', async () => {
    const { user } = renderDraftOperations([operationSaveRoute()]);
    await screen.findByText('1차 사출');

    await user.click(await removeOperationButton(1));
    await user.click(within(actionsRegion()).getByRole('button', { name: '취소' }));

    expect(operationNames()).toEqual(['1차 사출', '2차 조립']);
  });

  /*
   * 라인을 저장하면 헤더도 다시 불러온다(판 번호가 올라갈 수 있다).
   * 그때 저장하지 않은 헤더 편집이 서버 값으로 되돌아가므로 조용히 잃기 전에 먼저 막는다.
   */
  /* 하단 「저장」 한 번이 기본 정보 → 공정 구성 순서로 둘 다 저장한다(#231). */
  it('기본 정보와 공정 구성을 함께 고치면 저장 한 번에 기본 정보 · 공정 구성 순서로 요청이 나간다', async () => {
    const { requests, user } = renderDraftOperations([headerSaveRoute(), operationSaveRoute()]);
    await screen.findByText('1차 사출');

    await user.click(
      within(operationRows()[0] as HTMLElement).getByRole('button', { name: '아래로 이동' }),
    );
    await user.type(screen.getByLabelText('Routing 코드'), '-B');
    await user.click(within(actionsRegion()).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(savePuts(requests)).toHaveLength(1);
    });
    const puts = requests.filter((request) => request.method === 'PUT');
    expect(puts.map((request) => request.url.pathname)).toEqual([
      '/planning/routings/7003',
      OPERATIONS_PATH,
    ]);
  });

  it('기본 정보 저장이 실패하면 공정 구성은 보내지 않는다', async () => {
    const { requests, user } = renderDraftOperations([
      headerSaveRoute(() => jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 })),
      operationSaveRoute(),
    ]);
    await screen.findByText('1차 사출');

    await user.click(
      within(operationRows()[0] as HTMLElement).getByRole('button', { name: '아래로 이동' }),
    );
    await user.type(screen.getByLabelText('Routing 코드'), '-B');
    await user.click(within(actionsRegion()).getByRole('button', { name: '저장' }));

    expect(await screen.findByRole('button', { name: '최신 불러오기' })).toBeInTheDocument();
    expect(savePuts(requests)).toHaveLength(0);
  });

  it('확정 Rev에서는 공정 추가 · 편집 칸 · 저장을 세우지 않고 공정 정보만 보인다', async () => {
    renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(routingFixtures[1]),
        operationListRoute(7002),
        processListRoute(),
      ],
      '?item=5001&rev=7002',
    );

    await screen.findByText('1차 사출');

    const region = operationsRegion();
    expect(within(region).queryByRole('button', { name: '공정 추가' })).toBeNull();
    expect(within(region).queryByRole('button', { name: /공정 수정$/ })).toBeNull();
    expect(within(actionsRegion()).queryByRole('button', { name: '저장' })).toBeNull();
    expect(within(region).queryByRole('button', { name: '위로 이동' })).not.toBeInTheDocument();
    /* 선후행은 읽기 전용으로 열 수 있다 — 조회까지 막지 않는다. */
    expect(within(region).getByRole('button', { name: '공정 연결' })).toBeEnabled();
  });
});

const transitionRoute = (
  action: 'confirm' | 'obsolete' | 'new-revision' | 'set-default',
  routingId = 7003,
  respond: StubRoute['respond'] = () => jsonResponse(routingFixtures[0]),
): StubRoute => ({
  match: (request) =>
    request.method === 'POST' &&
    new URL(request.url).pathname === `/planning/routings/${String(routingId)}:${action}`,
  respond,
});

const stateLockedResponse = (message: string): Response =>
  jsonResponse({ errors: [{ scope: 'screen', code: 'STATE_LOCKED', message }] }, { status: 400 });

/* 작성중 Rev 취소(#231) — 확인 뒤 DELETE 하나, 지운 Rev 는 주소에서 빠진다. */
describe('RoutingScreen — 작성 취소', () => {
  const discardRoute = (respond: StubRoute['respond']): StubRoute => ({
    match: (request) =>
      request.method === 'DELETE' && new URL(request.url).pathname === '/planning/routings/7003',
    respond,
  });

  it('작성중 Rev 에서 작성 취소를 확인하면 DELETE 하나가 나가고 남은 확정 Rev 가 열린다', async () => {
    /* 지운 뒤에는 서버 목록에서 작성중 Rev 3 이 빠진다 — 화면은 남은 최신 확정 Rev 2 를 연다. */
    let discarded = false;
    const { requests, router, user } = renderScreen(
      [
        itemListRoute(),
        {
          match: (request) => isGet(request, '/planning/routings'),
          respond: () =>
            jsonResponse({
              items: discarded
                ? routingFixtures.filter((row) => row.routingId !== 7003)
                : routingFixtures,
            }),
        },
        routingDetailRoute(),
        operationListRoute(),
        processListRoute(),
        dependencyListRoute(),
        routingDetailRoute(routingFixtures[1]),
        operationListRoute(7002),
        discardRoute(() => {
          discarded = true;
          return new Response(null, { status: 204 });
        }),
      ],
      '?item=5001&rev=7003',
    );
    if (router === null) throw new Error('데이터 라우터가 없습니다');
    await screen.findByText('1차 사출');

    await user.click(within(actionsRegion()).getByRole('button', { name: '작성 취소' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rev 3 작성을 취소하시겠습니까?' });
    expect(requests.filter((request) => request.method === 'DELETE')).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: '작성 취소' }));

    expect(await screen.findByText('작성을 취소했습니다.')).toBeInTheDocument();
    const deletes = requests.filter((request) => request.method === 'DELETE');
    expect(deletes).toHaveLength(1);
    expect(deletes[0]?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    await waitFor(() => expect(router.state.location.search).toContain('rev=7002'));
  });

  it('확정 Rev 에는 작성 취소 단추가 없다', async () => {
    renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(routingFixtures[1]),
        operationListRoute(7002),
        processListRoute(),
        dependencyListRoute(),
      ],
      '?item=5001&rev=7002',
    );
    await screen.findByText('1차 사출');

    expect(within(actionsRegion()).queryByRole('button', { name: '작성 취소' })).toBeNull();
  });

  it('서버가 거절하면 창을 닫지 않고 그 사유를 보인다', async () => {
    renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(),
        operationListRoute(),
        processListRoute(),
        dependencyListRoute(),
        discardRoute(() =>
          stateLockedResponse(
            '이 Rev 를 쓰는 생산계획 · 작업지시 · BOM · 검사기준이 있어 취소할 수 없습니다.',
          ),
        ),
      ],
      '?item=5001&rev=7003',
    );
    const { user } = { user: userEvent.setup() };
    await screen.findByText('1차 사출');

    await user.click(within(actionsRegion()).getByRole('button', { name: '작성 취소' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rev 3 작성을 취소하시겠습니까?' });
    await user.click(within(dialog).getByRole('button', { name: '작성 취소' }));

    expect(
      await within(dialog).findByText(
        '이 Rev 를 쓰는 생산계획 · 작업지시 · BOM · 검사기준이 있어 취소할 수 없습니다.',
      ),
    ).toBeInTheDocument();
  });
});

describe('RoutingScreen — 확정·폐기', () => {
  /* 되돌릴 수 없는 전이다 — 확인 단계를 건너뛰면 실수로 판이 잠긴다. */
  it('확정을 눌러도 확인 전에는 요청이 나가지 않는다', async () => {
    const { requests, user } = renderDraftOperations([transitionRoute('confirm')]);
    await screen.findByText('1차 사출');

    await user.click(within(actionsRegion()).getByRole('button', { name: '확정' }));

    expect(await screen.findByText('이 Rev를 확정할까요?')).toBeInTheDocument();
    expect(requestsTo(requests, '/planning/routings/7003:confirm')).toHaveLength(0);
  });

  it('확인하면 멱등 키만 실어 확정 요청을 보낸다', async () => {
    const { requests, user } = renderDraftOperations([transitionRoute('confirm')]);
    await screen.findByText('1차 사출');

    await user.click(within(actionsRegion()).getByRole('button', { name: '확정' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: '확정' }));

    await screen.findByText('저장했습니다');

    const posts = requestsTo(requests, '/planning/routings/7003:confirm');
    expect(posts).toHaveLength(1);
    expect(posts[0]?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    /* 계약이 이 경로에 If-Match를 요구하지 않는다 — 실으면 규약을 지어내는 것이다. */
    expect(posts[0]?.headers.get('If-Match')).toBeNull();
  });

  /*
   * 전이 응답에는 ETag가 없다 — 보관된 토큰은 그 순간 낡은 값이 된다.
   * 재조회로 새 토큰을 확보하지 않으면 다음 헤더 저장이 조용히 막힌다.
   */
  it('확정에 성공하면 상세와 Rev 목록을 다시 조회한다', async () => {
    const { requests, user } = renderDraftOperations([transitionRoute('confirm')]);
    await screen.findByText('1차 사출');

    const before = {
      detail: requestsTo(requests, '/planning/routings/7003').length,
      list: revisionRequests(requests).length,
    };

    await user.click(within(actionsRegion()).getByRole('button', { name: '확정' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: '확정' }),
    );
    await screen.findByText('저장했습니다');

    await waitFor(() => {
      expect(requestsTo(requests, '/planning/routings/7003').length).toBeGreaterThan(before.detail);
    });
    expect(revisionRequests(requests).length).toBeGreaterThan(before.list);
  });

  it('상태 잠김은 창을 닫지 않고 「최신 불러오기」 없는 배너로 낸다', async () => {
    const { user } = renderDraftOperations([
      transitionRoute('confirm', 7003, () =>
        stateLockedResponse('작성중 Rev가 아니라 확정할 수 없습니다.'),
      ),
    ]);
    await screen.findByText('1차 사출');

    await user.click(within(actionsRegion()).getByRole('button', { name: '확정' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: '확정' }),
    );

    expect(await screen.findByText('작성중 Rev가 아니라 확정할 수 없습니다.')).toBeInTheDocument();
    expect(screen.getByText('지금은 저장할 수 없는 상태입니다')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '최신 불러오기' })).not.toBeInTheDocument();
  });

  /* 계약이 라인 1건 이상을 요구한다(400 LINE_REQUIRED) — 화면이 먼저 막고 사유를 밝힌다. */
  it('라인이 0건이면 확정이 비활성이고 사유가 보인다', async () => {
    renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(),
        operationListRoute(7003, []),
        processListRoute(),
      ],
      '?item=5001&rev=7003',
    );

    await screen.findByText('등록된 공정이 없습니다');

    expect(within(actionsRegion()).getByRole('button', { name: '확정' })).toBeDisabled();
    expect(screen.getByText('확정은 공정을 1건 이상 등록해야 할 수 있습니다.')).toBeInTheDocument();
  });

  /* 확정하면 되돌릴 수 없다 — 저장하지 않은 편집은 그 순간 영영 사라진다. */
  it('저장하지 않은 변경이 있으면 확정이 비활성이고 사유가 보인다', async () => {
    const { user } = renderDraftOperations([transitionRoute('confirm')]);
    await screen.findByText('1차 사출');

    await user.type(screen.getByLabelText('Routing 코드'), '-B');

    expect(within(actionsRegion()).getByRole('button', { name: '확정' })).toBeDisabled();
    expect(
      screen.getByText(
        '확정은 저장하지 않은 변경이 있으면 할 수 없습니다. 먼저 저장하거나 취소하세요.',
      ),
    ).toBeInTheDocument();
  });

  /* 작성중은 폐기할 수 없다 — 단추를 세우지 않는다(사용자 지시 · #231). */
  it('작성중 Rev에서는 폐기 단추가 없다', async () => {
    renderDraftOperations([transitionRoute('obsolete')]);
    await screen.findByText('1차 사출');

    expect(within(actionsRegion()).queryByRole('button', { name: '폐기' })).not.toBeInTheDocument();
  });

  it('확정 Rev에서는 폐기가 활성이고 확인하면 요청이 나간다', async () => {
    const { requests, user } = renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(routingFixtures[1]),
        operationListRoute(7002),
        processListRoute(),
        transitionRoute('obsolete', 7002),
      ],
      '?item=5001&rev=7002',
    );

    await screen.findByText('1차 사출');

    await user.click(within(actionsRegion()).getByRole('button', { name: '폐기' }));
    expect(await screen.findByText('Rev 2를 폐기하시겠습니까?')).toBeInTheDocument();
    expect(requestsTo(requests, '/planning/routings/7002:obsolete')).toHaveLength(0);

    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: '폐기' }),
    );
    await screen.findByText('저장했습니다');

    const posts = requestsTo(requests, '/planning/routings/7002:obsolete');
    expect(posts).toHaveLength(1);
    expect(posts[0]?.headers.get('If-Match')).toBeNull();
  });

  it('확인 창에서 취소하면 요청이 나가지 않는다', async () => {
    const { requests, user } = renderDraftOperations([transitionRoute('confirm')]);
    await screen.findByText('1차 사출');

    await user.click(within(actionsRegion()).getByRole('button', { name: '확정' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: '취소' }),
    );

    expect(screen.queryByText('이 Rev를 확정할까요?')).not.toBeInTheDocument();
    expect(requestsTo(requests, '/planning/routings/7003:confirm')).toHaveLength(0);
  });
});

/* 신규 Rev 발행 · 첫 등록 단추는 상세 카드 「설정」 탭의 「기본 정보」 머리에 있다(#231). */
const revisionRegion = (): HTMLElement => screen.getByRole('region', { name: '공정 경로' });

const createRoutingRoute = (
  respond: StubRoute['respond'] = () =>
    jsonResponse({ ...routingFixtures[0], routingId: 7010, routingVersion: 1 }, { status: 201 }),
): StubRoute => ({
  match: (request) =>
    request.method === 'POST' && new URL(request.url).pathname === '/planning/routings',
  respond,
});

describe('RoutingScreen — 신규 Rev 발행과 첫 Rev 등록', () => {
  /* 신규 Rev 발행은 확정 개정을 볼 때만 선다(작성중이면 세우지 않는다 · #231) — 확정 Rev 2 를 연다. */
  const renderConfirmedRevision = (extraRoutes: StubRoute[] = []) =>
    renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(routingFixtures[1]),
        operationListRoute(7002),
        processListRoute(),
        ...extraRoutes,
        dependencyListRoute(),
      ],
      '?item=5001&rev=7002',
    );

  /* 폐기 개정에서는 발행을 서버가 받지 않는다 — 단추를 세우지 않는다(사용자 지시 · #231). */
  it('폐기된 Rev 를 보고 있으면 신규 Rev 발행 단추가 없다', async () => {
    renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(routingFixtures[2]),
        operationListRoute(7001),
        processListRoute(),
        dependencyListRoute(),
      ],
      '?item=5001&rev=7001',
    );

    const card = await screen.findByRole('region', { name: '공정 경로' });
    expect(await within(card).findByText('Rev 1 · 폐기')).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: '신규 Rev 발행' })).toBeNull();
    /* 안내 상자 대신 머리 라벨 하나. */
    expect(within(card).getByText('수정 · 변경 불가')).toBeInTheDocument();
  });

  it('Rev가 1건 이상이면 발행 버튼이 활성되고 멱등 키만 실어 요청한다', async () => {
    const { requests, user } = renderConfirmedRevision([
      transitionRoute('new-revision', 7002, () =>
        jsonResponse(
          { ...routingFixtures[0], routingId: 7004, routingVersion: 4 },
          { status: 201 },
        ),
      ),
      routingDetailRoute({ ...routingFixtures[0]!, routingId: 7004, routingVersion: 4 }),
      operationListRoute(7004),
    ]);
    await screen.findByText('1차 사출');

    await user.click(within(revisionRegion()).getByRole('button', { name: '신규 Rev 발행' }));
    await screen.findByText('등록했습니다');

    const posts = requestsTo(requests, '/planning/routings/7002:new-revision');
    expect(posts).toHaveLength(1);
    expect(posts[0]?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    expect(posts[0]?.headers.get('If-Match')).toBeNull();
  });

  /*
   * 201 응답에는 ETag가 없다 — 새 판으로 옮겨 상세를 다시 조회해야 잠금 토큰이 생긴다.
   * 옮기지 않으면 사용자가 방금 만든 판을 목록에서 직접 찾아야 한다.
   */
  it('발행에 성공하면 새 Rev로 옮겨 상세와 라인을 다시 조회한다', async () => {
    const { requests, user } = renderConfirmedRevision([
      transitionRoute('new-revision', 7002, () =>
        jsonResponse(
          { ...routingFixtures[0], routingId: 7004, routingVersion: 4 },
          { status: 201 },
        ),
      ),
      routingDetailRoute({ ...routingFixtures[0]!, routingId: 7004, routingVersion: 4 }),
      operationListRoute(7004),
    ]);
    await screen.findByText('1차 사출');

    await user.click(within(revisionRegion()).getByRole('button', { name: '신규 Rev 발행' }));

    await waitFor(() => {
      expect(requestsTo(requests, '/planning/routings/7004')).toHaveLength(1);
    });
    expect(requestsTo(requests, '/planning/routings/7004/operations')).toHaveLength(1);
  });

  /* 발행 상태 잠금은 붉은 상자 대신 개정을 다시 읽는다 — 새 상태는 머리 라벨이 말한다(사용자 지시 · #231). */
  it('발행이 상태 잠김으로 거절되면 안내 상자 없이 개정을 다시 읽는다', async () => {
    const { requests, user } = renderConfirmedRevision([
      transitionRoute('new-revision', 7002, () =>
        stateLockedResponse('확정된 Rev에서만 신규 Rev를 발행할 수 있습니다.'),
      ),
    ]);
    await screen.findByText('1차 사출');
    const detailReads = () => requestsTo(requests, '/planning/routings/7002').length;
    const before = detailReads();

    await user.click(within(revisionRegion()).getByRole('button', { name: '신규 Rev 발행' }));

    await waitFor(() => expect(detailReads()).toBeGreaterThan(before));
    expect(screen.queryByText('지금은 저장할 수 없는 상태입니다')).toBeNull();
    expect(screen.queryByText('확정된 Rev에서만 신규 Rev를 발행할 수 있습니다.')).toBeNull();
  });

  /*
   * 작성중 개정을 보는 동안에는 발행 단추가 없다(사용자 지시 · #231). 저장하지 않은 변경은 작성중에서만 생기므로
   * 「저장하지 않은 변경 때문에 발행 비활성」 사유도 이 화면에 더는 서지 않는다.
   */
  it('작성중 개정을 보는 동안에는 신규 Rev 발행 단추가 없다', async () => {
    renderDraftOperations([transitionRoute('new-revision')]);
    await screen.findByText('1차 사출');

    expect(within(revisionRegion()).queryByRole('button', { name: '신규 Rev 발행' })).toBeNull();
  });

  it('Rev가 0건이면 등록 액션이 보이고 누르면 빈 등록 폼이 열린다', async () => {
    const { user } = renderScreen(
      [itemListRoute(), revisionListRoute([]), processListRoute()],
      '?item=5001',
    );

    await user.click(await screen.findByRole('button', { name: 'Routing 등록' }));

    expect(await screen.findByLabelText('Routing 코드')).toHaveValue('');
    /* 유효 시작일 · 종료일은 입력받지 않는다(#231). */
    expect(screen.queryByLabelText('유효시작')).not.toBeInTheDocument();
    // 판 번호와 상태는 서버가 채운다 — 없는 값을 미리 지어내 보이지 않는다.
    expect(screen.queryByText('Rev 1')).not.toBeInTheDocument();
    expect(screen.queryByText('작성중')).not.toBeInTheDocument();
  });

  it('등록 폼에서 로컬 검증에 걸리면 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen(
      [itemListRoute(), revisionListRoute([]), processListRoute(), createRoutingRoute()],
      '?item=5001',
    );

    await user.click(await screen.findByRole('button', { name: 'Routing 등록' }));
    /* 코드를 공백만 넣어 필수 검증을 건다(날짜는 받지 않는다 · #231). */
    await user.type(await screen.findByLabelText('Routing 코드'), '   ');
    await user.click(within(headerRegion()).getByRole('button', { name: 'Routing 등록' }));

    expect(await screen.findByText(messages.routing.validation.codeBlank)).toBeInTheDocument();
    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(0);
  });

  it('등록하면 품목 id와 코드를 실어 보내고(날짜는 싣지 않는다) 새 Rev로 옮긴다', async () => {
    const { requests, user } = renderScreen(
      [
        itemListRoute(),
        revisionListRoute([]),
        processListRoute(),
        createRoutingRoute(),
        routingDetailRoute({ ...routingFixtures[0]!, routingId: 7010, routingVersion: 1 }),
        operationListRoute(7010, []),
      ],
      '?item=5001',
    );

    await user.click(await screen.findByRole('button', { name: 'Routing 등록' }));
    await user.type(await screen.findByLabelText('Routing 코드'), 'STANDARD');
    await user.click(within(headerRegion()).getByRole('button', { name: 'Routing 등록' }));

    await screen.findByText('등록했습니다');

    const post = requestsTo(requests, '/planning/routings').find(
      (request) => request.method === 'POST',
    );
    expect(post?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    /* 첫 등록에는 잠글 대상이 없다 — 계약이 If-Match를 요구하지 않는다. */
    expect(post?.headers.get('If-Match')).toBeNull();
    expect(JSON.parse(post?.body ?? '{}')).toEqual({
      itemId: 5001,
      routingCode: 'STANDARD',
      effectiveTo: null,
    });

    /* 201에는 ETag가 없다 — 새 판으로 옮겨 상세를 다시 조회해야 잠금 토큰이 생긴다. */
    await waitFor(() => {
      expect(requestsTo(requests, '/planning/routings/7010')).toHaveLength(1);
    });
  });

  it('등록 폼에서 취소하면 폼이 닫힌다', async () => {
    const { user } = renderScreen(
      [itemListRoute(), revisionListRoute([]), processListRoute(), createRoutingRoute()],
      '?item=5001',
    );

    await user.click(await screen.findByRole('button', { name: 'Routing 등록' }));
    await user.type(await screen.findByLabelText('Routing 코드'), 'STANDARD');
    /* 첫 등록은 기본 정보 칸에 「Routing 등록」 줄이 그대로 있다(#231). */
    await user.click(within(headerRegion()).getByRole('button', { name: '취소' }));

    expect(screen.queryByLabelText('Routing 코드')).not.toBeInTheDocument();
  });

  /* 아직 없는 Rev에는 전이할 대상이 없다. 확정은 사유와 함께 비활성, 폐기는 세우지 않는다(#231). */
  /* 첫 등록에는 확정 · 폐기할 대상이 없다 — 쓸 수 없는 단추는 세우지 않는다(#231). */
  it('등록 폼에서는 확정 · 폐기 단추를 세우지 않는다', async () => {
    const { user } = renderScreen(
      [itemListRoute(), revisionListRoute([]), processListRoute()],
      '?item=5001',
    );

    await user.click(await screen.findByRole('button', { name: 'Routing 등록' }));

    const header = headerRegion();
    expect(within(header).queryByRole('button', { name: '확정' })).toBeNull();
    expect(within(header).queryByRole('button', { name: '폐기' })).toBeNull();
    expect(within(header).getByRole('button', { name: 'Routing 등록' })).toBeInTheDocument();
  });
});

const DEPENDENCIES_PATH = '/planning/routings/7003/operation-dependencies';

const dependencyListRoute = (items: unknown[] = [], path = DEPENDENCIES_PATH): StubRoute => ({
  match: (request) => isGet(request, path),
  respond: () => jsonResponse({ items }),
});

const dependencyTypesRoute: StubRoute = {
  match: (request) =>
    isGet(request, '/mdm/code-values') &&
    new URL(request.url).searchParams.get('codeGroupCode') === 'ROUTING_OPERATION_DEPENDENCY_TYPE',
  respond: () =>
    jsonResponse(
      listBody(
        [
          ['FINISH_TO_START', '선행 완료 후 착수', 1],
          ['START_TO_START', '동시 착수', 2],
        ].map(([code, codeName, displayOrder], index) => ({
          codeValueId: 900 + index,
          codeGroupId: 90,
          code,
          codeName,
          displayOrder,
          isActive: true,
        })),
      ),
    ),
};

const dependencyPuts = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter(
    (request) => request.method === 'PUT' && request.url.pathname === DEPENDENCIES_PATH,
  );

const savedFs = {
  predecessorOperationId: 8001,
  successorOperationId: 8002,
  dependencyTypeCode: 'FINISH_TO_START',
};

const openDependencies = async (user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> => {
  const button = await within(operationsRegion()).findByRole('button', { name: '공정 연결' });
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);

  return screen.findByRole('dialog', { name: /공정 연결/ });
};

describe('RoutingScreen — 공정 선후행 설정', () => {
  it('작성중 Rev 에서 관계를 더해 목록 전체를 한 번에 저장한다', async () => {
    const { requests, user } = renderDraftOperations([
      dependencyListRoute(),
      dependencyTypesRoute,
      {
        match: (request) =>
          request.method === 'PUT' && new URL(request.url).pathname === DEPENDENCIES_PATH,
        respond: () => jsonResponse({ items: [{ routingOperationDependencyId: 1, ...savedFs }] }),
      },
    ]);

    const dialog = await openDependencies(user);
    expect(within(dialog).getByText('공정 연결 · Rev 3')).toBeInTheDocument();
    expect(within(dialog).getByText('품목코드 ITM-001')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '연결 추가' }));

    expect(within(dialog).getByText('선행·후행 공정을 선택해 주세요.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '저장' })).toBeDisabled();
    /* 저장 단추 아래 사유 문장은 두지 않는다 — 문제는 그 입력칸에서 본다(#231). */
    expect(within(dialog).queryByText(/표에 표시된 문제/)).toBeNull();

    await user.click(within(dialog).getByRole('combobox', { name: '1번째 줄 선행 공정' }));
    await user.click(await screen.findByRole('option', { name: '1. 1차 사출' }));
    /* 선행을 고르면 남은 후행 칸만 짚는다. */
    expect(within(dialog).getByText('후행 공정을 선택해 주세요.')).toBeInTheDocument();
    expect(
      within(dialog).getByRole('combobox', { name: '1번째 줄 후행 공정' }),
    ).toHaveAccessibleDescription('후행 공정을 선택해 주세요.');
    expect(
      within(dialog).getByRole('combobox', { name: '1번째 줄 선행 공정' }),
    ).not.toHaveAccessibleDescription('후행 공정을 선택해 주세요.');
    await user.click(within(dialog).getByRole('combobox', { name: '1번째 줄 후행 공정' }));
    await user.click(await screen.findByRole('option', { name: '2. 2차 조립' }));
    expect(within(dialog).getByRole('combobox', { name: '1번째 줄 관계' })).toHaveTextContent(
      '선행 완료 후 착수',
    );

    await user.click(within(dialog).getByRole('button', { name: '저장' }));

    await screen.findByText('저장했습니다');
    const put = dependencyPuts(requests);
    expect(put).toHaveLength(1);
    expect(JSON.parse(put[0]?.body ?? '{}')).toEqual({ dependencies: [savedFs] });
    expect(put[0]?.headers.get('Idempotency-Key')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('순환이 생기면 그 경로를 보이고 저장을 막는다', async () => {
    const { requests, user } = renderDraftOperations([
      dependencyListRoute([{ routingOperationDependencyId: 1, ...savedFs }]),
      dependencyTypesRoute,
    ]);

    const dialog = await openDependencies(user);
    await user.click(await within(dialog).findByRole('button', { name: '연결 추가' }));
    await user.click(within(dialog).getByRole('combobox', { name: '2번째 줄 선행 공정' }));
    await user.click(await screen.findByRole('option', { name: '2. 2차 조립' }));
    await user.click(within(dialog).getByRole('combobox', { name: '2번째 줄 후행 공정' }));
    await user.click(await screen.findByRole('option', { name: '1. 1차 사출' }));

    const message =
      '선후행이 순환합니다(1. 1차 사출 → 2. 2차 조립 → 1. 1차 사출). 이 중 한 줄을 지우거나 방향을 바꾸세요.';
    expect(within(dialog).getAllByText(message).length).toBeGreaterThan(0);
    expect(within(dialog).getByRole('button', { name: '저장' })).toBeDisabled();
    expect(within(dialog).queryByText(/표에 표시된 문제/)).toBeNull();
    expect(dependencyPuts(requests)).toHaveLength(0);
  });

  it('저장하지 않은 채 닫으려 하면 묻고, 계속 편집하면 남긴다', async () => {
    const { user } = renderDraftOperations([dependencyListRoute(), dependencyTypesRoute]);

    const dialog = await openDependencies(user);
    await user.click(await within(dialog).findByRole('button', { name: '연결 추가' }));
    await user.click(within(dialog).getByRole('button', { name: '취소' }));

    const confirm = await screen.findByRole('dialog', { name: '저장하지 않은 선후행이 있습니다' });
    await user.click(within(confirm).getByRole('button', { name: '계속 편집' }));
    expect(
      within(dialog).getByRole('combobox', { name: '1번째 줄 선행 공정' }),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: '취소' }));
    await user.click(
      within(
        await screen.findByRole('dialog', { name: '저장하지 않은 선후행이 있습니다' }),
      ).getByRole('button', { name: '저장하지 않고 닫기' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('그사이 확정돼 거부되면 무엇이 일어났고 무엇을 할지 말하고 읽기 전용으로 돌린다', async () => {
    let locked = false;
    const { user } = renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        {
          match: (request) => isGet(request, '/planning/routings/7003'),
          respond: () =>
            jsonResponse(
              {
                routing: { ...routingFixtures[0]!, statusCode: locked ? 'CONFIRMED' : 'DRAFT' },
                editability: DEFAULT_EDITABILITY,
              },
              { headers: { ETag: '"7"' } },
            ),
        },
        operationListRoute(),
        processListRoute(),
        dependencyListRoute(),
        dependencyTypesRoute,
        {
          match: (request) =>
            request.method === 'PUT' && new URL(request.url).pathname === DEPENDENCIES_PATH,
          respond: () => {
            locked = true;
            return stateLockedResponse('작성중 Routing 만 선후행을 바꿀 수 있습니다.');
          },
        },
      ],
      '?item=5001&rev=7003',
    );

    const dialog = await openDependencies(user);
    await user.click(await within(dialog).findByRole('button', { name: '연결 추가' }));
    await user.click(within(dialog).getByRole('combobox', { name: '1번째 줄 선행 공정' }));
    await user.click(await screen.findByRole('option', { name: '1. 1차 사출' }));
    await user.click(within(dialog).getByRole('combobox', { name: '1번째 줄 후행 공정' }));
    await user.click(await screen.findByRole('option', { name: '2. 2차 조립' }));
    await user.click(within(dialog).getByRole('button', { name: '저장' }));

    expect(
      await within(dialog).findByText(
        '이 Rev는 이미 확정돼 선후행을 바꿀 수 없습니다. 목록을 새로 읽었습니다 — 바꾸려면 신규 Rev를 발행하세요.',
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).queryByRole('combobox')).toBeNull());
    expect(within(dialog).getByText('등록된 공정 연결이 없습니다.')).toBeInTheDocument();
  });

  it('확정 Rev 에서는 관계를 읽기 전용으로 보이고 닫기 단추 하나만 둔다', async () => {
    const { user } = renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(routingFixtures[1]),
        operationListRoute(7002),
        processListRoute(),
        dependencyListRoute([savedFs], '/planning/routings/7002/operation-dependencies'),
        dependencyTypesRoute,
      ],
      '?item=5001&rev=7002',
    );

    const dialog = await openDependencies(user);

    expect(await within(dialog).findByText('1. 1차 사출')).toBeInTheDocument();
    expect(within(dialog).getByText('선행 완료 후 착수')).toBeInTheDocument();
    expect(within(dialog).queryByRole('combobox')).toBeNull();
    expect(within(dialog).queryByRole('button', { name: '연결 추가' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: '저장' })).toBeNull();
    expect(within(dialog).getByRole('button', { name: '닫기' })).toBeInTheDocument();
    /* 우상단 X 는 두지 않는다(#231). */
    expect(within(dialog).getAllByRole('button')).toHaveLength(1);
  });

  it('저장하지 않은 공정 라인이 있으면 선후행 설정을 막고 할 일을 말한다', async () => {
    const { user } = renderDraftOperations();

    await screen.findByText('1차 사출');
    await user.click(await removeOperationButton(2));

    expect(within(operationsRegion()).getByRole('button', { name: '공정 연결' })).toBeDisabled();
    expect(
      within(operationsRegion()).getByText(
        '공정 연결은 저장하지 않은 공정 라인이 있으면 할 수 없습니다. 먼저 공정을 저장하거나 취소하세요.',
      ),
    ).toBeInTheDocument();
  });

  it('저장된 공정이 2건보다 적으면 선후행 설정을 막는다', async () => {
    renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(),
        operationListRoute(7003, routingOperationFixtures.slice(0, 1)),
        processListRoute(),
      ],
      '?item=5001&rev=7003',
    );

    await screen.findByText('1차 사출');
    /* 긴 문장 대신 단추 옆 라벨(#231) — 문장은 숨긴 글로 단추에 이어 화면 낭독기가 읽는다. */
    expect(
      await within(operationsRegion()).findByText('공정 2개 이상 등록 시 사용 가능'),
    ).toBeInTheDocument();
    const dependencies = within(operationsRegion()).getByRole('button', { name: '공정 연결' });
    expect(dependencies).toBeDisabled();
    expect(dependencies).toHaveAccessibleDescription(
      '공정 연결은 공정 2개 이상 등록 시 사용 가능합니다.',
    );
    expect(
      within(operationsRegion()).getByText('공정 연결은 공정 2개 이상 등록 시 사용 가능합니다.'),
    ).toHaveClass('visually-hidden');
  });
});

describe('RoutingScreen — 선후행이 걸린 공정 삭제와 서버 거부', () => {
  it('선후행이 걸린 공정은 삭제 아이콘을 막고 어떤 관계인지·어디서 풀지 말한다', async () => {
    renderDraftOperations([dependencyListRoute([savedFs])]);

    await screen.findByText('1차 사출');
    const reason =
      '이 공정에 선후행이 걸려 있습니다(1. 1차 사출 → 2. 2차 조립). 먼저 [공정 연결]에서 그 관계를 지우고 공정을 지우세요.';
    await waitFor(() =>
      expect(
        within(operationsRegion()).getByRole('button', { name: '1번 공정 삭제' }),
      ).toBeDisabled(),
    );
    expect(
      within(operationsRegion()).getByRole('button', { name: '2번 공정 삭제' }),
    ).toBeDisabled();
    expect(
      within(operationsRegion()).getByRole('button', { name: '1번 공정 삭제' }),
    ).toHaveAccessibleDescription(reason);
    expect(within(operationsRegion()).getByRole('button', { name: '1번 공정 수정' })).toBeEnabled();
  });

  it.each([
    [
      '받는 중',
      (): Promise<Response> => new Promise<Response>(() => undefined),
      '선후행을 확인하는 중입니다. 잠시 뒤 다시 시도하세요.',
    ],
    [
      '실패',
      async (): Promise<Response> => jsonResponse({ message: '합성 실패' }, { status: 500 }),
      '선후행을 불러오지 못해 지울 수 있는지 확인할 수 없습니다. 새로고침한 뒤 다시 시도하세요.',
    ],
  ])('선후행 목록이 %s이면 삭제도 막고 그 까닭을 말한다', async (_case, respond, reason) => {
    renderDraftOperations([{ match: (request) => isGet(request, DEPENDENCIES_PATH), respond }]);

    await screen.findByText('1차 사출');
    const button = within(operationsRegion()).getByRole('button', { name: '1번 공정 삭제' });
    await waitFor(() => expect(button).toHaveAccessibleDescription(reason));
    expect(button).toBeDisabled();
  });

  it('관계가 가리키는 공정이 표에 없으면 내부 번호 대신 「알 수 없는 공정」이라 말한다', async () => {
    renderDraftOperations([dependencyListRoute([{ ...savedFs, successorOperationId: 9999 }])]);

    await screen.findByText('1차 사출');
    await waitFor(() =>
      expect(
        within(operationsRegion()).getByRole('button', { name: '1번 공정 삭제' }),
      ).toHaveAccessibleDescription(
        '이 공정에 선후행이 걸려 있습니다(1. 1차 사출 → 알 수 없는 공정). 먼저 [공정 연결]에서 그 관계를 지우고 공정을 지우세요.',
      ),
    );
  });

  it('관계 유형 목록을 받는 동안에는 선후행 저장을 막는다', async () => {
    const { user } = renderDraftOperations([
      {
        match: (request) => isGet(request, '/mdm/code-values'),
        respond: () => new Promise<Response>(() => undefined),
      },
    ]);

    const dialog = await openDependencies(user);

    expect(within(dialog).getByRole('button', { name: '저장' })).toBeDisabled();
  });

  it('서버가 공정 삭제를 거부하면 서버 문구를 띠로 보인다', async () => {
    const { user } = renderDraftOperations([
      dependencyListRoute(),
      operationSaveRoute(() =>
        stateLockedResponse('선후행이 걸린 공정은 뺄 수 없습니다. 선후행을 먼저 정리하세요.'),
      ),
    ]);

    await screen.findByText('1차 사출');
    await user.click(await removeOperationButton(2));
    await user.click(within(actionsRegion()).getByRole('button', { name: '저장' }));

    expect(
      await within(operationsRegion()).findByText(
        '선후행이 걸린 공정은 뺄 수 없습니다. 선후행을 먼저 정리하세요.',
      ),
    ).toBeInTheDocument();
  });

  it('선후행 저장에서 서버가 짚은 줄 오류는 그 줄에, 화면 전체 오류는 띠로 낸다', async () => {
    let attempt = 0;
    const { user } = renderDraftOperations([
      dependencyListRoute(),
      dependencyTypesRoute,
      {
        match: (request) =>
          request.method === 'PUT' && new URL(request.url).pathname === DEPENDENCIES_PATH,
        respond: () => {
          attempt += 1;
          return jsonResponse(
            {
              errors:
                attempt === 1
                  ? [
                      {
                        scope: 'field',
                        field: 'dependencies[0].successorOperationId',
                        code: 'INVALID',
                        message: '이 Routing 의 공정이 아닙니다.',
                      },
                    ]
                  : [
                      {
                        scope: 'screen',
                        code: 'INVALID',
                        message: '공정 선후행에 순환이 생깁니다.',
                      },
                    ],
            },
            { status: 400 },
          );
        },
      },
    ]);

    const dialog = await openDependencies(user);
    await user.click(await within(dialog).findByRole('button', { name: '연결 추가' }));
    await user.click(within(dialog).getByRole('combobox', { name: '1번째 줄 선행 공정' }));
    await user.click(await screen.findByRole('option', { name: '1. 1차 사출' }));
    await user.click(within(dialog).getByRole('combobox', { name: '1번째 줄 후행 공정' }));
    await user.click(await screen.findByRole('option', { name: '2. 2차 조립' }));
    await user.click(within(dialog).getByRole('button', { name: '저장' }));

    const rowError = await within(dialog).findByText('이 Routing 의 공정이 아닙니다.');
    expect(within(dialog).getByRole('combobox', { name: '1번째 줄 선행 공정' })).toHaveAttribute(
      'aria-describedby',
      rowError.id,
    );

    await user.click(within(dialog).getByRole('button', { name: '저장' }));
    expect(await within(dialog).findByText('공정 선후행에 순환이 생깁니다.')).toBeInTheDocument();
    expect(within(dialog).queryByText('이 Routing 의 공정이 아닙니다.')).toBeNull();
  });
});

describe('RoutingScreen — 저장하지 않고 옮기기', () => {
  const discard = messages.routing.discard;

  it('저장하지 않은 편집이 있으면 다른 Rev 로 옮기기 전에 묻고, 계속 편집하면 그대로 둔다', async () => {
    const { user, router } = renderScreen(
      [itemListRoute(), revisionListRoute(), routingDetailRoute()],
      '?item=5001&rev=7003',
    );
    if (router === null) throw new Error('데이터 라우터가 없습니다');

    const code = await screen.findByLabelText('Routing 코드');
    await user.type(code, '-X');
    /* Rev 이동은 주소(링크 · 앞뒤 이동)로만 온다 — 상세 보기는 창이라 옮기지 않는다(#231). */
    await act(async () => {
      await router.navigate('?item=5001&rev=7002');
    });

    const dialog = await screen.findByRole('dialog', { name: discard.title });
    expect(within(dialog).getByText(discard.body)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: discard.stay }));

    expect(screen.queryByRole('dialog', { name: discard.title })).toBeNull();
    expect(screen.getByLabelText('Routing 코드')).toHaveValue('STANDARD-X');
    expect(router.state.location.search).toContain('rev=7003');

    await act(async () => {
      await router.navigate('?item=5001&rev=7002');
    });
    await user.click(
      within(await screen.findByRole('dialog', { name: discard.title })).getByRole('button', {
        name: discard.confirm,
      }),
    );

    await openHistory(user);
    expect(screen.getByRole('button', { name: 'Rev 2 상세 보기' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('뒤로가기로 앞 Rev 로 돌아가도 저장하지 않은 편집이 있으면 묻는다', async () => {
    const { user, router } = renderScreen(
      [itemListRoute(), revisionListRoute(), routingDetailRoute()],
      '?item=5001&rev=7002',
    );
    if (router === null) throw new Error('데이터 라우터가 없습니다');

    await screen.findByRole('tab', { name: '설정' });
    await act(async () => {
      await router.navigate('?item=5001&rev=7003');
    });
    await user.type(await screen.findByLabelText('Routing 코드'), '-X');

    await act(async () => {
      await router.navigate(-1);
    });

    const dialog = await screen.findByRole('dialog', { name: discard.title });
    await user.click(within(dialog).getByRole('button', { name: discard.stay }));
    expect(router.state.location.search).toContain('rev=7003');
    expect(screen.getByLabelText('Routing 코드')).toHaveValue('STANDARD-X');
  });

  it('첫 Rev 등록 칸을 두고 다른 품목으로 옮기면 그 칸을 비우고, 그 뒤 이동은 다시 묻지 않는다', async () => {
    const { user } = renderScreen(
      [itemListRoute(), revisionListRoute([]), processListRoute()],
      '?item=5001',
    );

    await user.click(await screen.findByRole('button', { name: 'Routing 등록' }));
    await user.type(await screen.findByLabelText('Routing 코드'), 'LEFTOVER');
    await user.click(screen.getByRole('button', { name: 'ITM-002' }));
    const dialog = await screen.findByRole('dialog', { name: discard.title });
    expect(
      within(dialog).getByText(
        '지금 옮기면 입력한 첫 Rev 등록 내용이 저장되지 않고 사라집니다. 남기려면 「계속 편집」을 누른 뒤 등록하세요.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(discard.body)).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: discard.confirm }));

    expect(screen.queryByDisplayValue('LEFTOVER')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'ITM-003' }));
    expect(screen.queryByRole('dialog', { name: discard.title })).toBeNull();
    expect(screen.getByRole('button', { name: 'ITM-003' })).toHaveAttribute('aria-current', 'true');
  });

  it('같은 품목을 다시 눌러도 묻지 않고, 그 뒤 뒤로가기는 여전히 묻는다', async () => {
    /* 앞 기록을 남기려고 Rev 2 에서 시작해 Rev 3 으로 옮긴다(품목만 고르면 개정이 자동으로 열려 기록이 늘지 않는다). */
    const { user, router } = renderScreen(
      [itemListRoute(), revisionListRoute(), routingDetailRoute()],
      '?item=5001&rev=7002',
    );
    if (router === null) throw new Error('데이터 라우터가 없습니다');

    await screen.findByRole('tab', { name: '설정' });
    await act(async () => {
      await router.navigate('?item=5001&rev=7003');
    });
    await user.type(await screen.findByLabelText('Routing 코드'), '-X');
    await user.click(screen.getByRole('button', { name: 'ITM-001' }));
    expect(screen.queryByRole('dialog', { name: discard.title })).toBeNull();

    await act(async () => {
      await router.navigate(-1);
    });
    expect(await screen.findByRole('dialog', { name: discard.title })).toBeInTheDocument();
  });

  it('고친 것이 없으면 묻지 않고 옮긴다', async () => {
    const { user, router } = renderScreen(
      [itemListRoute(), revisionListRoute(), routingDetailRoute()],
      '?item=5001&rev=7003',
    );
    if (router === null) throw new Error('데이터 라우터가 없습니다');

    await screen.findByLabelText('Routing 코드');
    await act(async () => {
      await router.navigate('?item=5001&rev=7002');
    });

    expect(screen.queryByRole('dialog', { name: discard.title })).toBeNull();
    await openHistory(user);
    expect(screen.getByRole('button', { name: 'Rev 2 상세 보기' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });
});

describe('RoutingScreen — 이력 관리 기본 Rev 고르기 (#231)', () => {
  const notDefault = routingFixtures.map((row) => ({ ...row, isDefault: false }));

  it('기본 Rev 칸에서 확정 개정을 고르고 확인하면 그 개정에 지정 요청 하나가 나간다', async () => {
    const { requests, user } = renderScreen(
      [
        itemListRoute(),
        revisionListRoute(notDefault),
        routingDetailRoute(),
        transitionRoute('set-default', 7002, () =>
          jsonResponse({ ...routingFixtures[1], isDefault: true }),
        ),
      ],
      '?item=5001&rev=7003',
    );

    await openHistory(user);
    await user.click(await screen.findByLabelText('기본 Rev'));
    await user.click(await screen.findByRole('option', { name: 'Rev 2' }));
    const dialog = await screen.findByRole('dialog', { name: '기본 Rev 지정' });
    await user.click(within(dialog).getByRole('button', { name: '기본으로 지정' }));

    await waitFor(() => {
      expect(requestsTo(requests, '/planning/routings/7002:set-default')).toHaveLength(1);
    });
    expect(
      requestsTo(requests, '/planning/routings/7002:set-default')[0]?.headers.get(
        'Idempotency-Key',
      ),
    ).toMatch(UUID_PATTERN);
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /기본 Rev 지정/ })).toBeNull();
    });
  });

  it('확인 창에서 취소하면 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen(
      [itemListRoute(), revisionListRoute(notDefault), routingDetailRoute()],
      '?item=5001&rev=7003',
    );

    await openHistory(user);
    await user.click(await screen.findByLabelText('기본 Rev'));
    await user.click(await screen.findByRole('option', { name: 'Rev 2' }));
    const dialog = await screen.findByRole('dialog', { name: /기본 Rev 지정/ });
    await user.click(within(dialog).getByRole('button', { name: '취소' }));

    expect(requestsTo(requests, '/planning/routings/7002:set-default')).toHaveLength(0);
  });
});

describe('RoutingScreen — Rev 비교 · 변경 이력 (#231)', () => {
  it('Rev 비교를 누르면 앞 판과 지금 판의 공정 구성을 견주는 창이 열린다', async () => {
    const { user } = renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(),
        operationListRoute(7003),
        operationListRoute(7002, routingOperationFixtures.slice(0, 1)),
        processListRoute(),
      ],
      '?item=5001&rev=7003',
    );

    await screen.findByText('1차 사출');
    await user.click(within(actionsRegion()).getByRole('button', { name: 'Rev 비교' }));

    const dialog = await screen.findByRole('dialog', { name: 'Rev 비교' });
    /* Rev 2 에는 1차 사출만, Rev 3 에는 2차 조립이 더 있다 — 추가로 잡힌다. */
    const operations = await within(dialog).findByRole('region', { name: '공정 구성 비교' });
    expect(await within(operations).findByText(/^2차 조립/)).toBeInTheDocument();
    expect(within(operations).getAllByText('추가').length).toBeGreaterThan(0);
    expect(within(operations).getByRole('columnheader', { name: 'Rev 2' })).toBeInTheDocument();
    expect(within(operations).getByRole('columnheader', { name: 'Rev 3' })).toBeInTheDocument();
  });

  it('변경 이력을 누르면 이 Rev 의 감사 이력을 기간과 함께 묻고 표로 보인다', async () => {
    const { requests, user } = renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(),
        operationListRoute(7003),
        processListRoute(),
        {
          match: (request) => isGet(request, '/audit/events'),
          respond: () =>
            jsonResponse({
              items: [
                {
                  auditEventId: 1,
                  occurredAt: '2026-11-05T02:35:06.879Z',
                  targetTypeCode: 'ROUTING',
                  targetId: 7003,
                  eventTypeCode: 'UPDATE',
                  beforeValue: { routingCode: 'A' },
                  afterValue: { routingCode: 'B' },
                  performedBy: null,
                },
              ],
              page: { page: 1, size: 100, total: 1 },
            }),
        },
      ],
      '?item=5001&rev=7003',
    );

    await screen.findByText('1차 사출');
    await user.click(within(actionsRegion()).getByRole('button', { name: '변경 이력' }));

    const dialog = await screen.findByRole('dialog', { name: /변경 이력/ });
    /* 바뀐 칸 하나가 한 줄 — 「변경 항목 | 변경 전 | 변경 후」(사용자 시안 · #231). */
    const change = (await within(dialog).findByText('Routing 코드')).closest('tr');
    expect(
      Array.from(change?.querySelectorAll('td') ?? [])
        .slice(3)
        .map((cell) => cell.textContent),
    ).toEqual(['Routing 코드', 'A', 'B']);
    expect(within(dialog).getByText('기본 정보 수정')).toBeInTheDocument();
    const audit = requestsTo(requests, '/audit/events')[0];
    expect(audit?.url.searchParams.get('targetTypeCode')).toBe('ROUTING');
    expect(audit?.url.searchParams.get('targetId')).toBe('7003');
    expect(audit?.url.searchParams.has('occurredFrom')).toBe(true);
  });

  /* 일시 머리를 누르면 오름 · 내림차순이 바뀐다 — 처음은 최신이 위(사용자 지시 · #231). */
  it('변경 이력은 최신이 위로 시작하고, 일시 머리를 누르면 오래된 것이 위로 온다', async () => {
    const event = (auditEventId: number, occurredAt: string, routingCode: string) => ({
      auditEventId,
      occurredAt,
      targetTypeCode: 'ROUTING',
      targetId: 7003,
      eventTypeCode: 'UPDATE',
      beforeValue: { routingCode: 'A' },
      afterValue: { routingCode },
      performedBy: null,
    });
    const { user } = renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(),
        operationListRoute(7003),
        processListRoute(),
        {
          match: (request) => isGet(request, '/audit/events'),
          respond: () =>
            jsonResponse({
              items: [
                event(1, '2026-11-04T01:00:00.000Z', 'OLD'),
                event(2, '2026-11-05T01:00:00.000Z', 'NEW'),
              ],
              page: { page: 1, size: 100, total: 2 },
            }),
        },
      ],
      '?item=5001&rev=7003',
    );

    await screen.findByText('1차 사출');
    await user.click(within(actionsRegion()).getByRole('button', { name: '변경 이력' }));
    const dialog = await screen.findByRole('dialog', { name: /변경 이력/ });
    await within(dialog).findByText('NEW');

    const order = () =>
      within(dialog)
        .getAllByRole('row')
        .slice(1)
        .map((row) => (row.textContent?.includes('NEW') === true ? 'NEW' : 'OLD'));
    expect(order()).toEqual(['NEW', 'OLD']);

    await user.click(within(dialog).getByRole('button', { name: /일시/ }));
    expect(order()).toEqual(['OLD', 'NEW']);
  });
});
