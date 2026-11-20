import { readQty } from './validation';

import type {
  AssignmentMode,
  ShipmentRequestCreate,
  ShipmentRequestLineCreate,
  ShipmentRequestLineDraft,
} from './types';

/**
 * 편성 요청의 본문을 만드는 **유일한 자리** — 이 화면에서 되돌릴 수 없는 쓰기의 내용이 여기서
 * 정해진다.
 *
 * | 자리 | 값 | 근거 |
 * | --- | --- | --- |
 * | `salesOrderId` | 지시서 경유면 그 번호, 단독 생성이면 **비운다**(`null`) | 계약 설명 — 이 값 하나로 두 모드를 가른다 |
 * | `customerId`·`shipToPartnerId`·`requestedShipDate` | 화면이 든 값 | 계약 필수 셋 |
 * | `lines` | **배정 수량이 1 이상인 줄만** | 0배정 줄은 「이번에 안 나간다」는 뜻이지 「지운다」가 아니다 — 서버가 요구하는 「라인 1건 이상·배정 1 이상」을 화면이 미리 지킨다 |
 * | `salesOrderLineId`·`itemId`·`uomId`·`requestedQty` | 지시서 경유 줄은 원본을 그대로, 단독 생성 줄은 사용자가 고른 값 | 지시서 경유는 읽기 전용이라 원본과 화면 값이 항상 같다 |
 * | `businessUnitId` | 고른 사업부 | 피처 012 FR-001 — 「출하 담당 공장」(`fulfillmentPlantId`)은 싣지 않는다(서버가 400) |
 * | `lines[].warehouseId` | 줄마다 고른 출고 창고 | 피처 012 FR-003 — 고르지 않은 줄이 있으면 본문을 만들지 않는다 |
 * | **나눈 줄의 `requestedQty`** | 나눈 줄 = 그 줄 배정 수량, 원 줄 = S/O 잔여 − 나눈 줄 배정 합 | 피처 012 FR-005 — 묶음의 요청 합이 S/O 잔여와 같다(요청이 두 번 세지지 않는다). 서버는 배정 합 ≤ 잔여만 본다 |
 * | **멱등 키** | 공통 쓰기 훅이 만든다 | 헤더 규약은 `patterns/master`가 한 곳에서 진다 |
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const POSITIVE_INTEGER = /^\d+$/;

/** 고르지 않은 값과 못 알아들은 값을 함께 `null`로 본다. */
const readId = (raw: string): number | null => {
  const text = raw.trim();

  return POSITIVE_INTEGER.test(text) && Number(text) >= 1 ? Number(text) : null;
};

/**
 * 한 줄을 계약의 생성 항목으로 옮긴다. **배정 수량이 1 미만이면 만들지 않는다**(`null`) —
 * 그 줄은 이번 편성에서 뺀다.
 */
const qtyOrZero = (raw: string): number => {
  const read = readQty(raw);

  return read.kind === 'qty' ? read.value : 0;
};

/**
 * 그 줄이 보낼 요청 수량(피처 012 FR-005).
 *
 * - 나누지 않은 줄: 화면 값 그대로.
 * - 나눈 줄: 자기 배정 수량.
 * - 나눈 줄이 있는 원 줄: S/O 잔여(원 줄 요청 수량) − 나눈 줄 배정 합. 소수 오차는 6자리에서 자른다.
 */
const requestedOf = (
  line: ShipmentRequestLineDraft,
  lines: readonly ShipmentRequestLineDraft[],
): number | null => {
  if (line.splitOf !== null) return qtyOrZero(line.allocatedQty);

  const requested = readQty(line.requestedQty);

  if (requested.kind !== 'qty') return null;

  const splitTotal = lines
    .filter((other) => other.splitOf === line.key)
    .reduce((sum, other) => sum + qtyOrZero(other.allocatedQty), 0);

  return Math.round((requested.value - splitTotal) * 1e6) / 1e6;
};

const toLine = (
  line: ShipmentRequestLineDraft,
  lines: readonly ShipmentRequestLineDraft[],
): ShipmentRequestLineCreate | null => {
  const allocated = readQty(line.allocatedQty);

  if (allocated.kind !== 'qty' || allocated.value < 1) return null;

  const itemId = readId(line.itemId);
  const uomId = readId(line.uomId);
  const warehouseId = readId(line.warehouseId);
  const requested = requestedOf(line, lines);

  if (itemId === null || uomId === null || warehouseId === null) return null;
  if (requested === null || requested <= 0) return null;
  if (allocated.value > requested) return null;

  return {
    ...(line.salesOrderLineId === null ? {} : { salesOrderLineId: line.salesOrderLineId }),
    itemId,
    requestedQty: requested,
    allocatedQty: allocated.value,
    uomId,
    warehouseId,
    shippingInspectionRequired: line.shippingInspectionRequired,
  };
};

export interface ShipmentRequestCreateInput {
  mode: AssignmentMode;
  /** 지시서 경유일 때만 값이 있다 */
  salesOrderId: number | null;
  businessUnitId: string;
  customerId: string;
  shipToPartnerId: string;
  requestedShipDate: string;
  lines: readonly ShipmentRequestLineDraft[];
}

/**
 * 본문을 만든다. **채워지지 않았거나 배정 수량이 1 이상인 줄이 하나도 없으면 만들지 않는다**
 * (`null`) — 버튼 잠금이 이미 닫아 둔 길이지만, 마지막 겹으로 한 번 더 막는다.
 */
export const toShipmentRequestCreateBody = (
  input: ShipmentRequestCreateInput,
): ShipmentRequestCreate | null => {
  const customerId = readId(input.customerId);
  const shipToPartnerId = readId(input.shipToPartnerId);
  const businessUnitId = readId(input.businessUnitId);
  const requestedShipDate = input.requestedShipDate.trim();

  if (customerId === null || shipToPartnerId === null || businessUnitId === null || requestedShipDate === '') {
    return null;
  }

  const lines: ShipmentRequestLineCreate[] = [];

  for (const line of input.lines) {
    if (qtyOrZero(line.allocatedQty) < 1) continue;

    const created = toLine(line, input.lines);

    /* 나갈 줄 하나라도 본문이 안 되면(창고 빈 줄 등) 아예 만들지 않는다 — 일부만 나가면 사람이 본 편성과 다르다. */
    if (created === null) return null;

    lines.push(created);
  }

  if (lines.length === 0) return null;

  return {
    salesOrderId: input.mode === 'fromOrder' ? input.salesOrderId : null,
    businessUnitId,
    customerId,
    shipToPartnerId,
    requestedShipDate,
    lines,
  };
};
