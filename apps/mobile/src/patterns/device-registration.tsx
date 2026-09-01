import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react';

import { clearDeviceToken, readDeviceToken, writeDeviceToken } from './device-token';

export type RegistrationStatus = 'loading' | 'unregistered' | 'registered';

export interface DeviceRegistration {
  status: RegistrationStatus;
  /**
   * 토큰을 두고 verify 가 끝나야 등록으로 친다.
   *
   * verify 는 그 토큰으로 서버를 한 번 부르는 자리다 — 기기는 QR 을 읽기만 하므로, 서버가
   * 받아 주는지는 실제로 불러 봐야 안다. 거절당한 토큰을 남기면 다음 실행에서 등록된 것처럼
   * 보이고, 작업자는 어느 화면에서도 인증 오류만 만난다.
   */
  register: (token: string, verify: () => Promise<void>) => Promise<void>;
  unregister: () => Promise<void>;
}

const DeviceRegistrationContext = createContext<DeviceRegistration | null>(null);

/**
 * 단말 토큰은 앱 밖에서 주입된다 — 관리웹이 만든 등록 QR 을 기기가 읽을 뿐이다.
 * 토큰 없이 열리는 서버 경로가 없으므로 등록 여부가 앱 전체의 관문이 된다.
 *
 * 보관은 Keystore 다. 앱을 지우면 토큰도 함께 사라지며 그것이 등록 해제와 같은 뜻이다.
 */
export const DeviceRegistrationProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<RegistrationStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    // 읽지 못한 것은 등록을 증명하지 못한 것이다. 다시 등록을 청하는 쪽이 안전하다.
    void readDeviceToken()
      .catch(() => null)
      .then((token) => {
        if (!cancelled) {
          setStatus(token === null ? 'unregistered' : 'registered');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const register = useCallback(async (token: string, verify: () => Promise<void>) => {
    await writeDeviceToken(token);

    try {
      await verify();
    } catch (error) {
      await clearDeviceToken();
      throw error;
    }

    setStatus('registered');
  }, []);

  const unregister = useCallback(async () => {
    await clearDeviceToken();
    setStatus('unregistered');
  }, []);

  return (
    <DeviceRegistrationContext value={{ status, register, unregister }}>
      {children}
    </DeviceRegistrationContext>
  );
};

export const useDeviceRegistration = (): DeviceRegistration => {
  const registration = use(DeviceRegistrationContext);

  if (registration === null) {
    throw new Error('useDeviceRegistration은 DeviceRegistrationProvider 안에서만 쓸 수 있습니다.');
  }

  return registration;
};
