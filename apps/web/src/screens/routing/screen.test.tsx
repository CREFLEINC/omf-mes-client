import { messages } from '@omf-mes/i18n';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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
  itemFixtures,
  processFixtures,
  routingFixtures,
  routingOperationFixtures,
} from './fixtures';
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

/**
 * 헤더와 공정 라인은 저장 버튼을 하나씩 따로 갖는다(두 요청의 실패 갈래가 다르다).
 * 이름만으로 조회하면 어느 구획의 버튼인지 갈리지 않으므로 구획으로 좁힌다.
 */
const headerRegion = (): HTMLElement => screen.getByRole('region', { name: 'Routing 정보' });

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

    await user.click(within(headerRegion()).getByRole('button', { name: '취소' }));

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
    await user.click(within(headerRegion()).getByRole('button', { name: '저장' }));

    expect(await screen.findByText('필수 입력 항목입니다.')).toBeInTheDocument();
    expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(0);
  });

  it('유효기간이 역전되면 두 칸 모두에 오류를 내고 보내지 않는다', async () => {
    const { requests, user } = renderDraftHeader([headerSaveRoute()]);

    const from = await screen.findByLabelText('유효시작');
    fireEvent.change(from, { target: { value: '2026-05-01' } });
    fireEvent.change(screen.getByLabelText('유효종료'), { target: { value: '2026-04-01' } });
    await user.click(within(headerRegion()).getByRole('button', { name: '저장' }));

    expect(
      await screen.findAllByText('유효종료는 유효시작과 같거나 그 뒤여야 합니다.'),
    ).toHaveLength(2);
    expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(0);
  });

  it('저장하면 멱등 키와 상세 경로에서 꺼낸 If-Match를 실어 보낸다', async () => {
    const { requests, user } = renderDraftHeader([headerSaveRoute()]);

    await user.type(await screen.findByLabelText('Routing 코드'), '-B');
    await user.click(within(headerRegion()).getByRole('button', { name: '저장' }));

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
    await user.click(within(headerRegion()).getByRole('button', { name: '저장' }));

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
    await user.click(within(headerRegion()).getByRole('button', { name: '저장' }));

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
    await user.click(within(headerRegion()).getByRole('button', { name: '저장' }));

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
    await user.click(within(headerRegion()).getByRole('button', { name: '저장' }));

    expect(await screen.findByText('알 수 없는 항목이 거부됐습니다.')).toBeInTheDocument();
  });

  it('저장에 성공하면 고친 것이 없는 상태로 돌아간다', async () => {
    const { user } = renderDraftHeader([
      headerSaveRoute(() => jsonResponse({ ...routingFixtures[0], routingCode: 'STANDARD-B' })),
    ]);

    await user.type(await screen.findByLabelText('Routing 코드'), '-B');
    await user.click(within(headerRegion()).getByRole('button', { name: '저장' }));

    await screen.findByText('저장했습니다');
    expect(within(headerRegion()).getByRole('button', { name: '저장' })).toBeDisabled();
  });
});

const operationListRoute = (routingId = 7003, items = routingOperationFixtures): StubRoute => ({
  match: (request) => isGet(request, `/planning/routings/${String(routingId)}/operations`),
  respond: () => jsonResponse({ items }),
});

const processListRoute = (items = processFixtures, total = items.length): StubRoute => ({
  match: (request) => isGet(request, '/mdm/processes'),
  respond: () => jsonResponse(listBody(items, total)),
});

