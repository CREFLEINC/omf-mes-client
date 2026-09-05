import { AlertBanner, Breadcrumb, Button, PageHeader, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useState } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { CancelRequestDialog, cancelReasonError } from './cancel-request-dialog';
import { ConfirmDialog } from './confirm-dialog';
import { retryableIds, summaryMessage } from './confirm-run';
import { elapsedOf, summarize } from './elapsed';
import { FilterBar } from './filter-bar';
import { defaultFilters, toListQuery, type ConfirmFilters } from './filters';
import { useShipmentStatusLookup } from './lookups';
import { useCancelRequestMutation, useConfirmRunner } from './mutations';
import { OutcomePane } from './outcome-pane';
import { useShipmentDetail, useUnconfirmedShipments } from './queries';
import { batchSelectableIds, retainSelection, selectedRows } from './selection';
import { ShipmentList } from './shipment-list';
import { SummaryPane } from './summary-pane';
import { totalQtyOf } from './types';

const t = messages.shipmentConfirm;

export interface ShipmentConfirmScreenProps {
  /** 기준 시각. 경과 계산이 실행하는 순간에 좌우되지 않게 밖에서 받는다. */
  now?: Date;
}

/**
 * W-04-12 출하 확정·취소.
 *
 * ⭐⭐ **이 화면이 「확정 후 취소」 문제를 없앤다**(§5-1). 되돌릴 수 있는 구간을 ERP 에 보내기
 * «전»으로 옮겨, 분산 트랜잭션·ERP 거부·불일치가 **구조적으로 사라진다** — 우회가 아니라 제거다.
 *
 * ⛔ **확정은 되돌릴 수 없다.** 그러나 확정 전 관문을 두껍게 하지 않는다(§5-3) — 경고를 늘리면
 * 경고 피로로 오히려 안 읽는다. 화면의 몫은 **결과 구획에 사실을 적는 것**까지다.
 */
