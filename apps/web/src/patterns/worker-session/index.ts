/**
 * 현재 작업자 — 「지금 이 단말에서 하는 일은 누구 것으로 기록되는가」.
 *
 * 여기 있는 것은 **특정 화면을 알지 않는다**(전례 `patterns/session`) — 지정하는 곳은
 * `P-CO-01` 하나지만 읽을 곳은 그 화면 밖이다(셸의 `pop-identity` · POP 쓰기 화면).
 *
 * ⚠ **아직 읽는 곳은 없다** — 그 화면들은 지금 각자 다른 출처를 쓴다. 자세한 사정은
 * `worker-session.ts` 머리에 있다.
 */
export { setWorkerSession, useWorkerSession, type WorkerSession } from './worker-session';
