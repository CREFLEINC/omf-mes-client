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
import {
  businessUnitFixtures,
  partnerFixtures,
  plantFixtures,
  uomFixtures,
  warehouseFixtures,
} from './fixtures';
import { WarehouseLocationScreen } from './screen';
import type { Warehouse } from './types';

const ROUTE = '/master-data/warehouse-location';

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

const warehouseListRoute = (items = warehouseFixtures, total = items.length): StubRoute => ({
  match: (request) => isGet(request, '/mdm/warehouses'),
  respond: () => jsonResponse(listBody(items, total)),
});

/** 선택 목록 4종. 화면이 항상 조회하므로 스텁을 빠뜨리면 하네스가 던진다. */
const lookupRoutes = (truncatedTotal?: number): StubRoute[] => [
  {
    match: (request) => isGet(request, '/mdm/plants'),
    respond: () => jsonResponse(listBody(plantFixtures, truncatedTotal ?? plantFixtures.length)),
  },
  {
    match: (request) => isGet(request, '/mdm/business-units'),
    respond: () => jsonResponse(listBody(businessUnitFixtures)),
  },
  {
    match: (request) => isGet(request, '/mdm/partners'),
    respond: () => jsonResponse(listBody(partnerFixtures)),
  },
  {
    match: (request) => isGet(request, '/mdm/uoms'),
    respond: () => jsonResponse(listBody(uomFixtures)),
  },
];

const DEFAULT_EDITABILITY = { codeEditable: true, reason: 'EDITABLE' as const };

const warehouseDetailRoute = (
  warehouse: Warehouse = warehouseFixtures[0]!,
  editability: { codeEditable: boolean; reason: 'EDITABLE' | 'REFERENCED' | 'NOT_COUNTABLE' | 'RECEIVED_FROM_ERP'; referenceCount?: number | null } = DEFAULT_EDITABILITY,
  etag = '"7"',
): StubRoute => ({
  match: (request) => isGet(request, `/mdm/warehouses/${String(warehouse.warehouseId)}`),
  respond: () => jsonResponse({ warehouse, editability }, { headers: { ETag: etag } }),
});

const renderScreen = (
  routes: StubRoute[],
  search = '',
): { requests: RecordedRequest[]; user: ReturnType<typeof userEvent.setup> } => {
  const { fetch, requests } = createRecordingFetch(routes);
  renderWithProviders(<WarehouseLocationScreen />, { fetch, route: `${ROUTE}${search}` });

  return { requests, user: userEvent.setup() };
};

const listRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === '/mdm/warehouses');

