import { useEffect, useState } from 'react';

/**
 * 단말의 네트워크 연결(브라우저 `online`·`offline`). 공통 메뉴 맨 위 줄이 모든 화면에 같은 연결 표시를
 * 보이려고 쓴다(#291 · 사용자 지시 2026-11-17) — 사번 입력 화면(`worker-assignment/connection`)과 같은 판정이다.
 */
export const usePopOnline = (): boolean => {
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
