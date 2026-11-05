import type { components, paths } from '@omf-mes/api-client';

/**
 * W-02-12 가 읽고 쓰는 API 모양 — 모두 생성 타입(`gen:api`, 서버 main 5a8dbd7d)에서 꺼낸 별칭이다(T065).
 * 화면 파일이 스키마 경로를 매번 적지 않도록 이름만 붙인다.
 */
type Schemas = components['schemas'];
type QueryOf<P extends keyof paths> = paths[P] extends {
  get: { parameters: { query?: infer Q } };
}
  ? NonNullable<Q>
  : never;

export type MaterialIssueRequest = Schemas['MaterialIssueRequest'];
export type MaterialIssueRequestDetail = Schemas['MaterialIssueRequestDetailResponse'];
export type MaterialIssueRequestListQuery = QueryOf<'/logistics/material-issue-requests'>;
export type MaterialIssueCloseRemaining = Schemas['MaterialIssueCloseRemaining'];

export type ReplenishmentOriginCode = NonNullable<MaterialIssueRequest['replenishmentOriginCode']>;
export type ReplenishmentStatusCode = NonNullable<MaterialIssueRequest['replenishmentStatus']>;
export type ReplenishmentQtySummary = NonNullable<MaterialIssueRequest['qtySummary']>;
export type ReplenishmentGoodsIssue = NonNullable<MaterialIssueRequest['goodsIssues']>[number];

export type ReplenishmentRequestCreate = Schemas['ReplenishmentRequestCreate'];
export type ReplenishmentRequestCreated = Schemas['ReplenishmentRequestCreated'];

export type ReplenishmentItem = Schemas['ReplenishmentItem'];
export type ReplenishmentItemListQuery = QueryOf<'/logistics/replenishment-items'>;
export type ReplenishmentItemCreate = Schemas['ReplenishmentItemCreate'];
export type ReplenishmentItemUpdate = Schemas['ReplenishmentItemUpdate'];
export type ReplenishmentItemDeleted = Schemas['ReplenishmentItemDeleted'];

export type ReplenishmentSettings = Schemas['ReplenishmentSettings'];
export type ReplenishmentLastRun = NonNullable<Schemas['ReplenishmentWarehouseSetting']['lastRun']>;

export type ReplenishmentRun = Schemas['ReplenishmentRun'];
export type ReplenishmentRunResultCode = ReplenishmentRun['lines'][number]['resultCode'];

export type ReplenishmentArrival = Schemas['ReplenishmentArrival'];
export type ReplenishmentArrivalListQuery = QueryOf<'/logistics/replenishment-requests/arrivals'>;
export type ReplenishmentArrivalReceive = Schemas['ReplenishmentArrivalReceive'];

export type ShopfloorReceiptBulkCreate = Schemas['ShopfloorReceiptBulkCreate'];
export type ShopfloorReceiptBulkResult = Schemas['ShopfloorReceiptBulkResult'];
export type ShopfloorReceiptDetail = Schemas['ShopfloorReceiptDetailResponse'];
