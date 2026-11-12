import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderWithProviders } from '../../test/api-harness';
import { detailOf, lotRow, READY, ROUTE, workRecordStub, type StubOptions } from './fixtures';
import type { WorkRecordLot } from './forward-contract';
import { InboundWorkRecordScreen } from './screen';

const t = messages.inboundWorkRecord;
const tf = t.finalizeDialog;

/** P/O 없음이 없는 마감 승인 대기 건. */
const CLEAN: WorkRecordLot = lotRow(9011, {
  finalizable: true,
  unallocatedQty: 0,
  receivedQty: 300,
  goodsReceivedQty: 300,
  poAllocations: [
    {
      purchaseOrderLineId: 501,
      purchaseOrderNo: 'PO-SYN-0031',
      lineNo: 10,
      orderDate: '2026-10-28',
      erpPurchaseOrderNo: null,
      qty: 300,
      excessQty: 0,
    },
  ],
});

const setup = (row: WorkRecordLot, options: StubOptions = {}) => {
  const stub = workRecordStub({ rows: [row], ...options });
  renderWithProviders(<InboundWorkRecordScreen />, {
    fetch: stub.fetch,
    route: `${ROUTE}&open=${String(row.inboundLotId)}`,
  });
  return { ...stub, user: userEvent.setup() };
};

const openFinalize = async (user: ReturnType<typeof userEvent.setup>, row: WorkRecordLot) => {
  const drawer = await screen.findByRole('dialog', { name: row.inboundLotNo });
  await user.click(await within(drawer).findByRole('button', { name: t.detail.finalize }));
  return screen.findByRole('dialog', { name: tf.title });
};

describe('W-01-16 최종 마감', () => {
  it('US8-4 P/O 없음이 남으면 「그 수량은 ERP 로 가지 않습니다」를 확인해야 풀리고 acknowledgeUnallocated 를 보낸다', async () => {
    const { user, recorded } = setup(READY);

    const dialog = await openFinalize(user, READY);
    expect(within(dialog).getByText(tf.summary('2,050', '2,050', 'EA'))).toBeVisible();
    expect(within(dialog).getByText('P/O 없음: 175')).toBeVisible();
    expect(within(dialog).getByText(tf.unallocatedWarning('175', 'EA'))).toBeVisible();
    expect(within(dialog).getByText(tf.warning)).toBeVisible();
    const confirm = within(dialog).getByRole('button', { name: tf.confirm });
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAccessibleDescription(tf.acknowledgeNeeded);

    await user.click(within(dialog).getByRole('checkbox', { name: tf.acknowledge }));
    await user.click(confirm);

    expect(await screen.findByText(tf.done(READY.inboundLotNo))).toBeVisible();
    const post = recorded.find((call) => call.method === 'POST');
    expect(post?.url.pathname).toBe('/logistics/inbound-lots/9001:finalize');
    expect(post?.body).toEqual({ versionNo: READY.versionNo, acknowledgeUnallocated: true });
    /* 결과: 「최종 마감」 보기로 옮긴다. */
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: new RegExp(t.views.final) })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    );
  });

  it('US8-4 P/O 없음이 없으면 확인란 없이 바로 최종 마감하고 확인 값을 싣지 않는다', async () => {
    const { user, recorded } = setup(CLEAN, {
      finalize: () =>
        jsonResponse({ ...CLEAN, statusCode: 'FINALIZED', finalizedAt: '2026-11-12T03:00:00Z' }),
    });

    const dialog = await openFinalize(user, CLEAN);
    expect(within(dialog).queryByRole('checkbox')).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: tf.confirm }));

    expect(await screen.findByText(tf.done(CLEAN.inboundLotNo))).toBeVisible();
    expect(recorded.find((call) => call.method === 'POST')?.body).toEqual({
      versionNo: CLEAN.versionNo,
    });
  });

  it('US8-4 그사이 P/O 없음이 생겼으면(400 UNALLOCATED_REMAINS) 같은 확인 줄을 띄운다', async () => {
    const { user } = setup(CLEAN, {
      finalize: () =>
        jsonResponse(
          {
            errors: [{ scope: 'screen', code: 'UNALLOCATED_REMAINS', message: '합성 남음' }],
            details: { unallocatedQty: 40 },
          },
          { status: 400 },
        ),
    });

    const dialog = await openFinalize(user, CLEAN);
    await user.click(within(dialog).getByRole('button', { name: tf.confirm }));

    expect(await within(dialog).findByText(tf.unallocatedWarning('40', 'EA'))).toBeVisible();
    expect(within(dialog).getByRole('button', { name: tf.confirm })).toBeDisabled();
  });

  it('US8-4 그사이 막힘이 생겼으면(409) 이유를 띄우고 상세를 다시 읽는다', async () => {
    let calls = 0;
    const blocked = detailOf(CLEAN, {
      finalizable: false,
      finalizeBlockers: [{ code: 'RECEIPT_CANCEL_PENDING', lotNos: ['SYN-LOT-0001'] }],
    });
    const { user, recorded } = setup(CLEAN, {
      details: { [CLEAN.inboundLotId]: blocked },
      finalize: () => {
        calls += 1;
        return jsonResponse(
          {
            errors: [{ scope: 'screen', code: 'STATE_LOCKED', message: '합성 막힘' }],
            blockers: [{ code: 'RECEIPT_CANCEL_PENDING', lotNos: ['SYN-LOT-0001'] }],
          },
          { status: 409 },
        );
      },
    });

    /* 첫 상세는 마감 승인 대기로 보이게 — 목록 행에서 열린 뒤 서버가 막힘을 알린다. */
    blocked.finalizable = true;
    const dialog = await openFinalize(user, CLEAN);
    blocked.finalizable = false;
    const before = recorded.filter(
      (call) => call.url.pathname === '/logistics/inbound-lots/9011',
    ).length;
    await user.click(within(dialog).getByRole('button', { name: tf.confirm }));

    expect(
      await within(dialog).findByText(tf.blocked(t.blockers.RECEIPT_CANCEL_PENDING(1))),
    ).toBeVisible();
    expect(calls).toBe(1);
    expect(
      recorded.filter((call) => call.url.pathname === '/logistics/inbound-lots/9011').length,
    ).toBeGreaterThan(before);
  });

  it('US8-4 다른 사람이 먼저 바꿨으면(409 VERSION_CONFLICT) 안내와 [다시 불러오기]', async () => {
    const { user } = setup(CLEAN, {
      finalize: () =>
        jsonResponse(
          { errors: [{ scope: 'screen', code: 'VERSION_CONFLICT', message: '합성 충돌' }] },
          { status: 409 },
        ),
    });

    const dialog = await openFinalize(user, CLEAN);
    await user.click(within(dialog).getByRole('button', { name: tf.confirm }));

    expect(await within(dialog).findByText(t.errors.conflict)).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: t.errors.reload }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: tf.title })).toBeNull());
  });
});
