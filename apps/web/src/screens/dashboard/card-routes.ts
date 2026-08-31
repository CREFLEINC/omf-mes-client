/**
 * **지표 코드 → 그 지표를 소유한 화면의 주소.**
 *
 * ⭐ 카드마다 소유 화면이 따로 있고, 이 화면은 숫자만 모은다 — 값이 이상하면 **누구에게 물어야
 * 하는지**가 카드에 있어야 한다. 그 길이 이 표다.
 *
 * ⛔ **비어 있는 것이 지금 맞다.** 계약이 지표 코드를 값 목록 없는 문자열로 두었고 예시조차
 * 싣지 않았다 — 어떤 지표를 보일지는 운영이 정하기 때문이다(착수 이슈 §4 미결). 그럴듯한 코드를
 * 지어 표를 채우면 **서버가 다른 코드를 보내는 순간 카드가 엉뚱한 화면을 연다.** 사용자는
 * 그것을 「대시보드가 틀렸다」가 아니라 「그 화면이 틀렸다」로 읽는다.
 *
 * ⭐ **줄이 생기면 그것만으로 열기가 살아난다.** 판정은 이 표를 읽는 자리 하나(`cardPathOf`)에
 * 있고 잠금을 상수로 굳혀 두지 않았다 — 자리표시를 「영영 죽은 가지」로 만들지 않기 위해서다.
 * `approval-inbox/screen-routes.ts`가 같은 형태로 먼저 섰다.
 *
 * ⚠ **설비종합효율은 이 표에 들어올 자리가 없다.** 그 지표는 다른 셋을 곱해 이 화면이 만드는
 * 값이라 물어볼 소유 화면이 따로 없다 — 항이 나란히 서 있는 이 화면이 그 자리다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export type CardRouteTable = Readonly<Record<string, string>>;

/** 지표 코드가 확정되면 이 표만 채운다. 코드를 지어내지 않는다. */
export const CARD_ROUTES: CardRouteTable = {};

/**
 * 그 지표를 자세히 볼 화면이 이 앱의 어느 주소인가. 표에 없으면 `null`이다 — **없음을 값으로 낸다.**
 *
 * **빈 코드는 표를 뒤지지 않는다.** 계약이 코드를 문자열로 두어 빈 값이 스키마를 통과하는데,
 * 그것을 열쇠로 쓰면 표에 실수로 들어간 빈 열쇠가 아무 카드나 열게 된다.
 *
 * 기준 축(기준 날짜 · 공장)을 **함께 넘긴다** — 넘기지 않으면 어제의 이상한 숫자를 눌렀는데
 * 오늘 자료가 열린다.
 */
export const cardPathOf = (
  cardCode: string,
  axes: URLSearchParams,
  routes: CardRouteTable,
): string | null => {
  if (cardCode === '') return null;

  const path = routes[cardCode];

  if (path === undefined) return null;

  const query = axes.toString();

  return query === '' ? path : `${path}?${query}`;
};
