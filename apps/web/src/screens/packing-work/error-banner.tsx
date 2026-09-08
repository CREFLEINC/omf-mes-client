import { AlertBanner, Button } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

/**
 * 이 화면의 실패를 말하는 배너.
 *
 * ⛔ **공용 `SaveErrorBanner` 를 쓰지 않는다.** 이 화면의 400 은 **담은 것이 없다**라, 사용자가
 * 할 일이 「내용물을 담아라」로 정해진다. 공통 문구는 그것을 일반 실패로 뭉갠다.
 *
 * ⚠ **확정은 `POST /inventory/handling-units` 한 건이고 그 계약에 409 가 없다**(201·400·403).
 * 앞선 판이 갈라 말하던 「이미 확정된 포장」은 `:pack` 의 것이었고, 그 호출을 쓰지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const BAD_REQUEST = 400;
const FORBIDDEN = 403;

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
    /*
     * ⚠ **계약에 없는 갈래다** — 확정(`POST /inventory/handling-units`)의 응답은 201·400·403
     * 뿐이다. 그래도 갈래를 비워 두지 않는다: 서버 구성이 달라 오면 화면이 아무 말도 못 한다.
     *
     * ⛔ **서버가 준 말을 그대로 내지 않는다.** 계약에 없는 응답이라 그 문장이 무엇일지 우리가
     * 통제하지 못한다 — 작업자에게는 원문이 아니라 다음에 할 일만 말한다.
     *
     * ⛔ **다시 시도를 열지 않는다.** 충돌로 되돌아온 것은 같은 요청을 다시 보내도 결과가
     * 같다 — 열어 두면 작업자가 같은 버튼을 되풀이한다.
     */
    case 'conflict':
      return { lines: [messages.httpError.description], canRetry: false };
    case 'http': {
      if (error.status === FORBIDDEN) return { lines: [t.error.forbidden], canRetry: false };
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
