import type { components } from '@omf-mes/api-client';

/**
 * W-01-12 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이
 * 유지된다.
 *
 * 이 회차가 다루는 것은 **읽기와 등록과 상신과 전기**다 — 실사 목록 · 실사 차이 라인 ·
 * 재고 잔액 · 참조 다섯 · 조정 전표 등록 · 결재 상신과 그 진행 조회 · **재고 전기**.
 * 처리 이력은 뒤따르는 회차가 붙인다.
 *
 * 이 파일은 이 화면이 소유한다. **다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다** —
 * 형태가 같아도 리소스 이름이 박힌 타입을 공유하면 한 화면의 계약 변화가 다른 화면을 끌고 간다.
 */

type InventoryCountResponse = components['schemas']['InventoryCount'];
type InventoryCountLineResponse = components['schemas']['InventoryCountLine'];
type InventoryAdjustmentDetailResponse = components['schemas']['InventoryAdjustmentDetailResponse'];

/** 승인 요청 상세 — 계약이 **단계 배열을 함께 내려** 화면이 두 번 부르지 않는다. */
export type ApprovalRequestDetailResponse = components['schemas']['ApprovalRequestDetail'];
export type ApprovalStepResponse = components['schemas']['ApprovalStep'];

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
 * 조정 머리의 초안 — **계약이 등록에서 받는 두 값**이다(`reasonCode`·`sendToErp`).
 *
 * **상신 사유(`reason`)를 여기 담지 않는다**(D-8). 헤더 사유는 **코드**(값 목록 미확정)이고
 * 상신 사유는 **자유 텍스트**다 — 둘이 한 자루에 있으면 어느 것이 결재함 요약을 겸하는지
 * 화면에서 갈리지 않는다. 상신 사유는 뒤따르는 회차가 제 자리에 든다.
 *
 * **전표번호·상태를 담지 않는다** — 서버가 정한다(계약 스키마 설명).
 */
export interface AdjustHeaderDraft {
  /** 헤더 사유 코드. **고를 값 목록이 아직 비어 있다**(D-9 · 미결 #64) */
  reasonCode: string;
  /**
   * ERP 송신 여부 — **토글의 상태가 곧 계약 필드다**(D-11 · 미결 #66).
   *
   * 자리표시 상수를 두지 않는다: 계약이 이 값을 실제로 받고 설명이 「화면의 송신 토글이 이
   * 값이다」로 못 박았다. 연계 **방식**은 서버가 정하는 것이라 화면에 표현할 자리가 없다.
   */
  sendToErp: boolean;
}

/**
 * 아직 아무것도 고르지 않은 머리. **ERP 송신은 계약 기본값과 같은 켬으로 시작한다** —
 * 화면이 기본값을 따로 정하면 계약이 기본을 바꿀 때 두 곳이 갈린다.
 */
export const emptyHeaderDraft = (): AdjustHeaderDraft => ({ reasonCode: '', sendToErp: true });

/**
 * 버릴 값이 있는가 — **깃발이 아니라 값으로 견준다**.
 *
 * 쳤다가 되돌린 사용자에게 「버릴 것이 있다」로 말하면, 아무것도 잃지 않는 조작에 확인 창이 뜬다.
 */
export const isHeaderEdited = (draft: AdjustHeaderDraft): boolean => {
  const seeded = emptyHeaderDraft();

  return draft.reasonCode !== seeded.reasonCode || draft.sendToErp !== seeded.sendToErp;
};

/**
 * 만들어진 조정 전표 — **화면이 보이는 값만 담는다.**
 *
 * **내부 번호를 담지 않는다**(`omf-mes#44`). 상신·전기가 쓸 번호는 그 회차가 표시 타입과
 * 갈린 자리에 따로 든다 — 그리는 값과 같은 자루에 있으면 사람이 읽는 자리로 새는 경로가
 * 먼저 생긴다.
 *
 * **상태 코드를 뜻으로 옮기지 않는다**(공유계약 G-2). 서버가 준 글자를 그대로 든다.
 */
export interface CreatedAdjustmentView {
  /** 업무 번호 — 사용자가 나중에 이 전표를 찾을 때 쓴다 */
  inventoryAdjustmentNo: string;
  /** 등록 시점의 상태 코드 **그대로** */
  statusCode: string;
  /**
   * ERP 송신 **대기열 적재** 여부.
   *
   * 계약이 선택으로 두어 **오지 않는 갈래가 따로 있다** — `?? false`로 접으면 아무 근거 없이
   * 「적재되지 않았다」로 읽힌다(C23).
   */
  erpMessageQueued: boolean | null;
  /** **서버가 저장한** 라인 수. 화면이 센 수가 아니다 */
  lineCount: number;
}

/** 등록 201 응답을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toCreatedAdjustmentView = (
  data: InventoryAdjustmentDetailResponse,
): CreatedAdjustmentView => ({
  inventoryAdjustmentNo: data.inventoryAdjustment.inventoryAdjustmentNo,
  statusCode: data.inventoryAdjustment.statusCode,
  /* 없이 오는 길이 실재한다(계약 선택 필드) — 값의 유무를 여기서 한 번에 갈라 둔다. */
  erpMessageQueued: data.inventoryAdjustment.erpMessageQueued ?? null,
  lineCount: data.lines.length,
});

