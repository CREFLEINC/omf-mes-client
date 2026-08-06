import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { codeGroupFixtures } from './fixtures';
import { CommonCodeScreen } from './screen';

const ROUTE = '/master-data/common-code';

const CODE_GROUPS_PATH = '/mdm/code-groups';

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

interface PageStub {
  page: number;
  size: number;
  total: number;
}

const DEFAULT_PAGE: PageStub = { page: 1, size: 50, total: codeGroupFixtures.length };

const codeGroupListRoute = (
  items = codeGroupFixtures,
  pageMeta: PageStub = DEFAULT_PAGE,
): StubRoute => ({
  match: (request) => isGet(request, CODE_GROUPS_PATH),
  respond: () => jsonResponse({ items, page: pageMeta }),
});

const renderScreen = (routes: StubRoute[], search = '') => {
  const { fetch, requests } = createRecordingFetch(routes);

  renderWithProviders(<CommonCodeScreen />, { fetch, route: `${ROUTE}${search}` });

  return { requests, user: userEvent.setup() };
};

const requestsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === pathname);

const codeGroupRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requestsTo(requests, CODE_GROUPS_PATH);

const codeGroupPane = (): HTMLElement => screen.getByRole('region', { name: '코드그룹' });

describe('CommonCodeScreen — 탭', () => {
  /* C2 — 만든 탭만 렌더한다. 자리만 먼저 두면 「눌러도 빈 화면인」 탭이 생긴다. */
  it('탭 묶음이 있고 만든 탭 하나만 렌더된다', async () => {
    renderScreen([codeGroupListRoute()]);
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    const tablist = screen.getByRole('tablist', { name: '공통코드·조직·작업자' });
    const tabs = within(tablist).getAllByRole('tab');

    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toHaveTextContent('공통코드');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('주소의 탭 값이 모르는 값이면 공통코드 탭으로 떨어진다', async () => {
    renderScreen([codeGroupListRoute()], '?tab=xyz');

    expect(await screen.findByRole('button', { name: 'SYN-GRP-01' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '공통코드' })).toHaveAttribute('aria-selected', 'true');
  });

  it('주소의 탭 값이 비어 있어도 공통코드 탭으로 떨어진다', async () => {
    renderScreen([codeGroupListRoute()], '?tab=');

    expect(await screen.findByRole('button', { name: 'SYN-GRP-01' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '공통코드' })).toHaveAttribute('aria-selected', 'true');
  });

  /* 아직 만들지 않은 탭의 주소값도 모르는 값이다 — 빈 화면이 되지 않아야 한다. */
  it('아직 만들지 않은 탭 값으로 들어와도 코드그룹 목록이 보인다', async () => {
    renderScreen([codeGroupListRoute()], '?tab=org');

    expect(await screen.findByRole('button', { name: 'SYN-GRP-01' })).toBeInTheDocument();
  });
});

describe('CommonCodeScreen — 코드그룹 목록 조회', () => {
  /* C3 */
  it('화면에 들어오면 목록 요청이 한 번 나가고 조건이 없으면 쿼리도 없다', async () => {
    const { requests } = renderScreen([codeGroupListRoute()]);

    expect(await screen.findByRole('button', { name: 'SYN-GRP-01' })).toBeInTheDocument();

    const first = codeGroupRequests(requests);
    expect(first).toHaveLength(1);
    expect(first[0]?.url.search).toBe('');
  });

  it('서버 응답의 코드그룹을 표에 그린다', async () => {
    renderScreen([codeGroupListRoute()]);

    expect(await screen.findByRole('button', { name: 'SYN-GRP-01' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SYN-GRP-02' })).toBeInTheDocument();
    expect(screen.getByText('합성 코드그룹 A')).toBeInTheDocument();
  });

  /* C4 */
  it('검색어를 걸고 조회를 누르면 q가 요청 쿼리에 실린다', async () => {
    const { requests, user } = renderScreen([codeGroupListRoute()]);
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    await user.type(screen.getByLabelText('코드그룹 검색'), 'SYN');
    await user.click(within(codeGroupPane()).getByRole('button', { name: '조회' }));

    expect(codeGroupRequests(requests).at(-1)?.url.searchParams.get('q')).toBe('SYN');
  });

  it('빈 검색어는 쿼리에 싣지 않는다', async () => {
    const { requests, user } = renderScreen([codeGroupListRoute()]);
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    await user.click(within(codeGroupPane()).getByRole('button', { name: '조회' }));

    expect(codeGroupRequests(requests).at(-1)?.url.searchParams.has('q')).toBe(false);
  });

  /* C5 — 계약의 기본값이 false다. 끈 상태를 값으로 실어 보내면 캐시 키가 갈린다. */
  it('미사용 포함이 꺼져 있으면 includeInactive를 싣지 않는다', async () => {
    const { requests } = renderScreen([codeGroupListRoute()]);
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    expect(codeGroupRequests(requests)[0]?.url.searchParams.has('includeInactive')).toBe(false);
  });

  it('미사용 포함을 켜면 includeInactive=true가 실린다', async () => {
    const { requests, user } = renderScreen([codeGroupListRoute()]);
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    await user.click(screen.getByRole('checkbox', { name: '미사용 포함' }));

    expect(codeGroupRequests(requests).at(-1)?.url.searchParams.get('includeInactive')).toBe(
      'true',
    );
  });

  it('조회 조건은 주소에 남는다 — 새로고침·공유가 같은 결과를 낸다', async () => {
    const { requests } = renderScreen([codeGroupListRoute()], '?q=SYN&inactive=1');
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    const first = codeGroupRequests(requests)[0];
    expect(first?.url.searchParams.get('q')).toBe('SYN');
    expect(first?.url.searchParams.get('includeInactive')).toBe('true');
    expect(screen.getByRole('checkbox', { name: '미사용 포함' })).toBeChecked();
  });

  /* C12 — 임시 목록 안내가 화면에 실제로 보인다(결정 6). */
  it('코드그룹 목록 위에 임시 목록 안내가 보인다', async () => {
    renderScreen([codeGroupListRoute()]);
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    expect(
      screen.getByText(
        '임시 목록입니다. 코드 체계가 확정되면 여기 보이는 코드그룹의 구성이 바뀔 수 있습니다.',
      ),
    ).toBeInTheDocument();
  });
});

describe('CommonCodeScreen — 조회 실패 (C10)', () => {
  it('조회에 실패하면 표와 빈 상태 대신 오류 배너와 다시 시도가 뜬다', async () => {
    renderScreen([
      {
        match: (request) => isGet(request, CODE_GROUPS_PATH),
        respond: () => jsonResponse({ message: '' }, { status: 500 }),
      },
    ]);

    expect(await screen.findByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('등록된 코드그룹이 없습니다')).not.toBeInTheDocument();
    // 서버가 빈 message를 줘도 무엇을 하라는 안내가 남아야 한다.
    expect(
      screen.getByText('잠시 뒤 다시 시도하세요. 반복되면 담당자에게 알려 주세요.'),
    ).toBeInTheDocument();
  });

  it('403이면 권한 안내를 낸다', async () => {
    renderScreen([
      {
        match: (request) => isGet(request, CODE_GROUPS_PATH),
        respond: () => jsonResponse({ message: '' }, { status: 403 }),
      },
    ]);

    expect(
      await screen.findByText(
        '이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.',
      ),
    ).toBeInTheDocument();
  });

  it('네트워크가 끊기면 연결 안내를 낸다', async () => {
    renderWithProviders(<CommonCodeScreen />, {
      fetch: () => Promise.reject(new Error('네트워크 실패')),
      route: ROUTE,
    });

    expect(
      await screen.findByText('네트워크 연결이 끊겼습니다. 연결을 확인한 뒤 다시 시도하세요.'),
    ).toBeInTheDocument();
  });

  it('다시 시도를 누르면 목록 요청이 한 번 더 나간다', async () => {
    const { requests, user } = renderScreen([
      {
        match: (request) => isGet(request, CODE_GROUPS_PATH),
        respond: () => jsonResponse({ message: '' }, { status: 500 }),
      },
    ]);
    await screen.findByText('목록을 불러오지 못했습니다');

    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(codeGroupRequests(requests).length).toBeGreaterThan(1);
  });
});

describe('CommonCodeScreen — 빈 상태 (C9)', () => {
  it('0건이면 등록된 것이 없다고 낸다', async () => {
    renderScreen([codeGroupListRoute([], { page: 1, size: 50, total: 0 })]);

    expect(await screen.findByText('등록된 코드그룹이 없습니다')).toBeInTheDocument();
  });

  it('조건이 걸린 0건에는 초기화로 돌아갈 길을 준다', async () => {
    const { requests, user } = renderScreen(
      [codeGroupListRoute([], { page: 1, size: 50, total: 0 })],
      '?q=SYN',
    );

    expect(await screen.findByText('조건에 맞는 코드그룹이 없습니다')).toBeInTheDocument();

    // 빈 상태 안의 「초기화」와 필터 바의 「초기화」가 둘 다 있으므로 빈 상태 쪽을 고른다.
    const emptyReset = screen.getAllByRole('button', { name: '초기화' }).at(-1);
    await user.click(emptyReset as HTMLElement);

    expect(codeGroupRequests(requests).at(-1)?.url.searchParams.has('q')).toBe(false);
  });
});

describe('CommonCodeScreen — 쪽 이동 (C7·C8)', () => {
  it('다음을 누르면 page가 오르고 요청에 실린다', async () => {
    const { requests, user } = renderScreen([
      codeGroupListRoute(codeGroupFixtures, { page: 1, size: 2, total: 10 }),
    ]);
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    await user.click(within(codeGroupPane()).getByRole('button', { name: '다음' }));

    expect(codeGroupRequests(requests).at(-1)?.url.searchParams.get('page')).toBe('2');
  });

  it('첫 쪽에서 이전이 비활성이다', async () => {
    renderScreen([codeGroupListRoute(codeGroupFixtures, { page: 1, size: 2, total: 10 })]);
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    expect(within(codeGroupPane()).getByRole('button', { name: '이전' })).toBeDisabled();
  });

  it('마지막 쪽에서 다음이 비활성이다', async () => {
    renderScreen(
      [codeGroupListRoute(codeGroupFixtures, { page: 5, size: 2, total: 10 })],
      '?page=5',
    );
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    expect(within(codeGroupPane()).getByRole('button', { name: '다음' })).toBeDisabled();
  });

  it('전체가 0건이면 범위를 지어내지 않는다', async () => {
    renderScreen([codeGroupListRoute([], { page: 1, size: 50, total: 0 })]);

    expect(await screen.findByText('전체 0건')).toBeInTheDocument();
  });

  /* C8 — 쪽을 옮기면 선택이 사라진다. 보이는 행이 달라지기 때문이다. */
  it('쪽을 옮기면 grp·val·vpage가 주소에서 사라진다', async () => {
    const { requests, user } = renderScreen(
      [codeGroupListRoute(codeGroupFixtures, { page: 1, size: 2, total: 10 })],
      '?grp=1001&val=2001&vpage=3',
    );
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    await user.click(within(codeGroupPane()).getByRole('button', { name: '다음' }));

    // 선택이 남아 있었다면 상세 조회가 이어졌을 것이다 — 스텁에 없는 요청은 하네스가 던진다.
    expect(await screen.findByText('좌측에서 코드그룹을 먼저 고르세요')).toBeInTheDocument();
    expect(codeGroupRequests(requests).at(-1)?.url.searchParams.get('page')).toBe('2');
  });
});

describe('CommonCodeScreen — 조건 변경과 선택 (C6·C11)', () => {
  /* C6 */
  it('조건이 바뀌면 page·grp·val·vpage가 주소에서 사라진다', async () => {
    const { requests, user } = renderScreen(
      [codeGroupListRoute()],
      '?page=3&grp=1001&val=2001&vpage=2&new=value',
    );
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    await user.type(screen.getByLabelText('코드그룹 검색'), 'SYN');
    await user.click(within(codeGroupPane()).getByRole('button', { name: '조회' }));

    const last = codeGroupRequests(requests).at(-1);
    expect(last?.url.searchParams.has('page')).toBe(false);
    expect(last?.url.searchParams.get('q')).toBe('SYN');
    expect(await screen.findByText('좌측에서 코드그룹을 먼저 고르세요')).toBeInTheDocument();
  });

  /* C11 */
  it('그룹코드를 누르면 그 행에 선택 표식이 선다', async () => {
    const { user } = renderScreen([codeGroupListRoute()]);
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    await user.click(screen.getByRole('button', { name: 'SYN-GRP-02' }));

    expect(screen.getByRole('button', { name: 'SYN-GRP-02' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('고르기 전에는 우 칸이 선택 전 안내를 낸다', async () => {
    renderScreen([codeGroupListRoute()]);

    expect(await screen.findByText('좌측에서 코드그룹을 먼저 고르세요')).toBeInTheDocument();
  });
});
