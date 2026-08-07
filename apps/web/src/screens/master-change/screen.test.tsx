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
import { auditEventFixtures } from './fixtures';
import { MasterChangeScreen } from './screen';

const ROUTE = '/master-data/master-change';
const LIST_PATH = '/audit/events';

interface RecordedRequest {
  method: string;
  url: URL;
}

/** 요청을 기록하면서 스텁 규칙으로 응답한다. 규칙에 없는 요청은 하네스가 던져 스텁 누락을 드러낸다. */
const createRecordingFetch = (
  routes: StubRoute[],
): { fetch: StubFetch; requests: RecordedRequest[] } => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch(routes);

  const fetch: StubFetch = async (request) => {
    requests.push({ method: request.method, url: new URL(request.url) });

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
  items: unknown[] = auditEventFixtures,
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
      <MasterChangeScreen />
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

describe('MasterChangeScreen — 기간 필수 조회', () => {
  it('화면에 들어오면 기본 기간이 주소에 채워지고 목록을 조회한다', async () => {
    const { requests } = renderScreen([listRoute()]);

    expect(await screen.findByText('SAMPLE_EVENT_A')).toBeInTheDocument();

    const location = currentLocation();
    expect(location).toContain(`to=${todayText()}`);
    expect(new URLSearchParams(location.split('?')[1]).get('from')).toMatch(DATE_PATTERN);
    expect(requestsTo(requests, LIST_PATH)).toHaveLength(1);
  });

  it('기본 기간은 오늘을 포함해 7일이다', async () => {
    renderScreen([listRoute()]);
    await screen.findByText('SAMPLE_EVENT_A');

    const params = new URLSearchParams(currentLocation().split('?')[1]);
    const from = new Date(`${params.get('from') ?? ''}T00:00:00`);
    const to = new Date(`${params.get('to') ?? ''}T00:00:00`);
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);

    expect(days).toBe(6);
  });

  it('요청에 기간 두 개가 초와 시간대까지 갖춘 형식으로 실린다', async () => {
    const { requests } = renderScreen([listRoute()], '?from=2026-08-01&to=2026-08-06');
    await screen.findByText('SAMPLE_EVENT_A');

    const first = requestsTo(requests, LIST_PATH)[0];
    expect(first?.url.searchParams.get('occurredFrom')).toMatch(
      /^2026-08-01T00:00:00[+-]\d{2}:\d{2}$/,
    );
    // 종료가 그날 00:00:00이면 마지막 날에 생긴 이력이 통째로 빠진다.
    expect(first?.url.searchParams.get('occurredTo')).toMatch(
      /^2026-08-06T23:59:59[+-]\d{2}:\d{2}$/,
    );
  });

  it('주소에 있던 기간이 첫 조회에 그대로 실린다 — 새로고침·공유가 같은 결과를 낸다', async () => {
    const { requests } = renderScreen([listRoute()], '?from=2026-07-01&to=2026-07-31');
    await screen.findByText('SAMPLE_EVENT_A');

    expect(requestsTo(requests, LIST_PATH)).toHaveLength(1);
    expect(requestsTo(requests, LIST_PATH)[0]?.url.searchParams.get('occurredFrom')).toContain(
      '2026-07-01',
    );
  });

  it('조회를 누르면 고친 기간이 주소와 요청에 함께 실린다', async () => {
    const { requests, user } = renderScreen([listRoute()], '?from=2026-08-01&to=2026-08-06');
    await screen.findByText('SAMPLE_EVENT_A');

    await user.clear(screen.getByLabelText('기간 시작'));
    await user.type(screen.getByLabelText('기간 시작'), '2026-07-20');
    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(currentLocation()).toContain('from=2026-07-20');
    expect(requestsTo(requests, LIST_PATH).at(-1)?.url.searchParams.get('occurredFrom')).toContain(
      '2026-07-20',
    );
  });

  /* 버튼의 비활성만 보면 못 잡는다 — 요청 횟수까지 단언해야 「보내기 전에 막는다」가 지켜진다. */
  it('기간이 비면 조회가 잠기고 요청이 더 나가지 않는다', async () => {
    const { requests, user } = renderScreen([listRoute()], '?from=2026-08-01&to=2026-08-06');
    await screen.findByText('SAMPLE_EVENT_A');

    await user.clear(screen.getByLabelText('기간 시작'));

    const searchButton = screen.getByRole('button', { name: '조회' });
    expect(searchButton).toBeDisabled();
    expect(requestsTo(requests, LIST_PATH)).toHaveLength(1);
  });

  it('주소의 기간이 비어 있으면 조회하지 않고 기간을 고르라고 안내한다', async () => {
    const { requests } = renderScreen([listRoute()], '?from=&to=');

    expect(await screen.findByText('기간을 고르고 조회하세요')).toBeInTheDocument();
    expect(requestsTo(requests, LIST_PATH)).toHaveLength(0);
  });

  it('초기화를 누르면 기간이 기본값으로 되돌아간다', async () => {
    const { user } = renderScreen([listRoute()], '?from=2026-01-01&to=2026-01-02');
    await screen.findByText('SAMPLE_EVENT_A');

    await user.click(screen.getByRole('button', { name: '초기화' }));

    expect(currentLocation()).toContain(`to=${todayText()}`);
  });
});

