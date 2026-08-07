import type { AsnView } from './types';

/**
 * 상태 필터의 선택지 — **조회 결과에서 만든다.**
 *
 * 계약이 `statusCode`를 「확정된 값 목록이 아직 없으므로 화면은 서버가 내려주는 값을 그대로 표시하고
 * 값 자체로 분기하지 않는다」로 두었다(이슈 #20 §4 · omf-mes#64). 값을 지어내는 대신
 * 이번 결과에 나온 코드에서 뽑고, 그 한계(결과에 없는 값은 목록에 없다)를 문구로 밝힌다.
 *
 * **목록 조회 결과에서 뽑는다.** 마스터 변경관리와 달리 조건 없는 조회를 한 번 더 부르지 않는다 —
 * 상태를 하나로 좁혀도 지금 걸린 값은 `withCurrentValue`가 목록에 남겨 주므로
 * 「선택지가 자기 자신으로 줄어 되돌릴 수 없다」가 생기지 않고, 요청도 늘지 않는다.
 */

/**
 * 값 목록이 확정되면 **이 배열만** 채운다. 값을 지어내지 않는다.
 * 비어 있어도 자리를 남기는 이유는, 확정됐을 때 고칠 곳이 한눈에 보이게 하기 위해서다.
 */
export const PLACEHOLDER_ASN_STATUS_CODES: readonly string[] = [];

/** 결과에 나온 상태 코드를 뽑는다. 빈 값은 버리고 문자열 오름차순으로 낸다. */
export const distinctStatusCodes = (rows: readonly AsnView[]): string[] => {
  const values = new Set<string>();

  for (const row of rows) {
    if (row.statusCode !== '') values.add(row.statusCode);
  }

  return [...values].sort((left, right) => left.localeCompare(right));
};

/**
 * 지금 걸려 있는 값이 목록에 없으면 맨 앞에 남긴다.
 * 남기지 않으면 조건을 바꿨을 때 고른 값이 목록에서 사라져 **해제할 방법이 없어진다.**
 */
export const withCurrentValue = (options: readonly string[], current: string): string[] =>
  current === '' || options.includes(current) ? [...options] : [current, ...options];

/** 자리표시 상수 · 조회 결과 · 지금 고른 값을 한 목록으로 합친다. */
export const toStatusOptions = (
  placeholders: readonly string[],
  rows: readonly AsnView[],
  current: string,
): string[] => {
  const merged = [...new Set([...placeholders, ...distinctStatusCodes(rows)])];

  return withCurrentValue(merged, current);
};
