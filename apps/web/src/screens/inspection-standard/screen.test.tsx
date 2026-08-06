import type { QueryClient } from '@tanstack/react-query';
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
): {
  requests: RecordedRequest[];
  user: ReturnType<typeof userEvent.setup>;
  queryClient: QueryClient;
} => {
  const { fetch, requests } = createRecordingFetch(routes);
  const { queryClient } = renderWithProviders(<InspectionStandardScreen />, {
    fetch,
    route: `${ROUTE}${search}`,
  });

  return { requests, user: userEvent.setup(), queryClient };
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

const PLAN_DETAIL_PATH = '/quality/inspection-plans/3001';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface EditabilityStub {
  codeEditable: boolean;
  reason: 'EDITABLE' | 'REFERENCED' | 'NOT_COUNTABLE' | 'RECEIVED_FROM_ERP';
  referenceCount?: number | null;
}

const DEFAULT_EDITABILITY: EditabilityStub = { codeEditable: true, reason: 'EDITABLE' };

const planDetailRoute = (
  plan = inspectionPlanFixtures[0]!,
  editability: EditabilityStub = DEFAULT_EDITABILITY,
  etag = '"7"',
): StubRoute => ({
  match: (request) =>
    isGet(request, `${PLANS_PATH}/${String(plan.inspectionPlanId)}`),
  respond: () => jsonResponse({ inspectionPlan: plan, editability }, { headers: { ETag: etag } }),
});

const itemOptionsRoute = (): StubRoute => ({
  match: (request) => isGet(request, '/mdm/items'),
  respond: () =>
    jsonResponse({
      items: [
        {
          itemId: 5001,
          itemCode: 'SYN-ITEM-01',
          itemName: '합성 품목 A',
          itemTypeCode: 'PRODUCT',
          baseUomId: 41,
          lotControlTypeCode: 'LOT',
          serialControlTypeCode: 'NONE',
          shelfLifeDays: null,
          inspectionRequired: true,
          fifoPolicyCode: 'FIFO',
          negativeStockAllowed: false,
          storageConditionCode: null,
          openedShelfLifeHours: null,
          isActive: true,
        },
        {
          itemId: 5002,
          itemCode: 'SYN-ITEM-02',
          itemName: '합성 품목 B',
          itemTypeCode: 'PRODUCT',
          baseUomId: 41,
          lotControlTypeCode: 'LOT',
          serialControlTypeCode: 'NONE',
          shelfLifeDays: null,
          inspectionRequired: true,
          fifoPolicyCode: 'FIFO',
          negativeStockAllowed: false,
          storageConditionCode: null,
          openedShelfLifeHours: null,
          isActive: true,
        },
      ],
      page: { page: 1, size: 50, total: 2 },
    }),
});

const processOptionsRoute = (total = 1): StubRoute => ({
  match: (request) => isGet(request, '/mdm/processes'),
  respond: () =>
    jsonResponse({
      items: [
        {
          processId: 9001,
          processCode: 'SYN-OP-01',
          processName: '합성 공정 A',
          processTypeCode: 'STANDARD',
          isActive: true,
        },
      ],
      page: { page: 1, size: 50, total },
    }),
});

const routingOptionsRoute = (): StubRoute => ({
  match: (request) => isGet(request, '/planning/routings'),
  respond: () =>
    jsonResponse({
      items: [
        {
          routingId: 7003,
          itemId: 5001,
          routingCode: 'SYN-ROUTE-01',
          routingVersion: 3,
          statusCode: 'DRAFT',
          effectiveFrom: '2026-03-01',
          effectiveTo: null,
        },
      ],
    }),
});

const planSaveRoute = (
  respond: StubRoute['respond'] = () => jsonResponse(inspectionPlanFixtures[0]),
): StubRoute => ({
  match: (request) => request.method === 'PUT' && new URL(request.url).pathname === PLAN_DETAIL_PATH,
  respond,
});

const planCreateRoute = (
  respond: StubRoute['respond'] = () =>
    jsonResponse(
      { ...inspectionPlanFixtures[0], inspectionPlanId: 3010, inspectionPlanCode: 'SYN-PLAN-10' },
      { status: 201 },
    ),
): StubRoute => ({
  match: (request) => request.method === 'POST' && new URL(request.url).pathname === PLANS_PATH,
  respond,
});

const lookupRoutes = (): StubRoute[] => [
  itemOptionsRoute(),
  processOptionsRoute(),
  routingOptionsRoute(),
];

const planForm = (): HTMLElement => screen.getByRole('region', { name: '기준 정보' });

const renderSelectedPlan = (extraRoutes: StubRoute[] = [], search = '?plan=3001') =>
  renderScreen([planListRoute(), planDetailRoute(), ...lookupRoutes(), ...extraRoutes], search);

describe('InspectionStandardScreen — 기준 상세 조회', () => {
  it('기준을 고르기 전에는 상세 요청이 나가지 않는다', async () => {
    const { requests } = renderScreen([planListRoute(), planDetailRoute(), ...lookupRoutes()]);
    await screen.findByRole('button', { name: 'SYN-PLAN-01' });

    expect(requestsTo(requests, PLAN_DETAIL_PATH)).toHaveLength(0);
  });

  it('기준을 고르면 상세 요청이 한 번 나가고 폼이 응답 값으로 채워진다', async () => {
    const { requests, user } = renderScreen([
      planListRoute(),
      planDetailRoute(),
      ...lookupRoutes(),
    ]);

    await user.click(await screen.findByRole('button', { name: 'SYN-PLAN-01' }));

    expect(await screen.findByLabelText('기준코드')).toHaveValue('SYN-PLAN-01');
    expect(screen.getByLabelText('기준명')).toHaveValue('합성 검사기준 A');
    expect(requestsTo(requests, PLAN_DETAIL_PATH)).toHaveLength(1);
  });

  it('상세 조회에 실패하면 폼 대신 오류 배너가 나온다', async () => {
    renderScreen(
      [
        planListRoute(),
        {
          match: (request) => isGet(request, PLAN_DETAIL_PATH),
          respond: () => jsonResponse({ message: '상세를 불러오지 못했습니다.' }, { status: 500 }),
        },
        ...lookupRoutes(),
      ],
      '?plan=3001',
    );

    expect(await screen.findByText('상세를 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.queryByLabelText('기준코드')).not.toBeInTheDocument();
  });

  /*
   * 판정의 주인은 codeEditable이다 — 목 서버도 실서버도 codeEditable=false에
   * reason=EDITABLE인 어긋난 조합을 실제로 내려준다.
   */
  it('codeEditable이 거짓이면 reason이 EDITABLE이어도 기준코드를 잠근다', async () => {
    renderScreen(
      [
        planListRoute(),
        planDetailRoute(inspectionPlanFixtures[0], {
          codeEditable: false,
          reason: 'EDITABLE',
          referenceCount: 3,
        }),
        ...lookupRoutes(),
      ],
      '?plan=3001',
    );

    expect(await screen.findByLabelText('기준코드')).toBeDisabled();
    expect(screen.getByLabelText('기준명')).toBeEnabled();
    expect(
      screen.getByText('지금은 코드를 바꿀 수 없습니다. 변경이 필요하면 담당자에게 문의하세요.'),
    ).toBeInTheDocument();
  });

  /*
   * 입력하는 동안 캐시가 갱신돼도 사용자가 넣은 값이 서버 값으로 되돌아가면 안 된다.
   * 같은 값을 다시 받으면 객체 동일성이 유지되므로 폼을 다시 세우지 않는다.
   */
  it('입력 중에 상세 캐시가 갱신돼도 입력값이 유지된다', async () => {
    const { user, requests, queryClient } = renderSelectedPlan();

    const name = await screen.findByLabelText('기준명');
    await user.type(name, '-편집중');

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['inspection-plans'] });
    });

    await waitFor(() => {
      expect(requestsTo(requests, PLAN_DETAIL_PATH).length).toBeGreaterThan(1);
    });

    expect(screen.getByLabelText('기준명')).toHaveValue('합성 검사기준 A-편집중');
  });

  it('고친 값은 취소로 기준값으로 되돌아간다', async () => {
    const { user } = renderSelectedPlan();

    const name = await screen.findByLabelText('기준명');
    await user.type(name, 'X');
    expect(name).toHaveValue('합성 검사기준 AX');

    await user.click(within(planForm()).getByRole('button', { name: '취소' }));

    expect(screen.getByLabelText('기준명')).toHaveValue('합성 검사기준 A');
  });
});

