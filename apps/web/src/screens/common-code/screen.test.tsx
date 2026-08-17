import type { ConflictCause, components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
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
import { pickDate } from '../../test/date-picker';
import {
  codeGroupFixtures,
  codeValueFixtures,
  departmentFixtures,
  partnerFixtures,
  partnerRoleFixtures,
  workerFixtures,
} from './fixtures';
import type { PartnerRoleRow } from './partner-role-draft';
/* 코드 글자를 시험이 다시 적지 않는다(결정 2) — 리터럴은 어휘 고정 감지기 한 자리에만 둔다. */
import { PARTNER_ROLE_CODES } from './partner-role-vocab';
import { CommonCodeScreen } from './screen';
import type { Partner } from './types';

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

const DEPARTMENTS_PATH = '/mdm/departments';
const BUSINESS_UNITS_PATH = '/mdm/business-units';

/**
 * 부서 목록. 좌 목록 조회와 상위 선택지 조회가 **같은 경로**를 쓴다 —
 * 선택지 조회는 `includeInactive=true`를 늘 싣고 그 밖의 조건을 싣지 않는다.
 */
const isDepartmentOptionsRequest = (request: Request): boolean => {
  const url = new URL(request.url);

  return (
    url.searchParams.get('includeInactive') === 'true' &&
    !url.searchParams.has('q') &&
    !url.searchParams.has('businessUnitId') &&
    !url.searchParams.has('page')
  );
};

const departmentListRoute = (
  items = departmentFixtures,
  pageMeta: PageStub = { page: 1, size: 50, total: departmentFixtures.length },
): StubRoute => ({
  match: (request) => isGet(request, DEPARTMENTS_PATH) && !isDepartmentOptionsRequest(request),
  respond: () => jsonResponse({ items, page: pageMeta }),
});

const businessUnitFixtures = [
  {
    businessUnitId: 4001,
    legalEntityId: 5001,
    businessUnitCode: 'SYN-BU-01',
    businessUnitName: '합성 사업부 A',
    isActive: true,
  },
];

const businessUnitsRoute = (
  items: unknown[] = businessUnitFixtures,
  pageMeta: PageStub = { page: 1, size: 50, total: businessUnitFixtures.length },
): StubRoute => ({
  match: (request) => isGet(request, BUSINESS_UNITS_PATH),
  respond: () => jsonResponse({ items, page: pageMeta }),
});

/** 상위 선택지 조회. 좌 목록과 **경로가 같고 쿼리가 다르다**. */
const departmentOptionsRoute = (
  items = departmentFixtures,
  pageMeta: PageStub = { page: 1, size: 50, total: departmentFixtures.length },
): StubRoute => ({
  match: (request) => isGet(request, DEPARTMENTS_PATH) && isDepartmentOptionsRequest(request),
  respond: () => jsonResponse({ items, page: pageMeta }),
});

/** 부서 상세 — `ETag`가 함께 온다(계약 실측). 저장의 `If-Match`가 이 값에서 나온다. */
const departmentDetailRoute = (
  departmentId = 3001,
  editability: Editability = { codeEditable: true, reason: 'EDITABLE', referenceCount: 0 },
): StubRoute => ({
  match: (request) => isGet(request, `${DEPARTMENTS_PATH}/${String(departmentId)}`),
  respond: () =>
    jsonResponse(
      {
        department: departmentFixtures.find((row) => row.departmentId === departmentId),
        editability,
      },
      { headers: { ETag: 'W/"5"' } },
    ),
});

const departmentRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requestsTo(requests, DEPARTMENTS_PATH);

const departmentPane = (): HTMLElement => screen.getByRole('region', { name: '부서' });

const departmentFormPane = (): HTMLElement => screen.getByRole('region', { name: '부서 정보' });

/** 조직 탭의 기본 스텁 묶음. 탭이 열리면 부서 목록과 사업부 선택지가 함께 필요하다. */
const orgRoutes = (): StubRoute[] => [departmentListRoute(), businessUnitsRoute()];

/**
 * 끝나지 않는 응답. 본문 스트림을 열어 두면 요청은 **보내진 채로** 남는다 —
 * 「나가는 중」이라는 순간을 시험이 붙잡는 유일한 방법이다.
 */
const neverFinishingResponse = (): Response =>
  new Response(new ReadableStream({ start: () => undefined }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * 시험이 도착 시점을 정하는 응답. 본문 스트림을 열어 둔 채 돌려주고 `release`로 닫는다 —
 * **응답이 도착하기 전에 다른 거래처로 옮기는** 경로를 재려면 그 사이가 필요하다.
 */
const deferredJsonResponse = (
  status: number,
): { response: Response; release: (body: unknown) => void } => {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  const response = new Response(
    new ReadableStream<Uint8Array>({
      start: (source) => {
        controller = source;
      },
    }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );

  return {
    response,
    release: (body) => {
      controller?.enqueue(new TextEncoder().encode(JSON.stringify(body)));
      controller?.close();
    },
  };
};

/** 부서를 고른 뒤에 필요한 스텁까지 포함한 묶음. */
const orgDetailRoutes = (
  editability: Editability = { codeEditable: true, reason: 'EDITABLE', referenceCount: 0 },
): StubRoute[] => [
  departmentListRoute(),
  businessUnitsRoute(),
  departmentOptionsRoute(),
  departmentDetailRoute(3001, editability),
];

describe('CommonCodeScreen — 탭', () => {
  /* C2 — 만든 탭만 렌더한다. 자리만 먼저 두면 「눌러도 빈 화면인」 탭이 생긴다. */
  it('탭 묶음에 만든 탭만 렌더되고 첫 탭이 활성이다', async () => {
    renderScreen([codeGroupListRoute()]);
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    const tablist = screen.getByRole('tablist', { name: '공통코드·조직·작업자' });
    const tabs = within(tablist).getAllByRole('tab');

    expect(tabs.map((element) => element.textContent)).toEqual([
      '공통코드',
      '조직(부서)',
      '작업자',
      '거래처 역할',
    ]);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
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

  const openCodeValueForm = async (routes: StubRoute[] = [], codeValueId = 2001) => {
    const rendered = renderScreen(
      [
        codeGroupListRoute(),
        codeGroupDetailRoute(),
        codeValueListRoute(),
        codeValueDetailRoute(codeValueId),
        ...routes,
      ],
      `?grp=1001&val=${String(codeValueId)}`,
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
    expect(screen.getByLabelText('유효 시작')).toHaveTextContent('2026-07-01');
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

    await pickDate(user, screen.getByLabelText('유효 종료'), '2026-01-01');
    await user.click(within(codeValueFormPane()).getByRole('button', { name: '저장' }));

    expect(
      await screen.findAllByText('유효 종료는 유효 시작과 같거나 그 뒤여야 합니다.'),
    ).toHaveLength(2);
    expect(requests.some((request) => request.method === 'PUT')).toBe(false);
  });

  /*
   * **유효 종료가 비어 있는 줄(2003)을 연다.** 예전에는 채워진 칸을 비워서 이 상태를 만들었지만
   * `DatePicker`에는 고른 날짜를 다시 비우는 수단이 없다(0.2.0 실측 · 통지 #63에 물어 둔 사항).
   * 사용자가 닿을 수 있는 길로 같은 것을 잰다 — 비어 있는 채로 저장하면 널이 그대로 나가는가.
   */
  it('유효기간이 한쪽만 있으면 막지 않는다', async () => {
    const { requests, user } = await openCodeValueForm([updateRoute], 2003);

    // 저장은 고친 것이 있어야 열린다 — 유효기간과 무관한 칸을 건드려 연다.
    await user.type(screen.getByLabelText('코드명'), 'X');
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

describe('CommonCodeScreen — 부서 목록 조회 (C41·C45·C47)', () => {
  /* C41 — 조직 탭에 들어오면 부서 목록이 한 번만 나가고 조건이 없으면 쿼리도 없다. */
  it('조직 탭에 들어오면 부서 목록 요청이 한 번 나간다', async () => {
    const { requests } = renderScreen(orgRoutes(), '?tab=org');

    expect(await screen.findByRole('button', { name: 'SYN-DEPT-01' })).toBeInTheDocument();

    const sent = departmentRequests(requests);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url.search).toBe('');
  });

  /* 다른 탭의 목록을 함께 받아 두지 않는다 — 보이지 않는 목록을 조회할 이유가 없다. */
  it('조직 탭에서는 코드그룹 목록을 조회하지 않는다', async () => {
    const { requests } = renderScreen(orgRoutes(), '?tab=org');
    await screen.findByRole('button', { name: 'SYN-DEPT-01' });

    expect(codeGroupRequests(requests)).toHaveLength(0);
  });

  /* C41 — 빈 값·꺼진 확인칸은 쿼리에 싣지 않는다. */
  it('걸린 조건만 요청 쿼리에 실린다', async () => {
    const { requests } = renderScreen(orgRoutes(), '?tab=org&q=SYN&bu=4001&inactive=1');
    await screen.findByRole('button', { name: 'SYN-DEPT-01' });

    const sent = departmentRequests(requests)[0];
    expect(sent?.url.searchParams.get('q')).toBe('SYN');
    expect(sent?.url.searchParams.get('businessUnitId')).toBe('4001');
    expect(sent?.url.searchParams.get('includeInactive')).toBe('true');
  });

  it('미사용 포함이 꺼져 있으면 그 키를 보내지 않는다', async () => {
    const { requests } = renderScreen(orgRoutes(), '?tab=org&q=SYN');
    await screen.findByRole('button', { name: 'SYN-DEPT-01' });

    const sent = departmentRequests(requests)[0];
    expect(sent?.url.searchParams.has('includeInactive')).toBe(false);
    expect(sent?.url.searchParams.has('businessUnitId')).toBe(false);
  });

  /* C45 — 선택 목록이 실제 조회로 채워진다. 지어내지 않는다. */
  it('사업부 선택지를 조회해 필터에 채운다', async () => {
    const { requests } = renderScreen(orgRoutes(), '?tab=org');
    await screen.findByRole('button', { name: 'SYN-DEPT-01' });

    expect(requestsTo(requests, BUSINESS_UNITS_PATH)).toHaveLength(1);
    expect(screen.getByLabelText('사업부')).toBeInTheDocument();
  });

  /* C45 — 잘림을 감추면 사용자는 찾는 값이 왜 없는지 알 수 없다. */
  it('사업부 선택지가 잘리면 그 사실을 목록 위에 알린다', async () => {
    renderScreen(
      [
        departmentListRoute(),
        businessUnitsRoute(businessUnitFixtures, { page: 1, size: 1, total: 9 }),
      ],
      '?tab=org',
    );

    expect(
      await screen.findByText(
        '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
      ),
    ).toBeInTheDocument();
  });

  it('사업부 선택지 조회가 실패하면 그 사실을 목록 위에 알린다', async () => {
    renderScreen(
      [
        departmentListRoute(),
        {
          match: (request) => isGet(request, BUSINESS_UNITS_PATH),
          respond: () => jsonResponse({ message: '' }, { status: 500 }),
        },
      ],
      '?tab=org',
    );

    expect(
      await screen.findByText('선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.'),
    ).toBeInTheDocument();
  });

  /* C47 — 빈 상태와 실패가 함께 나오지 않는다. */
  it('0건이면 빈 상태를 내고 조건이 걸린 0건과 갈린다', async () => {
    renderScreen(
      [departmentListRoute([], { page: 1, size: 50, total: 0 }), businessUnitsRoute()],
      '?tab=org',
    );

    expect(await screen.findByText('등록된 부서가 없습니다')).toBeInTheDocument();
    expect(screen.queryByText('조건에 맞는 부서가 없습니다')).not.toBeInTheDocument();
  });

  it('조건이 걸린 0건이면 조건을 줄이라는 안내가 나온다', async () => {
    renderScreen(
      [departmentListRoute([], { page: 1, size: 50, total: 0 }), businessUnitsRoute()],
      '?tab=org&q=SYN',
    );

    expect(await screen.findByText('조건에 맞는 부서가 없습니다')).toBeInTheDocument();
    expect(screen.queryByText('등록된 부서가 없습니다')).not.toBeInTheDocument();
  });

  it('부서 목록 조회에 실패하면 배너를 내고 빈 상태를 함께 내지 않는다', async () => {
    renderScreen(
      [
        {
          match: (request) => isGet(request, DEPARTMENTS_PATH),
          respond: () => jsonResponse({ message: '' }, { status: 500 }),
        },
        businessUnitsRoute(),
      ],
      '?tab=org',
    );

    expect(await screen.findByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('등록된 부서가 없습니다')).not.toBeInTheDocument();
  });

  it('부서 목록이 403이면 권한 안내를 낸다', async () => {
    renderScreen(
      [
        {
          match: (request) => isGet(request, DEPARTMENTS_PATH),
          respond: () => jsonResponse({ message: '' }, { status: 403 }),
        },
        businessUnitsRoute(),
      ],
      '?tab=org',
    );

    expect(
      await screen.findByText(
        '이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.',
      ),
    ).toBeInTheDocument();
  });
});

describe('CommonCodeScreen — 부서 계층 표시 (C42·C43·C44)', () => {
  /*
   * C42 — **목 서버가 실제로 자기참조 행을 준다.** 접지 않으면 「합성 부서 A」가
   * 자기 그룹의 하위 행으로도 나타나 대표와 하위가 같아진다.
   */
  it('자기 자신을 상위로 가리키는 행이 뿌리로 접혀 그룹 대표가 된다', async () => {
    renderScreen(orgRoutes(), '?tab=org');
    await screen.findByRole('button', { name: 'SYN-DEPT-01' });

    expect(screen.getByText('SYN-DEPT-01 · 합성 부서 A')).toBeInTheDocument();
    expect(screen.getByText('SYN-DEPT-03 · 합성 부서 C')).toBeInTheDocument();
  });

  /* C43 — 상위가 이 쪽에 없는 행은 고아 그룹에 모이고 머리글이 비지 않는다. */
  it('상위를 이 쪽에서 찾을 수 없는 행은 고아 그룹으로 간다', async () => {
    renderScreen(
      [
        departmentListRoute([
          departmentFixtures[0]!,
          {
            departmentId: 3009,
            departmentCode: 'SYN-DEPT-09',
            departmentName: '합성 부서 I',
            parentDepartmentId: 9999,
            businessUnitId: null,
            isActive: true,
          },
        ]),
        businessUnitsRoute(),
      ],
      '?tab=org',
    );

    expect(await screen.findByText('상위 부서가 이 쪽에 없음')).toBeInTheDocument();
  });

  /* C44 — 3단 이상이면 그 사실을 밝히고 계층을 다시 계산하지 않는다. */
  it('3단 이상 계층이 있으면 목록 위에 안내가 뜬다', async () => {
    renderScreen(
      [
        departmentListRoute([
          departmentFixtures[0]!,
          departmentFixtures[1]!,
          {
            departmentId: 3006,
            departmentCode: 'SYN-DEPT-06',
            departmentName: '합성 부서 F',
            parentDepartmentId: 3002,
            businessUnitId: null,
            isActive: true,
          },
        ]),
        businessUnitsRoute(),
      ],
      '?tab=org',
    );

    expect(await screen.findByText(/3단 이상 계층이 있습니다/)).toBeInTheDocument();
  });

  it('2단까지면 3단 안내가 뜨지 않는다', async () => {
    renderScreen(orgRoutes(), '?tab=org');
    await screen.findByRole('button', { name: 'SYN-DEPT-01' });

    expect(screen.queryByText(/3단 이상 계층이 있습니다/)).not.toBeInTheDocument();
  });
});

describe('CommonCodeScreen — 부서 조건과 선택 (C46)', () => {
  it('부서코드를 누르면 주소에 dep가 붙고 그 행에 선택 표식이 선다', async () => {
    const { history, user } = renderScreen(orgRoutes(), '?tab=org');
    await screen.findByRole('button', { name: 'SYN-DEPT-01' });

    await user.click(screen.getByRole('button', { name: 'SYN-DEPT-02' }));

    expect(history.search()).toBe('?tab=org&dep=3002');
    expect(screen.getByRole('button', { name: 'SYN-DEPT-02' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  /* 보이는 행이 달라지면 선택을 비운다 — 목록에 없는 부서의 폼이 우 칸에 남으면 안 된다. */
  it('조건을 바꾸면 주소에서 dep와 new가 사라진다', async () => {
    const { history, user } = renderScreen(orgRoutes(), '?tab=org&dep=3002&new=dept&page=3');
    await screen.findByRole('button', { name: 'SYN-DEPT-01' });

    await user.type(screen.getByLabelText('부서 검색'), 'SYN');
    await user.click(within(departmentPane()).getByRole('button', { name: '조회' }));

    expect(history.search()).toBe('?tab=org&q=SYN');
  });

  it('쪽을 옮기면 주소에서 dep와 new가 사라진다', async () => {
    const { history, user } = renderScreen(
      [
        departmentListRoute(departmentFixtures, { page: 1, size: 2, total: 9 }),
        businessUnitsRoute(),
      ],
      '?tab=org&dep=3002&new=dept',
    );
    await screen.findByRole('button', { name: 'SYN-DEPT-01' });

    await user.click(within(departmentPane()).getByRole('button', { name: '다음' }));

    expect(history.search()).toBe('?tab=org&page=2');
  });

  /* 이상한 선택 번호는 고르지 않은 것으로 본다 — 주소는 손으로 고쳐지는 자리다. */
  it('선택 번호가 0이면 아무 행도 고르지 않은 것으로 본다', async () => {
    renderScreen(orgRoutes(), '?tab=org&dep=0');
    await screen.findByRole('button', { name: 'SYN-DEPT-01' });

    for (const code of ['SYN-DEPT-01', 'SYN-DEPT-02', 'SYN-DEPT-03']) {
      expect(screen.getByRole('button', { name: code })).not.toHaveAttribute('aria-current');
    }
  });

  /* 한 조작은 히스토리 한 칸이다 — 뒤로가기가 사용자가 본 적 없는 주소로 떨어지면 안 된다. */
  it('부서를 고른 뒤 뒤로가기 한 번이면 직전 주소로 돌아간다', async () => {
    const { history, user } = renderScreen(orgRoutes(), '?tab=org&new=dept');
    await screen.findByRole('button', { name: 'SYN-DEPT-01' });

    const before = history.search();

    await user.click(screen.getByRole('button', { name: 'SYN-DEPT-02' }));
    expect(history.search()).toBe('?tab=org&dep=3002');

    history.back();
    expect(history.search()).toBe(before);
  });

  it('부서 추가를 누른 뒤 뒤로가기 한 번이면 직전 주소로 돌아간다', async () => {
    const { history, user } = renderScreen(orgRoutes(), '?tab=org&dep=3002');
    await screen.findByRole('button', { name: 'SYN-DEPT-01' });

    const before = history.search();

    await user.click(within(departmentPane()).getByRole('button', { name: '부서 추가' }));
    expect(history.search()).toBe('?tab=org&new=dept');

    history.back();
    expect(history.search()).toBe(before);
  });
});

describe('CommonCodeScreen — 탭 전환 (C13)', () => {
  /*
   * C13 · 뮤테이션 33 — 탭마다 목록이 통째로 다르다. 검색어를 넘기면
   * 「부서를 찾던 말」로 코드그룹을 조회한 결과가 나오고, 선택 번호를 넘기면
   * 그 탭에 없는 자원의 상세를 조회하게 된다.
   */
  it('조직 탭으로 바꾸면 이전 탭의 조건·선택이 주소에서 모두 사라진다', async () => {
    const { history, user } = renderScreen(
      [codeGroupListRoute(), codeGroupDetailRoute(), codeValueListRoute(), ...orgRoutes()],
      '?q=SYN&inactive=1&page=2&grp=1001&val=2001&vpage=3&vinactive=1',
    );
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    await user.click(screen.getByRole('tab', { name: '조직(부서)' }));

    expect(history.search()).toBe('?tab=org');
    expect(await screen.findByRole('button', { name: 'SYN-DEPT-01' })).toBeInTheDocument();
  });

  it('공통코드 탭으로 되돌아가면 조직 탭의 조건·선택이 사라진다', async () => {
    const { history, user } = renderScreen(
      [codeGroupListRoute(), ...orgRoutes()],
      '?tab=org&q=SYN&bu=4001&inactive=1&page=2&dep=3002',
    );
    await screen.findByRole('button', { name: 'SYN-DEPT-01' });

    await user.click(screen.getByRole('tab', { name: '공통코드' }));

    expect(history.search()).toBe('?tab=code');
    expect(await screen.findByRole('button', { name: 'SYN-GRP-01' })).toBeInTheDocument();
  });

  /* 탭 전환도 한 조작이다. */
  it('탭을 바꾼 뒤 뒤로가기 한 번이면 직전 주소로 돌아간다', async () => {
    const { history, user } = renderScreen([codeGroupListRoute(), ...orgRoutes()], '?q=SYN');
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    const before = history.search();

    await user.click(screen.getByRole('tab', { name: '조직(부서)' }));
    await screen.findByRole('button', { name: 'SYN-DEPT-01' });

    history.back();
    expect(history.search()).toBe(before);
  });
});

describe('CommonCodeScreen — 부서 상세 (C48·C54)', () => {
  /* C48 */
  it('부서를 고르면 상세 요청이 한 번 나가고 고르기 전에는 나가지 않는다', async () => {
    const { requests, user } = renderScreen(orgDetailRoutes(), '?tab=org');
    await screen.findByRole('button', { name: 'SYN-DEPT-01' });

    expect(requestsTo(requests, `${DEPARTMENTS_PATH}/3001`)).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'SYN-DEPT-01' }));
    await screen.findByDisplayValue('SYN-DEPT-01');

    expect(requestsTo(requests, `${DEPARTMENTS_PATH}/3001`)).toHaveLength(1);
  });

  it('폼이 상세 값으로 채워진다', async () => {
    renderScreen(orgDetailRoutes(), '?tab=org&dep=3001');

    expect(await screen.findByDisplayValue('SYN-DEPT-01')).toBeInTheDocument();
    expect(screen.getByDisplayValue('합성 부서 A')).toBeInTheDocument();
  });

  /*
   * C54 · 뮤테이션 44 — 판정의 주인은 `codeEditable`이다.
   * 목 서버가 `{codeEditable:false, reason:'EDITABLE'}`이라는 어긋난 조합을 실제로 준다.
   */
  it('편집 불가면 사유가 EDITABLE이어도 부서코드 칸이 잠긴다', async () => {
    renderScreen(
      orgDetailRoutes({ codeEditable: false, reason: 'EDITABLE', referenceCount: 3 }),
      '?tab=org&dep=3001',
    );

    expect(await screen.findByLabelText('부서코드')).toBeDisabled();
  });

  /* 서버가 잠그지 않은 칸까지 화면이 잠그면 안 된다. */
  it('편집 가능하면 부서코드와 부서명이 모두 열려 있다', async () => {
    renderScreen(orgDetailRoutes(), '?tab=org&dep=3001');

    expect(await screen.findByLabelText('부서코드')).toBeEnabled();
    expect(screen.getByLabelText('부서명')).toBeEnabled();
  });

  /* 입력하는 동안 캐시가 갱신돼도 입력한 값이 서버 값으로 되돌아가지 않는다. */
  it('입력 중에 캐시가 갱신돼도 입력값이 유지된다', async () => {
    const { queryClient, user } = renderScreen(orgDetailRoutes(), '?tab=org&dep=3001');
    await screen.findByDisplayValue('합성 부서 A');

    await user.clear(screen.getByLabelText('부서명'));
    await user.type(screen.getByLabelText('부서명'), '합성 부서 Z');

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['common-code-departments'] });
    });

    expect(screen.getByLabelText('부서명')).toHaveValue('합성 부서 Z');
  });
});

describe('CommonCodeScreen — 부서 수정 (C49·C50·C52·C53)', () => {
  const updateRoute = (respond: StubRoute['respond']): StubRoute => ({
    match: (request) =>
      request.method === 'PUT' && new URL(request.url).pathname === `${DEPARTMENTS_PATH}/3001`,
    respond,
  });

  const savedDepartment = { ...departmentFixtures[0]!, departmentName: '합성 부서 Z' };

  /* C49 — 낙관적 잠금이 있는 쓰기다. 헤더 둘이 함께 있어야 한다. */
  it('저장이 PUT으로 나가고 멱등 키와 If-Match가 둘 다 실린다', async () => {
    const { requests, user } = renderScreen(
      [...orgDetailRoutes(), updateRoute(() => jsonResponse(savedDepartment))],
      '?tab=org&dep=3001',
    );
    await screen.findByDisplayValue('합성 부서 A');

    await user.clear(screen.getByLabelText('부서명'));
    await user.type(screen.getByLabelText('부서명'), '합성 부서 Z');
    await user.click(within(departmentFormPane()).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(1);
    });

    const sent = requests.find((request) => request.method === 'PUT');
    expect(sent?.url.pathname).toBe(`${DEPARTMENTS_PATH}/3001`);
    expect(sent?.headers.get('Idempotency-Key')).toMatch(UUID);
    expect(sent?.headers.get('If-Match')).toBe('W/"5"');
  });

  /*
   * C50 — 사용 여부·번호는 싣지 않고, 상위·사업부는 **비어도 널을 명시**한다.
   * 키를 빼면 서버가 이전 값을 남겨 하위 부서를 뿌리로 되돌릴 수 없다.
   */
  it('수정 본문에 사용 여부·번호가 없고 상위·사업부는 널로 명시된다', async () => {
    const { requests, user } = renderScreen(
      [...orgDetailRoutes(), updateRoute(() => jsonResponse(savedDepartment))],
      '?tab=org&dep=3001',
    );
    await screen.findByDisplayValue('합성 부서 A');

    await user.clear(screen.getByLabelText('부서명'));
    await user.type(screen.getByLabelText('부서명'), '합성 부서 Z');
    await user.click(within(departmentFormPane()).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(1);
    });

    const body = JSON.parse(
      requests.find((request) => request.method === 'PUT')?.body ?? '{}',
    ) as Record<string, unknown>;

    expect('isActive' in body).toBe(false);
    expect('departmentId' in body).toBe(false);
    expect('parentDepartmentId' in body).toBe(true);
    expect(body.parentDepartmentId).toBeNull();
    expect(body.businessUnitId).toBe(4001);
  });

  /* C53 — 화면에서 잡히는 오류는 서버로 보내지 않는다. */
  it('필수 칸을 비우면 요청이 나가지 않고 인라인 오류가 뜬다', async () => {
    const { requests, user } = renderScreen(orgDetailRoutes(), '?tab=org&dep=3001');
    await screen.findByDisplayValue('합성 부서 A');

    await user.clear(screen.getByLabelText('부서명'));
    await user.click(within(departmentFormPane()).getByRole('button', { name: '저장' }));

    expect(screen.getByText('필수 입력 항목입니다.')).toBeInTheDocument();
    expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(0);
  });

  it('공백만 넣어도 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen(orgDetailRoutes(), '?tab=org&dep=3001');
    await screen.findByDisplayValue('합성 부서 A');

    await user.clear(screen.getByLabelText('부서명'));
    await user.type(screen.getByLabelText('부서명'), '   ');
    await user.click(within(departmentFormPane()).getByRole('button', { name: '저장' }));

    expect(screen.getByText('부서명은 공백만으로 지정할 수 없습니다.')).toBeInTheDocument();
    expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(0);
  });

  /*
   * C52 — **순환을 화면이 막지 않는다.** 서버가 400을 주면 그 사유를 배너로 낸다.
   * 화면이 흉내 내면 서버와 다른 답을 낸다.
   */
  it('순환 참조를 서버가 400으로 거부하면 그 사유가 배너에 나온다', async () => {
    const { user } = renderScreen(
      [
        ...orgDetailRoutes(),
        updateRoute(() =>
          jsonResponse(
            {
              message: '',
              errors: [
                { scope: 'screen', code: 'CYCLE', message: '상위 부서가 순환 참조를 만듭니다.' },
              ],
            },
            { status: 400 },
          ),
        ),
      ],
      '?tab=org&dep=3001',
    );
    await screen.findByDisplayValue('합성 부서 A');

    await user.clear(screen.getByLabelText('부서명'));
    await user.type(screen.getByLabelText('부서명'), '합성 부서 Z');
    await user.click(within(departmentFormPane()).getByRole('button', { name: '저장' }));

    expect(await screen.findByText('상위 부서가 순환 참조를 만듭니다.')).toBeInTheDocument();
  });

  /* 409에만 「최신 불러오기」를 낸다 — 다른 실패는 다시 받아도 풀리지 않는다. */
  it('409면 원인별 문구와 최신 불러오기가 나온다', async () => {
    const { user } = renderScreen(
      [
        ...orgDetailRoutes(),
        updateRoute(() => jsonResponse({ message: '', conflictCause: 'user' }, { status: 409 })),
      ],
      '?tab=org&dep=3001',
    );
    await screen.findByDisplayValue('합성 부서 A');

    await user.clear(screen.getByLabelText('부서명'));
    await user.type(screen.getByLabelText('부서명'), '합성 부서 Z');
    await user.click(within(departmentFormPane()).getByRole('button', { name: '저장' }));

    expect(await screen.findByRole('button', { name: '최신 불러오기' })).toBeInTheDocument();
  });
});

describe('CommonCodeScreen — 상위 부서 선택지 (C51·C52)', () => {
  /*
   * C51 — 계약이 자기참조를 막는다. 거부당할 값을 고르게 두지 않는다.
   * 선택지는 좌 목록이 아니라 **전체 목록**에서 나온다(쪽 나눔 때문).
   */
  it('상위 부서 선택지에 자기 자신이 없다', async () => {
    const { user } = renderScreen(orgDetailRoutes(), '?tab=org&dep=3001');
    await screen.findByDisplayValue('SYN-DEPT-01');

    await user.click(screen.getByLabelText('상위 부서'));

    expect(screen.queryByRole('option', { name: /SYN-DEPT-01/ })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /SYN-DEPT-02/ })).toBeInTheDocument();
  });

  /*
   * C52 — 후손도 선택지에 남는다. 순환 판정은 서버 몫이다.
   * 빠지는 것은 자기 자신(3001)과 미사용 부서(3004)뿐이며, 미사용은 순환과 무관한 표시 규칙이다.
   */
  it('자기 자신 말고는 빼지 않는다 — 후손(3002)이 선택지에 남는다', async () => {
    const { user } = renderScreen(orgDetailRoutes(), '?tab=org&dep=3001');
    await screen.findByDisplayValue('SYN-DEPT-01');

    await user.click(screen.getByLabelText('상위 부서'));

    // 선택지는 셋뿐이다 — 「없음」과 활성 부서 둘. 자기 자신만 빠졌다.
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByRole('option', { name: /없음 \(뿌리 부서\)/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /SYN-DEPT-02/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /SYN-DEPT-03/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /SYN-DEPT-01/ })).not.toBeInTheDocument();
  });

  /* C51 — 고를 다른 부서가 하나도 없으면 감추지 않고 사유와 함께 비활성으로 둔다. */
  it('상위로 고를 다른 부서가 없으면 선택칸이 비활성이고 사유가 붙는다', async () => {
    renderScreen(
      [
        departmentListRoute([departmentFixtures[0]!]),
        businessUnitsRoute(),
        departmentOptionsRoute([departmentFixtures[0]!], { page: 1, size: 50, total: 1 }),
        departmentDetailRoute(),
      ],
      '?tab=org&dep=3001',
    );

    expect(await screen.findByLabelText('상위 부서')).toBeDisabled();
    expect(screen.getByText(/상위 부서는 고를 수 있는 다른 부서가 없어/)).toBeInTheDocument();
  });

  /* 상위 선택지는 폼이 열렸을 때만 받는다 — 목록만 볼 때 같은 경로로 두 번 나가면 안 된다. */
  it('부서를 고르기 전에는 상위 선택지를 조회하지 않는다', async () => {
    const { requests } = renderScreen(orgDetailRoutes(), '?tab=org');
    await screen.findByRole('button', { name: 'SYN-DEPT-01' });

    expect(departmentRequests(requests)).toHaveLength(1);
  });
});

describe('CommonCodeScreen — 부서 등록 (C55)', () => {
  const createRoute = (respond: StubRoute['respond']): StubRoute => ({
    match: (request) =>
      request.method === 'POST' && new URL(request.url).pathname === DEPARTMENTS_PATH,
    respond,
  });

  const madeDepartment = {
    departmentId: 3009,
    departmentCode: 'SYN-DEPT-09',
    departmentName: '합성 부서 I',
    parentDepartmentId: null,
    businessUnitId: null,
    isActive: true,
  };

  const madeDetailRoute: StubRoute = {
    match: (request) => isGet(request, `${DEPARTMENTS_PATH}/3009`),
    respond: () =>
      jsonResponse(
        {
          department: madeDepartment,
          editability: { codeEditable: true, reason: 'EDITABLE', referenceCount: 0 },
        },
        { headers: { ETag: 'W/"1"' } },
      ),
  };

  /* 주소가 폼의 여닫음을 소유한다 — 새로고침·공유로 들어와도 폼이 서야 한다. */
  it('주소로 바로 들어와도 등록 폼이 선다', async () => {
    renderScreen(orgDetailRoutes(), '?tab=org&new=dept');

    const pane = await screen.findByRole('region', { name: '부서 정보' });
    expect(within(pane).getByLabelText('부서코드')).toHaveValue('');
    expect(within(pane).getByRole('button', { name: '부서 추가' })).toBeInTheDocument();
  });

  /* C55 — 아직 없는 자원이라 잠글 대상이 없다. */
  it('등록 저장이 POST로 나가고 If-Match가 없다', async () => {
    const { requests, user } = renderScreen(
      [
        ...orgDetailRoutes(),
        createRoute(() => jsonResponse(madeDepartment, { status: 201 })),
        madeDetailRoute,
      ],
      '?tab=org&new=dept',
    );

    await user.type(await screen.findByLabelText('부서코드'), 'SYN-DEPT-09');
    await user.type(screen.getByLabelText('부서명'), '합성 부서 I');
    await user.click(within(departmentFormPane()).getByRole('button', { name: '부서 추가' }));

    await waitFor(() => {
      expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1);
    });

    const sent = requests.find((request) => request.method === 'POST');
    expect(sent?.headers.get('Idempotency-Key')).toMatch(UUID);
    expect(sent?.headers.has('If-Match')).toBe(false);
  });

  /* C50 — 등록 본문에서는 「없음」이 곧 뿌리다. 지울 이전 값이 없어 키 자체를 싣지 않는다. */
  it('등록 본문은 비어 있는 상위·사업부의 키 자체를 싣지 않는다', async () => {
    const { requests, user } = renderScreen(
      [
        ...orgDetailRoutes(),
        createRoute(() => jsonResponse(madeDepartment, { status: 201 })),
        madeDetailRoute,
      ],
      '?tab=org&new=dept',
    );

    await user.type(await screen.findByLabelText('부서코드'), 'SYN-DEPT-09');
    await user.type(screen.getByLabelText('부서명'), '합성 부서 I');
    await user.click(within(departmentFormPane()).getByRole('button', { name: '부서 추가' }));

    await waitFor(() => {
      expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1);
    });

    const body = JSON.parse(
      requests.find((request) => request.method === 'POST')?.body ?? '{}',
    ) as Record<string, unknown>;

    expect('parentDepartmentId' in body).toBe(false);
    expect('businessUnitId' in body).toBe(false);
  });

  /* C55 — 방금 만든 부서로 옮겨 가야 이어서 고칠 수 있다. */
  it('등록에 성공하면 새 부서로 옮겨 가고 new가 사라진다', async () => {
    const { history, user } = renderScreen(
      [
        ...orgDetailRoutes(),
        createRoute(() => jsonResponse(madeDepartment, { status: 201 })),
        madeDetailRoute,
      ],
      '?tab=org&new=dept',
    );

    await user.type(await screen.findByLabelText('부서코드'), 'SYN-DEPT-09');
    await user.type(screen.getByLabelText('부서명'), '합성 부서 I');
    await user.click(within(departmentFormPane()).getByRole('button', { name: '부서 추가' }));

    await screen.findByDisplayValue('SYN-DEPT-09');
    expect(history.search()).toBe('?tab=org&dep=3009');
  });

  /* 한 조작은 히스토리 한 칸이다 — 나눠 부르면 뒤로가기가 중간 상태로 떨어진다. */
  it('등록에 성공한 뒤 뒤로가기 한 번이면 직전 주소로 돌아간다', async () => {
    const { history, user } = renderScreen(
      [
        ...orgDetailRoutes(),
        createRoute(() => jsonResponse(madeDepartment, { status: 201 })),
        madeDetailRoute,
      ],
      '?tab=org&new=dept',
    );

    await user.type(await screen.findByLabelText('부서코드'), 'SYN-DEPT-09');
    await user.type(screen.getByLabelText('부서명'), '합성 부서 I');

    const before = history.search();

    await user.click(within(departmentFormPane()).getByRole('button', { name: '부서 추가' }));
    await screen.findByDisplayValue('SYN-DEPT-09');

    history.back();
    expect(history.search()).toBe(before);
  });
});

