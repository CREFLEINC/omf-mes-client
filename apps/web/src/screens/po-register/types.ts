import type { components } from '@omf-mes/api-client';

/**
 * W-01-11 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 *
 * 이 회차가 다루는 것은 **읽기 하나**(입하 상세)와 **쓰기 하나**(등록), 그리고 그 응답이다.
 * 승인 요청은 뒤따르는 회차에서 붙는다.
 *
 * 이 파일은 이 화면이 소유한다. **다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다** —
 * 형태가 같아도 리소스 이름이 박힌 타입을 공유하면 한 화면의 계약 변화가 다른 화면을 끌고 간다.
 */

type InboundReceiptResponse = components['schemas']['InboundReceipt'];
type InboundReceiptLineResponse = components['schemas']['InboundReceiptLine'];
type PurchaseOrderDetailResponse = components['schemas']['PurchaseOrderDetailResponse'];

export type PageMeta = components['schemas']['PageMeta'];

/**
 * 넘어온 초과 입하 전표의 머리. **화면이 쓰는 값만 옮긴다.**
 *
 * `inboundReceiptId`를 담지 않는다 — 그 번호는 주소가 들고 있고, 타입에 자리를 두지 않으면
 * 화면으로 샐 경로도 없다(`omf-mes#44`). 조회 경로를 만드는 데 필요한 값은 주소에서 곧바로 온다.
 *
 * `supplierId`·`plantId`는 그리지 않지만 남긴다 — **승계의 원천**이라 발주 정보의 기본값이
 * 여기서 나온다. 이름은 참조 조회가 푼다.
 */
export interface SourceReceiptView {
  /** 업무 번호 — 사람에게 보인다 */
  inboundReceiptNo: string;
  /** 승계 원천 */
  supplierId: number;
  /** 승계 원천 */
  plantId: number;
  /** 값으로 분기하지 않고 그대로 보인다(공유계약 G-2) */
  statusCode: string;
}

/**
 * 넘어온 전표의 라인 한 줄.
 *
 * **`purchaseOrderLineId`를 옮기지 않는다.** 그 값이 비었는지로 「초과분인가」를 판정하고 싶어지는
 * 자리인데, 계약이 그 사실을 내려주지 않으므로 화면은 판정하지 않는다(계획 결정 3).
 * 타입에 자리가 없으면 그 판정이 되살아날 길도 없다.
 */
export interface SourceLineView {
  inboundReceiptLineId: number;
  lineNo: number;
  itemId: number;
  /** 승계 수량 = 발주수량의 하한(계획 결정 5) */
  receivedQty: number;
  uomId: number;
}

/** 입하 상세 응답. **요청 1회로 머리와 라인이 함께 온다.** */
export interface SourceReceiptResult {
  receipt: SourceReceiptView;
  lines: SourceLineView[];
}

/** 응답 머리를 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toSourceReceiptView = (data: InboundReceiptResponse): SourceReceiptView => ({
  inboundReceiptNo: data.inboundReceiptNo,
  supplierId: data.supplierId,
  plantId: data.plantId,
  statusCode: data.statusCode,
});

/** 응답 라인 한 줄을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toSourceLineView = (data: InboundReceiptLineResponse): SourceLineView => ({
  inboundReceiptLineId: data.inboundReceiptLineId,
  lineNo: data.lineNo,
  itemId: data.itemId,
  receivedQty: data.receivedQty,
  uomId: data.uomId,
});

/**
 * 라인 바깥의 초안 — 발주 머리에 실릴 값이다.
 *
 * **친 글자를 그대로 들고 있는다.** 날짜를 `Date`로 강제해 들고 있으면 아직 완성되지 않은
 * 입력(`2026-08-0`)이 그 자리에서 사라진다. 번호도 문자열로 든다 — 선택칸의 「고르지 않음」이
 * 빈 문자열 하나여야 값이 없는 상태가 한 가지로 남는다.
 *
 * **상태·ERP 발주번호 칸이 없다.** 상태는 서버가 정하고(계획 결정 7), ERP 발주번호는 계약에
 * 쓰는 경로 자체가 없다(계획 결정 6) — 칸이 없으면 보낼 수도 없다.
 */
export interface HeaderDraft {
  supplierId: string;
  businessUnitId: string;
  plantId: string;
  orderDate: string;
  expectedReceiptDate: string;
}

export const EMPTY_HEADER_DRAFT: HeaderDraft = {
  supplierId: '',
  businessUnitId: '',
  plantId: '',
  orderDate: '',
  expectedReceiptDate: '',
};

/**
 * 넘어온 전표에서 발주 머리의 기본값을 세운다.
 *
 * **넘어온 전표에 있는 값만 채운다.** 사업부는 입하 전표에 없고 발주일은 사용자가 정하는 값이라
 * 비운 채로 둔다 — 지어내면 사용자가 확인하지 않은 값이 되돌릴 수 없는 전표에 실린다.
 *
 * **전표 객체가 아니라 승계할 두 값을 받는다.** 이 초안을 되세우는 축이 무엇인지가 시그니처에
 * 드러나야 한다 — 응답 객체를 받으면 화면이 그 객체를 되돌림 축으로 삼게 되고, 같은 값이
 * 다시 와도(재조회) 친 값이 말없이 되돌아간다(전례가 머리 초안의 축을 좁혀 둔 이유).
 */
export const seedHeaderDraft = (supplierId: number, plantId: number): HeaderDraft => ({
  ...EMPTY_HEADER_DRAFT,
  supplierId: String(supplierId),
  plantId: String(plantId),
});

