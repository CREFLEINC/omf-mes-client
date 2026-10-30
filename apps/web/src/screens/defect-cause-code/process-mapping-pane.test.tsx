import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { HUB_ACTIONS_ID } from '../../patterns/hub-actions';
import { defectCodeFixtures } from './fixtures';
import { DefectCauseCodeScreen } from './screen';

/* 공정 매핑은 「품질 코드 관리」 탭 막대의 제 주소로 연다(#208). */
const ROUTE = '/master-data/defect-process-mapping';
const DEFECT_LIST_PATH = '/quality/defect-codes';
const PROCESS_LIST_PATH = '/mdm/processes';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const processFixtures = [
  {
    processId: 3001,
    processCode: 'OP-INJ',
    processName: '사출',
    processTypeCode: 'MACHINING',
    isActive: true,
  },
  {
    processId: 3002,
    processCode: 'OP-ASM',
    processName: '조립',
    processTypeCode: 'ASSEMBLY',
    isActive: true,
  },
];

interface RecordedRequest {
  method: string;
  url: URL;
  headers: Headers;
  body: string;
}

const listBody = (items: unknown[], total = items.length): unknown => ({
  items,
  page: { page: 1, size: 20, total },
});

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

const mappingPath = (defectCodeId: number): string =>
  `${DEFECT_LIST_PATH}/${String(defectCodeId)}/processes`;

const baseRoutes = (defectTotal = defectCodeFixtures.length): StubRoute[] => [
  {
    match: (request) =>
      request.method === 'GET' && new URL(request.url).pathname === DEFECT_LIST_PATH,
    respond: () => jsonResponse(listBody(defectCodeFixtures, defectTotal)),
  },
  {
    match: (request) =>
      request.method === 'GET' && new URL(request.url).pathname === PROCESS_LIST_PATH,
    respond: () => jsonResponse(listBody(processFixtures)),
  },
  ...[1002, 1003, 1005, 1007].map<StubRoute>((defectCodeId) => ({
    match: (request) =>
      request.method === 'GET' && new URL(request.url).pathname === mappingPath(defectCodeId),
    respond: () =>
      jsonResponse(
        listBody(
          defectCodeId === 1002
            ? [{ defectCodeId: 1002, processId: 3001, processName: '사출' }]
            : [],
        ),
      ),
  })),
];

const renderMapping = (extraRoutes: StubRoute[] = [], defectTotal?: number) => {
  const { fetch, requests } = createRecordingFetch([...extraRoutes, ...baseRoutes(defectTotal)]);
  renderWithProviders(<DefectCauseCodeScreen tab="mapping" />, { fetch, route: ROUTE });
  return { requests, user: userEvent.setup() };
};

