/**
 * 작업장 콘솔 — POP 화면의 공통 골격(상단 바·길잡이 · 부서 레일 · 현재작업 패널 · 단계 · 액션바 ·
 * 타일 판 · 피드백).
 *
 * 셸(`app/pop-main`)은 `PopConsoleShell`·`popShellLayoutOf` 를, 홈·부서 화면은 타일 판
 * (`boardOf`·`PopAreaGroups`·`PopAreaCard`·`PopScreenTile`)과 `usePopRecent`·`usePopShellActions`·
 * `usePopTerminalFacts` 를, 업무 화면은 `usePopFeedback` 을, 작업자 확인 창은 `clearTrail` 을 쓴다.
 */
export { POP_FLOW_PATHS, popShellLayoutOf, type PopShellLayout } from './console-routes';
export { PopConsoleShell } from './console-shell';
export { usePopFeedback, type FeedbackTone, type PopFeedback } from './feedback';
export { clearTrail, usePopRecent, usePopTrail } from './nav-trail';
export {
  boardOf,
  FLOW_ENTRY_PATH,
  PopAreaCard,
  PopAreaGroups,
  PopScreenTile,
  screenCountOf,
  type PopAreaBoard,
} from './screen-board';
export { usePopShellActions } from './shell-actions';
export { usePopTerminalFacts } from './terminal-dialog';