describe('MasterChangeScreen — 목록 표시', () => {
  it('다섯 열과 응답 건수만큼의 행이 나온다', async () => {
    renderScreen([listRoute()]);

    expect(await screen.findByText('SAMPLE_EVENT_A')).toBeInTheDocument();

    const table = screen.getByRole('table');
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);

    expect(headers).toEqual(['발생 시각', '대상 종류', '대상', '사건 종류', '수행자']);
    expect(within(table).getAllByRole('row')).toHaveLength(auditEventFixtures.length + 1);
  });

  it('머리글에 정렬 버튼이 없다 — 계약에 정렬 파라미터가 없어 쪽 안에서만 정렬된다', async () => {
    renderScreen([listRoute()]);
    await screen.findByText('SAMPLE_EVENT_A');

    const table = screen.getByRole('table');
    for (const header of within(table).getAllByRole('columnheader')) {
      expect(within(header).queryByRole('button')).not.toBeInTheDocument();
    }
  });

  it('선택 열이 없다 — 일괄로 할 쓰기가 하나도 없다', async () => {
    renderScreen([listRoute()]);
    await screen.findByText('SAMPLE_EVENT_A');

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('0건이면 빈 상태가 나오고 표의 행이 없다', async () => {
    renderScreen([listRoute([])]);

    expect(await screen.findByText('조건에 맞는 변경 이력이 없습니다')).toBeInTheDocument();
  });
});

describe('MasterChangeScreen — 조회 실패', () => {
  it('실패하면 배너와 다시 시도가 나오고 표도 빈 상태도 나오지 않는다', async () => {
    renderScreen([failingListRoute(500)]);

    expect(await screen.findByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('조건에 맞는 변경 이력이 없습니다')).not.toBeInTheDocument();
  });

  /* 서버가 빈 message를 주는 일이 실제로 있다. 그대로 쓰면 배너 본문이 빈다. */
  it('서버 문구가 비어 있으면 기본 안내가 나온다', async () => {
    renderScreen([failingListRoute(500, { message: '' })]);

    expect(
      await screen.findByText('잠시 뒤 다시 시도하세요. 반복되면 담당자에게 알려 주세요.'),
    ).toBeInTheDocument();
  });

  /* 이력 조회 권한은 편집 권한과 별개다. 계약이 「진입 차단 + 배너」로 정했다. */
  it('권한이 없으면 권한 안내 배너만 나오고 표도 빈 상태도 나오지 않는다', async () => {
    renderScreen([failingListRoute(403, { message: '' })]);

    expect(
      await screen.findByText(
        '이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('조건에 맞는 변경 이력이 없습니다')).not.toBeInTheDocument();
  });

  it('다시 시도를 누르면 같은 조건으로 한 번 더 조회한다', async () => {
    const { requests, user } = renderScreen(
      [failingListRoute(500)],
      '?from=2026-08-01&to=2026-08-06',
    );
    await screen.findByText('목록을 불러오지 못했습니다');

    expect(requestsTo(requests, LIST_PATH)).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(1);
  });
});
