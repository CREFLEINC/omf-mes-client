/**
 * 작업장 콘솔 — POP 화면의 공통 골격(상태바·길잡이 · 현재작업 패널 · 단계 · 액션바 · 작업 메뉴 · 피드백).
 *
 * 셸(`app/pop-main`)은 `PopConsoleShell`·`popShellLayoutOf`·`clearTrail` 을, 홈 화면은
 * `PopScreenTiles`·`usePopRecent` 를, 업무 화면은 `usePopFeedback` 을 쓴다.
 */
export { POP_FLOW_PATHS, popShellLayoutOf, type PopShellLayout } from './console-routes';
export { PopConsoleShell } from './console-shell';
export { usePopFeedback, type FeedbackTone, type PopFeedback } from './feedback';
export { clearTrail, usePopRecent, usePopTrail } from './nav-trail';
export { groupByArea, PopScreenTiles } from './screen-tiles';
