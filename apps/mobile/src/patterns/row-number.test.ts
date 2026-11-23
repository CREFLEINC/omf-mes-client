import { describe, expect, it } from 'vitest';

import { rowNumberStyle } from './row-number';

describe('행 번호 칸 폭', () => {
  it('가장 큰 번호의 자릿수만큼 — 두 자리보다 좁히지 않는다', () => {
    expect(rowNumberStyle(0)).toEqual({ '--row-no-digits': 2 });
    expect(rowNumberStyle(9)).toEqual({ '--row-no-digits': 2 });
    expect(rowNumberStyle(99)).toEqual({ '--row-no-digits': 2 });
    expect(rowNumberStyle(100)).toEqual({ '--row-no-digits': 3 });
    expect(rowNumberStyle(1200)).toEqual({ '--row-no-digits': 4 });
  });
});
