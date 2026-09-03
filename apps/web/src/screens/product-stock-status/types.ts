import type { components } from '@omf-mes/api-client';

/**
 * W-04-08 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이
 * 유지된다.
 *
 * 이 화면은 **읽기만 한다.** 계약에 `PUT /trace/lots/{lotId}` 같은 쓰기 오퍼레이션이 있으나
 * 이 화면은 부르지 않는다 — 완제품 재고·Lot Status 조회이지 편집 화면이 아니다.
 *
 * ⚠ **계약 형편에 관한 중요한 사실 — 인라인 이름이 아직 없다.** 이 화면의 계획은
 * `InventoryBalance`가 `itemCode`·`itemName`·`lotNo`·`locationCode`·`earliestExpiryDate`를
 * 인라인으로 주고 `/inventory/balances` 응답에 `summary`·`expiryUnknownCount`가 함께 온다고
 * 가정했다. 실제로 설계 저장소의 OpenAPI 정본(`logistics-01자재창고.json`)에는 그 필드들이
 * 있지만, **이 저장소가 지금 생성해 쓰는 `@omf-mes/api-client`(packages/api-client/src/generated/api.d.ts)에는
 * 아직 반영되지 않았다.** `pnpm gen:api`로 다시 생성해 보면 `quality-03품질.json`과
 * `logistics-01자재창고.json`이 `LotHold` 컴포넌트를 서로 다른 모양으로 정의하고 있어 병합
 * 자체가 실패한다(도구가 스스로 병합을 거부하고 사용자 경유 정보 요청을 안내한다).
 * 그 충돌을 우회해 강제로 재생성해 보면 이 화면과 무관한 화면 40여 개가 `pnpm typecheck`에서
 * 함께 깨진다 — 이 슬라이스 하나를 위해 저장소 전체의 생성물을 갱신하는 것은 계획 범위 밖이다.
 *
 * 그래서 이 파일은 **지금 실제로 생성된 `InventoryBalance`**(창고·품목·LOT·위치·소유처 이름이
 * 전부 내부 번호로만 오는 옛 모양 — W-01-07이 쓰는 것과 같다)를 기준으로 삼는다. 그 결과
 * `lookups.ts`가 창고·품목 둘만이 아니라 품목·LOT·위치·창고 넷을 이름으로 푼다. 계약 생성물이
 * 갱신되면 `itemCode`·`lotNo`·`locationCode`를 직접 쓰도록 이 파일과 `lookups.ts`를 함께
 * 정리하고 참조 훅을 창고·품목 둘로 되돌릴 수 있다.
 *
 * 이 파일은 이 화면이 소유한다. **다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.**
 */

type InventoryBalanceResponse = components['schemas']['InventoryBalance'];
type LotDetailResponse = components['schemas']['LotDetailResponse'];

export type PageMeta = components['schemas']['PageMeta'];

/** 계약이 정한 묶는 축. 응답의 각 행이 어느 축으로 묶였는지 스스로 말한다. */
export type BalanceGroupBy = InventoryBalanceResponse['groupBy'];

/**
 * 화면이 다루는 재고 잔액 한 줄. 계약 응답과 같되 **선택 필드가 전부 `null`로 모인다.**
 *
 * **이름 필드가 하나도 없다** — 전부 내부 번호다(위 파일 주석 참고). 소유처(`ownerPartnerId`)는
 * 이 화면이 조건·표에 쓰지 않는다 — 계획이 정한 열 구성에 소유 칸이 없다.
 */
export interface BalanceView {
  groupBy: BalanceGroupBy;
  /** 축을 하나도 접지 않은 줄에만 있다. 묶인 줄에는 없다 — 행 식별자로 쓸 수 없다. */
  inventoryBalanceId: number | null;
  warehouseId: number | null;
  /** `groupBy`가 `LOCATION`일 때 채워진다. */
  locationId: number | null;
  itemId: number;
  /** `groupBy`가 `LOT`일 때 채워진다. `null`이 확정된 뜻을 갖는 자리다 — 품목별·위치별 보기에서 비는 것이 정상이다. */
  lotId: number | null;
  qualityStatusCode: string | null;
  inventoryStatusCode: string | null;
  onHandQty: number;
  /**
   * 보유 − 예약 − 피킹 − 보류. **서버가 계산해 내려보낸다**(계약에서 `readonly`).
   * 화면이 다시 빼지 않는다.
   */
  availableQty: number;
  blockedQty: number;
  /** 이 줄에 포함된 보류 LOT 수. 계약이 세어 주므로 화면이 따로 세지 않는다. */
  heldLotCount: number | null;
}

