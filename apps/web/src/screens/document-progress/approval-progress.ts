import type { StepStatus } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { formatStepAt } from './steps-pane';
import type { ApprovalRequestDetailResponse, ApprovalStepResponse } from './types';

/**
 * 취소 요청의 **승인 진행 판정** — 이 화면의 한 곳.
 *
 * 전례 `disposal-issue/approval-progress.ts`의 사본이며, **갈리는 자리를 아래에 못 박아 둔다.**
 *
 * ---
 *
 * **규율 하나: 상태 코드로 분기하지 않는다**(공유계약 G-2 · 계약이 스스로 그렇게 적었다).
 *
 * | 화면이 말하는 것 | 근거로 쓰는 값 | **쓰지 않는 것** |
 * | --- | --- | --- |
 * | 이 문서에 취소 요청이 있는가 | `cancelApprovalRequestId`가 **있는가** | `statusCode` 문자열 비교 |
 * | 지금 몇 단계인가 | `request.currentStepNo`(비었으면 종료) | `steps`에서 인덱스+1 |
 * | 전체가 몇 단계인가 | `request.totalStepNo` | `steps.length` |
 * | 이 단계가 지금 차례인가 | `step.isCurrent` | 앞 단계들의 결과로 판정 |
 * | 승인이 끝났는가 | **자리표시 집합** — 비어 있는 동안 판정하지 않는다 | `currentStepNo === null` |
 *
 * **왜 이렇게까지 못 박는가.** ① 값 목록이 공통코드 소관이라(omf-mes#64) 어떤 코드가 승인이고
 * 반려인지 화면이 알 근거가 없다. ② **「결재가 끝났다」는 「승인됐다」가 아니다** — 반려로 끝난
 * 요청도 `currentStepNo`가 비므로, 그것으로 승인을 판정하면 **반려된 취소가 실행할 수 있는
 * 것처럼 보인다.**
 *
 * ---
 *
 * ## ⛔ 전례와 갈리는 자리 — **판정으로 실행을 막지 않는다**
 *
 * 전례에는 처리 버튼을 잠글 근거를 만드는 `readPostApproval`(네 갈래)이 있다. **이 화면에는
 * 그것을 가져오지 않았다**(계획 §5-2 · 완료 조건 C4-8). 잠금의 정본은 **서버**이고 계약이
 * 「승인 전이면 400」이라 적었다 — 화면이 모르는 것을 「승인되지 않았다」로 접으면 승인된 건까지
 * 실행할 수 없어 화면이 통째로 무용해진다. 그래서 이 파일의 자리표시 두 벌은 **말하는 데만**
 * 쓰이고 **잠그는 데는 쓰이지 않는다.**
 *
 * ## 이 화면은 결재하지 않는다
 *
 * 결재함(W-CO-09)이 쓰는 `isMyTurn`·`isMine` 표기를 여기서 나르지 않는다 — 나르면 이 화면이
 * 결재함처럼 읽히고, 사용자는 있지도 않은 승인 버튼을 찾는다. 여기서 말하는 것은
 * **어디까지 왔는가**뿐이다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.documentProgress;

/**
 * 「결재가 **승인으로** 끝났다」를 뜻하는 승인 요청 상태 코드 — **비어 있는 것이 지금의 사실이다.**
 *
 * 값 목록이 공통코드 소관이라(omf-mes#64) 어떤 코드가 승인이고 반려인지 화면이 알 근거가 없다.
 * 짐작해 채우면 그 짐작이 사용자에게는 사실로 보인다.
 *
 * **채우면 무엇이 살아나는가**: 승인이 끝난 요청에 「승인이 끝났습니다」 안내가 서고
 * 「판정하지 못합니다」 안내가 사라진다. **고칠 자리는 이 배열 하나다.**
 *
 * ⛔ **채워도 실행 버튼의 조건은 달라지지 않는다** — 그것이 이 화면과 전례의 차이다(위 머리말).
 */
export const APPROVED_APPROVAL_STATUS_CODES: readonly string[] = [];

/**
 * 반려를 뜻하는 결재 결과 코드 — 고정 OpenAPI가 `REJECTED`로 닫았다.
 *
 * 디자인 시스템 `Stepper`는 이 값의 단계를 반려 상태와 X 글리프로 그린다.
 */
export const REJECTION_DECISION_CODES = ['REJECTED'] as const;