describe('RoutingScreen — 공정 라인 조회·표시', () => {
  it('Rev를 고르기 전에는 라인 요청이 나가지 않는다', async () => {
    const { requests } = renderScreen(
      [itemListRoute(), revisionListRoute(), processListRoute()],
      '?item=5001',
    );
    await screen.findByRole('button', { name: 'Rev 3' });

    expect(requestsTo(requests, '/planning/routings/7003/operations')).toHaveLength(0);
  });

  it('Rev를 고르면 라인 요청이 나가고 표가 그려진다', async () => {
    const { requests, user } = renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(),
        operationListRoute(),
        processListRoute(),
      ],
      '?item=5001',
    );

    await user.click(await screen.findByRole('button', { name: 'Rev 3' }));

    expect(await screen.findByText('1차 사출')).toBeInTheDocument();
    expect(requestsTo(requests, '/planning/routings/7003/operations')).toHaveLength(1);
    expect(requestsTo(requests, '/mdm/processes')[0]?.url.searchParams.get('includeInactive')).toBe(
      'true',
    );
  });

  /*
   * 서버 채번은 서버 재량이다. 그 값을 그대로 보이면 사용자가 그것을 자료로 읽는다.
   */
  it('서버가 순서 값 10·20을 줘도 표시 번호는 1·2다', async () => {
    renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(),
        operationListRoute(),
        processListRoute(),
      ],
      '?item=5001&rev=7003',
    );

    await screen.findByText('1차 사출');

    const operations = screen.getByRole('region', { name: '공정 라인' });
    const rows = within(operations).getAllByRole('row').slice(1);
    expect(within(rows[0] as HTMLElement).getByText('1')).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText('2')).toBeInTheDocument();
    expect(within(operations).queryByText('10')).not.toBeInTheDocument();
    expect(within(operations).queryByText('20')).not.toBeInTheDocument();
  });

  it('공정 id를 선택 목록의 이름으로 옮겨 보인다', async () => {
    renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(),
        operationListRoute(),
        processListRoute(),
      ],
      '?item=5001&rev=7003',
    );

    const operations = await screen.findByRole('region', { name: '공정 라인' });
    expect(await within(operations).findByText('사출')).toBeInTheDocument();
    expect(within(operations).getByText('조립')).toBeInTheDocument();
  });

  it('공정 선택 목록이 실패하면 원시 id 대신 실패 상태를 보인다', async () => {
    renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(),
        operationListRoute(),
        {
          match: (request) => isGet(request, '/mdm/processes'),
          respond: () => jsonResponse({ message: '공정 선택 목록 실패' }, { status: 500 }),
        },
      ],
      '?item=5001&rev=7003',
    );

    const operations = await screen.findByRole('region', { name: '공정 라인' });
    expect(
      await within(operations).findAllByText(messages.common.reference.failed),
    ).not.toHaveLength(0);
    expect(within(operations).queryByText('9001')).not.toBeInTheDocument();
  });

  it('라인이 0건이면 빈 상태를 낸다', async () => {
    renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(),
        operationListRoute(7003, []),
        processListRoute(),
      ],
      '?item=5001&rev=7003',
    );

    expect(await screen.findByText('등록된 공정이 없습니다')).toBeInTheDocument();
  });

  it('라인 조회에 실패하면 표 대신 오류 배너가 나온다', async () => {
    renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(),
        {
          match: (request) => isGet(request, '/planning/routings/7003/operations'),
          respond: () => jsonResponse({ message: '공정을 불러오지 못했습니다.' }, { status: 500 }),
        },
        processListRoute(),
      ],
      '?item=5001&rev=7003',
    );

    expect(await screen.findByText('공정을 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.queryByText('등록된 공정이 없습니다')).not.toBeInTheDocument();
  });

  it('공정 선택 목록이 잘리면 그 사실을 표 위에 낸다', async () => {
    renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(),
        operationListRoute(),
        processListRoute(processFixtures, 120),
      ],
      '?item=5001&rev=7003',
    );

    expect(
      await screen.findByText(
        '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
      ),
    ).toBeInTheDocument();
  });
});

const OPERATIONS_PATH = '/planning/routings/7003/operations';

const operationSaveRoute = (
  respond: StubRoute['respond'] = () => jsonResponse({ items: routingOperationFixtures }),
): StubRoute => ({
  match: (request) => request.method === 'PUT' && new URL(request.url).pathname === OPERATIONS_PATH,
  respond,
});

const renderDraftOperations = (extraRoutes: StubRoute[] = []) =>
  renderScreen(
    [
      itemListRoute(),
      revisionListRoute(),
      routingDetailRoute(),
      operationListRoute(),
      processListRoute(),
      ...extraRoutes,
    ],
    '?item=5001&rev=7003',
  );

const operationsRegion = (): HTMLElement => screen.getByRole('region', { name: '공정 라인' });

const operationRows = (): HTMLElement[] => within(operationsRegion()).getAllByRole('row').slice(1);

const operationNames = (): string[] =>
  operationRows().map((row) => within(row).getAllByRole('cell')[2]?.textContent ?? '');

const savePuts = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter(
    (request) => request.method === 'PUT' && request.url.pathname === OPERATIONS_PATH,
  );

/** 저장 본문의 `operations` 배열. 계약이 그 키 하나만 받는다. */
interface SavedOperation {
  routingOperationId?: number;
  routingId: number;
  operationSeq: number;
  processId: number;
  operationName: string;
}

const savedOperations = (request: RecordedRequest | undefined): SavedOperation[] =>
  (JSON.parse(request?.body ?? '{"operations":[]}') as { operations: SavedOperation[] }).operations;

