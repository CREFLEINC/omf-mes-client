import { AlertBanner, Button } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

/**
 * 캘린더 조회가 실패했을 때 서는 배너.
 *
 * ⛔ **전례의 문자 그대로 형태를 베끼지 않았다.** 저장소의 같은 이름 사본 열아홉 곳이
 * 서버 문구를 `join(' ')` **한 뒤** 빈 문자열인지 검사하는데, 그 형태는 공백만 있는 문구와
 * 빈 문구 여럿에서 **공백만 그린 배너**를 만든다(client#192 — 전수 확인된 결함). 여기서는
 * **잇기 전에 항목별로 거른다.** 올바른 형태의 전례는 `login/login-error-banner.tsx`(#191)다.
 *
 * ⭐ **「다시 시도」는 다시 시도해서 달라지는 갈래에만 둔다**(공유계약 G-23). 권한 부족은
 * 같은 답이 오므로 두지 않는다 — 누를 수 있는데 아무 일도 없는 컨트롤은 사용자를 헛돌게 하고
 * 정작 해야 할 일(담당자 문의)을 가린다. 뒤집어서, **「다시 시도하세요」라고 말하는 갈래에는
 * 반드시 누를 자리가 있어야 한다.**
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

/** 배너 한 장이 담을 것. `canRetry` 가 거짓이면 액션 자리를 만들지 않는다. */
interface BannerContent {
  lines: string[];
  canRetry: boolean;
}

const FORBIDDEN = 403;

/**
 * 서버가 준 문구를 쓸 수 있는 것만 남긴다.
 *
 * **잇기 전에 거른다.** `[{message:'   '}]` 나 `[{message:''},{message:''}]` 를 이어 붙인 뒤
 * 검사하면 공백이나 이음쇠 한 칸이 남아 검사를 통과하고, 화면에는 제목만 있고 본문이 빈
 * 배너가 선다 — 사용자가 무엇을 해야 하는지 아무것도 얻지 못한다.
 */
const usableMessages = (errors: readonly { message: string }[]): string[] =>
  errors.map((item) => item.message).filter((message) => message.trim() !== '');

const toContent = (error: ApiError): BannerContent => {
  switch (error.kind) {
    case 'network':
      return { lines: [messages.httpError.offline], canRetry: true };
    case 'validation':
    case 'stateLocked': {
      const lines = usableMessages(error.errors);

      /* 쓸 수 있는 문구가 하나도 없으면 공용 안내로 떨어지고, 그때는 누를 자리를 함께 세운다. */
      return lines.length === 0
        ? { lines: [messages.httpError.description], canRetry: true }
        : { lines, canRetry: false };
    }
    case 'conflict':
      /* 조회에서는 오지 않는 갈래다. 와도 침묵하지 않는다 — 사용자가 할 수 있는 조치를 말한다. */
      return { lines: [messages.httpError.description], canRetry: true };
    case 'http':
      return error.status === FORBIDDEN
        ? { lines: [messages.httpError.forbidden], canRetry: false }
        : { lines: [messages.httpError.description], canRetry: true };
  }
};

export interface LoadErrorBannerProps {
  error: ApiError;
  onRetry: () => void;
}

export const LoadErrorBanner = ({ error, onRetry }: LoadErrorBannerProps) => {
  const content = toContent(error);

  const action: ReactNode = content.canRetry ? (
    <Button variant="outlined" size="sm" onClick={onRetry}>
      {messages.common.retry}
    </Button>
  ) : undefined;

  return (
    <div className="banner-slot">
      <AlertBanner variant="error" title={messages.httpError.loadTitle} action={action}>
        {content.lines.join(' ')}
      </AlertBanner>
    </div>
  );
};
