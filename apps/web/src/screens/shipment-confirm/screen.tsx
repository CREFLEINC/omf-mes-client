import { AlertBanner, Breadcrumb, Button, PageHeader, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { SaveErrorBanner } from '../../patterns/master';
import { PaneSplitter, useFitToViewport, usePaneSplit } from '../../patterns/po-board';
import {
  PaneHeightSplitter,
  SplitOrientationToggle,
  useSplitOrientation,
} from '../../patterns/split-orientation';
import { plantToday } from '../../patterns/plant-time';
import { CancelRequestDialog, cancelReasonError } from './cancel-request-dialog';
import { ConfirmDialog } from './confirm-dialog';
import { summaryMessage } from './confirm-run';
import { DetailPane } from './detail-pane';
import { ExecuteCancelDialog } from './execute-cancel-dialog';
import { FilterBar } from './filter-bar';
import { defaultFilters, toListQuery, type ConfirmFilters } from './filters';
import { useCancelExecuteMutation, useCancelRequestMutation, useConfirmRunner } from './mutations';
import {
  useApprovalTargetShipment,
  useCancelApproval,
  useShipmentDetail,
  useShipmentList,
} from './queries';
import { flowOf } from './rules';
import type { ShipmentRow } from './types';
import { ShipmentList } from './shipment-list';

const t = messages.shipmentConfirm;
const hubText = messages.common.inspectionHub;

export interface ShipmentConfirmScreenProps {
  /** 기준 시각. 경과 계산이 실행하는 순간에 좌우되지 않게 밖에서 받는다. */
  now?: Date;
}

/**
 * W-04-12 출하 내역(피처 010 · omf-all-around#305 — 옛 「출하 확정·취소」).
 *
 * ⭐ 출하는 POP 「출하 완료」(P-04-07)에서 끝난다. 이 화면은 모든 출하를 보고(기간·출하번호·ERP
 * 송신 거르기), 상세에서 LOT 별 출하 관리 코드·재고가 빠진 곳·완료 단말·작업자를 보이며, ERP 로
 * 보내기 «전»이면 취소를 요청한다(FR-023). 옛 흐름·긴급 직행 미확정 출하만 상세에서 **한 건씩**
 * 확정한다 — 일괄 확정·체크 칸은 없다(결정 2026-11-18).
 *
 * ⛔ ERP 송신 상태는 이 화면에만 보인다 — 출하 완료 단계 화면에는 표시하지 않는다.
 */
export const ShipmentConfirmScreen = ({ now }: ShipmentConfirmScreenProps = {}) => {
  const toast = useToast();
  const baseNow = useMemo(() => now ?? new Date(), [now]);

  const [filters, setFilters] = useState<ConfirmFilters>(() => defaultFilters(baseNow));
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelError, setShowCancelError] = useState(false);
  const [isExecuteOpen, setIsExecuteOpen] = useState(false);

  /*
   * 목록 · 상세 배치(T-W-A) — 검사 조회·판정과 같은 좌우 분할(막대로 폭을 나눔), 1440 보다 좁거나 상하를 고르면 위아래.
   * 각 창은 창 바닥에서 멈추고 안에서 구른다. 검증 2회차: 직접 짠 2열 격자에서 상세 표가 창 밖으로 넘쳤다.
   */
  const { splitRef, aboveRef } = useFitToViewport();
  const split = usePaneSplit('omf-mes:shipment-confirm:split', 0.5);
  const layout = useSplitOrientation('omf-mes:shipment-confirm:split-orientation');

  /* 결재함 대상 링크(`?approvalRequestId=` · 화면 ID W-04-12)로 열리면 그 결재의 출하를 고른다(Q13). */
  const [searchParams] = useSearchParams();
  const linkedApprovalId = Number(searchParams.get('approvalRequestId') ?? '');
  const linked = useApprovalTargetShipment(
    Number.isSafeInteger(linkedApprovalId) && linkedApprovalId > 0 ? linkedApprovalId : null,
  );
  useEffect(() => {
    if (typeof linked.data === 'number') setSelectedId(linked.data);
  }, [linked.data]);

  const query = useMemo(() => toListQuery(filters, page), [filters, page]);
  const list = useShipmentList(query);
  const rows = useMemo(() => list.data?.items ?? [], [list.data]);
  const total = list.data?.page.total ?? 0;
  const size = list.data?.page.size ?? 50;

  /* 상세가 취소 요청·확정의 잠금 토큰(ETag)도 받는다. */
  const detail = useShipmentDetail(selectedId);
  const selected = detail.data?.row ?? null;
  const runner = useConfirmRunner();
  const cancelApproval = useCancelApproval(selectedId);

  const closeCancel = (): void => {
    setIsCancelOpen(false);
    setCancelReason('');
    setShowCancelError(false);
  };

  const cancelWrite = useCancelRequestMutation({
    shipmentId: isCancelOpen ? selectedId : null,
    onSuccess: () => {
      const shipmentNo = selected?.shipmentNo ?? '';
      closeCancel();
      toast.show({ variant: 'success', description: t.result.requestCancelDone(shipmentNo) });
      void list.refetch();
      void detail.refetch();
    },
  });

  const executeWrite = useCancelExecuteMutation({
    shipmentId: isExecuteOpen ? selectedId : null,
    onSuccess: () => {
      const shipmentNo = selected?.shipmentNo ?? '';
      setIsExecuteOpen(false);
      toast.show({ variant: 'success', description: t.result.executeCancelDone(shipmentNo) });
      void list.refetch();
      void detail.refetch();
      void cancelApproval.refetch();
    },
  });
  const executeAlreadySent =
    executeWrite.error?.kind === 'conflict' && executeWrite.error.code === 'ERP_ALREADY_SENT';

  /* 409 ERP_ALREADY_SENT — 요청하는 사이 송신이 먼저 끝났다. 일반 충돌 문구가 아니라 그 사실을 말한다. */
  const erpAlreadySent =
    cancelWrite.error?.kind === 'conflict' && cancelWrite.error.code === 'ERP_ALREADY_SENT';

  const applyFilters = (next: ConfirmFilters): void => {
    setFilters(next);
    setPage(1);
  };

  const lastPage = Math.max(1, Math.ceil(total / size));

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={
          <Breadcrumb
            items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
            aria-label={messages.common.shell.breadcrumb}
          />
        }
      />
      <header ref={aboveRef} className="banner-slot ship-history-lead">
        <AlertBanner variant="info">{t.lead}</AlertBanner>
        <SplitOrientationToggle orientation={layout.orientation} onChange={layout.change} inline />
      </header>

      <div
        ref={splitRef}
        className={`po-board-split ship-history-split${layout.orientation === 'column' ? ' is-stacked' : ''}`}
        style={{ ...split.style, ...layout.style }}
      >
        <section className="pane po-board-pane po-board-scroll" aria-label={t.panes.list}>
          <h2>{t.panes.list}</h2>
          <FilterBar
            applied={filters}
            counts={list.data?.erpSendStatusCounts ?? null}
            onApply={applyFilters}
            onReset={() => applyFilters(defaultFilters(baseNow))}
          />
          <ShipmentList
            rows={rows}
            now={baseNow}
            selectedId={selectedId}
            isLoading={list.isPending && query !== null}
            error={
              list.isError ? (
                <AlertBanner
                  variant="error"
                  action={
                    <Button variant="outlined" size="sm" onClick={() => void list.refetch()}>
                      {messages.common.retry}
                    </Button>
                  }
                >
                  {t.list.loadFailed}
                </AlertBanner>
              ) : null
            }
            onOpen={(shipmentId) => {
              runner.reset();
              setSelectedId(shipmentId);
            }}
          />
          {total > size && (
            <div className="filter-actions ship-history-pager">
              <span className="field-note">{t.list.page(page, total)}</span>
              <Button
                variant="outlined"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                {t.list.prev}
              </Button>
              <Button
                variant="outlined"
                size="sm"
                disabled={page >= lastPage}
                onClick={() => setPage((current) => current + 1)}
              >
                {t.list.next}
              </Button>
            </div>
          )}
        </section>

        <PaneSplitter label={hubText.splitter} ratio={split.ratio} onChange={split.commit} />
        {layout.orientation === 'column' && (
          <PaneHeightSplitter
            label={hubText.heightSplitter}
            height={layout.listHeight}
            onChange={layout.changeListHeight}
          />
        )}

        <section
          className="pane po-board-pane po-board-scroll ship-history-detail-pane"
          aria-label={t.panes.detail}
        >
          <h2>{t.panes.detail}</h2>
          <DetailPane
            detail={selectedId === null ? undefined : detail.data}
            isLoading={selectedId !== null && detail.isPending}
            isError={selectedId !== null && detail.isError}
            onRetry={() => void detail.refetch()}
            confirmResult={
              runner.summary === null ? null : (
                <AlertBanner variant={runner.summary.failed === 0 ? 'success' : 'warning'}>
                  {summaryMessage(runner.summary)}
                </AlertBanner>
              )
            }
            isConfirming={runner.isRunning}
            onConfirm={() => {
              runner.reset();
              setIsConfirming(true);
            }}
            onRequestCancel={() => {
              cancelWrite.reset();
              setIsCancelOpen(true);
              setCancelReason('');
              setShowCancelError(false);
            }}
            cancelApproved={cancelApproval.data === 'APPROVED'}
            onExecuteCancel={() => {
              executeWrite.reset();
              setIsExecuteOpen(true);
            }}
          />
        </section>
      </div>

      {isConfirming && selected !== null && (
        <ConfirmDialog
          rows={[selected]}
          isRunning={runner.isRunning}
          onClose={() => {
            if (!runner.isRunning) setIsConfirming(false);
          }}
          onConfirm={() => {
            /* ⛔ 진행 중에는 다시 보내지 않는다 — 안 끝난 확정 위에 또 보내게 된다. */
            if (runner.isRunning) return;
            void runner.run([selected]).then(() => {
              setIsConfirming(false);
              void detail.refetch();
            });
          }}
        />
      )}

      {isExecuteOpen && selected !== null && (
        <ExecuteCancelDialog
          shipmentNo={selected.shipmentNo}
          consequences={consequencesOf(selected, detail.data?.shipmentRequestNo ?? null)}
          banner={
            executeAlreadySent ? (
              <AlertBanner variant="error">{t.executeDialog.erpAlreadySent}</AlertBanner>
            ) : (
              <SaveErrorBanner
                error={executeWrite.error}
                onReload={() => setIsExecuteOpen(false)}
              />
            )
          }
          isSubmitting={executeWrite.isSaving || detail.isFetching}
          onClose={() => setIsExecuteOpen(false)}
          onSubmit={() => {
            executeWrite.write({
              businessDate: plantToday(),
              occurredAt: new Date().toISOString(),
            });
          }}
        />
      )}

      {isCancelOpen && selected !== null && (
        <CancelRequestDialog
          shipmentNo={selected.shipmentNo}
          consequences={consequencesOf(selected, detail.data?.shipmentRequestNo ?? null)}
          reason={cancelReason}
          showError={showCancelError}
          banner={
            erpAlreadySent ? (
              <AlertBanner variant="error">{t.cancelDialog.erpAlreadySent}</AlertBanner>
            ) : (
              <SaveErrorBanner error={cancelWrite.error} onReload={closeCancel} />
            )
          }
          isSubmitting={cancelWrite.isSaving || detail.isFetching}
          onChangeReason={setCancelReason}
          onClose={closeCancel}
          onSubmit={() => {
            setShowCancelError(true);
            if (cancelReasonError(cancelReason) !== undefined) return;
            cancelWrite.write({ reason: cancelReason.trim() });
          }}
        />
      )}
    </>
  );
};

/** 취소가 실행되면 일어나는 것(POP 완료 출하만) — 요청 창과 실행 창이 같이 쓴다. */
const consequencesOf = (row: ShipmentRow, requestNo: string | null) =>
  flowOf(row) === 'completed'
    ? {
        qty: row.totalQty,
        /* 창고마다 빠진 수량을 함께 적는다(시안 「완제품 창고 A 90, B 70」) — 모르면 이름만. */
        warehouses: row.warehouses
          .map((w) => (w.qty === null ? w.warehouseName : `${w.warehouseName} ${String(w.qty)}`))
          .join(', '),
        shipmentRequestNo: row.shipmentRequestNo ?? requestNo,
      }
    : null;
