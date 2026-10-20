/**
 * 작업장 콘솔 — POP 화면의 공통 골격(상태바 · 현재작업 패널 · 단계 · 액션바 · 작업 메뉴 · 피드백).
 *
 * 셸(`app/pop-main`)은 `PopConsoleShell` 과 `isPopConsolePath` 를, 화면은 `usePopFeedback` 를 쓴다.
 */
export { isPopConsolePath, POP_CONSOLE_PATHS } from './console-routes';
export { PopConsoleShell } from './console-shell';
export { usePopFeedback, type FeedbackTone, type PopFeedback } from './feedback';
