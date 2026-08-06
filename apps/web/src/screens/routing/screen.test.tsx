import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { itemFixtures, routingFixtures } from './fixtures';
import { RoutingScreen } from './screen';

const ROUTE = '/master-data/routing';

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

const itemListRoute = (items = itemFixtures, total = items.length): StubRoute => ({
  match: (request) => isGet(request, '/mdm/items'),
  respond: () => jsonResponse(listBody(items, total)),
});

const revisionListRoute = (items = routingFixtures): StubRoute => ({
  match: (request) => isGet(request, '/planning/routings'),
  respond: () => jsonResponse({ items }),
});

const renderScreen = (
  routes: StubRoute[],
  search = '',
): { requests: RecordedRequest[]; user: ReturnType<typeof userEvent.setup> } => {
  const { fetch, requests } = createRecordingFetch(routes);
  renderWithProviders(<RoutingScreen />, { fetch, route: `${ROUTE}${search}` });

  return { requests, user: userEvent.setup() };
};

const requestsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === pathname);

const itemRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requestsTo(requests, '/mdm/items');

const revisionRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requestsTo(requests, '/planning/routings');

describe('RoutingScreen — 품목 검색·선택', () => {
  it('서버 응답의 품목을 표에 그린다', async () => {
    renderScreen([itemListRoute()]);

    expect(await screen.findByRole('button', { name: 'ITM-001' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ITM-002' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ITM-003' })).toBeInTheDocument();
  });

  it('검색어와 「Routing 미보유만」이 요청 쿼리에 실린다', async () => {
    const { requests, user } = renderScreen([itemListRoute()]);
    await screen.findByRole('button', { name: 'ITM-001' });

    await user.click(screen.getByRole('checkbox', { name: 'Routing 미보유만' }));
    await user.type(screen.getByLabelText('품목 검색'), 'ITM-0');
    await user.click(screen.getByRole('button', { name: '조회' }));

    const last = itemRequests(requests).at(-1);
    expect(last?.url.searchParams.get('q')).toBe('ITM-0');
    expect(last?.url.searchParams.get('hasRouting')).toBe('false');
  });

  it('「Routing 미보유만」이 꺼져 있으면 hasRouting을 싣지 않는다 — true는 뜻이 정반대가 된다', async () => {
    const { requests } = renderScreen([itemListRoute()]);
    await screen.findByRole('button', { name: 'ITM-001' });

    const first = itemRequests(requests)[0];
    expect(first?.url.searchParams.has('hasRouting')).toBe(false);
  });

  it('조회 조건은 URL에 남는다 — 새로고침·공유가 같은 결과를 낸다', async () => {
    const { requests } = renderScreen([itemListRoute()], '?q=ITM&noRouting=1');
    await screen.findByRole('button', { name: 'ITM-001' });

    const first = itemRequests(requests)[0];
    expect(first?.url.searchParams.get('q')).toBe('ITM');
    expect(first?.url.searchParams.get('hasRouting')).toBe('false');
    expect(screen.getByRole('checkbox', { name: 'Routing 미보유만' })).toBeChecked();
  });

  it('조회에 실패하면 표와 빈 상태 대신 오류 배너와 다시 시도가 뜬다', async () => {
    renderScreen([
      {
        match: (request) => isGet(request, '/mdm/items'),
        respond: () => jsonResponse({ message: '' }, { status: 500 }),
      },
    ]);

    expect(await screen.findByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('등록된 품목이 없습니다')).not.toBeInTheDocument();
    // 서버가 빈 message를 줘도 배너에 제목만 남으면 안 된다 — 무엇을 하라는 안내가 사라진다.
    expect(
      screen.getByText('잠시 뒤 다시 시도하세요. 반복되면 담당자에게 알려 주세요.'),
    ).toBeInTheDocument();
  });

  it('다시 시도를 누르면 목록 요청이 한 번 더 나간다', async () => {
    const { requests, user } = renderScreen([
      {
        match: (request) => isGet(request, '/mdm/items'),
        respond: () => jsonResponse({ message: '' }, { status: 500 }),
      },
    ]);

    await user.click(await screen.findByRole('button', { name: '다시 시도' }));

    expect(itemRequests(requests).length).toBeGreaterThan(1);
  });

  it('전체 건수가 받은 건수보다 많으면 잘림 안내를 낸다', async () => {
    renderScreen([itemListRoute(itemFixtures, 120)]);

    expect(
      await screen.findByText('전체 120건 중 3건을 표시합니다. 조건을 좁혀 조회하세요.'),
    ).toBeInTheDocument();
  });

  it('전부 받았으면 잘림 안내를 내지 않는다', async () => {
    renderScreen([itemListRoute()]);
    await screen.findByRole('button', { name: 'ITM-001' });

    expect(screen.queryByText(/전체 .*건을 표시합니다/)).not.toBeInTheDocument();
  });

  it('품목을 고르기 전에는 중·우 구획이 선택 안내를 낸다', async () => {
    renderScreen([itemListRoute()]);
    await screen.findByRole('button', { name: 'ITM-001' });

    expect(screen.getAllByText('좌측에서 품목을 먼저 고르세요').length).toBeGreaterThan(0);
  });

  it('URL의 item으로 선택이 복원된다', async () => {
    renderScreen([itemListRoute()], '?item=5002');

    expect(await screen.findByRole('button', { name: 'ITM-002' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });
});

describe('RoutingScreen — Rev 목록 조회·선택', () => {
  it('품목을 고르기 전에는 Rev 요청이 나가지 않는다 — 계약이 itemId를 필수로 둔다', async () => {
    const { requests } = renderScreen([itemListRoute(), revisionListRoute()]);
    await screen.findByRole('button', { name: 'ITM-001' });

    expect(revisionRequests(requests)).toHaveLength(0);
  });

  it('품목을 고르면 itemId를 실은 Rev 요청이 나가고 목록이 그려진다', async () => {
    const { requests, user } = renderScreen([itemListRoute(), revisionListRoute()]);

    await user.click(await screen.findByRole('button', { name: 'ITM-001' }));

    expect(await screen.findByRole('button', { name: 'Rev 3' })).toBeInTheDocument();
    expect(revisionRequests(requests)[0]?.url.searchParams.get('itemId')).toBe('5001');
  });

  it('품목을 바꾸면 이전 품목의 Rev 선택이 지워진다', async () => {
    const { user } = renderScreen([itemListRoute(), revisionListRoute()], '?item=5001&rev=7002');

    expect(await screen.findByRole('button', { name: 'Rev 2' })).toHaveAttribute(
      'aria-current',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'ITM-002' }));

    expect(screen.getByRole('button', { name: 'Rev 2' })).not.toHaveAttribute('aria-current');
  });

  it('Rev를 고르면 URL에 남아 선택 표식이 붙는다', async () => {
    const { user } = renderScreen([itemListRoute(), revisionListRoute()], '?item=5001');

    await user.click(await screen.findByRole('button', { name: 'Rev 3' }));

    expect(screen.getByRole('button', { name: 'Rev 3' })).toHaveAttribute('aria-current', 'true');
  });

  it('Rev가 0건이면 빈 상태를 낸다', async () => {
    renderScreen([itemListRoute(), revisionListRoute([])], '?item=5001');

    expect(await screen.findByText('등록된 Rev가 없습니다')).toBeInTheDocument();
  });

  it('Rev 조회에 실패하면 목록 대신 오류 배너가 나온다', async () => {
    renderScreen(
      [
        itemListRoute(),
        {
          match: (request) => isGet(request, '/planning/routings'),
          respond: () => jsonResponse({ message: 'Rev를 불러오지 못했습니다.' }, { status: 500 }),
        },
      ],
      '?item=5001',
    );

    expect(await screen.findByText('Rev를 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.queryByText('등록된 Rev가 없습니다')).not.toBeInTheDocument();
  });
});
