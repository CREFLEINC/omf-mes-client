import { activeLocale } from '@omf-mes/i18n';

import { toPlantDateTimeParts } from '../../patterns/plant-time';
import type { MovementKind } from './filters';
import type { InputLine, PackingLine, QtyByUom, ReceiptLine, ShipmentLine } from './types';

export interface Ref {
  id: number;
  code: string;
  name: string;
}

export interface MovementLot {
  lotId: number;
  lotNo: string;
  qty: number;
}

/** 입고 줄과 출하 줄을 한 모양으로 — 표와 내려받기가 같은 값을 읽는다. */
export interface MovementRow {
  id: number;
  kind: MovementKind;
  documentNo: string;
  lineNo: number;
  /** 공장 날짜(`YYYY-MM-DD`). */
  date: string;
  /** 공장 시각(`HH:mm`). */
  time: string;
  item: Ref;
  qty: number;
  uomCode: string;
  /** 투입 줄은 창고가 없다. */
  warehouse: Ref | null;
  /** 자재 입고의 공급사 또는 제품 출하의 고객. */
  partner: Ref | null;
  workOrderNo: string | null;
  statusCode: string;
  /** 출하 줄은 LOT 번호순 앞 5개다. */
  lots: MovementLot[];
  lotCount: number;
}

/** 공장 시각으로 바꾸지 못한 값은 받은 글자 그대로 보인다. 앞 10자를 자르면 UTC 날짜가 공장 날짜처럼 보인다. */
const plantParts = (value: string): { date: string; time: string } =>
  toPlantDateTimeParts(value) ?? { date: value, time: '' };

export const fromReceiptLine = (line: ReceiptLine): MovementRow => ({
  id: line.goodsReceiptLineId,
  kind: line.receiptTypeCode === 'PRODUCT' ? 'PRODUCT' : 'MATERIAL',
  documentNo: line.goodsReceiptNo,
  lineNo: line.lineNo,
  ...plantParts(line.receiptDatetime),
  item: line.item,
  qty: line.receiptQty,
  uomCode: line.uomCode,
  warehouse: line.warehouse,
  partner: line.supplier,
  workOrderNo: line.workOrder?.workOrderNo ?? null,
  statusCode: line.statusCode,
  lots: [{ lotId: line.lotId, lotNo: line.lotNo, qty: line.receiptQty }],
  lotCount: 1,
});

export const fromShipmentLine = (line: ShipmentLine): MovementRow => ({
  id: line.shipmentLineId,
  kind: 'SHIPMENT',
  documentNo: line.shipmentNo,
  lineNo: line.lineNo,
  ...plantParts(line.shippedAt),
  item: line.item,
  qty: line.shippedQty,
  uomCode: line.uomCode,
  warehouse: line.warehouse,
  partner: line.customer,
  workOrderNo: null,
  statusCode: line.statusCode,
  lots: line.lots,
  lotCount: line.lotCount,
});

/** 투입 줄 — 문서번호는 투입 번호, 상대 대신 W/O 번호. */
export const fromInputLine = (line: InputLine): MovementRow => ({
  id: line.materialConsumptionId,
  kind: 'CONSUMED',
  documentNo: line.consumptionNo,
  lineNo: 1,
  ...plantParts(line.occurredAt),
  item: line.item,
  qty: line.inputQty,
  uomCode: line.uomCode,
  warehouse: null,
  partner: null,
  workOrderNo: line.workOrder.workOrderNo,
  statusCode: line.statusCode,
  lots: [{ lotId: line.lotId, lotNo: line.lotNo, qty: line.inputQty }],
  lotCount: 1,
});

/** 포장 줄 — 한 줄이 상자 하나에 담긴 LOT 하나다. 문서번호는 포장 번호(취급 단위 번호). */
export const fromPackingLine = (line: PackingLine): MovementRow => ({
  id: line.handlingUnitContentId,
  kind: 'PACKED',
  documentNo: line.handlingUnitNo,
  lineNo: 1,
  ...plantParts(line.packedAt),
  item: line.item,
  qty: line.qty,
  uomCode: line.uomCode,
  warehouse: null,
  partner: null,
  workOrderNo: line.workOrder?.workOrderNo ?? null,
  statusCode: line.handlingUnitStatusCode,
  lots: [{ lotId: line.lotId, lotNo: line.lotNo, qty: line.qty }],
  lotCount: 1,
});

/** 화면 언어의 자리 구분을 따른다(베트남어는 `1.234,5`). */
export const formatQty = (value: number): string =>
  new Intl.NumberFormat(activeLocale(), { maximumFractionDigits: 6 }).format(value);

/** 단위가 섞이면 더할 수 없어 단위마다 적는다(계약 `qtyByUom`). */
export const formatQtyByUom = (totals: readonly QtyByUom[]): string =>
  totals.map((entry) => `${formatQty(entry.qty)} ${entry.uomCode}`).join(', ');

/** 줄의 열쇠 — 구분마다 번호 공간이 달라(입고 줄, 출하 줄) 「구분-번호」로 가른다. 주소 `line`에 쓴다. */
export const rowKeyOf = (row: MovementRow): string => `${row.kind}-${String(row.id)}`;

/** 표와 상세의 수량 글자. 파일에는 숫자 그대로 쓴다. */
export const qtyLabel = (row: MovementRow): string => `${formatQty(row.qty)} ${row.uomCode}`;
