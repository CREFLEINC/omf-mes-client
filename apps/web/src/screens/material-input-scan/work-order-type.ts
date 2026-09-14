/**
 * 작업지시 유형 코드 — **긴급 표식 하나**를 가르는 이 슬라이스의 한 곳(#1147).
 *
 * ⭐ 긴급 W/O 현장 화면(`P-02-12`)이 이 화면으로 넘기면서 **긴급 플래그를 유지**한다(`P-02-12`
 * §5-1). 주소에는 긴급 여부를 싣지 않으므로 이 화면이 작업지시를 물어 유형으로 가른다.
 *
 * ⛔ **다른 화면 슬라이스의 상수를 참조하지 않는다.** 슬라이스는 서로 import 하지 않고 사본을
 * 소유한다 — 작업 시작·긴급 현장 화면이 같은 값을 따로 갖는다.
 */
export const EMERGENCY_WORK_ORDER_TYPE_CODE = 'EMERGENCY';

/** 긴급 W/O 인가. **모르면 거짓이다** — 모르는 것을 긴급으로 그리지 않는다. */
export const isEmergencyTypeCode = (code: string | null | undefined): boolean =>
  (code ?? '').trim() === EMERGENCY_WORK_ORDER_TYPE_CODE;
