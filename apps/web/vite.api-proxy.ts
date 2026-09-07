import type { ProxyOptions } from 'vite';

/**
 * dev 서버가 `/api` 요청을 백엔드로 넘겨 준다.
 *
 * ⭐ **CORS 를 우회하려고 두는 것이다.** 개발 백엔드는 `Access-Control-Allow-Origin` 을
 * 내리지 않고 preflight(`OPTIONS`)를 404 로 떨어뜨린다(실측). 브라우저가 백엔드를 직접
 * 부르면 요청이 서버에 닿기도 전에 막힌다. dev 서버를 거치면 브라우저 입장에서는
 * **같은 출처**라 preflight 자체가 없다.
 *
 * ⚠ **개발 서버 전용이다.** 빌드 산출물에는 이 경로가 없다 — 설치본·배포본은 백엔드가
 * CORS 를 열어 주거나 같은 출처로 서비스돼야 한다.
 *
 * 주소를 코드에 박지 않는 이유는 사내 주소가 공개 저장소에 남지 않게 하기 위해서다.
 * 값은 `apps/web/.env.local` 에 둔다(`*.local` 은 gitignore 대상).
 *
 * @param target `VITE_API_PROXY_TARGET` — 백엔드 원점(`http://<host>:<port>`). 비어 있으면
 *   프록시를 두지 않는다. 그때 기본 동작은 지금까지와 같다(목 서버 직접 호출).
 */
export const apiProxy = (target: string | undefined): Record<string, ProxyOptions> | undefined => {
  if (target === undefined || target === '') return undefined;

  return {
    '/api': {
      target,
      changeOrigin: true,
    },
  };
};
