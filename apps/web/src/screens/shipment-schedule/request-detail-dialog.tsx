import { AlertBanner, Button, Chip, Dialog, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Fragment, useId } from 'react';

import { formatPlantDateTime } from '../../patterns/plant-time';
import { LoadErrorBanner } from './load-error-banner';
import {
  blockerTarget,
  linesOf,
  portionText,
  replacementsOf,
  salesOrderRemainingOf,
  uomOfDetail,
  warehouseSummary,
  type ShipmentRequestDetail,
} from './request-detail';
import { progressLabel } from './status-options';

const t = messages.shipmentSchedule;

type ChipStatus = 'success' | 'error' | 'warning' | 'idle';

const OQC_TONE: Record<string, ChipStatus> = {
  ACCEPTED: 'success',
  REJECTED: 'error',
  HELD: 'warning',
  NOT_INSPECTED: 'warning',
  NOT_REQUIRED: 'idle',
  SKIPPED: 'idle',
};

const dateTime = (value: string): string => formatPlantDateTime(value) ?? value;

/** 수주 잔량 칸 — 「100」 + 「수주 100」, 넘으면 「0 + 초과 10」 + 「수주 100, 출하 110」. */
const SalesOrderRemainingCell = ({
  line,
}: {
  line: Parameters<typeof salesOrderRemainingOf>[0];
}) => {
  const value = salesOrderRemainingOf(line);
  switch (value.kind) {
    case 'none':
      return <>{t.values.empty}</>;
    case 'cancelled':
      return <>{t.detail.salesOrderCancelled}</>;
    case 'remaining':
      return (
        <span className="ship-history-places">
          <span>{t.detail.salesOrderRemaining(value.remaining)}</span>
          <span className="field-note">{t.detail.salesOrderQty(value.ordered)}</span>
        </span>
      );
    case 'over':
      return (
        <span className="ship-history-places">
          <span>{t.detail.salesOrderOver(value.over)}</span>
          <span className="field-note">
            {t.detail.salesOrderQtyShipped(value.ordered, value.shipped)}
          </span>
        </span>
      );
  }
};

export interface RequestDetailDialogProps {
  detail: ShipmentRequestDetail | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  customerName: string;
  shipToPartnerName: string;
  fulfillmentPlantName: string;
  itemLabel: (itemId: number) => string | null;
  onPrint: () => void;
  onClose: () => void;
}

/**
 * 피처 010 — 출하 지시서 상세 창(시안 W0402-After ①⑤⑥⑦). **보기만 한다** — 출하 완료는 POP
 * P-04-07 에서만(FR-018). 피킹 LOT(창고·위치별 몫 · OQC 판정 · 출하 관리 코드), 교체 이력,
 * 막는 이유(수주 라인 취소는 「담당자에게 문의」 · FR-028b)를 보이고, [지시서 인쇄]를 연다.
 *
 * ⛔ ERP 송신 여부를 보이지 않는다(출하 완료 단계 화면 · 결정 2026-11-18).
 * 수주 라인의 수주 · 출하 수량으로 「수주 잔량」을 보인다 — 출하가 수주를 넘으면 「0 + 초과 n」(D-16).
 */
