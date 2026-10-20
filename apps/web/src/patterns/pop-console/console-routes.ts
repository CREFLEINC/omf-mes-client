/**
 * **작업장 콘솔 골격으로 옮긴 화면들.**
 *
 * ⭐ **한 번에 옮기지 않는다.** POP 화면 21개는 각자 1024×768 예산(공유계약 E-1)으로 서 있어,
 *    골격을 통째로 바꾸면 모든 화면의 세로 예산이 한꺼번에 어긋난다. 여기 적힌 화면만 콘솔
 *    골격(상태바·현재작업 패널·단계·액션바)과 1920×1080 기준(`pop-fit`)을 쓰고, 나머지는 지금
 *    모양 그대로 선다. 화면을 옮길 때 이 목록에 한 줄을 더한다.
 *
 * ⚠ 옮긴 화면의 본문은 그대로다 — 업무 로직(조회·저장·전송 대기·권한 판정)은 건드리지 않고,
 *   골격이 그 둘레를 감싼다.
 */
export const POP_CONSOLE_PATHS: ReadonlySet<string> = new Set([
  '/pop/work-start',
  '/pop/material-input',
]);

export const isPopConsolePath = (pathname: string): boolean => POP_CONSOLE_PATHS.has(pathname);
