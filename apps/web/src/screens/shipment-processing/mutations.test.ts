import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { useShipmentProcessingMutation } from './mutations';
import { shipmentProcessingKeys } from './queries';

const SHIPMENTS_PATH = '/logistics/shipments';

const createBody = (overrides: Record<string, unknown> = {}) => ({
  shipmentRequestId: 501,
  warehouseId: 1001,
  expedited: false,
  businessDate: '2026-08-11',
  occurredAt: '2026-08-11T14:20:30+09:00',
  lines: [
    {
      shipmentRequestLineId: 701,
      shippedQty: 100,
      uomId: 920001,
      allocations: [{ lotId: 1001, allocatedQty: 100, uomId: 920001 }],
    },
  ],
  ...overrides,
});

const shipmentResponse = (overrides: Record<string, unknown> = {}) => ({
  shipmentId: 9001,
  shipmentNo: 'SYN-SH-9001',
  shipmentRequestId: 501,
  warehouseId: 1001,
  statusCode: 'UNCONFIRMED',
  lines: [],
  ...overrides,
});

interface RecordedRequest {
  method: string;
  url: URL;
  headers: Headers;
  body: unknown;
}

const recordingFetch = (routes: StubRoute[]): { fetch: StubFetch; requests: RecordedRequest[] } => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch(routes);

  return {
    fetch: async (request) => {
      requests.push({
        method: request.method,
        url: new URL(request.url),
        headers: request.headers,
        body: request.method === 'POST' ? await request.clone().json() : null,
      });
      return stub(request);
    },
    requests,
  };
};

const shipmentsRoute = (respond: () => Response): StubRoute => ({
  match: (request) => request.method === 'POST' && new URL(request.url).pathname === SHIPMENTS_PATH,
  respond,
});

describe('useShipmentProcessingMutation', () => {
  it('If-Match 없이 멱등 키만 실어 보내고, 응답으로 후보·상세 캐시를 무효화한다', async () => {
    const onSuccess = vi.fn();
    const response = shipmentResponse();
    const { fetch, requests } = recordingFetch([
      shipmentsRoute(() => jsonResponse(response, { status: 201 })),
    ]);
    const { result, queryClient } = renderHookWithProviders(
      () => useShipmentProcessingMutation({ onSuccess }),
      { fetch },
    );
    queryClient.setQueryData(shipmentProcessingKeys.detail(501), { shipmentRequestId: 501 });

    act(() => {
      result.current.write(createBody());
    });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(response));

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: 'POST',
      url: { pathname: SHIPMENTS_PATH, search: '' },
    });
    expect(requests[0]?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/i);
    expect(requests[0]?.headers.has('If-Match')).toBe(false);
    await waitFor(() =>
      expect(queryClient.getQueryState(shipmentProcessingKeys.detail(501))?.isInvalidated).toBe(
        true,
      ),
    );
  });

  it('400 필드 오류를 배너로 낸다 — 확인 창 안에 대응하는 입력칸이 없다(knownFields: [])', async () => {
    const { fetch } = recordingFetch([
      shipmentsRoute(() =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'field',
                field: 'warehouseId',
                code: 'X',
                message: 'Synthetic invalid warehouse',
              },
            ],
          },
          { status: 400 },
        ),
      ),
    ]);
    const { result } = renderHookWithProviders(
      () => useShipmentProcessingMutation({ onSuccess: vi.fn() }),
      {
        fetch,
      },
    );

    act(() => {
      result.current.write(createBody());
    });

    await waitFor(() =>
      expect(result.current.error).toEqual({
        kind: 'validation',
        errors: [
          {
            scope: 'field',
            field: 'warehouseId',
            code: 'X',
            message: 'Synthetic invalid warehouse',
          },
        ],
      }),
    );
    expect(result.current.fieldErrors).toEqual({});
  });

  it('409 원인과 메시지를 conflict 오류로 보존한다', async () => {
    const { fetch } = recordingFetch([
      shipmentsRoute(() =>
        jsonResponse(
          { code: 'VERSION_CONFLICT', conflictCause: 'user', message: 'Synthetic state conflict' },
          { status: 409 },
        ),
      ),
    ]);
    const { result } = renderHookWithProviders(
      () => useShipmentProcessingMutation({ onSuccess: vi.fn() }),
      {
        fetch,
      },
    );

    act(() => {
      result.current.write(createBody());
    });

    await waitFor(() =>
      expect(result.current.error).toEqual({
        kind: 'conflict',
        cause: 'user',
        message: 'Synthetic state conflict',
      }),
    );
  });

  it('되돌릴 수 없는 쓰기라 실패 뒤 같은 본문 재시도는 같은 멱등 키를 쓴다', async () => {
    let attempt = 0;
    const onSuccess = vi.fn();
    const { fetch, requests } = recordingFetch([
      shipmentsRoute(() => {
        attempt += 1;
        return attempt === 1
          ? jsonResponse({ message: 'Synthetic transient failure' }, { status: 500 })
          : jsonResponse(shipmentResponse(), { status: 201 });
      }),
    ]);
    const { result } = renderHookWithProviders(() => useShipmentProcessingMutation({ onSuccess }), {
      fetch,
    });

    act(() => {
      result.current.write(createBody());
    });
    await waitFor(() => expect(result.current.error).toMatchObject({ kind: 'http', status: 500 }));

    act(() => {
      result.current.write(createBody());
    });
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));

    expect(requests).toHaveLength(2);
    expect(requests[1]?.headers.get('Idempotency-Key')).toBe(
      requests[0]?.headers.get('Idempotency-Key'),
    );
  });
});
