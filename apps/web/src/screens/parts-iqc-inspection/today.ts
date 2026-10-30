import { PLANT_UTC_OFFSET, plantToday } from '../../patterns/plant-time';
/**
 * 공장 하루 `[오늘 00:00, 내일 00:00)` — 공장 시간대로 셈해 오프셋을 붙여 보낸다(서버 장부 P-156).
 * 서버가 UTC 날짜로 자르면 베트남 공장 아침 7시 전 입고가 전날로 빠진다.
 */
export const plantTodayRange = (now: Date = new Date()) => {
  const from = `${plantToday(now)}T00:00:00${PLANT_UTC_OFFSET}`;
  return {
    requestedAtFrom: from,
    requestedAtTo: new Date(new Date(from).getTime() + 86_400_000).toISOString(),
  };
};
