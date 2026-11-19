import { AlertBanner, Button, Chip, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Fragment, useId, type ReactNode } from 'react';

import { formatPlantDateTime } from '../../patterns/plant-time';
import { canConfirm, cancelLockOf, flowOf } from './rules';
import { ErpChip, FlowChip } from './shipment-list';
import type { OqcLotStatus, ShipmentDetail } from './types';

const t = messages.shipmentConfirm;

const OQC_TONE: Record<OqcLotStatus, 'success' | 'error' | 'warning' | 'idle'> = {
  ACCEPTED: 'success',
  REJECTED: 'error',
  HELD: 'warning',
  NOT_INSPECTED: 'warning',
  NOT_REQUIRED: 'idle',
  SKIPPED: 'idle',
};

const dateTime = (value: string | null): string =>
  value === null ? t.detail.noValue : (formatPlantDateTime(value) ?? value);

export interface DetailPaneProps {
  detail: ShipmentDetail | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** 확정 결과 한 줄 — 상세 머리 아래에 둔다. */
  confirmResult: ReactNode;
  isConfirming: boolean;
  onConfirm: () => void;
  onRequestCancel: () => void;
  /** 이 출하의 취소가 승인돼 실행을 기다린다(마지막 `SHIPMENT_CANCEL` 결재 = 승인). */
  cancelApproved: boolean;
  onExecuteCancel: () => void;
}

/**
 * 출하 상세(피처 010 · 시안 W0412-After).
 *
 * ⭐ 출하 관리 코드는 **보기만** 한다 — 완료 뒤에는 고칠 수 없다(FR-022). 재고가 빠진 곳은 LOT 마다
 * 창고·위치별 몫으로 적는다(D-15 — 출하 하나에 창고 여럿).
 *
 * ⭐ [취소 요청]은 «ERP 로 보내기 전» 기준이다(FR-023). 막히면 단추를 잠그고 이유를 옆에 적는다.
 * ⭐ 취소가 승인되면 [취소 실행]이 선다 — 결재함은 승인만 하고 실행은 이 화면에서 한다(Q13 · 계약 `:cancel`).
 * [확정]은 옛 흐름·긴급 직행 미확정에만 선다(한 건씩 — 일괄 확정 없음).
 */
