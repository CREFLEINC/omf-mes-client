import { toPlantDateTimeParts } from '../../patterns/plant-time';

/**
 * 「마지막 갱신」 시각 표기(사용자 지시 2026-10-16) — **조회가 성공한 시각**(TanStack `dataUpdatedAt`)을
 * 공장 시각으로 보인다. 오늘(공장 시각 기준) 것이면 `HH:mm`, 다른 날이면 `YYYY-MM-DD HH:mm`.
 *
 * 갱신이 실패하면 `dataUpdatedAt`은 바뀌지 않으므로 마지막 성공 시각이 그대로 남는다.
 * 한 번도 성공하지 않았으면(`0`) `null` — 시각을 지어내지 않는다.
 */
export const formatLastUpdated = (updatedAt: number, now: number): string | null => {
  if (updatedAt <= 0) return null;

  const updated = toPlantDateTimeParts(new Date(updatedAt).toISOString());
  if (updated === null) return null;
  const today = toPlantDateTimeParts(new Date(now).toISOString());

  return today !== null && today.date === updated.date
    ? updated.time
    : `${updated.date} ${updated.time}`;
};
