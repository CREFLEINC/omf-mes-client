import type { components } from '@omf-mes/api-client';
import { act, screen, waitFor, within } from '@testing-library/react';
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
import { codeGroupFixtures, codeValueFixtures } from './fixtures';
import { CommonCodeScreen } from './screen';

type Editability = components['schemas']['Editability'];

const ROUTE = '/master-data/common-code';

const CODE_GROUPS_PATH = '/mdm/code-groups';
const CODE_VALUES_PATH = '/mdm/code-values';

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

/** 코드그룹 상세 — `ETag`가 함께 온다(계약 실측). 저장의 `If-Match`가 이 값에서 나온다. */
const codeGroupDetailRoute = (
  codeGroupId = 1001,
  editability: Editability = { codeEditable: true, reason: 'EDITABLE', referenceCount: 0 },
): StubRoute => ({
  match: (request) => isGet(request, `${CODE_GROUPS_PATH}/${String(codeGroupId)}`),
  respond: () =>
    jsonResponse(
      {
        codeGroup: codeGroupFixtures.find((row) => row.codeGroupId === codeGroupId),
        editability,
      },
      { headers: { ETag: 'W/"7"' } },
    ),
});

/**
 * 뒤로가기를 눌러 보기 위한 탐침.
 *
 * 하네스가 `MemoryRouter`라 브라우저 히스토리가 없다 — 라우터가 쌓은 칸을 보려면
 * 트리 안에서 `navigate(-1)`을 부르고 그때의 주소를 읽는 수밖에 없다.
 */
interface HistoryProbe {
  search: () => string;
  /**
   * **렌더된** 히스토리 칸 수. 한 틱에 갱신이 두 번 나면 앞 칸은 렌더되지 않고 스쳐 가므로
   * 이 값은 그것을 세지 못한다 — 「한 조작 = 한 칸」의 정본 판정은 `back()`이다.
   * 여기서는 「주소가 달라지지 않는데 칸만 늘었다」를 잡는 데만 쓴다.
   */
  entries: () => number;
  back: () => void;
}

let probeNavigate: ((delta: number) => void) | null = null;
let probeSearch = '';
let probeKeys: string[] = [];

const RouterProbe = () => {
  const location = useLocation();

  probeNavigate = useNavigate();
  probeSearch = location.search;
  // 같은 칸을 여러 번 렌더해도 한 번만 센다. 라우터는 칸마다 다른 열쇠를 준다.
  if (probeKeys.at(-1) !== location.key) probeKeys.push(location.key);

  return null;
};

const renderScreen = (routes: StubRoute[], search = '') => {
  const { fetch, requests } = createRecordingFetch(routes);

  probeNavigate = null;
  probeSearch = '';
  probeKeys = [];

  const { queryClient } = renderWithProviders(
    <>
      <CommonCodeScreen />
      <RouterProbe />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  const history: HistoryProbe = {
    search: () => probeSearch,
    entries: () => probeKeys.length,
    back: () => {
      act(() => {
        probeNavigate?.(-1);
      });
    },
  };

  return { requests, queryClient, history, user: userEvent.setup() };
};

const requestsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === pathname);

const codeGroupRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requestsTo(requests, CODE_GROUPS_PATH);

const codeGroupPane = (): HTMLElement => screen.getByRole('region', { name: '코드그룹' });

const codeGroupFormPane = (): HTMLElement => screen.getByRole('region', { name: '코드그룹 정보' });

const codeValuePane = (): HTMLElement => screen.getByRole('region', { name: '코드값' });

/** 코드값 목록 — 계약이 `codeGroupId`를 필수 쿼리로 둔다. */
const codeValueListRoute = (
  items = codeValueFixtures,
  pageMeta: PageStub = { page: 1, size: 50, total: codeValueFixtures.length },
): StubRoute => ({
  match: (request) => isGet(request, CODE_VALUES_PATH),
  respond: () => jsonResponse({ items, page: pageMeta }),
});

const codeValueRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requestsTo(requests, CODE_VALUES_PATH);

/**
 * 코드값 상세 — `ETag`가 함께 온다(계약 실측).
 * 코드값의 코드는 참조 건수를 셀 수 없어 늘 잠긴 상태로 온다(계약).
 */
const codeValueDetailRoute = (
  codeValueId = 2001,
  editability: Editability = {
    codeEditable: false,
    reason: 'NOT_COUNTABLE',
    referenceCount: null,
  },
): StubRoute => ({
  match: (request) => isGet(request, `${CODE_VALUES_PATH}/${String(codeValueId)}`),
  respond: () =>
    jsonResponse(
      {
        codeValue: codeValueFixtures.find((row) => row.codeValueId === codeValueId),
        editability,
      },
      { headers: { ETag: 'W/"3"' } },
    ),
});

/** UUID 형식인지. 고정 문자열 멱등 키를 쓰면 서버가 400으로 되돌린다(계약 실측). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
      [
        codeGroupListRoute(codeGroupFixtures, { page: 1, size: 2, total: 10 }),
        codeGroupDetailRoute(),
      ],
      '?grp=1001&val=2001&vpage=3',
    );
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    await user.click(within(codeGroupPane()).getByRole('button', { name: '다음' }));

    // 선택이 남아 있었다면 상세 조회가 이어졌을 것이다 — 스텁에 없는 요청은 하네스가 던진다.
    expect(
      await screen.findByText('좌측에서 코드그룹을 고르면 여기에 그 그룹의 정보가 보입니다'),
    ).toBeInTheDocument();
    expect(codeGroupRequests(requests).at(-1)?.url.searchParams.get('page')).toBe('2');
  });
});

describe('CommonCodeScreen — 조건 변경과 선택 (C6·C11)', () => {
  /* C6 */
  it('조건이 바뀌면 page·grp·val·vpage가 주소에서 사라진다', async () => {
    const { requests, user } = renderScreen(
      [codeGroupListRoute(), codeGroupDetailRoute()],
      '?page=3&grp=1001&val=2001&vpage=2&new=value',
    );
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    await user.type(screen.getByLabelText('코드그룹 검색'), 'SYN');
    await user.click(within(codeGroupPane()).getByRole('button', { name: '조회' }));

    const last = codeGroupRequests(requests).at(-1);
    expect(last?.url.searchParams.has('page')).toBe(false);
    expect(last?.url.searchParams.get('q')).toBe('SYN');
    expect(
      await screen.findByText('좌측에서 코드그룹을 고르면 여기에 그 그룹의 정보가 보입니다'),
    ).toBeInTheDocument();
  });

  /* C11 */
  it('그룹코드를 누르면 그 행에 선택 표식이 선다', async () => {
    const { user } = renderScreen([codeGroupListRoute(), codeGroupDetailRoute(1002)]);
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    await user.click(screen.getByRole('button', { name: 'SYN-GRP-02' }));

    expect(screen.getByRole('button', { name: 'SYN-GRP-02' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('고르기 전에는 우 칸이 선택 전 안내를 낸다', async () => {
    renderScreen([codeGroupListRoute()]);

    expect(
      await screen.findByText('좌측에서 코드그룹을 고르면 여기에 그 그룹의 정보가 보입니다'),
    ).toBeInTheDocument();
  });
});

describe('CommonCodeScreen — 코드그룹 상세 (C14·C15·C19)', () => {
  /* C14 */
  it('그룹을 고르면 상세 요청이 한 번 나간다', async () => {
    const { requests, user } = renderScreen([codeGroupListRoute(), codeGroupDetailRoute()]);
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    expect(requestsTo(requests, `${CODE_GROUPS_PATH}/1001`)).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'SYN-GRP-01' }));
    await screen.findByRole('region', { name: '코드그룹 정보' });

    expect(requestsTo(requests, `${CODE_GROUPS_PATH}/1001`)).toHaveLength(1);
  });

  it('폼이 상세 값으로 채워진다', async () => {
    renderScreen([codeGroupListRoute(), codeGroupDetailRoute()], '?grp=1001');

    expect(await screen.findByLabelText('그룹코드')).toHaveValue('SYN-GRP-01');
    expect(screen.getByLabelText('그룹명')).toHaveValue('합성 코드그룹 A');
    expect(screen.getByLabelText('설명')).toHaveValue('합성 설명 A');
  });

  /*
   * C15 — 입력하는 동안 캐시가 갱신돼도 사용자가 넣은 값이 서버 값으로 되돌아가면 안 된다.
   * 같은 값을 다시 받으면 객체 동일성이 유지되므로 폼을 다시 세우지 않는다.
   */
  it('입력 중에 상세 캐시가 갱신돼도 입력값이 유지된다', async () => {
    const { user, requests, queryClient } = renderScreen(
      [codeGroupListRoute(), codeGroupDetailRoute()],
      '?grp=1001',
    );
    await screen.findByRole('region', { name: '코드그룹 정보' });

    await user.type(screen.getByLabelText('그룹명'), '-편집중');

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['common-code-groups'] });
    });

    await waitFor(() => {
      expect(requestsTo(requests, `${CODE_GROUPS_PATH}/1001`).length).toBeGreaterThan(1);
    });

    expect(screen.getByLabelText('그룹명')).toHaveValue('합성 코드그룹 A-편집중');
  });

  /* C19 — 판정의 주인은 codeEditable이다. reason이 EDITABLE이어도 잠근다. */
  it('codeEditable이 거짓이면 reason이 EDITABLE이어도 그룹코드가 잠긴다', async () => {
    renderScreen(
      [
        codeGroupListRoute(),
        codeGroupDetailRoute(1001, {
          codeEditable: false,
          reason: 'EDITABLE',
          referenceCount: 3,
        }),
      ],
      '?grp=1001',
    );

    expect(await screen.findByLabelText('그룹코드')).toBeDisabled();
    expect(
      screen.getByText('지금은 코드를 바꿀 수 없습니다. 변경이 필요하면 담당자에게 문의하세요.'),
    ).toBeInTheDocument();
  });

  it('codeEditable이 참이면 그룹코드를 고칠 수 있다', async () => {
    renderScreen([codeGroupListRoute(), codeGroupDetailRoute()], '?grp=1001');

    expect(await screen.findByLabelText('그룹코드')).toBeEnabled();
  });

  it('상세 조회에 실패하면 폼 대신 배너를 낸다', async () => {
    renderScreen(
      [
        codeGroupListRoute(),
        {
          match: (request) => isGet(request, `${CODE_GROUPS_PATH}/1001`),
          respond: () => jsonResponse({ message: '' }, { status: 500 }),
        },
      ],
      '?grp=1001',
    );

    expect(await screen.findByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '코드그룹 정보' })).not.toBeInTheDocument();
  });
});

