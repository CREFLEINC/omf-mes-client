import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { requestedPaths, requestsSent, returnStub, type ReturnStubOptions } from './fixtures';
import { ReturnReceiptScreen } from './screen';

const t = messages.returnReceipt;

const renderScreen = (
  options: ReturnStubOptions & { route?: string } = {},
): { user: ReturnType<typeof userEvent.setup> } => {
  renderWithProviders(<ReturnReceiptScreen />, {
    fetch: returnStub(options),
    route: options.route ?? '/shipment/return-receipts',
  });

  return { user: userEvent.setup() };
};

const receiptPane = () => within(screen.getByRole('region', { name: t.panes.receipt }));
const linesGroup = () => within(screen.getByRole('group', { name: t.panes.lines }));

const selectShipment = async (
  user: ReturnType<typeof userEvent.setup>,
  shipmentNo = 'SH-TEST-0455',
): Promise<void> => {
  await user.click(await screen.findByRole('button', { name: t.actions.selectRow(shipmentNo) }));
  await screen.findByLabelText(`LOT-TEST-0311 ${t.fields.returnQty}`);
};

const chooseLocation = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(receiptPane().getByLabelText(new RegExp(`^${t.fields.location}`)));
  await user.click(await screen.findByRole('option', { name: /R-01-02/ }));
};

const postedReceipt = (): Request | undefined =>
  requestsSent().find(
    (request) =>
      request.method === 'POST' && new URL(request.url).pathname === '/logistics/goods-receipts',
  );

describe('ReturnReceiptScreen — 원 출하 찾기', () => {
  it('두 구획이 서고 기간을 실어 출하를 부른다', async () => {
    renderScreen();

    expect(await screen.findByRole('heading', { name: t.panes.search })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: t.panes.receipt })).toBeInTheDocument();
    /* 상단 설명 띠는 걷었다 — 기간 규칙은 라벨 옆 ⓘ 로 읽힌다(관리웹 정리 시안 A). */
    expect(screen.queryByText(/여기서 입고합니다/)).toBeNull();
    expect(screen.getByRole('button', { name: t.search.periodRequired })).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: t.actions.selectRow('SH-TEST-0455') }),
    ).toBeInTheDocument();

    const list = requestedPaths().find((path) => path.startsWith('/logistics/shipments?'));
    expect(list).toMatch(/shipDateFrom=\d{4}-\d{2}-\d{2}/);
    expect(list).toMatch(/shipDateTo=\d{4}-\d{2}-\d{2}/);
    /* 원 출하를 고르기 전에는 반품 구획이 고르라고만 말한다. */
    expect(receiptPane().getByText(t.target.none)).toBeInTheDocument();
  });

  it('목록 줄은 품목 요약과 배분 LOT 을 보이고, 라인이 없으면 모른다고 적는다', async () => {
    renderScreen();
    await screen.findByRole('button', { name: t.actions.selectRow('SH-TEST-0455') });

    expect(screen.getByText('SYN-FG-1 · 300')).toBeInTheDocument();
    expect(screen.getByText('LOT-TEST-0311 · 180')).toBeInTheDocument();
  });

  it('라인이 안 오면 「선택하면 보인다」로 적는다 — 빈 배분처럼 보이지 않게', async () => {
    renderScreen({ listWithoutLines: true });
    await screen.findByRole('button', { name: t.actions.selectRow('SH-TEST-0455') });

    expect(screen.getAllByText(t.values.unknownLots).length).toBeGreaterThan(0);
  });

  it('검색어를 넣고 조회하면 q 로 실린다', async () => {
    const { user } = renderScreen();
    await screen.findByRole('button', { name: t.actions.selectRow('SH-TEST-0455') });

    await user.type(screen.getByLabelText(t.fields.keyword), 'SH-TEST-0448');
    await user.click(screen.getByRole('button', { name: t.actions.search }));

    await waitFor(() => {
      expect(requestedPaths().some((path) => path.includes('q=SH-TEST-0448'))).toBe(true);
    });
    expect(
      await screen.findByRole('button', { name: t.actions.selectRow('SH-TEST-0448') }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: t.actions.selectRow('SH-TEST-0455') }),
    ).not.toBeInTheDocument();
  });

  it('「초기화」는 처음 값(최근 한 달)과 달라진 것이 있을 때만 보이고, 누르면 처음 값으로 돌아간다', async () => {
    const { user } = renderScreen();
    await screen.findByRole('button', { name: t.actions.selectRow('SH-TEST-0455') });

    expect(screen.queryByRole('button', { name: t.actions.reset })).toBeNull();

    await user.type(screen.getByLabelText(t.fields.keyword), 'SH-TEST');
    await user.click(screen.getByRole('button', { name: t.actions.reset }));

    expect(screen.getByLabelText(t.fields.keyword)).toHaveValue('');
    expect(screen.queryByRole('button', { name: t.actions.reset })).toBeNull();
  });

  it('목록 조회가 실패하면 다시 시도할 수 있다', async () => {
    renderScreen({ listStatus: 500 });

    expect(await screen.findByRole('button', { name: messages.common.retry })).toBeInTheDocument();
  });
});

