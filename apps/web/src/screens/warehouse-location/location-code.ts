import type { LocationLevelCode } from '../../patterns/location-level';
import { isSystemLocation } from '../../patterns/system-location';
import type { Location } from './types';

/**
 * 위치 코드(사용자 지시 2026-10-29) — MES 가 발행하는 유일한 식별자라 사람이 치지 않는다. 서버가 발행한다(위치 ③a, #890).
 *
 * 구역 `Z01`, 랙 `{구역}-R001`, 층 `{랙}-L01`, 셀 `{층}-C01`. 번호는 같은 상위 안에서 가장 큰 번호 + 1 이고 꺼진 것도 센다.
 * 랙만 세 자리다 — 한 구역에 랙이 백 개를 넘을 수 있다. 자리 수를 넘으면 늘어난다(`R1000`).
 *
 * 화면은 저장 전에 보일 코드를 서버 규칙대로 미리 짓기만 한다 — 보내도 서버는 쓰지 않는다.
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
export const locationCodeAt = (
  level: LocationLevelCode,
  parentCode: string | null,
  n: number,
): string => {
  const own = `${LEVEL_PREFIX[level]}${String(n).padStart(LEVEL_DIGITS[level], '0')}`;
  return level === 'ZONE' || parentCode === null ? own : `${parentCode}-${own}`;
};

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 같은 상위 밑에서 이 단계 모양의 코드 가운데 가장 큰 번호. 없으면 0 — 모양이 다른 옛 코드는 세지 않는다. */
export const maxLocationSequence = (
  level: LocationLevelCode,
  parentCode: string | null,
  siblingCodes: readonly string[],
): number => {
  const head = level === 'ZONE' || parentCode === null ? '' : `${escapeRegExp(parentCode)}-`;
  const pattern = new RegExp(`^${head}${LEVEL_PREFIX[level]}(\\d+)$`);
  return siblingCodes.reduce((max, code) => {
    const match = pattern.exec(code);
    return match === null ? max : Math.max(max, Number(match[1]));
  }, 0);
};

/**
 * 새 위치 하나의 코드(미리 보기). `parent` 가 null 이면 창고 바로 밑의 구역이다.
 * 서버가 만든 위치(창고 전체 · 적치 대기)는 모양이 달라 세지 않는다.
 */
export const issueLocationCode = (
  level: LocationLevelCode,
  parent: Location | null,
  items: readonly Location[],
): string => {
  const parentId = parent?.locationId ?? null;
  const siblingCodes = items
    .filter(
      (item) =>
        (item.parentLocationId ?? null) === parentId &&
        item.locationId !== parentId &&
        !isSystemLocation(item),
    )
    .map((item) => item.locationCode);
  const parentCode = parent?.locationCode ?? null;
  return locationCodeAt(
    level,
    parentCode,
    maxLocationSequence(level, parentCode, siblingCodes) + 1,
  );
};