describe('CommonCodeScreen — 코드그룹 수정 (C16·C17·C18·C20)', () => {
  const updateRoute: StubRoute = {
    match: (request) =>
      request.method === 'PUT' && new URL(request.url).pathname === `${CODE_GROUPS_PATH}/1001`,
    respond: () =>
      jsonResponse(
        { ...codeGroupFixtures[0], groupName: '고친 이름' },
        { headers: { ETag: 'W/"8"' } },
      ),
  };

  const openEditForm = async () => {
    const rendered = renderScreen(
      [codeGroupListRoute(), codeGroupDetailRoute(), updateRoute],
      '?grp=1001',
    );
    await screen.findByRole('region', { name: '코드그룹 정보' });

    return rendered;
  };

  /* C16 — 수정에는 멱등 키와 If-Match가 둘 다 필요하다(계약 실측). */
  it('저장이 PUT으로 나가고 UUID 멱등 키와 If-Match가 둘 다 실린다', async () => {
    const { requests, user } = await openEditForm();

    await user.type(screen.getByLabelText('그룹명'), 'X');
    await user.click(within(codeGroupFormPane()).getByRole('button', { name: '저장' }));

    const put = await waitFor(() => {
      const found = requests.find((request) => request.method === 'PUT');
      expect(found).toBeDefined();
      return found as RecordedRequest;
    });

    expect(put.url.pathname).toBe(`${CODE_GROUPS_PATH}/1001`);
    expect(put.headers.get('Idempotency-Key')).toMatch(UUID);
    expect(put.headers.get('If-Match')).toBe('W/"7"');
  });

  /* C17 */
  it('저장 본문에 isActive·codeGroupId가 없다', async () => {
    const { requests, user } = await openEditForm();

    await user.type(screen.getByLabelText('그룹명'), 'X');
    await user.click(within(codeGroupFormPane()).getByRole('button', { name: '저장' }));

    const put = await waitFor(() => {
      const found = requests.find((request) => request.method === 'PUT');
      expect(found).toBeDefined();
      return found as RecordedRequest;
    });

    const body = JSON.parse(put.body) as Record<string, unknown>;
    expect('isActive' in body).toBe(false);
    expect('codeGroupId' in body).toBe(false);
    expect(Object.keys(body).sort()).toEqual(['description', 'groupCode', 'groupName']);
  });

  /* C18 — 화면에서 잡히는 오류는 서버로 보내지 않는다. */
  it('필수를 비우면 요청이 나가지 않고 인라인 오류가 뜬다', async () => {
    const { requests, user } = await openEditForm();

    await user.clear(screen.getByLabelText('그룹명'));
    await user.click(within(codeGroupFormPane()).getByRole('button', { name: '저장' }));

    expect(await screen.findByText('필수 입력 항목입니다.')).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'PUT')).toBe(false);
  });

  it('공백만 넣어도 막고, 값을 고치면 그 오류가 지워진다', async () => {
    const { requests, user } = await openEditForm();

    await user.clear(screen.getByLabelText('그룹명'));
    await user.type(screen.getByLabelText('그룹명'), '   ');
    await user.click(within(codeGroupFormPane()).getByRole('button', { name: '저장' }));

    expect(await screen.findByText('그룹명은 공백만으로 지정할 수 없습니다.')).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'PUT')).toBe(false);

    await user.type(screen.getByLabelText('그룹명'), '고친 이름');

    expect(screen.queryByText('그룹명은 공백만으로 지정할 수 없습니다.')).not.toBeInTheDocument();
  });

  it('길이 상한을 넘으면 막는다', async () => {
    const { requests, user } = await openEditForm();

    await user.clear(screen.getByLabelText('그룹코드'));
    await user.type(screen.getByLabelText('그룹코드'), 'A'.repeat(51));
    await user.click(within(codeGroupFormPane()).getByRole('button', { name: '저장' }));

    expect(await screen.findByText('그룹코드는 50자를 넘을 수 없습니다.')).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'PUT')).toBe(false);
  });

  /* C20 — 재조회로 풀리는 것은 충돌뿐이다. */
  it('409면 원인별 문구와 최신 불러오기가 나온다', async () => {
    const { requests, user } = renderScreen(
      [
        codeGroupListRoute(),
        codeGroupDetailRoute(),
        {
          match: (request) =>
            request.method === 'PUT' &&
            new URL(request.url).pathname === `${CODE_GROUPS_PATH}/1001`,
          respond: () => jsonResponse({ conflictCause: 'erpSync', message: '' }, { status: 409 }),
        },
      ],
      '?grp=1001',
    );
    await screen.findByRole('region', { name: '코드그룹 정보' });

    await user.type(screen.getByLabelText('그룹명'), 'X');
    await user.click(within(codeGroupFormPane()).getByRole('button', { name: '저장' }));

    expect(
      await screen.findByText(
        '외부 시스템에서 이 항목이 다시 동기화됐습니다. 최신 내용을 불러온 뒤 다시 저장하세요.',
      ),
    ).toBeInTheDocument();

    const before = requestsTo(requests, `${CODE_GROUPS_PATH}/1001`).filter(
      (request) => request.method === 'GET',
    ).length;

    await user.click(screen.getByRole('button', { name: '최신 불러오기' }));

    await waitFor(() => {
      expect(
        requestsTo(requests, `${CODE_GROUPS_PATH}/1001`).filter(
          (request) => request.method === 'GET',
        ).length,
      ).toBeGreaterThan(before);
    });
  });

  it('409가 아닌 실패에는 최신 불러오기를 내지 않는다', async () => {
    const { user } = renderScreen(
      [
        codeGroupListRoute(),
        codeGroupDetailRoute(),
        {
          match: (request) =>
            request.method === 'PUT' &&
            new URL(request.url).pathname === `${CODE_GROUPS_PATH}/1001`,
          respond: () =>
            jsonResponse(
              { errors: [{ scope: 'screen', code: 'STANDARD', message: '저장할 수 없습니다.' }] },
              { status: 400 },
            ),
        },
      ],
      '?grp=1001',
    );
    await screen.findByRole('region', { name: '코드그룹 정보' });

    await user.type(screen.getByLabelText('그룹명'), 'X');
    await user.click(within(codeGroupFormPane()).getByRole('button', { name: '저장' }));

    expect(await screen.findByText('저장할 수 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '최신 불러오기' })).not.toBeInTheDocument();
  });
});

