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
type LotDetailResponse = components['schemas']['LotDetailResponse'];
type InventoryTransactionResponse = components['schemas']['InventoryTransaction'];
type InventoryTransactionDetailResponse =
  components['schemas']['InventoryTransactionDetailResponse'];

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
 * 여기서 나온 값은 React key와 그룹 키로만 쓰이며 **셀 텍스트가 되지 않는다** —
 * 표시되는 값으로 옮기는 자리를 두지 않는 것이 #44를 구조로 막는 형태다.
 *
 * **규칙은 하나다 — 번호를 문자열로 만드는 자리는 「기계가 읽는 값」에만 둔다.**
 * React key · 그룹 키 · 주소 값 · 선택지 값처럼 **맞춰 보기 위한 값**이 그것이고,
 * 사람이 읽는 텍스트로 옮기는 자리는 이 슬라이스에 **하나도 없다.** 그것이 #44를 구조로 막는다.
 *
 * **자리를 세지 않는다** — 세면 키가 하나 늘 때마다 주석과 실물이 어긋난다(실제로 두 번
 * 어긋났다). 새 자리를 만들 때 물을 것은 「몇 개째인가」가 아니라 **「이 값이 화면에 글로
 * 서는가」**다. 선다면 그 자리를 만들지 않는다.
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
 * 고른 LOT 한 벌.
 *
 * **수량 다섯은 여기 없다** — 계약의 `Lot`은 만들어질 때의 `initialQty`만 갖고, 지금 얼마나
 * 남았는지는 잔액 응답이 나른다. 상세 구획은 고른 **잔액 줄**에서 수량을 받는다.
 *
 * **내부 번호로만 이어진 필드는 옮기지 않는다** — `plantId`·`sourceId`·`parentLotId`가
 * 그렇다. 이름을 풀 참조를 새로 만들면 이 화면의 참조가 일곱째부터 늘고(계획 결정 9의 표),
 * 풀지 못한 채 내면 번호가 화면으로 샌다(#44). 계보·원천 문서는 이 화면의 질문이 아니다.
 */
export interface LotView {
  lotId: number;
  lotNo: string;
  itemId: number;
  lotTypeCode: string;
  statusCode: string;
  initialQty: number;
  uomId: number;
  manufacturedAt: string | null;
  /** 없는 것이 정상이다(계약에서 `nullable`) — 유효기한을 관리하지 않는 품목이 있다. */
  expiryDate: string | null;
  remarks: string | null;
}

/**
 * 해제되지 않은 보류 한 건.
 *
 * **`releasedBy`·`releasedAt`을 옮기지 않는다** — 계약이 이 목록을 「해제되지 않은 보류」로
 * 정해 언제나 비어 있다. 담아 두면 늘 대시인 열이 생긴다.
 * **`heldBy`도 옮기지 않는다** — 사용자 번호이고 이름을 풀 참조가 이 화면에 없다(#44).
 */
export interface LotHoldView {
  lotHoldId: number;
  reasonCode: string;
  statusCode: string;
  heldAt: string;
  /**
   * **`null`이 확정된 뜻을 갖는 자리다** — 계약이 「비어 있으면 전량 보류」로 적었다.
   * 0은 정반대(아무것도 묶이지 않았다)라 함께 뭉갤 수 없다.
   */
  holdQty: number | null;
  /** 계약상 `holdQty`가 있을 때 함께 온다. 전량 보류에는 견줄 수가 없어 단위도 없다. */
  uomId: number | null;
  releaseCondition: string | null;
  remarks: string | null;
}

/** LOT을 밖에서 부르는 이름. 발급처가 없으면 우리 쪽에서 붙인 번호다. */
export interface LotExternalIdentifierView {
  lotExternalIdentifierId: number;
  identifierTypeCode: string;
  externalIdentifier: string;
  partnerId: number | null;
  externalSystemCode: string | null;
}

export interface LotDetailView {
  lot: LotView;
  externalIdentifiers: LotExternalIdentifierView[];
  holds: LotHoldView[];
}

/** LOT 상세 응답을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toLotDetailView = (data: LotDetailResponse): LotDetailView => ({
  lot: {
    lotId: data.lot.lotId,
    lotNo: data.lot.lotNo,
    itemId: data.lot.itemId,
    lotTypeCode: data.lot.lotTypeCode,
    statusCode: data.lot.statusCode,
    initialQty: data.lot.initialQty,
    uomId: data.lot.uomId,
    manufacturedAt: data.lot.manufacturedAt ?? null,
    expiryDate: data.lot.expiryDate ?? null,
    remarks: data.lot.remarks ?? null,
  },
  externalIdentifiers: data.externalIdentifiers.map((identifier) => ({
    lotExternalIdentifierId: identifier.lotExternalIdentifierId,
    identifierTypeCode: identifier.identifierTypeCode,
    externalIdentifier: identifier.externalIdentifier,
    partnerId: identifier.partnerId ?? null,
    externalSystemCode: identifier.externalSystemCode ?? null,
  })),
  holds: data.holds.map((hold) => ({
    lotHoldId: hold.lotHoldId,
    reasonCode: hold.reasonCode,
    statusCode: hold.statusCode,
    heldAt: hold.heldAt,
    /* 0과 「없음」을 가른다 — 없음은 전량 보류이고 0은 아무것도 묶이지 않았다는 뜻이다. */
    holdQty: hold.holdQty ?? null,
    uomId: hold.uomId ?? null,
    releaseCondition: hold.releaseCondition ?? null,
    remarks: hold.remarks ?? null,
  })),
});

