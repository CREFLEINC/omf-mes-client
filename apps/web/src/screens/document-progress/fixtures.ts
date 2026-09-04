import type { DocumentTypeEntry } from './document-types';
import type {
  ApprovalRequestDetailResponse,
  ApprovalStepResponse,
  CancelResultResponse,
  DocumentProgressDetailView,
  DocumentProgressStepView,
  DocumentProgressView,
  DocumentSuccessorView,
} from './types';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 —
 * 참조하면 예시 값이 배포 번들에 들어간다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다. 이 화면은 문서번호처럼 **실제로 보일 법한 값**을
 * 그리는 자리라, 한눈에 예시임이 보이는 접두(`SYN-`)와 지어낸 번호 대역만 쓴다.
 * 실 운영 문서번호·품목코드·LOT 번호·거래처 코드·고객사명을 넣지 않는다(공개 저장소 경계).
 *
 * **계약의 `@example` 값을 쓰지 않는다.** 예시를 픽스처에 쓰면 나중에 「확정 값」으로 읽힌다.
 * 유형·상태 코드도 `SYN_` 접두를 붙여, 값 목록이 확정되면 이 값들이 **확정 값이 아님**이
 * 한눈에 보이게 한다.
 *
 * **내부 번호는 9000번대**로 둔다. 「표 어디에도 내부 번호가 렌더되지 않는다」를 검사할 때
 * 수량 같은 정상 숫자와 헷갈리지 않게 하기 위해서다.
 */

const BASE_PROGRESS: DocumentProgressView = {
  documentTypeCode: 'GOODS_RECEIPT',
  documentId: 9001,
  documentNo: 'SYN-GR-2026-0001',
  documentDate: '2026-08-06',
  documentSubTypeCode: 'SYN_SUB_A',
  statusCode: 'SYN_STATUS_A',
  plannedQty: 1200,
  processedQty: 1200,
  remainingQty: 0,
  successorCount: 0,
  cancellable: true,
  cancelBlockedReasonCode: null,
};

/** 한 항목만 다른 건을 만든다. 무엇이 다른지 그 인자만 보고 읽히게 한다. */
export const documentProgress = (
  overrides: Partial<DocumentProgressView> = {},
): DocumentProgressView => ({ ...BASE_PROGRESS, ...overrides });

/**
 * 화면 수준 테스트가 목록 응답으로 쓰는 네 건. 화면이 다뤄야 하는 까다로운 입력을 일부러 담는다.
 *
 * - 9001 — 취소할 수 있는 문서. 후속 0건
 * - 9002 — **후속이 있어 막혔다.** 계약이 열거한 코드라 우리말 문면이 나온다
 * - 9003 — **계약에 없는 코드로 막혔다.** 그 코드 문자열이 그대로 보여야 한다
 * - 9004 — **막혔는데 사유 코드가 없다.** 계약이 선택으로 둔 자리라 실재하는 갈래다.
 *   세부구분도 없어 「값 없음」 표식 갈래를 함께 만든다
 */
export const documentProgressFixtures: DocumentProgressView[] = [
  documentProgress(),
  documentProgress({
    documentId: 9002,
    documentNo: 'SYN-GR-2026-0002',
    documentSubTypeCode: 'SYN_SUB_B',
    statusCode: 'SYN_STATUS_B',
    processedQty: 800,
    remainingQty: 400,
    successorCount: 2,
    cancellable: false,
    cancelBlockedReasonCode: 'SUCCESSOR_EXISTS',
  }),
  documentProgress({
    documentId: 9003,
    documentNo: 'SYN-GR-2026-0003',
    documentDate: '2026-08-07',
    successorCount: 1,
    cancellable: false,
    cancelBlockedReasonCode: 'SYN_UNKNOWN_BLOCK_REASON',
  }),
  documentProgress({
    documentId: 9004,
    documentNo: 'SYN-GR-2026-0004',
    documentDate: '2026-08-08',
    documentSubTypeCode: null,
    cancellable: false,
    cancelBlockedReasonCode: null,
  }),
];

