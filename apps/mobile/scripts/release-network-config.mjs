#!/usr/bin/env node
// 릴리스 빌드의 평문 HTTP 허용 설정을 만든다.
//
// 릴리스 빌드는 평문 HTTP 를 막는다. 설계 결정 20 ① 이 운영 통신을 사내망 전용 평문으로
// 정했으므로 허용이 필요하지만, 주소 전체가 아니라 API 서버 호스트 하나만 연다.
//
// 여기가 이 빌드의 보안 경계다. 판정이 어긋나도 빌드는 성공하고 현장에서야 드러나므로,
// 셸이 아니라 시험할 수 있는 자리에 둔다 - release-network-config.test.mjs 가 잰다.
//
// 사용법: node release-network-config.mjs <API 주소> <릴리스 소스셋 경로>
//   평문을 열었으면 호스트를 stdout 으로 찍고, 막았으면 아무것도 찍지 않는다.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export class ReleaseConfigError extends Error {}

// 지울 디렉터리를 인자로 받으므로 자리를 확인한다. 오타 하나로 엉뚱한 경로가 사라지지 않게 한다.
const RELEASE_SRC_SUFFIX = join('app', 'src', 'release');

export function parseApiUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new ReleaseConfigError(
      `API 주소를 절대 주소로 읽을 수 없습니다: ${raw || '(빈 값)'}\n` +
        '  APK 에는 브라우저 프록시가 없습니다 — http(s)://<IP>:<PORT>/api 형태로 주세요.',
    );
  }

  const protocol = url.protocol.replace(':', '');
  if (protocol !== 'http' && protocol !== 'https') {
    throw new ReleaseConfigError(`http 또는 https 여야 합니다: ${raw}`);
  }

  // network_security_config 의 <domain> 은 IPv6 리터럴을 받지 않는다. 조용히 닿지 않는 설정을
  // 만드는 대신 여기서 멈춘다.
  if (url.hostname.includes(':')) {
    throw new ReleaseConfigError(`IPv6 리터럴 주소는 지원하지 않습니다: ${url.hostname}`);
  }

  return { protocol, host: url.hostname };
}

export function networkSecurityConfigXml(host) {
  return `<?xml version="1.0" encoding="utf-8"?>
<!--
  빌드가 만든 파일이다. 손으로 고치지 않는다 - release-network-config.mjs 가 매번 다시 쓴다.

  운영 서버 하나만 평문으로 연다(설계 결정 20 ①, 사내망 전용). 나머지 주소는 그대로 막힌다.
-->
<network-security-config>
    <base-config cleartextTrafficPermitted="false" />
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">${host}</domain>
    </domain-config>
</network-security-config>
`;
}

export const releaseManifestXml = `<?xml version="1.0" encoding="utf-8"?>
<!-- 빌드가 만든 파일이다. 손으로 고치지 않는다 - release-network-config.mjs 가 매번 다시 쓴다. -->
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <!--
      Capacitor 가 usesCleartextTraffic="true" 를 넣는다 - 주소를 가리지 않는 전면 허용이다.
      networkSecurityConfig 가 있으면 minSdk 24 위에서 무시되지만, 매니페스트에 서로 다른 두
      정책이 남는다. 지워서 실제로 도는 정책 하나만 적히게 한다.
    -->
    <application
        android:networkSecurityConfig="@xml/network_security_config"
        tools:replace="android:networkSecurityConfig"
        tools:remove="android:usesCleartextTraffic" />
</manifest>
`;

export function writeReleaseNetworkConfig(rawUrl, releaseSrcDir) {
  if (!releaseSrcDir.endsWith(sep + RELEASE_SRC_SUFFIX)) {
    throw new ReleaseConfigError(`예상 밖의 경로라 지우지 않습니다: ${releaseSrcDir}`);
  }

  const { protocol, host } = parseApiUrl(rawUrl);

  // 언제나 먼저 지운다. 남겨 두면 지난 빌드의 주소가 계속 열려 있다.
  rmSync(releaseSrcDir, { recursive: true, force: true });

  if (protocol !== 'http') {
    return { cleartext: false, host };
  }

  mkdirSync(join(releaseSrcDir, 'res', 'xml'), { recursive: true });
  writeFileSync(
    join(releaseSrcDir, 'res', 'xml', 'network_security_config.xml'),
    networkSecurityConfigXml(host),
  );
  writeFileSync(join(releaseSrcDir, 'AndroidManifest.xml'), releaseManifestXml);

  return { cleartext: true, host };
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const [rawUrl, releaseSrcDir] = process.argv.slice(2);
  try {
    const { cleartext, host } = writeReleaseNetworkConfig(rawUrl ?? '', releaseSrcDir ?? '');
    if (cleartext) process.stdout.write(host);
  } catch (error) {
    if (!(error instanceof ReleaseConfigError)) throw error;
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
