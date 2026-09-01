import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { type PageMeta, toPageView } from './pagination';

const t = messages.workOrderProgress.page;

const meta = (overrides: Partial<PageMeta> = {}): PageMeta => ({
  page: 1,
  size: 50,
  total: 128,
  ...overrides,
});

describe('toPageView', () => {
  it('지금 보는 자리와 전체를 함께 적는다', () => {
    expect(toPageView(meta(), 50).rangeLabel).toBe(t.range(1, 50, 128));
  });

  it('마지막 쪽은 받은 줄 수만큼만 적는다', () => {
    expect(toPageView(meta({ page: 3 }), 28).rangeLabel).toBe(t.range(101, 128, 128));
  });

  it('결과가 0건이면 자리 대신 건수만 적는다', () => {
    expect(toPageView(meta({ total: 0 }), 0).rangeLabel).toBe(t.total(0));
  });

  describe('경계', () => {
    it('첫 쪽에서는 이전으로 갈 수 없다', () => {
      expect(toPageView(meta(), 50).canPrev).toBe(false);
    });

    it('마지막 쪽에서는 다음으로 갈 수 없다', () => {
      expect(toPageView(meta({ page: 3 }), 28).canNext).toBe(false);
    });

    it('가운데 쪽에서는 양쪽으로 간다', () => {
      const view = toPageView(meta({ page: 2 }), 50);

      expect(view.canPrev).toBe(true);
      expect(view.canNext).toBe(true);
    });

    it('한 쪽에 다 들어가면 어느 쪽으로도 갈 수 없다', () => {
      const view = toPageView(meta({ total: 12 }), 12);

      expect(view.canPrev).toBe(false);
      expect(view.canNext).toBe(false);
    });

    /*
     * ⛔ 조건이 좁아졌는데 쪽 번호가 주소에 남아 있으면 **없는 자리**를 가리킨다.
     * 화면이 그 상태를 알아야 첫 쪽으로 되돌릴 수 있다.
     */
    it('⛔ 마지막 쪽을 지나쳐 있으면 그 사실을 알린다', () => {
      expect(toPageView(meta({ page: 9 }), 0).isBeyondLast).toBe(true);
    });

    it('결과가 0건이면 「지나쳤다」로 보지 않는다 — 되돌릴 자리가 없다', () => {
      expect(toPageView(meta({ page: 9, total: 0 }), 0).isBeyondLast).toBe(false);
    });

    it('마지막 쪽 자체는 지나친 것이 아니다', () => {
      expect(toPageView(meta({ page: 3 }), 28).isBeyondLast).toBe(false);
    });
  });

  /*
   * 계약이 보장하는 값이지만, 0이 오면 나눗셈이 무너진다. ⛔ 그때의 해악은 「멎는 것」이
   * 아니라 **끝없이 다음 쪽으로 갈 수 있게 되는 것**이다 — 쪽 수가 무한이 되어 「다음」이
   * 영영 열리고, 마지막을 지나쳤다는 사실도 알 수 없다.
   */
  describe('망가진 값을 받아도 멎지 않는다', () => {
    it('⛔ 크기가 0이어도 끝없이 다음 쪽으로 가지 않는다', () => {
      const view = toPageView(meta({ size: 0, page: 200 }), 0);

      expect(view.canNext).toBe(false);
      expect(view.isBeyondLast).toBe(true);
    });

    it.each([
      ['크기가 0', { size: 0 }],
      ['크기가 음수', { size: -50 }],
      ['쪽이 0', { page: 0 }],
      ['쪽이 음수', { page: -1 }],
    ])('%s 이어도 첫 쪽으로 읽는다', (_name, overrides) => {
      const view = toPageView(meta(overrides), 50);

      expect(Number.isFinite(view.page)).toBe(true);
      expect(view.page).toBeGreaterThanOrEqual(1);
      expect(view.rangeLabel).not.toContain('NaN');
    });
  });
});
