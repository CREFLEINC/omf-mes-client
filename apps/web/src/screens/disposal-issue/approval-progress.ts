import type { StepStatus } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import {
  formatDateTime,
  readableName,
  toReasonLines,
  type ApprovalRequestDetailResponse,
  type ApprovalStepResponse,
  type IssueLineView,
} from './types';

/**
 * 승인 축 판정의 **한 곳**.
 *
 * ---
 *
 * **규율 하나: 상태 코드로 분기하지 않는다**(공유계약 G-2 · 계약이 스스로 그렇게 적었다).
 *
 * | 화면이 말하는 것 | 근거로 쓰는 값 | **쓰지 않는 것** |
 * | --- | --- | --- |
 * | 이 품의가 상신됐는가 | `goodsIssue.approvalRequestId`가 **있는가** | `statusCode` 문자열 비교 |
 * | 이 줄이 전기됐는가 | 라인의 `inventoryTransactionLineId`가 **있는가** | 같은 위 |
 * | 지금 몇 단계인가 | `request.currentStepNo`(비었으면 종료) | `steps`에서 인덱스+1 |
 * | 전체가 몇 단계인가 | `request.totalStepNo` | `steps.length` |
 * | 이 단계가 지금 차례인가 | `step.isCurrent` | 앞 단계들의 결과로 판정 |
 * | 승인이 끝났는가 | **자리표시 집합** — 비어 있는 동안 판정하지 않는다 | `currentStepNo === null` |
 *
 * **왜 이렇게까지 못 박는가.** ① 목이 내려주는 상세가 자기모순이다 — `currentStepNo`가 단계
 * 수보다 크고, 결재된 단계에 `isCurrent`가 참이다. 실제 서버가 그럴 리 없다고 가정하면 안 된다.
 * ② **「결재가 끝났다」는 「승인됐다」가 아니다** — 반려로 끝난 요청도 `currentStepNo`가 비므로,
 * 그것으로 승인을 판정하면 **반려된 품의가 처리할 수 있는 것처럼 보인다.** ③ 전기 여부를
 * 상태 코드로 읽으면 조용히 틀린다: 목이 전기 뒤에도 초안 상태를 그대로 준다(실측).
 *
 * ---
 *
 * **이 화면은 결재하지 않는다.** 결재함(W-CO-09)이 쓰는 `isMyTurn`·`isMine` 표기를 여기서
 * 나르지 않는다 — 나르면 이 화면이 결재함처럼 읽히고, 사용자는 있지도 않은 승인 버튼을 찾는다.
 * 여기서 말하는 것은 **어디까지 왔는가**뿐이다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.disposalIssue;

/**
 * 「결재가 **승인으로** 끝났다」를 뜻하는 승인 요청 상태 코드 — **비어 있는 것이 지금의 사실이다.**
 *
 * 값 목록이 공통코드 소관이라(`omf-mes#64`) 어떤 코드가 승인이고 반려인지 화면이 알 근거가 없다.
 * 짐작해 채우면 그 짐작이 사용자에게는 사실로 보이고, 이 화면에서 그 어긋남은 **승인되지 않은
 * 품의를 처리하라고 권하는** 것이 된다.
 *
 * **채우면 무엇이 살아나는가**: ① 이 회차에서는 승인된 품의에 「승인되었습니다. 재고는 아직
 * 차감되지 않았습니다」 안내가 서고 「판정하지 못합니다」 안내가 사라진다 ② 처리가 붙는 회차에는
 * 승인 전 전표의 처리 버튼이 잠긴다. **고칠 자리는 이 배열 하나다.**
 */
export const APPROVED_APPROVAL_STATUS_CODES: readonly string[] = [];

/**
 * 반려를 뜻하는 결재 결과 코드 — 고정 OpenAPI가 `REJECTED`로 닫았다.
 *
 * 디자인 시스템 `Stepper`는 이 값의 단계를 반려 상태와 X 글리프로 그린다.
 */
export const REJECTION_DECISION_CODES = ['REJECTED'] as const;

/**
 * 이 품의가 상신됐는가 — **세 갈래**다.
 *
 * | 갈래 | 언제 | 화면이 하는 일 |
 * | --- | --- | --- |
 * | `notSubmitted` | 값이 아예 없다 | 「아직 상신되지 않았습니다」 · **승인 요청을 부르지 않는다** |
 * | `submitted` | 조회 조각으로 쓸 수 있는 값이 왔다 | 그 값을 **그대로** 경로에 옮겨 부른다 |
 * | `unusable` | 값은 왔는데 쓸 수 없다(0·음수·소수·NaN) | 그 사실만 밝히고 **부르지 않는다** |
 *
 * **셋째 갈래를 없애면 둘 중 하나가 거짓이 된다.** 값이 실려 왔다는 것은 상신이 있었을 수
 * 있다는 뜻이라 「아직 상신되지 않았습니다」는 사실이 아니고, 그 값으로 부르면
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

  /* **값을 가공하지 않는다**(계획 결정 10) — 그대로 나른다. */
  return { kind: 'submitted', approvalRequestId };
};

/**
 * 이 줄이 전기됐는가. **계약이 그 필드를 「전기로 생긴 원장 라인」이라 적었다** —
 * 있으면 원장에 반영된 것이고 없으면 아직이다.
 */
export const isLinePosted = (line: Pick<IssueLineView, 'inventoryTransactionLineId'>): boolean =>
  line.inventoryTransactionLineId !== null;

/**
 * 이 전표에 전기된 줄이 하나라도 있는가.
 *
 * **「하나라도」로 판정한다.** 이 값을 쓰는 자리가 「재고는 아직 차감되지 않았습니다」를 말할지
 * 정하는 곳이라, 한 줄이라도 원장에 갔으면 그 문장은 거짓이다 — **모르면 말하지 않는 쪽**으로
 * 기운다. 라인이 없는 전표는 근거가 없으므로 전기되지 않은 것으로 본다.
 */
