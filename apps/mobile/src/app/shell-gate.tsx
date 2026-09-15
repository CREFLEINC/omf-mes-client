import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router';

import { DeviceExpiredNotice, useDeviceExpired } from '../patterns/device-expired-notice';
import { useDeviceRegistration } from '../patterns/device-registration';
import { deviceTokenKey } from '../patterns/load-failure';
import { useLocalNetwork } from '../patterns/local-network';
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

  /*
   * 로컬 네트워크 권한은 등록 여부를 판정한 직후 여기서 한 번 묻는다. 등록 화면에서만 물으면
   * 이미 등록된 기기가 업데이트됐을 때 영영 묻지 않아 모든 요청이 막힌다(REG-ALL-01 N15).
   */
  const localNetwork = useLocalNetwork();
  const { request: requestLocalNetwork } = localNetwork;
  const askLocalNetwork = status !== 'loading' && localNetwork.status === 'unknown';

  useEffect(() => {
    if (askLocalNetwork) {
      requestLocalNetwork();
    }
  }, [askLocalNetwork, requestLocalNetwork]);

  /*
   * ⚠ 첫 답을 받을 때까지 화면을 세우지 않는다. 등록 화면은 서자마자 카메라 권한을 묻는데,
   * 권한 창은 한 번에 하나만 뜨고 겹친 요청은 묻지도 않고 거절로 돌아온다. 다시 묻는 동안에는
   * 화면을 걷지 않는다 — 입력하던 코드가 사라진다.
   */
  if (status === 'loading' || !localNetwork.settled) {
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
