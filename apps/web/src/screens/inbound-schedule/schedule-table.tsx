import { Button, Chip, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import {
  describeReference,
  toReference,
  type ItemNameLookup,
  type ReferenceSource,
} from './lookups';
import { isOverdue } from './overdue';
import type { InboundScheduleLine, ReceiptStatusCode } from './types';

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
  line: Pick<InboundScheduleLine, 'purchaseOrderId' | 'purchaseOrderNo'>,
): string => {
  const params = new URLSearchParams({
    q: line.purchaseOrderNo,
    open: '0',
    po: String(line.purchaseOrderId),
  });

  return `${OVER_RECEIPT_SPLIT_PATH}?${params.toString()}`;
};

/** 진행 표식의 색 — 저장소 관례(진행 중 info · 완료 success · 취소 error · 아직 idle)를 따른다. */
type Tone = 'idle' | 'info' | 'success' | 'error' | 'warning';

const RECEIPT_TONE: Record<ReceiptStatusCode, Tone> = {
  NOT_STARTED: 'idle',
  PARTIAL: 'info',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

/** 모르는 코드는 번역하지 않고 그대로, 중립 색으로 낸다 — 뜻을 지어내지 않는다. */
const receiptLabel = (code: string): string =>
  code in t.receiptStatus ? t.receiptStatus[code as ReceiptStatusCode] : code;

const receiptTone = (code: string): Tone =>
  code in RECEIPT_TONE ? RECEIPT_TONE[code as ReceiptStatusCode] : 'idle';

const formatQty = (value: number): string => value.toLocaleString();

export interface ScheduleTableProps {
  rows: InboundScheduleLine[];
  isLoading: boolean;
  /**
   * 조회가 실제로 나갔는가. **거짓이면 「결과가 없다」로 말하지 않는다** —
   * 보낼 수 없는 기간이면 요청 자체가 나가지 않는다.
   */
  hasQuery: boolean;
  /** 결과는 있는데 이 쪽에는 없다. 「결과가 없다」와 다른 안내를 낸다. */
  isBeyondLast: boolean;
  /** 공장 달력의 오늘(`YYYY-MM-DD`). 화면이 인자로 준다 — 표가 직접 읽으면 테스트가 실행 환경의 시각을 검사하게 된다. */
  today: string;
  supplierLookup: ReferenceSource;
  uomLookup: ReferenceSource;
  itemNames: ItemNameLookup;
  storageLocationNameOf: (code: string | null) => string;
  onFirstPage: () => void;
  onRetryReferences: () => void;
}

/**
 * 입하 예정 표 — P/O 라인 한 줄이 한 행이다. 정렬은 **서버가 정한 순서 그대로**다
 * (납기 → 발주번호 → 라인번호, 납기 없는 것은 뒤). 쪽을 넘어 같은 순서가 이어지므로 열 정렬을 두지 않는다.
 *
 * 열 폭의 도출(`docs/layout-conventions.md`의 방식 — 흡수 열에도 예산을 잡는다):
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 납기 | 120px | `YYYY-MM-DD` 75px + 아래에 쌓이는 「지연」 칩 + 셀 여백 32px |
 * | 발주번호 | 168px | 14자 ASCII 105px + 32px. ERP 발주번호가 아래 줄에 붙는다 |
 * | 라인 | 64px | 세 자리 숫자 + 32px |
 * | **공급사** | **미지정** | 「코드 · 이름」 — 남는 폭을 품목과 나눠 흡수한다 |
 * | **품목** | **미지정** | 「코드 · 이름」 |
 * | 발주·입하·남은 수량 | 104px × 3 | 천 단위 구분 9자 68px + 32px |
 * | 단위 | 72px | 코드 4자 + 32px |
 * | 진행 | 120px | 칩(한글 5자 70px + 안쪽 여백 24px) + 32px |
 * | 창고 | 136px | 창고 이름 한글 6자 + 32px |
 * | 바로가기 | 136px | 「초과 입하 분리」 7자 + 32px |
 * | 지정 폭 합 | 1,128px | |
 * | 흡수 열 예산 | 2 × 200px | 「코드 · 이름」이 접히지 않고 읽히는 하한 |
 * | **합** | **1,528px** | `.inbound-schedule-table` 최소 폭 `96rem`(1,536px) 안에 들어간다 |
 *
 * **행 바로가기는 「초과 입하 분리」 하나다.** 「자재 입고 처리」는 발주를 주소로 받지 않아
 * (그 화면의 주소 키는 입하 전표 `ir`·`line` 뿐이다) 열어도 그 발주가 고른 채로 서지 않는다 —
 * 그 화면은 사이드바 탭으로 간다.
 */
export const ScheduleTable = ({
  rows,
  isLoading,
  hasQuery,
  isBeyondLast,
  today,
  supplierLookup,
  uomLookup,
  itemNames,
  storageLocationNameOf,
  onFirstPage,
  onRetryReferences,
}: ScheduleTableProps) => {
  const columns: Column<InboundScheduleLine>[] = [
    {
      key: 'expectedReceiptDate',
      header: t.table.expectedReceiptDate,
      width: '120px',
      render: (row) => (
        <div className="field-cell">
          <span>{row.expectedReceiptDate ?? t.values.noDueDate}</span>
          {isOverdue(row, today) && (
            <Chip variant="status" status="warning" size="sm">
              {t.values.overdue}
            </Chip>
          )}
        </div>
      ),
    },
    {
      key: 'purchaseOrderNo',
      header: t.table.purchaseOrderNo,
      width: '168px',
      render: (row) => (
        <div className="field-cell">
          <span>{row.purchaseOrderNo}</span>
          {row.erpPurchaseOrderNo !== null && (
            <span className="field-note">
              {t.values.erpPurchaseOrderNo(row.erpPurchaseOrderNo)}
            </span>
          )}
        </div>
      ),
    },
    { key: 'lineNo', header: t.table.lineNo, width: '64px', align: 'end' },
    {
      key: 'supplier',
      header: t.table.supplier,
      /* **번호를 문자열로 바꾸는 자리가 없다**(#44). 풀 수 없는 세 갈래는 전부 문구로 갈린다. */
      render: (row) => describeReference(toReference(supplierLookup, row.supplierId)),
    },
    {
      key: 'item',
      header: t.table.item,
      render: (row) => describeReference(itemNames.of(row.itemId)),
    },
    {
      key: 'orderedQty',
      header: t.table.orderedQty,
      width: '104px',
      align: 'end',
      render: (row) => formatQty(row.orderedQty),
    },
    {
      key: 'receivedQty',
      header: t.table.receivedQty,
      width: '104px',
      align: 'end',
      render: (row) => formatQty(row.receivedQty),
    },
    {
      key: 'remainingQty',
      header: t.table.remainingQty,
      width: '104px',
      align: 'end',
      render: (row) => formatQty(row.remainingQty),
    },
    {
      key: 'uom',
      header: t.table.uom,
      width: '72px',
      render: (row) => describeReference(toReference(uomLookup, row.uomId)),
    },
    {
      key: 'receiptStatusCode',
      header: t.table.receiptStatus,
      width: '120px',
      /* 취소(라인 ERP 취소 · 헤더 취소)도 서버가 진행 값으로 준다(`CANCELLED`) — 따로 판정하지 않는다. */
      render: (row) => (
        <Chip variant="status" status={receiptTone(row.receiptStatusCode)} size="sm">
          {receiptLabel(row.receiptStatusCode)}
        </Chip>
      ),
    },
    {
      key: 'erpStorageLocationCode',
      header: t.table.storageLocation,
      width: '136px',
      render: (row) => storageLocationNameOf(row.erpStorageLocationCode),
    },
    {
      key: 'actions',
      header: t.table.actions,
      width: '136px',
      /* 취소된 라인은 더 받을 것이 없다 — 바로가기를 두면 할 일이 있는 것처럼 읽힌다. */
      render: (row) =>
        row.receiptStatusCode !== 'CANCELLED' ? (
          <Link
            to={overReceiptSplitPath(row)}
            aria-label={t.actions.overReceiptSplitRow(row.purchaseOrderNo)}
          >
            {t.actions.overReceiptSplit}
          </Link>
        ) : (
          t.values.empty
        ),
    },
  ];

  if (isLoading) {
    return (
      <div role="status" aria-label={t.loading.list}>
        <SkeletonText lines={3} />
      </div>
    );
  }

  /**
   * 조회 전 → 범위 밖 쪽 → 결과 없음 순서로 하나만 낸다. 셋은 사용자가 할 조치가 서로 다르다.
   * 조회 전의 사유는 조건 줄이 이미 밝히므로 여기서는 `live`를 붙이지 않는다.
   */
  const emptySlot = (): ReactNode => {
    if (!hasQuery) {
      return (
        <EmptyState
          size="sm"
          title={t.empty.notQueriedTitle}
          description={t.empty.notQueriedDescription}
        />
      );
    }

    if (isBeyondLast) {
      return (
        <EmptyState
          size="sm"
          live
          title={t.empty.beyondLastTitle}
          description={t.empty.beyondLastDescription}
          action={
            <Button variant="outlined" onClick={onFirstPage}>
              {t.actions.goFirstPage}
            </Button>
          }
        />
      );
    }

    return (
      <EmptyState
        size="sm"
        live
        title={t.empty.noResultTitle}
        description={t.empty.noResultDescription}
      />
    );
  };

  const referencesFailed = supplierLookup.isError || uomLookup.isError || itemNames.isError;

  return (
    <>
      <div className="wide-table inbound-schedule-table">
        <Table
          density="compact"
          columns={columns}
          rows={rows}
          /* 라인 번호는 React key로만 쓰인다 — 셀 텍스트가 되지 않는다(#44). */
          getRowId={(row) => String(row.purchaseOrderLineId)}
          empty={emptySlot()}
        />
      </div>

      {referencesFailed && (
        <div className="field-cell">
          <span className="field-note">{t.reasons.referencesFailed}</span>
          <Button variant="outlined" size="sm" onClick={onRetryReferences}>
            {messages.common.retry}
          </Button>
        </div>
      )}
    </>
  );
};
