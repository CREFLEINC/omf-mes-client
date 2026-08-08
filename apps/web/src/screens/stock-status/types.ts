import type { components } from '@omf-mes/api-client';

/**
 * W-01-07 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 *
 * 이 화면은 **읽기만 한다.** 계약에 `PUT /trace/lots/{lotId}` 같은 쓰기 오퍼레이션이 있으나
 * 이 화면은 부르지 않는다 — 재고 현황 조회이지 편집 화면이 아니다.
 *
 * 이 파일은 이 화면이 소유한다. **다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다** —
 * 형태가 같아도 리소스 이름이 박힌 타입을 공유하면 한 화면의 계약 변화가 다른 화면을 끌고 간다.
 */

type InventoryBalanceResponse = components['schemas']['InventoryBalance'];

export type PageMeta = components['schemas']['PageMeta'];

/** 계약이 정한 묶는 축. 응답의 각 행이 어느 축으로 묶였는지 스스로 말한다. */
export type BalanceGroupBy = InventoryBalanceResponse['groupBy'];

/**
 * 화면이 다루는 재고 잔액 한 줄. 계약 응답과 같되 **선택 필드가 전부 `null`로 모인다.**
 *
 * 키가 없는 경우와 `null`인 경우를 화면이 갈라 다루면 같은 「받지 못했다」가 두 갈래로 흩어지고,
 * 대시·고유 표기 판정이 자리마다 달라진다.
 *
 * **이름 필드가 하나도 없다** — 전부 내부 번호다. 그래서 이 화면의 참조가 여섯이다
 * (창고·위치·품목·LOT·단위·소유처). 계약 개선(응답에 `lotNo`·`itemCode`·`locationCode` 포함)을
 * 이슈에 요청해 두었으며, 반영되면 참조 셋이 통째로 사라진다.
 */
export interface BalanceView {
  groupBy: BalanceGroupBy;
  /** 축을 하나도 접지 않은 줄에만 있다. 묶인 줄에는 없다 — 행 식별자로 쓸 수 없다. */
  inventoryBalanceId: number | null;
  warehouseId: number | null;
  /** `groupBy`가 `LOCATION`일 때 채워진다. */
  locationId: number | null;
  itemId: number;
  /**
   * `groupBy`가 `LOT`일 때 채워진다.
   *
   * **`null`이 확정된 뜻을 갖는 자리다**(계획 결정 10) — 품목별·위치별 보기에서 비는 것이
   * 정상이므로 「알 수 없음」이 아니라 「(LOT 무관)」으로 적는다.
   */
  lotId: number | null;
  qualityStatusCode: string | null;
  inventoryStatusCode: string | null;
  ownershipTypeCode: string;
  /**
   * 소유가 자사가 아닐 때의 거래처.
   *
   * **`null`이 확정된 뜻을 갖는 둘째 자리다** — 「(자사 소유)」로 적는다.
   */
  ownerPartnerId: number | null;
  onHandQty: number;
  reservedQty: number;
  pickedQty: number;
  blockedQty: number;
  /**
   * 보유 − 예약 − 피킹 − 보류. **서버가 계산해 내려보낸다**(계약에서 `readonly`).
   * 화면이 다시 빼지 않는다 — 이슈 #21 §6의 금지 항목이다.
   */
  availableQty: number;
  uomId: number;
  /** 이 줄에 포함된 보류 LOT 수. 계약이 세어 주므로 화면이 따로 세지 않는다. */
  heldLotCount: number | null;
  lastTransactionAt: string | null;
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
  ownershipTypeCode: data.ownershipTypeCode,
  ownerPartnerId: data.ownerPartnerId ?? null,
  onHandQty: data.onHandQty,
  reservedQty: data.reservedQty,
  pickedQty: data.pickedQty,
  blockedQty: data.blockedQty,
  /* 서버가 준 값을 그대로 옮긴다. 빼는 식이 이 슬라이스 어디에도 없다. */
  availableQty: data.availableQty,
  uomId: data.uomId,
  /* 0과 「없음」을 가른다 — 0은 서버가 세어 본 결과이고 없음은 세어 주지 않은 것이다. */
  heldLotCount: data.heldLotCount ?? null,
  lastTransactionAt: data.lastTransactionAt ?? null,
});

/**
 * 식별자 한 조각을 키 문자열로 옮긴다.
 *
 * **이 슬라이스에서 내부 번호를 문자열로 만드는 유일한 자리다.** 여기서 나온 값은 React key와
 * 그룹 키로만 쓰이며 **셀 텍스트가 되지 않는다** — 표시되는 값으로 옮기는 자리를 두지 않는 것이
 * #44를 구조로 막는 형태이고, 만드는 자리를 하나로 모아 두면 그 사실을 한눈에 확인할 수 있다.
 */
const toIdentityKey = (value: string | number | null): string =>
  value === null ? '-' : String(value);

/**
 * 표의 행 식별자(React key).
 *
 * `inventoryBalanceId`는 **축을 하나도 접지 않은 줄에만** 있어 그것만으로는 키가 겹친다 —
 * 겹치면 쪽을 넘길 때 앞 쪽의 행이 남아 보인다. 그래서 행을 가르는 축 전부를 잇는다.
 */
export const toRowKey = (row: BalanceView): string =>
  [
    toIdentityKey(row.itemId),
    toIdentityKey(row.lotId),
    toIdentityKey(row.locationId),
    toIdentityKey(row.qualityStatusCode),
    toIdentityKey(row.inventoryStatusCode),
    toIdentityKey(row.ownershipTypeCode),
    toIdentityKey(row.ownerPartnerId),
  ].join(':');

/**
 * 1단 그룹 헤더가 줄을 묶는 키.
 *
 * **이름이 아니라 축의 식별자로 묶는다.** 이름으로 묶으면 아직 못 푼 줄들이 「알 수 없음」
 * 한 덩어리로 뭉쳐, 서로 다른 품목이 한 그룹으로 보인다. 보이는 이름은 그룹 헤더가
 * 그 그룹의 첫 줄에서 따로 푼다 — 키를 되짚어 숫자로 되돌리는 자리를 만들지 않는다.
 */
export const toGroupKey = (row: BalanceView, axis: 'item' | 'location'): string =>
  toIdentityKey(axis === 'item' ? row.itemId : row.locationId);

/** 목록 조회 결과. `page`는 쪽 이동과 위치 표시의 정본이다. */
export interface BalanceListResult {
  items: BalanceView[];
  page: PageMeta;
}

/**
 * 선택 목록의 원본 항목.
 *
 * **사용 여부는 선택지를 거르는 데 쓰지 않고 표식을 붙이는 데 쓴다.** 이 화면은 조회 전용이고
 * 과거 재고가 지금은 쓰지 않는 창고·위치·품목을 참조할 수 있다 — 미사용 값을 빼면 그 재고를
 * 조건으로 찾을 방법이 사라진다. 표식을 붙이는 자리는 `screen.tsx`의 `toSelectOptions`
 * 한 곳이고, 표의 이름 칸에는 붙이지 않는다(저장소 관례 — `ReferenceState`가 사용 여부를
 * 나르지 않는다).
 */
export interface LookupEntry {
  value: string;
  label: string;
  isActive: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}