/**
 * 목록 응답에 실리는 모양. **화면이 버리는 값이 응답에 있어야** 옮기기가 실제로 고르는지 보인다.
 *
 * 이 회차의 목록은 취소 요청의 승인 요청 번호와 화면 ID를 그리지 않는다 — 응답에는 담아 두고
 * 화면 타입에는 자리가 없다는 사실을 감지기가 잰다.
 */
interface ProgressResponseShape extends DocumentProgressView {
  cancelApprovalRequestId: number | null;
  screenId: string | null;
}

export const toProgressResponse = (view: DocumentProgressView): ProgressResponseShape => ({
  ...view,
  cancelApprovalRequestId: 9501,
  screenId: 'SYN-SCREEN-01',
});

/**
 * 처리 경과 한 줄. **까다로운 갈래를 기본값으로 두지 않는다** — 무엇이 다른지 인자만 보고
 * 읽히게 하려면 기본은 「전부 채워진 평범한 줄」이어야 한다.
 */
const BASE_STEP: DocumentProgressStepView = {
  stepCode: 'SYN_STEP_REGISTERED',
  occurredAt: '2026-08-06T09:14:00+09:00',
  actorName: '홍길동',
  inventoryTransactionNo: 'SYN-TX-9001',
  businessDate: '2026-08-06',
};

export const progressStep = (
  overrides: Partial<DocumentProgressStepView> = {},
): DocumentProgressStepView => ({ ...BASE_STEP, ...overrides });

/**
 * 처리 경과 네 줄 — 화면이 다뤄야 하는 갈래를 일부러 담는다.
 *
 * 1. 사람이 한 단계 + 원장 **짝**(번호 · 영업일)
 * 2. **행위자 이름이 비어 있다**(계약: 사람이 한 것이 아니면 비어 있다)
 * 3. **원장 번호만 왔다** — 영업일이 없어 원장을 찾을 수 없다
 * 4. 원장을 만들지 않은 단계(둘 다 없음)
 *
 * ⭐ **넷째 줄의 시각이 일부러 앞선다**(08:40 — 배열 차례로는 마지막). 계약이 시간순으로
 * 내린다고 적었으므로 화면은 **서버가 준 차례를 그대로 믿고 다시 세우지 않는데**, 픽스처가
 * 시각 오름차순이면 화면 쪽 시간순 정렬을 심어도 결과가 같아 감지기가 그 결함을 놓친다
 * (검증 F-T2-1). 배열 차례와 시각 차례를 갈라 두어야 「차례 그대로」가 실제로 재어진다.
 */
export const progressStepFixtures: DocumentProgressStepView[] = [
  progressStep(),
  progressStep({
    stepCode: 'SYN_STEP_POSTED',
    occurredAt: '2026-08-06T10:20:00+09:00',
    actorName: null,
    inventoryTransactionNo: 'SYN-TX-9002',
  }),
  progressStep({
    stepCode: 'SYN_STEP_CHECKED',
    occurredAt: '2026-08-06T11:05:00+09:00',
    actorName: '김영희',
    inventoryTransactionNo: 'SYN-TX-9003',
    businessDate: null,
  }),
  progressStep({
    stepCode: 'SYN_STEP_CLOSED',
    /* ⭐ 앞 줄들보다 **이른 시각**이다 — 위 머리말의 이유로 일부러 그렇게 둔다. */
    occurredAt: '2026-08-06T08:40:00+09:00',
    actorName: '이관리',
    inventoryTransactionNo: null,
    businessDate: null,
  }),
];

const BASE_SUCCESSOR: DocumentSuccessorView = {
  successorTypeCode: 'GOODS_ISSUE',
  successorId: 9101,
  successorNo: 'SYN-GI-2026-0101',
  qty: 400,
  screenId: 'SYN-SCREEN-02',
};

export const documentSuccessor = (
  overrides: Partial<DocumentSuccessorView> = {},
): DocumentSuccessorView => ({ ...BASE_SUCCESSOR, ...overrides });

/** 후속 두 건. 둘째는 **화면 ID가 오지 않은** 갈래다(계약이 선택으로 두었다). */
export const documentSuccessorFixtures: DocumentSuccessorView[] = [
  documentSuccessor(),
  documentSuccessor({
    successorId: 9102,
    successorNo: 'SYN-GI-2026-0102',
    qty: 100,
    screenId: null,
  }),
];

