/**
 * 이 화면이 쓰는 코드 값이 사는 **한 곳**.
 *
 * ⛔ **화면 로직에 흩어 박지 않는다.** 판정 네 값과 통제 세 값은 계약 `enum` 으로 닫혀 있고,
 * 우회 사유와 점검 유형은 **고객이 늘리는 값**이라 성격이 다르다 — 아래 주석이 그 차이를
 * 함께 적는다.
 *
 * ⛔ **다른 화면 슬라이스의 상수를 참조하지 않는다.** 슬라이스는 사본을 소유한다.
 */

/** 통제 수준 — 계약 `enum` 으로 닫혀 있다. */
export type ControlLevelCode = 'BLOCK' | 'WARN' | 'OFF';

/** 판정 결과 — 계약 `enum` 으로 닫혀 있다. 넷 다 기록한다(스펙 §5-8 · §9-3). */
export type DecisionCode = 'PASSED' | 'BLOCKED' | 'WARNED' | 'OVERRIDDEN';

/** 점검 종합 판정 — 계약 `enum`. */
export type OverallResultCode = 'PASS' | 'FAIL';

/** 통제 수준을 담고 있는 운영 정책의 코드. */
export const PRECHECK_POLICY_CODE = 'PRECHECK_CONTROL_LEVEL';

/**
 * ⭐ **적용 정책이 없으면 `WARN` 으로 다룬다.**
 *
 * 화면이 기본값을 지어내는 것이 아니라 **계약이 그렇게 정했다**(`PrecheckDecisionCreate`
 * 설명 · 스펙 §6). ⛔ 못 읽었다고 무통제로 열지 않는다 — 그 방향이 위험한 쪽이다(F-6).
 */
export const UNRESOLVED_CONTROL_LEVEL: ControlLevelCode = 'WARN';

/**
 * 우회 사유 — ⛔ **자유 텍스트가 아니라 코드다**(스펙 §5-8). 긴급 W/O 인 것 자체가 사유이고,
 * 더 물으면 형식적으로 채운다.
 *
 * ⚠ 값 목록은 `CONTROL_OVERRIDE_REASON` 코드 그룹이 갖고 고객이 늘린다 — 여기 적은 것은
 * **이 화면이 «보내는» 한 값**이지 목록이 아니다.
 */
export const OVERRIDE_REASON_CODE = 'EMERGENCY_WORK_ORDER';

/**
 * 긴급 작업지시인가를 가르는 유형 코드.
 *
 * ⛔ **우회를 아무 지시에나 열지 않는다**(스펙 §5-8). 서버도 유형으로 판정해 거부하지만,
 * 화면이 먼저 좁혀 «누를 수 있는데 거부되는» 버튼을 두지 않는다.
 */
export const EMERGENCY_WORK_ORDER_TYPE_CODE = 'EMERGENCY';

/**
 * 점검 유형의 **표시 이름이 사는 코드 그룹**.
 *
 * ⛔ **코드 문자열을 화면에 그대로 내지 않는다** — 스펙 §4 도면은 「일상(Daily)」·「정기(Monthly)」로
 * 적었고, 계약은 값 목록을 코드 사전에서 받으라고 못박았다(공유계약 G-32). ⭐ **고객이 값을
 * 늘린다** — 화면에 대응표를 박으면 늘어난 값이 코드로 노출된다.
 *
 * ⚠ 채번 식별자(`codeGroupId`)를 하드코딩하지 않는다 — 환경마다 다르다.
 */
export const INSPECTION_TYPE_CODE_GROUP = 'EQUIPMENT_INSPECTION_TYPE';

/**
 * 통제 수준이 «어느 축»으로 정해졌는가 — 계약 `matchedScopeCode`.
 *
 * 스펙 §4 도면이 통제 수준 옆에 적용 범위를 함께 보인다. ⚠ 도면은 공장·공정의 «이름»까지
 * 적었으나 계약이 내려주는 것은 축뿐이고, 이름을 얻으려면 왕복이 둘 더 든다 — 축만 보인다.
 */
export type MatchedScopeCode = 'ITEM' | 'PROCESS' | 'PLANT' | 'BUSINESS_UNIT' | 'ALL';
