import type { components } from '@omf-mes/api-client';

/**
 * W-01-13 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이
 * 유지된다.
 *
 * 이 화면은 **여러 유형의 물류 문서를 한 목록으로 가로질러 보고, 그중 셋을 승인을 경유해
 * 되돌린다.** 이 회차(작업 단위 ①)는 그중 **목록까지**다 — 상세·취소 요청·승인 진행·취소 실행의
 * 타입은 그 조작이 실제로 생기는 회차에서 이 파일에 더한다. 미리 두면 아무도 지나지 않는
 * 변환기가 남는다.
 *
 * ⭐ **후속 판정을 화면이 하지 않는다.** 「이 문서를 취소할 수 있는가」·「후속이 몇 건인가」는
 * 서버가 판정해 내려주고 화면은 그 결과만 쓴다. 원천 참조가 다형이라 화면이 유형↔후속 관계표를
 * 만들면 유형이 늘 때마다 판정이 조용히 틀린다(공유계약 A-10 보강 · 계약 본문이 같은 말을 적었다).
 *
 * 이 파일은 이 화면이 소유한다. **다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다** —
 * 형태가 같아도 리소스 이름이 박힌 타입을 공유하면 한 화면의 계약 변화가 다른 화면을 끌고 간다.
 */

export type DocumentProgressResponse = components['schemas']['DocumentProgress'];

export type PageMeta = components['schemas']['PageMeta'];