describe('CommonCodeScreen — 부서 사용 중지 (C56)', () => {
  const deactivateRoute = (respond: StubRoute['respond']): StubRoute => ({
    match: (request) =>
      request.method === 'POST' &&
      new URL(request.url).pathname === `${DEPARTMENTS_PATH}/3001:deactivate`,
    respond,
  });

  /* C56 — 되돌릴 수 없는 조작이라 확인을 한 단계 둔다. */
  it('사용 중지를 누르면 확인 창이 열리고 확인 전에는 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen(orgDetailRoutes(), '?tab=org&dep=3001');
    await screen.findByDisplayValue('SYN-DEPT-01');

    await user.click(within(departmentFormPane()).getByRole('button', { name: '사용 중지' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(0);
  });

  /* C56 — 확인 창에 참조 건수를 내지 않는다(결정 10). */
  it('확인 창에 참조 건수가 없고 되돌릴 수 없다는 사실을 밝힌다', async () => {
    const { user } = renderScreen(
      orgDetailRoutes({ codeEditable: false, reason: 'REFERENCED', referenceCount: 3 }),
      '?tab=org&dep=3001',
    );
    await screen.findByDisplayValue('SYN-DEPT-01');

    await user.click(within(departmentFormPane()).getByRole('button', { name: '사용 중지' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/되돌리는 경로가 없습니다/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/3건/)).not.toBeInTheDocument();
  });

  it('확인하면 사용 중지 요청이 나가고 If-Match가 실린다', async () => {
    const { requests, user } = renderScreen(
      [...orgDetailRoutes(), deactivateRoute(() => jsonResponse(departmentFixtures[0]))],
      '?tab=org&dep=3001',
    );
    await screen.findByDisplayValue('SYN-DEPT-01');

    await user.click(within(departmentFormPane()).getByRole('button', { name: '사용 중지' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '사용 중지' }));

    await waitFor(() => {
      expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1);
    });

    const sent = requests.find((request) => request.method === 'POST');
    expect(sent?.url.pathname).toBe(`${DEPARTMENTS_PATH}/3001:deactivate`);
    expect(sent?.headers.get('Idempotency-Key')).toMatch(UUID);
    expect(sent?.headers.get('If-Match')).toBe('W/"5"');
  });

  /* 닫으면 사용자는 무엇이 막았는지 모른 채 같은 버튼을 다시 누른다. */
  it('사용 중지에 실패해도 확인 창이 닫히지 않는다', async () => {
    const { user } = renderScreen(
      [
        ...orgDetailRoutes(),
        deactivateRoute(() =>
          jsonResponse({ message: '', conflictCause: 'user' }, { status: 409 }),
        ),
      ],
      '?tab=org&dep=3001',
    );
    await screen.findByDisplayValue('SYN-DEPT-01');

    await user.click(within(departmentFormPane()).getByRole('button', { name: '사용 중지' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '사용 중지' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  /* 응답에 ETag가 없다 — 재조회로 새 토큰을 확보하지 않으면 그다음 저장이 조용히 막힌다. */
  it('사용 중지에 성공하면 상세와 목록이 다시 조회된다', async () => {
    const { requests, user } = renderScreen(
      [...orgDetailRoutes(), deactivateRoute(() => jsonResponse(departmentFixtures[0]))],
      '?tab=org&dep=3001',
    );
    await screen.findByDisplayValue('SYN-DEPT-01');

    const before = departmentRequests(requests).length;
    const beforeDetail = requestsTo(requests, `${DEPARTMENTS_PATH}/3001`).length;

    await user.click(within(departmentFormPane()).getByRole('button', { name: '사용 중지' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '사용 중지' }));

    await waitFor(() => {
      expect(requestsTo(requests, `${DEPARTMENTS_PATH}/3001`).length).toBeGreaterThan(beforeDetail);
    });
    expect(departmentRequests(requests).length).toBeGreaterThan(before);
  });

  /* 이미 미사용이면 되돌릴 수 없는 조작을 다시 할 이유가 없다. */
  it('이미 미사용인 부서는 사용 중지가 비활성이고 사유가 붙는다', async () => {
    renderScreen(
      [
        departmentListRoute(),
        businessUnitsRoute(),
        departmentOptionsRoute(),
        departmentDetailRoute(3004),
      ],
      '?tab=org&dep=3004',
    );

    expect(await screen.findByDisplayValue('SYN-DEPT-04')).toBeInTheDocument();
    expect(within(departmentFormPane()).getByRole('button', { name: '사용 중지' })).toBeDisabled();
    expect(
      screen.getByText('사용 중지는 이미 미사용인 부서에 다시 할 수 없습니다.'),
    ).toBeInTheDocument();
  });
});

const WORKERS_PATH = '/mdm/workers';
const PLANTS_PATH = '/mdm/plants';

const workerListRoute = (
  items = workerFixtures,
  pageMeta: PageStub = { page: 1, size: 50, total: workerFixtures.length },
): StubRoute => ({
  match: (request) => isGet(request, WORKERS_PATH),
  respond: () => jsonResponse({ items, page: pageMeta }),
});

/** 작업자 상세 — **`ETag`가 없다**(계약 실측). 이 화면 고유의 함정이 여기서 나온다. */
const workerDetailRoute = (
  workerId = 5001,
  editability: Editability = { codeEditable: false, reason: 'EDITABLE', referenceCount: 3 },
): StubRoute => ({
  match: (request) => isGet(request, `${WORKERS_PATH}/${String(workerId)}`),
  respond: () =>
    jsonResponse({
      worker: workerFixtures.find((row) => row.workerId === workerId),
      editability,
    }),
});

const plantsRoute = (): StubRoute => ({
  match: (request) => isGet(request, PLANTS_PATH),
  respond: () =>
    jsonResponse({
      items: [
        {
          plantId: 6001,
          legalEntityId: 5001,
          businessUnitId: 4001,
          plantCode: 'SYN-PLT-01',
          plantName: '합성 공장 1',
          timezoneCode: 'STANDARD',
          isActive: true,
        },
      ],
      page: { page: 1, size: 50, total: 1 },
    }),
});

const workerRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requestsTo(requests, WORKERS_PATH);

const workerPane = (): HTMLElement => screen.getByRole('region', { name: '작업자' });

const workerDetailPane = (): HTMLElement =>
  screen.getByRole('region', { name: '작업자 기본 정보' });

/**
 * 기본 정보가 **다 채워질 때까지** 기다린다.
 *
 * 구획은 불러오는 중에도 같은 이름으로 있으므로 `findByRole`만으로는 뼈대를 잡고 지나간다 —
 * 이 구획에서만 나오는 고정 안내가 보일 때가 채워진 시점이다.
 */
const findLoadedWorkerDetailPane = async (): Promise<HTMLElement> => {
  await screen.findByText(/외부 시스템에서 받은 자료라/);
  return workerDetailPane();
};

/** 작업자 탭의 기본 스텁 묶음. 탭이 열리면 작업자 목록과 부서 선택지가 필요하다. */
const workerRoutes = (): StubRoute[] => [
  workerListRoute(),
  departmentOptionsRoute(),
  workerDetailRoute(),
  businessUnitsRoute(),
  plantsRoute(),
];

describe('CommonCodeScreen — 작업자 목록 조회 (C57)', () => {
  it('작업자 탭에 들어오면 목록 요청이 한 번 나간다', async () => {
    const { requests } = renderScreen(workerRoutes(), '?tab=worker');

    expect(await screen.findByRole('button', { name: 'SYN-W-0001' })).toBeInTheDocument();
    expect(workerRequests(requests)).toHaveLength(1);
    expect(workerRequests(requests)[0]?.url.search).toBe('');
  });

  it('걸린 조건만 요청 쿼리에 실린다', async () => {
    const { requests } = renderScreen(workerRoutes(), '?tab=worker&q=SYN&dept=3001&inactive=1');
    await screen.findByRole('button', { name: 'SYN-W-0001' });

    const sent = workerRequests(requests)[0];
    expect(sent?.url.searchParams.get('q')).toBe('SYN');
    expect(sent?.url.searchParams.get('departmentId')).toBe('3001');
    expect(sent?.url.searchParams.get('includeInactive')).toBe('true');
  });

  /* C57 — 만들지 않은 필터의 조건을 요청에 실으면 되돌릴 수단이 없다. */
  it('공장·사업부를 쿼리에 싣지 않는다', async () => {
    const { requests } = renderScreen(workerRoutes(), '?tab=worker&q=SYN&dept=3001');
    await screen.findByRole('button', { name: 'SYN-W-0001' });

    const sent = workerRequests(requests)[0];
    expect(sent?.url.searchParams.has('plantId')).toBe(false);
    expect(sent?.url.searchParams.has('businessUnitId')).toBe(false);
  });

  it('미사용 포함이 꺼져 있으면 그 키를 보내지 않는다', async () => {
    const { requests } = renderScreen(workerRoutes(), '?tab=worker');
    await screen.findByRole('button', { name: 'SYN-W-0001' });

    expect(workerRequests(requests)[0]?.url.searchParams.has('includeInactive')).toBe(false);
  });

  it('다른 탭의 목록을 함께 조회하지 않는다', async () => {
    const { requests } = renderScreen(workerRoutes(), '?tab=worker');
    await screen.findByRole('button', { name: 'SYN-W-0001' });

    expect(codeGroupRequests(requests)).toHaveLength(0);
    // 부서 경로로는 **선택지 조회 한 번**만 나간다(좌 목록 조회가 아니다).
    expect(departmentRequests(requests)).toHaveLength(1);
    expect(departmentRequests(requests)[0]?.url.searchParams.get('includeInactive')).toBe('true');
  });

  it('작업자 목록 조회에 실패하면 배너를 내고 빈 상태를 함께 내지 않는다', async () => {
    renderScreen(
      [
        {
          match: (request) => isGet(request, WORKERS_PATH),
          respond: () => jsonResponse({ message: '' }, { status: 500 }),
        },
        departmentOptionsRoute(),
      ],
      '?tab=worker',
    );

    expect(await screen.findByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByText('등록된 작업자가 없습니다')).not.toBeInTheDocument();
  });
});

describe('CommonCodeScreen — 작업자 선택과 기본 정보 (C58~C63)', () => {
  /* C58 */
  it('작업자를 고르면 상세 요청이 한 번 나가고 주소에 wkr가 붙는다', async () => {
    const { requests, history, user } = renderScreen(workerRoutes(), '?tab=worker');
    await screen.findByRole('button', { name: 'SYN-W-0001' });

    expect(requestsTo(requests, `${WORKERS_PATH}/5001`)).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'SYN-W-0001' }));
    await findLoadedWorkerDetailPane();

    expect(requestsTo(requests, `${WORKERS_PATH}/5001`)).toHaveLength(1);
    expect(history.search()).toBe('?tab=worker&wkr=5001');
    expect(screen.getByRole('button', { name: 'SYN-W-0001' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  /*
   * C59 — 계약에 쓰기 경로가 아예 없다. 폼 컨트롤을 잠그는 것이 아니라 두지 않는다.
   * 우 칸 전체에서 입력칸과 버튼이 0개여야 한다.
   */
  it('기본 정보 구획에 입력칸도 버튼도 없다', async () => {
    renderScreen(workerRoutes(), '?tab=worker&wkr=5001');

    const pane = await findLoadedWorkerDetailPane();

    expect(within(pane).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(pane).queryAllByRole('combobox')).toHaveLength(0);
    expect(within(pane).queryAllByRole('checkbox')).toHaveLength(0);
    expect(within(pane).queryAllByRole('button')).toHaveLength(0);
  });

  /* C60 — `editability`가 `EDITABLE`을 줘도 고정 문구를 낸다. */
  it('편집 가능 여부와 무관하게 외부 수신본 안내가 보인다', async () => {
    renderScreen(
      [
        workerListRoute(),
        departmentOptionsRoute(),
        workerDetailRoute(5001, { codeEditable: true, reason: 'EDITABLE', referenceCount: 0 }),
        businessUnitsRoute(),
        plantsRoute(),
      ],
      '?tab=worker&wkr=5001',
    );

    expect(
      await screen.findByText(
        '외부 시스템에서 받은 자료라 여기서 수정할 수 없습니다. 원본 시스템에서 변경하세요.',
      ),
    ).toBeInTheDocument();
  });

  /*
   * C61 — 이 화면의 어떤 요청도 `/mdm/workers`로 `If-Match`를 보내지 않는다.
   * 작업자 상세에 `ETag`가 없어 보내려 해도 보낼 수 없고, 보내려 하면 요청이 조용히 멈춘다.
   */
  it('작업자 경로로 나가는 요청에 If-Match가 하나도 없다', async () => {
    const { requests } = renderScreen(workerRoutes(), '?tab=worker&wkr=5001');
    await findLoadedWorkerDetailPane();

    const workerPathRequests = requests.filter((request) =>
      request.url.pathname.startsWith(WORKERS_PATH),
    );

    expect(workerPathRequests.length).toBeGreaterThan(0);
    for (const request of workerPathRequests) {
      expect(request.headers.has('If-Match')).toBe(false);
    }
  });

  /* 이 화면에서 작업자 경로로 나가는 쓰기가 0회다 — 기본 정보에 저장 경로가 없다. */
  it('작업자 경로로 나가는 쓰기 요청이 없다', async () => {
    const { requests, user } = renderScreen(workerRoutes(), '?tab=worker&wkr=5001');
    await findLoadedWorkerDetailPane();
    await screen.findByRole('button', { name: 'SYN-W-0002' });

    await user.click(screen.getByRole('button', { name: 'SYN-W-0002' }));

    const writes = requests.filter(
      (request) => request.url.pathname.startsWith(WORKERS_PATH) && request.method !== 'GET',
    );

    expect(writes).toHaveLength(0);
  });

  /* C62 — 번호가 아니라 이름을 낸다. */
  it('사업부·공장·부서를 이름으로 낸다', async () => {
    renderScreen(workerRoutes(), '?tab=worker&wkr=5001');
    await findLoadedWorkerDetailPane();

    // 선택 목록은 상세보다 늦게 도착할 수 있다 — 이름이 채워질 때까지 기다린다.
    expect(await screen.findByText('SYN-BU-01 · 합성 사업부 A')).toBeInTheDocument();
    const pane = workerDetailPane();
    expect(within(pane).getByText('합성 공장 1')).toBeInTheDocument();
    expect(within(pane).getByText('SYN-DEPT-01 · 합성 부서 A')).toBeInTheDocument();
  });

  /* C62 — 값 목록이 미정이라 이름을 지어내지 않는다. */
  it('상태 코드를 원본 문자열 그대로 낸다', async () => {
    renderScreen(
      [
        workerListRoute(),
        departmentOptionsRoute(),
        workerDetailRoute(5002),
        businessUnitsRoute(),
        plantsRoute(),
      ],
      '?tab=worker&wkr=5002',
    );

    expect(await screen.findByText('SYN-UNKNOWN-STATUS')).toBeInTheDocument();
  });

  /* C63 — 번호도 편집 수단도 두지 않는다. */
  it('계정 연결을 연결 여부로만 낸다', async () => {
    renderScreen(
      [
        workerListRoute(),
        departmentOptionsRoute(),
        workerDetailRoute(5002),
        businessUnitsRoute(),
        plantsRoute(),
      ],
      '?tab=worker&wkr=5002',
    );

    expect(await screen.findByText('연결 안 됨')).toBeInTheDocument();
    expect(screen.queryByText('7001')).not.toBeInTheDocument();
  });

  /*
   * C63 — **연결된 작업자에서도** 번호를 내지 않는다.
   * 연결이 없는 작업자만 보면 「연결 안 됨」이라 번호가 새는 것을 잡지 못한다
   * (뮤테이션 자체 주입에서 실제로 이 빈틈이 드러났다).
   */
  it('계정이 연결된 작업자도 번호를 내지 않는다', async () => {
    renderScreen(workerRoutes(), '?tab=worker&wkr=5001');
    await findLoadedWorkerDetailPane();

    expect(within(workerDetailPane()).getByText('연결됨')).toBeInTheDocument();
    expect(within(workerDetailPane()).queryByText('7001')).not.toBeInTheDocument();
  });

  /* 조회 목록에 없는 번호를 화면에 내지 않는다. */
  it('선택 목록에 없는 부서 번호는 「알 수 없음」이 된다', async () => {
    renderScreen(
      [
        workerListRoute(),
        departmentOptionsRoute(),
        workerDetailRoute(5003),
        businessUnitsRoute(),
        plantsRoute(),
      ],
      '?tab=worker&wkr=5003',
    );

    await findLoadedWorkerDetailPane();

    // 사업부·공장은 이름으로 채워지고 부서만 목록에 없다.
    await screen.findByText('합성 공장 1');
    expect(within(workerDetailPane()).getByText('알 수 없음')).toBeInTheDocument();
    expect(screen.queryByText('9999')).not.toBeInTheDocument();
  });
});

describe('CommonCodeScreen — 작업자 조건과 탭 전환', () => {
  it('조건을 바꾸면 주소에서 wkr가 사라진다', async () => {
    const { history, user } = renderScreen(workerRoutes(), '?tab=worker&wkr=5001&page=3');
    await screen.findByRole('button', { name: 'SYN-W-0001' });

    await user.type(screen.getByLabelText('작업자 검색'), 'SYN');
    await user.click(within(workerPane()).getByRole('button', { name: '조회' }));

    expect(history.search()).toBe('?tab=worker&q=SYN');
  });

  it('작업자를 고른 뒤 뒤로가기 한 번이면 직전 주소로 돌아간다', async () => {
    const { history, user } = renderScreen(workerRoutes(), '?tab=worker');
    await screen.findByRole('button', { name: 'SYN-W-0001' });

    const before = history.search();

    await user.click(screen.getByRole('button', { name: 'SYN-W-0001' }));
    expect(history.search()).toBe('?tab=worker&wkr=5001');

    history.back();
    expect(history.search()).toBe(before);
  });

  /* C13 — 작업자 탭으로 바꿔도 이전 탭의 조건·선택이 하나도 남지 않는다. */
  it('작업자 탭으로 바꾸면 조직 탭의 조건·선택이 사라진다', async () => {
    const { history, user } = renderScreen(
      [...orgDetailRoutes(), ...workerRoutes()],
      '?tab=org&q=SYN&bu=4001&inactive=1&page=2&dep=3001',
    );
    await screen.findByRole('button', { name: 'SYN-DEPT-01' });

    await user.click(screen.getByRole('tab', { name: '작업자' }));

    expect(history.search()).toBe('?tab=worker');
    expect(await screen.findByRole('button', { name: 'SYN-W-0001' })).toBeInTheDocument();
  });

  it('탭 묶음에 만든 탭 넷이 렌더된다', async () => {
    renderScreen(workerRoutes(), '?tab=worker');
    await screen.findByRole('button', { name: 'SYN-W-0001' });

    const tabs = within(screen.getByRole('tablist', { name: '공통코드·조직·작업자' })).getAllByRole(
      'tab',
    );

    expect(tabs.map((element) => element.textContent)).toEqual([
      '공통코드',
      '조직(부서)',
      '작업자',
      '거래처 역할',
    ]);
  });
});

const qualificationsPath = (workerId: number): string =>
  `${WORKERS_PATH}/${String(workerId)}/qualifications`;

const PROCESSES_PATH = '/mdm/processes';

const savedQualifications = [
  {
    workerQualificationId: 8001,
    workerId: 5001,
    qualificationTypeCode: 'PENDING',
    processId: 6001,
    certificateNo: 'SYN-CERT-01',
    validFrom: '2026-08-01',
    validTo: '2026-12-31',
    /** 목 서버가 실제로 값을 준다 — 되돌려 싣지 않으면 조용히 지워진다. */
    certifiedBy: 7001,
  },
];

const qualificationListRoute = (items: unknown[] = savedQualifications): StubRoute => ({
  match: (request) => isGet(request, qualificationsPath(5001)),
  respond: () => jsonResponse({ items }),
});

const processesRoute = (): StubRoute => ({
  match: (request) => isGet(request, PROCESSES_PATH),
  respond: () =>
    jsonResponse({
      items: [
        {
          processId: 6001,
          processCode: 'SYN-OP-01',
          processName: '합성 공정 A',
          processTypeCode: 'STANDARD',
          isActive: true,
        },
      ],
      page: { page: 1, size: 50, total: 1 },
    }),
});

const qualificationPane = (): HTMLElement => screen.getByRole('region', { name: '자격·인증' });

/** 자격까지 다루는 작업자 탭 스텁 묶음. */
const qualificationRoutes = (items: unknown[] = savedQualifications): StubRoute[] => [
  ...workerRoutes(),
  qualificationListRoute(items),
  processesRoute(),
];

describe('CommonCodeScreen — 자격 조회 (C64·C75)', () => {
  /* C64 */
  it('작업자를 고르면 자격 목록 요청이 한 번 나가고 고르기 전에는 나가지 않는다', async () => {
    const { requests, user } = renderScreen(qualificationRoutes(), '?tab=worker');
    await screen.findByRole('button', { name: 'SYN-W-0001' });

    expect(requestsTo(requests, qualificationsPath(5001))).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'SYN-W-0001' }));
    await screen.findByText('SYN-CERT-01');

    expect(requestsTo(requests, qualificationsPath(5001))).toHaveLength(1);
  });

  /* C75 — 공정 선택지가 실제 조회로 채워진다. */
  it('공정 이름을 조회 목록에서 찾아 표에 낸다', async () => {
    renderScreen(qualificationRoutes(), '?tab=worker&wkr=5001');

    expect(await screen.findByText('합성 공정 A')).toBeInTheDocument();
  });

  /* C75 — 계약이 비운 공정을 「모든 공정」으로 정했다(A-7). */
  it('공정을 비운 자격은 「(전체 공정)」으로 표기한다', async () => {
    renderScreen(
      qualificationRoutes([{ ...savedQualifications[0], processId: null }]),
      '?tab=worker&wkr=5001',
    );

    expect(await screen.findByText('(전체 공정)')).toBeInTheDocument();
  });

  it('공정 선택지 조회가 실패하면 그 사실을 표 위에 알린다', async () => {
    renderScreen(
      [
        ...workerRoutes(),
        qualificationListRoute(),
        {
          match: (request) => isGet(request, PROCESSES_PATH),
          respond: () => jsonResponse({ message: '' }, { status: 500 }),
        },
      ],
      '?tab=worker&wkr=5001',
    );

    expect(
      await screen.findByText('선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.'),
    ).toBeInTheDocument();
  });

  it('자격이 0건이면 빈 상태를 낸다', async () => {
    renderScreen(qualificationRoutes([]), '?tab=worker&wkr=5001');

    expect(await screen.findByText('등록된 자격·인증이 없습니다')).toBeInTheDocument();
  });
});

describe('CommonCodeScreen — 자격 편집과 저장 (C65~C68·C74)', () => {
  const replaceRoute = (respond: StubRoute['respond']): StubRoute => ({
    match: (request) =>
      request.method === 'PUT' && new URL(request.url).pathname === qualificationsPath(5001),
    respond,
  });

  /** 서버는 새 번호를 매겨 돌려준다 — 화면이 그 응답으로 초안을 다시 세워야 한다. */
  const replacedResponse = {
    items: [
      { ...savedQualifications[0], workerQualificationId: 9001, certificateNo: 'SYN-CERT-77' },
    ],
  };

  const openEditDialog = async (user: ReturnType<typeof userEvent.setup>) => {
    await screen.findByText('SYN-CERT-01');
    await user.click(screen.getByRole('button', { name: 'PENDING 자격 수정' }));
    return screen.getByRole('dialog');
  };

  /* C65 — 창의 확인은 표에만 반영된다. 서버 요청이 나가지 않는다. */
  it('창에서 확인해도 서버 요청이 나가지 않고 표에만 반영된다', async () => {
    const { requests, user } = renderScreen(qualificationRoutes(), '?tab=worker&wkr=5001');

    const dialog = await openEditDialog(user);
    const certificate = within(dialog).getByLabelText('인증번호');
    await user.clear(certificate);
    await user.type(certificate, 'SYN-CERT-77');
    await user.click(within(dialog).getByRole('button', { name: '확인' }));

    expect(await screen.findByText('SYN-CERT-77')).toBeInTheDocument();
    expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(0);
  });

  it('창 안에 확인이 저장이 아니라는 안내가 있다', async () => {
    const { user } = renderScreen(qualificationRoutes(), '?tab=worker&wkr=5001');

    const dialog = await openEditDialog(user);

    expect(
      within(dialog).getByText(
        '이 창의 확인은 저장이 아닙니다. 표에 반영된 뒤 「저장」을 눌러야 서버에 반영됩니다.',
      ),
    ).toBeInTheDocument();
  });

  /* 창은 열 때만 마운트한다 — 닫힌 창을 남기면 지난 값이 살아 있다. */
  it('창을 닫았다 다시 열면 지난 입력이 남지 않는다', async () => {
    const { user } = renderScreen(qualificationRoutes(), '?tab=worker&wkr=5001');

    const dialog = await openEditDialog(user);
    await user.clear(within(dialog).getByLabelText('인증번호'));
    await user.type(within(dialog).getByLabelText('인증번호'), 'SYN-CERT-77');
    await user.click(within(dialog).getByRole('button', { name: '취소' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'PENDING 자격 수정' }));
    expect(within(screen.getByRole('dialog')).getByLabelText('인증번호')).toHaveValue(
      'SYN-CERT-01',
    );
  });

  /*
   * C66 · 뮤테이션 23 — **`etagPath`가 `null`이어야 요청이 실제로 나간다.**
   * 작업자 상세에 `ETag`가 없어 상세 경로를 주면 토큰을 못 찾고 요청이 멈춘다.
   */
  it('저장이 치환 경로로 실제로 나가고 If-Match가 없다', async () => {
    const { requests, user } = renderScreen(
      [...qualificationRoutes(), replaceRoute(() => jsonResponse(replacedResponse))],
      '?tab=worker&wkr=5001',
    );

    const dialog = await openEditDialog(user);
    await user.clear(within(dialog).getByLabelText('인증번호'));
    await user.type(within(dialog).getByLabelText('인증번호'), 'SYN-CERT-77');
    await user.click(within(dialog).getByRole('button', { name: '확인' }));

    await user.click(within(qualificationPane()).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(1);
    });

    const sent = requests.find((request) => request.method === 'PUT');
    expect(sent?.url.pathname).toBe(qualificationsPath(5001));
    expect(sent?.headers.get('Idempotency-Key')).toMatch(UUID);
    expect(sent?.headers.has('If-Match')).toBe(false);
  });

  /* C67 — 계약의 요청 항목에 식별자가 없다. W-06-01·W-06-02의 치환과 반대다. */
  it('요청 본문의 어느 항목에도 행 식별자와 작업자 번호가 없다', async () => {
    const { requests, user } = renderScreen(
      [...qualificationRoutes(), replaceRoute(() => jsonResponse(replacedResponse))],
      '?tab=worker&wkr=5001',
    );

    const dialog = await openEditDialog(user);
    await user.clear(within(dialog).getByLabelText('인증번호'));
    await user.type(within(dialog).getByLabelText('인증번호'), 'SYN-CERT-77');
    await user.click(within(dialog).getByRole('button', { name: '확인' }));
    await user.click(within(qualificationPane()).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(1);
    });

    const body = JSON.parse(requests.find((request) => request.method === 'PUT')?.body ?? '{}') as {
      qualifications: Record<string, unknown>[];
    };

    expect(body.qualifications).toHaveLength(1);
    for (const item of body.qualifications) {
      expect('workerQualificationId' in item).toBe(false);
      expect('workerId' in item).toBe(false);
    }
  });

  /* C68 — 화면에 입력칸이 없는 값이라 되돌려 싣지 않으면 조용히 지워진다. */
  it('기존 행의 인증자가 서버가 준 값 그대로 실린다', async () => {
    const { requests, user } = renderScreen(
      [...qualificationRoutes(), replaceRoute(() => jsonResponse(replacedResponse))],
      '?tab=worker&wkr=5001',
    );

    const dialog = await openEditDialog(user);
    await user.clear(within(dialog).getByLabelText('인증번호'));
    await user.type(within(dialog).getByLabelText('인증번호'), 'SYN-CERT-77');
    await user.click(within(dialog).getByRole('button', { name: '확인' }));
    await user.click(within(qualificationPane()).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(1);
    });

    const body = JSON.parse(requests.find((request) => request.method === 'PUT')?.body ?? '{}') as {
      qualifications: Record<string, unknown>[];
    };

    expect(body.qualifications[0]?.certifiedBy).toBe(7001);
  });

  /* C68 — 새 행에는 그 값을 만들 수 없다. 널이 아니라 **키 자체가 없어야** 한다. */
  it('새로 더한 행에는 인증자 키 자체가 없다', async () => {
    const { requests, user } = renderScreen(
      [...qualificationRoutes([]), replaceRoute(() => jsonResponse({ items: [] }))],
      '?tab=worker&wkr=5001',
    );
    await screen.findByText('등록된 자격·인증이 없습니다');

    await user.click(within(qualificationPane()).getByRole('button', { name: '자격 추가' }));

    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByLabelText('자격 유형'));
    await user.click(screen.getByRole('option', { name: /선택지 준비 중/ }));
    await pickDate(user, within(dialog).getByLabelText('유효 시작'), '2026-08-01');
    await user.click(within(dialog).getByRole('button', { name: '확인' }));

    await user.click(within(qualificationPane()).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(1);
    });

    const body = JSON.parse(requests.find((request) => request.method === 'PUT')?.body ?? '{}') as {
      qualifications: Record<string, unknown>[];
    };

    expect('certifiedBy' in (body.qualifications[0] ?? {})).toBe(false);
  });

  /*
   * C74 — **서버가 새 번호를 매기고 값을 다듬을 수 있다.** 보낸 목록을 그대로 두면
   * 다음 저장이 옛 번호로 돈다. 서버가 돌려준 것이 정본이다.
   *
   * 목 서버는 상태를 갖지 않으므로 여기서만 상태를 두어 「치환 뒤의 조회」를 흉내 낸다 —
   * 그렇게 해야 저장 성공 뒤 재조회까지 포함한 최종 표시를 잴 수 있다.
   */
  it('저장에 성공하면 서버가 돌려준 값이 정본이 된다', async () => {
    let current: unknown[] = savedQualifications;

    const { user } = renderScreen(
      [
        ...workerRoutes(),
        processesRoute(),
        {
          match: (request) => isGet(request, qualificationsPath(5001)),
          respond: () => jsonResponse({ items: current }),
        },
        replaceRoute(() => {
          current = replacedResponse.items;
          return jsonResponse(replacedResponse);
        }),
      ],
      '?tab=worker&wkr=5001',
    );

    const dialog = await openEditDialog(user);
    await user.clear(within(dialog).getByLabelText('인증번호'));
    await user.type(within(dialog).getByLabelText('인증번호'), 'SYN-CERT-99');
    await user.click(within(dialog).getByRole('button', { name: '확인' }));
    await user.click(within(qualificationPane()).getByRole('button', { name: '저장' }));

    // 서버가 돌려준 값(`SYN-CERT-77`)이 남고 사용자가 보낸 값(`SYN-CERT-99`)은 남지 않는다.
    expect(await screen.findByText('SYN-CERT-77')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('SYN-CERT-99')).not.toBeInTheDocument();
    });
  });

  /*
   * **재조회가 도착하기 전에도 서버 값이 정본이다.**
   *
   * 응답을 지역 상태에만 앉히면 초안의 출처(조회 캐시)와 어긋나 **바로 다음 렌더에서 초안이
   * 저장 전 목록으로 되돌아간다** — 되세우기 규칙이 「출처가 바뀌었다」로 읽기 때문이다.
   * 위 감지기는 재조회가 곧바로 도착해 그 되돌아감을 덮으므로 이 갈래를 잡지 못한다.
   * 재조회를 **끝내지 않는 스텁**이 그 사이를 붙잡는다 — 실제로도 재조회가 늦거나 실패하면
   * 저장 전 값이 그대로 남는다.
   */
  it('저장에 성공하면 재조회가 도착하기 전에도 표가 저장 전 값으로 되돌아가지 않는다', async () => {
    let listCalls = 0;

    const { user } = renderScreen(
      [
        ...workerRoutes(),
        processesRoute(),
        {
          match: (request) => isGet(request, qualificationsPath(5001)),
          /* 첫 조회만 응답한다 — 무효화가 낸 재조회는 열어 둔 채로 둔다. */
          respond: () => {
            listCalls += 1;

            return listCalls === 1
              ? jsonResponse({ items: savedQualifications })
              : neverFinishingResponse();
          },
        },
        replaceRoute(() => jsonResponse(replacedResponse)),
      ],
      '?tab=worker&wkr=5001',
    );

    const dialog = await openEditDialog(user);
    await user.clear(within(dialog).getByLabelText('인증번호'));
    await user.type(within(dialog).getByLabelText('인증번호'), 'SYN-CERT-99');
    await user.click(within(dialog).getByRole('button', { name: '확인' }));
    await user.click(within(qualificationPane()).getByRole('button', { name: '저장' }));

    /* 양성 앵커 — 서버가 돌려준 값이 실제로 섰다. */
    expect(await screen.findByText('SYN-CERT-77')).toBeInTheDocument();
    expect(screen.queryByText('SYN-CERT-01')).not.toBeInTheDocument();
    expect(screen.queryByText('SYN-CERT-99')).not.toBeInTheDocument();
  });

  /*
   * **서버가 저장 전과 같은 값을 돌려줘도 서버 값이 정본이다.**
   *
   * 조회 라이브러리는 새 값이 옛 값과 깊이 같으면 **옛 참조를 그대로 유지한다**
   * (`replaceEqualDeep`) — 응답을 캐시에 앉히기만 하면 출처가 바뀌지 않아 되세우기가 열리지
   * 않고, 화면은 서버가 말한 상태가 아니라 **사용자가 고친 상태**를 계속 보인다.
   * 서버가 저장을 조용히 무시한 경우가 정확히 그 갈래다.
   */
  it('서버가 저장 전과 같은 값을 돌려주면 사용자가 고친 초안이 남지 않는다', async () => {
    const { user } = renderScreen(
      [...qualificationRoutes(), replaceRoute(() => jsonResponse({ items: savedQualifications }))],
      '?tab=worker&wkr=5001',
    );

    const dialog = await openEditDialog(user);
    await user.clear(within(dialog).getByLabelText('인증번호'));
    await user.type(within(dialog).getByLabelText('인증번호'), 'SYN-CERT-99');
    await user.click(within(dialog).getByRole('button', { name: '확인' }));
    await screen.findByText('SYN-CERT-99');

    await user.click(within(qualificationPane()).getByRole('button', { name: '저장' }));

    /* 양성 앵커 — 저장이 실제로 끝났다. 그 뒤에 「고친 값이 없다」를 잰다. */
    expect(await screen.findByText('저장했습니다')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('SYN-CERT-01')).toBeInTheDocument();
    });
    expect(screen.queryByText('SYN-CERT-99')).not.toBeInTheDocument();
  });

  /* C74 — 지운 행이 본문에서 빠진다. */
  it('행을 지우고 저장하면 그 행이 본문에서 빠진다', async () => {
    const { requests, user } = renderScreen(
      [...qualificationRoutes(), replaceRoute(() => jsonResponse({ items: [] }))],
      '?tab=worker&wkr=5001',
    );
    await screen.findByText('SYN-CERT-01');

    await user.click(screen.getByRole('button', { name: 'PENDING 자격 삭제' }));
    await user.click(within(qualificationPane()).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(1);
    });

    const body = JSON.parse(requests.find((request) => request.method === 'PUT')?.body ?? '{}') as {
      qualifications: unknown[];
    };

    expect(body.qualifications).toHaveLength(0);
  });

  /* C70 — 서버가 준 목록에 이미 겹친 짝이 있으면 그대로 보내도 서버가 거부한다. */
  it('서버가 준 목록에 이미 겹친 짝이 있으면 저장이 비활성이고 사유가 붙는다', async () => {
    renderScreen(
      qualificationRoutes([
        { ...savedQualifications[0], workerQualificationId: 8001, processId: null },
        { ...savedQualifications[0], workerQualificationId: 8002, processId: null },
      ]),
      '?tab=worker&wkr=5001',
    );

    await screen.findAllByText('(전체 공정)');

    expect(within(qualificationPane()).getByRole('button', { name: '저장' })).toBeDisabled();
    expect(screen.getByText(/저장은 자격 유형과 공정 짝이 겹치는 줄이 있어/)).toBeInTheDocument();
  });

  /* 저장 실패는 삼키지 않는다 — 무엇이 막았는지 밝힌다. */
  it('저장에 실패하면 배너에 사유가 나온다', async () => {
    const { user } = renderScreen(
      [
        ...qualificationRoutes(),
        replaceRoute(() =>
          jsonResponse(
            {
              message: '',
              errors: [{ scope: 'screen', code: 'UNIQUE', message: '이미 있는 자격입니다.' }],
            },
            { status: 400 },
          ),
        ),
      ],
      '?tab=worker&wkr=5001',
    );

    const dialog = await openEditDialog(user);
    await user.clear(within(dialog).getByLabelText('인증번호'));
    await user.type(within(dialog).getByLabelText('인증번호'), 'SYN-CERT-77');
    await user.click(within(dialog).getByRole('button', { name: '확인' }));
    await user.click(within(qualificationPane()).getByRole('button', { name: '저장' }));

    expect(await screen.findByText('이미 있는 자격입니다.')).toBeInTheDocument();
  });

  /*
   * **저장 실패 배너는 고른 작업자에 매인 자료다.** 조건을 바꿔 선택이 비워졌다가
   * 뒤로가기로 같은 작업자에 돌아오면, 초기화하지 않은 실패 배너가 **남의 실패처럼** 되살아난다
   * (사용자가 본 적 없는 맥락에서 「이미 있는 자격입니다」가 뜬다).
   */
  it('저장에 실패한 뒤 조건을 바꿨다 돌아오면 지난 실패 배너가 남지 않는다', async () => {
    const { history, user } = renderScreen(
      [
        ...qualificationRoutes(),
        replaceRoute(() =>
          jsonResponse(
            {
              message: '',
              errors: [{ scope: 'screen', code: 'UNIQUE', message: '이미 있는 자격입니다.' }],
            },
            { status: 400 },
          ),
        ),
      ],
      '?tab=worker&wkr=5001',
    );

    const dialog = await openEditDialog(user);
    await user.clear(within(dialog).getByLabelText('인증번호'));
    await user.type(within(dialog).getByLabelText('인증번호'), 'SYN-CERT-77');
    await user.click(within(dialog).getByRole('button', { name: '확인' }));
    await user.click(within(qualificationPane()).getByRole('button', { name: '저장' }));

    expect(await screen.findByText('이미 있는 자격입니다.')).toBeInTheDocument();

    // 조건을 바꾸면 보이는 작업자가 달라진다 — 주소에서 wkr가 사라진다.
    await user.type(screen.getByLabelText('작업자 검색'), 'SYN');
    await user.click(within(workerPane()).getByRole('button', { name: '조회' }));
    expect(history.search()).toBe('?tab=worker&q=SYN');

    history.back();
    expect(history.search()).toBe('?tab=worker&wkr=5001');

    await screen.findByText('SYN-CERT-01');
    expect(screen.queryByText('이미 있는 자격입니다.')).not.toBeInTheDocument();
  });

  /* 다른 작업자를 고르면 편집 중이던 초안이 남으면 안 된다. */
  it('다른 작업자를 고르면 편집 중이던 초안이 비워진다', async () => {
    const { user } = renderScreen(
      [
        ...qualificationRoutes(),
        workerDetailRoute(5002),
        {
          match: (request) => isGet(request, qualificationsPath(5002)),
          respond: () => jsonResponse({ items: [] }),
        },
      ],
      '?tab=worker&wkr=5001',
    );

    const dialog = await openEditDialog(user);
    await user.clear(within(dialog).getByLabelText('인증번호'));
    await user.type(within(dialog).getByLabelText('인증번호'), 'SYN-CERT-77');
    await user.click(within(dialog).getByRole('button', { name: '확인' }));
    await screen.findByText('SYN-CERT-77');

    await user.click(screen.getByRole('button', { name: 'SYN-W-0002' }));

    expect(await screen.findByText('등록된 자격·인증이 없습니다')).toBeInTheDocument();
    expect(screen.queryByText('SYN-CERT-77')).not.toBeInTheDocument();
  });
});

