import { AlertBanner, Button, Chip, type Column, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { useEffect, useId, useState } from 'react';
import { useSearchParams } from 'react-router';

import { BoardFrame } from '../../patterns/board-frame';
import { BoardTable } from '../../patterns/board-table';
import { SaveErrorBanner } from '../../patterns/master';
import { toPlantDateTimeParts } from '../../patterns/plant-time';
import { toApiError } from '../../patterns/request';
import { readExcessEntry } from './excess-entry';
import {
  EXCESS_PAGE_SIZE,
  useExcessCandidates,
  useLinkExcess,
  useUnallocatedLines,
} from './excess-queries';
import type {
  ExcessCandidate,
  InboundAllocation,
  OrderLineRef,
  UnallocatedLine,
} from './excess-types';
import { LoadErrorBanner } from './load-error-banner';
import { formatDate } from './period';
import { formatQty, OneLine, orEmpty } from './receipt-status';

const t = messages.inboundSchedule.excess;

const NO_EXCESSES: UnallocatedLine[] = [];
const NO_CANDIDATES: ExcessCandidate[] = [];

/** 입하 시각(오프셋 있음) → 공장 날짜 `yyyy.mm.dd`. */
const receiptDateOf = (excess: UnallocatedLine): string => {
  const date = toPlantDateTimeParts(excess.receiptDatetime)?.date;

  return date === undefined ? orEmpty(null) : formatDate(date);
};

const qtyWithUom = (qty: number, uomCode: string): string => `${formatQty(qty)} ${uomCode}`;

export const orderLineText = (ref: OrderLineRef | null): string =>
  ref === null ? orEmpty(null) : t.orderLine(ref.purchaseOrderNo, ref.lineNo);

/** 이 줄이 이미 들어간 발주 라인들 — 다 초과분이라 들어간 곳이 없으면 「—」. */
const allocatedOrdersText = (allocations: readonly InboundAllocation[]): string =>
  allocations.length === 0
    ? orEmpty(null)
    : allocations.map((allocation) => orderLineText(allocation.orderLine)).join(', ');

/** 방금 등록한 전표의 초과분을 앞에 세운다 — 나머지 순서는 서버 순서(오래된 것부터) 그대로다. */
export const orderExcesses = (
  rows: readonly UnallocatedLine[],
  focusReceiptNo: string | null,
): UnallocatedLine[] =>
  focusReceiptNo === null
    ? [...rows]
    : [
        ...rows.filter((row) => row.inboundReceiptNo === focusReceiptNo),
        ...rows.filter((row) => row.inboundReceiptNo !== focusReceiptNo),
      ];

/**
 * 「초과분 발주 연결」 탭(서버 장부 P-115 입하 ↔ P/O 배정) — 입고 관리 묶음의 둘째 탭이다(사용자 지시 2026-10-28 · 옛 오른쪽
 * 창을 탭으로 뗐다). 입고 관리와 같은 짜임이다: 왼쪽은 미연결 초과분, 오른쪽은 고른 초과분과 그것을 연결할 발주 라인 후보.
 *
 * 후보는 서버가 정하고(같은 공장·공급사·품목·단위 · 다 받을 수 있는 라인 · 수량 일치가 먼저) 사람이 고른다.
 * 초과분 한 줄은 늘 **전부** 연결한다(서버는 일부도 받지만 화면은 아직 나누지 않는다). 단추 옆에 무엇이 어디로 가는지
 * 요약을 늘 보인다.
 *
 * 시작 상태는 주소가 정한다(`excess-entry.ts`) — 입고 관리 라인 표의 「초과분」 칸이나 입하 등록 결과에서 건너오면
 * 그 초과분 · 라인을 고른 채로 선다. 고르는 것은 이 화면의 상태다(누를 때마다 뒤로가기 기록이 늘지 않게).
 *
 * 연결 해제는 아직 없다 — 「연결한 초과분」 목록이 서버에 없어 해제할 자리를 정하지 못했다(사용자 결정 2026-10-27).
 */
export const InboundExcessScreen = () => {
  const [searchParams] = useSearchParams();
  const entry = readExcessEntry(searchParams);

  /** 고른 초과분 — 입하 줄 번호(`inboundReceiptLineId`)로 가리킨다. */
  const [selectedExcessId, setSelectedExcessId] = useState<number | null>(
    entry.inboundReceiptLineId,
  );
  const [selectedLineId, setSelectedLineId] = useState<number | null>(entry.purchaseOrderLineId);
  const [done, setDone] = useState<string | null>(null);
  const confirmId = useId();

  const unlinked = useUnallocatedLines({ size: EXCESS_PAGE_SIZE });
  const rows = orderExcesses(unlinked.data?.items ?? NO_EXCESSES, entry.receiptNo);

  const selectedExcess = rows.find((row) => row.inboundReceiptLineId === selectedExcessId) ?? null;
  const candidates = useExcessCandidates(selectedExcess?.inboundReceiptLineId ?? null);
  const candidateRows = candidates.data?.items ?? NO_CANDIDATES;
  /* 고른 줄은 **서버 후보에 있을 때만** 선다 — 화면의 짐작(`excess-match.ts`)이 서버와 다르면 고르지 않는다. */
  const selectedCandidate =
    candidateRows.find((row) => row.purchaseOrderLineId === selectedLineId) ?? null;

  const link = useLinkExcess();
  const isSaving = link.isPending;
  const saveError = link.error;

  /*
   * 고를 것이 하나뿐이면 저절로 고른다 — 방금 등록한 전표의 초과분 하나, 또는 목록 전체가 하나.
   * 사람이 이미 골랐으면 건드리지 않는다.
   */
  const unlinkedItems = unlinked.data?.items;
  useEffect(() => {
    if (unlinkedItems === undefined) return;
    setSelectedExcessId((current) => {
      if (current !== null && unlinkedItems.some((row) => row.inboundReceiptLineId === current)) {
        return current;
      }
      const focused = unlinkedItems.filter((row) => row.inboundReceiptNo === entry.receiptNo);
      const only =
        focused.length === 1
          ? focused[0]
          : unlinkedItems.length === 1
            ? unlinkedItems[0]
            : undefined;

      return only?.inboundReceiptLineId ?? null;
    });
  }, [unlinkedItems, entry.receiptNo]);

  /* 후보가 하나뿐이면 그 라인을 고른다 — 대개 그 초과분 때문에 만든 추가 P/O 다. */
  const candidateItems = candidates.data?.items;
  useEffect(() => {
    if (candidateItems === undefined) return;
    setSelectedLineId((current) => {
      if (current !== null && candidateItems.some((row) => row.purchaseOrderLineId === current)) {
        return current;
      }
      const exact = candidateItems.filter((row) => row.exactMatch);
      const only =
        candidateItems.length === 1 ? candidateItems[0] : exact.length === 1 ? exact[0] : undefined;

      return only?.purchaseOrderLineId ?? null;
    });
  }, [candidateItems]);

  const pickExcess = (row: UnallocatedLine): void => {
    if (isSaving || row.inboundReceiptLineId === selectedExcessId) return;
    setSelectedExcessId(row.inboundReceiptLineId);
    setSelectedLineId(null);
    setDone(null);
    link.reset();
  };

  const pickLine = (row: ExcessCandidate): void => {
    if (isSaving) return;
    setSelectedLineId(row.purchaseOrderLineId);
    setDone(null);
    link.reset();
  };

  const runLink = (): void => {
    if (selectedExcess === null || selectedCandidate === null) return;
    const qty = qtyWithUom(selectedExcess.unallocatedQty, selectedExcess.uomCode);
    const order = t.orderLine(selectedCandidate.purchaseOrderNo, selectedCandidate.lineNo);
    link.mutate(
      {
        inboundReceiptLineId: selectedExcess.inboundReceiptLineId,
        purchaseOrderLineId: selectedCandidate.purchaseOrderLineId,
        qty: selectedExcess.unallocatedQty,
      },
      {
        onSuccess: () => {
          setDone(t.done.linked(qty, order));
          setSelectedExcessId(null);
          setSelectedLineId(null);
        },
      },
    );
  };

  /* ── 단추 옆 문장 — 막힌 사유이거나, 누르면 바뀌는 것 ── */
  const sentence = ((): string => {
    if (selectedExcess === null) return t.blocked.noExcess;
    if (selectedCandidate === null) return t.blocked.noLine;

    return t.confirmLink(
      qtyWithUom(selectedExcess.unallocatedQty, selectedExcess.uomCode),
      t.orderLine(selectedCandidate.purchaseOrderNo, selectedCandidate.lineNo),
    );
  })();
  const canRun = !isSaving && selectedExcess !== null && selectedCandidate !== null;

  /* ── 열 ── */
  const excessColumns: Column<UnallocatedLine>[] = [
    { key: 'receiptDate', header: t.table.receiptDate, width: '104px', render: receiptDateOf },
    {
      key: 'supplier',
      header: t.table.supplier,
      width: '144px',
      render: (row) => <OneLine text={orEmpty(row.supplierName)} />,
    },
    /*
     * 입하번호 열은 두지 않는다 — 고른 초과분의 머리에 선다(사용자 지시 2026-10-28). 품목코드 · 품목명은 열을 나눈다.
     * 고르는 단추와 「방금 등록」 칩은 품목코드 칸이 진다.
     */
    {
      key: 'itemCode',
      header: t.table.itemCode,
      /* 품목코드(10자 안팎) + 「방금 등록」 칩까지 한 줄에. */
      width: '200px',
      render: (row) => (
        <span className="excess-receipt-cell">
          {row.itemCode}
          {row.inboundReceiptNo === entry.receiptNo && (
            <Chip variant="status" status="info" size="sm">
              {t.justRegistered}
            </Chip>
          )}
        </span>
      ),
    },
    {
      key: 'itemName',
      header: t.table.itemName,
      render: (row) => <OneLine text={row.itemName} />,
    },
    {
      key: 'excessQty',
      header: t.table.excessQty,
      width: '112px',
      align: 'end',
      render: (row) => <strong>{qtyWithUom(row.unallocatedQty, row.uomCode)}</strong>,
    },
  ];

  const uomCode = selectedExcess?.uomCode ?? '';
  const candidateColumns: Column<ExcessCandidate>[] = [
    {
      key: 'purchaseOrderNo',
      header: t.candidates.purchaseOrderNo,
      /* 발주번호만 — 라인 번호는 싣지 않는다(사용자 지시 2026-10-28). 칩 둘까지 한 줄에. */
      width: '264px',
      render: (row) => (
        <span className="excess-receipt-cell">
          {row.purchaseOrderNo}
          {row.exactMatch && (
            <Chip variant="status" status="success" size="sm">
              {t.candidates.exact}
            </Chip>
          )}
          {row.purchaseOrderId === entry.purchaseOrderId && (
            <Chip variant="status" status="info" size="sm">
              {t.candidates.current}
            </Chip>
          )}
        </span>
      ),
    },
    /*
     * 후보는 서버가 고른 초과분과 **같은 품목**의 라인만 준다(같은 공장·공급사·품목·단위) — 응답에 품목코드가 없어
     * 고른 초과분의 것을 쓴다.
     */
    {
      key: 'itemCode',
      header: t.candidates.itemCode,
      width: '144px',
      render: () => <OneLine text={selectedExcess?.itemCode ?? orEmpty(null)} />,
    },
    {
      key: 'orderDate',
      header: t.candidates.orderDate,
      width: '96px',
      render: (row) => formatDate(row.orderDate),
    },
    {
      key: 'dueDate',
      header: t.candidates.dueDate,
      width: '96px',
      render: (row) =>
        row.expectedReceiptDate === null ? orEmpty(null) : formatDate(row.expectedReceiptDate),
    },
    {
      key: 'ordered',
      header: t.candidates.ordered,
      width: '96px',
      align: 'end',
      render: (row) => formatQty(row.orderedQty),
    },
    {
      key: 'received',
      header: t.candidates.received,
      width: '96px',
      align: 'end',
      render: (row) => formatQty(row.receivedQty),
    },
    {
      key: 'room',
      header: t.candidates.room,
      align: 'end',
      render: (row) => qtyWithUom(row.roomQty, uomCode),
    },
  ];

  const listBody = (): ReactNode => {
    if (unlinked.isError) {
      return (
        <LoadErrorBanner
          error={unlinked.error}
          onRetry={() => {
            void unlinked.refetch();
          }}
        />
      );
    }
    if (unlinked.isPending) {
      return (
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={3} />
        </div>
      );
    }
    const total = unlinked.data.page.total;

    return (
      <>
        <h2 className="pane-title">{t.listCount(total)}</h2>
        <BoardTable
          label={t.listTitle}
          widthKey="omf-mes:inbound-excess:columns:excess"
          minWidth="720px"
          columns={excessColumns}
          rows={rows}
          getRowId={(row) => String(row.inboundReceiptLineId)}
          pick={{
            columnKey: 'itemCode',
            label: (row) => t.pickExcess(row.inboundReceiptNo, row.lineNo),
            currentId: selectedExcessId === null ? null : String(selectedExcessId),
            onPick: pickExcess,
          }}
          empty={<EmptyState size="sm" title={t.emptyTitle} />}
        />
        {total > rows.length && <p className="field-note">{t.truncated(rows.length, total)}</p>}
      </>
    );
  };

  const candidateBody = (): ReactNode => {
    if (candidates.isError) {
      return (
        <LoadErrorBanner
          error={candidates.error}
          onRetry={() => {
            void candidates.refetch();
          }}
        />
      );
    }
    if (candidates.isPending) {
      return (
        <div role="status" aria-label={t.candidates.loading}>
          <SkeletonText lines={2} />
        </div>
      );
    }

    return (
      <BoardTable
        label={t.candidates.title}
        widthKey="omf-mes:inbound-excess:columns:candidates"
        minWidth="940px"
        columns={candidateColumns}
        rows={candidateRows}
        getRowId={(row) => String(row.purchaseOrderLineId)}
        pick={{
          columnKey: 'purchaseOrderNo',
          label: (row) => t.pickLine(row.purchaseOrderNo, row.lineNo),
          currentId: selectedLineId === null ? null : String(selectedLineId),
          onPick: pickLine,
        }}
        empty={
          <EmptyState
            size="sm"
            title={t.candidates.emptyTitle}
            description={t.candidates.emptyDescription}
          />
        }
      />
    );
  };

  /** 오른쪽 — 고른 초과분의 머리(입고 관리 발주 머리와 같은 모양) · 연결 단추 · 후보 라인. */
  const detailBody = (): ReactNode => {
    const feedback = (
      <>
        {done !== null && (
          <div role="status">
            <AlertBanner variant="success">{done}</AlertBanner>
          </div>
        )}
        {saveError !== null && <SaveErrorBanner error={toApiError(saveError)} />}
      </>
    );

    if (selectedExcess === null) {
      return (
        <>
          {feedback}
          <EmptyState size="sm" title={t.blocked.noExcess} />
        </>
      );
    }

    return (
      <>
        <header className="po-board-order-head">
          <div className="po-board-order-title">
            <span className="po-board-order-eyebrow">{t.table.receiptNo}</span>
            <span className="po-board-order-no">{selectedExcess.inboundReceiptNo}</span>
          </div>
          <dl className="po-board-order-facts">
            <div>
              <dt>{t.table.supplier}</dt>
              <dd>{orEmpty(selectedExcess.supplierName)}</dd>
            </div>
            <div>
              <dt>{t.table.item}</dt>
              <dd>{`${selectedExcess.itemCode} · ${selectedExcess.itemName}`}</dd>
            </div>
            <div>
              <dt>{t.table.excessQty}</dt>
              <dd>
                <strong>{qtyWithUom(selectedExcess.unallocatedQty, selectedExcess.uomCode)}</strong>
              </dd>
            </div>
            <div>
              <dt>{t.table.receiptDate}</dt>
              <dd>{receiptDateOf(selectedExcess)}</dd>
            </div>
            <div>
              <dt>{t.table.lot}</dt>
              <dd>{orEmpty(selectedExcess.lotNo)}</dd>
            </div>
            <div>
              <dt>{t.table.sourceOrder}</dt>
              <dd>{allocatedOrdersText(selectedExcess.allocations)}</dd>
            </div>
          </dl>
          <div className="po-board-order-actions">
            <span id={confirmId} className="po-board-checked-count" aria-live="polite">
              {sentence}
            </span>
            <Button
              size="sm"
              disabled={!canRun}
              loading={isSaving}
              aria-describedby={confirmId}
              onClick={runLink}
            >
              {t.actions.link}
            </Button>
          </div>
        </header>
        {feedback}
        <h3 className="excess-section-title">{t.candidates.title}</h3>
        {candidateBody()}
      </>
    );
  };

  return (
    <BoardFrame
      splitKey="omf-mes:inbound-excess:split"
      /* 왼쪽 표의 고정 폭(576px) + 품목 칸이 1920 폭에서 다 보이게 — 오른쪽은 후보 표가 가로로 넘긴다. */
      initialRatio={0.55}
      splitter={{ label: t.splitter, collapseLabel: t.listCollapse, expandLabel: t.listExpand }}
      list={{ label: t.listTitle, content: listBody() }}
      detail={{ label: t.candidates.title, content: detailBody() }}
    />
  );
};
