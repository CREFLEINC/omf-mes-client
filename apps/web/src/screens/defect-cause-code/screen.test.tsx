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
import { causeCodeFixtures, defectCodeFixtures } from './fixtures';
import { DefectCauseCodeScreen } from './screen';
import { CODE_TABS } from './tabs';

const ROUTE = '/master-data/defect-cause-code';

const DEFECT_LIST_PATH = '/quality/defect-codes';
const CAUSE_LIST_PATH = '/quality/cause-codes';

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

const defectListRoute = (items: unknown[] = defectCodeFixtures, total?: number): StubRoute => ({
  match: (request) => isGet(request, DEFECT_LIST_PATH),
  respond: () => jsonResponse(listBody(items, total ?? items.length)),
});

const causeListRoute = (items: unknown[] = causeCodeFixtures): StubRoute => ({
  match: (request) => isGet(request, CAUSE_LIST_PATH),
  respond: () => jsonResponse(listBody(items)),
});

/** 주소가 실제로 어떻게 바뀌는지 본다 — 탭 전환이 조건을 지우는지 판정할 유일한 근거다. */
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
      <DefectCauseCodeScreen />
      <LocationProbe />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, user: userEvent.setup() };
};

const requestsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === pathname);

const currentLocation = (): string => screen.getByTestId('location').textContent ?? '';