describe('CommonCodeScreen — 코드그룹 등록 (C21)', () => {
  const createRoute: StubRoute = {
    match: (request) =>
      request.method === 'POST' && new URL(request.url).pathname === CODE_GROUPS_PATH,
    respond: () =>
      jsonResponse(
        {
          codeGroupId: 1009,
          groupCode: 'SYN-GRP-09',
          groupName: '합성 코드그룹 I',
          description: null,
          isActive: true,
        },
        { status: 201 },
      ),
  };

  const openCreateForm = async () => {
    const rendered = renderScreen([
      codeGroupListRoute(),
      createRoute,
      {
        match: (request) => isGet(request, `${CODE_GROUPS_PATH}/1009`),
        respond: () =>
          jsonResponse(
            {
              codeGroup: {
                codeGroupId: 1009,
                groupCode: 'SYN-GRP-09',
                groupName: '합성 코드그룹 I',
                description: null,
                isActive: true,
              },
              editability: { codeEditable: true, reason: 'EDITABLE', referenceCount: 0 },
            },
            { headers: { ETag: 'W/"1"' } },
          ),
      },
    ]);
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    await rendered.user.click(screen.getByRole('button', { name: '그룹 추가' }));
    await screen.findByRole('region', { name: '코드그룹 정보' });

    return rendered;
  };

  it('등록 저장이 POST로 나가고 If-Match가 없다', async () => {
    const { requests, user } = await openCreateForm();

    await user.type(screen.getByLabelText('그룹코드'), 'SYN-GRP-09');
    await user.type(screen.getByLabelText('그룹명'), '합성 코드그룹 I');
    await user.click(within(codeGroupFormPane()).getByRole('button', { name: '그룹 추가' }));

    const post = await waitFor(() => {
      const found = requests.find((request) => request.method === 'POST');
      expect(found).toBeDefined();
      return found as RecordedRequest;
    });

    expect(post.url.pathname).toBe(CODE_GROUPS_PATH);
    expect(post.headers.get('Idempotency-Key')).toMatch(UUID);
    expect(post.headers.has('If-Match')).toBe(false);
  });

  it('등록에 성공하면 새 그룹으로 옮겨 가고 new가 사라진다', async () => {
    const { requests, user } = await openCreateForm();

    await user.type(screen.getByLabelText('그룹코드'), 'SYN-GRP-09');
    await user.type(screen.getByLabelText('그룹명'), '합성 코드그룹 I');
    await user.click(within(codeGroupFormPane()).getByRole('button', { name: '그룹 추가' }));

    // 새 그룹의 상세를 조회한다 = grp가 새 번호가 되고 new가 사라졌다.
    await waitFor(() => {
      expect(requestsTo(requests, `${CODE_GROUPS_PATH}/1009`)).toHaveLength(1);
    });
    expect(await screen.findByRole('button', { name: '저장' })).toBeInTheDocument();
  });

  it('등록에 성공하면 목록이 다시 조회된다', async () => {
    const { requests, user } = await openCreateForm();
    const before = codeGroupRequests(requests).filter((request) => request.method === 'GET').length;

    await user.type(screen.getByLabelText('그룹코드'), 'SYN-GRP-09');
    await user.type(screen.getByLabelText('그룹명'), '합성 코드그룹 I');
    await user.click(within(codeGroupFormPane()).getByRole('button', { name: '그룹 추가' }));

    await waitFor(() => {
      expect(
        codeGroupRequests(requests).filter((request) => request.method === 'GET').length,
      ).toBeGreaterThan(before);
    });
  });

  /* 등록 폼이 열려 있는 동안 고른 그룹의 상세가 함께 보이면 어느 쪽을 고치는지 가릴 수 없다. */
  it('등록 폼을 열면 고른 그룹의 상세를 조회하지 않는다', async () => {
    const { requests, user } = renderScreen(
      [codeGroupListRoute(), codeGroupDetailRoute()],
      '?grp=1001',
    );
    await screen.findByRole('region', { name: '코드그룹 정보' });
    const before = requestsTo(requests, `${CODE_GROUPS_PATH}/1001`).length;

    await user.click(screen.getByRole('button', { name: '그룹 추가' }));

    expect(screen.getByLabelText('그룹코드')).toHaveValue('');
    expect(requestsTo(requests, `${CODE_GROUPS_PATH}/1001`)).toHaveLength(before);
  });
});

