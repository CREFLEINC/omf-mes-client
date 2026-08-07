/**
 * 도착 예정일 **경과 판정**.
 *
 * 당일을 경과로 볼 것인지가 아직 정해지지 않았다(이슈 #20 §4). 그래서 기준을 상수 한 곳에 두고,
 * 판정식은 그 기준을 **인자로 받는 함수**만 갖는다 — 판정식이 `true`/`false`를 직접 적으면
 * 상수를 고쳐도 화면이 따라오지 않아 「한 곳만 고치면 된다」가 깨진다.
 *
 * 순수 함수만 둔다 — 함수 안에서 `new Date()`를 부르면 테스트가 실행 환경의 시각을 검사하게 된다.
 * 「오늘」은 호출부가 인자로 준다(`period.ts`의 선례와 같다).
 */

/**
 * **도착 예정일 당일을 경과로 볼 것인가.** 지금 확정된 처리는 「당일 미포함」이다.
 * 판정 기준이 정해지면 **이 상수 하나만** 고친다.
 */
export const OVERDUE_INCLUDES_TODAY = false;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const pad = (value: number, length: number): string => String(value).padStart(length, '0');

/**
 * 현지 날짜를 `YYYY-MM-DD`로 옮긴다.
 *
 * **UTC로 읽지 않는다**(`toISOString`을 쓰지 않는다). 한국 시간대에서 밤 9시가 지나면
 * UTC 날짜가 하루 뒤라 경과 표시가 하루 일찍 붙는다.
 */
export const toDateText = (date: Date): string =>
  `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;

/**
 * 기준을 **인자로 받아** 경과를 판정한다. 이 함수가 판정 논리의 유일한 자리다.
 *
 * 형식이 깨진 값에는 경과를 붙이지 않는다 — 문자열 비교는 `''`이나 `2026-8-9` 같은 값도
 * 「작다」로 판정하므로, 형식을 먼저 보지 않으면 지어낸 판정을 화면에 내게 된다.
 */
export const isOverdueUnder = (
  expectedArrivalDate: string,
  today: Date,
  includesToday: boolean,
): boolean => {
  if (!DATE_PATTERN.test(expectedArrivalDate)) return false;

  const todayText = toDateText(today);

  // 자릿수가 고정된 `YYYY-MM-DD`라 문자열 비교가 곧 날짜 비교다.
  return includesToday ? expectedArrivalDate <= todayText : expectedArrivalDate < todayText;
};

/**
 * 화면이 쓰는 경과 판정. 확정된 기준(`OVERDUE_INCLUDES_TODAY`)을 그대로 넘긴다.
 *
 * **표시 문구는 「도착 예정일 경과」이지 「미입하」가 아니다** — 상태 값 집합을 모르므로
 * 입하 여부를 화면이 판정할 수 없다. 사실만 말한다.
 */
export const isOverdue = (expectedArrivalDate: string, today: Date): boolean =>
  isOverdueUnder(expectedArrivalDate, today, OVERDUE_INCLUDES_TODAY);