describe('ReturnReceiptScreen — 원 출하가 있는 반품', () => {
  it('출하를 고르면 배분이 반품 라인으로 서고 수량은 비어 있다', async () => {
    const { user } = renderScreen();
    await selectShipment(user);

    expect(receiptPane().getByText(t.target.shipment('SH-TEST-0455'))).toBeInTheDocument();
    expect(linesGroup().getByLabelText(`LOT-TEST-0311 ${t.fields.returnQty}`)).toHaveValue('');
    expect(linesGroup().getByLabelText(`LOT-TEST-0305 ${t.fields.returnQty}`)).toHaveValue('');
    expect(linesGroup().getByText('180')).toBeInTheDocument();
    /* 원천은 묻지 않는다 — 라디오도, 고정됐다는 문장도 없다(관리웹 정리 시안 A). */
    expect(receiptPane().queryByRole('radio')).not.toBeInTheDocument();
    expect(receiptPane().queryByText(/원천은 고객 클레임/)).toBeNull();
    /* 칸 아래 늘 서던 규칙은 라벨 · 제목 옆 ⓘ 로 읽힌다. */
    for (const text of [
      t.form.reasonHelp,
      t.form.remarksHelp,
      t.form.warehouseHelp,
      t.form.qualityFixedNote,
      t.lines.partialNote,
    ]) {
      expect(receiptPane().getByRole('button', { name: text })).toBeInTheDocument();
      expect(receiptPane().queryByText(text)).toBeNull();
    }
    /* 수량 전에는 사유와 함께 잠긴다. */
    expect(receiptPane().getByRole('button', { name: t.actions.submit })).toBeDisabled();
    expect(receiptPane().getByText(t.lock.noQty)).toBeInTheDocument();
  });

  it('⭐ 주소로 출하를 지목하면 그 출하가 자동으로 골라진다', async () => {
    renderScreen({ route: '/shipment/return-receipts?shipment=9902' });

    expect(await screen.findByText(t.target.shipment('SH-TEST-0448'))).toBeInTheDocument();
    expect(await screen.findByLabelText(`LOT-TEST-0290 ${t.fields.returnQty}`)).toBeInTheDocument();
  });

  it('출하 수량을 넘는 반품 수량은 그 줄에서 막고 등록도 잠근다', async () => {
    const { user } = renderScreen();
    await selectShipment(user);

    await user.type(linesGroup().getByLabelText(`LOT-TEST-0311 ${t.fields.returnQty}`), '181');

    expect(linesGroup().getByText(t.lines.qtyExceeds('180'))).toBeInTheDocument();
    expect(receiptPane().getByText(t.lock.lineErrors)).toBeInTheDocument();
  });

  it('⭐ 등록은 원천 문서·배분 번호·보류를 싣고 멱등 키와 함께 나간다', async () => {
    const { user } = renderScreen();
    await selectShipment(user);

    await user.type(linesGroup().getByLabelText(`LOT-TEST-0311 ${t.fields.returnQty}`), '120');
    /* 창고 기본값은 불량창고다 — 위치만 고르면 된다. */
    await chooseLocation(user);
    await user.click(receiptPane().getByLabelText(new RegExp(`^${t.fields.reason}`)));
    await user.click(await screen.findByRole('option', { name: '품질 불량' }));
    await user.type(receiptPane().getByLabelText(new RegExp(t.fields.remarks)), '상단 긁힘');

    /* J-7 — 누르기 전에 무엇이 바뀌는지 보인다. */
    expect(
      receiptPane().getByText(t.form.effectStock('120', 'EA', '합성 불량창고')),
    ).toBeInTheDocument();

    await user.click(receiptPane().getByRole('button', { name: t.actions.submit }));

    expect(await screen.findByText(t.form.success)).toBeInTheDocument();
    const post = postedReceipt();
    expect(post?.headers.get('Idempotency-Key')).toMatch(/[0-9a-f-]{36}/);
    const body = (await post?.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      receiptTypeCode: 'RETURN',
      plantId: 11,
      warehouseId: 1003,
      sourceDocumentTypeCode: 'SHIPMENT',
      sourceDocumentId: 9901,
      reasonCode: 'QUALITY_DEFECT',
      remarks: '상단 긁힘',
      lines: [
        {
          itemId: 2003,
          lotId: 8301,
          receiptQty: 120,
          uomId: 7001,
          qualityStatusCode: 'INSPECTION_PENDING',
          inventoryStatusCode: 'ON_HOLD',
          destinationLocationId: 3102,
          originalShipmentLotAllocationId: 9921,
        },
      ],
    });
    expect(body.businessDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.receiptDatetime).toMatch(/[+-]\d{2}:\d{2}$/);

    /* 결과 — 입고번호와 다음 화면(판정 의뢰)으로 가는 주소. LOT 하나라 그 LOT 을 겨눈다. */
    const outcome = within(await screen.findByRole('group', { name: t.panes.outcome }));
    expect(outcome.getByText(/RT-TEST-0099/)).toBeInTheDocument();
    expect(outcome.getByRole('link', { name: t.actions.openDisposition })).toHaveAttribute(
      'href',
      '/shipment/disposition-requests?lot=8301',
    );
  });

  it('불량창고가 아닌 창고를 고르면 경고하되 막지 않는다', async () => {
    const { user } = renderScreen();
    await selectShipment(user);

    await user.click(receiptPane().getByLabelText(new RegExp(`^${t.fields.warehouse}`)));
    await user.click(await screen.findByRole('option', { name: /SYN-WH-2/ }));

    expect(await receiptPane().findByText(t.form.warehouseNotDefect)).toBeInTheDocument();
    await user.type(linesGroup().getByLabelText(`LOT-TEST-0311 ${t.fields.returnQty}`), '10');
    await user.click(receiptPane().getByLabelText(new RegExp(`^${t.fields.location}`)));
    await user.click(await screen.findByRole('option', { name: /FG-A-01/ }));

    expect(receiptPane().getByRole('button', { name: t.actions.submit })).toBeEnabled();
  });

  /* G-2 — 사유 코드값이 비면 지어내지 않고 칸을 잠근다. 사유는 선택이라 등록은 막지 않는다. */
  /* 목록 제목 줄 「목록 접기」 · 접힌 「목록 N건」 탭(#350). */
  it('목록을 접으면 탭에 건수가 서고, 펼친 뒤에도 고른 출하 · 적어 둔 수량 · 검색어가 그대로다', async () => {
    const collapsedKey = 'omf-mes:return-receipt:list:collapsed';
    window.localStorage.removeItem(collapsedKey);
    const { user } = renderScreen();
    await selectShipment(user);
    await user.type(linesGroup().getByLabelText(`LOT-TEST-0311 ${t.fields.returnQty}`), '40');
    await user.type(screen.getByLabelText(t.fields.keyword), 'SH-TEST');
    const workspace = document.querySelector('.return-receipt-workspace');

    await user.click(
      screen.getByRole('button', { name: messages.common.inspectionHub.listCollapse }),
    );
    expect(workspace).toHaveAttribute('data-left-collapsed', 'true');
    const tab = workspace!.querySelector<HTMLElement>('.po-board-list-tab');
    expect(tab).toHaveTextContent('목록2건');

    await user.click(tab!);
    expect(workspace).not.toHaveAttribute('data-left-collapsed');
    expect(workspace!.querySelector('.po-board-list-tab')).toBeNull();
    expect(
      screen.getByRole('button', { name: t.actions.selectRow('SH-TEST-0455') }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(linesGroup().getByLabelText(`LOT-TEST-0311 ${t.fields.returnQty}`)).toHaveValue('40');
    expect(screen.getByLabelText(t.fields.keyword)).toHaveValue('SH-TEST');
    window.localStorage.removeItem(collapsedKey);
  });

  it('반품 사유 코드값이 비면 사유 칸만 잠긴다', async () => {
    const { user } = renderScreen({ emptyReasons: true });
    await selectShipment(user);

    await waitFor(() => {
      expect(receiptPane().getByLabelText(new RegExp(`^${t.fields.reason}`))).toBeDisabled();
    });
    expect(receiptPane().getAllByText(t.codePending).length).toBeGreaterThan(0);
  });
});

describe('ReturnReceiptScreen — 원 출하 없이 등록', () => {
  it('LOT 번호로 줄을 더하고 원천 문서 없이 등록한다', async () => {
    const { user } = renderScreen();
    await screen.findByRole('button', { name: t.actions.selectRow('SH-TEST-0455') });

    await user.click(screen.getByRole('button', { name: t.actions.withoutShipment }));
    expect(await screen.findByText(t.target.direct)).toBeInTheDocument();
    /* 반품 수량에 상한이 없다는 사실은 머리 옆 ⓘ 로 읽힌다(관리웹 정리 시안 A). */
    expect(receiptPane().getByRole('button', { name: t.lot.help })).toBeInTheDocument();
    expect(receiptPane().queryByText(t.lot.help)).toBeNull();

    await user.type(receiptPane().getByLabelText(t.lot.label), 'LOT-TEST-0000');
    await user.click(receiptPane().getByRole('button', { name: t.actions.findLot }));
    expect(await screen.findByText(t.lot.notFound('LOT-TEST-0000'))).toBeInTheDocument();

    await user.clear(receiptPane().getByLabelText(t.lot.label));
    await user.type(receiptPane().getByLabelText(t.lot.label), 'LOT-TEST-0199');
    await user.click(receiptPane().getByRole('button', { name: t.actions.findLot }));

    const qty = await screen.findByLabelText(`LOT-TEST-0199 ${t.fields.returnQty}`);
    /* 상한이 없다 — 출하 수량 칸이 「—」다. */
    expect(linesGroup().getByText(t.values.notAvailable)).toBeInTheDocument();
    await user.type(qty, '40');
    await chooseLocation(user);
    await user.click(receiptPane().getByRole('button', { name: t.actions.submit }));

    expect(await screen.findByText(t.form.success)).toBeInTheDocument();
    const body = (await postedReceipt()?.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty('sourceDocumentTypeCode');
    expect(body).not.toHaveProperty('sourceDocumentId');
    expect(body.lines).toEqual([
      expect.not.objectContaining({ originalShipmentLotAllocationId: expect.anything() }),
    ]);
    expect((body.lines as Record<string, unknown>[])[0]).toMatchObject({
      lotId: 8309,
      receiptQty: 40,
    });
  });

  it('같은 LOT 을 두 번 찾으면 더하지 않고 알려 준다', async () => {
    const { user } = renderScreen({ route: '/shipment/return-receipts?mode=direct' });
    await screen.findByText(t.target.direct);

    await user.type(receiptPane().getByLabelText(t.lot.label), 'LOT-TEST-0199');
    await user.click(receiptPane().getByRole('button', { name: t.actions.findLot }));
    await screen.findByLabelText(`LOT-TEST-0199 ${t.fields.returnQty}`);
    await user.click(receiptPane().getByRole('button', { name: t.actions.findLot }));

    expect(await screen.findByText(t.lot.alreadyAdded('LOT-TEST-0199'))).toBeInTheDocument();
    expect(screen.getAllByLabelText(`LOT-TEST-0199 ${t.fields.returnQty}`)).toHaveLength(1);
  });
});
