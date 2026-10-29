import type { LocationLevelCode } from '../../patterns/location-level';
import { isSystemLocation } from '../../patterns/system-location';
import type { Location } from './types';

/**
 * 위치 코드 발행(사용자 지시 2026-10-29) — 위치 코드는 MES 가 발행하는 유일한 식별자라 사람이 치지 않는다.
 *
 * 구역 `Z01`, 랙 `{구역}-R001`, 층 `{랙}-L01`, 셀 `{층}-C01`. 번호는 그 상위의 하위 수 + 1 부터 올라가며
 * 창고 안에서 아직 쓰지 않은 첫 번호를 붙인다(코드는 창고 안에서 유일 — `uq_location`). 랙만 세 자리다 — 한 구역에
 * 랙이 백 개를 넘을 수 있다. 층(20 이하) · 셀(50 이하)은 두 자리로 넉넉하다.
 *
 * ⚠ 서버가 코드를 발행하기 전까지 화면이 대신 짓는다. 서버가 발행하면 이 파일을 걷는다.
 */

const LEVEL_PREFIX: Record<LocationLevelCode, string> = {
  ZONE: 'Z',
  RACK: 'R',
  LEVEL: 'L',
  CELL: 'C',
};

/** 번호 자리 수 — 랙만 세 자리. */
const LEVEL_DIGITS: Record<LocationLevelCode, number> = {
  ZONE: 2,
  RACK: 3,
  LEVEL: 2,
  CELL: 2,
};

/**
 * 코드 순서 — 숫자를 수로 읽는다. 랙 `R100` 이 `R99` 뒤에, 자리 수가 섞인 옛 코드도 차례대로 놓인다.
 * 로캘을 `en` 으로 묶어 실행 환경마다 순서가 달라지지 않게 한다.
 */
export const compareLocationCodes = (a: string, b: string): number =>
  a.localeCompare(b, 'en', { numeric: true });

/** `n` 번째 코드 — 구역은 창고 바로 밑이라 상위 코드를 붙이지 않는다. */
const codeOf = (level: LocationLevelCode, parentCode: string | null, n: number): string => {
  const own = `${LEVEL_PREFIX[level]}${String(n).padStart(LEVEL_DIGITS[level], '0')}`;
  return level === 'ZONE' || parentCode === null ? own : `${parentCode}-${own}`;
};

/** 쓰지 않은 코드 — `start` 번부터 올라가며 찾는다. 찾은 것은 `used` 에 넣어 같은 계획에서 겹치지 않게 한다. */
export const nextFreeLocationCode = (
  level: LocationLevelCode,
  parentCode: string | null,
  start: number,
  used: Set<string>,
): string => {
  let n = Math.max(1, start);
  while (used.has(codeOf(level, parentCode, n))) n += 1;
  const code = codeOf(level, parentCode, n);
  used.add(code);
  return code;
};

/**
 * 새 위치 하나의 코드. `parent` 가 null 이면 창고 바로 밑의 구역이다.
 * 구역의 번호는 서버가 만든 위치(창고 전체 · 적치 대기)를 세지 않는다 — 첫 구역이 `Z01` 이 되게.
 */
export const issueLocationCode = (
  level: LocationLevelCode,
  parent: Location | null,
  items: readonly Location[],
): string => {
  const parentId = parent?.locationId ?? null;
  const siblings = items.filter(
    (item) =>
      (item.parentLocationId ?? null) === parentId &&
      item.locationId !== parentId &&
      !isSystemLocation(item),
  );
  const used = new Set(items.map((item) => item.locationCode));
  return nextFreeLocationCode(level, parent?.locationCode ?? null, siblings.length + 1, used);
};