/**
 * **나가는 중인 자격 저장은 자기 작업자 밖으로 새지 않는다.**
 *
 * `resetIfIdle`가 나가는 중인 쓰기를 거두지 않는 것은 옳다(되먹임을 끊지 않는다 · `omf-mes#96`).
 * 그래서 거두지 못한 상태가 남는데, **좌 목록은 저장 중에도 잠기지 않으므로** 사용자는 그사이
 * 다른 작업자를 고를 수 있다. 끊는 것과 가리는 것을 갈라 두 면을 각각 잰다 —
 * 같은 화면의 거래처 역할 구획이 세운 형태를 그대로 따른다.
 */
describe('CommonCodeScreen — 나가는 중인 자격 저장의 매임과 잠금 (G-30)', () => {
  /** 옮겨 갈 작업자의 자격. 앞 작업자의 값(`SYN-CERT-01`)과 갈려야 어느 구획을 보는지 가른다. */
  const otherWorkerQualifications = [
    {
      ...savedQualifications[0],
      workerQualificationId: 8002,
      workerId: 5002,
      certificateNo: 'SYN-CERT-02',
    },
  ];

  const twoWorkerRoutes = (): StubRoute[] => [
    ...qualificationRoutes(),
    workerDetailRoute(5002),
    {
      match: (request) => isGet(request, qualificationsPath(5002)),
      respond: () => jsonResponse({ items: otherWorkerQualifications }),
    },
  ];

  /**
   * 두 작업자의 치환 경로를 **둘 다** 스텁한다. 5002 쪽을 비워 두면 두 번째 저장이 나갔을 때
   * 하네스가 「스텁 누락」으로 던져, 감지기가 재려는 **요청 수**가 아니라 다른 이유로 실패한다.
   */
  const replaceRoute = (workerId: number, respond: StubRoute['respond']): StubRoute => ({
    match: (request) =>
      request.method === 'PUT' && new URL(request.url).pathname === qualificationsPath(workerId),
    respond,
  });

  const qualificationSaveButton = (): HTMLElement =>
    within(qualificationPane()).getByRole('button', { name: '저장' });

  /** 5001에서 행 하나를 지워 저장을 낸다 — 초안을 고치는 가장 짧은 길이다. */
  const startSaveOnFirstWorker = async (user: ReturnType<typeof userEvent.setup>) => {
    await screen.findByText('SYN-CERT-01');
    await user.click(screen.getByRole('button', { name: 'PENDING 자격 삭제' }));
    await user.click(qualificationSaveButton());
  };

  const selectSecondWorker = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'SYN-W-0002' }));
    await screen.findByText('SYN-CERT-02');
  };

  /**
   * **막는 것과 가리는 것을 가른다.**
   *
   * 저장은 한 번에 하나뿐이라 옮겨 간 작업자도 **잠긴다**(막는 것 — 전역). 그러나 그 잠금은
   * 남의 저장이라는 **다른 사실**이므로 사유가 붙어야 하고, 진행 표시는 돌지 않아야 한다
   * (가리는 것 — 대상 축). 사유 없는 비활성은 사용자에게 「고장」으로 읽힌다.
   */
  it('저장이 나가는 중에 옮겨 간 작업자는 진행 표시 없이 사유와 함께 잠긴다', async () => {
    const { user } = renderScreen(
      [...twoWorkerRoutes(), replaceRoute(5001, neverFinishingResponse)],
      '?tab=worker&wkr=5001',
    );

    await startSaveOnFirstWorker(user);
    await waitFor(() => {
      expect(qualificationSaveButton()).toBeDisabled();
    });

    await selectSecondWorker(user);

    const pane = qualificationPane();
    const save = qualificationSaveButton();

    expect(save).toBeDisabled();
    expect(
      within(pane).getByText('저장은 다른 작업자의 저장이 끝난 뒤에 할 수 있습니다.'),
    ).toBeInTheDocument();
    /* 남의 저장으로 스피너를 돌리면 화면이 손댄 적 없는 작업자를 「저장 중」이라고 말한다. */
    expect(save).not.toHaveAttribute('aria-busy', 'true');
  });

  /*
   * 뒤늦게 온 앞 작업자의 실패가 지금 구획에 서면 사용자는 **손댄 적 없는 작업자가 막힌 줄** 안다.
   */
  it('저장이 뒤늦게 실패해도 그사이 옮겨 간 작업자에 배너가 서지 않는다', async () => {
    const deferred = deferredJsonResponse(400);

    const { user } = renderScreen(
      [...twoWorkerRoutes(), replaceRoute(5001, () => deferred.response)],
      '?tab=worker&wkr=5001',
    );

    await startSaveOnFirstWorker(user);
    await selectSecondWorker(user);

    /* 도착 전 — 남의 저장이 나가는 중이라 이 구획이 그 사유로 잠겨 있다. */
    expect(
      within(qualificationPane()).getByText(/저장은 다른 작업자의 저장이 끝난 뒤에/),
    ).toBeInTheDocument();

    await act(async () => {
      deferred.release({
        message: '',
        errors: [{ scope: 'screen', code: 'UNIQUE', message: '이미 있는 자격입니다.' }],
      });
    });

    /*
     * **잠금이 풀리는 것으로 실패가 도착한 것을 안다** — 「자격 추가」가 다시 열리는 순간은
     * 나가는 중이던 저장이 끝났을 때뿐이다. 도착 전에 음성 단언을 하면 늘 통과한다.
     */
    await waitFor(() => {
      expect(within(qualificationPane()).getByRole('button', { name: '자격 추가' })).toBeEnabled();
    });
    expect(
      within(qualificationPane()).queryByText('이미 있는 자격입니다.'),
    ).not.toBeInTheDocument();
  });

  /*
   * **끊지는 않는다.** 가리는 축을 세운 뒤에도 `resetIfIdle`의 「나가는 중이면 손대지 않는다」
   * 가드는 살아 있어야 한다. 가드가 없으면 옵저버가 떨어져 **무효화도 성공도 실패도 오지
   * 않는다** — 서버에는 저장됐는데 화면에는 아무 흔적도 남지 않는다(`omf-mes#96`).
   */
  it('저장이 나가는 중에 작업자를 옮겨도 그 저장의 되먹임이 끊기지 않는다', async () => {
    const deferred = deferredJsonResponse(200);

    const { requests, user } = renderScreen(
      [...twoWorkerRoutes(), replaceRoute(5001, () => deferred.response)],
      '?tab=worker&wkr=5001',
    );

    await startSaveOnFirstWorker(user);
    await waitFor(() => {
      expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(1);
    });

    await selectSecondWorker(user);

    await act(async () => {
      deferred.release({ items: [] });
    });

    expect(await screen.findByText('저장했습니다')).toBeInTheDocument();
  });

  /*
   * **응답이 앉는 자리는 보낸 요청의 캐시 키다.**
   *
   * `onSuccess`는 `mutate`를 부른 렌더에 닫혀 있어(공통 훅이 그것을 `mutate`의 두 번째
   * 인자로 넘긴다) 그사이 선택이 옮겨 가도 남의 자리에 앉지 않는다 — 「지금 보고 있는」
   * 작업자 번호를 읽게 되면 앞 작업자의 응답이 **손댄 적 없는 작업자의 표를 덮는다.**
   * 배너·진행 표시와 달리 이 갈래는 **틀린 자료를 사실처럼 보여 주므로** 가장 조용하다.
   */
  it('저장이 나가는 중에 작업자를 옮겨도 그 응답이 옮겨 간 작업자의 표를 덮지 않는다', async () => {
    const deferred = deferredJsonResponse(200);
    let otherListCalls = 0;

    const { requests, user } = renderScreen(
      [
        ...qualificationRoutes(),
        workerDetailRoute(5002),
        {
          match: (request) => isGet(request, qualificationsPath(5002)),
          /*
           * 5002의 **첫 조회만** 응답하고 무효화가 낸 재조회는 열어 둔다.
           * 재조회가 5002의 자료를 곧바로 다시 세우면 남의 자리에 앉은 응답이 **스쳐 지나가**
           * 이 감지기가 그 순간을 붙잡지 못한다 — 실제로도 재조회가 늦거나 실패하면
           * 덮인 값이 그대로 남는다.
           */
          respond: () => {
            otherListCalls += 1;

            return otherListCalls === 1
              ? jsonResponse({ items: otherWorkerQualifications })
              : neverFinishingResponse();
          },
        },
        replaceRoute(5001, () => deferred.response),
      ],
      '?tab=worker&wkr=5001',
    );

    await startSaveOnFirstWorker(user);
    await waitFor(() => {
      expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(1);
    });

    await selectSecondWorker(user);

    /* 5001의 응답은 **빈 목록**이다 — 그 저장이 하나뿐인 행을 지웠다. */
    await act(async () => {
      deferred.release({ items: [] });
    });

    /* 양성 앵커 — 응답이 실제로 도착했다. 그 뒤에 5002의 표를 잰다. */
    expect(await screen.findByText('저장했습니다')).toBeInTheDocument();
    expect(within(qualificationPane()).getByText('SYN-CERT-02')).toBeInTheDocument();
    expect(
      within(qualificationPane()).queryByText('등록된 자격·인증이 없습니다'),
    ).not.toBeInTheDocument();
  });

  /*
   * **두 저장이 겹치지 않는다.** 훅 하나에 요청 하나라, 두 번째 `mutate`는 앞 요청에서
   * 옵저버를 떼어 낸다 — 앞 저장이 400이면 **어디에도 표시되지 않는 실패**가 되고,
   * 성공이면 캐시가 저장 전 값으로 남는다. 잠긴 컨트롤을 실제로 눌러 그 겹침을 시도한다.
   */
  it('남의 저장이 나가는 중에는 옮겨 간 작업자의 저장이 시작되지 않는다', async () => {
    const { requests, user } = renderScreen(
      [
        ...twoWorkerRoutes(),
        replaceRoute(5001, neverFinishingResponse),
        replaceRoute(5002, neverFinishingResponse),
      ],
      '?tab=worker&wkr=5001',
    );

    await startSaveOnFirstWorker(user);
    await waitFor(() => {
      expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(1);
    });

    await selectSecondWorker(user);
    await user.click(screen.getByRole('button', { name: 'PENDING 자격 삭제' }));
    await user.click(qualificationSaveButton());

    expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(1);
    expect(
      within(qualificationPane()).getByText(/저장은 다른 작업자의 저장이 끝난 뒤에/),
    ).toBeInTheDocument();
  });

  /*
   * **구획 전체가 잠긴다.** 성공이 초안을 비워 되세우기를 다시 열므로, 저장 중 표를 고칠 수
   * 있게 두면 **성공이 그 편집을 조용히 지운다.** 형제 구획(거래처 역할)이 체크칸까지 전역으로
   * 잠그는 것과 같은 판단이다.
   */
  it('저장이 나가는 중에는 자격 구획의 다섯 컨트롤이 모두 잠긴다', async () => {
    const { user } = renderScreen(
      [...qualificationRoutes(), replaceRoute(5001, neverFinishingResponse)],
      '?tab=worker&wkr=5001',
    );

    await screen.findByText('SYN-CERT-01');
    await user.click(screen.getByRole('button', { name: 'PENDING 자격 수정' }));

    const dialog = screen.getByRole('dialog');
    await user.clear(within(dialog).getByLabelText('인증번호'));
    await user.type(within(dialog).getByLabelText('인증번호'), 'SYN-CERT-77');
    await user.click(within(dialog).getByRole('button', { name: '확인' }));
    await user.click(qualificationSaveButton());

    const pane = qualificationPane();

    await waitFor(() => {
      expect(within(pane).getByRole('button', { name: '자격 추가' })).toBeDisabled();
    });
    expect(within(pane).getByRole('button', { name: 'PENDING 자격 수정' })).toBeDisabled();
    expect(within(pane).getByRole('button', { name: 'PENDING 자격 삭제' })).toBeDisabled();
    expect(within(pane).getByRole('button', { name: '취소' })).toBeDisabled();
    expect(qualificationSaveButton()).toBeDisabled();
  });
});

