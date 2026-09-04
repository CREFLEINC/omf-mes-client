import type { StepStatus } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import {
  formatDateTime,
  readableName,
  type ApprovalRequestDetail,
  type ApprovalStep,
} from './types';

/**
 * 결재 진행 — **단계 배열을 그릴 값으로 옮기는 유일한 자리.**
 *
 * ---
 *
 * **이 파일의 규율 하나: 판정을 다시 계산하지 않는다.**
 *
 * | 화면이 말하는 것 | 근거로 쓰는 값 | **쓰지 않는 것** |
 * | --- | --- | --- |
 * | 지금 몇 단계인가 | `request.currentStepNo`(비었으면 종료) | `steps`에서 `isCurrent`를 찾아 **인덱스+1** |
 * | 전체가 몇 단계인가 | `request.totalStepNo` | `steps.length` |
 * | 지금 결재할 수 있는가 | `request.isMyTurn` | 앞 단계가 전부 승인인지 훑는 것 |
 * | 이 단계가 지금 차례인가 | `step.isCurrent` | 앞 단계들의 `decisionCode`로 판정 |
 * | 이 단계가 내 것인가 | `step.isMine` | 로그인 사용자와 `approverId` 맞춰 보기 |
 *
 * **왜 이렇게까지 못 박는가.** 목 서버가 내려주는 상세가 **자기모순이다** —
 * `currentStepNo`가 2인데 단계는 하나뿐이고, 그 하나는 결재됐는데 `isCurrent`가 참이다.
 * 실제 서버가 그럴 리 없다고 가정하면 안 된다. **판정을 두 곳에서 하면 언젠가 갈리고,
 * 갈리는 순간 사용자는 「눌리는데 400이 오는 버튼」을 본다.** 정본은 서버 하나다.
 *
 * ---
 *
 * **결재 결과 코드는 고정 OpenAPI가 닫은 값만 해석한다.** `REJECTED`는 반려로 그리며,
 * 그 밖의 결재 완료 코드는 서버 값을 그대로 표시한다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.approvalInbox;

/**
 * 반려를 뜻하는 결재 코드 — 고정 OpenAPI가 `REJECTED`로 닫았다.
 *
 * 디자인 시스템 `Stepper`에 `rejected` 상태가 있고 X 글리프를 그리지만, 지금 그것을 켜려면
 * `decisionCode` 문자열을 해석해야 한다. 그것이 **공유계약이 금지한 일**이다 —
 * 값 목록은 공통코드 소관이고, 화면이 「이 코드는 반려일 것」이라고 짐작하면 그 짐작이
 * 사용자에게는 사실로 보인다.
 *
 * 판정은 이 배열을 읽는 자리 하나뿐이며 `REJECTED` 단계는 반려로 그려진다.
 */
export const REJECTION_DECISION_CODES = ['REJECTED'] as const;

/** 그려진 단계 하나. **여기 있는 값은 전부 응답에서 온 것이거나 그 사실을 옮긴 글자다.** */
export interface StepProgressView {
  /** 서버가 매긴 단계 번호. 배열 차례로 다시 매기지 않는다. */
  stepNo: number;
  status: StepStatus;
  /** 승인자 이름. 비어 오면 **`approverId`를 대신 내지 않는다**(`omf-mes#44`). */
  approverLabel: string;
  /** 결재 결과 코드 **그대로**. 결재 전이면 `null`이다. */
  decisionCode: string | null;
  decisionAtText: string | null;
  decisionComment: string | null;
  /**
   * 결재 전 단계가 지금 어떤 상태인지 말하는 **보이는 글자**.
   *
   * 디자인 시스템은 상태 낱말(「완료·진행 중·대기·반려」)을 **스크린리더 전용 텍스트**로만
   * 내고 시각적으로는 색과 아이콘뿐이다. 그래서 보조 라벨이 보이는 글자를 맡는다.
   * 결재된 단계는 결과 코드가 그 자리를 맡으므로 `null`이다.
   */
  waitingText: string | null;
  /** 로그인 사용자가 이 단계의 승인자인가 — 서버 값 그대로. */
  isMine: boolean;
}

