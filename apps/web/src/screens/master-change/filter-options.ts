import type { AuditEventView } from './types';

/**
 * 필터 선택지 — **조회한 기록에서 만든다.**
 *
 * `targetTypeCode`는 고정 OpenAPI가 닫은 7개를 제공한다. `eventTypeCode`는 실행 시점
 * 공통코드이므로 지금까지 남은 기록에서 뽑고, 그 한계
 * (한 번도 기록되지 않은 값·기간 밖의 값은 없다)를 문구로 밝힌다.
 *
 * **목록 조회 결과에서 뽑으면 안 된다.** 대상 종류를 하나로 좁혀 조회하면 결과의 대상 종류가
 * 하나뿐이라 선택지가 자기 자신으로 줄고 **다른 값으로 바꿀 수 없게 된다** —
 * 그래서 같은 기간·다른 조건 없음으로 한 번 더 조회한 결과를 넣는다.
 */

/**
 * 고정 enum은 그대로 두고, 실행 시점 목록은 조회 결과와 합친다.
 */
export const PLACEHOLDER_TARGET_TYPE_CODES = [
  'APP_USER',
  'ROLE',
  'WORKER',
  'TERMINAL',
  'ITEM',
  'ROUTING',
  'INSPECTION_PLAN_VERSION',
] as const;
export const PLACEHOLDER_EVENT_TYPE_CODES: readonly string[] = [];

/** 한 필드의 값 목록을 뽑는다. 빈 값은 버리고 문자열 오름차순으로 낸다. */
export const distinctValues = (
  rows: readonly AuditEventView[],
  pick: (row: AuditEventView) => string,
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
  rows: readonly AuditEventView[],
  pick: (row: AuditEventView) => string,
  current: string,
): string[] => {
  const merged = [...new Set([...placeholders, ...distinctValues(rows, pick)])];

  return withCurrentValue(merged, current);
};
