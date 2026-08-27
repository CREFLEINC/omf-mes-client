import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { dispositionLockReason } from './disposition-codes';

export interface DecisionLockInput {
  /** 고른 부적합. 없으면 판정할 대상이 없다. */
  selectedId: number | null;
  isSaving: boolean;
  /** 저장이 되돌린 오류. */
  writeError: ApiError | null;
  /** 부적합 상세 조회가 되돌린 오류. */
  detailError: ApiError | null;
  /** 대상 LOT의 단위. 갈리거나 없으면 `undefined`. */
  uomId: number | undefined;
  dispositionTypeCodes: readonly string[];
  /**
   * 적용 여부를 모르는 판정이 **지금 고른 부적합이 아닌** 다른 부적합을 겨누고 있으면 그 번호.
   *
   * ⭐ 이것이 없으면 탈출구가 **거짓 확인**이 된다 — 다른 부적합으로 옮긴 뒤 「확인」을 누르면
   * 화면은 겨냥된 레코드를 한 번도 읽지 않은 채 잠금을 지우고, 미해결 쓰기가 있었다는 사실이
   * 화면에서 사라진다.
   */
  otherPendingWriteNo?: string;
}

export interface DecisionLock {
  /** 판정 컨트롤을 잠그는 사유. 없으면 잠그지 않는다. */
  reason: string | undefined;
  /**
   * ⭐ **서버에 적용됐는지 모르는 상태다.** 잠그되 **빠져나갈 길을 함께 내야 한다** —
   * 길이 없으면 사용자는 새로고침으로 나가고, 그 순간 멱등 키가 사라져
   * 「같은 키로 안전하게 다시 누른다」가 성립하지 않게 된다. 이중 실행 위험이 되살아난다.
   */
  isUncertain: boolean;
}

const HTTP_SERVER_ERROR = 500;

/**
 * 적용 여부를 모르는 실패인가.
 *
 * ⚠ **연결 실패와 5xx를 한 묶음으로 본다.** 둘 다 요청이 서버에 닿았는지·커밋됐는지 알 수 없다.
 * 판정 저장은 LOT 상태 전이를 같은 트랜잭션으로 부르므로(B-8) **한쪽만 잠그면 최악의 조합**이
 * 된다 — 불명인데 열려 있어 다시 보내거나, 불명인데 탈출구가 없다.
 */
const isUnknownOutcome = (error: ApiError | null): boolean =>
  error !== null &&
  (error.kind === 'network' || (error.kind === 'http' && error.status >= HTTP_SERVER_ERROR));

const isForbidden = (error: ApiError | null): boolean =>
  error !== null && error.kind === 'http' && error.status === 403;

/**
 * 판정 컨트롤을 잠글지, 잠근다면 왜인지.
 *
 * **순서에 뜻이 있다** — 앞의 것이 더 급한 사실이다. 대상이 없으면 권한을 따질 것도 없고,
 * 적용 여부를 모르는 저장이 남아 있으면 다른 무엇보다 그것부터 확인해야 한다.
 *
 * 순수 함수로 둔 이유는 **우선순위를 감지기가 고정할 수 있게** 하기 위해서다 — 화면 본문의
 * if/else 사슬로 두면 어느 갈래가 어느 갈래를 가리는지 아무도 확인하지 못한다.
 */
export const toDecisionLock = (input: DecisionLockInput): DecisionLock => {
  const t = messages.dispositionDecision.form;

  if (input.selectedId === null) return { reason: t.selectFirstReason, isUncertain: false };
  if (input.isSaving) return { reason: t.savingReason, isUncertain: false };
  if (isUnknownOutcome(input.writeError)) {
    return {
      reason:
        input.otherPendingWriteNo === undefined
          ? t.uncertainReason
          : t.uncertainOtherTarget(input.otherPendingWriteNo),
      isUncertain: true,
    };
  }

  /* ⚠ 저장 403도 본다 — 읽기는 되고 쓰기만 막히는 게이팅이 계약에 있다(단말·권한). */
  if (isForbidden(input.writeError) || isForbidden(input.detailError)) {
    return { reason: t.forbiddenReason, isUncertain: false };
  }

  /*
   * ⛔ 단위를 정할 수 없으면 잠근다 — **사유를 보이면서** 잠근다.
   * 열어 두면 버튼은 활성인데 눌러도 아무 일이 없어, 사용자가 무엇이 잘못됐는지 알 수 없다.
   */
  if (input.uomId === undefined) return { reason: t.unitUnknownReason, isUncertain: false };

  return { reason: dispositionLockReason(input.dispositionTypeCodes), isUncertain: false };
};
