import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { messageRow, messageRowFixtures } from './fixtures';
import { IntegrationSyncScreen } from './screen';

const ROUTE = '/master-data/integration-sync';
const LIST_PATH = '/integration/messages';

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

const listBody = (
  items: unknown[],
  page: Partial<{ page: number; size: number; total: number }> = {},
) => ({
  items,
  page: { page: 1, size: 50, total: items.length, ...page },
});

const listRoute = (
  items: unknown[] = messageRowFixtures,
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isGet(request, LIST_PATH),
  respond: () => jsonResponse(listBody(items, page)),
});

const failingListRoute = (status: number, body: unknown = { message: '' }): StubRoute => ({
  match: (request) => isGet(request, LIST_PATH),
  respond: () => jsonResponse(body, { status }),
});

/** 주소가 실제로 어떻게 바뀌는지 본다 — 기본 기간이 주소에 채워지는지 판정할 유일한 근거다. */
const LocationProbe = () => {
  const location = useLocation();

  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

const renderScreen = (
  routes: StubRoute[],
  search = '',
): { requests: RecordedRequest[]; user: ReturnType<typeof userEvent.setup> } => {
  const { fetch, requests } = createRecordingFetch(routes);

  renderWithProviders(
    <>
      <IntegrationSyncScreen />
      <LocationProbe />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, user: userEvent.setup() };
};

const requestsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === pathname);

/** 목록과 선택지가 같은 경로를 쓴다. 조건이 실렸는지로 가른다. */
const NARROWING_KEYS = [
  'statusCode',
  'interfaceCode',
  'directionCode',
  'targetTypeCode',
  'retryCountMin',
  'page',
];

const isNarrowed = (request: RecordedRequest): boolean =>
  NARROWING_KEYS.some((key) => request.url.searchParams.has(key));

/** 조건이 걸린 요청 = 목록 조회. 조건 없는 요청 = 선택지 조회(또는 조건 없는 목록 조회). */
const narrowedRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requestsTo(requests, LIST_PATH).filter(isNarrowed);

const plainRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requestsTo(requests, LIST_PATH).filter((request) => !isNarrowed(request));

const currentLocation = (): string => screen.getByTestId('location').textContent ?? '';

