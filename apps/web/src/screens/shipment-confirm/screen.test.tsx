import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderWithProviders } from '../../test/api-harness';
import {
  cancelRequests,
  confirmRequests,
  confirmStub,
  listRequests,
  type ConfirmStubOptions,
} from './fixtures';
import { ShipmentConfirmScreen } from './screen';

const t = messages.shipmentConfirm;
const NOW = new Date('2026-11-18T12:00:00+07:00');

const renderScreen = (options: ConfirmStubOptions = {}) => {
  renderWithProviders(<ShipmentConfirmScreen now={NOW} />, {
    fetch: confirmStub(options),
    route: '/shipment/shipment-confirm',
  });

  return { user: userEvent.setup() };
};

const listPane = () => screen.getByRole('region', { name: t.panes.list });
const detailPane = () => screen.getByRole('region', { name: t.panes.detail });

const rowOf = async (shipmentNo: string): Promise<HTMLElement> => {
  const open = await screen.findByRole('button', { name: t.list.open(shipmentNo) });
  const row = open.closest('tr');
  if (row === null) throw new Error('행을 찾지 못했습니다');
  return row;
};

const openDetail = async (user: ReturnType<typeof userEvent.setup>, shipmentNo: string) => {
  await user.click(await screen.findByRole('button', { name: t.list.open(shipmentNo) }));
  await within(detailPane()).findByText(shipmentNo);
};

