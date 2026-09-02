import { useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void): (() => void) => {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);

  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
};

/**
 * navigator.onLine 은 이 기기에 네트워크 연결이 있다는 뜻이지 우리 서버에 닿는다는
 * 뜻이 아니다. 요청을 막는 데 쓰지 않고 표시에만 쓴다 — 닿는지는 보내 봐야 안다.
 */
export const useOnlineStatus = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