/**
 * 지금 화면이 세워야 할 머리 초안 — **승계 원천이 반쪽이면 빈 초안이다.**
 *
 * **초안을 세우는 자리와 「친 값이 있는가」를 견주는 자리가 이 함수를 함께 쓴다.** 두 자리가
 * 서로 다른 기준을 쓰면 아무것도 치지 않았는데 버리기 확인 창이 열리거나, 친 값이 확인 없이 사라진다.
 */
export const headerSeed = (supplierId: number | null, plantId: number | null): HeaderDraft =>
  supplierId === null || plantId === null
    ? EMPTY_HEADER_DRAFT
    : seedHeaderDraft(supplierId, plantId);

/**
 * 승계 상태에서 **달라진 값이 있는가**.
 *
 * 「무엇이든 만졌는가」를 깃발로 들지 않는다 — 쳤다가 되돌린 사용자에게 「버릴 것이 있다」로
 * 말하게 되고, 그 창은 아무것도 잃지 않는 조작에 확인을 받는 창이 된다.
 */
export const isHeaderEdited = (draft: HeaderDraft, seed: HeaderDraft): boolean =>
  draft.supplierId !== seed.supplierId ||
  draft.businessUnitId !== seed.businessUnitId ||
  draft.plantId !== seed.plantId ||
  draft.orderDate !== seed.orderDate ||
  draft.expectedReceiptDate !== seed.expectedReceiptDate;

/**
 * 발주 라인 한 줄의 초안.
 *
 * **`key`가 이 타입의 중심이다.** 표의 `getRowId`가 이 값을 쓴다 — 인덱스가 키가 되면
 * 앞 줄이 사라질 때 치고 있던 칸의 DOM 노드가 대신 지워져 입력과 포커스가 다른 줄로 옮겨 붙는다.
 *
 * **승계 근거를 줄이 들고 있다.** `sourceLineId`·`sourceQty`가 있는 줄만 하한 판정을 받는다 —
 * 사용자가 더한 줄에는 승계 근거가 없어 하한도 없다(계획 결정 5).
 */
export interface LineDraft {
  /** 안정 키. 서버로 나가지 않는다 — 한 화면 안에서만 유일하면 된다 */
  key: string;
  /** 승계 줄이면 입하 라인 번호, 사용자가 더한 줄이면 `null` */
  sourceLineId: number | null;
  /** 승계 수량 — 하한 판정의 근거(계획 결정 5) */
  sourceQty: number | null;
  itemId: string;
  orderedQty: string;
  uomId: string;
  toleranceOverQty: string;
  toleranceUnderQty: string;
}

/**
 * 만들어진 발주 — **결과 구획이 그리는 것 전부**다.
 *
 * **내부 번호를 담지 않는다**(`omf-mes#44`). 상신에 필요한 번호는 이 타입 밖에 두고(`PoDetailResult`)
 * 화면 상태로만 든다 — 표시 타입에 자리가 없으면 사람이 읽는 자리로 샐 경로도 없다.
 *
 * `statusCode`는 **서버가 준 글자 그대로**다. 「등록 완료」로 옮겨 적지 않는다(공유계약 G-2) —
 * 값 목록이 확정되지 않아 뜻을 옮길 근거가 없다.
 */
export interface CreatedPoView {
  /** 업무 번호 — 사용자가 나중에 이 전표를 찾는 값이라 보이는 것이 맞다 */
  purchaseOrderNo: string;
  /** **등록 시점의** 상태. 그 뒤 상신·승인으로 달라진다 — 라벨이 시점을 밝힌다 */
  statusCode: string;
  /** 비어 있으면 `null` — 「미매칭」 갈래다. 없음·`null`·빈 글자를 한 값으로 접는다 */
  erpPurchaseOrderNo: string | null;
  /** 서버가 되돌려 준 줄 수. 화면이 보낸 줄이 아니다 */
  lineCount: number;
}

/**
 * 등록 응답 하나가 낳는 두 값.
 *
 * **번호와 표시를 갈라 둔다** — 상신(뒤따르는 회차)이 필요로 하는 것은 내부 번호이고, 결과
 * 구획이 필요로 하는 것은 표시 타입이다. 한 타입에 뭉개면 내부 번호가 그리는 자리까지 따라간다.
 */
export interface PoDetailResult {
  /** 상신에만 쓴다. 화면 상태로 들고 **그리지 않는다** */
  purchaseOrderId: number;
  created: CreatedPoView;
}

/** 값이 없다고 볼 글자. 공백만인 번호는 **채워지지 않은 것**이다. */
const isBlank = (value: string | null | undefined): boolean =>
  value === null || value === undefined || value.trim() === '';

/** 등록 응답을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toPoDetailResult = (data: PurchaseOrderDetailResponse): PoDetailResult => ({
  purchaseOrderId: data.purchaseOrder.purchaseOrderId,
  created: {
    purchaseOrderNo: data.purchaseOrder.purchaseOrderNo,
    statusCode: data.purchaseOrder.statusCode,
    erpPurchaseOrderNo: isBlank(data.purchaseOrder.erpPurchaseOrderNo)
      ? null
      : /* 위에서 빈 값을 걸렀으므로 값이 있다. 공백은 표기 사고를 막으려고 다듬는다. */
        (data.purchaseOrder.erpPurchaseOrderNo ?? '').trim(),
    lineCount: data.lines.length,
  },
});

/**
 * 선택 목록의 원본 항목.
 *
 * **사용 여부로 선택지를 거르지 않고 표식만 붙인다** — 지금은 쓰지 않는 거래처·품목을 참조하는
 * 과거 자료가 실제로 있고, 빼면 그 값의 이름을 풀 방법이 사라진다.
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
