import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();

/*
 * 마지막 요청이 서버의 답을 받았는가.
 *
 * 아직 아무것도 안 보낸 기동 직후는 참이다 - 못 닿는다고 단정할 근거가 없고, 첫 조회가
 * 곧 답을 준다. 거짓으로 두면 멀쩡한 단말이 켜질 때마다 오프라인을 보인다.
 */
let answered = true;

const notify = () => {
  for (const listener of listeners) {
    listener();
  }
};

const set = (next: boolean) => {
  if (answered === next) {
    return;
  }

  answered = next;
  notify();
};

/** 서버가 답을 줬다. 401 도 500 도 답이다 - 받았다는 뜻이므로 연결은 살아 있다. */
export const noteServerAnswered = (): void => {
  set(true);
};

/** 응답이 아예 없었다. 상태 코드가 없는 실패만 여기로 온다. */
export const noteServerSilent = (): void => {
  set(false);
};

const subscribe = (onChange: () => void): (() => void) => {
  /*
   * 기기가 다시 붙었다는 신호는 앞서 못 닿았던 기억을 지운다. 그대로 두면 망이 돌아와도
   * 다음 요청이 나갈 때까지 오프라인으로 남아, 작업자가 멀쩡한 단말을 고치러 간다.
   */
  const regained = () => {
    set(true);
    onChange();
  };

  listeners.add(onChange);
  window.addEventListener('online', regained);
  window.addEventListener('offline', onChange);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener('online', regained);
    window.removeEventListener('offline', onChange);
  };
};

/**
 * 이 기기에 망이 붙어 있는가.
 *
 * navigator.onLine 은 우리 서버에 닿는다는 뜻이 아니다. 요청을 막는 데 쓰지 않고, 오프라인
 * 이어도 할 수 있는 일과 없는 일을 가르는 화면 갈래에만 쓴다 - 닿는지는 보내 봐야 안다.
 *
 * ⛔ 여기에 서버 응답 여부를 섞지 않는다. 큐에 담는 쓰기는 실패해야 담기는데, 그 실패로
 * 화면을 오프라인으로 돌리면 담아 두는 흐름 자체가 막힌다.
 */
export const useOnlineStatus = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );

/**
 * 연결 표시에 쓰는 값.
 *
 * ⛔ 브라우저가 말하는 연결이 아니라 서버에 닿았는가로 말한다(공유계약 C-1 · 화면 문구
 * 정의). 랜선이 빠져도 같은 기기의 서버에는 닿고, 반대로 기기가 망에 붙어 있어도 우리
 * 서버에는 못 닿을 수 있다 - 방화벽, 평문 차단, 주소 오설정, 서버 정지. 실측으로 겪었다.
 *
 * ⛔ 주기적으로 찔러 보지 않는다. 앱이 늘 요청을 보내 신호가 저절로 갱신되고, 찌르기가
 * 성공해도 업무 쓰기는 권한·범위 때문에 실패할 수 있어 같은 오해가 되풀이된다.
 *
 * ⛔ 화면 갈래를 가르는 데 쓰지 않는다. 이 값은 보이기만 한다.
 */
export const useServerReachable = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => navigator.onLine && answered,
    () => true,
  );
