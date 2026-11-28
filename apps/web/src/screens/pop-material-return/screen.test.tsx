import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { jsonResponse } from '../../test/api-harness';
import { TERMINAL_WAREHOUSE, WORKER, lookupOf, pressKeys, renderReturn, scanLot } from './test-kit';

/*
 * P-01-03 반납 입고(피처 019 · 시안 ②). 합성값만 쓴다.
 * 시험 이름 앞 ID 는 verification.md · quickstart.md 의 것이다.
 */

const t = messages.materialReturn;
const LOT_A = 'SYN-M00000220261120000031';
const LOT_B = 'SYN-M00000220261127000039';
const LOT_C = 'SYN-M00000220261121000012';

const setOnline = (value: boolean): void => {
  Object.defineProperty(globalThis.navigator, 'onLine', { value, configurable: true });
};

beforeEach(() => {
  globalThis.localStorage.clear();
  setOnline(true);
});

afterEach(() => {
  setOnline(true);
  globalThis.localStorage.clear();
});

const table = () => screen.getByRole('group', { name: t.pop.table.label });
const submitButton = (lines: number) => screen.getByRole('button', { name: t.pop.submit(lines) });

describe('P-01-03 반납 입고', () => {
  it('US1-1 · SC-005 LOT 을 스캔하면 줄이 생기고 품목·LOT·반납 가능·적치 대기가 보이며, 수량은 빈칸이고 W/O 는 묻지도 보이지도 않는다', async () => {
    const user = userEvent.setup();
    const { sent } = renderReturn();

    await scanLot(user, LOT_A);

    expect(sent.find((each) => each.path.endsWith('/lot-lookup'))?.search.get('lotNo')).toBe(LOT_A);
    const row = within(table()).getAllByRole('row')[1] as HTMLElement;
    expect(within(row).getByText('SYN-A100')).toBeTruthy();
    expect(within(row).getByText('합성 볼트 M4×10')).toBeTruthy();
    expect(within(row).getByText('100 EA')).toBeTruthy();
    expect(within(row).getByText(t.pop.staging)).toBeTruthy();
    expect(screen.getByText(t.pop.destination(TERMINAL_WAREHOUSE.warehouseName))).toBeTruthy();

    /* 수량 처음 값은 빈칸, 반납 가능 양은 칸 아래에. */
    expect((screen.getByRole('textbox', { name: t.pop.qtyLabel }) as HTMLInputElement).value).toBe(
      '',
    );
    expect(screen.getByText(t.pop.returnableHint('100 EA'))).toBeTruthy();
    expect(submitButton(1)).toHaveProperty('disabled', true);

    /* W/O 를 묻는 칸이 없고, 귀속될 W/O 번호도 그리지 않는다(FR-013). */
    expect(screen.queryByText('WO-SYN-0010')).toBeNull();
    const fields = screen
      .getAllByRole('textbox')
      .map((field) => field.getAttribute('aria-label') ?? '');
    expect(fields.some((label) => label.includes('W/O'))).toBe(false);
    expect(screen.queryByText(t.pop.byWorkOrderChip)).toBeNull();
  });

  it('US1-5 · SC-005 세 LOT 을 담고 수량을 적어 한 번에 보내면 한 건에 줄 셋이 나가고 목록이 빈다', async () => {
    const user = userEvent.setup();
    const { sent } = renderReturn({
      lookup: (lotNo) =>
        jsonResponse(
          lotNo === LOT_A
            ? lookupOf({ lotId: 501, lotNo })
            : lotNo === LOT_B
              ? lookupOf({ lotId: 502, lotNo, returnableQty: 150 })
              : lookupOf({
                  lotId: 503,
                  lotNo,
                  uom: { uomId: 2, uomCode: 'KG' },
                  returnableQty: 12.5,
                  issueWarehouse: { warehouseId: 32, warehouseName: 'H 생산창고' },
                }),
        ),
    });

    await scanLot(user, LOT_A);
    await pressKeys(user, '20');
    await scanLot(user, LOT_B);
    await pressKeys(user, '40');
    await scanLot(user, LOT_C);
    await pressKeys(user, '3.2');

    /* 다른 창고에서 나간 LOT 은 주황 칩으로 따로 보인다. */
    expect(within(table()).getByText(t.pop.otherWarehouse('H 생산창고'))).toBeTruthy();
    expect(screen.getByText(t.pop.sum(3, '60 EA · 3.2 KG'))).toBeTruthy();

    await user.click(submitButton(3));
    await screen.findByText(t.pop.done(3));

    const posts = sent.filter((each) => each.method === 'POST');
    expect(posts).toHaveLength(1);
    const post = posts[0];
    expect(post?.path).toBe('/production/material-returns');
    expect(post?.headers.get('X-Worker-No')).toBe(WORKER);
    expect(post?.headers.get('Idempotency-Key')).toBeTruthy();
    const body = post?.body as {
      businessDate: string;
      occurredAt: string;
      lines: Record<string, unknown>[];
    };
    expect(body.businessDate).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(Number.isNaN(Date.parse(body.occurredAt))).toBe(false);
    expect(body.lines).toEqual([
      { lotId: 501, returnQty: 20 },
      { lotId: 502, returnQty: 40 },
      { lotId: 503, returnQty: 3.2 },
    ]);
    /* 보낸 뒤 목록을 비운다. */
    expect(screen.queryByRole('group', { name: t.pop.table.label })).toBeNull();
    expect(screen.getByText(t.pop.emptyHint)).toBeTruthy();
  });

  it('US1-5 같은 LOT 을 다시 스캔하면 새 줄을 만들지 않고 그 줄을 고른다', async () => {
    const user = userEvent.setup();
    renderReturn();

    await scanLot(user, LOT_A);
    await scanLot(user, LOT_B);
    await user.type(screen.getByRole('textbox', { name: t.pop.scanLabel }), `${LOT_A}{Enter}`);

    await waitFor(() => {
      const rows = within(table()).getAllByRole('row').slice(1);
      expect(rows).toHaveLength(2);
      expect(rows[0]?.getAttribute('aria-selected')).toBe('true');
    });
  });

  it('US1-3 반납 가능 초과는 화면이 먼저 막고, 서버 400 문구는 그대로 보이며 그 줄을 고른다', async () => {
    const user = userEvent.setup();
    const over = '출고된 양보다 많이 반납할 수 없습니다 (반납 가능 100)';
    renderReturn({
      lookup: (lotNo) => jsonResponse(lookupOf({ lotId: lotNo === LOT_A ? 501 : 502, lotNo })),
      receive: () =>
        jsonResponse(
          {
            errors: [{ scope: 'field', field: 'lines[0].returnQty', code: 'RANGE', message: over }],
          },
          { status: 400 },
        ),
    });

    await scanLot(user, LOT_A);
    await pressKeys(user, '101');
    expect(screen.getByText(t.pop.qtyOver('100 EA'))).toBeTruthy();
    expect(submitButton(1)).toHaveProperty('disabled', true);

    await user.click(screen.getByRole('button', { name: messages.popUniform.keypad.backspace }));
    await scanLot(user, LOT_B);
    await pressKeys(user, '5');
    await user.click(submitButton(2));

    await screen.findByText(over);
    const rows = within(table()).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.getAttribute('aria-selected')).toBe('true');
  });

  it('US1-4 반납 대상이 아닌 LOT 은 서버 문구를 그대로 스캔 칸 아래 빨간 줄로 보인다', async () => {
    const user = userEvent.setup();
    renderReturn({
      lookup: () =>
        jsonResponse(
          {
            errors: [
              {
                field: 'lotNo',
                scope: 'field',
                code: 'NOT_RETURNABLE',
                message: '반납할 수 있는 자재 LOT 이 아닙니다',
              },
            ],
          },
          { status: 400 },
        ),
    });

    await user.type(
      screen.getByRole('textbox', { name: t.pop.scanLabel }),
      'SYN-NOT-ISSUED{Enter}',
    );

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('반납할 수 있는 자재 LOT 이 아닙니다');
    expect(screen.queryByRole('group', { name: t.pop.table.label })).toBeNull();
  });

  it('오프라인이면 보낼 대기열에 넣고 목록을 비우며, 연결되면 같은 멱등 키로 보낸다', async () => {
    const user = userEvent.setup();
    const { sent } = renderReturn();

    await scanLot(user, LOT_A);
    await pressKeys(user, '20');
    setOnline(false);
    await user.click(submitButton(1));

    await screen.findByText(t.pop.queued);
    expect(screen.getByText(t.pop.pending(1))).toBeTruthy();
    expect(sent.filter((each) => each.method === 'POST')).toHaveLength(0);
    const queued = JSON.parse(
      globalThis.localStorage.getItem('omf-mes.pop-material-return.outbox') ?? '[]',
    ) as { idempotencyKey: string }[];
    expect(queued).toHaveLength(1);

    setOnline(true);
    globalThis.dispatchEvent(new Event('online'));

    await waitFor(() => {
      expect(sent.filter((each) => each.method === 'POST')).toHaveLength(1);
    });
    const post = sent.find((each) => each.method === 'POST');
    expect(post?.headers.get('Idempotency-Key')).toBe(queued[0]?.idempotencyKey);
    await waitFor(() => {
      expect(screen.queryByText(t.pop.pending(1))).toBeNull();
    });
  });
});
