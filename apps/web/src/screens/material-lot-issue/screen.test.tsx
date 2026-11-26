import type {
  MaterialLotPair,
  MaterialLotSummary,
  MaterialLotTab,
  MaterialLotTabRow,
} from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { plantToday } from '../../patterns/plant-time';
import { SessionProvider } from '../../patterns/session';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import { storageText } from './defaults-text';
import { MaterialLotIssueScreen } from './screen';
import { formatAt } from './types';

const t = messages.materialLotIssue;

/*
 * 시험 받침 — 공장 · 공급사 · 품목 · LOT 은 모두 지어낸 값이다.
 * 합성 공급사 가(8201) · 합성 캡(601, EA, 기본 정보 봉지 10 × 100 = 1,000) — 대기 3개(하나 미출력), 폐기 1개.
 * 합성 공급사 나(8202) · 합성 레진(602, TON, 기본 정보 없음 · 보관 단위 = 기본 단위 TON) — 대기 없음.
 */
const PLANT = {
  plantId: 8401,
  businessUnitId: 8301,
  legalEntityId: 8201,
  plantCode: 'G1',
  plantName: '합성 1공장',
  timezoneCode: 'Asia/Ho_Chi_Minh',
  isActive: true,
};

const UOMS = [
  { uomId: 1, uomCode: 'EA', uomName: '개', decimalScale: 0, isActive: true },
  { uomId: 2, uomCode: 'TON', uomName: '톤', decimalScale: 3, isActive: true },
  { uomId: 3, uomCode: 'BAG', uomName: '봉지', decimalScale: 0, isActive: true },
];

const lot = (lotId: number, over: Partial<MaterialLotSummary> = {}): MaterialLotSummary => ({
  lotId,
  lotNo: `SYN-CAP|1000|261111|SYN-S1|${String(lotId).padStart(4, '0')}`,
  lotQty: 1000,
  package: { uomId: 3, uomCode: 'BAG', uomName: 'BAG', count: 10, qtyPerPackage: 100 },
  supplierLotNo: 'SL-77',
  lifecycleStatusCode: 'WAITING',
  statusCode: 'INSPECTION_PENDING',
  inboundLotId: null,
  inboundLotNo: null,
  lastLabelIssue: { issueSeq: 1, issuedAt: '2026-11-11T01:12:00Z' },
  createdChannelCode: 'POP',
  createdAt: '2026-11-11T01:12:00Z',
  ...over,
});

/** 왼쪽 공급사·품목(피처 014 `material-lot-pairs`) — 캡은 미출력 1 · 생성 예정 37, 레진은 품목 기본값 없음. */
const PAIRS: MaterialLotPair[] = [
  {
    supplier: { supplierId: 8201, code: 'SYN-S1', name: '합성 공급사 가' },
    item: { itemId: 601, code: 'SYN-CAP', name: '합성 캡', baseUomCode: 'EA' },
    unprintedCount: 1,
    creatableCount: 37,
    defaultsStatus: 'OK',
    lotDefaults: { lotQty: 1000, packageUomId: 3, packageUomCode: 'BAG', packageCount: 10 },
    printedCount: 0,
    inspectionRequired: false,
    lastIssuedAt: '2026-11-23T01:00:00Z',
  },
  {
    supplier: { supplierId: 8202, code: 'SYN-S2', name: '합성 공급사 나' },
    item: { itemId: 602, code: 'SYN-RES', name: '합성 레진', baseUomCode: 'TON' },
    unprintedCount: 0,
    creatableCount: 0,
    defaultsStatus: 'NO_DEFAULT',
    lotDefaults: null,
    printedCount: 0,
    inspectionRequired: false,
    lastIssuedAt: null,
  },
];

/** LOT 줄(탭 목록 한 줄) — 캡의 탭마다. */
const row = (
  base: MaterialLotSummary,
  over: Partial<MaterialLotTabRow> = {},
): MaterialLotTabRow => ({
  ...base,
  seq: 1,
  uomCode: 'EA',
  creationModeCode: 'MANUAL',
  purchaseOrderLine: null,
  receivedAt: null,
  voidedAt: null,
  ...over,
});

