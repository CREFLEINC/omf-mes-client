import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ReleaseConfigError,
  parseApiUrl,
  writeReleaseNetworkConfig,
} from './release-network-config.mjs';

// 실제 소스셋과 같은 꼬리(app/src/release)를 가진 임시 경로를 쓴다. 모듈이 그 꼬리를 확인한다.
let root;
let releaseSrc;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'omf-release-net-'));
  releaseSrc = join(root, 'app', 'src', 'release');
  mkdirSync(join(root, 'app', 'src'), { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const configPath = () => join(releaseSrc, 'res', 'xml', 'network_security_config.xml');
const manifestPath = () => join(releaseSrc, 'AndroidManifest.xml');

describe('parseApiUrl', () => {
  it('http 주소에서 프로토콜과 호스트를 뽑는다', () => {
    expect(parseApiUrl('http://10.0.2.2:4010/api')).toEqual({
      protocol: 'http',
      host: '10.0.2.2',
    });
  });

  it('포트와 경로는 호스트에 섞이지 않는다', () => {
    expect(parseApiUrl('https://mes.example.invalid:8443/api/v2').host).toBe(
      'mes.example.invalid',
    );
  });

  it.each([
    ['상대 주소', '/api'],
    ['빈 값', ''],
    ['호스트 없는 주소', 'http://'],
  ])('%s 는 거부한다', (_label, raw) => {
    expect(() => parseApiUrl(raw)).toThrow(ReleaseConfigError);
  });

  it('http · https 가 아닌 프로토콜은 거부한다', () => {
    expect(() => parseApiUrl('ftp://mes.example.invalid/api')).toThrow(ReleaseConfigError);
  });

  it('IPv6 리터럴은 거부한다', () => {
    // <domain> 이 받지 못하는 형태다. 통과시키면 조용히 닿지 않는 APK 가 나온다.
    expect(() => parseApiUrl('http://[::1]:8080/api')).toThrow(/IPv6/);
  });
});

describe('writeReleaseNetworkConfig — http', () => {
  it('그 호스트 하나만 평문으로 연다', () => {
    const result = writeReleaseNetworkConfig('http://10.0.2.2:4010/api', releaseSrc);

    expect(result).toEqual({ cleartext: true, host: '10.0.2.2' });

    const xml = readFileSync(configPath(), 'utf8');
    expect(xml).toContain('<domain includeSubdomains="false">10.0.2.2</domain>');
    // 나머지 주소가 함께 열리면 이 단언이 깨진다.
    expect(xml).toContain('<base-config cleartextTrafficPermitted="false" />');
    expect(xml.match(/<domain /g)).toHaveLength(1);
  });

  it('포트는 도메인에 넣지 않는다', () => {
    writeReleaseNetworkConfig('http://10.0.2.2:4010/api', releaseSrc);
    expect(readFileSync(configPath(), 'utf8')).not.toContain('4010');
  });

  it('매니페스트가 전면 허용 플래그를 지운다', () => {
    writeReleaseNetworkConfig('http://10.0.2.2:4010/api', releaseSrc);

    const manifest = readFileSync(manifestPath(), 'utf8');
    expect(manifest).toContain('tools:remove="android:usesCleartextTraffic"');
    expect(manifest).toContain('android:networkSecurityConfig="@xml/network_security_config"');
  });
});

describe('writeReleaseNetworkConfig — https', () => {
  it('아무것도 만들지 않는다', () => {
    const result = writeReleaseNetworkConfig('https://mes.example.invalid/api', releaseSrc);

    expect(result.cleartext).toBe(false);
    expect(existsSync(releaseSrc)).toBe(false);
  });

  it('앞선 http 빌드가 남긴 설정을 지운다', () => {
    // 남겨 두면 지난 주소가 계속 열려 있다. 빌드는 성공하므로 드러나지 않는다.
    writeReleaseNetworkConfig('http://10.0.2.2:4010/api', releaseSrc);
    expect(existsSync(configPath())).toBe(true);

    writeReleaseNetworkConfig('https://mes.example.invalid/api', releaseSrc);
    expect(existsSync(releaseSrc)).toBe(false);
  });
});

describe('writeReleaseNetworkConfig — 주소가 바뀔 때', () => {
  it('앞선 호스트가 남지 않는다', () => {
    writeReleaseNetworkConfig('http://10.0.2.2:4010/api', releaseSrc);
    writeReleaseNetworkConfig('http://10.0.2.99:4010/api', releaseSrc);

    const xml = readFileSync(configPath(), 'utf8');
    expect(xml).toContain('10.0.2.99');
    expect(xml).not.toContain('10.0.2.2<');
    expect(xml.match(/<domain /g)).toHaveLength(1);
  });
});

describe('writeReleaseNetworkConfig — 경로 확인', () => {
  it('app/src/release 로 끝나지 않는 경로는 건드리지 않는다', () => {
    const stray = join(root, 'app', 'src', 'main');
    mkdirSync(stray, { recursive: true });

    expect(() => writeReleaseNetworkConfig('http://10.0.2.2:4010/api', stray)).toThrow(
      ReleaseConfigError,
    );
    expect(existsSync(stray)).toBe(true);
  });

  it('주소가 잘못되면 앞선 설정을 지우지 않는다', () => {
    writeReleaseNetworkConfig('http://10.0.2.2:4010/api', releaseSrc);

    expect(() => writeReleaseNetworkConfig('/api', releaseSrc)).toThrow(ReleaseConfigError);
    // 빌드가 중단되므로 앞 상태가 그대로 남아야 한다. 반쯤 지워진 상태가 가장 나쁘다.
    expect(existsSync(configPath())).toBe(true);
  });
});
