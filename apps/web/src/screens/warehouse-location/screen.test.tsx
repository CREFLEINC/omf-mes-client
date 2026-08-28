import { onlineManager } from '@tanstack/react-query';
import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import {
  businessUnitFixtures,
  locationFixtures,
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

const locationListRoute = (items = locationFixtures): StubRoute => ({
  match: (request) => isGet(request, '/mdm/locations'),
  respond: () => jsonResponse(listBody(items)),
});

const DEFAULT_EDITABILITY = { codeEditable: true, reason: 'EDITABLE' as const };

const warehouseDetailRoute = (
  warehouse: Warehouse = warehouseFixtures[0]!,
  editability: {
    codeEditable: boolean;
    reason: 'EDITABLE' | 'REFERENCED' | 'NOT_COUNTABLE' | 'RECEIVED_FROM_ERP';
    referenceCount?: number | null;
  } = DEFAULT_EDITABILITY,
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
    // 서버가 빈 message를 줘도 배너에 제목만 남으면 안 된다 — 무엇을 하라는 안내가 사라진다.
    expect(
      screen.getByText('잠시 뒤 다시 시도하세요. 반복되면 담당자에게 알려 주세요.'),
    ).toBeInTheDocument();
  });

  it('서버가 준 문구가 있으면 배너 본문에 그 문구를 낸다', async () => {
    renderScreen([
      {
        match: (request) => isGet(request, '/mdm/warehouses'),
        respond: () => jsonResponse({ message: '조회 대상이 너무 많습니다.' }, { status: 500 }),
      },
    ]);

    expect(await screen.findByText('조회 대상이 너무 많습니다.')).toBeInTheDocument();
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
      locationListRoute([]),
      ...lookupRoutes(),
    ]);

    await user.click(await screen.findByRole('button', { name: 'WH-02' }));

    expect(screen.getByRole('button', { name: 'WH-02' })).toHaveAttribute('aria-current', 'true');
  });
});