/** 캡의 탭 넷 — 미출력 2(수동 1 · 자동 1), 출력됨 2, 입하됨 0, 폐기 1. */
const CAP_TABS: Record<MaterialLotTab, MaterialLotTabRow[]> = {
  UNPRINTED: [
    row(lot(3, { lastLabelIssue: null, createdChannelCode: 'WEB' }), { seq: 1 }),
    row(
      lot(5, {
        lotNo: 'SYN-CAP|1000|261123|SYN-S1|0001',
        lastLabelIssue: null,
        createdChannelCode: 'WEB',
      }),
      {
        seq: 2,
        creationModeCode: 'AUTO',
        purchaseOrderLine: { purchaseOrderLineId: 93, purchaseOrderNo: 'PO-SYN-0001', lineNo: 1 },
      },
    ),
  ],
  PRINTED: [row(lot(1)), row(lot(2))],
  RECEIVED: [],
  VOIDED: [row(lot(4, { lifecycleStatusCode: 'VOIDED' }), { voidedAt: '2026-11-12T01:00:00Z' })],
};

interface Write {
  method: string;
  path: string;
  headers: Headers;
  body: unknown;
}

const pathOf = (request: Request): string => new URL(request.url).pathname;
const isGet = (request: Request, path: string | RegExp): boolean =>
  request.method === 'GET' &&
  (typeof path === 'string' ? pathOf(request) === path : path.test(pathOf(request)));
const page = <T,>(items: T[]) => ({ items, page: { page: 1, size: 200, total: items.length } });

/** 데이터 범위 밖 공장 — 코드가 앞서 범위로 거르지 않으면 기본 공장이 된다(G2 L21). */
const OTHER_PLANT = {
  ...PLANT,
  plantId: 8402,
  businessUnitId: 8302,
  plantCode: 'A0',
  plantName: '합성 부품공장',
};

/** 공급사·품목 목록을 부른 조건 — 어느 공장 · 찾기로 불렀는지 잰다. */
const pairQueries: URLSearchParams[] = [];
/** 탭 목록을 부른 조건. */
const lotQueries: URLSearchParams[] = [];

/**
 * 합성 캡(8201 · 601)의 미입고 P/O 라인 — 서버 차례(납기순)로 온다. 채우는 차례(발주일 → P/O 번호 → 라인)는
 * 0001-1 → 0001-2 → 0002-1 이고, 납기가 가장 이른 0002-1 이 맨 뒤다. 0003-1 은 단위(BAG)가 달라 배정 대상이 아니다.
 */
const PO_LINES = [
  {
    purchaseOrderLineId: 91,
    purchaseOrderNo: 'PO-SYN-0002',
    lineNo: 1,
    orderDate: '2026-11-03',
    expectedReceiptDate: '2026-11-10',
    remainingQty: 300,
    uomId: 1,
    supplierId: 8201,
    itemId: 601,
  },
  {
    purchaseOrderLineId: 92,
    purchaseOrderNo: 'PO-SYN-0001',
    lineNo: 2,
    orderDate: '2026-11-01',
    expectedReceiptDate: '2026-11-20',
    remainingQty: 200,
    uomId: 1,
    supplierId: 8201,
    itemId: 601,
  },
  {
    purchaseOrderLineId: 93,
    purchaseOrderNo: 'PO-SYN-0001',
    lineNo: 1,
    orderDate: '2026-11-01',
    expectedReceiptDate: null,
    remainingQty: 1000,
    uomId: 1,
    supplierId: 8201,
    itemId: 601,
  },
  {
    purchaseOrderLineId: 94,
    purchaseOrderNo: 'PO-SYN-0003',
    lineNo: 1,
    orderDate: '2026-11-02',
    expectedReceiptDate: '2026-11-05',
    remainingQty: 5,
    uomId: 3,
    supplierId: 8201,
    itemId: 601,
  },
];

/** 미입고 P/O 를 부른 조건 — 공장 · 공급사 · 품목 · 미입고만으로 부르는지 잰다. */
const poLineQueries: URLSearchParams[] = [];