/**
 * 등록 응답 하나가 낳는 **두 값**.
 *
 * **번호와 표시를 갈라 둔다** — 상신이 필요로 하는 것은 **내부 번호**(경로 조각과 잠금 토큰의
 * 열쇠)이고, 결과 구획이 필요로 하는 것은 **표시 타입**이다. 한 타입에 뭉개면 내부 번호가
 * 그리는 자리까지 따라간다(`omf-mes#44` · 전례 `po-register`의 `PoDetailResult`와 같은 형태).
 */
export interface CreatedAdjustmentResult {
  /** 상신 경로와 `If-Match` 열쇠에만 쓴다. 화면 상태로 들고 **그리지 않는다** */
  inventoryAdjustmentId: number;
  created: CreatedAdjustmentView;
}

/**
 * 등록 201을 **두 값으로** 옮기는 유일한 지점이다.
 *
 * ⛔ **응답의 `approvalRequestId`·`adjustedAt`을 옮기지 않는다.** 목이 그 둘을 계약 예시값으로
 * 채워 주므로(계획 §5.2.5) 옮기면 방금 만든 전표가 「이미 상신·전기된 것」으로 그려진다 —
 * 화면이 확인하지 않은 사실이다. **상신 여부는 이 화면이 받은 202가 정한다**(D-13).
 */
export const toCreatedAdjustmentResult = (
  data: InventoryAdjustmentDetailResponse,
): CreatedAdjustmentResult => ({
  inventoryAdjustmentId: data.inventoryAdjustment.inventoryAdjustmentId,
  created: toCreatedAdjustmentView(data),
});

/**
 * 전기 200이 준 것 가운데 **화면이 쓰는 값**.
 *
 * ⛔ **전표번호를 담지 않는다.** 화면이 보이는 번호는 **매임이 든 것**이라야 한다 — 응답이 준
 * 번호를 그리면 매임이 끊긴 전기의 번호가 지금 보고 있는 전표 자리에 선다(D-15).
 *
 * ⛔ **승인 요청 번호를 담지 않는다** — 목이 그 값을 채워 준다(계획 §5.2.5). 상신 여부의 근거는
 * 이 화면이 받은 **202** 하나다.
 */
export interface PostedAdjustmentView {
  /**
   * 서버가 준 전기 시각 **그대로**.
   *
   * ⚠ **없이 올 수 있다** — 계약이 이 값을 nullable로 두었다. 값의 유무를 여기서 한 번에 갈라
   * 두면 「전기됐는가」의 판정(`readPosting`)이 그 한 자리에서 끝난다(C35).
   */
  adjustedAt: string | null;
  /**
   * 전기 뒤 상태 코드 **그대로**(공유계약 G-2).
   *
   * ⛔ **이 값으로 전기 여부를 판정하지 않는다**(C35) — 값 목록이 확정되지 않았고(`omf-mes#64`)
   * 계약이 문자열 비교를 금지했다. 보이기만 한다.
   */
  statusCode: string;
}

/** 전기 200을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toPostedAdjustmentView = (
  data: components['schemas']['InventoryAdjustment'],
): PostedAdjustmentView => ({
  /* 없이 오는 길이 실재한다(계약이 nullable로 두었다) — 값의 유무를 여기서 한 번에 갈라 둔다. */
  adjustedAt: data.adjustedAt ?? null,
  statusCode: data.statusCode,
});

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

/**
 * 사람이 읽는 이름 — **이름 자리가 전부 이 판정 하나를 지난다.**
 *
 * 상신자·승인자 이름은 계약이 필수로 두었으나 **빈 문자열도 공백만인 값도 스키마를 통과한다.**
 * 그때 화면은 번호를 대신 내지 않고 그 사실을 적는다(`omf-mes#44`).
 *
 * **판정을 한 자리에 두는 이유**: 자리마다 따로 적으면 한쪽은 `=== ''`이고 다른 쪽은 `.trim()`이
 * 되어, 같은 요청이 어디서는 빈 칸으로 어디서는 안내로 보인다.
 *
 * **이름 안의 공백은 건드리지 않는다.** 판정에만 다듬기를 쓰고 값은 실려 온 그대로 낸다.
 */
export const readableName = (value: string, whenMissing: string): string =>
  value.trim() === '' ? whenMissing : value;

/** 계약의 date-time 문자열에서 표기용 조각을 뽑는다. */
const RFC3339_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

/**
 * 결재 진행이 보이는 시각.
 *
 * **실행 환경 시간대로 옮기지 않는다.** 문자열에 실려 온 offset은 그 일이 일어난 곳의 시각이고,
 * 보는 사람의 시간대로 옮기면 같은 요청이 사람마다 다른 시각으로 보인다.
 *
 * **형식이 아니면 원문을 그대로 낸다.** 서버가 보낸 값을 화면이 삼키지 않는다 — 「—」로 바꾸면
 * 값이 없는 것과 못 알아본 것이 구분되지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 함수를 참조하지 않는다.
 */
export const formatDateTime = (value: string): string => {
  const matched = RFC3339_PATTERN.exec(value);

  if (matched === null) return value;

  return `${matched[1] ?? ''} ${matched[2] ?? ''}`;
};
