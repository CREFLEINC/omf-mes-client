import type { components } from '@omf-mes/api-client';

import type {
  AdjustLineDraft,
  ApprovalRequestDetailResponse,
  ApprovalStepResponse,
  CountVarianceLineView,
} from './types';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 —
 * 참조하면 예시 값이 배포 번들에 들어간다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다. 이 화면은 실사번호·위치코드·품목코드·LOT 번호처럼
 * **실제로 보일 법한 값**을 그리는 자리라, 한눈에 예시임이 보이는 접두(`SAMPLE-`·`SAMPLE_`)만
 * 쓴다. 실 운영 코드·거래처명·품목코드를 넣지 않는다(공개 저장소 경계).
 *
 * **계약의 예시값(`1001`·`IC-2026-…`·`COUNT_VARIANCE`·`MISPLACED`)을 쓰지 않는다.**
 * 계약 예시가 픽스처로 새어 들어오면 「목이 채워 준 값」과 「화면이 만든 값」이 구분되지 않는다.
 *
 * **내부 번호(FK)는 서로 겹치지 않는 대역으로 나눈다** — 9100대(실사·실사 라인) ·
 * 9200대(창고) · **9300대(조정 전표)** · 9400대(위치) · 9500대(품목) · 9600대(단위) ·
 * 9700대(자재 LOT) · **9800대(승인 요청·결재자)**. 「화면 어디에도 내부 번호가 렌더되지
 * 않는다」를 검사할 때 줄번호·수량 같은 정상 숫자와 헷갈리지 않게 하기 위해서다.
 */

type InventoryCountResponse = components['schemas']['InventoryCount'];
type InventoryCountLineResponse = components['schemas']['InventoryCountLine'];
type InventoryBalanceResponse = components['schemas']['InventoryBalance'];
type InventoryAdjustmentDetailResponse = components['schemas']['InventoryAdjustmentDetailResponse'];
type InventoryAdjustmentLineResponse = components['schemas']['InventoryAdjustmentLine'];
type ApprovalRequestRefResponse = components['schemas']['ApprovalRequestRef'];

const BASE_COUNT: InventoryCountResponse = {
  inventoryCountId: 9101,
  inventoryCountNo: 'SAMPLE-IC-9101',
  countTypeCode: 'SAMPLE_CT_A',
  warehouseId: 9201,
  plannedDate: '2026-08-17',
  blindCount: false,
  statusCode: 'SAMPLE_IC_STATUS_A',
};

/** 한 항목만 다른 건을 만든다. 무엇을 검사하는 테스트인지 그 인자만 보고 읽히게 한다. */
export const countResponse = (
  overrides: Partial<InventoryCountResponse> = {},
): InventoryCountResponse => ({ ...BASE_COUNT, ...overrides });

/**
 * 실사 둘. **주소가 가리키지 않는 실사가 함께 있어야** 「고른 실사만 대상이 된다」를 잴 수 있다.
 * 둘째 실사는 **창고가 다르다** — 실사를 바꾸면 위치 조회의 축도 바뀌는 것을 잴 수 있다.
 */
export const countFixtures: InventoryCountResponse[] = [
  countResponse(),
  countResponse({
    inventoryCountId: 9102,
    inventoryCountNo: 'SAMPLE-IC-9102',
    warehouseId: 9202,
    plannedDate: '2026-08-18',
  }),
];

const BASE_COUNT_LINE: InventoryCountLineResponse = {
  inventoryCountLineId: 9111,
  inventoryCountId: 9101,
  lineNo: 1,
  locationId: 9401,
  itemId: 9501,
  lotId: 9701,
  systemQty: 100,
  countedQty: 98,
  varianceQty: -2,
  uomId: 9601,
  varianceReasonCode: null,
  countedAt: '2026-08-17T09:12:00+09:00',
};

export const countVarianceLineResponse = (
  overrides: Partial<InventoryCountLineResponse> = {},
): InventoryCountLineResponse => ({ ...BASE_COUNT_LINE, ...overrides });

/**
 * 실사 차이 세 줄.
 *
 * - 1행: **줄이는 조정**(차이 음수) — 이 화면의 정상 경로다
 * - 2행: **늘리는 조정**(차이 양수) · LOT이 없다 — 두 갈래를 한 화면에서 잰다
 * - 3행: **차이 0** — 「오류가 아니라 제외」를 실제 값으로 만든다
 */
