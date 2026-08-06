import { fireEvent, screen } from '@testing-library/react';
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
import type { Routing } from './types';

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

const DEFAULT_EDITABILITY = { codeEditable: true, reason: 'EDITABLE' as const };

interface EditabilityStub {
  codeEditable: boolean;
  reason: 'EDITABLE' | 'REFERENCED' | 'NOT_COUNTABLE' | 'RECEIVED_FROM_ERP';
  referenceCount?: number | null;
}

const routingDetailRoute = (
  routing: Routing = routingFixtures[0]!,
  editability: EditabilityStub = DEFAULT_EDITABILITY,
  etag = '"7"',
): StubRoute => ({
  match: (request) => isGet(request, `/planning/routings/${String(routing.routingId)}`),
  respond: () => jsonResponse({ routing, editability }, { headers: { ETag: etag } }),
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

describe('RoutingScreen — 헤더 상세 조회와 상태 잠금', () => {
  it('Rev를 고르면 상세 요청이 나가고 폼이 응답 값으로 채워진다', async () => {
    const { requests, user } = renderScreen(
      [itemListRoute(), revisionListRoute(), routingDetailRoute()],
      '?item=5001',
    );

    await user.click(await screen.findByRole('button', { name: 'Rev 3' }));

    expect(await screen.findByLabelText('Routing 코드')).toHaveValue('STANDARD');
    expect(screen.getByLabelText('유효시작')).toHaveValue('2026-03-01');
    // 유효종료가 널인 응답에서 입력칸이 비어 있다.
    expect(screen.getByLabelText('유효종료')).toHaveValue('');
    expect(requestsTo(requests, '/planning/routings/7003')).toHaveLength(1);
  });

  it('상세 조회에 실패하면 폼 대신 오류 배너가 나온다', async () => {
    renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        {
          match: (request) => isGet(request, '/planning/routings/7003'),
          respond: () => jsonResponse({ message: '상세를 불러오지 못했습니다.' }, { status: 500 }),
        },
      ],
      '?item=5001&rev=7003',
    );

    expect(await screen.findByText('상세를 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Routing 코드')).not.toBeInTheDocument();
  });

  it('확정 Rev에서는 헤더 입력이 전부 잠기고 푸는 방법을 안내한다', async () => {
    renderScreen(
      [itemListRoute(), revisionListRoute(), routingDetailRoute(routingFixtures[1])],
      '?item=5001&rev=7002',
    );

    expect(await screen.findByLabelText('Routing 코드')).toBeDisabled();
    expect(screen.getByLabelText('유효시작')).toBeDisabled();
    expect(
      screen.getByText('확정된 Rev는 수정할 수 없습니다. 변경하려면 신규 Rev를 발행하세요.'),
    ).toBeInTheDocument();
  });

  it('작성중 Rev에서는 헤더를 편집할 수 있다', async () => {
    renderScreen(
      [itemListRoute(), revisionListRoute(), routingDetailRoute()],
      '?item=5001&rev=7003',
    );

    expect(await screen.findByLabelText('Routing 코드')).toBeEnabled();
    expect(screen.getByLabelText('유효시작')).toBeEnabled();
  });

  /*
   * 판정의 주인은 codeEditable이다 — 목 서버도 실서버도 codeEditable=false에
   * reason=EDITABLE인 어긋난 조합을 실제로 내려준다.
   */
  it('codeEditable이 거짓이면 Routing 코드만 잠기고 상태 잠금과 다른 사유가 붙는다', async () => {
    renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(routingFixtures[0], { codeEditable: false, reason: 'EDITABLE' }),
      ],
      '?item=5001&rev=7003',
    );

    expect(await screen.findByLabelText('Routing 코드')).toBeDisabled();
    expect(screen.getByLabelText('유효시작')).toBeEnabled();
    expect(
      screen.getByText('지금은 코드를 바꿀 수 없습니다. 변경이 필요하면 담당자에게 문의하세요.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('확정된 Rev는 수정할 수 없습니다. 변경하려면 신규 Rev를 발행하세요.'),
    ).not.toBeInTheDocument();
  });

  it('고른 품목을 헤더에 값으로 밝힌다', async () => {
    renderScreen(
      [itemListRoute(), revisionListRoute(), routingDetailRoute()],
      '?item=5001&rev=7003',
    );

    expect(await screen.findByText('ITM-001 · 하우징 커버')).toBeInTheDocument();
  });

  it('고친 값은 취소로 기준값으로 되돌아간다', async () => {
    const { user } = renderScreen(
      [itemListRoute(), revisionListRoute(), routingDetailRoute()],
      '?item=5001&rev=7003',
    );

    const code = await screen.findByLabelText('Routing 코드');
    await user.type(code, '-X');
    expect(code).toHaveValue('STANDARD-X');

    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(screen.getByLabelText('Routing 코드')).toHaveValue('STANDARD');
  });
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const headerSaveRoute = (
  respond: StubRoute['respond'] = () => jsonResponse(routingFixtures[0]),
): StubRoute => ({
  match: (request) =>
    request.method === 'PUT' && new URL(request.url).pathname === '/planning/routings/7003',
  respond,
});

const renderDraftHeader = (extraRoutes: StubRoute[] = []) =>
  renderScreen(
    [itemListRoute(), revisionListRoute(), routingDetailRoute(), ...extraRoutes],
    '?item=5001&rev=7003',
  );

describe('RoutingScreen — 헤더 저장', () => {
  it('로컬 검증에 걸리면 요청이 나가지 않는다', async () => {
    const { requests, user } = renderDraftHeader([headerSaveRoute()]);

    await user.clear(await screen.findByLabelText('Routing 코드'));
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByText('필수 입력 항목입니다.')).toBeInTheDocument();
    expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(0);
  });

  it('유효기간이 역전되면 두 칸 모두에 오류를 내고 보내지 않는다', async () => {
    const { requests, user } = renderDraftHeader([headerSaveRoute()]);

    const from = await screen.findByLabelText('유효시작');
    fireEvent.change(from, { target: { value: '2026-05-01' } });
    fireEvent.change(screen.getByLabelText('유효종료'), { target: { value: '2026-04-01' } });
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(
      await screen.findAllByText('유효종료는 유효시작과 같거나 그 뒤여야 합니다.'),
    ).toHaveLength(2);
    expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(0);
  });

  it('저장하면 멱등 키와 상세 경로에서 꺼낸 If-Match를 실어 보낸다', async () => {
    const { requests, user } = renderDraftHeader([headerSaveRoute()]);

    await user.type(await screen.findByLabelText('Routing 코드'), '-B');
    await user.click(screen.getByRole('button', { name: '저장' }));

    await screen.findByText('저장했습니다');

    const put = requests.find((request) => request.method === 'PUT');
    expect(put?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    expect(put?.headers.get('If-Match')).toBe('"7"');
    expect(JSON.parse(put?.body ?? '{}')).toEqual({
      routingCode: 'STANDARD-B',
      effectiveFrom: '2026-03-01',
      effectiveTo: null,
    });
  });

  it('저장 충돌은 원인별 문구와 「최신 불러오기」로 낸다', async () => {
    const { user } = renderDraftHeader([
      headerSaveRoute(() => jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 })),
    ]);

    await user.type(await screen.findByLabelText('Routing 코드'), '-B');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(
      await screen.findByText(
        '다른 사용자가 먼저 저장했습니다. 최신 내용을 불러온 뒤 다시 저장하세요.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '최신 불러오기' })).toBeInTheDocument();
  });

  /*
   * 상태 잠김은 재조회해도 풀리지 않는다 — 「최신 불러오기」를 내면 입력만 버리게 된다.
   */
  it('상태 잠김은 「최신 불러오기」 없는 배너로 낸다', async () => {
    const { user } = renderDraftHeader([
      headerSaveRoute(() =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'screen',
                code: 'STATE_LOCKED',
                message: '확정된 Rev는 수정할 수 없습니다.',
              },
            ],
          },
          { status: 400 },
        ),
      ),
    ]);

    await user.type(await screen.findByLabelText('Routing 코드'), '-B');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByText('지금은 저장할 수 없는 상태입니다')).toBeInTheDocument();
    expect(screen.getByText('확정된 Rev는 수정할 수 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '최신 불러오기' })).not.toBeInTheDocument();
  });

  it('화면이 아는 필드의 400 오류는 그 입력칸 옆에 낸다', async () => {
    const { user } = renderDraftHeader([
      headerSaveRoute(() =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'field',
                field: 'routingCode',
                code: 'UNIQUE_VIOLATION',
                message: '이미 사용 중인 코드입니다.',
              },
            ],
          },
          { status: 400 },
        ),
      ),
    ]);

    await user.type(await screen.findByLabelText('Routing 코드'), '-B');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByText('이미 사용 중인 코드입니다.')).toBeInTheDocument();
  });

  /*
   * 목 서버도 실서버도 화면이 모르는 필드명을 내려준다. 삼키면 어디에도 보이지 않는 오류가 생긴다.
   */
  it('화면이 모르는 필드의 400 오류는 배너로 올린다', async () => {
    const { user } = renderDraftHeader([
      headerSaveRoute(() =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'field',
                field: 'unknownColumn',
                code: 'STANDARD',
                message: '알 수 없는 항목이 거부됐습니다.',
              },
            ],
          },
          { status: 400 },
        ),
      ),
    ]);

    await user.type(await screen.findByLabelText('Routing 코드'), '-B');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByText('알 수 없는 항목이 거부됐습니다.')).toBeInTheDocument();
  });

  it('저장에 성공하면 고친 것이 없는 상태로 돌아간다', async () => {
    const { user } = renderDraftHeader([
      headerSaveRoute(() => jsonResponse({ ...routingFixtures[0], routingCode: 'STANDARD-B' })),
    ]);

    await user.type(await screen.findByLabelText('Routing 코드'), '-B');
    await user.click(screen.getByRole('button', { name: '저장' }));

    await screen.findByText('저장했습니다');
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  });
});
