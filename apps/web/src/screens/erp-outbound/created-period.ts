/**
 * 송신 예정 조회의 날짜 모양 — 생성일 조건 칸은 걷었고(사용자 지시 2026-11-24), 「전체」 기간의 끝(오늘)만 만든다.
 * 기간 검증과 서버 형식(RFC3339 · 공장 시각)은 연동 현황·이력과 같은 `integration-sync/period.ts` 를 쓴다.
 */

const pad = (value: number, length: number): string => String(value).padStart(length, '0');

/** `YYYY-MM-DD` — 그 날의 날짜(브라우저 시각). */
export const formatDate = (date: Date): string =>
  `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;