const setup = (
  options: {
    voidFails?: number[];
    plants?: (typeof PLANT)[];
    uoms?: readonly (typeof UOMS)[number][];
    /** 캡 미출력 탭의 생성 결과 상태. */
    generation?: 'OK' | 'NO_DEFAULT' | 'NO_OPEN_PO' | 'NO_CONVERSION';
    /** 미출력 탭을 비운다(입하 예정 없음 등). */
    noUnprinted?: boolean;
    /** 탭 목록 응답을 붙잡는다 — 로딩을 잰다. */
    lotsGate?: Promise<void>;
    reviseFail?: { status: number; code: string };
  } = {},
) => {
  const writes: Write[] = [];
  pairQueries.length = 0;
  lotQueries.length = 0;
  poLineQueries.length = 0;
  const fetch = createStubFetch([
    {
      match: (r) => isGet(r, '/mdm/plants'),
      respond: () => jsonResponse(page(options.plants ?? [PLANT])),
    },
    {
      match: (r) => isGet(r, '/logistics/material-lot-pairs'),
      respond: (r) => {
        const query = new URL(r.url).searchParams;
        pairQueries.push(query);
        const q = (query.get('q') ?? '').toLocaleLowerCase('ko-KR');
        const items = PAIRS.filter(
          (pair) =>
            q === '' ||
            [pair.supplier.code, pair.supplier.name, pair.item.code, pair.item.name].some((v) =>
              v.toLocaleLowerCase('ko-KR').includes(q),
            ),
        );
        return jsonResponse({
          items,
          page: {
            page: Number(query.get('page') ?? 1),
            size: Number(query.get('size') ?? 50),
            total: items.length,
          },
          summary: { unprintedCount: 1 },
        });
      },
    },
    {
      match: (r) => isGet(r, '/logistics/material-lots'),
      respond: async (r) => {
        const query = new URL(r.url).searchParams;
        lotQueries.push(query);
        if (options.lotsGate !== undefined) await options.lotsGate;
        const tab = (query.get('tab') ?? 'UNPRINTED') as MaterialLotTab;
        const isCap = query.get('itemId') === '601';
        const rows =
          isCap && !(tab === 'UNPRINTED' && options.noUnprinted === true) ? CAP_TABS[tab] : [];
        const creatable = isCap && options.generation !== 'NO_DEFAULT' ? 36 : 0;
        return jsonResponse({
          items: rows,
          page: {
            page: Number(query.get('page') ?? 1),
            size: Number(query.get('size') ?? 10),
            total: rows.length + (tab === 'UNPRINTED' ? creatable : 0),
          },
          generation:
            tab === 'UNPRINTED'
              ? {
                  status: options.generation ?? (isCap ? 'OK' : 'NO_DEFAULT'),
                  createdNow: 1,
                  creatableRemaining: creatable,
                }
              : null,
        });
      },
    },
    {
      match: (r) => isGet(r, '/mdm/uoms'),
      respond: () => jsonResponse({ items: options.uoms ?? UOMS }),
    },
    {
      match: (r) => isGet(r, /^\/mdm\/items\/\d+$/),
      respond: (r) => {
        const itemId = Number(pathOf(r).split('/').at(-1));
        return jsonResponse({
          item: {
            itemId,
            baseUomId: itemId === 601 ? 1 : 2,
            /* 레진은 보관 단위가 기본 단위와 같다(T050). */
            defaultLotStorageUomId: itemId === 601 ? 3 : 2,
            /* 캡은 봉지 10개(1,000 EA)가 LOT 기본크기다 — 봉지 1 = 100 EA 환산. */
            ...(itemId === 601
              ? { defaultProductionLotSize: 10, defaultPackageUomId: 3, defaultPackageCount: 10 }
              : {}),
          },
        });
      },
    },
    {
      match: (r) => isGet(r, /^\/mdm\/items\/\d+\/uom-conversions$/),
      respond: (r) =>
        jsonResponse({
          items: pathOf(r).includes('/601/')
            ? [
                {
                  itemUomConversionId: 1,
                  itemId: 601,
                  fromUomId: 3,
                  toUomId: 1,
                  conversionRate: 100,
                  effectiveFrom: '2026-01-01',
                  effectiveTo: null,
                },
              ]
            : [],
        }),
    },
    {
      match: (r) => isGet(r, '/logistics/purchase-order-lines'),
      respond: (r) => {
        const query = new URL(r.url).searchParams;
        poLineQueries.push(query);
        return jsonResponse(
          page(
            PO_LINES.filter(
              (line) =>
                String(line.supplierId) === query.get('supplierId') &&
                String(line.itemId) === query.get('itemId'),
            ),
          ),
        );
      },
    },
    {
      match: (r) => r.method !== 'GET',
      respond: async (r) => {
        const text = await r.clone().text();
        const body: unknown = text === '' ? null : JSON.parse(text);
        writes.push({ method: r.method, path: pathOf(r), headers: r.headers, body });
        if (pathOf(r).endsWith(':revise')) {
          if (options.reviseFail !== undefined) {
            return jsonResponse(
              {
                errors: [
                  {
                    scope: 'screen',
                    code: options.reviseFail.code,
                    message: options.reviseFail.code,
                  },
                ],
              },
              { status: options.reviseFail.status },
            );
          }
          const revised = body as { qty: number };
          return jsonResponse(
            row(
              lot(5, {
                lotNo: `SYN-CAP|${String(revised.qty)}|261123|SYN-S1|0002`,
                lotQty: revised.qty,
              }),
            ),
          );
        }
        if (pathOf(r) === '/trace/lots:void') {
          const lotIds = (body as { lotIds: number[] }).lotIds;
          return jsonResponse({
            items: lotIds.map((lotId) => ({
              lotId,
              lotNo: lot(lotId).lotNo,
              voided: !(options.voidFails ?? []).includes(lotId),
              errorCode: (options.voidFails ?? []).includes(lotId) ? 'STATE_LOCKED' : null,
            })),
          });
        }
        return jsonResponse({ batchId: 5, lots: [lot(11), lot(12), lot(13)] }, { status: 201 });
      },
    },
  ]);
  /* 공장 기본값이 세션 데이터 범위를 따른다(G2 L21) — 화면은 셸의 세션 안에서 선다. */
  renderWithProviders(
    <SessionProvider>
      <MaterialLotIssueScreen />
    </SessionProvider>,
    {
      fetch,
      route: '/logistics/material-lot-issue',
      session: { ...SYNTHETIC_SESSION, scopes: [{ businessUnitId: 8301 }] },
    },
  );
  return { user: userEvent.setup(), writes };
};

