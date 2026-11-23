import { screen, waitFor } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { DispositionLegacyRedirect } from './legacy-redirect';

const pathOf = (request: Request): string => new URL(request.url).pathname;

const LocationProbe = () => {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
};

const nonconformance = (overrides: Record<string, unknown>) => ({
  nonconformanceId: 41,
  nonconformanceNo: 'NC-0041',
  itemId: 5001,
  statusCode: 'OPEN',
  openedAt: '2026-08-12T09:30:00+09:00',
  lots: [],
  ...overrides,
});

const render = (
  route: string,
  stub: { nc?: Record<string, unknown>; inspectionType?: string; list?: unknown[] },
) =>
  renderWithProviders(
    <Routes>
      <Route path="/quality/dispositions" element={<DispositionLegacyRedirect />} />
      <Route path="*" element={<LocationProbe />} />
    </Routes>,
    {
      route,
      fetch: createStubFetch([
        {
          match: (request) => /^\/quality\/nonconformances\/\d+$/.test(pathOf(request)),
          respond: () => jsonResponse(nonconformance(stub.nc ?? {})),
        },
        {
          match: (request) => pathOf(request) === '/quality/nonconformances',
          respond: () =>
            jsonResponse({
              items: stub.list ?? [],
              page: { page: 1, size: 1, total: (stub.list ?? []).length },
            }),
        },
        {
          match: (request) => /^\/quality\/inspection-requests\/\d+$/.test(pathOf(request)),
          respond: () =>
            jsonResponse({
              inspectionRequestId: 9001,
              inspectionTypeCode: stub.inspectionType ?? 'IQC',
            }),
        },
      ]),
    },
  );

const location = async (): Promise<string> => {
  const probe = await screen.findByTestId('location');
  return probe.textContent ?? '';
};

describe('옛 「부적합 처분 관리」 주소(omf-all-around#354)', () => {
  it('IQC 부적합은 IQC 탭에서 그 검사 건을 고른 채로 연다', async () => {
    render('/quality/dispositions?nonconformanceId=41', { nc: { inspectionRequestId: 9001 } });
    await waitFor(async () =>
      expect(await location()).toBe('/logistics/iqc-inspection?ir=9001&pd=0'),
    );
  });

  it('OQC 불합격(LOT 교체) 부적합은 OQC 탭에서 그 검사 건을 고른 채로 연다', async () => {
    render('/quality/dispositions?nonconformanceId=41', {
      nc: { inspectionRequestId: 9001 },
      inspectionType: 'OQC',
    });
    await waitFor(async () =>
      expect(await location()).toBe('/shipment/oqc-inspection?ir=9001&pd=0'),
    );
  });

  it('검사 건이 없는 부적합(판정 의뢰로 올린 반품 · 제품)은 OQC 탭 「판정 의뢰」에서 그 부적합을 고른 채로 연다', async () => {
    for (const sourceCode of ['RETURN', 'PRODUCT']) {
      const view = render('/quality/dispositions?nonconformanceId=41', {
        nc: { sourceCode, inspectionRequestId: null },
      });
      await waitFor(async () =>
        expect(await location()).toBe('/shipment/oqc-inspection?kind=request&nonconformanceId=41'),
      );
      view.unmount();
    }
  });

  it('품목으로 오면 그 품목의 가장 최근 부적합이 속한 탭을 그 품목으로 걸러 연다', async () => {
    render('/quality/dispositions?item=5001', {
      list: [nonconformance({ inspectionRequestId: 9001 })],
    });
    await waitFor(async () =>
      expect(await location()).toBe('/logistics/iqc-inspection?it=5001&pd=0'),
    );
  });

  it('조건 없이 오면 IQC 탭으로 연다', async () => {
    render('/quality/dispositions', {});
    await waitFor(async () => expect(await location()).toBe('/logistics/iqc-inspection'));
  });
});