export const hasPostedLine = (
  lines: readonly Pick<IssueLineView, 'inventoryTransactionLineId'>[],
): boolean => lines.some(isLinePosted);

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

/**
 * 「기타출고 처리」를 잠글 근거가 화면에 있는가 — **네 갈래**다(승인 기록 §13-2 안 1).
 *
 * | 갈래 | 언제 | 처리 버튼 |
 * | --- | --- | :-: |
 * | `judgePending` | **자리표시가 비어 있다** — 어떤 코드가 승인인지 화면이 모른다 | **열려 있다** |
 * | `unread` | 자리표시는 찼는데 **결재 진행을 못 읽었다**(403·404·네트워크·부르는 중) | **열려 있다** |
 * | `approved` | 자리표시가 찼고 그 요청이 승인 상태다 | 열려 있다 |
 * | `notApproved` | 자리표시가 찼고 승인 상태가 **아니다** | **잠긴다** + 사유 |
 *
 * **앞의 두 갈래가 이 함수의 요점이다.** 모르는 것을 「승인되지 않았다」로 접으면 **승인된
 * 건까지 처리할 수 없어** 화면이 통째로 무용해진다 — 잠금이 위험을 줄이는 것이 아니라 옮긴다.
 * 잠금의 정본은 서버이고 계약이 그것을 명시했다(승인 전이면 400). 화면은 **아는 것만 말한다.**
 *
 * 자리표시를 **인자로 받는다** — 안에서 읽으면 「채워졌을 때 무엇이 잠기는가」를 시험이 잴 길이
 * 없어 그 자리가 죽은 가지가 된다(감지기 M64).
 */
export type PostApproval =
  { kind: 'judgePending' } | { kind: 'unread' } | { kind: 'approved' } | { kind: 'notApproved' };

export const readPostApproval = (
  approvedCodes: readonly string[],
  /** 읽어 낸 결재 진행. **못 읽었으면 `null`이다** — 그 사실과 「승인되지 않았다」는 다르다. */
  progress: Pick<RequestProgressView, 'isApproved'> | null,
): PostApproval => {
  if (isApprovalJudgePending(approvedCodes)) return { kind: 'judgePending' };
  if (progress === null) return { kind: 'unread' };

  return progress.isApproved ? { kind: 'approved' } : { kind: 'notApproved' };
};

/** 그려진 단계 하나. **여기 있는 값은 전부 응답에서 온 것이거나 그 사실을 옮긴 글자다.** */
export interface StepProgressView {
  /** 서버가 매긴 단계 번호. **배열 차례로 다시 매기지 않는다.** */
  stepNo: number;
  status: StepStatus;
  /** 승인자 이름. 비어 오면 **번호를 대신 내지 않는다**(`omf-mes#44`). */
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

/** 결재 진행 구획이 그리는 것 전부. **내부 번호는 하나도 담기지 않는다.** */
export interface RequestProgressView {
  /** 승인 요청**번호**(`AP-…`). 업무 번호라 그대로 낸다 — 내부 식별자와 다른 값이다. */
  requestNo: string;
  approvalTypeCode: string;
  statusCode: string;
  requesterLabel: string;
  requestedAtText: string;
  /** 사유 **전문**. 줄바꿈이 유지된다 — 첫 줄만 내는 것은 목록의 일이다. */
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

/**
 * 단계 하나의 상태.
 *
 * **결재했는가와 지금 차례인가, 둘로만 가른다.** 결재 기록이 있으면 완료이며, 그 코드가 반려
 * 고정 목록의 `REJECTED`일 때만 반려다.
 *
 * **결재 기록이 있으면 `isCurrent`가 참이어도 완료다.** 두 값이 어긋나는 응답이 실재하고
 * (목 실측), 그때 「진행 중」으로 그리면 사용자가 이미 끝난 단계를 기다린다.
 */
const statusOf = (step: ApprovalStepResponse, rejectionCodes: readonly string[]): StepStatus => {
  const decisionCode = filled(step.decisionCode);

  if (decisionCode === null) return step.isCurrent ? 'current' : 'pending';

  return rejectionCodes.includes(decisionCode) ? 'rejected' : 'complete';
};

/** 결재 전 단계가 지금 무엇을 기다리는지. 결재된 단계는 결과 코드가 말하므로 `null`이다. */
const waitingTextOf = (step: ApprovalStepResponse): string | null => {
  if (filled(step.decisionCode) !== null) return null;

  return step.isCurrent ? t.progress.waitingCurrent : t.progress.waitingPending;
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
      decisionAtText: decisionAt === null ? null : formatDateTime(decisionAt),
      decisionComment: filled(step.decisionComment),
      waitingText: waitingTextOf(step),
    };
  });

/**
 * 상세 응답 하나에서 결재 진행 구획이 그릴 것을 전부 만든다.
 *
 * **조회는 하나뿐이다** — 계약이 `steps`를 상세에 실어 주므로 단계 전용 조회를 만들지 않는다.
 * 두 번 부르면 두 응답이 서로 다른 시점을 보게 되고, 그 어긋남이 「진행은 3단계인데 단계
 * 목록은 2단계까지」로 나타난다.
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
    requestedAtText: formatDateTime(request.requestedAt),
    reasonLines: toReasonLines(request.reason),
    positionText:
      request.currentStepNo === null
        ? t.progress.finished(request.totalStepNo)
        : t.progress.position(request.currentStepNo, request.totalStepNo),
    isApproved: isApproved(request.statusCode, approvedCodes),
    steps: toStepProgressViews(steps, rejectionCodes),
  };
};