describe('InspectionStandardScreen — 기준 저장', () => {
  it('로컬 검증에 걸리면 요청이 나가지 않고 값을 고치면 오류가 지워진다', async () => {
    const { requests, user } = renderSelectedPlan([planSaveRoute()]);

    await user.clear(await screen.findByLabelText('기준명'));
    await user.click(within(planForm()).getByRole('button', { name: '저장' }));

    expect(await screen.findByText('필수 입력 항목입니다.')).toBeInTheDocument();
    expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(0);

    await user.type(screen.getByLabelText('기준명'), '다시');

    expect(screen.queryByText('필수 입력 항목입니다.')).not.toBeInTheDocument();
  });

  it('저장하면 멱등 키와 상세 경로에서 꺼낸 If-Match를 함께 실어 보낸다', async () => {
    const { requests, user } = renderSelectedPlan([planSaveRoute()]);

    await user.type(await screen.findByLabelText('기준명'), 'X');
    await user.click(within(planForm()).getByRole('button', { name: '저장' }));

    await screen.findByText('저장했습니다');

    const put = requests.find((request) => request.method === 'PUT');
    expect(put?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    expect(put?.headers.get('If-Match')).toBe('"7"');
  });

  /* 승인 정보와 사용 여부는 전용 액션으로만 바뀐다 — 수정 본문에 실으면 계약 위반이다. */
  it('저장 본문에 승인 정보와 사용 여부를 싣지 않는다', async () => {
    const { requests, user } = renderSelectedPlan([planSaveRoute()]);

    await user.type(await screen.findByLabelText('기준명'), 'X');
    await user.click(within(planForm()).getByRole('button', { name: '저장' }));

    await screen.findByText('저장했습니다');

    const body = JSON.parse(
      requests.find((request) => request.method === 'PUT')?.body ?? '{}',
    ) as Record<string, unknown>;

    expect(body).toEqual({
      inspectionPlanCode: 'SYN-PLAN-01',
      inspectionPlanName: '합성 검사기준 AX',
      inspectionTypeCode: 'IQC',
      itemId: 5001,
      processId: null,
      routingId: null,
    });
    expect('approvedBy' in body).toBe(false);
    expect('approvedAt' in body).toBe(false);
    expect('isActive' in body).toBe(false);
  });

  it('저장 충돌은 원인별 문구와 「최신 불러오기」로 낸다', async () => {
    const { user } = renderSelectedPlan([
      planSaveRoute(() => jsonResponse({ conflictCause: 'erpSync', message: '' }, { status: 409 })),
    ]);

    await user.type(await screen.findByLabelText('기준명'), 'X');
    await user.click(within(planForm()).getByRole('button', { name: '저장' }));

    expect(
      await screen.findByText(
        '외부 시스템에서 이 항목이 다시 동기화됐습니다. 최신 내용을 불러온 뒤 다시 저장하세요.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '최신 불러오기' })).toBeInTheDocument();
  });

  it('「최신 불러오기」를 누르면 상세를 다시 조회한다', async () => {
    const { requests, user } = renderSelectedPlan([
      planSaveRoute(() => jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 })),
    ]);

    await user.type(await screen.findByLabelText('기준명'), 'X');
    await user.click(within(planForm()).getByRole('button', { name: '저장' }));
    await user.click(await screen.findByRole('button', { name: '최신 불러오기' }));

    await waitFor(() => {
      expect(requestsTo(requests, PLAN_DETAIL_PATH).length).toBeGreaterThan(1);
    });
  });

  /* 재조회해도 풀리지 않는 실패에 「최신 불러오기」를 내면 입력만 버리게 된다. */
  it('409가 아닌 실패에는 「최신 불러오기」를 내지 않는다', async () => {
    const { user } = renderSelectedPlan([
      planSaveRoute(() =>
        jsonResponse(
          { errors: [{ scope: 'screen', code: 'STATE_LOCKED', message: '' }] },
          { status: 400 },
        ),
      ),
    ]);

    await user.type(await screen.findByLabelText('기준명'), 'X');
    await user.click(within(planForm()).getByRole('button', { name: '저장' }));

    expect(await screen.findByText('지금은 저장할 수 없는 상태입니다')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '최신 불러오기' })).not.toBeInTheDocument();
  });

  /* 목 서버도 실서버도 화면이 모르는 필드명을 내려준다. 삼키면 어디에도 보이지 않는 오류가 된다. */
  it('화면이 모르는 필드의 400 오류는 배너로 올린다', async () => {
    const { user } = renderSelectedPlan([
      planSaveRoute(() =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'field',
                field: '문자열',
                code: 'STANDARD',
                message: '알 수 없는 항목이 거부됐습니다.',
              },
            ],
          },
          { status: 400 },
        ),
      ),
    ]);

    await user.type(await screen.findByLabelText('기준명'), 'X');
    await user.click(within(planForm()).getByRole('button', { name: '저장' }));

    expect(await screen.findByText('알 수 없는 항목이 거부됐습니다.')).toBeInTheDocument();
  });
});

