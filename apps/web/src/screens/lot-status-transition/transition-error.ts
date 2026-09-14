import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

const t = messages.lotStatusTransition.stale;

export const isTransitionStale = (error: ApiError | null): boolean =>
  error?.kind === 'conflict' ||
  (error?.kind === 'http' && (error.status === 409 || error.status === 412));

export const transitionStaleMessage = (
  error: ApiError | null,
  statusLabel: (code: string) => string,
): string => {
  if (
    (error?.kind === 'conflict' || error?.kind === 'http') &&
    error.currentLotStatusCode !== undefined
  ) {
    return t.withStatus(statusLabel(error.currentLotStatusCode));
  }

  return (error?.kind === 'conflict' || error?.kind === 'http') &&
    error.message !== undefined &&
    error.message.trim() !== ''
    ? error.message
    : t.fallback;
};