/**
 * 상세 응답 한 벌.
 *
 * ⭐ **요약이 목록 행과 다른 값을 갖게 둔다**(`statusCode`) — 요약을 목록 행에서 그리는 결함이
 * 있으면 그 자리에서 갈린다.
 */
export const documentProgressDetail = (
  overrides: Partial<DocumentProgressDetailView> = {},
): DocumentProgressDetailView => ({
  progress: documentProgress({ statusCode: 'SYN_STATUS_DETAIL' }),
  screenId: 'SYN-SCREEN-01',
  /**
   * ⭐ **기본값은 「취소 요청이 없다」**이다. 취소 요청이 진행 중인 문서를 기본으로 두면
   * 앞선 회차의 감지기들이 전부 승인 진행 구획을 함께 그리게 되고, 「요청이 없으면 부르지
   * 않는다」(C4-1)가 기본 상태에서 재어지지 않는다.
   */
  cancelApprovalRequestId: null,
  steps: progressStepFixtures,
  successors: documentSuccessorFixtures,
  ...overrides,
});

/**
 * 상세 조회 응답에 실리는 모양. 화면 ID와 **취소 요청의 승인 요청 번호**는 응답에서
 * **`progress` 안**에 실려 온다.
 */
export const toDetailResponse = (view: DocumentProgressDetailView) => ({
  progress: {
    ...toProgressResponse(view.progress),
    screenId: view.screenId,
    cancelApprovalRequestId: view.cancelApprovalRequestId,
  },
  steps: view.steps,
  successors: view.successors,
});

/* ─────────────────────────────────────────────────────────────────────────────
 * 승인 진행과 취소 실행(단위 ④)
 * ────────────────────────────────────────────────────────────────────────── */

/** 조회할 수 있는 승인 요청 번호. **내부 식별자라 9000번대**다. */
export const APPROVAL_REQUEST_ID = 9501;

const BASE_APPROVAL_STEP: ApprovalStepResponse = {
  stepNo: 1,
  approverId: 9601,
  approverName: '김승인',
  decisionCode: 'APPROVED',
  decisionAt: '2026-08-06T15:02:00+09:00',
  decisionComment: '수량 확인함',
  isMine: false,
  isCurrent: false,
};

export const approvalStep = (
  overrides: Partial<ApprovalStepResponse> = {},
): ApprovalStepResponse => ({ ...BASE_APPROVAL_STEP, ...overrides });

/**
 * 결재 단계 셋 — 화면이 다뤄야 하는 갈래를 일부러 담는다.
 *
 * | 줄 | 무엇을 재나 |
 * | :-: | --- |
 * | 1 | 결재가 끝난 단계. 결과 코드·시각·의견이 다 있다 |
 * | 2 | **지금 차례**인 단계(결재 전) |
 * | 3 | 아직 차례가 아닌 단계 + **승인자 이름이 비어 왔다**(내부 번호를 대신 내지 않는 갈래) |
 *
 * ⭐ **`stepNo`가 배열 차례와 어긋난다**(11·12·13). 서버가 매긴 번호를 쓰는지 배열 인덱스+1을
 * 쓰는지가 이 값으로 갈린다 — 나란히 두면 두 구현이 같은 답을 내 감지기가 결함을 놓친다(C4-5).
 */
export const approvalStepFixtures: ApprovalStepResponse[] = [
  approvalStep({ stepNo: 11 }),
  approvalStep({
    stepNo: 12,
    approverId: 9602,
    approverName: '박검토',
    decisionCode: null,
    decisionAt: null,
    decisionComment: null,
    isCurrent: true,
  }),
  approvalStep({
    stepNo: 13,
    approverId: 9603,
    /* 계약이 필수로 두었으나 빈 글자가 스키마를 통과한다 — 없음을 없음으로 옮기는 갈래다. */
    approverName: '',
    decisionCode: null,
    decisionAt: null,
    decisionComment: null,
  }),
];

