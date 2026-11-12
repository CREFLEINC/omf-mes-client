import type { InboundLotColumns, InboundLotFilterQuery, paths } from '@omf-mes/api-client';

/** 입고 줄 목록(자재 입고, 제품입고). 계약 정본: 서버 `contracts/logistics-01자재창고.json`. */
export type ReceiptLineQuery = NonNullable<
  paths['/logistics/goods-receipt-lines']['get']['parameters']['query']
> &
  InboundLotFilterQuery;
export type ReceiptLinePage =
  paths['/logistics/goods-receipt-lines']['get']['responses'][200]['content']['application/json'];
/** 005 FR-035 — 입고한 LOT 의 입하 LOT(`inboundLotId` · `inboundLotNo`, 없으면 null)을 더한 줄(api-client 덧댐). 칸을 고르게 받으려고 선택으로 둔다 — 없으면 null 과 같다. */
export type ReceiptLine = ReceiptLinePage['items'][number] & Partial<InboundLotColumns>;

/** 출하 줄 목록(제품 출하). 계약 정본: 서버 `contracts/shipment-04제품출하.json`. */
export type ShipmentLineQuery = NonNullable<
  paths['/logistics/shipment-lines']['get']['parameters']['query']
>;
export type ShipmentLinePage =
  paths['/logistics/shipment-lines']['get']['responses'][200]['content']['application/json'];
export type ShipmentLine = ShipmentLinePage['items'][number];

/** 투입 줄 목록. 계약 정본: 서버 `contracts/logistics-01자재창고.json`(장부 P-140). */
export type InputLineQuery = NonNullable<
  paths['/trace/material-input-lines']['get']['parameters']['query']
> &
  InboundLotFilterQuery;
/** 005 FR-035 — 투입한 자재 LOT 의 입하 LOT 을 더한 줄. */
export type InputLine =
  paths['/trace/material-input-lines']['get']['responses'][200]['content']['application/json']['items'][number] &
    Partial<InboundLotColumns>;

/** 포장 줄 목록(확정된 취급 단위의 구성 줄). 계약 정본: 서버 `contracts/logistics-01자재창고.json`(장부 P-140). */
export type PackingLineQuery = NonNullable<
  paths['/trace/packing-lines']['get']['parameters']['query']
>;
export type PackingLine =
  paths['/trace/packing-lines']['get']['responses'][200]['content']['application/json']['items'][number];

export type QtyByUom = ReceiptLinePage['totals']['qtyByUom'][number];
