import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';

import { deviceTokenKey, type DeviceTokenState } from './load-failure';

/**
 * 등록 만료는 한 번만 알린다.
 *
 * 토큰이 죽으면 화면의 조회가 전부 거절되는데, 조회마다 같은 문장을 달면 한 화면에 여러 번
 * 뜬다(#1198 실기). 조회 하나의 실패가 아니라 기기의 상태라 셸이 화면 위에 하나만 둔다
 * (`ShellGate`). 판정은 조회 실패 문구 고르기와 사번 확인이 캐시에 남긴 토큰 확인을 그대로
 * 읽는다 - 여기서 새로 묻지 않는다. 묻는 중이면 보이지 않는다.
 */
export const DeviceExpiredNotice = () => {
  const queryClient = useQueryClient();
  const cache = queryClient.getQueryCache();

  /* 관찰자를 달지 않고 상태만 읽는다 - 달면 그 조회 함수가 토큰 확인의 것을 덮을 수 있다. */
  const expired = useSyncExternalStore(
    useCallback((notify: () => void) => cache.subscribe(notify), [cache]),
    () => {
      const state = queryClient.getQueryState<DeviceTokenState>(deviceTokenKey);
      return state?.data === 'dead' && state.fetchStatus === 'idle';
    },
  );

  return expired ? (
    <div className="mobile-shell__notice">
      <AlertBanner variant="error" title={messages.httpError.deviceExpired} />
    </div>
  ) : null;
};
