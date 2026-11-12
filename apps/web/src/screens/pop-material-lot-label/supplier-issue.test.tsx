import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  HARNESS_NOW,
  PLANT_ID,
  WORKER_NO,
  defaultInfo,
  group,
  lot,
  renderLabelScreen,
  sentTo,
  type HarnessOptions,
} from './screen-harness';

/**
 * 005 T028 — P-01-01 「자재 관리 LOT 만들기」(공급사·품목 단위 발행) · 폐기(screens/P-01-01.md · FR-002~008).
 * 기본값 채우기 · 검사 규칙은 관리웹 W-01-14 와 같은 모듈(`patterns/material-lot-batch`)이다.
 */

const t = messages.popMaterialLotLabel;
const tb = t.batch;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(HARNESS_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

const openBatch = async (user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> => {
  await user.click(await screen.findByRole('button', { name: t.work.create }));
  const dialog = await screen.findByRole('dialog', { name: tb.title });
  await within(dialog).findByText(tb.lotQty);

  return dialog;
};

const field = (dialog: HTMLElement, label: string | RegExp): HTMLInputElement =>
  within(dialog).getByRole('textbox', { name: label }) as HTMLInputElement;

/** 레진 — 기본 단위 TON, 기본 정보 없음, 품목 기본 보관 단위 드럼(8403)·환산 없음. */
const RESIN: HarnessOptions = {
  groups: [
    group([], {
      supplierId: 8202,
      supplierCode: 'SYN-P-02',
      supplierName: '합성 공급사 나',
      itemId: 8602,
      itemCode: 'SYN-ITEM-02',
      itemName: '합성 레진',
      uomId: 8404,
      uomCode: 'TON',
    }),
  ],
  defaults: [],
  items: [{ itemId: 8602, baseUomId: 8404, defaultLotStorageUomId: 8403 }],
};

describe('US1-1 기본 정보로 채운다', () => {
  it('US1-1 S·A 를 고르면 기본 정보(봉지 · 10 · 1,000 EA)가 채워지고 「기본 정보에서 가져옴」을 보인다', async () => {
    const user = userEvent.setup();
    renderLabelScreen();

    const dialog = await openBatch(user);

    expect(within(dialog).getByText(tb.source.default)).toBeInTheDocument();
    expect(field(dialog, tb.packageCount).value).toBe('10');
    expect(field(dialog, tb.qtyPerPackage('EA')).value).toBe('100');
    expect(field(dialog, tb.lotQty).value).toBe('1000');
    expect(within(dialog).getByText('봉지 10 × 100 = 1,000 EA')).toBeInTheDocument();
  });

  it('US1-1 채운 값은 바꿀 수 있다 — 패키징 수를 바꾸면 재고 수량이 곱을 따라간다', async () => {
    const user = userEvent.setup();
    renderLabelScreen();

    const dialog = await openBatch(user);
    await user.clear(field(dialog, tb.packageCount));
    await user.type(field(dialog, tb.packageCount), '5');

    expect(field(dialog, tb.lotQty).value).toBe('500');
    expect(within(dialog).getByText('봉지 5 × 100 = 500 EA')).toBeInTheDocument();
  });

  it('곱이 맞지 않으면 빨간 줄로 말하고 만들기를 잠근다(FR-003)', async () => {
    const user = userEvent.setup();
    renderLabelScreen();

    const dialog = await openBatch(user);
    /* 비우면 곱으로 다시 채운다(시안 동작) — 통째로 골라 덮어 쓴다. */
    await user.tripleClick(field(dialog, tb.lotQty));
    await user.keyboard('950');
    await user.type(field(dialog, tb.lotCount), '3');

    expect(
      within(dialog).getByText(tb.errors.mismatch('950 EA', '봉지 10 × 100 = 1,000 EA')),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: tb.submitIdle })).toBeDisabled();
  });

  it('개수는 1~200 정수다 — 201 이면 막는다', async () => {
    const user = userEvent.setup();
    renderLabelScreen();

    const dialog = await openBatch(user);
    await user.type(field(dialog, tb.lotCount), '201');

    expect(within(dialog).getByText(tb.errors.lotCount)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: tb.submitIdle })).toBeDisabled();

    await user.clear(field(dialog, tb.lotCount));
    await user.type(field(dialog, tb.lotCount), '200');
    expect(within(dialog).getByRole('button', { name: tb.submit(200) })).toBeEnabled();
  });
});

