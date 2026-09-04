import type { components, paths } from '@omf-mes/api-client';

/**
 * 이 화면이 다루는 계약 타입. 손으로 옮겨 적지 않고 **계약에서 파생한다** — 계약이 바뀌면
 * 컴파일이 잡아 준다.
 */
export type WorkOrder = components['schemas']['WorkOrder'];
export type WorkOrderListResponse =
  paths['/production/work-orders']['get']['responses']['200']['content']['application/json'];
