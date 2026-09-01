import { AlertBanner, Button } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { toApiError } from '../../patterns/request';

/**
 * 조회·쓰기 실패의 원인을 한 줄 안내로 옮긴다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const describeError = (error: ApiError): string => {
  switch (error.kind) {
    case 'network':
      return messages.httpError.offline;
    case 'http':
      if (error.status === 403) return messages.httpError.forbidden;
      return error.message === undefined || error.message === ''
        ? messages.httpError.description
        : error.message;
    case 'conflict':
      return error.message === '' ? messages.httpError.description : error.message;
    case 'stateLocked':
    case 'validation': {
      const lines = error.errors.map((item) => item.message).join(' ');
      return lines === '' ? messages.httpError.description : lines;
    }
  }
};

/** 권한 없음인가. 같은 권한으로 다시 불러도 같은 답이 오므로 재시도를 붙이지 않는다. */
const isForbidden = (error: ApiError): boolean => error.kind === 'http' && error.status === 403;

export interface LoadErrorBannerProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
}

/**
 * 실패 배너. **실패를 빈 상태로 보이지 않는다** — 「없습니다」로 내면 작업자가 오늘 비가동이
 * 없는 것으로 읽고, 이미 적어 둔 구간을 한 번 더 적는다.
 */
export const LoadErrorBanner = ({ error, title, onRetry }: LoadErrorBannerProps) => {
  const apiError = toApiError(error);
  const forbidden = isForbidden(apiError);

  return (
    <div className="banner-slot">
      <AlertBanner
        variant="error"
        title={title ?? (forbidden ? messages.httpError.title : messages.httpError.loadTitle)}
        action={
          forbidden || onRetry === undefined ? undefined : (
            <Button variant="outlined" size="sm" onClick={onRetry}>
              {messages.common.retry}
            </Button>
          )
        }
      >
        {describeError(apiError)}
      </AlertBanner>
    </div>
  );
};
