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

    expect(
      await screen.findByRole('button', { name: 'PUR_GROUP 코드값 보기' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'UNIT 코드값 보기' })).toBeInTheDocument();
    expect(screen.queryByText('ITEM_TYPE')).not.toBeInTheDocument();
    expect(screen.getByText('2개 그룹')).toBeInTheDocument();
    expect(screen.getByText('코드 그룹을 고르세요')).toBeInTheDocument();

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

    expect(
      await screen.findByRole('button', { name: 'PUR_GROUP 코드값 보기' }),
    ).toBeInTheDocument();
    expect(urls.filter((url) => url.pathname === GROUPS_PATH)).toHaveLength(2);
  });

  it('그룹을 누르면 그룹 코드로 코드값을 조회해 그린다', async () => {
    const { urls, user } = renderScreen([groupsRoute(), valuesRoute()]);

    await user.click(await screen.findByRole('button', { name: 'PUR_GROUP 코드값 보기' }));

    const pane = await screen.findByRole('region', { name: '코드값' });
    expect(await within(pane).findByText('예시 값 B')).toBeInTheDocument();
    expect(within(pane).getByText('미사용')).toBeInTheDocument();
    expect(within(pane).getByText('1–2 / 전체 2건')).toBeInTheDocument();
    // 한국어·베트남어 명칭 열은 두지 않는다 — 코드명과 겹친다.
    expect(within(pane).queryByText('한국어 명칭')).not.toBeInTheDocument();
    expect(within(pane).queryByText('베트남어 명칭')).not.toBeInTheDocument();

    const request = urls.find((url) => url.pathname === VALUES_PATH);
    expect(request?.searchParams.get('codeGroupCode')).toBe('PUR_GROUP');
    expect(request?.searchParams.has('codeGroupId')).toBe(false);
  });

  it('검색어와 미사용 포함을 코드값 조건으로 싣는다', async () => {
    const { urls, user } = renderScreen([groupsRoute(), valuesRoute()], '?group=UNIT');
    await screen.findByText('예시 값 B');

    await user.type(screen.getByLabelText('코드·코드명'), 'SAMPLE');
    await user.click(screen.getByRole('checkbox', { name: '미사용 포함' }));
    await user.click(screen.getByRole('button', { name: '조회' }));

    await waitFor(() => {
      const last = urls.filter((url) => url.pathname === VALUES_PATH).at(-1);
      expect(last?.searchParams.get('codeGroupCode')).toBe('UNIT');
      expect(last?.searchParams.get('q')).toBe('SAMPLE');
      expect(last?.searchParams.get('includeInactive')).toBe('true');
    });
  });

  it('주소의 그룹이 ERP 분류가 아니면 코드값을 조회하지 않는다', async () => {
    const { urls } = renderScreen([groupsRoute()], '?group=ITEM_TYPE');
    await screen.findByRole('button', { name: 'PUR_GROUP 코드값 보기' });

    expect(screen.getByText('코드 그룹을 고르세요')).toBeInTheDocument();
    expect(urls.some((url) => url.pathname === VALUES_PATH)).toBe(false);
  });

  it('ERP 그룹이 하나도 없으면 빈 상태를 낸다', async () => {
    renderScreen([groupsRoute([GROUPS[2] ?? group()])]);

    expect(await screen.findByText('ERP 에서 받은 코드 그룹이 없습니다')).toBeInTheDocument();
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
