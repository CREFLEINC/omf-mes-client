import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { UOM_ID } from './fixtures';
import { useUomLookup } from './uom-lookup';

const okRoutes = [
  {
    match: (request: Request) => new URL(request.url).pathname === '/mdm/uoms',
    respond: () => jsonResponse({ items: [{ uomId: UOM_ID, uomCode: 'EA', uomName: '개' }] }),
  },
];

const failRoutes = [
  {
    match: (request: Request) => new URL(request.url).pathname === '/mdm/uoms',
    respond: () => jsonResponse({ message: '조회 실패' }, { status: 500 }),
  },
];

describe('useUomLookup — 이름을 모르면 아무것도 붙이지 않는다', () => {
  it('받아 온 단위는 코드로 보인다', async () => {
    const { result } = renderHookWithProviders(() => useUomLookup(), {
      fetch: createStubFetch(okRoutes),
    });

    await waitFor(() => {
      expect(result.current.labelOf(UOM_ID)).toBe('EA');
    });
  });

  /*
   * ⛔ **숫자 식별자를 보이지 않는다.** `10` 은 사용자가 쓰는 말이 아니라, 붙이면 수량 뒤에
   * 뜻 없는 숫자가 하나 더 서서 「120 10」처럼 읽힌다.
   */
  it('조회가 실패하면 null 이다 — 식별자로 대신하지 않는다', async () => {
    const { result } = renderHookWithProviders(() => useUomLookup(), {
      fetch: createStubFetch(failRoutes),
    });

    await waitFor(() => {
      expect(result.current.labelOf(UOM_ID)).toBeNull();
    });
  });

  it('모르는 단위도 null 이다', async () => {
    const { result } = renderHookWithProviders(() => useUomLookup(), {
      fetch: createStubFetch(okRoutes),
    });

    await waitFor(() => {
      expect(result.current.labelOf(UOM_ID)).toBe('EA');
    });

    expect(result.current.labelOf(999)).toBeNull();
    expect(result.current.labelOf(undefined)).toBeNull();
  });
});
