import { formatPlantDateTime } from '../../patterns/plant-time';

/**
 * 「마지막 갱신」 시각 표기(사용자 지시 2026-10-16) — **조회가 성공한 시각**(TanStack `dataUpdatedAt`)을
 * 공장 시각으로 보인다. 표기는 늘 `yyyy-MM-dd HH:mm`(⭐ 관리웹 날짜 표기 통일 · 사용자 지시 2026-10-19 — 오늘
 * 것도 날짜를 뺀 `HH:mm`으로 줄이지 않는다).
 *
 * 갱신이 실패하면 `dataUpdatedAt`은 바뀌지 않으므로 마지막 성공 시각이 그대로 남는다.
 * 한 번도 성공하지 않았으면(`0`) `null` — 시각을 지어내지 않는다.
 */
export const formatLastUpdated = (updatedAt: number): string | null => {
  if (updatedAt <= 0) return null;

  return formatPlantDateTime(new Date(updatedAt).toISOString());
};
