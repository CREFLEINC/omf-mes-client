import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';

import { DeviceExpiredNotice } from '../patterns/device-expired-notice';
import { useDeviceRegistration } from '../patterns/device-registration';
import { deviceTokenKey } from '../patterns/load-failure';
import { DeviceRegistrationScreen } from '../screens/device-registration/screen';

const t = messages.deviceRegistration;

/**
 * 등록되지 않은 단말은 어떤 화면에도 닿지 못한다. 토큰 없이 열리는 서버 경로가 없어
 * 그 상태로 들어간 화면은 전부 인증 오류만 낸다.
 */
export const ShellGate = ({ children }: { children: ReactNode }) => {
  const { status } = useDeviceRegistration();
  const queryClient = useQueryClient();

  /*
   * 등록이 풀리면 앞 토큰의 판정을 버린다. 남겨 두면 새 QR 로 다시 등록한 멀쩡한 단말에
   * 앞 등록의 만료가 뜬다.
   */
  useEffect(() => {
    if (status === 'unregistered') {
      queryClient.removeQueries({ queryKey: deviceTokenKey });
    }
  }, [queryClient, status]);

  if (status === 'loading') {
    return <p role="status">{t.checking}</p>;
  }

  if (status === 'unregistered') {
    return <DeviceRegistrationScreen />;
  }

  return (
    <>
      <DeviceExpiredNotice />
      {children}
    </>
  );
};
