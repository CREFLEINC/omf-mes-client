import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SYNTHETIC_SESSION } from '../../test/session-harness';
import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import {
  goodsReceiptResponse,
  inboundReceiptFixtures,
  inboundReceiptLine,
  locationFixtures,
  lotDetailResponse,
  plantFixtures,
  warehouseFixtures,
} from './fixtures';
import { GoodsReceiptPostPanel, type GoodsReceiptPostPanelProps } from './post-panel';

const t = messages.goodsReceipt;

const DETAIL_PATH = '/logistics/inbound-receipts/9001';
const GOODS_RECEIPTS_PATH = '/logistics/goods-receipts';
const LOT_DETAIL_PATH = '/trace/lots/9601';
const CODE_VALUES_PATH = '/mdm/code-values';

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

/** 공통코드 — 그룹마다 다른 목록. 품질 상태에 LOT 상태(NORMAL)가 있어 승계가 실제로 검사된다. */
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
  match: (request) => isGet(request, CODE_VALUES_PATH),
  respond: (request) =>
    jsonResponse(
      listBody(CODE_GROUPS[new URL(request.url).searchParams.get('codeGroupCode') ?? ''] ?? []),
    ),
});

const detailRoute = (lines: unknown[] = [inboundReceiptLine()]): StubRoute => ({
  match: (request) => isGet(request, DETAIL_PATH),
  respond: () => jsonResponse({ inboundReceipt: inboundReceiptFixtures[0], lines }),
});

const lotDetailRoute = (statusCode: string): StubRoute => ({
  match: (request) => isGet(request, LOT_DETAIL_PATH),
  respond: () => jsonResponse(lotDetailResponse(statusCode)),
});

const goodsReceiptRoute = (bodies: unknown[]): StubRoute => ({
  match: (request) =>
    request.method === 'POST' && new URL(request.url).pathname === GOODS_RECEIPTS_PATH,
  respond: async (request) => {
    bodies.push(JSON.parse(await request.clone().text()));

    return jsonResponse(goodsReceiptResponse(), { status: 201 });
  },
});

const baseRoutes = (lotStatus = 'NORMAL'): StubRoute[] => [
  detailRoute(),
  lotDetailRoute(lotStatus),
  codeValuesRoute(),
  listRoute('/mdm/warehouses', warehouseFixtures),
  listRoute('/mdm/locations', locationFixtures),
  listRoute('/mdm/plants', plantFixtures),
];

const CONTEXT: GoodsReceiptPostPanelProps['context'] = {
  purchaseOrderNo: 'SAMPLE-PO-0001',
  supplierName: '합성 공급사 가',
  itemCode: 'SAMPLE-ITEM-01',
  itemName: '합성 품목 가',
  lotNo: 'SAMPLE|LOT|0003',
  uomCode: 'SAMPLE-EA',
  inspectionNote: '검사 합격 2026.10.21',
};

