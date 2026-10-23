import { Button, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState, type ReactNode } from 'react';

import { useColumnWidths } from '../../patterns/column-resize';
import type { ExcessEntry } from './excess-entry';
import { lineExcessesOf, type LineExcesses } from './excess-match';
import {
  LotActionCell,
  LotMainCell,
  lotLocation,
  StageChip,
  StageGroupChip,
  TreeGuide,
  TreeToggle,
} from './lot-row';
import { formatDate } from './period';
import { formatQty, OneLine, orEmpty, ReceiptStatusCell } from './receipt-status';
import {
  lineTableRowId,
  linesWithLots,
  presentGroups,
  toLineTableRows,
  type LineTableRow,
} from './stage';
import type {
  InboundLotProgress,
  InboundScheduleLine,
  IssuedLotProgress,
  PurchaseOrderSummary,
} from './types';

const t = messages.inboundSchedule;

export interface LineTableProps {
  /** 고른 발주. 없으면 「왼쪽에서 고르세요」. */
  order: PurchaseOrderSummary | null;
  rows: InboundScheduleLine[];
  isLoading: boolean;
  storageLocationNameOf: (code: string | null) => string;
  /** 품목 조건으로 찾았으면 그 품목. 그 라인을 강조한다. */
  matchedItemId: number | null;
  /**
   * 라인마다 연결할 수 있는 · 이미 연결된 초과분(`excess-match.ts`). 비었으면 「초과분」 열을 세우지 않는다 —
   * 드문 일이라 늘 칸을 먹지 않는다(사용자 지시 2026-10-21 「자주 쓰지 않는 일은 눈에 띄지 않게」).
   */
  lineExcesses?: ReadonlyMap<number, LineExcesses>;
  /** 초과분 연결 창을 그 초과분·라인을 고른 채로 연다. */
  onOpenExcess?: (entry: Partial<ExcessEntry>) => void;
  /** 고른 발주의 「입하 등록」 창을 연다. 없으면(등록 권한 없음) 단추를 세우지 않는다. */
  onRegister?: (purchaseOrderId: number) => void;
  /**
   * 라인별 LOT 진행(`stage.ts` `progressByLine` · 계약 대기). **`undefined` 면 앞선 서버거나 조회 전**이라
   * 라인만 선다 — 접기 손잡이·「다음 할 일」 열도 없다. 빈 Map 은 「LOT 이 없다」다.
   */
  lots?: ReadonlyMap<number, InboundLotProgress[]>;
  /** 진행 조회가 실패했다(404·403 은 아님) — 라인은 그대로 두고 한 줄로 알린다. */
  progressFailed?: boolean;
  /** 표 위에 서는 한 줄(IQC 의뢰 결과 · 실패 배너). */
  notice?: ReactNode;
  /** 보내는 중인 IQC 의뢰의 LOT. 그 단추만 돈다. */
  requestingLotId?: number | null;
  /** LOT 줄의 「입고 처리」 — 없으면(권한 없음) 세우지 않는다. */
  onPostReceipt?: (lot: IssuedLotProgress) => void;
  /** LOT 줄의 「IQC 의뢰 요청」. */
  onRequestIqc?: (lot: IssuedLotProgress) => void;
}

const NO_LINE_EXCESSES: ReadonlyMap<number, LineExcesses> = new Map();
const NO_COLLAPSED: ReadonlySet<number> = new Set();

const te = messages.inboundSchedule.excess;

/**
 * 「초과분」 칸 — 이 줄에 연결할 수 있는 초과분이 있으면 「500 연결」, 이미 연결했으면 「500 연결됨」.
 * 누르면 연결 창이 그 초과분과 이 줄을 고른 채로 열린다 — 사람은 「연결」만 누른다.
 */
