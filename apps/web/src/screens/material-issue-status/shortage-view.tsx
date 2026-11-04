import { AlertBanner, Button, Chip, Skeleton } from '@crefle/web-ui';
import type { PlannedStockResponse } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { Link } from 'react-router';

import { useOverrideNotes, useReasonNames } from './queries';
import { formatDay, formatQty, historyText, plantMinute } from './status';

const t = messages.materialIssueStatus;

/** W-02-10 추가 출고 요청 — 보충 요청이 여는 자리. */
export const MATERIAL_ISSUE_REQUEST_PATH = '/production/material-issue-requests';

/** 「부족 보충」 사유 코드(계약 §1 409 `overridable` 판단과 같은 값). */
export const SHORTAGE_SUPPLEMENT_REASON = 'SHORTAGE_SUPPLEMENT';

export interface ReplenishTarget {
  workOrderId?: number;
  workOrderNo: string;
  itemId: number;
  qty: number;
  sourceWarehouseId?: number;
  unsourcedShortageId?: number;
}

/**
 * 보충 요청 → W-02-10 을 W/O · 품목 · 수량 · 사유 「부족 보충」 · 출발 생산 창고를 채워 연다(검토 3).
 * 「재고 있는 생산 창고 없음」 행이면 `unsourced` 를 실어 발행이 그 행을 「보충 요청됨」으로 바꾼다.
 */
export const replenishLink = (target: ReplenishTarget): string => {
  const params = new URLSearchParams();
  if (target.workOrderId !== undefined) params.set('wo', String(target.workOrderId));
  params.set('woNo', target.workOrderNo);
  params.set('item', String(target.itemId));
  params.set('qty', String(target.qty));
  params.set('reason', SHORTAGE_SUPPLEMENT_REASON);
  if (target.sourceWarehouseId !== undefined) params.set('src', String(target.sourceWarehouseId));
  if (target.unsourcedShortageId !== undefined) {
    params.set('unsourced', String(target.unsourcedShortageId));
  }
  return `${MATERIAL_ISSUE_REQUEST_PATH}?${params.toString()}`;
};

export interface ShortageViewProps {
  data: PlannedStockResponse | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}

/**
 * 「부족」 보기 — 맨 위 「재고 있는 생산 창고 없음」 묶음(FR-007a, W/O 단위)과 생산 창고별 부족(FR-016).
 * 요청 배분 줄마다 「보충 요청 →」(검토 3).
 */
