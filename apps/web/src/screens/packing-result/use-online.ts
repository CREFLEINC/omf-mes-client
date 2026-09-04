import { useSyncExternalStore } from 'react';

/**
 * 지금 연결돼 있는가.
 *
 * ⛔ **이 화면은 «온라인 전용»이다**(스펙 §6 · 공유계약 C-6). 매칭 판정이 서버에 있어
 * 오프라인에서는 스캔이 옳은지 알 수 없고, 판정 없이 담은 것을 나중에 보내면 틀린 포장이
 * 확정된다. 그래서 보관함(outbox)에 담지 않고 **막고 그 사실을 말한다** — 여기서는 기반이
 * 생겨도 「담는다」로 바뀌지 않는다.
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