const ExcessCell = ({
  row,
  excesses,
  onOpen,
}: {
  row: InboundScheduleLine;
  excesses: LineExcesses;
  onOpen: (entry: Partial<ExcessEntry>) => void;
}) => {
  const first = excesses.linkable[0];
  if (first !== undefined) {
    const qty =
      excesses.linkable.length === 1
        ? `${formatQty(first.excessQty)} ${first.uomCode}`
        : `${String(excesses.linkable.length)}건`;

    return (
      <Button
        variant="outlined"
        size="sm"
        aria-label={te.lineLinkableLabel(row.lineNo, qty)}
        onClick={() => {
          onOpen({
            excessId: excesses.linkable.length === 1 ? first.inboundReceiptExcessId : null,
            purchaseOrderLineId: row.purchaseOrderLineId,
          });
        }}
      >
        {te.lineLinkable(qty)}
      </Button>
    );
  }

  const linked = excesses.linked[0];
  if (linked === undefined) return null;
  const qty = `${formatQty(linked.excessQty)} ${linked.uomCode}`;

  return (
    <Button
      variant="text"
      size="sm"
      aria-label={te.lineLinkedLabel(row.lineNo, qty)}
      onClick={() => {
        onOpen({ tab: 'linked', excessId: linked.inboundReceiptExcessId });
      }}
    >
      {te.lineLinked(qty)}
    </Button>
  );
};

/** 발주 머리의 「진행」 — 수가 있는 묶음을 흐름 순서로. LOT 이 없으면 미착수는 「입하 전」, 아니면 「—」. */
const OrderProgress = ({ order }: { order: PurchaseOrderSummary }) => {
  const counts = order.inboundStageCounts;

  if (counts === undefined) return null;

  const groups = presentGroups(counts);

  if (groups.length === 0) {
    return (
      <div>
        <dt>{t.table.progress}</dt>
        <dd>
          {order.receiptStatusCode === 'NOT_STARTED' ? t.stage.beforeReceipt : t.values.empty}
        </dd>
      </div>
    );
  }

  return (
    <div>
      <dt>{t.table.progress}</dt>
      <dd>
        <span className="po-board-progress">
          {groups.map((group) => (
            <StageGroupChip key={group} group={group} count={counts[group]} />
          ))}
        </span>
      </dd>
    </div>
  );
};

/**
 * 오른쪽 표 — **고른 P/O 의 라인 전부**(다 들어온 것·취소된 것 포함 — 상태 칸이 가른다).
 * 이름 칸이 라인에 함께 와(server #762) 품목·단위를 따로 부르지 않는다.
 *
 * **라인 아래에 LOT 줄이 딸린다**(사용자 지시 2026-10-22 · 입고 관리). 서버가 진행 자료를 주면(`lots`) 라인마다 그 라인에서
 * 나온 LOT 이 한 단 낮은 줄로 서고, 첫 칸의 안내선이 계층을 보인다. 라인의 손잡이가 그 라인의 LOT 을, 머리칸의 손잡이가
 * 전부를 접고 편다. 접힘은 이 부품의 상태다 — 발주가 바뀌면 다 펼친 채로 돌아간다(주소에 싣지 않는다 — 접을 때마다 뒤로가기
 * 기록이 늘어서는 안 된다).
 *
 * 「입하 등록」은 **표 위에 한 번만** 둔다 — 발주 단위의 일이라 줄마다 되풀이할 까닭이 없다.
 *
 * 아래는 기본 폭이다 — 머리칸 오른쪽 끝을 끌어 바꿀 수 있다(`patterns/column-resize.tsx`).
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 상태 | 84px · 진행 자료가 있으면 116px | 칩 「부분 입하」 64px + 여백. 진행 자료가 있으면 접기 손잡이(24px) + 틈이 앞에 선다. 지연 칩은 두지 않는다(아래 상태 열 주석) |
 * | 라인 | 48px | 세 자리 + 여백 |
 * | 품목코드 | 120px | 10자 ASCII + 여백. LOT 줄은 비운다 |
 * | **품목명** | **미지정** | 남는 폭을 흡수한다. 넘치면 말줄임. LOT 줄은 LOT 번호(그대로) + 근거(입하일 · 검사 · 입고 · 적치) |
 * | 발주·입하·남은 수량 | 88px × 3 | 천 단위 7자 + 여백. LOT 줄은 입하 수량만 |
 * | 단위 | 56px | 코드 3자 + 여백 |
 * | 창고 | 184px | 「VICT 자재창고_…」 같은 긴 이름 + 여백. 넘치면 말줄임(전체는 마우스를 올리면). **LOT 줄은 적치된 위치, 아직 없으면 다음 할 일**(「입고 처리」·「IQC 의뢰 요청」 단추 · 「PDA에서 적치」) — 열을 하나 더 세우면 1920 폭에서 품목명 칸이 사라진다 |
 * | 합 | 756px + 흡수 (진행 자료가 있으면 788px) | `.po-board-lines` 최소 폭은 `max(48rem + 늘린 폭, 고정 폭 합)` |
 */