describe('WarehouseLocationScreen — 창고 목록 조회', () => {
  it('서버 응답의 창고를 표에 그린다', async () => {
    renderScreen([warehouseListRoute()]);

    expect(await screen.findByRole('button', { name: 'WH-01' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'WH-02' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'WH-03' })).toBeInTheDocument();
  });

  it('조회에 실패하면 표와 빈 상태 대신 오류 배너와 다시 시도가 뜬다', async () => {
    renderScreen([
      {
        match: (request) => isGet(request, '/mdm/warehouses'),
        respond: () => jsonResponse({ message: '' }, { status: 500 }),
      },
    ]);

    expect(await screen.findByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('아직 등록된 창고가 없습니다')).not.toBeInTheDocument();
  });

  it('다시 시도를 누르면 목록 요청이 한 번 더 나간다', async () => {
    const { requests, user } = renderScreen([
      {
        match: (request) => isGet(request, '/mdm/warehouses'),
        respond: () => jsonResponse({ message: '' }, { status: 500 }),
      },
    ]);

    await user.click(await screen.findByRole('button', { name: '다시 시도' }));

    expect(listRequests(requests).length).toBeGreaterThan(1);
  });

  // 응답이 도착하기 전(첫 렌더 직후)의 상태를 본다.
  it('불러오는 동안에는 스켈레톤을 낸다', () => {
    renderScreen([
      {
        match: (request) => isGet(request, '/mdm/warehouses'),
        respond: () => jsonResponse({ items: [], page: { page: 1, size: 20, total: 0 } }),
      },
    ]);

    expect(screen.getByRole('status', { name: '창고 목록을 불러오는 중' })).toBeInTheDocument();
  });

  it('조건을 적용하면 요청 URL에 q·warehouseTypeCode·includeInactive가 실린다', async () => {
    const { requests, user } = renderScreen([warehouseListRoute()]);
    await screen.findByRole('button', { name: 'WH-01' });

    // 미사용 포함은 해제 축이라 즉시 적용되고, 나머지는 조회를 눌러 모아서 적용한다.
    await user.click(screen.getByRole('checkbox', { name: '미사용 포함' }));
    await user.type(screen.getByLabelText('창고 검색'), 'WH-0');
    await user.click(screen.getByRole('combobox', { name: '창고유형' }));
    await user.click(screen.getByRole('option', { name: '자재창고' }));
    await user.click(screen.getByRole('button', { name: '조회' }));

    const last = listRequests(requests).at(-1);
    expect(last?.url.searchParams.get('q')).toBe('WH-0');
    expect(last?.url.searchParams.get('warehouseTypeCode')).toBe('MATERIAL');
    expect(last?.url.searchParams.get('includeInactive')).toBe('true');
  });

  it('조회 조건은 URL에 남는다 — 새로고침·공유가 같은 결과를 낸다', async () => {
    const { requests } = renderScreen([warehouseListRoute()], '?q=WH&type=MATERIAL&inactive=1');

    await screen.findByRole('button', { name: 'WH-01' });

    const first = listRequests(requests)[0];
    expect(first?.url.searchParams.get('q')).toBe('WH');
    expect(first?.url.searchParams.get('warehouseTypeCode')).toBe('MATERIAL');
    expect(first?.url.searchParams.get('includeInactive')).toBe('true');
  });

  it('전체 건수가 받은 건수보다 많으면 잘림 안내를 낸다', async () => {
    renderScreen([warehouseListRoute(warehouseFixtures, 120)]);

    expect(
      await screen.findByText('전체 120건 중 3건을 표시합니다. 조건을 좁혀 조회하세요.'),
    ).toBeInTheDocument();
  });

  it('전부 받았으면 잘림 안내를 내지 않는다', async () => {
    renderScreen([warehouseListRoute()]);
    await screen.findByRole('button', { name: 'WH-01' });

    expect(screen.queryByText(/전체 .*건을 표시합니다/)).not.toBeInTheDocument();
  });

  it('창고를 고르기 전에는 우측이 선택 안내를 낸다', async () => {
    renderScreen([warehouseListRoute()]);
    await screen.findByRole('button', { name: 'WH-01' });

    expect(screen.getByText('좌측에서 창고를 먼저 고르세요')).toBeInTheDocument();
  });

  it('목록의 코드를 누르면 URL의 wh가 바뀐다', async () => {
    const { user } = renderScreen([
      warehouseListRoute(),
      warehouseDetailRoute(warehouseFixtures[1]!),
      ...lookupRoutes(),
    ]);

    await user.click(await screen.findByRole('button', { name: 'WH-02' }));

    expect(screen.getByRole('button', { name: 'WH-02' })).toHaveAttribute('aria-current', 'true');
  });

  it('Location 탭으로 전환하면 보이는 패널 안에서 Location 계층이 조회된다', async () => {
    const { user } = renderScreen(
      [warehouseListRoute(), warehouseDetailRoute(), ...lookupRoutes()],
      '?wh=1001',
    );
    await screen.findByLabelText('창고명');

    await user.click(screen.getByRole('tab', { name: 'Location' }));

    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByRole('button', { name: 'A-01' })).toBeInTheDocument();
  });
});

