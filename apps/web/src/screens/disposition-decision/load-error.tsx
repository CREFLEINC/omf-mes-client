import { AlertBanner, Button } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { toApiError } from '../../patterns/request';

/**
 * 조회 실패를 화면 문구로 옮긴다.
 *
 * 이 화면은 조회가 넷이다(판정 대기 목록·부적합 상세·판정 이력·처리 이력). 각자 나름의
 * 실패 문구를 갖게 두면 같은 사태가 자리마다 다르게 읽힌다 — 한 곳에 모은다.
 *
 * ⚠ **저장 실패는 여기 오지 않는다.** 그쪽은 `patterns/master`의 `SaveErrorBanner`가 맡는다 —
 * 조회 실패는 「다시 시도」로 풀리고 저장 실패는 충돌·검증처럼 풀리는 방법이 다르다.
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
  /** 조회 훅이 돌려준 오류. `null`이면 아무것도 그리지 않는다. */
  error: unknown;
  /** 목록이 아니라 상세를 부르다 실패했으면 제목을 바꾼다. */
  isDetail?: boolean;
  onRetry: () => void;
}

/**
 * ⭐ **권한 없음(403)에는 「다시 시도」를 내지 않는다.** 눌러도 풀리지 않는 것에 버튼을 두면
 * 사용자가 할 수 없는 조치를 반복하게 된다(G-3 — 사유는 「어떻게 풀 것인가」를 담는다).
 */
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
