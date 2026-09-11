/**
 * 이 화면의 시각 표기 — **한 화면 안에서 한 꼴로만 적는다**(#1043).
 *
 * 서버는 표준시(UTC) 문자열을 그대로 내린다(`2026-09-10T09:12:00.000Z`). 발행 이력이 그것을
 * 손대지 않고 찍어, 같은 화면의 발행 대기 칸(`08-07 14:20`)과 두 표기가 섞였고 **현지 시각과
 * 아홉 시간 어긋나 보였다.**
 *
 * ⛔ **화면마다 새 변환을 만들지 않는다.** 이 화면이 쓰는 꼴은 여기 하나뿐이다.
 *
 * ⛔ **읽을 수 없는 값을 지어내지 않는다** — 모르면 모른다고 둔다.
 */

/** 해는 적지 않는다 — 이 화면이 보는 것은 오늘·어제 일어난 재구성이다(설계 §3 ① 도면). */
export const localDateTimeText = (value: string | null, unknown: string): string => {
  if (value === null) return unknown;

  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return unknown;

  const pad = (part: number): string => String(part).padStart(2, '0');

  return `${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
};
