import { describe, expect, it } from 'vitest';

import { isKnownCode, labelOfCode, toCodeOptions } from './code-options';
import { overallJudgmentCodeValues, retiredCodeValue } from './fixtures';

describe('toCodeOptions', () => {
  it('사용 중지된 값을 내리지 않는다 — 과거 자료에는 남지만 지금 고를 것은 아니다', () => {
    const options = toCodeOptions([...overallJudgmentCodeValues, retiredCodeValue]);

    expect(options.map((option) => option.value)).not.toContain(retiredCodeValue.code);
  });

  it('차례는 displayOrder 다 — 그 값이 뜻을 담는다(합격·불합격·보류)', () => {
    expect(toCodeOptions(overallJudgmentCodeValues).map((option) => option.value)).toEqual([
      'ACCEPTED',
      'REJECTED',
      'HELD',
    ]);
  });

  it('표시명이 비면 코드를 그대로 쓴다 — 라벨을 지어내지 않는다', () => {
    const [first] = toCodeOptions([{ ...overallJudgmentCodeValues[1]!, codeName: '  ' }]);

    expect(first?.label).toBe('ACCEPTED');
  });
});

describe('isKnownCode · labelOfCode', () => {
  it('저장된 값이 목록에서 사라진 것을 알아본다 — 조용히 비우면 고른 것이 지워진다', () => {
    const options = toCodeOptions(overallJudgmentCodeValues);

    expect(isKnownCode(options, 'ACCEPTED')).toBe(true);
    expect(isKnownCode(options, '')).toBe(true);
    expect(isKnownCode(options, 'RETIRED')).toBe(false);
  });

  it('목록에 없는 코드는 표시명 대신 코드를 그대로 낸다 — 확인 창이 빈칸을 보이지 않게', () => {
    const options = toCodeOptions(overallJudgmentCodeValues);

    expect(labelOfCode(options, 'ACCEPTED')).toBe('합격');
    expect(labelOfCode(options, 'RETIRED')).toBe('RETIRED');
  });
});
