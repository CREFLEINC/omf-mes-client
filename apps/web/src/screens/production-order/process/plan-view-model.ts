/** 공장 날짜는 날짜 문자열로 다루고 브라우저 시간대를 섞지 않는다. */
export const shiftPlanDate = (date: string, days: number): string => {
  const value = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(value.getTime())) return '';
  if (value.toISOString().slice(0, 10) !== date) return '';
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

export const planWeek = (date: string): string[] => {
  const valid = shiftPlanDate(date, 0);
  if (valid === '') return [];
  const day = new Date(`${valid}T00:00:00Z`).getUTCDay();
  const monday = shiftPlanDate(valid, -((day + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => shiftPlanDate(monday, index));
};
