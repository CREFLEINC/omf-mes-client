import { AlertBanner, Button } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { toApiError } from '../../patterns/request';

/**
 * 조회·쓰기 실패의 원인을 한 줄 안내로 옮긴다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
/**
 * 서버가 준 글을 **사용자에게 그대로 보여도 되는 자리**인가(#1094).
 *
 * ⭐ **검증 계열의 글은 사용자 몫이다** — 「수량이 0보다 커야 합니다」처럼 **무엇을 고치면
 * 되는지**를 담고, 그것을 삼키면 작업자가 할 일을 알 수 없다(공유계약 A-12).
 *
 * ⛔ **그 밖의 상태 코드에서 오는 글은 개발자 몫이다.** 500·404 따위에 실려 오는 문장은
 * 서버 내부 사정이라, 그대로 내면 **작업자가 할 수 있는 일이 하나도 없는 글**이 화면에 선다.
 * 실제로 목 서버의 「씨앗에 없는 자원입니다.」가 사용자 화면에 그대로 떴다(88단계 2회차).
 */
const KEEPS_USER_TEXT = new Set([400, 409, 422]);

export const describeError = (error: ApiError): string => {
  switch (error.kind) {
    case 'network':
      return messages.httpError.offline;
    case 'http': {
      if (error.status === 403) return messages.httpError.forbidden;

      /* ⛔ 개발자 몫의 글을 화면에 올리지 않는다 — 정해진 안내로 덮는다. */
      if (!KEEPS_USER_TEXT.has(error.status)) return messages.httpError.description;

      return error.message === undefined || error.message === ''
        ? messages.httpError.description
        : error.message;
    }
    case 'conflict':
      return error.message === '' ? messages.httpError.description : error.message;
    case 'stateLocked':
    case 'validation': {
      /* 검증 계열은 사용자가 고칠 것을 말한다 — 그대로 보인다. */
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
  /** 주면 닫기 단추가 선다. **쓰기 실패는 닫을 수 있어야 한다** — 다음 저장까지 남으면
   *  방금 저장한 것이 거부된 것처럼 읽힌다. */
  onDismiss?: () => void;
}

/**
 * 실패 배너. **실패를 빈 상태로 보이지 않는다** — 「없습니다」로 내면 작업자가 오늘 비가동이
 * 없는 것으로 읽고, 이미 적어 둔 구간을 한 번 더 적는다.
 */
export const LoadErrorBanner = ({ error, title, onRetry, onDismiss }: LoadErrorBannerProps) => {
  const apiError = toApiError(error);
  const forbidden = isForbidden(apiError);

  return (
    <div className="banner-slot">
      <AlertBanner
        variant="error"
        onDismiss={onDismiss}
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