export const countVarianceLineFixtures: InventoryCountLineResponse[] = [
  countVarianceLineResponse({ varianceReasonCode: 'SAMPLE_VR_A' }),
  countVarianceLineResponse({
    inventoryCountLineId: 9112,
    lineNo: 2,
    itemId: 9502,
    lotId: null,
    systemQty: 40,
    countedQty: 45,
    varianceQty: 5,
  }),
  countVarianceLineResponse({
    inventoryCountLineId: 9113,
    lineNo: 3,
    itemId: 9503,
    lotId: null,
    systemQty: 7,
    countedQty: 7,
    varianceQty: 0,
  }),
];

const BASE_COUNT_LINE_VIEW: CountVarianceLineView = {
  inventoryCountLineId: 9111,
  locationId: 9401,
  itemId: 9501,
  lotId: 9701,
  uomId: 9601,
  systemQty: 100,
  varianceQty: -2,
  varianceReasonCode: null,
};

export const countVarianceLineView = (
  overrides: Partial<CountVarianceLineView> = {},
): CountVarianceLineView => ({ ...BASE_COUNT_LINE_VIEW, ...overrides });

/**
 * 재고 잔액 한 줄. **`groupBy`가 `LOT`이다** — 이 화면은 LOT까지 갈라 장부를 맞춘다.
 *
 * `locationId`를 **비운 채로 둔다.** 계약이 「접은 축은 비워서 내린다」고 적었고, 화면은 응답의
 * 위치를 대조에 쓰지 않는다(D-6) — 비어 있는 응답으로도 장부가 서는지가 이 픽스처의 요점이다.
 */
const BASE_BALANCE: InventoryBalanceResponse = {
  groupBy: 'LOT',
  itemId: 9501,
  lotId: 9701,
  ownershipTypeCode: 'SAMPLE_OWN_A',
  onHandQty: 120,
  reservedQty: 0,
  pickedQty: 0,
  blockedQty: 0,
  availableQty: 120,
  uomId: 9601,
};

export const balanceResponse = (
  overrides: Partial<InventoryBalanceResponse> = {},
): InventoryBalanceResponse => ({ ...BASE_BALANCE, ...overrides });

/**
 * 한 위치의 잔액 둘. 둘째 줄은 **장부가 0**이다 —
 * 「서버가 0이라고 한 것」과 「못 찾은 것」이 갈리는지를 실제 값으로 잰다.
 */
export const balanceFixtures: InventoryBalanceResponse[] = [
  balanceResponse(),
  balanceResponse({ itemId: 9502, lotId: null, onHandQty: 0, availableQty: 0 }),
];

/**
 * 등록 201이 되돌려 주는 조정 전표 하나.
 *
 * **모양이 상세 200과 같다**(계약 실측 — 머리 + 라인). 그래서 이 픽스처 하나로 등록 결과를
 * 세우고, 뒤따르는 회차의 상세 조회도 같은 모양을 쓴다.
 *
 * **계약 예시값(`IA-2026-000031`·`COUNT_VARIANCE`·`REQUESTED`)을 쓰지 않는다** — 목이 채워
 * 주는 값과 화면이 만든 값이 구분되지 않는다.
 */
const BASE_ADJUSTMENT_LINE: InventoryAdjustmentLineResponse = {
  inventoryAdjustmentLineId: 9311,
  inventoryAdjustmentId: 9301,
  lineNo: 1,
  locationId: 9401,
  itemId: 9501,
  lotId: 9701,
  adjustmentQty: -20,
  uomId: 9601,
};

export interface AdjustmentDetailOverrides {
  /**
   * 내부 번호. **두 전표를 가르려면 이 값이 실제로 갈려야 한다** — 상신의 매임 축이 이 번호라,
   * 같은 번호를 두 번 주면 「앞 전표의 상신이 새 전표 위에 서는가」를 잴 수 없다.
   */
  inventoryAdjustmentId?: number;
  inventoryAdjustmentNo?: string;
  statusCode?: string;
  /** `null`이면 **응답에 그 키가 없다** — 계약이 선택으로 둔 갈래를 실제 응답으로 만든다 */
  erpMessageQueued?: boolean | null;
  /** 서버가 저장했다고 되돌려 주는 줄 수. **화면이 보낸 줄 수와 갈라 두는 것이 요점이다** */
  lineCount?: number;
  /**
   * ⚠ **목이 채워 주는 값**(계획 §5.2.5 실측 — 결함이 아니다).
   *
   * 등록 응답에 승인 요청 번호가 실려 오면 방금 만든 전표가 「이미 상신된 것」으로 보인다.
   * 화면이 그것을 읽어 진행을 부르거나 「상신됨」을 그리면 **확인하지 않은 사실**을 말하게
   * 되므로, 이 인자는 **그 유혹을 실제 응답으로 재현하는 자리**다(C36 감지기).
   */
  approvalRequestId?: number;
  /** 같은 이유로 두는 전기 시각. **전기 여부는 이 회차가 판정하지 않는다**(T4 몫) */
  adjustedAt?: string;
}