const listTable = async () => within(await screen.findByRole('table', { name: t.list.label }));
const rowOf = async (code: string) => {
  const cell = (await listTable()).getByText(code);
  const found = cell.closest('tr');
  if (found === null) throw new Error(`${code} 줄이 없다`);
  return found;
};
const tp = t.precreate;
/** 줄을 누르면 오른쪽 구획(입고 관리 짜임)에 그 공급사·품목이 나온다 — 덮개 창이 아니다. */
const openDetail = async (user: ReturnType<typeof userEvent.setup>, code: string) => {
  await user.click(await rowOf(code));
  const pane = await screen.findByRole('region', { name: t.detail.label });
  await waitFor(() =>
    expect(within(pane).getByRole('group', { name: t.detail.label })).toHaveTextContent(code),
  );
  return within(pane);
};
const lotTable = async (pane: ReturnType<typeof within>, tab: MaterialLotTab) =>
  within(await pane.findByRole('table', { name: tp.tabs[tab] }));

describe('W-01-14 자재 관리 LOT 발행 — 목록(피처 014 · 서버 쪽)', () => {
  it('가정-W0114 FR-010 공급사·품목 목록은 material-lot-pairs 로 받고 기본 정보 · 미출력 · 생성 예정을 보이며 라벨 단추가 없다', async () => {
    setup();

    const cap = within(await rowOf('SYN-CAP'));
    const cells = cap.getAllByRole('cell').map((cell) => cell.textContent);
    expect(cells[0]).toBe('합성 공급사 가 SYN-S1');
    expect(cells[1]).toBe('SYN-CAP');
    expect(cells[2]).toBe('합성 캡');
    expect(cells[3]).toBe('EA');
    expect(cells[4]).toBe(tp.defaultPackaged('1,000 EA', 'BAG 10'));
    expect(cells[5]).toBe('1');
    expect(cells[6]).toBe('37');
    /* T051 최근 발행 — 조합 목록 lastIssuedAt, 없으면 「—」. */
    expect(cells[7]).toBe(formatAt('2026-11-23T01:00:00Z'));
    expect(
      screen.getByRole('columnheader', { name: t.list.columns.lastIssued }),
    ).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: tp.columns.creatable })).toBeInTheDocument();

    const resin = within(await rowOf('SYN-RES'));
    expect(resin.getByText(tp.noDefault)).toBeInTheDocument();
    expect(resin.getAllByRole('cell').at(-1)?.textContent).toBe('—');

    expect(Object.fromEntries(pairQueries[0] ?? [])).toMatchObject({ plantId: '8401', page: '1' });
    expect(document.body.textContent).not.toMatch(/[MPW]-0\d-\d\d/u);
    expect(screen.queryByRole('button', { name: /라벨|인쇄/ })).not.toBeInTheDocument();
  });

  it('가정-W0114 조건은 공장 · 찾기 하나 — 공급사 고르기 · 「대기 있는 것만」은 없고, 찾기는 서버 q 로', async () => {
    const { user } = setup();
    await listTable();

    const bar = within(screen.getByRole('region', { name: t.filters.label }));
    expect(bar.queryByRole('combobox', { name: t.filters.supplier })).toBeNull();
    expect(bar.queryByRole('checkbox', { name: t.filters.waitingOnly })).toBeNull();
    await user.type(bar.getByRole('searchbox', { name: tp.search }), '레진');

    await waitFor(() => expect(pairQueries.at(-1)?.get('q')).toBe('레진'));
    await waitFor(() => expect(screen.queryByText('SYN-CAP')).not.toBeInTheDocument());
  });

  it('G2 L21 공장은 사용자 데이터 범위의 공장으로 열린다(코드가 앞선 범위 밖 공장이 아님)', async () => {
    setup({ plants: [OTHER_PLANT, PLANT] });

    await listTable();
    expect(pairQueries.map((query) => query.get('plantId'))).toEqual(['8401']);
    expect(screen.queryByRole('combobox', { name: t.filters.plant })).toBeNull();
  });

  it('G2 L21 공장이 여럿이면 공장 칸에도 「공장」 이름이 붙는다', async () => {
    setup({
      plants: [PLANT, { ...PLANT, plantId: 8403, plantCode: 'G2', plantName: '합성 2공장' }],
    });
    await listTable();

    const bar = within(screen.getByRole('region', { name: t.filters.label }));
    expect(bar.getByText(t.filters.plant)).toBeVisible();
    expect(bar.getByRole('combobox', { name: t.filters.plant })).toHaveTextContent('합성 1공장');
  });

  it('G2 L17 품목 기본 보관 단위 글은 단위 이름(봉지)으로', () => {
    const bag = { uomId: 3, uomCode: 'SYN-BAG', uomName: '봉지', decimalScale: 0 };
    expect(storageText({ uomId: 3, qtyPerPackage: 100 }, [bag], 'EA')).toBe('봉지 100 EA');
    expect(storageText({ uomId: 3, qtyPerPackage: null }, [{ ...bag, uomName: '' }], 'EA')).toBe(
      'SYN-BAG',
    );
  });
});