export const LineTable = ({
  order,
  rows,
  isLoading,
  storageLocationNameOf,
  matchedItemId,
  lineExcesses = NO_LINE_EXCESSES,
  onOpenExcess,
  onRegister,
  lots,
  progressFailed = false,
  notice,
  requestingLotId = null,
  onPostReceipt,
  onRequestIqc,
}: LineTableProps) => {
  const isTree = lots !== undefined;

  /** 접은 라인(라인 번호). 발주가 바뀌면 비운다 — 앞 발주의 접힘이 다음 발주에 남지 않는다. */
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(NO_COLLAPSED);
  const orderId = order?.purchaseOrderId ?? null;

  useEffect(() => {
    setCollapsed(NO_COLLAPSED);
  }, [orderId]);

  const withLots = linesWithLots(rows, lots);
  const isAllCollapsed = withLots.length > 0 && withLots.every((id) => collapsed.has(id));

  const toggleAll = (): void => {
    setCollapsed(isAllCollapsed ? NO_COLLAPSED : new Set(withLots));
  };

  const toggleLine = (purchaseOrderLineId: number): void => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(purchaseOrderLineId)) next.delete(purchaseOrderLineId);
      else next.add(purchaseOrderLineId);

      return next;
    });
  };

  const tableRows = toLineTableRows(rows, lots, collapsed);

  const columns: Column<LineTableRow>[] = [
    {
      key: 'receiptStatusCode',
      header:
        isTree && withLots.length > 0 ? (
          <span className="po-board-tree-head">
            <TreeToggle
              isExpanded={!isAllCollapsed}
              label={isAllCollapsed ? t.actions.expandAll : t.actions.collapseAll}
              onToggle={toggleAll}
            />
            {t.table.receiptStatus}
          </span>
        ) : (
          t.table.receiptStatus
        ),
      width: isTree ? '116px' : '84px',
      /*
       * **지연 칩을 두지 않는다.** 납기는 발주 헤더의 값이라 한 발주의 라인은 모두 같이 늦다 — 줄마다
       * 되풀이하면 뜻 없이 칸만 먹는다. 지연은 왼쪽 표의 발주 줄이 말한다.
       */
      render: (row) =>
        row.kind === 'lot' ? (
          <span className="po-board-tree-cell">
            <TreeGuide isLast={row.isLast} />
            <StageChip code={row.lot.stageCode} />
          </span>
        ) : (
          <span className="po-board-tree-cell">
            {isTree &&
              (row.lots.length > 0 ? (
                <TreeToggle
                  isExpanded={row.isExpanded}
                  label={
                    row.isExpanded
                      ? t.actions.collapseLine(row.line.lineNo)
                      : t.actions.expandLine(row.line.lineNo)
                  }
                  onToggle={() => {
                    toggleLine(row.line.purchaseOrderLineId);
                  }}
                />
              ) : (
                <span className="po-board-tree-spacer" aria-hidden="true" />
              ))}
            <ReceiptStatusCell code={row.line.receiptStatusCode} overdue={false} />
            {/* 품목으로 찾은 라인 표식 — 줄 배경이 따라간다(app.css `tr:has([data-matched])`). */}
            {matchedItemId === row.line.itemId && (
              <span className="erp-data-table-caption" data-matched="true">
                {t.values.matchedLine}
              </span>
            )}
          </span>
        ),
    },
    {
      key: 'lineNo',
      header: t.table.lineNo,
      width: '48px',
      align: 'end',
      render: (row) => (row.kind === 'line' ? row.line.lineNo : ''),
    },
    {
      key: 'itemCode',
      header: t.table.itemCode,
      width: '120px',
      render: (row) => (row.kind === 'line' ? orEmpty(row.line.itemCode) : ''),
    },
    {
      key: 'itemName',
      header: t.table.itemName,
      render: (row) =>
        row.kind === 'line' ? (
          <OneLine text={orEmpty(row.line.itemName)} />
        ) : (
          <LotMainCell lot={row.lot} />
        ),
    },
    {
      key: 'orderedQty',
      header: t.table.orderedQty,
      width: '88px',
      align: 'end',
      render: (row) => (row.kind === 'line' ? formatQty(row.line.orderedQty) : ''),
    },
    {
      key: 'receivedQty',
      header: t.table.receivedQty,
      width: '88px',
      align: 'end',
      render: (row) =>
        row.kind === 'line' ? formatQty(row.line.receivedQty) : formatQty(row.lot.receivedQty),
    },
    {
      key: 'remainingQty',
      header: t.table.remainingQty,
      width: '88px',
      align: 'end',
      render: (row) => (row.kind === 'line' ? formatQty(row.line.remainingQty) : ''),
    },
    /* 「초과분」은 수량 바로 뒤 — 표가 넓어 끝에 두면 가로 스크롤 밖으로 밀린다. */
    ...(lineExcesses.size > 0 && onOpenExcess !== undefined
      ? [
          {
            key: 'excess',
            header: te.lineColumn,
            width: '120px',
            render: (row: LineTableRow) =>
              row.kind === 'line' ? (
                <ExcessCell
                  row={row.line}
                  excesses={lineExcessesOf(lineExcesses, row.line.purchaseOrderLineId)}
                  onOpen={onOpenExcess}
                />
              ) : null,
          } satisfies Column<LineTableRow>,
        ]
      : []),
    {
      key: 'uomCode',
      header: t.table.uom,
      width: '56px',
      render: (row) => (row.kind === 'line' ? orEmpty(row.line.uomCode) : row.lot.uomCode),
    },
    {
      key: 'erpStorageLocationCode',
      header: t.table.storageLocation,
      width: '184px',
      /* LOT 줄 — 이미 자리가 있으면(적치·임시 적치) 그 위치, 아직 없으면 다음 할 일(서버가 정한 것만 · C-17). */
      render: (row) => {
        if (row.kind === 'line') {
          return <OneLine text={storageLocationNameOf(row.line.erpStorageLocationCode)} />;
        }

        const location = lotLocation(row.lot);

        return location !== '' ? (
          <OneLine text={location} />
        ) : (
          <LotActionCell
            lot={row.lot}
            requestingLotId={requestingLotId}
            {...(onPostReceipt === undefined ? {} : { onPostReceipt })}
            {...(onRequestIqc === undefined ? {} : { onRequestIqc })}
          />
        );
      },
    },
  ];
  const resizable = useColumnWidths('omf-mes:inbound-schedule:columns:lines', columns);

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
          <OrderProgress order={order} />
        </dl>
        {/* 취소된 발주는 더 받을 것이 없다 — 단추를 두면 할 일이 있는 것처럼 읽힌다. */}
        {onRegister !== undefined && order.receiptStatusCode !== 'CANCELLED' && (
          <div className="po-board-order-actions">
            <Button
              size="sm"
              aria-label={t.actions.registerRow(order.purchaseOrderNo)}
              onClick={() => {
                onRegister(order.purchaseOrderId);
              }}
            >
              {t.actions.register}
            </Button>
          </div>
        )}
      </header>

      {isLoading ? (
        <div role="status" aria-label={t.loading.lines}>
          <SkeletonText lines={3} />
        </div>
      ) : (
        <>
          {notice}
          {progressFailed && (
            <p className="field-note" role="status">
              {t.lot.loadFailed}
            </p>
          )}
          <div className="wide-table po-board-table po-board-lines" style={resizable.style}>
            <Table
              density="compact"
              caption={<span className="erp-data-table-caption">{t.panes.lines}</span>}
              columns={resizable.columns}
              rows={tableRows}
              getRowId={lineTableRowId}
              empty={<EmptyState size="sm" title={t.empty.noLinesTitle} />}
            />
          </div>
        </>
      )}
    </>
  );
};
