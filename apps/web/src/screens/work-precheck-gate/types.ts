import type { components, paths } from '@omf-mes/api-client';

/**
 * 이 화면이 다루는 계약 타입. 손으로 옮겨 적지 않고 **계약에서 파생한다** — 계약이 바뀌면
 * 컴파일이 잡아 준다.
 */
export type OperationPolicyEffective = components['schemas']['OperationPolicyEffective'];

export type EquipmentInspectionItemAssignmentsResponse =
  components['schemas']['EquipmentInspectionItemAssignmentsResponse'];
export type InspectionItemAssignment = components['schemas']['InspectionItemAssignment'];

export type InspectionListResponse =
  paths['/maintenance/inspections']['get']['responses']['200']['content']['application/json'];
export type Inspection = components['schemas']['Inspection'];

export type BreakdownListResponse =
  paths['/maintenance/breakdowns']['get']['responses']['200']['content']['application/json'];

export type PrecheckDecision = components['schemas']['PrecheckDecision'];
export type PrecheckDecisionCreate = components['schemas']['PrecheckDecisionCreate'];

export type WorkSessionCreate = components['schemas']['WorkSessionCreate'];
export type ControlOverride = components['schemas']['ControlOverride'];
