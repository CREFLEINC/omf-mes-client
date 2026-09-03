import type { WorkOrder } from './types';

/**
 * 작업지시 유형 코드가 사는 **이 슬라이스의 한 곳**.
 *
 * ⛔ **화면 로직에 흩어 박지 않는다**(계약 `WorkOrder.workOrderTypeCode` 설명). 이 화면이 이
 * 값으로 하는 일은 **⚡ 긴급 배지 하나**다 — 우회 «판정»은 작업 전 점검 통제 화면이 하고,
 * 여기는 표시만 한다(스펙 §5-3).
 *
 * ⛔ **다른 화면 슬라이스의 상수를 참조하지 않는다.** 슬라이스는 서로 import 하지 않고 사본을
 * 소유한다 — 긴급 현장 투입 화면(`emergency-work-order-field`)이 같은 값을 따로 갖는다.
 *
 * ⚠ **기본 목록에는 긴급이 뜨지 않는 것이 정상이다**(§6) — 축이 계획 설비인데 긴급은 무배정
 * 으로 배포된다. 「전체 보기」에서만 보이고, 그 진입은 긴급 현장 투입 화면이 갖는다.
 */
export const EMERGENCY_WORK_ORDER_TYPE_CODE = 'EMERGENCY';

/** 긴급 W/O 인가 — 배지 하나를 가르는 판정이다. */
export const isEmergency = (workOrder: WorkOrder): boolean =>
  (workOrder.workOrderTypeCode ?? '').trim() === EMERGENCY_WORK_ORDER_TYPE_CODE;
