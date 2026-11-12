import type { SupplierItemDefault } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SessionProvider } from '../../patterns/session';
import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import { SupplierItemDefaultScreen } from './screen';

const t = messages.supplierItemDefault;
const td = t.dialog;

/** 공장 · 공급사 · 품목 · 단위는 모두 합성 값이다(시험 전용). */
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
  { uomId: 2, uomCode: 'KG', uomName: '킬로그램', decimalScale: 3, isActive: true },
  { uomId: 11, uomCode: '봉지', uomName: '봉지', decimalScale: 0, isActive: true },
  { uomId: 12, uomCode: '박스', uomName: '박스', decimalScale: 0, isActive: true },
];

const PARTNERS = [
  { partnerId: 5101, partnerCode: 'SYN-S1', partnerName: '합성 공급사 가', isActive: true },
  { partnerId: 5102, partnerCode: 'SYN-S2', partnerName: '합성 공급사 나', isActive: true },
];

const item = (
  id: number,
  code: string,
  name: string,
  baseUomId: number,
  storage: number | null,
) => ({
  itemId: id,
  itemCode: code,
  itemName: name,
  itemTypeCode: 'RAW_MATERIAL',
  baseUomId,
  lotControlled: true,
  serialControlTypeCode: 'NONE',
  inspectionRequired: false,
  fifoPolicyCode: 'FIFO',
  negativeStockAllowed: false,
  isActive: true,
  defaultLotStorageUomId: storage,
});

const ITEMS = [
  item(6101, 'SYN-CAP', '합성 캡', 1, 11),
  item(6102, 'SYN-RES', '합성 레진', 2, null),
];

const defaultRow = (
  id: number,
  overrides: Partial<SupplierItemDefault> = {},
): SupplierItemDefault => ({
  supplierItemDefaultId: id,
  plantId: 8401,
  supplierId: 5101,
  supplierCode: 'SYN-S1',
  supplierName: '합성 공급사 가',
  itemId: 6101,
  itemCode: 'SYN-CAP',
  itemName: '합성 캡',
  uomId: 1,
  uomCode: 'EA',
  lotQty: 1000,
  package: { uomId: 11, uomCode: '봉지', count: 10, qtyPerPackage: 100 },
  remarks: null,
  versionNo: 3,
  updatedAt: '2026-11-11T02:02:00Z',
  updatedByName: '합성 관리자',
  ...overrides,
});

const ROWS: SupplierItemDefault[] = [
  defaultRow(1),
  defaultRow(2, {
    supplierId: 5102,
    supplierCode: 'SYN-S2',
    supplierName: '합성 공급사 나',
    itemId: 6102,
    itemCode: 'SYN-RES',
    itemName: '합성 레진',
    uomId: 2,
    uomCode: 'KG',
    lotQty: 25,
    package: null,
    updatedByName: null,
  }),
];

interface Write {
  method: string;
  path: string;
  body: unknown;
}

