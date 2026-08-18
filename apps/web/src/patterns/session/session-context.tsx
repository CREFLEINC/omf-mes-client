import type { components } from '@omf-mes/api-client';
import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';

/**
 * 로그인 결과이자 「지금 나는 누구이고 어디까지 보는가」.
 *
 * 계약 타입을 여기서 다시 별칭한다 — 허용 의존 규칙이 `patterns/` → `screens/` 참조를 막으므로
 * 화면 슬라이스의 같은 별칭을 쓸 수 없다. 전례(`patterns/api-context.tsx`)가 `ApiClient`를
 * 패키지에서 직접 가져오는 것과 같은 형태다.
 */
export type Session = components['schemas']['Session'];

export interface SessionValue {
  /** 로그인하지 않았으면 `null`. **「모른다」와 「비었다」를 같은 모양으로 두지 않는다** */
  session: Session | null;
  signIn: (session: Session) => void;
}

/**
 * 로그인 결과를 앱에 내려 주는 컨텍스트.
 *
 * **`patterns/`에 있는 이유**는 허용 의존 규칙이 `screens/`·`patterns/` → `app/` 참조를 막기
 * 때문이다(`app-inner-direction`). 마운트는 `app/providers.tsx`가 하고 읽기는 셸과 화면이
 * 한다 — `app/` → `patterns/`는 허용 방향이다. 전례 `patterns/api-context.tsx`가 같은 사정으로
 * 같은 자리에 있다.
 *
 * ⚠ **메모리에만 둔다 — 새로고침하면 사라진다.** 자격을 어떻게 실어 보내는지(쿠키·헤더)를
 * 계약이 아직 정하지 않아 세션을 되살릴 경로가 없다. 그것을 감추려고 저장소에 흉내를 내면
 * 「로그인돼 있는데 요청은 거절되는」 상태가 생긴다. 방식이 정해지면 **이 파일 하나에**
 * 복구 조회가 붙도록 경계를 그 모양으로 둔다.
 */
const SessionContext = createContext<SessionValue | null>(null);

export interface SessionProviderProps {
  children: ReactNode;
}

export const SessionProvider = ({ children }: SessionProviderProps) => {
  const [session, setSession] = useState<Session | null>(null);

  /**
   * **응답을 그대로 담는다.** 필요한 것만 골라 담으면 뒤따르는 화면이 권한 범위를 읽을 때
   * 다시 로그인을 시켜야 한다 — 지금 그리는 것이 이름 하나뿐인 것과는 별개다.
   */
  const signIn = useCallback((next: Session): void => {
    setSession(next);
  }, []);

  /* 값 객체를 매 렌더 새로 만들면 세션이 그대로인데도 읽는 쪽이 전부 다시 그린다. */
  const value = useMemo<SessionValue>(() => ({ session, signIn }), [session, signIn]);

  return <SessionContext value={value}>{children}</SessionContext>;
};

/**
 * ⛔ **프로바이더 밖에서 부르면 던진다** — 전례와 같은 규율이다.
 *
 * 기본값을 돌려주면 프로바이더를 잊은 화면이 **로그인하지 않은 상태로 정상 동작하는 것처럼**
 * 보이고, 그 어긋남은 세션을 실제로 읽는 자리에 가서야 드러난다.
 */
export const useSession = (): SessionValue => {
  const value = use(SessionContext);

  if (value === null) {
    throw new Error('useSession은 SessionProvider 안에서만 쓸 수 있습니다.');
  }

  return value;
};
