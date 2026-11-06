import { AlertBanner, Button } from '@crefle/web-ui';
import { isForbidden, type ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { toApiError } from '../../patterns/request';

/**
 * 조회 실패의 원인을 한 줄 안내로 옮긴다. `product-stock-status`의 같은 이름 부품과 같은 형태다.
 */
export const describeLoadError = (error: ApiError): string => {
  if (isForbidden(error)) return messages.httpError.forbidden;
  switch (error.kind) {
    case 'network':
      return messages.httpError.offline;
    case 'http':
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

export interface LoadErrorBannerProps {
  error: unknown;
  onRetry: () => void;
}

/**
 * 조회 실패 배너. 배치 규범 6에 따라 화면이 직접 배치하는 배너는 화면이 이음매(`.banner-slot`)를
 * 붙인다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const LoadErrorBanner = ({ error, onRetry }: LoadErrorBannerProps) => {
  const apiError = toApiError(error);
  const forbidden = isForbidden(apiError);

  return (
    <div className="banner-slot">
      <AlertBanner
        variant="error"
        title={forbidden ? messages.httpError.title : messages.httpError.loadTitle}
        action={
          forbidden ? undefined : (
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
