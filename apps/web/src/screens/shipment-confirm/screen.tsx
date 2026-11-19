import { AlertBanner, Breadcrumb, Button, PageHeader, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo, useState } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { CancelRequestDialog, cancelReasonError } from './cancel-request-dialog';
import { ConfirmDialog } from './confirm-dialog';
import { summaryMessage } from './confirm-run';
import { DetailPane } from './detail-pane';
import { FilterBar } from './filter-bar';
import { defaultFilters, toListQuery, type ConfirmFilters } from './filters';
import { useCancelRequestMutation, useConfirmRunner } from './mutations';
import { useShipmentDetail, useShipmentList } from './queries';
import { flowOf } from './rules';
import { ShipmentList } from './shipment-list';

const t = messages.shipmentConfirm;

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

  const query = useMemo(() => toListQuery(filters, page), [filters, page]);
  const list = useShipmentList(query);
  const rows = useMemo(() => list.data?.items ?? [], [list.data]);
  const total = list.data?.page.total ?? 0;
  const size = list.data?.page.size ?? 50;

  /* 상세가 취소 요청·확정의 잠금 토큰(ETag)도 받는다. */
  const detail = useShipmentDetail(selectedId);
  const selected = detail.data?.row ?? null;
  const runner = useConfirmRunner();

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
      <div className="banner-slot">
        <AlertBanner variant="info">{t.lead}</AlertBanner>
      </div>

      <div className="ship-history">
        <section className="pane" aria-label={t.panes.list}>
          <h2>{t.panes.list}</h2>
          <FilterBar
            applied={filters}
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

        <section className="pane" aria-label={t.panes.detail}>
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

      {isCancelOpen && selected !== null && (
        <CancelRequestDialog
          shipmentNo={selected.shipmentNo}
          consequences={
            flowOf(selected) === 'completed'
              ? {
                  qty: selected.totalQty,
                  warehouses: selected.warehouses.map((w) => w.warehouseName).join(', '),
                  shipmentRequestNo: detail.data?.shipmentRequestNo ?? null,
                }
              : null
          }
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