describe('InspectionStandardScreen — 기준 등록', () => {
  it('「기준 추가」를 누르면 빈 등록 폼이 열린다', async () => {
    const { user } = renderScreen([planListRoute(), ...lookupRoutes(), planCreateRoute()]);

    await user.click(await screen.findByRole('button', { name: '기준 추가' }));

    expect(await screen.findByLabelText('기준코드')).toHaveValue('');
    expect(screen.getByLabelText('기준명')).toHaveValue('');
    // 서버가 채우는 값을 미리 지어내 보이지 않는다.
    expect(screen.queryByText('미승인')).not.toBeInTheDocument();
  });

  /* 아직 없는 자원이라 잠글 대상이 없다 — 계약이 If-Match를 요구하지 않는다. */
  it('등록은 If-Match 없이 멱등 키만 실어 보낸다', async () => {
    const { requests, user } = renderScreen([
      planListRoute(),
      ...lookupRoutes(),
      planCreateRoute(),
      planDetailRoute({ ...inspectionPlanFixtures[0]!, inspectionPlanId: 3010 }),
    ]);

    await user.click(await screen.findByRole('button', { name: '기준 추가' }));
    await user.type(await screen.findByLabelText('기준코드'), 'SYN-PLAN-10');
    await user.type(screen.getByLabelText('기준명'), '합성 검사기준 J');
    await user.click(within(planForm()).getByRole('combobox', { name: '검사 유형' }));
    await user.click(screen.getByRole('option', { name: 'OQC (출하검사)' }));
    await user.click(within(planForm()).getByRole('button', { name: '기준 추가' }));

    await screen.findByText('등록했습니다');

    const post = requests.find((request) => request.method === 'POST');
    expect(post?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    expect(post?.headers.get('If-Match')).toBeNull();
    expect(JSON.parse(post?.body ?? '{}')).toEqual({
      inspectionPlanCode: 'SYN-PLAN-10',
      inspectionPlanName: '합성 검사기준 J',
      inspectionTypeCode: 'OQC',
      itemId: null,
      processId: null,
      routingId: null,
    });
  });

  /* 201에는 ETag가 없다 — 새 기준으로 옮겨 상세를 다시 조회해야 잠금 토큰이 생긴다. */
  it('등록에 성공하면 새 기준으로 옮겨 상세를 조회하고 목록도 다시 조회한다', async () => {
    const { requests, user } = renderScreen([
      planListRoute(),
      ...lookupRoutes(),
      planCreateRoute(),
      planDetailRoute({ ...inspectionPlanFixtures[0]!, inspectionPlanId: 3010 }),
    ]);

    await user.click(await screen.findByRole('button', { name: '기준 추가' }));
    await user.type(await screen.findByLabelText('기준코드'), 'SYN-PLAN-10');
    await user.type(screen.getByLabelText('기준명'), '합성 검사기준 J');
    await user.click(within(planForm()).getByRole('combobox', { name: '검사 유형' }));
    await user.click(screen.getByRole('option', { name: 'OQC (출하검사)' }));
    await user.click(within(planForm()).getByRole('button', { name: '기준 추가' }));

    await waitFor(() => {
      expect(requestsTo(requests, `${PLANS_PATH}/3010`)).toHaveLength(1);
    });
    expect(planRequests(requests).length).toBeGreaterThan(1);
  });

  it('등록 폼에서 로컬 검증에 걸리면 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen([
      planListRoute(),
      ...lookupRoutes(),
      planCreateRoute(),
    ]);

    await user.click(await screen.findByRole('button', { name: '기준 추가' }));
    await user.type(await screen.findByLabelText('기준코드'), 'SYN-PLAN-10');
    await user.click(within(planForm()).getByRole('button', { name: '기준 추가' }));

    expect(await screen.findAllByText('필수 입력 항목입니다.')).toHaveLength(2);
    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(0);
  });
});

