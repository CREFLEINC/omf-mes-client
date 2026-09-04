import type { components, paths } from '@omf-mes/api-client';

/**
 * 이 화면이 다루는 계약 타입. 손으로 옮겨 적지 않고 **계약에서 파생한다** — 계약이 바뀌면
 * 컴파일이 잡아 준다.
 */
export type WorkOrder = components['schemas']['WorkOrder'];
export type WorkOrderListResponse =
  paths['/production/work-orders']['get']['responses']['200']['content']['application/json'];

export type WorkSession = components['schemas']['WorkSession'];
export type WorkSessionCreate = components['schemas']['WorkSessionCreate'];
export type WorkSessionEventCreate = components['schemas']['WorkSessionEventCreate'];
/** 작업 전 점검 통제를 우회하고 시작할 때 세션 본문에 함께 싣는 값(`P-02-02` §5-8). */
export type ControlOverride = components['schemas']['ControlOverride'];

export type Terminal = components['schemas']['Terminal'];
export type Worker = components['schemas']['Worker'];
