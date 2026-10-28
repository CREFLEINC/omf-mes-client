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
  '7201': { itemCode: 'SYN-GRAND-1', itemName: '합성 손품목 1' },
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
          group === 'ITEM_TYPE'
            ? [
                { codeValueId: 1, code: 'RAW_MATERIAL', codeName: '원자재', displayOrder: 1 },
                { codeValueId: 2, code: 'FINISHED', codeName: '제품', displayOrder: 2 },
                { codeValueId: 3, code: 'MERCHANDISE', codeName: '상품', displayOrder: 3 },
                {
                  codeValueId: 4,
                  code: 'SUBSIDIARY_MATERIAL',
                  codeName: '부자재',
                  displayOrder: 4,
                },
                { codeValueId: 5, code: 'SEMI_FINISHED', codeName: '반제품', displayOrder: 5 },
              ]
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

/**
 * 모품목별 BOM 목록. 모품목(7001)의 것만 기본으로 주고, 하이라키가 묻는 자품목의 BOM 은 `sub` 로 준다 —
 * 없는 품목은 빈 목록(하위 구성 없음)이다.
 */
const bomsRoute = (items: Bom[] = [bom()], sub: Record<string, Bom[]> = {}): StubRoute => ({
  match: (request) => isGet(request, BOMS_PATH),
  respond: (request) => {
    const parent = new URL(request.url).searchParams.get('parentItemId') ?? '';
    return jsonResponse({ items: parent === '7001' ? items : (sub[parent] ?? []) });
  },
});

const componentsOf = (bomId: number, items: ErpBomComponent[]): StubRoute => ({
  match: (request) => isGet(request, `${BOMS_PATH}/${String(bomId)}/components`),
  respond: () => jsonResponse({ items }),
});

/** 모품목 BOM(501)의 구성 — 서버 순서와 달리 순번 2 가 먼저 온다. */
const componentsRoute = componentsOf(501, [
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
]);

/** 자품목 1(7101)의 하위 BOM(502)과 그 구성 — 하이라키 2단계. */
const SUB_BOMS = { '7101': [bom({ bomId: 502, parentItemId: 7101, bomCode: 'SYN-SUB' })] };
const subComponentsRoute = componentsOf(502, [
  component({ bomComponentId: 9101, bomId: 502, componentItemId: 7201, requiredQty: 3 }),
]);

