import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { usePrinters, useSerials, useTagIssueSummary } from './flow-queries';

const pathOf = (request: Request): string => new URL(request.url).pathname;

const SerialProbe = () => {
  const serials = useSerials(7, true);
  const summaries = useTagIssueSummary(serials.data?.items ?? [], true);

  return (
    <p>
      {serials.data === undefined
        ? 'serial-loading'
        : `serial-${String(serials.data.items.length)}`}
      {' / '}
      {summaries.data === undefined
        ? 'summary-loading'
        : `summary-${String(summaries.data.length)}`}
    </p>
  );
};

const PrinterProbe = () => {
  const lot = usePrinters('PRODUCTION_LOT_LABEL');
  const tag = usePrinters('IDENTIFICATION_TAG');

  return <p>{lot.data !== undefined && tag.data !== undefined ? 'ready' : 'loading'}</p>;
};

describe('P-02-04 계약 경계 조회', () => {
  it('시리얼 전체 페이지와 발행 요약을 각각 1000건 경계로 끝까지 읽는다', async () => {
    const requests: Request[] = [];
    const serials = Array.from({ length: 1001 }, (_, index) => ({
      serialNumberId: index + 1,
      serialNo: `SN-${String(index + 1)}`,
      itemId: 1,
      lotId: 7,
      statusCode: 'ACTIVE',
    }));
    const routes: StubRoute[] = [
      {
        match: (request) => pathOf(request) === '/trace/serial-numbers',
        respond: (request) => {
          requests.push(request.clone());
          const page = Number(new URL(request.url).searchParams.get('page'));
          const items = page === 1 ? serials.slice(0, 1000) : serials.slice(1000);

          return jsonResponse({ items, page: { page, size: 1000, total: 1001 } });
        },
      },
      {
        match: (request) => pathOf(request) === '/app/document-issues/summary',
        respond: (request) => {
          requests.push(request.clone());
          const targetIds = (new URL(request.url).searchParams.get('targetIds') ?? '')
            .split(',')
            .filter(Boolean)
            .map(Number);

          return jsonResponse({
            items: targetIds.map((targetId) => ({
              targetTypeCode: 'SERIAL_NUMBER',
              targetId,
              issueCount: 1,
              lastPrintOutcome: 'SUCCEEDED',
            })),
          });
        },
      },
    ];

    renderWithProviders(<SerialProbe />, { fetch: createStubFetch(routes) });

    expect(await screen.findByText('serial-1001 / summary-1001')).toBeInTheDocument();
    const serialPages = requests
      .filter((request) => pathOf(request) === '/trace/serial-numbers')
      .map((request) => Number(new URL(request.url).searchParams.get('page')));
    const summaryBatchSizes = requests
      .filter((request) => pathOf(request) === '/app/document-issues/summary')
      .map(
        (request) =>
          (new URL(request.url).searchParams.get('targetIds') ?? '').split(',').filter(Boolean)
            .length,
      );

    expect(serialPages).toEqual([1, 2]);
    expect(summaryBatchSizes).toEqual([1000, 1]);
  });

  it('LOT 라벨과 인식표 프린터를 문서 유형별로 따로 조회한다', async () => {
    const documentTypes: string[] = [];
    const routes: StubRoute[] = [
      {
        match: (request) => pathOf(request) === '/app/printers',
        respond: (request) => {
          documentTypes.push(new URL(request.url).searchParams.get('documentTypeCode') ?? '');
          return jsonResponse({ items: [] });
        },
      },
    ];

    renderWithProviders(<PrinterProbe />, { fetch: createStubFetch(routes) });

    await screen.findByText('ready');
    await waitFor(() => expect(documentTypes).toHaveLength(2));
    expect(documentTypes.sort()).toEqual(['IDENTIFICATION_TAG', 'PRODUCTION_LOT_LABEL']);
  });
});
