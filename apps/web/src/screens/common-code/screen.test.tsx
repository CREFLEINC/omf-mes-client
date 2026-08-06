import type { components } from '@omf-mes/api-client';
import { act, screen, waitFor, within } from '@testing-library/react';
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

type Editability = components['schemas']['Editability'];

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

const renderScreen = (routes: StubRoute[], search = '') => {
  const { fetch, requests } = createRecordingFetch(routes);

  const { queryClient } = renderWithProviders(<CommonCodeScreen />, {
    fetch,
    route: `${ROUTE}${search}`,
  });

  return { requests, queryClient, user: userEvent.setup() };
};

const requestsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === pathname);

const codeGroupRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requestsTo(requests, CODE_GROUPS_PATH);

const codeGroupPane = (): HTMLElement => screen.getByRole('region', { name: '코드그룹' });

const codeGroupFormPane = (): HTMLElement => screen.getByRole('region', { name: '코드그룹 정보' });

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
    expect(await screen.findByText('좌측에서 코드그룹을 먼저 고르세요')).toBeInTheDocument();
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
    expect(await screen.findByText('좌측에서 코드그룹을 먼저 고르세요')).toBeInTheDocument();
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

    expect(await screen.findByText('좌측에서 코드그룹을 먼저 고르세요')).toBeInTheDocument();
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
