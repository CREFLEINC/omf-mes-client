import { describe, expect, it } from 'vitest';

import {
  availableShots,
  formatShots,
  isOverGuaranteed,
  projectedTotal,
  usagePercent,
  type FigureInput,
} from './shot-figures';

const base: FigureInput = {
  currentShotCount: 412300,
  guaranteedShotCount: 500000,
  increment: 1250,
  isOnline: true,
};

describe('projectedTotal', () => {
  it('서버 누계에 이번 입력을 더한다', () => {
    expect(projectedTotal(base)).toEqual({ kind: 'value', value: 413550 });
  });

  it('아직 기입 전이면 서버 누계만 보인다', () => {
    expect(projectedTotal({ ...base, increment: null })).toEqual({
      kind: 'value',
      value: 412300,
    });
  });

  it('연결이 끊기면 그리지 않는다 — 다른 단말이 더한 몫이 빠진 숫자다', () => {
    expect(projectedTotal({ ...base, isOnline: false })).toEqual({ kind: 'offline' });
  });
});

describe('availableShots', () => {
  it('적정타수에서 저장 후 누계를 뺀다', () => {
    expect(availableShots(base)).toEqual({ kind: 'value', value: 86450 });
  });

  it('적정타수가 비면 0 으로 채우지 않고 산출 불가로 남긴다', () => {
    expect(availableShots({ ...base, guaranteedShotCount: null })).toEqual({
      kind: 'guaranteedMissing',
    });
  });

  it('연결이 끊긴 사정이 적정타수 사정보다 앞이다', () => {
    expect(availableShots({ ...base, guaranteedShotCount: null, isOnline: false })).toEqual({
      kind: 'offline',
    });
  });

  it('넘긴 만큼 음수로 나온다 — 넘긴 크기가 곧 위험 크기다', () => {
    expect(availableShots({ ...base, increment: 90000 })).toEqual({
      kind: 'value',
      value: -2300,
    });
  });
});

describe('usagePercent', () => {
  it('저장 후 누계를 적정타수로 나눈 백분율이다', () => {
    expect(usagePercent(base)).toEqual({ kind: 'value', value: 82.71 });
  });

  it('100 을 넘을 수 있다', () => {
    const percent = usagePercent({ ...base, increment: 90000 });

    expect(percent.kind === 'value' && percent.value > 100).toBe(true);
  });

  it('적정타수가 0 이면 나누지 않는다', () => {
    expect(usagePercent({ ...base, guaranteedShotCount: 0 })).toEqual({
      kind: 'guaranteedMissing',
    });
  });
});

describe('isOverGuaranteed', () => {
  it('남는 것이 있으면 넘겼다고 말하지 않는다', () => {
    expect(isOverGuaranteed(base)).toBe(false);
  });

  it('넘기면 참이다 — 다만 저장을 막는 판정이 아니다', () => {
    expect(isOverGuaranteed({ ...base, increment: 90000 })).toBe(true);
  });

  it('산출할 수 없으면 넘겼다고 말하지 않는다 — 모르는 것과 넘긴 것은 다르다', () => {
    expect(isOverGuaranteed({ ...base, guaranteedShotCount: null })).toBe(false);
    expect(isOverGuaranteed({ ...base, isOnline: false })).toBe(false);
  });
});

describe('formatShots', () => {
  it('천단위를 끊는다 — 수십만 자리를 눈으로 세게 두지 않는다', () => {
    expect(formatShots(413550)).toBe('413,550');
  });
});
