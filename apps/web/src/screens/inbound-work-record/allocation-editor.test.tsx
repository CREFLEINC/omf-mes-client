import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderWithProviders } from '../../test/api-harness';
import {
  candidate,
  detailOf,
  READY,
  READY_CANDIDATES,
  ROUTE,
  workRecordStub,
  type StubOptions,
} from './fixtures';
import { InboundWorkRecordScreen } from './screen';

const t = messages.inboundWorkRecord;
const te = t.editor;

const setup = (options: StubOptions = {}) => {
  const stub = workRecordStub(options);
  renderWithProviders(<InboundWorkRecordScreen />, {
    fetch: stub.fetch,
    route: `${ROUTE}&open=${String(READY.inboundLotId)}`,
  });
  return { ...stub, user: userEvent.setup() };
};

/** [매칭 수정]을 눌러 편집을 연다. */
const startEdit = async (user: ReturnType<typeof userEvent.setup>) => {
  const dialog = await screen.findByRole('dialog', { name: READY.inboundLotNo });
  await user.click(await within(dialog).findByRole('button', { name: t.detail.editMatch }));
  return dialog;
};

const qtyInput = (dialog: HTMLElement, line: string) =>
  within(dialog).getByRole('textbox', { name: te.qtyLabel(line) });

const typeQty = async (
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  line: string,
  value: string,
) => {
  const input = qtyInput(dialog, line);
  await user.clear(input);
  if (value !== '') await user.type(input, value);
};

