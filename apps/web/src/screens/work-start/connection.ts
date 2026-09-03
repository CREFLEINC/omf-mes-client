import { useEffect, useState } from 'react';

/**
 * 지금 연결돼 있는가 — 헤더의 연결 표시와 **시작·재개의 가부**가 이 값에 걸린다(스펙 §6-1).
 *
 * ⛔ **이 화면은 오프라인을 허용하지 않는다.** 읽는 값이 전부 «판정값»이라서다 — 단말 게이팅은
 * 권한 없는 단말을 열고, 점검 이력은 차단해야 할 작업을 열고, W/O 상태는 취소된 지시로
 * 작업하게 한다(공유계약 C-14). 그래서 **큐(outbox)를 만들지 않는다** — 통지 #556 이
 * 「이 화면 몫이 있으면 제거한다 · 202 분기도 만들지 않는다」로 못박았다.
 *
 * ⛔ **회색 버튼만 두지 않는다**(G-3 · §9-2). 끊겼을 때는 사유와 다음 행동을 함께 보인다.
 *
 * ⚠ **`navigator.onLine` 은 「랜선이 꽂혀 있다」에 가깝다** — 참인데도 서버에 못 닿을 수 있고,
 * 거짓인데도 같은 기기의 서버에는 닿을 수 있다(산업용 패널 PC). 그래서 이 값은 **막는 쪽**
 * 으로만 쓰고, 「닿았는가」는 조회 결과가 따로 말한다(헤더 표시).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */
export const useIsOnline = (): boolean => {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const update = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener('online', update);
    window.addEventListener('offline', update);

    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return isOnline;
};
