import { describe, expect, it } from 'vitest';

import { hasError, toDraft, toFilters, validateDraft } from './queue-draft';

describe('validateDraft', () => {
  it('빈 칸은 조건이 아니므로 잘못된 것도 아니다', () => {
    expect(hasError(validateDraft({ item: '  ', keyword: '' }))).toBe(false);
  });

  it('번호가 아닌 값을 조용히 넘기지 않는다 — 넘기면 사용자는 좁혔다고 믿는데 결과가 안 좁혀진다', () => {
    expect(validateDraft({ item: '0', keyword: '' }).item).toBe(true);
    expect(validateDraft({ item: 'abc', keyword: '' }).item).toBe(true);
    expect(validateDraft({ item: '2101', keyword: '' }).item).toBe(false);
  });
});

describe('toFilters', () => {
  it('토글을 인자로 받아 조건에 합류시킨다 — 초안에는 boolean 을 두지 않는다', () => {
    expect(toFilters({ item: ' 2101 ', keyword: ' IR ' }, false)).toEqual({
      itemId: 2101,
      keyword: 'IR',
      pendingOnly: false,
    });
  });

  it('빈 칸은 「좁히지 않음」이다', () => {
    expect(toFilters({ item: '', keyword: '' }, true)).toEqual({
      itemId: null,
      keyword: '',
      pendingOnly: true,
    });
  });
});

describe('toDraft', () => {
  it('주소가 담은 조건을 편집 초안으로 되돌린다', () => {
    expect(toDraft({ itemId: 2101, keyword: 'IR', pendingOnly: false })).toEqual({
      item: '2101',
      keyword: 'IR',
    });
  });
});
