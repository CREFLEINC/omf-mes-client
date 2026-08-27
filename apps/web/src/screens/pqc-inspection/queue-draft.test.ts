import { describe, expect, it } from 'vitest';

import { EMPTY_FILTERS } from './filters';
import { EMPTY_DRAFT, hasError, toDraft, toFilters, validateDraft } from './queue-draft';

describe('validateDraft', () => {
  it('빈 칸은 조건이 아니므로 잘못된 것도 아니다', () => {
    expect(validateDraft(EMPTY_DRAFT)).toEqual({ workOrder: false, lot: false });
  });

  it('1 이상 정수를 받는다', () => {
    expect(hasError(validateDraft({ ...EMPTY_DRAFT, workOrder: '1001' }))).toBe(false);
  });

  it.each(['0', '-1', '1.5', 'abc', '1e3'])('번호가 아닌 값(%s)을 잡는다', (raw) => {
    expect(validateDraft({ ...EMPTY_DRAFT, workOrder: raw }).workOrder).toBe(true);
  });

  it('앞뒤 공백은 번호를 가리지 않는다', () => {
    expect(validateDraft({ ...EMPTY_DRAFT, lot: '  2002  ' }).lot).toBe(false);
  });

  it('칸마다 따로 잡는다 — 한 칸이 틀렸다고 멀쩡한 칸까지 고치라고 하지 않는다', () => {
    expect(validateDraft({ workOrder: 'x', lot: '2002', keyword: '' })).toEqual({
      workOrder: true,
      lot: false,
    });
  });
});

describe('toFilters', () => {
  it('빈 초안은 아무것도 좁히지 않는다', () => {
    expect(toFilters(EMPTY_DRAFT)).toEqual(EMPTY_FILTERS);
  });

  it('번호를 정수로 옮긴다', () => {
    expect(toFilters({ workOrder: '1001', lot: '2002', keyword: 'IR' })).toEqual({
      workOrderId: 1001,
      lotId: 2002,
      keyword: 'IR',
    });
  });

  it('앞뒤 공백을 걷어낸다 — 공백만 친 것은 조건이 아니다', () => {
    expect(toFilters({ workOrder: ' 7 ', lot: '', keyword: '   ' })).toEqual({
      workOrderId: 7,
      lotId: null,
      keyword: '',
    });
  });
});

describe('toDraft', () => {
  it('조건을 되돌리면 같은 초안이 나온다', () => {
    const filters = { workOrderId: 1001, lotId: 2002, keyword: 'IR' };

    expect(toFilters(toDraft(filters))).toEqual(filters);
  });

  it('좁히지 않은 조건은 빈 칸이 된다', () => {
    expect(toDraft(EMPTY_FILTERS)).toEqual(EMPTY_DRAFT);
  });
});
