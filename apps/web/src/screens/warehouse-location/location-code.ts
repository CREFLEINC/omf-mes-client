import type { LocationLevelCode } from '../../patterns/location-level';
import { isSystemLocation } from '../../patterns/system-location';
import type { Location } from './types';

/**
 * 위치 코드(사용자 지시 2026-10-29) — MES 가 발행하는 유일한 식별자라 사람이 치지 않는다. 서버가 발행한다(위치 ③a, #890).
 *
 * 구역 `{창고코드}-Z01`, 랙 `{구역}-R001`, 층 `{랙}-L01`, 셀 `{층}-C01` — 창고코드를 앞에 붙여 모든 창고에서 하나뿐이다
 * (omf-all-around#292, 예: `PTW-B-Z01-R001-L01-C01`). 번호는 같은 상위 안에서 가장 큰 번호 + 1 이고 꺼진 것도 센다.
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
 * `n` 번째 코드 — 상위 코드 뒤에 붙인다. 구역의 상위 코드는 창고코드다(#292). 상위 코드가 null 이면 붙이지 않는다.
 */
export const locationCodeAt = (
  level: LocationLevelCode,
  parentCode: string | null,
  n: number,
): string => {
  const own = `${LEVEL_PREFIX[level]}${String(n).padStart(LEVEL_DIGITS[level], '0')}`;
  return parentCode === null ? own : `${parentCode}-${own}`;
};

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 같은 상위 밑에서 이 단계 모양의 코드 가운데 가장 큰 번호. 없으면 0 — 모양이 다른 옛 코드는 세지 않는다.
 * 구역은 `parentCode` 에 창고코드를 넘긴다 — 창고코드가 안 붙은 옛 구역(`Z01`)은 세지 않는다(서버 규칙).
 */
export const maxLocationSequence = (
  level: LocationLevelCode,
  parentCode: string | null,
  siblingCodes: readonly string[],
): number => {
  const head = parentCode === null ? '' : `${escapeRegExp(parentCode)}-`;
  const pattern = new RegExp(`^${head}${LEVEL_PREFIX[level]}(\\d+)$`);
  return siblingCodes.reduce((max, code) => {
    const match = pattern.exec(code);
    return match === null ? max : Math.max(max, Number(match[1]));
  }, 0);
};

/**
 * 새 위치 하나의 코드(미리 보기). `parent` 가 null 이면 창고 바로 밑의 구역이고 `warehouseCode` 를 앞에 붙인다 —
 * 상위가 있는 위치(랙 · 층 · 셀)는 상위 코드에 이미 창고코드가 들어 있어 창고코드를 받지 않아도 된다.
 * 서버가 만든 위치(창고 전체 · 적치 대기)는 역할로 가려 세지 않는다.
 */
export function issueLocationCode(
  level: LocationLevelCode,
  parent: Location,
  items: readonly Location[],
): string;
export function issueLocationCode(
  level: LocationLevelCode,
  parent: Location | null,
  items: readonly Location[],
  warehouseCode: string,
): string;
export function issueLocationCode(
  level: LocationLevelCode,
  parent: Location | null,
  items: readonly Location[],
  warehouseCode?: string,
): string {
  const parentId = parent?.locationId ?? null;
  const siblingCodes = items
    .filter(
      (item) =>
        (item.parentLocationId ?? null) === parentId &&
        item.locationId !== parentId &&
        !isSystemLocation(item),
    )
    .map((item) => item.locationCode);
  const parentCode = parent?.locationCode ?? warehouseCode ?? null;
  return locationCodeAt(
    level,
    parentCode,
    maxLocationSequence(level, parentCode, siblingCodes) + 1,
  );
}
