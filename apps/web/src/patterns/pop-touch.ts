/**
 * POP 조작의 업무 중요도 등급.
 *
 * 2026-09-08 E-3 개정 뒤에는 등급이 컨트롤 크기를 바꾸지 않는다. 관리웹 기본 밀도를 쓰되,
 * 위험도에 따른 색·문구·배치 격리를 화면 코드에서 추적하기 위해 의미 이름은 유지한다.
 */

/**
 * 무엇을 누르는가로 등급이 갈린다. 「얼마나 큰가」가 아니라 「틀렸을 때 무엇이 일어나는가」다.
 *
 * - `normal` 목록 행·보조 조작 — 되돌리기 쉽다
 * - `primary` 화면의 주 조작 — 흐름을 진행시킨다
 * - `critical` 기록을 남기는 조작 — 되돌리려면 다른 조작이 필요하다
 * - `destructive` 되돌릴 수 없는 조작
 */
export type PopTouchGrade = 'normal' | 'primary' | 'critical' | 'destructive';

/**
 * 등급에 해당하는 클래스 이름. 화면은 이 함수만 쓰고 클래스 이름을 직접 적지 않는다.
 */
export const popTouchClass = (grade: PopTouchGrade): string => `pop-touch pop-touch-${grade}`;
