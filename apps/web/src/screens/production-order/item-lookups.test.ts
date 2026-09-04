import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { productionOrderItemKeys, useProductionOrderItemNames } from './item-lookups';

const itemPath = (itemId: number): string => `/mdm/items/${String(itemId)}`;

const itemResponse = (itemId: number) => ({
  item: {
    itemId,
    itemCode: `MAT-${String(itemId)}`,
    itemName: `Synthetic item ${String(itemId)}`,
    itemTypeCode: 'MATERIAL',
    baseUomId: 8001,
    lotControlled: false,
    serialControlTypeCode: 'NONE',
    inspectionRequired: false,
    fifoPolicyCode: 'FIFO',
    negativeStockAllowed: false,
    isActive: true,
  },
  editability: { codeEditable: false, reason: 'RECEIVED_FROM_ERP', referenceCount: null },
});

const recordingFetch = (routes: StubRoute[]): { fetch: StubFetch; paths: string[] } => {
  const paths: string[] = [];
  const stub = createStubFetch(routes);

  return {
    paths,
    fetch: async (request) => {
      paths.push(new URL(request.url).pathname);
      return stub(request);
    },
  };
};

describe('useProductionOrderItemNames', () => {
  it('상세 응답 전에는 품목별 loading 상태를 유지한다', async () => {
    const releases = new Map<number, (response: Response) => void>();
    const fetch: StubFetch = async (request) => {
      const itemId = Number(new URL(request.url).pathname.split('/').at(-1));

      return new Promise<Response>((resolve) => {
        releases.set(itemId, resolve);
      });
    };
    const { result } = renderHookWithProviders(() => useProductionOrderItemNames([7606, 7707]), {
      fetch,
    });

    await waitFor(() => expect(releases.size).toBe(2));

    expect(result.current.items).toEqual([
      { itemId: 7606, status: 'loading', label: null },
      { itemId: 7707, status: 'loading', label: null },
    ]);

    releases.get(7606)?.(jsonResponse(itemResponse(7606)));
    releases.get(7707)?.(jsonResponse(itemResponse(7707)));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('중복 품목은 exact 상세를 한 번만 받고 named label에는 내부 ID를 내보내지 않는다', async () => {
    const { fetch, paths } = recordingFetch([
      {
        match: (request) => new URL(request.url).pathname === itemPath(7101),
        respond: () => jsonResponse(itemResponse(7101)),
      },
      {
        match: (request) => new URL(request.url).pathname === itemPath(7202),
        respond: () => jsonResponse(itemResponse(7202)),
      },
    ]);
    const { result } = renderHookWithProviders(
      () => useProductionOrderItemNames([7101, 7202, 7101]),
      {
        fetch,
      },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(paths).toEqual([itemPath(7101), itemPath(7202)]);
    expect(result.current.items).toEqual([
      { itemId: 7101, status: 'named', label: 'MAT-7101 · Synthetic item 7101' },
      { itemId: 7202, status: 'named', label: 'MAT-7202 · Synthetic item 7202' },
    ]);
  });

  it('404와 다른 실패를 품목별로 가르고 성공 label은 보존한다', async () => {
    const { fetch } = recordingFetch([
      {
        match: (request) => new URL(request.url).pathname === itemPath(7303),
        respond: () => jsonResponse({ message: 'synthetic missing' }, { status: 404 }),
      },
      {
        match: (request) => new URL(request.url).pathname === itemPath(7404),
        respond: () => jsonResponse({ message: 'synthetic failure' }, { status: 500 }),
      },
      {
        match: (request) => new URL(request.url).pathname === itemPath(7505),
        respond: () => jsonResponse(itemResponse(7505)),
      },
    ]);
    const { result } = renderHookWithProviders(
      () => useProductionOrderItemNames([7303, 7404, 7505]),
      {
        fetch,
      },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.items).toEqual([
      { itemId: 7303, status: 'unknown', label: null },
      { itemId: 7404, status: 'failed', label: null },
      { itemId: 7505, status: 'named', label: 'MAT-7505 · Synthetic item 7505' },
    ]);
  });

  it('서로 다른 itemId는 서로 다른 캐시 키를 쓴다', () => {
    expect(productionOrderItemKeys.detail(7101)).not.toEqual(productionOrderItemKeys.detail(7202));
  });
});