describe('US1-3 기본 정보가 없으면', () => {
  it('US1-3 품목 기본 보관 단위로 패키징 단위만 채우고 수량은 빈칸 — 패키징 없이 1 TON × 5 를 만든다', async () => {
    const user = userEvent.setup();
    const { sent } = renderLabelScreen(RESIN);

    const dialog = await openBatch(user);

    expect(within(dialog).getByText(tb.source.itemStorage)).toBeInTheDocument();
    expect(field(dialog, tb.packageCount).value).toBe('');
    expect(field(dialog, tb.qtyPerPackage('TON')).value).toBe('');
    expect(field(dialog, tb.lotQty).value).toBe('');

    await user.click(within(dialog).getByRole('button', { name: tb.packageOff }));
    expect(within(dialog).getByText(tb.sourceNote.itemStorage)).toBeInTheDocument();
    await user.type(field(dialog, tb.lotQty), '1');
    await user.type(field(dialog, tb.lotCount), '5');
    await user.click(within(dialog).getByRole('button', { name: tb.submit(5) }));

    await waitFor(() => expect(sentTo(sent, '/logistics/material-lot-batches')).toHaveLength(1));
    expect(sentTo(sent, '/logistics/material-lot-batches')[0]?.body).toMatchObject({
      plantId: PLANT_ID,
      supplierId: 8202,
      itemId: 8602,
      lotQty: 1,
      package: null,
      lotCount: 5,
    });
  });

  it('기본 정보도 품목 기본 보관 단위도 없으면 「직접 입력」으로 패키징 없이 시작한다', async () => {
    const user = userEvent.setup();
    renderLabelScreen({ ...RESIN, items: [{ itemId: 8602, baseUomId: 8404 }] });

    const dialog = await openBatch(user);

    expect(within(dialog).getByText(tb.source.none)).toBeInTheDocument();
    expect(within(dialog).getByText(tb.sourceNote.none)).toBeInTheDocument();
    expect(within(dialog).queryByRole('textbox', { name: tb.packageCount })).toBeNull();
  });

  it('품목 환산이 있으면 패키징당 수량도 채운다(재고 수량은 빈칸)', async () => {
    const user = userEvent.setup();
    renderLabelScreen({
      ...RESIN,
      items: [{ itemId: 8602, baseUomId: 8404, defaultLotStorageUomId: 8403, storageRate: 0.5 }],
    });

    const dialog = await openBatch(user);

    expect(field(dialog, tb.qtyPerPackage('TON')).value).toBe('0.5');
    expect(field(dialog, tb.packageCount).value).toBe('');
  });
});

describe('US1-5 공급사 LOT · 만들기', () => {
  it('US1-5 공급사 LOT SL-77 → 만드는 LOT 모두 같은 값, 본문은 POP 사번 · 멱등 키와 함께 나간다', async () => {
    const user = userEvent.setup();
    const { sent } = renderLabelScreen();

    const dialog = await openBatch(user);
    await user.type(field(dialog, new RegExp(tb.supplierLot, 'u')), 'SYN-SL-77');
    await user.type(field(dialog, tb.lotCount), '3');

    expect(
      within(dialog).getByText(new RegExp(tb.summarySupplierLot('SYN-SL-77'), 'u')),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: tb.submit(3) }));

    await waitFor(() => expect(sentTo(sent, '/logistics/material-lot-batches')).toHaveLength(1));
    const [request] = sentTo(sent, '/logistics/material-lot-batches');
    expect(request?.body).toMatchObject({
      plantId: PLANT_ID,
      supplierId: 8201,
      itemId: 8601,
      lotQty: 1000,
      package: { uomId: 8402, count: 10, qtyPerPackage: 100 },
      supplierLotNo: 'SYN-SL-77',
      lotCount: 3,
      businessDate: '2026-11-11',
    });
    expect(request?.headers.get('X-Worker-No')).toBe(WORKER_NO);
    expect(request?.headers.get('Idempotency-Key')).not.toBeNull();
  });

  it('만들면 창이 닫히고 만든 LOT 을 고른 채로 둔다 — 알림이 라벨을 발행하라고 말한다', async () => {
    const user = userEvent.setup();
    renderLabelScreen({ groups: [group([])] });

    const dialog = await openBatch(user);
    await user.type(field(dialog, tb.lotCount), '2');
    await user.click(within(dialog).getByRole('button', { name: tb.submit(2) }));

    expect(await screen.findByText(tb.created(2))).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(t.bar.selected(2, 2))).toBeInTheDocument());
    expect(screen.queryByRole('dialog', { name: tb.title })).toBeNull();
    expect(screen.getByRole('button', { name: t.bar.issue(2) })).toBeEnabled();
  });

  it('서버가 거절하면 창을 닫지 않고 사유를 보인다', async () => {
    const user = userEvent.setup();
    renderLabelScreen({
      batchFail: {
        status: 400,
        body: {
          errors: [
            {
              scope: 'field',
              field: 'lotQty',
              code: 'INVALID',
              message: '패키징 곱이 맞지 않습니다.',
            },
          ],
        },
      },
    });

    const dialog = await openBatch(user);
    await user.type(field(dialog, tb.lotCount), '1');
    await user.click(within(dialog).getByRole('button', { name: tb.submit(1) }));

    expect(await within(dialog).findByText('패키징 곱이 맞지 않습니다.')).toBeInTheDocument();
  });
});

