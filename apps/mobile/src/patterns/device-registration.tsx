import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react';

import { clearDeviceToken, readDeviceToken, writeDeviceToken } from './device-token';

export type RegistrationStatus = 'loading' | 'unregistered' | 'registered';

export interface DeviceRegistration {
  status: RegistrationStatus;
  register: (token: string) => Promise<void>;
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

  const register = useCallback(async (token: string) => {
    await writeDeviceToken(token);
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
