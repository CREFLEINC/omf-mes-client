/**
 * 이 화면이 **보내는** 사건 유형.
 *
 * 계약 `POST /production/work-sessions/{workSessionId}/events` 설명이 못박았다 — **단말이
 * 적재하는 것은 구간 «안의» 사건인 `STOP`·`RESUME` 뿐이다.** 구간의 경계(`START`·`END`)와
 * 통제 우회는 세션을 열고 닫는 오퍼레이션이 같은 트랜잭션으로 만들며 단말이 따로 보내지 않는다.
 *
 * ⛔ **`:hold`·`:resume` 경로를 부르지 않는다** — 계약에 없다. 착수 이슈 코멘트가 그 이름을
 * 적었으나 계약·화면 스펙 §5-4 가 함께 이 경로 하나를 가리킨다.
 *
 * ⚠ **유형의 «표시 목록»이 필요할 때는 `GET /mdm/code-values` 로 받는다**(공유계약 G-32).
 * 여기 있는 둘은 목록이 아니라 **이 화면이 고정으로 보내는 값**이라 상수로 둔다.
 */
export const EVENT_TYPE_STOP = 'STOP';
export const EVENT_TYPE_RESUME = 'RESUME';
