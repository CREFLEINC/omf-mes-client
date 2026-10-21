import {
  AlertBanner,
  Button,
  Chip,
  type Column,
  Dialog,
  EmptyState,
  SkeletonText,
  Stepper,
  type StepperItem,
  Table,
  Tabs,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { MouseEvent, ReactNode } from 'react';
import { useEffect, useId, useState } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { toPlantDateTimeParts } from '../../patterns/plant-time';
import { toApiError } from '../../patterns/request';
import type { ExcessEntry, ExcessTab } from './excess-entry';
import {
  EXCESS_PAGE_SIZE,
  useExcessCandidates,
  useInboundExcesses,
  useLinkExcess,
  useUnlinkExcess,
} from './excess-queries';
import type { ExcessCandidate, InboundExcess, OrderLineRef } from './excess-types';
import { LoadErrorBanner } from './load-error-banner';
import { formatDate } from './period';
import { formatQty, OneLine, orEmpty } from './receipt-status';

const t = messages.inboundSchedule.excess;

const NO_EXCESSES: InboundExcess[] = [];
const NO_CANDIDATES: ExcessCandidate[] = [];

/** 입하 시각(오프셋 있음) → 공장 날짜 `yyyy.mm.dd`. */
const receiptDateOf = (excess: InboundExcess): string => {
  const date = toPlantDateTimeParts(excess.receiptDatetime)?.date;

  return date === undefined ? orEmpty(null) : formatDate(date);
};

const qtyWithUom = (qty: number, uomCode: string): string => `${formatQty(qty)} ${uomCode}`;

export const orderLineText = (ref: OrderLineRef | null): string =>
  ref === null ? orEmpty(null) : t.orderLine(ref.purchaseOrderNo, ref.lineNo);

/**
 * 표 부품에 줄 클릭이 없어 감싼 상자가 받는다 — 누른 줄 안의 고르기 단추(`data-pick`)로 어느 줄인지 안다.
 * 키보드는 그 단추가 받는다(Enter·Space 가 단추의 click 을 내어 여기로 올라온다). 입하 예정 발주 목록과 같은 길이다.
 */
const pickedIdOf = (event: MouseEvent<HTMLElement>): number | null => {
  const row = (event.target as HTMLElement).closest('tbody tr');
  const raw = row?.querySelector<HTMLElement>('[data-pick]')?.dataset.pick;

  return raw === undefined ? null : Number(raw);
};

interface PickButtonProps {
  id: number;
  selected: boolean;
  label: string;
  children: ReactNode;
}

const PickButton = ({ id, selected, label, children }: PickButtonProps) => (
  <button
    type="button"
    className="link-cell"
    aria-current={selected ? true : undefined}
    aria-label={label}
    data-pick={id}
  >
    {children}
  </button>
);

/** 방금 등록한 전표의 초과분을 앞에 세운다 — 나머지 순서는 서버 순서(오래된 것부터) 그대로다. */
export const orderExcesses = (
  rows: readonly InboundExcess[],
  focusReceiptNo: string | null,
): InboundExcess[] =>
  focusReceiptNo === null
    ? [...rows]
    : [
        ...rows.filter((row) => row.inboundReceiptNo === focusReceiptNo),
        ...rows.filter((row) => row.inboundReceiptNo !== focusReceiptNo),
      ];

export interface ExcessPanelProps {
  /** 주소가 정한 시작 상태(`excess-entry.ts`). */
  entry: ExcessEntry;
  /** 상세에서 보던 발주 — 그 발주의 후보 라인에 표식을 단다. 없으면 `null`. */
  currentOrderId: number | null;
  onClose: () => void;
}

/**
 * 초과분 발주 연결 창(서버 장부 P-100) — **오른쪽에서 열리는 넓은 창이다.** 입하 예정의 두 표를 덮지 않고 옆에
 * 세워 「어느 추가 발주에 연결하는가」를 보던 맥락에서 정한다.
 *
 * 위에 세 단계(초과분 선택 → 발주 라인 선택 → 연결)를 두고, 단추 옆에 무엇이 어디로 가는지 요약을 늘 보인다.
 * 후보는 서버가 정하고(같은 공장·공급사·품목·단위 · 다 받을 수 있는 라인 · 수량 일치가 먼저) 사람이 고른다.
 * 연결한 것은 「연결됨」 탭에서 해제한다 — 잘못 연결한 것을 되돌리는 길이다.
 */
export const ExcessPanel = ({ entry, currentOrderId, onClose }: ExcessPanelProps) => {
  const [tab, setTab] = useState<ExcessTab>(entry.tab);
  const [selectedExcessId, setSelectedExcessId] = useState<number | null>(entry.excessId);
  const [selectedLineId, setSelectedLineId] = useState<number | null>(entry.purchaseOrderLineId);
  const [done, setDone] = useState<string | null>(null);
  const confirmId = useId();

  const unlinked = useInboundExcesses({ linked: false, size: EXCESS_PAGE_SIZE });
  const linked = useInboundExcesses({ linked: true, size: EXCESS_PAGE_SIZE }, tab === 'linked');
  const active = tab === 'unlinked' ? unlinked : linked;
  const rows = orderExcesses(active.data?.items ?? NO_EXCESSES, entry.receiptNo);

  const selectedExcess =
    rows.find((row) => row.inboundReceiptExcessId === selectedExcessId) ?? null;
  const candidates = useExcessCandidates(
    tab === 'unlinked' && selectedExcess !== null ? selectedExcess.inboundReceiptExcessId : null,
  );
  const candidateRows = candidates.data?.items ?? NO_CANDIDATES;
  /* 고른 줄은 **서버 후보에 있을 때만** 선다 — 화면의 짐작(`excess-match.ts`)이 서버와 다르면 고르지 않는다. */
  const selectedCandidate =
    candidateRows.find((row) => row.purchaseOrderLineId === selectedLineId) ?? null;

  const link = useLinkExcess();
  const unlink = useUnlinkExcess();
  const isSaving = link.isPending || unlink.isPending;
  const saveError = link.error ?? unlink.error;

  /*
   * 고를 것이 하나뿐이면 저절로 고른다 — 방금 등록한 전표의 초과분 하나, 또는 목록 전체가 하나.
   * 사람이 이미 골랐으면 건드리지 않는다.
   */
  const unlinkedItems = unlinked.data?.items;
  useEffect(() => {
    if (tab !== 'unlinked' || unlinkedItems === undefined) return;
    setSelectedExcessId((current) => {
      if (current !== null && unlinkedItems.some((row) => row.inboundReceiptExcessId === current)) {
        return current;
      }
      const focused = unlinkedItems.filter((row) => row.inboundReceiptNo === entry.receiptNo);
      const only =
        focused.length === 1
          ? focused[0]
          : unlinkedItems.length === 1
            ? unlinkedItems[0]
            : undefined;

      return only?.inboundReceiptExcessId ?? null;
    });
  }, [tab, unlinkedItems, entry.receiptNo]);

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

  const changeTab = (next: string): void => {
    setTab(next === 'linked' ? 'linked' : 'unlinked');
    setSelectedExcessId(null);
    setSelectedLineId(null);
    setDone(null);
    link.reset();
    unlink.reset();
  };

  const pickExcess = (id: number): void => {
    if (isSaving || id === selectedExcessId) return;
    setSelectedExcessId(id);
    setSelectedLineId(null);
    setDone(null);
    link.reset();
    unlink.reset();
  };

  const pickLine = (id: number): void => {
    if (isSaving) return;
    setSelectedLineId(id);
    setDone(null);
    link.reset();
  };

  const runLink = (): void => {
    if (selectedExcess === null || selectedCandidate === null) return;
    const qty = qtyWithUom(selectedExcess.excessQty, selectedExcess.uomCode);
    const order = t.orderLine(selectedCandidate.purchaseOrderNo, selectedCandidate.lineNo);
    link.mutate(
      {
        inboundReceiptExcessId: selectedExcess.inboundReceiptExcessId,
        purchaseOrderLineId: selectedCandidate.purchaseOrderLineId,
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

  const runUnlink = (): void => {
    if (selectedExcess === null) return;
    const qty = qtyWithUom(selectedExcess.excessQty, selectedExcess.uomCode);
    const order = orderLineText(selectedExcess.linkedOrderLine);
    unlink.mutate(selectedExcess.inboundReceiptExcessId, {
      onSuccess: () => {
        setDone(t.done.unlinked(qty, order));
        setSelectedExcessId(null);
      },
    });
  };

  /* ── 단계 안내 ── */
  const step: 'pick' | 'line' | 'link' =
    selectedExcess === null ? 'pick' : selectedCandidate !== null ? 'link' : 'line';
  const stepOrder = ['pick', 'line', 'link'] as const;
  const stepIndex = stepOrder.indexOf(step);
  const stepItems: StepperItem[] = stepOrder.map((key, index) => ({
    label: t.steps[key],
    status: index < stepIndex ? 'complete' : index === stepIndex ? 'current' : 'pending',
  }));

  /* ── 단추 옆 문장 — 막힌 사유이거나, 누르면 바뀌는 것 ── */
  const sentence = ((): string => {
    if (tab === 'linked') {
      return selectedExcess === null
        ? t.blocked.noLinked
        : t.confirmUnlink(
            qtyWithUom(selectedExcess.excessQty, selectedExcess.uomCode),
            orderLineText(selectedExcess.linkedOrderLine),
          );
    }
    if (selectedExcess === null) return t.blocked.noExcess;
    if (selectedCandidate === null) return t.blocked.noLine;

    return t.confirmLink(
      qtyWithUom(selectedExcess.excessQty, selectedExcess.uomCode),
      t.orderLine(selectedCandidate.purchaseOrderNo, selectedCandidate.lineNo),
    );
  })();
  const canRun =
    !isSaving && selectedExcess !== null && (tab === 'linked' || selectedCandidate !== null);

  /* ── 열 ── */
  const excessHead: Column<InboundExcess>[] = [
    {
      key: 'receiptNo',
      header: t.table.receiptNo,
      width: '184px',
      render: (row) => (
        <span className="excess-receipt-cell">
          <PickButton
            id={row.inboundReceiptExcessId}
            selected={row.inboundReceiptExcessId === selectedExcessId}
            label={t.pickExcess(row.inboundReceiptNo, row.lineNo)}
          >
            {row.inboundReceiptNo}
          </PickButton>
          {row.inboundReceiptNo === entry.receiptNo && (
            <Chip variant="status" status="info" size="sm">
              {t.justRegistered}
            </Chip>
          )}
        </span>
      ),
    },
    { key: 'receiptDate', header: t.table.receiptDate, width: '96px', render: receiptDateOf },
    {
      key: 'supplier',
      header: t.table.supplier,
      render: (row) => <OneLine text={orEmpty(row.supplierName)} />,
    },
    {
      key: 'item',
      header: t.table.item,
      render: (row) => <OneLine text={`${row.itemCode} · ${row.itemName}`} />,
    },
    {
      key: 'excessQty',
      header: t.table.excessQty,
      width: '104px',
      align: 'end',
      render: (row) => <strong>{qtyWithUom(row.excessQty, row.uomCode)}</strong>,
    },
  ];
  const excessColumns: Column<InboundExcess>[] =
    tab === 'unlinked'
      ? [
          ...excessHead,
          {
            key: 'lot',
            header: t.table.lot,
            width: '168px',
            render: (row) => <OneLine text={orEmpty(row.lotNo)} />,
          },
          {
            key: 'sourceOrder',
            header: t.table.sourceOrder,
            width: '168px',
            render: (row) => <OneLine text={orderLineText(row.sourceOrderLine)} />,
          },
        ]
      : [
          ...excessHead,
          {
            key: 'linkedOrder',
            header: t.table.linkedOrder,
            width: '168px',
            render: (row) => <OneLine text={orderLineText(row.linkedOrderLine)} />,
          },
          {
            key: 'linkedAt',
            header: t.table.linkedAt,
            width: '96px',
            render: (row) => {
              const date = toPlantDateTimeParts(row.linkedAt)?.date;

              return date === undefined ? orEmpty(null) : formatDate(date);
            },
          },
        ];

  const uomCode = selectedExcess?.uomCode ?? '';
  const candidateColumns: Column<ExcessCandidate>[] = [
    {
      key: 'purchaseOrderNo',
      header: t.candidates.purchaseOrderNo,
      width: '240px',
      render: (row) => (
        <span className="excess-receipt-cell">
          <PickButton
            id={row.purchaseOrderLineId}
            selected={row.purchaseOrderLineId === selectedLineId}
            label={t.pickLine(row.purchaseOrderNo, row.lineNo)}
          >
            {t.orderLine(row.purchaseOrderNo, row.lineNo)}
          </PickButton>
          {row.exactMatch && (
            <Chip variant="status" status="success" size="sm">
              {t.candidates.exact}
            </Chip>
          )}
          {row.purchaseOrderId === currentOrderId && (
            <Chip variant="status" status="info" size="sm">
              {t.candidates.current}
            </Chip>
          )}
        </span>
      ),
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

  const listBody = (kind: ExcessTab): ReactNode => {
    if (kind !== tab) return null;
    if (active.isError) {
      return (
        <LoadErrorBanner
          error={active.error}
          onRetry={() => {
            void active.refetch();
          }}
        />
      );
    }
    if (active.isPending) {
      return (
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={3} />
        </div>
      );
    }
    const total = active.data.page.total;

    return (
      <>
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div
          className="wide-table po-board-table excess-table"
          onClick={(event) => {
            const id = pickedIdOf(event);
            if (id !== null) pickExcess(id);
          }}
        >
          <Table
            density="compact"
            caption={<span className="erp-data-table-caption">{t.tabs[kind]}</span>}
            columns={excessColumns}
            rows={rows}
            getRowId={(row) => String(row.inboundReceiptExcessId)}
            empty={
              <EmptyState
                size="sm"
                title={kind === 'unlinked' ? t.empty.unlinkedTitle : t.empty.linkedTitle}
              />
            }
          />
        </div>
        {total > rows.length && <p className="field-note">{t.truncated(rows.length, total)}</p>}
      </>
    );
  };

  const candidatePane = (): ReactNode => {
    /* 초과분을 고르기 전에는 후보 구획을 세우지 않는다 — 무엇을 고를지는 단추 옆 문장이 말한다. */
    if (tab !== 'unlinked' || selectedExcess === null) return null;

    const body = ((): ReactNode => {
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
        /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
        <div
          className="wide-table po-board-table excess-table"
          onClick={(event) => {
            const id = pickedIdOf(event);
            if (id !== null) pickLine(id);
          }}
        >
          <Table
            density="compact"
            caption={<span className="erp-data-table-caption">{t.candidates.title}</span>}
            columns={candidateColumns}
            rows={candidateRows}
            getRowId={(row) => String(row.purchaseOrderLineId)}
            empty={
              <EmptyState
                size="sm"
                title={t.candidates.emptyTitle}
                description={t.candidates.emptyDescription}
              />
            }
          />
        </div>
      );
    })();

    return (
      <section className="excess-section" aria-label={t.candidates.title}>
        <h3 className="excess-section-title">
          {t.candidates.title}
          <span className="excess-section-sub">
            {selectedExcess.itemCode} ·{' '}
            {qtyWithUom(selectedExcess.excessQty, selectedExcess.uomCode)}
          </span>
        </h3>
        {body}
      </section>
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      placement="right"
      size="lg"
      className="excess-dialog"
      title={t.title}
      footer={
        <div className="excess-footer">
          <p id={confirmId} className="excess-confirm" aria-live="polite">
            {sentence}
          </p>
          <Button
            disabled={!canRun}
            aria-describedby={confirmId}
            onClick={tab === 'linked' ? runUnlink : runLink}
          >
            {tab === 'linked' ? t.actions.unlink : t.actions.link}
          </Button>
        </div>
      }
    >
      <div className="excess-panel">
        {/* 단계는 연결하는 길에만 있다 — 「연결됨」 탭은 고르고 해제하는 한 걸음이다. */}
        {tab === 'unlinked' && (
          <nav className="excess-guide" aria-label={t.steps.label}>
            <Stepper size="sm" steps={stepItems} />
          </nav>
        )}

        {done !== null && (
          <div role="status">
            <AlertBanner variant="success">{done}</AlertBanner>
          </div>
        )}
        {saveError !== null && <SaveErrorBanner error={toApiError(saveError)} />}

        <Tabs
          size="sm"
          aria-label={t.tabs.label}
          value={tab}
          onChange={changeTab}
          items={[
            {
              value: 'unlinked',
              label: t.tabs.unlinked,
              /* 0 은 달지 않는다 — 「없다」는 표의 빈 상태가 말한다. */
              badge: (unlinked.data?.page.total ?? 0) > 0 ? unlinked.data?.page.total : undefined,
              content: listBody('unlinked'),
            },
            { value: 'linked', label: t.tabs.linked, content: listBody('linked') },
          ]}
        />

        {candidatePane()}
      </div>
    </Dialog>
  );
};