export const adjustmentDetailBody = (
  overrides: AdjustmentDetailOverrides = {},
): InventoryAdjustmentDetailResponse => {
  const {
    inventoryAdjustmentId = 9301,
    inventoryAdjustmentNo = 'SAMPLE-IA-9301',
    statusCode = 'SAMPLE_IA_STATUS_A',
    erpMessageQueued = true,
    lineCount = 1,
    approvalRequestId,
    adjustedAt,
  } = overrides;

  return {
    inventoryAdjustment: {
      inventoryAdjustmentId,
      inventoryAdjustmentNo,
      reasonCode: 'SAMPLE_AR_A',
      statusCode,
      /* 값이 오지 않는 갈래는 **키 자체가 없는 것**이다 — `null`을 실으면 다른 사실이 된다. */
      ...(erpMessageQueued === null ? {} : { erpMessageQueued }),
      ...(approvalRequestId === undefined ? {} : { approvalRequestId }),
      ...(adjustedAt === undefined ? {} : { adjustedAt }),
    },
    lines: Array.from({ length: lineCount }, (_unused, index) => ({
      ...BASE_ADJUSTMENT_LINE,
      inventoryAdjustmentLineId: BASE_ADJUSTMENT_LINE.inventoryAdjustmentLineId + index,
      lineNo: index + 1,
    })),
  };
};

/**
 * 상신 202가 되돌려 주는 것 — **내부 식별자 하나뿐이다**(`ApprovalRequestRef`).
 *
 * 화면에 낼 업무 번호가 여기 없다(`omf-mes#44`) — 진행 구획이 그 번호를 **승인 요청 상세**에서
 * 따로 받는다.
 */
export const approvalRequestRefBody = (approvalRequestId = 9801): ApprovalRequestRefResponse => ({
  approvalRequestId,
});

const BASE_APPROVAL_STEP: ApprovalStepResponse = {
  stepNo: 1,
  approverId: 9811,
  approverName: '합성 결재자 가',
  decisionCode: 'SAMPLE_DECISION_A',
  decisionAt: '2026-08-18T15:02:00+09:00',
  decisionComment: '합성 결재 의견',
  /** **결재함이 쓰는 표기다** — 이 화면이 나르지 않는 것을 재려면 참으로 와야 한다(C36). */
  isMine: true,
  isCurrent: false,
};

export const approvalStep = (
  overrides: Partial<ApprovalStepResponse> = {},
): ApprovalStepResponse => ({ ...BASE_APPROVAL_STEP, ...overrides });

/**
 * 승인 요청 상세 한 건.
 *
 * - 사유가 **여러 줄**이다 — 전문의 줄바꿈이 유지되는지 재는 자리다
 * - 둘째 단계는 **결재 전이고 승인자 이름이 비어 있다** — 「번호를 대신 내지 않는다」가 실제
 *   값으로 걸린다
 * - **단계 번호가 비연속(1·4)이다** — 연속으로 두면 `stepNo`를 배열 인덱스+1로 다시 매기는
 *   결함이 **값이 같아 가려진다**
 * - `isMyTurn`·`isMine`이 **참**이다 — 이 화면이 결재함의 표기를 나르지 않는다는 것을 잴 수
 *   있어야 한다(C36)
 *
 * **계약 예시값(`AP-2026-0087`·`DISPOSAL_REQUEST`·`IN_PROGRESS`·예시 인명)을 쓰지 않는다.**
 */
