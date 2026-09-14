import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router';

import { DeviceExpiredNotice, useDeviceExpired } from '../patterns/device-expired-notice';
import { useDeviceRegistration } from '../patterns/device-registration';
import { deviceTokenKey } from '../patterns/load-failure';
import { DeviceRegistrationScreen } from '../screens/device-registration/screen';

const t = messages.deviceRegistration;

/** 사번 확인 화면. 등록 해제가 여기 있다. */
const HOME_PATH = '/';

/**
 * 등록되지 않은 단말은 어떤 화면에도 닿지 못한다. 토큰 없이 열리는 서버 경로가 없어
 * 그 상태로 들어간 화면은 전부 인증 오류만 낸다.
 */
export const ShellGate = ({ children }: { children: ReactNode }) => {
  const { status } = useDeviceRegistration();
  const queryClient = useQueryClient();
  const expired = useDeviceExpired();
  const { pathname } = useLocation();

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

  /*
   * 등록이 끊겼으면 작업 화면은 쓸 수 없다 - 조회는 전부 거절되고 쓰기는 되돌아온다. 쓸 수 없는
   * 지시 목록·완료 단추를 보이지 않고 만료 알림만 둔다(사용자 지시 2026-09-14).
   * 사번 확인 화면(`/`)은 남긴다. 거기서 등록을 풀어야 새 QR 로 다시 등록할 수 있다.
   */
  const workHidden = expired && pathname !== HOME_PATH;

  return (
    <>
      <DeviceExpiredNotice />
      {workHidden ? null : children}
    </>
  );
};
