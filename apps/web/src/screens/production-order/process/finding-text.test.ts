import { describe, expect, it } from 'vitest';

import { readableFinding } from './finding-text';

describe('점검 지적 문구(C-13)', () => {
  it('내부 번호를 이름으로 바꾸거나 지운다', () => {
    const message = '설비(1)가 같은 시간대의 다른 작업지시에 배정돼 있습니다.';
    expect(
      readableFinding(message, { equipment: '사출기 1호기 (EQ-01)', mold: null, worker: null }),
    ).toBe('설비 사출기 1호기 (EQ-01)가 같은 시간대의 다른 작업지시에 배정돼 있습니다');
    expect(readableFinding(message)).toBe('설비가 같은 시간대의 다른 작업지시에 배정돼 있습니다');
  });
});
