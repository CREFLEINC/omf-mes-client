import { AlertBanner, Button } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

/**
 * 이 화면의 실패를 말하는 배너.
 *
 * ⛔ **공용 `SaveErrorBanner` 를 쓰지 않는다.** 그쪽은 리소스 이름을 알지 않아 권한 거부를
 * 공통 문구로 낸다. 이 화면의 403 은 **단말 게이팅**이고(스펙 §8 미결 6 · 통지 #547), 사용자가
 * 할 일이 「담당자 문의」로 정해져 있어 그렇게 말해야 한다.
 *
 * ⭐ **「다시 시도」는 다시 시도해서 달라지는 갈래에만 둔다**(공유계약 G-23). 권한 부족·업무 규칙
 * 위반은 같은 답이 오므로 두지 않는다 — 누를 수 있는데 아무 일도 없는 컨트롤은 사용자를
 * 헛돌게 하고 정작 해야 할 일을 가린다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const FORBIDDEN = 403;

interface BannerContent {
  lines: string[];
  canRetry: boolean;
}

/**
 * 서버가 준 문구를 쓸 수 있는 것만 남긴다.
 *
 * **잇기 전에 항목별로 거른다**(이 저장소 #192). 이어 붙인 뒤 검사하면 공백만인 문구나
 * 이음쇠 한 칸이 검사를 통과해, 제목만 있고 본문이 빈 배너가 선다.
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

      return lines.length === 0
        ? { lines: [messages.httpError.description], canRetry: true }
        : { lines, canRetry: false };
    }
    case 'conflict':
      /* 이 화면의 쓰기에는 낙관적 잠금이 없어 오지 않는 갈래다. 와도 침묵하지 않는다. */
      return { lines: [messages.httpError.description], canRetry: true };
    case 'http':
      return error.status === FORBIDDEN
        ? { lines: [messages.toolUsage.save.forbidden], canRetry: false }
        : { lines: [messages.httpError.description], canRetry: true };
  }
};

export interface ErrorBannerProps {
  error: ApiError;
  title: string;
  onRetry: () => void;
}

export const ErrorBanner = ({ error, title, onRetry }: ErrorBannerProps) => {
  const content = toContent(error);

  const action: ReactNode = content.canRetry ? (
    <Button variant="outlined" size="sm" onClick={onRetry}>
      {messages.common.retry}
    </Button>
  ) : undefined;

  return (
    <div className="banner-slot">
      <AlertBanner variant="error" title={title} action={action}>
        {content.lines.join(' ')}
      </AlertBanner>
    </div>
  );
};
