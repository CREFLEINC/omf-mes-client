import type { ConflictCause } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

/**
 * 다건 확정의 실행과 결과 수집.
 *
 * ⭐⭐ **건별 호출이고 함께 되돌리지 않는다**(§6). `:confirm` 은 출하 하나를 확정하며, **확정을
 * 되돌릴 경로가 아예 없다**(§5-3). 그래서 중간에 실패해도 **앞서 확정된 건은 확정된 채로 남고,
 * 화면은 그것을 성공으로 «보여야» 한다.**
 *
 * ⛔ 「전부 실패했습니다」로 뭉뚱그리면 사용자가 **이미 확정된 건을 다시 확정하러 간다** — 서버가
 * 409 로 막아 주지만, 화면이 거짓을 말한 것은 그대로다.
 *
 * ⚠ **순차로 돈다.** 병렬로 던지면 어느 것이 먼저 닿았는지 알 수 없어, 낙관적 잠금 충돌이
 * 났을 때 「무엇이 먼저 반영됐는지」를 사용자에게 말할 수 없다.
 */

export type ConfirmFailureKind =
  'already-confirmed' | 'cancel-in-progress' | 'version-conflict' | 'lock-unavailable' | 'unknown';

export interface ConfirmOutcome {
  shipmentId: number;
  shipmentNo: string;
  /** 성공이면 `null`. */
  failure: ConfirmFailureKind | null;
  /**
   * `failure`가 `version-conflict`일 때만 있다 — 통보 221로 이 오퍼레이션의 모든 409가
   * `conflictCause`를 반드시 싣는다. 다른 사용자·ERP 재동기화·워커 중 무엇이 원인이냐에 따라
   * 사용자가 할 수 있는 다음 행동이 달라지므로 「다른 처리가 먼저 반영됐습니다」 하나로
   * 뭉뚱그리지 않는다(`failureReason`이 이어받는다).
   */
  conflictCause?: ConflictCause;
}

export interface ConfirmSummary {
  outcomes: ConfirmOutcome[];
  confirmed: number;
  failed: number;
}

export const summarizeOutcomes = (outcomes: readonly ConfirmOutcome[]): ConfirmSummary => {
  const failed = outcomes.filter((outcome) => outcome.failure !== null).length;
  return { outcomes: [...outcomes], confirmed: outcomes.length - failed, failed };
};

/**
 * 서버가 준 것으로 실패 갈래를 가른다.
 *
 * ⭐ **구조화 코드를 먼저 본다**(공유계약 A-9 ⓑ) — `message` 원문은 표시하지도 파싱하지도
 * 않는다. 계약이 이 오퍼레이션의 409 에 `ALREADY_CONFIRMED`·`CANCEL_IN_PROGRESS` 를 열거했고,
 * 낙관적 잠금 충돌은 B-1 의 형태로 온다.
 *
 * ⚠ **모르는 실패를 「이미 확정됨」으로 접지 않는다.** 접으면 사용자가 「그럼 됐네」로 읽고
 * 넘어가는데, 실제로는 확정되지 않았다.
 */
export const toFailureKind = (status: number, code: string | undefined): ConfirmFailureKind => {
  if (code === 'ALREADY_CONFIRMED') return 'already-confirmed';
  if (code === 'CANCEL_IN_PROGRESS') return 'cancel-in-progress';
  if (code === 'VERSION_CONFLICT') return 'version-conflict';
  /* 코드가 없어도 412·409 는 잠금 충돌의 자리다 — 다시 조회하면 풀린다는 안내가 맞다. */
  if (status === 412) return 'version-conflict';

  return 'unknown';
};

/**
 * @param conflictCause `version-conflict`일 때만 뜻이 있다. 없으면(계약 밖 값이거나 아직 안 실은
 *   구버전 서버) 예전처럼 공용 문구로 남는다 — 통보 221 전에도 이 함수가 성립해야 한다.
 */
export const failureReason = (kind: ConfirmFailureKind, conflictCause?: ConflictCause): string => {
  const t = messages.shipmentConfirm.result.reasons;

  switch (kind) {
    case 'already-confirmed':
      return t.alreadyConfirmed;
    case 'cancel-in-progress':
      return t.cancelInProgress;
    case 'version-conflict':
      /*
       * ⭐ **원인별로 다른 안내다**(통보 221). `save-error-banner.tsx`가 단건 저장 충돌에 쓰는
       * 것과 같은 공용 문구(`messages.conflict`)를 쓴다 — 다건 확정도 같은 「저장 경합」이라
       * 문구를 새로 짓지 않는다.
       */
      return conflictCause === undefined ? t.versionConflict : messages.conflict[conflictCause];
    case 'lock-unavailable':
      return t.lockUnavailable;
    default:
      return t.unknown;
  }
};

/** 실행이 끝난 뒤 사용자에게 낼 한 줄. */
export const summaryMessage = (summary: ConfirmSummary): string => {
  const t = messages.shipmentConfirm.result;

  if (summary.failed === 0) return t.allConfirmed(summary.confirmed);
  if (summary.confirmed === 0) return t.allFailed(summary.failed);

  return t.partial(summary.confirmed, summary.failed);
};

/**
 * 다시 시도할 수 있는 건.
 *
 * ⛔ **이미 확정된 건은 다시 담지 않는다** — 다시 보내 봐야 같은 409 가 돌아오고, 남겨 두면
 * 「실패 목록이 안 줄어드는」 화면이 된다. 나머지 셋은 조건이 바뀌면 풀린다.
 */
export const retryableIds = (summary: ConfirmSummary): number[] =>
  summary.outcomes
    .filter((outcome) => outcome.failure !== null && outcome.failure !== 'already-confirmed')
    .map((outcome) => outcome.shipmentId);