describe('RoutingScreen — 공정 라인 편집과 일괄 저장', () => {
  /*
   * 이 화면의 핵심 규약(공유계약 A-5)이다. 순서 컬럼에 유일 제약이 있어 행을 하나씩 저장하면
   * 중간 상태가 반드시 제약을 위반한다 — 이동은 초안만 바꾸고 저장은 한 번뿐이어야 한다.
   * 요청 횟수를 세는 것이 그 규약을 지키는 유일한 자동 수단이다.
   */
  it('순서를 세 번 바꿔도 저장 요청이 나가지 않는다', async () => {
    const { requests, user } = renderDraftOperations([operationSaveRoute()]);
    await screen.findByText('1차 사출');

    const down = () =>
      within(operationRows()[0] as HTMLElement).getByRole('button', { name: '아래로 이동' });
    const up = () =>
      within(operationRows()[1] as HTMLElement).getByRole('button', { name: '위로 이동' });

    await user.click(down());
    await user.click(up());
    await user.click(down());

    expect(operationNames()).toEqual(['2차 조립', '1차 사출']);
    expect(savePuts(requests)).toHaveLength(0);
  });

  it('저장을 누르면 요청이 정확히 한 번 나가고 순서 값을 1부터 다시 매긴다', async () => {
    const { requests, user } = renderDraftOperations([operationSaveRoute()]);
    await screen.findByText('1차 사출');

    await user.click(
      within(operationRows()[0] as HTMLElement).getByRole('button', { name: '아래로 이동' }),
    );
    await user.click(within(operationsRegion()).getByRole('button', { name: '저장' }));

    await screen.findByText('저장했습니다');

    const puts = savePuts(requests);
    expect(puts).toHaveLength(1);
    expect(puts[0]?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    /* 계약이 이 경로에 If-Match를 요구하지 않는다 — 실으면 규약을 지어내는 것이다. */
    expect(puts[0]?.headers.get('If-Match')).toBeNull();

    const operations = savedOperations(puts[0]);
    expect(operations.map((item) => item.operationSeq)).toEqual([1, 2]);
    expect(operations.map((item) => item.operationName)).toEqual(['2차 조립', '1차 사출']);
    /* 전체 치환은 행 교체가 아니다 — 식별자를 버리면 진행 중 작업지시가 참조하던 행이 사라진다. */
    expect(operations.map((item) => item.routingOperationId)).toEqual([8002, 8001]);
  });

  /** 계약에 자리가 없는 항목을 지어내 보내지 않는다. */
  it('저장 본문에 외주 공정 항목이 실리지 않는다', async () => {
    const { requests, user } = renderDraftOperations([operationSaveRoute()]);
    await screen.findByText('1차 사출');

    await user.click(
      within(operationRows()[0] as HTMLElement).getByRole('button', { name: '아래로 이동' }),
    );
    await user.click(within(operationsRegion()).getByRole('button', { name: '저장' }));
    await screen.findByText('저장했습니다');

    const body = savePuts(requests)[0]?.body ?? '';
    expect(body).not.toContain('utsourced');
    expect(body).not.toContain('draftId');
  });

  /*
   * 서버 채번은 서버 재량이다. 응답을 정본으로 다시 세우되 표시 번호는 여전히 위치다.
   */
  it('저장에 성공하면 표를 응답 목록으로 다시 세운다', async () => {
    const { user } = renderDraftOperations([
      operationSaveRoute(() =>
        jsonResponse({
          items: [
            { ...routingOperationFixtures[1], operationSeq: 30 },
            { ...routingOperationFixtures[0], operationSeq: 40 },
          ],
        }),
      ),
    ]);
    await screen.findByText('1차 사출');

    await user.click(
      within(operationRows()[0] as HTMLElement).getByRole('button', { name: '아래로 이동' }),
    );
    await user.click(within(operationsRegion()).getByRole('button', { name: '저장' }));
    await screen.findByText('저장했습니다');

    expect(operationNames()).toEqual(['2차 조립', '1차 사출']);
    const region = operationsRegion();
    expect(within(region).queryByText('30')).not.toBeInTheDocument();
    expect(within(region).queryByText('40')).not.toBeInTheDocument();
    expect(within(operationRows()[0] as HTMLElement).getByText('1')).toBeInTheDocument();
  });

  it('저장에 실패하면 배너로 알리고 바꾼 순서를 잃지 않는다', async () => {
    const { user } = renderDraftOperations([
      operationSaveRoute(() =>
        jsonResponse(
          {
            errors: [
              { scope: 'field', field: 'operationSeq', code: 'STANDARD', message: '순서가 겹칩니다.' },
            ],
          },
          { status: 400 },
        ),
      ),
    ]);
    await screen.findByText('1차 사출');

    await user.click(
      within(operationRows()[0] as HTMLElement).getByRole('button', { name: '아래로 이동' }),
    );
    await user.click(within(operationsRegion()).getByRole('button', { name: '저장' }));

    /* 어느 행의 오류인지 계약이 알려 주지 않는다 — 인라인으로 낼 수 없어 배너로 올린다. */
    expect(await screen.findByText('순서가 겹칩니다.')).toBeInTheDocument();
    expect(operationNames()).toEqual(['2차 조립', '1차 사출']);
  });

  it('상태 잠김은 「최신 불러오기」 없는 배너로 낸다', async () => {
    const { user } = renderDraftOperations([
      operationSaveRoute(() =>
        jsonResponse(
          {
            errors: [
              { scope: 'screen', code: 'STATE_LOCKED', message: '확정된 Rev는 수정할 수 없습니다.' },
            ],
          },
          { status: 400 },
        ),
      ),
    ]);
    await screen.findByText('1차 사출');

    await user.click(
      within(operationRows()[0] as HTMLElement).getByRole('button', { name: '아래로 이동' }),
    );
    await user.click(within(operationsRegion()).getByRole('button', { name: '저장' }));

    expect(await screen.findByText('지금은 저장할 수 없는 상태입니다')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '최신 불러오기' })).not.toBeInTheDocument();
  });

  it('공정을 추가하면 표에만 반영되고 저장 요청은 나가지 않는다', async () => {
    const { requests, user } = renderDraftOperations([operationSaveRoute()]);
    await screen.findByText('1차 사출');

    await user.click(within(operationsRegion()).getByRole('button', { name: '공정 추가' }));

    await user.type(await screen.findByLabelText('공정명'), '3차 검사');
    await user.click(screen.getByRole('combobox', { name: '공정' }));
    await user.click(await screen.findByRole('option', { name: '조립' }));
    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(operationNames()).toEqual(['1차 사출', '2차 조립', '3차 검사']);
    expect(savePuts(requests)).toHaveLength(0);
  });

  it('새 행은 식별자 없이 저장 본문에 실린다', async () => {
    const { requests, user } = renderDraftOperations([operationSaveRoute()]);
    await screen.findByText('1차 사출');

    await user.click(within(operationsRegion()).getByRole('button', { name: '공정 추가' }));
    await user.type(await screen.findByLabelText('공정명'), '3차 검사');
    await user.click(screen.getByRole('combobox', { name: '공정' }));
    await user.click(await screen.findByRole('option', { name: '조립' }));
    await user.click(screen.getByRole('button', { name: '확인' }));

    await user.click(within(operationsRegion()).getByRole('button', { name: '저장' }));
    await screen.findByText('저장했습니다');

    const operations = savedOperations(savePuts(requests)[0]);
    expect(operations).toHaveLength(3);
    expect(operations[2]?.operationName).toBe('3차 검사');
    expect('routingOperationId' in (operations[2] ?? {})).toBe(false);
  });

  it('편집 창의 검증에 걸리면 표에 반영되지 않는다', async () => {
    const { user } = renderDraftOperations([operationSaveRoute()]);
    await screen.findByText('1차 사출');

    await user.click(within(operationsRegion()).getByRole('button', { name: '공정 추가' }));
    await user.click(await screen.findByRole('button', { name: '확인' }));

    expect(await screen.findAllByText('필수 입력 항목입니다.')).toHaveLength(2);
    expect(operationNames()).toEqual(['1차 사출', '2차 조립']);
  });

  /** 퍼센트로 넣은 수율은 100배 오입력이다 — 표에 들어오기 전에 막는다. */
  it('표준 수율을 퍼센트로 넣으면 표에 반영되지 않는다', async () => {
    const { user } = renderDraftOperations([operationSaveRoute()]);
    await screen.findByText('1차 사출');

    await user.click(
      within(operationRows()[0] as HTMLElement).getByRole('button', { name: '1번 공정 수정' }),
    );

    const rate = await screen.findByLabelText('표준 수율(0~1)');
    fireEvent.change(rate, { target: { value: '98' } });
    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(
      await screen.findByText('표준 수율은 0과 1 사이의 비율이어야 합니다. 퍼센트가 아닙니다.'),
    ).toBeInTheDocument();
    expect(within(operationRows()[0] as HTMLElement).getByText('0.98')).toBeInTheDocument();
  });

  it('행을 수정하면 자리를 지킨 채 값만 바뀐다', async () => {
    const { user } = renderDraftOperations([operationSaveRoute()]);
    await screen.findByText('1차 사출');

    await user.click(
      within(operationRows()[0] as HTMLElement).getByRole('button', { name: '1번 공정 수정' }),
    );
    await user.type(await screen.findByLabelText('공정명'), '(개정)');
    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(operationNames()).toEqual(['1차 사출(개정)', '2차 조립']);
  });

  it('행을 지우면 표에서 사라지고 저장 요청은 나가지 않는다', async () => {
    const { requests, user } = renderDraftOperations([operationSaveRoute()]);
    await screen.findByText('1차 사출');

    await user.click(
      within(operationRows()[0] as HTMLElement).getByRole('button', { name: '1번 공정 삭제' }),
    );

    expect(operationNames()).toEqual(['2차 조립']);
    expect(savePuts(requests)).toHaveLength(0);
  });

  it('취소를 누르면 서버에서 받은 목록으로 되돌아간다', async () => {
    const { user } = renderDraftOperations([operationSaveRoute()]);
    await screen.findByText('1차 사출');

    await user.click(
      within(operationRows()[0] as HTMLElement).getByRole('button', { name: '1번 공정 삭제' }),
    );
    await user.click(within(operationsRegion()).getByRole('button', { name: '취소' }));

    expect(operationNames()).toEqual(['1차 사출', '2차 조립']);
  });

  /*
   * 라인을 저장하면 헤더도 다시 불러온다(판 번호가 올라갈 수 있다).
   * 그때 저장하지 않은 헤더 편집이 서버 값으로 되돌아가므로 조용히 잃기 전에 먼저 막는다.
   */
  it('헤더에 저장하지 않은 변경이 있으면 라인 저장을 막고 사유를 낸다', async () => {
    const { requests, user } = renderDraftOperations([operationSaveRoute()]);
    await screen.findByText('1차 사출');

    await user.click(
      within(operationRows()[0] as HTMLElement).getByRole('button', { name: '아래로 이동' }),
    );
    await user.type(screen.getByLabelText('Routing 코드'), '-B');

    const save = within(operationsRegion()).getByRole('button', { name: '저장' });
    expect(save).toBeDisabled();
    expect(
      screen.getByText(
        '공정 저장은 Routing 정보에 저장하지 않은 변경이 있으면 할 수 없습니다. 먼저 저장하거나 취소하세요.',
      ),
    ).toBeInTheDocument();
    expect(savePuts(requests)).toHaveLength(0);
  });

  it('확정 Rev에서는 공정 라인 편집이 전부 막히고 사유가 보인다', async () => {
    renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(routingFixtures[1]),
        operationListRoute(7002),
        processListRoute(),
      ],
      '?item=5001&rev=7002',
    );

    await screen.findByText('1차 사출');

    const region = operationsRegion();
    expect(within(region).getByRole('button', { name: '공정 추가' })).toBeDisabled();
    expect(within(region).getByRole('button', { name: '저장' })).toBeDisabled();
    expect(within(region).queryByRole('button', { name: '위로 이동' })).not.toBeInTheDocument();
    expect(
      within(region).getAllByText(
        '공정 라인은 작성중 Rev에서만 편집할 수 있습니다. 변경하려면 신규 Rev를 발행하세요.',
      ).length,
    ).toBeGreaterThan(0);
  });
});

