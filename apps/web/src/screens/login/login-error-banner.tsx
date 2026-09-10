import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { LoginOutcome } from './login-outcome';

const t = messages.login;

/** 배너 한 장이 담을 것 — 제목·본문과, 눌러서 풀 수 있는 갈래에만 두는 액션. */
interface BannerContent {
  title: string;
  body: string;
  canRetry: boolean;
}

/**
 * 갈래를 배너 내용으로 옮긴다.
 *
 * **셋이 각각 다른 조치를 가리킨다** — 값을 고친다 · 사람에게 요청한다 · 기다렸다 다시 보낸다.
 *
 * ⛔ **「다시 시도」는 다시 시도해서 달라지는 갈래에만 둔다**(공유계약 G-23 — 누를 수 있는데
 * 아무 일도 없는 컨트롤을 두지 않는다). 로그인 정보 오류는 **값을 고쳐야** 풀리고, 잠긴 계정은
 * 몇 번을 보내도 같은 답이 온다 — 그 자리에 버튼을 두면 사용자를 헛돌게 하고 정작 해야 할
 * 일(값 수정 · 관리자 요청)을 가린다.
 *
 * 역방향도 같은 규칙이다 — 서버 오류의 문구가 「잠시 뒤 다시 시도하세요」라고 말하므로 그
 * 갈래에는 **반드시** 누를 자리가 있어야 한다. 말과 컨트롤이 반대를 가리키면 하라고 한 일을
 * 할 수 없다.
 */
const toContent = (outcome: LoginOutcome): BannerContent => {
  switch (outcome.kind) {
    case 'credentials':
      return { title: t.banner.credentialsTitle, body: t.banner.credentials, canRetry: false };
    case 'locked':
      return { title: t.banner.lockedTitle, body: t.banner.locked, canRetry: false };
    case 'server':
      return { title: t.banner.serverTitle, body: t.banner.server, canRetry: true };
  }
};

export interface LoginErrorBannerProps {
  outcome: LoginOutcome;
  /** 서버 오류의 「다시 시도」. 다른 갈래에서는 불리지 않는다 */
  onRetry: () => void;
}

/**
 * 로그인 실패 배너 — **이 화면의 실패는 전부 여기 한 자리에 선다**(공유계약 G-1).
 *
 * 말하는 것은 **셋뿐이다**(#1034) — 로그인 정보 오류 · 계정 잠김 · 서버 오류. 갈래를 고르는
 * 규칙은 `login-outcome.ts` 가 소유한다.
 *
 * ⛔ **인라인 필드 오류를 내지 않는다.** 칸 옆에 붙은 오류는 문구를 아무리 뭉뚱그려도
 * **붙은 자리가** 어느 칸이 문제인지 말한다 — 서버가 `field` 키를 주더라도 그것을 그 칸에
 * 옮기지 않는다(공유계약 F-7).
 *
 * 규범 6에 따라 화면이 직접 배치하는 배너는 이음매(`.banner-slot`)를 **스스로** 갖는다 —
 * 소비하는 화면이 붙일 것을 잊을 수 없게.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const LoginErrorBanner = ({ outcome, onRetry }: LoginErrorBannerProps) => {
  const content = toContent(outcome);

  const action: ReactNode = content.canRetry ? (
    <Button variant="outlined" size="sm" onClick={onRetry}>
      {messages.common.retry}
    </Button>
  ) : undefined;

  return (
    <div className="banner-slot">
      <AlertBanner variant="error" title={content.title} action={action}>
        {content.body}
      </AlertBanner>
    </div>
  );
};