export const DetailPane = ({
  detail,
  isLoading,
  isError,
  onRetry,
  confirmResult,
  isConfirming,
  onConfirm,
  onRequestCancel,
  cancelApproved,
  onExecuteCancel,
}: DetailPaneProps) => {
  const actionNoteId = useId();

  if (isError) {
    return (
      <AlertBanner
        variant="error"
        action={
          <Button variant="outlined" size="sm" onClick={onRetry}>
            {messages.common.retry}
          </Button>
        }
      >
        {t.detail.loadFailed}
      </AlertBanner>
    );
  }

  if (isLoading) {
    return (
      <div role="status" aria-label={t.detail.loading}>
        <SkeletonText lines={6} />
      </div>
    );
  }

  if (detail === undefined) return <EmptyState size="sm" title={t.detail.empty} />;

  const { row } = detail;
  const flow = flowOf(row);
  const lock = cancelLockOf(row, cancelApproved);
  const canExecuteCancel = lock === 'cancelApproved';
  /* 송신 대기 안내 — 다음 송신 때 나갈 수주 연결 라인 수와 수주 번호(시안). 모르면 일반 문구. */
  const salesOrderLines = detail.lines.filter((line) => line.salesOrderNo !== null);
  const salesOrderNos = [...new Set(salesOrderLines.map((line) => line.salesOrderNo))].join(', ');
  const erpStatus = row.erpSendStatus;

  return (
    <div className="ship-history-detail">
      <header className="ship-history-detail-head">
        <div>
          <div className="field-note">{t.list.fields.shipmentNo}</div>
          <h3 className="ship-history-no">{row.shipmentNo}</h3>
        </div>
        <span className="ship-history-chips">
          <FlowChip row={row} />
          <ErpChip status={erpStatus} />
          {row.cancelRequestPending && <span className="field-note">{t.hold}</span>}
        </span>
      </header>

      <dl className="ship-history-dl">
        <div>
          <dt>{t.detail.fields.shipmentRequest}</dt>
          <dd>{detail.shipmentRequestNo ?? t.detail.noValue}</dd>
        </div>
        <div>
          <dt>{t.detail.fields.salesOrder}</dt>
          <dd>{row.salesOrderNo ?? t.detail.noSalesOrder}</dd>
        </div>
        <div>
          <dt>{t.detail.fields.customer}</dt>
          <dd>{row.customerName ?? t.detail.noValue}</dd>
        </div>
        <div>
          <dt>{t.detail.fields.shipTo}</dt>
          <dd>{row.shipToName ?? t.detail.noValue}</dd>
        </div>
        <div>
          <dt>{t.detail.fields.completedAt}</dt>
          <dd>{dateTime(row.shippedAt)}</dd>
        </div>
        <div>
          <dt>{t.detail.fields.terminal}</dt>
          <dd>{row.completedTerminalCode ?? t.list.webCreated}</dd>
        </div>
        <div>
          <dt>{t.detail.fields.worker}</dt>
          <dd>
            {row.completedWorker === null
              ? t.detail.noValue
              : `${row.completedWorker.workerName} (${row.completedWorker.workerNo})`}
          </dd>
        </div>
        <div>
          <dt>{t.detail.fields.erpDeliveryNo}</dt>
          <dd>{row.erpDeliveryNo ?? t.detail.erpDeliveryNone}</dd>
        </div>
      </dl>

      {row.cancelRequestPending && (
        <AlertBanner variant="warning">{t.detail.cancelPendingBanner}</AlertBanner>
      )}
      {flow === 'legacyUnconfirmed' && (
        <AlertBanner variant="info">{t.detail.legacyBanner}</AlertBanner>
      )}
      {flow === 'expeditedUnconfirmed' && (
        <AlertBanner variant="info">{t.detail.expeditedBanner}</AlertBanner>
      )}
      {confirmResult}

      <section aria-label={t.detail.lines}>
        <h4 className="field-label">{t.detail.lines}</h4>
        <p className="field-note">{t.detail.linesNote}</p>
        <div className="wide-table">
          <table className="ship-history-lines">
            <thead>
              <tr>
                <th scope="col">{t.detail.columns.lot}</th>
                <th scope="col">{t.detail.columns.shipped}</th>
                <th scope="col">{t.detail.columns.managementCode}</th>
                <th scope="col">{t.detail.columns.places}</th>
                <th scope="col">{t.detail.columns.oqc}</th>
              </tr>
            </thead>
            <tbody>
              {detail.lines.map((line) => (
                <Fragment key={line.lineNo}>
                  <tr className="ship-history-line">
                    <td colSpan={5}>
                      <span>
                        {t.detail.line(
                          line.lineNo,
                          line.itemName === ''
                            ? line.itemCode
                            : `${line.itemCode} ${line.itemName}`,
                        )}
                      </span>{' '}
                      <span>
                        {t.detail.lineQty(
                          line.targetQty === null ? t.detail.noValue : String(line.targetQty),
                          line.shippedQty,
                        )}
                      </span>{' '}
                      {line.overQty > 0 && (
                        <Chip status="warning" size="sm">
                          {t.detail.over(line.overQty)}
                        </Chip>
                      )}{' '}
                      {/* 수주 없는 라인은 ERP 로 보내지 않는다(US7-4) — 지시서를 받았을 때만 가른다. */}
                      {line.targetQty !== null && line.salesOrderNo === null && (
                        <Chip status="idle" size="sm">
                          {t.detail.lineNotSent}
                        </Chip>
                      )}
                    </td>
                  </tr>
                  {line.lots.map((lot) => (
                    <tr key={lot.lotId}>
                      <td>{lot.lotNo}</td>
                      <td className="ship-history-num">{lot.qty}</td>
                      <td>{lot.managementCode ?? t.detail.noValue}</td>
                      <td>
                        <span className="ship-history-places">
                          {lot.places.map((place) => (
                            <span key={place.label}>{`${place.label} ${String(place.qty)}`}</span>
                          ))}
                        </span>
                      </td>
                      <td>
                        {lot.oqcLotStatus === null ? (
                          t.detail.noValue
                        ) : (
                          <Chip status={OQC_TONE[lot.oqcLotStatus]} size="sm">
                            {t.oqc[lot.oqcLotStatus]}
                          </Chip>
                        )}
                      </td>
                    </tr>
                  ))}
                  {line.replaced.map((lot) => (
                    <tr key={`replaced-${lot.lotNo}`} className="ship-history-replaced">
                      <td>{lot.lotNo}</td>
                      <td colSpan={4}>
                        <Chip status="idle" size="sm">
                          {t.detail.replaced}
                        </Chip>{' '}
                        <span className="field-note">
                          {t.detail.replacedNote(dateTime(lot.replacedAt), lot.nonconformanceNo)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {row.warehouses.some((warehouse) => warehouse.qty !== null) && (
        <section aria-label={t.detail.warehouses}>
          <h4 className="field-label">{t.detail.warehouses}</h4>
          <p className="field-note">{t.detail.warehousesNote}</p>
          <ul className="ship-history-warehouses">
            {row.warehouses.map((warehouse) => (
              <li key={warehouse.warehouseId}>
                <div className="ship-history-warehouse-head">
                  <strong>{warehouse.warehouseName}</strong>
                  <span className="field-note">{warehouse.warehouseCode}</span>
                  <span className="ship-history-num">{warehouse.qty ?? t.detail.noValue}</span>
                </div>
                <div className="field-note">
                  {warehouse.goodsIssueNos.length === 0
                    ? t.detail.noGoodsIssue
                    : t.detail.goodsIssue(warehouse.goodsIssueNos.join(', '))}
                </div>
                <span className="ship-history-places">
                  {warehouse.locations.map((location) => (
                    <span key={location.locationCode}>
                      {`${location.locationCode} ${String(location.qty)}`}
                      {location.staging ? ` (${t.detail.staging})` : ''}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {erpStatus !== null && (
        <section aria-label={t.detail.erp}>
          <h4 className="field-label">{t.detail.erp}</h4>
          <p>
            {erpStatus === 'PENDING' && salesOrderLines.length > 0
              ? t.detail.erpPending(salesOrderLines.length, salesOrderNos)
              : t.detail.erpMessage[erpStatus]}
          </p>
        </section>
      )}

      <div className="form-actions ship-history-actions">
        {/* 막힌 이유를 단추 옆에 두고 단추에 잇는다(C-4). */}
        <span id={actionNoteId} className="field-note">
          {lock === null ? t.cancelNote : t.lock[lock]}
        </span>
        {lock !== 'cancelled' && (
          <Button
            variant="outlined"
            disabled={lock !== null || isConfirming}
            aria-describedby={actionNoteId}
            onClick={onRequestCancel}
          >
            {t.actions.requestCancel}
          </Button>
        )}
        {canExecuteCancel && (
          <Button disabled={isConfirming} aria-describedby={actionNoteId} onClick={onExecuteCancel}>
            {t.actions.executeCancel}
          </Button>
        )}
        {canConfirm(row) && (
          <Button
            disabled={isConfirming || row.cancelRequestPending}
            aria-describedby={actionNoteId}
            onClick={onConfirm}
          >
            {t.actions.confirm}
          </Button>
        )}
      </div>
    </div>
  );
};
