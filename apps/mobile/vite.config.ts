import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/*
 * 브라우저에서 셸을 돌릴 때 개발 백엔드로 넘겨줄 자리.
 *
 * 그 서버는 CORS 응답 헤더를 주지 않아 preflight 가 404 로 떨어진다. 같은 출처로 부르게
 * 하면 preflight 자체가 없어진다 - 서버를 고치지 않고 브라우저에서 확인할 수 있다.
 *
 * 주소는 환경 변수로만 받는다. 이 저장소는 공개라 사내 주소를 파일에 적지 않는다.
 */
const proxyTarget = process.env.MOBILE_API_PROXY_TARGET;

export default defineConfig({
  plugins: [react()],
  /*
   * 대상이 없으면 프록시를 걸지 않는다. 목 서버는 CORS 를 열어 두어 직접 부르는 것이
   * 그대로 도는데, 빈 프록시를 걸어 두면 그 경로까지 함께 바뀐다.
   */
  ...(proxyTarget === undefined || proxyTarget === ''
    ? {}
    : {
        server: {
          proxy: {
            '/api': {
              target: proxyTarget,
              changeOrigin: true,
            },
          },
        },
      }),
});
