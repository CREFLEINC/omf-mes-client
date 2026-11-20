import { AlertBanner, Button, Chip, SkeletonText, type ChipStatus } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { formatPlantDateTime, plantToday } from '../../patterns/plant-time';
import { CancelRequestDialog, cancelReasonError } from './cancel-request-dialog';
import { ConfirmDialog } from './confirm-dialog';
import { summaryMessage } from './confirm-run';
import { ExecuteCancelDialog } from './execute-cancel-dialog';
import type { ShipmentRequestDetail } from './request-detail';
import {
  useCancelExecuteMutation,
  useCancelRequestMutation,
  useConfirmRunner,
} from './shipment-mutations';
import { useCancelApproval, useShipmentDetail } from './shipment-queries';
import { canConfirm, cancelLockOf, flowOf, type ShipmentFlow } from './shipment-rules';
import type { ErpSendStatus, OqcLotStatus, ShipmentRow } from './shipment-types';

/*
 * 출하 내역(W-04-12)에서 옮긴 문구는 그 파일(`shipment-confirm.ts`)을 그대로 쓴다 — 같은 말을 두 벌 두지 않는다
 * (`packages/i18n/src/*\/index.ts` 를 고치지 않는다는 지속 제약 · T069).
 */
const tc = messages.shipmentConfirm;
const t = messages.shipmentSchedule.bu012;

const ERP_TONE: Record<ErpSendStatus, ChipStatus> = {
  PENDING: 'info',
  SENT: 'success',
  SEND_ERROR: 'error',
  NOT_SENT_NO_SALES_ORDER: 'warning',
  CANCELLED: 'idle',
  NOT_QUEUED: 'idle',
};

const FLOW_TONE: Record<ShipmentFlow, ChipStatus> = {
  completed: 'success',
  legacyUnconfirmed: 'idle',
  expeditedUnconfirmed: 'idle',
  confirmed: 'success',
  cancelled: 'idle',
};

const OQC_TONE: Record<OqcLotStatus, ChipStatus> = {
  ACCEPTED: 'success',
  REJECTED: 'error',
  HELD: 'warning',
  NOT_INSPECTED: 'warning',
  NOT_REQUIRED: 'idle',
  SKIPPED: 'idle',
};

const dateTime = (value: string | null): string =>
  value === null ? tc.detail.noValue : (formatPlantDateTime(value) ?? value);

/** 취소가 실행되면 일어나는 것(POP 완료 출하만) — 요청 창과 실행 창이 같이 쓴다(W-04-12 그대로). */
const consequencesOf = (row: ShipmentRow, requestNo: string | null) =>
  flowOf(row) === 'completed'
    ? {
        qty: row.totalQty,
        warehouses: row.warehouses
          .map((w) => (w.qty === null ? w.warehouseName : `${w.warehouseName} ${String(w.qty)}`))
          .join(', '),
        shipmentRequestNo: row.shipmentRequestNo ?? requestNo,
      }
    : null;

export interface ShipmentSectionProps {
  request: ShipmentRequestDetail;
  /**
   * 「출하 취소(송신 전)」(`W-04-12`) 권한이 있는가 — 없으면 [취소 요청]·[취소 실행]·[확정]을 보이지 않는다
   * (서버가 W-04-02 만으로는 403 · 피처 012 R-6).
   */
  canAct: boolean;
}

/**
 * 「출하」 칸(피처 012 FR-019·020·022 · 시안 W0402-After ④) — 출하 내역(W-04-12) 상세를 옮겼다.
 *
 * 지시서 상세 머리 바로 아래 · 라인 표 위. 지시서의 출하마다(최신이 위) 출하 번호 · 완료 시각 · POP · 작업자,
 * 창고별 차감(출고 전표 · 공장), LOT 배분(출하 관리 코드), ERP 송신 상태, [취소 요청] · [취소 실행] · [확정].
 * 취소된 출하도 기록으로 남는다 — 다시 완료하면 새 출하가 위에 쌓인다.
 */
