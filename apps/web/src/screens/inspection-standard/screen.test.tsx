import { messages } from '@omf-mes/i18n';
import type { QueryClient } from '@tanstack/react-query';
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
import { pickDate } from '../../test/date-picker';
import { inspectionPlanFixtures, inspectionPlanVersionFixtures } from './fixtures';
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
      await screen.findByText(
        '이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.',
      ),
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
    renderScreen(
      [planListRoute(inspectionPlanFixtures, { page: 2, size: 3, total: 6 })],
      '?page=2',
    );
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
      screen.getByText(
        '엑셀 올리기는 아직 할 수 없습니다. 양식이 정해지면 이 버튼을 쓸 수 있습니다.',
      ),
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
  match: (request) => isGet(request, `${PLANS_PATH}/${String(plan.inspectionPlanId)}`),
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
          lotControlled: true,
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
          lotControlled: true,
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
  match: (request) =>
    request.method === 'PUT' && new URL(request.url).pathname === PLAN_DETAIL_PATH,
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

/**
 * 상세가 도착해 폼이 그려질 때까지 기다린다.
 *
 * 불러오는 중 구획과 폼 구획은 **다른 컴포넌트**라 React가 DOM 노드를 갈아 끼운다 —
 * 기다리기 전에 구획을 잡아 두면 그 노드는 화면에서 떨어져 나가 아무것도 찾지 못한다.
 */
const awaitPlanForm = async (): Promise<HTMLElement> => {
  await screen.findByLabelText('기준코드');

  return planForm();
};

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
      [
        planListRoute(),
        planDetailRoute(),
        itemOptionsRoute(),
        processOptionsRoute(120),
        routingOptionsRoute(),
      ],
      '?plan=3001',
    );

    expect(
      await screen.findByText(
        '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
      ),
    ).toBeInTheDocument();
  });
});

const APPROVE_PATH = `${PLANS_PATH}/3001:approve`;
const DEACTIVATE_PATH = `${PLANS_PATH}/3001:deactivate`;

const planActionRoute = (
  action: 'approve' | 'deactivate',
  respond: StubRoute['respond'] = () => jsonResponse(inspectionPlanFixtures[0]),
): StubRoute => ({
  match: (request) =>
    request.method === 'POST' && new URL(request.url).pathname === `${PLANS_PATH}/3001:${action}`,
  respond,
});

const dialog = async (): Promise<HTMLElement> => screen.findByRole('dialog');

