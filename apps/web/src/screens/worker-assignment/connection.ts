import { useEffect, useState } from 'react';

/**
 * 지금 연결돼 있는가 — 헤더의 `● 연결됨` / `● 오프라인` 이 이 값이다(스펙 §6).
 *
 * ⚠ **`navigator.onLine` 은 「랜선이 꽂혀 있다」에 가깝다** — 참인데도 서버에 못 닿을 수
 * 있고, 거짓인데도 같은 기기의 서버에는 닿을 수 있다(산업용 패널 PC).
 *
 * ⛔ **이 값은 표시에 그치지 않는다** — 확인을 누를 때 어느 경로로 갈지(서버 조회 · 미리 받아
 * 둔 목록)를 이 값이 가른다. 그래서 **거짓으로 새면 서버에 닿는 단말이 캐시 경로로 간다.**
 * ⚠ 지금은 그 캐시를 채우는 쪽이 서 있지 않아(`screen.tsx` 의 선행 수신 주석) 그 경우
 * **확인이 서지 않는다.** 단말 값을 얻는 경로가 서면 함께 풀린다.
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
