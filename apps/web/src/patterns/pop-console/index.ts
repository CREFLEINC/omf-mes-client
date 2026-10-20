/**
 * 작업장 콘솔 — POP 화면의 공통 골격(상태바·길잡이 · 현재작업 패널 · 단계 · 액션바 · 작업 메뉴 · 피드백).
 *
 * 셸(`app/pop-main`)은 `PopConsoleShell`·`popShellLayoutOf` 를, 홈 화면은 `PopTaskBoard`·
 * `usePopRecent`·`usePopShellActions` 를, 업무 화면은 `usePopFeedback` 을, 작업자 확인 창은
 * `clearTrail` 을 쓴다.
 */
export { POP_FLOW_PATHS, popShellLayoutOf, type PopShellLayout } from './console-routes';
export { PopConsoleShell } from './console-shell';
export { usePopFeedback, type FeedbackTone, type PopFeedback } from './feedback';
export { clearTrail, usePopRecent, usePopTrail } from './nav-trail';
export { usePopShellActions } from './shell-actions';
export { boardOf, PopTaskBoard } from './task-board';
