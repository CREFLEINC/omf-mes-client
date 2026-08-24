import { messages } from '@omf-mes/i18n';
import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import {
  candidateReferenceKeys,
  describeWorkOrderCloseItemReference,
  resolveWorkOrderCloseUomReference,
  toWorkOrderCloseQuantityLabel,
  useWorkOrderCloseItemNames,
  useWorkOrderCloseUomLookup,
  type WorkOrderCloseUomReferenceSource,
} from './candidate-references';

const t = messages.workOrderClose.candidateReferences;
const itemPath = (itemId: number): string => `/mdm/items/${String(itemId)}`;
const itemResponse = (itemId: number, isActive = true) => ({
  item: {
    itemId,
    itemCode: 'SYN-ITEM',
    itemName: 'Synthetic Item',
    itemTypeCode: 'MATERIAL',
    baseUomId: 920001,
    lotControlTypeCode: 'NONE',
    serialControlTypeCode: 'NONE',
    inspectionRequired: false,
    fifoPolicyCode: 'FIFO',
    negativeStockAllowed: false,
    isActive,
  },
  editability: { codeEditable: false, reason: 'RECEIVED_FROM_ERP', referenceCount: null },
});
const recordingFetch = (routes: StubRoute[]): { fetch: StubFetch; urls: URL[] } => {
  const urls: URL[] = [];
  const stub = createStubFetch(routes);
  const fetch: StubFetch = async (request) => {
    urls.push(new URL(request.url));
    return stub(request);
  };
  return { fetch, urls };
};
const pathRoute = (path: string, respond: () => Response): StubRoute => ({
  match: (request) => new URL(request.url).pathname === path,
  respond,
});
const errorResponse = (status: 404 | 500): Response =>
  jsonResponse({ message: 'synthetic failure' }, { status });
type UomSource = WorkOrderCloseUomReferenceSource;
const uomSource = (overrides: Partial<UomSource> = {}): UomSource => ({
  entries: [{ uomId: 920001, label: 'SYN-EA · Synthetic Each' }],
  isError: false,
  isLoading: false,
  truncated: false,
  ...overrides,
});

