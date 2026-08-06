import { screen, within } from '@testing-library/react';
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
  it('여섯 열과 응답 건수만큼의 행이 나온다', async () => {
    renderScreen([listRoute()]);

    expect(await screen.findByText('SAMPLE-KEY-0001')).toBeInTheDocument();

    const table = screen.getByRole('table');
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);

    expect(headers).toEqual(['메시지 키', '연계 종류', '상태', '시도', '생성', '마지막 오류']);
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
