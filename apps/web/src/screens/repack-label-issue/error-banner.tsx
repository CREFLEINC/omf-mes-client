import { AlertBanner, Button } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

/**
 * 이 화면의 발행 실패를 말하는 배너.
 *
 * ⛔ **공용 `SaveErrorBanner` 를 쓰지 않는다.** 여기의 403 은 **단말 출력 권한**이라 사용자가 할
 * 일이 「담당자 문의」이고, 422 는 **재발행 사유가 빠진 것**이라 「사유를 고르는 것」이다. 공통
 * 문구는 그 둘을 하나로 뭉친다.
 *
 * ⚠ **`P-02-09` 의 같은 이름 파일을 사본으로 가져왔다.** 그 화면과 이 화면은 403·422 의 뜻이
 * 같다 — 단말 출력 권한과 재발행 사유 누락이다. ⛔ **사본이므로 원본이 바뀌어도 따라오지
 * 않는다.**
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const FORBIDDEN = 403;

/**
 * 다시 눌러도 같은 답이 오는 상태 코드.
 *
 * ⛔ **여기에 「다시 시도」를 두지 않는다**(공유계약 G-23). 400 은 보낸 값이 규칙에 어긋난 것이고
 * 422 는 업무 규칙에 걸린 것이라, 값을 고치기 전에는 결과가 같다 — 이 화면에서는 대개
 * **재발행 사유**다.
 */
const NO_RETRY_STATUSES: readonly number[] = [400, 422];

const t = messages.repackLabelIssue;

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
      return { lines: [t.error.rejected], canRetry: true };
    case 'http': {
      if (error.status === FORBIDDEN) return { lines: [t.error.forbidden], canRetry: false };

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