describe('CommonCodeScreen — 코드그룹 사용 중지 (C22)', () => {
  const deactivateRoute: StubRoute = {
    match: (request) =>
      request.method === 'POST' &&
      new URL(request.url).pathname === `${CODE_GROUPS_PATH}/1001:deactivate`,
    respond: () => jsonResponse({ ...codeGroupFixtures[0], isActive: false }),
  };

  const openEditForm = async (routes: StubRoute[] = [deactivateRoute]) => {
    const rendered = renderScreen(
      [codeGroupListRoute(), codeGroupDetailRoute(), ...routes],
      '?grp=1001',
    );
    await screen.findByRole('region', { name: '코드그룹 정보' });

    return rendered;
  };

  it('사용 중지를 누르면 확인 창이 열리고 확인 전에는 요청이 나가지 않는다', async () => {
    const { requests, user } = await openEditForm();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(within(codeGroupFormPane()).getByRole('button', { name: '사용 중지' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'POST')).toBe(false);
  });

  it('확인하면 :deactivate로 나가고 멱등 키와 If-Match가 둘 다 실린다', async () => {
    const { requests, user } = await openEditForm();

    await user.click(within(codeGroupFormPane()).getByRole('button', { name: '사용 중지' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '사용 중지' }));

    const post = await waitFor(() => {
      const found = requests.find((request) => request.method === 'POST');
      expect(found).toBeDefined();
      return found as RecordedRequest;
    });

    expect(post.url.pathname).toBe(`${CODE_GROUPS_PATH}/1001:deactivate`);
    expect(post.headers.get('Idempotency-Key')).toMatch(UUID);
    expect(post.headers.get('If-Match')).toBe('W/"7"');
  });

  /* 응답에 ETag가 없어 보관된 토큰이 낡는다 — 재조회로 새 토큰을 확보해야 한다. */
  it('중지에 성공하면 상세와 목록이 다시 조회된다', async () => {
    const { requests, user } = await openEditForm();
    const beforeDetail = requestsTo(requests, `${CODE_GROUPS_PATH}/1001`).length;
    const beforeList = codeGroupRequests(requests).filter(
      (request) => request.method === 'GET',
    ).length;

    await user.click(within(codeGroupFormPane()).getByRole('button', { name: '사용 중지' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '사용 중지' }));

    await waitFor(() => {
      expect(requestsTo(requests, `${CODE_GROUPS_PATH}/1001`).length).toBeGreaterThan(beforeDetail);
      expect(
        codeGroupRequests(requests).filter((request) => request.method === 'GET').length,
      ).toBeGreaterThan(beforeList);
    });
  });

  /* 닫으면 사용자는 무엇이 막았는지 모른 채 같은 버튼을 다시 누른다. */
  it('중지에 실패해도 확인 창이 닫히지 않는다', async () => {
    const { user } = await openEditForm([
      {
        match: (request) =>
          request.method === 'POST' &&
          new URL(request.url).pathname === `${CODE_GROUPS_PATH}/1001:deactivate`,
        respond: () => jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 }),
      },
    ]);

    await user.click(within(codeGroupFormPane()).getByRole('button', { name: '사용 중지' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '사용 중지' }));

    expect(
      await within(screen.getByRole('dialog')).findByText(
        '다른 사용자가 먼저 저장했습니다. 최신 내용을 불러온 뒤 다시 저장하세요.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('확인 창에 참조 건수를 내지 않는다', async () => {
    const { user } = await openEditForm();

    await user.click(within(codeGroupFormPane()).getByRole('button', { name: '사용 중지' }));

    expect(screen.getByRole('dialog').textContent).not.toMatch(/\d+\s*건/);
  });

  it('이미 미사용이면 사용 중지가 비활성이고 사유가 붙는다', async () => {
    renderScreen([codeGroupListRoute(), codeGroupDetailRoute(1003)], '?grp=1003');
    await screen.findByRole('region', { name: '코드그룹 정보' });

    const button = within(codeGroupFormPane()).getByRole('button', { name: '사용 중지' });
    expect(button).toBeDisabled();
    expect(
      screen.getByText('사용 중지는 이미 미사용인 코드그룹에 다시 할 수 없습니다.'),
    ).toBeInTheDocument();
  });

  /* 닫힌 창을 남겨 두면 지난 값이 그대로 살아 있다. */
  it('창을 닫으면 DOM에서 사라진다', async () => {
    const { user } = await openEditForm();

    await user.click(within(codeGroupFormPane()).getByRole('button', { name: '사용 중지' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '취소' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('CommonCodeScreen — 코드값 목록 (C23·C24·C25·C29)', () => {
  /* C23 — 계약이 `codeGroupId`를 필수 쿼리로 두어 빼고 부르면 422다. */
  it('그룹을 고르기 전에는 코드값 목록을 조회하지 않는다', async () => {
    const { requests } = renderScreen([codeGroupListRoute(), codeValueListRoute()]);
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    expect(codeValueRequests(requests)).toHaveLength(0);
    expect(
      within(codeValuePane()).getByText('좌측에서 코드그룹을 먼저 고르세요'),
    ).toBeInTheDocument();
  });

  it('그룹을 고르면 codeGroupId를 실어 한 번 조회한다', async () => {
    const { requests, user } = renderScreen([
      codeGroupListRoute(),
      codeGroupDetailRoute(),
      codeValueListRoute(),
    ]);
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    await user.click(screen.getByRole('button', { name: 'SYN-GRP-01' }));
    await screen.findByRole('button', { name: 'SYN-CV-01' });

    const list = codeValueRequests(requests);
    expect(list).toHaveLength(1);
    expect(list[0]?.url.searchParams.get('codeGroupId')).toBe('1001');
  });

  /* C24 — 계약의 기본값이 false다. 끈 상태를 값으로 실어 보내면 캐시 키가 갈린다. */
  it('코드값 미사용 포함이 꺼져 있으면 includeInactive를 싣지 않는다', async () => {
    const { requests } = renderScreen(
      [codeGroupListRoute(), codeGroupDetailRoute(), codeValueListRoute()],
      '?grp=1001',
    );
    await screen.findByRole('button', { name: 'SYN-CV-01' });

    expect(codeValueRequests(requests)[0]?.url.searchParams.has('includeInactive')).toBe(false);
  });

  it('코드값 미사용 포함을 켜면 includeInactive=true가 실린다', async () => {
    const { requests, user } = renderScreen(
      [codeGroupListRoute(), codeGroupDetailRoute(), codeValueListRoute()],
      '?grp=1001',
    );
    await screen.findByRole('button', { name: 'SYN-CV-01' });

    await user.click(within(codeValuePane()).getByRole('checkbox', { name: '미사용 포함' }));

    await waitFor(() => {
      expect(codeValueRequests(requests).at(-1)?.url.searchParams.get('includeInactive')).toBe(
        'true',
      );
    });
  });

  /* C25 — 한 화면에 쪽이 둘이라 같은 키를 쓰면 한쪽을 옮길 때 다른 쪽까지 따라간다. */
  it('코드값 쪽 이동은 vpage를 쓰고 좌 목록의 page와 섞이지 않는다', async () => {
    const { requests, user } = renderScreen(
      [
        codeGroupListRoute(codeGroupFixtures, { page: 1, size: 50, total: 3 }),
        codeGroupDetailRoute(),
        codeValueListRoute(codeValueFixtures, { page: 1, size: 2, total: 10 }),
      ],
      '?grp=1001',
    );
    await screen.findByRole('button', { name: 'SYN-CV-01' });

    const groupRequestsBefore = codeGroupRequests(requests).filter(
      (request) => request.method === 'GET',
    ).length;

    await user.click(within(codeValuePane()).getByRole('button', { name: '다음' }));

    await waitFor(() => {
      expect(codeValueRequests(requests).at(-1)?.url.searchParams.get('page')).toBe('2');
    });

    // 좌 목록은 다시 조회되지 않는다 — 요청 쿼리의 page도 그대로다.
    expect(codeGroupRequests(requests).filter((request) => request.method === 'GET').length).toBe(
      groupRequestsBefore,
    );
    expect(codeGroupRequests(requests).at(-1)?.url.searchParams.has('page')).toBe(false);
  });

  it('주소의 vpage로 들어오면 그 쪽을 조회한다', async () => {
    const { requests } = renderScreen(
      [
        codeGroupListRoute(),
        codeGroupDetailRoute(),
        codeValueListRoute(codeValueFixtures, { page: 3, size: 2, total: 10 }),
      ],
      '?grp=1001&vpage=3',
    );
    await screen.findByRole('button', { name: 'SYN-CV-01' });

    expect(codeValueRequests(requests)[0]?.url.searchParams.get('page')).toBe('3');
  });

  /* C26 — 화면 수준에서도 서버가 준 배열 순서를 그대로 쓰지 않음을 확인한다. */
  it('코드값이 정렬 순서 오름차순으로 그려진다', async () => {
    renderScreen([codeGroupListRoute(), codeGroupDetailRoute(), codeValueListRoute()], '?grp=1001');
    await screen.findByRole('button', { name: 'SYN-CV-01' });

    const codes = within(codeValuePane())
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[0]?.textContent ?? '');

    expect(codes).toEqual(['SYN-CV-02', 'SYN-CV-03', 'SYN-CV-01']);
  });

  /* C29 */
  it('코드를 누르면 그 행에 선택 표식이 선다', async () => {
    const { user } = renderScreen(
      [codeGroupListRoute(), codeGroupDetailRoute(), codeValueListRoute()],
      '?grp=1001',
    );
    await screen.findByRole('button', { name: 'SYN-CV-01' });

    await user.click(screen.getByRole('button', { name: 'SYN-CV-02' }));

    expect(screen.getByRole('button', { name: 'SYN-CV-02' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('그룹을 바꾸면 val·vpage가 주소에서 사라진다', async () => {
    const { requests, user } = renderScreen(
      [
        codeGroupListRoute(),
        codeGroupDetailRoute(1001),
        codeGroupDetailRoute(1002),
        codeValueListRoute(),
      ],
      '?grp=1001&val=2001&vpage=2',
    );
    await screen.findByRole('button', { name: 'SYN-CV-01' });

    await user.click(screen.getByRole('button', { name: 'SYN-GRP-02' }));

    await waitFor(() => {
      expect(codeValueRequests(requests).at(-1)?.url.searchParams.get('codeGroupId')).toBe('1002');
    });
    // vpage가 남아 있었다면 page=2가 실렸을 것이다.
    expect(codeValueRequests(requests).at(-1)?.url.searchParams.has('page')).toBe(false);
    expect(screen.getByRole('button', { name: 'SYN-CV-01' })).not.toHaveAttribute('aria-current');
  });

  it('코드값 조건을 바꾸면 val이 주소에서 사라진다', async () => {
    const { user } = renderScreen(
      [codeGroupListRoute(), codeGroupDetailRoute(), codeValueListRoute()],
      '?grp=1001&val=2001',
    );
    await screen.findByRole('button', { name: 'SYN-CV-01' });
    expect(screen.getByRole('button', { name: 'SYN-CV-01' })).toHaveAttribute('aria-current');

    await user.click(within(codeValuePane()).getByRole('checkbox', { name: '미사용 포함' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'SYN-CV-01' })).not.toHaveAttribute('aria-current');
    });
  });

  it('코드값 조회에 실패하면 표 대신 배너를 낸다', async () => {
    renderScreen(
      [
        codeGroupListRoute(),
        codeGroupDetailRoute(),
        {
          match: (request) => isGet(request, CODE_VALUES_PATH),
          respond: () => jsonResponse({ message: '' }, { status: 500 }),
        },
      ],
      '?grp=1001',
    );

    expect(
      await within(codeValuePane()).findByText('목록을 불러오지 못했습니다'),
    ).toBeInTheDocument();
    expect(within(codeValuePane()).queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('CommonCodeScreen — 코드값 상세와 수정 (C30·C31·C32·C33·C36·C40)', () => {
  const updateRoute: StubRoute = {
    match: (request) =>
      request.method === 'PUT' && new URL(request.url).pathname.startsWith(`${CODE_VALUES_PATH}/`),
    respond: (request) =>
      jsonResponse(
        {
          ...codeValueFixtures[0],
          codeValueId: Number(new URL(request.url).pathname.split('/').pop()),
          displayOrder: 5,
        },
        { headers: { ETag: 'W/"4"' } },
      ),
  };

  const openCodeValueForm = async (routes: StubRoute[] = []) => {
    const rendered = renderScreen(
      [
        codeGroupListRoute(),
        codeGroupDetailRoute(),
        codeValueListRoute(),
        codeValueDetailRoute(),
        ...routes,
      ],
      '?grp=1001&val=2001',
    );
    // 구획은 불러오는 중에도 있다 — 입력칸이 나와야 상세가 도착한 것이다.
    await screen.findByLabelText('코드명');

    return rendered;
  };

  const codeValueFormPane = (): HTMLElement => screen.getByRole('region', { name: '코드값 정보' });

  /* C30 */
  it('코드값을 고르면 상세 요청이 한 번 나간다', async () => {
    const { requests, user } = renderScreen([
      codeGroupListRoute(),
      codeGroupDetailRoute(),
      codeValueListRoute(),
      codeValueDetailRoute(2002),
    ]);
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    await user.click(screen.getByRole('button', { name: 'SYN-GRP-01' }));
    await screen.findByRole('button', { name: 'SYN-CV-02' });

    expect(requestsTo(requests, `${CODE_VALUES_PATH}/2002`)).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'SYN-CV-02' }));
    await screen.findByLabelText('코드명');

    expect(requestsTo(requests, `${CODE_VALUES_PATH}/2002`)).toHaveLength(1);
  });

  it('폼이 상세 값으로 채워진다', async () => {
    await openCodeValueForm();

    expect(screen.getByLabelText('코드')).toHaveValue('SYN-CV-01');
    expect(screen.getByLabelText('정렬 순서')).toHaveValue(30);
    expect(screen.getByLabelText('유효 시작')).toHaveValue('2026-07-01');
  });

  /* C36 — 코드값의 코드는 참조 건수를 셀 수 없어 수정에서 언제나 잠긴다(계약). */
  it('수정 폼의 코드 칸이 잠기고 셀 수 없다는 문구가 붙는다', async () => {
    await openCodeValueForm();

    expect(screen.getByLabelText('코드')).toBeDisabled();
    expect(
      screen.getByText(
        '이 코드를 참조하는 자료의 수를 확인할 수 없어 코드를 잠급니다. 변경이 필요하면 담당자에게 문의하세요.',
      ),
    ).toBeInTheDocument();
  });

  /* C31 */
  it('저장이 PUT으로 나가고 UUID 멱등 키와 If-Match가 둘 다 실린다', async () => {
    const { requests, user } = await openCodeValueForm([updateRoute]);

    await user.type(screen.getByLabelText('코드명'), 'X');
    await user.click(within(codeValueFormPane()).getByRole('button', { name: '저장' }));

    const put = await waitFor(() => {
      const found = requests.find((request) => request.method === 'PUT');
      expect(found).toBeDefined();
      return found as RecordedRequest;
    });

    expect(put.url.pathname).toBe(`${CODE_VALUES_PATH}/2001`);
    expect(put.headers.get('Idempotency-Key')).toMatch(UUID);
    expect(put.headers.get('If-Match')).toBe('W/"3"');
  });

  /* C32 */
  it('저장 본문에 codeGroupId·isActive·codeValueId가 없다', async () => {
    const { requests, user } = await openCodeValueForm([updateRoute]);

    await user.type(screen.getByLabelText('코드명'), 'X');
    await user.click(within(codeValueFormPane()).getByRole('button', { name: '저장' }));

    const put = await waitFor(() => {
      const found = requests.find((request) => request.method === 'PUT');
      expect(found).toBeDefined();
      return found as RecordedRequest;
    });

    const body = JSON.parse(put.body) as Record<string, unknown>;
    expect('codeGroupId' in body).toBe(false);
    expect('isActive' in body).toBe(false);
    expect('codeValueId' in body).toBe(false);
  });

  /*
   * C33 — **전체 치환이 아니다.** 정렬 순서를 고쳐도 그 행 하나만 보낸다.
   * `display_order`에 유일 제약이 없어 중간 상태가 제약을 위반하지 않는다.
   */
  it('정렬 순서를 고쳐 저장하면 PUT 요청이 정확히 한 번 나간다', async () => {
    const { requests, user } = await openCodeValueForm([updateRoute]);

    await user.clear(screen.getByLabelText('정렬 순서'));
    await user.type(screen.getByLabelText('정렬 순서'), '5');
    await user.click(within(codeValueFormPane()).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(1);
    });

    const puts = requests.filter((request) => request.method === 'PUT');
    expect(puts[0]?.url.pathname).toBe(`${CODE_VALUES_PATH}/2001`);
    // 보이는 다른 행(2002·2003)에는 요청이 나가지 않는다.
    expect(requestsTo(requests, `${CODE_VALUES_PATH}/2002`)).toHaveLength(0);
    expect(requestsTo(requests, `${CODE_VALUES_PATH}/2003`)).toHaveLength(0);
    expect(JSON.parse(puts[0]?.body ?? '{}')).toMatchObject({ displayOrder: 5 });
  });

  /* C34 */
  it('정렬 순서가 정수가 아니면 요청이 나가지 않고 인라인 오류가 뜬다', async () => {
    const { requests, user } = await openCodeValueForm([updateRoute]);

    await user.clear(screen.getByLabelText('정렬 순서'));
    await user.type(screen.getByLabelText('정렬 순서'), '1.5');
    await user.click(within(codeValueFormPane()).getByRole('button', { name: '저장' }));

    expect(await screen.findByText('정렬 순서는 정수로 입력하세요.')).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'PUT')).toBe(false);
  });

  it('정렬 순서를 비우면 요청이 나가지 않는다', async () => {
    const { requests, user } = await openCodeValueForm([updateRoute]);

    await user.clear(screen.getByLabelText('정렬 순서'));
    await user.click(within(codeValueFormPane()).getByRole('button', { name: '저장' }));

    expect(await screen.findByText('필수 입력 항목입니다.')).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'PUT')).toBe(false);
  });

  /* 계약에 하한이 없다 — 화면이 서버가 허용한 값을 막으면 안 된다. */
  it('음수 정렬 순서는 막지 않고 그대로 보낸다', async () => {
    const { requests, user } = await openCodeValueForm([updateRoute]);

    await user.clear(screen.getByLabelText('정렬 순서'));
    await user.type(screen.getByLabelText('정렬 순서'), '-5');
    await user.click(within(codeValueFormPane()).getByRole('button', { name: '저장' }));

    const put = await waitFor(() => {
      const found = requests.find((request) => request.method === 'PUT');
      expect(found).toBeDefined();
      return found as RecordedRequest;
    });

    expect(JSON.parse(put.body)).toMatchObject({ displayOrder: -5 });
  });

  /* C35 */
  it('유효 종료가 유효 시작보다 앞이면 두 칸 모두에 오류가 뜨고 요청이 나가지 않는다', async () => {
    const { requests, user } = await openCodeValueForm([updateRoute]);

    await user.clear(screen.getByLabelText('유효 종료'));
    await user.type(screen.getByLabelText('유효 종료'), '2026-01-01');
    await user.click(within(codeValueFormPane()).getByRole('button', { name: '저장' }));

    expect(
      await screen.findAllByText('유효 종료는 유효 시작과 같거나 그 뒤여야 합니다.'),
    ).toHaveLength(2);
    expect(requests.some((request) => request.method === 'PUT')).toBe(false);
  });

  it('유효기간이 한쪽만 있으면 막지 않는다', async () => {
    const { requests, user } = await openCodeValueForm([updateRoute]);

    await user.clear(screen.getByLabelText('유효 종료'));
    await user.click(within(codeValueFormPane()).getByRole('button', { name: '저장' }));

    const put = await waitFor(() => {
      const found = requests.find((request) => request.method === 'PUT');
      expect(found).toBeDefined();
      return found as RecordedRequest;
    });

    expect(JSON.parse(put.body)).toMatchObject({ effectiveTo: null });
  });

  /* C40 */
  it('저장에 성공하면 목록과 상세가 다시 조회된다', async () => {
    const { requests, user } = await openCodeValueForm([updateRoute]);
    const beforeList = codeValueRequests(requests).length;
    const beforeDetail = requestsTo(requests, `${CODE_VALUES_PATH}/2001`).length;

    await user.type(screen.getByLabelText('코드명'), 'X');
    await user.click(within(codeValueFormPane()).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(codeValueRequests(requests).length).toBeGreaterThan(beforeList);
      expect(requestsTo(requests, `${CODE_VALUES_PATH}/2001`).length).toBeGreaterThan(beforeDetail);
    });
  });

  it('409면 원인별 문구와 최신 불러오기가 나온다', async () => {
    const { user } = await openCodeValueForm([
      {
        match: (request) =>
          request.method === 'PUT' && new URL(request.url).pathname === `${CODE_VALUES_PATH}/2001`,
        respond: () => jsonResponse({ conflictCause: 'workerLease', message: '' }, { status: 409 }),
      },
    ]);

    await user.type(screen.getByLabelText('코드명'), 'X');
    await user.click(within(codeValueFormPane()).getByRole('button', { name: '저장' }));

    expect(
      await screen.findByText(
        '다른 작업에서 이 항목을 처리하는 중입니다. 잠시 뒤 최신 내용을 불러와 다시 저장하세요.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '최신 불러오기' })).toBeInTheDocument();
  });
});

describe('CommonCodeScreen — 코드값 등록 (C37·C38)', () => {
  const createdCodeValue = {
    codeValueId: 2009,
    codeGroupId: 1001,
    code: 'SYN-CV-09',
    codeName: '합성 코드값 I',
    displayOrder: 40,
    effectiveFrom: null,
    effectiveTo: null,
    isActive: true,
  };

  const createRoute: StubRoute = {
    match: (request) =>
      request.method === 'POST' && new URL(request.url).pathname === CODE_VALUES_PATH,
    respond: () => jsonResponse(createdCodeValue, { status: 201 }),
  };

  const createdDetailRoute: StubRoute = {
    match: (request) => isGet(request, `${CODE_VALUES_PATH}/2009`),
    respond: () =>
      jsonResponse(
        {
          codeValue: createdCodeValue,
          editability: { codeEditable: false, reason: 'NOT_COUNTABLE', referenceCount: null },
        },
        { headers: { ETag: 'W/"1"' } },
      ),
  };

  const codeValueFormPane = (): HTMLElement => screen.getByRole('region', { name: '코드값 정보' });

  /* C38 — 계약이 그룹 번호를 필수 쿼리로 두어 그룹 없이는 만들 자리 자체가 없다. */
  it('그룹을 고르지 않았으면 코드값 추가가 비활성이고 사유가 붙는다', async () => {
    renderScreen([codeGroupListRoute()]);
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    const button = within(codeValuePane()).getByRole('button', { name: '코드값 추가' });
    expect(button).toBeDisabled();

    const noteId = button.getAttribute('aria-describedby');
    expect(noteId).not.toBeNull();
    expect(document.getElementById(noteId as string)).toHaveTextContent(
      '코드값 추가는 좌측에서 코드그룹을 고른 뒤에 할 수 있습니다.',
    );
  });

  it('등록 저장이 POST로 나가고 본문에 고른 그룹 번호가 실리며 If-Match가 없다', async () => {
    const { requests, user } = renderScreen(
      [
        codeGroupListRoute(),
        codeGroupDetailRoute(),
        codeValueListRoute(),
        createRoute,
        createdDetailRoute,
      ],
      '?grp=1001',
    );
    await screen.findByRole('button', { name: 'SYN-CV-01' });

    await user.click(within(codeValuePane()).getByRole('button', { name: '코드값 추가' }));

    await user.type(await screen.findByLabelText('코드'), 'SYN-CV-09');
    await user.type(screen.getByLabelText('코드명'), '합성 코드값 I');
    await user.click(within(codeValueFormPane()).getByRole('button', { name: '코드값 추가' }));

    const post = await waitFor(() => {
      const found = requests.find((request) => request.method === 'POST');
      expect(found).toBeDefined();
      return found as RecordedRequest;
    });

    expect(post.url.pathname).toBe(CODE_VALUES_PATH);
    expect(post.headers.get('Idempotency-Key')).toMatch(UUID);
    expect(post.headers.has('If-Match')).toBe(false);
    expect(JSON.parse(post.body)).toMatchObject({ codeGroupId: 1001 });
  });

  /* C37 — 옮기지 않으면 사용자가 방금 만든 코드값을 직접 찾아야 한다. */
  it('등록에 성공하면 새 코드값으로 옮겨 가고 목록이 다시 조회된다', async () => {
    const { requests, user } = renderScreen(
      [
        codeGroupListRoute(),
        codeGroupDetailRoute(),
        codeValueListRoute(),
        createRoute,
        createdDetailRoute,
      ],
      '?grp=1001',
    );
    await screen.findByRole('button', { name: 'SYN-CV-01' });
    const beforeList = codeValueRequests(requests).length;

    await user.click(within(codeValuePane()).getByRole('button', { name: '코드값 추가' }));

    await user.type(await screen.findByLabelText('코드'), 'SYN-CV-09');
    await user.type(screen.getByLabelText('코드명'), '합성 코드값 I');
    await user.click(within(codeValueFormPane()).getByRole('button', { name: '코드값 추가' }));

    await waitFor(() => {
      expect(requestsTo(requests, `${CODE_VALUES_PATH}/2009`)).toHaveLength(1);
    });
    expect(codeValueRequests(requests).length).toBeGreaterThan(beforeList);
  });

  /* 등록 폼이 열려 있는 동안 고른 코드값의 상세가 함께 보이면 어느 쪽을 고치는지 가릴 수 없다. */
  it('등록 폼을 열면 고른 코드값의 상세를 조회하지 않는다', async () => {
    const { requests, user } = renderScreen(
      [
        codeGroupListRoute(),
        codeGroupDetailRoute(),
        codeValueListRoute(),
        {
          match: (request) => isGet(request, `${CODE_VALUES_PATH}/2001`),
          respond: () =>
            jsonResponse(
              {
                codeValue: codeValueFixtures[0],
                editability: { codeEditable: false, reason: 'NOT_COUNTABLE', referenceCount: null },
              },
              { headers: { ETag: 'W/"3"' } },
            ),
        },
      ],
      '?grp=1001&val=2001',
    );
    await screen.findByLabelText('코드명');
    const before = requestsTo(requests, `${CODE_VALUES_PATH}/2001`).length;

    await user.click(within(codeValuePane()).getByRole('button', { name: '코드값 추가' }));

    expect(screen.getByLabelText('코드')).toHaveValue('');
    expect(requestsTo(requests, `${CODE_VALUES_PATH}/2001`)).toHaveLength(before);
  });
});

describe('CommonCodeScreen — 코드값 사용 중지 (C39)', () => {
  const detailRoute: StubRoute = {
    match: (request) => isGet(request, `${CODE_VALUES_PATH}/2001`),
    respond: () =>
      jsonResponse(
        {
          codeValue: codeValueFixtures[0],
          editability: { codeEditable: false, reason: 'NOT_COUNTABLE', referenceCount: null },
        },
        { headers: { ETag: 'W/"3"' } },
      ),
  };

  const deactivateRoute: StubRoute = {
    match: (request) =>
      request.method === 'POST' &&
      new URL(request.url).pathname === `${CODE_VALUES_PATH}/2001:deactivate`,
    respond: () => jsonResponse({ ...codeValueFixtures[0], isActive: false }),
  };

  const openForm = async (routes: StubRoute[] = [deactivateRoute]) => {
    const rendered = renderScreen(
      [codeGroupListRoute(), codeGroupDetailRoute(), codeValueListRoute(), detailRoute, ...routes],
      '?grp=1001&val=2001',
    );
    await screen.findByLabelText('코드명');

    return rendered;
  };

  const codeValueFormPane = (): HTMLElement => screen.getByRole('region', { name: '코드값 정보' });

  /*
   * 계약 서술은 「확인 다이얼로그 없이」이지만 그 이유가 「참조 건수를 셀 수 없어」다 —
   * 못 보여 주는 것은 건수이지 확인 절차가 아니다. 되돌리는 경로가 없는 조작이라 확인을 둔다.
   */
  it('사용 중지를 누르면 확인 창이 열리고 확인 전에는 요청이 나가지 않는다', async () => {
    const { requests, user } = await openForm();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(within(codeValueFormPane()).getByRole('button', { name: '사용 중지' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'POST')).toBe(false);
  });

  it('확인하면 :deactivate로 나가고 멱등 키와 If-Match가 둘 다 실린다', async () => {
    const { requests, user } = await openForm();

    await user.click(within(codeValueFormPane()).getByRole('button', { name: '사용 중지' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '사용 중지' }));

    const post = await waitFor(() => {
      const found = requests.find((request) => request.method === 'POST');
      expect(found).toBeDefined();
      return found as RecordedRequest;
    });

    expect(post.url.pathname).toBe(`${CODE_VALUES_PATH}/2001:deactivate`);
    expect(post.headers.get('Idempotency-Key')).toMatch(UUID);
    expect(post.headers.get('If-Match')).toBe('W/"3"');
  });

  it('확인 창에 참조 건수를 내지 않는다', async () => {
    const { user } = await openForm();

    await user.click(within(codeValueFormPane()).getByRole('button', { name: '사용 중지' }));

    expect(screen.getByRole('dialog').textContent).not.toMatch(/\d+\s*건/);
  });

  it('중지에 성공하면 목록과 상세가 다시 조회된다', async () => {
    const { requests, user } = await openForm();
    const beforeList = codeValueRequests(requests).length;
    const beforeDetail = requestsTo(requests, `${CODE_VALUES_PATH}/2001`).length;

    await user.click(within(codeValueFormPane()).getByRole('button', { name: '사용 중지' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '사용 중지' }));

    await waitFor(() => {
      expect(codeValueRequests(requests).length).toBeGreaterThan(beforeList);
      expect(requestsTo(requests, `${CODE_VALUES_PATH}/2001`).length).toBeGreaterThan(beforeDetail);
    });
  });

  it('중지에 실패해도 확인 창이 닫히지 않는다', async () => {
    const { user } = await openForm([
      {
        match: (request) =>
          request.method === 'POST' &&
          new URL(request.url).pathname === `${CODE_VALUES_PATH}/2001:deactivate`,
        respond: () => jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 }),
      },
    ]);

    await user.click(within(codeValueFormPane()).getByRole('button', { name: '사용 중지' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '사용 중지' }));

    expect(
      await within(screen.getByRole('dialog')).findByText(
        '다른 사용자가 먼저 저장했습니다. 최신 내용을 불러온 뒤 다시 저장하세요.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('CommonCodeScreen — 주소만으로 등록 폼이 살아난다 (리뷰 Major ①)', () => {
  const createdCodeValue = {
    codeValueId: 2009,
    codeGroupId: 1001,
    code: 'SYN-CV-09',
    codeName: '합성 코드값 I',
    displayOrder: 40,
    effectiveFrom: null,
    effectiveTo: null,
    isActive: true,
  };

  /*
   * 등록 폼의 여닫음을 주소가 소유한다고 정했으면 **주소만 있어도 폼이 서야 한다.**
   * 폼 값이 로컬 상태에만 있으면 새로고침·공유·북마크·뒤로가기로 들어온 사용자는
   * 빈 화면을 보고, 「그룹 추가」도 이미 열린 것으로 보여 비활성이라 되돌릴 길이 없다.
   */
  it('?new=group으로 직접 들어와도 코드그룹 등록 폼이 뜬다', async () => {
    renderScreen([codeGroupListRoute()], '?new=group');

    expect(await screen.findByRole('region', { name: '코드그룹 정보' })).toBeInTheDocument();
    expect(screen.getByLabelText('그룹코드')).toHaveValue('');
    expect(
      within(screen.getByRole('region', { name: '코드그룹 정보' })).getByRole('button', {
        name: '그룹 추가',
      }),
    ).toBeInTheDocument();
  });

  it('?grp=1001&new=value로 직접 들어와도 코드값 등록 폼이 뜬다', async () => {
    renderScreen(
      [codeGroupListRoute(), codeGroupDetailRoute(), codeValueListRoute()],
      '?grp=1001&new=value',
    );

    expect(await screen.findByRole('region', { name: '코드값 정보' })).toBeInTheDocument();
    expect(screen.getByLabelText('코드')).toHaveValue('');
    expect(
      within(screen.getByRole('region', { name: '코드값 정보' })).getByRole('button', {
        name: '코드값 추가',
      }),
    ).toBeInTheDocument();
  });

  /* 그룹이 없으면 만들 자리 자체가 없다 — 주소만으로 그룹 없는 등록 폼이 서면 안 된다. */
  it('?new=value만 있고 그룹이 없으면 등록 폼을 세우지 않는다', async () => {
    renderScreen([codeGroupListRoute()], '?new=value');
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    expect(screen.queryByLabelText('코드')).not.toBeInTheDocument();
    expect(
      within(codeValuePane()).getByText('좌측에서 코드그룹을 먼저 고르세요'),
    ).toBeInTheDocument();
  });

  it('직접 들어온 등록 폼에서 그대로 저장할 수 있다', async () => {
    const { requests, user } = renderScreen(
      [
        codeGroupListRoute(),
        codeGroupDetailRoute(),
        codeValueListRoute(),
        {
          match: (request) =>
            request.method === 'POST' && new URL(request.url).pathname === CODE_VALUES_PATH,
          respond: () => jsonResponse(createdCodeValue, { status: 201 }),
        },
        {
          match: (request) => isGet(request, `${CODE_VALUES_PATH}/2009`),
          respond: () =>
            jsonResponse(
              {
                codeValue: createdCodeValue,
                editability: { codeEditable: false, reason: 'NOT_COUNTABLE', referenceCount: null },
              },
              { headers: { ETag: 'W/"1"' } },
            ),
        },
      ],
      '?grp=1001&new=value',
    );

    await user.type(await screen.findByLabelText('코드'), 'SYN-CV-09');
    await user.type(screen.getByLabelText('코드명'), '합성 코드값 I');
    await user.click(
      within(screen.getByRole('region', { name: '코드값 정보' })).getByRole('button', {
        name: '코드값 추가',
      }),
    );

    await waitFor(() => {
      expect(requests.some((request) => request.method === 'POST')).toBe(true);
    });
  });
});

describe('CommonCodeScreen — 한 조작은 히스토리 한 칸이다 (리뷰 Major ②)', () => {
  it('코드값 추가를 누른 뒤 뒤로가기 한 번이면 직전 주소로 돌아간다', async () => {
    const { history, user } = renderScreen(
      [codeGroupListRoute(), codeGroupDetailRoute(), codeValueListRoute(), codeValueDetailRoute()],
      '?grp=1001&val=2001',
    );
    await screen.findByLabelText('코드명');

    const before = history.search();
    await user.click(within(codeValuePane()).getByRole('button', { name: '코드값 추가' }));
    await screen.findByRole('region', { name: '코드값 정보' });

    history.back();
    expect(history.search()).toBe(before);
  });

  it('코드값 행을 고른 뒤 뒤로가기 한 번이면 직전 주소로 돌아간다', async () => {
    const { history, user } = renderScreen(
      [codeGroupListRoute(), codeGroupDetailRoute(), codeValueListRoute(), codeValueDetailRoute()],
      '?grp=1001',
    );
    await screen.findByRole('button', { name: 'SYN-CV-01' });

    const before = history.search();
    await user.click(screen.getByRole('button', { name: 'SYN-CV-01' }));

    history.back();
    expect(history.search()).toBe(before);
  });

  it('코드값 미사용 포함을 켠 뒤 뒤로가기 한 번이면 직전 주소로 돌아간다', async () => {
    const { history, user } = renderScreen(
      [codeGroupListRoute(), codeGroupDetailRoute(), codeValueListRoute(), codeValueDetailRoute()],
      '?grp=1001&val=2001',
    );
    await screen.findByLabelText('코드명');

    const before = history.search();
    await user.click(within(codeValuePane()).getByRole('checkbox', { name: '미사용 포함' }));

    history.back();
    expect(history.search()).toBe(before);
  });

  it('코드값 쪽을 옮긴 뒤 뒤로가기 한 번이면 직전 주소로 돌아간다', async () => {
    const { history, user } = renderScreen(
      [
        codeGroupListRoute(),
        codeGroupDetailRoute(),
        codeValueListRoute(codeValueFixtures, { page: 1, size: 2, total: 10 }),
        codeValueDetailRoute(),
      ],
      '?grp=1001&val=2001',
    );
    await screen.findByLabelText('코드명');

    const before = history.search();
    await user.click(within(codeValuePane()).getByRole('button', { name: '다음' }));

    history.back();
    expect(history.search()).toBe(before);
  });

  it('그룹 추가를 누른 뒤 뒤로가기 한 번이면 직전 주소로 돌아간다', async () => {
    const { history, user } = renderScreen(
      [codeGroupListRoute(), codeGroupDetailRoute(), codeValueListRoute()],
      '?grp=1001',
    );
    await screen.findByRole('region', { name: '코드그룹 정보' });

    const before = history.search();

    await user.click(within(codeGroupPane()).getByRole('button', { name: '그룹 추가' }));
    await screen.findByLabelText('그룹코드');

    history.back();
    expect(history.search()).toBe(before);
  });

  /* 같은 값을 다시 쓰면 주소가 달라지지 않는다 — 달라지지 않는 갱신은 칸만 늘린다. */
  it('이미 고른 코드값을 다시 눌러도 히스토리가 늘지 않는다', async () => {
    const { history, user } = renderScreen(
      [codeGroupListRoute(), codeGroupDetailRoute(), codeValueListRoute(), codeValueDetailRoute()],
      '?grp=1001&val=2001',
    );
    await screen.findByLabelText('코드명');

    const entriesBefore = history.entries();

    await user.click(screen.getByRole('button', { name: 'SYN-CV-01' }));

    // 주소가 달라지지 않는 갱신은 칸만 늘린다 — 아예 갱신하지 않는다.
    expect(history.entries()).toBe(entriesBefore);
  });

  /*
   * 등록 성공은 Major ②의 증상이 났던 **두 번째 자리**다 — 「등록을 끈다」와 「새 번호를 고른다」를
   * 나눠 부르면 뒤로가기가 고른 값이 사라진 주소로 떨어진다. 폼을 여는 자리만 덮고 이쪽을 비워 두면
   * 나중에 다시 둘로 나눠도 아무 테스트가 실패하지 않는다.
   */
  it('코드값 등록에 성공한 뒤 뒤로가기 한 번이면 직전 주소로 돌아간다', async () => {
    const made = {
      codeValueId: 2009,
      codeGroupId: 1001,
      code: 'SYN-CV-09',
      codeName: '합성 코드값 I',
      displayOrder: 40,
      effectiveFrom: null,
      effectiveTo: null,
      isActive: true,
    };

    const { history, user } = renderScreen(
      [
        codeGroupListRoute(),
        codeGroupDetailRoute(),
        codeValueListRoute(),
        {
          match: (r) => r.method === 'POST' && new URL(r.url).pathname === CODE_VALUES_PATH,
          respond: () => jsonResponse(made, { status: 201 }),
        },
        {
          match: (r) => isGet(r, `${CODE_VALUES_PATH}/2009`),
          respond: () =>
            jsonResponse(
              {
                codeValue: made,
                editability: { codeEditable: false, reason: 'NOT_COUNTABLE', referenceCount: null },
              },
              { headers: { ETag: 'W/"1"' } },
            ),
        },
      ],
      '?grp=1001&new=value',
    );

    await user.type(await screen.findByLabelText('코드'), 'SYN-CV-09');
    await user.type(screen.getByLabelText('코드명'), '합성 코드값 I');

    const before = history.search();

    await user.click(
      within(screen.getByRole('region', { name: '코드값 정보' })).getByRole('button', {
        name: '코드값 추가',
      }),
    );
    await screen.findByDisplayValue('SYN-CV-09');

    history.back();
    expect(history.search()).toBe(before);
  });

  /* 코드그룹 등록 성공도 같은 자리다 — 한쪽만 덮으면 그물이 반만 남는다. */
  it('코드그룹 등록에 성공한 뒤 뒤로가기 한 번이면 직전 주소로 돌아간다', async () => {
    const made = {
      codeGroupId: 1009,
      groupCode: 'SYN-GRP-09',
      groupName: '합성 코드그룹 I',
      description: null,
      isActive: true,
    };

    const { history, user } = renderScreen(
      [
        codeGroupListRoute(),
        {
          match: (r) => r.method === 'POST' && new URL(r.url).pathname === CODE_GROUPS_PATH,
          respond: () => jsonResponse(made, { status: 201 }),
        },
        {
          match: (r) => isGet(r, `${CODE_GROUPS_PATH}/1009`),
          respond: () =>
            jsonResponse(
              {
                codeGroup: made,
                editability: { codeEditable: true, reason: 'EDITABLE', referenceCount: 0 },
              },
              { headers: { ETag: 'W/"1"' } },
            ),
        },
        codeValueListRoute(),
      ],
      '?new=group',
    );

    await user.type(await screen.findByLabelText('그룹코드'), 'SYN-GRP-09');
    await user.type(screen.getByLabelText('그룹명'), '합성 코드그룹 I');

    const before = history.search();

    await user.click(
      within(screen.getByRole('region', { name: '코드그룹 정보' })).getByRole('button', {
        name: '그룹 추가',
      }),
    );
    await screen.findByDisplayValue('SYN-GRP-09');

    history.back();
    expect(history.search()).toBe(before);
  });
});