/** 응답 한 줄을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toBalanceView = (data: InventoryBalanceResponse): BalanceView => ({
  groupBy: data.groupBy,
  inventoryBalanceId: data.inventoryBalanceId ?? null,
  warehouseId: data.warehouseId ?? null,
  locationId: data.locationId ?? null,
  itemId: data.itemId,
  lotId: data.lotId ?? null,
  qualityStatusCode: data.qualityStatusCode ?? null,
  inventoryStatusCode: data.inventoryStatusCode ?? null,
  onHandQty: data.onHandQty,
  /* 서버가 준 값을 그대로 옮긴다. 빼는 식이 이 슬라이스 어디에도 없다. */
  availableQty: data.availableQty,
  blockedQty: data.blockedQty,
  /* 0과 「없음」을 가른다 — 0은 서버가 세어 본 결과이고 없음은 세어 주지 않은 것이다. */
  heldLotCount: data.heldLotCount ?? null,
});

/**
 * 식별자 한 조각을 키 문자열로 옮긴다. 여기서 나온 값은 React key와 그룹 키로만 쓰이며
 * **셀 텍스트가 되지 않는다** — 표시되는 값으로 옮기는 자리를 두지 않는 것이 내부 번호가
 * 화면에 새는 것을 구조로 막는 형태다.
 */
const toIdentityKey = (value: string | number | null): string =>
  value === null ? '-' : String(value);

/**
 * 표의 행 식별자(React key). `inventoryBalanceId`는 축을 하나도 접지 않은 줄에만 있어
 * 그것만으로는 키가 겹친다 — 행을 가르는 축 전부를 잇는다.
 */
export const toRowKey = (row: BalanceView): string =>
  [
    toIdentityKey(row.itemId),
    toIdentityKey(row.lotId),
    toIdentityKey(row.locationId),
    toIdentityKey(row.qualityStatusCode),
    toIdentityKey(row.inventoryStatusCode),
  ].join(':');

/**
 * 1단 그룹 헤더가 줄을 묶는 키. **이름이 아니라 축의 식별자로 묶는다** — 이름으로 묶으면
 * 아직 못 푼 줄들이 「알 수 없음」 한 덩어리로 뭉쳐, 서로 다른 품목이 한 그룹으로 보인다.
 */
export const toGroupKey = (row: BalanceView, axis: 'item' | 'location'): string =>
  toIdentityKey(axis === 'item' ? row.itemId : row.locationId);

/** 목록 조회 결과. `page`는 쪽 이동과 위치 표시의 정본이다. */
export interface BalanceListResult {
  items: BalanceView[];
  page: PageMeta;
}

/**
 * 해제되지 않은 보류 한 건. **표시하는 열 넷만 옮긴다**(사유·상태·보류 시각·해제 조건) —
 * 계획이 이 화면의 보류 표를 그 넷으로 좁혔다. `holdQty`·`uomId`·`remarks`는 옮기지 않는다
 * (표에 없다). `heldBy`(등록자 번호)도 옮기지 않는다 — 이름을 풀 참조가 이 화면에 없다.
 * `releasedBy`·`releasedAt`도 옮기지 않는다 — 계약이 이 목록을 「해제되지 않은 보류」로
 * 정해 언제나 비어 있다.
 */
export interface LotHoldView {
  lotHoldId: number;
  reasonCode: string;
  statusCode: string;
  heldAt: string;
  releaseCondition: string | null;
}

/**
 * LOT 상세 구획이 쓰는 것 — **해제되지 않은 보류뿐이다.** 계획이 명시적으로 `holds[]`만
 * 쓰라고 정했다 — LOT 속성·수량·외부 식별자는 이 구획의 몫이 아니다(속성은 고른 잔액 줄에서
 * 이미 보이고, 수량은 잔액 표에 있다).
 */
export interface LotDetailView {
  holds: LotHoldView[];
}

/** LOT 상세 응답을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toLotDetailView = (data: LotDetailResponse): LotDetailView => ({
  holds: data.holds.map((hold) => ({
    lotHoldId: hold.lotHoldId,
    reasonCode: hold.reasonCode,
    statusCode: hold.statusCode,
    heldAt: hold.heldAt,
    releaseCondition: hold.releaseCondition ?? null,
  })),
});

export interface SelectOption {
  value: string;
  label: string;
}