/*
 * 탭마다 선택 축의 주소 키가 다르다 — 조직 탭은 `bu`, 작업자 탭은 `dept`.
 *
 * **읽는 쪽과 쓰는 쪽을 함께 고정해야 한다.** 단위 테스트(`readScopedFilters`)는 읽는 쪽만 덮고,
 * 「각 탭이 `toScopedSearchParams`에 어떤 키를 넘기는가」는 화면에만 있다. 그 배선이 뒤바뀌면
 * 주소에는 다른 탭의 키가 실리고 화면은 자기 키를 읽으므로 **필터가 조용히 아무 일도 하지 않는다** —
 * 선택칸이 되돌아가고 요청에도 조건이 실리지 않는다.
 *
 * 그래서 선택칸을 실제로 골라 「조회」를 누르는 경로를 여기서만 밟는다.
 * 디자인 시스템 `Select`는 네이티브 `<select>`가 아니라 트리거를 누른 뒤 선택지를 누른다.
 */
describe('CommonCodeScreen — 탭마다 자기 선택 축 키를 쓴다', () => {
  it('작업자 탭에서 부서를 골라 조회하면 dept로 실리고 요청에도 실린다', async () => {
    const { requests, history, user } = renderScreen(workerRoutes(), '?tab=worker');
    await screen.findByRole('button', { name: 'SYN-W-0001' });

    await user.click(within(workerPane()).getByLabelText('부서'));
    await user.click(screen.getByRole('option', { name: /SYN-DEPT-01/ }));
    await user.click(within(workerPane()).getByRole('button', { name: '조회' }));

    expect(history.search()).toContain('dept=3001');
    expect(history.search()).not.toContain('bu=');

    // 주소에서 끝나지 않는다 — 그 조건이 실제로 서버로 나가야 필터가 「먹는다」.
    await waitFor(() => {
      expect(workerRequests(requests).at(-1)?.url.searchParams.get('departmentId')).toBe('3001');
    });
  });

  it('조직 탭에서 사업부를 골라 조회하면 bu로 실리고 요청에도 실린다', async () => {
    const { requests, history, user } = renderScreen(orgRoutes(), '?tab=org');
    await screen.findByRole('button', { name: 'SYN-DEPT-01' });

    await user.click(within(departmentPane()).getByLabelText('사업부'));
    await user.click(screen.getByRole('option', { name: /SYN-BU-01/ }));
    await user.click(within(departmentPane()).getByRole('button', { name: '조회' }));

    expect(history.search()).toContain('bu=4001');
    expect(history.search()).not.toContain('dept=');

    await waitFor(() => {
      expect(departmentRequests(requests).at(-1)?.url.searchParams.get('businessUnitId')).toBe(
        '4001',
      );
    });
  });
});

