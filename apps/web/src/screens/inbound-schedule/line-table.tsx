import { type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Link } from 'react-router';

import { formatDate } from './period';
import { formatQty, OneLine, orEmpty, OrderStateCell, ReceiptStatusCell } from './receipt-status';
import type { InboundScheduleLine, PurchaseOrderSummary } from './types';

const t = messages.inboundSchedule;

/** 「초과 입하 분리」 화면. 그 화면의 주소 키(`q`·`open`·`po`)는 그 화면의 `filters.ts`가 정한다. */
const OVER_RECEIPT_SPLIT_PATH = '/logistics/over-receipt-split';

/**
 * 그 발주를 고른 채로 「초과 입하 분리」를 여는 주소.
 *
 * - `po` — 그 화면이 받는 고른 발주 번호다
 * - `q` — **발주번호로 좁혀 둔다.** 그 화면은 고른 발주가 목록 결과에 없으면 `po`를 떼므로,
 *   좁히지 않으면 첫 쪽 밖의 발주는 고른 채로 열리지 않는다
 * - `open=0` — 그 화면의 「미완료만」을 끈다. 다 들어온(초과 입하) 발주도 목록에 남아야 고를 수 있다
 */
export const overReceiptSplitPath = (
  order: Pick<PurchaseOrderSummary, 'purchaseOrderId' | 'purchaseOrderNo'>,
): string => {
  const params = new URLSearchParams({
    q: order.purchaseOrderNo,
    open: '0',
    po: String(order.purchaseOrderId),
  });

  return `${OVER_RECEIPT_SPLIT_PATH}?${params.toString()}`;
};

export interface LineTableProps {
  /** 고른 발주. 없으면 「왼쪽에서 고르세요」. */
  order: PurchaseOrderSummary | null;
  rows: InboundScheduleLine[];
  isLoading: boolean;
  storageLocationNameOf: (code: string | null) => string;
  /** 품목 조건으로 찾았으면 그 품목. 그 라인을 강조한다. */
  matchedItemId: number | null;
}

/**
 * 오른쪽 표 — **고른 P/O 의 라인 전부**(다 들어온 것·취소된 것 포함 — 상태 칸이 가른다).
 * 이름 칸이 라인에 함께 와(server #762) 품목·단위를 따로 부르지 않는다.
 *
 * 바로가기(「초과 입하 분리」)는 **표 위에 한 번만** 둔다 — 발주 단위의 일이라 줄마다 되풀이할 까닭이 없다.
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 상태 | 84px | 칩 「부분 입하」 64px + 여백. 지연 칩은 두지 않는다(아래 상태 열 주석) |
 * | 라인 | 48px | 세 자리 + 여백 |
 * | 품목코드 | 120px | 10자 ASCII + 여백 |
 * | **품목명** | **미지정** | 남는 폭을 흡수한다. 넘치면 말줄임 |
 * | 발주·입하·남은 수량 | 88px × 3 | 천 단위 7자 + 여백 |
 * | 단위 | 56px | 코드 3자 + 여백 |
 * | 창고 | 184px | 「VICT 자재창고_…」 같은 긴 이름 + 여백. 넘치면 말줄임(전체는 마우스를 올리면) |
 * | 합 | 756px + 흡수 | `.po-board-lines` 최소 폭 `48rem`(768px) |
 */
