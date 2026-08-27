import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import type { ExpansionState } from './expansion';
import { isEmergencyTypeCodeKnown } from './work-order-type';

export interface IssueLockInput {
  /** 발행 요청이 나가 있는 중인가. */
  isIssuing: boolean;
  /**
   * ⭐ **만들어졌으나 배포되지 않은 W/O 의 번호.** 발행은 한 액션이지만 호출은 여럿이라,
   * 앞은 성공하고 뒤가 실패하는 창이 있다. 그 창에서는 **새 발행을 막고 배포 재시도만** 낸다 —
   * 여기서 새로 발행하면 같은 지시가 둘이 된다.
   */
  undeliveredWorkOrderNo: string | null;
  /** 발행이 되돌린 오류. */
  issueError: ApiError | null;
  expansion: ExpansionState;
  isInputComplete: boolean;
  /** 긴급을 뜻하는 유형 코드. 비어 있으면 아직 정해지지 않은 것이다. */
  typeCode?: string;
}

export interface IssueLock {
  /** 발행 컨트롤을 잠그는 사유. 없으면 잠그지 않는다. */
  reason: string | undefined;
  /**
   * ⭐ **서버에 닿았는지 모르는 상태다.** 잠그되 **빠져나갈 길을 함께 내야 한다** — 길이 없으면
   * 사용자는 새로고침으로 나가고, 그 순간 멱등 키가 사라져 「같은 키로 안전하게 다시 누른다」가
   * 성립하지 않는다.
   */
  isUncertain: boolean;
  /** 만들어진 W/O 를 배포만 다시 시도할 수 있는 상태인가. */
  canRetryRelease: boolean;
}

const HTTP_SERVER_ERROR = 500;

/**
 * 적용 여부를 모르는 실패인가.
 *
 * ⚠ **연결 실패와 5xx 를 한 묶음으로 본다.** 둘 다 요청이 서버에 닿았는지·커밋됐는지 알 수
 * 없다. 발행은 내부 P/O·계획·W/O 를 한 트랜잭션으로 만드는 호출이라, 모르는 채 다시 보내면
 * **같은 긴급 지시가 둘이 될 수 있다.**
 */
const isUnknownOutcome = (error: ApiError | null): boolean =>
  error !== null &&
  (error.kind === 'network' || (error.kind === 'http' && error.status >= HTTP_SERVER_ERROR));

const isForbidden = (error: ApiError | null): boolean =>
  error !== null && error.kind === 'http' && error.status === 403;

/**
 * 전개가 발행할 수 있는 상태인지, 아니면 왜 아닌지.
 *
 * 막힌 사유마다 **무엇이 갖춰지면 열리는지**를 함께 말한다 — 막혔다는 사실만 알리면 사용자가
 * 화면 밖에서 임의로 처리한다.
 */
const expansionReason = (state: ExpansionState): string | undefined => {
  const t = messages.emergencyWorkOrder.lock;

  switch (state.kind) {
    case 'ready':
      return undefined;
    case 'idle':
      return t.itemNotChosen;
    case 'loading':
      return t.expansionLoading;
    case 'error':
      return t.expansionError;
    case 'needsRevision':
      return t.revisionNotChosen;
    case 'blocked':
      return t.blocked[state.reason];
  }
};

/**
 * 발행 컨트롤을 잠글지, 잠근다면 왜인지.
 *
 * **순서에 뜻이 있다** — 앞의 것이 더 급한 사실이다.
 *
 * 1. **배포되지 않은 W/O** — 다른 무엇보다 먼저다. 그것을 두고 새로 발행하면 지시가 둘이 된다
 * 2. **보내는 중** · **결과 불명** — 결과를 모르는 요청이 있으면 그것부터 확인한다
 * 3. **권한 없음** — 사용자가 풀 수 없는 것이되 담당자에게 요청할 수는 있다
 * 4. **유형 값 미정** — 사용자가 아무것도 할 수 없다. 입력을 다 채우게 두고 나서 막지 않는다
 * 5. **전개 미완** · **입력 미완** — 사용자가 지금 할 수 있는 일
 *
 * ⛔ **4를 5보다 앞에 둔 것이 의도다.** 뒤에 두면 사용자가 품목을 고르고 수량과 사유를 다
 * 채운 뒤에야 「어차피 발행할 수 없다」를 만난다. 헛일을 시키지 않는다.
 *
 * 순수 함수로 둔 이유는 **우선순위를 감지기가 고정할 수 있게** 하기 위해서다 — 화면 본문의
 * if/else 사슬로 두면 어느 갈래가 어느 갈래를 가리는지 아무도 확인하지 못한다.
 */
export const toIssueLock = (input: IssueLockInput): IssueLock => {
  const t = messages.emergencyWorkOrder.lock;

  if (input.undeliveredWorkOrderNo !== null) {
    return {
      reason: t.undelivered(input.undeliveredWorkOrderNo),
      isUncertain: false,
      canRetryRelease: true,
    };
  }

  if (input.isIssuing) {
    return { reason: t.issuing, isUncertain: false, canRetryRelease: false };
  }

  if (isUnknownOutcome(input.issueError)) {
    return { reason: t.uncertain, isUncertain: true, canRetryRelease: false };
  }

  if (isForbidden(input.issueError)) {
    return { reason: t.forbidden, isUncertain: false, canRetryRelease: false };
  }

  if (!isEmergencyTypeCodeKnown(input.typeCode)) {
    return { reason: t.typeCodeUnknown, isUncertain: false, canRetryRelease: false };
  }

  const blocked = expansionReason(input.expansion);
  if (blocked !== undefined) {
    return { reason: blocked, isUncertain: false, canRetryRelease: false };
  }

  if (!input.isInputComplete) {
    return { reason: t.inputIncomplete, isUncertain: false, canRetryRelease: false };
  }

  return { reason: undefined, isUncertain: false, canRetryRelease: false };
};
