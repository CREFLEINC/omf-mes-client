import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { jsonResponse } from '../../test/api-harness';
import { setupScreen, writesTo } from './test-fixtures';

const t = messages.productionWarehouseReplenishment;
const tp = t.progress;
const td = t.detail;

const PROGRESS = '/production/warehouse-replenishment?view=progress';

const listTable = async () => within(await screen.findByRole('table', { name: tp.listLabel }));
const rowOf = async (no: string) => {
  const found = (await listTable()).getByRole('button', { name: no }).closest('tr');
  if (found === null) throw new Error(`${no} 줄이 없다`);
  return within(found);
};
const panel = async (no: string) =>
  within(await screen.findByRole('dialog', { name: new RegExp(no) }));
const listQueries = (gets: readonly URL[]) =>
  gets.filter(
    (url) =>
      url.pathname === '/logistics/material-issue-requests' && url.searchParams.get('size') !== '1',
  );

describe('W-02-12 생산 창고 보충 — 진행 보기', () => {
  it('FR-023 요청마다 구분 칩 · 생산 창고 · 출고 자재 창고 · 요청 · 출고 · 마감 · 부족 · 수령 n/m · 상태 칩을 보이고, 창고 보충 요청만 묻는다', async () => {
    const { gets } = setupScreen({ route: PROGRESS });

    const auto = await rowOf('SYN-MIR-01');
    expect(auto.getByText(t.origin.AUTO)).toBeInTheDocument();
    expect(auto.getByText(t.status.RELEASED)).toBeInTheDocument();

    const progressing = await rowOf('SYN-MIR-02');
    expect(progressing.getByText(t.origin.DIRECT)).toBeInTheDocument();
    expect(progressing.getByText(tp.receipt(1, 2))).toBeInTheDocument();
    expect(progressing.getByText(t.status.IN_PROGRESS)).toBeInTheDocument();
    expect(progressing.getByText('160 KG')).toBeInTheDocument();
    expect(progressing.getByText('100')).toBeInTheDocument();

    const short = await rowOf('SYN-MIR-03');
    expect(short.getByText('합성 생산창고 B')).toBeInTheDocument();
    expect(short.getByText('200')).toBeInTheDocument();
    /* 두 품목 이상은 qtySummary 가 없다 — 「N품목」 · 출고 「일부」 · 마감 「—」. */
    expect(short.getByText(tp.itemCount(2))).toBeInTheDocument();
    expect(short.getByText(tp.issuedPartial)).toBeInTheDocument();

    /* 상태 칩 5종 — 배포 · 진행 중 · 완료 · 마감 · 취소. */
    const closed = await rowOf('SYN-MIR-04');
    expect(closed.getByText(t.status.CLOSED)).toBeInTheDocument();
    expect(closed.getByText('60')).toBeInTheDocument();
    expect((await rowOf('SYN-MIR-05')).getByText(t.status.DONE)).toBeInTheDocument();
    expect((await rowOf('SYN-MIR-06')).getByText(t.status.CANCELLED)).toBeInTheDocument();

    const [query] = listQueries(gets);
    expect(query?.searchParams.get('requestTypeCode')).toBe('REPLENISHMENT');
    expect(query?.searchParams.get('plantId')).toBe('8401');
  });

  it('조건: 구분 · 상태 버튼이 계약 조건으로 나간다 — 상태는 replenishmentStatus(마감 = REMAINDER_CLOSED)로 서버가 거른다', async () => {
    const { user, gets } = setupScreen({ route: PROGRESS });
    await listTable();

    await user.click(
      within(screen.getByRole('group', { name: tp.filters.origin })).getByRole('button', {
        name: t.origin.AUTO,
      }),
    );
    await waitFor(() =>
      expect(listQueries(gets).at(-1)?.searchParams.get('replenishmentOriginCode')).toBe('AUTO'),
    );

    for (const status of [t.status.RELEASED, t.status.CLOSED]) {
      await user.click(
        within(screen.getByRole('group', { name: tp.filters.status })).getByRole('button', {
          name: status,
        }),
      );
    }
    await waitFor(() =>
      expect(listQueries(gets).at(-1)?.searchParams.getAll('replenishmentStatus').join(',')).toBe(
        'DISPATCHED,REMAINDER_CLOSED',
      ),
    );
    expect(listQueries(gets).at(-1)?.searchParams.has('displayStatus')).toBe(false);
  });

  it('FR-023 상세에 출고 전표 목록(번호 · 출고 시각 · 수령 여부)을 보인다', async () => {
    setupScreen({ route: `${PROGRESS}&id=2` });
    const detail = await panel('SYN-MIR-02');

    const issues = within(await detail.findByRole('table', { name: td.goodsIssues.label }));
    const rows = issues.getAllByRole('row').slice(1);
    expect(within(rows[0] as HTMLElement).getByText('SYN-GI-91')).toBeInTheDocument();
    /* UTC 로 와도 공장 현지 시각(UTC+7). */
    expect(within(rows[0] as HTMLElement).getByText('11-03 14:20')).toBeInTheDocument();
    expect(
      within(rows[0] as HTMLElement).getByText(td.goodsIssues.receivedYes),
    ).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText(td.goodsIssues.receivedNo)).toBeInTheDocument();
  });

  it('US3-3 진행 없는 요청은 [요청 취소] 확인 창(「피킹 지시도 닫힙니다」)에서 versionNo 와 함께 :cancel 로 보낸다', async () => {
    const { user, writes } = setupScreen({ route: `${PROGRESS}&id=1` });
    const detail = await panel('SYN-MIR-01');

    expect(detail.queryByRole('button', { name: td.closeRemaining })).not.toBeInTheDocument();
    await user.click(await detail.findByRole('button', { name: td.cancel }));
    const confirm = within(
      await screen.findByRole('dialog', { name: t.cancelDialog.title('SYN-MIR-01') }),
    );
    expect(confirm.getByText(t.cancelDialog.body)).toBeInTheDocument();
    await user.click(confirm.getByRole('button', { name: t.cancelDialog.submit }));

    await waitFor(() => expect(writesTo(writes, 'POST', ':cancel')).toHaveLength(1));
    expect(writesTo(writes, 'POST', ':cancel')[0]?.body).toEqual({ versionNo: 4 });
  });

  it('US3-3 진행 있는 요청은 취소 대신 [잔량 마감] — 사유가 없으면 막고, 고르면 사유 · 메모 · versionNo 를 보낸다', async () => {
    const { user, writes } = setupScreen({ route: `${PROGRESS}&id=2` });
    const detail = await panel('SYN-MIR-02');

    expect(detail.queryByRole('button', { name: td.cancel })).not.toBeInTheDocument();
    await user.click(await detail.findByRole('button', { name: td.closeRemaining }));
    const dialog = within(await screen.findByRole('dialog', { name: t.closeDialog.title }));
    expect(
      dialog.getByText(t.closeDialog.line('SYN-IT-1 합성 동선', '160 KG', '100 KG', '60 KG')),
    ).toBeInTheDocument();

    await user.click(dialog.getByRole('button', { name: t.closeDialog.submit }));
    expect(dialog.getByText(t.closeDialog.reasonRequired)).toBeInTheDocument();
    expect(writesTo(writes, 'POST', ':close-remaining')).toHaveLength(0);

    /* 사유는 공통코드에서 읽는다 — 고객이 더한 사유도 나오고, 쓰지 않는 사유는 없다. */
    await user.click(dialog.getByRole('combobox', { name: t.closeDialog.reason }));
    expect(await screen.findByRole('option', { name: '합성 고객 사유' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '합성 지난 사유' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('option', { name: '합성 자재 창고 결품' }));
    await user.type(dialog.getByLabelText(t.closeDialog.remark), '합성 납기 지연');
    await user.click(dialog.getByRole('button', { name: t.closeDialog.submit }));

    await waitFor(() => expect(writesTo(writes, 'POST', ':close-remaining')).toHaveLength(1));
    expect(writesTo(writes, 'POST', ':close-remaining')[0]?.body).toEqual({
      versionNo: 4,
      reasonCode: 'STOCK_OUT',
      remark: '합성 납기 지연',
    });
  });

  it('R5-1 집고 출고하지 않은 양이 있으면 [잔량 마감]이 잠기고 「집은 N 을 먼저 출고하세요」를 잇는다', async () => {
    setupScreen({ route: `${PROGRESS}&id=3` });
    const detail = await panel('SYN-MIR-03');

    const button = await detail.findByRole('button', { name: td.closeRemaining });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(td.pickedLock('120 KG'));
    expect(detail.getByText(td.pickedNotIssued('120 KG'))).toBeInTheDocument();
  });

  it('US3-4 마감한 요청은 「출고 N, 마감 M, 사유」와 메모 · 닫은 사람 · 시각을 보이고 버튼이 없다', async () => {
    setupScreen({
      route: `${PROGRESS}&id=4`,
      history: [
        {
          occurredAt: '2026-11-05T03:00:00Z',
          actorName: '합성 관리자',
          eventCode: 'CLOSED',
          detail: { reason: 'REMAINDER_CLOSED' },
        },
      ],
    });
    const detail = await panel('SYN-MIR-04');

    expect(
      await detail.findByText(
        `${td.closed('100 KG', '60 KG', '합성 자재 창고 결품')} 합성 납기 지연 ${td.closedBy('11-05 10:00', '합성 관리자')}`,
      ),
    ).toBeInTheDocument();
    expect(detail.queryByRole('button', { name: td.closeRemaining })).not.toBeInTheDocument();
    expect(detail.queryByRole('button', { name: td.cancel })).not.toBeInTheDocument();
  });

  it('409 VERSION_CONFLICT 면 「다른 사람이 먼저 바꿨습니다」와 [다시 불러오기]', async () => {
    const { user } = setupScreen({
      route: `${PROGRESS}&id=1`,
      respondWrite: () =>
        jsonResponse(
          { conflictCause: 'user', code: 'VERSION_CONFLICT', message: 'conflict' },
          { status: 409 },
        ),
    });
    const detail = await panel('SYN-MIR-01');

    await user.click(await detail.findByRole('button', { name: td.cancel }));
    await user.click(
      within(
        await screen.findByRole('dialog', { name: t.cancelDialog.title('SYN-MIR-01') }),
      ).getByRole('button', { name: t.cancelDialog.submit }),
    );

    expect(await detail.findByText(t.errors.versionConflict)).toBeInTheDocument();
    expect(detail.getByRole('button', { name: t.common.reload })).toBeInTheDocument();
  });
});