describe('W-01-14 상세 — 탭 넷(피처 014 Q17)', () => {
  it('Q17 US1-1 미출력 탭은 고르면 만들면서 받고, 차례 · P/O · 만든 방식 · [수정]과 아직 만들지 않은 몫을 보인다', async () => {
    const { user } = setup();
    const pane = await openDetail(user, 'SYN-CAP');

    const table = await lotTable(pane, 'UNPRINTED');
    const rows = table.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveTextContent(tp.mode.AUTO);
    expect(rows[1]).toHaveTextContent(tp.poLine('PO-SYN-0001', 1));
    expect(rows[0]).toHaveTextContent(tp.mode.MANUAL);
    expect(
      within(rows[0] as HTMLElement).getByRole('button', {
        name: tp.revise.actionName(lot(3).lotNo),
      }),
    ).toBeInTheDocument();
    expect(pane.getByText(tp.notCreatedYet(36))).toBeInTheDocument();
    expect(pane.getByText(messages.screenPatterns.pageNav.total(38))).toBeInTheDocument();
    expect(Object.fromEntries(lotQueries[0] ?? [])).toMatchObject({
      plantId: '8401',
      supplierId: '8201',
      itemId: '601',
      tab: 'UNPRINTED',
      page: '1',
    });
    expect(
      pane.getByText(tp.headDefault(tp.defaultPackaged('1,000 EA', 'BAG 10 × 100'))),
    ).toBeInTheDocument();
    expect(pane.queryByRole('button', { name: /라벨|인쇄/ })).not.toBeInTheDocument();
  });

  it('고른 줄을 다시 누르면 고르기를 풀고 오른쪽이 「고르세요」로 돌아간다', async () => {
    const { user } = setup();
    await openDetail(user, 'SYN-CAP');

    await user.click(await rowOf('SYN-CAP'));

    const pane = await screen.findByRole('region', { name: t.detail.label });
    expect(await within(pane).findByText(t.detail.choose)).toBeInTheDocument();
  });

  it('US2-3 조회 · 생성 중에는 로딩 문구를 보인다', async () => {
    let open = (): void => undefined;
    const lotsGate = new Promise<void>((resolve) => {
      open = resolve;
    });
    const { user } = setup({ lotsGate });
    const pane = await openDetail(user, 'SYN-CAP');

    expect(await pane.findByText(tp.loading)).toBeInTheDocument();
    open();
    await waitFor(() => expect(pane.queryByText(tp.loading)).toBeNull());
  });

  it('US1-4 SC-005 기본값이 없으면 「기본 단위 설정이 안되어있습니다…」, 발행 단추는 그대로', async () => {
    const { user } = setup();
    const pane = await openDetail(user, 'SYN-RES');

    expect(await pane.findByText(tp.notes.NO_DEFAULT)).toBeInTheDocument();
    expect(pane.getByRole('button', { name: t.detail.issue })).toBeEnabled();
  });

  it('가정-W0114 T050 품목 기본 보관 단위가 기본 단위와 같으면 「없음」이 아니라 그 단위(TON)를 적는다', async () => {
    const { user } = setup();
    const pane = await openDetail(user, 'SYN-RES');

    const term = await pane.findByText(t.detail.storageUom);
    await waitFor(() => expect(term.nextElementSibling).toHaveTextContent('TON'));
    expect(term.nextElementSibling).not.toHaveTextContent(t.detail.storageNone);
  });

  it('US1-5 SC-005 입하 예정 계획이 없으면 빈 표 대신 표 자리에 알림', async () => {
    const first = setup({ generation: 'NO_OPEN_PO', noUnprinted: true });
    const pane = await openDetail(first.user, 'SYN-CAP');

    expect(await pane.findByText(tp.notes.NO_OPEN_PO)).toBeInTheDocument();
    expect(pane.queryByRole('table', { name: tp.tabs.UNPRINTED })).toBeNull();
  });

  it('US4-4 출력됨(입하 전) 탭은 [수정]이 없고 폐기는 된다 · 폐기 LOT 탭은 고를 수 없다', async () => {
    const { user } = setup();
    const pane = await openDetail(user, 'SYN-CAP');
    await lotTable(pane, 'UNPRINTED');

    await user.click(pane.getByRole('tab', { name: tp.tabs.PRINTED }));
    const printed = await lotTable(pane, 'PRINTED');
    expect(printed.getAllByRole('row')).toHaveLength(3);
    expect(printed.queryByRole('button', { name: /수정/u })).toBeNull();
    await user.click(printed.getByRole('checkbox', { name: t.detail.pick(lot(1).lotNo) }));
    expect(pane.getByRole('button', { name: t.detail.void(1) })).toBeEnabled();

    await user.click(pane.getByRole('tab', { name: tp.tabs.VOIDED }));
    const voided = await lotTable(pane, 'VOIDED');
    expect(voided.queryAllByRole('checkbox')).toHaveLength(0);
    expect(voided.getByText(t.detail.status.VOIDED)).toBeInTheDocument();
  });

  it('미입고 P/O 는 입하 마감이 채우는 차례(발주일 → P/O 번호 → 라인)로 보이고, 단위가 다른 라인은 뺀다', async () => {
    const { user } = setup();

    const pane = await openDetail(user, 'SYN-CAP');
    const table = within(await pane.findByRole('table', { name: t.poLines.title }));
    const rows = table
      .getAllByRole('row')
      .slice(1)
      .map((each) =>
        within(each)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      );
    expect(rows).toEqual([
      ['PO-SYN-0001', '1', '2026.11.01', '—', '1,000 EA'],
      ['PO-SYN-0001', '2', '2026.11.01', '2026.11.20', '200 EA'],
      ['PO-SYN-0002', '1', '2026.11.03', '2026.11.10', '300 EA'],
    ]);
    expect(Object.fromEntries(poLineQueries[0] ?? [])).toMatchObject({
      plantId: '8401',
      supplierId: '8201',
      itemId: '601',
      openOnly: 'true',
    });
  });

  it('US1-8 미출력 LOT 폐기 — 고른 LOT 를 :void 로 보내고 건별 실패는 「N개 폐기 · 실패 N」으로 묶는다', async () => {
    const { user, writes } = setup({ voidFails: [5] });
    const pane = await openDetail(user, 'SYN-CAP');
    const table = await lotTable(pane, 'UNPRINTED');

    await user.click(table.getByRole('checkbox', { name: t.detail.pick(lot(3).lotNo) }));
    await user.click(
      table.getByRole('checkbox', { name: t.detail.pick('SYN-CAP|1000|261123|SYN-S1|0001') }),
    );
    await user.click(pane.getByRole('button', { name: t.detail.void(2) }));

    const confirm = within(await screen.findByRole('dialog', { name: t.void.title(2) }));
    await user.click(confirm.getByRole('button', { name: t.void.confirm(2) }));

    await waitFor(() =>
      expect(writes.filter((w) => w.path === '/trace/lots:void')).toHaveLength(1),
    );
    expect(writes.find((w) => w.path === '/trace/lots:void')?.body).toEqual({ lotIds: [3, 5] });
    expect(await screen.findByText(t.toast.voidedPartly(1, 1))).toBeInTheDocument();
  });
});

