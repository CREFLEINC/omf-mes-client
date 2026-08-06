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
import { inspectionPlanFixtures } from './fixtures';
import { InspectionStandardScreen } from './screen';

const ROUTE = '/master-data/inspection-standard';

const PLANS_PATH = '/quality/inspection-plans';

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

const DEFAULT_PAGE: PageStub = { page: 1, size: 50, total: inspectionPlanFixtures.length };

const planListRoute = (
  items = inspectionPlanFixtures,
  pageMeta: PageStub = DEFAULT_PAGE,
): StubRoute => ({
  match: (request) => isGet(request, PLANS_PATH),
  respond: () => jsonResponse({ items, page: pageMeta }),
});

const renderScreen = (
  routes: StubRoute[],
  search = '',
): { requests: RecordedRequest[]; user: ReturnType<typeof userEvent.setup> } => {
  const { fetch, requests } = createRecordingFetch(routes);
  renderWithProviders(<InspectionStandardScreen />, { fetch, route: `${ROUTE}${search}` });

  return { requests, user: userEvent.setup() };
};

const requestsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === pathname);

const planRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requestsTo(requests, PLANS_PATH);

const planPane = (): HTMLElement => screen.getByRole('region', { name: '검사기준' });

describe('InspectionStandardScreen — 기준 목록 조회', () => {
  it('화면에 들어오면 목록 요청이 한 번 나가고 조건이 없으면 쿼리도 없다', async () => {
    const { requests } = renderScreen([planListRoute()]);

    expect(await screen.findByRole('button', { name: 'SYN-PLAN-01' })).toBeInTheDocument();

    const first = planRequests(requests);
    expect(first).toHaveLength(1);
    expect(first[0]?.url.search).toBe('');
  });

  it('서버 응답의 기준을 표에 그린다', async () => {
    renderScreen([planListRoute()]);

    expect(await screen.findByRole('button', { name: 'SYN-PLAN-01' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SYN-PLAN-02' })).toBeInTheDocument();
    expect(screen.getByText('합성 검사기준 A')).toBeInTheDocument();
    expect(screen.getByText('IQC (수입검사)')).toBeInTheDocument();
  });

  it('검색어와 검사 유형이 요청 쿼리에 실린다', async () => {
    const { requests, user } = renderScreen([planListRoute()]);
    await screen.findByRole('button', { name: 'SYN-PLAN-01' });

    await user.type(screen.getByLabelText('검사기준 검색'), 'SYN');
    await user.click(within(planPane()).getByRole('combobox', { name: '검사 유형' }));
    await user.click(screen.getByRole('option', { name: 'PQC (공정검사)' }));
    await user.click(within(planPane()).getByRole('button', { name: '조회' }));

    const last = planRequests(requests).at(-1);
    expect(last?.url.searchParams.get('q')).toBe('SYN');
    expect(last?.url.searchParams.get('inspectionTypeCode')).toBe('PQC');
  });

  /* 계약의 기본값이 false다 — 끈 상태를 값으로 실어 보내면 캐시 키가 갈린다. */
  it('미사용 포함이 꺼져 있으면 includeInactive를 싣지 않는다', async () => {
    const { requests } = renderScreen([planListRoute()]);
    await screen.findByRole('button', { name: 'SYN-PLAN-01' });

    expect(planRequests(requests)[0]?.url.searchParams.has('includeInactive')).toBe(false);
  });

  it('미사용 포함을 켜면 includeInactive=true가 실린다', async () => {
    const { requests, user } = renderScreen([planListRoute()]);
    await screen.findByRole('button', { name: 'SYN-PLAN-01' });

    await user.click(screen.getByRole('checkbox', { name: '미사용 포함' }));

    const last = planRequests(requests).at(-1);
    expect(last?.url.searchParams.get('includeInactive')).toBe('true');
  });

  it('조회 조건은 주소에 남는다 — 새로고침·공유가 같은 결과를 낸다', async () => {
    const { requests } = renderScreen([planListRoute()], '?q=SYN&type=OQC&inactive=1');
    await screen.findByRole('button', { name: 'SYN-PLAN-01' });

    const first = planRequests(requests)[0];
    expect(first?.url.searchParams.get('q')).toBe('SYN');
    expect(first?.url.searchParams.get('inspectionTypeCode')).toBe('OQC');
    expect(first?.url.searchParams.get('includeInactive')).toBe('true');
    expect(screen.getByRole('checkbox', { name: '미사용 포함' })).toBeChecked();
  });

  it('조회에 실패하면 표와 빈 상태 대신 오류 배너와 다시 시도가 뜬다', async () => {
    renderScreen([
      {
        match: (request) => isGet(request, PLANS_PATH),
        respond: () => jsonResponse({ message: '' }, { status: 500 }),
      },
    ]);

    expect(await screen.findByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('등록된 검사기준이 없습니다')).not.toBeInTheDocument();
    // 서버가 빈 message를 줘도 무엇을 하라는 안내가 남아야 한다.
    expect(
      screen.getByText('잠시 뒤 다시 시도하세요. 반복되면 담당자에게 알려 주세요.'),
    ).toBeInTheDocument();
  });

  it('403이면 권한 안내를 낸다', async () => {
    renderScreen([
      {
        match: (request) => isGet(request, PLANS_PATH),
        respond: () => jsonResponse({ message: '' }, { status: 403 }),
      },
    ]);

    expect(
      await screen.findByText('이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.'),
    ).toBeInTheDocument();
  });

  it('네트워크가 끊기면 연결 안내를 낸다', async () => {
    renderWithProviders(<InspectionStandardScreen />, {
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
        match: (request) => isGet(request, PLANS_PATH),
        respond: () => jsonResponse({ message: '' }, { status: 500 }),
      },
    ]);

    await user.click(await screen.findByRole('button', { name: '다시 시도' }));

    expect(planRequests(requests).length).toBeGreaterThan(1);
  });

  it('조건이 없는 0건이면 첫 등록을 권하고 조건 안내를 내지 않는다', async () => {
    renderScreen([planListRoute([], { page: 1, size: 50, total: 0 })]);

    expect(await screen.findByText('등록된 검사기준이 없습니다')).toBeInTheDocument();
    expect(screen.queryByText('조건에 맞는 검사기준이 없습니다')).not.toBeInTheDocument();
  });

  it('조건이 걸린 0건이면 조건을 줄이라고 안내하고 초기화를 낸다', async () => {
    const { requests, user } = renderScreen(
      [planListRoute([], { page: 1, size: 50, total: 0 })],
      '?q=없는코드',
    );

    expect(await screen.findByText('조건에 맞는 검사기준이 없습니다')).toBeInTheDocument();

    const emptyState = screen.getByText('조건에 맞는 검사기준이 없습니다').closest('div');
    await user.click(within(emptyState as HTMLElement).getByRole('button', { name: '초기화' }));

    expect(planRequests(requests).at(-1)?.url.search).toBe('');
  });
});

describe('InspectionStandardScreen — 쪽 이동', () => {
  it('다음을 누르면 page가 오르고 요청에 실린다', async () => {
    const { requests, user } = renderScreen([
      planListRoute(inspectionPlanFixtures, { page: 1, size: 50, total: 240 }),
    ]);
    await screen.findByRole('button', { name: 'SYN-PLAN-01' });

    await user.click(within(planPane()).getByRole('button', { name: '다음' }));

    expect(planRequests(requests).at(-1)?.url.searchParams.get('page')).toBe('2');
  });

  it('첫 쪽에서는 이전이 비활성이다', async () => {
    renderScreen([planListRoute(inspectionPlanFixtures, { page: 1, size: 50, total: 240 })]);
    await screen.findByRole('button', { name: 'SYN-PLAN-01' });

    expect(within(planPane()).getByRole('button', { name: '이전' })).toBeDisabled();
    expect(within(planPane()).getByRole('button', { name: '다음' })).toBeEnabled();
  });

  it('마지막 쪽에서는 다음이 비활성이다', async () => {
    renderScreen(
      [planListRoute(inspectionPlanFixtures, { page: 5, size: 50, total: 203 })],
      '?page=5',
    );
    await screen.findByRole('button', { name: 'SYN-PLAN-01' });

    expect(within(planPane()).getByRole('button', { name: '다음' })).toBeDisabled();
    expect(within(planPane()).getByRole('button', { name: '이전' })).toBeEnabled();
  });

  /* 경계 — 전체 건수가 쪽 크기의 배수면 마지막 쪽이 꽉 찬다. 여기서 다음이 열리면 빈 쪽으로 간다. */
  it('전체가 쪽 크기의 배수여도 마지막 쪽에서 다음이 비활성이다', async () => {
    renderScreen([planListRoute(inspectionPlanFixtures, { page: 2, size: 3, total: 6 })], '?page=2');
    await screen.findByRole('button', { name: 'SYN-PLAN-01' });

    expect(within(planPane()).getByRole('button', { name: '다음' })).toBeDisabled();
  });

  it('전체 0건이면 범위를 지어내지 않는다', async () => {
    renderScreen([planListRoute([], { page: 1, size: 50, total: 0 })]);

    expect(await screen.findByText('전체 0건')).toBeInTheDocument();
  });

  /*
   * 조건·쪽이 바뀌면 보이는 행이 달라진다 — 목록에 없는 기준의 폼이 우 칸에 남으면
   * 그것이 어디서 왔는지 알 수 없다.
   */
  it('조건이 바뀌면 주소에서 page·plan·ver가 사라진다', async () => {
    const { requests, user } = renderScreen(
      [planListRoute(inspectionPlanFixtures, { page: 3, size: 50, total: 240 })],
      '?page=3&plan=3001&ver=4001',
    );
    await screen.findByRole('button', { name: 'SYN-PLAN-01' });

    await user.type(screen.getByLabelText('검사기준 검색'), 'SYN');
    await user.click(within(planPane()).getByRole('button', { name: '조회' }));

    const last = planRequests(requests).at(-1);
    expect(last?.url.searchParams.get('q')).toBe('SYN');
    expect(last?.url.searchParams.has('page')).toBe(false);
    expect(screen.queryByRole('button', { name: 'SYN-PLAN-01' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('쪽을 옮기면 기준·버전 선택이 주소에서 사라진다', async () => {
    const { user } = renderScreen(
      [planListRoute(inspectionPlanFixtures, { page: 1, size: 50, total: 240 })],
      '?plan=3001&ver=4001',
    );

    expect(await screen.findByRole('button', { name: 'SYN-PLAN-01' })).toHaveAttribute(
      'aria-current',
      'true',
    );

    await user.click(within(planPane()).getByRole('button', { name: '다음' }));

    expect(screen.getByRole('button', { name: 'SYN-PLAN-01' })).not.toHaveAttribute('aria-current');
  });
});

describe('InspectionStandardScreen — 기준 선택', () => {
  it('기준코드를 누르면 그 행에 선택 표식이 붙는다', async () => {
    const { user } = renderScreen([planListRoute()]);

    await user.click(await screen.findByRole('button', { name: 'SYN-PLAN-02' }));

    expect(screen.getByRole('button', { name: 'SYN-PLAN-02' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('주소의 plan으로 선택이 복원된다', async () => {
    renderScreen([planListRoute()], '?plan=3003');

    expect(await screen.findByRole('button', { name: 'SYN-PLAN-03' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('기준을 고르기 전에는 중·우 구획이 선택 안내를 낸다', async () => {
    renderScreen([planListRoute()]);
    await screen.findByRole('button', { name: 'SYN-PLAN-01' });

    expect(screen.getAllByText('좌측에서 검사기준을 먼저 고르세요').length).toBeGreaterThan(0);
  });
});

describe('InspectionStandardScreen — 만들지 않기로 한 것', () => {
  /* 감추면 사용자가 「이 화면에는 없는 기능」으로 오해하고 다른 곳을 찾는다. */
  it('엑셀 올리기는 비활성이고 사유가 함께 보인다', async () => {
    renderScreen([planListRoute()]);
    await screen.findByRole('button', { name: 'SYN-PLAN-01' });

    expect(screen.getByRole('button', { name: '엑셀 올리기' })).toBeDisabled();
    expect(
      screen.getByText('엑셀 올리기는 아직 할 수 없습니다. 양식이 정해지면 이 버튼을 쓸 수 있습니다.'),
    ).toBeInTheDocument();
  });
});
