import { CUSTOMER_LOT_REQUIREMENT_MAX_LENGTH, readQty } from './validation';
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
const toLine = (line: ShipmentRequestLineDraft): ShipmentRequestLineCreate | null => {
  const allocated = readQty(line.allocatedQty);

  if (allocated.kind !== 'qty' || allocated.value < 1) return null;

  const itemId = readId(line.itemId);
  const uomId = readId(line.uomId);
  const requested = readQty(line.requestedQty);

  if (itemId === null || uomId === null) return null;
  if (requested.kind !== 'qty' || requested.value <= 0) return null;
  if (allocated.value > requested.value) return null;

  const shelfLife = readQty(line.minimumRemainingShelfLifeDays);

  return {
    ...(line.salesOrderLineId === null ? {} : { salesOrderLineId: line.salesOrderLineId }),
    itemId,
    requestedQty: requested.value,
    allocatedQty: allocated.value,
    uomId,
    ...(line.customerLotRequirement.trim() === ''
      ? {}
      : { customerLotRequirement: line.customerLotRequirement.trim() }),
    shippingInspectionRequired: line.shippingInspectionRequired,
    ...(shelfLife.kind === 'qty' ? { minimumRemainingShelfLifeDays: shelfLife.value } : {}),
  };
};

export interface ShipmentRequestCreateInput {
  mode: AssignmentMode;
  /** 지시서 경유일 때만 값이 있다 */
  salesOrderId: number | null;
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
  const requestedShipDate = input.requestedShipDate.trim();

  if (customerId === null || shipToPartnerId === null || requestedShipDate === '') return null;
  if (
    input.lines.some(
      (line) => line.customerLotRequirement.length > CUSTOMER_LOT_REQUIREMENT_MAX_LENGTH,
    )
  ) {
    return null;
  }

  const lines: ShipmentRequestLineCreate[] = [];

  for (const line of input.lines) {
    const created = toLine(line);

    if (created !== null) lines.push(created);
  }

  if (lines.length === 0) return null;

  return {
    salesOrderId: input.mode === 'fromOrder' ? input.salesOrderId : null,
    customerId,
    shipToPartnerId,
    requestedShipDate,
    lines,
  };
};
