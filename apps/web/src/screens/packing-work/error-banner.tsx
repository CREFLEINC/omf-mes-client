import { AlertBanner, Button } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

/**
 * 이 화면의 실패를 말하는 배너.
 *
 * ⛔ **공용 `SaveErrorBanner` 를 쓰지 않는다.** 이 화면의 400 은 **담은 것이 없다**이고 409 는
 * **이미 확정된 포장**이라, 사용자가 할 일이 「내용물을 담아라」와 「새 포장을 시작해라」로
 * 갈린다. 공통 문구는 그 둘을 하나로 뭉친다.
 *
 * ⛔ **어느 쪽에도 「다시 시도」를 두지 않는다** — 같은 요청을 다시 보내도 결과가 같다.
 * 400 은 담은 것이 생겨야 풀리고, 409 는 이 포장으로는 영영 풀리지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const BAD_REQUEST = 400;
const FORBIDDEN = 403;
const CONFLICT = 409;

const t = messages.packingWork;

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
        ? { lines: [t.error.emptyContents], canRetry: false }
        : { lines, canRetry: false };
    }
    case 'conflict':
      return { lines: [t.error.alreadyPacked], canRetry: false };
    case 'http': {
      if (error.status === FORBIDDEN) return { lines: [t.error.forbidden], canRetry: false };

      /*
       * ⭐ 확정의 409 는 원인 구분을 싣지 않아 `conflict` 갈래로 정규화되지 않는다. 상태
       * 코드로 한 번 더 집는다 — 놓치면 「이미 확정됐다」가 일반 실패 문구로 뭉개져, 사용자가
       * 같은 포장을 계속 다시 누른다.
       */
      if (error.status === CONFLICT) return { lines: [t.error.alreadyPacked], canRetry: false };
      if (error.status === BAD_REQUEST) {
        /* ⛔ 서버가 준 사유를 삼키지 않는다 — 빈 내용물 말고 다른 사유일 수 있다. */
        const serverLines =
          error.message === undefined ? [] : usableMessages([{ message: error.message }]);

        return {
          lines: serverLines.length > 0 ? serverLines : [t.error.emptyContents],
          canRetry: false,
        };
      }

      const serverLines =
        error.message === undefined ? [] : usableMessages([{ message: error.message }]);

      if (serverLines.length > 0) return { lines: serverLines, canRetry: true };

      return { lines: [messages.httpError.description], canRetry: true };
    }
  }
};

export interface PackErrorBannerProps {
  error: ApiError;
  title: string;
  onRetry: () => void;
}

export const PackErrorBanner = ({ error, title, onRetry }: PackErrorBannerProps) => {
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
