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

/**
 * 상위 선택지·계층 판정 전용 목록. 화면이 `includeInactive=true`로 따로 조회하므로
 * 목록 규칙보다 **먼저** 등록해야 이 규칙이 잡는다.
 */
const defectOptionsRoute = (items: unknown[] = defectCodeFixtures, total?: number): StubRoute => ({
  match: (request) =>
    isGet(request, DEFECT_LIST_PATH) &&
    new URL(request.url).searchParams.get('includeInactive') === 'true',
  respond: () => jsonResponse(listBody(items, total ?? items.length)),
});

/** 기본 조회는 사용 중인 것만 내려준다 — 미사용 대분류가 선택지에만 있는 상황을 만든다. */
const activeDefectFixtures = defectCodeFixtures.filter((item) => item.isActive);

const defectCreateRoute = (respond: StubRoute['respond']): StubRoute => ({
  match: (request) =>
    request.method === 'POST' && new URL(request.url).pathname === DEFECT_LIST_PATH,
  respond,
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

const CREATED_DEFECT = {
  defectCodeId: 1100,
  defectCode: 'DF-30',
  defectName: '신규',
  parentDefectCodeId: null,
  isActive: true,
};

/** 등록 흐름의 기본 스텁 — 선택지 규칙을 목록 규칙보다 먼저 둔다. */
const createFlowRoutes = (post: StubRoute): StubRoute[] => [
  defectOptionsRoute(),
  defectListRoute(activeDefectFixtures),
  post,
];

describe('DefectCauseCodeScreen — 등록 폼 열기', () => {
  it('대분류 추가를 누르면 상위가 빈 폼과 경고·안내가 함께 열린다', async () => {
    const { user } = renderScreen([defectOptionsRoute(), defectListRoute(activeDefectFixtures)]);
    await screen.findByRole('button', { name: 'DF-10' });

    await user.click(screen.getByRole('button', { name: '대분류 추가' }));

    expect(screen.getByLabelText('코드')).toHaveValue('');
    expect(
      screen.getByText(
        '대분류는 전사에서 공통으로 쓰는 축입니다. 추가하면 모든 현장에서 함께 쓰이므로 신중히 정하세요.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('대분류 목록은 아직 임시입니다. 확정되면 이 항목의 선택지가 바뀔 수 있습니다.'),
    ).toBeInTheDocument();
  });

  it('폼을 열 때 상위 선택지를 미사용까지 포함해 따로 조회한다', async () => {
    const { requests, user } = renderScreen([
      defectOptionsRoute(),
      defectListRoute(activeDefectFixtures),
    ]);
    await screen.findByRole('button', { name: 'DF-10' });

    expect(
      requests.some((request) => request.url.searchParams.get('includeInactive') === 'true'),
    ).toBe(false);

    await user.click(screen.getByRole('button', { name: '대분류 추가' }));
    await screen.findByLabelText('코드');

    expect(
      requests.some((request) => request.url.searchParams.get('includeInactive') === 'true'),
    ).toBe(true);
  });

  it('상세 추가는 대분류를 고르기 전에는 비활성이고 사유가 보인다', async () => {
    renderScreen([defectListRoute(activeDefectFixtures)]);
    await screen.findByRole('button', { name: 'DF-10' });

    expect(screen.getByRole('button', { name: '상세 추가' })).toBeDisabled();
    expect(
      screen.getByText('상세 추가는 대분류를 하나 고른 뒤에 쓸 수 있습니다.'),
    ).toBeInTheDocument();
  });

  it('상세 코드를 고르면 상세 추가를 쓸 수 없다 — 3계층이 된다', async () => {
    renderScreen([defectListRoute(activeDefectFixtures)], '?sel=1002');
    await screen.findByRole('button', { name: 'DF-11' });

    expect(screen.getByRole('button', { name: '상세 추가' })).toBeDisabled();
  });

  it('대분류를 고른 뒤 상세 추가를 누르면 상위가 그 대분류로 채워진 폼이 열린다', async () => {
    const { user } = renderScreen(
      [defectOptionsRoute(), defectListRoute(activeDefectFixtures)],
      '?sel=1001',
    );
    await screen.findByRole('button', { name: 'DF-10' });

    await user.click(screen.getByRole('button', { name: '상세 추가' }));

    const parent = await screen.findByRole('combobox', { name: '상위 대분류' });
    await waitFor(() => {
      expect(parent).toHaveTextContent('DF-10 · 외관');
    });
    expect(screen.queryByText(/대분류는 전사에서 공통으로 쓰는 축입니다/)).not.toBeInTheDocument();
  });
});

describe('DefectCauseCodeScreen — 상위 선택지', () => {
  it('선택지에 대분류만 들어간다 — 상세 코드는 상위가 될 수 없다', async () => {
    const { user } = renderScreen(
      [defectOptionsRoute(), defectListRoute(activeDefectFixtures)],
      '?mode=create',
    );
    await screen.findByLabelText('코드');

    await user.click(screen.getByRole('combobox', { name: '상위 대분류' }));

    expect(screen.getByRole('option', { name: 'DF-10 · 외관' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'DF-20 · 치수' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /DF-11/ })).not.toBeInTheDocument();
  });

  it('미사용 대분류는 기본으로 빠진다', async () => {
    const { user } = renderScreen(
      [defectOptionsRoute(), defectListRoute(activeDefectFixtures)],
      '?mode=create',
    );
    await screen.findByLabelText('코드');

    await user.click(screen.getByRole('combobox', { name: '상위 대분류' }));

    expect(screen.queryByRole('option', { name: /DF-90/ })).not.toBeInTheDocument();
  });

  /* 빼 버리면 선택칸이 비어 보여 사용자가 값이 사라진 줄 안다. */
  it('지금 상위로 지정된 미사용 대분류는 표식과 함께 남는다', async () => {
    renderScreen(
      [defectOptionsRoute(), defectListRoute()],
      '?inactive=1&sel=1006&mode=create',
    );

    // 선택지가 도착하기 전에는 번호만 보인다 — 라벨이 붙는 것까지 기다린다.
    expect(await screen.findByText('DF-90 · 사용하지 않는 축 (미사용)')).toBeInTheDocument();
  });

  it('선택지 목록이 잘리면 경고가 보인다', async () => {
    renderScreen(
      [defectOptionsRoute(defectCodeFixtures, 500), defectListRoute(activeDefectFixtures)],
      '?mode=create',
    );

    expect(
      await screen.findByText('선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.'),
    ).toBeInTheDocument();
  });

  it('선택지 조회가 실패하면 그 사실을 폼 위에 낸다', async () => {
    renderScreen(
      [
        {
          match: (request) =>
            isGet(request, DEFECT_LIST_PATH) &&
            new URL(request.url).searchParams.get('includeInactive') === 'true',
          respond: () => jsonResponse({ message: '' }, { status: 500 }),
        },
        defectListRoute(activeDefectFixtures),
      ],
      '?mode=create',
    );

    expect(
      await screen.findByText('선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.'),
    ).toBeInTheDocument();
  });
});

describe('DefectCauseCodeScreen — 등록 저장', () => {
  it('저장하면 UUID 멱등 키를 실은 POST가 나가고 본문에 공정 번호가 없다', async () => {
    const { requests, user } = renderScreen(
      createFlowRoutes(defectCreateRoute(() => jsonResponse(CREATED_DEFECT, { status: 201 }))),
      '?mode=create',
    );

    await user.type(await screen.findByLabelText('코드'), 'DF-30');
    await user.type(screen.getByLabelText('명칭'), '신규');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByText('등록했습니다')).toBeInTheDocument();

    const post = requests.find((request) => request.method === 'POST');
    expect(post?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    // 등록에는 낙관적 잠금이 없다 — 계약에 If-Match가 없다.
    expect(post?.headers.get('If-Match')).toBeNull();

    const body: unknown = JSON.parse(post?.body ?? '{}');
    expect(body).toEqual({ defectCode: 'DF-30', defectName: '신규' });
  });

  it('상세로 등록하면 상위 번호가 본문에 실린다', async () => {
    const { requests, user } = renderScreen(
      createFlowRoutes(
        defectCreateRoute(() =>
          jsonResponse({ ...CREATED_DEFECT, parentDefectCodeId: 1001 }, { status: 201 }),
        ),
      ),
      '?sel=1001&mode=create',
    );

    await user.type(await screen.findByLabelText('코드'), 'DF-13');
    await user.type(screen.getByLabelText('명칭'), '눌림');
    await user.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('등록했습니다');

    const post = requests.find((request) => request.method === 'POST');
    expect(JSON.parse(post?.body ?? '{}')).toMatchObject({ parentDefectCodeId: 1001 });
  });

  it('등록에 성공하면 목록을 다시 조회하고 폼이 비워진다', async () => {
    const { requests, user } = renderScreen(
      createFlowRoutes(defectCreateRoute(() => jsonResponse(CREATED_DEFECT, { status: 201 }))),
      '?mode=create',
    );

    await user.type(await screen.findByLabelText('코드'), 'DF-30');
    await user.type(screen.getByLabelText('명칭'), '신규');

    const before = requests.filter((request) => request.method === 'GET').length;
    await user.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('등록했습니다');

    expect(requests.filter((request) => request.method === 'GET').length).toBeGreaterThan(before);
    expect(screen.getByLabelText('코드')).toHaveValue('');
    expect(screen.getByLabelText('명칭')).toHaveValue('');
  });

  it('코드·명칭이 공백만이면 요청을 보내지 않고 인라인 오류만 보인다', async () => {
    const { requests, user } = renderScreen(
      createFlowRoutes(defectCreateRoute(() => jsonResponse(CREATED_DEFECT, { status: 201 }))),
      '?mode=create',
    );

    await user.type(await screen.findByLabelText('코드'), '   ');
    await user.type(screen.getByLabelText('명칭'), '  ');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(screen.getByText('코드는 공백만으로 지정할 수 없습니다.')).toBeInTheDocument();
    expect(screen.getByText('필수 입력 항목입니다.')).toBeInTheDocument();
    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(0);
  });

  it('서버가 준 필드 오류는 입력칸 옆에, 화면이 모르는 이름은 배너로 간다', async () => {
    const { user } = renderScreen(
      createFlowRoutes(
        defectCreateRoute(() =>
          jsonResponse(
            {
              errors: [
                {
                  scope: 'field',
                  field: 'defectCode',
                  code: 'DUPLICATED',
                  message: '이미 사용 중인 코드입니다.',
                },
                {
                  scope: 'field',
                  field: '문자열',
                  code: 'STANDARD',
                  message: '화면이 모르는 필드의 오류입니다.',
                },
              ],
            },
            { status: 400 },
          ),
        ),
      ),
      '?mode=create',
    );

    await user.type(await screen.findByLabelText('코드'), 'DF-30');
    await user.type(screen.getByLabelText('명칭'), '신규');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByText('이미 사용 중인 코드입니다.')).toBeInTheDocument();
    expect(screen.getByText('화면이 모르는 필드의 오류입니다.')).toBeInTheDocument();
  });

  it('입력칸을 고치면 그 칸의 서버 오류가 사라진다', async () => {
    const { user } = renderScreen(
      createFlowRoutes(
        defectCreateRoute(() =>
          jsonResponse(
            {
              errors: [
                {
                  scope: 'field',
                  field: 'defectCode',
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

    await user.type(await screen.findByLabelText('코드'), 'DF-30');
    await user.type(screen.getByLabelText('명칭'), '신규');
    await user.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('이미 사용 중인 코드입니다.');

    await user.type(screen.getByLabelText('코드'), '1');

    expect(screen.queryByText('이미 사용 중인 코드입니다.')).not.toBeInTheDocument();
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

    it('등록 요청이 그 탭의 경로와 필드 이름으로 나간다', async () => {
      const fields = definition.adapter.serverFields;
      const created: Record<string, unknown> = {
        [`${definition.kind}CodeId`]: 1100,
        [fields.code]: 'X-01',
        [fields.name]: '새 코드',
        [fields.parentId]: null,
        isActive: true,
      };

      const { requests, user } = renderScreen(
        [
          ...routes,
          {
            match: (request) =>
              request.method === 'POST' && new URL(request.url).pathname === listPath,
            respond: () => jsonResponse(created, { status: 201 }),
          },
        ],
        `?tab=${definition.kind}&mode=create`,
      );

      await user.type(await screen.findByLabelText('코드'), 'X-01');
      await user.type(screen.getByLabelText('명칭'), '새 코드');
      await user.click(screen.getByRole('button', { name: '저장' }));
      await screen.findByText('등록했습니다');

      const post = requests.find((request) => request.method === 'POST');
      expect(post?.url.pathname).toBe(listPath);
      expect(post?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
      expect(JSON.parse(post?.body ?? '{}')).toEqual({
        [fields.code]: 'X-01',
        [fields.name]: '새 코드',
      });
    });
  },
);
