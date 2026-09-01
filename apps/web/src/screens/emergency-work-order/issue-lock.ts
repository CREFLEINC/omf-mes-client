import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import type { ExpansionState } from './expansion';
import type { PendingWorkOrder } from './mutations';
import { isEmergencyTypeCodeKnown } from './work-order-type';

export interface IssueLockInput {
  /** 발행·배포 요청이 나가 있는 중인가. */
  isIssuing: boolean;
  /**
   * ⭐ **만들어졌으나 배포가 끝나지 않은 W/O.** 발행은 한 액션이지만 호출은 여럿이라, 앞은
   * 성공하고 뒤가 실패하는 창이 있다. 그 창에서는 **새 발행을 막고 배포 재시도만** 낸다 —
   * 여기서 새로 발행하면 같은 지시가 둘이 된다.
   */
  pending: PendingWorkOrder | null;
  /** 발행이 되돌린 오류. */
  issueError: ApiError | null;
  /** 발행됐는지 모르는 상태인가 — 2xx 를 받았는데 번호를 못 읽었다. */
  isCreateUncertain?: boolean;
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
 * ⚠ **이 판정은 완전하지 않다.** 오류 정규화가 계약 형태의 본문(`{ errors: [...] }`)을 만나면
 * **상태 코드를 버리므로**, 계약 형태로 온 5xx 는 여기 걸리지 않는다. 부품 쪽 고침이 필요한
 * 자리라 따로 올려 두었다(client#548) — 그때까지 **이것에만 기대지 않는다**: 배포 단계의 불명은 상태가
 * 아니라 **어디까지 갔는지**로 판정한다(`pending.failedAt`).
 */
const isUnknownOutcome = (error: ApiError | null): boolean =>
  error !== null &&
  (error.kind === 'network' || (error.kind === 'http' && error.status >= HTTP_SERVER_ERROR));

/** ⚠ 위와 같은 한계가 있다 — 계약 형태로 온 403 은 여기 걸리지 않고 서버 문구가 배너로 간다. */
const isForbidden = (error: ApiError | null): boolean =>
  error !== null && error.kind === 'http' && error.status === 403;

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
 * 1. **보내는 중** — 나가 있는 요청이 먼저다. ⛔ **배포 안 끝남보다 앞이다**: 정상 흐름에서도
 *    W/O 가 만들어진 «뒤 배포가 도는 동안» 그 상태가 잠깐 존재하는데, 뒤에 두면 그 찰나에
 *    「배포되지 않았습니다」가 뜨고 **재시도 버튼이 살아난다** — 첫 배포가 아직 전선에 있는데
 * 2. **배포 안 끝남** — 그것을 두고 새로 발행하면 같은 지시가 둘이 된다
 * 3. **결과 불명** · **권한 없음** — 결과를 모르는 요청, 사용자가 풀 수 없는 것
 * 4. **유형 값 미정** — 사용자가 아무것도 할 수 없다. 입력을 다 채우게 두고 나서 막지 않는다
 * 5. **전개 미완** · **입력 미완** — 사용자가 지금 할 수 있는 일
 *
 * 순수 함수로 둔 이유는 **우선순위를 감지기가 고정할 수 있게** 하기 위해서다.
 */
export const toIssueLock = (input: IssueLockInput): IssueLock => {
  const t = messages.emergencyWorkOrder.lock;

  if (input.isIssuing) {
    return { reason: t.issuing, isUncertain: false, canRetryRelease: false };
  }

  if (input.pending !== null) {
    /*
     * ⭐ **보내지 못한 것과 답을 못 받은 것을 갈라 말한다.** 「안 됐다」고 단언했다가 실제로
     * 됐으면 사용자가 두 번 배포한다. 어느 쪽이든 재시도는 같은 키로 나가 안전하다.
     */
    const isUnknown = input.pending.failedAt === 'unknown';

    return {
      reason: isUnknown
        ? t.releaseUnknown(input.pending.workOrderNo)
        : t.notSent(input.pending.workOrderNo),
      isUncertain: isUnknown,
      canRetryRelease: true,
    };
  }

  /*
   * ⛔ **번호를 못 읽은 2xx 는 「실패」가 아니다.** 지시가 이미 만들어졌을 수 있는데 번호를
   * 몰라 배포도 재시도도 낼 수 없다 — 여기서 「실패」로 말하면 사용자가 한 번 더 눌러
   * 긴급 지시가 둘이 된다. 상태 코드가 아니라 **2xx 를 받았다는 사실**로 판정하므로,
   * 정규화가 상태를 버리는 것과 무관하다.
   */
  if (input.isCreateUncertain === true) {
    return { reason: t.uncertain, isUncertain: true, canRetryRelease: false };
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
