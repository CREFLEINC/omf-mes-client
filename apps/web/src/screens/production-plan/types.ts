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
}

export interface ProductionPlanListResponse {
  items: ProductionPlanFact[];
  page: PageMeta;
}

export interface ProductionPlanAllResponse {
  items: ProductionPlanFact[];
  total: number;
}
