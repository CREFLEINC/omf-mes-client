import type { components } from '@omf-mes/api-client';

/**
 * W-04-12 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이
 * 유지된다.
 *
 * 이 파일은 이 화면이 소유한다 — 다른 화면 슬라이스(`shipment-processing`·`expedited-shipment`)의
 * 같은 이름 파일을 참조하지 않는다. 타입 모양이 겹쳐도 각자 새로 쓴다.
 */

type ShipmentResponse = components['schemas']['Shipment'];

/**
 * 미확정 출하 한 건.
 *
 * ⚠ **`shippedAt`이 선택 필드다.** 경과와 자동 확정 예정 시각이 **전부 이 값에서 나오므로**
 * 없으면 「0시간 경과」가 아니라 **셀 수 없는 것**이다. `null`로 들고 있다가 표시 지점에서
 * 사실을 적는다 — 0으로 접으면 방금 나간 건처럼 보여 **가장 오래 적체된 건이 눈에서 사라진다.**
 */
export interface ShipmentRow {
  shipmentId: number;
  shipmentNo: string;
  shippedAt: string | null;
  statusCode: string;
  erpDeliveryNo: string | null;
  /** 출하 수량 합. 라인이 안 오면 셀 수 없다 — 0과 구분한다. */
  totalQty: number | null;
}

/** 라인이 없으면 `null`. 빈 배열(라인이 실제로 0건)과 「못 받았다」를 가른다. */
const sumShippedQty = (lines: ShipmentResponse['lines']): number | null => {
  if (lines === undefined) return null;
  return lines.reduce((sum, line) => sum + line.shippedQty, 0);
};

export const toShipmentRow = (data: ShipmentResponse): ShipmentRow => ({
  shipmentId: data.shipmentId,
  shipmentNo: data.shipmentNo,
  shippedAt: data.shippedAt ?? null,
  statusCode: data.statusCode,
  erpDeliveryNo: data.erpDeliveryNo ?? null,
  totalQty: sumShippedQty(data.lines),
});

/**
 * 고른 건들의 수량 합.
 *
 * ⚠ **하나라도 셀 수 없으면 합도 셀 수 없다** — 못 받은 것을 0으로 치고 더하면 **실제보다 작은
 * 수**가 확인 창에 뜬다. 되돌릴 수 없는 확정 앞에서 그 수를 보고 판단한다.
 */
export const totalQtyOf = (rows: readonly ShipmentRow[]): number | null => {
  if (rows.some((row) => row.totalQty === null)) return null;
  return rows.reduce((sum, row) => sum + (row.totalQty ?? 0), 0);
};
