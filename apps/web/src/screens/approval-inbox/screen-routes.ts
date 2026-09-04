/**
 * **화면 ID → 이 앱의 주소.** 계약이 프런트에 두라고 지시한 매핑 **하나**다 —
 * 「대상 유형 → 화면」 매핑은 만들지 않는다(그것이 금지된 쪽이다).
 *
 * ---
 *
 * W-03-09는 화면과 선택 주소 규약이 함께 공개돼 표에 들어간다. W-03-10은 아직 실제
 * 클라이언트 route가 없으므로 넣지 않는다 — 그럴듯한 경로를 지으면 사용자가 엉뚱한 자리에
 * 도착하고 그 값이 규약처럼 굳는다.
 *
 * **줄이 생기면 그것만으로 열기가 살아난다.** 판정은 이 표를 읽는 자리 하나(`target.ts`)에
 * 있고 잠금을 상수로 굳혀 두지 않았다 — 자리표시를 「영영 죽은 가지」로 만들지 않기 위해서다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export interface ScreenRouteDescriptor {
  path: string;
  /** 대상 화면이 선택을 읽는 query key. 화면 주소와 한 계약이라 같은 표가 소유한다. */
  selectionKey: string;
}

/** 화면 ID를 열쇠로 하는 주소 표. `screenId`는 계약이 내려 주는 값이라 키를 좁히지 않는다. */
export type ScreenRouteTable = Readonly<Record<string, ScreenRouteDescriptor>>;

/** 화면 ID → 주소와 선택 규약. W-03-10은 실제 route가 공개되기 전까지 일부러 없다. */
export const SCREEN_ROUTES: ScreenRouteTable = {
  'W-03-09': { path: '/quality/approvals', selectionKey: 'approvalRequestId' },
};

/**
 * 그 화면 ID가 이 앱의 어느 주소인가. 표에 없으면 `null`이다 — **없음을 값으로 낸다.**
 *
 * **빈 화면 ID는 표를 뒤지지 않는다.** 계약이 `screenId`를 선택 필드로 두어 빈 문자열이
 * 스키마를 통과하는데, 그것을 열쇠로 쓰면 표에 실수로 들어간 빈 열쇠가 아무 대상이나 열게 된다.
 */
export const screenPathOf = (
  screenId: string,
  approvalRequestId: number,
  routes: ScreenRouteTable,
): string | null => {
  if (screenId === '') return null;

  if (!Object.hasOwn(routes, screenId)) return null;

  const route = routes[screenId];

  if (route === undefined) return null;

  const query = new URLSearchParams({ [route.selectionKey]: String(approvalRequestId) });

  return `${route.path}?${query.toString()}`;
};
