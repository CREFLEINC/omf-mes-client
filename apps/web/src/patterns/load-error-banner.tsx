import { AlertBanner, Button } from '@crefle/web-ui';
import { isForbidden, type ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { toApiError } from './request';

/**
 * 조회 실패의 원인을 한 줄 안내로 옮긴다. 권한 없음(403)이면 할 일(담당자 문의)을 말하고, 그 밖에는
 * 재시도가 조치다. 403 은 오류 봉투에 담겨 `validation` 으로 오므로 갈래보다 먼저 본다(`isForbidden`).
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
      /* 잇기 전에 거른다 — 공백만·빈 문구 여럿이 이음쇠만 남은 본문을 만들지 않게(client#192). */
      const lines = error.errors
        .map((item) => item.message)
        .filter((message) => message.trim() !== '')
        .join(' ');
      return lines === '' ? messages.httpError.description : lines;
    }
  }
};

export interface LoadErrorBannerProps {
  error: unknown;
  onRetry: () => void;
}

/**
 * 조회 실패 알림 한 장. 권한 없음(403)이면 그렇다고 말하고 [다시 시도]를 두지 않는다 — 같은
 * 권한으로 다시 불러도 같은 답이 오므로, 누를 수 있는데 아무 일도 없는 버튼이 할 일(담당자
 * 문의)을 가린다.
 *
 * 배너 자리(`.banner-slot`)를 화면이 이미 두었거나 본문 자리에 바로 그릴 때 쓴다. 그 밖에는
 * `LoadErrorBanner`.
 */
export const LoadErrorAlert = ({ error, onRetry }: LoadErrorBannerProps) => {
  const apiError = toApiError(error);
  const forbidden = isForbidden(apiError);

  return (
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
  );
};

/**
 * 목록과 상세의 조회 실패 배너(화면 구성 규범 6장 `LoadErrorBanner`, C-7). **실패를 빈 상태로
 * 보이지 않는다** — 「없습니다」로 내면 사용자가 자료가 없는 것으로 읽는다.
 *
 * 처음 쓴 곳은 자재 투입(P-02-03)이다. 화면 폴더의 같은 이름 복제본은 그 화면을 고칠 때 이것으로
 * 바꾼다.
 */
export const LoadErrorBanner = (props: LoadErrorBannerProps) => (
  <div className="banner-slot">
    <LoadErrorAlert {...props} />
  </div>
);
