import type { CapacitorConfig } from '@capacitor/cli';

/*
 * 평문 HTTP 를 보낼 수 있게 한다.
 *
 * 앱은 https://localhost 위에서 돌아, http 로 가는 요청이 혼합 콘텐츠로 막힌다. 매니페스트의
 * 평문 허용만으로는 풀리지 않는다 - 그것은 시스템 정책이고 이것은 WebView 정책이라 둘 다
 * 열어야 닿는다.
 *
 * 환경 변수가 있을 때만 켠다. 주는 곳은 둘이다 - emulator-run.sh 가 개발 기기의 목 서버를
 * 위해, release-build.sh 가 사내 운영 서버를 위해(설계 결정 20 ①) 준다.
 *
 * ⚠ 이 스위치는 WebView 전체에 걸린다 - 주소 하나로 좁힐 수 없다. 좁히는 일은 시스템 정책
 * 쪽에서 한다: release-build.sh 가 운영 서버 호스트 하나만 여는 network_security_config 를
 * 만들어 얹는다.
 */
const allowCleartextHttp = process.env.CAP_ALLOW_CLEARTEXT_HTTP === '1';

/*
 * 요청을 WebView 대신 네이티브로 보낸다.
 *
 * 개발 백엔드가 CORS 응답 헤더를 주지 않아 WebView 의 fetch 로는 닿지 않는다. 실기·에뮬레이터
 * 에는 브라우저 프록시가 없어 우회할 자리가 여기뿐이다 - 네이티브 요청에는 동일 출처 정책이
 * 걸리지 않는다.
 *
 * 기본은 끈다. 목 서버는 CORS 를 열어 두어 지금 경로가 그대로 돌고, 켜면 그 경로까지 함께
 * 바뀐다.
 */
const nativeHttp = process.env.CAP_NATIVE_HTTP === '1';

const config: CapacitorConfig = {
  appId: 'com.crefle.omfmes.mobile',
  appName: 'OMF-MES',
  webDir: 'dist',
  ...(allowCleartextHttp ? { server: { cleartext: true }, android: { allowMixedContent: true } } : {}),
  ...(nativeHttp ? { plugins: { CapacitorHttp: { enabled: true } } } : {}),
};

export default config;