export const approvalRequestDetailBody = (
  overrides: Partial<ApprovalRequestDetailResponse['request']> = {},
): ApprovalRequestDetailResponse => ({
  request: {
    approvalRequestId: 9801,
    /* 업무 번호에 내부 번호를 섞지 않는다 — 「9801이 그려지지 않는다」를 잴 수 있어야 한다. */
    approvalRequestNo: 'SAMPLE-AP-0001',
    approvalTypeCode: 'SAMPLE_AT_A',
    requestedBy: 9821,
    requestedByName: '합성 상신자 가',
    requestedAt: '2026-08-18T14:35:00+09:00',
    statusCode: 'SAMPLE_AP_STATUS_A',
    reason: '합성 조정 사유 첫 줄\n\n둘째 문단 — 근거를 적는 자리',
    target: {
      targetTypeCode: 'SAMPLE_TARGET_TYPE_A',
      targetId: 9301,
      displayName: '합성 대상 문서',
      openable: false,
    },
    currentStepNo: 4,
    totalStepNo: 4,
    isMyTurn: true,
    ...overrides,
  },
  steps: [
    approvalStep(),
    approvalStep({
      stepNo: 4,
      approverId: 9812,
      approverName: '',
      decisionCode: null,
      decisionAt: null,
      decisionComment: null,
      isCurrent: true,
    }),
  ],
});

/** 승인 완료 자리표시가 채워졌다고 가정할 때 쓰는 합성 코드. **계약 예시값이 아니다.** */
export const SAMPLE_APPROVED_STATUS = 'SAMPLE_AP_STATUS_A';

/** 반려 자리표시가 채워졌다고 가정할 때 쓰는 합성 코드. **계약 예시값이 아니다.** */
export const SAMPLE_REJECTION_DECISION = 'SAMPLE_DECISION_A';

/**
 * 값이 전부 유효한 라인 초안. **검사하려는 칸만 인자로 어긋나게 둔다** —
 * 기본값이 이미 잘못돼 있으면 어느 규칙이 울었는지 가릴 수 없다.
 *
 * 차이 기본값이 **음수**다. 이 화면의 정상 경로가 줄이는 조정이라, 기본값이 양수면
 * 「음수를 막지 않는다」가 늘 예외 경로에서만 검사된다.
 */
const BASE_LINE_DRAFT: AdjustLineDraft = {
  key: 's1:new:1',
  countLineId: null,
  countSystemQty: null,
  countReasonCode: null,
  locationId: '9401',
  itemId: '9501',
  lotId: '9701',
  uomId: '9601',
  adjustmentQtyText: '-20',
};

export const adjustLineDraft = (overrides: Partial<AdjustLineDraft> = {}): AdjustLineDraft => ({
  ...BASE_LINE_DRAFT,
  ...overrides,
});

/**
 * 참조 목록의 응답 본문. **화면이 읽는 필드만 담는다** — 스텁 응답은 JSON이라
 * 계약의 모든 필드를 갖출 필요가 없고, 갖추면 무엇을 읽는지가 오히려 가려진다.
 */
export const warehouseFixtures = [
  {
    warehouseId: 9201,
    warehouseCode: 'SAMPLE-WH-01',
    warehouseName: '합성 창고 가',
    isActive: true,
  },
  {
    warehouseId: 9202,
    warehouseCode: 'SAMPLE-WH-02',
    warehouseName: '합성 창고 나',
    isActive: true,
  },
];

export const locationFixtures = [
  {
    locationId: 9401,
    locationCode: 'SAMPLE-LOC-01',
    locationName: '합성 위치 가',
    isActive: true,
  },
  {
    locationId: 9402,
    locationCode: 'SAMPLE-LOC-02',
    locationName: '합성 위치 나',
    isActive: false,
  },
];

/** 9503(차이 0인 줄의 품목)은 일부러 빠져 있다 — 「목록에 없음」 갈래를 만드는 값이다. */
export const itemFixtures = [
  { itemId: 9501, itemCode: 'SAMPLE-ITEM-A', itemName: '합성 품목 가', isActive: true },
  { itemId: 9502, itemCode: 'SAMPLE-ITEM-B', itemName: '합성 품목 나', isActive: true },
];

export const uomFixtures = [
  { uomId: 9601, uomCode: 'SAMPLE-EA', uomName: '합성 단위 개', isActive: true },
];

/** 자재 LOT은 **품목마다 따로 받는다** — 계약에 번호 목록으로 받는 조건이 없다. */
export const lotFixtures = [{ lotId: 9701, lotNo: 'SAMPLE-LOT-0001', itemId: 9501 }];
