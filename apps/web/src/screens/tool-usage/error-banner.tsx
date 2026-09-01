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

/**
 * 다시 눌러도 같은 답이 오는 상태 코드.
 *
 * ⛔ **여기에 「다시 시도」를 두지 않는다**(공유계약 G-23). 400 은 보낸 값이 규칙에 어긋난
 * 것이고 422 는 업무 규칙에 걸린 것이라, 값을 고치거나 사정이 달라지기 전에는 결과가 같다.
 * 누를 수 있는데 아무 일도 없는 컨트롤은 사용자를 헛돌게 하고 정작 해야 할 일을 가린다.
 */
const NO_RETRY_STATUSES: readonly number[] = [400, 422];

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

      /*
       * ⛔ **쓸 수 있는 문구가 하나도 없어도 「다시 시도」를 두지 않는다.** 이 갈래는 보낸 값이
       * 규칙에 어긋났다는 뜻이라 값이 그대로면 답도 그대로다 — 서버가 말을 못 했다는 사정은
       * 「다시 누르면 달라진다」로 바뀌지 않는다(`http` 갈래의 400·422와 같은 판단).
       */
      return lines.length === 0
        ? { lines: [messages.toolUsage.save.rejected], canRetry: false }
        : { lines, canRetry: false };
    }
    case 'conflict':
      /* 이 화면의 쓰기에는 낙관적 잠금이 없어 오지 않는 갈래다. 와도 침묵하지 않는다. */
      return { lines: [messages.httpError.description], canRetry: true };
    case 'http': {
      if (error.status === FORBIDDEN) {
        return { lines: [messages.toolUsage.save.forbidden], canRetry: false };
      }

      const canRetry = !NO_RETRY_STATUSES.includes(error.status);
      /*
       * ⛔ **서버가 준 사유를 삼키지 않는다.** 뭉갠 문구로 덮으면 「이미 마감된 작업지시입니다」
       * 같은, 사용자가 다음 행동을 정하는 데 필요한 유일한 단서가 사라진다. 계약 형태가 아닌
       * 응답에서도 `message` 는 남아 온다(`normalizeApiError`).
       */
      const serverLines = usableMessages(
        error.message === undefined ? [] : [{ message: error.message }],
      );

      if (serverLines.length > 0) return { lines: serverLines, canRetry };

      /* 서버가 아무 말도 하지 않았다 — 다시 눌러도 같은 답이면 그 사실에 맞는 안내를 낸다. */
      return {
        lines: [canRetry ? messages.httpError.description : messages.toolUsage.save.rejected],
        canRetry,
      };
    }
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
