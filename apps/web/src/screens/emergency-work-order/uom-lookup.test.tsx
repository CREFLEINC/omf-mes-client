import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderHookWithProviders, type StubFetch } from '../../test/api-harness';
import { UOM_UNKNOWN, useUomLookup } from './uom-lookup';

const stub =
  (options: { fail?: boolean } = {}): StubFetch =>
  async () =>
    options.fail === true
      ? jsonResponse({ message: '실패' }, { status: 500 })
      : jsonResponse({
          items: [
            { uomId: 11, uomCode: 'EA', isActive: true },
            { uomId: 12, uomCode: 'BOX', isActive: false },
          ],
          page: { page: 1, size: 20, total: 2 },
        });

describe('useUomLookup', () => {
  it('식별자를 단위 이름으로 바꾼다', async () => {
    const { result } = renderHookWithProviders(() => useUomLookup(), { fetch: stub() });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.labelOf(11)).toBe('EA');
  });

  it('쓰지 않게 된 단위도 이름을 낸다 — 이미 그 단위로 쓰인 값이 있다', async () => {
    const { result } = renderHookWithProviders(() => useUomLookup(), { fetch: stub() });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.labelOf(12)).toBe('BOX');
  });

  /*
   * ⛔ `11` 은 사용자가 쓰는 말이 아니다. 이름을 모르는데 식별자를 내면 그것이 단위인 줄 알고
   * 읽는다 — 모르면 모른다고 적는 편이 낫다.
   */
  it.each([
    ['고른 품목이 없을 때', undefined],
    ['목록에 없는 단위일 때', 99],
  ])('⛔ %s 숫자 식별자를 보이지 않는다', async (_name, uomId) => {
    const { result } = renderHookWithProviders(() => useUomLookup(), { fetch: stub() });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.labelOf(uomId)).toBe(UOM_UNKNOWN);
  });

  it('⛔ 조회가 실패해도 숫자 식별자로 물러나지 않는다', async () => {
    const { result } = renderHookWithProviders(() => useUomLookup(), {
      fetch: stub({ fail: true }),
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.labelOf(11)).toBe(UOM_UNKNOWN);
    expect(result.current.labelOf(11)).not.toContain('11');
  });

  it('받기 전에도 숫자를 보이지 않는다', () => {
    const { result } = renderHookWithProviders(() => useUomLookup(), { fetch: stub() });

    expect(result.current.labelOf(11)).toBe(UOM_UNKNOWN);
  });
});
