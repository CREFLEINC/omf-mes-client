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
  it('ERP 원본 열을 그리고, 이름을 못 찾은 유형·단위는 받은 값을 그대로 낸다', async () => {
    const { requests } = renderScreen([listRoute()]);

    const table = await screen.findByRole('table');
    expect(within(table).getByText('SYN-ITEM-001')).toBeInTheDocument();
    expect(await within(table).findByText('합성 제품')).toBeInTheDocument();
    expect(await within(table).findByText('SYN-EA')).toBeInTheDocument();
    expect(within(table).getByText('SYN 10x20')).toBeInTheDocument();
    expect(within(table).getByText('SYN-GRP')).toBeInTheDocument();
    // 이름이 없는 유형 코드·단위 번호는 지우지 않고 그대로 낸다.
    expect(within(table).getByText('SYN_UNNAMED')).toBeInTheDocument();
    expect(within(table).getByText('8999')).toBeInTheDocument();
    expect(within(table).getByText(t.values.inactive)).toBeInTheDocument();
    expect(within(table).getAllByText(t.values.empty)).toHaveLength(2);
    // MES 확장 속성(다국어 명칭 등)은 이 화면에 보이지 않는다.
    expect(within(table).queryByText('한국어 확장 명칭')).not.toBeInTheDocument();

    // 읽기 전용 — 쓰기 요청이 나가지 않고, 고치는 단추도 없다.
    expect(requests.every((request) => request.method === 'GET')).toBe(true);
    expect(screen.queryByRole('button', { name: /저장|수정|등록|삭제/ })).not.toBeInTheDocument();
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

  it('상세 구획 없이 목록 한 구획만 서고, 줄을 눌러도 상세를 부르지 않는다', async () => {
    const { user, urls } = renderScreen([listRoute()]);

    await user.click(await screen.findByText('SYN-ITEM-001'));

    expect(screen.getByRole('region', { name: t.panes.list })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '품목 상세' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /상세 보기/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    expect(urls().some((url) => url.pathname.startsWith(`${LIST_PATH}/`))).toBe(false);
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
  });
});
