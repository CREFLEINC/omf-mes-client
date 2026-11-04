import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueries } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

import type { PlannedStockConflict } from './mutations';

const t = messages.materialIssueRequest;

export interface PlannedStockDialogProps {
  conflict: PlannedStockConflict;
  /** 품목 번호 → 「코드 이름」을 이미 아는 자리(줄 품목). 모르면 창이 품목 상세로 푼다. */
  itemLabel: (itemId: number) => string | undefined;
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
  const { client } = useApiClient();
  /* 품목은 번호만 온다 — 모르는 품목은 상세로 코드 · 이름을 푼다(G2 6). */
  const unknownItems = [
    ...new Set(
      conflict.details
        .map((detail) => detail.itemId)
        .filter((itemId) => itemLabel(itemId) === undefined),
    ),
  ];
  const itemDetails = useQueries({
    queries: unknownItems.map((itemId) => ({
      queryKey: ['material-issue-request', 'conflict-item', itemId] as const,
      retry: false,
      queryFn: async () =>
        (
          await runRequest(() =>
            client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } }),
          )
        ).item,
    })),
  });
  const labelOf = (itemId: number): string => {
    const known = itemLabel(itemId);
    if (known !== undefined) return known;
    const item = itemDetails[unknownItems.indexOf(itemId)]?.data;
    return item === undefined ? String(itemId) : `${item.itemCode} ${item.itemName}`;
  };

  /*
   * 「재고 있는 생산 창고 없음」 품목은 그 줄에만 알린다(G2 14) — 창 전체를 막지 않는다.
   * 가져갈 예정분이 없으면(가져갈 수량 0, 영향받는 요청 없음) 「남은 수량보다 많습니다」(G2 7).
   */
  const stocked = conflict.details.filter((detail) => detail.noStockedWarehouse !== true);
  /*
   * 「재고 있는 생산 창고 없음」 줄이 하나라도 있으면 서버는 `acceptPlannedOverride` 를 보내도 다시 409 다 —
   * 「그래도 요청」을 열지 않고 그 줄을 빼라고 알린다(총괄 확인 2026-11-04). 나머지 줄 안내는 그대로.
   */
  const hasNoStocked = stocked.length < conflict.details.length;
  const canOverride =
    !hasNoStocked &&
    stocked.length > 0 &&
    stocked.every((detail) => detail.overridable) &&
    onOverride !== undefined;
  const takesPlanned = stocked.some(
    (detail) => detail.takeFromPlannedQty > 0 || (detail.affectedRequests?.length ?? 0) > 0,
  );
  const title = hasNoStocked
    ? t.override.noStockedTitle
    : canOverride
      ? takesPlanned
        ? t.override.title
        : t.override.shortTitle
      : t.override.blockedTitle;
  const body = hasNoStocked
    ? t.override.noStockedRemoveBody
    : canOverride
      ? takesPlanned
        ? t.override.body
        : t.override.shortBody
      : stocked.length === 0
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
              <td>{labelOf(detail.itemId)}</td>
              <td>
                {detail.noStockedWarehouse === true
                  ? t.override.noStockedRow
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
                      request.issueRequestNo ?? t.values.empty,
                      request.workOrderNo ?? t.values.empty,
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