/**
 * 선택칸의 항목 하나.
 *
 * **`disabled`를 담는다** — 외주 2문서처럼 목록에 두되 고를 수 없는 유형이 있기 때문이다
 * (omf-mes#82). 목록에서 아예 빼면 「왜 그 유형이 없는지」를 화면 어디에서도 읽을 수 없다.
 */
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * 화면이 다루는 진행현황 한 건.
 *
 * **계약 응답을 통째로 넓히지 않고 이 회차가 쓰는 값만 옮긴다.** 응답에는 취소 요청의 승인 요청
 * 번호(`cancelApprovalRequestId`)와 문서를 여는 화면 ID(`screenId`)도 함께 오는데, 이 회차의
 * 목록은 그 둘을 그리지도 보내지도 않는다 — 타입에 자리를 두지 않으면 그 값이 화면으로 샐
 * 경로도 없다(omf-mes#44). 둘은 각각 단위 ④·②에서 자리를 얻는다.
 *
 * **수량 셋을 함께 담는다.** 계획·처리·잔여가 한 줄에서 함께 읽혀야 「어디까지 갔는가」가 보이고,
 * 그것이 이 화면의 이름(진행현황)이 뜻하는 것이다.
 *
 * **`cancellable`과 `cancelBlockedReasonCode`를 짝으로 담는다** — 거짓인데 사유를 담지 않으면
 * 화면이 「왜 안 되는지」를 말할 수단이 없어 사용자가 상세를 열어 확인할 수밖에 없다. 목록 열에서
 * 대상을 고르게 하는 것이 이 화면의 요점이다(착수 이슈 §6).
 */
export interface DocumentProgressView {
  documentTypeCode: string;
  documentId: number;
  documentNo: string;
  /** `YYYY-MM-DD`. 계약이 date로 두어 시각이 없다 — 시간대 옮김이 필요 없다. */
  documentDate: string;
  /**
   * 유형 안의 구분. 계약이 선택으로 두어 **없이 오는 문서가 실재한다** —
   * 없음을 없음으로 옮긴다. 빈 문자열로 메우면 「구분이 없다」와 「빈 구분」이 섞인다.
   */
  documentSubTypeCode: string | null;
  statusCode: string;
  plannedQty: number;
  processedQty: number;
  remainingQty: number;
  /** 이 문서를 원천으로 삼는 하류 문서 수. **서버가 센 값을 그대로 쓴다.** */
  successorCount: number;
  /** 지금 취소 **요청**을 낼 수 있는가. 「지금 취소를 실행할 수 있는가」가 아니다(계약 설명). */
  cancellable: boolean;
  /** `cancellable`이 거짓인 이유. 계약이 선택으로 두어 **오지 않는 갈래가 따로 있다.** */
  cancelBlockedReasonCode: string | null;
}

/** 응답 한 건을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toDocumentProgressView = (data: DocumentProgressResponse): DocumentProgressView => ({
  documentTypeCode: data.documentTypeCode,
  documentId: data.documentId,
  documentNo: data.documentNo,
  documentDate: data.documentDate,
  documentSubTypeCode: data.documentSubTypeCode ?? null,
  statusCode: data.statusCode,
  plannedQty: data.plannedQty,
  processedQty: data.processedQty,
  remainingQty: data.remainingQty,
  successorCount: data.successorCount,
  cancellable: data.cancellable,
  cancelBlockedReasonCode: data.cancelBlockedReasonCode ?? null,
});

/** 목록 조회 결과. `page`는 쪽 이동과 위치 표시의 정본이다. */
export interface DocumentProgressListResult {
  items: DocumentProgressView[];
  page: PageMeta;
}

export type DocumentProgressDetailResponse = components['schemas']['DocumentProgressDetail'];

/**
 * 승인 요청 상세 — **결재선 진행을 단계 배열로 함께 내린다**(계약). 그래서 이 화면은 단계 전용
 * 조회를 만들지 않는다: 두 번 부르면 두 응답이 서로 다른 시점을 보게 되고, 그 어긋남이
 * 「진행은 3단계인데 단계 목록은 2단계까지」로 나타난다.
 */
export type ApprovalRequestDetailResponse = components['schemas']['ApprovalRequestDetail'];

export type ApprovalStepResponse = components['schemas']['ApprovalStep'];

export type CancelResultResponse = components['schemas']['CancelResult'];

/**
 * 처리 경과 한 줄.
 *
 * **단계 코드를 해석하지 않는다** — 시간순으로 그리기만 한다(값 목록이 공통코드 소관이다).
 *
 * **행위자 이름이 비어 오는 갈래가 실재한다.** 계약이 「사람이 한 것이 아니면 비어 있다」라고
 * 적었다 — 없음을 없음으로 옮기고, ⛔ **내부 번호를 대신 담지 않는다**(omf-mes#44). 애초에
 * 계약이 행위자 번호를 내려 주지 않으므로 이 타입에 그 자리를 만들 이유도 없다.
 *
 * **원장 번호와 영업일이 둘 다 선택이다.** 반쪽으로 오는 갈래를 판정하는 것은 `ledger-ref.ts`
 * 한 곳이며, 이 타입은 받은 그대로 나른다.
 */
export interface DocumentProgressStepView {
  stepCode: string;
  /** `date-time`. 서버가 시간대까지 실어 준다 — 화면이 시간대를 옮기지 않는다. */
  occurredAt: string;
  actorName: string | null;
  inventoryTransactionNo: string | null;
  businessDate: string | null;
}

/**
 * 후속 문서 한 건.
 *
 * ⭐ **유형↔후속 관계표를 화면이 만들지 않는다**(공유계약 A-10 보강). 이 배열이 곧 서버의
 * 판정이며, 화면은 유형 코드를 **글자로 그릴 뿐** 그 값으로 분기하지 않는다.
 */
export interface DocumentSuccessorView {
  successorTypeCode: string;
  successorId: number;
  successorNo: string;
  qty: number;
  /** 후속 문서를 여는 화면 ID. 표(`screen-routes.ts`)를 뒤지는 **열쇠**일 뿐이다. */
  screenId: string | null;
}

/**
 * 고른 문서의 상세.
 *
 * ⭐ **요약의 근거가 목록 행이 아니라 이 안의 `progress`다.** 두 조회의 시점이 갈릴 수 있어,
 * 목록 행을 다시 그리면 같은 화면의 위아래가 서로 다른 수량을 말한다.
 *
 * **`screenId`와 `cancelApprovalRequestId`는 여기에만 자리가 있다.** 목록 행 타입
 * (`DocumentProgressView`)은 둘을 담지 않는다 — 목록은 문서를 열지도 취소를 실행하지도 않으므로
 * 담으면 화면으로 샐 경로만 생긴다(omf-mes#44). 둘 다 상세 응답의 `progress` 안에 실려 온다.
 */
export interface DocumentProgressDetailView {
  progress: DocumentProgressView;
  screenId: string | null;
  /**
   * 진행 중인 취소 요청의 승인 요청 **내부 식별자**. 없으면 요청이 없다는 뜻이다.
   *
   * ⭐ **이 값이 취소 실행 버튼의 근거다**(계획 §5-2). `cancellable`이 아니다 — 취소 요청이
   * 진행 중이면 서버가 `cancellable`을 거짓으로 내리므로(`CANCEL_IN_PROGRESS`) 그것으로 실행
   * 버튼을 세우면 **실행 버튼이 영영 서지 않는다.**
   *
   * ⛔ **화면에 그리지 않는다.** 내부 식별자라 사용자에게 뜻이 없고(omf-mes#44) 쓰임은 둘뿐이다 —
   * 승인 진행 조회의 경로 조각, 그리고 「요청이 있는가」의 근거. 값을 **가공하지 않고 그대로**
   * 나른다: 쓸 수 있는 값인지의 판정은 `approval-progress.ts`의 `readSubmission` 한 곳이 한다.
   */
  cancelApprovalRequestId: number | null;
  steps: DocumentProgressStepView[];
  successors: DocumentSuccessorView[];
}

/** 상세 응답 한 건을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toDocumentProgressDetailView = (
  data: DocumentProgressDetailResponse,
): DocumentProgressDetailView => ({
  progress: toDocumentProgressView(data.progress),
  screenId: data.progress.screenId ?? null,
  /* ⛔ **값을 고르지 않는다** — 0·음수·소수도 그대로 나른다. 판정은 `readSubmission` 한 곳이다. */
  cancelApprovalRequestId: data.progress.cancelApprovalRequestId ?? null,
  steps: data.steps.map((step) => ({
    stepCode: step.stepCode,
    occurredAt: step.occurredAt,
    actorName: step.actorName ?? null,
    inventoryTransactionNo: step.inventoryTransactionNo ?? null,
    businessDate: step.businessDate ?? null,
  })),
  successors: data.successors.map((successor) => ({
    successorTypeCode: successor.successorTypeCode,
    successorId: successor.successorId,
    successorNo: successor.successorNo,
    qty: successor.qty,
    screenId: successor.screenId ?? null,
  })),
});