const setup = (respondWrite?: (method: string, path: string) => Response | undefined) => {
  const writes: Write[] = [];
  const gets: URL[] = [];
  const pathOf = (request: Request) => new URL(request.url).pathname;
  const isGet = (request: Request, path: string) =>
    request.method === 'GET' && pathOf(request) === path;
  const page = (items: unknown[]) => ({ items, page: { page: 1, size: 200, total: items.length } });

  const routes: StubRoute[] = [
    { match: (r) => isGet(r, '/mdm/plants'), respond: () => jsonResponse(page([PLANT])) },
    { match: (r) => isGet(r, '/mdm/uoms'), respond: () => jsonResponse({ items: UOMS }) },
    { match: (r) => isGet(r, '/mdm/partners'), respond: () => jsonResponse(page(PARTNERS)) },
    {
      match: (r) => r.method === 'GET' && pathOf(r).startsWith('/mdm/partners/'),
      respond: (r) =>
        jsonResponse(PARTNERS.find((p) => String(p.partnerId) === pathOf(r).split('/').at(-1))),
    },
    { match: (r) => isGet(r, '/mdm/items'), respond: () => jsonResponse(page(ITEMS)) },
    {
      match: (r) => r.method === 'GET' && /\/mdm\/items\/\d+\/uom-conversions$/.test(pathOf(r)),
      respond: () =>
        jsonResponse({
          items: [
            {
              itemUomConversionId: 1,
              itemId: 6101,
              fromUomId: 11,
              toUomId: 1,
              conversionRate: 100,
              effectiveFrom: '2026-01-01',
              effectiveTo: null,
            },
          ],
        }),
    },
    {
      match: (r) => r.method === 'GET' && /\/mdm\/items\/\d+$/.test(pathOf(r)),
      respond: (r) =>
        jsonResponse({
          item: ITEMS.find((each) => String(each.itemId) === pathOf(r).split('/').at(-1)),
        }),
    },
    {
      match: (r) => isGet(r, '/mdm/supplier-item-defaults'),
      respond: (r) => {
        gets.push(new URL(r.url));
        return jsonResponse(page(ROWS));
      },
    },
    {
      match: (r) => r.method !== 'GET' && pathOf(r).startsWith('/mdm/supplier-item-defaults'),
      respond: async (r) => {
        const text = await r.clone().text();
        const body: unknown = text === '' ? null : JSON.parse(text);
        writes.push({ method: r.method, path: pathOf(r), body });
        const override = respondWrite?.(r.method, pathOf(r));
        if (override !== undefined) return override;
        if (r.method === 'DELETE') return new Response(null, { status: 204 });
        const saved = { ...ROWS[0], ...(body as object), supplierItemDefaultId: 1 };
        return jsonResponse(saved, { status: r.method === 'POST' ? 201 : 200 });
      },
    },
  ];

  renderWithProviders(
    <SessionProvider>
      <SupplierItemDefaultScreen />
    </SessionProvider>,
    {
      fetch: createStubFetch(routes),
      route: '/master-data/supplier-item-defaults',
      dataRouter: true,
      session: {
        ...SYNTHETIC_SESSION,
        scopes: [{ businessUnitId: 8301 }],
        permissions: ['W-06-25'],
      },
    },
  );

  return { user: userEvent.setup(), writes, gets };
};

const table = async () => within(await screen.findByRole('table', { name: t.tableLabel }));
const rowOf = async (code: string) => {
  const found = (await table()).getByText(code).closest('tr');
  if (found === null) throw new Error(`${code} 줄이 없다`);
  return within(found);
};

const openAdd = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: t.add }));
  return within(await screen.findByRole('dialog', { name: td.addTitle }));
};

const pick = async (
  user: ReturnType<typeof userEvent.setup>,
  dialog: ReturnType<typeof within>,
  field: string,
  option: string,
) => {
  await user.click(dialog.getByRole('combobox', { name: field }));
  await user.click(await screen.findByRole('option', { name: option }));
};

