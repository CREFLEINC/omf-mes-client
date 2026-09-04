import { AlertBanner, Button } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { toApiError } from '../../patterns/request';

/**
 * 조회 실패를 화면 문구로 옮긴다. 이 화면은 조회가 넷이라(목록·상세·처분·선택지) 각자 나름의
 * 실패 문구를 갖게 두면 같은 사태가 자리마다 다르게 읽힌다 — 한 곳에 모은다.
 *
 * ⚠ 저장 실패는 여기 오지 않는다 — `patterns/master`의 `SaveErrorBanner`가 맡는다.
 */
export const describeLoadError = (error: ApiError): string => {
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
      const description = error.errors.map((item) => item.message).join(' ');
      return description === '' ? messages.httpError.description : description;
    }
  }
};

export interface LoadErrorBannerProps {
  error: unknown;
  isDetail?: boolean;
  onRetry: () => void;
}

/** 권한 없음(403)에는 「다시 시도」를 내지 않는다 — 눌러도 풀리지 않는 것에 버튼을 두지 않는다(G-3). */
export const LoadErrorBanner = ({
  error,
  isDetail = false,
  onRetry,
}: LoadErrorBannerProps): ReactNode => {
  if (error === null || error === undefined) return null;

  const apiError = toApiError(error);
  const isForbidden = apiError.kind === 'http' && apiError.status === 403;
  const loadTitle = isDetail ? messages.httpError.title : messages.httpError.loadTitle;

  return (
    <div className="banner-slot">
      <AlertBanner
        variant="error"
        title={isForbidden ? messages.httpError.title : loadTitle}
        action={
          isForbidden ? undefined : (
            <Button variant="outlined" size="sm" onClick={onRetry}>
              {messages.common.retry}
            </Button>
          )
        }
      >
        {describeLoadError(apiError)}
      </AlertBanner>
    </div>
  );
};