export const ShipmentSection = ({ request, canAct }: ShipmentSectionProps) => {
  const shipments = request.shipments ?? [];

  if (shipments.length === 0) return null;

  /* 창고 → 공장 이름(줄 창고에서). 출하 응답의 창고에는 공장이 없다 — 출고 전표의 공장이 ERP 송신 공장이다. */
  const plantOf = new Map<number, string>();
  for (const line of request.lines ?? []) {
    if (line.warehouse !== null && line.warehouse !== undefined) {
      plantOf.set(line.warehouse.warehouseId, line.warehouse.plantName);
    }
  }

  return (
    <section className="shipment-section" aria-label={t.section}>
      <h3 className="field-label">
        {t.section} <span className="field-note">{t.sectionNote}</span>
      </h3>
      {[...shipments]
        .sort((a, b) => b.shipmentId - a.shipmentId)
        .map((shipment) => (
          <ShipmentCard
            key={shipment.shipmentId}
            shipmentId={shipment.shipmentId}
            shipmentRequestNo={request.shipmentRequestNo}
            plantOf={(warehouseId) => plantOf.get(warehouseId) ?? null}
            canAct={canAct}
          />
        ))}
    </section>
  );
};

interface ShipmentCardProps {
  shipmentId: number;
  shipmentRequestNo: string;
  plantOf: (warehouseId: number) => string | null;
  canAct: boolean;
}

