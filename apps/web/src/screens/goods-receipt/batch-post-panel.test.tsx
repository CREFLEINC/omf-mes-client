import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import { GoodsReceiptBatchPostPanel, type BatchPostLot } from './batch-post-panel';
import {
  goodsReceiptResponse,
  inboundReceiptFixtures,
  inboundReceiptLine,
  locationFixtures,
  lotDetailResponse,
  plantFixtures,
  warehouseFixtures,
} from './fixtures';

const t = messages.goodsReceipt;
const tb = t.batch;

const DETAIL_PATH = /^\/logistics\/inbound-receipts\/(\d+)$/;
const LOT_PATH = /^\/trace\/lots\/(\d+)$/;
const GOODS_RECEIPTS_PATH = '/logistics/goods-receipts';

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const listBody = (items: unknown[]) => ({
  items,
  page: { page: 1, size: 200, total: items.length },
});

const listRoute = (pathname: string, items: unknown[]): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse(listBody(items)),
});

const codeValue = (code: string, displayOrder: number) => ({
  code,
  codeName: `합성 ${code}`,
  isActive: true,
  displayOrder,
});

const CODE_GROUPS: Record<string, unknown[]> = {
  RECEIPT_TYPE: [codeValue('SAMPLE_RECEIPT_TYPE_A', 1)],
  LOT_STATUS: [codeValue('NORMAL', 1), codeValue('DEFECTIVE', 2)],
  INVENTORY_STATUS: [codeValue('AVAILABLE', 1)],
};

const codeValuesRoute = (): StubRoute => ({
  match: (request) => isGet(request, '/mdm/code-values'),
  respond: (request) =>
    jsonResponse(
      listBody(CODE_GROUPS[new URL(request.url).searchParams.get('codeGroupCode') ?? ''] ?? []),
    ),
});

/** 전표 둘(9001 · 9002) — 품목마다 전표 하나라 줄도 LOT 도 하나씩이다. */
const DETAILS: Record<number, unknown> = {
  9001: { inboundReceipt: inboundReceiptFixtures[0], lines: [inboundReceiptLine()] },
  9002: {
    inboundReceipt: inboundReceiptFixtures[1],
    lines: [
      inboundReceiptLine({
        inboundReceiptId: 9002,
        inboundReceiptLineId: 9402,
        lotId: 9602,
        receivedQty: 40,
      }),
    ],
  },
};

const detailRoute = (): StubRoute => ({
  match: (request) => request.method === 'GET' && DETAIL_PATH.test(new URL(request.url).pathname),
  respond: (request) =>
    jsonResponse(DETAILS[Number(DETAIL_PATH.exec(new URL(request.url).pathname)?.[1])]),
});

const lotRoute = (statusOf: Record<number, string>): StubRoute => ({
  match: (request) => request.method === 'GET' && LOT_PATH.test(new URL(request.url).pathname),
  respond: (request) =>
    jsonResponse(
      lotDetailResponse(statusOf[Number(LOT_PATH.exec(new URL(request.url).pathname)?.[1])]),
    ),
});

/** 입고 요청 — 본문과 멱등 키를 모은다. `fail` 에 든 원천 전표는 처음 한 번 400 으로 막힌다. */
const goodsReceiptRoute = (
  sent: { body: { sourceDocumentId: number }; key: string | null }[],
  fail: ReadonlySet<number> = new Set(),
): StubRoute => {
  const failed = new Set<number>();

  return {
    match: (request) =>
      request.method === 'POST' && new URL(request.url).pathname === GOODS_RECEIPTS_PATH,
    respond: async (request) => {
      const body = JSON.parse(await request.clone().text()) as { sourceDocumentId: number };
      sent.push({ body, key: request.headers.get('Idempotency-Key') });
      if (fail.has(body.sourceDocumentId) && !failed.has(body.sourceDocumentId)) {
        failed.add(body.sourceDocumentId);

        return jsonResponse(
          { errors: [{ scope: 'form', code: 'INVALID', message: '합성 서버 거절' }] },
          { status: 400 },
        );
      }

      return jsonResponse(
        goodsReceiptResponse({ goodsReceiptNo: `GR-${String(body.sourceDocumentId)}` }),
        { status: 201 },
      );
    },
  };
};

const baseRoutes = (statusOf: Record<number, string> = { 9601: 'NORMAL', 9602: 'NORMAL' }) => [
  detailRoute(),
  lotRoute(statusOf),
  codeValuesRoute(),
  listRoute('/mdm/warehouses', warehouseFixtures),
  listRoute('/mdm/locations', locationFixtures),
  listRoute('/mdm/plants', plantFixtures),
];

const LOTS: BatchPostLot[] = [
  {
    inboundReceiptId: 9001,
    inboundReceiptLineId: 9401,
    lotId: 9601,
    lotNo: 'SAMPLE|LOT|0003',
    itemCode: 'SAMPLE-ITEM-01',
    itemName: '합성 품목 가',
    uomCode: 'SAMPLE-EA',
  },
  {
    inboundReceiptId: 9002,
    inboundReceiptLineId: 9402,
    lotId: 9602,
    lotNo: 'SAMPLE|LOT|0007',
    itemCode: 'SAMPLE-ITEM-02',
    itemName: '합성 품목 나',
    uomCode: 'SAMPLE-EA',
  },
];