describe('W-01-14 발행 창(수동)', () => {
  const openIssue = async (user: ReturnType<typeof userEvent.setup>, code: string) => {
    const pane = await openDetail(user, code);
    await user.click(pane.getByRole('button', { name: t.detail.issue }));
    return within(await screen.findByRole('dialog', { name: t.dialog.title }));
  };

  it('US1-8 발행 창은 품목 기본값으로 채우고(바꿀 수 있음) POP 과 같은 본문으로 발행한다', async () => {
    const { user, writes } = setup();
    const dialog = await openIssue(user, 'SYN-CAP');

    expect(await dialog.findByText(t.dialog.source.item)).toBeInTheDocument();
    expect(dialog.getByLabelText(t.dialog.packageCount)).toHaveValue('10');
    expect(dialog.getByLabelText(t.dialog.lotQty)).toHaveValue('1000');

    await user.type(dialog.getByLabelText(t.dialog.supplierLotNo), 'SL-77');
    await user.type(dialog.getByLabelText(t.dialog.lotCount), '3');
    await user.click(dialog.getByRole('button', { name: t.dialog.submit(3) }));

    await waitFor(() =>
      expect(writes.filter((w) => w.path === '/logistics/material-lot-batches')).toHaveLength(1),
    );
    const sent = writes.find((w) => w.path === '/logistics/material-lot-batches');
    expect(sent?.headers.get('X-Worker-No')).toBeNull();
    expect(sent?.body).toEqual({
      plantId: 8401,
      supplierId: 8201,
      itemId: 601,
      lotQty: 1000,
      package: { uomId: 3, count: 10, qtyPerPackage: 100 },
      supplierLotNo: 'SL-77',
      lotCount: 3,
      businessDate: plantToday(),
      occurredAt: expect.any(String) as string,
    });
    expect(await screen.findByText(t.toast.issued(3))).toBeInTheDocument();
  });

  it('G2 L17 발행 창 패키징 단위는 이름(봉지)으로', async () => {
    const { user } = setup({
      uoms: UOMS.map((uom) => (uom.uomId === 3 ? { ...uom, uomCode: 'SYN-BAG' } : uom)),
    });
    const dialog = await openIssue(user, 'SYN-CAP');

    await waitFor(() =>
      expect(dialog.getByRole('combobox', { name: t.dialog.packageUom })).toHaveTextContent('봉지'),
    );
  });

  it('US1-8 발행 창 — 재고 수량이 패키징 곱과 다르면 알리고 발행을 잠근다', async () => {
    const { user } = setup();
    const dialog = await openIssue(user, 'SYN-CAP');

    const qty = await dialog.findByLabelText(t.dialog.lotQty);
    await user.tripleClick(qty);
    await user.keyboard('950');
    await user.type(dialog.getByLabelText(t.dialog.lotCount), '2');

    expect(
      dialog.getByText(t.dialog.errors.mismatch('950 EA', '봉지 10 × 100', '1,000 EA')),
    ).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: t.dialog.submit(null) })).toBeDisabled();
  });

  it('US1-8 발행 창 — 품목 기본값도 보관 단위도 없으면 「직접 입력」으로 패키징 없이 시작한다', async () => {
    const { user } = setup();
    const dialog = await openIssue(user, 'SYN-RES');

    expect(await dialog.findByText(t.dialog.source.none)).toBeInTheDocument();
    expect(dialog.getByLabelText(t.dialog.lotQty)).toHaveValue('');
  });
});

