export interface ProductionOrderRow {
  productionOrderId: number;
  productionOrderNo: string;
  erpProductionOrderNo: string | null;
  itemLabel: string | null;
  orderedQtyLabel: string;
  dueDateLabel: string | null;
  statusCode: string;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  expandedWorkOrderCount: number | null;
  plannedWorkOrderCount: number | null;
}

export interface PageMeta {
  page: number;
  size: number;
  total: number;
}

/** 목록 화면이 서버 응답에서 보존하는 생산 지시 사실. */
export interface ProductionOrderFact {
  productionOrderId: number;
  productionOrderNo: string;
  erpOrderNo: string | null;
  parentProductionOrderId: number | null;
  /** 계층 표시가 시작되기 전에도 안전하게 쓸 수 있는 깊이 값. */
  bomLevel: number;
  businessUnitId: number | null;
  plantId: number | null;
  itemId: number;
  orderQty: number;
  uomId: number;
  dueDate: string | null;
  statusCode: string;
  expandedWorkOrderCount: number | null;
  plannedWorkOrderCount: number | null;
}

export interface ProductionOrderListResponse {
  items: ProductionOrderFact[];
  page: PageMeta;
}

export interface SelectOption {
  value: string;
  label: string;
}