const renderPanel = (routes: StubRoute[]) => {
  const onClose = vi.fn();
  renderWithProviders(
    <GoodsReceiptBatchPostPanel lots={LOTS} refreshKeys={[]} onClose={onClose} />,
    {
      fetch: createStubFetch(routes),
      route: '/logistics/inbound-schedule',
      session: SYNTHETIC_SESSION,
    },
  );

  return { user: userEvent.setup(), onClose };
};

const chooseOption = async (
  user: ReturnType<typeof userEvent.setup>,
  fieldLabel: string,
  optionLabel: string,
): Promise<void> => {
  await user.click(screen.getByRole('combobox', { name: fieldLabel }));
  await user.click(screen.getByRole('option', { name: optionLabel }));
};

const fillForm = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await waitFor(() => {
    expect(screen.getByRole('combobox', { name: t.fields.warehouse })).toBeEnabled();
  });
  await chooseOption(user, t.fields.warehouse, 'SAMPLE-WH-01 · 합성 창고 가');
  await chooseOption(user, t.fields.location, 'SAMPLE-LOC-A1 · 합성 열 가1');
  await chooseOption(user, t.fields.receiptType, 'SAMPLE_RECEIPT_TYPE_A');
  await chooseOption(user, t.fields.inventoryStatus, 'AVAILABLE');
};

const confirmPost = async (user: ReturnType<typeof userEvent.setup>, count: number) => {
  const confirm = await screen.findByRole('dialog', { name: tb.confirm.title(count) });
  await user.click(within(confirm).getByRole('button', { name: tb.confirm.ok }));
};

describe('GoodsReceiptBatchPostPanel — 입고 대기 LOT 일괄 입고', () => {
  it('입력 한 벌로 전표마다 입고 요청을 하나씩 보내고, LOT 마다 입고번호가 선다', async () => {
    const sent: { body: { sourceDocumentId: number }; key: string | null }[] = [];
    const { user } = renderPanel([goodsReceiptRoute(sent), ...baseRoutes()]);

    const dialog = await screen.findByRole('dialog', { name: tb.title(2) });
    expect(dialog).toHaveTextContent('SAMPLE|LOT|0003');
    expect(dialog).toHaveTextContent('SAMPLE|LOT|0007');
    /* LOT 상태가 모두 정상이라 품질 상태가 승계된다. */
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: t.fields.qualityStatus })).toHaveTextContent(
        'NORMAL',
      );
    });

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: tb.submit(2) }));
    await confirmPost(user, 2);

    expect(await within(dialog).findByText(tb.done('GR-9001'))).toBeInTheDocument();
    expect(await within(dialog).findByText(tb.done('GR-9002'))).toBeInTheDocument();
    expect(screen.getByText(tb.allDone(2))).toBeInTheDocument();
    expect(sent.map(({ body }) => body)).toEqual([
      expect.objectContaining({
        sourceDocumentId: 9001,
        warehouseId: 9701,
        lines: [
          expect.objectContaining({
            inboundReceiptLineId: 9401,
            lotId: 9601,
            receiptQty: 100,
            qualityStatusCode: 'NORMAL',
            destinationLocationId: 9802,
          }),
        ],
      }),
      expect.objectContaining({
        sourceDocumentId: 9002,
        lines: [expect.objectContaining({ inboundReceiptLineId: 9402, receiptQty: 40 })],
      }),
    ]);
  });

  it('한 건이 막혀도 나머지는 보내고, 다시 누르면 실패한 건만 같은 멱등 키로 보낸다', async () => {
    const sent: { body: { sourceDocumentId: number }; key: string | null }[] = [];
    const { user } = renderPanel([goodsReceiptRoute(sent, new Set([9001])), ...baseRoutes()]);

    const dialog = await screen.findByRole('dialog', { name: tb.title(2) });
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: tb.submit(2) }));
    await confirmPost(user, 2);

    expect(await within(dialog).findByText(tb.done('GR-9002'))).toBeInTheDocument();
    expect(within(dialog).getByText(tb.failed)).toBeInTheDocument();
    expect(screen.getByText(tb.failedLot('SAMPLE|LOT|0003'))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: tb.retry }));
    await confirmPost(user, 1);

    expect(await within(dialog).findByText(tb.done('GR-9001'))).toBeInTheDocument();
    expect(sent.map(({ body }) => body.sourceDocumentId)).toEqual([9001, 9002, 9001]);
    expect(sent[2]?.key).toBe(sent[0]?.key);
  });

  it('불량 LOT 과 다른 LOT 이 섞이면 막고 그 까닭을 말한다', async () => {
    renderPanel(baseRoutes({ 9601: 'NORMAL', 9602: 'DEFECTIVE' }));

    expect(await screen.findByText(tb.blocked.mixedDefect)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: t.fields.warehouse })).toBeDisabled();
    expect(screen.getByRole('button', { name: tb.submit(2) })).toBeDisabled();
  });

  it('판정 전 · 보류 LOT 이 섞이면 그 LOT 번호를 들어 막는다', async () => {
    renderPanel(baseRoutes({ 9601: 'NORMAL', 9602: 'INSPECTION_PENDING' }));

    expect(await screen.findByText(tb.blocked.gated('SAMPLE|LOT|0007'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: tb.submit(2) })).toBeDisabled();
  });
});