const ShipmentCard = ({ shipmentId, shipmentRequestNo, plantOf, canAct }: ShipmentCardProps) => {
  const actionNoteId = useId();
  const detail = useShipmentDetail(shipmentId);
  const cancelApproval = useCancelApproval(shipmentId);
  const runner = useConfirmRunner();
  const [dialog, setDialog] = useState<'cancel' | 'execute' | 'confirm' | null>(null);
  const [reason, setReason] = useState('');
  const [showReasonError, setShowReasonError] = useState(false);

  const closeDialog = (): void => {
    setDialog(null);
    setReason('');
    setShowReasonError(false);
  };

  const cancelWrite = useCancelRequestMutation({
    shipmentId: dialog === 'cancel' ? shipmentId : null,
    onSuccess: () => {
      closeDialog();
      void detail.refetch();
      void cancelApproval.refetch();
    },
  });
  const executeWrite = useCancelExecuteMutation({
    shipmentId: dialog === 'execute' ? shipmentId : null,
    onSuccess: () => {
      closeDialog();
      void detail.refetch();
      void cancelApproval.refetch();
    },
  });

  if (detail.isError) {
    return (
      <AlertBanner
        variant="error"
        action={
          <Button variant="outlined" size="sm" onClick={() => void detail.refetch()}>
            {messages.common.retry}
          </Button>
        }
      >
        {t.sectionLoadFailed}
      </AlertBanner>
    );
  }

  if (detail.data === undefined) {
    return (
      <div role="status" aria-label={t.sectionLoading}>
        <SkeletonText lines={3} />
      </div>
    );
  }

  const { row, lines } = detail.data;
  const flow = flowOf(row);
  const lock = cancelLockOf(row, cancelApproval.data === 'APPROVED');
  const erpStatus = row.erpSendStatus;
  const salesOrderLines = lines.filter((line) => line.salesOrderNo !== null);
  const salesOrderNos = [...new Set(salesOrderLines.map((line) => line.salesOrderNo))].join(', ');
  const cancelAlreadySent =
    cancelWrite.error?.kind === 'conflict' && cancelWrite.error.code === 'ERP_ALREADY_SENT';
  const executeAlreadySent =
    executeWrite.error?.kind === 'conflict' && executeWrite.error.code === 'ERP_ALREADY_SENT';

  return (
    <article className="shipment-card" aria-label={row.shipmentNo}>
      <header className="ship-history-detail-head">
        <strong className="ship-history-no">{row.shipmentNo}</strong>
        <span className="ship-history-chips">
          <Chip
            status={row.cancelRequestPending && flow !== 'cancelled' ? 'warning' : FLOW_TONE[flow]}
            size="sm"
          >
            {row.cancelRequestPending && flow !== 'cancelled' ? tc.flow.cancelPending : tc.flow[flow]}
          </Chip>
          {erpStatus === null ? null : (
            <Chip status={ERP_TONE[erpStatus]} size="sm">
              {`${t.erpSend} ${tc.erp[erpStatus]}`}
            </Chip>
          )}
        </span>
      </header>

      <dl className="ship-history-dl">
        <div>
          <dt>{tc.detail.fields.completedAt}</dt>
          <dd>{dateTime(row.shippedAt)}</dd>
        </div>
        <div>
          <dt>{tc.detail.fields.terminal}</dt>
          <dd>{row.completedTerminalCode ?? tc.list.webCreated}</dd>
        </div>
        <div>
          <dt>{tc.detail.fields.worker}</dt>
          <dd>
            {row.completedWorker === null
              ? tc.detail.noValue
              : `${row.completedWorker.workerName} (${row.completedWorker.workerNo})`}
          </dd>
        </div>
        <div>
          <dt>{tc.detail.fields.erpDeliveryNo}</dt>
          <dd>{row.erpDeliveryNo ?? tc.detail.erpDeliveryNone}</dd>
        </div>
      </dl>

      {row.cancelRequestPending && (
        <AlertBanner variant="warning">{tc.detail.cancelPendingBanner}</AlertBanner>
      )}
      {flow === 'legacyUnconfirmed' && <AlertBanner variant="info">{tc.detail.legacyBanner}</AlertBanner>}
      {flow === 'expeditedUnconfirmed' && (
        <AlertBanner variant="info">{tc.detail.expeditedBanner}</AlertBanner>
      )}
      {runner.summary === null ? null : (
        <AlertBanner variant={runner.summary.failed === 0 ? 'success' : 'warning'}>
          {summaryMessage(runner.summary)}
        </AlertBanner>
      )}

      {erpStatus !== null && (
        <section aria-label={tc.detail.erp}>
          <h4 className="field-label">{tc.detail.erp}</h4>
          <p>
            {erpStatus === 'PENDING' && salesOrderLines.length > 0
              ? tc.detail.erpPending(salesOrderLines.length, salesOrderNos)
              : tc.detail.erpMessage[erpStatus]}
          </p>
        </section>
      )}

      {row.warehouses.length > 0 && (
        <section aria-label={t.goodsIssues}>
          <h4 className="field-label">
            {t.goodsIssues} <span className="field-note">{t.goodsIssuesNote}</span>
          </h4>
          <div className="wide-table">
            <table className="ship-history-lines">
              <thead>
                <tr>
                  <th scope="col">{t.goodsIssueColumns.no}</th>
                  <th scope="col">{t.goodsIssueColumns.warehouse}</th>
                  <th scope="col">{t.goodsIssueColumns.plant}</th>
                  <th scope="col">{t.goodsIssueColumns.qty}</th>
                </tr>
              </thead>
              <tbody>
                {row.warehouses.map((warehouse) => (
                  <tr key={warehouse.warehouseId}>
                    <td>
                      {warehouse.goodsIssueNos.length === 0
                        ? tc.detail.noValue
                        : warehouse.goodsIssueNos.join(', ')}
                    </td>
                    <td>{warehouse.warehouseName}</td>
                    <td>{plantOf(warehouse.warehouseId) ?? tc.detail.noValue}</td>
                    <td className="ship-history-num">{warehouse.qty ?? tc.detail.noValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {lines.some((line) => line.lots.length > 0) && (
        <section aria-label={t.lots}>
          <h4 className="field-label">{t.lots}</h4>
          <div className="wide-table">
            <table className="ship-history-lines">
              <thead>
                <tr>
                  <th scope="col">{t.lotColumns.lot}</th>
                  <th scope="col">{t.lotColumns.line}</th>
                  <th scope="col">{t.lotColumns.place}</th>
                  <th scope="col">{t.lotColumns.qty}</th>
                  <th scope="col">{t.lotColumns.oqc}</th>
                  <th scope="col">{t.lotColumns.code}</th>
                </tr>
              </thead>
              <tbody>
                {lines.flatMap((line) =>
                  line.lots.map((lot) => (
                    <tr key={`${String(line.lineNo)}-${String(lot.lotId)}`}>
                      <td>{lot.lotNo}</td>
                      <td>{line.lineNo}</td>
                      <td>
                        <span className="ship-history-places">
                          {lot.places.map((place) => (
                            <span key={place.label}>{`${place.label} ${String(place.qty)}`}</span>
                          ))}
                        </span>
                      </td>
                      <td className="ship-history-num">{lot.qty}</td>
                      <td>
                        {lot.oqcLotStatus === null ? (
                          tc.detail.noValue
                        ) : (
                          <Chip status={OQC_TONE[lot.oqcLotStatus]} size="sm">
                            {tc.oqc[lot.oqcLotStatus]}
                          </Chip>
                        )}
                      </td>
                      <td>{lot.managementCode ?? tc.detail.noValue}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/*
       * 취소 · 확정은 「출하 취소(송신 전)」 권한(W-04-12)으로만 — 없으면 단추 대신 그 사실을 적는다(R-6).
       * 막힌 이유를 단추 옆에 두고 단추에 잇는다(C-4).
       */}
      {canAct ? (
        <div className="form-actions ship-history-actions">
          <span id={actionNoteId} className="field-note">
            {lock === null ? tc.cancelNote : tc.lock[lock]}
          </span>
          {lock !== 'cancelled' && lock !== 'sent' && (
            <Button
              variant="outlined"
              disabled={lock !== null || runner.isRunning}
              aria-describedby={actionNoteId}
              onClick={() => {
                cancelWrite.reset();
                setDialog('cancel');
              }}
            >
              {tc.actions.requestCancel}
            </Button>
          )}
          {lock === 'cancelApproved' && (
            <Button
              disabled={runner.isRunning}
              aria-describedby={actionNoteId}
              onClick={() => {
                executeWrite.reset();
                setDialog('execute');
              }}
            >
              {tc.actions.executeCancel}
            </Button>
          )}
          {canConfirm(row) && (
            <Button
              disabled={runner.isRunning || row.cancelRequestPending}
              aria-describedby={actionNoteId}
              onClick={() => {
                runner.reset();
                setDialog('confirm');
              }}
            >
              {tc.actions.confirm}
            </Button>
          )}
        </div>
      ) : (
        lock !== 'cancelled' && <p className="field-note">{t.noPermission}</p>
      )}

      {dialog === 'confirm' && (
        <ConfirmDialog
          rows={[row]}
          isRunning={runner.isRunning}
          onClose={() => {
            if (!runner.isRunning) closeDialog();
          }}
          onConfirm={() => {
            if (runner.isRunning) return;
            void runner.run([row]).then(() => {
              closeDialog();
              void detail.refetch();
            });
          }}
        />
      )}

      {dialog === 'execute' && (
        <ExecuteCancelDialog
          shipmentNo={row.shipmentNo}
          consequences={consequencesOf(row, shipmentRequestNo)}
          banner={
            executeAlreadySent ? (
              <AlertBanner variant="error">{tc.executeDialog.erpAlreadySent}</AlertBanner>
            ) : (
              <SaveErrorBanner error={executeWrite.error} onReload={closeDialog} />
            )
          }
          isSubmitting={executeWrite.isSaving || detail.isFetching}
          onClose={closeDialog}
          onSubmit={() => {
            executeWrite.write({
              businessDate: plantToday(),
              occurredAt: new Date().toISOString(),
            });
          }}
        />
      )}

      {dialog === 'cancel' && (
        <CancelRequestDialog
          shipmentNo={row.shipmentNo}
          consequences={consequencesOf(row, shipmentRequestNo)}
          reason={reason}
          showError={showReasonError}
          banner={
            cancelAlreadySent ? (
              <AlertBanner variant="error">{tc.cancelDialog.erpAlreadySent}</AlertBanner>
            ) : (
              <SaveErrorBanner error={cancelWrite.error} onReload={closeDialog} />
            )
          }
          isSubmitting={cancelWrite.isSaving || detail.isFetching}
          onChangeReason={setReason}
          onClose={closeDialog}
          onSubmit={() => {
            setShowReasonError(true);
            if (cancelReasonError(reason) !== undefined) return;
            cancelWrite.write({ reason: reason.trim() });
          }}
        />
      )}
    </article>
  );
};
