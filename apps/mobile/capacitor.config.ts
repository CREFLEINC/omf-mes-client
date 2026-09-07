import type { CapacitorConfig } from '@capacitor/cli';

/*
 * 개발 기기의 목 서버로 평문 HTTP 를 보낼 수 있게 한다.
 *
 * 앱은 https://localhost 위에서 돌아, 목 서버(http://10.0.2.2:4010)로 가는 요청이 혼합
 * 콘텐츠로 막힌다. 매니페스트의 평문 허용만으로는 풀리지 않는다 - 그것은 시스템 정책이고
 * 이것은 WebView 정책이라 둘 다 열어야 닿는다.
 *
 * 환경 변수가 있을 때만 켠다. emulator-run.sh 가 이 변수를 주고, 릴리스 빌드는 주지 않는다 -
 * 운영 서버를 평문으로 두는 것과는 다른 이야기이고, 이 스위치는 개발 기기 안에서만 산다.
 */
const allowLocalHttp = process.env.CAP_ALLOW_LOCAL_HTTP === '1';

const config: CapacitorConfig = {
  appId: 'com.crefle.omfmes.mobile',
  appName: 'OMF-MES',
  webDir: 'dist',
  ...(allowLocalHttp ? { server: { cleartext: true }, android: { allowMixedContent: true } } : {}),
};

export default config;