/**
 * 승인 요청 상세 한 벌.
 *
 * ⭐ **사유가 여러 줄이다** — 취소 사유가 곧 취소 이력이라(문서에 담을 컬럼이 없다) 상신자가
 * 여러 줄로 근거를 적는다. 전문이 줄바꿈째 보이는지를 이 값이 잰다.
 */
export const approvalRequestDetail = (
  overrides: Partial<ApprovalRequestDetailResponse['request']> = {},
  steps: ApprovalStepResponse[] = approvalStepFixtures,
): ApprovalRequestDetailResponse => ({
  request: {
    approvalRequestId: APPROVAL_REQUEST_ID,
    approvalRequestNo: 'SYN-AP-2026-0001',
    approvalTypeCode: 'GOODS_RECEIPT_CANCEL',
    requestedBy: 9701,
    requestedByName: '이상신',
    requestedAt: '2026-08-06T14:20:00+09:00',
    statusCode: 'SYN_APPROVAL_IN_PROGRESS',
    reason: '수량 오기입으로 취소합니다\n실사 차이표 대조 완료',
    /**
     * ⚠ 계약이 대상을 함께 내리지만 **이 화면은 그리지 않는다** — 어느 문서인지는 위 요약이 이미
     * 말하고, 여는 손잡이는 화면 ID 표(`screen-routes.ts`)가 정한다. 응답에 담아 두어
     * 「화면이 쓰지 않는 값이 응답에 있다」는 사실을 감지기가 볼 수 있게 한다.
     */
    target: {
      targetTypeCode: 'GOODS_RECEIPT',
      targetId: 9001,
      displayName: 'SYN-GR-2026-0001',
      openable: false,
    },
    currentStepNo: 2,
    totalStepNo: 3,
    isMyTurn: false,
    ...overrides,
  },
  steps,
});

/**
 * 취소 실행 결과 — **기본은 전기된 문서**(역트랜잭션이 생긴 갈래)다.
 *
 * 되돌릴 수 없는 조작의 결과 중 더 무거운 쪽을 기본으로 둔다 — 가벼운 쪽을 기본으로 두면
 * 감지기가 무거운 갈래를 일부러 적어야만 재게 된다.
 */
export const cancelResult = (
  overrides: Partial<CancelResultResponse> = {},
): CancelResultResponse => ({
  documentTypeCode: 'GOODS_ISSUE',
  documentId: 9001,
  statusCode: 'SYN_STATUS_CANCELLED',
  reversed: true,
  reversalTransactionNo: 'SYN-TX-9501',
  reversalBusinessDate: '2026-08-07',
  ...overrides,
});

/**
 * 값이 **채워진** 유형 표. 자리표시가 비어 있는 지금 화면이 어떻게 되는지와,
 * 값이 오면 무엇이 살아나는지를 **같은 감지기 짝**으로 재기 위한 것이다.
 *
 * 세 줄이 서로 다른 일을 한다.
 *
 * | 줄 | 무엇을 재나 |
 * | --- | --- |
 * | 가 | **취소 리소스가 없는 유형** — 계약의 취소 경로가 셋뿐이라 덮는 유형 중 일부에는 취소가 없다. 그 유형에서 취소 조작이 서지 않는 것을 잰다 |
 * | 나 | **취소 리소스가 있는 유형** — 취소 축의 주 무대다 |
 * | 다 | **고를 수 없는데 리소스는 있다**(외주 문서 자리 — omf-mes#82). 「비활성 + 사유 표시」와 함께, `cancelResourceOf`가 **고를 수 있는 줄에서만 읽는지**를 잰다 — 두 값이 같은 줄에 있어야 그 가드가 재어진다 |
 */
export const documentTypeFixtures: readonly DocumentTypeEntry[] = [
  { code: 'GOODS_RECEIPT', label: '합성 유형 가', cancelResource: null, disabledReason: null },
  {
    code: 'GOODS_ISSUE',
    label: '합성 유형 나',
    cancelResource: 'goods-receipts',
    disabledReason: null,
  },
  {
    code: 'INBOUND_RECEIPT',
    label: '합성 유형 다',
    cancelResource: 'goods-issues',
    disabledReason: '이 유형에는 상태 컬럼이 없어 진행현황을 볼 수 없습니다',
  },
];
