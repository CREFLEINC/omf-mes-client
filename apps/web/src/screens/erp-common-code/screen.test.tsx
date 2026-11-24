import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import type { CodeGroup, CodeValue } from './queries';
import { ErpCommonCodeScreen } from './screen';

const ROUTE = '/system/erp-data/common-codes';
const GROUPS_PATH = '/mdm/code-groups';
const VALUES_PATH = '/mdm/code-values';

/** 지어낸 합성값만 쓴다. 그룹 코드는 ERP 분류 이름이라야 화면에 선다. */
const group = (overrides: Partial<CodeGroup> = {}): CodeGroup => ({
  codeGroupId: 501,
  groupCode: 'PUR_GROUP',
  groupName: '예시 구매그룹',
  description: null,
  isActive: true,
  ...overrides,
});

const GROUPS = [
  group(),
  group({ codeGroupId: 502, groupCode: 'UNIT', groupName: '예시 단위' }),
  // MES 자체 그룹 — 서버가 함께 내려도 이 화면에는 서지 않는다.
  group({ codeGroupId: 10, groupCode: 'ITEM_TYPE', groupName: '예시 MES 그룹' }),
];

const value = (overrides: Partial<CodeValue> = {}): CodeValue => ({
  codeValueId: 9001,
  codeGroupId: 501,
  code: 'SAMPLE-V1',
  codeName: '예시 값 A',
  nameKo: '예시 값 A',
  nameVi: null,
  displayOrder: 0,
  effectiveFrom: null,
  effectiveTo: null,
  isActive: true,
  ...overrides,
});

const VALUES = [
  value(),
  value({ codeValueId: 9002, code: 'SAMPLE-V2', codeName: '예시 값 B', isActive: false }),
];

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const renderScreen = (routes: StubRoute[], search = '') => {
  const urls: URL[] = [];
  const stub = createStubFetch(routes);

  renderWithProviders(<ErpCommonCodeScreen />, {
    fetch: (request) => {
      urls.push(new URL(request.url));
      return stub(request);
    },
    route: `${ROUTE}${search}`,
  });

  return { urls, user: userEvent.setup() };
};

const groupsRoute = (items: CodeGroup[] = GROUPS): StubRoute => ({
  match: (request) => isGet(request, GROUPS_PATH),
  respond: () => jsonResponse({ items, page: { page: 1, size: 200, total: items.length } }),
});

const valuesRoute = (items: CodeValue[] = VALUES): StubRoute => ({
  match: (request) => isGet(request, VALUES_PATH),
  respond: () => jsonResponse({ items, page: { page: 1, size: 50, total: items.length } }),
});

