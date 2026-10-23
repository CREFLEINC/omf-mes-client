export interface PageMeta {
  page: number;
  size: number;
  total: number;
}

export interface ProductionPlanFact {
  productionPlanId: number;
  productionOrderId: number;
  planNo: string;
  planDate: string;
  plannedQty: number;
  uomId: number;
  bomId: number;
  routingId: number;
  plannedLineId: number | null;
  statusCode: string;
  confirmedAt: string | null;
  remarks: string | null;
  /** 낙관적 잠금 판. 서버 ETag와 같은 값이다(If-Match로 보낸다). */
  versionNo: number | null;
}

export interface ProductionPlanListResponse {
  items: ProductionPlanFact[];
  page: PageMeta;
}

export interface ProductionPlanAllResponse {
  items: ProductionPlanFact[];
  total: number;
}