export const RequestDetailDialog = ({
  detail,
  isLoading,
  error,
  onRetry,
  customerName,
  shipToPartnerName,
  fulfillmentPlantName,
  itemLabel,
  onPrint,
  onClose,
}: RequestDetailDialogProps) => {
  const item = (itemId: number): string => itemLabel(itemId) ?? String(itemId);
  const printNoteId = useId();

  return (
    <Dialog
      open
      size="lg"
      placement="right"
      title={t.detail.title}
      onClose={onClose}
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            {t.detail.close}
          </Button>
          {/* 인쇄는 받은 상세 값으로 그린다 — 상세가 없으면 잠근다. 피킹 전에도 열어 둔다. */}
          <Button
            disabled={detail === undefined}
            aria-describedby={detail === undefined ? printNoteId : undefined}
            onClick={onPrint}
          >
            {t.detail.print}
          </Button>
        </>
      }
    >
      {error !== null && error !== undefined && <LoadErrorBanner error={error} onRetry={onRetry} />}
      {detail === undefined && (
        <p id={printNoteId} className="field-note">
          {t.detail.printNeedsDetail}
        </p>
      )}
      {isLoading && (
        <div role="status" aria-label={t.loading.detail}>
          <SkeletonText lines={6} />
        </div>
      )}
      {detail !== undefined && (
        <div className="ship-request-detail">
          <dl className="ship-history-dl">
            <div>
              <dt>{t.detail.fields.shipmentRequestNo}</dt>
              <dd>{detail.shipmentRequestNo}</dd>
            </div>
            <div>
              <dt>{t.detail.fields.customer}</dt>
              <dd>{customerName}</dd>
            </div>
            <div>
              <dt>{t.detail.fields.shipToPartner}</dt>
              <dd>{shipToPartnerName}</dd>
            </div>
            <div>
              <dt>{t.detail.fields.salesOrder}</dt>
              <dd>{detail.salesOrderNo ?? t.detail.noSalesOrder}</dd>
            </div>
            <div>
              <dt>{t.detail.fields.shipDate}</dt>
              <dd>{detail.requestedShipDate}</dd>
            </div>
            <div>
              <dt>{t.detail.fields.fulfillmentPlant}</dt>
              <dd>{fulfillmentPlantName}</dd>
            </div>
            <div>
              <dt>{t.detail.fields.progress}</dt>
              <dd>{progressLabel(detail.shipmentProgressCode)}</dd>
            </div>
            <div>
              <dt>{t.detail.fields.code}</dt>
              <dd>{detail.code}</dd>
            </div>
            <div>
              <dt>{t.detail.fields.pickingWarehouses}</dt>
              <dd>
                {warehouseSummary(detail).length === 0
                  ? t.detail.noPickingWarehouse
                  : warehouseSummary(detail)
                      .map((w) =>
                        `${w.warehouseName} LOT ${String(w.lotCount)}, ${String(w.qty)} ${uomOfDetail(detail)}`.trim(),
                      )
                      .join(' / ')}
              </dd>
            </div>
          </dl>

          {detail.completedShipment !== null && (
            <AlertBanner variant="success">
              {t.detail.completed(
                detail.completedShipment.shipmentNo,
                dateTime(detail.completedShipment.completedAt),
              )}
            </AlertBanner>
          )}

          {detail.completionBlockers.length > 0 && (
            <AlertBanner
              variant="error"
              title={t.detail.blockersTitle(detail.completionBlockers.length)}
            >
              <ul className="ship-history-consequences">
                {detail.completionBlockers.map((blocker, index) => {
                  const target = blockerTarget(blocker);
                  const text =
                    blocker.code === 'ALREADY_COMPLETED'
                      ? t.detail.blockers.ALREADY_COMPLETED
                      : t.detail.blockers[blocker.code](target);
                  return <li key={`${blocker.code}-${target}-${String(index)}`}>{text}</li>;
                })}
              </ul>
            </AlertBanner>
          )}
          <p className="field-note">{t.detail.popOnly}</p>

          <h3 className="field-label">{t.detail.lines}</h3>
          {linesOf(detail).map((line) => (
            <section key={line.shipmentRequestLineId} className="ship-request-line">
              <div className="wide-table">
                <table className="ship-history-lines">
                  <thead>
                    <tr>
                      <th scope="col">{t.detail.lineColumns.lineNo}</th>
                      <th scope="col">{t.detail.lineColumns.item}</th>
                      <th scope="col">{t.detail.lineColumns.uom}</th>
                      <th scope="col">{t.detail.lineColumns.inspection}</th>
                      <th scope="col">{t.detail.lineColumns.requested}</th>
                      <th scope="col">{t.detail.lineColumns.target}</th>
                      <th scope="col">{t.detail.lineColumns.picked}</th>
                      <th scope="col">{t.detail.lineColumns.over}</th>
                      <th scope="col">{t.detail.lineColumns.shipped}</th>
                      <th scope="col">{t.detail.lineColumns.salesOrderLine}</th>
                      <th scope="col">{t.detail.lineColumns.salesOrderRemaining}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{line.lineNo}</td>
                      <td>{item(line.itemId)}</td>
                      <td>{line.uomCode === '' ? t.values.empty : line.uomCode}</td>
                      <td>
                        {line.shippingInspectionRequired
                          ? t.detail.inspectionRequired
                          : t.detail.inspectionNotRequired}
                      </td>
                      <td className="ship-history-num">{line.requestedQty}</td>
                      <td className="ship-history-num">{line.allocatedQty}</td>
                      <td className="ship-history-num">{line.pickedQty}</td>
                      <td>
                        {line.overQty > 0
                          ? t.values.over(line.overQty)
                          : line.pickedQty < line.allocatedQty
                            ? t.detail.short(line.allocatedQty - line.pickedQty)
                            : t.values.empty}
                      </td>
                      <td className="ship-history-num">{line.shippedQty}</td>
                      <td>
                        {line.salesOrderLine === null
                          ? t.values.empty
                          : t.detail.salesOrderLine(
                              line.salesOrderLine.salesOrderNo,
                              line.salesOrderLine.lineNo,
                            )}
                      </td>
                      <td>
                        <SalesOrderRemainingCell line={line} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {line.lots.length === 0 ? (
                <p className="field-note">{t.detail.noLots}</p>
              ) : (
                <div className="wide-table">
                  <table className="ship-history-lines">
                    <thead>
                      <tr>
                        <th scope="col">{t.detail.lotColumns.lot}</th>
                        <th scope="col">{t.detail.lotColumns.qty}</th>
                        <th scope="col">{t.detail.lotColumns.portions}</th>
                        <th scope="col">{t.detail.lotColumns.status}</th>
                        <th scope="col">{t.detail.lotColumns.oqc}</th>
                        <th scope="col">{t.detail.lotColumns.code}</th>
                        <th scope="col">{t.detail.lotColumns.picked}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {line.lots.map((lot) => (
                        <tr
                          key={lot.shipmentRequestLotId}
                          className={
                            lot.statusCode === 'REPLACED' ? 'ship-history-replaced' : undefined
                          }
                        >
                          <td>{lot.lotNo}</td>
                          <td className="ship-history-num">{lot.pickedQty}</td>
                          <td>
                            <span className="ship-history-places">
                              {lot.portions.map((portion) => (
                                <span
                                  key={`${String(portion.warehouseId)}-${String(portion.locationId)}`}
                                >
                                  {portionText(portion, t.detail.staging)}
                                </span>
                              ))}
                            </span>
                          </td>
                          <td>{t.detail.lotStatus[lot.statusCode]}</td>
                          <td>
                            {lot.oqcLotStatus === null ? (
                              t.values.empty
                            ) : (
                              <Chip variant="status" status={OQC_TONE[lot.oqcLotStatus]} size="sm">
                                {t.detail.oqc[lot.oqcLotStatus]}
                              </Chip>
                            )}
                          </td>
                          <td>{lot.managementCode ?? t.values.empty}</td>
                          <td>
                            {lot.replacement === null ? (
                              `${dateTime(lot.pickedAt)}${lot.pickedWorker === null ? '' : `, ${lot.pickedWorker.workerName}`}`
                            ) : (
                              <Fragment>
                                {t.detail.replacedAt(
                                  dateTime(lot.replacement.replacedAt),
                                  lot.replacement.nonconformanceNo,
                                )}
                              </Fragment>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}

          <h3 className="field-label">{t.detail.replacements}</h3>
          {replacementsOf(detail).length === 0 ? (
            <p className="field-note">{t.detail.noReplacements}</p>
          ) : (
            <div className="wide-table">
              <table className="ship-history-lines" aria-label={t.detail.replacements}>
                <thead>
                  <tr>
                    <th scope="col">{t.detail.replacementColumns.at}</th>
                    <th scope="col">{t.detail.replacementColumns.worker}</th>
                    <th scope="col">{t.detail.replacementColumns.line}</th>
                    <th scope="col">{t.detail.replacementColumns.lot}</th>
                    <th scope="col">{t.detail.replacementColumns.result}</th>
                    <th scope="col">{t.detail.replacementColumns.nonconformance}</th>
                  </tr>
                </thead>
                <tbody>
                  {replacementsOf(detail).map((row) => (
                    <tr key={`${row.lotNo}-${row.replacedAt}`}>
                      <td>{dateTime(row.replacedAt)}</td>
                      <td>
                        {row.workerName === null
                          ? t.values.empty
                          : `${row.workerName} ${row.workerNo ?? ''}`.trim()}
                      </td>
                      <td>{`${String(row.lineNo)}, ${item(row.itemId)}`}</td>
                      <td>{`${row.lotNo}, ${String(row.qty)}`}</td>
                      <td>
                        {`${t.detail.resultRound(row.resultRound)}, ${
                          row.judgment === null
                            ? t.values.empty
                            : (t.detail.oqc[row.judgment as keyof typeof t.detail.oqc] ??
                              row.judgment)
                        }, ${dateTime(row.resultAt)}`}
                      </td>
                      <td>{row.nonconformanceNo ?? t.values.empty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
};
