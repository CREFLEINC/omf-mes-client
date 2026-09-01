/**
 * 「묶기」(groupBy) — 이 화면의 정체를 정하는 축이다.
 *
 * 계약의 `/inventory/balances`는 호출 한 번에 축 하나만 묶는다(`groupBy`). 그래서
 * 「품목별·LOT별·위치별」은 세 화면이 아니라 **같은 목록의 세 보기**이고, 축이 조건 줄·요청·
 * 표 열 구성·그룹 헤더·정렬을 전부 관통한다.
 *
 * ⚠ **LOT별 보기를 품목 뒤에 가둔다.** 계획은 이 화면이 인라인 LOT 이름을 받는다는 가정으로
 * 이 게이팅을 만들지 말라고 지시했지만, `types.ts`가 적어 둔 대로 이 클라이언트가 생성한
 * 계약에는 아직 인라인 이름이 없다 — LOT 이름은 `lookups.ts`가 품목 범위로 좁혀 받는
 * `/trace/lots?itemId=` 참조로 푼다. 품목 없이 LOT별 보기를 열면 표의 LOT 칸이 대부분
 * 「알 수 없음」이 되어 정상 값이 잘못된 값으로 보인다 — 계약이 갱신되기 전까지는 W-01-07과
 * 같은 이유로 이 게이팅이 필요하다.
 *
 * 순수 함수만 둔다. 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 화면이 쓰는 보기 이름. 주소 키 `view`에 그대로 실린다. */
export type ViewAxis = 'item' | 'lot' | 'location';

/** 선택지 순서이자 유효 값 목록. */
export const VIEW_AXES: readonly ViewAxis[] = ['item', 'lot', 'location'];

/** 기본 보기. 계약 기본값(`groupBy: ITEM`)과 같은 축을 고른다. */
export const DEFAULT_VIEW: ViewAxis = 'item';

const isViewAxis = (value: string): value is ViewAxis =>
  (VIEW_AXES as readonly string[]).includes(value);

/** 주소가 담은 보기. 모르는 값은 기본 보기로 읽는다 — 주소는 손으로 고쳐지는 자리다. */
export const readViewAxis = (raw: string | null): ViewAxis => {
  const value = raw ?? '';

  return isViewAxis(value) ? value : DEFAULT_VIEW;
};

/**
 * 주소가 담은 보기를 **지금 열 수 있는 보기**로 읽는다. LOT별 보기는 품목이 있어야 성립한다
 * (위 파일 주석). 탭을 비활성으로 두는 것만으로는 클릭 경로만 막힌다 — 이 화면은 주소가
 * 조건의 정본이라 주소 진입(북마크·공유·뒤로가기)과 품목 조건 제거로도 같은 자리에 닿는다.
 * 그래서 읽는 자리에서 막는다.
 */
export const resolveViewAxis = (raw: string | null, hasItemFilter: boolean): ViewAxis => {
  const requested = readViewAxis(raw);

  return requested === 'lot' && !hasItemFilter ? DEFAULT_VIEW : requested;
};

/** 계약이 받는 묶는 축. 품목별은 키 자체가 생기지 않는다(계약 기본값). */
export interface GroupByQuery {
  groupBy?: 'LOT' | 'LOCATION';
}

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
 * 그 보기의 그룹 헤더 축. 품목별에 그룹이 없는 이유: 행 하나가 곧 품목이라 묶으면 그룹마다
 * 행이 하나씩 남는다.
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
