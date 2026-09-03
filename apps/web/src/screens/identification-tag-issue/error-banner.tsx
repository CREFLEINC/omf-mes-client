import { AlertBanner, Button } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

/**
 * 이 화면의 실패를 말하는 배너.
 *
 * ⛔ **공용 `SaveErrorBanner` 를 쓰지 않는다.** 이 화면의 403 은 **단말 출력 권한**이고
 * 409 는 **서버가 매긴 번호의 충돌**이라, 사용자가 할 일이 각각 「담당자 문의」와 「다시 시도」로
 * 갈린다. 공통 문구는 그 둘을 하나로 뭉친다.
 *
 * ⭐ **409 는 다시 부르면 풀린다** — 번호를 서버가 매기므로 사용자가 고칠 값이 없다.
 * ⚠ 자재LOT 번호는 **400** 이라 반대다(스캔한 값이 그대로 번호다) — 같은 「중복」인데 대응이
 * 다르므로, 이 화면의 판단을 그쪽으로 옮기지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const FORBIDDEN = 403;
const CONFLICT = 409;

/**
 * 다시 눌러도 같은 답이 오는 상태 코드.
 *
 * ⛔ **여기에 「다시 시도」를 두지 않는다**(공유계약 G-23). 400 은 보낸 값이 규칙에 어긋난
 * 것이고 422 는 업무 규칙에 걸린 것이라, 값을 고치거나 사정이 달라지기 전에는 결과가 같다.
 */
const NO_RETRY_STATUSES: readonly number[] = [400, 422];

const t = messages.identificationTagIssue;

interface BannerContent {
  lines: string[];
  canRetry: boolean;
}

/** 잇기 전에 항목별로 거른다 — 이어 붙인 뒤 검사하면 이음쇠 한 칸이 검사를 통과한다. */
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
        ? { lines: [t.error.rejected], canRetry: false }
        : { lines, canRetry: false };
    }
    case 'conflict':
      /* 원인 구분이 실린 409. 번호 충돌이든 다른 충돌이든 **다시 부르면 풀린다.** */
      return { lines: [t.error.duplicateSerial], canRetry: true };
    case 'http': {
      if (error.status === FORBIDDEN) return { lines: [t.error.forbidden], canRetry: false };

      /*
       * ⭐ 발번의 409 는 원인 구분(`conflictCause`)을 싣지 않아 `conflict` 갈래로 정규화되지
       * 않는다. 상태 코드로 한 번 더 집는다 — 놓치면 「다시 시도」가 사라져, 다시 누르기만
       * 하면 풀릴 실패에서 사용자가 멈춘다.
       */
      if (error.status === CONFLICT) return { lines: [t.error.duplicateSerial], canRetry: true };

      const canRetry = !NO_RETRY_STATUSES.includes(error.status);
      /* ⛔ 서버가 준 사유를 삼키지 않는다 — 다음 행동을 정하는 유일한 단서일 수 있다. */
      const serverLines = usableMessages(
        error.message === undefined ? [] : [{ message: error.message }],
      );

      if (serverLines.length > 0) return { lines: serverLines, canRetry };

      return {
        lines: [canRetry ? messages.httpError.description : t.error.rejected],
        canRetry,
      };
    }
  }
};

/**
 * 실패를 사람 말로 푼 줄들. **배너 밖에서도 같은 말을 쓸 수 있게** 내보낸다 — 같은 실패를
 * 두 자리에서 다르게 말하면 사용자는 어느 쪽이 참인지 알 수 없다.
 */
export const describeError = (error: ApiError): string[] => toContent(error).lines;

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
