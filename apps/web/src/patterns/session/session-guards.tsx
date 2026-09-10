import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';

import { LOGIN_PATH, resolveReturnPath, type SessionRedirectState } from './return-path';
import { useSession } from './session-context';

const t = messages.session;

/**
 * 판정을 기다리는 동안 서는 자리.
 *
 * ⛔ **셸을 먼저 그려 두고 그 안에서 기다리지 않는다.** 그러면 미인증인 사람에게 메뉴 전체가
 * 한 번 번쩍이고 사라진다 — 가리려던 것을 보여 준 뒤에 가리는 셈이다.
 *
 * ⭐ **`role="status"`로 낸다.** 화면 읽기 프로그램을 쓰는 사람에게는 「비었다」와 「기다리는
 * 중이다」가 둘 다 아무 소리도 나지 않는 상태다.
 */
const SessionGate = ({ children }: { children: ReactNode }) => (
  <main className="session-gate">{children}</main>
);

const RestoringNotice = () => (
  <SessionGate>
    <p role="status">{t.restoring}</p>
  </SessionGate>
);

/**
 * 물어봤는데 답을 못 받았을 때. **로그인 화면으로 보내지 않는다** — 사정은
 * `session-context.tsx`의 `SessionStatus` 주석에 적었다.
 */
const UnknownNotice = ({ onRetry }: { onRetry: () => void }) => (
  <SessionGate>
    <AlertBanner
      variant="warning"
      title={t.unknown.title}
      action={
        <Button variant="text" size="sm" onClick={onRetry}>
          {t.unknown.retry}
        </Button>
      }
    >
      {t.unknown.body}
    </AlertBanner>
  </SessionGate>
);

/**
 * **로그인한 사람만 지나간다.** 관리웹 라우트 표 전체가 이 겹 아래에 선다.
 *
 * ⭐ **셸 «바깥»에 둔다.** 안에 두면 사이드바와 상단 바가 먼저 그려진 뒤에 판정이 끝나, 막으려던
 * 사람에게 메뉴 구조가 그대로 보인다. 업무 자료는 서버가 401로 막지만 **화면 구성은 서버가
 * 막아 주지 않는다** — 그것을 막는 것이 이 겹의 일이다.
 *
 * ⭐ **막힌 주소를 들려 보낸다.** 즐겨찾기로 깊은 화면을 열었다가 로그인한 사람이 첫 화면에
 * 떨어지면, 자기가 어디로 가려 했는지 기억해 다시 찾아 들어가야 한다.
 */
export const RequireSession = ({ children }: { children: ReactNode }) => {
  const { status, retryRestore } = useSession();
  const location = useLocation();

  if (status === 'restoring') return <RestoringNotice />;
  if (status === 'unknown') return <UnknownNotice onRetry={retryRestore} />;

  if (status === 'anonymous') {
    const state: SessionRedirectState = { from: `${location.pathname}${location.search}` };

    /*
     * **`replace`로 넘긴다.** 밀어 넣으면 막힌 주소가 히스토리에 남아, 로그인한 뒤 뒤로가기
     * 한 번에 다시 가드를 지나며 로그인 화면으로 튕긴다.
     */
    return <Navigate to={LOGIN_PATH} replace state={state} />;
  }

  return children;
};

/**
 * **로그인하지 «않은» 사람만 지나간다.** 로그인 화면 하나가 이 겹 아래에 선다.
 *
 * ⭐ **`unknown`은 통과시킨다.** 판정을 못 했다고 로그인마저 막으면 세션이 만료된 사람이
 * 들어올 길이 사라진다 — 그 사람에게 지금 필요한 것이 바로 이 화면이다.
 */
export const GuestOnly = ({ children }: { children: ReactNode }) => {
  const { status } = useSession();
  const location = useLocation();

  if (status === 'restoring') return <RestoringNotice />;

  /*
   * 이미 로그인한 사람이 주소창으로 `/login`을 열었을 때다. 로그인 화면을 보이면 자기가
   * 로그인된 줄 모르고 자격을 한 번 더 친다.
   */
  if (status === 'authenticated') return <Navigate to={resolveReturnPath(location.state)} replace />;

  return children;
};
