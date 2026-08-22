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
}

export interface PageMeta {
  page: number;
  size: number;
  total: number;
}

export interface SelectOption {
  value: string;
  label: string;
}
