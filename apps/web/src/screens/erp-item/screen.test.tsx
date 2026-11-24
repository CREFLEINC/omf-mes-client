import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { ErpItemScreen } from './screen';
import type { ErpItem } from './types';

const t = messages.erpItem;
const ROUTE = '/system/erp-data/items';
const LIST_PATH = '/mdm/items';

/** 지어낸 합성값만 쓴다 — 실제 품목코드처럼 보이는 값을 넣지 않는다(공개 저장소 경계). */
const item = (overrides: Partial<ErpItem> = {}): ErpItem => ({
  itemId: 7001,
  itemCode: 'SYN-ITEM-001',
  itemName: '합성 품목 A',
  nameKo: '한국어 확장 명칭',
  nameVi: null,
  itemTypeCode: 'FINISHED',
  baseUomId: 8101,
  lotControlled: true,
  serialControlTypeCode: 'NONE',
  inspectionRequired: false,
  fifoPolicyCode: 'FIFO',
  negativeStockAllowed: false,
  isActive: true,
  erpSpec: 'SYN 10x20',
  erpItemGroupCode: 'SYN-GRP',
  ...overrides,
});

const ROWS = [
  item(),
  item({
    itemId: 7002,
    itemCode: 'SYN-ITEM-002',
    itemName: '합성 품목 B',
    itemTypeCode: 'SYN_UNNAMED',
    baseUomId: 8999,
    isActive: false,
    erpSpec: null,
    erpItemGroupCode: null,
  }),
];

/** 화면 한 벌(조회 상자 + 목록 상자). */
const workspace = (): HTMLElement => {
  const el = document.querySelector<HTMLElement>('.list-detail-workspace');
  if (el === null) throw new Error('화면이 그려지지 않았습니다.');
  return el;
};

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const references: StubRoute[] = [
  {
    match: (request) => isGet(request, '/mdm/code-values'),
    respond: (request) => {
      const group = new URL(request.url).searchParams.get('codeGroupCode');
      const items =
        group === 'ITEM_TYPE'
          ? [{ codeValueId: 1, code: 'FINISHED', codeName: '합성 제품', displayOrder: 1 }]
          : [];
      return jsonResponse({ items, page: { page: 1, size: 100, total: items.length } });
    },
  },
  {
    match: (request) => isGet(request, '/mdm/uoms'),
    respond: () =>
      jsonResponse({
        items: [{ uomId: 8101, uomCode: 'SYN-EA', uomName: 'each', isActive: true }],
        page: { page: 1, size: 50, total: 1 },
      }),
  },
];

const listRoute = (items: ErpItem[] = ROWS, total = items.length): StubRoute => ({
  match: (request) => isGet(request, LIST_PATH),
  respond: () => jsonResponse({ items, page: { page: 1, size: 50, total } }),
});

const renderScreen = (routes: StubRoute[], search = '') => {
  const requests: Request[] = [];
  const stub = createStubFetch([...references, ...routes]);

  renderWithProviders(<ErpItemScreen />, {
    fetch: (request) => {
      requests.push(request);
      return stub(request);
    },
    route: `${ROUTE}${search}`,
  });

  const urls = () => requests.map((request) => new URL(request.url));
  return { requests, urls, user: userEvent.setup() };
};

