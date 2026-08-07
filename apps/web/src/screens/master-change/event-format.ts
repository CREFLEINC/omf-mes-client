/**
 * 표기 규칙 — **시각 하나**와 **자유 형식 값 하나**.
 *
 * 자유 형식이라 값이 어떤 자료형으로 올지 모른다. 자료형별 규칙을 여기 한 곳에 못 박는다 —
 * 표·창이 각자 판단하면 같은 값이 자리마다 다르게 보인다.
 */

/**
 * 계약의 date-time 문자열에서 표기용 조각을 뽑는다.
 *
 * **실행 환경 시간대로 옮기지 않는다.** 서버가 적어 보낸 벽시계 시각이 현장이 쓰는 시각이고,
 * 옮기면 같은 자료가 보는 사람마다 다른 시각으로 보인다.
 */
const RFC3339_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

/** `2026-08-04 09:12`. 값이 없거나 형식이 아니면 null — 호출부가 「—」로 바꾼다. */
export const formatDateTime = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined) return null;

  const matched = RFC3339_PATTERN.exec(value);
  if (matched === null) return null;

  return `${matched[1] ?? ''} ${matched[2] ?? ''}`;
};

/**
 * 전후 값 하나를 표기 문자열로 옮긴다. 값이 없으면 `null`을 내고 그때 빈 값 표기는 호출부가 붙인다.
 *
 * | 받은 값 | 표기 |
 * | --- | --- |
 * | 문자열 | 그대로(빈 문자열은 없는 값으로 본다) |
 * | 숫자 · 불리언 | `String(value)` — **`0`·`false`도 「없음」으로 뭉개지 않는다** |
 * | `null` · `undefined` | `null` |
 * | 객체 · 배열 | **원문 JSON** |
 *
 * 객체를 `String()`으로 그리면 `[object Object]`가 화면에 나온다. 자유 형식이라 이 경우가
 * 실제로 온다 — 원문 JSON은 읽기 좋지 않지만 **자료를 잃지 않고 해석도 하지 않는다.**
 * 긴 JSON은 뿌리 선언의 `overflow-wrap: break-word`가 이미 처리한다(배치 규범 7).
 */
export const formatValue = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value === '' ? null : value;
  if (typeof value === 'object') return JSON.stringify(value);

  return String(value);
};
