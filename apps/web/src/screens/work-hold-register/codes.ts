/**
 * 이 화면이 **보내는** 사건 유형과 그 방향.
 *
 * ⭐ **중단·재개는 두 층 둘 다를 부른다**(스펙 §5-4 · 2026-09-06 게이트 승인).
 * ① `POST /production/work-orders/{workOrderId}:hold`(또는 `:resume`) — **W/O 층**의 상태 전환
 * ② `POST /production/work-sessions/{workSessionId}/events` — **세션 구간 안의 사건** 기록
 *
 * 계약이 두 층을 갈라 적는다 — `:hold` 설명이 「세션의 `status_code` 를 옮기는 것은 events 의
 * `STOP` 이다」로, events 설명이 「단말이 적재하는 것은 구간 «안의» 사건뿐」로 서로를 가리킨다.
 *
 * ⛔ **구간의 «경계»는 사건으로 보내지 않는다.** `START` 는 세션을 여는 오퍼레이션이,
 * `END` 는 `POST /production/work-sessions/{workSessionId}:end` 가 같은 트랜잭션으로 만든다 —
 * 단말이 `END` 사건을 따로 적재하면 같은 종료가 두 번 기록된다.
 *
 * ⚠ **`:resume` 를 부르지 않는 화면이 따로 있다** — `P-02-01`(작업 시작)의 [재개]는 events 의
 * `RESUME` 하나로 끝난다(계약 실측). 이 화면은 아니다 — 그 오퍼레이션의 근거가 `P-02-10 §5-4` 다.
 */
export const EVENT_TYPE_STOP = 'STOP';
export const EVENT_TYPE_RESUME = 'RESUME';

/**
 * 한 번의 조작이 세션을 어느 쪽으로 미는가.
 *
 * ⭐ **호출이 둘로 갈려도 방향은 하나다.** 버튼 활성 판정은 「지금 어느 쪽으로 가는 중인가」만
 * 알면 되므로, 큐에 담긴 «호출»이 아니라 이 값을 본다 — 그러지 않으면 한 쌍의 앞뒤가 서로
 * 다른 방향으로 읽힌다.
 */
export const DIRECTION_STOP = EVENT_TYPE_STOP;
export const DIRECTION_RESUME = EVENT_TYPE_RESUME;
export const DIRECTION_END = 'END';

export type HoldDirection =
  | typeof DIRECTION_STOP
  | typeof DIRECTION_RESUME
  | typeof DIRECTION_END;

/** 중단 사유 코드 그룹 — 값 목록은 서버가 갖는다(공유계약 G-32). */
export const HOLD_REASON_GROUP_CODE = 'WORK_SESSION_EVENT_REASON';
