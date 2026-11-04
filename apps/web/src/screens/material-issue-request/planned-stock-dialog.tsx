import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { PlannedStockConflict } from './mutations';

const t = messages.materialIssueRequest;

export interface PlannedStockDialogProps {
  conflict: PlannedStockConflict;
  /** 품목 번호 → 「코드 이름」. 응답은 번호만 준다. */
  itemLabel: (itemId: number) => string;
  /** 생산 창고 번호 → 이름. 응답은 번호만 준다(W/O 의 라인 부서 생산 창고에서 푼다). */
  warehouseLabel: (warehouseId: number) => string;
  isSaving: boolean;
  onFix: () => void;
  /** 「그래도 요청」 — `acceptPlannedOverride: true` 로 다시 보낸다. 막힘이면 주지 않는다. */
  onOverride?: () => void;
}

/**
 * 409 `PLANNED_STOCK_CONFLICT`(screens/W-02-10.md 「발행 흐름」).
 * `overridable` 이면 경고 창 「다른 W/O 의 출고 예정분을 가져갑니다」 + [그래도 요청],
 * 아니면 막힘 창 「남은 수량이 없어 요청할 수 없습니다」. 사유 판단은 서버 값을 따른다.
 */
export const PlannedStockDialog = ({
  conflict,
  itemLabel,
  warehouseLabel,
  isSaving,
  onFix,
  onOverride,
}: PlannedStockDialogProps) => {
  const canOverride =
    conflict.overridable && !conflict.noStockedWarehouse && onOverride !== undefined;
  const title = canOverride ? t.override.title : t.override.blockedTitle;
  const body = canOverride
    ? t.override.body
    : conflict.noStockedWarehouse
      ? t.override.noStockedBody
      : t.override.blockedBody;

  return (
    <Dialog
      open
      onClose={onFix}
      title={title}
      size="lg"
      footer={
        <>
          <Button variant="outlined" onClick={onFix}>
            {t.override.fix}
          </Button>
          {canOverride && (
            <Button loading={isSaving} onClick={onOverride}>
              {t.override.submit}
            </Button>
          )}
        </>
      }
    >
      <p className="dialog-text">{body}</p>
      <table className="material-issue-request-conflict" aria-label={t.override.tableLabel}>
        <thead>
          <tr>
            <th scope="col">{t.override.columns.item}</th>
            <th scope="col">{t.override.columns.warehouse}</th>
            <th scope="col">{t.override.columns.requested}</th>
            <th scope="col">{t.override.columns.free}</th>
            <th scope="col">{t.override.columns.take}</th>
            <th scope="col">{t.override.columns.affected}</th>
          </tr>
        </thead>
        <tbody>
          {conflict.details.map((detail) => (
            <tr key={`${String(detail.itemId)}-${String(detail.sourceWarehouseId ?? 0)}`}>
              <td>{itemLabel(detail.itemId)}</td>
              <td>
                {detail.noStockedWarehouse === true
                  ? t.override.noStockedWarehouse
                  : detail.sourceWarehouseId === null || detail.sourceWarehouseId === undefined
                    ? t.values.empty
                    : warehouseLabel(detail.sourceWarehouseId)}
              </td>
              <td>{detail.requestedQty.toLocaleString('ko-KR')}</td>
              <td>{detail.freeQty.toLocaleString('ko-KR')}</td>
              <td>{detail.takeFromPlannedQty.toLocaleString('ko-KR')}</td>
              <td>
                {/* 늦은 출고 작업일부터 가져간다(계약 §1) — 서버가 준 차례 그대로. */}
                {(detail.affectedRequests ?? [])
                  .map((request) =>
                    t.override.affected(
                      request.issueRequestNo,
                      request.workOrderNo,
                      request.issueWorkDate?.slice(5) ?? t.values.empty,
                    ),
                  )
                  .join(', ') || t.values.empty}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  );
};