const transitionRoute = (
  action: 'confirm' | 'obsolete' | 'new-revision',
  routingId = 7003,
  respond: StubRoute['respond'] = () => jsonResponse(routingFixtures[0]),
): StubRoute => ({
  match: (request) =>
    request.method === 'POST' &&
    new URL(request.url).pathname === `/planning/routings/${String(routingId)}:${action}`,
  respond,
});

const stateLockedResponse = (message: string): Response =>
  jsonResponse(
    { errors: [{ scope: 'screen', code: 'STATE_LOCKED', message }] },
    { status: 400 },
  );

describe('RoutingScreen — 확정·폐기', () => {
  /* 되돌릴 수 없는 전이다 — 확인 단계를 건너뛰면 실수로 판이 잠긴다. */
  it('확정을 눌러도 확인 전에는 요청이 나가지 않는다', async () => {
    const { requests, user } = renderDraftOperations([transitionRoute('confirm')]);
    await screen.findByText('1차 사출');

    await user.click(within(headerRegion()).getByRole('button', { name: '확정' }));

    expect(await screen.findByText('이 Rev를 확정할까요?')).toBeInTheDocument();
    expect(requestsTo(requests, '/planning/routings/7003:confirm')).toHaveLength(0);
  });

  it('확인하면 멱등 키만 실어 확정 요청을 보낸다', async () => {
    const { requests, user } = renderDraftOperations([transitionRoute('confirm')]);
    await screen.findByText('1차 사출');

    await user.click(within(headerRegion()).getByRole('button', { name: '확정' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: '확정' }));

    await screen.findByText('저장했습니다');

    const posts = requestsTo(requests, '/planning/routings/7003:confirm');
    expect(posts).toHaveLength(1);
    expect(posts[0]?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    /* 계약이 이 경로에 If-Match를 요구하지 않는다 — 실으면 규약을 지어내는 것이다. */
    expect(posts[0]?.headers.get('If-Match')).toBeNull();
  });

  /*
   * 전이 응답에는 ETag가 없다 — 보관된 토큰은 그 순간 낡은 값이 된다.
   * 재조회로 새 토큰을 확보하지 않으면 다음 헤더 저장이 조용히 막힌다.
   */
  it('확정에 성공하면 상세와 Rev 목록을 다시 조회한다', async () => {
    const { requests, user } = renderDraftOperations([transitionRoute('confirm')]);
    await screen.findByText('1차 사출');

    const before = {
      detail: requestsTo(requests, '/planning/routings/7003').length,
      list: revisionRequests(requests).length,
    };

    await user.click(within(headerRegion()).getByRole('button', { name: '확정' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '확정' }));
    await screen.findByText('저장했습니다');

    await waitFor(() => {
      expect(requestsTo(requests, '/planning/routings/7003').length).toBeGreaterThan(before.detail);
    });
    expect(revisionRequests(requests).length).toBeGreaterThan(before.list);
  });

  it('상태 잠김은 창을 닫지 않고 「최신 불러오기」 없는 배너로 낸다', async () => {
    const { user } = renderDraftOperations([
      transitionRoute('confirm', 7003, () =>
        stateLockedResponse('작성중 Rev가 아니라 확정할 수 없습니다.'),
      ),
    ]);
    await screen.findByText('1차 사출');

    await user.click(within(headerRegion()).getByRole('button', { name: '확정' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '확정' }));

    expect(await screen.findByText('작성중 Rev가 아니라 확정할 수 없습니다.')).toBeInTheDocument();
    expect(screen.getByText('지금은 저장할 수 없는 상태입니다')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '최신 불러오기' })).not.toBeInTheDocument();
  });

  /* 계약이 라인 1건 이상을 요구한다(400 LINE_REQUIRED) — 화면이 먼저 막고 사유를 밝힌다. */
  it('라인이 0건이면 확정이 비활성이고 사유가 보인다', async () => {
    renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(),
        operationListRoute(7003, []),
        processListRoute(),
      ],
      '?item=5001&rev=7003',
    );

    await screen.findByText('등록된 공정이 없습니다');

    expect(within(headerRegion()).getByRole('button', { name: '확정' })).toBeDisabled();
    expect(screen.getByText('확정은 공정을 1건 이상 등록해야 할 수 있습니다.')).toBeInTheDocument();
  });

  /* 확정하면 되돌릴 수 없다 — 저장하지 않은 편집은 그 순간 영영 사라진다. */
  it('저장하지 않은 변경이 있으면 확정이 비활성이고 사유가 보인다', async () => {
    const { user } = renderDraftOperations([transitionRoute('confirm')]);
    await screen.findByText('1차 사출');

    await user.type(screen.getByLabelText('Routing 코드'), '-B');

    expect(within(headerRegion()).getByRole('button', { name: '확정' })).toBeDisabled();
    expect(
      screen.getByText('확정은 저장하지 않은 변경이 있으면 할 수 없습니다. 먼저 저장하거나 취소하세요.'),
    ).toBeInTheDocument();
  });

  it('작성중 Rev에서는 폐기가 비활성이고 먼저 확정하라고 알린다', async () => {
    renderDraftOperations([transitionRoute('obsolete')]);
    await screen.findByText('1차 사출');

    expect(within(headerRegion()).getByRole('button', { name: '폐기' })).toBeDisabled();
    expect(screen.getByText('폐기는 확정된 Rev에만 할 수 있습니다. 먼저 확정하세요.')).toBeInTheDocument();
  });

  it('확정 Rev에서는 폐기가 활성이고 확인하면 요청이 나간다', async () => {
    const { requests, user } = renderScreen(
      [
        itemListRoute(),
        revisionListRoute(),
        routingDetailRoute(routingFixtures[1]),
        operationListRoute(7002),
        processListRoute(),
        transitionRoute('obsolete', 7002),
      ],
      '?item=5001&rev=7002',
    );

    await screen.findByText('1차 사출');

    await user.click(within(headerRegion()).getByRole('button', { name: '폐기' }));
    expect(await screen.findByText('이 Rev를 폐기할까요?')).toBeInTheDocument();
    expect(requestsTo(requests, '/planning/routings/7002:obsolete')).toHaveLength(0);

    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '폐기' }));
    await screen.findByText('저장했습니다');

    const posts = requestsTo(requests, '/planning/routings/7002:obsolete');
    expect(posts).toHaveLength(1);
    expect(posts[0]?.headers.get('If-Match')).toBeNull();
  });

  it('확인 창에서 취소하면 요청이 나가지 않는다', async () => {
    const { requests, user } = renderDraftOperations([transitionRoute('confirm')]);
    await screen.findByText('1차 사출');

    await user.click(within(headerRegion()).getByRole('button', { name: '확정' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '취소' }));

    expect(screen.queryByText('이 Rev를 확정할까요?')).not.toBeInTheDocument();
    expect(requestsTo(requests, '/planning/routings/7003:confirm')).toHaveLength(0);
  });
});

