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
 * ⭐ **확정(`:pack`)은 409 를 선언한다**(200·400·403·404·409) — 「이미 확정된 포장」이다.
 * 앞선 판(한 건 쓰기)의 등록 경로에는 그 갈래가 없어 화면이 일반 거부로 받았는데, 두 호출로
 * 돌아오면서 계약이 그 뜻을 되돌려 주었다.
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
     * ⭐ **이미 확정된 포장이다** — 계약이 `:pack` 의 409 로 선언한다. 되돌릴 화면이 없는
     * 쓰기라(§8-4) 여기서 사용자가 할 일은 「다음 포장 시작」뿐이다.
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

      /*
       * ⛔ **400 밖의 상태 코드에서 오는 글은 개발자 몫이다**(#1094 · 실기 2026-09-12).
       *
       * 400 은 계약이 「무엇이 잘못됐는지」를 담는 자리라 위에서 그대로 보이지만, 그 밖의
       * 코드(404·500…)에 실려 오는 문장은 서버 내부 사정이다. 그대로 내면 **작업자가 할 수
       * 있는 일이 하나도 없는 글**이 화면에 선다 — 목의 「씨앗에 없는 자원입니다」가 포장
       * 확정 실패 띠에 그대로 떴다.
       */
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