describe('ErpItemScreen', () => {
  it('목록에 규격 · 품목 그룹까지 내고, 이름을 못 찾은 유형·단위는 받은 값을 그대로 낸다', async () => {
    const { requests, urls } = renderScreen([listRoute()]);

    const table = await screen.findByRole('table');
    expect(within(table).getByText('SYN-ITEM-001')).toBeInTheDocument();
    expect(await within(table).findByText('합성 제품')).toBeInTheDocument();
    expect(await within(table).findByText('SYN-EA')).toBeInTheDocument();
    // 이름이 없는 유형 코드·단위 번호는 지우지 않고 그대로 낸다.
    expect(within(table).getByText('SYN_UNNAMED')).toBeInTheDocument();
    expect(within(table).getByText('8999')).toBeInTheDocument();
    // 사용 여부는 상태 라벨로 낸다(사용자 지시 2026-11-24).
    expect(within(table).getByText(t.values.inactive).parentElement?.className).toMatch(
      /status-idle/,
    );
    expect(within(table).getByText(t.values.active).parentElement?.className).toMatch(
      /status-success/,
    );
    // 규격 · 품목 그룹은 목록에도 있다(사용자 지시 2026-11-24). 값이 없으면 「—」.
    expect(within(table).getByRole('columnheader', { name: t.table.erpSpec })).toBeInTheDocument();
    expect(
      within(table).getByRole('columnheader', { name: t.table.erpItemGroupCode }),
    ).toBeInTheDocument();
    expect(within(table).getByText('SYN 10x20')).toBeInTheDocument();
    expect(within(table).getByText('SYN-GRP')).toBeInTheDocument();
    expect(within(table).getAllByText(t.values.empty)).toHaveLength(2);
    // 목록 제목 줄 — 이름 · 건수.
    expect(screen.getByRole('heading', { name: t.panes.list })).toBeInTheDocument();
    expect(screen.getByText(messages.common.paneList.count(2))).toBeInTheDocument();
    // MES 확장 속성(다국어 명칭 등)은 이 화면에 보이지 않는다.
    expect(screen.queryByText('한국어 확장 명칭')).not.toBeInTheDocument();

    // 읽기 전용 — 쓰기 요청이 나가지 않고, 고치는 단추도 없다. 목록 응답만 쓴다.
    expect(requests.every((request) => request.method === 'GET')).toBe(true);
    expect(urls().some((url) => url.pathname.startsWith(`${LIST_PATH}/`))).toBe(false);
    expect(screen.queryByRole('button', { name: /저장|수정|등록|삭제/ })).not.toBeInTheDocument();
  });

  it('상세 칸이 없다 — 줄을 눌러도 상세가 생기지 않고, 배치 · 목록 접기 조작도 없다(사용자 지시 2026-11-24)', async () => {
    const { user, requests } = renderScreen([listRoute()]);

    const table = await screen.findByRole('table');
    /* 화면 몫의 구획만 센다(알림 구획은 앱 몫이다). */
    const regionNames = () =>
      within(workspace())
        .queryAllByRole('region')
        .map((el) => el.getAttribute('aria-label'));
    expect(regionNames()).toEqual([t.panes.filter, t.panes.list]);
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: messages.common.inspectionHub.listCollapse }),
    ).not.toBeInTheDocument();
    // 줄 고르기 단추가 없다.
    expect(table.querySelector('.users-roles-row-pick')).toBeNull();
    const before = requests.length;

    await user.click(within(table).getByText('합성 품목 B'));
    await user.click(within(table).getByText('SYN-ITEM-001'));

    expect(regionNames()).toEqual([t.panes.filter, t.panes.list]);
    expect(table.querySelector('[aria-current]')).toBeNull();
    // 「SYN 10x20」은 목록 칸 한 곳에만 있다 — 다른 곳에 값이 다시 그려지지 않는다.
    expect(screen.getAllByText('SYN 10x20')).toHaveLength(1);
    expect(requests.length).toBe(before);
  });

  it('주소에 옛 선택 값이 남아 와도 화면이 깨지지 않고 조회 인자에 싣지 않는다', async () => {
    const { urls } = renderScreen([listRoute()], '?item=7001&selected=7001');

    expect(await screen.findByText('합성 품목 B')).toBeInTheDocument();
    const first = urls().find((url) => url.pathname === LIST_PATH);
    expect(first?.searchParams.has('item')).toBe(false);
    expect(first?.searchParams.has('selected')).toBe(false);
    expect(within(workspace()).getAllByRole('region')).toHaveLength(2);
  });

  it('주소의 품목유형과 검색어·미사용 포함을 조회 조건으로 싣는다', async () => {
    const { urls, user } = renderScreen([listRoute()], '?type=FINISHED');
    await screen.findByText('합성 품목 B');

    const first = urls().find((url) => url.pathname === LIST_PATH);
    expect(first?.searchParams.get('itemTypeCode')).toBe('FINISHED');

    await user.type(screen.getByLabelText(t.fields.q), 'SYN');
    await user.click(screen.getByRole('checkbox', { name: t.fields.includeInactive }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      const last = urls()
        .filter((url) => url.pathname === LIST_PATH)
        .at(-1);
      expect(last?.searchParams.get('q')).toBe('SYN');
      expect(last?.searchParams.get('includeInactive')).toBe('true');
      expect(last?.searchParams.get('itemTypeCode')).toBe('FINISHED');
    });
  });

  it('초기화는 바뀐 것이 있을 때만 보이고, 누르면 치던 값까지 비운다', async () => {
    const { user } = renderScreen([listRoute()]);
    await screen.findByText('합성 품목 B');
    expect(screen.queryByRole('button', { name: messages.common.reset })).toBeNull();

    await user.type(screen.getByLabelText(t.fields.q), 'SYN');
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    // 주소는 이미 처음 값이라 바뀌지 않는다 — 그래도 치던 값은 비워지고 초기화는 다시 숨는다.
    expect(screen.getByLabelText(t.fields.q)).toHaveValue('');
    expect(screen.queryByRole('button', { name: messages.common.reset })).toBeNull();
  });

  it('쪽 넘김은 서버 쪽 넘김 — 쪽 크기를 고르기 전엔 size 를 싣지 않고, 다음 쪽은 page 로 싣는다', async () => {
    const { user, urls } = renderScreen([listRoute(ROWS, 120)]);
    await screen.findByText('합성 품목 B');
    const first = urls().find((url) => url.pathname === LIST_PATH);
    expect(first?.searchParams.has('size')).toBe(false);

    /* 쪽 넘김 줄 — 왼쪽 「총 N건」 + 쪽 크기, 오른쪽 [처음] [이전] n / N [다음] [마지막](ERP 수신 묶음 공통 · 사용자 지시 2026-11-24). */
    const nav = within(screen.getByRole('navigation', { name: '쪽 이동' }));
    expect(nav.getByText('총 120건')).toBeInTheDocument();
    expect(nav.getByRole('combobox', { name: '페이지 크기' })).toHaveTextContent('50건');
    expect(nav.getByText('1 / 3')).toBeInTheDocument();
    for (const name of ['처음', '이전', '다음', '마지막']) {
      expect(nav.getByRole('button', { name })).toBeInTheDocument();
    }

    await user.click(screen.getByRole('button', { name: messages.screenPatterns.pageNav.next }));
    await waitFor(() => {
      const last = urls()
        .filter((url) => url.pathname === LIST_PATH)
        .at(-1);
      expect(last?.searchParams.get('page')).toBe('2');
    });
  });

  it('결과가 없으면 빈 상태를 낸다', async () => {
    renderScreen([listRoute([])]);

    expect(await screen.findByText(t.empty.noResultTitle)).toBeInTheDocument();
  });

  it('조회에 실패하면 오류 배너를 내고 표를 감춘다', async () => {
    renderScreen([
      {
        match: (request) => isGet(request, LIST_PATH),
        respond: () => jsonResponse({ message: '' }, { status: 500 }),
      },
    ]);

    expect(await screen.findByRole('button', { name: messages.common.retry })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // 배너는 목록 상자 안 표 자리에 선다(ERP 수신 탭과 같은 자리) — 조회 상자에는 없다.
    expect(
      within(screen.getByRole('region', { name: t.panes.list })).getByRole('button', {
        name: messages.common.retry,
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: t.panes.filter })).queryByRole('button', {
        name: messages.common.retry,
      }),
    ).not.toBeInTheDocument();
  });
});
