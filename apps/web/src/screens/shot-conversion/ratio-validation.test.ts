import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { emptyRatioForm } from './options';
import { parseRatio, ratioWarning, validateRatio, RATIO_FORM_FIELDS } from './ratio-validation';
import type { RatioFormValues } from './types';

const t = messages.shotConversion.validation;

const form = (overrides: Partial<RatioFormValues> = {}): RatioFormValues => ({
  ...emptyRatioForm(),
  ratio: '0.25',
  effectiveFrom: '2026-01-01',
  ...overrides,
});

describe('비율 읽기', () => {
  it('수로 읽는다', () => {
    expect(parseRatio('0.25')).toBe(0.25);
  });

  it('앞뒤 공백은 값이 아니다', () => {
    expect(parseRatio('  0.25  ')).toBe(0.25);
  });

  /** 빈 칸과 「읽을 수 없는 글자」를 가른다 — 둘 다 `null` 이지만 문구는 갈린다. */
  it('빈 칸은 없음이다', () => {
    expect(parseRatio('')).toBeNull();
    expect(parseRatio('   ')).toBeNull();
  });

  it('수가 아니면 없음이다', () => {
    expect(parseRatio('영점이오')).toBeNull();
    expect(parseRatio('0.2.5')).toBeNull();
  });

  /** ⭐ 0은 값이다 — 읽기는 읽고, 막는 것은 검증의 몫이다. */
  it('0 도 읽는다', () => {
    expect(parseRatio('0')).toBe(0);
  });
});

describe('저장을 막는 것', () => {
  it('바른 값이면 통과한다', () => {
    expect(validateRatio(form())).toEqual({});
  });

  it('비율이 비면 필수라고 말한다', () => {
    expect(validateRatio(form({ ratio: '' })).valueNumeric).toBe(t.required);
  });

  it('수로 읽을 수 없으면 그렇게 말한다', () => {
    expect(validateRatio(form({ ratio: '영점이오' })).valueNumeric).toBe(t.ratioNumber);
  });

  /**
   * ⛔ **0이면 타발수가 늘 0이라 누계가 안 늘고 예방보전이 영영 오지 않는다.**
   * 데이터베이스에 CHECK 가 없어 **화면이 진다**(공유계약 A-9 등급 2).
   */
  it('0 이면 그 결과까지 말하며 막는다', () => {
    expect(validateRatio(form({ ratio: '0' })).valueNumeric).toBe(t.ratioPositive);
  });

  it('음수도 막는다', () => {
    expect(validateRatio(form({ ratio: '-1' })).valueNumeric).toBe(t.ratioPositive);
  });

  /** ⛔ 1 초과는 막지 않는다 — 한 번에 여러 번 타발하는 공정이 있을 수 있다. */
  it('1 을 넘어도 막지 않는다', () => {
    expect(validateRatio(form({ ratio: '4' }))).toEqual({});
  });

  it('시작일이 비면 필수라고 말한다', () => {
    expect(validateRatio(form({ effectiveFrom: '' })).effectiveFrom).toBe(t.required);
  });

  it('종료일이 시작일보다 앞이면 짚는다', () => {
    const errors = validateRatio(form({ effectiveFrom: '2026-06-01', effectiveTo: '2026-01-01' }));

    expect(errors.effectiveTo).toBe(t.periodOrder);
  });

  /** ⭐ 같은 날은 허용한다 — 계약이 「종료 ≥ 시작」이다. */
  it('같은 날은 통과한다', () => {
    expect(validateRatio(form({ effectiveFrom: '2026-06-01', effectiveTo: '2026-06-01' }))).toEqual(
      {},
    );
  });

  /** 종료일이 비어 있는 것은 정상이다 — 끝이 없다는 뜻이다. */
  it('종료일이 비어도 짝 제약을 걸지 않는다', () => {
    expect(validateRatio(form({ effectiveTo: '' }))).toEqual({});
  });

  /** 시작일이 비었으면 그것은 이미 짚었다 — 짝 제약을 겹쳐 내지 않는다. */
  it('시작일이 비면 짝 제약을 겹쳐 내지 않는다', () => {
    const errors = validateRatio(form({ effectiveFrom: '', effectiveTo: '2026-01-01' }));

    expect(errors.effectiveTo).toBeUndefined();
  });
});

describe('막지 않고 알리는 것', () => {
  /** ⚠ 잘못 친 0 하나로 수량보다 타발수가 많아지는 일이 훨씬 흔하다 — 그래서 말은 한다. */
  it('1 을 넘으면 경고한다', () => {
    expect(ratioWarning(form({ ratio: '4' }))).toBe(t.ratioOverOne);
  });

  it('1 이면 경고하지 않는다', () => {
    expect(ratioWarning(form({ ratio: '1' }))).toBeNull();
  });

  it('1 아래면 경고하지 않는다', () => {
    expect(ratioWarning(form({ ratio: '0.25' }))).toBeNull();
  });

  it('읽을 수 없으면 경고하지 않는다 — 그것은 오류가 잡는다', () => {
    expect(ratioWarning(form({ ratio: '영점이오' }))).toBeNull();
    expect(ratioWarning(form({ ratio: '' }))).toBeNull();
  });
});

describe('인라인으로 낼 수 있는 칸', () => {
  /** ⛔ 오류를 그릴 자리가 없는 칸을 넣으면 «어디에도 표시되지 않는 오류»가 된다. */
  it('창에 실제로 있는 칸들뿐이다', () => {
    expect([...RATIO_FORM_FIELDS]).toEqual([
      'valueNumeric',
      'effectiveFrom',
      'effectiveTo',
      'itemId',
      'processId',
      'plantId',
      'businessUnitId',
    ]);
  });

  /** 화면이 붙이는 값이라 고칠 칸이 없다. */
  it('정책 코드는 여기 없다', () => {
    expect(RATIO_FORM_FIELDS).not.toContain('policyCode');
  });
});
