import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { LoginOutcome } from './login-outcome';

const t = messages.login;

/**
 * 로그인 실패 배너 — **이 화면의 실패는 전부 여기 한 자리에 선다**(공유계약 G-1).
 *
 * 말하는 것은 **두 가지뿐이다**(#1034) — 로그인 정보가 맞지 않거나, 서버 쪽 사정이거나.
 * 갈래를 고르는 규칙은 `login-outcome.ts` 가 소유한다.
 *
 * ⛔ **인라인 필드 오류를 내지 않는다.** 칸 옆에 붙은 오류는 문구를 아무리 뭉뚱그려도
 * **붙은 자리가** 어느 칸이 문제인지 말한다 — 서버가 `field` 키를 주더라도 그것을 그 칸에
 * 옮기지 않는다(공유계약 F-7).
 *
 * ⛔ **「다시 시도」는 다시 시도해서 달라지는 갈래에만 둔다**(공유계약 G-23 — 누를 수 있는데
 * 아무 일도 없는 컨트롤을 두지 않는다). 로그인 정보 오류는 **값을 고쳐야** 풀리므로 그 자리에
 * 버튼을 두면 사용자를 헛돌게 하고 정작 해야 할 일을 가린다. 서버 쪽 사정은 다시 보내면
 * 달라질 수 있고, 문구도 「잠시 뒤 다시 시도하세요」라고 말한다 — 말과 컨트롤이 같은 곳을
 * 가리켜야 한다.
 *
 * 규범 6에 따라 화면이 직접 배치하는 배너는 이음매(`.banner-slot`)를 **스스로** 갖는다 —
 * 소비하는 화면이 붙일 것을 잊을 수 없게.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export interface LoginErrorBannerProps {
  outcome: LoginOutcome;
  /** 서버 오류의 「다시 시도」. 로그인 정보 오류에서는 불리지 않는다 */
  onRetry: () => void;
}

export const LoginErrorBanner = ({ outcome, onRetry }: LoginErrorBannerProps) => {
  const isCredentials = outcome.kind === 'credentials';

  const action: ReactNode = isCredentials ? undefined : (
    <Button variant="outlined" size="sm" onClick={onRetry}>
      {messages.common.retry}
    </Button>
  );

  return (
    <div className="banner-slot">
      <AlertBanner
        variant="error"
        title={isCredentials ? t.banner.credentialsTitle : t.banner.serverTitle}
        action={action}
      >
        {isCredentials ? t.banner.credentials : t.banner.server}
      </AlertBanner>
    </div>
  );
};