/* ── 거래처 역할 탭 ─────────────────────────────────────────────────────────── */

const PARTNERS_PATH = '/mdm/partners';

const partnerRolesPath = (partnerId: number): string =>
  `${PARTNERS_PATH}/${String(partnerId)}/roles`;

const partnerListRoute = (
  items = partnerFixtures,
  pageMeta: PageStub = { page: 1, size: 50, total: partnerFixtures.length },
): StubRoute => ({
  match: (request) => isGet(request, PARTNERS_PATH),
  respond: () => jsonResponse({ items, page: pageMeta }),
});

const partnerDetailPath = (partnerId: number): string => `${PARTNERS_PATH}/${String(partnerId)}`;

/**
 * 목록 스텁에 **없는** 거래처. 기본 정보가 목록에서 오지 않는다는 사실이 이 픽스처의 요점이다 —
 * 조건을 바꾼 뒤·다른 쪽으로 넘어간 뒤·링크를 받은 뒤가 모두 이 상태다.
 */
const outsideListPartner: Partner = {
  partnerId: 9999,
  partnerCode: 'SAMPLE-PTNR-Z',
  partnerName: '샘플 거래처 지',
  countryCode: 'SAMPLE-CTRY',
  erpPartnerCode: 'SAMPLE-ERP-Z',
  isActive: true,
};

/**
 * 거래처 단건 — **기본 정보의 출처**(#173). 목록에 실려 있는지와 무관하다.
 *
 * ⛔ **`ETag`를 얹지 않는다** — 계약이 이 응답에 선언하지 않는다. 여기서 토큰을 주면 역할
 * 치환의 잠금 토큰이 어느 경로에서 왔는지 갈리지 않고, 상세 경로에서 꺼내는 잘못된 배선도
 * 통과해 버린다(#174가 정정한 그 실수다).
 *
 * **모르는 번호면 던진다** — 이 파일의 하네스 규율이 「조용히 두지 않고 던진다」이기 때문이다
 * (`test/api-harness.tsx`). 픽스처에 없는 번호를 인자 없이 부르면 `JSON.stringify(undefined)`가
 * 본문 없는 응답을 만들어, 스텁을 잘못 부른 시험이 요란하게 죽는 대신 **상세가 영영 서지 않는
 * 상태로 굳는다.**
 */
const partnerDetailRoute = (partnerId = 9001, partner?: Partner): StubRoute => ({
  match: (request) => isGet(request, partnerDetailPath(partnerId)),
  respond: () => {
    const found = partner ?? partnerFixtures.find((row) => row.partnerId === partnerId);

    if (found === undefined) {
      throw new Error(`거래처 ${String(partnerId)} 픽스처가 없습니다 — 기본 정보를 넘기세요.`);
    }

    return jsonResponse(found);
  },
});

/**
 * 역할 조회가 내려 주는 잠금 토큰. 치환의 `If-Match`가 **이 값 그대로**여야 한다.
 *
 * **계약이 이 헤더를 선언한다**(#174 — 이 자원의 토큰 원천이 역할 목록 조회로 확정됐다).
 * 그래서 이것이 기본 상태다. 서버가 아직 주지 않는 상태는 `partnerRolesRouteWithoutEtag`가
 * 따로 재현한다 — 계약이 치환에 `If-Match`를 **필수**로 요구하므로(#173) 그때 저장은 요청조차
 * 만들지 못한다.
 */
const ROLES_ETAG = '"7"';

/**
 * 재조회가 주는 **다른** 토큰. 값이 갈리는 것 자체가 요점이라 `ROLES_ETAG`와 같아서는 안 된다.
 */
const ROLES_ETAG_AFTER_RELOAD = '"8"';

/** 역할 목록 응답. **잠금 토큰을 얹는다** — 이 경로가 치환의 `If-Match` 원천이다. */
const rolesResponse = (roles: unknown): Response =>
  jsonResponse(roles, { headers: { ETag: ROLES_ETAG } });

/** 역할 목록 — **배열만 온다**(쪽 나눔이 없다 · 계약 실측). */
const partnerRolesRoute = (partnerId = 9001, roles = partnerRoleFixtures): StubRoute => ({
  match: (request) => isGet(request, partnerRolesPath(partnerId)),
  respond: () => rolesResponse(roles),
});

/**
 * 잠금 토큰을 주지 않는 역할 목록 — **계약은 선언했으나 서버가 아직 주지 않는 상태**(#174).
 *
 * 그 상태가 실제로 있을 수 있으므로 갈래를 지운다는 뜻이 아니다 — 계약은 구현보다 앞선다.
 *
 * 부여분을 인자로 받는다. 기본값은 어휘 밖 코드가 없는 쪽이라 **토큰 축만** 갈리고,
 * 어휘 밖 코드까지 얹으면 두 갈래가 만나는 실사용 경로가 된다(확인 창 → 토큰 벽).
 */
const partnerRolesRouteWithoutEtag = (
  partnerId = 9001,
  roles: PartnerRoleRow[] = vocabularyRoleFixtures,
): StubRoute => ({
  match: (request) => isGet(request, partnerRolesPath(partnerId)),
  respond: () => jsonResponse(roles),
});

const partnerRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requestsTo(requests, PARTNERS_PATH);

const partnerDetailRequests = (requests: RecordedRequest[], partnerId = 9001): RecordedRequest[] =>
  requestsTo(requests, partnerDetailPath(partnerId));

/**
 * 역할 **조회**만 센다 — 치환(`PUT`)이 같은 경로를 쓰므로 경로만으로 걸러 내면 쓰기까지 섞인다.
 */
const roleGetRequests = (requests: RecordedRequest[], partnerId = 9001): RecordedRequest[] =>
  requests.filter(
    (request) => request.method === 'GET' && request.url.pathname === partnerRolesPath(partnerId),
  );

const partnerPane = (): HTMLElement => screen.getByRole('region', { name: '거래처' });

const partnerRolePane = (): HTMLElement => screen.getByRole('region', { name: '거래처 역할' });

const partnerRoutes = (): StubRoute[] => [
  partnerListRoute(),
  partnerDetailRoute(),
  partnerRolesRoute(),
];

describe('CommonCodeScreen — 거래처 목록 조회 (C14·C16)', () => {
  it('거래처 탭에 들어오면 목록 요청이 한 번 나가고 조건이 없으면 쿼리도 없다', async () => {
    const { requests } = renderScreen(partnerRoutes(), '?tab=partner');

    expect(await screen.findByRole('button', { name: 'SAMPLE-PTNR-A' })).toBeInTheDocument();
    expect(partnerRequests(requests)).toHaveLength(1);
    expect(partnerRequests(requests)[0]?.url.search).toBe('');
  });

  it('걸린 조건만 요청 쿼리에 실린다', async () => {
    const { requests } = renderScreen(partnerRoutes(), '?tab=partner&q=SAMPLE&inactive=1&page=2');
    await screen.findByRole('button', { name: 'SAMPLE-PTNR-A' });

    const sent = partnerRequests(requests)[0];
    expect(sent?.url.searchParams.get('q')).toBe('SAMPLE');
    expect(sent?.url.searchParams.get('includeInactive')).toBe('true');
    expect(sent?.url.searchParams.get('page')).toBe('2');
  });

  /*
   * C14 — 이 탭은 역할을 **붙이는** 곳이라 역할이 아직 없는 거래처가 반드시 보여야 한다.
   * 계약에 `roleTypeCode` 질의가 있다는 사실이 그것을 쓸 이유가 되지 않는다.
   */
  it('역할 코드를 목록 쿼리에 싣지 않는다', async () => {
    const { requests } = renderScreen(partnerRoutes(), '?tab=partner&q=SAMPLE');
    await screen.findByRole('button', { name: 'SAMPLE-PTNR-A' });

    expect(partnerRequests(requests)[0]?.url.searchParams.has('roleTypeCode')).toBe(false);
  });

  it('다른 탭의 목록을 함께 조회하지 않는다', async () => {
    const { requests } = renderScreen(partnerRoutes(), '?tab=partner');
    await screen.findByRole('button', { name: 'SAMPLE-PTNR-A' });

    expect(codeGroupRequests(requests)).toHaveLength(0);
    expect(departmentRequests(requests)).toHaveLength(0);
    expect(workerRequests(requests)).toHaveLength(0);
  });

  /*
   * 반대 방향도 잰다(뮤테이션에서 살아남은 축) — **보이지 않는 목록을 받아 둘 이유가 없고**,
   * 주소 키(`q`·`inactive`·`page`)를 탭이 공유하므로 「코드그룹을 찾던 말」로 거래처를
   * 조회하게 된다. 그 요청은 화면에 아무것도 그리지 않아 눈으로는 드러나지 않는다.
   *
   * **주소에 `ptn`을 실어 둔다.** 없으면 상세·역할 조회는 어차피 나갈 수 없어 아래 두 단언이
   * 항상 참인 빈 단언이 된다 — 선택에 매인 조회 둘의 탭 경계(`isPartnerTab`)를 지키는 유일한
   * 감지기다.
   */
  it('다른 탭에 있는 동안에는 거래처를 조회하지 않는다', async () => {
    const { requests } = renderScreen(
      [codeGroupListRoute(), codeGroupDetailRoute(), codeValueListRoute()],
      '?q=SYN&grp=1001&ptn=9001',
    );
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    expect(partnerRequests(requests)).toHaveLength(0);
    expect(partnerDetailRequests(requests)).toHaveLength(0);
    expect(requestsTo(requests, partnerRolesPath(9001))).toHaveLength(0);
  });

  /* C16 — 실패를 「없습니다」로 보이면 사실과 다른 안내가 된다. */
  it('거래처 목록 조회에 실패하면 배너를 내고 빈 상태를 함께 내지 않는다', async () => {
    renderScreen(
      [
        {
          match: (request) => isGet(request, PARTNERS_PATH),
          respond: () => jsonResponse({ message: '' }, { status: 500 }),
        },
      ],
      '?tab=partner',
    );

    expect(await screen.findByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByText('등록된 거래처가 없습니다')).not.toBeInTheDocument();
  });
});