describe('W-06-25 공급사·품목 기본 정보', () => {
  it('US1-9 공장의 기본 정보를 공급사 · 품목 · 패키징 · 재고 수량 · 라벨 미리 보기로 보이고, 패키징 없음은 「없음」 · 「—」', async () => {
    const { gets } = setup();

    const cap = (await rowOf('SYN-CAP')).getAllByRole('cell').map((cell) => cell.textContent);
    expect(cap.slice(0, 8)).toEqual([
      '합성 공급사 가 SYN-S1',
      'SYN-CAP 합성 캡',
      'EA',
      '봉지',
      '100 EA',
      '1,000 EA',
      '봉지 10 × 100 = 1,000 EA',
      '11-11 09:02, 합성 관리자',
    ]);
    const resin = (await rowOf('SYN-RES')).getAllByRole('cell').map((cell) => cell.textContent);
    expect(resin.slice(3, 7)).toEqual([t.values.noPackage, t.values.none, '25 KG', '25 KG']);

    expect(screen.getByText(t.count(2))).toBeInTheDocument();
    /* 공장 단위 — 「공장 공통」이 아니라 지금 공장(screens/W-06-25.md 시안과 다른 점). */
    expect(screen.getByText(t.plantNote('합성 1공장'))).toBeInTheDocument();
    expect(gets.at(-1)?.searchParams.get('plantId')).toBe('8401');
  });

  it('US1-9 공급사 · 품목 찾기 칸이 목록을 거르고, 초기화가 되돌린다', async () => {
    const { user } = setup();
    await table();

    await user.type(screen.getByLabelText(t.filters.supplier), '공급사 나');
    expect((await table()).queryByText('SYN-CAP')).toBeNull();
    expect((await table()).getByText('SYN-RES')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.filters.reset }));
    await user.type(screen.getByLabelText(t.filters.item), 'cap');
    expect((await table()).getByText('SYN-CAP')).toBeInTheDocument();
    expect((await table()).queryByText('SYN-RES')).toBeNull();

    await user.clear(screen.getByLabelText(t.filters.item));
    await user.type(screen.getByLabelText(t.filters.item), '없는 품목');
    expect(await screen.findByText(t.empty)).toBeInTheDocument();
  });

  it('US1-9 추가 — 품목을 고르면 품목 기본 보관 단위로 패키징을 채우고, 정수배가 아니면 막고, 맞으면 count 를 계산해 보낸다', async () => {
    const { user, writes } = setup();
    const dialog = await openAdd(user);

    /* 품목을 고르기 전 도움말에 빈 괄호 「기본 단위()」를 두지 않는다(G1). */
    expect(dialog.getByText(td.qtyPerPackageHelp(''))).toBeInTheDocument();
    expect(dialog.queryByText(/기본 단위\(\)/u)).toBeNull();

    await pick(user, dialog, td.supplier, 'SYN-S2 · 합성 공급사 나');
    await pick(user, dialog, td.item, 'SYN-CAP · 합성 캡');

    /* 보관 단위 봉지, 품목 환산 봉지 → EA 100. */
    expect(await dialog.findByText('품목 기본 보관 단위: 봉지 100 EA')).toBeInTheDocument();
    await waitFor(() => expect(dialog.getByLabelText(td.qtyPerPackage)).toHaveValue('100'));
    expect(dialog.getByRole('combobox', { name: td.packageUom })).toHaveTextContent('봉지');

    const lot = dialog.getByLabelText(new RegExp(td.lotQty));
    await user.type(lot, '1050');
    expect(
      dialog.getByText('자재 관리 LOT당 재고 수량 1,050은 패키징 수량 100의 정수배여야 합니다'),
    ).toBeInTheDocument();
    const save = dialog.getByRole('button', { name: td.save });
    expect(save).toBeDisabled();

    await user.clear(lot);
    await user.type(lot, '1000');
    expect(dialog.getByText(/= 봉지 10개/)).toBeInTheDocument();
    expect(save).toBeEnabled();
    await user.click(save);

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({
      method: 'POST',
      path: '/mdm/supplier-item-defaults',
      body: {
        plantId: 8401,
        supplierId: 5102,
        itemId: 6101,
        lotQty: 1000,
        package: { uomId: 11, count: 10, qtyPerPackage: 100 },
        remarks: null,
      },
    });
    expect(await screen.findByText(t.toast.saved('합성 공급사 가', 'SYN-CAP'))).toBeInTheDocument();
  });

  it('US1-9 추가 — 이미 있는 공급사 · 품목은 화면이 막고, 서버 409 DUPLICATE 도 안내한다', async () => {
    const { user } = setup((method) =>
      method === 'POST'
        ? jsonResponse(
            { conflictCause: 'user', code: 'DUPLICATE', message: 'duplicate' },
            { status: 409 },
          )
        : undefined,
    );
    const dialog = await openAdd(user);

    await pick(user, dialog, td.supplier, 'SYN-S1 · 합성 공급사 가');
    await pick(user, dialog, td.item, 'SYN-CAP · 합성 캡');
    expect(
      await dialog.findByText('합성 공급사 가, SYN-CAP는 이미 있습니다 — 목록에서 수정하세요'),
    ).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: td.save })).toBeDisabled();

    /* 화면이 모르는 중복(다른 사람이 방금 만든 것)은 서버가 409 로 막는다. */
    await pick(user, dialog, td.supplier, 'SYN-S2 · 합성 공급사 나');
    await user.type(dialog.getByLabelText(new RegExp(td.lotQty)), '1000');
    await user.click(dialog.getByRole('button', { name: td.save }));
    expect(await dialog.findByText(t.errors.duplicateServer)).toBeInTheDocument();
  });

  it('US1-9 수정 — 「이미 만든 자재 관리 LOT는 바뀌지 않습니다」를 알리고 versionNo 와 함께 보낸다, 패키징 없음이면 package null', async () => {
    const { user, writes } = setup();
    await user.click(
      (await rowOf('SYN-CAP')).getByRole('button', {
        name: t.editRow('합성 공급사 가', 'SYN-CAP'),
      }),
    );
    const dialog = within(await screen.findByRole('dialog', { name: td.editTitle }));

    expect(dialog.getByText(td.unchanged)).toBeInTheDocument();
    /* 수정은 공급사 · 품목을 바꾸지 않는다. */
    expect(dialog.queryByRole('combobox', { name: td.supplier })).toBeNull();

    await user.click(dialog.getByRole('combobox', { name: td.packageUom }));
    await user.click(await screen.findByRole('option', { name: td.noPackage }));
    const lot = dialog.getByLabelText(new RegExp(td.lotQty));
    await user.clear(lot);
    await user.type(lot, '1200');
    await user.type(dialog.getByLabelText(td.remarks), '  봉지 바뀜  ');
    await user.click(dialog.getByRole('button', { name: td.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({
      method: 'PUT',
      path: '/mdm/supplier-item-defaults/1',
      body: { versionNo: 3, lotQty: 1200, package: null, remarks: '봉지 바뀜' },
    });
  });

  it('US1-9 수정 — EA 는 정수만, 다른 사람이 먼저 고쳤으면(409 VERSION_CONFLICT) 다시 불러오기를 준다', async () => {
    const { user, gets } = setup(() =>
      jsonResponse(
        { conflictCause: 'user', code: 'VERSION_CONFLICT', message: 'conflict' },
        { status: 409 },
      ),
    );
    await user.click(
      (await rowOf('SYN-CAP')).getByRole('button', {
        name: t.editRow('합성 공급사 가', 'SYN-CAP'),
      }),
    );
    const dialog = within(await screen.findByRole('dialog', { name: td.editTitle }));

    const lot = dialog.getByLabelText(new RegExp(td.lotQty));
    await user.clear(lot);
    await user.type(lot, '1000.5');
    expect(dialog.getByText('EA는 정수로 넣습니다')).toBeInTheDocument();
    await user.clear(lot);
    await user.type(lot, '2000');
    await user.click(dialog.getByRole('button', { name: td.save }));

    expect(await dialog.findByText(t.errors.conflict)).toBeInTheDocument();
    const before = gets.length;
    await user.click(dialog.getByRole('button', { name: t.errors.reload }));
    await waitFor(() => expect(gets.length).toBeGreaterThan(before));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: td.editTitle })).toBeNull());
  });

  it('US1-9 삭제 — 확인 창이 「이미 발행한 자재 관리 LOT는 바뀌지 않습니다」를 알리고 지운다', async () => {
    const { user, writes } = setup();
    await user.click(
      (await rowOf('SYN-RES')).getByRole('button', {
        name: t.deleteRow('합성 공급사 나', 'SYN-RES'),
      }),
    );
    const confirm = within(await screen.findByRole('dialog', { name: t.deleteDialog.title }));
    expect(confirm.getByText(t.deleteDialog.body)).toBeInTheDocument();

    await user.click(confirm.getByRole('button', { name: t.deleteDialog.confirm }));
    await waitFor(() =>
      expect(writes).toEqual([
        { method: 'DELETE', path: '/mdm/supplier-item-defaults/2', body: null },
      ]),
    );
    expect(await screen.findByText(t.toast.deleted)).toBeInTheDocument();
  });
});
