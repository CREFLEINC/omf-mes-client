import { useSyncExternalStore } from 'react';

/**
 * 지금 연결돼 있는가.
 *
 * ⚠ **이 화면에는 보낼 것 보관함(outbox)이 없다.** 스펙 §6-2 는 오프라인 버퍼링을 확정했지만
 * 이 저장소에 그 기반이 아직 없어(이 저장소 #73 과 같은 사정) **연결이 끊기면 저장을 막고 그
 * 사실을 말한다.** 기반이 서면 이 값을 읽는 자리가 「막는다」에서 「담는다」로 바뀐다.
 *
 * ⛔ **연결 여부를 렌더 중에 `navigator.onLine` 으로 직접 읽지 않는다.** 그 값은 React 밖에서
 * 바뀌므로 이벤트를 구독하지 않으면 끊긴 뒤에도 화면이 「연결됨」을 그대로 들고 있는다.
 */
const subscribe = (onChange: () => void): (() => void) => {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);

  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
};

const getSnapshot = (): boolean => navigator.onLine;

/** 서버 렌더에는 연결 상태가 없다 — 「연결됨」을 기본으로 둬야 첫 그림이 막힌 화면이 되지 않는다. */
const getServerSnapshot = (): boolean => true;

export const useOnline = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