describe('InspectionStandardScreen — 라우팅 선택의 품목 의존', () => {
  /* 계약이 itemId를 필수 쿼리로 둔다 — 품목이 없으면 보낼 수 없는 요청이다. */
  it('품목이 널인 기준에서는 라우팅 요청이 나가지 않고 선택칸이 비활성이다', async () => {
    const { requests } = renderScreen(
      [
        planListRoute(),
        planDetailRoute(inspectionPlanFixtures[2]),
        itemOptionsRoute(),
        processOptionsRoute(),
        routingOptionsRoute(),
      ],
      '?plan=3003',
    );

    expect(await screen.findByRole('combobox', { name: '라우팅' })).toBeDisabled();
    expect(
      screen.getByText('라우팅은 품목을 고른 뒤에 고를 수 있습니다. 먼저 품목을 고르세요.'),
    ).toBeInTheDocument();
    expect(requestsTo(requests, '/planning/routings')).toHaveLength(0);
  });

  it('품목을 고르면 그 품목의 라우팅을 조회한다', async () => {
    const { requests, user } = renderScreen(
      [planListRoute(), planDetailRoute(inspectionPlanFixtures[2]), ...lookupRoutes()],
      '?plan=3003',
    );

    await user.click(await screen.findByRole('combobox', { name: '품목' }));
    await user.click(screen.getByRole('option', { name: 'SYN-ITEM-01 · 합성 품목 A' }));

    await waitFor(() => {
      expect(requestsTo(requests, '/planning/routings')).toHaveLength(1);
    });
    expect(requestsTo(requests, '/planning/routings')[0]?.url.searchParams.get('itemId')).toBe(
      '5001',
    );
  });

  /* 다른 품목의 라우팅을 가리키면 안 된다 — 자동 승계를 넣지 않는다. */
  it('품목을 바꾸면 라우팅 값이 비워진다', async () => {
    const { user } = renderScreen(
      [planListRoute(), planDetailRoute(inspectionPlanFixtures[1]), ...lookupRoutes()],
      '?plan=3002',
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: '라우팅' })).toHaveTextContent(
        'SYN-ROUTE-01 · Rev 3',
      );
    });

    await user.click(screen.getByRole('combobox', { name: '품목' }));
    await user.click(screen.getByRole('option', { name: 'SYN-ITEM-02 · 합성 품목 B' }));

    expect(screen.getByRole('combobox', { name: '라우팅' })).not.toHaveTextContent(
      'SYN-ROUTE-01 · Rev 3',
    );
  });

  /* 알리지 않으면 이름이 이유 없이 비어 보이고 사용자는 값이 사라진 줄 안다. */
  it('선택 목록이 잘리면 그 사실을 폼 위에 낸다', async () => {
    renderScreen(
      [planListRoute(), planDetailRoute(), itemOptionsRoute(), processOptionsRoute(120), routingOptionsRoute()],
      '?plan=3001',
    );

    expect(
      await screen.findByText('선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.'),
    ).toBeInTheDocument();
  });
});
