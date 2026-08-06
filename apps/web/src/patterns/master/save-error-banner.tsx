import type { ApiError } from '@omf-mes/api-client';
import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

export interface SaveErrorBannerProps {
  /** null이면 아무것도 렌더하지 않는다. */
  error: ApiError | null;
  /** 주면 충돌일 때만 「최신 불러오기」를 낸다. 재조회해도 풀리지 않는 오류에는 내지 않는다. */
  onReload?: () => void;
}

interface BannerContent {
  title?: string;
  lines: string[];
}

/** 여러 줄일 때만 목록으로 낸다. 한 줄을 목록으로 내면 없는 항목 구분이 생긴다. */
const BannerLines = ({ lines }: { lines: string[] }): ReactNode => {
  if (lines.length <= 1) return lines[0] ?? null;

  return (
    <ul>
      {lines.map((line, index) => (
        <li key={`${String(index)}-${line}`}>{line}</li>
      ))}
    </ul>
  );
};

/**
 * 정규화된 오류 5갈래를 화면 문구로 옮긴다.
 * 리소스 이름을 알지 않으므로 공통 규약 문구만 쓴다.
 */
const describeError = (error: ApiError): BannerContent => {
  switch (error.kind) {
    case 'conflict':
      return { lines: [messages.conflict[error.cause]] };
    case 'stateLocked': {
      /*
       * 서버가 「확정된 항목입니다」 같은 구체적 사유를 주면 함께 낸다.
       * 일반 문구로 뭉개면 재조회로 풀리지 않는 상태에서 사용자가 다음 행동을 정할 수 없다.
       */
      const serverLines = error.errors
        .map((item) => item.message)
        .filter((message) => message !== '');

      return {
        title: messages.stateLocked.title,
        lines: [messages.stateLocked.description, ...serverLines],
      };
    }
    case 'validation':
      // 화면이 인라인으로 소화하지 못한 오류만 여기 온다. 서버 문구를 그대로 나열한다 —
      // 삼키면 어디에도 보이지 않는 오류가 된다.
      return { lines: error.errors.map((item) => item.message) };
    case 'http': {
      if (error.status === 403) {
        return { title: messages.httpError.title, lines: [messages.httpError.forbidden] };
      }

      // 서버 문구는 있을 때만 덧붙인다. 빈 문자열을 그대로 실으면 빈 줄이 생긴다.
      const serverLines =
        error.message === undefined || error.message === '' ? [] : [error.message];

      return {
        title: messages.httpError.title,
        lines: [messages.httpError.description, ...serverLines],
      };
    }
    case 'network':
      return { title: messages.httpError.title, lines: [messages.httpError.offline] };
  }
};

export const SaveErrorBanner = ({ error, onReload }: SaveErrorBannerProps) => {
  if (error === null) return null;

  const { title, lines } = describeError(error);
  // 재조회로 풀리는 것은 충돌뿐이다. 다른 오류에 「최신 불러오기」를 내면 입력만 버리게 된다.
  const canReload = error.kind === 'conflict' && onReload !== undefined;

  return (
    <div className="banner-slot">
      <AlertBanner
        variant="error"
        title={title}
        action={
          canReload ? (
            <>
              <Button variant="outlined" size="sm" onClick={onReload}>
                {messages.conflict.reloadAction}
              </Button>
              <span className="field-note">{messages.conflict.reloadNote}</span>
            </>
          ) : undefined
        }
      >
        <BannerLines lines={lines} />
      </AlertBanner>
    </div>
  );
};
