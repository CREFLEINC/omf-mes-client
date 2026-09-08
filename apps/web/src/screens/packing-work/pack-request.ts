import { toContentUpserts } from './contents';
import type { HandlingUnitPack, PackingLine } from './types';

/**
 * 확정 요청 본문을 짓는다. **시각 두 칸이 필수라**(계약 `HandlingUnitPack.required`) 화면이
 * 값을 갖춰야 한다.
 */

const pad = (value: number, length: number): string => String(value).padStart(length, '0');

/**
 * 실행 환경이 UTC 와 얼마나 떨어져 있는지. `+09:00` 꼴이다.
 *
 * ⛔ **offset 없는 문자열을 보내지 않는다** — 같은 글자가 지역마다 다른 순간을 가리킨다.
 */
const offsetText = (at: Date): string => {
  const minutes = -at.getTimezoneOffset();
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);

  return `${sign}${pad(Math.floor(absolute / 60), 2)}:${pad(absolute % 60, 2)}`;
};

/** 영업일 — **확정 순간의 로컬 날짜**다(공유계약 C-8). */
export const toBusinessDate = (now: Date): string =>
  `${String(now.getFullYear())}-${pad(now.getMonth() + 1, 2)}-${pad(now.getDate(), 2)}`;

/** 발생 시각 — **확정 순간**을 초와 offset 까지 갖춰 싣는다(공유계약 C-8). */
export const toOccurredAt = (now: Date): string =>
  `${toBusinessDate(now)}T${pad(now.getHours(), 2)}:${pad(now.getMinutes(), 2)}:${pad(
    now.getSeconds(),
    2,
  )}${offsetText(now)}`;

/**
 * 포장 확정 본문.
 *
 * ⛔ **위치·비고를 싣지 않는다.** 이 화면에 그 입력칸이 없다 — 계약이 둘 다 선택으로 두었고,
 * 값을 지어내면 사용자가 정하지 않은 것이 기록에 남는다. 창고·위치는 「완료 후 이동 시
 * 채워짐」이 스펙 §4-A 의 서술이다.
 */
export const toPackBody = (lines: readonly PackingLine[], now: Date): HandlingUnitPack => ({
  contents: toContentUpserts(lines),
  businessDate: toBusinessDate(now),
  occurredAt: toOccurredAt(now),
});

/**
 * 두 확정이 **같은 것을 담고 있는가.**
 *
 * ⭐ 적용 여부를 모르는 온라인 시도를 큐가 이어받아도 되는지 가르는 자리다. 담은 것이
 * 달라졌으면 그 키는 **다른 쓰기의 키**이므로 이어받으면 안 된다 — 서버가 앞 쓰기의 중복으로
 * 보고 흡수해, 나중에 담은 줄이 조용히 사라진다(공유계약 C-1 #6).
 *
 * ⚠ 시각 두 칸은 보지 않는다 — 담은 것이 같아도 누를 때마다 달라지는 값이다.
 */
export const sameContents = (left: HandlingUnitPack, right: HandlingUnitPack): boolean =>
  JSON.stringify(left.contents) === JSON.stringify(right.contents);
