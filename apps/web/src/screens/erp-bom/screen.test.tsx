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
import { ErpBomScreen } from './screen';
import type { Bom, ErpBomComponent } from './types';

const t = messages.erpBom;
const ROUTE = '/system/erp-data/boms';
const BOMS_PATH = '/planning/boms';

/** 지어낸 합성값만 쓴다 — 실제 품목코드처럼 보이는 값을 넣지 않는다(공개 저장소 경계). */
const bom = (overrides: Partial<Bom> = {}): Bom => ({
  bomId: 501,
  parentItemId: 7001,
  bomCode: 'SYN-BOM',
  bomVersion: 2,
  statusCode: 'CONFIRMED',
  isDefault: true,
  effectiveFrom: '2026-10-01',
  effectiveTo: null,
  baseQty: 1,
  baseUomId: 8101,
  ...overrides,
});

const component = (overrides: Partial<ErpBomComponent> = {}): ErpBomComponent => ({
  bomComponentId: 9001,
  bomId: 501,
  componentItemId: 7101,
  routingOperationId: 4444,
  actualUseProcessId: null,
  requiredQty: 2.5,
  uomId: 8101,
  scrapRate: 0.05,
  isMandatory: true,
  lotTraceRequired: true,
  backflushAllowed: false,
  sequenceNo: 1,
  erpChildItemSeq: 0,
  ...overrides,
});

const ITEMS: Record<string, { itemCode: string; itemName: string }> = {
  '7001': { itemCode: 'SYN-PARENT', itemName: '합성 모품목' },
  '7101': { itemCode: 'SYN-CHILD-1', itemName: '합성 자품목 1' },
  '7102': { itemCode: 'SYN-CHILD-2', itemName: '합성 자품목 2' },
};

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const page = (items: unknown[]) => ({ items, page: { page: 1, size: 100, total: items.length } });

const references: StubRoute[] = [
  {
    match: (request) => isGet(request, '/mdm/code-values'),
    respond: (request) => {
      const group = new URL(request.url).searchParams.get('codeGroupCode');
      return jsonResponse(
        page(
          group === 'MASTER_VERSION_STATUS'
            ? [{ codeValueId: 1, code: 'CONFIRMED', codeName: '합성 확정', displayOrder: 1 }]
            : [],
        ),
      );
    },
  },
  {
    match: (request) => isGet(request, '/mdm/uoms'),
    respond: () => jsonResponse(page([{ uomId: 8101, uomCode: 'SYN-EA', isActive: true }])),
  },
  {
    match: (request) =>
      request.method === 'GET' && /^\/mdm\/items\/\d+$/.test(new URL(request.url).pathname),
    respond: (request) => {
      const id = new URL(request.url).pathname.split('/').at(-1) ?? '';
      const found = ITEMS[id];
      return found === undefined
        ? jsonResponse({ message: 'not found' }, { status: 404 })
        : jsonResponse({ item: { itemId: Number(id), ...found } });
    },
  },
];

const bomsRoute = (items: Bom[] = [bom()]): StubRoute => ({
  match: (request) => isGet(request, BOMS_PATH),
  respond: () => jsonResponse({ items }),
});

const componentsRoute: StubRoute = {
  match: (request) => isGet(request, `${BOMS_PATH}/501/components`),
  respond: () =>
    jsonResponse({
      items: [
        component({
          bomComponentId: 9002,
          componentItemId: 7102,
          sequenceNo: 2,
          requiredQty: 1000,
          erpChildItemSeq: null,
          isMandatory: false,
          scrapRate: 0,
        }),
        component(),
      ],
    }),
};

const renderScreen = (routes: StubRoute[], search = '') => {
  const requests: Request[] = [];
  const stub = createStubFetch([...references, ...routes]);

  renderWithProviders(<ErpBomScreen />, {
    fetch: (request) => {
      requests.push(request);
      return stub(request);
    },
    route: `${ROUTE}${search}`,
  });

  const urls = () => requests.map((request) => new URL(request.url));
  return { requests, urls, user: userEvent.setup() };
};

