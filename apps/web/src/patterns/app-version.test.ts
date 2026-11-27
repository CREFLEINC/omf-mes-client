import { describe, expect, it } from 'vitest';

import { toAppVersion } from './app-version';

describe('toAppVersion', () => {
  it('릴리스 태그에서 접두사를 떼어 버전을 낸다', () => {
    expect(toAppVersion('web-v0.3.8')).toEqual({ kind: 'release', version: 'v0.3.8' });
  });

  it('접두사 없는 버전도 받는다', () => {
    expect(toAppVersion('v1.12.0')).toEqual({ kind: 'release', version: 'v1.12.0' });
  });

  it.each([undefined, '', '   ', 'main', 'web-v0.3', 'web-v0.3.8-rc1', 'pop-v0.3.8', 42])(
    '값이 없거나 형식 밖이면(%s) 개발 빌드로 둔다',
    (raw) => {
      expect(toAppVersion(raw)).toEqual({ kind: 'dev' });
    },
  );
});
