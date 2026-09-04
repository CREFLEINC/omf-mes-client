import { messages } from '@omf-mes/i18n';

import {
  INVENTORY_STATUS_HOLD,
  QUALITY_STATUS_PENDING,
  RECEIPT_TYPE_RETURN,
  SOURCE_DOCUMENT_SHIPMENT,
} from './codes';
import type { ActiveLine } from './line-draft';
import type { GoodsReceiptCreate, GoodsReceiptLineCreate, WarehouseView } from './types';

/**
 * 요청 조립 — **되돌릴 수 없는 쓰기의 본문을 만드는 유일한 자리다.**
 *
 * 입고 처리는 생성과 전기가 한 순간이다(입고 전표 · LOT 상태 · 수불 · 잔액 · ERP 적재). 그래서
 * 「무엇을 싣는가」만큼 **「무엇을 싣지 않는가」**를 분명히 한다.
 *
 * | 자리 | 값 | 근거 |
 * | --- | --- | --- |
 * | `receiptTypeCode` | `RETURN` 고정 | 스펙 §4-A |
 * | `plantId` | **고른 입고 창고의 공장** | 이 입고의 근거 문서는 창고다 — 원 출하가 없는 갈래에도 같은 규칙이 선다 |
 * | `sourceDocumentTypeCode`·`sourceDocumentId` | 원 출하를 찾았을 때만 `SHIPMENT`+출하 번호. 못 찾으면 **둘 다 싣지 않는다** | §5-3 · A-10 — 한쪽만 채우지 않는다. 「없음」 값을 두지 않는다 |
 * | `reasonCode` | 고른 반품 사유. 비면 싣지 않는다 | §4-A — 선택. 원천을 접어 넣지 않는다(§5-2) |
 * | `receiptDatetime`·`businessDate` | **제출 순간** | 스펙에 입고 일시 입력칸이 없다 — 반품은 받은 그 자리에서 등록한다 |
 * | 라인 `inventoryStatusCode` | `ON_HOLD` 고정 | §5-5 — 판정 전에는 출하·피킹이 막힌다 |
 * | 라인 `qualityStatusCode` | `INSPECTION_PENDING` | ⚠ 가정(`codes.ts`) — 정보 요청 중 |
 * | 라인 `originalShipmentLotAllocationId` | 배분에서 온 줄만 | §5-3 — 직접 찾은 LOT 은 비운다 |
 * | 라인 `inboundReceiptLineId` | **싣지 않는다** | 입하 전표가 없는 입고다 |
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export interface ReceiptDraft {
  reasonCode: string;
  remarks: string;
  warehouseId: string;
  locationId: string;
}

export const EMPTY_RECEIPT_DRAFT: ReceiptDraft = {
  reasonCode: '',
  remarks: '',
  warehouseId: '',
  locationId: '',
};

export interface ReceiptInput {
  /** 원 출하. 못 찾았으면 `null` — 그것이 정상 갈래다 */
  shipmentId: number | null;
  warehouse: WarehouseView;
  locationId: number;
  lines: readonly ActiveLine[];
  draft: ReceiptDraft;
  /** 제출 순간 — 인자로 받아 고정 시각으로 검사할 수 있게 한다 */
  now: Date;
}

const pad = (value: number, length = 2): string => String(value).padStart(length, '0');

/** 실행 환경이 UTC 와 얼마나 떨어져 있는지 — `+09:00` 꼴. */
const offsetText = (at: Date): string => {
  const minutes = -at.getTimezoneOffset();
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);

  return `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
};

export const toLocalDate = (at: Date): string =>
  `${String(at.getFullYear())}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;

/** offset 이 붙은 지역 일시 — offset 없는 문자열은 지역마다 다른 순간을 가리킨다. */
export const toOffsetDateTime = (at: Date): string =>
  `${toLocalDate(at)}T${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}${offsetText(at)}`;

const toLine = (line: ActiveLine, destinationLocationId: number): GoodsReceiptLineCreate => ({
  itemId: line.source.itemId,
  lotId: line.source.lotId,
  receiptQty: line.qty,
  uomId: line.source.uomId,
  qualityStatusCode: QUALITY_STATUS_PENDING,
  inventoryStatusCode: INVENTORY_STATUS_HOLD,
  destinationLocationId,
  ...(line.source.allocationId === null
    ? {}
    : { originalShipmentLotAllocationId: line.source.allocationId }),
});

export const toGoodsReceiptBody = (input: ReceiptInput): GoodsReceiptCreate => ({
  receiptTypeCode: RECEIPT_TYPE_RETURN,
  plantId: input.warehouse.plantId,
  warehouseId: input.warehouse.warehouseId,
  receiptDatetime: toOffsetDateTime(input.now),
  businessDate: toLocalDate(input.now),
  ...(input.shipmentId === null
    ? {}
    : { sourceDocumentTypeCode: SOURCE_DOCUMENT_SHIPMENT, sourceDocumentId: input.shipmentId }),
  ...(input.draft.reasonCode === '' ? {} : { reasonCode: input.draft.reasonCode }),
  ...(input.draft.remarks.trim() === '' ? {} : { remarks: input.draft.remarks.trim() }),
  lines: input.lines.map((line) => toLine(line, input.locationId)),
});

/** 머리 검증 — 위치만 필수다(`destination_location_id` NOT NULL). 창고는 위치가 딸려 있으니 함께 선다. */
export const validateDraft = (draft: ReceiptDraft): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (draft.locationId === '')
    errors.destinationLocationId = messages.returnReceipt.form.locationRequired;

  return errors;
};

export const hasDraftInput = (draft: ReceiptDraft): boolean =>
  draft.reasonCode !== '' || draft.remarks.trim() !== '' || draft.locationId !== '';
