import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { useDeviceRegistration } from '../patterns/device-registration';
import { DeviceRegistrationScreen } from '../screens/device-registration/screen';

const t = messages.deviceRegistration;

/**
 * 등록되지 않은 단말은 어떤 화면에도 닿지 못한다. 토큰 없이 열리는 서버 경로가 없어
 * 그 상태로 들어간 화면은 전부 인증 오류만 낸다.
 */
export const ShellGate = ({ children }: { children: ReactNode }) => {
  const { status } = useDeviceRegistration();

  if (status === 'loading') {
    return <p role="status">{t.checking}</p>;
  }

  if (status === 'unregistered') {
    return <DeviceRegistrationScreen />;
  }

  return children;
};