/**
 * 수불 이력 한 줄 — **헤더다.** 계약이 수량·품목·창고를 헤더에 담지 않는다.
 *
 * **번호로만 이어진 필드를 옮기지 않는다** — `plantId`·`sourceDocumentId`·
 * `reversalOfTransactionId`가 그렇다. 담을 자리가 없으면 화면으로 샐 경로도 없다(#44).
 * 특히 `sourceDocumentId`는 원천 전표를 가리키지만 그 이름을 풀 참조가 이 화면에 없다 —
 * 「어느 전표에서 왔는가」는 전표 화면의 질문이다.
 */
export interface TransactionView {
  inventoryTransactionId: number;
  /** **식별자의 일부다** — 이 값 없이는 상세를 부를 수 없다(경로 조각 둘 중 하나). */
  businessDate: string;
  transactionNo: string;
  transactionTypeCode: string;
  sourceDocumentTypeCode: string;
  statusCode: string;
  /** 단말에서 행위가 일어난 시각. 서버가 받은 시각(`recordedAt`)과 벌어질 수 있다. */
  occurredAt: string;
  /**
   * 역처리 거래인가. **대상 거래의 번호를 담지 않는다**(#44) — 그 번호를 이름으로 풀 참조가
   * 이 화면에 없고, 취소가 행을 지우지 않고 역처리 행을 더한다는 사실만 알면 목록을 읽을 수 있다.
   */
  isReversal: boolean;
}

/** 수불 이력 한 줄을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toTransactionView = (data: InventoryTransactionResponse): TransactionView => ({
  inventoryTransactionId: data.inventoryTransactionId,
  businessDate: data.businessDate,
  transactionNo: data.transactionNo,
  transactionTypeCode: data.transactionTypeCode,
  sourceDocumentTypeCode: data.sourceDocumentTypeCode,
  statusCode: data.statusCode,
  occurredAt: data.occurredAt,
  /* 번호가 아니라 **있다·없다**만 옮긴다 — 이 자리에서 번호를 버려야 아래로 새지 않는다. */
  isReversal: (data.reversalOfTransactionId ?? null) !== null,
});

/**
 * 수불 이력 표의 행 식별자(React key).
 *
 * **번호만으로는 행이 겹친다** — 원장이 영업일로 나뉘어 저장되고 계약이 영업일을 식별자의
 * 일부로 두어, **같은 번호가 다른 영업일에 설 수 있다.** 겹치면 React가 두 행을 같은 것으로
 * 보아 쪽을 넘길 때 앞 쪽의 행이 남아 보인다 — `toRowKey`가 축 전부를 잇는 것과 같은 이유다.
 *
 * 표의 JSX 안에 인라인으로 두지 않고 여기 내보내는 이유는 **그 주장을 값으로 고정하기
 * 위해서다** — 인라인이면 키를 한 조각으로 줄여도 아무 단언도 깨지지 않는다(리뷰 M13).
 */
export const toTransactionRowKey = (row: TransactionView): string =>
  [toIdentityKey(row.businessDate), toIdentityKey(row.inventoryTransactionId)].join(':');

/** 이력 조회 결과. `page`는 쪽 이동과 위치 표시의 정본이다. */
export interface TransactionListResult {
  items: TransactionView[];
  page: PageMeta;
}

/**
 * 고른 거래를 가리키는 것. **영업일과 번호가 함께여야 한다** —
 * 계약이 영업일을 식별자의 일부로 두어(원장이 영업일로 나뉜다) 번호만으로는 행을 찾을 수 없다.
 */
export interface TransactionRef {
  businessDate: string;
  transactionId: number;
}

/**
 * 거래 라인 한 줄 — **수량이 여기 있다.** 헤더에는 없다.
 *
 * 옮기지 않는 것: 이동 전후의 품질·재고 상태 코드, 이 거래 직후의 잔액
 * (`fromQtyAfterTransaction`·`toQtyAfterTransaction`), 소유·핸들링 유닛.
 * 이번 화면이 답하는 질문은 「언제 얼마나 어디서 어디로 움직였나」이고, 상태와 시점 잔액은
 * 그 질문의 다음 질문이다 — 열을 늘리면 축 열(품목)이 짓눌린다.
 */
export interface TransactionLineView {
  inventoryTransactionLineId: number;
  lineNo: number;
  itemId: number;
  /** 라인이 LOT을 가리키지 않을 수 있다(LOT 관리 대상이 아닌 품목). */
  lotId: number | null;
  qty: number;
  uomId: number;
  /** 입고 라인에는 출발지가 없다 — 비는 것이 정상이다. */
  fromWarehouseId: number | null;
  fromLocationId: number | null;
  /** 출고 라인에는 도착지가 없다. */
  toWarehouseId: number | null;
  toLocationId: number | null;
}

export interface TransactionDetailView {
  transaction: TransactionView;
  lines: TransactionLineView[];
}

/** 거래 상세 응답을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toTransactionDetailView = (
  data: InventoryTransactionDetailResponse,
): TransactionDetailView => ({
  transaction: toTransactionView(data.inventoryTransaction),
  lines: data.lines.map((line) => ({
    inventoryTransactionLineId: line.inventoryTransactionLineId,
    lineNo: line.lineNo,
    itemId: line.itemId,
    lotId: line.lotId ?? null,
    qty: line.qty,
    uomId: line.uomId,
    fromWarehouseId: line.fromWarehouseId ?? null,
    fromLocationId: line.fromLocationId ?? null,
    toWarehouseId: line.toWarehouseId ?? null,
    toLocationId: line.toLocationId ?? null,
  })),
});

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