describe('CommonCodeScreen — 거래처 선택과 역할 읽기 (C15·C17·C19·C20)', () => {
  it('거래처를 고르면 상세와 역할 요청이 한 번씩 나가고 주소에 ptn이 붙는다', async () => {
    const { requests, history, user } = renderScreen(partnerRoutes(), '?tab=partner');
    await screen.findByRole('button', { name: 'SAMPLE-PTNR-A' });

    // 고르기 전에는 나가지 않는다 — 아직 아무 거래처도 가리키지 않는다(C16).
    expect(requestsTo(requests, partnerRolesPath(9001))).toHaveLength(0);
    expect(partnerDetailRequests(requests)).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'SAMPLE-PTNR-A' }));
    await screen.findByText('고객사');

    expect(requestsTo(requests, partnerRolesPath(9001))).toHaveLength(1);
    expect(partnerDetailRequests(requests)).toHaveLength(1);
    expect(history.search()).toBe('?tab=partner&ptn=9001');
    expect(screen.getByRole('button', { name: 'SAMPLE-PTNR-A' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  /* C15 — 주소가 정본이다. 주소로 바로 들어와도 같은 화면이 선다. */
  it('주소로 바로 들어와도 고른 거래처의 역할이 선다', async () => {
    const { requests } = renderScreen(partnerRoutes(), '?tab=partner&ptn=9001');

    expect(await screen.findByText('고객사')).toBeInTheDocument();
    expect(requestsTo(requests, partnerRolesPath(9001))).toHaveLength(1);
  });

  /*
   * C17 — 기본 정보는 **단건 조회**에서 온다(#173).
   * **값 표기만 있다** — 계약에 쓰기 경로가 없어 폼 컨트롤을 잠그는 것이 아니라 두지 않는다.
   */
  it('고른 거래처의 기본 정보가 값 표기와 사유로 선다', async () => {
    renderScreen(partnerRoutes(), '?tab=partner&ptn=9001');

    const pane = await screen.findByRole('region', { name: '거래처 기본 정보' });

    expect(within(pane).getByLabelText('거래처코드')).toHaveTextContent('SAMPLE-PTNR-A');
    expect(within(pane).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(pane).queryAllByRole('button')).toHaveLength(0);
    expect(
      within(pane).getByText(
        '외부 시스템에서 받은 자료라 여기서 수정할 수 없습니다. 원본 시스템에서 변경하세요.',
      ),
    ).toBeInTheDocument();
  });

  it('고르기 전에는 무엇이 채워지는지 안내한다', async () => {
    renderScreen(partnerRoutes(), '?tab=partner');
    await screen.findByRole('button', { name: 'SAMPLE-PTNR-A' });

    expect(
      screen.getByText('좌측에서 거래처를 고르면 여기에 그 거래처의 역할이 보입니다'),
    ).toBeInTheDocument();
  });

  /*
   * **기본 정보는 목록에 매여 있지 않다**(#173 — 단건 조회 신설). 종전에는 목록 밖 거래처를
   * 주소가 가리키면 채울 자료가 없어 「목록 밖 선택」 안내로 물러섰다. 검색어를 바꾼 뒤·다른
   * 쪽으로 넘어간 뒤·링크를 받은 뒤가 모두 그 상태였다 — 그 갈래를 정의째 없앤다.
   *
   * 역할까지 함께 재는 이유는, 기본 정보만 서고 역할이 서지 않으면 이 탭이 할 일을 못 하기
   * 때문이다(이 탭이 고치는 것은 역할이다).
   */
  it('목록에 없는 거래처를 주소가 가리켜도 기본 정보와 역할이 선다', async () => {
    renderScreen(
      [
        partnerListRoute(),
        partnerDetailRoute(9999, outsideListPartner),
        partnerRolesRoute(9999, vocabularyRoleFixtures),
      ],
      '?tab=partner&ptn=9999',
    );

    const pane = await screen.findByRole('region', { name: '거래처 기본 정보' });

    expect(within(pane).getByLabelText('거래처코드')).toHaveTextContent('SAMPLE-PTNR-Z');
    expect(await screen.findByText('고객사')).toBeInTheDocument();
  });

  /*
   * **좌 목록의 사정이 우 칸을 막지 않는다.** 두 조회가 갈렸으므로 목록이 실패해도 고른 거래처는
   * 그대로 선다 — 종전에는 목록 실패가 우 칸까지 가렸다. 좌 목록은 자기 자리에서 실패를 낸다.
   */
  it('목록 조회가 실패해도 고른 거래처의 기본 정보와 역할이 선다', async () => {
    renderScreen(
      [
        {
          match: (request) => isGet(request, PARTNERS_PATH),
          respond: () => jsonResponse({ message: '' }, { status: 500 }),
        },
        partnerDetailRoute(),
        partnerRolesRoute(),
      ],
      '?tab=partner&ptn=9001',
    );

    const pane = await screen.findByRole('region', { name: '거래처 기본 정보' });

    expect(within(pane).getByLabelText('거래처코드')).toHaveTextContent('SAMPLE-PTNR-A');
    expect(await screen.findByText('고객사')).toBeInTheDocument();
    /* 목록 실패는 좌 목록이 낸다 — 우 칸이 대신 말하지 않는다. */
    expect(within(partnerPane()).getByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
  });

  /*
   * C14 — 상세를 **불러오는 동안**은 빈 칸이 아니라 진행 안내를 낸다. 빈 칸을 보이면 자료가
   * 없는 것인지 아직 받는 중인지 구분되지 않는다.
   */
  it('상세를 불러오는 동안 진행 안내가 선다', () => {
    renderScreen(partnerRoutes(), '?tab=partner&ptn=9001');

    expect(
      within(partnerRolePane()).getByRole('status', { name: '거래처 정보를 불러오는 중' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '거래처 기본 정보' })).not.toBeInTheDocument();
  });

  /* C14 — 실패를 「없는 거래처」로 보이면 사실과 다른 안내가 된다. 조치도 다르다(재시도 대 다시 고르기). */
  it('상세 조회에 실패하면 재시도 배너가 서고 없는 거래처로 말하지 않는다', async () => {
    renderScreen(
      [
        partnerListRoute(),
        {
          match: (request) => isGet(request, partnerDetailPath(9001)),
          respond: () => jsonResponse({ message: '' }, { status: 500 }),
        },
        partnerRolesRoute(),
      ],
      '?tab=partner&ptn=9001',
    );

    const pane = await screen.findByRole('region', { name: '거래처 역할' });

    await waitFor(() => {
      expect(within(pane).getByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    });
    expect(within(pane).getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(screen.queryByText('고른 거래처를 찾을 수 없습니다')).not.toBeInTheDocument();
  });

  /**
   * C14 — **없는 거래처는 안내만 낸다.** 다시 시도해도 나타나지 않으므로 재시도를 권하지 않는다.
   *
   * ⛔ **주소에서 선택을 지우지 않는다.** 형제 화면 셋이 그 정리를 하는 것은 그쪽 상세가 **목록
   * 조건에 매인 선택**이라 조건이 바뀌면 안내가 가리킬 것이 없어지기 때문이다. 거래처 선택 키는
   * 조건과 독립이므로 그 전제가 없다 — 지우면 사용자는 무엇을 열려 했는지 잃는다.
   */
  it('없는 거래처를 주소가 가리키면 안내만 내고 주소는 그대로 둔다', async () => {
    const { history } = renderScreen(
      [
        partnerListRoute(),
        {
          match: (request) => isGet(request, partnerDetailPath(9999)),
          respond: () => jsonResponse({ message: '' }, { status: 404 }),
        },
        partnerRolesRoute(9999, []),
      ],
      '?tab=partner&ptn=9999',
    );

    expect(await screen.findByText('고른 거래처를 찾을 수 없습니다')).toBeInTheDocument();
    /* 재시도로 풀리지 않는 상태라 그 버튼을 내지 않는다. */
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
    expect(history.search()).toBe('?tab=partner&ptn=9999');
  });

  /* C20 — 어휘 밖 코드를 감추면 통째 교체 저장에서 조용히 해제된다. */
  it('어휘 밖 역할이 표식과 함께 보인다', async () => {
    renderScreen(partnerRoutes(), '?tab=partner&ptn=9001');
    await screen.findByText('고객사');

    const pane = partnerRolePane();
    expect(within(pane).getByText('샘플 역할 엑스')).toBeInTheDocument();
    expect(within(pane).getByText('이 화면이 모르는 역할')).toBeInTheDocument();
  });

  /**
   * C19 — 실패를 「지정된 역할이 없습니다」로 보이면 역할이 없는 거래처로 읽힌다.
   *
   * ⚠ **기본 정보 구획이 「역할 실패 갈래를 실제로 밟았다」의 앵커다.** 상세 실패와 역할 실패는
   * 같은 배너 부품을 같은 구획 안에 내므로 문면·범위로는 갈리지 않는다 — 그래서 상세 스텁을
   * 빠뜨려도 이 시험이 통과해 버린다(상세가 대신 실패해 같은 배너를 낸다). 기본 정보 구획은
   * **상세가 성공했을 때만** 서므로, 그것을 먼저 잡으면 역할 쪽 실패임이 확정된다.
   */
  it('역할 조회에 실패하면 배너를 내고 빈 상태를 함께 내지 않는다', async () => {
    renderScreen(
      [
        partnerListRoute(),
        partnerDetailRoute(),
        {
          match: (request) => isGet(request, partnerRolesPath(9001)),
          respond: () => jsonResponse({ message: '' }, { status: 500 }),
        },
      ],
      '?tab=partner&ptn=9001',
    );

    expect(await screen.findByRole('region', { name: '거래처 기본 정보' })).toBeInTheDocument();
    expect(await screen.findByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByText('지정된 역할이 없습니다')).not.toBeInTheDocument();
  });

  it('역할이 하나도 없으면 없다고 낸다', async () => {
    renderScreen(
      [partnerListRoute(), partnerDetailRoute(), partnerRolesRoute(9001, [])],
      '?tab=partner&ptn=9001',
    );

    expect(await screen.findByText('지정된 역할이 없습니다')).toBeInTheDocument();
  });

  /*
   * **고르는 것만으로는 아무것도 저장되지 않는다.** 저장은 사용자가 「저장」을 누를 때만
   * 나간다 — 통째 교체라 무심코 나간 요청 하나가 역할을 통째로 갈아 치운다.
   * 다른 거래처를 눌러 선택을 옮긴 뒤에도 마찬가지다.
   */
  it('거래처를 고르기만 하면 쓰기 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen(
      [
        partnerListRoute(),
        partnerDetailRoute(),
        partnerDetailRoute(9002),
        partnerRolesRoute(),
        partnerRolesRoute(9002, []),
      ],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    await user.click(screen.getByRole('button', { name: 'SAMPLE-PTNR-B' }));
    await screen.findByText('지정된 역할이 없습니다');

    const writes = requests.filter(
      (request) => request.url.pathname.startsWith(PARTNERS_PATH) && request.method !== 'GET',
    );

    expect(writes).toHaveLength(0);
  });
});

describe('CommonCodeScreen — 거래처 조건과 탭 전환 (C11·C15)', () => {
  it('조건을 바꾸면 선택이 주소에서 사라진다', async () => {
    const { history, user } = renderScreen(partnerRoutes(), '?tab=partner&ptn=9001');
    await screen.findByText('고객사');

    await user.click(within(partnerPane()).getByRole('checkbox', { name: '미사용 포함' }));

    expect(history.search()).toBe('?tab=partner&inactive=1');
  });

  it('쪽을 옮기면 선택이 주소에서 사라진다', async () => {
    const { history, user } = renderScreen(
      [
        partnerListRoute(partnerFixtures, { page: 1, size: 2, total: 9 }),
        partnerDetailRoute(),
        partnerRolesRoute(),
      ],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    await user.click(within(partnerPane()).getByRole('button', { name: '다음' }));

    expect(history.search()).toBe('?tab=partner&page=2');
  });

  /* C11 — 탭마다 목록이 통째로 다르다. 선택 번호를 넘기면 그 탭에 없는 자원을 조회하게 된다. */
  it('거래처 탭으로 바꾸면 이전 탭의 조건·선택이 사라진다', async () => {
    const { history, user } = renderScreen(
      [codeGroupListRoute(), codeGroupDetailRoute(), codeValueListRoute(), ...partnerRoutes()],
      '?q=SYN&inactive=1&page=2&grp=1001',
    );
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    await user.click(screen.getByRole('tab', { name: '거래처 역할' }));

    expect(history.search()).toBe('?tab=partner');
    expect(await screen.findByRole('button', { name: 'SAMPLE-PTNR-A' })).toBeInTheDocument();
  });

  it('거래처 탭에서 다른 탭으로 바꾸면 거래처 조건·선택이 사라진다', async () => {
    const { history, user } = renderScreen(
      [codeGroupListRoute(), ...partnerRoutes()],
      '?tab=partner&q=SAMPLE&inactive=1&ptn=9001',
    );
    await screen.findByText('고객사');

    await user.click(screen.getByRole('tab', { name: '공통코드' }));

    expect(history.search()).toBe('?tab=code');
    expect(await screen.findByRole('button', { name: 'SYN-GRP-01' })).toBeInTheDocument();
  });

  /* 탭 전환도 한 조작이다 — 뒤로가기 한 번이면 직전 주소로 돌아간다. */
  it('거래처 탭으로 바꾼 뒤 뒤로가기 한 번이면 직전 주소로 돌아간다', async () => {
    const { history, user } = renderScreen([codeGroupListRoute(), ...partnerRoutes()], '?q=SYN');
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    const before = history.search();

    await user.click(screen.getByRole('tab', { name: '거래처 역할' }));
    await screen.findByRole('button', { name: 'SAMPLE-PTNR-A' });

    history.back();
    expect(history.search()).toBe(before);
  });
});

/* ── 거래처 역할 편집과 통째 교체 저장 (C24~C35) ───────────────────────────── */

/** 어휘 밖 코드. 어휘 표에 없으므로 여기서 짓는다 — 화면이 모르는 값이 이 시험의 요점이다. */
const UNKNOWN_ROLE_CODE = 'SAMPLE-ROLE-X';

/** 이름과 표식이 붙어 읽히지 않게 사이에 낱말 공백 하나가 든다. */
const UNKNOWN_ROLE_LABEL = '샘플 역할 엑스 이 화면이 모르는 역할';

const roleCheckbox = (name: string): HTMLElement =>
  within(partnerRolePane()).getByRole('checkbox', { name });

const partnerSaveButton = (): HTMLElement =>
  within(partnerRolePane()).getByRole('button', { name: '저장' });

const rolesReplaceRoute = (respond: StubRoute['respond'], partnerId = 9001): StubRoute => ({
  match: (request) =>
    request.method === 'PUT' && new URL(request.url).pathname === partnerRolesPath(partnerId),
  respond,
});

/**
 * 어휘 밖 코드가 섞이지 않은 부여분과 그 스텁.
 *
 * **저장 경로를 재는 시험이 이것을 쓴다.** `partnerRoleFixtures`에는 어휘 밖 코드가 하나
 * 섞여 있고, 계약이 그 값을 400으로 거절하게 된 뒤로(#173) 그 거래처의 저장은 **무엇을
 * 눌러도 해제 확인 창을 지난다** — 그 코드를 실을 수 없어 반드시 잃기 때문이다. 저장의
 * 다른 축(헤더·본문·잠금·실패)을 재려는 시험이 창의 사정까지 함께 지고 갈 이유가 없다.
 * 어휘 밖 코드가 **주제**인 시험은 그대로 `partnerRoleFixtures`를 쓴다.
 */
const vocabularyRoleFixtures = partnerRoleFixtures.filter(
  (role) => role.roleTypeCode !== UNKNOWN_ROLE_CODE,
);

const vocabularyPartnerRoutes = (): StubRoute[] => [
  partnerListRoute(),
  partnerDetailRoute(),
  partnerRolesRoute(9001, vocabularyRoleFixtures),
];

/**
 * 서버는 정규화한 결과를 돌려준다 — 화면이 그 응답으로 초안을 다시 세워야 한다.
 *
 * 어휘 안 코드는 **표에서 꺼내 쓴다**(결정 2) — 리터럴은 어휘 고정 감지기 한 자리에만 둔다.
 * `SAMPLE-ROLE-X`는 어휘 표에 없는 값이라 여기서 짓는다.
 */
const replacedRoles = [
  { roleTypeCode: UNKNOWN_ROLE_CODE, roleTypeName: '샘플 역할 엑스' },
  { roleTypeCode: PARTNER_ROLE_CODES.disposal, roleTypeName: '폐기처리' },
];

const putRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.method === 'PUT');

const sentRoleCodes = (requests: RecordedRequest[]): unknown => {
  const body = JSON.parse(putRequests(requests)[0]?.body ?? '{}') as { roleTypeCodes?: unknown };

  return body.roleTypeCodes;
};

describe('CommonCodeScreen — 역할 체크와 저장 (C24·C29·C30)', () => {
  /* C24 — 고친 것이 없는데 저장이 열려 있으면 「같은 것을 다시 저장」이 가능해진다. */
  it('체크를 바꾸기 전에는 저장이 잠겨 있고 바꾸면 열린다', async () => {
    const { user } = renderScreen(partnerRoutes(), '?tab=partner&ptn=9001');
    await screen.findByText('고객사');

    expect(partnerSaveButton()).toBeDisabled();

    await user.click(roleCheckbox('공급사'));

    expect(partnerSaveButton()).toBeEnabled();
  });

  /*
   * 체크 순서는 자료가 아니라 조작의 흔적이다 — 순서로 판정하면 껐다가 되돌려 놓아도
   * 「고쳤다」로 남아 사용자가 아무것도 바꾸지 않은 저장을 낼 수 있다.
   */
  it('체크를 껐다 다시 켜면 저장이 다시 잠긴다', async () => {
    const { user } = renderScreen(partnerRoutes(), '?tab=partner&ptn=9001');
    await screen.findByText('고객사');

    await user.click(roleCheckbox('고객사'));
    expect(partnerSaveButton()).toBeEnabled();

    await user.click(roleCheckbox('고객사'));
    expect(partnerSaveButton()).toBeDisabled();
  });

  it('취소를 누르면 체크가 서버 상태로 되돌아가고 저장이 다시 잠긴다', async () => {
    const { user } = renderScreen(partnerRoutes(), '?tab=partner&ptn=9001');
    await screen.findByText('고객사');

    await user.click(roleCheckbox('공급사'));
    await user.click(within(partnerRolePane()).getByRole('button', { name: '취소' }));

    expect(roleCheckbox('공급사')).not.toBeChecked();
    expect(partnerSaveButton()).toBeDisabled();
  });

  /**
   * C25·C29·C30 — 잃는 것이 없는 저장은 창 없이 바로 나간다.
   *
   * ⚠ **`If-Match`를 싣는다**(계약 재동기화 #173 — 헤더가 필수가 됐다). 토큰은 역할 조회
   * 응답의 `ETag`에서 온다 — 그 헤더가 없으면 공통 훅이 요청을 만들지 않고 멈춘다(아래
   * 「토큰이 없으면」 감지기가 그 갈래를 잰다).
   */
  it('추가만 하는 저장은 확인 창 없이 치환 경로로 나가고 If-Match를 싣는다', async () => {
    const { requests, user } = renderScreen(
      [...vocabularyPartnerRoutes(), rolesReplaceRoute(() => jsonResponse(replacedRoles))],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    await user.click(roleCheckbox('공급사'));
    await user.click(partnerSaveButton());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(putRequests(requests)).toHaveLength(1);
    });

    const sent = putRequests(requests)[0];
    expect(sent?.url.pathname).toBe(partnerRolesPath(9001));
    expect(sent?.headers.get('Idempotency-Key')).toMatch(UUID);
    expect(sent?.headers.get('If-Match')).toBe(ROLES_ETAG);
  });

  /**
   * **재조회가 준 새 토큰이 다음 저장에 실린다** — 잠금 토큰의 **갱신 경로**를 잰다(#174).
   *
   * 위 감지기는 「토큰을 싣는가」만 잰다. 한 번 잡아 둔 값을 계속 다시 쓰는 화면도 그것을
   * 통과하는데, 그러면 두 번째 저장은 **낡은 토큰**으로 나가 매번 충돌한다. 지금까지의 스텁은
   * 회차와 무관하게 같은 토큰을 주어 그 어긋남을 드러낼 수 없었다.
   *
   * copy-checklist 「두 스텁 형태」의 **헤더만 바뀌는 쪽**이다 — 내용은 그대로 두고 토큰만
   * 갈아 「값이 갱신됐다」의 축을 토큰 하나로 가둔다(내용까지 바뀌는 쪽은 충돌 구획이 맡는다).
   *
   * 치환 응답에는 `ETag`를 **싣지 않는다.** 실으면 쓰기 응답으로 갱신됐는지 재조회로 갱신됐는지
   * 갈리지 않는다 — 쓰기 응답 쪽 갱신은 `packages/api-client`의 단위 시험이 이미 덮는다.
   */
  it('재조회가 새 토큰을 주면 다음 저장이 그 새 값을 싣는다', async () => {
    let roleCalls = 0;

    const { requests, user } = renderScreen(
      [
        partnerListRoute(),
        partnerDetailRoute(),
        {
          match: (request) => isGet(request, partnerRolesPath(9001)),
          respond: () => {
            roleCalls += 1;

            return jsonResponse(vocabularyRoleFixtures, {
              headers: { ETag: roleCalls === 1 ? ROLES_ETAG : ROLES_ETAG_AFTER_RELOAD },
            });
          },
        },
        rolesReplaceRoute(() => jsonResponse(vocabularyRoleFixtures)),
      ],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    await user.click(roleCheckbox('공급사'));
    await user.click(partnerSaveButton());

    await waitFor(() => {
      expect(putRequests(requests)).toHaveLength(1);
    });
    expect(putRequests(requests)[0]?.headers.get('If-Match')).toBe(ROLES_ETAG);

    /* 무효화가 낸 재조회가 새 토큰을 들고 도착한 뒤에 다시 저장한다. */
    await waitFor(() => {
      expect(roleGetRequests(requests)).toHaveLength(2);
    });
    await waitFor(() => {
      expect(partnerSaveButton()).toBeDisabled();
    });

    await user.click(roleCheckbox('공급사'));
    await user.click(partnerSaveButton());

    await waitFor(() => {
      expect(putRequests(requests)).toHaveLength(2);
    });
    expect(putRequests(requests)[1]?.headers.get('If-Match')).toBe(ROLES_ETAG_AFTER_RELOAD);
  });

  /**
   * **토큰이 없으면 요청을 만들지 않고, 안내는 이 자원의 사실을 말한다.**
   *
   * 계약이 `If-Match`를 필수로 요구하고 토큰 원천도 선언했지만(#174), **서버가 그 헤더를 아직
   * 주지 않는** 상태는 실제로 있을 수 있다. 그때 화면이 할 수 있는 정직한 일은 **보내지 않고
   * 안내하는 것**이다 — 빈 헤더를 지어 보내면 서버가 400으로 되돌리고 사용자는 원인을 읽을 수 없다.
   *
   * 문구를 **전용 문구로 못박는다.** 공통 문구(`save.staleToken`)는 「잠시 뒤 다시 저장하세요」라
   * 이 자원에서는 영영 거짓이다 — 공통 훅이 붙이는 코드값이 바뀌어 화면의 갈래가 조용히
   * 공통 문구로 되돌아가면 이 단언이 운다.
   *
   * **출구 한 문장까지 함께 잰다.** 사용자가 이 화면에서 스스로 풀 수 없는 상태라, 안내가
   * 「달라지지 않는다」에서 끝나면 다음에 할 일이 남지 않는다. 기대값을 문구 상수로만 두면 그
   * 문장을 지워도 기대값이 함께 지워져 아무 감지기도 울지 않으므로(자기참조 침묵) **문면 조각을
   * 따로 못박는다.**
   */
  it('잠금 토큰을 못 얻으면 저장이 요청을 만들지 않고 사실대로 안내한다', async () => {
    const { requests, user } = renderScreen(
      [
        partnerListRoute(),
        partnerDetailRoute(),
        partnerRolesRouteWithoutEtag(),
        rolesReplaceRoute(() => jsonResponse(replacedRoles)),
      ],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    await user.click(roleCheckbox('공급사'));
    await user.click(partnerSaveButton());

    const notice = await within(partnerRolePane()).findByText(
      messages.commonCode.partnerRole.saveTokenUnavailable,
    );

    expect(notice).toBeInTheDocument();
    /* 출구 한 문장 — 문면 조각으로 못박는다(위 주석). */
    expect(notice).toHaveTextContent('반복되면 담당자에게 알려 주세요');
    /* 「다시 시도하면 풀린다」는 공통 문구가 이 자원에는 서지 않는다. */
    expect(screen.queryByText(messages.save.staleToken)).not.toBeInTheDocument();
    expect(putRequests(requests)).toHaveLength(0);
  });

  /**
   * **두 갈래가 만나는 자리 — 어휘 밖 역할 + 토큰 없음**(리뷰 M-3).
   *
   * 서버 구현이 계약을 따라오기 전까지 실제로 만날 수 있는 조합이다: 계약은 구현보다 앞서므로
   * 서버가 어휘 밖 역할을 아직 들고 있을 수 있고(D-4의 존재 이유) 토큰도 아직 안 줄 수 있다 —
   * 그 거래처에서 저장을 누르면 확인 창이 먼저 서고 승낙한 뒤에 토큰 벽을 만난다.
   *
   * 재는 것 넷 — ① 요청이 나가지 않는다 ② **창이 닫히지 않는다**(닫히면 사용자는 승낙이
   * 받아들여진 줄 안다) ③ 사유가 **창 안에서** 사실대로 보인다 ④ **출구 한 문장이 창 안에도
   * 선다** — 체감이 가장 나쁜 자리다(해제를 승낙한 뒤에 막힌 것을 읽는다).
   */
  it('어휘 밖 역할이 붙은 거래처에서 확인 창을 승낙해도 요청이 나가지 않고 창 안에 사유가 선다', async () => {
    const { requests, user } = renderScreen(
      [
        partnerListRoute(),
        partnerDetailRoute(),
        partnerRolesRouteWithoutEtag(9001, partnerRoleFixtures),
        rolesReplaceRoute(() => jsonResponse(replacedRoles)),
      ],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    await user.click(roleCheckbox('공급사'));
    await user.click(partnerSaveButton());

    const dialog = await screen.findByRole('dialog');
    /* 어휘 밖 역할이 해제 목록에 서 있다 — 사용자가 그것을 승낙하는 순간이다. */
    expect(within(dialog).getByText('샘플 역할 엑스')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: '해제하고 저장' }));

    const notice = await within(dialog).findByText(
      messages.commonCode.partnerRole.saveTokenUnavailable,
    );

    expect(notice).toBeInTheDocument();
    expect(notice).toHaveTextContent('반복되면 담당자에게 알려 주세요');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(putRequests(requests)).toHaveLength(0);
  });

  /* C29 — 본문은 **최종 상태 전부**다. 차례는 어휘 다섯의 결정된 차례로 고정한다. */
  it('본문에 최종 상태 전부가 정해진 차례로 실린다', async () => {
    const { requests, user } = renderScreen(
      [...vocabularyPartnerRoutes(), rolesReplaceRoute(() => jsonResponse(replacedRoles))],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    await user.click(roleCheckbox('공급사'));
    await user.click(partnerSaveButton());

    await waitFor(() => {
      expect(putRequests(requests)).toHaveLength(1);
    });

    expect(sentRoleCodes(requests)).toEqual([
      PARTNER_ROLE_CODES.customer,
      PARTNER_ROLE_CODES.supplier,
      PARTNER_ROLE_CODES.disposal,
    ]);
  });

  /**
   * **어휘 밖 코드는 본문에서 빠지고 확인 창이 그것을 든다**(계약 재동기화 #173).
   *
   * 앞 회차까지는 그 코드를 그대로 실어 보존했다. 계약이 값 목록을 못 박으면서 그 본문은
   * 서버가 **통째로 거절하는 요청**이 됐다 — 하나를 지키려다 저장 전체를 막는다.
   * 지금은 실을 수 있는 것만 싣고, 잃는 사실을 창이 이름으로 밝힌다.
   */
  it('어휘 밖 코드는 본문에서 빠지고 확인 창이 그 이름을 밝힌다', async () => {
    const { requests, user } = renderScreen(
      [...partnerRoutes(), rolesReplaceRoute(() => jsonResponse(replacedRoles))],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    /* 어휘 밖 체크는 **그대로 둔다** — 사용자가 끄지 않아도 잃는다는 것이 요점이다. */
    await user.click(roleCheckbox('공급사'));
    await user.click(partnerSaveButton());

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('샘플 역할 엑스')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: '해제하고 저장' }));

    await waitFor(() => {
      expect(putRequests(requests)).toHaveLength(1);
    });

    expect(sentRoleCodes(requests)).toEqual([
      PARTNER_ROLE_CODES.customer,
      PARTNER_ROLE_CODES.supplier,
      PARTNER_ROLE_CODES.disposal,
    ]);
  });

  /* C31 — 성공 알림이 없으면 사용자는 저장이 됐는지 화면을 다시 훑어 확인해야 한다. */
  it('저장에 성공하면 성공 알림이 뜬다', async () => {
    const { user } = renderScreen(
      [...vocabularyPartnerRoutes(), rolesReplaceRoute(() => jsonResponse(replacedRoles))],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    await user.click(roleCheckbox('공급사'));
    await user.click(partnerSaveButton());

    expect(await screen.findByText('저장했습니다')).toBeInTheDocument();
  });

  /*
   * C31 — **저장 응답 그 자체로 초안을 다시 세운다.**
   *
   * 무효화가 낸 재조회를 **끝내지 않은 채**로 재는 것이 이 시험의 요점이다. 재조회가 곧바로
   * 상태를 덮어쓰면 「응답으로 다시 세웠는가」와 「재조회가 고쳐 줬는가」가 구분되지 않는다 —
   * 보낸 목록을 그대로 둔 화면도 통과해 버린다. 실서버에서 재조회가 늦거나 실패하는 동안
   * 사용자가 보는 것은 **보낸 목록**이 되고, 그것은 서버가 정규화한 결과와 다르다.
   */
  it('저장 응답으로 체크 상태를 다시 세운다 — 재조회를 기다리지 않는다', async () => {
    let rolesCalls = 0;

    const { user } = renderScreen(
      [
        partnerListRoute(),
        partnerDetailRoute(),
        {
          match: (request) => isGet(request, partnerRolesPath(9001)),
          respond: () => {
            rolesCalls += 1;

            return rolesCalls === 1
              ? rolesResponse(vocabularyRoleFixtures)
              : neverFinishingResponse();
          },
        },
        /* 서버는 「공급사를 더한 목록」을 받고도 **고객사·공급사가 빠진 상태**를 돌려준다. */
        rolesReplaceRoute(() => jsonResponse(replacedRoles)),
      ],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    await user.click(roleCheckbox('공급사'));
    await user.click(partnerSaveButton());

    await waitFor(() => {
      expect(roleCheckbox('고객사')).not.toBeChecked();
    });
    expect(roleCheckbox('공급사')).not.toBeChecked();
    expect(roleCheckbox('폐기 업체')).toBeChecked();
    /* 서버가 돌려준 것이 기준값이 됐다 — 재조회가 오기 전에 이미 저장이 잠긴다. */
    expect(partnerSaveButton()).toBeDisabled();
  });

  /*
   * C31 — **응답이 저장 전과 값이 같아도 되세운다.**
   *
   * 조회 라이브러리는 새 값이 옛 값과 깊이 같으면 **옛 참조를 유지한다**(`replaceEqualDeep`).
   * 되세우기가 참조 동일성으로 판정하므로, 그때 초안을 비워 주지 않으면 화면이 서버가 말한
   * 상태가 아니라 **사용자가 고른 상태**를 계속 보인다 — 서버가 저장을 조용히 무시한 경우가
   * 정확히 그 갈래이고, 무상태 목 서버가 늘 그 갈래다.
   */
  it('저장 응답이 저장 전과 값이 같아도 체크를 서버 상태로 다시 세운다', async () => {
    const { user } = renderScreen(
      [
        partnerListRoute(),
        partnerDetailRoute(),
        partnerRolesRoute(9001, vocabularyRoleFixtures),
        /* 서버가 「받았다」면서 **저장 전과 똑같은 목록**을 돌려준다. */
        rolesReplaceRoute(() => jsonResponse(vocabularyRoleFixtures)),
      ],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    await user.click(roleCheckbox('공급사'));
    await user.click(partnerSaveButton());

    expect(await screen.findByText('저장했습니다')).toBeInTheDocument();
    await waitFor(() => {
      expect(roleCheckbox('공급사')).not.toBeChecked();
    });
    expect(partnerSaveButton()).toBeDisabled();
  });

  /*
   * C31 · copy-checklist 11 — **재조회 결과도 화면에 닿는다.** 재조회 스텁이 호출 횟수에 따라
   * 내용까지 바꾸도록 두어야 「저장 뒤 표시가 갱신됐다」가 헛통과하지 않는다.
   */
  it('저장에 성공하면 서버가 돌려준 상태가 정본이 된다', async () => {
    let current = vocabularyRoleFixtures;

    const { requests, user } = renderScreen(
      [
        partnerListRoute(),
        partnerDetailRoute(),
        {
          match: (request) => isGet(request, partnerRolesPath(9001)),
          respond: () => rolesResponse(current),
        },
        rolesReplaceRoute(() => {
          current = replacedRoles;
          return jsonResponse(replacedRoles);
        }),
      ],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    /* 서버는 「공급사를 더한 목록」을 받고도 **고객사가 빠진 상태**를 돌려준다. */
    await user.click(roleCheckbox('공급사'));
    await user.click(partnerSaveButton());

    await waitFor(() => {
      expect(roleCheckbox('고객사')).not.toBeChecked();
    });
    expect(roleCheckbox('공급사')).not.toBeChecked();
    expect(roleCheckbox('폐기 업체')).toBeChecked();
    /* 서버가 돌려준 것이 기준값이 됐다 — 저장이 다시 잠긴다. */
    expect(partnerSaveButton()).toBeDisabled();

    /*
     * **역할 캐시를 무효화한다.** 응답으로 초안을 다시 세우는 것만으로는 캐시에 옛 목록이
     * 남아, 다른 거래처를 들렀다 돌아오면 저장 전 상태가 되살아난다.
     */
    await waitFor(() => {
      expect(roleGetRequests(requests)).toHaveLength(2);
    });
  });

  /**
   * C17 — **무효화 대상은 역할 키 하나뿐이다.** 역할 치환으로 거래처 본체는 바뀌지 않으므로
   * 기본 정보·목록까지 무효화하면 아무것도 달라지지 않을 조회를 다시 낸다. 단건 조회가 생긴
   * 뒤로 그 실수를 저지를 자리가 하나 늘었다.
   */
  it('저장에 성공해도 기본 정보와 목록은 다시 조회하지 않는다', async () => {
    const { requests, user } = renderScreen(
      [...vocabularyPartnerRoutes(), rolesReplaceRoute(() => jsonResponse(replacedRoles))],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    await user.click(roleCheckbox('공급사'));
    await user.click(partnerSaveButton());
    await screen.findByText('저장했습니다');

    /* 양성 앵커 — 역할은 실제로 다시 조회된다. 음성 단언은 그 시점 뒤에 잰다. */
    await waitFor(() => {
      expect(roleGetRequests(requests)).toHaveLength(2);
    });
    expect(partnerDetailRequests(requests)).toHaveLength(1);
    expect(partnerRequests(requests)).toHaveLength(1);
  });
});

describe('CommonCodeScreen — 해제 확인 창 (C25·C26·C27)', () => {
  /* C25 — 추가만 하는 저장에까지 창을 세우면 확인이 습관이 되어 잃는 저장에서도 읽히지 않는다. */
  it('해제되는 역할이 없으면 확인 창이 뜨지 않는다', async () => {
    const { user } = renderScreen(
      [...vocabularyPartnerRoutes(), rolesReplaceRoute(() => jsonResponse(replacedRoles))],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    await user.click(roleCheckbox('공급사'));
    await user.click(partnerSaveButton());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /* C26 — 통째 교체라 목록에 없는 역할은 해제된다. 그 이름을 밝히는 것이 유일한 방어다. */
  it('해제되는 역할이 있으면 확인 창이 그 이름을 밝히고 확인 전에는 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen(
      [...partnerRoutes(), rolesReplaceRoute(() => jsonResponse(replacedRoles))],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    await user.click(roleCheckbox('고객사'));
    await user.click(partnerSaveButton());

    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText('저장하면 아래 역할이 해제됩니다.')).toBeInTheDocument();
    expect(within(dialog).getByText('고객사')).toBeInTheDocument();
    expect(putRequests(requests)).toHaveLength(0);
  });

  /* C26 — 어휘 밖 코드를 빠뜨리면 화면이 모르는 역할이 창에도 나오지 않은 채 사라진다. */
  it('어휘 밖 역할을 끄면 그 이름도 확인 창에 나온다', async () => {
    const { user } = renderScreen(
      [...partnerRoutes(), rolesReplaceRoute(() => jsonResponse(replacedRoles))],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    await user.click(roleCheckbox(UNKNOWN_ROLE_LABEL));
    await user.click(partnerSaveButton());

    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText('샘플 역할 엑스')).toBeInTheDocument();
    expect(within(dialog).queryByText('고객사')).not.toBeInTheDocument();
  });

  it('확인 창에서 계속 편집을 고르면 요청이 나가지 않고 체크가 그대로 남는다', async () => {
    const { requests, user } = renderScreen(
      [...partnerRoutes(), rolesReplaceRoute(() => jsonResponse(replacedRoles))],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    await user.click(roleCheckbox('고객사'));
    await user.click(partnerSaveButton());
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: '계속 편집' }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(putRequests(requests)).toHaveLength(0);
    expect(roleCheckbox('고객사')).not.toBeChecked();
  });

  /* C27 — 계약이 빈 배열을 「전부 해제」로 정의한다. 실제로 만들 수 있는 상태다. */
  it('전부 해제하면 하나도 남지 않는다는 사실이 함께 나오고 빈 배열이 나간다', async () => {
    const { requests, user } = renderScreen(
      [...partnerRoutes(), rolesReplaceRoute(() => jsonResponse([]))],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    await user.click(roleCheckbox('고객사'));
    await user.click(roleCheckbox('폐기 업체'));
    await user.click(roleCheckbox(UNKNOWN_ROLE_LABEL));
    await user.click(partnerSaveButton());

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('저장하면 이 거래처의 역할이 하나도 남지 않습니다.'),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: '해제하고 저장' }));

    await waitFor(() => {
      expect(putRequests(requests)).toHaveLength(1);
    });
    expect(sentRoleCodes(requests)).toEqual([]);
  });

  it('확인하면 남은 역할만 실려 나가고 창이 닫힌다', async () => {
    const { requests, user } = renderScreen(
      [...partnerRoutes(), rolesReplaceRoute(() => jsonResponse(replacedRoles))],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    await user.click(roleCheckbox('고객사'));
    await user.click(partnerSaveButton());
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: '해제하고 저장' }),
    );

    await waitFor(() => {
      expect(putRequests(requests)).toHaveLength(1);
    });
    /* 어휘 밖 코드는 체크가 남아 있어도 실리지 않는다 — 계약이 거절한다(#173). */
    expect(sentRoleCodes(requests)).toEqual([PARTNER_ROLE_CODES.disposal]);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});

describe('CommonCodeScreen — 저장이 나가는 중 (C33)', () => {
  /* 나가는 중에 체크가 바뀌면 확인한 것과 다른 것이 저장된 것처럼 보인다. */
  it('구획의 체크칸과 저장·취소가 잠긴다', async () => {
    const { user } = renderScreen(
      [...vocabularyPartnerRoutes(), rolesReplaceRoute(neverFinishingResponse)],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    await user.click(roleCheckbox('공급사'));
    await user.click(partnerSaveButton());

    await waitFor(() => {
      expect(partnerSaveButton()).toBeDisabled();
    });
    expect(roleCheckbox('공급사')).toBeDisabled();
    expect(within(partnerRolePane()).getByRole('button', { name: '취소' })).toBeDisabled();
  });

  it('확인 창의 두 버튼도 함께 잠긴다', async () => {
    const { user } = renderScreen(
      [...partnerRoutes(), rolesReplaceRoute(neverFinishingResponse)],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    await user.click(roleCheckbox('고객사'));
    await user.click(partnerSaveButton());

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: '해제하고 저장' }));

    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: '해제하고 저장' })).toBeDisabled();
    });
    expect(within(dialog).getByRole('button', { name: '계속 편집' })).toBeDisabled();
  });
});

/**
 * **나가는 중인 저장은 자기 거래처 밖으로 새지 않는다.**
 *
 * `resetIfIdle`가 나가는 중인 쓰기를 거두지 않는 것은 옳다(되먹임을 끊지 않는다 · `omf-mes#96`).
 * 그래서 거두지 못한 상태가 남는데, **좌 목록은 저장 중에도 잠기지 않으므로** 사용자는 그사이
 * 다른 거래처를 고를 수 있다. 끊는 것과 가리는 것을 갈라 두 면을 각각 잰다.
 */
describe('CommonCodeScreen — 나가는 중인 저장의 매임 (M-1·F-1)', () => {
  /*
   * 9001의 부여분에서 **어휘 밖 코드를 뺀다.** 계약이 그 값을 거절하게 된 뒤로(#173) 그것이
   * 붙어 있으면 어떤 저장도 해제 확인 창을 지나는데, 이 구획의 주제는 창이 아니라
   * **나가는 중인 저장의 매임**이다.
   */
  const twoPartnerRoutes = (): StubRoute[] => [
    partnerListRoute(),
    partnerDetailRoute(),
    partnerDetailRoute(9002),
    partnerRolesRoute(9001, vocabularyRoleFixtures),
    partnerRolesRoute(9002, []),
  ];

  /**
   * **막는 것과 가리는 것을 가른다.**
   *
   * 저장은 한 번에 하나뿐이라 옮겨 간 거래처도 **잠긴다**(막는 것 — 전역). 그러나 그 잠금은
   * 남의 저장이라는 **다른 사실**이므로 사유가 붙어야 하고, 진행 표시는 돌지 않아야 한다
   * (가리는 것 — 대상 축). 사유 없는 비활성은 사용자에게 「고장」으로 읽힌다.
   */
  it('저장이 나가는 중에 옮겨 간 거래처는 진행 표시 없이 사유와 함께 잠긴다', async () => {
    const { user } = renderScreen(
      [...twoPartnerRoutes(), rolesReplaceRoute(neverFinishingResponse)],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    await user.click(roleCheckbox('공급사'));
    await user.click(partnerSaveButton());
    await waitFor(() => {
      expect(partnerSaveButton()).toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: 'SAMPLE-PTNR-B' }));
    await screen.findByText('지정된 역할이 없습니다');

    const pane = partnerRolePane();

    expect(partnerSaveButton()).toBeDisabled();
    /*
     * 진행 표시를 도는 갈래에는 **사유가 없다** — 사유가 보인다는 것이 곧 이 구획이
     * 남의 저장으로 스피너를 돌리고 있지 않다는 뜻이다.
     */
    expect(within(pane).getByText(/저장은 다른 거래처의 저장이 끝난 뒤에/)).toBeInTheDocument();
    expect(within(pane).queryByText(/저장은 역할을 고친 뒤에/)).not.toBeInTheDocument();
  });

  /*
   * **두 저장이 겹치지 않는다.** 훅 하나에 요청 하나라, 두 번째 `mutate`는 앞 요청에서
   * 옵저버를 떼어 낸다 — 앞 저장이 400이면 **어디에도 표시되지 않는 실패**가 되고,
   * 성공이면 캐시가 저장 전 값으로 남아 다음 통째 교체가 그것을 덮어쓴다.
   */
  it('남의 저장이 나가는 중에는 새 거래처의 저장이 시작되지 않는다', async () => {
    const { requests, user } = renderScreen(
      [...twoPartnerRoutes(), rolesReplaceRoute(neverFinishingResponse)],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    await user.click(roleCheckbox('공급사'));
    await user.click(partnerSaveButton());
    await waitFor(() => {
      expect(putRequests(requests)).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: 'SAMPLE-PTNR-B' }));
    await screen.findByText('지정된 역할이 없습니다');
    await user.click(roleCheckbox('공급사'));
    await user.click(partnerSaveButton());

    expect(putRequests(requests)).toHaveLength(1);
    expect(
      within(partnerRolePane()).getByText(/저장은 다른 거래처의 저장이 끝난 뒤에/),
    ).toBeInTheDocument();
  });

  /*
   * 확인 창은 **자기 쓰기와 함께만** 선다. 남의 저장 중에 열리면 두 버튼이 잠긴 채
   * **보낸 적 없는 진행 표시**를 돌며 갇힌다 — 되돌릴 수 없는 저장을 확인하는 창이 거짓말한다.
   */
  it('남의 저장이 나가는 중에는 해제 확인 창이 서지 않는다', async () => {
    const { requests, user } = renderScreen(
      [
        partnerListRoute(),
        partnerDetailRoute(),
        partnerDetailRoute(9002),
        partnerRolesRoute(9001, vocabularyRoleFixtures),
        partnerRolesRoute(9002, [{ roleTypeCode: PARTNER_ROLE_CODES.customer }]),
        rolesReplaceRoute(neverFinishingResponse),
      ],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    await user.click(roleCheckbox('공급사'));
    await user.click(partnerSaveButton());
    await waitFor(() => {
      expect(putRequests(requests)).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: 'SAMPLE-PTNR-B' }));
    await waitFor(() => {
      expect(roleCheckbox('고객사')).toBeChecked();
    });

    /* 해제가 있는 저장이라 잠기지 않았다면 확인 창이 섰을 것이다. */
    await user.click(roleCheckbox('고객사'));
    await user.click(partnerSaveButton());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(putRequests(requests)).toHaveLength(1);
  });

  /*
   * 뒤늦게 온 앞 거래처의 실패가 지금 구획에 서면 사용자는 **손댄 적 없는 거래처가 막힌 줄** 안다.
   * 계획 D-11이 「남의 실패 배너를 보게 된다」를 금지 사항으로 못 박은 자리다.
   */
  it('저장이 뒤늦게 실패해도 그사이 옮겨 간 거래처에 배너가 서지 않는다', async () => {
    const deferred = deferredJsonResponse(400);

    const { requests, user } = renderScreen(
      [...twoPartnerRoutes(), rolesReplaceRoute(() => deferred.response)],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    await user.click(roleCheckbox('공급사'));
    await user.click(partnerSaveButton());
    await waitFor(() => {
      expect(putRequests(requests)).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: 'SAMPLE-PTNR-B' }));
    await screen.findByText('지정된 역할이 없습니다');

    /* 도착 전 — 남의 저장이 나가는 중이라 이 구획이 그 사유로 잠겨 있다. */
    expect(
      within(partnerRolePane()).getByText(/저장은 다른 거래처의 저장이 끝난 뒤에/),
    ).toBeInTheDocument();

    await act(async () => {
      deferred.release({
        message: '',
        errors: [{ scope: 'screen', code: 'DENIED', message: '저장이 막혔습니다.' }],
      });
    });

    /*
     * **잠금 사유가 갈리는 것으로 실패가 도착한 것을 안다** — 「다른 거래처의 저장이 끝난 뒤에」가
     * 「역할을 고친 뒤에」로 바뀌는 순간은 나가는 중이던 저장이 끝났을 때뿐이다.
     * 도착 전에 음성 단언을 하면 늘 통과한다.
     */
    await waitFor(() => {
      expect(within(partnerRolePane()).getByText(/저장은 역할을 고친 뒤에/)).toBeInTheDocument();
    });
    expect(within(partnerRolePane()).queryByText('저장이 막혔습니다.')).not.toBeInTheDocument();
  });

  /*
   * F-1 — **끊지는 않는다.** 가리는 축을 세운 뒤에도 `resetIfIdle`의 「나가는 중이면 손대지
   * 않는다」 가드는 살아 있어야 한다. 가드가 없으면 옵저버가 떨어져 **무효화도 성공도 실패도
   * 오지 않는다** — 서버에는 저장됐는데 화면에는 아무 흔적도 남지 않는다(`omf-mes#96`).
   */
  it('저장이 나가는 중에 거래처를 옮겨도 그 저장의 되먹임이 끊기지 않는다', async () => {
    const deferred = deferredJsonResponse(200);

    const { requests, user } = renderScreen(
      [...twoPartnerRoutes(), rolesReplaceRoute(() => deferred.response)],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    /* 해제가 있는 저장이라 확인 창을 거친다 — 창을 거친 길에서도 같아야 한다. */
    await user.click(roleCheckbox('고객사'));
    await user.click(partnerSaveButton());
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: '해제하고 저장' }),
    );
    await waitFor(() => {
      expect(putRequests(requests)).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: 'SAMPLE-PTNR-B' }));
    await screen.findByText('지정된 역할이 없습니다');

    await act(async () => {
      deferred.release(replacedRoles);
    });

    expect(await screen.findByText('저장했습니다')).toBeInTheDocument();
  });
});

