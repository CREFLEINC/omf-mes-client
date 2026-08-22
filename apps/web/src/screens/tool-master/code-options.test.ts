import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  SORT_OPTIONS,
  codeLabel,
  defaultToolFilters,
  ensureOption,
  lookupLabel,
  selectableOptions,
  toCodeLabels,
  toToolSort,
} from './code-options';
import { makeCodeValue } from './fixtures';

describe('toCodeLabels', () => {
  /*
   * ⛔ **거르지 않는다** — 이것은 «고를 목록»이 아니라 «읽는 값의 이름표»다.
   * 거르면 사용 중지된 코드값을 가진 툴의 이름이 화면에서 사라진다.
   */
  it('쓰지 않는 코드값의 이름도 남긴다', () => {
    const options = toCodeLabels([makeCodeValue('OLD', '쓰지 않는 상태', false)]);

    expect(options).toEqual([{ value: 'OLD', label: '쓰지 않는 상태' }]);
  });

  /* ⛔ 라벨을 지어내지 않는다 — 이름이 비면 코드가 곧 이름이다. */
  it.each(['', '   '])('이름이 %s 면 코드를 그대로 쓴다', (codeName) => {
    expect(toCodeLabels([makeCodeValue('IN_SERVICE', codeName)])[0]?.label).toBe('IN_SERVICE');
  });
});

describe('codeLabel', () => {
  it('못 찾으면 코드를 그대로 보인다', () => {
    expect(codeLabel('JIG', [])).toBe('JIG');
  });

  it('찾으면 이름을 보인다', () => {
    expect(codeLabel('JIG', [{ value: 'JIG', label: '지그' }])).toBe('지그');
  });
});

describe('ensureOption', () => {
  it('목록에 없는 값을 코드 그대로 덧붙인다', () => {
    expect(ensureOption([{ value: 'A', label: '가' }], 'B')).toEqual([
      { value: 'A', label: '가' },
      { value: 'B', label: 'B' },
    ]);
  });

  it('빈 값은 덧붙이지 않는다', () => {
    const options = [{ value: 'A', label: '가' }];

    expect(ensureOption(options, '')).toBe(options);
  });
});

describe('selectableOptions', () => {
  const entries = [
    { value: '11', label: '제1공장', isActive: true },
    { value: '13', label: '제3공장', isActive: false },
  ];

  it('쓰지 않는 것은 고를 목록에서 뺀다', () => {
    expect(selectableOptions(entries, '').map((option) => option.value)).toEqual(['11']);
  });

  /* 빼 버리면 칸이 비어 보여 사용자가 값이 사라진 줄 알고 다시 고른다. */
  it('지금 고른 값이면 쓰지 않는 것도 표식과 함께 남긴다', () => {
    expect(selectableOptions(entries, '13')).toContainEqual({
      value: '13',
      label: `제3공장${messages.toolMaster.values.inactiveSuffix}`,
    });
  });

  it('목록에 아예 없는 값도 코드 그대로 남긴다', () => {
    expect(selectableOptions(entries, '99')).toContainEqual({ value: '99', label: '99' });
  });
});

describe('lookupLabel', () => {
  it('못 찾으면 값을 그대로 보인다', () => {
    expect(lookupLabel([], '11')).toBe('11');
  });
});

describe('toToolSort', () => {
  it('계약이 정한 값은 그대로 쓴다', () => {
    for (const option of SORT_OPTIONS) {
      expect(toToolSort(option.value)).toBe(option.value);
    }
  });

  /*
   * ⛔ **모르는 값을 질의에 싣지 않는다** — 계약이 받지 않는 값이라 서버가 거절하고,
   * 그때 사용자는 목록이 왜 비었는지 알 수 없다.
   */
  it.each(['', 'NAME_ASC', 'shot_usage_desc'])('모르는 값 %s 은 기본 정렬로 돌아간다', (value) => {
    expect(toToolSort(value)).toBe(defaultToolFilters.sort);
  });
});

describe('defaultToolFilters', () => {
  /** 마스터 화면은 「그 툴을 찾아 고치는」 자리라 찾는 차례가 먼저다. */
  it('처음 차례는 코드 순이다', () => {
    expect(defaultToolFilters.sort).toBe('CODE');
  });

  it('처음에는 아무 조건도 걸지 않는다', () => {
    expect(defaultToolFilters).toEqual({
      q: '',
      plantId: '',
      toolTypeCode: '',
      guaranteedShotCountMissing: false,
      pmDueOnly: false,
      sort: 'CODE',
      includeInactive: false,
    });
  });
});
