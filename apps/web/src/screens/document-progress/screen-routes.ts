/**
 * **화면 ID → 이 앱의 주소.** 계약이 프런트에 두라고 지시한 매핑 **하나**다 —
 * 「문서 유형 → 화면」 매핑은 만들지 않는다(그것이 금지된 쪽이다 · 공유계약 A-10 보강).
 * 계약이 `screenId`를 내려 주는 이유가 그것이며, 이 화면은 그 값을 **열쇠로 쓸 뿐** 해석하지 않는다.
 *
 * ---
 *
 * **지금은 빈 표다.** 근거 둘.
 *
 * | # | 사실 |
 * | :-: | --- |
 * | ① | **문서 하나를 지목해 여는 주소 규약이 계약에도 이 저장소에도 없다** — 화면만 열면 「열었더니 그 문서가 아니다」가 된다 |
 * | ② | 대상 화면 일부는 이 앱에 있으나(입고·출고 등) 어느 화면 ID가 어느 주소인지 정한 자리가 없다 |
 *
 * 그래서 빈 표가 「아직 없다」의 정직한 모습이다. 그럴듯한 경로를 지어 넣으면 사용자는
 * 「열기」를 누르고 엉뚱한 자리에 도착하며, 그 값이 화면 코드보다 오래 남아 규약처럼 굳는다.
 *
 * **줄이 생기면 그것만으로 열기가 살아난다.** 판정(`judgeScreenOpen`)이 표를 **인자로** 받아
 * 자리표시가 「영영 죽은 가지」가 되지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 화면 ID를 열쇠로 하는 주소 표. `screenId`는 계약이 내려 주는 값이라 키를 좁히지 않는다. */
export type ScreenRouteTable = Readonly<Record<string, string>>;

/** 화면 ID → 주소. **비어 있는 것이 지금의 사실이다.** */
export const SCREEN_ROUTES: ScreenRouteTable = {};

/**
 * 그 화면 ID가 이 앱의 어느 주소인가. 표에 없으면 `null`이다 — **없음을 값으로 낸다.**
 *
 * **빈 화면 ID는 표를 뒤지지 않는다.** 계약이 `screenId`를 선택 필드로 두어 빈 문자열이
 * 스키마를 통과하는데, 그것을 열쇠로 쓰면 표에 실수로 들어간 빈 열쇠가 아무 문서나 열게 된다.
 */
export const screenPathOf = (screenId: string, routes: ScreenRouteTable): string | null =>
  screenId === '' ? null : (routes[screenId] ?? null);

/**
 * 열기가 어떤 상태인가 — **열림 하나와 잠김 둘**이다.
 *
 * | 갈래 | 무엇이 사실인가 | 누가 풀 수 있는가 |
 * | --- | --- | --- |
 * | `open` | 열 수 있고 갈 곳도 안다 | — |
 * | `noScreenId` | **어느 화면인지 오지 않았다** | 계약·규약(서버가 값을 채운다) |
 * | `unmapped` | 화면은 아는데 **이 앱에 그 화면이 없다** | 이 저장소(`SCREEN_ROUTES`에 줄을 더한다) |
 *
 * 둘을 한 갈래로 뭉개지 않는 이유는 **풀 수 있는 사람이 다르기 때문**이다.
 * ⚠ 전례(`approval-inbox`)의 셋째 갈래(`notOpenable`)는 **이 화면에 없다** — 진행현황 계약에
 * 「열 수 있는가」를 내려 주는 필드가 없어(실측) 그 사실을 지어낼 근거가 없다.
 */
export type ScreenOpenBlock = { kind: 'noScreenId' } | { kind: 'unmapped' };

export type ScreenOpenState = { kind: 'open'; path: string } | ScreenOpenBlock;

/**
 * 이 화면 ID를 열 수 있는가.
 *
 * 매핑표를 **인자로 받는다.** 자리표시를 읽는 자리를 한 곳으로 묶어야 「표를 채우면 열린다」를
 * 시험이 실제로 잴 수 있다 — 판정 안에 표를 박아 넣으면 그 전환이 죽은 가지가 된다.
 */
export const judgeScreenOpen = (screenId: string, routes: ScreenRouteTable): ScreenOpenState => {
  if (screenId === '') return { kind: 'noScreenId' };

  const path = screenPathOf(screenId, routes);

  return path === null ? { kind: 'unmapped' } : { kind: 'open', path };
};