const revisionRegion = (): HTMLElement => screen.getByRole('region', { name: 'Rev 목록' });

const createRoutingRoute = (
  respond: StubRoute['respond'] = () =>
    jsonResponse({ ...routingFixtures[0], routingId: 7010, routingVersion: 1 }, { status: 201 }),
): StubRoute => ({
  match: (request) =>
    request.method === 'POST' && new URL(request.url).pathname === '/planning/routings',
  respond,
});

describe('RoutingScreen — 신규 Rev 발행과 첫 Rev 등록', () => {
  it('Rev가 1건 이상이면 발행 버튼이 활성되고 멱등 키만 실어 요청한다', async () => {
    const { requests, user } = renderDraftOperations([
      transitionRoute('new-revision', 7003, () =>
        jsonResponse({ ...routingFixtures[0], routingId: 7004, routingVersion: 4 }, { status: 201 }),
      ),
      routingDetailRoute({ ...routingFixtures[0]!, routingId: 7004, routingVersion: 4 }),
      operationListRoute(7004),
    ]);
    await screen.findByText('1차 사출');

    await user.click(within(revisionRegion()).getByRole('button', { name: '신규 Rev 발행' }));
    await screen.findByText('등록했습니다');

    const posts = requestsTo(requests, '/planning/routings/7003:new-revision');
    expect(posts).toHaveLength(1);
    expect(posts[0]?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    expect(posts[0]?.headers.get('If-Match')).toBeNull();
  });

  /*
   * 201 응답에는 ETag가 없다 — 새 판으로 옮겨 상세를 다시 조회해야 잠금 토큰이 생긴다.
   * 옮기지 않으면 사용자가 방금 만든 판을 목록에서 직접 찾아야 한다.
   */
  it('발행에 성공하면 새 Rev로 옮겨 상세와 라인을 다시 조회한다', async () => {
    const { requests, user } = renderDraftOperations([
      transitionRoute('new-revision', 7003, () =>
        jsonResponse({ ...routingFixtures[0], routingId: 7004, routingVersion: 4 }, { status: 201 }),
      ),
      routingDetailRoute({ ...routingFixtures[0]!, routingId: 7004, routingVersion: 4 }),
      operationListRoute(7004),
    ]);
    await screen.findByText('1차 사출');

    await user.click(within(revisionRegion()).getByRole('button', { name: '신규 Rev 발행' }));

    await waitFor(() => {
      expect(requestsTo(requests, '/planning/routings/7004')).toHaveLength(1);
    });
    expect(requestsTo(requests, '/planning/routings/7004/operations')).toHaveLength(1);
  });

  it('상태 잠김은 「최신 불러오기」 없는 배너로 낸다', async () => {
    const { user } = renderDraftOperations([
      transitionRoute('new-revision', 7003, () =>
        stateLockedResponse('확정된 Rev에서만 신규 Rev를 발행할 수 있습니다.'),
      ),
    ]);
    await screen.findByText('1차 사출');

    await user.click(within(revisionRegion()).getByRole('button', { name: '신규 Rev 발행' }));

    expect(
      await screen.findByText('확정된 Rev에서만 신규 Rev를 발행할 수 있습니다.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '최신 불러오기' })).not.toBeInTheDocument();
  });

  it('저장하지 않은 변경이 있으면 발행이 비활성이고 사유가 보인다', async () => {
    const { user } = renderDraftOperations([transitionRoute('new-revision')]);
    await screen.findByText('1차 사출');

    await user.click(
      within(operationsRegion()).getByRole('button', { name: '1번 공정 삭제' }),
    );

    expect(within(revisionRegion()).getByRole('button', { name: '신규 Rev 발행' })).toBeDisabled();
    expect(
      screen.getByText(
        '신규 Rev 발행은 저장하지 않은 변경이 있으면 할 수 없습니다. 먼저 저장하거나 취소하세요.',
      ),
    ).toBeInTheDocument();
  });

  it('Rev가 0건이면 등록 액션이 보이고 누르면 빈 등록 폼이 열린다', async () => {
    const { user } = renderScreen(
      [itemListRoute(), revisionListRoute([]), processListRoute()],
      '?item=5001',
    );

    await user.click(await screen.findByRole('button', { name: 'Routing 등록' }));

    expect(await screen.findByLabelText('Routing 코드')).toHaveValue('');
    expect(screen.getByLabelText('유효시작')).toHaveValue('');
    // 판 번호와 상태는 서버가 채운다 — 없는 값을 미리 지어내 보이지 않는다.
    expect(screen.queryByText('Rev 1')).not.toBeInTheDocument();
    expect(screen.queryByText('작성중')).not.toBeInTheDocument();
  });

  it('등록 폼에서 로컬 검증에 걸리면 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen(
      [itemListRoute(), revisionListRoute([]), processListRoute(), createRoutingRoute()],
      '?item=5001',
    );

    await user.click(await screen.findByRole('button', { name: 'Routing 등록' }));
    await user.type(await screen.findByLabelText('Routing 코드'), 'STANDARD');
    await user.click(within(headerRegion()).getByRole('button', { name: 'Routing 등록' }));

    expect(await screen.findByText('필수 입력 항목입니다.')).toBeInTheDocument();
    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(0);
  });

  it('등록하면 품목 id와 코드·유효시작을 실어 보내고 새 Rev로 옮긴다', async () => {
    const { requests, user } = renderScreen(
      [
        itemListRoute(),
        revisionListRoute([]),
        processListRoute(),
        createRoutingRoute(),
        routingDetailRoute({ ...routingFixtures[0]!, routingId: 7010, routingVersion: 1 }),
        operationListRoute(7010, []),
      ],
      '?item=5001',
    );

    await user.click(await screen.findByRole('button', { name: 'Routing 등록' }));
    await user.type(await screen.findByLabelText('Routing 코드'), 'STANDARD');
    fireEvent.change(screen.getByLabelText('유효시작'), { target: { value: '2026-03-01' } });
    await user.click(within(headerRegion()).getByRole('button', { name: 'Routing 등록' }));

    await screen.findByText('등록했습니다');

    const post = requestsTo(requests, '/planning/routings').find(
      (request) => request.method === 'POST',
    );
    expect(post?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    /* 첫 등록에는 잠글 대상이 없다 — 계약이 If-Match를 요구하지 않는다. */
    expect(post?.headers.get('If-Match')).toBeNull();
    expect(JSON.parse(post?.body ?? '{}')).toEqual({
      itemId: 5001,
      routingCode: 'STANDARD',
      effectiveFrom: '2026-03-01',
      effectiveTo: null,
    });

    /* 201에는 ETag가 없다 — 새 판으로 옮겨 상세를 다시 조회해야 잠금 토큰이 생긴다. */
    await waitFor(() => {
      expect(requestsTo(requests, '/planning/routings/7010')).toHaveLength(1);
    });
  });

  it('등록 폼에서 취소하면 폼이 닫힌다', async () => {
    const { user } = renderScreen(
      [itemListRoute(), revisionListRoute([]), processListRoute(), createRoutingRoute()],
      '?item=5001',
    );

    await user.click(await screen.findByRole('button', { name: 'Routing 등록' }));
    await user.type(await screen.findByLabelText('Routing 코드'), 'STANDARD');
    await user.click(within(headerRegion()).getByRole('button', { name: '취소' }));

    expect(screen.queryByLabelText('Routing 코드')).not.toBeInTheDocument();
  });

  /* 아직 없는 Rev에는 전이할 대상이 없다. 감추지 않고 사유와 함께 비활성으로 둔다. */
  it('등록 폼에서는 확정·폐기가 비활성이고 사유가 보인다', async () => {
    const { user } = renderScreen(
      [itemListRoute(), revisionListRoute([]), processListRoute()],
      '?item=5001',
    );

    await user.click(await screen.findByRole('button', { name: 'Routing 등록' }));

    const header = headerRegion();
    expect(within(header).getByRole('button', { name: '확정' })).toBeDisabled();
    expect(within(header).getByRole('button', { name: '폐기' })).toBeDisabled();
    expect(
      within(header).getAllByText('확정·폐기는 Routing을 먼저 등록해야 할 수 있습니다.').length,
    ).toBeGreaterThan(0);
  });
});
