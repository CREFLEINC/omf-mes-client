import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { jsonResponse } from '../../test/api-harness';
import { initialLotId } from './find-by-wo';
import {
  lookupOf,
  pressKeys,
  receivedOf,
  renderReturn,
  splitLotOf,
  woLotOf,
  workOrderOf,
} from './test-kit';

/*
 * P-01-03 「라벨이 없어요 · W/O 로 찾기」 → 반납 → 라벨 찍기(피처 019 · US4 · 시안 ③). 합성값만 쓴다.
 */

const t = messages.materialReturn;
const B_S1 = 'SYN-M00000220261127000041';

beforeEach(() => {
  globalThis.localStorage.clear();
});

afterEach(() => {
  delete window.pop;
  globalThis.localStorage.clear();
});

/** 셸 인쇄 — 찍은 라벨 이름을 모은다(`texts` 에는 라벨 명령 글자). */
const shellPrints = () => {
  const saved: string[] & { texts?: string[] } = [];
  saved.texts = [];
  window.pop = {
    rendition: {
      save: (bytes: Uint8Array, label: string) => {
        saved.push(label);
        saved.texts?.push(new TextDecoder().decode(bytes));
        return Promise.resolve('/tmp/x.tspl');
      },
    },
  } as unknown as typeof window.pop;
  return saved;
};

const openFind = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: t.pop.byWorkOrder }));
  return screen.findByRole('dialog', { name: t.findByWo.title });
};

const WORK_ORDERS = [
  workOrderOf(),
  workOrderOf({
    workOrderId: 620,
    workOrderNo: 'WO-SYN-0008',
    unprintedLotCount: 0,
    lastIssuedAt: '2026-11-27T00:55:00Z',
  }),
  workOrderOf({
    workOrderId: 601,
    workOrderNo: 'WO-SYN-0002',
    unprintedLotCount: 0,
    finalized: true,
    lastIssuedAt: '2026-11-25T01:10:00Z',
    returnableMaterial: {
      item: { itemId: 23, itemCode: 'SYN-A100', itemName: '합성 볼트 M4×10' },
      otherItemCount: 0,
    },
  }),
];

const LOTS = [
  woLotOf(),
  woLotOf({
    lotId: 539,
    lotNo: 'SYN-M00000220261127000039',
    item: { itemId: 22, itemCode: 'SYN-D015', itemName: '합성 나사 와셔' },
    labelUnprinted: false,
    issueQty: 200,
    returnableQty: 150,
  }),
];

