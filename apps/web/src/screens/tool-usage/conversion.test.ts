import { describe, expect, it } from 'vitest';

import { conversionState, convertedShots } from './conversion';
import { conversionOnPolicies, effectivePolicy, unresolvedPolicies } from './fixtures';

describe('conversionState', () => {
  it('불러오는 중은 「없음」과 다른 상태다 — 깜빡임을 만들지 않기 위해서다', () => {
    expect(conversionState({ ...conversionOnPolicies, isLoading: true })).toEqual({
      kind: 'loading',
    });
  });

  it('비율이 있어도 「쓰지 않는다」로 정해져 있으면 닫힌다', () => {
    expect(
      conversionState({
        enabled: effectivePolicy('SHOT_CONVERSION_ENABLED', { valueBoolean: false }),
        ratio: conversionOnPolicies.ratio,
        isLoading: false,
      }),
    ).toEqual({ kind: 'off' });
  });

  it('맞는 정책이 없으면 기본값을 지어내지 않고 미설정으로 둔다', () => {
    expect(conversionState({ ...unresolvedPolicies, isLoading: false })).toEqual({
      kind: 'unset',
    });
  });

  it('쓴다고 정해져 있어도 비율이 없으면 열지 않는다', () => {
    expect(
      conversionState({
        enabled: conversionOnPolicies.enabled,
        ratio: effectivePolicy('SHOT_CONVERSION_RATIO', { valueNumeric: null }),
        isLoading: false,
      }),
    ).toEqual({ kind: 'unset' });
  });

  it('비율이 0 이하이면 열지 않는다 — 곱해서 0 이 나오는 환산은 실적이 아니다', () => {
    expect(
      conversionState({
        enabled: conversionOnPolicies.enabled,
        ratio: effectivePolicy('SHOT_CONVERSION_RATIO', { valueNumeric: 0 }),
        isLoading: false,
      }),
    ).toEqual({ kind: 'unset' });
  });

  it('둘 다 정해져 있으면 비율과 함께 연다', () => {
    expect(conversionState({ ...conversionOnPolicies, isLoading: false })).toEqual({
      kind: 'ready',
      ratio: 2.5,
    });
  });
});

describe('convertedShots', () => {
  it('수량에 비율을 곱한다', () => {
    expect(convertedShots(500, 2.5)).toBe(1250);
  });

  it('정수로 맞춰 보낸다 — 계약이 타발수를 정수로 받는다', () => {
    expect(convertedShots(3, 0.4)).toBe(1);
    expect(convertedShots(3, 0.5)).toBe(2);
  });
});