describe('W-01-14 [수정](피처 014 FR-016 · FR-017)', () => {
  const openRevise = async (user: ReturnType<typeof userEvent.setup>) => {
    const pane = await openDetail(user, 'SYN-CAP');
    const table = await lotTable(pane, 'UNPRINTED');
    await user.click(
      table.getByRole('button', {
        name: tp.revise.actionName('SYN-CAP|1000|261123|SYN-S1|0001'),
      }),
    );
    return within(await screen.findByRole('dialog', { name: tp.revise.title }));
  };

  it('US3-1 패키징 수를 8 로 고치면 재고 수량이 800 을 따르고, 저장하면 :revise 로(사번 없이) 보내 번호를 새로 받는다', async () => {
    const { user, writes } = setup();
    const dialog = await openRevise(user);

    const count = dialog.getByLabelText(tp.revise.packageCount);
    await user.clear(count);
    await user.type(count, '8');
    expect(dialog.getByLabelText(tp.revise.qty)).toHaveValue('800');
    expect(dialog.getByText(tp.revise.renumber)).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: tp.revise.save }));

    await waitFor(() => expect(writes.filter((w) => w.path.endsWith(':revise'))).toHaveLength(1));
    const sent = writes.find((w) => w.path.endsWith(':revise'));
    expect(sent?.path).toBe('/logistics/material-lots/5:revise');
    expect(sent?.body).toEqual({ qty: 800, package: { uomId: 3, count: 8, qtyPerPackage: 100 } });
    expect(sent?.headers.get('X-Worker-No')).toBeNull();
    expect(sent?.headers.get('Idempotency-Key')).not.toBeNull();
    expect(
      await screen.findByText(tp.revise.saved('SYN-CAP|800|261123|SYN-S1|0002')),
    ).toBeInTheDocument();
  });

  it('US3-2 곱이 맞지 않으면 저장이 잠긴다', async () => {
    const { user } = setup();
    const dialog = await openRevise(user);

    const count = dialog.getByLabelText(tp.revise.packageCount);
    await user.clear(count);
    await user.type(count, '7');
    const qty = dialog.getByLabelText(tp.revise.qty);
    await user.tripleClick(qty);
    await user.keyboard('800');

    expect(dialog.getByRole('alert')).toHaveTextContent('≠');
    expect(dialog.getByRole('button', { name: tp.revise.save })).toBeDisabled();
  });

  it('US3-3 서버가 409 ALREADY_PRINTED 로 거절하면 알리고 목록을 다시 받는다', async () => {
    const { user } = setup({ reviseFail: { status: 409, code: 'ALREADY_PRINTED' } });
    const dialog = await openRevise(user);
    const asked = lotQueries.length;

    await user.click(dialog.getByRole('button', { name: tp.revise.save }));

    expect(await screen.findByText(tp.revise.alreadyPrinted)).toBeInTheDocument();
    await waitFor(() => expect(lotQueries.length).toBeGreaterThan(asked));
  });
});
