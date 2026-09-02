/**
 * 종합 판정 코드 → **LOT 상태가 어느 쪽으로 가는가.**
 *
 * ⭐ **아는 코드에만 방향이 있다.** 판정 확정이 Lot Status 를 전이시키는데(결정 10 · 공유계약
 * B-8) 독립 전이 경로가 없으므로, 화면이 「무엇이 일어나는가」를 미리 말해야 한다. 그런데
 * **모르는 코드에 방향을 지어내면** 사용자가 그 문장을 근거로 **되돌릴 수 없는 쓰기**를 누른다 —
 * 그래서 모르는 코드는 방향 없이 「상태가 바뀝니다」만 남긴다.
 *
 * ⚠ **값 목록을 화면에 고정하는 것이 아니다.** 선택지는 공통코드가 채우고 여기 없는 코드도
 * 고를 수 있다 — 이 표는 「방향 문장을 덧붙여도 되는 코드」의 목록이지 「고를 수 있는 코드」의
 * 목록이 아니다. 둘을 같은 것으로 읽으면 코드가 늘 때 선택칸이 조용히 좁아진다.
 *
 * 「틀려도 조용한 것」이라 단위 시험을 붙인다 — 방향을 잘못 그려도 화면은 멀쩡히 돈다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */
export type JudgmentDirection = 'release' | 'hold' | 'pending' | 'unknown';

/**
 * 계약이 적어 둔 3값의 방향. 합격이면 풀리고, 불합격이면 묶이고, 보류면 검사 대기다.
 *
 * ⛔ 이 표를 선택지의 근거로 쓰지 않는다 — 위 단락 참조.
 */
const DIRECTION_OF: Record<string, JudgmentDirection> = {
  ACCEPTED: 'release',
  REJECTED: 'hold',
  HELD: 'pending',
};

export const toJudgmentDirection = (overallJudgmentCode: string): JudgmentDirection =>
  DIRECTION_OF[overallJudgmentCode] ?? 'unknown';
