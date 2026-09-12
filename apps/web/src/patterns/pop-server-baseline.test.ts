import { afterEach, describe, expect, it, vi } from 'vitest';

import { isServerBaselineBuild } from './pop-server-baseline';

/**
 * 이 판정은 **화면이 무엇을 부를 것인가**를 가른다 — 틀리면 배포본이 서버에 없는 축을 부르고
 * 좁혀지지 않은 목록을 세운다. 가름이 조용히 뒤집히는 것을 여기서 막는다(#1095).
 */
describe('isServerBaselineBuild', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('배포본에서만 참이다 — 실서버는 아직 없는 축을 무시하므로 화면이 스스로 좁힌다', () => {
    vi.stubEnv('MODE', 'production');

    expect(isServerBaselineBuild()).toBe(true);
  });

  it('개발 서버는 목을 보므로 거짓이다 — 목은 고정 설계대로 답한다', () => {
    vi.stubEnv('MODE', 'development');

    expect(isServerBaselineBuild()).toBe(false);
  });

  it('시험도 고정 설계 기준의 스텁을 보므로 거짓이다', () => {
    expect(isServerBaselineBuild()).toBe(false);
  });
});
