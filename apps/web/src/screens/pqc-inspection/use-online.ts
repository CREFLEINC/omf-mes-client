import { useSyncExternalStore } from 'react';

/**
 * 지금 연결돼 있는가.
 *
 * 스펙 §3 도면의 머리 오른쪽 끝에 상태 표식이 있고, §5-7·§6 이 이 화면을 오프라인 지원
 * 대상으로 못박았다 — 현장 검사가 통신에 묶이면 안 된다.
 *
 * ⚠ **이 화면은 큐를 들지 않는다.** 계약이 「오프라인이면 셸의 outbox 가 들고 있다가
 * 연결되면 보낸다 · 미확정 표식도 셸이 붙인다」로 셸 소관을 못박았고(`queries.ts` 머리),
 * POP 셸이 이 저장소에 아직 서지 않았다. 그래서 지금 이 값이 하는 일은 **연결이 끊겼다는
 * 사실을 말하는 것까지**다 — 셸이 서면 담는 자리가 그쪽에 생긴다.
 *
 * ⛔ **연결 여부를 렌더 중에 `navigator.onLine` 으로 직접 읽지 않는다.** 그 값은 React 밖에서
 * 바뀌므로 이벤트를 구독하지 않으면 끊긴 뒤에도 화면이 「온라인」을 그대로 들고 있는다.
 *
 * ⚠ 이 화면이 소유한다 — `P-05-01` 에 같은 것이 있으나 다른 화면 슬라이스의 부품을
 * 참조하지 않는다. **세 번째 사용처가 나오면** 그때 공용으로 올린다.
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

/** 서버 렌더에는 연결 상태가 없다 — 「온라인」을 기본으로 둬야 첫 그림이 막힌 화면이 되지 않는다. */
const getServerSnapshot = (): boolean => true;

export const useOnline = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
