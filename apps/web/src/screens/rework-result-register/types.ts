import type { components, paths } from '@omf-mes/api-client';

export type WorkOrder = components['schemas']['WorkOrder'];
export type Nonconformance = components['schemas']['Nonconformance'];
export type ProductionResultCreate = components['schemas']['ProductionResultCreate'];
export type ProductionResult = components['schemas']['ProductionResult'];
export type WorkOrderList =
  paths['/production/work-orders']['get']['responses']['200']['content']['application/json'];
export type DispositionList =
  paths['/quality/nonconformances/{nonconformanceId}/disposition-decisions']['get']['responses']['200']['content']['application/json'];
