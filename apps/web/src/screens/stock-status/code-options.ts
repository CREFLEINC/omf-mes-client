import type { BalanceView } from './types';

/**
 * 코드 조건의 선택지 — **조회 결과에서 만든다.**
 *
 * 품질 상태·재고 상태·소유 구분은 계약이 전부 「확정된 값 목록이 아직 없다 — 서버가 내려주는
 * 값을 그대로 쓴다」로 두었다(이슈 #21 §4 · omf-mes#64). 값을 지어내면 **없는 선택지를
 * 만드는 것**이라 사용자가 고른 값으로 조회했다가 늘 0건을 본다.
 *
 * 그래서 자리표시 상수를 **빈 배열로 두고** 이번 결과에 나온 코드에서 뽑으며, 그 한계
 * (결과에 없는 값은 목록에 없다)를 조건 줄의 안내 문구가 밝힌다.
 *
 * **조회 결과에서 뽑고 목록을 한 번 더 부르지 않는다** — 조건을 하나로 좁혀도 지금 걸린 값은
 * `withCurrentValue`가 남겨 주므로 「선택지가 자기 자신으로 줄어 되돌릴 수 없다」가 생기지 않고,
 * 요청도 늘지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/**
 * 값 목록이 확정되면(omf-mes#64) **이 배열들만** 채운다. 값을 지어내지 않는다.
 * 비어 있어도 자리를 남기는 이유는, 확정됐을 때 고칠 곳이 한눈에 보이게 하기 위해서다.
 */
export const PLACEHOLDER_QUALITY_STATUS_CODES: readonly string[] = [];
export const PLACEHOLDER_INVENTORY_STATUS_CODES: readonly string[] = [];
export const PLACEHOLDER_OWNERSHIP_TYPE_CODES: readonly string[] = [];

/** 한 줄에서 코드 하나를 꺼내는 방법. 코드마다 필드가 다르므로 호출부가 준다. */
export type CodePicker = (row: BalanceView) => string | null;

/** 결과에 나온 코드를 뽑는다. 없는 값·빈 값은 버리고 문자열 오름차순으로 낸다. */
export const distinctCodes = (rows: readonly BalanceView[], pick: CodePicker): string[] => {
  const values = new Set<string>();

  for (const row of rows) {
    const code = pick(row);

    /* 빈 값이 선택지에 들어가면 「전체」와 구분되지 않는다. */
    if (code !== null && code !== '') values.add(code);
  }

  return [...values].sort((left, right) => left.localeCompare(right));
};

/**
 * 지금 걸려 있는 값이 목록에 없으면 맨 앞에 남긴다.
 *
 * 남기지 않으면 조건을 걸어 결과를 좁힌 순간 그 값이 선택지에서 사라져
 * **해제할 방법이 없어진다** — 조건을 건 사용자가 조건을 못 푸는 상태가 된다.
 */
export const withCurrentValue = (options: readonly string[], current: string): string[] =>
  current === '' || options.includes(current) ? [...options] : [current, ...options];

/** 자리표시 상수 · 조회 결과 · 지금 고른 값을 한 목록으로 합친다. */
export const toCodeOptions = (
  placeholders: readonly string[],
  rows: readonly BalanceView[],
  pick: CodePicker,
  current: string,
): string[] => {
  const merged = [...new Set([...placeholders, ...distinctCodes(rows, pick)])];

  return withCurrentValue(merged, current);
};
