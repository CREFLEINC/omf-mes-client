import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { jsonResponse } from '../../test/api-harness';
import { setupScreen, writesTo } from './test-fixtures';

const t = messages.productionWarehouseReplenishment;
const ta = t.arrival;
const tr = t.receiveDialog;

const ARRIVAL = '/production/warehouse-replenishment?view=arrival';

const listTable = async () => within(await screen.findByRole('table', { name: ta.listLabel }));
const rowOf = async (no: string) => {
  const found = (await listTable()).getByText(no).closest('tr');
  if (found === null) throw new Error(`${no} 줄이 없다`);
  return within(found);
};

describe('W-02-12 생산 창고 보충 — 도착 대기 보기', () => {
  it('US2-3 창고 보충 출고마다 출고번호 · 요청번호 · 구분 · 생산 창고 · 도착 위치 · 품목/LOT · 출고 수량 · 출고 시각 · 경과를 보이고, 여러 줄은 펼친다', async () => {
    const { user, gets } = setupScreen({ route: ARRIVAL });

    const one = await rowOf('SYN-GI-91');
    expect(one.getByText('SYN-MIR-02')).toBeInTheDocument();
    expect(one.getByText(t.origin.DIRECT)).toBeInTheDocument();
    expect(one.getByText('합성 생산창고 A')).toBeInTheDocument();
    /* 서버가 둔 위치는 코드(SYS-STAGING) 대신 역할 이름(G2 확인 2). */
    expect(await one.findByText('적치 대기')).toBeInTheDocument();
    expect(one.queryByText('SYS-STAGING')).toBeNull();
    expect(one.getByText('합성 동선, SYN-L-910')).toBeInTheDocument();
    expect(one.getByText('30 KG')).toBeInTheDocument();
    /* UTC 로 와도 공장 현지 시각(UTC+7). */
    expect(one.getByText('11-05 08:10')).toBeInTheDocument();
    expect(one.getByText(ta.elapsed(0))).not.toHaveClass('replenishment-late');

    /* 경과 3일 이상은 노랑(표시만). */
    expect((await rowOf('SYN-GI-92')).getByText(ta.elapsed(4))).toHaveClass('replenishment-late');

    /* 같은 품목 LOT 두 줄은 1품목 — 「품목, LOT 2개」와 수량 합(G2 확인 3). */
    const lots = await rowOf('SYN-GI-92');
    expect(lots.getByText(ta.lotCount('SYN-IT-1 합성 동선', 2))).toBeInTheDocument();
    expect(lots.getByText('30 KG')).toBeInTheDocument();

    const multi = await rowOf('SYN-GI-93');
    expect(multi.getByText(ta.itemCount(2))).toBeInTheDocument();
    expect(await multi.findByText('합성 A열 1칸')).toBeInTheDocument();
    await user.click(multi.getByRole('button', { name: ta.expand('SYN-GI-93') }));
    expect(multi.getByText('SYN-IT-2 합성 라벨지, SYN-L-932, 50 EA')).toBeInTheDocument();

    const query = gets.find((url) => url.pathname === '/logistics/replenishment-requests/arrivals');
    expect(query?.searchParams.get('plantId')).toBe('8401');
  });

  it('US2-4 고른 장을 확인 창 뒤 :bulk 로 출고 수량 그대로 받는다(POST /shopfloor-receipts 를 부르지 않는다)', async () => {
    const { user, writes } = setupScreen({ route: ARRIVAL });

    await user.click(
      (await rowOf('SYN-GI-91')).getByRole('checkbox', { name: ta.selectRow('SYN-GI-91') }),
    );
    await user.click(
      (await rowOf('SYN-GI-92')).getByRole('checkbox', { name: ta.selectRow('SYN-GI-92') }),
    );
    await user.click(screen.getByRole('button', { name: ta.bulk(2) }));

    const confirm = within(await screen.findByRole('dialog', { name: t.bulkDialog.title(2) }));
    expect(confirm.getByText(t.bulkDialog.body)).toBeInTheDocument();
    await user.click(confirm.getByRole('button', { name: t.bulkDialog.submit }));

    await waitFor(() =>
      expect(writesTo(writes, 'POST', '/shopfloor-receipts:bulk')).toHaveLength(1),
    );
    expect(writesTo(writes, 'POST', '/shopfloor-receipts:bulk')[0]?.body).toMatchObject({
      goodsIssueIds: [91, 92],
    });
    expect(writes.some((write) => write.url.pathname === '/logistics/shopfloor-receipts')).toBe(
      false,
    );
  });

  it('고른 장이 없으면 일괄 수령을 잠그고 사유를 잇는다', async () => {
    setupScreen({ route: ARRIVAL });
    await listTable();

    const button = screen.getByRole('button', { name: ta.bulk(0) });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(ta.bulkBlocked);
  });

  it('US2-9 일괄 결과 창은 받음 수 · 이미 받음 · 실패를 장마다 보인다', async () => {
    const { user } = setupScreen({
      route: ARRIVAL,
      respondWrite: (method, path) =>
        method === 'POST' && path === '/logistics/shopfloor-receipts:bulk'
          ? jsonResponse({
              results: [
                { goodsIssueId: 91, outcome: 'RECEIVED', shopfloorReceiptId: 801 },
                { goodsIssueId: 92, outcome: 'ALREADY_RECEIVED' },
                { goodsIssueId: 93, outcome: 'FAILED', message: '합성 실패 사유' },
              ],
            })
          : undefined,
    });

    await user.click(await screen.findByRole('checkbox', { name: ta.selectAll }));
    await user.click(screen.getByRole('button', { name: ta.bulk(3) }));
    await user.click(
      within(await screen.findByRole('dialog', { name: t.bulkDialog.title(3) })).getByRole(
        'button',
        { name: t.bulkDialog.submit },
      ),
    );

    const result = within(await screen.findByRole('dialog', { name: t.bulkResult.title }));
    expect(result.getByText(t.bulkResult.received(1))).toBeInTheDocument();
    expect(result.getByText(t.bulkResult.already('SYN-GI-92'))).toBeInTheDocument();
    expect(
      result.getByText(t.bulkResult.failed('SYN-GI-93', '합성 실패 사유')),
    ).toBeInTheDocument();
  });

  it('US2-5 행을 누르면 하나씩 받기 창 — 받은 수량을 바꾸면 차이 안내와 사유 필수, 모든 줄을 …:receive 로 보낸다', async () => {
    const { user, writes } = setupScreen({ route: ARRIVAL });

    /* 링크 아닌 칸(생산 창고)을 눌러도 열린다. */
    await user.click((await rowOf('SYN-GI-91')).getByText('합성 생산창고 A'));
    const dialog = within(await screen.findByRole('dialog', { name: tr.title('SYN-GI-91') }));
    const qty = dialog.getByRole('textbox', { name: tr.receivedLabel('SYN-IT-1 합성 동선') });
    expect(qty).toHaveValue('30');

    await user.clear(qty);
    await user.type(qty, '28');
    expect(dialog.getByText(tr.diff('2 KG'))).toBeInTheDocument();
    expect(dialog.getByRole('alert')).toHaveTextContent(tr.reasonRequired('SYN-IT-1 합성 동선'));
    const submit = dialog.getByRole('button', { name: tr.submit });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAccessibleDescription(tr.reasonRequired('SYN-IT-1 합성 동선'));

    await user.click(dialog.getByRole('combobox', { name: tr.reasonLabel('SYN-IT-1 합성 동선') }));
    await user.click(await screen.findByRole('option', { name: '합성 덜 옴' }));
    await user.click(dialog.getByRole('button', { name: tr.submit }));

    await waitFor(() => expect(writesTo(writes, 'POST', '/arrivals/91:receive')).toHaveLength(1));
    const body = writesTo(writes, 'POST', '/arrivals/91:receive')[0]?.body as Record<
      string,
      unknown
    >;
    expect(body).toMatchObject({
      lines: [
        {
          goodsIssueLineId: 910,
          itemId: 601,
          lotId: 1010,
          uomId: 1,
          issuedQty: 30,
          receivedQty: 28,
          varianceReasonCode: 'SHORT_DELIVERY',
        },
      ],
    });
    expect(body).toHaveProperty('businessDate');
    expect(body).toHaveProperty('receivedAt');
    expect(body).toHaveProperty('occurredAt');
    expect(body).not.toHaveProperty('destinationLocationId');
    expect(body).not.toHaveProperty('workOrderId');
  });

  it('US6-2 구역을 나눈 생산 창고로 받으면 「적치 지시 N건이 생겼습니다」를 알린다', async () => {
    const { user } = setupScreen({
      route: ARRIVAL,
      respondWrite: (method, path) =>
        method === 'POST' && path.endsWith(':receive')
          ? jsonResponse(
              {
                shopfloorReceipt: {
                  shopfloorReceiptId: 801,
                  shopfloorReceiptNo: 'SYN-SR-1',
                  goodsIssueId: 91,
                  workOrderId: null,
                  destinationLocationId: 501,
                  receivedAt: '2026-11-05T03:00:00Z',
                  statusCode: 'RECEIVED',
                  putawayTaskIds: [71, 72],
                },
                lines: [],
              },
              { status: 201 },
            )
          : undefined,
    });

    await user.click((await rowOf('SYN-GI-91')).getByRole('button', { name: ta.receiveOne }));
    await user.click(
      within(await screen.findByRole('dialog', { name: tr.title('SYN-GI-91') })).getByRole(
        'button',
        { name: tr.submit },
      ),
    );

    expect(await screen.findByText(t.receiveToast.putaway('SYN-GI-91', 2))).toBeInTheDocument();
  });

  it('US2-7 그사이 이미 받은 출고(409 ALREADY_RECEIVED)는 안내하고 목록을 다시 받게 한다', async () => {
    const { user, gets } = setupScreen({
      route: ARRIVAL,
      respondWrite: () =>
        jsonResponse(
          { conflictCause: 'user', code: 'ALREADY_RECEIVED', message: 'already' },
          { status: 409 },
        ),
    });

    await user.click((await rowOf('SYN-GI-91')).getByRole('button', { name: ta.receiveOne }));
    const dialog = within(await screen.findByRole('dialog', { name: tr.title('SYN-GI-91') }));
    await user.click(dialog.getByRole('button', { name: tr.submit }));
    expect(await dialog.findByText(tr.already)).toBeInTheDocument();

    const before = gets.filter((url) => url.pathname.endsWith('/arrivals')).length;
    await user.click(dialog.getByRole('button', { name: t.common.reload }));
    await waitFor(() =>
      expect(gets.filter((url) => url.pathname.endsWith('/arrivals')).length).toBeGreaterThan(
        before,
      ),
    );
  });
});
