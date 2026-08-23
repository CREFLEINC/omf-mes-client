import { describe, expect, it } from 'vitest';

import { enabledState, globalPolicy, warnsNoRatio } from './enabled-state';
import { makeEnabled } from './fixtures';

describe('전체 범위 정책 고르기', () => {
  /**
   * ⚠ **이 화면은 전체 범위의 스위치만 다룬다.** 범위가 붙은 것이 섞여 있으면 그것은 다른
   * 누군가가 넣은 것이고, 이 스위치가 그것을 대신 말하면 거짓이 된다.
   */
  it('축을 하나도 지정하지 않은 것을 고른다', () => {
    const policies = [
      makeEnabled(1, true, { plantId: 11 }),
      makeEnabled(2, false),
      makeEnabled(3, true, { itemId: 21 }),
    ];

    expect(globalPolicy(policies)?.operationPolicyId).toBe(2);
  });

  it('전체 범위가 없으면 없음이다', () => {
    expect(globalPolicy([makeEnabled(1, true, { plantId: 11 })])).toBeNull();
  });

  it('빈 목록도 없음이다', () => {
    expect(globalPolicy([])).toBeNull();
  });

  it('명시적 null 축도 지정하지 않은 것으로 본다', () => {
    expect(
      globalPolicy([makeEnabled(1, true, { itemId: null, plantId: null })])?.operationPolicyId,
    ).toBe(1);
  });
});

/**
 * ⭐ **상태가 셋이다**(공유계약 G-9) — 켬 · 끔 · **아직 정하지 않음.**
 * 셋째를 「끔」으로 그리면 **아무도 정한 적 없는 값이 정해진 것처럼 보인다.**
 */
describe('지금 상태', () => {
  it('참이면 켬이다', () => {
    expect(enabledState([makeEnabled(1, true)])).toBe('on');
  });

  it('거짓이면 끔이다', () => {
    expect(enabledState([makeEnabled(1, false)])).toBe('off');
  });

  it('정책이 없으면 아직 정하지 않은 것이다', () => {
    expect(enabledState([])).toBe('unset');
  });

  /** ⛔ 값이 오지 않은 정책을 「끔」으로 읽지 않는다 — 그것은 정책이 값을 갖지 않는다는 뜻이다. */
  it('값이 없으면 아직 정하지 않은 것이다', () => {
    expect(enabledState([makeEnabled(1, null)])).toBe('unset');
    expect(enabledState([makeEnabled(1, undefined as unknown as null)])).toBe('unset');
  });

  it('범위가 붙은 것만 있으면 아직 정하지 않은 것이다', () => {
    expect(enabledState([makeEnabled(1, true, { plantId: 11 })])).toBe('unset');
  });
});

describe('켜 두었는데 쓸 비율이 없는가', () => {
  it('켜져 있고 비율이 0건이면 알린다', () => {
    expect(warnsNoRatio('on', 0)).toBe(true);
  });

  it('비율이 있으면 알리지 않는다', () => {
    expect(warnsNoRatio('on', 3)).toBe(false);
  });

  it('꺼져 있으면 알리지 않는다', () => {
    expect(warnsNoRatio('off', 0)).toBe(false);
    expect(warnsNoRatio('unset', 0)).toBe(false);
  });

  /**
   * ⛔ **모르는 것을 「없다」로 단정하지 않는다**(공유계약 G-9). 기준일로 좁힌 목록이
   * 비었다고 정책이 없는 것은 아니다 — 단정하면 **있는 정책을 두고 없다고 말하게 된다.**
   */
  it('셀 수 없으면 알리지 않는다', () => {
    expect(warnsNoRatio('on', null)).toBe(false);
  });
});