/** 결재 진행 구획이 그리는 것 전부. */
export interface RequestProgressView {
  /** 「2 / 3 단계」 또는 「결재 종료 · 전체 2단계」. **서버가 준 두 수 그대로다.** */
  positionText: string;
  /** 「지금 이 요청을 결재할 차례입니다」 또는 그 반대. **`isMyTurn` 그대로다.** */
  turnText: string;
  steps: StepProgressView[];
}

/** 값이 실려 왔는가. 계약이 선택 필드로 둔 문자열은 널·없음·빈 문자열이 모두 「없음」이다. */
const filled = (value: string | null | undefined): string | null => {
  const text = value ?? '';

  return text === '' ? null : text;
};

/**
 * 단계 하나의 상태.
 *
 * **결재했는가와 지금 차례인가, 둘로만 가른다.** 결재 기록이 있으면 완료이며, 그 코드가
 * 고정 목록의 `REJECTED`일 때만 반려다.
 *
 * **결재 기록이 있으면 `isCurrent`가 참이어도 완료다.** 두 값이 어긋나는 응답이 실재하고
 * (목 실측), 그때 「진행 중」으로 그리면 사용자가 이미 끝난 단계를 기다린다.
 */
const statusOf = (step: ApprovalStep, rejectionCodes: readonly string[]): StepStatus => {
  const decisionCode = filled(step.decisionCode);

  if (decisionCode === null) return step.isCurrent ? 'current' : 'pending';

  return rejectionCodes.includes(decisionCode) ? 'rejected' : 'complete';
};

/** 결재 전 단계가 지금 무엇을 기다리는지. 결재된 단계는 결과 코드가 말하므로 `null`이다. */
const waitingTextOf = (step: ApprovalStep): string | null => {
  if (filled(step.decisionCode) !== null) return null;

  return step.isCurrent ? t.progress.waitingCurrent : t.progress.waitingPending;
};

/**
 * 단계 배열을 그릴 값으로 옮긴다.
 *
 * 반려 코드 집합을 **인자로 받는다.** 자리표시를 읽는 자리를 한 곳으로 묶어야 「채우면
 * 반려가 된다」를 시험이 실제로 잴 수 있다 — 판정 안에 배열을 박아 넣으면 죽은 가지가 된다.
 *
 * **차례를 바꾸지 않는다.** 배열 순서가 곧 결재 순서이고 그것은 서버가 정한 것이다.
 */
export const toStepProgressViews = (
  steps: ApprovalStep[],
  rejectionCodes: readonly string[],
): StepProgressView[] =>
  steps.map((step) => ({
    stepNo: step.stepNo,
    status: statusOf(step, rejectionCodes),
    approverLabel: readableName(step.approverName, t.values.unknownApprover),
    decisionCode: filled(step.decisionCode),
    decisionAtText: (() => {
      const decisionAt = filled(step.decisionAt);

      return decisionAt === null ? null : formatDateTime(decisionAt);
    })(),
    decisionComment: filled(step.decisionComment),
    waitingText: waitingTextOf(step),
    isMine: step.isMine,
  }));

/**
 * 상세 응답 하나에서 결재 진행 구획이 그릴 것을 전부 만든다.
 *
 * **조회는 하나뿐이다** — 계약이 `steps`를 상세에 실어 주므로 단계 전용 조회를 만들지 않는다.
 */
export const toRequestProgressView = (
  detail: ApprovalRequestDetail,
  rejectionCodes: readonly string[],
): RequestProgressView => {
  const { request, steps } = detail;

  return {
    positionText:
      request.currentStepNo === null
        ? t.progress.finished(request.totalStepNo)
        : t.progress.position(request.currentStepNo, request.totalStepNo),
    turnText: request.isMyTurn ? t.progress.myTurn : t.progress.notMyTurn,
    steps: toStepProgressViews(steps, rejectionCodes),
  };
};
