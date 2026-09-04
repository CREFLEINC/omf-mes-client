import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

/**
 * 「지금 등록할 수 없는 이유」를 한 곳에서 판정한다. 사유 문구는 규범 4 를 따른다 — 컨트롤 이름으로
 * 시작하고 풀리는 조건을 함께 적는다.
 */
export interface Lock {
  reason: string | undefined;
  /**
   * ⭐ 적용 여부를 모르는 저장이 남아 있다 — 잠그되 빠져나갈 길(결과 확인)을 함께 낸다. 길이 없으면
   * 사용자는 새로고침으로 나가고, 그 순간 멱등 키가 사라져 이중 입고 위험이 되살아난다.
   */
  isUncertain: boolean;
}

const UNLOCKED: Lock = { reason: undefined, isUncertain: false };

/** 통신이 끊기거나 5xx 로 끝난 쓰기 — 서버에 적용됐는지 모른다. */
export const isUncertainOutcome = (error: ApiError | null): boolean =>
  error !== null && (error.kind === 'network' || (error.kind === 'http' && error.status >= 500));

export interface SubmitLockInput {
  lineCount: number;
  activeLineCount: number;
  hasLineErrors: boolean;
  hasLocation: boolean;
  isSaving: boolean;
  writeError: ApiError | null;
}

export const toSubmitLock = (input: SubmitLockInput): Lock => {
  const t = messages.returnReceipt.lock;

  if (isUncertainOutcome(input.writeError)) return { reason: t.uncertain, isUncertain: true };
  if (input.isSaving) return { reason: t.saving, isUncertain: false };
  if (input.lineCount === 0) return { reason: t.noLines, isUncertain: false };
  if (input.hasLineErrors) return { reason: t.lineErrors, isUncertain: false };
  if (input.activeLineCount === 0) return { reason: t.noQty, isUncertain: false };
  if (!input.hasLocation) return { reason: t.noLocation, isUncertain: false };

  return UNLOCKED;
};
