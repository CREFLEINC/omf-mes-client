import { describe, expect, it } from 'vitest';

import { availableShots, isOverUsed, shotUsage, type ShotTarget } from './shot-counts';

const make = (overrides: Partial<ShotTarget> = {}): ShotTarget => ({
  guaranteedShotCount: 100_000,
  availableShotCount: 40_000,
  shotUsageRatio: 60,
  ...overrides,
});

describe('availableShots', () => {
  it('값이 오면 그 값을 그대로 든다', () => {
    expect(availableShots(make())).toEqual({ kind: 'value', value: 40_000 });
  });

  /*
   * ⛔ **0 을 「없음」으로 뭉개지 않는다.** 사용 가능 타수 0 은 「지금 다 썼다」는 사실이라
   * 「못 센다」와 전혀 다르다 — `??` 하나로 잇는 순간 이 둘이 같은 화면이 된다.
   */
  it('0 은 온 값이다', () => {
    expect(availableShots(make({ availableShotCount: 0 }))).toEqual({ kind: 'value', value: 0 });
  });

  /** 적정타수를 넘겨 쓰면 음수가 온다 — 그것도 온 값이다. */
  it('음수도 온 값이다', () => {
    expect(availableShots(make({ availableShotCount: -2_500 }))).toEqual({
      kind: 'value',
      value: -2_500,
    });
  });

  /*
   * ⭐ **못 세는 두 이유를 가른다.** 적정타수가 비어서면 사용자가 채우면 풀리고,
   * 그 밖의 이유면 사용자가 할 수 있는 일이 없다.
   */
  it.each([null, undefined])('적정타수가 %s 면 「적정타수 미입력」이다', (guaranteed) => {
    expect(
      availableShots(make({ guaranteedShotCount: guaranteed, availableShotCount: null })),
    ).toEqual({ kind: 'guaranteedMissing' });
  });

  it('적정타수는 있는데 값이 없으면 「산출 불가」다', () => {
    expect(availableShots(make({ availableShotCount: null }))).toEqual({ kind: 'notCalculable' });
    expect(availableShots(make({ availableShotCount: undefined }))).toEqual({
      kind: 'notCalculable',
    });
  });

  /* ⛔ 0 으로 채우면 예방보전이 즉시 도래한 것처럼 보인다 — 있어서는 안 될 값이다. */
  it('못 셀 때 0 을 지어내지 않는다', () => {
    expect(availableShots(make({ availableShotCount: null }))).not.toEqual({
      kind: 'value',
      value: 0,
    });
  });
});

describe('shotUsage', () => {
  it('값이 오면 그대로 든다', () => {
    expect(shotUsage(make({ shotUsageRatio: 102.5 }))).toEqual({ kind: 'value', value: 102.5 });
  });

  it('적정타수가 비면 「적정타수 미입력」이다', () => {
    expect(shotUsage(make({ guaranteedShotCount: null, shotUsageRatio: null }))).toEqual({
      kind: 'guaranteedMissing',
    });
  });

  it('적정타수는 있는데 비율이 없으면 「산출 불가」다', () => {
    expect(shotUsage(make({ shotUsageRatio: null }))).toEqual({ kind: 'notCalculable' });
  });

  it('0% 도 온 값이다', () => {
    expect(shotUsage(make({ shotUsageRatio: 0 }))).toEqual({ kind: 'value', value: 0 });
  });
});

describe('isOverUsed', () => {
  /** 딱 100% 는 적정타수를 «다 쓴» 것이다 — 아직 남았다고 말할 수 없다. */
  it('100% 부터 넘어선 것으로 본다', () => {
    expect(isOverUsed({ kind: 'value', value: 99.9 })).toBe(false);
    expect(isOverUsed({ kind: 'value', value: 100 })).toBe(true);
    expect(isOverUsed({ kind: 'value', value: 102.5 })).toBe(true);
  });

  /* 못 세는 것을 「넘지 않았다」로 그리면 모르는 것이 정상으로 보인다. */
  it('못 세는 값은 넘어섰다고 말하지 않는다', () => {
    expect(isOverUsed({ kind: 'guaranteedMissing' })).toBe(false);
    expect(isOverUsed({ kind: 'notCalculable' })).toBe(false);
  });
});