/**
 * 이 문서에 취소 요청이 올라가 있는가 — **세 갈래**다(전례 `readSubmission` 그대로).
 *
 * | 갈래 | 언제 | 화면이 하는 일 |
 * | --- | --- | --- |
 * | `notSubmitted` | 값이 아예 없다 | 「아직 취소 요청이 없습니다」 · **승인 요청을 부르지 않는다** |
 * | `submitted` | 조회 조각으로 쓸 수 있는 값이 왔다 | 그 값을 **그대로** 경로에 옮겨 부른다 |
 * | `unusable` | 값은 왔는데 쓸 수 없다(0·음수·소수·NaN) | 그 사실만 밝히고 **부르지 않는다** |
 *
 * **셋째 갈래를 없애면 둘 중 하나가 거짓이 된다.** 값이 실려 왔다는 것은 요청이 있었을 수
 * 있다는 뜻이라 「아직 취소 요청이 없습니다」는 사실이 아니고, 그 값으로 부르면
 * `/app/approval-requests/0` 같은 요청이 나가 남의 요청을 열거나 헛돈다.
 */
export type Submission =
  | { kind: 'notSubmitted' }
  | { kind: 'submitted'; approvalRequestId: number }
  | { kind: 'unusable' };

export const readSubmission = (approvalRequestId: number | null | undefined): Submission => {
  if (approvalRequestId === null || approvalRequestId === undefined) {
    return { kind: 'notSubmitted' };
  }

  if (!Number.isInteger(approvalRequestId) || approvalRequestId < 1) {
    return { kind: 'unusable' };
  }

  /* **값을 가공하지 않는다** — 그대로 나른다. */
  return { kind: 'submitted', approvalRequestId };
};

/**
 * ⭐ **취소 실행 버튼이 설 근거** — 「취소 요청이 있는가」다(계획 §5-2 · 완료 조건 C4-7).
 *
 * **`cancellable`이 아니다.** 취소 요청이 진행 중이면 서버가 그 값을 거짓으로 내리므로
 * (`CANCEL_IN_PROGRESS`) 그것으로 실행 버튼을 세우면 **실행 버튼이 영영 서지 않는다** —
 * 요청이 진행 중인 때가 바로 실행이 필요한 때다.
 *
 * ⭐ **`unusable`에서도 참이다.** 값이 실려 왔다는 것은 요청이 있었을 수 있다는 뜻이고, 실행은
 * 그 값을 **쓰지 않는다**(경로가 `/logistics/document-progress/{유형}/{번호}:cancel`이다). 여기서 거짓을 내면
 * 조회 하나가 막혔다는 이유로 **실행 자체가 사라진다** — 조회의 조건과 버튼의 조건은 다른
 * 물음이고, 잠금의 정본은 서버다(승인 전이면 400).
 */
export const hasCancelRequest = (submission: Submission): boolean =>
  submission.kind !== 'notSubmitted';

/**
 * 승인 판정을 아직 할 수 없는가. **거짓이 되는 순간 화면의 안내가 바뀐다.**
 *
 * 상수를 함수 안에서 직접 읽지 않고 **인자로 받는다** — 그래야 「채워졌을 때 무엇이 달라지는가」를
 * 감지기가 실제로 잴 수 있다. 안에서 읽으면 그 전환을 시험할 길이 없어 자리표시가 죽은 가지가 된다.
 */
export const isApprovalJudgePending = (approvedCodes: readonly string[]): boolean =>
  approvedCodes.length === 0;

/** 이 요청이 승인으로 끝났는가. 자리표시가 비어 있는 동안 **어떤 코드도 승인이 되지 않는다.** */
export const isApproved = (code: string, approvedCodes: readonly string[]): boolean =>
  approvedCodes.includes(code);

/** 그려진 단계 하나. **여기 있는 값은 전부 응답에서 온 것이거나 그 사실을 옮긴 글자다.** */
export interface StepProgressView {
  /** 서버가 매긴 단계 번호. **배열 차례로 다시 매기지 않는다.** */
  stepNo: number;
  status: StepStatus;
  /** 승인자 이름. 비어 오면 **번호를 대신 내지 않는다**(omf-mes#44). */
  approverLabel: string;
  /** 결재 결과 코드 **그대로**. 결재 전이면 `null`이다. */
  decisionCode: string | null;
  decisionAtText: string | null;
  decisionComment: string | null;
  /**
   * 결재 전 단계가 지금 어떤 상태인지 말하는 **보이는 글자**.
   *
   * 디자인 시스템은 상태 낱말(「완료·진행 중·대기·반려」)을 **스크린리더 전용**으로만 내고
   * 시각적으로는 색과 아이콘뿐이다 — 색으로만 말하면 색을 구분하지 못하는 사용자에게 이
   * 구획은 아무 말도 하지 않는다. 결재된 단계는 결과 코드가 그 자리를 맡으므로 `null`이다.
   */
  waitingText: string | null;
}

