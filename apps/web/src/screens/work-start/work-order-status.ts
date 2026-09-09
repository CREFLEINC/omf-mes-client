import type { WorkOrder } from './types';

/**
 * 작업지시 상태 코드 문자열이 사는 **유일한 자리**.
 *
 * ⛔ **상태 문자열을 화면 로직에 흩어 박지 않는다**(통지 #556). 이 화면은 「배포됐으니 시작」과
 * 「중단 중이니 재개」를 갈라야 하고, 그 근거인 코드 문자열이 **확정됐다** — 계약이 8종을
 * 닫았고(`PLANNED`·`CONFIRMED`·`RELEASED`·`IN_PROGRESS`·`COMPLETED`·`CLOSED`·`SUSPENDED`·
 * `CANCELLED`) 그중 「중단」이 `SUSPENDED` 다(설계 변동 공지 `CREFLEINC/omf-mes#507`).
 *
 * ⭐ **그래도 값은 여기 한 곳에만 둔다.** 화면·목록·버튼은 이 파일의 판정만 부른다 — 값이
 * 또 바뀌면 고칠 자리가 배열 하나로 남는다.
 *
 * ⚠ **목록 조회는 이 값에 기대지 않는다** — `open=true` 가 「배포됐고 아직 완료·마감·취소되지
 * 않음」을 서버에서 판정한다(시각 필드로 가른다). 상태 문자열이 필요한 곳은 **줄마다의 표시**
 * 뿐이다: ⏸ 배지와 [재개] 버튼.
 */

/**
 * 「지금 중단 중」을 뜻하는 상태 코드들.
 *
 * ⛔ **여기에 추측한 값을 넣지 않는다.** 넣으면 아무 지시나 중단으로 그려지고, 작업자가
 * 시작해야 할 지시에서 [재개] 를 누른다. 계약이 닫은 8종 중 「중단」의 문자열만 담는다 —
 * 「진행불가」는 상태가 아니고(확정 게이트), 「재시작」도 상태가 아니라 전이 사건이다.
 */
export const HELD_STATUS_CODES: readonly string[] = ['SUSPENDED'];

/** 상태 코드 문자열을 하나라도 아는가. 화면이 「모른다」를 말할 근거다. */
export const isStatusVocabularyKnown = (): boolean => HELD_STATUS_CODES.length > 0;

/**
 * 이 작업지시가 지금 중단 중인가.
 *
 * ⛔ **모르면 거짓이다.** 「중단인지 모른다」를 「중단이다」로 다루면 시작해야 할 지시에
 * [재개] 가 뜨고, 화면이 없는 세션을 찾다가 멈춘다. 반대로 흘려보내면 이 화면이 하는 일은
 * 「시작」뿐이고, 서버가 중단 중인 지시의 새 세션을 거절한다 — 잘못 판정한 쪽이 조용히
 * 진행되지 않는다.
 */
export const isHeld = (workOrder: WorkOrder): boolean => {
  const code = (workOrder.statusCode ?? '').trim();

  return code !== '' && HELD_STATUS_CODES.includes(code);
};
