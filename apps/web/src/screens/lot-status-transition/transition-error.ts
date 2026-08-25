import type { ApiError } from '@omf-mes/api-client';

const STALE_FALLBACK = 'LOT 정보가 변경되었습니다. 최신 정보를 불러온 뒤 다시 확인하세요.';

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
    return `LOT 정보가 변경되었습니다. 현재 상태는 ${statusLabel(error.currentLotStatusCode)}입니다. 최신 정보를 불러온 뒤 다시 확인하세요.`;
  }

  return (error?.kind === 'conflict' || error?.kind === 'http') &&
    error.message !== undefined &&
    error.message.trim() !== ''
    ? error.message
    : STALE_FALLBACK;
};