describe('WarehouseLocationScreen — 창고 상세 조회', () => {
  it('창고를 고르면 상세 요청이 나가고 폼이 응답 값으로 채워진다', async () => {
    const { requests, user } = renderScreen([
      warehouseListRoute(),
      warehouseDetailRoute(warehouseFixtures[1]!),
      ...lookupRoutes(),
    ]);

    await user.click(await screen.findByRole('button', { name: 'WH-02' }));

    expect(await screen.findByLabelText('창고명')).toHaveValue('1공장 제품창고');
    expect(screen.getByLabelText('창고코드')).toHaveValue('WH-02');
    expect(
      requests.some((request) => request.url.pathname === '/mdm/warehouses/1002'),
    ).toBe(true);
  });

  it('고르기 전에는 상세 요청이 나가지 않는다', async () => {
    const { requests } = renderScreen([warehouseListRoute(), ...lookupRoutes()]);
    await screen.findByRole('button', { name: 'WH-01' });

    expect(requests.some((request) => /^\/mdm\/warehouses\/\d+$/.test(request.url.pathname))).toBe(
      false,
    );
  });

  it('코드 편집이 잠긴 창고는 입력이 비활성이고 사유가 화면에 보인다', async () => {
    renderScreen(
      [
        warehouseListRoute(),
        warehouseDetailRoute(warehouseFixtures[0]!, {
          codeEditable: false,
          reason: 'REFERENCED',
          referenceCount: 3,
        }),
        ...lookupRoutes(),
      ],
      '?wh=1001',
    );

    const code = await screen.findByLabelText('창고코드');
    expect(code).toBeDisabled();
    expect(
      screen.getByText('이미 3건에서 사용 중이라 코드를 바꿀 수 없습니다.'),
    ).toBeInTheDocument();
  });

  it('codeEditable이 참이면 코드 입력이 열려 있다', async () => {
    renderScreen(
      [warehouseListRoute(), warehouseDetailRoute(), ...lookupRoutes()],
      '?wh=1001',
    );

    expect(await screen.findByLabelText('창고코드')).not.toBeDisabled();
  });

  it('상세 조회에 실패하면 폼 대신 오류 배너가 나온다', async () => {
    renderScreen(
      [
        warehouseListRoute(),
        {
          match: (request) => isGet(request, '/mdm/warehouses/1001'),
          respond: () => jsonResponse({ message: '' }, { status: 500 }),
        },
        ...lookupRoutes(),
      ],
      '?wh=1001',
    );

    expect(await screen.findByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByLabelText('창고명')).not.toBeInTheDocument();
  });

  it('불러오는 동안에는 빈 폼 대신 스켈레톤을 낸다', () => {
    renderScreen(
      [warehouseListRoute(), warehouseDetailRoute(), ...lookupRoutes()],
      '?wh=1001',
    );

    expect(screen.getByRole('status', { name: '창고 정보를 불러오는 중' })).toBeInTheDocument();
    expect(screen.queryByLabelText('창고명')).not.toBeInTheDocument();
  });

  it('미사용 거래처를 참조하는 창고를 열면 그 값이 표식과 함께 선택지에 남는다', async () => {
    const external: Warehouse = { ...warehouseFixtures[2]!, warehouseId: 1001, partnerId: 32 };
    const { user } = renderScreen(
      [warehouseListRoute(), warehouseDetailRoute(external), ...lookupRoutes()],
      '?wh=1001',
    );

    await screen.findByLabelText('창고명');
    await user.click(screen.getByRole('combobox', { name: '거래처' }));

    expect(screen.getByRole('option', { name: '(주)한빛소재 (미사용)' })).toBeInTheDocument();
  });

  it('선택 목록이 잘리면 폼에 그 사실을 알린다', async () => {
    renderScreen(
      [warehouseListRoute(), warehouseDetailRoute(), ...lookupRoutes(500)],
      '?wh=1001',
    );

    expect(
      await screen.findByText('선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.'),
    ).toBeInTheDocument();
  });

  it('선택 목록 조회가 실패하면 그 사실을 폼에 알린다 — 빈 선택칸을 이유 없이 두지 않는다', async () => {
    renderScreen(
      [
        warehouseListRoute(),
        warehouseDetailRoute(),
        {
          match: (request) => isGet(request, '/mdm/plants'),
          respond: () => jsonResponse({ message: '' }, { status: 500 }),
        },
        ...lookupRoutes().slice(1),
      ],
      '?wh=1001',
    );

    expect(
      await screen.findByText('선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.'),
    ).toBeInTheDocument();
  });

  it('값을 고치면 저장·취소가 열리고 취소하면 서버 값으로 되돌아간다', async () => {
    const { user } = renderScreen(
      [warehouseListRoute(), warehouseDetailRoute(), ...lookupRoutes()],
      '?wh=1001',
    );

    const name = await screen.findByLabelText('창고명');
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();

    await user.type(name, '가');
    expect(screen.getByRole('button', { name: '저장' })).not.toBeDisabled();

    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(screen.getByLabelText('창고명')).toHaveValue('1공장 자재창고');
  });
});
