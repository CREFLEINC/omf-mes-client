import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { createdShipmentRequestFixture } from './fixtures';
import { useShipmentRequestCreateMutation } from './mutations';
import type { ShipmentRequestCreate } from './types';

const CREATE_PATH = '/logistics/shipment-requests';

const BODY: ShipmentRequestCreate = {
  salesOrderId: 8101,
  customerId: 8201,
  shipToPartnerId: 8211,
  requestedShipDate: '2026-08-20',
  lines: [
    {
      salesOrderLineId: 8601,
      itemId: 8301,
      requestedQty: 80,
      allocatedQty: 80,
      uomId: 8401,
      shippingInspectionRequired: false,
    },
  ],
};

describe('useShipmentRequestCreateMutation', () => {
  it('잠금 토큰 없이 Idempotency-Key만 실어 보낸다(etagPath: null)', async () => {
    let idempotencyKey: string | null = null;
    let ifMatchHeader: string | null = null;
    const routes: StubRoute[] = [
      {
        match: (request) =>
          request.method === 'POST' && new URL(request.url).pathname === CREATE_PATH,
        respond: (request) => {
          idempotencyKey = request.headers.get('Idempotency-Key');
          ifMatchHeader = request.headers.get('If-Match');

          return jsonResponse(createdShipmentRequestFixture, { status: 201 });
        },
      },
    ];

    const onSuccess = vi.fn();
    const { result } = renderHookWithProviders(
      () => useShipmentRequestCreateMutation({ onSuccess }),
      {
        fetch: createStubFetch(routes),
      },
    );

    act(() => {
      result.current.write(BODY);
    });

    await waitFor(() => {
      expect(result.current.isSaving).toBe(false);
    });

    expect(idempotencyKey).toBeTruthy();
    expect(ifMatchHeader).toBeNull();
    expect(onSuccess).toHaveBeenCalledWith({
      shipmentRequestNo: 'SAMPLE-SR-0001',
      statusCode: 'SAMPLE_SR_S_A',
      lineCount: 1,
    });
  });

  it('검증 실패(400)는 화면이 아는 필드로 인라인 오류를 낸다', async () => {
    const routes: StubRoute[] = [
      {
        match: (request) =>
          request.method === 'POST' && new URL(request.url).pathname === CREATE_PATH,
        respond: () =>
          jsonResponse(
            {
              errors: [
                {
                  scope: 'field',
                  field: 'requestedShipDate',
                  code: 'REQUIRED',
                  message: '필수입니다.',
                },
              ],
            },
            { status: 400 },
          ),
      },
    ];

    const { result } = renderHookWithProviders(
      () => useShipmentRequestCreateMutation({ onSuccess: vi.fn() }),
      { fetch: createStubFetch(routes) },
    );

    act(() => {
      result.current.write(BODY);
    });

    await waitFor(() => {
      expect(result.current.isSaving).toBe(false);
    });

    expect(result.current.fieldErrors.requestedShipDate).toBe('필수입니다.');
  });
});
