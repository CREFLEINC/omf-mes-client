/**
 * 시각 표기 둘 — 머리글의 **기준 시각**과 보류 표의 **보류 시각**. W-01-07의 같은 이름
 * 파일을 그대로 옮겼다.
 *
 * 기준 시각 — 재고는 조회 시점의 스냅샷이라는 사실을 화면이 밝히기 위한 표기. 이 화면은
 * 자동으로 갱신되지 않는다. 갱신은 새로고침 버튼이 하고 기준 시각이 그 사실을 밝힌다.
 *
 * **순수 함수만 둔다.** 함수 안에서 `new Date()`를 부르면 아무것도 안 했는데 시각이 계속
 * 바뀌고, 테스트가 실행 환경의 시각을 검사하게 된다. 「응답이 도착한 시각」은 호출부가
 * 인자로 준다(`useQuery`의 `dataUpdatedAt`).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const pad = (value: number, length: number): string => String(value).padStart(length, '0');

/**
 * 응답이 도착한 시각을 「YYYY-MM-DD HH:mm」으로 옮긴다. **현지 시각으로 읽는다**
 * (`toISOString`을 쓰지 않는다) — 한국 시간대에서 UTC로 읽으면 아홉 시간 전으로 보인다.
 *
 * `dataUpdatedAt`은 아직 받은 자료가 없으면 0이다. 그때 1970년을 내면 사용자가 그 시각의
 * 재고를 본 것으로 읽으므로 표기 자체를 내지 않는다.
 */
export const formatAsOf = (updatedAt: number | null): string | null => {
  if (updatedAt === null || updatedAt === 0) return null;

  const at = new Date(updatedAt);

  const date = `${pad(at.getFullYear(), 4)}-${pad(at.getMonth() + 1, 2)}-${pad(at.getDate(), 2)}`;
  const time = `${pad(at.getHours(), 2)}:${pad(at.getMinutes(), 2)}`;

  return `${date} ${time}`;
};

/**
 * 보류 시각을 표의 「MM-DD HH:mm」으로 옮긴다. 계약이 주는 값은 시간대까지 붙은
 * `2026-08-06T09:12:00+09:00` 형(25자)이라 그대로 내면 좁은 열에서 여러 줄로 접힌다.
 *
 * 해를 적지 않는 이유 — 보류는 대개 최근이 정상이고, 열 폭 예산에서 해 네 자리는 다른
 * 열이 더 필요로 한다. **현지 시각으로 읽는다**(`formatAsOf`와 같은 이유). 깨진 값에는
 * 표기를 지어내지 않고 원래 값을 그대로 낸다.
 */
export const formatHeldAt = (value: string): string => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return value;

  return `${pad(parsed.getMonth() + 1, 2)}-${pad(parsed.getDate(), 2)} ${pad(parsed.getHours(), 2)}:${pad(parsed.getMinutes(), 2)}`;
};