/**
 * 취소 실행이 실제로 한 일.
 *
 * ⭐ **`reversed`가 두 문면을 가른다**(계약이 그렇게 적었다) — 전기된 문서였으면 원장에
 * 역트랜잭션이 생기고, 전기 전이었으면 상태만 바뀐다. 화면이 그것을 판정하지 않고 서버가 준
 * 값을 그대로 쓴다: 전기 여부를 화면이 다시 세면 조용히 틀린다.
 *
 * ⛔ **문서 번호(`documentId`)와 유형 코드를 담지 않는다.** 앞은 내부 식별자라 사용자에게 뜻이
 * 없고(omf-mes#44), 뒤는 이미 위 요약이 말한다 — 담지 않으면 화면으로 샐 경로가 없다.
 *
 * **역트랜잭션 번호와 영업일을 짝으로 담는다.** 원장 조회는 영업일이 키의 일부라(계약 경로)
 * 번호만으로는 찾을 수 없다. 계약이 둘 다 선택으로 두어 반쪽으로 오는 갈래가 실재하며,
 * 그 판정은 `ledger-ref.ts` 한 곳이 한다 — 이 타입은 받은 그대로 나른다.
 */
export interface CancelExecutionView {
  statusCode: string;
  reversed: boolean;
  reversalTransactionNo: string | null;
  reversalBusinessDate: string | null;
}

/** 실행 응답 한 건을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toCancelExecutionView = (data: CancelResultResponse): CancelExecutionView => ({
  statusCode: data.statusCode,
  reversed: data.reversed,
  reversalTransactionNo: data.reversalTransactionNo ?? null,
  reversalBusinessDate: data.reversalBusinessDate ?? null,
});
