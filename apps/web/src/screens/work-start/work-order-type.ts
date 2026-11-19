import type { WorkOrder } from './types';

/**
 * 작업지시 유형 코드가 사는 **이 슬라이스의 한 곳**.
 *
 * ⛔ **화면 로직에 흩어 박지 않는다**(계약 `WorkOrder.workOrderTypeCode` 설명). 이 화면이 이
 * 값으로 하는 일은 **⚡ 긴급 배지 · 긴급을 위로 · 「긴급」 보기**다 — 우회 «판정»은 작업 전 점검 통제 화면이 하고,
 * 여기는 표시만 한다(스펙 §5-3).
 *
 * ⛔ **다른 화면 슬라이스의 상수를 참조하지 않는다.** 슬라이스는 서로 import 하지 않고 사본을
 * 소유한다 — 긴급 현장 투입 화면(`emergency-work-order-field`)이 같은 값을 따로 갖는다.
 *
 * ⭐ 「긴급」 보기(#295)의 조회 조건(`workOrderTypeCode`)도 이 값을 쓴다 — 옛 긴급 현장 투입 화면을 이
 * 목록에 합쳤다.
 */
export const EMERGENCY_WORK_ORDER_TYPE_CODE = 'EMERGENCY';

/** 긴급 W/O 인가 — 배지 하나를 가르는 판정이다. */
export const isEmergency = (workOrder: WorkOrder): boolean =>
  (workOrder.workOrderTypeCode ?? '').trim() === EMERGENCY_WORK_ORDER_TYPE_CODE;

/**
 * 재작업 W/O 의 유형 코드. 이 목록이 하는 일은 「재작업」 표식과 [재작업 실적 등록] 길 하나다(#295) — 실적은
 * 재작업 실적 등록 화면(P-04-03)이 받는다. 그 화면이 같은 값을 따로 갖는다(`rework-result-register/result.ts`).
 */
export const REWORK_WORK_ORDER_TYPE_CODE = 'REWORK';

/** 재작업 W/O 인가. */
export const isRework = (workOrder: WorkOrder): boolean =>
  (workOrder.workOrderTypeCode ?? '').trim() === REWORK_WORK_ORDER_TYPE_CODE;

/**
 * 긴급 W/O 를 맨 위로 올린다(#295 — 옛 「긴급 작업지시」 화면을 이 목록에 합쳤다). 순서만 바꾼다 —
 * 긴급끼리, 나머지끼리는 들어온 순서를 지킨다.
 *
 * ⭐ **정렬의 마지막 단계로 둔다.** 목록 순서(지금은 진행 중 먼저 · 앞으로 최신순/오래된순 전환이 올 수
 *    있다)를 먼저 정하고 이 함수를 맨 끝에 건다 — 순서를 바꿔도 긴급은 늘 위다.
 * ⚠ 받은 쪽 안에서만 올린다(서버가 유형으로 정렬하지 않는다). 다른 쪽의 긴급은 「긴급」 보기가 모두 보인다.
 */
export const pinEmergencyFirst = (rows: readonly WorkOrder[]): WorkOrder[] => [
  ...rows.filter(isEmergency),
  ...rows.filter((row) => !isEmergency(row)),
];
