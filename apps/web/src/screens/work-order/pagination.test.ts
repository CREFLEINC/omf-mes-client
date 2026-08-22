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

  it('preserves a valid server page for zero results without an inverted range', () => {
    expect(toWorkOrderPageView({ page: 7, size: 20, total: 0 }, 5)).toEqual({
      page: 7,
      canFirst: true,
      canPrev: true,
      canNext: false,
      isBeyondLast: false,
      rangeLabel: t.page.total(0),
    });
  });

  it.each([0, 1.5, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'normalizes page %p to 1',
    (page) => {
      expect(toWorkOrderPageView({ page, size: 10, total: 20 }, 1)).toMatchObject({
        page: 1,
        canPrev: false,
        rangeLabel: t.page.range(1, 1, 20),
      });
    },
  );

  it('preserves exact safe-integer pagination boundaries', () => {
    const max = Number.MAX_SAFE_INTEGER;

    expect(toWorkOrderPageView({ page: max, size: 1, total: max }, 1)).toEqual({
      page: max,
      canFirst: true,
      canPrev: true,
      canNext: false,
      isBeyondLast: false,
      rangeLabel: t.page.range(max, max, max),
    });
    expect(toWorkOrderPageView({ page: 1, size: max, total: max }, max)).toEqual({
      page: 1,
      canFirst: false,
      canPrev: false,
      canNext: false,
      isBeyondLast: false,
      rangeLabel: t.page.range(1, max, max),
    });
  });

  it.each([0, -1, 1.5, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'normalizes size %p to 1',
    (size) => {
      expect(toWorkOrderPageView({ page: 2, size, total: 3 }, 1)).toMatchObject({
        canPrev: true,
        canNext: true,
        rangeLabel: t.page.range(2, 2, 3),
      });
    },
  );

  it.each([0, -1, 1.5, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'normalizes total %p to 0',
    (total) => {
      expect(toWorkOrderPageView({ page: 2, size: 10, total }, 1)).toMatchObject({
        canNext: false,
        isBeyondLast: false,
        rangeLabel: t.page.total(0),
      });
    },
  );

  it.each([
    ['negative', -1, t.page.total(50)],
    ['fractional', 4.8, t.page.range(11, 14, 50)],
    ['larger than size', 99, t.page.range(11, 20, 50)],
    ['non-finite', Number.POSITIVE_INFINITY, t.page.total(50)],
  ])('normalizes %s shown rows', (_name, shown, rangeLabel) => {
    expect(toWorkOrderPageView({ page: 2, size: 10, total: 50 }, shown).rangeLabel).toBe(
      rangeLabel,
    );
  });
});