describe('DefectCauseCodeScreen — 목록 조회', () => {
  it('화면에 들어오면 선택을 기다리지 않고 목록을 조회한다', async () => {
    const { requests } = renderScreen([defectListRoute()]);

    expect(await screen.findByRole('button', { name: 'DF-10' })).toBeInTheDocument();
    expect(requestsTo(requests, DEFECT_LIST_PATH)).toHaveLength(1);
  });

  it('조건이 없으면 q·includeInactive를 요청에 싣지 않는다', async () => {
    const { requests } = renderScreen([defectListRoute()]);
    await screen.findByRole('button', { name: 'DF-10' });

    const first = requestsTo(requests, DEFECT_LIST_PATH)[0];
    expect(first?.url.searchParams.has('q')).toBe(false);
    expect(first?.url.searchParams.has('includeInactive')).toBe(false);
  });

  it('조건을 적용하면 요청 쿼리와 주소에 함께 실린다', async () => {
    const { requests, user } = renderScreen([defectListRoute()]);
    await screen.findByRole('button', { name: 'DF-10' });

    await user.click(screen.getByRole('checkbox', { name: '미사용 포함' }));
    await user.type(screen.getByLabelText('불량코드 검색'), 'DF-1');
    await user.click(screen.getByRole('button', { name: '조회' }));

    const last = requestsTo(requests, DEFECT_LIST_PATH).at(-1);
    expect(last?.url.searchParams.get('q')).toBe('DF-1');
    expect(last?.url.searchParams.get('includeInactive')).toBe('true');
    expect(currentLocation()).toContain('q=DF-1');
    expect(currentLocation()).toContain('inactive=1');
  });

  it('주소에 있던 조건이 첫 조회에 그대로 실린다 — 새로고침·공유가 같은 결과를 낸다', async () => {
    const { requests } = renderScreen([defectListRoute()], '?q=DF&inactive=1');
    await screen.findByRole('button', { name: 'DF-10' });

    const first = requestsTo(requests, DEFECT_LIST_PATH)[0];
    expect(first?.url.searchParams.get('q')).toBe('DF');
    expect(first?.url.searchParams.get('includeInactive')).toBe('true');
  });

  it('전체 건수가 받은 건수보다 많으면 잘림 안내를 낸다', async () => {
    renderScreen([defectListRoute(defectCodeFixtures, 120)]);

    expect(
      await screen.findByText('전체 120건 중 7건을 표시합니다. 조건을 좁혀 조회하세요.'),
    ).toBeInTheDocument();
  });

  it('전부 받았으면 잘림 안내를 내지 않는다', async () => {
    renderScreen([defectListRoute()]);
    await screen.findByRole('button', { name: 'DF-10' });

    expect(screen.queryByText(/전체 .*건을 표시합니다/)).not.toBeInTheDocument();
  });

  it('조회에 실패하면 표와 빈 상태 대신 오류 배너와 다시 시도가 뜬다', async () => {
    renderScreen([
      {
        match: (request) => isGet(request, DEFECT_LIST_PATH),
        respond: () => jsonResponse({ message: '' }, { status: 500 }),
      },
    ]);

    expect(await screen.findByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // 서버가 빈 message를 줘도 배너에 제목만 남으면 안 된다 — 무엇을 하라는 안내가 사라진다.
    expect(
      screen.getByText('잠시 뒤 다시 시도하세요. 반복되면 담당자에게 알려 주세요.'),
    ).toBeInTheDocument();
  });

  it('다시 시도를 누르면 목록 요청이 한 번 더 나간다', async () => {
    const { requests, user } = renderScreen([
      {
        match: (request) => isGet(request, DEFECT_LIST_PATH),
        respond: () => jsonResponse({ message: '' }, { status: 500 }),
      },
    ]);

    await user.click(await screen.findByRole('button', { name: '다시 시도' }));

    expect(requestsTo(requests, DEFECT_LIST_PATH).length).toBeGreaterThan(1);
  });

  it('0건이면 조건 유무에 따라 다른 빈 상태를 낸다', async () => {
    renderScreen([defectListRoute([])]);

    expect(await screen.findByText('아직 등록된 코드가 없습니다')).toBeInTheDocument();
  });

  it('조건이 걸린 0건은 조건을 고치라고 안내한다', async () => {
    renderScreen([defectListRoute([])], '?q=ZZ');

    expect(await screen.findByText('조건에 맞는 결과가 없습니다')).toBeInTheDocument();
  });
});

describe('DefectCauseCodeScreen — 2계층 표시', () => {
  it('대분류마다 그룹 머리글이 나오고 그 아래 첫 행이 대분류 자신이다', async () => {
    renderScreen([defectListRoute()]);

    expect(await screen.findByText('DF-10 · 외관')).toBeInTheDocument();

    const codes = screen
      .getAllByRole('button')
      .map((element) => element.textContent ?? '')
      .filter((text) => text.startsWith('DF-'));
    expect(codes).toEqual(['DF-10', 'DF-11', 'DF-12', 'DF-20', 'DF-21', 'DF-90', 'DF-91']);
  });

  it('자기참조 행은 대분류로 보인다 — 목 서버가 실제로 내려주는 모양이다', async () => {
    renderScreen([defectListRoute()]);

    expect(await screen.findByText('DF-20 · 치수')).toBeInTheDocument();
  });

  it('고아 행은 별도 그룹으로 나오고 사라지지 않는다', async () => {
    renderScreen([defectListRoute()]);

    expect(await screen.findByText('상위를 찾을 수 없는 코드')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'DF-91' })).toBeInTheDocument();
  });

  it('코드를 고르면 주소에 sel이 남는다', async () => {
    const { user } = renderScreen([defectListRoute()]);

    await user.click(await screen.findByRole('button', { name: 'DF-11' }));

    expect(currentLocation()).toContain('sel=1002');
    expect(screen.getByRole('button', { name: 'DF-11' })).toHaveAttribute('aria-current', 'true');
  });

  it('고르기 전에는 우측이 선택 안내를 낸다', async () => {
    renderScreen([defectListRoute()]);
    await screen.findByRole('button', { name: 'DF-10' });

    expect(
      screen.getByText('왼쪽에서 코드를 고르거나 「대분류 추가」로 시작하세요'),
    ).toBeInTheDocument();
  });
});