/** 오늘 날짜(로컬). 기본 기간이 「오늘까지」인지 보기 위해 테스트도 같은 기준으로 만든다. */
const todayText = (): string => {
  const today = new Date();
  const pad = (value: number): string => String(value).padStart(2, '0');

  return `${String(today.getFullYear())}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

describe('IntegrationSyncScreen — 기간 필수 조회', () => {
  it('화면에 들어오면 기본 기간이 주소에 채워지고 목록을 조회한다', async () => {
    const { requests } = renderScreen([listRoute()]);

    expect(await screen.findByText('SAMPLE-KEY-0001')).toBeInTheDocument();

    const location = currentLocation();
    expect(location).toContain(`to=${todayText()}`);
    expect(new URLSearchParams(location.split('?')[1]).get('from')).toMatch(DATE_PATTERN);
    expect(requestsTo(requests, LIST_PATH)).toHaveLength(1);
  });

  it('기본 기간은 오늘을 포함해 7일이다', async () => {
    renderScreen([listRoute()]);
    await screen.findByText('SAMPLE-KEY-0001');

    const params = new URLSearchParams(currentLocation().split('?')[1]);
    const from = new Date(`${params.get('from') ?? ''}T00:00:00`);
    const to = new Date(`${params.get('to') ?? ''}T00:00:00`);
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);

    expect(days).toBe(6);
  });

  it('요청 기간이 초와 시간대까지 갖춘 형식으로 실린다 — 날짜만 보내면 서버가 거부한다', async () => {
    const { requests } = renderScreen([listRoute()], '?from=2026-08-01&to=2026-08-06');
    await screen.findByText('SAMPLE-KEY-0001');

    const first = requestsTo(requests, LIST_PATH)[0];
    expect(first?.url.searchParams.get('createdFrom')).toMatch(
      /^2026-08-01T00:00:00[+-]\d{2}:\d{2}$/,
    );
    // 종료가 그날 00:00:00이면 마지막 날에 생긴 건이 통째로 빠진다.
    expect(first?.url.searchParams.get('createdTo')).toMatch(
      /^2026-08-06T23:59:59[+-]\d{2}:\d{2}$/,
    );
  });

  it('주소에 있던 기간이 첫 조회에 그대로 실린다 — 새로고침·공유가 같은 결과를 낸다', async () => {
    const { requests } = renderScreen([listRoute()], '?from=2026-07-01&to=2026-07-31');
    await screen.findByText('SAMPLE-KEY-0001');

    expect(requestsTo(requests, LIST_PATH)).toHaveLength(1);
    expect(requestsTo(requests, LIST_PATH)[0]?.url.searchParams.get('createdFrom')).toContain(
      '2026-07-01',
    );
  });

  it('조회를 누르면 고친 기간이 주소와 요청에 함께 실린다', async () => {
    const { requests, user } = renderScreen([listRoute()], '?from=2026-08-01&to=2026-08-06');
    await screen.findByText('SAMPLE-KEY-0001');

    await user.clear(screen.getByLabelText('기간 시작'));
    await user.type(screen.getByLabelText('기간 시작'), '2026-07-20');
    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(currentLocation()).toContain('from=2026-07-20');
    expect(requestsTo(requests, LIST_PATH).at(-1)?.url.searchParams.get('createdFrom')).toContain(
      '2026-07-20',
    );
  });

  it('기간을 비우면 조회 버튼이 잠기고 사유가 보이며 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen([listRoute()], '?from=2026-08-01&to=2026-08-06');
    await screen.findByText('SAMPLE-KEY-0001');

    await user.clear(screen.getByLabelText('기간 시작'));

    const searchButton = screen.getByRole('button', { name: '조회' });
    expect(searchButton).toBeDisabled();

    const reasonId = searchButton.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(reasonId)).toHaveTextContent(
      '조회는 기간을 모두 채운 뒤에 쓸 수 있습니다.',
    );
    expect(requestsTo(requests, LIST_PATH)).toHaveLength(1);
  });

  it('기간이 역전되면 조회 버튼이 잠기고 다른 사유가 보인다', async () => {
    const { user } = renderScreen([listRoute()], '?from=2026-08-01&to=2026-08-06');
    await screen.findByText('SAMPLE-KEY-0001');

    await user.clear(screen.getByLabelText('기간 종료'));
    await user.type(screen.getByLabelText('기간 종료'), '2026-07-01');

    const searchButton = screen.getByRole('button', { name: '조회' });
    expect(searchButton).toBeDisabled();

    const reasonId = searchButton.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(reasonId)).toHaveTextContent(
      '기간 종료는 기간 시작보다 앞설 수 없습니다.',
    );
  });

  it('주소의 기간이 비어 있으면 조회하지 않고 기간을 고르라고 안내한다', async () => {
    const { requests } = renderScreen([listRoute()], '?from=&to=');

    expect(await screen.findByText('기간을 고르고 조회하세요')).toBeInTheDocument();
    expect(requestsTo(requests, LIST_PATH)).toHaveLength(0);
  });

  it('초기화를 누르면 기간이 기본값으로 되돌아간다', async () => {
    const { user } = renderScreen([listRoute()], '?from=2026-01-01&to=2026-01-02');
    await screen.findByText('SAMPLE-KEY-0001');

    await user.click(screen.getByRole('button', { name: '초기화' }));

    expect(currentLocation()).toContain(`to=${todayText()}`);
  });
});

describe('IntegrationSyncScreen — 목록 표시', () => {
  it('선택 열과 일곱 열, 응답 건수만큼의 행이 나온다', async () => {
    renderScreen([listRoute()]);

    expect(await screen.findByText('SAMPLE-KEY-0001')).toBeInTheDocument();

    const table = screen.getByRole('table');
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);

    // 첫 칸은 디자인 시스템이 렌더하는 선택 열이라 머리글 글자가 없다.
    expect(headers).toEqual([
      '',
      '메시지 키',
      '연계 종류',
      '상태',
      '시도',
      '생성',
      '마지막 오류',
      '재처리',
    ]);
    expect(within(table).getAllByRole('row')).toHaveLength(messageRowFixtures.length + 1);
  });

  it('값이 없는 칸은 비워 두지 않고 「—」로 낸다', async () => {
    renderScreen([listRoute([messageRow({ lastErrorMessage: null })])]);
    await screen.findByText('SAMPLE-KEY-0001');

    const row = screen.getAllByRole('row')[1];
    expect(within(row as HTMLElement).getByText('—')).toBeInTheDocument();
  });

  it('생성 시각을 서버가 적어 보낸 벽시계 그대로 낸다', async () => {
    renderScreen([listRoute([messageRow()])]);

    expect(await screen.findByText('2026-08-04 09:12')).toBeInTheDocument();
  });

  it('모르는 상태 코드는 코드 문자열 그대로 나온다 — 이름을 지어내지 않는다', async () => {
    renderScreen([listRoute()]);

    expect(await screen.findByText('ERROR')).toBeInTheDocument();
    // 확인된 코드에만 화면 문구를 붙인다. 픽스처의 FAILED 두 건이 그 문구로 나온다.
    expect(screen.getAllByText('실패')).toHaveLength(2);
  });

  it('워커가 잡고 있는 행에는 처리 중 보조 문구가 붙는다', async () => {
    renderScreen([listRoute()]);

    expect(await screen.findByText('11:20부터 처리 중')).toBeInTheDocument();
  });

  it('다음 시도가 미래인 행에는 자동 재시도 보조 문구가 붙는다', async () => {
    renderScreen([listRoute()]);

    expect(await screen.findByText('23:30 자동 재시도')).toBeInTheDocument();
  });
});

describe('IntegrationSyncScreen — 빈 상태와 실패', () => {
  it('0건이면 조건을 고치라는 빈 상태가 나온다', async () => {
    renderScreen([listRoute([])]);

    expect(await screen.findByText('조건에 맞는 기록이 없습니다')).toBeInTheDocument();
  });

  it('조회에 실패하면 표와 빈 상태 대신 오류 배너와 다시 시도가 나온다', async () => {
    renderScreen([failingListRoute(500)]);

    expect(await screen.findByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('조건에 맞는 기록이 없습니다')).not.toBeInTheDocument();
    // 서버가 빈 message를 줘도 배너에 제목만 남으면 안 된다 — 무엇을 하라는 안내가 사라진다.
    expect(
      screen.getByText('잠시 뒤 다시 시도하세요. 반복되면 담당자에게 알려 주세요.'),
    ).toBeInTheDocument();
  });

  it('다시 시도를 누르면 목록 요청이 한 번 더 나간다', async () => {
    const { requests, user } = renderScreen([failingListRoute(500)]);

    await user.click(await screen.findByRole('button', { name: '다시 시도' }));

    expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(1);
  });

  it('권한이 없으면 권한 안내가 나온다', async () => {
    renderScreen([failingListRoute(403)]);

    expect(
      await screen.findByText(
        '이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.',
      ),
    ).toBeInTheDocument();
  });
});

describe('IntegrationSyncScreen — 조건으로 좁히기', () => {
  const PERIOD = '?from=2026-08-01&to=2026-08-06';

  it('고른 조건이 요청 쿼리와 주소에 함께 실린다', async () => {
    const { requests, user } = renderScreen([listRoute()], PERIOD);
    await screen.findByText('SAMPLE-KEY-0001');

    await user.click(screen.getByRole('combobox', { name: '상태' }));
    await user.click(screen.getByRole('option', { name: 'ERROR' }));
    await user.type(screen.getByLabelText('시도 횟수 하한'), '2');
    await user.click(screen.getByRole('button', { name: '조회' }));

    const last = narrowedRequests(requests).at(-1);
    expect(last?.url.searchParams.get('statusCode')).toBe('ERROR');
    expect(last?.url.searchParams.get('retryCountMin')).toBe('2');
    expect(currentLocation()).toContain('status=ERROR');
    expect(currentLocation()).toContain('retryMin=2');
  });

  it('걸리지 않은 조건은 요청에 키 자체를 싣지 않는다', async () => {
    const { requests } = renderScreen([listRoute()], PERIOD);
    await screen.findByText('SAMPLE-KEY-0001');

    const first = requestsTo(requests, LIST_PATH)[0];
    for (const key of NARROWING_KEYS) {
      expect(first?.url.searchParams.has(key)).toBe(false);
    }
  });

  it('주소에 있던 조건이 첫 조회에 그대로 실린다', async () => {
    const { requests } = renderScreen([listRoute()], `${PERIOD}&status=FAILED&dir=OUTBOUND`);
    await screen.findByText('SAMPLE-KEY-0001');

    const listRequest = narrowedRequests(requests)[0];
    expect(listRequest?.url.searchParams.get('statusCode')).toBe('FAILED');
    expect(listRequest?.url.searchParams.get('directionCode')).toBe('OUTBOUND');
  });

  it('조건이 걸리면 선택지는 조건 없는 조회에서 만든다 — 선택지가 자기 자신으로 줄면 안 된다', async () => {
    const { requests } = renderScreen([listRoute()], `${PERIOD}&status=FAILED`);
    await screen.findByText('SAMPLE-KEY-0001');

    // 조건이 실린 목록 조회와, 조건이 하나도 실리지 않은 선택지 조회가 따로 나간다.
    expect(narrowedRequests(requests)).toHaveLength(1);
    expect(plainRequests(requests)).toHaveLength(1);
    for (const key of NARROWING_KEYS) {
      expect(plainRequests(requests)[0]?.url.searchParams.has(key)).toBe(false);
    }
  });

  it('조건이 걸린 상태에서도 선택지에 다른 값이 남는다', async () => {
    const { user } = renderScreen([listRoute()], `${PERIOD}&status=FAILED`);
    await screen.findByText('SAMPLE-KEY-0001');

    await user.click(screen.getByRole('combobox', { name: '상태' }));

    expect(screen.getByRole('option', { name: 'ERROR' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'FAILED' })).toBeInTheDocument();
  });

  it('고른 값이 선택지에 없어도 목록에 남는다 — 없으면 해제할 방법이 사라진다', async () => {
    const { user } = renderScreen([listRoute()], `${PERIOD}&status=GONE_CODE`);
    await screen.findByText('SAMPLE-KEY-0001');

    await user.click(screen.getByRole('combobox', { name: '상태' }));

    expect(screen.getByRole('option', { name: 'GONE_CODE' })).toBeInTheDocument();
  });

  it('조건 칩의 ×는 그 조건만 풀고 다시 조회한다', async () => {
    const { requests, user } = renderScreen([listRoute()], `${PERIOD}&status=FAILED&dir=OUTBOUND`);
    await screen.findByText('SAMPLE-KEY-0001');

    await user.click(screen.getByRole('button', { name: '상태 조건 제거' }));

    expect(currentLocation()).not.toContain('status=');
    expect(currentLocation()).toContain('dir=OUTBOUND');

    const last = narrowedRequests(requests).at(-1);
    expect(last?.url.searchParams.has('statusCode')).toBe(false);
    expect(last?.url.searchParams.get('directionCode')).toBe('OUTBOUND');
  });

  it('초기화는 기간을 기본값으로 되돌리고 나머지 조건과 쪽을 지운다', async () => {
    const { user } = renderScreen([listRoute()], `${PERIOD}&status=FAILED&page=3`);
    await screen.findByText('SAMPLE-KEY-0001');

    await user.click(screen.getByRole('button', { name: '초기화' }));

    const location = currentLocation();
    expect(location).toContain(`to=${todayText()}`);
    expect(location).not.toContain('status=');
    expect(location).not.toContain('page=');
  });
});

describe('IntegrationSyncScreen — 쪽 이동', () => {
  const PERIOD = '?from=2026-08-01&to=2026-08-06';

  it('다음을 누르면 쪽이 하나 늘고 요청에 실린다', async () => {
    const { requests, user } = renderScreen(
      [listRoute(messageRowFixtures, { page: 1, size: 3, total: 10 })],
      PERIOD,
    );
    await screen.findByText('SAMPLE-KEY-0001');

    await user.click(screen.getByRole('button', { name: '다음' }));

    expect(currentLocation()).toContain('page=2');
    expect(narrowedRequests(requests).at(-1)?.url.searchParams.get('page')).toBe('2');
  });

  it('첫 쪽이면 주소와 요청에 page 키가 없다', async () => {
    const { requests } = renderScreen(
      [listRoute(messageRowFixtures, { page: 1, size: 3, total: 10 })],
      PERIOD,
    );
    await screen.findByText('SAMPLE-KEY-0001');

    expect(currentLocation()).not.toContain('page=');
    expect(requestsTo(requests, LIST_PATH)[0]?.url.searchParams.has('page')).toBe(false);
  });

  it('지금 위치를 받은 건수와 전체 건수로 계산해 낸다', async () => {
    renderScreen(
      [listRoute(messageRowFixtures, { page: 3, size: 3, total: 10 })],
      `${PERIOD}&page=3`,
    );

    expect(await screen.findByText('7–9 / 전체 10건')).toBeInTheDocument();
  });

  it('마지막 쪽에서는 다음이 잠긴다', async () => {
    renderScreen(
      [listRoute(messageRowFixtures, { page: 4, size: 3, total: 12 })],
      `${PERIOD}&page=4`,
    );
    await screen.findByText('SAMPLE-KEY-0001');

    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  });

  it('전체가 쪽 크기의 배수여도 마지막 쪽에서 다음이 잠긴다', async () => {
    renderScreen(
      [listRoute(messageRowFixtures, { page: 2, size: 3, total: 6 })],
      `${PERIOD}&page=2`,
    );
    await screen.findByText('SAMPLE-KEY-0001');

    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  });

  it('0건이면 전체 0건이 보이고 양쪽 이동이 다 잠긴다', async () => {
    renderScreen([listRoute([], { page: 1, size: 50, total: 0 })], PERIOD);

    expect(await screen.findByText('전체 0건')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이전' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  });

  it('마지막 쪽보다 뒤를 가리키면 첫 쪽으로 갈 수단과 함께 안내한다', async () => {
    const { user } = renderScreen(
      [listRoute([], { page: 9, size: 3, total: 10 })],
      `${PERIOD}&page=9`,
    );

    expect(await screen.findByText('이 쪽에는 결과가 없습니다')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '첫 쪽으로' }));

    expect(currentLocation()).not.toContain('page=');
  });

  it('조건을 바꾸면 쪽이 첫 쪽으로 되돌아간다 — 좁힌 결과가 그 쪽에 못 미친다', async () => {
    const { requests, user } = renderScreen(
      [listRoute(messageRowFixtures, { page: 3, size: 3, total: 10 })],
      `${PERIOD}&page=3`,
    );
    await screen.findByText('SAMPLE-KEY-0001');

    await user.click(screen.getByRole('combobox', { name: '상태' }));
    await user.click(screen.getByRole('option', { name: 'ERROR' }));
    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(currentLocation()).not.toContain('page=');
    expect(narrowedRequests(requests).at(-1)?.url.searchParams.has('page')).toBe(false);
  });

  it('조건 칩으로 조건을 풀어도 쪽이 첫 쪽으로 되돌아간다', async () => {
    const { user } = renderScreen(
      [listRoute(messageRowFixtures, { page: 3, size: 3, total: 10 })],
      `${PERIOD}&status=FAILED&page=3`,
    );
    await screen.findByText('SAMPLE-KEY-0001');

    await user.click(screen.getByRole('button', { name: '상태 조건 제거' }));

    expect(currentLocation()).not.toContain('page=');
  });
});

describe('IntegrationSyncScreen — 상세', () => {
  const PERIOD = '?from=2026-08-01&to=2026-08-06';
  const DETAIL_PATH = `${LIST_PATH}/9001`;

  /**
   * 상세 응답은 **전문을 언제나 싣는다.** 여기 값이 화면 어디에도 나오지 않아야 한다.
   * 합성값임이 한눈에 보이는 이름만 쓴다(공개 저장소 경계).
   */
  const PAYLOAD_MARKER = 'SAMPLE-PAYLOAD-MARKER';

  const detailRoute = (overrides: Record<string, unknown> = {}, status = 200): StubRoute => ({
    match: (request) => isGet(request, DETAIL_PATH),
    respond: () =>
      status === 200
        ? jsonResponse({
            ...messageRowFixtures[0],
            payload: { sampleField: PAYLOAD_MARKER },
            ...overrides,
          })
        : jsonResponse({ message: '' }, { status }),
  });

  const openFirstDetail = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: 'SAMPLE-KEY-0001 상세 열기' }));
  };

  it('메시지 키를 누르기 전에는 상세를 조회하지 않는다', async () => {
    const { requests } = renderScreen([listRoute(), detailRoute()], PERIOD);
    await screen.findByText('SAMPLE-KEY-0001');

    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(0);
  });

  it('메시지 키를 누르면 상세를 조회하고 주소에 남긴다', async () => {
    const { requests, user } = renderScreen([listRoute(), detailRoute()], PERIOD);
    await openFirstDetail(user);

    // 디자인 시스템 Dialog는 닫혀 있어도 내용을 DOM에 둔다. 열림 여부는 role로만 판정된다.
    expect(
      within(await screen.findByRole('dialog')).getByText('연계 메시지 상세'),
    ).toBeInTheDocument();
    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(1);
    expect(currentLocation()).toContain('sel=9001');
  });

  it('주소에 상세가 있으면 새로고침해도 같은 상세가 열린다', async () => {
    const { requests } = renderScreen([listRoute(), detailRoute()], `${PERIOD}&sel=9001`);

    expect(
      within(await screen.findByRole('dialog')).getByText('연계 메시지 상세'),
    ).toBeInTheDocument();
    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(1);
  });

  it('닫으면 주소에서 상세가 지워진다', async () => {
    const { user } = renderScreen([listRoute(), detailRoute()], `${PERIOD}&sel=9001`);
    await screen.findByRole('dialog');

    await user.click(screen.getByRole('button', { name: '닫기' }));

    expect(currentLocation()).not.toContain('sel=');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('전문이 실려 와도 화면 어디에도 나오지 않는다', async () => {
    const { user } = renderScreen([listRoute(), detailRoute()], PERIOD);
    await openFirstDetail(user);
    await screen.findByRole('dialog');

    expect(screen.queryByText(PAYLOAD_MARKER)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(PAYLOAD_MARKER);
    expect(document.body.textContent).not.toContain('sampleField');
  });

  it('전송 내용 구획은 잠긴 채로 사유와 함께 보인다', async () => {
    const { user } = renderScreen([listRoute(), detailRoute()], PERIOD);
    await openFirstDetail(user);

    expect(await screen.findByRole('button', { name: '전송 내용 보기' })).toBeDisabled();
    expect(
      screen.getByText(
        '전송 내용은 열람 범위가 정해진 뒤에 볼 수 있습니다. 지금은 표시하지 않습니다.',
      ),
    ).toBeInTheDocument();
  });

  it('상세 조회에 실패하면 창 안에 사유가 나오고 목록은 남는다', async () => {
    const { user } = renderScreen([listRoute(), detailRoute({}, 500)], PERIOD);
    await openFirstDetail(user);

    expect(await screen.findByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('SAMPLE-KEY-0002')).toBeInTheDocument();
  });

  it('전문 권한이 없어 상세가 403이면 권한 안내가 나온다', async () => {
    const { user } = renderScreen([listRoute(), detailRoute({}, 403)], PERIOD);
    await openFirstDetail(user);

    expect(
      await screen.findByText(
        '이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.',
      ),
    ).toBeInTheDocument();
  });

  it('조건을 바꾸면 열려 있던 상세도 닫힌다 — 그 건이 새 결과에 없을 수 있다', async () => {
    const { user } = renderScreen([listRoute(), detailRoute()], `${PERIOD}&sel=9001`);
    await screen.findByRole('dialog');

    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(currentLocation()).not.toContain('sel=');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('IntegrationSyncScreen — 단건 재처리', () => {
  const PERIOD = '?from=2026-08-01&to=2026-08-06';
  const RETRY_PATH = `${LIST_PATH}/9001:retry`;

  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const retryRoute = (respond: StubRoute['respond']): StubRoute => ({
    match: (request) => request.method === 'POST' && new URL(request.url).pathname === RETRY_PATH,
    respond,
  });

  const okRetry = retryRoute(() => jsonResponse(messageRowFixtures[0]));

  const confirmRetry = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: 'SAMPLE-KEY-0001 재처리' }));
    await user.click(await screen.findByRole('button', { name: '재처리' }));
  };

  it('확인을 거쳐야 요청이 나간다', async () => {
    const { requests, user } = renderScreen([listRoute(), okRetry], PERIOD);

    await user.click(await screen.findByRole('button', { name: 'SAMPLE-KEY-0001 재처리' }));
    expect(within(screen.getByRole('dialog')).getByText('다시 보낼까요?')).toBeInTheDocument();
    expect(requestsTo(requests, RETRY_PATH)).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: '재처리' }));

    expect(requestsTo(requests, RETRY_PATH)).toHaveLength(1);
  });

  it('멱등 키가 UUID 형식으로 실리고 If-Match는 실리지 않는다', async () => {
    const { requests, user } = renderScreen([listRoute(), okRetry], PERIOD);
    await confirmRetry(user);

    const request = requestsTo(requests, RETRY_PATH)[0];
    expect(request?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    // 이 리소스에는 낙관적 잠금이 없다. If-Match를 꺼내려 하면 요청 자체가 나가지 않는다.
    expect(request?.headers.has('If-Match')).toBe(false);
    expect(request?.body).toBe('');
  });

  it('성공하면 창이 닫히고 안내가 뜨며 목록을 다시 조회한다', async () => {
    const { requests, user } = renderScreen([listRoute(), okRetry], PERIOD);
    const before = requestsTo(requests, LIST_PATH).length;

    await confirmRetry(user);

    expect(await screen.findByText('다시 보내도록 요청했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(before);
    });
  });

  it('연타해도 같은 요청이 두 번 나가지 않는다', async () => {
    const { requests, user } = renderScreen(
      [
        listRoute(),
        retryRoute(
          () =>
            new Response(JSON.stringify(messageRowFixtures[0]), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
        ),
      ],
      PERIOD,
    );

    await user.click(await screen.findByRole('button', { name: 'SAMPLE-KEY-0001 재처리' }));
    const confirm = await screen.findByRole('button', { name: '재처리' });
    await user.click(confirm);
    await user.click(confirm);

    expect(requestsTo(requests, RETRY_PATH)).toHaveLength(1);
  });

  it('워커 점유 충돌은 목록 행의 시각과 함께 안내한다', async () => {
    const { user } = renderScreen(
      [
        listRoute([
          messageRow({ lockedBy: 'sync-worker-01', lockedAt: '2026-08-04T11:20:00+09:00' }),
        ]),
        retryRoute(() =>
          jsonResponse({ conflictCause: 'workerLease', message: '' }, { status: 409 }),
        ),
      ],
      PERIOD,
    );
    await confirmRetry(user);

    expect(
      await screen.findByText(
        '이 건을 처리하는 작업이 11:20부터 진행 중입니다. 잠시 뒤 다시 시도하세요.',
      ),
    ).toBeInTheDocument();
    // 실패했으면 창을 닫지 않는다 — 사유를 보고 다음 행동을 정해야 한다.
    expect(within(screen.getByRole('dialog')).getByText('다시 보낼까요?')).toBeInTheDocument();
  });

  it('다른 사용자 충돌은 다른 문구로 나온다', async () => {
    const { user } = renderScreen(
      [
        listRoute(),
        retryRoute(() => jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 })),
      ],
      PERIOD,
    );
    await confirmRetry(user);

    expect(
      await screen.findByText(
        '다른 사용자가 이 건을 먼저 처리했습니다. 목록을 다시 조회해 상태를 확인하세요.',
      ),
    ).toBeInTheDocument();
  });

  it('상태가 실패가 아니면 서버 문구가 비어도 안내가 남는다', async () => {
    const { user } = renderScreen(
      [
        listRoute(),
        retryRoute(() =>
          jsonResponse(
            {
              errors: [{ scope: 'field', field: '문자열', code: 'NOT_RETRYABLE', message: '' }],
            },
            { status: 400 },
          ),
        ),
      ],
      PERIOD,
    );
    await confirmRetry(user);

    expect(
      await screen.findByText(
        '지금 상태에서는 다시 보낼 수 없습니다. 목록을 다시 조회해 상태를 확인하세요.',
      ),
    ).toBeInTheDocument();
  });

  it('다시 조회를 누르면 목록 요청이 한 번 더 나간다', async () => {
    const { requests, user } = renderScreen(
      [
        listRoute(),
        retryRoute(() => jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 })),
      ],
      PERIOD,
    );
    await confirmRetry(user);
    const before = requestsTo(requests, LIST_PATH).length;

    await user.click(await screen.findByRole('button', { name: '다시 조회' }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(before);
    });
  });

  it('권한이 없으면 권한 안내가 창 안에 나온다', async () => {
    const { user } = renderScreen(
      [listRoute(), retryRoute(() => jsonResponse({ message: '' }, { status: 403 }))],
      PERIOD,
    );
    await confirmRetry(user);

    expect(
      await screen.findByText(
        '이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.',
      ),
    ).toBeInTheDocument();
  });

  it('연결이 끊기면 연결 안내가 나온다', async () => {
    const { user } = renderScreen(
      [
        listRoute(),
        {
          match: (request) =>
            request.method === 'POST' && new URL(request.url).pathname === RETRY_PATH,
          respond: () => {
            throw new Error('네트워크 실패');
          },
        },
      ],
      PERIOD,
    );
    await confirmRetry(user);

    expect(
      await screen.findByText('네트워크 연결이 끊겼습니다. 연결을 확인한 뒤 다시 시도하세요.'),
    ).toBeInTheDocument();
  });
});

describe('IntegrationSyncScreen — 선택 일괄 재처리', () => {
  const PERIOD = '?from=2026-08-01&to=2026-08-06';
  const BATCH_PATH = '/integration/messages:retry-batch';

  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const batchRoute = (respond: StubRoute['respond']): StubRoute => ({
    match: (request) => request.method === 'POST' && new URL(request.url).pathname === BATCH_PATH,
    respond,
  });

  const failureItem = (index: number, message = '상태가 맞지 않습니다') => ({
    index,
    errors: [{ scope: 'field', field: '문자열', code: 'STANDARD', message }],
  });

  /**
   * 디자인 시스템은 행 체크박스의 접근 이름을 모든 행에 같게 붙인다 —
   * 이름으로 특정할 수 없어 **순서**로 찾는다.
   */
  const selectRow = async (user: ReturnType<typeof userEvent.setup>, index: number) => {
    const boxes = await screen.findAllByRole('checkbox', { name: '행 선택' });
    await user.click(boxes[index] as HTMLElement);
  };

  const openBatch = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: '선택 일괄 재처리' }));
  };

  it('고르기 전에는 일괄 재처리가 잠기고 사유가 보인다', async () => {
    renderScreen([listRoute()], PERIOD);
    await screen.findByText('SAMPLE-KEY-0001');

    const button = screen.getByRole('button', { name: '선택 일괄 재처리' });
    expect(button).toBeDisabled();
    expect(screen.getByText('선택 0건')).toBeInTheDocument();

    const reasonId = button.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(reasonId)).toHaveTextContent(
      '선택 일괄 재처리는 목록에서 건을 고른 뒤에 쓸 수 있습니다.',
    );
  });

  it('고르면 건수가 맞고 버튼이 열린다', async () => {
    const { user } = renderScreen([listRoute()], PERIOD);
    await selectRow(user, 0);
    await selectRow(user, 2);

    expect(screen.getByText('선택 2건')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '선택 일괄 재처리' })).toBeEnabled();
  });

  it('확인하면 고른 식별자가 표에 보이는 순서 그대로 실린다', async () => {
    const { requests, user } = renderScreen(
      [listRoute(), batchRoute(() => jsonResponse({ succeeded: 2, failed: [] }))],
      PERIOD,
    );
    await selectRow(user, 2);
    await selectRow(user, 0);
    await openBatch(user);
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: '선택 일괄 재처리' }),
    );

    const request = requestsTo(requests, BATCH_PATH)[0];
    expect(JSON.parse(request?.body ?? '{}')).toEqual({ integrationMessageIds: [9001, 9003] });
    expect(request?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    expect(request?.headers.has('If-Match')).toBe(false);
  });

  it('전건 성공이면 창이 닫히고 안내가 뜨며 목록을 다시 조회한다', async () => {
    const { requests, user } = renderScreen(
      [listRoute(), batchRoute(() => jsonResponse({ succeeded: 1, failed: [] }))],
      PERIOD,
    );
    await selectRow(user, 0);
    const before = requestsTo(requests, LIST_PATH).length;
    await openBatch(user);
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: '선택 일괄 재처리' }),
    );

    expect(await screen.findByText('1건을 다시 보냈습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(before);
    });
  });

  it('부분 실패면 창이 닫히지 않고 건별 사유가 창 안에 나온다', async () => {
    const { requests, user } = renderScreen(
      [listRoute(), batchRoute(() => jsonResponse({ succeeded: 1, failed: [failureItem(1)] }))],
      PERIOD,
    );
    await selectRow(user, 0);
    await selectRow(user, 1);
    const before = requestsTo(requests, LIST_PATH).length;
    await openBatch(user);
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: '선택 일괄 재처리' }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('1건을 다시 보냈습니다. 1건은 보내지 못했습니다.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('SAMPLE-KEY-0002')).toBeInTheDocument();
    expect(within(dialog).getByText('상태가 맞지 않습니다')).toBeInTheDocument();
    // 부분 실패라도 목록은 달라졌다 — 다시 조회한다.
    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(before);
    });
  });

  it('전건 실패면 성공 안내가 나오지 않는다', async () => {
    const { user } = renderScreen(
      [listRoute(), batchRoute(() => jsonResponse({ succeeded: 0, failed: [failureItem(0)] }))],
      PERIOD,
    );
    await selectRow(user, 0);
    await openBatch(user);
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: '선택 일괄 재처리' }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByText(/다시 보냈습니다/)).not.toBeInTheDocument();
    expect(within(dialog).getByText('SAMPLE-KEY-0001')).toBeInTheDocument();
  });

  it('보낸 건수 밖의 위치 번호가 와도 그 항목이 사라지지 않는다', async () => {
    // 목 서버가 실제로 이렇게 내려준다 — 한 건만 보내도 index: 1이 온다.
    const { user } = renderScreen(
      [listRoute(), batchRoute(() => jsonResponse({ succeeded: 1, failed: [failureItem(1)] }))],
      PERIOD,
    );
    await selectRow(user, 0);
    await openBatch(user);
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: '선택 일괄 재처리' }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('어느 건인지 알 수 없습니다.')).toBeInTheDocument();
  });

  it('건별 사유가 비어 있으면 받지 못했다고 밝힌다', async () => {
    const { user } = renderScreen(
      [
        listRoute(),
        batchRoute(() => jsonResponse({ succeeded: 0, failed: [{ index: 0, errors: [] }] })),
      ],
      PERIOD,
    );
    await selectRow(user, 0);
    await openBatch(user);
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: '선택 일괄 재처리' }),
    );

    expect(
      within(await screen.findByRole('dialog')).getByText('사유를 받지 못했습니다.'),
    ).toBeInTheDocument();
  });

  it('요청 자체가 실패하면 창이 닫히지 않고 사유가 나온다', async () => {
    const { user } = renderScreen(
      [listRoute(), batchRoute(() => jsonResponse({ message: '' }, { status: 403 }))],
      PERIOD,
    );
    await selectRow(user, 0);
    await openBatch(user);
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: '선택 일괄 재처리' }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(
      await within(dialog).findByText(
        '이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.',
      ),
    ).toBeInTheDocument();
  });

  it('계약 형태가 아닌 422도 삼키지 않고 안내한다', async () => {
    const { user } = renderScreen(
      [
        listRoute(),
        batchRoute(() =>
          jsonResponse({ type: 'about:blank', title: 'Unprocessable Entity' }, { status: 422 }),
        ),
      ],
      PERIOD,
    );
    await selectRow(user, 0);
    await openBatch(user);
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: '선택 일괄 재처리' }),
    );

    expect(
      await within(screen.getByRole('dialog')).findByText(
        '잠시 뒤 다시 시도하세요. 반복되면 담당자에게 알려 주세요.',
      ),
    ).toBeInTheDocument();
  });

  it('조건을 바꾸면 선택이 비워진다 — 보이지 않는 건이 요청에 실리면 안 된다', async () => {
    const { user } = renderScreen([listRoute()], PERIOD);
    await selectRow(user, 0);
    expect(screen.getByText('선택 1건')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(screen.getByText('선택 0건')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '선택 일괄 재처리' })).toBeDisabled();
  });

  it('쪽을 옮기면 선택이 비워진다', async () => {
    const { user } = renderScreen(
      [listRoute(messageRowFixtures, { page: 1, size: 3, total: 10 })],
      PERIOD,
    );
    await selectRow(user, 0);
    expect(screen.getByText('선택 1건')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다음' }));

    expect(screen.getByText('선택 0건')).toBeInTheDocument();
  });
});

describe('IntegrationSyncScreen — 선택의 수명', () => {
  const PERIOD = '?from=2026-08-01&to=2026-08-06';
  const RETRY_PATH = `${LIST_PATH}/9001:retry`;

  const selectRow = async (user: ReturnType<typeof userEvent.setup>, index: number) => {
    const boxes = await screen.findAllByRole('checkbox', { name: '행 선택' });
    await user.click(boxes[index] as HTMLElement);
  };

  /** 조회할 때마다 다른 결과를 주는 목록. 재조회로 행이 달라지는 상황을 만든다. */
  const shrinkingListRoute = (): StubRoute => {
    let calls = 0;

    return {
      match: (request) => isGet(request, LIST_PATH),
      respond: () => {
        calls += 1;
        // 두 번째 조회부터 첫 행이 사라진다 — 워커가 그 사이에 처리했다는 뜻이다.
        const items = calls === 1 ? messageRowFixtures : messageRowFixtures.slice(1);

        return jsonResponse(listBody(items));
      },
    };
  };

  it('상세를 열고 닫아도 선택이 그대로다 — 보이는 행이 달라지지 않았다', async () => {
    const { user } = renderScreen(
      [
        listRoute(),
        {
          match: (request) => isGet(request, `${LIST_PATH}/9001`),
          respond: () => jsonResponse({ ...messageRowFixtures[0], payload: {} }),
        },
      ],
      PERIOD,
    );
    await selectRow(user, 0);
    expect(screen.getByText('선택 1건')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'SAMPLE-KEY-0002 상세 열기' }));
    await screen.findByRole('dialog');
    expect(screen.getByText('선택 1건')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '닫기' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('선택 1건')).toBeInTheDocument();
  });

  it('다시 조회하면 선택이 비워진다 — 행이 달라질 수 있다', async () => {
    const { user } = renderScreen(
      [
        listRoute(),
        {
          match: (request) =>
            request.method === 'POST' && new URL(request.url).pathname === RETRY_PATH,
          respond: () => jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 }),
        },
      ],
      PERIOD,
    );
    await selectRow(user, 1);
    expect(screen.getByText('선택 1건')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'SAMPLE-KEY-0001 재처리' }));
    await user.click(await screen.findByRole('button', { name: '재처리' }));
    await user.click(await screen.findByRole('button', { name: '다시 조회' }));

    expect(screen.getByText('선택 0건')).toBeInTheDocument();
  });

  it('목록이 갱신돼 고른 행이 사라지면 선택에서도 빠진다', async () => {
    const { user } = renderScreen(
      [
        shrinkingListRoute(),
        {
          match: (request) =>
            request.method === 'POST' && new URL(request.url).pathname === RETRY_PATH,
          respond: () => jsonResponse(messageRowFixtures[0]),
        },
      ],
      PERIOD,
    );

    await user.click(await screen.findByRole('checkbox', { name: '전체 선택' }));
    expect(screen.getByText('선택 3건')).toBeInTheDocument();

    // 재처리에 성공하면 목록을 다시 조회한다. 그 결과에서 9001이 사라진다.
    await user.click(screen.getByRole('button', { name: 'SAMPLE-KEY-0001 재처리' }));
    await user.click(await screen.findByRole('button', { name: '재처리' }));

    // 남은 두 건만 선택으로 남는다 — 보이지 않는 건이 일괄 요청에 실리면 안 된다.
    expect(await screen.findByText('선택 2건')).toBeInTheDocument();
  });
});

describe('IntegrationSyncScreen — 선택칸 폭', () => {
  const PERIOD = '?from=2026-08-01&to=2026-08-06';

  it('코드값을 고르는 네 칸이 넓은 선택칸으로 표시된다', async () => {
    /*
     * 디자인 시스템 선택 목록은 트리거 상자에 못 박혀 있어(left:0; right:0) 값이 길면 잘린다.
     * 바깥 칸에 최소 폭을 주는 것이 지금의 우회이고, 그 표시가 떨어지면 다시 잘린다.
     * jsdom 은 폭을 재지 못하므로 **표시가 붙어 있는지**를 고정한다.
     */
    renderScreen([listRoute()], PERIOD);
    await screen.findByText('SAMPLE-KEY-0001');

    for (const label of ['상태', '연계 종류', '방향', '대상 유형']) {
      expect(screen.getByLabelText(label).closest('.field-cell')).toHaveClass('wide-select');
    }
  });

  it('값이 짧은 칸에는 넓은 선택칸을 붙이지 않는다 — 필요 없는 자리까지 넓어진다', async () => {
    renderScreen([listRoute()], PERIOD);
    await screen.findByText('SAMPLE-KEY-0001');

    expect(screen.getByLabelText('시도 횟수 하한').closest('.field-cell')).not.toHaveClass(
      'wide-select',
    );
  });
});