describe('InspectionStandardScreen — 기준 승인', () => {
  it('「승인」을 누르면 확인 창이 열리고 확인 전에는 요청이 나가지 않는다', async () => {
    const { requests, user } = renderSelectedPlan([planActionRoute('approve')]);

    await user.click(within(await awaitPlanForm()).getByRole('button', { name: '승인' }));

    expect(await dialog()).toBeInTheDocument();
    expect(screen.getByText('이 검사기준을 승인할까요?')).toBeInTheDocument();
    expect(requestsTo(requests, APPROVE_PATH)).toHaveLength(0);
  });

  /* 승인자와 승인 시각은 서버가 함께 기록한다 — 화면이 보내지 않는다. */
  it('확인하면 본문 없이 멱등 키만 실어 보내고 If-Match를 싣지 않는다', async () => {
    const { requests, user } = renderSelectedPlan([planActionRoute('approve')]);

    await user.click(within(await awaitPlanForm()).getByRole('button', { name: '승인' }));
    await user.click(within(await dialog()).getByRole('button', { name: '승인' }));

    await screen.findByText('저장했습니다');

    const posts = requestsTo(requests, APPROVE_PATH);
    expect(posts).toHaveLength(1);
    expect(posts[0]?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    expect(posts[0]?.headers.get('If-Match')).toBeNull();
    expect(posts[0]?.body).toBe('');
  });

  /* 두 요청의 멱등 키가 같으면 서버가 두 번째를 첫 번째의 재시도로 본다. */
  it('멱등 키는 요청마다 새로 만든다', async () => {
    const { requests, user } = renderSelectedPlan([
      planActionRoute('approve', () =>
        jsonResponse(
          { errors: [{ scope: 'screen', code: 'STANDARD', message: '거부' }] },
          { status: 400 },
        ),
      ),
    ]);

    await user.click(within(await awaitPlanForm()).getByRole('button', { name: '승인' }));
    const confirmButton = within(await dialog()).getByRole('button', { name: '승인' });
    await user.click(confirmButton);
    await screen.findByText('거부');
    await user.click(confirmButton);

    await waitFor(() => {
      expect(requestsTo(requests, APPROVE_PATH)).toHaveLength(2);
    });

    const keys = requestsTo(requests, APPROVE_PATH).map((request) =>
      request.headers.get('Idempotency-Key'),
    );
    expect(keys[0]).toMatch(UUID_PATTERN);
    expect(keys[0]).not.toBe(keys[1]);
  });

  /* 서버가 코드만 주고 문구를 비워 보내는 일이 실제로 있다. */
  it('확정 버전이 없다는 거부는 서버 문구가 비어도 화면 안내가 남는다', async () => {
    const { user } = renderSelectedPlan([
      planActionRoute('approve', () =>
        jsonResponse(
          { errors: [{ scope: 'screen', code: 'CONFIRMED_VERSION_REQUIRED', message: '' }] },
          { status: 400 },
        ),
      ),
    ]);

    await user.click(within(await awaitPlanForm()).getByRole('button', { name: '승인' }));
    await user.click(within(await dialog()).getByRole('button', { name: '승인' }));

    expect(
      await screen.findByText(
        '승인은 확정된 버전이 있어야 할 수 있습니다. 버전을 먼저 확정하세요.',
      ),
    ).toBeInTheDocument();
  });

  /* 닫으면 사용자는 무엇이 막았는지 모른 채 같은 버튼을 다시 누른다. */
  it('실패해도 확인 창이 닫히지 않는다', async () => {
    const { user } = renderSelectedPlan([
      planActionRoute('approve', () => jsonResponse({ message: '' }, { status: 403 })),
    ]);

    await user.click(within(await awaitPlanForm()).getByRole('button', { name: '승인' }));
    await user.click(within(await dialog()).getByRole('button', { name: '승인' }));

    expect(
      await screen.findByText(
        '이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  /* 응답에 ETag가 없다 — 재조회로 새 잠금 토큰을 확보해야 그다음 저장이 막히지 않는다. */
  it('성공하면 목록과 상세를 다시 조회하고 창이 닫힌다', async () => {
    const { requests, user } = renderSelectedPlan([planActionRoute('approve')]);

    await screen.findByLabelText('기준코드');
    const before = {
      detail: requestsTo(requests, PLAN_DETAIL_PATH).length,
      list: planRequests(requests).length,
    };

    await user.click(within(planForm()).getByRole('button', { name: '승인' }));
    await user.click(within(await dialog()).getByRole('button', { name: '승인' }));
    await screen.findByText('저장했습니다');

    await waitFor(() => {
      expect(requestsTo(requests, PLAN_DETAIL_PATH).length).toBeGreaterThan(before.detail);
    });
    expect(planRequests(requests).length).toBeGreaterThan(before.list);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('확인 창에서 취소하면 요청이 나가지 않는다', async () => {
    const { requests, user } = renderSelectedPlan([planActionRoute('approve')]);

    await user.click(within(await awaitPlanForm()).getByRole('button', { name: '승인' }));
    await user.click(within(await dialog()).getByRole('button', { name: '취소' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(requestsTo(requests, APPROVE_PATH)).toHaveLength(0);
  });

  it('이미 승인된 기준은 승인이 비활성이고 사유가 보인다', async () => {
    renderScreen(
      [planListRoute(), planDetailRoute(inspectionPlanFixtures[2]), ...lookupRoutes()],
      '?plan=3003',
    );

    expect(within(await awaitPlanForm()).getByRole('button', { name: '승인' })).toBeDisabled();
    expect(screen.getByText('승인은 이미 승인된 기준에 다시 할 수 없습니다.')).toBeInTheDocument();
  });

  it('등록 폼에서는 승인·사용 중지가 비활성이고 사유가 보인다', async () => {
    const { user } = renderScreen([planListRoute(), ...lookupRoutes()]);

    await user.click(await screen.findByRole('button', { name: '기준 추가' }));

    const form = planForm();
    expect(within(form).getByRole('button', { name: '승인' })).toBeDisabled();
    expect(within(form).getByRole('button', { name: '사용 중지' })).toBeDisabled();
    expect(screen.getByText('승인은 기준을 먼저 등록해야 할 수 있습니다.')).toBeInTheDocument();
  });
});

describe('InspectionStandardScreen — 기준 사용 중지', () => {
  /* 같은 기준의 두 액션인데도 규약이 다르다 — 사용 중지는 If-Match 를 요구한다. */
  it('확인하면 If-Match를 함께 실어 보낸다', async () => {
    const { requests, user } = renderSelectedPlan([planActionRoute('deactivate')]);

    await user.click(within(await awaitPlanForm()).getByRole('button', { name: '사용 중지' }));
    await user.click(within(await dialog()).getByRole('button', { name: '사용 중지' }));

    await screen.findByText('저장했습니다');

    const posts = requestsTo(requests, DEACTIVATE_PATH);
    expect(posts).toHaveLength(1);
    expect(posts[0]?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    expect(posts[0]?.headers.get('If-Match')).toBe('"7"');
  });

  it('확인 전에는 요청이 나가지 않는다', async () => {
    const { requests, user } = renderSelectedPlan([planActionRoute('deactivate')]);

    await user.click(within(await awaitPlanForm()).getByRole('button', { name: '사용 중지' }));

    expect(screen.getByText('이 검사기준을 사용 중지할까요?')).toBeInTheDocument();
    expect(requestsTo(requests, DEACTIVATE_PATH)).toHaveLength(0);
  });

  it('이미 미사용인 기준은 사용 중지가 비활성이고 사유가 보인다', async () => {
    renderScreen(
      [planListRoute(), planDetailRoute(inspectionPlanFixtures[2]), ...lookupRoutes()],
      '?plan=3003',
    );

    expect(within(await awaitPlanForm()).getByRole('button', { name: '사용 중지' })).toBeDisabled();
    expect(
      screen.getByText('사용 중지는 이미 미사용인 기준에 다시 할 수 없습니다.'),
    ).toBeInTheDocument();
  });

  /* 사용 중지에는 409가 있다(계약 실측) — 재조회하면 풀린다. */
  it('충돌이면 원인 문구와 「최신 불러오기」가 창 안에 나온다', async () => {
    const { user } = renderSelectedPlan([
      planActionRoute('deactivate', () =>
        jsonResponse({ conflictCause: 'workerLease', message: '' }, { status: 409 }),
      ),
    ]);

    await user.click(within(await awaitPlanForm()).getByRole('button', { name: '사용 중지' }));
    await user.click(within(await dialog()).getByRole('button', { name: '사용 중지' }));

    expect(
      await screen.findByText(
        '다른 작업에서 이 항목을 처리하는 중입니다. 잠시 뒤 최신 내용을 불러와 다시 저장하세요.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '최신 불러오기' })).toBeInTheDocument();
  });
});

const VERSIONS_PATH = '/quality/inspection-plan-versions';

const versionListRoute = (items = inspectionPlanVersionFixtures): StubRoute => ({
  match: (request) => isGet(request, VERSIONS_PATH),
  respond: () => jsonResponse({ items }),
});

const versionCreateRoute = (
  respond: StubRoute['respond'] = () =>
    jsonResponse(
      { ...inspectionPlanVersionFixtures[0], inspectionPlanVersionId: 4010, planVersion: 1 },
      { status: 201 },
    ),
): StubRoute => ({
  match: (request) => request.method === 'POST' && new URL(request.url).pathname === VERSIONS_PATH,
  respond,
});

const newRevisionRoute = (
  sourceVersionId = 4002,
  respond: StubRoute['respond'] = () =>
    jsonResponse(
      { ...inspectionPlanVersionFixtures[0], inspectionPlanVersionId: 4003, planVersion: 3 },
      { status: 201 },
    ),
): StubRoute => ({
  match: (request) =>
    request.method === 'POST' &&
    new URL(request.url).pathname === `${VERSIONS_PATH}/${String(sourceVersionId)}:new-revision`,
  respond,
});

const versionPane = (): HTMLElement => screen.getByRole('region', { name: '버전 목록' });

const versionRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requestsTo(requests, VERSIONS_PATH);

/** 넘긴 규칙이 기본 규칙보다 **앞선다** — 스텁은 첫 일치를 쓰므로 이 순서가 곧 덮어쓰기다. */
const renderVersions = (extraRoutes: StubRoute[] = [], search = '?plan=3001') =>
  renderScreen(
    [...extraRoutes, planListRoute(), planDetailRoute(), versionListRoute(), ...lookupRoutes()],
    search,
  );

describe('InspectionStandardScreen — 버전 목록', () => {
  it('기준을 고르기 전에는 버전 요청이 나가지 않는다', async () => {
    const { requests } = renderScreen([planListRoute(), versionListRoute(), ...lookupRoutes()]);
    await screen.findByRole('button', { name: 'SYN-PLAN-01' });

    expect(versionRequests(requests)).toHaveLength(0);
  });

  it('기준을 고르면 기준 번호를 실은 버전 요청이 한 번 나가고 목록이 그려진다', async () => {
    const { requests, user } = renderScreen([
      planListRoute(),
      planDetailRoute(),
      versionListRoute(),
      ...lookupRoutes(),
    ]);

    await user.click(await screen.findByRole('button', { name: 'SYN-PLAN-01' }));

    expect(await screen.findByRole('button', { name: '버전 2' })).toBeInTheDocument();

    const gets = versionRequests(requests).filter((request) => request.method === 'GET');
    expect(gets).toHaveLength(1);
    expect(gets[0]?.url.searchParams.get('inspectionPlanId')).toBe('3001');
  });

  it('버전을 누르면 주소에 남아 선택 표식이 붙는다', async () => {
    const { user } = renderVersions();

    await user.click(await screen.findByRole('button', { name: '버전 1' }));

    expect(screen.getByRole('button', { name: '버전 1' })).toHaveAttribute('aria-current', 'true');
  });

  it('주소의 ver로 버전 선택이 복원된다', async () => {
    renderVersions([], '?plan=3001&ver=4001');

    expect(await screen.findByRole('button', { name: '버전 1' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  /* 다른 기준의 버전을 가리키면 안 된다. */
  it('기준을 바꾸면 버전 선택이 지워진다', async () => {
    const { user } = renderScreen(
      [
        planListRoute(),
        planDetailRoute(),
        planDetailRoute(inspectionPlanFixtures[1]),
        versionListRoute(),
        ...lookupRoutes(),
      ],
      '?plan=3001&ver=4001',
    );

    expect(await screen.findByRole('button', { name: '버전 1' })).toHaveAttribute(
      'aria-current',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'SYN-PLAN-02' }));

    expect(screen.getByRole('button', { name: '버전 1' })).not.toHaveAttribute('aria-current');
  });

  it('버전 조회에 실패하면 목록 대신 오류 배너가 나온다', async () => {
    renderScreen(
      [
        planListRoute(),
        planDetailRoute(),
        {
          match: (request) => isGet(request, VERSIONS_PATH),
          respond: () => jsonResponse({ message: '버전을 불러오지 못했습니다.' }, { status: 500 }),
        },
        ...lookupRoutes(),
      ],
      '?plan=3001',
    );

    expect(await screen.findByText('버전을 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.queryByText('등록된 버전이 없습니다')).not.toBeInTheDocument();
  });

  /*
   * 미인식을 잠금으로 두면 실서버가 다른 문자열을 쓰는 순간 작성중 버전도 편집할 수 없다.
   * 원문을 그대로 내고 편집을 연다 — 서버 400이 최종 방어선이다.
   */
  it('인식하지 못한 상태 코드는 원문을 그대로 배지에 낸다', async () => {
    renderVersions([
      versionListRoute([{ ...inspectionPlanVersionFixtures[0]!, statusCode: 'IN_REVIEW' }]),
    ]);

    expect(await screen.findByText('IN_REVIEW')).toBeInTheDocument();
  });

  it('빈 상태 코드는 작성중으로 낸다', async () => {
    renderVersions([versionListRoute([{ ...inspectionPlanVersionFixtures[0]!, statusCode: '' }])]);

    expect(await screen.findByText('작성중')).toBeInTheDocument();
  });
});

describe('InspectionStandardScreen — 신규 버전 두 갈래', () => {
  it('버전이 0건이면 중 페인 액션이 「버전 등록」이다', async () => {
    renderVersions([versionListRoute([])]);

    expect(
      await within(versionPane()).findByRole('button', { name: '버전 등록' }),
    ).toBeInTheDocument();
    expect(
      within(versionPane()).queryByRole('button', { name: '신규 버전 발행' }),
    ).not.toBeInTheDocument();
  });

  it('버전이 1건 이상이면 중 페인 액션이 「신규 버전 발행」이다', async () => {
    renderVersions();

    expect(
      await within(versionPane()).findByRole('button', { name: '신규 버전 발행' }),
    ).toBeInTheDocument();
    expect(
      within(versionPane()).queryByRole('button', { name: '버전 등록' }),
    ).not.toBeInTheDocument();
  });

  /* 버전이 0건이면 복사할 원본이 없다 — 생성 경로를 쓴다. */
  it('「버전 등록」의 저장은 생성 경로로 나가고 기준 번호를 싣는다', async () => {
    const { requests, user } = renderVersions([versionListRoute([]), versionCreateRoute()]);

    await user.click(await within(versionPane()).findByRole('button', { name: '버전 등록' }));

    const form = screen.getByRole('region', { name: '버전 정보' });
    await pickDate(user, within(form).getByLabelText('유효시작'), '2026-08-01');
    await user.click(within(form).getByRole('combobox', { name: '샘플링 방법' }));
    await user.click(screen.getByRole('option', { name: '선택지 준비 중' }));
    await user.click(within(form).getByRole('combobox', { name: '검사 주기' }));
    await user.click(screen.getByRole('option', { name: '선택지 준비 중' }));
    await user.click(within(form).getByRole('button', { name: '버전 등록' }));

    await screen.findByText('등록했습니다');

    const post = versionRequests(requests).find((request) => request.method === 'POST');
    expect(post?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    expect(post?.headers.get('If-Match')).toBeNull();

    const body = JSON.parse(post?.body ?? '{}') as Record<string, unknown>;
    expect(body.inspectionPlanId).toBe(3001);
    // 달력에서 고른 날이 그대로 요청에 실린다 — 입력 수단이 바뀌어도 나가는 값의 형식은 그대로다.
    expect(body.effectiveFrom).toBe('2026-08-01');
    expect('planVersion' in body).toBe(false);
    expect('statusCode' in body).toBe(false);
  });

  /* 버전이 1건 이상이면 개정 경로다 — 생성 경로를 부르면 유일 제약을 위반한다. */
  it('「신규 버전 발행」은 개정 경로로 나가고 본문이 없다', async () => {
    const { requests, user } = renderVersions([newRevisionRoute()]);

    await user.click(await within(versionPane()).findByRole('button', { name: '신규 버전 발행' }));

    await screen.findByText('등록했습니다');

    const posts = requestsTo(requests, `${VERSIONS_PATH}/4002:new-revision`);
    expect(posts).toHaveLength(1);
    expect(posts[0]?.body).toBe('');
    expect(posts[0]?.headers.get('If-Match')).toBeNull();
    // 생성 경로를 부르지 않는다.
    expect(versionRequests(requests).filter((request) => request.method === 'POST')).toHaveLength(
      0,
    );
  });

  /*
   * 계약이 목록을 판 번호 내림차순으로 준다 — 첫 행이 최신이다.
   * 마지막 행을 대상으로 삼으면 옛 판을 복사하게 된다.
   */
  it('아무것도 고르지 않았으면 목록 첫 행을 원본으로 삼는다', async () => {
    const { requests, user } = renderVersions([newRevisionRoute(4002)]);

    await user.click(await within(versionPane()).findByRole('button', { name: '신규 버전 발행' }));
    await screen.findByText('등록했습니다');

    expect(requestsTo(requests, `${VERSIONS_PATH}/4002:new-revision`)).toHaveLength(1);
    expect(requestsTo(requests, `${VERSIONS_PATH}/4001:new-revision`)).toHaveLength(0);
  });

  it('버전을 골랐으면 그 버전을 원본으로 삼는다', async () => {
    const { requests, user } = renderVersions([newRevisionRoute(4001)], '?plan=3001&ver=4001');

    await user.click(await within(versionPane()).findByRole('button', { name: '신규 버전 발행' }));
    await screen.findByText('등록했습니다');

    expect(requestsTo(requests, `${VERSIONS_PATH}/4001:new-revision`)).toHaveLength(1);
  });

  /* 201에는 ETag가 없다 — 새 버전으로 옮겨 다시 조회해야 잠금 토큰이 생긴다. */
  it('발행에 성공하면 새 버전으로 옮기고 버전 목록을 다시 조회한다', async () => {
    const { requests, user } = renderVersions([newRevisionRoute()]);

    await within(versionPane()).findByRole('button', { name: '신규 버전 발행' });
    const before = versionRequests(requests).filter((request) => request.method === 'GET').length;

    await user.click(within(versionPane()).getByRole('button', { name: '신규 버전 발행' }));
    await screen.findByText('등록했습니다');

    await waitFor(() => {
      expect(
        versionRequests(requests).filter((request) => request.method === 'GET').length,
      ).toBeGreaterThan(before);
    });
  });

  /*
   * 원본이 확정이 아니면 서버가 거부한다 — 화면은 막지 않는다(상태 어휘가 미확정이다).
   * 재조회해도 풀리지 않으므로 「최신 불러오기」를 내지 않는다.
   */
  it('상태 잠김은 「최신 불러오기」 없는 배너로 낸다', async () => {
    const { user } = renderVersions([
      newRevisionRoute(4002, () =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'screen',
                code: 'STATE_LOCKED',
                message: '확정된 버전에서만 신규 버전을 발행할 수 있습니다.',
              },
            ],
          },
          { status: 400 },
        ),
      ),
    ]);

    await user.click(await within(versionPane()).findByRole('button', { name: '신규 버전 발행' }));

    expect(
      await screen.findByText('확정된 버전에서만 신규 버전을 발행할 수 있습니다.'),
    ).toBeInTheDocument();
    expect(screen.getByText('지금은 저장할 수 없는 상태입니다')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '최신 불러오기' })).not.toBeInTheDocument();
  });

  it('기준에 저장하지 않은 변경이 있으면 발행이 비활성이고 사유가 보인다', async () => {
    const { user } = renderVersions([newRevisionRoute()]);

    await user.type(await screen.findByLabelText('기준명'), 'X');

    expect(within(versionPane()).getByRole('button', { name: '신규 버전 발행' })).toBeDisabled();
    expect(
      screen.getByText(
        '신규 버전 발행은 저장하지 않은 변경이 있으면 할 수 없습니다. 먼저 저장하거나 취소하세요.',
      ),
    ).toBeInTheDocument();
  });

  it('등록 폼에서 로컬 검증에 걸리면 요청이 나가지 않는다', async () => {
    const { requests, user } = renderVersions([versionListRoute([]), versionCreateRoute()]);

    await user.click(await within(versionPane()).findByRole('button', { name: '버전 등록' }));

    const form = screen.getByRole('region', { name: '버전 정보' });
    await pickDate(user, within(form).getByLabelText('유효시작'), '2026-08-01');
    await user.click(within(form).getByRole('button', { name: '버전 등록' }));

    expect(await screen.findAllByText('필수 입력 항목입니다.')).toHaveLength(2);
    expect(versionRequests(requests).filter((request) => request.method === 'POST')).toHaveLength(
      0,
    );
  });
});

const VERSION_DETAIL_PATH = `${VERSIONS_PATH}/4002`;
const ITEMS_PATH = `${VERSIONS_PATH}/4002/items`;

const versionDetailRoute = (
  version = inspectionPlanVersionFixtures[0]!,
  etag = '"11"',
): StubRoute => ({
  match: (request) => isGet(request, `${VERSIONS_PATH}/${String(version.inspectionPlanVersionId)}`),
  respond: () =>
    jsonResponse(
      { inspectionPlanVersion: version, editability: DEFAULT_EDITABILITY },
      { headers: { ETag: etag } },
    ),
});

const itemSpecFixture = {
  inspectionItemSpecId: 5101,
  inspectionPlanVersionId: 4002,
  sequenceNo: 10,
  inspectionItemCode: 'SYN-ITEM-CODE-01',
  inspectionItemName: '합성 항목 A',
  dataTypeCode: 'PENDING',
  uomId: 41,
  targetValue: 10,
  lowerLimit: 9,
  upperLimit: 11,
  measurementCount: 3,
  inspectionMethodCode: null,
  defaultInspectionEquipmentId: null,
  requiredFlag: true,
  automaticJudgment: true,
};

const itemListRoute = (versionId = 4002, items: unknown[] = [itemSpecFixture]): StubRoute => ({
  match: (request) => isGet(request, `${VERSIONS_PATH}/${String(versionId)}/items`),
  respond: () => jsonResponse({ items }),
});

const versionSaveRoute = (
  respond: StubRoute['respond'] = () => jsonResponse(inspectionPlanVersionFixtures[0]),
): StubRoute => ({
  match: (request) =>
    request.method === 'PUT' && new URL(request.url).pathname === VERSION_DETAIL_PATH,
  respond,
});

const versionTransitionRoute = (
  action: 'confirm' | 'obsolete',
  versionId = 4002,
  respond: StubRoute['respond'] = () => jsonResponse(inspectionPlanVersionFixtures[0]),
): StubRoute => ({
  match: (request) =>
    request.method === 'POST' &&
    new URL(request.url).pathname === `${VERSIONS_PATH}/${String(versionId)}:${action}`,
  respond,
});

const versionForm = (): HTMLElement => screen.getByRole('region', { name: '버전 정보' });

/** 버전 상세가 도착해 폼이 그려질 때까지 기다린다 — 불러오는 중 구획과 폼 구획은 다른 컴포넌트다. */
const awaitVersionForm = async (): Promise<HTMLElement> => {
  await screen.findByLabelText('샘플 비율(%)');

  return versionForm();
};

const renderSelectedVersion = (extraRoutes: StubRoute[] = [], search = '?plan=3001&ver=4002') =>
  renderScreen(
    [
      ...extraRoutes,
      planListRoute(),
      planDetailRoute(),
      versionListRoute(),
      versionDetailRoute(),
      itemListRoute(),
      ...lookupRoutes(),
    ],
    search,
  );

describe('InspectionStandardScreen — 버전 상세와 샘플 비율 표기', () => {
  it('버전을 고르면 상세 요청이 한 번 나가고 폼이 응답 값으로 채워진다', async () => {
    const { requests, user } = renderScreen(
      [
        planListRoute(),
        planDetailRoute(),
        versionListRoute(),
        versionDetailRoute(),
        itemListRoute(),
        ...lookupRoutes(),
      ],
      '?plan=3001',
    );

    await user.click(await screen.findByRole('button', { name: '버전 2' }));

    expect(await screen.findByLabelText('샘플 비율(%)')).toHaveValue(30);
    expect(requestsTo(requests, VERSION_DETAIL_PATH)).toHaveLength(1);
  });

  it('버전을 고르기 전에는 상세 요청이 나가지 않는다', async () => {
    const { requests } = renderScreen(
      [
        planListRoute(),
        planDetailRoute(),
        versionListRoute(),
        versionDetailRoute(),
        itemListRoute(),
        ...lookupRoutes(),
      ],
      '?plan=3001',
    );
    await screen.findByRole('button', { name: '버전 2' });

    expect(requestsTo(requests, VERSION_DETAIL_PATH)).toHaveLength(0);
  });

  /*
   * 단위를 라벨에 박지 않으면 30을 30개로 읽는다. 「비율이 아니라 개수」를 밝히던
   * 보조 안내는 그 어긋남이 사라져 함께 없앴다(#201).
   */
  it('샘플 비율 라벨이 단위를 담고 옛 보조 안내가 남지 않는다', async () => {
    renderSelectedVersion();

    // 음성 단언은 짝 양성과 같은 시점에 잰다 — 폼이 도착한 뒤에 잰다.
    expect(await screen.findByLabelText('샘플 비율(%)')).toBeInTheDocument();
    expect(screen.queryByText(/비율\(%\)이 아니라/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/샘플 수량/)).not.toBeInTheDocument();
  });

  it('0인 합격판정개수가 빈 칸으로 뭉개지지 않는다', async () => {
    renderSelectedVersion();

    expect(await screen.findByLabelText('합격판정개수')).toHaveValue(0);
  });

  /* 상태 값 목록이 확정되지 않았다는 사실을 감추지 않는다. 되풀이하지도 않는다. */
  it('상태 임시 안내가 화면에 한 번만 보인다', async () => {
    renderSelectedVersion();

    await awaitVersionForm();

    expect(
      screen.getAllByText(
        '상태 표시는 임시입니다 — 상태 값 목록이 확정되면 이 표시가 바뀔 수 있습니다.',
      ),
    ).toHaveLength(1);
  });

  it('버전 상세 조회에 실패하면 폼 대신 오류 배너가 나온다', async () => {
    renderSelectedVersion([
      {
        match: (request) => isGet(request, VERSION_DETAIL_PATH),
        respond: () =>
          jsonResponse({ message: '버전 정보를 불러오지 못했습니다.' }, { status: 500 }),
      },
    ]);

    expect(await screen.findByText('버전 정보를 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.queryByLabelText('샘플 비율(%)')).not.toBeInTheDocument();
  });
});

describe('InspectionStandardScreen — 버전 저장', () => {
  it('저장이 멱등 키와 If-Match를 함께 실어 나가고 금지 항목을 싣지 않는다', async () => {
    const { requests, user } = renderSelectedVersion([versionSaveRoute()]);

    const form = await awaitVersionForm();
    fireEvent.change(within(form).getByLabelText('샘플 비율(%)'), { target: { value: '40' } });
    await user.click(within(form).getByRole('button', { name: '저장' }));

    await screen.findByText('저장했습니다');

    const put = requests.find(
      (request) => request.method === 'PUT' && request.url.pathname === VERSION_DETAIL_PATH,
    );
    expect(put?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    expect(put?.headers.get('If-Match')).toBe('"11"');

    const body = JSON.parse(put?.body ?? '{}') as Record<string, unknown>;
    expect(body.samplingRatio).toBe(40);
    expect('inspectionPlanId' in body).toBe(false);
    expect('planVersion' in body).toBe(false);
    expect('statusCode' in body).toBe(false);
  });

  /*
   * 비율은 그대로 실린다 — 수량으로 환산하려면 로트 크기가 필요하고 그것은 검사 시점에
   * 정해진다(#201 ④). 옛 이름을 함께 실으면 어느 쪽이 이기는지를 또 정해야 한다.
   */
  it('저장 본문에 비율이 입력값 그대로 실리고 옛 수량 키는 실리지 않는다', async () => {
    const { requests, user } = renderSelectedVersion([versionSaveRoute()]);

    const form = await awaitVersionForm();
    fireEvent.change(within(form).getByLabelText('샘플 비율(%)'), { target: { value: '30.5' } });
    await user.click(within(form).getByRole('button', { name: '저장' }));

    await screen.findByText('저장했습니다');

    const put = requests.find(
      (request) => request.method === 'PUT' && request.url.pathname === VERSION_DETAIL_PATH,
    );
    const body = JSON.parse(put?.body ?? '{}') as Record<string, unknown>;

    // 음성 단언은 짝 양성과 같은 시점에 잰다 — 값이 실려 있음을 먼저 확인한다.
    expect(body.samplingRatio).toBe(30.5);
    expect(Object.keys(body)).toContain('samplingRatio');
    expect(Object.keys(body)).not.toContain('samplingQty');
  });

  it('유효기간이 역전되면 두 칸 모두에 오류를 내고 보내지 않는다', async () => {
    const { requests, user } = renderSelectedVersion([versionSaveRoute()]);

    const form = await awaitVersionForm();
    await pickDate(user, within(form).getByLabelText('유효시작'), '2026-09-01');
    await pickDate(user, within(form).getByLabelText('유효종료'), '2026-08-01');
    await user.click(within(form).getByRole('button', { name: '저장' }));

    expect(
      await screen.findAllByText('유효종료는 유효시작과 같거나 그 뒤여야 합니다.'),
    ).toHaveLength(2);
    expect(
      requests.filter(
        (request) => request.method === 'PUT' && request.url.pathname === VERSION_DETAIL_PATH,
      ),
    ).toHaveLength(0);
  });

  it('주기 값만 채우면 두 칸 모두에 오류를 내고 보내지 않는다', async () => {
    const { requests, user } = renderSelectedVersion([versionSaveRoute()]);

    const form = await awaitVersionForm();
    fireEvent.change(within(form).getByLabelText('주기 값'), { target: { value: '4' } });
    await user.click(within(form).getByRole('button', { name: '저장' }));

    expect(
      await screen.findAllByText('주기 값과 주기 단위는 함께 채우거나 함께 비워야 합니다.'),
    ).toHaveLength(2);
    expect(
      requests.filter(
        (request) => request.method === 'PUT' && request.url.pathname === VERSION_DETAIL_PATH,
      ),
    ).toHaveLength(0);
  });

  /*
   * 세 칸의 하한 규칙이 서로 다르다 — 하나로 뭉뚱그리면 0이 잘못 막히거나 잘못 통과한다.
   * 샘플 비율의 0은 **종전에는 통과였다**(수량 minimum: 0). #201 로 뒤집힌 자리다.
   */
  it('불합격판정개수 0과 샘플 비율 0은 막히고 합격판정개수 0은 막히지 않는다', async () => {
    const { requests, user } = renderSelectedVersion([versionSaveRoute()]);

    const form = await awaitVersionForm();
    fireEvent.change(within(form).getByLabelText('불합격판정개수'), { target: { value: '0' } });
    fireEvent.change(within(form).getByLabelText('합격판정개수'), { target: { value: '0' } });
    fireEvent.change(within(form).getByLabelText('샘플 비율(%)'), { target: { value: '0' } });
    await user.click(within(form).getByRole('button', { name: '저장' }));

    expect(
      await screen.findByText('불합격판정개수는 0보다 큰 숫자여야 합니다.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('샘플 비율(%)은 0보다 크고 100 이하인 값이어야 합니다.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('합격판정개수는 0 이상의 숫자여야 합니다.')).not.toBeInTheDocument();
    expect(
      requests.filter(
        (request) => request.method === 'PUT' && request.url.pathname === VERSION_DETAIL_PATH,
      ),
    ).toHaveLength(0);
  });

  it('충돌이면 「최신 불러오기」가 나온다', async () => {
    const { user } = renderSelectedVersion([
      versionSaveRoute(() => jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 })),
    ]);

    const form = await awaitVersionForm();
    fireEvent.change(within(form).getByLabelText('샘플 비율(%)'), { target: { value: '40' } });
    await user.click(within(form).getByRole('button', { name: '저장' }));

    expect(
      await screen.findByText(
        '다른 사용자가 먼저 저장했습니다. 최신 내용을 불러온 뒤 다시 저장하세요.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '최신 불러오기' })).toBeInTheDocument();
  });
});

describe('InspectionStandardScreen — 상태 잠금', () => {
  it('확정 버전에서는 전 입력이 잠기고 푸는 방법을 안내한다', async () => {
    renderSelectedVersion(
      [versionDetailRoute(inspectionPlanVersionFixtures[1]), itemListRoute(4001)],
      '?plan=3001&ver=4001',
    );

    expect(await screen.findByLabelText('샘플 비율(%)')).toBeDisabled();
    expect(screen.getByLabelText('유효시작')).toBeDisabled();
    expect(screen.getByLabelText('합격판정개수')).toBeDisabled();
    expect(screen.getByRole('combobox', { name: '샘플링 방법' })).toBeDisabled();
    expect(
      screen.getByText('확정된 버전은 수정할 수 없습니다. 변경하려면 신규 버전을 발행하세요.'),
    ).toBeInTheDocument();
  });

  it('폐기 버전에서도 전 입력이 잠긴다', async () => {
    renderSelectedVersion(
      [
        versionDetailRoute({ ...inspectionPlanVersionFixtures[1]!, statusCode: 'OBSOLETE' }),
        itemListRoute(4001),
      ],
      '?plan=3001&ver=4001',
    );

    expect(await screen.findByLabelText('샘플 비율(%)')).toBeDisabled();
    expect(
      screen.getByText('폐기된 버전은 수정할 수 없습니다. 변경하려면 신규 버전을 발행하세요.'),
    ).toBeInTheDocument();
  });

  /* 미인식 코드를 잠그면 실서버가 다른 문자열을 쓰는 순간 사용자가 풀 방법이 없다. */
  it('인식하지 못한 상태 코드에서는 편집이 열린다', async () => {
    renderSelectedVersion([
      versionDetailRoute({ ...inspectionPlanVersionFixtures[0]!, statusCode: 'IN_REVIEW' }),
    ]);

    expect(await screen.findByLabelText('샘플 비율(%)')).toBeEnabled();
  });
});

describe('InspectionStandardScreen — 확정과 폐기', () => {
  it('「확정」은 확인 창을 거쳐 본문 없이 If-Match도 없이 나간다', async () => {
    const { requests, user } = renderSelectedVersion([versionTransitionRoute('confirm')]);

    const form = await awaitVersionForm();
    await user.click(within(form).getByRole('button', { name: '확정' }));

    expect(await dialog()).toBeInTheDocument();
    expect(requestsTo(requests, `${VERSIONS_PATH}/4002:confirm`)).toHaveLength(0);

    await user.click(within(await dialog()).getByRole('button', { name: '확정' }));
    await screen.findByText('저장했습니다');

    const posts = requestsTo(requests, `${VERSIONS_PATH}/4002:confirm`);
    expect(posts).toHaveLength(1);
    expect(posts[0]?.body).toBe('');
    expect(posts[0]?.headers.get('If-Match')).toBeNull();
    expect(posts[0]?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
  });

  /* 응답에 ETag가 없다 — 재조회로 새 잠금 토큰을 확보해야 그다음 저장이 막히지 않는다. */
  it('전이에 성공하면 버전 목록·상세·항목을 다시 조회한다', async () => {
    const { requests, user } = renderSelectedVersion([versionTransitionRoute('confirm')]);

    const form = await awaitVersionForm();
    const before = {
      detail: requestsTo(requests, VERSION_DETAIL_PATH).length,
      items: requestsTo(requests, ITEMS_PATH).length,
      list: versionRequests(requests).filter((request) => request.method === 'GET').length,
    };

    await user.click(within(form).getByRole('button', { name: '확정' }));
    await user.click(within(await dialog()).getByRole('button', { name: '확정' }));
    await screen.findByText('저장했습니다');

    await waitFor(() => {
      expect(requestsTo(requests, VERSION_DETAIL_PATH).length).toBeGreaterThan(before.detail);
    });
    expect(requestsTo(requests, ITEMS_PATH).length).toBeGreaterThan(before.items);
    expect(
      versionRequests(requests).filter((request) => request.method === 'GET').length,
    ).toBeGreaterThan(before.list);
  });

  it('전이에 실패해도 확인 창이 닫히지 않는다', async () => {
    const { user } = renderSelectedVersion([
      versionTransitionRoute('confirm', 4002, () =>
        jsonResponse(
          { errors: [{ scope: 'screen', code: 'LINE_REQUIRED', message: '' }] },
          { status: 400 },
        ),
      ),
    ]);

    const form = await awaitVersionForm();
    await user.click(within(form).getByRole('button', { name: '확정' }));
    await user.click(within(await dialog()).getByRole('button', { name: '확정' }));

    expect(
      await screen.findByText('확정은 검사 항목을 1건 이상 저장해야 할 수 있습니다.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  /* 계약이 항목 1건 이상을 요구한다 — 화면이 먼저 막고 사유를 밝힌다. */
  it('저장된 항목이 0건이면 확정이 비활성이고 사유가 보인다', async () => {
    renderSelectedVersion([itemListRoute(4002, [])]);

    const form = await awaitVersionForm();

    await waitFor(() => {
      expect(within(form).getByRole('button', { name: '확정' })).toBeDisabled();
    });
    expect(
      screen.getByText('확정은 검사 항목을 1건 이상 저장해야 할 수 있습니다.'),
    ).toBeInTheDocument();
  });

  /* 확정하면 되돌릴 수 없다 — 저장하지 않은 편집은 그 순간 영영 사라진다. */
  it('저장하지 않은 편집이 있으면 확정과 신규 버전 발행이 비활성이다', async () => {
    renderSelectedVersion();

    const form = await awaitVersionForm();
    fireEvent.change(within(form).getByLabelText('샘플 비율(%)'), { target: { value: '40' } });

    expect(within(form).getByRole('button', { name: '확정' })).toBeDisabled();
    expect(within(versionPane()).getByRole('button', { name: '신규 버전 발행' })).toBeDisabled();
    expect(
      screen.getByText(
        '확정은 저장하지 않은 변경이 있으면 할 수 없습니다. 먼저 저장하거나 취소하세요.',
      ),
    ).toBeInTheDocument();
  });

  it('작성중 버전에서는 폐기가 비활성이고 먼저 확정하라고 알린다', async () => {
    renderSelectedVersion();

    const form = await awaitVersionForm();

    expect(within(form).getByRole('button', { name: '폐기' })).toBeDisabled();
    expect(
      screen.getByText('폐기는 확정된 버전에만 할 수 있습니다. 먼저 확정하세요.'),
    ).toBeInTheDocument();
  });

  it('확정 버전에서는 폐기가 활성이고 확인하면 요청이 나간다', async () => {
    const { requests, user } = renderSelectedVersion(
      [
        versionDetailRoute(inspectionPlanVersionFixtures[1]),
        itemListRoute(4001),
        versionTransitionRoute('obsolete', 4001),
      ],
      '?plan=3001&ver=4001',
    );

    await screen.findByLabelText('샘플 비율(%)');
    const form = versionForm();

    await user.click(within(form).getByRole('button', { name: '폐기' }));
    await user.click(within(await dialog()).getByRole('button', { name: '폐기' }));
    await screen.findByText('저장했습니다');

    const posts = requestsTo(requests, `${VERSIONS_PATH}/4001:obsolete`);
    expect(posts).toHaveLength(1);
    expect(posts[0]?.headers.get('If-Match')).toBeNull();
  });

  /* 계약에 경로가 없다. 감추면 「이 화면에는 없는 기능」으로 오해한다. */
  it('버전 비교와 변경 이력은 비활성이고 사유가 보인다', async () => {
    renderSelectedVersion();

    const form = await awaitVersionForm();

    expect(within(form).getByRole('button', { name: '버전 비교' })).toBeDisabled();
    expect(within(form).getByRole('button', { name: '변경 이력' })).toBeDisabled();
    expect(
      screen.getByText(
        '버전 비교는 아직 할 수 없습니다. 비교 기능이 준비되면 이 버튼을 쓸 수 있습니다.',
      ),
    ).toBeInTheDocument();
  });
});

const uomOptionsRoute = (total = 1): StubRoute => ({
  match: (request) => isGet(request, '/mdm/uoms'),
  respond: () =>
    jsonResponse({
      items: [{ uomId: 41, uomCode: 'EA', uomName: '개', decimalScale: 0, isActive: true }],
      page: { page: 1, size: 50, total },
    }),
});

const equipmentOptionsRoute = (): StubRoute => ({
  match: (request) => isGet(request, '/mdm/equipments'),
  respond: () =>
    jsonResponse({
      items: [
        {
          equipmentId: 6001,
          plantId: 1,
          equipmentCode: 'SYN-EQ-01',
          equipmentName: '합성 설비 A',
          equipmentTypeCode: 'PENDING',
          processId: null,
          productionLineId: null,
          statusCode: 'PENDING',
          calibrationRequired: false,
          lastCalibrationDate: null,
          calibrationDueDate: null,
          isActive: true,
        },
      ],
      page: { page: 1, size: 50, total: 1 },
    }),
});

const itemsSaveRoute = (
  respond: StubRoute['respond'] = () => jsonResponse({ items: [itemSpecFixture] }),
): StubRoute => ({
  match: (request) => request.method === 'PUT' && new URL(request.url).pathname === ITEMS_PATH,
  respond,
});

const itemFixtures = [
  itemSpecFixture,
  {
    ...itemSpecFixture,
    inspectionItemSpecId: 5102,
    sequenceNo: 20,
    inspectionItemCode: 'SYN-ITEM-CODE-02',
    inspectionItemName: '합성 항목 B',
    uomId: null,
    targetValue: null,
    lowerLimit: null,
    upperLimit: null,
    measurementCount: 1,
    requiredFlag: false,
    automaticJudgment: false,
  },
];

const itemPane = (): HTMLElement => screen.getByRole('region', { name: '검사 항목' });

const renderItems = (extraRoutes: StubRoute[] = [], search = '?plan=3001&ver=4002') =>
  renderScreen(
    [
      ...extraRoutes,
      planListRoute(),
      planDetailRoute(),
      versionListRoute(),
      versionDetailRoute(),
      itemListRoute(4002, itemFixtures),
      uomOptionsRoute(),
      equipmentOptionsRoute(),
      ...lookupRoutes(),
    ],
    search,
  );

describe('InspectionStandardScreen — 검사 항목 조회', () => {
  it('버전을 고르면 항목 요청이 한 번 나간다', async () => {
    const { requests, user } = renderItems([], '?plan=3001');

    await user.click(await screen.findByRole('button', { name: '버전 2' }));

    expect(await screen.findByText('SYN-ITEM-CODE-01 · 합성 항목 A')).toBeInTheDocument();
    expect(requestsTo(requests, ITEMS_PATH)).toHaveLength(1);
  });

  /* 서버 채번은 서버 재량이다 — 그 값을 그대로 보이면 사용자가 그것을 자료로 읽는다. */
  it('서버가 순서 값 10·20을 줘도 표시 번호는 1·2다', async () => {
    renderItems();

    await screen.findByText('SYN-ITEM-CODE-01 · 합성 항목 A');

    const rows = within(itemPane()).getAllByRole('row').slice(1);
    expect(within(rows[0]!).getByText('1')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('2')).toBeInTheDocument();
    expect(within(itemPane()).queryByText('10')).not.toBeInTheDocument();
  });

  it('단위 id를 선택 목록의 이름으로 옮겨 보인다', async () => {
    renderItems();

    await screen.findByText('SYN-ITEM-CODE-01 · 합성 항목 A');

    await waitFor(() => {
      expect(within(itemPane()).getByText('10 · 9~11 · EA · 개')).toBeInTheDocument();
    });
  });

  /* 알리지 않으면 이름이 이유 없이 비어 보이고 사용자는 값이 사라진 줄 안다. */
  it('단위 선택 목록이 잘리면 그 사실을 표 위에 낸다', async () => {
    renderItems([uomOptionsRoute(120)]);

    await screen.findByText('SYN-ITEM-CODE-01 · 합성 항목 A');

    expect(
      within(itemPane()).getByText(
        '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
      ),
    ).toBeInTheDocument();
  });

  /* 지금 고른 값이 목록에 없어도 지우지 않는다 — 지우면 저장 때 조용히 다른 값이 된다. */
  it('선택 목록에 없는 단위 값은 알 수 없음으로 낸다', async () => {
    renderItems([
      itemListRoute(4002, [{ ...itemSpecFixture, uomId: 99 }]),
      {
        match: (request) => isGet(request, '/mdm/uoms'),
        respond: () => jsonResponse({ items: [], page: { page: 1, size: 50, total: 0 } }),
      },
    ]);

    expect(
      await screen.findByText(`10 · 9~11 · ${messages.common.reference.unknown}`),
    ).toBeInTheDocument();
    expect(screen.queryByText('10 · 9~11 · 99')).not.toBeInTheDocument();
  });

  it('항목 조회에 실패하면 표 대신 오류 배너가 나온다', async () => {
    renderItems([
      {
        match: (request) => isGet(request, ITEMS_PATH),
        respond: () =>
          jsonResponse({ message: '검사 항목을 불러오지 못했습니다.' }, { status: 500 }),
      },
    ]);

    expect(await screen.findByText('검사 항목을 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.queryByText('등록된 검사 항목이 없습니다')).not.toBeInTheDocument();
  });
});

describe('InspectionStandardScreen — 검사 항목 편집', () => {
  /* 순서 컬럼에 유일 제약이 있어 행 단위 저장이 성립하지 않는다. */
  it('창에서 확인하면 표에만 반영되고 요청이 나가지 않는다', async () => {
    const { requests, user } = renderItems([itemsSaveRoute()]);

    await screen.findByText('SYN-ITEM-CODE-01 · 합성 항목 A');
    await user.click(within(itemPane()).getByRole('button', { name: '항목 추가' }));

    const dialogNode = await dialog();
    await user.type(within(dialogNode).getByLabelText('항목코드'), 'SYN-ITEM-CODE-09');
    await user.type(within(dialogNode).getByLabelText('항목명'), '합성 항목 Z');
    expect(
      within(dialogNode).getByText(
        '확인을 누르면 표에만 반영됩니다. 「저장」을 눌러야 서버에 반영됩니다.',
      ),
    ).toBeInTheDocument();

    await user.click(within(dialogNode).getByRole('button', { name: '확인' }));

    expect(await screen.findByText('SYN-ITEM-CODE-09 · 합성 항목 Z')).toBeInTheDocument();
    expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(0);
  });

  /* 계약에 버전 내 유일 제약이 없다 — 막는 곳이 화면과 서버뿐이다. */
  it('같은 항목코드를 두 행에 넣으면 확인이 막힌다', async () => {
    const { user } = renderItems([itemsSaveRoute()]);

    await screen.findByText('SYN-ITEM-CODE-01 · 합성 항목 A');
    await user.click(within(itemPane()).getByRole('button', { name: '항목 추가' }));

    const dialogNode = await dialog();
    await user.type(within(dialogNode).getByLabelText('항목코드'), 'SYN-ITEM-CODE-01');
    await user.type(within(dialogNode).getByLabelText('항목명'), '합성 항목 Z');
    await user.click(within(dialogNode).getByRole('button', { name: '확인' }));

    expect(
      await screen.findByText('같은 항목코드가 이 버전에 이미 있습니다. 다른 코드를 입력하세요.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  /* 수정할 때 자기 코드가 그대로여도 통과해야 한다. */
  it('자기 자신을 수정할 때 코드가 그대로면 통과한다', async () => {
    const { user } = renderItems([itemsSaveRoute()]);

    await screen.findByText('SYN-ITEM-CODE-01 · 합성 항목 A');
    await user.click(within(itemPane()).getByRole('button', { name: '1번 항목 수정' }));

    const dialogNode = await dialog();
    await user.type(within(dialogNode).getByLabelText('항목명'), '-수정');
    await user.click(within(dialogNode).getByRole('button', { name: '확인' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('SYN-ITEM-CODE-01 · 합성 항목 A-수정')).toBeInTheDocument();
  });

  it('상한이 하한보다 작으면 확인이 막힌다', async () => {
    const { user } = renderItems([itemsSaveRoute()]);

    await screen.findByText('SYN-ITEM-CODE-01 · 합성 항목 A');
    await user.click(within(itemPane()).getByRole('button', { name: '1번 항목 수정' }));

    const dialogNode = await dialog();
    fireEvent.change(within(dialogNode).getByLabelText('상한'), { target: { value: '1' } });
    await user.click(within(dialogNode).getByRole('button', { name: '확인' }));

    expect(await screen.findAllByText('상한은 하한과 같거나 그보다 커야 합니다.')).toHaveLength(2);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('측정 횟수가 0이면 확인이 막힌다', async () => {
    const { user } = renderItems([itemsSaveRoute()]);

    await screen.findByText('SYN-ITEM-CODE-01 · 합성 항목 A');
    await user.click(within(itemPane()).getByRole('button', { name: '1번 항목 수정' }));

    const dialogNode = await dialog();
    fireEvent.change(within(dialogNode).getByLabelText('측정 횟수'), { target: { value: '0' } });
    await user.click(within(dialogNode).getByRole('button', { name: '확인' }));

    expect(await screen.findByText('측정 횟수는 1 이상의 정수여야 합니다.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  /* 계약 A-9 ⓑ — 경고 등급이다. 화면이 막으면 서버가 허용한 값을 넣을 방법이 없어진다. */
  it('목표값이 범위 밖이면 경고가 뜨지만 확인은 막히지 않는다', async () => {
    const { user } = renderItems([itemsSaveRoute()]);

    await screen.findByText('SYN-ITEM-CODE-01 · 합성 항목 A');
    await user.click(within(itemPane()).getByRole('button', { name: '1번 항목 수정' }));

    const dialogNode = await dialog();
    fireEvent.change(within(dialogNode).getByLabelText('목표값'), { target: { value: '99' } });

    expect(
      await within(dialogNode).findByText('목표값이 하한~상한 밖입니다. 의도한 값인지 확인하세요.'),
    ).toBeInTheDocument();

    await user.click(within(dialogNode).getByRole('button', { name: '확인' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /* 창을 열 때만 붙인다 — 닫힌 창을 남기면 지난 편집 값이 그대로 살아 있다. */
  it('창을 닫았다 다시 열면 지난 편집 값이 남지 않는다', async () => {
    const { user } = renderItems([itemsSaveRoute()]);

    await screen.findByText('SYN-ITEM-CODE-01 · 합성 항목 A');
    await user.click(within(itemPane()).getByRole('button', { name: '항목 추가' }));

    await user.type(within(await dialog()).getByLabelText('항목코드'), 'SYN-BUFFER');
    await user.click(within(await dialog()).getByRole('button', { name: '취소' }));

    await user.click(within(itemPane()).getByRole('button', { name: '항목 추가' }));

    expect(within(await dialog()).getByLabelText('항목코드')).toHaveValue('');
  });
});

describe('InspectionStandardScreen — 검사 항목 저장', () => {
  it('저장이 If-Match 없이 나가고 순서·식별자·버전 번호를 계약대로 싣는다', async () => {
    const { requests, user } = renderItems([itemsSaveRoute()]);

    await screen.findByText('SYN-ITEM-CODE-01 · 합성 항목 A');

    // 새 행을 하나 더한 뒤 순서를 바꿔 저장한다.
    await user.click(within(itemPane()).getByRole('button', { name: '항목 추가' }));
    const dialogNode = await dialog();
    await user.type(within(dialogNode).getByLabelText('항목코드'), 'SYN-ITEM-CODE-09');
    await user.type(within(dialogNode).getByLabelText('항목명'), '합성 항목 Z');
    await user.click(within(dialogNode).getByRole('button', { name: '확인' }));

    await user.click(within(itemPane()).getByRole('button', { name: '저장' }));
    await screen.findByText('저장했습니다');

    const put = requests.find(
      (request) => request.method === 'PUT' && request.url.pathname === ITEMS_PATH,
    );
    expect(put?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    expect(put?.headers.get('If-Match')).toBeNull();

    const body = JSON.parse(put?.body ?? '{}') as {
      items: {
        sequenceNo: number;
        inspectionPlanVersionId: number;
        inspectionItemSpecId?: number;
      }[];
    };

    expect(body.items.map((item) => item.sequenceNo)).toEqual([1, 2, 3]);
    expect(body.items[0]?.inspectionItemSpecId).toBe(5101);
    expect('inspectionItemSpecId' in (body.items[2] ?? {})).toBe(false);
    expect(body.items.every((item) => item.inspectionPlanVersionId === 4002)).toBe(true);
  });

  /*
   * **잠금 토큰이 없어도 항목 저장은 나가야 한다.** 계약이 이 경로에 If-Match 를 요구하지 않으므로
   * 화면이 상세 경로를 잠금 출처로 지정하면, 토큰을 찾지 못한 순간 요청을 보내지 않고 멈춰
   * 「저장을 눌러도 아무 일이 없다」가 된다 — 이 화면에서 가장 사고가 나기 쉬운 자리다.
   */
  it('버전 상세에 잠금 토큰이 없어도 항목 저장 요청이 나간다', async () => {
    const { requests, user } = renderItems([
      {
        match: (request) => isGet(request, VERSION_DETAIL_PATH),
        respond: () =>
          jsonResponse({
            inspectionPlanVersion: inspectionPlanVersionFixtures[0],
            editability: DEFAULT_EDITABILITY,
          }),
      },
      itemsSaveRoute(),
    ]);

    await screen.findByText('SYN-ITEM-CODE-01 · 합성 항목 A');
    await user.click(within(itemPane()).getByRole('button', { name: '2번 항목 삭제' }));
    await user.click(within(itemPane()).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(
        requests.filter(
          (request) => request.method === 'PUT' && request.url.pathname === ITEMS_PATH,
        ),
      ).toHaveLength(1);
    });
    expect(
      screen.queryByText('최신 정보를 불러오는 중입니다. 잠시 뒤 다시 저장하세요.'),
    ).not.toBeInTheDocument();
  });

  /* 이동은 초안만 바꾼다 — 순서 컬럼에 유일 제약이 있어 행 단위 저장이 성립하지 않는다. */
  it('순서를 바꿔도 서버 요청이 나가지 않는다', async () => {
    const { requests, user } = renderItems([itemsSaveRoute()]);

    await screen.findByText('SYN-ITEM-CODE-01 · 합성 항목 A');

    const moveButtons = within(itemPane()).getAllByRole('button', { name: /아래로|위로/ });
    await user.click(moveButtons[0]!);

    expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(0);
  });

  /* 채번 방식은 서버 재량이라 보낸 값과 다를 수 있다 — 서버가 정본이다. */
  it('저장 성공 후 서버 응답으로 초안을 다시 세운다', async () => {
    const { user } = renderItems([
      itemsSaveRoute(() =>
        jsonResponse({
          items: [{ ...itemSpecFixture, sequenceNo: 100, inspectionItemName: '서버가 고친 이름' }],
        }),
      ),
    ]);

    await screen.findByText('SYN-ITEM-CODE-01 · 합성 항목 A');
    await user.click(within(itemPane()).getByRole('button', { name: '2번 항목 삭제' }));
    await user.click(within(itemPane()).getByRole('button', { name: '저장' }));

    expect(await screen.findByText('SYN-ITEM-CODE-01 · 서버가 고친 이름')).toBeInTheDocument();
    // 서버 채번 값(100)이 아니라 목록 안의 위치를 낸다.
    expect(within(itemPane()).queryByText('100')).not.toBeInTheDocument();
  });

  /*
   * 서버가 준 목록에 이미 중복이 있을 수 있다 — 화면이 만든 행만 검사하면
   * 옛 중복이 전체 치환에 실려 나가 저장 전체가 거부된다.
   */
  it('서버가 준 목록에 이미 중복 코드가 있으면 저장이 비활성이고 사유가 보인다', async () => {
    renderItems([
      itemListRoute(4002, [
        itemSpecFixture,
        { ...itemSpecFixture, inspectionItemSpecId: 5102, sequenceNo: 20 },
      ]),
    ]);

    await screen.findAllByText('SYN-ITEM-CODE-01 · 합성 항목 A');

    expect(within(itemPane()).getByRole('button', { name: '저장' })).toBeDisabled();
    expect(
      screen.getByText(
        '항목 저장은 저장할 수 없는 항목이 섞여 있으면 할 수 없습니다. 표에서 그 항목을 수정하세요.',
      ),
    ).toBeInTheDocument();
  });

  it('버전 정보에 저장하지 않은 변경이 있으면 항목 저장이 비활성이다', async () => {
    const { user } = renderItems([itemsSaveRoute()]);

    await screen.findByText('SYN-ITEM-CODE-01 · 합성 항목 A');
    await user.click(within(itemPane()).getByRole('button', { name: '2번 항목 삭제' }));

    fireEvent.change(within(versionForm()).getByLabelText('샘플 비율(%)'), {
      target: { value: '40' },
    });

    expect(within(itemPane()).getByRole('button', { name: '저장' })).toBeDisabled();
    expect(
      screen.getByText(
        '항목 저장은 버전 정보에 저장하지 않은 변경이 있으면 할 수 없습니다. 먼저 저장하거나 취소하세요.',
      ),
    ).toBeInTheDocument();
  });

  it('확정 버전에서는 항목 편집이 잠기고 순서 이동 열이 사라진다', async () => {
    renderItems(
      [versionDetailRoute(inspectionPlanVersionFixtures[1]), itemListRoute(4001, itemFixtures)],
      '?plan=3001&ver=4001',
    );

    await screen.findByText('SYN-ITEM-CODE-01 · 합성 항목 A');

    expect(within(itemPane()).getByRole('button', { name: '항목 추가' })).toBeDisabled();
    expect(within(itemPane()).getByRole('button', { name: '1번 항목 수정' })).toBeDisabled();
    expect(
      within(itemPane()).queryByRole('button', { name: /아래로|위로/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByText(
        '검사 항목은 작성중 버전에서만 편집할 수 있습니다. 변경하려면 신규 버전을 발행하세요.',
      ).length,
    ).toBeGreaterThan(0);
  });

  /* 저장하지 않은 초안으로 세면 화면은 1건인데 서버는 0건이라 확정이 400으로 거부된다. */
  it('저장된 항목이 0건이면 초안이 있어도 확정이 비활성이다', async () => {
    const { user } = renderItems([itemListRoute(4002, []), itemsSaveRoute()]);

    await screen.findByText('등록된 검사 항목이 없습니다');

    await user.click(within(itemPane()).getByRole('button', { name: '항목 추가' }));
    const dialogNode = await dialog();
    await user.type(within(dialogNode).getByLabelText('항목코드'), 'SYN-ITEM-CODE-09');
    await user.type(within(dialogNode).getByLabelText('항목명'), '합성 항목 Z');
    await user.click(within(dialogNode).getByRole('button', { name: '확인' }));

    expect(await screen.findByText('SYN-ITEM-CODE-09 · 합성 항목 Z')).toBeInTheDocument();
    expect(within(versionForm()).getByRole('button', { name: '확정' })).toBeDisabled();
    /*
     * 사유가 「1건 이상 저장해야」여야 한다 — 초안으로 세면 이 사유가 사라지고
     * 「저장하지 않은 변경」 사유로 바뀐다. 그 차이가 곧 「저장된 건수로 센다」의 증거다.
     */
    expect(
      screen.getByText('확정은 검사 항목을 1건 이상 저장해야 할 수 있습니다.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        '확정은 저장하지 않은 변경이 있으면 할 수 없습니다. 먼저 저장하거나 취소하세요.',
      ),
    ).not.toBeInTheDocument();
  });
});

/**
 * 선택 목록 조회가 **실패**했을 때의 안내.
 *
 * 잘림과 「목록에 없는 값」은 이미 각각 덮여 있으나 실패 갈래는 계약이 정한 세 입력 중 하나이며
 * 알리지 않으면 이름이 이유 없이 비어 보이고 사용자는 값이 사라진 줄 안다.
 *
 * **실패가 잘림보다 우선한다** — 둘 다 참일 때 잘림 안내를 내면 「일부만 표시됩니다」가
 * 「아예 못 불러왔습니다」를 덮어 사용자가 지금 목록을 믿게 된다.
 */
describe('InspectionStandardScreen — 선택 목록 조회 실패', () => {
  it('품목·공정 조회가 실패하면 기준 폼 위에 그 사실을 내고 잘림 안내로 덮지 않는다', async () => {
    renderScreen(
      [
        {
          match: (request) => isGet(request, '/mdm/items'),
          respond: () => jsonResponse({ message: '' }, { status: 500 }),
        },
        // 공정 목록은 성공하되 잘려서 온다 — 두 안내가 함께 참인 상태를 만든다.
        processOptionsRoute(120),
        planListRoute(),
        planDetailRoute(),
        versionListRoute(),
        routingOptionsRoute(),
      ],
      '?plan=3001',
    );

    const form = await awaitPlanForm();

    expect(
      await within(form).findByText(
        '선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.',
      ),
    ).toBeInTheDocument();
    expect(
      within(form).queryByText(
        '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
      ),
    ).not.toBeInTheDocument();
  });

  it('단위·설비 조회가 실패하면 검사 항목 표 위에 그 사실을 내고 잘림 안내로 덮지 않는다', async () => {
    renderItems([
      {
        match: (request) => isGet(request, '/mdm/uoms'),
        respond: () => jsonResponse({ message: '' }, { status: 500 }),
      },
      // 설비 목록은 성공하되 잘려서 온다 — 두 안내가 함께 참인 상태를 만든다.
      {
        match: (request) => isGet(request, '/mdm/equipments'),
        respond: () =>
          jsonResponse({
            items: [
              {
                equipmentId: 6001,
                plantId: 1,
                equipmentCode: 'SYN-EQ-01',
                equipmentName: '합성 설비 A',
                equipmentTypeCode: 'PENDING',
                processId: null,
                productionLineId: null,
                statusCode: 'PENDING',
                calibrationRequired: false,
                lastCalibrationDate: null,
                calibrationDueDate: null,
                isActive: true,
              },
            ],
            page: { page: 1, size: 50, total: 120 },
          }),
      },
    ]);

    await screen.findByText('SYN-ITEM-CODE-01 · 합성 항목 A');

    expect(
      await within(itemPane()).findByText(
        '선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.',
      ),
    ).toBeInTheDocument();
    expect(
      within(itemPane()).getByText(`10 · 9~11 · ${messages.common.reference.failed}`),
    ).toBeInTheDocument();
    expect(within(itemPane()).queryByText('10 · 9~11 · 41')).not.toBeInTheDocument();
    expect(
      within(itemPane()).queryByText(
        '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
      ),
    ).not.toBeInTheDocument();
  });
});

/**
 * 선택을 옮기면 **편집 중이던 폼 상태도 함께 비운다**(결정 2).
 *
 * 비우지 않으면 상세를 다시 받을 수 없는 자리에서 옛 편집이 갇히고,
 * 그 편집은 화면 어디에도 보이지 않으면서 액션만 막는다 — 사용자가 풀 방법이 없다.
 */
describe('InspectionStandardScreen — 선택을 옮기면 폼 편집도 비운다', () => {
  it('버전 폼을 고친 채 다른 기준을 고르면 신규 버전 발행이 다시 열린다', async () => {
    const { user } = renderScreen(
      [
        planListRoute(),
        planDetailRoute(),
        planDetailRoute(inspectionPlanFixtures[1]),
        versionListRoute(),
        versionDetailRoute(),
        itemListRoute(),
        uomOptionsRoute(),
        equipmentOptionsRoute(),
        ...lookupRoutes(),
      ],
      '?plan=3001&ver=4002',
    );

    const form = await awaitVersionForm();
    fireEvent.change(within(form).getByLabelText('샘플 비율(%)'), { target: { value: '40' } });

    // 고친 상태에서는 발행이 막힌다 — 여기까지는 의도한 동작이다.
    expect(within(versionPane()).getByRole('button', { name: '신규 버전 발행' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'SYN-PLAN-02' }));

    /*
     * 기준을 바꾸면 `ver`가 사라져 버전 상세 조회가 꺼진다 — 폼 상태를 비우지 않으면
     * 재시드가 영영 일어나지 않아 「저장하지 않은 변경」이 참으로 굳는다.
     */
    await waitFor(() => {
      expect(within(versionPane()).getByRole('button', { name: '신규 버전 발행' })).toBeEnabled();
    });
    expect(
      screen.queryByText(
        '신규 버전 발행은 저장하지 않은 변경이 있으면 할 수 없습니다. 먼저 저장하거나 취소하세요.',
      ),
    ).not.toBeInTheDocument();
  });

  /*
   * 같은 규칙의 기준 폼 쪽. **상세 응답 객체가 그대로여도** 폼 상태를 비우면 재시드 조건이
   * 성립해 서버 값으로 다시 세워진다 — 비우지 않으면 옛 편집이 그대로 남는다.
   */
  it('기준 폼을 고친 뒤 같은 기준을 다시 고르면 고친 값이 남지 않는다', async () => {
    const { user } = renderSelectedPlan();

    const name = await screen.findByLabelText('기준명');
    await user.type(name, '-편집중');
    expect(screen.getByLabelText('기준명')).toHaveValue('합성 검사기준 A-편집중');

    await user.click(screen.getByRole('button', { name: 'SYN-PLAN-01' }));

    await waitFor(() => {
      expect(screen.getByLabelText('기준명')).toHaveValue('합성 검사기준 A');
    });
  });
});

/**
 * 결과는 있는데 이 쪽에는 없다 — 주소를 손으로 고치거나 조건이 좁아졌을 때 생긴다.
 * 「등록된 것이 없다」로 내면 사실과 다른 안내가 된다.
 */
describe('InspectionStandardScreen — 범위 밖 쪽', () => {
  it('결과가 있는데 이 쪽에 없으면 범위 밖 안내를 내고 0건 안내를 내지 않는다', async () => {
    renderScreen([planListRoute([], { page: 9, size: 50, total: 240 })], '?page=9');

    expect(await screen.findByText('이 쪽에는 결과가 없습니다')).toBeInTheDocument();
    expect(screen.getByText('첫 쪽으로 이동하세요.')).toBeInTheDocument();
    expect(screen.queryByText('등록된 검사기준이 없습니다')).not.toBeInTheDocument();
    expect(screen.queryByText('조건에 맞는 검사기준이 없습니다')).not.toBeInTheDocument();
  });

  it('「첫 쪽으로」를 누르면 첫 쪽을 다시 조회한다', async () => {
    const { requests, user } = renderScreen(
      [planListRoute([], { page: 9, size: 50, total: 240 })],
      '?page=9',
    );

    await user.click(await screen.findByRole('button', { name: '첫 쪽으로' }));

    expect(planRequests(requests).at(-1)?.url.searchParams.has('page')).toBe(false);
  });
});