describe('CommonCodeScreen — 저장 실패와 초안 수명 (C32·C34)', () => {
  const failedRoute = (status: number): StubRoute =>
    rolesReplaceRoute(() =>
      jsonResponse(
        {
          message: '',
          errors: [{ scope: 'screen', code: 'DENIED', message: '저장이 막혔습니다.' }],
        },
        { status },
      ),
    );

  /* C32 — 창을 닫으면 사용자는 무엇이 막았는지 모른 채 같은 버튼을 다시 누른다. */
  it('확인 창을 거친 저장이 실패해도 창이 닫히지 않고 사유가 보인다', async () => {
    const { user } = renderScreen([...partnerRoutes(), failedRoute(400)], '?tab=partner&ptn=9001');
    await screen.findByText('고객사');

    await user.click(roleCheckbox('고객사'));
    await user.click(partnerSaveButton());
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: '해제하고 저장' }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('저장이 막혔습니다.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '해제하고 저장' })).toBeInTheDocument();
  });

  it('권한에 막힌 저장도 창을 닫지 않고 사유를 낸다', async () => {
    const { user } = renderScreen([...partnerRoutes(), failedRoute(403)], '?tab=partner&ptn=9001');
    await screen.findByText('고객사');

    await user.click(roleCheckbox('고객사'));
    await user.click(partnerSaveButton());
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: '해제하고 저장' }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('저장이 막혔습니다.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '해제하고 저장' })).toBeInTheDocument();
  });

  /*
   * **화면이 아는 입력칸이 하나도 없다**(`knownFields`가 빈 배열이다). 체크칸에는 계약의
   * 필드 이름이 붙지 않으므로, 필드 오류를 인라인으로 소화하려 들면 그 오류는 어디에도
   * 표시되지 않고 조용히 사라진다.
   */
  it('필드에 붙은 오류도 배너로 올라온다', async () => {
    const { user } = renderScreen(
      [
        ...vocabularyPartnerRoutes(),
        rolesReplaceRoute(() =>
          jsonResponse(
            {
              message: '',
              errors: [
                {
                  scope: 'field',
                  field: 'roleTypeCodes',
                  code: 'UNKNOWN_CODE',
                  message: '모르는 역할 코드입니다.',
                },
              ],
            },
            { status: 400 },
          ),
        ),
      ],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    await user.click(roleCheckbox('공급사'));
    await user.click(partnerSaveButton());

    expect(
      await within(partnerRolePane()).findByText('모르는 역할 코드입니다.'),
    ).toBeInTheDocument();
  });

  /* 창을 거치지 않는 저장의 실패는 구획 배너가 받는다 — 어디에도 표시되지 않는 실패를 두지 않는다. */
  it('확인 창 없는 저장이 실패하면 구획 배너에 사유가 나온다', async () => {
    const { user } = renderScreen(
      [...vocabularyPartnerRoutes(), failedRoute(404)],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    await user.click(roleCheckbox('공급사'));
    await user.click(partnerSaveButton());

    expect(await within(partnerRolePane()).findByText('저장이 막혔습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /*
   * C34 — 초안·실패 배너를 남기면 뒤로가기로 돌아왔을 때 **남의 실패 배너**를 보게 된다.
   * 역할은 고른 거래처에 매인 자료다.
   */
  it('거래처 선택이 바뀌면 초안과 저장 실패 배너가 비워진다', async () => {
    const { user } = renderScreen(
      [
        partnerListRoute(),
        partnerDetailRoute(),
        partnerDetailRoute(9002),
        partnerRolesRoute(9001, vocabularyRoleFixtures),
        partnerRolesRoute(9002, []),
        failedRoute(400),
      ],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    await user.click(roleCheckbox('공급사'));
    await user.click(partnerSaveButton());
    await within(partnerRolePane()).findByText('저장이 막혔습니다.');

    await user.click(screen.getByRole('button', { name: 'SAMPLE-PTNR-B' }));
    await screen.findByText('지정된 역할이 없습니다');

    expect(within(partnerRolePane()).queryByText('저장이 막혔습니다.')).not.toBeInTheDocument();
    expect(roleCheckbox('공급사')).not.toBeChecked();
    expect(partnerSaveButton()).toBeDisabled();
  });

  /* 탭을 옮기면 선택도 주소에서 떨어진다 — 돌아와 같은 거래처를 다시 골라도 초안은 새것이다. */
  it('탭을 옮겼다 돌아와 같은 거래처를 다시 골라도 초안이 남아 있지 않다', async () => {
    const { user } = renderScreen(
      [codeGroupListRoute(), ...partnerRoutes()],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    await user.click(roleCheckbox('공급사'));
    await user.click(screen.getByRole('tab', { name: '공통코드' }));
    await screen.findByRole('button', { name: 'SYN-GRP-01' });

    await user.click(screen.getByRole('tab', { name: '거래처 역할' }));
    await user.click(await screen.findByRole('button', { name: 'SAMPLE-PTNR-A' }));
    await screen.findByText('고객사');

    expect(roleCheckbox('공급사')).not.toBeChecked();
    expect(partnerSaveButton()).toBeDisabled();
  });

  /* 조건을 바꾸면 선택이 주소에서 떨어진다 — 편집 중이던 초안이 남을 자리도 없다. */
  it('조건을 바꾸면 편집 중이던 초안이 남지 않는다', async () => {
    const { user } = renderScreen(partnerRoutes(), '?tab=partner&ptn=9001');
    await screen.findByText('고객사');

    await user.click(roleCheckbox('공급사'));
    await user.click(within(partnerPane()).getByRole('checkbox', { name: '미사용 포함' }));

    await screen.findByText('좌측에서 거래처를 고르면 여기에 그 거래처의 역할이 보입니다');
    expect(screen.queryByRole('checkbox', { name: '공급사' })).not.toBeInTheDocument();
  });
});

/* ── 역할 저장 충돌 (#174) ─────────────────────────────────────────────────── */

/**
 * 저장 충돌은 **토큰이 흐르기 시작한 뒤에 처음으로 실제로 생길 수 있는 갈래**다. 통째 교체
 * 저장이라 남이 방금 붙인 역할이 조용히 사라지는 것을 막는 것이 이 보호의 존재 이유이고,
 * 사용자에게는 「무엇이 막았는가」와 **최신을 받아 오는 수단**이 함께 있어야 한다.
 *
 * **화면 전용 문구를 만들지 않는다.** 공통 규약 문구가 원인 셋을 이미 갖고 있고 공통 배너가
 * 충돌일 때만 「최신 불러오기」를 낸다 — 화면이 할 일은 재조회 핸들러를 넘기는 것 하나다.
 * 토큰 부재 갈래가 전용 문구를 쓴 이유(「다시 시도하면 풀린다」가 거짓)는 **여기에 없다** —
 * 충돌은 다시 부르면 실제로 풀린다.
 *
 * 목 서버로는 409를 낼 때 요청에 `Prefer` 헤더가 필요하고 화면에는 그 헤더를 실을 자리가
 * 없다 — 그래서 이 갈래의 판정은 브라우저 확인이 아니라 **여기가 맡는다.**
 */
describe('CommonCodeScreen — 역할 저장 충돌 (#174)', () => {
  const CONFLICT_CAUSES: ConflictCause[] = ['user', 'erpSync', 'workerLease'];

  /** 재조회가 돌려줄 **다른** 부여분. 내용이 갈리는 것이 「되세웠다」의 증거다. */
  const reloadedRoles: PartnerRoleRow[] = [
    { roleTypeCode: PARTNER_ROLE_CODES.subcontractor, roleTypeName: null },
  ];

  /**
   * 치환은 409로 막고, 역할 조회는 **회차마다 토큰과 내용을 함께 바꾼다** — copy-checklist
   * 「두 스텁 형태」의 **내용까지 바뀌는 쪽**이다. 같은 구조를 되돌리는 스텁을 쓰면 「값이
   * 갱신됐다」가 부분 견줌으로 헛통과한다.
   *
   * 어휘 밖 코드가 없는 부여분으로 시작한다 — 확인 창은 그것을 주제로 삼는 시험에서만 지난다.
   */
  const conflictRoutes = (cause: ConflictCause): StubRoute[] => {
    let roleCalls = 0;

    return [
      partnerListRoute(),
      partnerDetailRoute(),
      {
        match: (request) => isGet(request, partnerRolesPath(9001)),
        respond: () => {
          roleCalls += 1;

          return roleCalls === 1
            ? jsonResponse(vocabularyRoleFixtures, { headers: { ETag: ROLES_ETAG } })
            : jsonResponse(reloadedRoles, { headers: { ETag: ROLES_ETAG_AFTER_RELOAD } });
        },
      },
      rolesReplaceRoute(() => jsonResponse({ conflictCause: cause, message: '' }, { status: 409 })),
    ];
  };

  /* 원인마다 대응 방법이 달라 문구가 갈린다 — 한 문구로 뭉개면 사용자가 다음 행동을 못 정한다. */
  it.each(CONFLICT_CAUSES)(
    '충돌 원인 %s에 맞는 문구와 최신 불러오기가 함께 선다',
    async (cause) => {
      const { user } = renderScreen(conflictRoutes(cause), '?tab=partner&ptn=9001');
      await screen.findByText('고객사');

      await user.click(roleCheckbox('공급사'));
      await user.click(partnerSaveButton());

      const pane = partnerRolePane();

      expect(await within(pane).findByText(messages.conflict[cause])).toBeInTheDocument();
      expect(within(pane).getByRole('button', { name: '최신 불러오기' })).toBeInTheDocument();
      /* 잃는 것을 **누르기 전에** 밝힌다 — 누른 뒤에 알리면 되돌릴 수 없다. */
      expect(within(pane).getByText(messages.conflict.reloadNote)).toBeInTheDocument();
    },
  );

  it('최신 불러오기를 누르면 다시 조회하고 배너가 사라지고 초안이 서버 최신값으로 되세워진다', async () => {
    const { requests, user } = renderScreen(conflictRoutes('user'), '?tab=partner&ptn=9001');
    await screen.findByText('고객사');

    await user.click(roleCheckbox('공급사'));
    await user.click(partnerSaveButton());
    await within(partnerRolePane()).findByText(messages.conflict.user);

    expect(roleGetRequests(requests)).toHaveLength(1);

    await user.click(within(partnerRolePane()).getByRole('button', { name: '최신 불러오기' }));

    /* ① 재조회가 한 건 더 나간다. */
    await waitFor(() => {
      expect(roleGetRequests(requests)).toHaveLength(2);
    });

    /* ③ 초안이 **서버 최신값**으로 되세워진다 — 양성 앵커를 먼저 붙잡는다. */
    await waitFor(() => {
      expect(roleCheckbox('외주 제작사')).toBeChecked();
    });
    expect(roleCheckbox('고객사')).not.toBeChecked();
    /* 고치던 체크는 사라진다 — 공통 안내가 미리 밝힌 그 대가다. */
    expect(roleCheckbox('공급사')).not.toBeChecked();
    expect(partnerSaveButton()).toBeDisabled();

    /* ② 저장 실패 배너가 사라진다. 음성 단언은 위 양성 앵커가 잡은 시점 뒤에 잰다. */
    expect(within(partnerRolePane()).queryByText(messages.conflict.user)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '최신 불러오기' })).not.toBeInTheDocument();
  });

  /**
   * **확인 창을 거친 저장의 충돌** — 사유는 창 안에 서고, 최신 불러오기를 누르면 **창이 닫힌다.**
   *
   * 「실패해도 창을 닫지 않는다」는 규율의 이유는 *같은 자리에서 다시 시도할 수 있게* 하려는
   * 것인데, 다시 불러오기는 **그 시도의 전제(초안)를 버리는 조작**이다. 창이 나열하는 해제
   * 목록은 사용자의 초안에서 나오므로 초안이 서버값으로 되돌아가면 **해제될 것이 하나도 없다** —
   * 그대로 두면 「저장하면 아래 역할이 해제됩니다」 아래에 빈 목록이 선 창이 남는다.
   */
  it('확인 창을 거친 저장이 충돌하면 창 안에 사유가 서고 최신 불러오기를 누르면 창이 닫힌다', async () => {
    const { requests, user } = renderScreen(conflictRoutes('user'), '?tab=partner&ptn=9001');
    await screen.findByText('고객사');

    /* 해제가 있는 저장이라 확인 창을 지난다. */
    await user.click(roleCheckbox('고객사'));
    await user.click(partnerSaveButton());

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: '해제하고 저장' }));

    expect(await within(dialog).findByText(messages.conflict.user)).toBeInTheDocument();
    /* 배너를 두 자리에 두지 않는다 — 사용자가 스크림 뒤의 사본을 읽으려 든다. */
    expect(screen.getAllByText(messages.conflict.user)).toHaveLength(1);

    await user.click(within(dialog).getByRole('button', { name: '최신 불러오기' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(roleGetRequests(requests)).toHaveLength(2);
    });
    expect(roleCheckbox('외주 제작사')).toBeChecked();
  });

  /**
   * **다시 부른 뒤의 저장이 갱신된 토큰으로 나간다** — 이것이 「충돌이 풀린다」의 실제 내용이다.
   * 배너가 사라지는 것만 재면 같은 낡은 토큰으로 다시 막히는 화면도 통과한다.
   *
   * 스텁이 토큰과 내용을 **함께** 바꾸므로, 초안이 되세워진 것과 토큰이 갱신된 것이 같은
   * 재조회에서 왔다는 사실까지 함께 재진다.
   */
  it('다시 부른 뒤의 저장은 갱신된 토큰을 싣는다', async () => {
    const { requests, user } = renderScreen(conflictRoutes('user'), '?tab=partner&ptn=9001');
    await screen.findByText('고객사');

    await user.click(roleCheckbox('공급사'));
    await user.click(partnerSaveButton());
    await within(partnerRolePane()).findByText(messages.conflict.user);

    expect(putRequests(requests)[0]?.headers.get('If-Match')).toBe(ROLES_ETAG);

    await user.click(within(partnerRolePane()).getByRole('button', { name: '최신 불러오기' }));
    await waitFor(() => {
      expect(roleCheckbox('외주 제작사')).toBeChecked();
    });

    await user.click(roleCheckbox('공급사'));
    await user.click(partnerSaveButton());

    await waitFor(() => {
      expect(putRequests(requests)).toHaveLength(2);
    });
    expect(putRequests(requests)[1]?.headers.get('If-Match')).toBe(ROLES_ETAG_AFTER_RELOAD);
  });

  /*
   * **재조회로 풀리지 않는 실패에는 그 버튼을 내지 않는다.** 내면 사용자는 고치던 입력만 버리고
   * 같은 자리로 되돌아온다 — 공통 배너가 갖는 규율이지만, 화면이 두 자리에 핸들러를 넘긴
   * 뒤에도 그 규율이 살아 있는지는 여기서만 재진다.
   */
  it('충돌이 아닌 저장 실패에는 최신 불러오기가 서지 않는다', async () => {
    const { user } = renderScreen(
      [
        ...vocabularyPartnerRoutes(),
        rolesReplaceRoute(() =>
          jsonResponse(
            {
              message: '',
              errors: [{ scope: 'screen', code: 'DENIED', message: '저장이 막혔습니다.' }],
            },
            { status: 400 },
          ),
        ),
      ],
      '?tab=partner&ptn=9001',
    );
    await screen.findByText('고객사');

    await user.click(roleCheckbox('공급사'));
    await user.click(partnerSaveButton());

    expect(await within(partnerRolePane()).findByText('저장이 막혔습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '최신 불러오기' })).not.toBeInTheDocument();
  });
});
