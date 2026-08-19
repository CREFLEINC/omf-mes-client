import { AlertBanner, Button } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { toApiError } from '../../patterns/request';

/**
 * 조회 실패의 원인을 한 줄 안내로 옮긴다.
 * 이 화면은 이 회차에 쓰기가 없어 사용자가 할 수 있는 조치가 재시도뿐이라 액션도 하나다.
 *
 * 서버가 빈 문구를 주는 일이 실제로 있다 — `??`는 빈 문자열을 통과시켜 배너 본문을 지운다.
 * 그래서 널이 아니라 빈 문자열까지 명시적으로 검사한다.
 *
 * ⭐ **여러 오류를 이을 때는 잇기 전에 항목별로 다듬는다.** 형제 화면들의 사본은 이은 뒤에
 * 한 번만 검사하는데, 그 형태로는 항목이 공백뿐일 때 이음쇠 공백이 남아 빠져나가고 본문이
 * 빈 배너가 선다. 전례는 `login/login-error-banner.tsx`다.
 */
export const describeLoadError = (error: ApiError): string => {
  switch (error.kind) {
    case 'network':
      return messages.httpError.offline;
    case 'http':
      if (error.status === 403) return messages.httpError.forbidden;
      return error.message === undefined || error.message.trim() === ''
        ? messages.httpError.description
        : error.message;
    case 'conflict':
      return error.message.trim() === '' ? messages.httpError.description : error.message;
    case 'stateLocked':
    case 'validation': {
      const lines = error.errors
        .map((item) => item.message)
        .filter((message) => message.trim() !== '');

      return lines.length === 0 ? messages.httpError.description : lines.join(' ');
    }
  }
};

/**
 * 권한 없음인가.
 *
 * **목록에 403이 계약에 적혀 있지 않다**(실측 — 200과 400뿐이다). 그러나 권한 없는 사용자가
 * 무엇을 받는지도 계약이 말하지 않으므로 갈래를 지우지 않는다. 계약에 없다고 오지 않는다는
 * 뜻은 아니다.
 */
const isForbidden = (error: ApiError): boolean => error.kind === 'http' && error.status === 403;

export interface LoadErrorBannerProps {
  error: unknown;
  onRetry: () => void;
}

/**
 * 조회 실패 배너. 규범 6에 따라 화면이 직접 배치하는 배너는 화면이 이음매(`.banner-slot`)를 붙인다.
 *
 * **실패를 빈 상태로 보이지 않는다.** 「없습니다」로 내면 사용자가 알림이 없는 줄 알고 기간을
 * 넓힌다 — 실제로는 조회 자체가 되지 않은 것이라 무엇을 해도 결과가 같다.
 *
 * **권한 없음에는 「다시 시도」를 내지 않는다.** 같은 권한으로 다시 불러도 같은 답이 온다 —
 * 누를 수 있는 조치를 주면 사용자를 헛돌게 하고, 무엇을 해야 하는지(담당자 문의)를 가린다.
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
