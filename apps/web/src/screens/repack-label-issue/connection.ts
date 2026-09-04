import { useEffect, useState } from 'react';

/**
 * 지금 연결돼 있는가 — 헤더의 연결 칩이 이 값이고, **발행을 막는 조건**이기도 하다(스펙 §6 「⛔ 온라인 전용 — 서버 렌더링 필수」·K-5).
 *
 * ⚠ **`navigator.onLine` 은 「랜선이 꽂혀 있다」에 가깝다** — 참인데도 서버에 못 닿을 수
 * 있고, 거짓인데도 같은 기기의 서버에는 닿을 수 있다(산업용 패널 PC).
 *
 * ⛔ **이 화면에 오프라인 대체 경로가 없다.** 라벨을 **서버가 그리므로**(결정 18 · K-5) 끊긴
 * 채로는 발행해도 인쇄할 것이 오지 않는다 — 그래서 이 값이 거짓이면 **발행 자체를 막는다.**
 * 큐에 쌓아 두는 갈래(outbox)를 두지 않는 것도 같은 이유다.
 *
 * ⚠ **`P-CO-01` 의 같은 이름 파일을 사본으로 가져왔다.** 그쪽은 이 값으로 **조회 경로**를
 * 가르고 여기서는 **쓰기를 막는다** — 쓰임이 달라 합치지 않았다. ⛔ 사본이므로 원본이 바뀌어도
 * 따라오지 않는다.
 *
 * ⚠ **무엇으로 갈라야 하는가는 설계가 정할 자리다** — 브라우저의 온라인 여부로 판정하지
 * 말라는 경계가 다른 POP 화면에도 적혀 있다. 이 화면이 혼자 정하지 않는다.
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
