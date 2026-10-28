import type {
  ProductionOrderAutoPlan,
  WorklistReasonEntry,
  WorklistState,
} from '@omf-mes/api-client';

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
  remarks: string | null;
  expandedWorkOrderCount: number | null;
  plannedWorkOrderCount: number | null;
  autoPlan: ProductionOrderAutoPlan | null;
  /** 서버가 정한 작업지시 목록 칩 판정. 싣지 않는 서버면 null. */
  worklistState: WorklistState | null;
  /** 조치 필요인데 자동 계획은 끝난 까닭. 그 밖에는 빈 목록. */
  worklistReasons: WorklistReasonEntry[];
}

export interface ProductionOrderListResponse {
  items: ProductionOrderFact[];
  page: PageMeta;
}

export interface SelectOption {
  value: string;
  label: string;
}
