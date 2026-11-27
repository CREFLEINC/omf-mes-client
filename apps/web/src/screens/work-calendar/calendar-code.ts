/*
 * 등록 창의 캘린더 코드 자동 채움(사용자 지시 2026-11-27 · omf-all-around#360).
 * 서버는 코드를 매기지 않는다(계약 필수 · 생략 불가) — 화면이 아는 공장과 해로 `CAL-공장코드-연도` 를 만든다.
 * 계약 예시(`CAL-HCM-2026`)와 같은 모양이다. 같은 코드가 이미 있으면 `-02`, `-03` … 을 붙인다.
 */

/** 공장을 모르면 해만 쓴다. */
export const calendarCodeBase = (plantCode: string | null, year: number): string =>
  plantCode === null ? `CAL-${String(year)}` : `CAL-${plantCode}-${String(year)}`;

/** `codes` 는 이미 있는 코드(사용 중지 포함). 바탕 코드 자체를 1번으로 센다. */
export const nextCalendarCode = (base: string, codes: readonly string[]): string => {
  const pattern = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:-(\\d+))?$`);
  const numbers = codes
    .map((code) => pattern.exec(code))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => (match[1] === undefined ? 1 : Number(match[1])));

  if (numbers.length === 0) return base;

  return `${base}-${String(Math.max(...numbers) + 1).padStart(2, '0')}`;
};
