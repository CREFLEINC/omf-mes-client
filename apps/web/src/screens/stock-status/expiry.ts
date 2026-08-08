/**
 * 유효기한 판정 — **경과 · 임박 · 해당 없음** 세 갈래.
 *
 * **목록에는 붙일 수 없다.** 계약의 `InventoryBalance`에 유효기한 필드가 없고 `Lot.expiryDate`에
 * 있어(실측), 이 판정은 LOT 상세에서만 쓰인다.
 *
 * **표식만 낸다.** 기한이 지난 재고를 자동으로 보류하지 않는다 — 그 정책이 아직 정해지지
 * 않았다(이슈 #21 §4 미결 5). 화면이 먼저 정하면 정책이 오는 날 값이 이미 바뀌어 있다.
 *
 * **순수 함수만 둔다.** 함수 안에서 `new Date()`를 부르면 테스트가 실행 환경의 시각을 검사하게
 * 되고, 화면은 아무것도 안 했는데 표식이 바뀐다. 「오늘」은 호출부가 인자로 준다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/**
 * 「임박」으로 볼 남은 날수. **기준 일수를 적는 자리는 여기 하나뿐이다.**
 *
 * 값 자체가 아직 확정되지 않았다 — 품목별인지 고정값인지 정해지지 않아 30일로 둔다
 * (이슈 #21 §4 미결 2). 정해지면 **이 상수만** 고친다. 판정식이 숫자를 직접 적으면
 * 그날 상수와 화면이 서로 다른 날짜를 임박이라고 말하게 된다.
 */
export const EXPIRY_SOON_DAYS = 30;

/** 표식 세 갈래. `none`은 「유효기한이 없다」와 「아직 멀었다」를 함께 담는다 — 둘 다 표식이 없다. */
export type ExpiryState = 'none' | 'soon' | 'passed';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** 날짜만 남긴 그 날의 0시. 시각을 견주면 오전에 연 화면과 오후에 연 화면이 달라진다. */
const startOfDay = (at: Date): Date => new Date(at.getFullYear(), at.getMonth(), at.getDate());

/**
 * 계약이 주는 `YYYY-MM-DD`를 **현지 날짜**로 읽는다.
 *
 * `new Date('2027-08-06')`은 UTC 자정으로 읽혀 한국 시간대에서 하루 앞의 날짜가 된다 —
 * 경계 하루가 통째로 밀린다. 그래서 조각을 갈라 현지 날짜로 만든다.
 *
 * **없는 날짜를 만들어 내지 않는다.** `Date`는 `2026-02-31`을 3월 3일로 굴려 주므로,
 * 만든 값을 되읽어 적힌 그대로인지 확인한다. 아니면 판정하지 않는다 — 서버가 준 적 없는
 * 날짜로 표식을 지어내는 것보다 표식이 없는 편이 낫다.
 */
const parseExpiryDate = (value: string): Date | null => {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (matched === null) return null;

  const [year, month, day] = [Number(matched[1]), Number(matched[2]), Number(matched[3])];
  const parsed = new Date(year, month - 1, day);

  const isSameDate =
    parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;

  return isSameDate ? parsed : null;
};

/**
 * 유효기한 표식을 정한다.
 *
 * 경계 둘이 뜻을 정한다:
 *
 * - **오늘은 경과가 아니다.** 유효기한은 그 날까지 쓸 수 있다는 뜻이라, 오늘을 경과로 부르면
 *   하루 일찍 못 쓰는 재고가 된다.
 * - **기준 일수째까지 임박이다.** 「30일 안에 닥친다」에 30일째가 든다.
 *
 * 여름·겨울 시간이 있는 지역에서 하루가 23·25시간이 되므로 **날 수를 반올림한다** —
 * 자정끼리 빼도 한 시간이 어긋나 경계가 밀릴 수 있다.
 */
export const classifyExpiry = (expiryDate: string | null, today: Date): ExpiryState => {
  if (expiryDate === null) return 'none';

  const expiry = parseExpiryDate(expiryDate);

  if (expiry === null) return 'none';

  const daysLeft = Math.round((expiry.getTime() - startOfDay(today).getTime()) / MS_PER_DAY);

  if (daysLeft < 0) return 'passed';

  return daysLeft <= EXPIRY_SOON_DAYS ? 'soon' : 'none';
};
