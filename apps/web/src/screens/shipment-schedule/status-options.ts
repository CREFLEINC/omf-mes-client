import type { ShipmentProgressCode } from './types';

/**
 * 출하 진행 필터의 선택지. 2차 고정 계약의 닫힌 6개 값과 순서를 그대로 쓴다.
 * 화면이 라인 수량으로 상태를 재계산하거나 조회 결과에서 목록을 유추하지 않는다.
 */

export const SHIPMENT_PROGRESS_CODES: readonly ShipmentProgressCode[] = [
  'NOT_ALLOCATED',
  'PARTIALLY_ALLOCATED',
  'PICKING',
  'PICKED',
  'PARTIALLY_SHIPPED',
  'SHIPPED',
];