const tree = () => within(screen.getByRole('region', { name: t.panes.components }));

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
    // 읽기 전용 안내 문구는 두지 않는다 — 쓰기 조작이 없는 화면이라 따로 알릴 것이 없다.
    expect(screen.queryByText(/고칠 수 없습니다/)).not.toBeInTheDocument();
    // 조건은 모품목 하나 — BOM 코드 검색칸 · 조회 단추를 두지 않는다.
    expect(screen.queryByLabelText('BOM 코드')).toBeNull();
    expect(screen.queryByRole('button', { name: messages.common.search })).toBeNull();
    expect(urls().some((url) => url.pathname === BOMS_PATH)).toBe(false);
  });

  it('대화상자로 모품목을 고르면 그 품목의 BOM 을 조회한다', async () => {
    const { urls, user } = renderScreen([
      bomsRoute(),
      componentsRoute,
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

    // 유형은 처음부터 제품이고, BOM 이 없는 원자재 · 상품 · 부자재는 선택지에 없다.
    await waitFor(() => {
      const search = urls()
        .filter((url) => url.pathname === '/mdm/items')
        .at(-1);
      expect(search?.searchParams.get('itemTypeCode')).toBe('FINISHED');
    });
    await user.click(within(dialog).getByRole('combobox', { name: '유형' }));
    expect(await within(dialog).findByRole('option', { name: '제품' })).toBeInTheDocument();
    expect(within(dialog).getByRole('option', { name: '반제품' })).toBeInTheDocument();
    for (const name of ['원자재', '상품', '부자재']) {
      expect(within(dialog).queryByRole('option', { name })).toBeNull();
    }
    await user.keyboard('{Escape}');

    await user.click(await within(dialog).findByRole('checkbox', { name: 'SYN-PARENT' }));
    await user.click(within(dialog).getByRole('button', { name: t.actions.confirmPick }));

    expect(await tree().findByText('SYN-CHILD-1')).toBeInTheDocument();
    const list = urls().find((url) => url.pathname === BOMS_PATH);
    expect(list?.searchParams.get('parentItemId')).toBe('7001');
    const filter = screen.getByRole('region', { name: t.panes.filter });
    expect(within(filter).getByText('SYN-PARENT · 합성 모품목')).toBeInTheDocument();
  });

  it('한 구획에 기본 BOM 의 하이라키를 연다 — 모품목 아래로 자품목을 순번대로, ERP 원본 열만', async () => {
    const { requests } = renderScreen([bomsRoute(), componentsRoute], '?item=7001');

    expect(await tree().findByText('SYN-CHILD-1')).toBeInTheDocument();
    // 하이라키 위에 모품목 상세 — 품목 칸과 그 BOM 칸. 품목코드는 굵게.
    const facts = screen.getByLabelText(t.parent.label);
    expect(within(facts).getByText('SYN-BOM')).toBeInTheDocument();
    expect(within(facts).getByText('1 SYN-EA')).toBeInTheDocument();
    expect(await within(facts).findByText('SYN-PARENT')).toHaveClass('bom-tree-code');
    expect(tree().getByText('SYN-CHILD-1')).toHaveClass('bom-tree-code');
    // 좌우로 나누지 않는다 — BOM 목록 구획도 나눔 막대도 없다.
    expect(screen.queryByRole('region', { name: 'BOM 목록' })).toBeNull();
    expect(screen.queryByRole('separator')).toBeNull();
    expect(await tree().findByText('2.5 SYN-EA')).toBeInTheDocument();
    expect(tree().getByText('1,000 SYN-EA')).toBeInTheDocument();
    expect(tree().getByText('5%')).toBeInTheDocument();

    const rows = tree().getAllByRole('row').slice(1);
    // 뿌리는 모품목, 그 아래 순번 1 이 먼저 선다(서버 순서와 무관).
    expect(rows[0]).toHaveTextContent('SYN-PARENT');
    expect(rows[1]).toHaveTextContent('SYN-CHILD-1');
    expect(rows[2]).toHaveTextContent('SYN-CHILD-2');
    // 뿌리는 하위 구성을 펼친 채로 서고, 자품목은 하위 BOM 이 없어 단추가 없다.
    expect(tree().getByRole('button', { name: 'SYN-PARENT · 합성 모품목 접기' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(
      tree().queryByRole('button', { name: /SYN-CHILD-1 · 합성 자품목 1 (접기|펼치기)/ }),
    ).toBeNull();
    // MES 확장 열(공정 등)은 보이지 않는다.
    expect(tree().queryByText('4444')).not.toBeInTheDocument();

    // 읽기 전용 — 쓰기 요청이 나가지 않고, 고치는 단추도 없다.
    expect(requests.every((request) => request.method === 'GET')).toBe(true);
    expect(screen.queryByRole('button', { name: /저장|수정|등록|삭제/ })).not.toBeInTheDocument();
  });

  it('자품목이 BOM 을 가지면 그 구성을 한 단계 더 들여 펼치고, 접으면 감춘다', async () => {
    const { user } = renderScreen(
      [bomsRoute([bom()], SUB_BOMS), componentsRoute, subComponentsRoute],
      '?item=7001',
    );

    const grand = await tree().findByText('SYN-GRAND-1');
    const rows = tree().getAllByRole('row').slice(1);
    const codeOf = (row: HTMLElement) => row.querySelector('.bom-tree-code')?.textContent;
    expect(rows.map(codeOf)).toEqual(['SYN-PARENT', 'SYN-CHILD-1', 'SYN-GRAND-1', 'SYN-CHILD-2']);
    // 2단계 줄은 윗 단계 세로선(이어짐)과 마지막 형제의 └ 가지선을 갖는다.
    const grandCell = grand.closest('.bom-tree-cell');
    const rails = [...(grandCell?.querySelectorAll('.bom-tree-rail') ?? [])].map(
      (rail) => (rail as HTMLElement).dataset.line,
    );
    expect(rails).toEqual(['pass', 'elbow']);

    await user.click(tree().getByRole('button', { name: 'SYN-CHILD-1 · 합성 자품목 1 접기' }));

    expect(tree().queryByText('SYN-GRAND-1')).toBeNull();
    expect(
      tree().getByRole('button', { name: 'SYN-CHILD-1 · 합성 자품목 1 펼치기' }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('자품목이 위 단계의 품목을 다시 가리키면 더 내려가지 않는다', async () => {
    renderScreen(
      [
        bomsRoute([bom()], SUB_BOMS),
        componentsRoute,
        componentsOf(502, [component({ bomComponentId: 9101, bomId: 502, componentItemId: 7001 })]),
      ],
      '?item=7001',
    );

    expect(await tree().findByText(t.tree.cycle)).toBeInTheDocument();
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