/** 승인 진행 구획이 그리는 것 전부. **내부 번호는 하나도 담기지 않는다.** */
export interface RequestProgressView {
  /** 승인 요청**번호**(`AP-…`). 업무 번호라 그대로 낸다 — 내부 식별자와 다른 값이다. */
  requestNo: string;
  approvalTypeCode: string;
  statusCode: string;
  requesterLabel: string;
  requestedAtText: string;
  /** 취소 사유 **전문**. 줄바꿈이 유지된다 — 이 사유가 곧 취소 이력이다. */
  reasonLines: string[];
  /** 「2 / 3 단계」 또는 「결재 종료 · 전체 2단계」. **서버가 준 두 수 그대로다.** */
  positionText: string;
  /** 승인으로 끝났는가 — **자리표시가 비어 있는 동안 늘 거짓이다.** */
  isApproved: boolean;
  steps: StepProgressView[];
}

/** 값이 실려 왔는가. 계약이 선택으로 둔 문자열은 널·없음·빈 문자열이 모두 「없음」이다. */
const filled = (value: string | null | undefined): string | null => {
  const text = value ?? '';

  return text === '' ? null : text;
};

/** 이름이 비어 왔으면 **그 사실을 적은 글자**를 낸다. ⛔ 내부 번호를 대신 내지 않는다. */
const readableName = (value: string | null | undefined, fallback: string): string =>
  filled(value) ?? fallback;

/**
 * 사유를 줄로 가른다. **줄바꿈이 뜻을 나른다** — 승인 요청의 업무 값이 사유 하나뿐이라
 * 상신자가 여러 줄로 근거를 적는다.
 */
export const toReasonLines = (reason: string): string[] => reason.split(/\r?\n/);

/**
 * 단계 하나의 상태.
 *
 * **결재했는가와 지금 차례인가, 둘로만 가른다.** 결재 기록이 있으면 완료이며, 그 코드가 반려
 * 고정 목록의 `REJECTED`일 때만 반려다.
 *
 * **결재 기록이 있으면 `isCurrent`가 참이어도 완료다.** 두 값이 어긋나는 응답이 실재하고
 * (전례가 목에서 실측), 그때 「진행 중」으로 그리면 사용자가 이미 끝난 단계를 기다린다.
 */
const statusOf = (step: ApprovalStepResponse, rejectionCodes: readonly string[]): StepStatus => {
  const decisionCode = filled(step.decisionCode);

  if (decisionCode === null) return step.isCurrent ? 'current' : 'pending';

  return rejectionCodes.includes(decisionCode) ? 'rejected' : 'complete';
};

/** 결재 전 단계가 지금 무엇을 기다리는지. 결재된 단계는 결과 코드가 말하므로 `null`이다. */
const waitingTextOf = (step: ApprovalStepResponse): string | null => {
  if (filled(step.decisionCode) !== null) return null;

  return step.isCurrent ? t.approval.waitingCurrent : t.approval.waitingPending;
};

/**
 * 단계 배열을 그릴 값으로 옮긴다.
 *
 * 반려 코드 집합을 **인자로 받는다** — 자리표시를 읽는 자리를 한 곳으로 묶어야 「채우면
 * 반려가 된다」를 시험이 실제로 잴 수 있다.
 *
 * **차례를 바꾸지 않는다.** 배열 순서가 곧 결재 순서이고 그것은 서버가 정한 것이다.
 */
export const toStepProgressViews = (
  steps: readonly ApprovalStepResponse[],
  rejectionCodes: readonly string[],
): StepProgressView[] =>
  steps.map((step) => {
    const decisionAt = filled(step.decisionAt);

    return {
      stepNo: step.stepNo,
      status: statusOf(step, rejectionCodes),
      approverLabel: readableName(step.approverName, t.values.unknownApprover),
      decisionCode: filled(step.decisionCode),
      decisionAtText: decisionAt === null ? null : formatStepAt(decisionAt),
      decisionComment: filled(step.decisionComment),
      waitingText: waitingTextOf(step),
    };
  });

/**
 * 상세 응답 하나에서 승인 진행 구획이 그릴 것을 전부 만든다.
 *
 * **조회는 하나뿐이다** — 계약이 `steps`를 상세에 실어 주므로 단계 전용 조회를 만들지 않는다.
 *
 * 두 자리표시를 **인자로 받는다** — 채워졌을 때 무엇이 달라지는지를 감지기가 재는 자리다.
 */
export const toRequestProgressView = (
  detail: ApprovalRequestDetailResponse,
  rejectionCodes: readonly string[],
  approvedCodes: readonly string[] = [],
): RequestProgressView => {
  const { request, steps } = detail;

  return {
    requestNo: request.approvalRequestNo,
    approvalTypeCode: request.approvalTypeCode,
    statusCode: request.statusCode,
    requesterLabel: readableName(request.requestedByName, t.values.unknownRequester),
    requestedAtText: formatStepAt(request.requestedAt),
    reasonLines: toReasonLines(request.reason),
    positionText:
      request.currentStepNo === null
        ? t.approval.finished(request.totalStepNo)
        : t.approval.position(request.currentStepNo, request.totalStepNo),
    isApproved: isApproved(request.statusCode, approvedCodes),
    steps: toStepProgressViews(steps, rejectionCodes),
  };
};