describe('ErpBomScreen', () => {
  it('모품목을 고르기 전에는 BOM 을 부르지 않고 안내만 낸다', async () => {
    const { urls } = renderScreen([]);

    expect(await screen.findByText(t.empty.noParentTitle)).toBeInTheDocument();
    expect(screen.getByText(t.readOnlyNote)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.common.search })).toBeDisabled();
    expect(urls().some((url) => url.pathname === BOMS_PATH)).toBe(false);
  });

  it('대화상자로 모품목을 고르면 그 품목의 BOM 을 조회한다', async () => {
    const { urls, user } = renderScreen([
      bomsRoute(),
      {
        match: (request) => isGet(request, '/mdm/items'),
        respond: () =>
          jsonResponse({
            items: [
              {
                itemId: 7001,
                itemCode: 'SYN-PARENT',
                itemName: '합성 모품목',
                itemTypeCode: 'FINISHED',
                baseUomId: 8101,
                isActive: true,
              },
            ],
            page: { page: 1, size: 20, total: 1 },
          }),
      },
    ]);

    await user.click(screen.getByRole('button', { name: t.actions.pickParent }));
    const dialog = await screen.findByRole('dialog');
    await user.click(await within(dialog).findByRole('checkbox', { name: 'SYN-PARENT' }));
    await user.click(within(dialog).getByRole('button', { name: t.actions.confirmPick }));

    expect(
      await screen.findByRole('button', { name: t.bomTable.openAction('SYN-BOM', 2) }),
    ).toBeInTheDocument();
    const list = urls().find((url) => url.pathname === BOMS_PATH);
    expect(list?.searchParams.get('parentItemId')).toBe('7001');
    expect(await screen.findByText('SYN-PARENT · 합성 모품목')).toBeInTheDocument();
    // 상태는 공통코드 이름으로, 기준 수량은 단위와 함께.
    const boms = screen.getByRole('region', { name: t.panes.boms });
    expect(await within(boms).findByText('합성 확정')).toBeInTheDocument();
    expect(await within(boms).findByText('1 SYN-EA')).toBeInTheDocument();
  });

  it('BOM 코드를 조건으로 싣는다', async () => {
    const { urls, user } = renderScreen([bomsRoute()], '?item=7001');
    await screen.findByRole('button', { name: t.bomTable.openAction('SYN-BOM', 2) });

    await user.type(screen.getByLabelText(t.fields.bomCode), 'SYN-BOM');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      const last = urls()
        .filter((url) => url.pathname === BOMS_PATH)
        .at(-1);
      expect(last?.searchParams.get('parentItemId')).toBe('7001');
      expect(last?.searchParams.get('bomCode')).toBe('SYN-BOM');
    });
  });

  it('BOM 을 고르면 구성품의 ERP 원본 열을 순번대로 보인다 — ERP 자품목 순번 0 도 값이다', async () => {
    const { requests, user } = renderScreen([bomsRoute(), componentsRoute], '?item=7001');

    await user.click(
      await screen.findByRole('button', { name: t.bomTable.openAction('SYN-BOM', 2) }),
    );

    const pane = screen.getByRole('region', { name: t.panes.components });
    expect(await within(pane).findByText('SYN-CHILD-1 · 합성 자품목 1')).toBeInTheDocument();
    expect(await within(pane).findByText('2.5 SYN-EA')).toBeInTheDocument();
    expect(within(pane).getByText('1,000 SYN-EA')).toBeInTheDocument();
    expect(within(pane).getByText('5%')).toBeInTheDocument();

    const rows = within(pane).getAllByRole('row').slice(1);
    // 순번 1 이 먼저 선다(서버 순서와 무관).
    expect(rows[0]).toHaveTextContent('SYN-CHILD-1');
    expect(within(rows[0] as HTMLElement).getByText('0')).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText(t.values.empty)).toBeInTheDocument();
    // MES 확장 열(공정 등)은 보이지 않는다.
    expect(within(pane).queryByText('4444')).not.toBeInTheDocument();

    // 읽기 전용 — 쓰기 요청이 나가지 않고, 고치는 단추도 없다.
    expect(requests.every((request) => request.method === 'GET')).toBe(true);
    expect(screen.queryByRole('button', { name: /저장|수정|등록|삭제/ })).not.toBeInTheDocument();
  });

  it('BOM 이 없으면 빈 상태를 낸다', async () => {
    renderScreen([bomsRoute([])], '?item=7001');

    expect(await screen.findByText(t.empty.noBomTitle)).toBeInTheDocument();
  });

  it('BOM 조회에 실패하면 오류 배너를 내고 표를 감춘다', async () => {
    renderScreen(
      [
        {
          match: (request) => isGet(request, BOMS_PATH),
          respond: () => jsonResponse({ message: '' }, { status: 500 }),
        },
      ],
      '?item=7001',
    );

    expect(await screen.findByRole('button', { name: messages.common.retry })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