describe('ErpCommonCodeScreen', () => {
  it('ERP 분류 그룹만 그리고 MES 그룹은 감춘다', async () => {
    const { urls } = renderScreen([groupsRoute()]);

    expect(await screen.findByRole('button', { name: 'PUR_GROUP' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'UNIT' })).toBeInTheDocument();
    expect(screen.queryByText('ITEM_TYPE')).not.toBeInTheDocument();
    // 그룹 수는 목록 제목 줄의 건수로 선다(#350).
    expect(screen.getByText('2건')).toBeInTheDocument();
    expect(screen.getByText('코드그룹을 선택하세요.')).toBeInTheDocument();

    // 미사용 그룹도 받는다 — 꺼진 ERP 그룹이 사라지지 않게.
    const request = urls.find((url) => url.pathname === GROUPS_PATH);
    expect(request?.searchParams.get('includeInactive')).toBe('true');
    // 그룹을 고르기 전에는 코드값을 부르지 않는다.
    expect(urls.some((url) => url.pathname === VALUES_PATH)).toBe(false);
    // 쓰기 조작이 없다.
    expect(screen.queryByRole('button', { name: /저장|등록|삭제|추가/ })).not.toBeInTheDocument();
  });

  it('그룹 목록이 여러 쪽이면 끝까지 받는다', async () => {
    const { urls } = renderScreen([
      {
        match: (request) => isGet(request, GROUPS_PATH),
        respond: (request) => {
          const page = Number(new URL(request.url).searchParams.get('page') ?? '1');
          const items = page === 1 ? [GROUPS[2] ?? group()] : [group()];
          return jsonResponse({ items, page: { page, size: 1, total: 2 } });
        },
      },
    ]);

    expect(await screen.findByRole('button', { name: 'PUR_GROUP' })).toBeInTheDocument();
    expect(urls.filter((url) => url.pathname === GROUPS_PATH)).toHaveLength(2);
  });

  /* 사용 여부 라벨 「전체 · 사용 · 미사용」 — 받은 그룹 안에서 화면이 거른다(사용자 지시 2026-11-24). */
  it('사용 여부 라벨(「전체」 없이 건수)로 코드그룹 목록을 거르고, 다시 누르면 전체로 돌아간다', async () => {
    const { user } = renderScreen([
      groupsRoute([
        group(),
        group({ codeGroupId: 502, groupCode: 'UNIT', groupName: '예시 단위', isActive: false }),
      ]),
    ]);
    await screen.findByRole('button', { name: 'PUR_GROUP' });

    const chips = screen.getByRole('group', { name: '사용 여부' });
    expect(within(chips).queryByText(/전체/)).not.toBeInTheDocument();
    await user.click(within(chips).getByRole('button', { name: '미사용 1건' }));
    expect(screen.queryByRole('button', { name: 'PUR_GROUP' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'UNIT' })).toBeInTheDocument();

    await user.click(within(chips).getByRole('button', { name: '미사용 1건' }));
    expect(screen.getByRole('button', { name: 'PUR_GROUP' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'UNIT' })).toBeInTheDocument();
  });

  it('0건인 사용 여부 라벨은 감춘다', async () => {
    renderScreen([groupsRoute()]);
    await screen.findByRole('button', { name: 'PUR_GROUP' });

    const chips = screen.getByRole('group', { name: '사용 여부' });
    expect(within(chips).getByRole('button', { name: '사용 2건' })).toBeInTheDocument();
    expect(within(chips).queryByRole('button', { name: /미사용/ })).not.toBeInTheDocument();
  });

  it('그룹을 누르면 상세에 그룹 칸을 내고 그룹 코드로 코드값을 조회해 그린다', async () => {
    const { urls, user } = renderScreen([groupsRoute(), valuesRoute()]);

    await user.click(await screen.findByRole('button', { name: 'PUR_GROUP' }));

    const detail = screen.getByRole('region', { name: '코드그룹 상세' });
    expect(within(detail).getByText('예시 구매그룹')).toBeInTheDocument();
    const pane = await screen.findByRole('region', { name: '코드값' });
    expect(await within(pane).findByText('예시 값 B')).toBeInTheDocument();
    expect(within(pane).getByText('미사용')).toBeInTheDocument();
    expect(within(pane).getByText('총 2건')).toBeInTheDocument();
    /* 상세 안 코드값 표 아래 쪽 넘김 줄 — 총 N건 · 쪽 크기 · [처음]~[마지막](사용자 지시 2026-11-24). */
    const nav = within(within(pane).getByRole('navigation', { name: '쪽 이동' }));
    expect(nav.getByRole('combobox', { name: '페이지 크기' })).toHaveTextContent('50건');
    expect(nav.getByText('1 / 1')).toBeInTheDocument();
    for (const name of ['처음', '이전', '다음', '마지막']) {
      expect(nav.getByRole('button', { name })).toBeDisabled();
    }
    // 한국어·베트남어 명칭 열은 두지 않는다 — 코드명과 겹친다.
    expect(within(pane).queryByText('한국어 명칭')).not.toBeInTheDocument();
    expect(within(pane).queryByText('베트남어 명칭')).not.toBeInTheDocument();

    const request = urls.find((url) => url.pathname === VALUES_PATH);
    expect(request?.searchParams.get('codeGroupCode')).toBe('PUR_GROUP');
    expect(request?.searchParams.has('codeGroupId')).toBe(false);
  });

  it('고른 그룹을 다시 누르면 선택이 풀린다(사용자 지시 2026-11-24)', async () => {
    const { user } = renderScreen([groupsRoute(), valuesRoute()]);

    await user.click(await screen.findByRole('button', { name: 'PUR_GROUP' }));
    await screen.findByRole('region', { name: '코드값' });
    await user.click(screen.getByRole('button', { name: 'PUR_GROUP' }));

    expect(await screen.findByText('코드그룹을 선택하세요.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '코드값' })).not.toBeInTheDocument();
  });

  it('검색어와 미사용 포함을 코드값 조건으로 싣는다', async () => {
    const { urls, user } = renderScreen([groupsRoute(), valuesRoute()], '?group=UNIT');
    await screen.findByText('예시 값 B');
    const form = screen.getByRole('form', { name: '코드값 조회 조건' });
    // 초기화는 바뀐 것이 있을 때만 보인다 — 고른 그룹은 조건이 아니다.
    expect(within(form).queryByRole('button', { name: '초기화' })).toBeNull();

    await user.type(within(form).getByLabelText('코드값 검색'), 'SAMPLE');
    expect(within(form).getByRole('button', { name: '초기화' })).toBeInTheDocument();
    await user.click(within(form).getByRole('checkbox', { name: '미사용 포함' }));
    await user.click(within(form).getByRole('button', { name: '조회' }));

    await waitFor(() => {
      const last = urls.filter((url) => url.pathname === VALUES_PATH).at(-1);
      expect(last?.searchParams.get('codeGroupCode')).toBe('UNIT');
      expect(last?.searchParams.get('q')).toBe('SAMPLE');
      expect(last?.searchParams.get('includeInactive')).toBe('true');
    });
  });

  it('위 그룹 검색은 화면 안에서만 거르고 서버에 다시 묻지 않는다', async () => {
    const { urls, user } = renderScreen([groupsRoute()]);
    await screen.findByRole('button', { name: 'PUR_GROUP' });
    const before = urls.length;
    // 그룹 검색 초기화도 검색어가 처음 값(빈칸)과 다를 때만 보인다.
    expect(screen.queryByRole('button', { name: '초기화' })).toBeNull();

    await user.type(screen.getByLabelText('코드그룹 검색'), '단위');
    await user.click(screen.getAllByRole('button', { name: '조회' })[0]!);
    expect(screen.queryByRole('button', { name: 'PUR_GROUP' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'UNIT' })).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: '초기화' })[0]!);
    expect(screen.getByRole('button', { name: 'PUR_GROUP' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '초기화' })).toBeNull();
    expect(urls.length).toBe(before);
  });

  it('주소의 그룹이 ERP 분류가 아니면 코드값을 조회하지 않는다', async () => {
    const { urls } = renderScreen([groupsRoute()], '?group=ITEM_TYPE');
    await screen.findByRole('button', { name: 'PUR_GROUP' });

    expect(screen.getByText('코드그룹을 선택하세요.')).toBeInTheDocument();
    expect(urls.some((url) => url.pathname === VALUES_PATH)).toBe(false);
  });

  it('ERP 그룹이 하나도 없으면 빈 상태를 낸다', async () => {
    renderScreen([groupsRoute([GROUPS[2] ?? group()])]);

    expect(await screen.findByText('ERP에서 받은 코드그룹이 없습니다')).toBeInTheDocument();
  });

  it('코드값이 없으면 빈 상태를 낸다', async () => {
    renderScreen([groupsRoute(), valuesRoute([])], '?group=PUR_GROUP');

    expect(await screen.findByText('조건에 맞는 코드값이 없습니다')).toBeInTheDocument();
  });

  it('그룹 조회에 실패하면 오류 배너를 내고 표를 감춘다', async () => {
    renderScreen([
      {
        match: (request) => isGet(request, GROUPS_PATH),
        respond: () => jsonResponse({ message: '' }, { status: 500 }),
      },
    ]);

    expect(await screen.findByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