describe('P-01-03 W/O 로 찾기', () => {
  it('US4-1 반납이 남은 W/O 가 최근 순으로 「라벨 미발행 n」·「최종 마감」과 함께 보이고, 번호 일부로 찾는다', async () => {
    const user = userEvent.setup();
    const { sent } = renderReturn({
      workOrders: (query) =>
        query === null ? WORK_ORDERS : WORK_ORDERS.filter((wo) => wo.workOrderNo.includes(query)),
    });

    const dialog = await openFind(user);
    const list = await within(dialog).findByRole('list', { name: t.findByWo.recent });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('WO-SYN-0011'),
      expect.stringContaining('WO-SYN-0008'),
      expect.stringContaining('WO-SYN-0002'),
    ]);
    expect(within(items[0] as HTMLElement).getByText(t.findByWo.unprinted(1))).toBeTruthy();
    expect(within(items[2] as HTMLElement).getByText(t.findByWo.finalized)).toBeTruthy();
    /* 줄에는 W/O 생산 품목이 아니라 그 W/O 로 나간 자재 — 다른 품목이 있으면 「외 n」, 없으면 품목만(시안 ③-1). */
    expect(items[0]?.textContent).toContain('SYN-B220 합성 하우징 커버 외 2 · 공정 20 조립 · L2');
    expect(items[0]?.textContent).not.toContain('SYN-P900');
    expect(items[2]?.textContent).toContain('SYN-A100 합성 볼트 M4×10 · 공정 20 조립 · L2');
    expect(items[2]?.textContent).not.toContain('외');

    await user.click(within(dialog).getByRole('searchbox', { name: t.findByWo.search }));
    const search = await screen.findByRole('dialog', {
      name: messages.popUniform.scan.manualTitle(t.findByWo.search),
    });
    await user.type(within(search).getByRole('textbox'), '0011');
    await user.click(within(search).getByRole('button', { name: messages.popUniform.scan.search }));

    await waitFor(() => {
      expect(
        within(within(dialog).getByRole('list', { name: t.findByWo.recent })).getAllByRole(
          'listitem',
        ),
      ).toHaveLength(1);
    });
    expect(
      sent.some(
        (each) =>
          each.path === '/production/material-returns/work-orders' &&
          each.search.get('q') === '0011',
      ),
    ).toBe(true);
  });

  it('US4-2 · US4-3 W/O 를 고르면 그 W/O 의 LOT 이 미발행 먼저 보이고, 한 품목에 미발행이 하나면 자동 선택된다', async () => {
    const user = userEvent.setup();
    renderReturn({ workOrders: () => WORK_ORDERS, workOrderLots: () => LOTS });

    const dialog = await openFind(user);
    await user.click(await within(dialog).findByText('WO-SYN-0011'));

    const lots = await within(dialog).findByRole('group', { name: t.findByWo.lotTable.label });
    const rows = within(lots).getAllByRole('row').slice(1);
    expect(rows[0]?.textContent).toContain(B_S1);
    expect(within(rows[0] as HTMLElement).getByText(t.findByWo.labelUnprinted)).toBeTruthy();
    expect(within(rows[0] as HTMLElement).getByText(t.findByWo.autoPicked)).toBeTruthy();
    expect(rows[0]?.getAttribute('aria-selected')).toBe('true');
    /* 고른 LOT 의 수량 칸이 열린다(빈칸에서 시작). */
    expect(
      (within(dialog).getByRole('textbox', { name: t.findByWo.qty }) as HTMLInputElement).value,
    ).toBe('');
  });

  it('US4-3 미발행 LOT 이 여럿이면 자동으로 고르지 않는다', () => {
    expect(initialLotId([woLotOf({ lotId: 1 }), woLotOf({ lotId: 2 })])).toBeNull();
    expect(
      initialLotId([woLotOf({ lotId: 1 }), woLotOf({ lotId: 2, labelUnprinted: false })]),
    ).toBe(1);
    expect(initialLotId([woLotOf({ lotId: 9, labelUnprinted: false })])).toBe(9);
  });

  it('US4-4 · US4-5 LOT · 수량을 담으면 「W/O 로 찾음」 줄이 되고, 보내면 고른 W/O 가 실리며 미발행이면 라벨 찍기가 이어 뜬다', async () => {
    const user = userEvent.setup();
    const saved = shellPrints();
    const { sent } = renderReturn({
      workOrders: () => WORK_ORDERS,
      workOrderLots: () => LOTS,
      lookup: (lotNo) =>
        jsonResponse(
          lookupOf({
            lotId: 541,
            lotNo,
            item: { itemId: 21, itemCode: 'SYN-B220', itemName: '합성 하우징 커버' },
            returnableQty: 300,
            workOrder: { workOrderId: 635, workOrderNo: 'WO-SYN-0011', finalized: false },
            labelUnprinted: true,
          }),
        ),
      receive: (body) => jsonResponse(receivedOf(body, [541]), { status: 201 }),
      splitLots: [splitLotOf(541, B_S1)],
    });

    const dialog = await openFind(user);
    await user.click(await within(dialog).findByText('WO-SYN-0011'));
    await within(dialog).findByRole('group', { name: t.findByWo.lotTable.label });
    await pressKeys(user, '40');
    await user.click(within(dialog).getByRole('button', { name: t.findByWo.add }));

    /* 창이 닫히고 목록에 「W/O 로 찾음」 줄. W/O 번호는 목록에 그리지 않는다. */
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: t.findByWo.title })).toBeNull();
    });
    const table = screen.getByRole('group', { name: t.pop.table.label });
    expect(within(table).getByText(t.pop.byWorkOrderChip)).toBeTruthy();
    expect(within(table).queryByText('WO-SYN-0011')).toBeNull();
    expect(sent.find((each) => each.path.endsWith('/lot-lookup'))?.search.get('lotNo')).toBe(B_S1);

    await user.click(screen.getByRole('button', { name: t.pop.submit(1) }));
    const label = await screen.findByRole('dialog', { name: t.label.title(1) });
    const post = sent.find(
      (each) => each.method === 'POST' && each.path === '/production/material-returns',
    );
    expect((post?.body as { lines: unknown[] }).lines).toEqual([
      { lotId: 541, returnQty: 40, workOrderId: 635 },
    ]);

    await within(label).findByText(B_S1);
    /* 라벨 수량은 이번 반납 수량 40 — 분할 LOT 목록의 처음 나간 양 300 이 아니다(시안 ③-3 · F-04). */
    expect(within(label).getByText('40 EA')).toBeTruthy();
    expect(within(label).queryByText('300 EA')).toBeNull();
    await user.click(within(label).getByRole('button', { name: t.label.print }));
    await screen.findByText(t.label.printed(1));

    const issue = sent.find(
      (each) => each.method === 'POST' && each.path === '/app/document-issues',
    );
    expect(issue?.body).toMatchObject({
      documentTypeCode: 'MATERIAL_LOT_LABEL',
      targets: [{ targetTypeCode: 'LOT', targetId: 541 }],
    });
    expect(saved).toHaveLength(1);
    expect(saved.texts?.[0]).toContain('40');
    expect(saved.texts?.[0]).not.toContain('300');
  });

  it('US4-5 라벨 찍기 창의 [나중에]는 찍지 않고 닫는다(분할 LOT 라벨 탭에 남는다)', async () => {
    const user = userEvent.setup();
    const { sent } = renderReturn({
      lookup: (lotNo) => jsonResponse(lookupOf({ lotId: 541, lotNo, labelUnprinted: true })),
      receive: (body) => jsonResponse(receivedOf(body, [541]), { status: 201 }),
      splitLots: [splitLotOf(541, B_S1)],
    });

    await user.type(screen.getByRole('textbox', { name: t.pop.scanLabel }), `${B_S1}{Enter}`);
    await screen.findByText(B_S1);
    await pressKeys(user, '7');
    await user.click(screen.getByRole('button', { name: t.pop.submit(1) }));
    const label = await screen.findByRole('dialog', { name: t.label.title(1) });
    await user.click(within(label).getByRole('button', { name: t.label.later }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: t.label.title(1) })).toBeNull();
    });
    expect(sent.some((each) => each.path === '/app/document-issues')).toBe(false);
  });

  it('US4-6 최종 마감 W/O 를 고르면 「재고는 돌아오지만 이 W/O 에는 붙지 않는다」고 안내한다', async () => {
    const user = userEvent.setup();
    renderReturn({ workOrders: () => WORK_ORDERS, workOrderLots: () => [woLotOf()] });

    const dialog = await openFind(user);
    await user.click(await within(dialog).findByText('WO-SYN-0002'));

    expect(await within(dialog).findByText(t.findByWo.finalizedNote)).toBeTruthy();
  });
});