describe('work-order close candidate references', () => {
  it('keeps first-seen unique exact item requests loading until each response arrives', async () => {
    const releases = new Map<number, (response: Response) => void>();
    const itemIds = [910002, 910001, 910002];
    const fetch: StubFetch = async (request) => {
      const itemId = Number(new URL(request.url).pathname.split('/').at(-1));
      return new Promise<Response>((resolve) => releases.set(itemId, resolve));
    };
    const { result } = renderHookWithProviders(() => useWorkOrderCloseItemNames(itemIds), {
      fetch,
    });
    await waitFor(() => expect(releases.size).toBe(2));
    expect([...releases.keys()]).toEqual([910002, 910001]);
    expect(result.current.items.map(({ itemId, status }) => ({ itemId, status }))).toEqual([
      { itemId: 910002, status: 'loading' },
      { itemId: 910001, status: 'loading' },
    ]);
    expect(itemIds).toEqual([910002, 910001, 910002]);
    releases.get(910002)?.(jsonResponse(itemResponse(910002)));
    releases.get(910001)?.(jsonResponse(itemResponse(910001)));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('separates inactive named, exact 404, and other item failures without cross-contamination', async () => {
    const { fetch } = recordingFetch([
      pathRoute(itemPath(910003), () => jsonResponse(itemResponse(910003, false))),
      pathRoute(itemPath(910004), () => errorResponse(404)),
      pathRoute(itemPath(910005), () => errorResponse(500)),
    ]);
    const { result } = renderHookWithProviders(
      () => useWorkOrderCloseItemNames([910003, 910004, 910005]),
      { fetch },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toEqual([
      { itemId: 910003, status: 'named', label: 'SYN-ITEM · Synthetic Item' },
      { itemId: 910004, status: 'unknown', label: null },
      { itemId: 910005, status: 'failed', label: null },
    ]);
    expect(candidateReferenceKeys.item(910003)).not.toEqual(candidateReferenceKeys.item(910004));
    expect(typeof result.current.refetch).toBe('function');
  });

  it('drops stale item names when refetch returns 404 or another failure', async () => {
    let isRefetch = false;
    const itemIds = [910006, 910007];
    const fetch: StubFetch = async (request) => {
      const itemId = Number(new URL(request.url).pathname.split('/').at(-1));
      if (!isRefetch) return jsonResponse(itemResponse(itemId));
      return errorResponse(itemId === 910006 ? 404 : 500);
    };
    const { result } = renderHookWithProviders(() => useWorkOrderCloseItemNames(itemIds), {
      fetch,
    });
    await waitFor(() =>
      expect(result.current.items.every((item) => item.status === 'named')).toBe(true),
    );
    isRefetch = true;
    result.current.refetch();
    await waitFor(() =>
      expect(result.current.items).toEqual([
        { itemId: 910006, status: 'unknown', label: null },
        { itemId: 910007, status: 'failed', label: null },
      ]),
    );
  });

  it('loads active and inactive UOM names with includeInactive and preserves truncation', async () => {
    const { fetch, urls } = recordingFetch([
      pathRoute('/mdm/uoms', () =>
        jsonResponse({
          items: [
            {
              uomId: 920001,
              uomCode: 'SYN-EA',
              uomName: 'Synthetic Each',
              decimalScale: 0,
              isActive: true,
            },
            {
              uomId: 920002,
              uomCode: 'SYN-KG',
              uomName: 'Synthetic Kilogram',
              decimalScale: 3,
              isActive: false,
            },
          ],
          page: { page: 1, size: 25, total: 3 },
        }),
      ),
    ]);
    const { result } = renderHookWithProviders(() => useWorkOrderCloseUomLookup(), { fetch });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({
      entries: [
        { uomId: 920001, label: 'SYN-EA · Synthetic Each' },
        { uomId: 920002, label: 'SYN-KG · Synthetic Kilogram' },
      ],
      isError: false,
      truncated: true,
    });
    expect(urls).toHaveLength(1);
    expect(urls[0]?.searchParams.get('includeInactive')).toBe('true');
    expect(typeof result.current.refetch).toBe('function');
  });

  it('preserves a UOM request failure as an error result', async () => {
    const fetch = createStubFetch([pathRoute('/mdm/uoms', () => errorResponse(500))]);
    const { result } = renderHookWithProviders(() => useWorkOrderCloseUomLookup(), { fetch });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.entries).toEqual([]);
  });

  it('resolves UOM with failed, loading, named, truncated, unknown priority', () => {
    const namedSource = uomSource({ truncated: true });
    const originalEntries = namedSource.entries;
    expect(
      resolveWorkOrderCloseUomReference(
        uomSource({ isError: true, isLoading: true, truncated: true }),
        920001,
      ),
    ).toEqual({ kind: 'failed' });
    expect(
      resolveWorkOrderCloseUomReference(uomSource({ isLoading: true, truncated: true }), 920001),
    ).toEqual({ kind: 'loading' });
    expect(resolveWorkOrderCloseUomReference(namedSource, 920001)).toEqual({
      kind: 'named',
      label: 'SYN-EA · Synthetic Each',
    });
    expect(
      resolveWorkOrderCloseUomReference(uomSource({ entries: [], truncated: true }), 920099),
    ).toEqual({ kind: 'truncated' });
    expect(resolveWorkOrderCloseUomReference(uomSource({ entries: [] }), 920099)).toEqual({
      kind: 'unknown',
    });
    expect(namedSource.entries).toBe(originalEntries);
  });

  it('describes item and quantity states distinctly without raw reference ID fallbacks', () => {
    const itemDescriptions = [
      describeWorkOrderCloseItemReference({ itemId: 910099, status: 'loading', label: null }),
      describeWorkOrderCloseItemReference({ itemId: 910099, status: 'unknown', label: null }),
      describeWorkOrderCloseItemReference({ itemId: 910099, status: 'failed', label: null }),
      describeWorkOrderCloseItemReference({
        itemId: 910099,
        status: 'named',
        label: 'SYN-ITEM · Synthetic Item',
      }),
    ];
    const quantityLabels = [
      toWorkOrderCloseQuantityLabel(12.5, { kind: 'failed' }),
      toWorkOrderCloseQuantityLabel(12.5, { kind: 'loading' }),
      toWorkOrderCloseQuantityLabel(12.5, { kind: 'truncated' }),
      toWorkOrderCloseQuantityLabel(12.5, { kind: 'unknown' }),
      toWorkOrderCloseQuantityLabel(12.5, { kind: 'named', label: 'SYN-EA · Synthetic Each' }),
    ];
    expect(new Set(itemDescriptions).size).toBe(4);
    expect(new Set(quantityLabels).size).toBe(5);
    expect(itemDescriptions).toEqual([
      t.item.loading,
      t.item.unknown,
      t.item.failed,
      'SYN-ITEM · Synthetic Item',
    ]);
    expect(quantityLabels).toContain(`12.5 ${t.uom.truncated}`);
    expect(quantityLabels.every((label) => label.startsWith('12.5 '))).toBe(true);
    expect([...itemDescriptions, ...quantityLabels].join(' ')).not.toMatch(/910099|920099/);
  });
});
