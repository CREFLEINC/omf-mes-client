import { AlertBanner, Button } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { toApiError } from '../../patterns/request';

/**
 * 조회 실패의 원인을 한 줄 안내로 옮긴다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
/**
 * 서버가 준 문구를 **쓸 수 있는 것만** 남긴다.
 *
 * ⛔ **이어 붙인 뒤에 검사하지 않는다.** `[{message:'   '}]` 나 빈 문구 여럿을 `join` 한 뒤
 * 빈 문자열인지 보면, 공백 하나나 이음쇠 한 칸이 남아 검사를 통과한다 — 제목만 있고 본문이
 * 빈 배너가 서서 작업자가 무엇을 해야 하는지 아무것도 얻지 못한다.
 */
const usableMessages = (errors: readonly { message: string }[]): string[] =>
  errors.map((item) => item.message).filter((message) => message.trim() !== '');

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
      const lines = usableMessages(error.errors);

      return lines.length === 0 ? messages.httpError.description : lines.join(' ');
    }
  }
};

/** 권한 없음인가. 같은 권한으로 다시 불러도 같은 답이 오므로 재시도를 붙이지 않는다. */
const isForbidden = (error: ApiError): boolean => error.kind === 'http' && error.status === 403;

export interface LoadErrorBannerProps {
  error: unknown;
  title: string;
  onRetry?: () => void;
}

/**
 * 실패 배너. **실패를 빈 상태로 보이지 않는다** — 「없습니다」로 내면 작업자가 세션이 없는
 * 것으로 읽고 이미 시작한 작업을 한 번 더 시작한다.
 */
export const LoadErrorBanner = ({ error, title, onRetry }: LoadErrorBannerProps) => {
  const apiError = toApiError(error);
  const forbidden = isForbidden(apiError);

  return (
    <div className="banner-slot">
      <AlertBanner
        variant="error"
        title={title}
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
