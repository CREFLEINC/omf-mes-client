import { AlertBanner, Button } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

/**
 * 이 화면의 실패를 말하는 배너.
 *
 * ⛔ **공용 `SaveErrorBanner` 를 쓰지 않는다.** 이 화면의 409 는 **다른 단말이 먼저 완료한 것**
 * 이고 404 는 **목록이 낡은 것**이라, 사용자가 할 일이 둘 다 「다시 불러오기」다 — 「다시 시도」와
 * 다르다. 같은 버튼을 두면 되돌릴 수 없는 쓰기를 낡은 값 위에서 다시 보내게 된다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const FORBIDDEN = 403;
const NOT_FOUND = 404;
const CONFLICT = 409;

/**
 * 다시 눌러도 같은 답이 오는 상태 코드.
 *
 * ⛔ **여기에 「다시 시도」를 두지 않는다**(공유계약 G-23). 400 은 보낸 값이 규칙에 어긋난
 * 것이고 422 는 업무 규칙에 걸린 것이라, 값을 고치기 전에는 결과가 같다.
 */
const NO_RETRY_STATUSES: readonly number[] = [400, 422];

const t = messages.productionLotComplete;

/** 무엇을 하면 풀리는가. 되돌릴 수 없는 쓰기라 「다시 보내기」와 「다시 읽기」를 가른다. */
type Recovery = 'none' | 'retry' | 'reload';

interface BannerContent {
  lines: string[];
  recovery: Recovery;
}

/** 잇기 전에 항목별로 거른다 — 이어 붙인 뒤 검사하면 이음쇠 한 칸이 검사를 통과한다. */
const usableMessages = (errors: readonly { message: string }[]): string[] =>
  errors.map((item) => item.message).filter((message) => message.trim() !== '');

const toContent = (error: ApiError): BannerContent => {
  switch (error.kind) {
    case 'network':
      return { lines: [messages.httpError.offline], recovery: 'retry' };
    case 'validation':
    case 'stateLocked': {
      const lines = usableMessages(error.errors);

      return lines.length === 0
        ? { lines: [t.error.rejected], recovery: 'none' }
        : { lines, recovery: 'none' };
    }
    case 'conflict':
      /*
       * ⛔ **409 에 「다시 시도」를 주지 않는다.** 낙관적 잠금이 걸린 충돌이라 같은 토큰으로
       * 다시 보내면 또 막힌다 — 다시 읽어 와야 풀린다(B-1).
       */
      return { lines: [t.error.conflict], recovery: 'reload' };
    case 'http': {
      if (error.status === FORBIDDEN) return { lines: [t.error.forbidden], recovery: 'none' };
      if (error.status === NOT_FOUND) return { lines: [t.error.notFound], recovery: 'reload' };
      /*
       * ⭐ 원인 구분(`conflictCause`)이 실리지 않은 409 는 `conflict` 갈래로 정규화되지 않는다.
       * 상태 코드로 한 번 더 집는다 — 놓치면 다시 읽으면 풀릴 실패에서 사용자가 멈춘다.
       */
      if (error.status === CONFLICT) return { lines: [t.error.conflict], recovery: 'reload' };

      const recovery: Recovery = NO_RETRY_STATUSES.includes(error.status) ? 'none' : 'retry';
      /* ⛔ 서버가 준 사유를 삼키지 않는다 — 다음 행동을 정하는 유일한 단서일 수 있다. */
      const serverLines = usableMessages(
        error.message === undefined ? [] : [{ message: error.message }],
      );

      if (serverLines.length > 0) return { lines: serverLines, recovery };

      return {
        lines: [recovery === 'retry' ? messages.httpError.description : t.error.rejected],
        recovery,
      };
    }
  }
};

export interface ErrorBannerProps {
  error: ApiError;
  title: string;
  onRetry: () => void;
  onReload: () => void;
}

export const ErrorBanner = ({ error, title, onRetry, onReload }: ErrorBannerProps) => {
  const content = toContent(error);

  const action: ReactNode =
    content.recovery === 'none' ? undefined : (
      <Button
        variant="outlined"
        size="sm"
        onClick={content.recovery === 'reload' ? onReload : onRetry}
      >
        {content.recovery === 'reload' ? t.error.reload : messages.common.retry}
      </Button>
    );

  return (
    <div className="banner-slot">
      <AlertBanner variant="error" title={title} action={action}>
        {content.lines.join(' ')}
      </AlertBanner>
    </div>
  );
};
