import { describe, expect, it } from 'vitest';

import { CODE_GROUPS, isKnownCode, toCodeOptions } from './code-options';
import { overallJudgmentCodeValues, retiredCodeValue } from './fixtures';

describe('CODE_GROUPS', () => {
  /*
   * ⛔ 판정 그룹이 둘이고 합치면 안 된다 — 항목 판정에는 보류가 없다. 합쳐 쓰면 항목
   * 선택칸에 보류가 떠서 화면이 설계와 어긋난 값을 저장한다(omf-mes#179).
   */
  it('종합 판정과 항목 판정을 다른 그룹으로 부른다', () => {
    expect(CODE_GROUPS.overallJudgment).not.toBe(CODE_GROUPS.measurementJudgment);
  });

  it('그룹을 이름으로 부른다 — 정수 id 를 코드에 박지 않는다(환경마다 다르다)', () => {
    for (const group of Object.values(CODE_GROUPS)) {
      expect(group).toMatch(/^[A-Z_]+$/);
    }
  });
});

describe('toCodeOptions', () => {
  it('차례를 displayOrder 로 세운다 — 그 값이 뜻을 담는다(합격·불합격·보류)', () => {
    expect(toCodeOptions(overallJudgmentCodeValues).map((option) => option.value)).toEqual([
      'ACCEPTED',
      'REJECTED',
      'HELD',
    ]);
  });

  it('사용 중지된 값을 내리지 않는다 — 과거 자료에는 남아 있으나 지금 고를 것은 아니다', () => {
    const options = toCodeOptions([...overallJudgmentCodeValues, retiredCodeValue]);

    expect(options.map((option) => option.value)).not.toContain('RETIRED');
  });

  it('표시명을 라벨로 쓴다 — 화면이 이름을 지어내지 않는다', () => {
    expect(toCodeOptions(overallJudgmentCodeValues)[0]).toEqual({
      value: 'ACCEPTED',
      label: '합격',
    });
  });

  it('표시명이 비면 코드를 그대로 쓴다 — 빈 라벨을 그리지 않는다', () => {
    const nameless = [{ ...overallJudgmentCodeValues[1], codeName: '   ' }];

    expect(toCodeOptions(nameless as typeof overallJudgmentCodeValues)[0]?.label).toBe('ACCEPTED');
  });

  it('값이 하나도 없으면 빈 목록이다 — 자리표시를 지어내지 않는다', () => {
    expect(toCodeOptions([])).toEqual([]);
  });
});

describe('isKnownCode', () => {
  const options = toCodeOptions(overallJudgmentCodeValues);

  it('목록에 있는 값을 안다', () => {
    expect(isKnownCode(options, 'HELD')).toBe(true);
  });

  /*
   * ⚠ 저장된 값이 사용 중지되면 목록에서 사라진다. 그때 선택칸이 조용히 빈 것으로 보이면
   * 사용자가 고르지 않았는데 고른 것이 지워진다.
   */
  it('저장된 값이 목록에서 사라진 것을 잡는다', () => {
    expect(isKnownCode(options, 'RETIRED')).toBe(false);
  });

  it('아직 고르지 않은 상태는 모르는 값이 아니다', () => {
    expect(isKnownCode(options, '')).toBe(true);
  });
});
