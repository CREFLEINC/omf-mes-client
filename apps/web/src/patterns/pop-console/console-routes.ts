/**
 * 작업장 콘솔이 화면을 어떤 모양으로 감싸는가.
 *
 * - `flow` **생산 흐름 화면** — 상태바 + 현재작업 패널 + 단계 표시줄 + 액션바(이상 보고 · 다음).
 *   작업지시 하나를 붙들고 시작 → 투입 → 실적으로 가는 화면들이다.
 * - `task` **그 밖의 화면**(홈 포함) — 상태바 + 본문. 구매·자재·품질·출하·설비 화면은 작업지시
 *   흐름이 없어 현재작업 패널·단계가 뜻이 없다. 대신 상태바의 [홈]·[이전]·위치가 같은 자리에 선다.
 *
 * ⭐ **모든 화면이 같은 상태바를 갖는다.** 부서마다 쓰는 화면이 달라도 「홈으로 · 이전으로 ·
 *    지금 어디인가 · 누구로 기록하는가」는 늘 같은 자리에 있다 — 화면을 옮기다 돌아갈 길을 잃는
 *    일이 없게 한다. 사번 입력도 페이지가 아니라 상태바의 [작업자]가 여는 창이다.
 *
 * ⚠ **생산 작업(`P-02-04`)은 아직 `task` 다.** 1,545줄 화면이 1024×768 예산으로 서 있어, 패널·단계가
 *   본문 세로를 줄이면 구획마다 스크롤한다. 화면을 쪼갠 뒤 `flow` 로 옮긴다.
 */
export type PopShellLayout = 'flow' | 'task';

export const POP_FLOW_PATHS: ReadonlySet<string> = new Set([
  '/pop/work-start',
  '/pop/material-input',
]);

export const popShellLayoutOf = (pathname: string): PopShellLayout =>
  POP_FLOW_PATHS.has(pathname) ? 'flow' : 'task';