describe('US1-7 대기 LOT 폐기', () => {
  it('US1-7 고른 대기 LOT 을 확인 뒤 폐기한다 — 출력한 LOT 은 라벨을 떼라고 말하고, 폐기는 아래로 내려간다', async () => {
    const user = userEvent.setup();
    const { sent } = renderLabelScreen();

    await waitFor(() =>
      expect(screen.getAllByRole('checkbox', { name: /SYN-ITEM-01\|/u })).toHaveLength(3),
    );
    await user.click(screen.getByRole('checkbox', { name: /\|0002 /u }));
    await user.click(screen.getByRole('checkbox', { name: /\|0003 /u }));
    await user.click(screen.getByRole('button', { name: t.bar.void(2) }));

    const dialog = await screen.findByRole('dialog', { name: t.voidDialog.title(2) });
    expect(within(dialog).getByText(t.voidDialog.body, { exact: false })).toBeInTheDocument();
    expect(within(dialog).getByText(t.voidDialog.printed(1), { exact: false })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: t.voidDialog.confirm(2) }));

    expect(await screen.findByText(t.voidDialog.done(2))).toBeInTheDocument();
    expect(sentTo(sent, '/trace/lots:void')[0]?.body).toEqual({ lotIds: [9002, 9003] });
    await waitFor(() =>
      expect(screen.getAllByRole('checkbox', { name: /SYN-ITEM-01\|/u })).toHaveLength(1),
    );
    const table = screen.getByRole('group', { name: t.work.waitingTitle });
    expect(within(table).getAllByText(t.lotState.voided)).toHaveLength(3);
  });

  it('대기가 아닌 LOT 은 서버가 건별 실패로 돌려준다 — 「N개 폐기 · 실패 N」으로 묶는다', async () => {
    const user = userEvent.setup();
    renderLabelScreen({
      groups: [group([lot(9001), lot(9002)])],
      voidRejects: [9002],
    });

    await waitFor(() =>
      expect(screen.getAllByRole('checkbox', { name: /SYN-ITEM-01\|/u })).toHaveLength(2),
    );
    await user.click(screen.getByRole('button', { name: t.bar.selectAllWaiting }));
    await user.click(screen.getByRole('button', { name: t.bar.void(2) }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: t.voidDialog.confirm(2),
      }),
    );

    expect(await screen.findByText(t.voidDialog.partial(1, 1))).toBeInTheDocument();
  });
});

describe('기본 정보 한 줄', () => {
  it('기본 정보가 없는 공급사·품목은 「기본 정보 없음」', async () => {
    renderLabelScreen({ defaults: [defaultInfo({ itemId: 9999 })] });

    const list = await screen.findByRole('list', { name: t.pairs.label });
    expect(within(list).getAllByRole('button')[0]).toHaveTextContent(t.pairs.noDefault);
  });
});