describe('ShipmentConfirmScreen — W-04-12 출하 내역', () => {
  it('Q17 이름은 「출하 내역」이고, 미확정만이 아니라 모든 출하를 조회한다', async () => {
    renderScreen();
    await rowOf('SYN-SH-101');

    expect(screen.getByRole('heading', { level: 1, name: t.title })).toBeInTheDocument();
    expect(screen.getByText(t.lead)).toBeInTheDocument();
    const [query] = listRequests();
    expect(query?.searchParams.get('unconfirmedOnly')).toBeNull();
    expect(query?.searchParams.get('shipDateFrom')).not.toBeNull();
    /* 옛 흐름 미확정과 POP 완료 출하가 함께 선다. */
    await rowOf('SYN-SH-105');
  });

  it('Q15·US7-3 ERP 송신 칩 6종을 보이고, 「송신 안 함」으로 거르면 그 값으로 조회한다', async () => {
    const { user } = renderScreen();

    expect(await within(await rowOf('SYN-SH-101')).findByText(t.erp.PENDING)).toBeInTheDocument();
    expect(
      within(await rowOf('SYN-SH-102')).getByText(t.erp.NOT_SENT_NO_SALES_ORDER),
    ).toBeInTheDocument();
    expect(within(await rowOf('SYN-SH-103')).getByText(t.erp.SENT)).toBeInTheDocument();
    expect(within(await rowOf('SYN-SH-105')).getByText(t.erp.NOT_QUEUED)).toBeInTheDocument();
    expect(within(await rowOf('SYN-SH-107')).getByText(t.erp.SEND_ERROR)).toBeInTheDocument();
    expect(within(await rowOf('SYN-SH-108')).getByText(t.erp.CANCELLED)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.erp.NOT_SENT_NO_SALES_ORDER }));
    await user.click(screen.getByRole('button', { name: t.filter.search }));

    await waitFor(() => {
      expect(listRequests().at(-1)?.searchParams.get('erpSendStatus')).toBe(
        'NOT_SENT_NO_SALES_ORDER',
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: t.list.open('SYN-SH-101') })).toBeNull();
    });
    await rowOf('SYN-SH-102');
  });

  it('Q18 창고가 여럿이면 「창고 2곳」 칩(이름은 title), 하나면 그 이름이다', async () => {
    renderScreen();

    const multi = within(await rowOf('SYN-SH-101')).getByText(t.list.warehouseCount(2));
    expect(multi.closest('[title]')).toHaveAttribute(
      'title',
      '합성 완제품 창고 A, 합성 완제품 창고 B',
    );
    expect(within(await rowOf('SYN-SH-102')).getByText('합성 완제품 창고 B')).toBeInTheDocument();
  });

  it('Q9 POP 완료 출하는 「출하 완료」·완료 단말·작업자, 옛 흐름·긴급 직행은 미확정으로 보인다', async () => {
    renderScreen();

    const done = await rowOf('SYN-SH-101');
    expect(within(done).getByText(t.flow.completed)).toBeInTheDocument();
    expect(within(done).getByText('SYN-POP-01')).toBeInTheDocument();
    expect(within(done).getByText('합성 작업자')).toBeInTheDocument();

    const legacy = await rowOf('SYN-SH-105');
    expect(within(legacy).getByText(t.flow.legacyUnconfirmed)).toBeInTheDocument();
    expect(within(legacy).getByText(t.list.webCreated)).toBeInTheDocument();
    expect(
      within(await rowOf('SYN-SH-106')).getByText(t.flow.expeditedUnconfirmed),
    ).toBeInTheDocument();
    expect(within(await rowOf('SYN-SH-108')).getByText(t.flow.cancelled)).toBeInTheDocument();
  });

  it('Q22 일괄 확정·체크 칸·「모두 선택」이 없다', async () => {
    renderScreen();
    await rowOf('SYN-SH-105');

    expect(within(listPane()).queryAllByRole('checkbox')).toHaveLength(0);
    expect(within(listPane()).queryByRole('button', { name: t.actions.confirm })).toBeNull();
    expect(screen.queryByRole('button', { name: t.actions.confirm })).toBeNull();
  });

  it('US5-5·Q12 상세에 LOT 별 출하 관리 코드·재고가 빠진 곳·OQC 판정을 보이고, 교체 LOT 은 이력 줄이다', async () => {
    const { user } = renderScreen();
    await openDetail(user, 'SYN-SH-101');

    const detail = detailPane();
    expect(await within(detail).findByText('SYN-SR-3001')).toBeInTheDocument();
    expect(within(detail).getByText('SYN-POP-01')).toBeInTheDocument();
    expect(within(detail).getByText(/합성 작업자/)).toBeInTheDocument();
    expect(within(detail).getByText(t.detail.lineQty('100', 110))).toBeInTheDocument();
    expect(within(detail).getByText(t.detail.over(10))).toBeInTheDocument();

    const lot1 = within(detail).getByText('SYN-LOT-0001').closest('tr');
    expect(lot1).not.toBeNull();
    expect(lot1).toHaveTextContent('SYN-PLT-0007');
    expect(lot1).toHaveTextContent('SYN-A-01-01');
    expect(lot1).toHaveTextContent(t.oqc.ACCEPTED);

    /* 두 창고 잔액 행에서 나간 LOT 은 한 줄에 합계 · 창고별 몫. 코드가 없으면 「—」. */
    const lot2 = within(detail).getByText('SYN-LOT-0002').closest('tr');
    expect(lot2).toHaveTextContent('70');
    expect(lot2).toHaveTextContent('합성 완제품 창고 A 20');
    expect(lot2).toHaveTextContent('합성 완제품 창고 B 50');
    expect(lot2).toHaveTextContent(t.detail.noValue);

    const replaced = within(detail).getByText('SYN-LOT-0003').closest('tr');
    expect(replaced).toHaveTextContent(t.detail.replaced);
    expect(replaced).toHaveTextContent('SYN-NC-0004');

    /* 출하 관리 코드는 보기만 한다 — 입력칸이 없다. */
    expect(within(detail).queryByRole('textbox')).toBeNull();
    expect(within(detail).getByText(t.detail.erpMessage.PENDING)).toBeInTheDocument();
  });

  it('Q18 옛 흐름 미확정은 상세에서 한 건씩 확정한다 — 잠금 토큰을 싣는다', async () => {
    const { user } = renderScreen();
    await openDetail(user, 'SYN-SH-105');

    expect(within(detailPane()).getByText(t.detail.legacyBanner)).toBeInTheDocument();
    await user.click(within(detailPane()).getByRole('button', { name: t.actions.confirm }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('SYN-SH-105');
    await user.click(within(dialog).getByRole('button', { name: t.confirmDialog.confirm }));

    await waitFor(() => {
      expect(confirmRequests()).toHaveLength(1);
    });
    expect(confirmRequests()[0]?.headers.get('If-Match')).toBe('"v105"');
    expect(await screen.findByText(t.result.allConfirmed(1))).toBeInTheDocument();
  });

  it('Q22 POP 완료 출하에는 [확정]이 없다', async () => {
    const { user } = renderScreen();
    await openDetail(user, 'SYN-SH-101');

    expect(within(detailPane()).queryByRole('button', { name: t.actions.confirm })).toBeNull();
  });

  it('US6-1·Q13 송신 대기 출하의 취소 요청 창은 송신 보류와 「취소가 실행되면」 목록을 보이고 사유와 함께 올린다', async () => {
    const { user } = renderScreen();
    await openDetail(user, 'SYN-SH-101');

    expect(within(detailPane()).getByText(t.cancelNote)).toBeInTheDocument();
    await user.click(within(detailPane()).getByRole('button', { name: t.actions.requestCancel }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(t.cancelDialog.approvalNote);
    expect(dialog).toHaveTextContent(t.cancelDialog.hold);
    expect(dialog).toHaveTextContent(t.cancelDialog.whatTitle);
    expect(dialog).toHaveTextContent(
      t.cancelDialog.what.stock(110, '합성 완제품 창고 A, 합성 완제품 창고 B'),
    );
    expect(dialog).toHaveTextContent(t.cancelDialog.what.request('SYN-SR-3001'));

    await user.click(within(dialog).getByRole('button', { name: t.cancelDialog.submit }));
    expect(await screen.findByText(t.cancelDialog.reasonRequired)).toBeInTheDocument();

    await user.type(within(dialog).getByRole('textbox'), '합성 사유');
    await user.click(within(dialog).getByRole('button', { name: t.cancelDialog.submit }));

    await waitFor(() => {
      expect(cancelRequests()).toHaveLength(1);
    });
    expect(cancelRequests()[0]?.headers.get('If-Match')).toBe('"v101"');
  });

  it('US7-4 수주 없이 나간 출하(송신 안 함)도 취소를 요청할 수 있다', async () => {
    const { user } = renderScreen();
    await openDetail(user, 'SYN-SH-102');

    expect(
      within(detailPane()).getByRole('button', { name: t.actions.requestCancel }),
    ).toBeEnabled();
    expect(
      within(detailPane()).getByText(t.detail.erpMessage.NOT_SENT_NO_SALES_ORDER),
    ).toBeInTheDocument();
  });

  it('US6-2·Q14 ERP 로 보낸 출하는 취소 요청이 잠기고 이유를 보인다', async () => {
    const { user } = renderScreen();
    await openDetail(user, 'SYN-SH-103');

    expect(
      within(detailPane()).getByRole('button', { name: t.actions.requestCancel }),
    ).toBeDisabled();
    expect(within(detailPane()).getByText(t.lock.sent)).toBeInTheDocument();
    expect(within(detailPane()).getByText('SYN-DN-0381')).toBeInTheDocument();
  });

  it('Q14 취소 상신 중이면 목록에 「송신 보류」, 상세에 결재 중 안내가 있고 다시 요청할 수 없다', async () => {
    const { user } = renderScreen();

    const row = await rowOf('SYN-SH-104');
    expect(within(row).getByText(t.hold)).toBeInTheDocument();
    expect(within(row).getByText(t.flow.cancelPending)).toBeInTheDocument();

    await openDetail(user, 'SYN-SH-104');
    expect(within(detailPane()).getByText(t.detail.cancelPendingBanner)).toBeInTheDocument();
    expect(
      within(detailPane()).getByRole('button', { name: t.actions.requestCancel }),
    ).toBeDisabled();
    expect(within(detailPane()).getByText(t.lock.cancelPending)).toBeInTheDocument();
  });

  it('Q14 요청하는 사이 송신이 먼저 끝나 409 ERP_ALREADY_SENT 면 그 이유를 창에 보인다', async () => {
    const { user } = renderScreen({
      cancelResponse: () =>
        jsonResponse(
          /* 서버 모양 그대로 — ConflictException('user', …, { code }) (통보 221). */
          { code: 'ERP_ALREADY_SENT', conflictCause: 'user', message: 'sent' },
          { status: 409 },
        ),
    });
    await openDetail(user, 'SYN-SH-101');
    await user.click(within(detailPane()).getByRole('button', { name: t.actions.requestCancel }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), '합성 사유');
    await user.click(within(dialog).getByRole('button', { name: t.cancelDialog.submit }));

    expect(await within(dialog).findByText(t.cancelDialog.erpAlreadySent)).toBeInTheDocument();
  });

  it('조건에 맞는 출하가 없으면 빈 상태를, 못 불러오면 다시 시도를 보인다', async () => {
    renderScreen({ shipments: [] });
    expect(await screen.findByText(t.list.empty)).toBeInTheDocument();
  });

  it('목록을 못 불러오면 오류와 다시 시도를 보인다', async () => {
    renderScreen({ listStatus: 500 });
    expect(await screen.findByText(t.list.loadFailed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.common.retry })).toBeInTheDocument();
  });
});