describe('DefectCauseCodeScreen — 탭', () => {
  it('탭을 바꾸면 다른 리소스의 목록을 조회한다', async () => {
    const { requests, user } = renderScreen([defectListRoute(), causeListRoute()]);
    await screen.findByRole('button', { name: 'DF-10' });

    await user.click(screen.getByRole('tab', { name: '원인코드' }));

    expect(await screen.findByRole('button', { name: 'CS-10' })).toBeInTheDocument();
    expect(requestsTo(requests, CAUSE_LIST_PATH)).toHaveLength(1);
  });

  /*
   * 한쪽 탭의 코드 번호가 남으면 다른 탭에는 없는 리소스의 상세를 조회하게 된다.
   * 조회 조건도 함께 지워 규칙을 하나로 둔다 — 「탭이 바뀌면 그 탭의 처음 상태로 간다」.
   */
  it('탭을 바꾸면 q·inactive·sel·mode가 주소에서 지워진다', async () => {
    const { requests, user } = renderScreen(
      [defectListRoute(), causeListRoute()],
      '?q=DF&inactive=1&sel=1001&mode=create',
    );
    await screen.findByRole('tab', { name: '원인코드' });

    await user.click(screen.getByRole('tab', { name: '원인코드' }));
    await screen.findByRole('button', { name: 'CS-10' });

    expect(currentLocation()).toBe(`${ROUTE}?tab=cause`);

    const causeRequest = requestsTo(requests, CAUSE_LIST_PATH)[0];
    expect(causeRequest?.url.searchParams.has('q')).toBe(false);
    expect(causeRequest?.url.searchParams.has('includeInactive')).toBe(false);
  });

  it('모르는 탭 값이면 첫 탭으로 떨어진다', async () => {
    const { requests } = renderScreen([defectListRoute()], '?tab=xyz');

    expect(await screen.findByRole('button', { name: 'DF-10' })).toBeInTheDocument();
    expect(requestsTo(requests, DEFECT_LIST_PATH)).toHaveLength(1);
  });

  it('비활성 탭의 표는 화면에 남지 않는다', async () => {
    const { user } = renderScreen([defectListRoute(), causeListRoute()]);
    await screen.findByRole('button', { name: 'DF-10' });

    await user.click(screen.getByRole('tab', { name: '원인코드' }));
    await screen.findByRole('button', { name: 'CS-10' });

    expect(screen.queryByText('DF-10 · 외관')).not.toBeInTheDocument();
  });
});

/*
 * 탭 정의 배열을 순회한다 — 탭이 셋으로 늘면 이 테스트도 함께 는다.
 * 탭마다 경로·필드 이름이 다르므로 어댑터별 응답을 만들어 준다.
 */
describe.each(CODE_TABS.map((definition) => [definition.adapter.labels.tab, definition] as const))(
  'DefectCauseCodeScreen — %s 탭',
  (_label, definition) => {
    const listPath = definition.kind === 'defect' ? DEFECT_LIST_PATH : CAUSE_LIST_PATH;
    const fixtures = definition.kind === 'defect' ? defectCodeFixtures : causeCodeFixtures;
    const firstCode = definition.kind === 'defect' ? 'DF-10' : 'CS-10';
    const groupHeader = definition.kind === 'defect' ? 'DF-10 · 외관' : 'CS-10 · 설비';

    const routes: StubRoute[] = [
      {
        match: (request) => isGet(request, listPath),
        respond: () => jsonResponse(listBody(fixtures)),
      },
    ];

    it('진입 즉시 그 탭의 목록을 조회하고 대분류로 묶어 그린다', async () => {
      const { requests } = renderScreen(routes, `?tab=${definition.kind}`);

      expect(await screen.findByRole('button', { name: firstCode })).toBeInTheDocument();
      expect(screen.getByText(groupHeader)).toBeInTheDocument();
      expect(requestsTo(requests, listPath)).toHaveLength(1);
    });

    it('조건이 그 탭의 요청 쿼리에 실린다', async () => {
      const { requests, user } = renderScreen(routes, `?tab=${definition.kind}`);
      await screen.findByRole('button', { name: firstCode });

      await user.type(screen.getByLabelText(definition.adapter.labels.searchLabel), 'X');
      await user.click(screen.getByRole('button', { name: '조회' }));

      expect(requestsTo(requests, listPath).at(-1)?.url.searchParams.get('q')).toBe('X');
    });

    it('탭 안의 목록 페인에 그 탭의 이름이 붙는다', async () => {
      renderScreen(routes, `?tab=${definition.kind}`);
      await screen.findByRole('button', { name: firstCode });

      const pane = screen.getByRole('region', { name: definition.adapter.labels.tab });
      expect(within(pane).getByRole('button', { name: firstCode })).toBeInTheDocument();
    });
  },
);
