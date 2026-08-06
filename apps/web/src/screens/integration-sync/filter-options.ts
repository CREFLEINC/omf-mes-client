import type { IntegrationMessageRow } from './types';

/**
 * 필터 선택지 — **조회한 기록에서 만든다.**
 *
 * 계약이 `statusCode`·`interfaceCode`·`directionCode`·`targetTypeCode`를 모두
 * 「값 목록 미정」으로 두어 화면이 고를 값을 알 수 없다. 값을 지어내는 대신 지금까지 실행된
 * 기록에서 뽑고, 그 한계(한 번도 실행되지 않은 값·기간 밖의 값은 없다)를 문구로 밝힌다.
 *
 * **목록 조회 결과에서 뽑으면 안 된다.** 상태를 「실패」로 좁혀 조회하면 결과의 상태가
 * 하나뿐이라 선택지가 자기 자신으로 줄고 다른 값으로 바꿀 수 없게 된다 —
 * 그래서 같은 기간·다른 조건 없음으로 한 번 더 조회한 결과를 넣는다.
 */

/**
 * 값 목록이 확정되면 **이 배열만** 채운다. 값을 지어내지 않는다.
 * 비어 있어도 자리를 남기는 이유는, 확정됐을 때 고칠 곳이 한눈에 보이게 하기 위해서다.
 */
export const PLACEHOLDER_STATUS_CODES: readonly string[] = [];
export const PLACEHOLDER_INTERFACE_CODES: readonly string[] = [];
export const PLACEHOLDER_DIRECTION_CODES: readonly string[] = [];
export const PLACEHOLDER_TARGET_TYPE_CODES: readonly string[] = [];

/** 한 필드의 값 목록을 뽑는다. 빈 값은 버리고 문자열 오름차순으로 낸다. */
export const distinctValues = (
  rows: readonly IntegrationMessageRow[],
  pick: (row: IntegrationMessageRow) => string,
): string[] => {
  const values = new Set<string>();

  for (const row of rows) {
    const value = pick(row);
    if (value !== '') values.add(value);
  }

  return [...values].sort((left, right) => left.localeCompare(right));
};

/**
 * 지금 걸려 있는 값이 목록에 없으면 맨 앞에 남긴다.
 * 남기지 않으면 기간을 바꿨을 때 고른 값이 목록에서 사라져 **해제할 방법이 없어진다.**
 */
export const withCurrentValue = (options: readonly string[], current: string): string[] =>
  current === '' || options.includes(current) ? [...options] : [current, ...options];

/** 자리표시 상수 · 조회 결과 · 지금 고른 값을 한 목록으로 합친다. */
export const toCodeOptions = (
  placeholders: readonly string[],
  rows: readonly IntegrationMessageRow[],
  pick: (row: IntegrationMessageRow) => string,
  current: string,
): string[] => {
  const merged = [...new Set([...placeholders, ...distinctValues(rows, pick)])];

  return withCurrentValue(merged, current);
};
