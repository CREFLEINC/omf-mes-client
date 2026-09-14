import type { WorkOrder } from './types';

/**
 * 작업지시 유형 코드 — **긴급 표식 하나**를 가르는 이 슬라이스의 한 곳(#1147).
 *
 * ⭐ 긴급 W/O 현장 화면(`P-02-12`)이 이 화면으로 넘기면서 **긴급 플래그를 유지**한다(`P-02-12`
 * §5-1). 주소에는 긴급 여부를 싣지 않으므로 이미 받는 작업지시의 유형으로 가른다.
 *
 * ⛔ **다른 화면 슬라이스의 상수를 참조하지 않는다.** 슬라이스는 서로 import 하지 않고 사본을
 * 소유한다 — 작업 시작·자재 투입·긴급 현장 화면이 같은 값을 따로 갖는다.
 */
export const EMERGENCY_WORK_ORDER_TYPE_CODE = 'EMERGENCY';

/** 긴급 W/O 인가. 표시에만 쓴다 — 실적 저장은 유형과 상관없이 같은 경로다. */
export const isEmergency = (workOrder: WorkOrder): boolean =>
  (workOrder.workOrderTypeCode ?? '').trim() === EMERGENCY_WORK_ORDER_TYPE_CODE;