describe('WarehouseLocationScreen — 창고 상세 조회', () => {
  it('창고를 고르면 상세 요청이 나가고 폼이 응답 값으로 채워진다', async () => {
    const { requests, user } = renderScreen([
      warehouseListRoute(),
      warehouseDetailRoute(warehouseFixtures[1]!),
      locationListRoute(),
      ...lookupRoutes(),
    ]);

    await user.click(await screen.findByRole('button', { name: 'WH-02' }));

    expect(await screen.findByLabelText('창고명')).toHaveValue('1공장 제품창고');
    expect(screen.getByLabelText('창고코드')).toHaveValue('WH-02');
    expect(requests.some((request) => request.url.pathname === '/mdm/warehouses/1002')).toBe(true);
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
        locationListRoute(),
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
      [warehouseListRoute(), warehouseDetailRoute(), locationListRoute(), ...lookupRoutes()],
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
        locationListRoute(),
        ...lookupRoutes(),
      ],
      '?wh=1001',
    );

    expect(await screen.findByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByLabelText('창고명')).not.toBeInTheDocument();
  });

  it('불러오는 동안에는 빈 폼 대신 스켈레톤을 낸다', () => {
    renderScreen(
      [warehouseListRoute(), warehouseDetailRoute(), locationListRoute(), ...lookupRoutes()],
      '?wh=1001',
    );

    expect(screen.getByRole('status', { name: '창고 정보를 불러오는 중' })).toBeInTheDocument();
    expect(screen.queryByLabelText('창고명')).not.toBeInTheDocument();
  });

  /*
   * ⛔ **거래처는 조회 응답에 없다** — 외부창고를 열어도 화면은 그 값을 모른다. 무언가가
   * 채워져 보이면 그것은 화면이 지어낸 값이고, 그대로 저장하면 엉뚱한 거래처가 실린다.
   *
   * ⚠ 종전에는 「미사용 거래처를 참조하는 창고를 열면 그 값이 표식과 함께 남는다」를 지켰다.
   * 계약이 그 칸을 조회에서 걷어내 **참조하던 값을 알 방법이 사라졌으므로** 그 감지기는
   * 성립하지 않는다. 지워 없애지 않고 지금 성립하는 사실로 바꿔 둔다.
   */
  it('⛔ 외부창고를 열어도 거래처는 비어 있다 — 서버가 주지 않는 값을 지어내지 않는다', async () => {
    const external: Warehouse = { ...warehouseFixtures[2]!, warehouseId: 1001 };
    renderScreen(
      [
        warehouseListRoute(),
        warehouseDetailRoute(external),
        locationListRoute(),
        ...lookupRoutes(),
      ],
      '?wh=1001',
    );

    await screen.findByLabelText('창고명');

    /* 어느 거래처도 고른 것으로 보이지 않는다 — 하나라도 보이면 화면이 지어낸 값이다. */
    const partner = screen.getByRole('combobox', { name: '거래처' });
    expect(partner).not.toHaveTextContent('(주)한빛소재');
    expect(partner).not.toHaveTextContent('(주)대한부품');

    /* ⛔ 빈 것이 「없음」이 아니라 「모름」임을 밝힌다 — 적지 않으면 지워진 줄 안다. */
    expect(screen.getByText(messages.warehouseLocation.fields.partnerNotReturned)).toBeVisible();
  });

  it('선택 목록이 잘리면 폼에 그 사실을 알린다', async () => {
    renderScreen(
      [warehouseListRoute(), warehouseDetailRoute(), locationListRoute(), ...lookupRoutes(500)],
      '?wh=1001',
    );

    expect(
      await screen.findByText(
        '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
      ),
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
        locationListRoute(),
        ...lookupRoutes().slice(1),
      ],
      '?wh=1001',
    );

    expect(
      await screen.findByText('선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.'),
    ).toBeInTheDocument();
  });

  it('공장 조회 실패 중인 현재 FK는 번호 대신 실패 상태를 표시한다', async () => {
    const warehouse: Warehouse = { ...warehouseFixtures[0]!, plantId: 9999 };
    renderScreen(
      [
        warehouseListRoute([warehouse]),
        warehouseDetailRoute(warehouse),
        {
          match: (request) => isGet(request, '/mdm/plants'),
          respond: () => jsonResponse({ message: '' }, { status: 500 }),
        },
        locationListRoute(),
        ...lookupRoutes().slice(1),
      ],
      `?wh=${String(warehouse.warehouseId)}`,
    );

    expect(await screen.findByText(messages.common.reference.failed)).toBeInTheDocument();
    expect(screen.queryByText('9999')).not.toBeInTheDocument();
  });

  it('값을 고치면 저장·취소가 열리고 취소하면 서버 값으로 되돌아간다', async () => {
    const { user } = renderScreen(
      [warehouseListRoute(), warehouseDetailRoute(), locationListRoute(), ...lookupRoutes()],
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

const openLocationTab = async (user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> => {
  await screen.findByLabelText('창고명');
  await user.click(screen.getByRole('tab', { name: 'Location' }));

  return screen.getByRole('tabpanel');
};

describe('WarehouseLocationScreen — Location 계층 조회', () => {
  it('창고를 고르면 warehouseId가 실린 Location 요청이 나간다', async () => {
    const { requests } = renderScreen(
      [warehouseListRoute(), warehouseDetailRoute(), locationListRoute(), ...lookupRoutes()],
      '?wh=1001',
    );

    await screen.findByLabelText('창고명');

    const request = requests.find((candidate) => candidate.url.pathname === '/mdm/locations');
    expect(request?.url.searchParams.get('warehouseId')).toBe('1001');
  });

  it('창고를 고르기 전에는 Location 요청이 나가지 않는다', async () => {
    const { requests } = renderScreen([warehouseListRoute(), ...lookupRoutes()]);
    await screen.findByRole('button', { name: 'WH-01' });

    expect(requests.some((request) => request.url.pathname === '/mdm/locations')).toBe(false);
  });

  it('계층을 depth와 함께 그리고 기본이 펼침 상태다', async () => {
    const { user } = renderScreen(
      [warehouseListRoute(), warehouseDetailRoute(), locationListRoute(), ...lookupRoutes()],
      '?wh=1001',
    );

    const panel = await openLocationTab(user);

    // 3단 계층이 전부 보인다 — 접힌 노드가 있으면 하위가 행으로 나오지 않는다.
    expect(within(panel).getByRole('button', { name: 'A-01' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'A-01-01' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'A-01-01-01' })).toBeInTheDocument();
    expect(
      within(panel).getByRole('button', { name: 'A-01-01' }).closest('.tree-toggle'),
    ).toHaveAttribute('data-depth', '1');
    expect(within(panel).getAllByRole('button', { name: '하위 접기' })).toHaveLength(2);
  });

  it('접기 버튼이 실제로 동작한다', async () => {
    const { user } = renderScreen(
      [warehouseListRoute(), warehouseDetailRoute(), locationListRoute(), ...lookupRoutes()],
      '?wh=1001',
    );

    const panel = await openLocationTab(user);
    await user.click(within(panel).getAllByRole('button', { name: '하위 접기' })[0]!);

    expect(
      within(screen.getByRole('tabpanel')).queryByRole('button', { name: 'A-01-01' }),
    ).not.toBeInTheDocument();
  });

  it('Location 조회에 실패하면 표 대신 오류 배너가 나온다', async () => {
    const { user } = renderScreen(
      [
        warehouseListRoute(),
        warehouseDetailRoute(),
        {
          match: (request) => isGet(request, '/mdm/locations'),
          respond: () => jsonResponse({ message: '' }, { status: 500 }),
        },
        ...lookupRoutes(),
      ],
      '?wh=1001',
    );

    const panel = await openLocationTab(user);

    expect(within(panel).getByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(within(panel).queryByRole('table')).not.toBeInTheDocument();
    expect(within(panel).queryByText('등록된 Location이 없습니다')).not.toBeInTheDocument();
  });

  it('Location 다이얼로그에 어느 창고인지 이름으로 보인다', async () => {
    const { user } = renderScreen(
      [warehouseListRoute(), warehouseDetailRoute(), locationListRoute(), ...lookupRoutes()],
      '?wh=1001',
    );

    const panel = await openLocationTab(user);
    await user.click(within(panel).getByRole('button', { name: '최상위 추가' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('WH-01 · 1공장 자재창고')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('위치코드')).toBeInTheDocument();
  });

  it('행의 코드를 누르면 그 값이 채워진 수정 다이얼로그가 열린다', async () => {
    const { user } = renderScreen(
      [warehouseListRoute(), warehouseDetailRoute(), locationListRoute(), ...lookupRoutes()],
      '?wh=1001',
    );

    const panel = await openLocationTab(user);
    await user.click(within(panel).getByRole('button', { name: 'A-01-01-01' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('위치코드')).toHaveValue('A-01-01-01');
    expect(within(dialog).getByLabelText('수용량')).toHaveValue('500');
  });
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const writeRequests = (requests: RecordedRequest[], method: string): RecordedRequest[] =>
  requests.filter((request) => request.method === method);

/** 저장 흐름의 기본 스텁 — PUT은 요청마다 다르게 주고 싶어 따로 받는다. */
const saveRoutes = (put: StubRoute): StubRoute[] => [
  warehouseListRoute(),
  warehouseDetailRoute(),
  locationListRoute(),
  ...lookupRoutes(),
  put,
];

const putRoute = (respond: StubRoute['respond']): StubRoute => ({
  match: (request) =>
    request.method === 'PUT' && new URL(request.url).pathname === '/mdm/warehouses/1001',
  respond,
});

describe('WarehouseLocationScreen — 창고 수정 저장', () => {
  it('로컬 검증이 걸리면 요청을 보내지 않고 인라인 오류만 보인다', async () => {
    const { requests, user } = renderScreen(
      saveRoutes(putRoute(() => jsonResponse(warehouseFixtures[0]!))),
      '?wh=1001',
    );

    await user.clear(await screen.findByLabelText('창고명'));
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(screen.getByText('필수 입력 항목입니다.')).toBeInTheDocument();
    expect(writeRequests(requests, 'PUT')).toHaveLength(0);
  });

  it('저장하면 PUT에 UUID 멱등 키와 상세 경로의 If-Match가 실린다', async () => {
    const { requests, user } = renderScreen(
      saveRoutes(
        putRoute(() =>
          jsonResponse(
            { ...warehouseFixtures[0]!, warehouseName: '1공장 자재창고가' },
            {
              headers: { ETag: '"8"' },
            },
          ),
        ),
      ),
      '?wh=1001',
    );

    await user.type(await screen.findByLabelText('창고명'), '가');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByText('저장했습니다')).toBeInTheDocument();

    const put = writeRequests(requests, 'PUT')[0];
    expect(put?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    // 상세 GET이 준 ETag를 그대로 되돌려 보낸다.
    expect(put?.headers.get('If-Match')).toBe('"7"');
    expect(JSON.parse(put?.body ?? '{}')).toMatchObject({
      warehouseName: '1공장 자재창고가',
      businessUnitId: 21,
    });
  });

  it('저장한 값이 새 기준값이 된다 — 곧바로 다시 저장할 수 없다', async () => {
    const { user } = renderScreen(
      saveRoutes(
        putRoute(() =>
          jsonResponse(
            { ...warehouseFixtures[0]!, warehouseName: '1공장 자재창고가' },
            {
              headers: { ETag: '"8"' },
            },
          ),
        ),
      ),
      '?wh=1001',
    );

    await user.type(await screen.findByLabelText('창고명'), '가');
    await user.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('저장했습니다');

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  });

  it('409면 원인에 맞는 충돌 배너와 최신 불러오기가 뜬다', async () => {
    const { user } = renderScreen(
      saveRoutes(
        putRoute(() =>
          jsonResponse(
            { conflictCause: 'user', message: '다른 사용자가 먼저 저장했습니다.' },
            { status: 409 },
          ),
        ),
      ),
      '?wh=1001',
    );

    await user.type(await screen.findByLabelText('창고명'), '가');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(
      await screen.findByText(
        '다른 사용자가 먼저 저장했습니다. 최신 내용을 불러온 뒤 다시 저장하세요.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '최신 불러오기' })).toBeInTheDocument();
    expect(screen.getByText('최신 내용을 불러오면 입력한 내용은 사라집니다.')).toBeInTheDocument();
  });

  it('최신 불러오기를 누르면 상세를 다시 조회하고 입력한 내용이 사라진다', async () => {
    const { requests, user } = renderScreen(
      saveRoutes(
        putRoute(() => jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 })),
      ),
      '?wh=1001',
    );

    await user.type(await screen.findByLabelText('창고명'), '가');
    await user.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByRole('button', { name: '최신 불러오기' });

    const before = requests.filter(
      (request) => request.url.pathname === '/mdm/warehouses/1001' && request.method === 'GET',
    ).length;

    await user.click(screen.getByRole('button', { name: '최신 불러오기' }));

    const after = requests.filter(
      (request) => request.url.pathname === '/mdm/warehouses/1001' && request.method === 'GET',
    ).length;
    expect(after).toBeGreaterThan(before);
    expect(await screen.findByLabelText('창고명')).toHaveValue('1공장 자재창고');
  });

  it('서버가 준 필드 오류는 인라인으로, 모르는 필드는 배너로 간다', async () => {
    const { user } = renderScreen(
      saveRoutes(
        putRoute(() =>
          jsonResponse(
            {
              errors: [
                {
                  scope: 'field',
                  field: 'warehouseCode',
                  code: 'DUPLICATED',
                  message: '이미 사용 중인 코드입니다.',
                },
                {
                  scope: 'field',
                  field: 'somethingTheScreenDoesNotOwn',
                  code: 'STANDARD',
                  message: '화면이 모르는 필드의 오류입니다.',
                },
              ],
            },
            { status: 400 },
          ),
        ),
      ),
      '?wh=1001',
    );

    await user.type(await screen.findByLabelText('창고명'), '가');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByText('이미 사용 중인 코드입니다.')).toBeInTheDocument();
    // 삼키면 어디에도 보이지 않는 오류가 된다.
    expect(screen.getByText('화면이 모르는 필드의 오류입니다.')).toBeInTheDocument();
  });

  it('값을 고치면 그 필드의 서버 오류가 사라진다', async () => {
    const { user } = renderScreen(
      saveRoutes(
        putRoute(() =>
          jsonResponse(
            {
              errors: [
                {
                  scope: 'field',
                  field: 'warehouseName',
                  code: 'STANDARD',
                  message: '창고명을 다시 입력하세요.',
                },
              ],
            },
            { status: 400 },
          ),
        ),
      ),
      '?wh=1001',
    );

    await user.type(await screen.findByLabelText('창고명'), '가');
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText('창고명을 다시 입력하세요.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('창고명'), '나');

    expect(screen.queryByText('창고명을 다시 입력하세요.')).not.toBeInTheDocument();
  });

  it('연결이 끊기면 오프라인 안내가 뜬다', async () => {
    const { user } = renderScreen(
      saveRoutes({
        match: (request) => request.method === 'PUT',
        respond: () => {
          throw new Error('연결 실패');
        },
      }),
      '?wh=1001',
    );

    await user.type(await screen.findByLabelText('창고명'), '가');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(
      await screen.findByText('네트워크 연결이 끊겼습니다. 연결을 확인한 뒤 다시 시도하세요.'),
    ).toBeInTheDocument();
  });
});

const NEW_WAREHOUSE: Warehouse = {
  ...warehouseFixtures[0]!,
  warehouseId: 1009,
  warehouseCode: 'WH-09',
  warehouseName: '신규 창고',
};

const createRoutes = (post: StubRoute): StubRoute[] => [
  warehouseListRoute(),
  warehouseDetailRoute(),
  warehouseDetailRoute(NEW_WAREHOUSE),
  locationListRoute(),
  ...lookupRoutes(),
  post,
];

const postRoute = (respond: StubRoute['respond']): StubRoute => ({
  match: (request) =>
    request.method === 'POST' && new URL(request.url).pathname === '/mdm/warehouses',
  respond,
});

const fillCreateForm = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  // 창고유형은 필터 바에도 있어 폼 안으로 범위를 좁힌다.
  const form = screen.getByRole('region', { name: '창고 정보' });

  await user.click(within(form).getByRole('combobox', { name: '공장' }));
  await user.click(screen.getByRole('option', { name: '1공장' }));
  await user.click(within(form).getByRole('combobox', { name: '사업부' }));
  await user.click(screen.getByRole('option', { name: '생산본부' }));
  await user.type(within(form).getByLabelText('창고코드'), 'WH-09');
  await user.type(within(form).getByLabelText('창고명'), '신규 창고');
  await user.click(within(form).getByRole('combobox', { name: '창고유형' }));
  await user.click(screen.getByRole('option', { name: '자재창고' }));
};

describe('WarehouseLocationScreen — 창고 신규 등록', () => {
  it('창고 추가를 누르면 빈 폼이 열리고 공장을 고를 수 있으며 사용 중지가 없다', async () => {
    const { user } = renderScreen([warehouseListRoute(), ...lookupRoutes()]);

    await user.click(await screen.findByRole('button', { name: '창고 추가' }));

    expect(screen.getByLabelText('창고코드')).toHaveValue('');
    expect(screen.getByLabelText('창고명')).toHaveValue('');
    expect(screen.getByRole('combobox', { name: '공장' })).not.toBeDisabled();
    expect(screen.queryByRole('button', { name: '사용 중지' })).not.toBeInTheDocument();
  });

  it('빈 상태의 창고 추가도 같은 신규 폼을 연다', async () => {
    const { user } = renderScreen([warehouseListRoute([]), ...lookupRoutes()]);

    await user.click(await screen.findByRole('button', { name: '창고 추가' }));

    expect(screen.getByLabelText('창고코드')).toHaveValue('');
  });

  it('신규 등록에서 공장을 비우면 요청을 보내지 않고 인라인 오류를 낸다', async () => {
    const { requests, user } = renderScreen(
      createRoutes(postRoute(() => jsonResponse(NEW_WAREHOUSE, { status: 201 }))),
      '?mode=create',
    );

    await screen.findByLabelText('창고코드');
    await user.type(screen.getByLabelText('창고코드'), 'WH-09');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(screen.getAllByText('필수 입력 항목입니다.').length).toBeGreaterThan(0);
    expect(writeRequests(requests, 'POST')).toHaveLength(0);
  });

  it('POST 본문에 plantId가 실리고 If-Match는 실리지 않는다', async () => {
    const { requests, user } = renderScreen(
      createRoutes(postRoute(() => jsonResponse(NEW_WAREHOUSE, { status: 201 }))),
      '?mode=create',
    );

    await screen.findByLabelText('창고코드');
    await fillCreateForm(user);
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByText('등록했습니다')).toBeInTheDocument();

    const post = writeRequests(requests, 'POST')[0];
    expect(post?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    // 등록에는 낙관적 잠금이 없다 — 계약에 If-Match가 없다.
    expect(post?.headers.get('If-Match')).toBeNull();
    expect(JSON.parse(post?.body ?? '{}')).toMatchObject({
      plantId: 11,
      businessUnitId: 21,
      warehouseCode: 'WH-09',
    });
  });

  it('등록되면 그 창고의 상세로 옮겨 다시 조회한다 — 여기서 잠금 토큰을 확보한다', async () => {
    const { requests, user } = renderScreen(
      createRoutes(postRoute(() => jsonResponse(NEW_WAREHOUSE, { status: 201 }))),
      '?mode=create',
    );

    await screen.findByLabelText('창고코드');
    await fillCreateForm(user);
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByLabelText('창고명')).toHaveValue('신규 창고');
    /*
     * 상세 조회를 **기다려서** 단언한다. 창고명 입력칸은 등록 폼 상태만으로도 이 값을 가져
     * `findByLabelText`가 즉시 풀리므로, 동기로 단언하면 상세 GET이 기록되기 전에 먼저 도는
     * 경합이 생긴다 — 병렬 부하가 커지면 실제로 어긋난다.
     */
    await waitFor(() => {
      expect(
        requests.some(
          (request) => request.method === 'GET' && request.url.pathname === '/mdm/warehouses/1009',
        ),
      ).toBe(true);
    });
    // 상세가 열렸다는 것은 Location 탭이 다시 생겼다는 뜻이다.
    expect(screen.getByRole('tab', { name: 'Location' })).toBeInTheDocument();
  });

  it('등록이 400이면 필드 오류가 인라인으로 뜬다', async () => {
    const { user } = renderScreen(
      createRoutes(
        postRoute(() =>
          jsonResponse(
            {
              errors: [
                {
                  scope: 'field',
                  field: 'warehouseCode',
                  code: 'DUPLICATED',
                  message: '이미 사용 중인 코드입니다.',
                },
              ],
            },
            { status: 400 },
          ),
        ),
      ),
      '?mode=create',
    );

    await screen.findByLabelText('창고코드');
    await fillCreateForm(user);
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByText('이미 사용 중인 코드입니다.')).toBeInTheDocument();
  });

  it('등록 실패에는 최신 불러오기를 내지 않는다 — 되돌아갈 저장본이 없다', async () => {
    const { user } = renderScreen(
      createRoutes(
        postRoute(() => jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 })),
      ),
      '?mode=create',
    );

    await screen.findByLabelText('창고코드');
    await fillCreateForm(user);
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(
      await screen.findByText(
        '다른 사용자가 먼저 저장했습니다. 최신 내용을 불러온 뒤 다시 저장하세요.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '최신 불러오기' })).not.toBeInTheDocument();
  });
});

const DEACTIVATE_PATH = '/mdm/warehouses/1001:deactivate';

const deactivateRoutes = (deactivate: StubRoute): StubRoute[] => [
  warehouseListRoute(),
  warehouseDetailRoute(),
  locationListRoute(),
  ...lookupRoutes(),
  deactivate,
];

const deactivateRoute = (respond: StubRoute['respond']): StubRoute => ({
  match: (request) =>
    request.method === 'POST' && new URL(request.url).pathname === DEACTIVATE_PATH,
  respond,
});

const openDeactivateDialog = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<HTMLElement> => {
  await screen.findByLabelText('창고명');
  await user.click(screen.getByRole('button', { name: '사용 중지' }));

  return screen.getByRole('dialog');
};

describe('WarehouseLocationScreen — 창고 사용 중지', () => {
  it('사용 중지를 눌러도 확인 전에는 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen(
      deactivateRoutes(deactivateRoute(() => jsonResponse(warehouseFixtures[0]!))),
      '?wh=1001',
    );

    const dialog = await openDeactivateDialog(user);

    expect(within(dialog).getByText('사용 중지할까요?')).toBeInTheDocument();
    expect(
      within(dialog).getByText('삭제하지 않습니다. 사용 중지하면 새 작업에서 고를 수 없게 됩니다.'),
    ).toBeInTheDocument();
    expect(requests.some((request) => request.url.pathname === DEACTIVATE_PATH)).toBe(false);
  });

  it('확인하면 :deactivate로 POST가 나가고 If-Match가 상세 경로의 토큰이다', async () => {
    const { requests, user } = renderScreen(
      deactivateRoutes(
        deactivateRoute(() => jsonResponse({ ...warehouseFixtures[0]!, isActive: false })),
      ),
      '?wh=1001',
    );

    const dialog = await openDeactivateDialog(user);
    await user.click(within(dialog).getByRole('button', { name: '사용 중지' }));

    expect(await screen.findByText('저장했습니다')).toBeInTheDocument();

    const request = requests.find((candidate) => candidate.url.pathname === DEACTIVATE_PATH);
    expect(request?.method).toBe('POST');
    expect(request?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    // 사용 중지 경로가 아니라 상세 경로에 보관된 토큰이어야 한다.
    expect(request?.headers.get('If-Match')).toBe('"7"');
  });

  it('409면 충돌 배너와 최신 불러오기가 뜨고 다이얼로그는 닫히지 않는다', async () => {
    const { user } = renderScreen(
      deactivateRoutes(
        deactivateRoute(() =>
          jsonResponse({ conflictCause: 'workerLease', message: '' }, { status: 409 }),
        ),
      ),
      '?wh=1001',
    );

    const dialog = await openDeactivateDialog(user);
    await user.click(within(dialog).getByRole('button', { name: '사용 중지' }));

    expect(
      await within(screen.getByRole('dialog')).findByText(
        '다른 작업에서 이 항목을 처리하는 중입니다. 잠시 뒤 최신 내용을 불러와 다시 저장하세요.',
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('dialog')).getByRole('button', { name: '최신 불러오기' }),
    ).toBeInTheDocument();
  });

  it('400 STATE_LOCKED에는 최신 불러오기를 내지 않고 서버가 준 사유를 함께 낸다', async () => {
    const { user } = renderScreen(
      deactivateRoutes(
        deactivateRoute(() =>
          jsonResponse(
            {
              errors: [{ scope: 'screen', code: 'STATE_LOCKED', message: '확정된 항목입니다.' }],
            },
            { status: 400 },
          ),
        ),
      ),
      '?wh=1001',
    );

    const dialog = await openDeactivateDialog(user);
    await user.click(within(dialog).getByRole('button', { name: '사용 중지' }));

    const alert = await within(screen.getByRole('dialog')).findByRole('alert');
    expect(alert).toHaveTextContent('지금은 저장할 수 없는 상태입니다');
    // 재조회해도 풀리지 않는다 — 재시도를 권하지 않는다.
    expect(
      within(screen.getByRole('dialog')).queryByRole('button', { name: '최신 불러오기' }),
    ).not.toBeInTheDocument();
    // 일반 문구로 뭉개면 무엇을 먼저 해야 하는지 알 수 없다.
    expect(alert).toHaveTextContent('확정된 항목입니다.');
  });

  it('403이면 권한 문구를 배너로 낸다 — 대응하는 입력칸이 없다', async () => {
    const { user } = renderScreen(
      deactivateRoutes(
        deactivateRoute(() =>
          jsonResponse(
            { errors: [{ scope: 'screen', code: 'FORBIDDEN', message: '' }] },
            { status: 403 },
          ),
        ),
      ),
      '?wh=1001',
    );

    const dialog = await openDeactivateDialog(user);
    await user.click(within(dialog).getByRole('button', { name: '사용 중지' }));

    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toBeInTheDocument();
  });

  it('이미 미사용인 창고에는 사용 중지 버튼이 없다', async () => {
    renderScreen(
      [
        warehouseListRoute(),
        warehouseDetailRoute({ ...warehouseFixtures[0]!, isActive: false }),
        locationListRoute(),
        ...lookupRoutes(),
      ],
      '?wh=1001',
    );

    await screen.findByLabelText('창고명');

    expect(screen.queryByRole('button', { name: '사용 중지' })).not.toBeInTheDocument();
  });
});

const locationDetailRoute = (
  location = locationFixtures[1]!,
  editability: {
    codeEditable: boolean;
    reason: 'EDITABLE' | 'REFERENCED' | 'NOT_COUNTABLE' | 'RECEIVED_FROM_ERP';
    referenceCount?: number | null;
  } = DEFAULT_EDITABILITY,
  etag = '"5"',
): StubRoute => ({
  match: (request) => isGet(request, `/mdm/locations/${String(location.locationId)}`),
  respond: () => jsonResponse({ location, editability }, { headers: { ETag: etag } }),
});

const locationWriteRoutes = (...extra: StubRoute[]): StubRoute[] => [
  warehouseListRoute(),
  warehouseDetailRoute(),
  locationListRoute(),
  ...lookupRoutes(),
  ...extra,
];

describe('WarehouseLocationScreen — Location 등록·수정', () => {
  it('하위 추가 저장의 POST 본문에 parentLocationId가 실린다', async () => {
    const { requests, user } = renderScreen(
      locationWriteRoutes({
        match: (request) =>
          request.method === 'POST' && new URL(request.url).pathname === '/mdm/locations',
        respond: () =>
          jsonResponse(
            { ...locationFixtures[1]!, locationId: 2009, locationCode: 'A-01-09' },
            {
              status: 201,
            },
          ),
      }),
      '?wh=1001',
    );

    const panel = await openLocationTab(user);
    // 하위 추가는 선택이 정확히 1건일 때만 열린다.
    await user.click(within(panel).getAllByRole('checkbox')[1]!);
    await user.click(within(panel).getByRole('button', { name: '하위 추가' }));

    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('위치코드'), 'A-01-09');
    await user.type(within(dialog).getByLabelText('위치명'), 'A구역 09열');
    await user.click(within(dialog).getByRole('button', { name: '저장' }));

    expect(await screen.findByText('등록했습니다')).toBeInTheDocument();

    const post = requests.find(
      (request) => request.method === 'POST' && request.url.pathname === '/mdm/locations',
    );
    expect(post?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    expect(post?.headers.get('If-Match')).toBeNull();
    expect(JSON.parse(post?.body ?? '{}')).toMatchObject({
      warehouseId: 1001,
      parentLocationId: 2001,
      locationCode: 'A-01-09',
    });
  });

  it('최상위 추가는 상위 위치를 널로 보낸다', async () => {
    const { requests, user } = renderScreen(
      locationWriteRoutes({
        match: (request) =>
          request.method === 'POST' && new URL(request.url).pathname === '/mdm/locations',
        respond: () => jsonResponse(locationFixtures[3]!, { status: 201 }),
      }),
      '?wh=1001',
    );

    const panel = await openLocationTab(user);
    await user.click(within(panel).getByRole('button', { name: '최상위 추가' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('없음 (최상위)')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('위치코드'), 'C-01');
    await user.type(within(dialog).getByLabelText('위치명'), 'C구역');
    await user.click(within(dialog).getByRole('button', { name: '저장' }));

    await screen.findByText('등록했습니다');

    const post = requests.find(
      (request) => request.method === 'POST' && request.url.pathname === '/mdm/locations',
    );
    expect(JSON.parse(post?.body ?? '{}')).toMatchObject({ parentLocationId: null });
  });

  it('검증이 걸리면 요청을 보내지 않고 인라인 오류를 낸다', async () => {
    const { requests, user } = renderScreen(locationWriteRoutes(), '?wh=1001');

    const panel = await openLocationTab(user);
    await user.click(within(panel).getByRole('button', { name: '최상위 추가' }));

    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('수용량'), '10');
    await user.click(within(dialog).getByRole('button', { name: '저장' }));

    expect(
      within(dialog).getByText('수용량과 단위는 함께 입력하거나 함께 비워야 합니다.'),
    ).toBeInTheDocument();
    expect(
      requests.some(
        (request) => request.method === 'POST' && request.url.pathname === '/mdm/locations',
      ),
    ).toBe(false);
  });

  it('편집 다이얼로그를 열면 상세를 조회해 잠금 토큰과 코드 잠금을 확보한다', async () => {
    const { requests, user } = renderScreen(
      locationWriteRoutes(
        locationDetailRoute(locationFixtures[1]!, {
          codeEditable: false,
          reason: 'REFERENCED',
          referenceCount: 2,
        }),
      ),
      '?wh=1001',
    );

    const panel = await openLocationTab(user);
    await user.click(within(panel).getByRole('button', { name: 'A-01-01' }));

    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByLabelText('위치코드')).toBeDisabled();
    expect(
      within(dialog).getByText('이미 2건에서 사용 중이라 코드를 바꿀 수 없습니다.'),
    ).toBeInTheDocument();
    expect(requests.some((request) => request.url.pathname === '/mdm/locations/2002')).toBe(true);
  });

  it('편집 저장의 PUT에 상세 경로의 If-Match가 실린다', async () => {
    const { requests, user } = renderScreen(
      locationWriteRoutes(locationDetailRoute(), {
        match: (request) =>
          request.method === 'PUT' && new URL(request.url).pathname === '/mdm/locations/2002',
        respond: () => jsonResponse({ ...locationFixtures[1]!, locationName: 'A구역 01열 수정' }),
      }),
      '?wh=1001',
    );

    const panel = await openLocationTab(user);
    await user.click(within(panel).getByRole('button', { name: 'A-01-01' }));

    const dialog = screen.getByRole('dialog');
    await within(dialog).findByLabelText('위치명');
    await user.type(within(dialog).getByLabelText('위치명'), ' 수정');
    await user.click(within(dialog).getByRole('button', { name: '저장' }));

    expect(await screen.findByText('저장했습니다')).toBeInTheDocument();

    const put = requests.find(
      (request) => request.method === 'PUT' && request.url.pathname === '/mdm/locations/2002',
    );
    expect(put?.headers.get('If-Match')).toBe('"5"');
    expect(put?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    // 상위 위치는 화면에 재배치 수단이 없으므로 지금 값을 그대로 되돌려 보낸다.
    expect(JSON.parse(put?.body ?? '{}')).toMatchObject({ parentLocationId: 2001 });
    expect(JSON.parse(put?.body ?? '{}')).not.toHaveProperty('warehouseId');
  });

  it('잠금 토큰을 확보하지 못하면 저장을 보내지 않고 그 사실을 알린다', async () => {
    const { requests, user } = renderScreen(
      locationWriteRoutes({
        match: (request) => isGet(request, '/mdm/locations/2002'),
        respond: () => jsonResponse({ message: '' }, { status: 500 }),
      }),
      '?wh=1001',
    );

    const panel = await openLocationTab(user);
    await user.click(within(panel).getByRole('button', { name: 'A-01-01' }));

    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('위치명'), '가');
    await user.click(within(dialog).getByRole('button', { name: '저장' }));

    expect(
      await within(dialog).findByText('최신 정보를 불러오는 중입니다. 잠시 뒤 다시 저장하세요.'),
    ).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'PUT')).toBe(false);
  });

  it('편집 다이얼로그에 상위 위치의 코드가 보인다', async () => {
    const { user } = renderScreen(locationWriteRoutes(locationDetailRoute()), '?wh=1001');

    const panel = await openLocationTab(user);
    await user.click(within(panel).getByRole('button', { name: 'A-01-01' }));

    expect(within(screen.getByRole('dialog')).getByText('A-01')).toBeInTheDocument();
  });

  it('서버가 준 필드 오류는 다이얼로그 안에 인라인으로 뜬다', async () => {
    const { user } = renderScreen(
      locationWriteRoutes({
        match: (request) =>
          request.method === 'POST' && new URL(request.url).pathname === '/mdm/locations',
        respond: () =>
          jsonResponse(
            {
              errors: [
                {
                  scope: 'field',
                  field: 'locationCode',
                  code: 'DUPLICATED',
                  message: '이미 사용 중인 위치코드입니다.',
                },
              ],
            },
            { status: 400 },
          ),
      }),
      '?wh=1001',
    );

    const panel = await openLocationTab(user);
    await user.click(within(panel).getByRole('button', { name: '최상위 추가' }));

    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('위치코드'), 'A-01');
    await user.type(within(dialog).getByLabelText('위치명'), '겹치는 구역');
    await user.click(within(dialog).getByRole('button', { name: '저장' }));

    expect(await within(dialog).findByText('이미 사용 중인 위치코드입니다.')).toBeInTheDocument();
    // 실패하면 다이얼로그를 닫지 않는다 — 입력한 내용을 다시 쓰게 만들지 않는다.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

/** 연결이 거부됐을 때 브라우저가 겪는 것 — 응답이 없고 fetch가 예외를 던진다. */
const refusingFetch: StubFetch = async () => {
  throw new TypeError('Failed to fetch');
};

describe('WarehouseLocationScreen — 서버에 닿지 못할 때', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('연결이 거부되면 좌측이 스켈레톤에 머물지 않고 오류 배너로 바뀐다', async () => {
    renderWithProviders(<WarehouseLocationScreen />, { fetch: refusingFetch, route: ROUTE });

    expect(await screen.findByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(
      screen.getByText('네트워크 연결이 끊겼습니다. 연결을 확인한 뒤 다시 시도하세요.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('status', { name: '창고 목록을 불러오는 중' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('아직 등록된 창고가 없습니다')).not.toBeInTheDocument();
  });

  /*
   * navigator.onLine은 브라우저에 네트워크 연결이 있는지만 말한다. 우리 서버에 닿는지는 말하지 않는다.
   * 그 신호로 조회를 멈추면 화면이 영원히 스켈레톤에 머물고 사용자가 빠져나올 방법이 없다.
   */
  it('브라우저가 오프라인으로 보고해도 조회 실패가 오류로 드러난다', async () => {
    onlineManager.setOnline(false);

    renderWithProviders(<WarehouseLocationScreen />, { fetch: refusingFetch, route: ROUTE });

    expect(await screen.findByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(
      screen.queryByRole('status', { name: '창고 목록을 불러오는 중' }),
    ).not.toBeInTheDocument();
  });

  it('브라우저가 오프라인으로 보고해도 Location 조회 실패가 오류로 드러난다', async () => {
    onlineManager.setOnline(false);

    const { user } = renderScreen(
      [
        warehouseListRoute(),
        warehouseDetailRoute(),
        ...lookupRoutes(),
        {
          match: (request) => isGet(request, '/mdm/locations'),
          respond: () => {
            throw new TypeError('Failed to fetch');
          },
        },
      ],
      '?wh=1001',
    );

    const panel = await openLocationTab(user);

    expect(within(panel).getByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(
      within(panel).queryByRole('status', { name: 'Location을 불러오는 중' }),
    ).not.toBeInTheDocument();
  });

  it('브라우저가 오프라인으로 보고해도 저장이 멈춰 있지 않고 답을 준다', async () => {
    onlineManager.setOnline(false);

    const { user } = renderScreen(
      saveRoutes({
        match: (request) => request.method === 'PUT',
        respond: () => {
          throw new TypeError('Failed to fetch');
        },
      }),
      '?wh=1001',
    );

    await user.type(await screen.findByLabelText('창고명'), '가');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(
      await screen.findByText('네트워크 연결이 끊겼습니다. 연결을 확인한 뒤 다시 시도하세요.'),
    ).toBeInTheDocument();
  });
});

describe('WarehouseLocationScreen — 예시 데이터 제거', () => {
  it('예시 데이터 안내 배너가 없다', async () => {
    renderScreen([warehouseListRoute(), ...lookupRoutes()]);
    await screen.findByRole('button', { name: 'WH-01' });

    expect(screen.queryByText(/예시 데이터/)).not.toBeInTheDocument();
  });

  it('demo 파라미터를 줘도 화면이 달라지지 않는다', async () => {
    renderScreen([warehouseListRoute(), ...lookupRoutes()], '?demo=conflict');
    await screen.findByRole('button', { name: 'WH-01' });

    expect(screen.queryByText(/다른 사용자가 먼저 저장했습니다/)).not.toBeInTheDocument();
  });
});
