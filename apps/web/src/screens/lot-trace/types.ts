import type { paths } from '@omf-mes/api-client';

/** 입고 줄 목록(자재 입고, 제품입고). 계약 정본: 서버 `contracts/logistics-01자재창고.json`. */
export type ReceiptLineQuery = NonNullable<
  paths['/logistics/goods-receipt-lines']['get']['parameters']['query']
>;
export type ReceiptLinePage =
  paths['/logistics/goods-receipt-lines']['get']['responses'][200]['content']['application/json'];
export type ReceiptLine = ReceiptLinePage['items'][number];

/** 출하 줄 목록(제품 출하). 계약 정본: 서버 `contracts/shipment-04제품출하.json`. */
export type ShipmentLineQuery = NonNullable<
  paths['/logistics/shipment-lines']['get']['parameters']['query']
>;
export type ShipmentLinePage =
  paths['/logistics/shipment-lines']['get']['responses'][200]['content']['application/json'];
export type ShipmentLine = ShipmentLinePage['items'][number];

export type QtyByUom = ReceiptLinePage['totals']['qtyByUom'][number];
