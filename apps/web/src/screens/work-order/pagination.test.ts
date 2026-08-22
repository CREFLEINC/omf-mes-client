import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { toWorkOrderPageView } from './pagination';

const t = messages.workOrder;

describe('toWorkOrderPageView', () => {
  it.each([
    [
      'first page',
      { page: 1, size: 20, total: 45 },
      20,
      { page: 1, canFirst: false, canPrev: false, canNext: true, isBeyondLast: false },
      '1–20 / 전체 45건',
    ],
    [
      'middle page',
      { page: 2, size: 20, total: 45 },
      20,
      { page: 2, canFirst: true, canPrev: true, canNext: true, isBeyondLast: false },
      '21–40 / 전체 45건',
    ],
    [
      'last page',
      { page: 3, size: 20, total: 45 },
      5,
      { page: 3, canFirst: true, canPrev: true, canNext: false, isBeyondLast: false },
      '41–45 / 전체 45건',
    ],
    [
      'beyond last page',
      { page: 4, size: 20, total: 45 },
      0,
      { page: 4, canFirst: true, canPrev: true, canNext: false, isBeyondLast: true },
      '전체 45건',
    ],
  ])('%s derives navigation and range state', (_name, meta, shown, flags, rangeLabel) => {
    expect(toWorkOrderPageView(meta, shown)).toEqual({ ...flags, rangeLabel });
  });

  it('preserves a valid server page for zero results so a caller can recover', () => {
    expect(toWorkOrderPageView({ page: 7, size: 20, total: 0 }, 0)).toEqual({
      page: 7,
      canFirst: true,
      canPrev: true,
      canNext: false,
      isBeyondLast: false,
      rangeLabel: t.page.total(0),
    });
  });

  it('normalizes invalid page metadata and clamps shown rows without inventing a page request', () => {
    expect(toWorkOrderPageView({ page: 0, size: 0, total: -1 }, Number.NaN)).toEqual({
      page: 1,
      canFirst: false,
      canPrev: false,
      canNext: false,
      isBeyondLast: false,
      rangeLabel: t.page.total(0),
    });
    expect(toWorkOrderPageView({ page: 2, size: 10, total: 50 }, 99).rangeLabel).toBe(
      t.page.range(11, 20, 50),
    );
  });
});
