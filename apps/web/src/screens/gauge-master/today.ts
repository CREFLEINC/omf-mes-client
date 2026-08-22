/**
 * 오늘 날짜를 `YYYY-MM-DD` 로.
 *
 * ⛔ **`toISOString()` 을 쓰지 않는다.** 그것은 UTC 달력이라 한국(UTC+9)에서는 오전 9시
 * 전까지 «어제»를 돌려준다 — 검교정 만료 판정이 하루 어긋난다. 만료일이 오늘인 계측기가
 * 아침 8시에는 「1일 남음」으로 보이는 식이다. 사용자가 보는 달력은 로컬 달력이다.
 */
export const todayIso = (): string => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${now.getFullYear()}-${month}-${day}`;
};
