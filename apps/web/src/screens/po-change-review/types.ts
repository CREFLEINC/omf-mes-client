import type { components } from '@omf-mes/api-client';

/**
 * W-02-06 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이
 * 유지된다.
 *
 * 이 파일은 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type ProductionOrderResponse = components['schemas']['ProductionOrder'];
type WorkOrderResponse = components['schemas']['WorkOrder'];

/**
 * 변경 알림 한 건 — **P/O 자신이다.**
 *
 * ⚠ **변경은 이미 반영된 뒤에 온다**(§5-1). `orderQty`·`dueDate`·`statusCode` 는 **변경 «후»
 * 값**이다 — 화면이 열릴 때 P/O 행은 이미 ERP 가 보낸 값으로 덮여 있다.
 *
 * ⛔ **`versionNo` 는 화면에 보이지 않는다**(A-4). 다만 낙관적 잠금이 걸린다 — 판정하는 사이
 * ERP 가 또 보내면 409 다(§5-3).
 */
export interface ChangeNotification {
  productionOrderId: number;
  productionOrderNo: string;
  itemId: number;
  /** 변경 «후» 수량. 비교의 오른쪽이다. */
  orderQty: number;
  uomId: number;
  dueDate: string | null;
  statusCode: string;
  /** 확인 시각. 비어 있으면 미확인이다 — 목록의 「확인」 열이 이 값의 «유무»를 본다. */
  acknowledgedAt: string | null;
}

export const toChangeNotification = (data: ProductionOrderResponse): ChangeNotification => ({
  productionOrderId: data.productionOrderId,
  productionOrderNo: data.productionOrderNo,
  itemId: data.itemId,
  orderQty: data.orderQty,
  uomId: data.uomId,
  dueDate: data.dueDate ?? null,
  statusCode: data.statusCode,
  acknowledgedAt: data.acknowledgedAt ?? null,
});

/**
 * 영향 받는 W/O 한 건.
 *
 * ⭐ **실적을 함께 받는다**(`withProgress=true`) — 「실적 1,200 ⚠ 이미 생산됨」이 그것 없이는
 * 그려지지 않는다. 실적이 이미 붙은 W/O 가 섞이면 **어느 것을 얼마나 줄일지는 업무 판단**이라
 * 서버가 스스로 나누지 않는다(§5-5).
 *
 * ⛔ **`poMismatch` 는 서버가 세운다** — 화면이 계산하지 않는다(계약 명시).
 */
export interface AffectedWorkOrder {
  workOrderId: number;
  workOrderNo: string;
  orderQty: number;
  statusCode: string;
  /** 양품 실적 합. 실적을 안 받았으면 `null` — 0과 구분한다. */
  producedQty: number | null;
  poMismatch: boolean;
  versionNo: number | null;
}

export const toAffectedWorkOrder = (data: WorkOrderResponse): AffectedWorkOrder => ({
  workOrderId: data.workOrderId,
  workOrderNo: data.workOrderNo,
  orderQty: data.orderQty,
  statusCode: data.statusCode,
  /*
   * ⚠ **실적을 못 받은 것과 0인 것을 가른다.** 0으로 접으면 「아직 안 만든 W/O」로 보여
   * 「이미 생산됨」 경고가 사라진다 — 반영하면 계획이 실적보다 작아지는 바로 그 경우다.
   */
  producedQty: data.progress?.goodQty ?? null,
  poMismatch: data.poMismatch ?? false,
  versionNo: data.versionNo ?? null,
});

/**
 * 실적이 변경 후 수량을 넘는 W/O 들.
 *
 * ⚠ **막지 않고 경고한다**(A-9 ⓑ · §6) — 반영이 업무적으로 옳을 수 있고, 옳은지는 관리자가
 * 안다. 화면의 몫은 **무엇이 일어나는지 저장 전에 말하는 것**이다.
 */
export const overProducedOf = (
  workOrders: readonly AffectedWorkOrder[],
  changedQty: number,
): AffectedWorkOrder[] =>
  workOrders.filter((one) => one.producedQty !== null && one.producedQty > changedQty);
