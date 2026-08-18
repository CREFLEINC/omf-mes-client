import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { splitInvalidErrors, type ChangeOutcome } from './change-outcome';

const t = messages.passwordChange;

/** 배너 한 장이 담을 것 — 제목과 본문 줄, 있으면 액션. */
export interface BannerContent {
  /**
   * ⭐ **제목도 갈래가 정한다.** 상수로 두면 제목이 본문을 부정하는 갈래가 생긴다 — 통신 실패에서
   * 「바꾸지 못했습니다」는 거짓일 수 있고, 제목이 먼저·굵게 읽히므로 그 거짓이 이긴다.
   */
  title: string;
  lines: string[];
  /** 눌러서 달라지는 갈래에만 둔다. `false`면 액션 자리를 만들지 않는다 */
  canRetry: boolean;
}

/**
 * 갈래를 배너 내용으로 옮긴다. **배너를 세우지 않아야 하는 갈래에는 `null`을 준다.**
 *
 * ⛔ **「다시 시도」는 다시 시도해서 달라지는 갈래에만 둔다**(공유계약 G-23 — 누를 수 있는데 아무
 * 일도 없는 컨트롤을 두지 않는다). 서버가 값을 문제 삼은 갈래는 **값을 고쳐야** 풀리므로 재시도가
 * 헛돌고, 정작 해야 할 일(값 수정)을 가린다.
 *
 * ⭐ **말과 컨트롤이 같은 곳을 가리킨다** — 문구가 「다시 시도하세요」라고 말하는 갈래에는 반드시
 * 누를 자리가 있다(전례 `login-error-banner.tsx`가 세운 규율).
 */
export const toBannerContent = (outcome: ChangeOutcome): BannerContent | null => {
  switch (outcome.kind) {
    case 'currentMismatch':
      /*
       * ⛔ **배너를 세우지 않는다 — 이 갈래의 자리는 그 칸 옆이다.** 이미 인증된 본인만 보는
       * 화면이라 지목해도 흘릴 것이 없고, 지목하지 않으면 세 칸 중 어디가 틀렸는지 알 수 없다.
       */
      return null;
    case 'invalid': {
      const { fieldErrors, bannerLines } = splitInvalidErrors(outcome.errors);

      if (bannerLines.length > 0) {
        return { title: t.banner.failureTitle, lines: bannerLines, canRetry: false };
      }

      /* 인라인으로 다 내려갔으면 배너를 세울 이유가 없다 — 같은 말을 두 자리에서 하지 않는다. */
      if (Object.keys(fieldErrors).length > 0) return null;

      /*
       * ⭐ **어디에도 보이지 않는 경로를 남기지 않는다.** 서버가 400을 주었는데 쓸 만한 문장이
       * 하나도 남지 않으면(전부 빈 문구였다면) 화면은 **무엇을 고쳐야 하는지 말하지 못하는
       * 상태**가 된다. 그때 남는 조치는 다시 보내는 것뿐이라 「다시 시도」가 함께 선다.
       */
      return {
        title: t.banner.failureTitle,
        lines: [messages.httpError.description],
        canRetry: true,
      };
    }
    case 'network':
      /*
       * ⭐ **제목과 본문이 같은 말을 한다.** 「바꾸지 못했다」고 단언하지 않는다 — 요청이 서버에
       * 닿았다면 이미 바뀌었고, 그때 실패라고 말하면 사용자를 옛 비밀번호로 돌려보낸다.
       */
      return {
        title: t.banner.unconfirmedTitle,
        lines: [t.banner.networkUnconfirmed],
        canRetry: true,
      };
    case 'unknown':
      /*
       * ⛔ 자격이 틀렸다고 말하지 않는다. **그렇다고 침묵하지도 않는다.** 상태 코드는 그리지
       * 않는다 — 사용자가 쓰지 않는 말이다. 고칠 값이 없고 서버 사정은 다시 보내면 달라질 수 있다.
       */
      return {
        title: t.banner.failureTitle,
        lines: [messages.httpError.description],
        canRetry: true,
      };
  }
};

export interface ChangeErrorBannerProps {
  outcome: ChangeOutcome;
  /** 「다시 시도」. 누르면 **같은 시도**가 다시 나간다(결정 ②) */
  onRetry: () => void;
}

/**
 * 비밀번호 변경 실패 배너 — **칸에 붙일 수 없는 실패만** 여기 선다.
 *
 * 규범 6에 따라 화면이 직접 배치하는 배너는 이음매(`.banner-slot`)를 **스스로** 갖는다 —
 * 소비하는 화면이 붙일 것을 잊을 수 없게.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const ChangeErrorBanner = ({ outcome, onRetry }: ChangeErrorBannerProps) => {
  const content = toBannerContent(outcome);

  if (content === null) return null;

  const action: ReactNode = content.canRetry ? (
    <Button variant="outlined" size="sm" onClick={onRetry}>
      {messages.common.retry}
    </Button>
  ) : undefined;

  /*
   * 여러 줄을 **한 글자로 이어 넘긴다** — 형제 배너들과 같은 방식이다. 요소로 쪼개면 문단 기본
   * 여백을 되돌릴 배치 클래스가 새로 필요한데, 디자인 시스템이 이 자리에 이미 본문 서식을 갖고 있다.
   */
  return (
    <div className="banner-slot">
      <AlertBanner variant="error" title={content.title} action={action}>
        {content.lines.join(' ')}
      </AlertBanner>
    </div>
  );
};