export const ShortageView = ({ data, isPending, isError, onRetry }: ShortageViewProps) => {
  const reasons = useReasonNames();
  const overrideNotes = useOverrideNotes(
    (data?.items ?? []).flatMap((row) =>
      row.shortageQty > 0
        ? row.requests
            .filter((request) => request.shortageQty > 0)
            .map((request) => request.materialIssueRequestId)
        : [],
    ),
  );
  if (isError) {
    return (
      <AlertBanner
        variant="error"
        title={messages.httpError.loadTitle}
        action={
          <Button variant="outlined" size="sm" onClick={onRetry}>
            {messages.common.retry}
          </Button>
        }
      >
        {messages.httpError.description}
      </AlertBanner>
    );
  }
  if (isPending || data === undefined) return <Skeleton variant="rect" height="16rem" />;

  const unsourced = data.unsourced ?? [];
  const rows = data.items.filter((row) => row.shortageQty > 0);
  const workOrderCount = new Set(unsourced.map((row) => row.workOrderId)).size;

  return (
    <>
      <div className="banner-slot">
        <AlertBanner variant="info">{t.shortage.intro}</AlertBanner>
      </div>
      <table className="material-issue-status-table" aria-label={t.shortage.tableLabel}>
        <thead>
          <tr>
            <th scope="col">{t.shortage.columns.warehouse}</th>
            <th scope="col">{t.shortage.columns.item}</th>
            <th scope="col">{t.shortage.columns.available}</th>
            <th scope="col">{t.shortage.columns.planned}</th>
            <th scope="col">{t.shortage.columns.shortage}</th>
            <th scope="col">{t.shortage.columns.allocation}</th>
          </tr>
        </thead>
        <tbody>
          {unsourced.length > 0 && (
            <tr className="material-issue-status-group">
              <th scope="rowgroup" colSpan={6}>
                <strong>{t.shortage.unsourcedTitle}</strong>{' '}
                <span className="field-note">{t.shortage.unsourcedNote(workOrderCount)}</span>
              </th>
            </tr>
          )}
          {unsourced.map((row) => (
            <tr key={`u-${String(row.unsourcedShortageId)}`}>
              <td>{t.shortage.none}</td>
              <td>
                <span className="material-issue-status-code">{row.itemCode}</span> {row.itemName}
              </td>
              <td>0</td>
              <td>—</td>
              <td>
                <Chip size="sm" status="error">
                  {`${formatQty(row.shortageQty)} ${row.uomCode}`}
                </Chip>
              </td>
              <td>
                <span className="material-issue-status-allocation">
                  <span>
                    {t.shortage.workOrderLine(
                      row.workOrderNo,
                      row.productionDate ? formatDay(row.productionDate) : '',
                    )}
                  </span>
                  {row.resolvedRequestNo ? (
                    <Chip size="sm" status="success">
                      {t.shortage.replenished(row.resolvedRequestNo)}
                    </Chip>
                  ) : (
                    <Link
                      to={replenishLink({
                        workOrderId: row.workOrderId,
                        workOrderNo: row.workOrderNo,
                        itemId: row.itemId,
                        qty: row.shortageQty,
                        unsourcedShortageId: row.unsourcedShortageId,
                      })}
                      aria-label={t.shortage.replenishLabel(`${row.workOrderNo} ${row.itemCode}`)}
                    >
                      {t.shortage.replenish}
                    </Link>
                  )}
                </span>
              </td>
            </tr>
          ))}
          {rows.length > 0 && (
            <tr className="material-issue-status-group">
              <th scope="rowgroup" colSpan={6}>
                <strong>{t.shortage.warehouseGroup}</strong>{' '}
                <span className="field-note">{t.shortage.warehouseGroupCount(rows.length)}</span>
              </th>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={`${String(row.sourceWarehouseId)}-${String(row.itemId)}`}>
              <td>{row.sourceWarehouseName ?? String(row.sourceWarehouseId)}</td>
              <td>
                <span className="material-issue-status-code">{row.itemCode}</span> {row.itemName}
              </td>
              <td>{formatQty(row.availableQty)}</td>
              <td>{formatQty(row.plannedQty)}</td>
              <td>
                <Chip size="sm" status="warning">
                  {formatQty(row.shortageQty)}
                </Chip>
              </td>
              <td>
                {row.requests
                  .filter((request) => request.shortageQty > 0)
                  .flatMap((request) => {
                    const note = overrideNotes.get(request.materialIssueRequestId);
                    return note === undefined
                      ? []
                      : [
                          <p
                            key={`note-${String(request.materialIssueRequestId)}`}
                            className="field-note"
                          >
                            {t.shortage.overrideNote(
                              plantMinute(note.occurredAt),
                              note.actorName ?? t.detail.systemActor,
                              request.issueRequestNo,
                              historyText(note, (code) => reasons.data?.get(code) ?? code),
                            )}
                          </p>,
                        ];
                  })}
                {row.requests
                  .filter((request) => request.shortageQty > 0)
                  .map((request) => (
                    <span
                      key={request.materialIssueRequestId}
                      className="material-issue-status-allocation"
                    >
                      <span className="material-issue-status-code">{request.issueRequestNo}</span>
                      <span>
                        {t.shortage.allocation(
                          request.workOrderNo,
                          formatDay(request.issueWorkDate),
                          formatQty(request.plannedQty),
                        )}
                      </span>
                      <Chip size="sm" status="warning">
                        {t.shortageChip(formatQty(request.shortageQty))}
                      </Chip>
                      <Link
                        to={replenishLink({
                          ...(request.workOrderId === undefined
                            ? {}
                            : { workOrderId: request.workOrderId }),
                          workOrderNo: request.workOrderNo,
                          itemId: row.itemId,
                          qty: request.shortageQty,
                          sourceWarehouseId: row.sourceWarehouseId,
                        })}
                        aria-label={t.shortage.replenishLabel(
                          `${request.issueRequestNo} ${row.itemCode}`,
                        )}
                      >
                        {t.shortage.replenish}
                      </Link>
                    </span>
                  ))}
              </td>
            </tr>
          ))}
          {unsourced.length === 0 && rows.length === 0 && (
            <tr>
              <td colSpan={6}>{t.shortage.empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
};
