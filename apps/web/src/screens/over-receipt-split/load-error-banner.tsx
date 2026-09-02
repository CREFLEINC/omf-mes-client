import { AlertBanner, Button } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { toApiError } from '../../patterns/request';

/**
 * 조회 실패의 원인을 한 줄 안내로 옮긴다.
 *
 * **조회 실패 전용이다.** 등록(쓰기) 실패는 갈래가 다르고(검증 400 · 권한 403 · 응답 없음)
 * 공통 `SaveErrorBanner`가 맡는다 — 그 배선은 PR ②에 있다. 둘을 한 부품으로 합치지 않는 이유는
 * 사용자가 할 조치가 다르기 때문이다. 조회 실패는 「다시 시도」로 풀리고, 등록 실패는 아니다.
 *
 * 서버가 빈 문구를 주는 일이 실제로 있다 — `??`는 빈 문자열을 통과시켜 배너 본문을 지운다.
 * 그래서 널이 아니라 빈 문자열까지 명시적으로 검사한다.
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
      /* client#192 — 잇기 전에 항목별로 거른다(공백만·빈 문구 여럿이 이음쇠만 남기지 않도록). */
      const lines = error.errors
        .map((item) => item.message)
        .filter((message) => message.trim() !== '')
        .join(' ');
      return lines === '' ? messages.httpError.description : lines;
    }
  }
};

/** 권한 없음인가. 같은 권한으로 다시 불러도 같은 답이 오므로 재시도를 붙이지 않는다. */
const isForbidden = (error: ApiError): boolean => error.kind === 'http' && error.status === 403;

export interface LoadErrorBannerProps {
  error: unknown;
  onRetry: () => void;
}

/**
 * 조회 실패 배너. 규범 6에 따라 화면이 직접 배치하는 배너는 화면이 이음매(`.banner-slot`)를 붙인다.
 *
 * **실패를 빈 상태로 보이지 않는다.** 「없습니다」로 내면 사용자가 자료가 없는 줄 알고 조건을 넓힌다 —
 * 실제로는 조회 자체가 되지 않은 것이라 무엇을 해도 결과가 같다.
 *
 * **권한 없음에는 「다시 시도」를 내지 않는다.** 누를 수 있는 조치를 주면 사용자를 헛돌게 하고,
 * 무엇을 해야 하는지(담당자 문의)를 가린다.
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
