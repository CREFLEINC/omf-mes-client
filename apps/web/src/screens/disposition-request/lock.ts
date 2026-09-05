import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import type { DecisionRow, TargetRow } from './types';

/**
 * 구획마다 「지금 할 수 없는 이유」를 한 곳에서 판정한다 — 구획이 셋이라 각자 판정하게 두면 같은
 * 사태를 자리마다 다르게 말한다. 사유 문구는 규범 4를 따른다: 컨트롤 이름으로 시작하고 풀리는
 * 조건을 함께 적는다.
 */

export interface Lock {
  /** 잠그는 사유. 없으면 잠그지 않는다 */
  reason: string | undefined;
  /**
   * ⭐ 적용 여부를 모르는 저장이 남아 있다 — 잠그되 빠져나갈 길(결과 확인)을 함께 낸다.
   * 길이 없으면 사용자는 새로고침으로 나가고, 그 순간 멱등 키가 사라져 이중 실행 위험이 되살아난다.
   */
  isUncertain: boolean;
}

const UNLOCKED: Lock = { reason: undefined, isUncertain: false };

/** 통신이 끊기거나 5xx로 끝난 쓰기 — 서버에 적용됐는지 모른다. */
const isUncertainOutcome = (error: ApiError | null): boolean =>
  error !== null && (error.kind === 'network' || (error.kind === 'http' && error.status >= 500));

export interface RegisterLockInput {
  row: TargetRow | null;
  severityReady: boolean;
  isSaving: boolean;
  writeError: ApiError | null;
}

/** ① 부적합 등록의 잠금. */
export const toRegisterLock = (input: RegisterLockInput): Lock => {
  const t = messages.dispositionRequest.register.lock;

  if (isUncertainOutcome(input.writeError)) return { reason: t.uncertain, isUncertain: true };
  if (input.isSaving) return { reason: t.saving, isUncertain: false };
  if (input.row === null) return { reason: t.noTarget, isUncertain: false };
  if (input.row.nonconformanceId !== null) {
    return {
      reason: t.alreadyRegistered(input.row.nonconformanceNo ?? String(input.row.nonconformanceId)),
      isUncertain: false,
    };
  }
  /* 부적합 목록에서 온 여러 LOT 부적합은 LOT을 특정할 수 없다 — 여기까지 오지 않지만 타입이 요구한다. */
  if (input.row.lotId === null) return { reason: t.noLot, isUncertain: false };
  /* G-2 — 선택지가 비면 지어내지 않고 사유를 단다. 저장 버튼도 같은 사유로 잠근다. */
  if (!input.severityReady) return { reason: t.severityPending, isUncertain: false };

  return UNLOCKED;
};

export interface RequestLockInput {
  row: TargetRow | null;
  /** 부적합 상세 조회 상태 — 잠금 토큰이 여기서 오므로 상세가 서기 전에는 의뢰할 수 없다 */
  detail: { isPending: boolean; isError: boolean };
  isSaving: boolean;
  writeError: ApiError | null;
}

/** ② 판정 의뢰의 잠금. 단계가 그 사유를 정한다 — 의뢰 전만 열린다. */
export const toRequestLock = (input: RequestLockInput): Lock => {
  const t = messages.dispositionRequest.request.lock;

  if (isUncertainOutcome(input.writeError)) return { reason: t.uncertain, isUncertain: true };
  if (input.isSaving) return { reason: t.saving, isUncertain: false };
  if (input.row === null) return { reason: t.noTarget, isUncertain: false };
  if (input.row.nonconformanceId === null)
    return { reason: t.noNonconformance, isUncertain: false };
  if (input.detail.isError) return { reason: t.loadFailed, isUncertain: false };
  if (input.detail.isPending) return { reason: t.loading, isUncertain: false };

  switch (input.row.stage) {
    case 'NOT_REQUESTED':
      return UNLOCKED;
    case 'PENDING_DECISION':
      return { reason: t.alreadyRequested, isUncertain: false };
    case 'DECIDED':
      return { reason: t.decided, isUncertain: false };
    case 'NONE':
      /* 부적합이 있는데 단계가 NONE일 수는 없다 — 위 가드가 먼저 걸린다. 타입이 전수를 요구한다. */
      return { reason: t.noNonconformance, isUncertain: false };
    case null:
      return { reason: t.unknownStage(input.row.stageCodeText), isUncertain: false };
  }
};

/**
 * ③ 후속 버튼 — 처분별로 활성 «조건»만 판정한다(스펙 §5-7). 조건이 맞아도 열 화면이 없으면
 * 그 사실을 사유로 말한다 — 재작업 실적 등록은 현장 단말(POP) 화면이고 폐기 품의는 아직
 * 만들어지지 않았다. 재고 재등록은 공개 화면이 서므로 정상 판정이 있으면 열린다.
 */
export interface FollowUpState {
  reason: string | undefined;
}

export interface FollowUpStates {
  rework: FollowUpState;
  disposal: FollowUpState;
  reinstate: FollowUpState;
}

export const toFollowUpStates = (decisions: readonly DecisionRow[]): FollowUpStates => {
  const t = messages.dispositionRequest.result.followUp;
  const has = (code: DecisionRow['dispositionTypeCode']): boolean =>
    decisions.some((decision) => decision.dispositionTypeCode === code);

  return {
    rework: { reason: has('REWORK') ? t.reworkUnavailable : t.reworkNotDecided },
    disposal: { reason: has('SCRAP') ? t.disposalUnavailable : t.disposalNotDecided },
    reinstate: { reason: has('NORMAL') ? undefined : t.reinstateNotDecided },
  };
};
