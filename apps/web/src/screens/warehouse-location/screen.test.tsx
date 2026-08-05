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
import { warehouseFixtures } from './fixtures';
import { WarehouseLocationScreen } from './screen';

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

const warehouseListRoute = (
  items = warehouseFixtures,
  total = items.length,
): StubRoute => ({
  match: (request) => isGet(request, '/mdm/warehouses'),
  respond: () => jsonResponse({ items, page: { page: 1, size: 20, total } }),
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
    const { user } = renderScreen([warehouseListRoute()]);

    await user.click(await screen.findByRole('button', { name: 'WH-02' }));

    expect(screen.getByRole('button', { name: 'WH-02' })).toHaveAttribute('aria-current', 'true');
  });

  it('Location 탭으로 전환하면 보이는 패널 안에서 Location 계층이 조회된다', async () => {
    const { user } = renderScreen([warehouseListRoute()], '?wh=1001');
    await screen.findByRole('button', { name: 'WH-01' });

    await user.click(screen.getByRole('tab', { name: 'Location' }));

    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByRole('button', { name: 'A-01' })).toBeInTheDocument();
  });
});