export const ShipmentConfirmScreen = ({ now }: ShipmentConfirmScreenProps = {}) => {
  const toast = useToast();
  const baseNow = useMemo(() => now ?? new Date(), [now]);

  const [filters, setFilters] = useState<ConfirmFilters>(() => defaultFilters(baseNow));
  const [selected, setSelected] = useState<number[]>([]);
  const [isConfirming, setIsConfirming] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelError, setShowCancelError] = useState(false);

  const query = useMemo(() => toListQuery(filters, 1), [filters]);
  const list = useUnconfirmedShipments(query);
  const statusLookup = useShipmentStatusLookup();
  const rows = useMemo(() => list.data?.items ?? [], [list.data]);

  /*
   * 조회를 다시 하면 고른 건이 사라질 수 있다(다른 사람이 확정했거나 자동 확정이 돌았다) —
   * 남은 것만 들고 가지 않으면 **없는 건을 확정하러 간다.**
   */
  useEffect(() => {
    setSelected((current) => retainSelection(current, rows));
  }, [rows]);

  const chosen = selectedRows(rows, selected);
  const runner = useConfirmRunner();
  const failures = runner.summary?.outcomes.filter((outcome) => outcome.failure !== null) ?? [];

  /* 취소 요청의 잠금 토큰은 그 출하의 상세가 내린다 — 창을 열 때 함께 부른다. */
  const cancelDetail = useShipmentDetail(cancelTargetId);
  const cancelTarget = rows.find((row) => row.shipmentId === cancelTargetId) ?? null;

  const closeCancel = (): void => {
    setCancelTargetId(null);
    setCancelReason('');
    setShowCancelError(false);
  };

  const cancelWrite = useCancelRequestMutation({
    shipmentId: cancelTargetId,
    onSuccess: () => {
      const shipmentNo = cancelTarget?.shipmentNo ?? '';
      closeCancel();
      toast.show({ variant: 'success', description: t.result.requestCancelDone(shipmentNo) });
      void list.refetch();
    },
  });

  /*
   * ⛔ 이미 확정된 건은 다시 담지 않는다 — 다시 보내 봐야 같은 409 가 돌아오고, 남겨 두면
   * 「실패 목록이 안 줄어드는」 화면이 된다.
   */
  const retryable = runner.summary === null ? [] : retryableIds(runner.summary);
  const summary = summarize(rows, baseNow);
  const thisMonth = rows.filter((row) => {
    const elapsed = elapsedOf(row, baseNow);
    if (elapsed.ms === null || row.shippedAt === null) return false;
    const shipped = new Date(row.shippedAt);
    return (
      shipped.getFullYear() === baseNow.getFullYear() && shipped.getMonth() === baseNow.getMonth()
    );
  }).length;

  const confirmLock = runner.isRunning
    ? t.lock.running
    : chosen.length === 0
      ? t.lock.selectNone
      : undefined;
  const cancelLock = selected.length === 1 ? undefined : t.lock.selectOneForCancel;

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      <SummaryPane total={list.data?.page.total ?? 0} page={summary} thisMonth={thisMonth} />

      <section className="pane" aria-label={t.panes.list}>
        <h2>{t.panes.list}</h2>
        <FilterBar
          applied={filters}
          onApply={setFilters}
          onReset={() => setFilters(defaultFilters(baseNow))}
        />
        <ShipmentList
          rows={rows}
          now={baseNow}
          selected={selected}
          statusLookup={statusLookup}
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
          failures={failures}
          onToggle={(shipmentId) =>
            setSelected((current) =>
              current.includes(shipmentId)
                ? current.filter((id) => id !== shipmentId)
                : [...current, shipmentId],
            )
          }
          /* ⚠ 「모두 선택」은 일괄에 담을 수 있는 건만 담는다 — 3일 경과는 개별로만(§6). */
          onToggleAll={() =>
            setSelected((current) => (current.length > 0 ? [] : batchSelectableIds(rows, baseNow)))
          }
        />
        <p className="field-note">
          {t.list.selected(chosen.length, String(totalQtyOf(chosen) ?? t.list.elapsedUnknown))}
        </p>
      </section>

      <OutcomePane count={chosen.length} />

      <section className="pane" aria-label={t.actions.confirm}>
        {/*
         * 확정 결과는 «건별»이다(§6) — 성공분을 유지하고 실패한 건에만 사유를 붙인다.
         * 「전부 실패했습니다」로 뭉뚱그리면 이미 확정된 건을 다시 확정하러 간다.
         */}
        {runner.summary !== null && (
          <div className="banner-slot">
            <AlertBanner variant={runner.summary.failed === 0 ? 'success' : 'warning'}>
              {summaryMessage(runner.summary)}
            </AlertBanner>
          </div>
        )}
        {confirmLock !== undefined && (
          <div className="banner-slot">
            <AlertBanner variant="info">{confirmLock}</AlertBanner>
          </div>
        )}
        {/* A-11 — 승인된 취소를 여기서 실행하지 못한다는 사실을 «취소 요청 옆»에 적는다. */}
        <p className="field-note">{t.withdrawn.executeCancel}</p>
        <div className="form-actions">
          <Button
            variant="outlined"
            disabled={cancelLock !== undefined || runner.isRunning}
            onClick={() => {
              const [only] = selected;
              if (only === undefined) return;
              cancelWrite.reset();
              setCancelTargetId(only);
              setCancelReason('');
              setShowCancelError(false);
            }}
          >
            {t.actions.requestCancel}
          </Button>
          {retryable.length > 0 && (
            <Button variant="outlined" onClick={() => setSelected(retryable)}>
              {t.actions.retry}
            </Button>
          )}
          <Button
            disabled={confirmLock !== undefined}
            onClick={() => {
              runner.reset();
              setIsConfirming(true);
            }}
          >
            {t.actions.confirm}
          </Button>
        </div>
      </section>

      {isConfirming && (
        <ConfirmDialog
          rows={chosen}
          isRunning={runner.isRunning}
          onClose={() => {
            if (!runner.isRunning) setIsConfirming(false);
          }}
          onConfirm={() => {
            /* ⛔ 진행 중에는 다시 보내지 않는다 — 안 끝난 확정 위에 또 보내게 된다. */
            if (runner.isRunning) return;
            void runner.run(chosen).then(() => {
              setIsConfirming(false);
              setSelected([]);
            });
          }}
        />
      )}

      {cancelTargetId !== null && cancelTarget !== null && (
        <CancelRequestDialog
          shipmentNo={cancelTarget.shipmentNo}
          reason={cancelReason}
          showError={showCancelError}
          banner={<SaveErrorBanner error={cancelWrite.error} onReload={closeCancel} />}
          isSubmitting={cancelWrite.isSaving || cancelDetail.isPending}
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
