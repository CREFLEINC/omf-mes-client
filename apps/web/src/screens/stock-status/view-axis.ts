/**
 * 보기(묶는 축) — 이 화면의 정체를 정하는 축이다.
 *
 * 계약의 `/inventory/balances`는 **호출 한 번에 축 하나만** 묶는다(`groupBy`). 그래서
 * 「품목별·LOT별·위치별」은 세 화면이 아니라 **같은 목록의 세 보기**이고, 축이 조건 줄·요청·
 * 표 열 구성·그룹 헤더·기본 정렬을 전부 관통한다.
 *
 * 순수 함수만 둔다 — 주소 문자열을 읽고 계약 파라미터를 만드는 일뿐이라 화면을 띄우지 않고
 * 고정할 수 있다. 이 화면 최대 위험 자리라(계획 §8 R1) 판정을 한곳에 모은다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 화면이 쓰는 보기 이름. 주소 키 `view`에 그대로 실린다 — 계약의 낱말을 주소에 쓰지 않는다. */
export type ViewAxis = 'item' | 'lot' | 'location';

/** 탭 순서이자 유효 값 목록. 순서가 곧 시각·키보드 순서다. */
export const VIEW_AXES: readonly ViewAxis[] = ['item', 'lot', 'location'];

/**
 * 기본 보기. **계약 기본값(`groupBy: ITEM`)과 같은 축을 고른다** —
 * 다르면 첫 조회가 기본값을 명시해야 해서 요청 URL이 이유 없이 길어진다.
 */
export const DEFAULT_VIEW: ViewAxis = 'item';

const isViewAxis = (value: string): value is ViewAxis =>
  (VIEW_AXES as readonly string[]).includes(value);

/**
 * 주소가 담은 보기. **모르는 값은 기본 보기로 읽는다.**
 *
 * 주소는 손으로 고쳐지는 자리다. 모르는 값을 그대로 요청에 실으면 계약 열거값 밖이라
 * 조회 전체가 400으로 죽고, 사용자에게는 「조회가 늘 안 된다」로만 보인다.
 */
export const readViewAxis = (raw: string | null): ViewAxis => {
  const value = raw ?? '';

  return isViewAxis(value) ? value : DEFAULT_VIEW;
};

/**
 * 주소가 담은 보기를 **지금 열 수 있는 보기**로 읽는다.
 *
 * **LOT별 보기는 품목이 있어야 성립한다**(계획 결정 11). LOT을 번호 여러 개로 조회할 수단이
 * 계약에 없어 품목이 이름을 풀 범위를 정하는데, 품목 없이 그 보기를 열면 표의 LOT 칸이 전부
 * 「알 수 없음」이 된다 — **정상 값을 잘못된 값으로 보이게 하는 표기**(#47)이고, 이름을 풀
 * 수단 자체가 없으니 일시적이 아니라 **영구적**이다.
 *
 * 탭을 비활성으로 두는 것만으로는 **클릭 경로만** 막힌다. 이 화면은 주소가 조건의 정본이라
 * 주소 진입(북마크·공유·뒤로가기)과 품목 조건 제거로도 같은 자리에 닿는다.
 * 그래서 **읽는 자리에서** 막는다 — 모르는 값을 기본 보기로 읽는 것과 같은 갈래다.
 *
 * **주소의 `view`를 고쳐 쓰지는 않는다.** 품목을 다시 고르면 원하던 보기가 되살아나야 하고,
 * 「주소에 적힌 값과 읽는 값이 다를 수 있다」는 이 화면이 이미 `view=xyz`·`sort=nope`에서
 * 쓰고 있는 규칙이다.
 */
export const resolveViewAxis = (raw: string | null, hasItemFilter: boolean): ViewAxis => {
  const requested = readViewAxis(raw);

  return requested === 'lot' && !hasItemFilter ? DEFAULT_VIEW : requested;
};

/** 계약이 받는 묶는 축. 품목별은 키 자체가 생기지 않는다. */
export interface GroupByQuery {
  groupBy?: 'LOT' | 'LOCATION';
}

/**
 * 보기를 계약 파라미터로 옮긴다.
 *
 * **품목별은 싣지 않는다** — 계약 기본값이 `ITEM`이라 실으면 같은 조회의 요청 URL이 두 가지가 된다.
 * 「기본값은 주소에도 요청에도 적지 않는다」는 이 화면의 규칙이 쪽·`includeZero`와 같다.
 */
export const toGroupByQuery = (view: ViewAxis): GroupByQuery => {
  switch (view) {
    case 'item':
      return {};
    case 'lot':
      return { groupBy: 'LOT' };
    case 'location':
      return { groupBy: 'LOCATION' };
  }
};

/** 1단 그룹 헤더가 묶는 축. `null`이면 그룹 헤더를 만들지 않는다. */
export type GroupAxis = 'item' | 'location';

/**
 * 그 보기의 그룹 헤더 축.
 *
 * **1단뿐이다**(이슈 #21 §4 미결 4 — 다단 위치 트리를 만들지 않는다). 반환값이 하나거나
 * 없음이라 중첩 그룹을 만들 자리가 구조적으로 없다.
 *
 * 품목별에 그룹이 없는 이유: 행 하나가 곧 품목이라 묶으면 그룹마다 행이 하나씩 남는다.
 */
export const groupAxisOf = (view: ViewAxis): GroupAxis | null => {
  switch (view) {
    case 'item':
      return null;
    case 'lot':
      return 'item';
    case 'location':
      return 'location';
  }
};
