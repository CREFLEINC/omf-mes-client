import { describe, expect, it } from 'vitest';

import { toDelta } from './delta';

describe('toDelta', () => {
  it('비교 대상이 없으면 아무것도 그리지 않는다 — 0%로 그리면 「어제와 같았다」를 지어낸다', () => {
    expect(toDelta(null)).toBeUndefined();
  });

  it('비율을 백분율로 옮기고 부호를 붙인다', () => {
    expect(toDelta(0.08)).toMatchObject({ direction: 'up', value: '+8%' });
    expect(toDelta(-0.008)).toMatchObject({ direction: 'down', value: '-0.8%' });
  });

  it('내림이어도 부호를 두 번 붙이지 않는다', () => {
    expect(toDelta(-0.123)?.value).toBe('-12.3%');
  });

  it('0은 변동 없음이다', () => {
    expect(toDelta(0)).toMatchObject({ direction: 'flat', value: '0%' });
  });

  /**
   * ⭐ 이 화면의 「틀려도 조용한」 자리 — 원값으로 방향을 정하면 **0%인데 위 화살표**가 붙는다.
   * 사용자는 그것을 「올랐다는 건가 아니라는 건가」로 읽고 화면에서 확인할 수단이 없다.
   */
  it('보이는 숫자로 반올림해 0이 되면 방향도 변동 없음이다', () => {
    expect(toDelta(0.0004)).toMatchObject({ direction: 'flat', value: '0%' });
    expect(toDelta(-0.0004)).toMatchObject({ direction: 'flat', value: '0%' });
  });

  it('반올림해 0이 된 하락에 「-0%」를 그리지 않는다', () => {
    expect(toDelta(-0.0004)?.value).toBe('0%');
  });

  it('반올림 경계에서 방향이 산다', () => {
    expect(toDelta(0.0005)).toMatchObject({ direction: 'up', value: '+0.1%' });
  });
});