const renderPanel = (routes: StubRoute[], onClose = vi.fn()) => {
  renderWithProviders(
    <GoodsReceiptPostPanel
      target={{ inboundReceiptId: 9001, inboundReceiptLineId: 9401, lotId: 9601 }}
      context={CONTEXT}
      onClose={onClose}
    />,
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

describe('GoodsReceiptPostPanel — 입고 처리 오른쪽 창', () => {
  it('LOT 머리에 창을 연 화면의 값과 전표 번호가 보이고, 품질 상태는 LOT 상태에서 승계된다', async () => {
    renderPanel(baseRoutes());

    const dialog = await screen.findByRole('dialog', { name: t.panel.title });
    expect(dialog).toHaveTextContent('SAMPLE|LOT|0003');
    expect(dialog).toHaveTextContent('SAMPLE-PO-0001');
    expect(dialog).toHaveTextContent('SAMPLE-ITEM-01 · 합성 품목 가');
    expect(dialog).toHaveTextContent('검사 합격 2026.10.21');
    expect(await within(dialog).findByText('IR-2026-900001')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: t.fields.qualityStatus })).toHaveTextContent(
        'NORMAL',
      );
    });
    /* 원천 문서 유형은 계약이 하나로 닫아 두어 채워져 있고, 입고 일시도 채워져 있다. */
    expect(screen.getByRole('combobox', { name: t.fields.sourceDocumentType })).toHaveTextContent(
      'INBOUND_RECEIPT',
    );
    /* 검사 화면으로 가는 링크는 없다. */
    expect(within(dialog).queryByRole('link')).toBeNull();
  });

  it('창고 → 위치 → 입고 유형 → 재고 상태를 고르고 확인하면 그 LOT 하나로 입고 전표를 보내고 결과를 보인다', async () => {
    const bodies: unknown[] = [];
    const { user } = renderPanel([goodsReceiptRoute(bodies), ...baseRoutes()]);

    await screen.findByRole('dialog', { name: t.panel.title });
    await screen.findByText('IR-2026-900001');
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: t.fields.warehouse })).toBeEnabled();
    });

    const post = screen.getByRole('button', { name: t.actions.post });
    expect(post).toBeDisabled();

    await chooseOption(user, t.fields.warehouse, 'SAMPLE-WH-01 · 합성 창고 가');
    await chooseOption(user, t.fields.location, 'SAMPLE-LOC-A1 · 합성 열 가1');
    await chooseOption(user, t.fields.receiptType, 'SAMPLE_RECEIPT_TYPE_A');
    await chooseOption(user, t.fields.inventoryStatus, 'AVAILABLE');

    /* 아래 띠의 요약 — 어디로 가는지. */
    expect(
      screen.getByText(/SAMPLE\|LOT\|0003 · 100 SAMPLE-EA → SAMPLE-WH-01/),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(post).toBeEnabled();
    });
    expect(bodies).toHaveLength(0);
    await user.click(post);

    const confirm = await screen.findByRole('dialog', { name: t.dialog.submitTitle });
    await user.click(within(confirm).getByRole('button', { name: t.actions.confirmPost }));

    await waitFor(() => {
      expect(bodies).toHaveLength(1);
    });
    expect(bodies[0]).toMatchObject({
      receiptTypeCode: 'SAMPLE_RECEIPT_TYPE_A',
      plantId: 9201,
      warehouseId: 9701,
      sourceDocumentTypeCode: 'INBOUND_RECEIPT',
      sourceDocumentId: 9001,
      lines: [
        {
          inboundReceiptLineId: 9401,
          lotId: 9601,
          receiptQty: 100,
          qualityStatusCode: 'NORMAL',
          inventoryStatusCode: 'AVAILABLE',
          destinationLocationId: 9802,
        },
      ],
    });

    expect(await screen.findByText('GR-2026-800001')).toBeInTheDocument();
    expect(screen.getByText(t.panel.guide.hint.done)).toBeInTheDocument();
  });

  it('창고 선택지는 입하 전표의 공장 창고로 부른다', async () => {
    const warehouseQueries: string[] = [];
    const warehousesRoute: StubRoute = {
      match: (request) => isGet(request, '/mdm/warehouses'),
      respond: (request) => {
        warehouseQueries.push(new URL(request.url).searchParams.get('plantId') ?? '');

        return jsonResponse(listBody(warehouseFixtures));
      },
    };
    renderPanel([warehousesRoute, ...baseRoutes()]);

    await screen.findByText('IR-2026-900001');
    await waitFor(() => {
      expect(warehouseQueries.length).toBeGreaterThan(0);
    });
    expect(warehouseQueries.every((plantId) => plantId === '9201')).toBe(true);
  });

  it('IQC 판정 전 LOT 은 칸이 잠기고 막힌 이유가 보이되 검사 화면 링크는 없다', async () => {
    renderPanel(baseRoutes('INSPECTION_PENDING'));

    const dialog = await screen.findByRole('dialog', { name: t.panel.title });
    expect(await within(dialog).findByText(t.notes.iqcGate.pendingTitle)).toBeInTheDocument();
    expect(within(dialog).queryByRole('link')).toBeNull();
    expect(screen.getByRole('combobox', { name: t.fields.warehouse })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.post })).toBeDisabled();
    expect(screen.getByText(t.panel.guide.hint.gated)).toBeInTheDocument();
  });

  it('진행 자료의 LOT 이 전표에 없으면 그렇다고 알린다', async () => {
    renderPanel([detailRoute([]), ...baseRoutes().slice(1)]);

    expect(await screen.findByText(t.panel.lineMissing)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.post })).toBeDisabled();
  });

  it('고친 것이 없으면 취소가 바로 닫고, 고친 것이 있으면 버릴지 묻는다', async () => {
    const { user, onClose } = renderPanel(baseRoutes());

    await screen.findByText('IR-2026-900001');
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: t.fields.warehouse })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: messages.common.cancel }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await chooseOption(user, t.fields.warehouse, 'SAMPLE-WH-01 · 합성 창고 가');
    await user.click(screen.getByRole('button', { name: messages.common.cancel }));
    expect(await screen.findByRole('dialog', { name: t.dialog.discardTitle })).toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
