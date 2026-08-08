/**
 * 시각 표기 둘 — 머리글의 **기준 시각**과 표의 **최근 거래**.
 *
 * 기준 시각 — **재고는 조회 시점의 스냅샷**이라는 사실을 화면이 밝히기 위한 표기.
 *
 * 이 화면은 자동으로 갱신되지 않는다(대시보드가 아니다 — 이슈 #21 §5). 그래서 지금 보이는
 * 수량이 언제의 것인지 밝히지 않으면 사용자가 실시간으로 읽는다.
 *
 * **순수 함수만 둔다.** 함수 안에서 `new Date()`를 부르면 아무것도 안 했는데 시각이 계속 바뀌고,
 * 테스트가 실행 환경의 시각을 검사하게 된다. 「응답이 도착한 시각」은 호출부가 인자로 준다
 * (`useQuery`의 `dataUpdatedAt` — 렌더 시각이 아니다).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const pad = (value: number, length: number): string => String(value).padStart(length, '0');

/**
 * 응답이 도착한 시각을 「YYYY-MM-DD HH:mm」으로 옮긴다.
 *
 * **현지 시각으로 읽는다**(`toISOString`을 쓰지 않는다). 한국 시간대에서 UTC로 읽으면
 * 아홉 시간 전으로 보여 「낡은 자료」로 오인된다.
 *
 * `dataUpdatedAt`은 아직 받은 자료가 없으면 0이다. 그때 1970년을 내면 사용자가
 * 그 시각의 재고를 본 것으로 읽으므로 표기 자체를 내지 않는다.
 */
export const formatAsOf = (updatedAt: number | null): string | null => {
  if (updatedAt === null || updatedAt === 0) return null;

  const at = new Date(updatedAt);

  const date = `${pad(at.getFullYear(), 4)}-${pad(at.getMonth() + 1, 2)}-${pad(at.getDate(), 2)}`;
  /* 초를 내지 않는다 — 조회 시점의 정밀도가 초 단위로 읽힐 이유가 없다. */
  const time = `${pad(at.getHours(), 2)}:${pad(at.getMinutes(), 2)}`;

  return `${date} ${time}`;
};

/**
 * 최근 거래 시각을 표의 「MM-DD HH:mm」으로 옮긴다(계획 §5.4의 표기 규칙).
 *
 * **계약이 주는 값을 그대로 그리지 않는다.** `lastTransactionAt`은 시간대까지 붙은
 * `2026-08-06T09:12:00+09:00` 형태(25자)라, 그대로 내면 124px 열에서 여러 줄로 접히고
 * 사람이 읽을 형태도 아니다 — 브라우저 확인 F-B2가 드러낸 열 폭 문제의 한 축이다.
 *
 * **해를 적지 않는 이유**: 재고의 마지막 움직임은 최근이 정상이고, 열 폭 예산에서 해
 * 네 자리는 「코드 · 이름」 축 열이 더 필요로 한다. 해가 다른 값을 가려야 할 근거가 생기면
 * 그때 이 함수 한 곳을 고친다.
 *
 * **현지 시각으로 읽는다**(`formatAsOf`와 같은 이유 — UTC로 읽으면 아홉 시간이 밀린다).
 * 깨진 값에는 표기를 지어내지 않고 `null`을 돌려 대시로 두게 한다.
 */
export const formatTransactionAt = (at: string | null): string | null => {
  if (at === null || at === '') return null;

  const parsed = new Date(at);

  if (Number.isNaN(parsed.getTime())) return null;

  const date = `${pad(parsed.getMonth() + 1, 2)}-${pad(parsed.getDate(), 2)}`;
  const time = `${pad(parsed.getHours(), 2)}:${pad(parsed.getMinutes(), 2)}`;

  return `${date} ${time}`;
};
