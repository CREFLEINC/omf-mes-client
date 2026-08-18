import type { components } from '@omf-mes/api-client';

/**
 * W-01-12 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이
 * 유지된다.
 *
 * 이 회차가 다루는 것은 **읽기뿐**이다 — 실사 목록 · 실사 차이 라인 · 재고 잔액 · 참조 다섯.
 * 등록·상신·전기는 뒤따르는 회차가 붙인다.
 *
 * 이 파일은 이 화면이 소유한다. **다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다** —
 * 형태가 같아도 리소스 이름이 박힌 타입을 공유하면 한 화면의 계약 변화가 다른 화면을 끌고 간다.
 */

type InventoryCountResponse = components['schemas']['InventoryCount'];
type InventoryCountLineResponse = components['schemas']['InventoryCountLine'];

export type PageMeta = components['schemas']['PageMeta'];

/** 값 목록이 확정되지 않은 코드. 이 회차가 쓰는 것은 헤더 사유 하나다(D-9). */
export type StockAdjustCodeKey = 'reason';

/**
 * 원천으로 고를 수 있는 실사 하나.
 *
 * **창고를 함께 든다.** 실사를 고르면 그 창고가 위치 이름 풀이의 축이 된다 —
 * 계약이 위치 조회에 창고를 필수 조건으로 요구하기 때문이다.
 *
 * **상태 코드를 담지 않는다.** 이 화면은 실사 상태로 분기하지 않고(공유계약 G-2) 선택칸에
 * 그리지도 않는다 — 자리를 두면 값으로 거르고 싶어지는 자리가 생긴다.
 */
export interface CountOptionView {
  /** 선택칸의 값이자 라인 조회의 경로 조각. **글자로 그리지 않는다**(`omf-mes#44`) */
  inventoryCountId: number;
  /** 업무 번호 — 사람에게 보인다 */
  inventoryCountNo: string;
  /** 위치 이름 풀이와 잔액 조회의 축 */
  warehouseId: number;
  /** 같은 번호를 여러 번 본 사용자가 어느 실사인지 가리는 값 */
  plannedDate: string;
}

/** 실사 응답 하나를 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toCountOptionView = (data: InventoryCountResponse): CountOptionView => ({
  inventoryCountId: data.inventoryCountId,
  inventoryCountNo: data.inventoryCountNo,
  warehouseId: data.warehouseId,
  plannedDate: data.plannedDate,
});

/**
 * 실사 차이 한 줄 — **조정 대상으로 승계될 값**이다.
 *
 * **실물(`countedQty`)을 옮기지 않는다**(D-5). 실물은 「장부 + 차이」로 파생하는 값이고,
 * 사용자가 차이를 고치는 순간 응답의 실물은 낡는다 — 자리를 두면 두 값이 갈린 채로 그려진다.
 * 처음 승계한 시점에는 계약이 준 셋이 서로 맞으므로(`varianceQty = countedQty − systemQty`)
 * 파생 값이 곧 계약 값이다.
 */
export interface CountVarianceLineView {
  /** 승계 근거이자 등록 본문의 원천 라인 번호(뒤따르는 회차가 싣는다) */
  inventoryCountLineId: number;
  locationId: number;
  itemId: number;
  lotId: number | null;
  uomId: number;
  /**
   * 장부 수량 — 이 갈래에서는 잔액 조회 없이 이 값이 곧 장부다(D-6).
   *
   * ⚠ **없이 올 수 있다.** 계약은 이 값을 필수로 두면서 설명에 「블라인드 실사에서는
   * 내려보내지 않는다」를 적었다 — 생성 타입은 `number`라 **타입 검사가 잡지 못한다.**
   * 그대로 믿으면 장부 칸에 `undefined`가, 실물 칸에 `NaN`이 선다. 실사 목록을 좁히지
   * 않으므로(그 조건으로 거르면 고를 수 있어야 할 실사가 사라진다) 블라인드 실사가 선택칸에
   * 실제로 오른다.
   */
  systemQty: number | null;
  /** 실물 − 장부. **서버가 계산한 값이고 화면이 다시 빼지 않는다** */
  varianceQty: number;
  /** 실사에서 적은 사유. **읽기 전용 표기 전용이고 보내지 않는다**(D-7) */
  varianceReasonCode: string | null;
}

/** 실사 라인 한 줄을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toCountVarianceLineView = (
  data: InventoryCountLineResponse,
): CountVarianceLineView => ({
  inventoryCountLineId: data.inventoryCountLineId,
  locationId: data.locationId,
  itemId: data.itemId,
  lotId: data.lotId ?? null,
  uomId: data.uomId,
  /* 없이 오는 길이 실재한다(블라인드 실사) — 값의 유무를 여기서 한 번에 갈라 둔다. */
  systemQty: data.systemQty ?? null,
  varianceQty: data.varianceQty,
  varianceReasonCode: data.varianceReasonCode ?? null,
});

/**
 * 조정 라인 한 줄의 초안.
 *
 * **`key`가 이 타입의 중심이다.** 표의 `getRowId`가 이 값을 쓴다 — 인덱스가 키가 되면
 * 앞 줄이 사라질 때 치고 있던 칸의 DOM 노드가 대신 지워져 입력과 포커스가 다른 줄로 옮겨 붙는다.
 *
 * **입력으로 드는 수량은 차이 하나뿐이다**(D-5 · 조심 ③). 장부는 갈래에 따라 실사가 주거나
 * 잔액 조회가 주고, 실물은 둘을 더한 파생이라 이 타입에 자리가 없다 — 자리가 없으면 실물이
 * 입력칸이 되는 길도 없다.
 */
export interface AdjustLineDraft {
  /** 안정 키. 서버로 나가지 않는다 — 한 화면 안에서만 유일하면 된다 */
  key: string;
  /** 실사에서 승계한 줄이면 그 실사 라인 번호, 직접 등록 줄이면 `null` */
  countLineId: number | null;
  /** 실사가 함께 준 장부 수량. 직접 등록 줄은 `null`이고 잔액 조회가 장부를 낸다(D-6) */
  countSystemQty: number | null;
  /** 실사에서 적은 사유. **보이기만 한다**(D-7) */
  countReasonCode: string | null;
  locationId: string;
  itemId: string;
  /** 비어 있는 것이 정상이다 — LOT 관리를 하지 않는 품목이 실재한다 */
  lotId: string;
  uomId: string;
  /** 친 글자 그대로. **음수와 「-」 같은 미완성 입력이 지나는 자리다** */
  adjustmentQtyText: string;
}

/**
 * 선택 목록의 원본 항목.
 *
 * **사용 여부로 선택지를 거르지 않고 표식만 붙인다** — 지금은 쓰지 않는 위치·품목을 참조하는
 * 과거 자료가 실제로 있고, 빼면 그 값의 이름을 풀 방법이 사라진다.
 */
export interface LookupEntry {
  value: string;
  label: string;
  isActive: boolean;
}

/**
 * 자재 LOT 항목 — **어느 품목의 LOT인지 함께 든다.**
 *
 * 이름 풀이는 받은 전체로 하고 **선택지만 그 줄의 품목으로 좁힌다**(사본 체크리스트 10번).
 * 좁힌 목록을 이름 풀이에도 쓰면 좁힘 밖의 정상 LOT이 「알 수 없음」으로 보인다.
 */
export interface LotLookupEntry extends LookupEntry {
  itemId: string;
}

export interface SelectOption {
  value: string;
  label: string;
}