export const LineTable = ({
  order,
  rows,
  isLoading,
  storageLocationNameOf,
  matchedItemId,
}: LineTableProps) => {
  const columns: Column<InboundScheduleLine>[] = [
    {
      key: 'receiptStatusCode',
      header: t.table.receiptStatus,
      width: '84px',
      /*
       * **지연 칩을 두지 않는다.** 납기는 발주 헤더의 값이라 한 발주의 라인은 모두 같이 늦다 — 줄마다
       * 되풀이하면 뜻 없이 칸만 먹는다. 지연은 왼쪽 표의 발주 줄이 말한다.
       */
      render: (row) => (
        <>
          <ReceiptStatusCell code={row.receiptStatusCode} overdue={false} />
          {/* 품목으로 찾은 라인 표식 — 줄 배경이 따라간다(app.css `tr:has([data-matched])`). */}
          {matchedItemId === row.itemId && (
            <span className="erp-data-table-caption" data-matched="true">
              {t.values.matchedLine}
            </span>
          )}
        </>
      ),
    },
    { key: 'lineNo', header: t.table.lineNo, width: '48px', align: 'end' },
    {
      key: 'itemCode',
      header: t.table.itemCode,
      width: '120px',
      render: (row) => orEmpty(row.itemCode),
    },
    {
      key: 'itemName',
      header: t.table.itemName,
      render: (row) => <OneLine text={orEmpty(row.itemName)} />,
    },
    {
      key: 'orderedQty',
      header: t.table.orderedQty,
      width: '88px',
      align: 'end',
      render: (row) => formatQty(row.orderedQty),
    },
    {
      key: 'receivedQty',
      header: t.table.receivedQty,
      width: '88px',
      align: 'end',
      render: (row) => formatQty(row.receivedQty),
    },
    {
      key: 'remainingQty',
      header: t.table.remainingQty,
      width: '88px',
      align: 'end',
      render: (row) => formatQty(row.remainingQty),
    },
    { key: 'uomCode', header: t.table.uom, width: '56px', render: (row) => orEmpty(row.uomCode) },
    {
      key: 'erpStorageLocationCode',
      header: t.table.storageLocation,
      width: '184px',
      render: (row) => <OneLine text={storageLocationNameOf(row.erpStorageLocationCode)} />,
    },
  ];

  if (order === null) {
    return (
      <EmptyState size="sm" title={t.empty.noOrderTitle} description={t.empty.noOrderDescription} />
    );
  }

  return (
    <>
      {/*
       * 발주 머리(사용자 지시 2026-10-21 — 「밋밋하다」). 이름표 + 값의 칸을 구분선으로 나눠 세운다.
       * 발주번호도 다른 값과 같은 글자다 — 상태는 왼쪽 표가 말한다.
       */}
      <header className="po-board-order-head">
        <div className="po-board-order-title">
          <span className="po-board-order-eyebrow">{t.detail.purchaseOrderNo}</span>
          <span className="po-board-order-no">{order.purchaseOrderNo}</span>
        </div>
        <dl className="po-board-order-facts">
          <div>
            <dt>{t.detail.supplierCode}</dt>
            <dd>{orEmpty(order.supplierCode)}</dd>
          </div>
          <div>
            <dt>{t.detail.supplierName}</dt>
            <dd>{orEmpty(order.supplierName)}</dd>
          </div>
          <div>
            <dt>{t.detail.expectedReceiptDate}</dt>
            <dd>
              {order.expectedReceiptDate == null
                ? t.values.noDueDate
                : formatDate(order.expectedReceiptDate)}
            </dd>
          </div>
          <div>
            <dt>{t.detail.orderDate}</dt>
            <dd>{formatDate(order.orderDate)}</dd>
          </div>
          <div>
            <dt>{t.table.openLines}</dt>
            <dd>
              {typeof order.openLineCount === 'number' && typeof order.lineCount === 'number'
                ? t.values.lineRatio(order.openLineCount, order.lineCount)
                : t.values.empty}
            </dd>
          </div>
        </dl>
        {/* 취소된 발주는 더 받을 것이 없다 — 바로가기를 두면 할 일이 있는 것처럼 읽힌다. */}
        {order.receiptStatusCode !== 'CANCELLED' && (
          <Link
            className="po-board-order-link"
            to={overReceiptSplitPath(order)}
            aria-label={t.actions.overReceiptSplitRow(order.purchaseOrderNo)}
          >
            {t.actions.overReceiptSplit}
          </Link>
        )}
      </header>

      {isLoading ? (
        <div role="status" aria-label={t.loading.lines}>
          <SkeletonText lines={3} />
        </div>
      ) : (
        <div className="wide-table po-board-table po-board-lines">
          <Table
            density="compact"
            caption={<span className="erp-data-table-caption">{t.panes.lines}</span>}
            columns={columns}
            rows={rows}
            getRowId={(row) => String(row.purchaseOrderLineId)}
            empty={<EmptyState size="sm" title={t.empty.noLinesTitle} />}
          />
        </div>
      )}
    </>
  );
};