describe('DefectCauseCodeScreen — 공정 매핑', () => {
  it('상세 불량코드와 사용 중인 공정을 매트릭스로 표시한다', async () => {
    const { requests } = renderMapping();

    /* 하위 탭은 셸 탭 막대(주소)로 고른다 — 화면 안에 탭 줄을 두지 않는다(#208). */
    expect(
      await screen.findByRole('region', { name: '공정별 상세 불량코드 매핑' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    // 열 머리는 공정명 위 · 공정코드 아래(#209).
    expect(await screen.findByRole('columnheader', { name: /사출\s*OP-INJ/ })).toBeInTheDocument();
    expect(screen.getByRole('grid', { name: '공정별 상세 불량코드 매핑' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: /DF-11 · 스크래치/ })).toBeInTheDocument();
    expect(screen.queryByRole('rowheader', { name: /DF-10 · 외관/ })).not.toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'DF-11 · 사출 · 매핑됨' })).toHaveAttribute(
      'data-status',
      'success',
    );
    expect(screen.getByRole('cell', { name: 'DF-12 · 조립 · 매핑 안 됨' })).not.toHaveAttribute(
      'data-status',
    );
    expect(requests.some((request) => request.url.pathname === '/quality/cause-codes')).toBe(false);
  });

  it('불량코드 · 공정 목록을 끝까지 받아 뒤쪽 쪽의 코드 · 공정도 표에 낸다(#209 버그 수정)', async () => {
    const lateDefect = {
      defectCodeId: 1010,
      defectCode: 'DF-19',
      defectName: '뒤쪽 코드',
      parentDefectCodeId: 1001,
      processId: null,
      isActive: true,
    };
    const lateProcess = {
      processId: 3009,
      processCode: 'OP-PKG',
      processName: '포장',
      processTypeCode: 'ASSEMBLY',
      isActive: true,
    };
    const paged = (pathname: string, first: unknown[], second: unknown[]): StubRoute => ({
      match: (request) => request.method === 'GET' && new URL(request.url).pathname === pathname,
      respond: (request) => {
        const page = Number(new URL(request.url).searchParams.get('page') ?? '1');
        const total = first.length + second.length;
        return jsonResponse({
          items: page === 1 ? first : second,
          page: { page, size: first.length, total },
        });
      },
    });
    const { requests } = renderMapping([
      paged(DEFECT_LIST_PATH, defectCodeFixtures, [lateDefect]),
      paged(PROCESS_LIST_PATH, processFixtures, [lateProcess]),
      {
        match: (request) =>
          request.method === 'GET' && new URL(request.url).pathname === mappingPath(1010),
        respond: () => jsonResponse(listBody([])),
      },
    ]);

    expect(await screen.findByRole('rowheader', { name: /DF-19 · 뒤쪽 코드/ })).toBeInTheDocument();
    expect(await screen.findByRole('columnheader', { name: /포장\s*OP-PKG/ })).toBeInTheDocument();
    expect(
      requests.some(
        (request) =>
          request.url.pathname === DEFECT_LIST_PATH && request.url.searchParams.get('page') === '2',
      ),
    ).toBe(true);
    expect(screen.queryByText(/일부만 표시되어/)).not.toBeInTheDocument();
  });

  it('조회 카드의 검색어로 행을 거르고, 초기화하면 모두 보인다(#209)', async () => {
    const { user } = renderMapping();
    await screen.findByRole('rowheader', { name: /DF-11 · 스크래치/ });

    // 검색 칸은 직접 입력하지 않고 불량코드 검색 창에서 골라 넣는다(사용자 지시 · #209).
    const field = screen.getByLabelText('불량코드 검색');
    expect(field).toHaveAttribute('readonly');
    await user.click(field);
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('검색어'), 'DF-12');
    await user.click(within(dialog).getByRole('button', { name: '검색' }));
    await user.click(await within(dialog).findByRole('checkbox', { name: 'DF-12' }));
    await user.click(within(dialog).getByRole('button', { name: '선택' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(field).toHaveValue('DF-12');

    await user.click(screen.getByRole('button', { name: '조회' }));
    expect(screen.queryByRole('rowheader', { name: /DF-11 · 스크래치/ })).not.toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: /DF-12/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '초기화' }));
    expect(screen.getByRole('rowheader', { name: /DF-11 · 스크래치/ })).toBeInTheDocument();
  });

  it('검색 창에서 대분류를 고르면 대분류 조건으로 걸린다(#209 버그 수정)', async () => {
    const { user } = renderMapping();
    await screen.findByRole('rowheader', { name: /DF-11 · 스크래치/ });

    await user.click(screen.getByLabelText('불량코드 검색'));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('검색어'), 'DF-20');
    await user.click(within(dialog).getByRole('button', { name: '검색' }));
    await user.click(await within(dialog).findByRole('checkbox', { name: 'DF-20' }));
    await user.click(within(dialog).getByRole('button', { name: '선택' }));

    expect(screen.getByLabelText('불량코드 검색')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: '조회' }));
    expect(screen.queryByRole('rowheader', { name: /DF-11 · 스크래치/ })).not.toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: /DF-21/ })).toBeInTheDocument();
  });

  it('대분류 · 공정 선택으로 행과 열을 거르고, 연결 상태는 칩으로 바로 거른다(#209)', async () => {
    const { user } = renderMapping();
    await screen.findByRole('rowheader', { name: /DF-11 · 스크래치/ });

    // 조회 칸 순서: 대분류 선택 · 공정 선택 · 불량코드 검색
    const search = screen.getByRole('search');
    const labels = [...search.querySelectorAll('label')].map((label) => label.textContent);
    expect(labels.slice(0, 2)).toEqual(['대분류 선택', '공정 선택']);
    expect(screen.queryByRole('combobox', { name: /연결 상태/ })).not.toBeInTheDocument();

    // 공정을 조립으로 고르면 조립 열만 남는다.
    await user.click(screen.getByRole('combobox', { name: '공정 선택' }));
    await user.click(screen.getByRole('option', { name: '조립' }));
    await user.click(screen.getByRole('button', { name: '조회' }));
    expect(screen.queryByRole('columnheader', { name: /사출/ })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /조립\s*OP-ASM/ })).toBeInTheDocument();

    // 대분류 치수만 고르면 DF-21 만 남는다.
    await user.click(screen.getByRole('combobox', { name: '대분류 선택' }));
    await user.click(screen.getByRole('option', { name: '치수' }));
    await user.click(screen.getByRole('button', { name: '조회' }));
    expect(screen.getByRole('rowheader', { name: /DF-21 · 길이 초과/ })).toBeInTheDocument();
    expect(screen.queryByRole('rowheader', { name: /DF-11/ })).not.toBeInTheDocument();
  });

  it('탭 줄 오른쪽 연결 상태 칩으로 바로 거른다(#209)', async () => {
    const { fetch } = createRecordingFetch(baseRoutes());
    renderWithProviders(
      <>
        <div id={HUB_ACTIONS_ID} />
        <DefectCauseCodeScreen tab="mapping" />
      </>,
      { fetch, route: ROUTE },
    );
    const user = userEvent.setup();
    await screen.findByRole('rowheader', { name: /DF-11 · 스크래치/ });

    // 상세 코드 4개 중 DF-11 만 사출에 연결돼 있다.
    expect(await screen.findByRole('button', { name: '전체 4' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: '매핑 1' }));
    expect(screen.getByRole('rowheader', { name: /DF-11 · 스크래치/ })).toBeInTheDocument();
    expect(screen.queryByRole('rowheader', { name: /DF-12/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '매핑 해제 3' }));
    expect(screen.queryByRole('rowheader', { name: /DF-11 · 스크래치/ })).not.toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: /DF-12/ })).toBeInTheDocument();

    // 초기화는 칩도 「전체」로 되돌린다(#209 버그 수정).
    await user.click(screen.getByRole('button', { name: '초기화' }));
    expect(screen.getByRole('button', { name: '전체 4' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('rowheader', { name: /DF-11 · 스크래치/ })).toBeInTheDocument();
  });

  it('상위 대분류만 미사용이어도 상세 코드 줄에 대분류 이름을 낸다(#209)', async () => {
    const { requests } = renderMapping([
      {
        match: (request) =>
          request.method === 'GET' && new URL(request.url).pathname === DEFECT_LIST_PATH,
        respond: () =>
          jsonResponse(
            listBody([
              {
                defectCodeId: 1100,
                defectCode: 'DF-80',
                defectName: '중지된 대분류',
                parentDefectCodeId: null,
                processId: null,
                isActive: false,
              },
              {
                defectCodeId: 1101,
                defectCode: 'DF-81',
                defectName: '살아 있는 상세',
                parentDefectCodeId: 1100,
                processId: null,
                isActive: true,
              },
              {
                defectCodeId: 1102,
                defectCode: 'DF-82',
                defectName: '중지된 상세',
                parentDefectCodeId: 1100,
                processId: null,
                isActive: false,
              },
            ]),
          ),
      },
      {
        match: (request) =>
          request.method === 'GET' && new URL(request.url).pathname === mappingPath(1101),
        respond: () => jsonResponse(listBody([])),
      },
    ]);

    expect(
      await screen.findByRole('rowheader', { name: /DF-81 · 살아 있는 상세\s*중지된 대분류/ }),
    ).toBeInTheDocument();
    // 미사용 상세는 줄로 세우지 않는다(종전과 같다).
    expect(screen.queryByRole('rowheader', { name: /DF-82/ })).not.toBeInTheDocument();
    const list = requests.find((request) => request.url.pathname === DEFECT_LIST_PATH);
    expect(list?.url.searchParams.get('includeInactive')).toBe('true');
  });

  it('빈 셀을 누르면 멱등 키와 공정 번호로 즉시 매핑한다', async () => {
    const { requests, user } = renderMapping([
      {
        match: (request) =>
          request.method === 'POST' && new URL(request.url).pathname === mappingPath(1003),
        respond: () =>
          jsonResponse(
            { defectCodeId: 1003, processId: 3002, processName: '조립' },
            { status: 201 },
          ),
      },
    ]);

    // 칸 안 둥근 표시(단추)를 누른다 — 사용자 시안(#209).
    await user.click(await screen.findByRole('button', { name: 'DF-12 · 조립 · 매핑 안 됨' }));

    await waitFor(() => {
      expect(
        requests.some(
          (request) => request.method === 'POST' && request.url.pathname === mappingPath(1003),
        ),
      ).toBe(true);
    });
    const post = requests.find(
      (request) => request.method === 'POST' && request.url.pathname === mappingPath(1003),
    );
    expect(post?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    expect(post?.headers.has('If-Match')).toBe(false);
    expect(JSON.parse(post?.body ?? '{}')).toEqual({ processId: 3002 });
  });

  it('매핑된 셀을 누르면 해당 공정 매핑만 즉시 해제한다', async () => {
    const deletePath = `${mappingPath(1002)}/3001`;
    const { requests, user } = renderMapping([
      {
        match: (request) =>
          request.method === 'DELETE' && new URL(request.url).pathname === deletePath,
        respond: () => new Response(null, { status: 204 }),
      },
    ]);

    await user.click(await screen.findByRole('button', { name: 'DF-11 · 사출 · 매핑됨' }));

    await waitFor(() => {
      expect(
        requests.some(
          (request) => request.method === 'DELETE' && request.url.pathname === deletePath,
        ),
      ).toBe(true);
    });
    const deletion = requests.find(
      (request) => request.method === 'DELETE' && request.url.pathname === deletePath,
    );
    expect(deletion?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    expect(deletion?.headers.has('If-Match')).toBe(false);
    expect(deletion?.body).toBe('');
  });

  it('목록이 잘렸으면 일부만 매핑 중임을 경고한다', async () => {
    renderMapping([], 120);

    expect(
      await screen.findByText(
        '불량코드 또는 공정 목록이 일부만 표시되어 전체 매핑을 편집할 수 없습니다.',
      ),
    ).toBeInTheDocument();
  });
});