describe('W-01-16 매칭 수정', () => {
  it('US8-3 P/O 없음 175 를 마감 뒤 열린 라인으로 옮기면 P/O 없음이 0 이 되고, 0 인 라인 없이 저장한 뒤 받은 양이 표에 반영된다', async () => {
    let saved = false;
    const { user, recorded } = setup({
      candidates: () =>
        saved
          ? READY_CANDIDATES.map((line) =>
              line.purchaseOrderLineId === 503
                ? { ...line, receivedQty: 175, thisLotQty: 175, maxQty: 500 }
                : line,
            )
          : READY_CANDIDATES,
      put: () => {
        saved = true;
        return jsonResponse(
          detailOf({
            ...READY,
            versionNo: 5,
            unallocatedQty: 0,
            poAllocations: [
              ...(READY.poAllocations ?? []),
              {
                purchaseOrderLineId: 503,
                purchaseOrderNo: 'PO-SYN-0077',
                lineNo: 10,
                orderDate: '2026-11-11',
                erpPurchaseOrderNo: null,
                qty: 175,
                excessQty: 0,
              },
            ],
          }),
        );
      },
    });

    const dialog = await startEdit(user);
    expect(within(dialog).getByText(te.help)).toBeVisible();
    expect(within(dialog).getByText(te.reopenNote)).toBeVisible();
    /* 마감 승인 대기라도 편집 중에는 최종 마감이 잠긴다. */
    expect(within(dialog).getByRole('button', { name: t.detail.finalize })).toBeDisabled();

    await typeQty(user, dialog, '0077/10', '175');

    const match = within(dialog).getByRole('table', { name: t.detail.matchLabel });
    expect(within(match).getByText(t.detail.total('2,050', '2,050', 'EA'))).toBeVisible();
    const noneRow = within(match)
      .getAllByText(t.detail.unallocatedRow)[0]
      ?.closest('tr') as HTMLElement;
    expect(within(noneRow).getByText('0')).toBeVisible();

    await user.click(within(dialog).getByRole('button', { name: te.save }));

    expect(await screen.findByText(te.saved(READY.inboundLotNo))).toBeVisible();
    const put = recorded.find((call) => call.method === 'PUT');
    expect(put?.url.pathname).toBe('/logistics/inbound-lots/9001/po-allocations');
    expect(put?.body).toEqual({
      versionNo: READY.versionNo,
      allocations: [
        { purchaseOrderLineId: 501, qty: 300 },
        { purchaseOrderLineId: 502, qty: 1575 },
        { purchaseOrderLineId: 503, qty: 175 },
      ],
    });

    const after = await within(dialog).findByRole('table', { name: t.detail.matchLabel });
    await waitFor(() => {
      const late = within(after).getByText('PO-SYN-0077 · 10').closest('tr') as HTMLElement;
      /* 이번 매칭 175 · 남은 한도 500 − 175 = 325. */
      expect(within(late).getByText('175')).toBeVisible();
      expect(within(late).getByText('325')).toBeVisible();
    });
    expect(within(dialog).queryByRole('textbox')).toBeNull();
  });

  it('US8-3 라인 한도를 넘으면 그 줄 문구가 바로 서고 저장할 수 없다', async () => {
    const { user, recorded } = setup();

    const dialog = await startEdit(user);
    await typeQty(user, dialog, '0012/10', '1700');

    expect(within(dialog).getByText(te.errorsTitle)).toBeVisible();
    expect(
      within(dialog).getByText(
        '0012/10: 1,700 — 한도 1,600 EA(발주 1,500 + 허용치 100 − 받은 양 0)를 넘습니다',
      ),
    ).toBeVisible();
    const save = within(dialog).getByRole('button', { name: te.save });
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription(te.saveLocked);
    expect(recorded.some((call) => call.method === 'PUT')).toBe(false);
  });

  it('US8-3 매칭 합이 입하 수량을 넘거나 빈 칸이면 바로 막는다', async () => {
    const { user } = setup();

    const dialog = await startEdit(user);
    await typeQty(user, dialog, '0077/10', '500');
    expect(
      within(dialog).getByText('매칭 합 2,375 EA가 입하 수량 2,050 EA를 넘습니다(+325)'),
    ).toBeVisible();

    await typeQty(user, dialog, '0077/10', '');
    expect(within(dialog).getByText(te.notNumber('0077/10'))).toBeVisible();
    expect(within(dialog).getByRole('button', { name: te.save })).toBeDisabled();
  });

  it('US8-3 서버 400 RANGE 는 details 의 라인 · 한도로 그 줄 문구를 띄운다', async () => {
    const { user } = setup({
      put: () =>
        jsonResponse(
          {
            errors: [{ scope: 'field', code: 'RANGE', message: '합성 한도 넘음' }],
            details: { purchaseOrderLineId: 503, maxQty: 100 },
          },
          { status: 400 },
        ),
    });

    const dialog = await startEdit(user);
    await typeQty(user, dialog, '0077/10', '175');
    await user.click(within(dialog).getByRole('button', { name: te.save }));

    expect(
      await within(dialog).findByText(
        '0077/10: 175 — 한도 100 EA(발주 500 + 허용치 0 − 받은 양 0)를 넘습니다',
      ),
    ).toBeVisible();
    expect(screen.queryByText(te.saved(READY.inboundLotNo))).toBeNull();
  });

  it('US8-3 다른 사람이 먼저 바꿨으면(409) 안내와 [다시 불러오기]', async () => {
    const { user } = setup({
      put: () =>
        jsonResponse(
          { errors: [{ scope: 'screen', code: 'VERSION_CONFLICT', message: '합성 충돌' }] },
          { status: 409 },
        ),
    });

    const dialog = await startEdit(user);
    await typeQty(user, dialog, '0077/10', '175');
    await user.click(within(dialog).getByRole('button', { name: te.save }));

    expect(await within(dialog).findByText(t.errors.conflict)).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: t.errors.reload }));
    await waitFor(() => expect(within(dialog).queryByRole('textbox')).toBeNull());
  });

  it('US8-3 [취소]하면 고친 값을 버리고 표로 돌아간다', async () => {
    const { user } = setup({
      candidates: () => [...READY_CANDIDATES.slice(0, 2), candidate(504, { maxQty: 10 })],
    });

    const dialog = await startEdit(user);
    await user.click(within(dialog).getByRole('button', { name: te.cancel }));

    expect(within(dialog).queryByRole('textbox')).toBeNull();
    expect(within(dialog).getByRole('button', { name: t.detail.finalize })).toBeEnabled();
  });
});
