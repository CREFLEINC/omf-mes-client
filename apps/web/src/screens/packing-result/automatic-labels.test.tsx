import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { summary } from '../shipping-packing-label/fixtures';

import { AutomaticLabels, type AutomaticLabelRun } from './automatic-labels';

const t = messages.packingResult.automaticLabels;

/*
 * 현행 배분 응답은 목표 선택 필드 `shippingInspectionStatusCode`를 생략한다.
 * 이 흐름은 서버가 준 `oqcPassed`만 발행 조건으로 사용한다.
 */
const allocation = (id: number, oqcPassed: boolean) => ({
  shipmentLotAllocationId: id,
  shipmentId: 501,
  shipmentLineId: 701,
  itemId: 801,
  itemCode: 'SYN-FG-01',
  lotId: 901 + id,
  lotNo: `SYN-LOT-${String(id)}`,
  warehouseId: 1001,
  allocatedQty: 10,
  uomId: 2001,
  oqcPassed,
  packedQty: 10,
});

const run: AutomaticLabelRun = {
  handlingUnit: { handlingUnitId: 4001, handlingUnitNo: 'SYN-CTN-4001', etag: '"1"' },
  allocations: [allocation(9001, true), allocation(9002, false)],
};

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:syn-label');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AutomaticLabels', () => {
  /*
   * 포장 라벨 렌더링은 이 배포 흐름에서 아직 막혀 있다. 따라서 포장 라벨 발행 뒤
   * 실패 상태가 되고, 뒤따르는 납품 라벨 발행 단계에는 도달하지 않는다.
   */
  it('포장 라벨 그림을 받지 못하면 이어지는 납품 라벨 발행에 진입하지 않는다', async () => {
    const issued: string[] = [];
    const save = vi.fn(async () => 'syn://printed');
    Object.defineProperty(window, 'pop', {
      configurable: true,
      value: { rendition: { save } },
    });

    renderWithProviders(
      <AutomaticLabels run={run} workerNo="SYN-W-01" onOpenManagement={() => undefined} />,
      {
        fetch: createStubFetch([
          {
            match: (request) => new URL(request.url).pathname === '/app/document-issues/summary',
            respond: (request) => {
              const ids = new URL(request.url).searchParams
                .getAll('targetIds')
                .flatMap((value) => value.split(','))
                .map(Number);

              return jsonResponse({ items: ids.map((id) => summary(id, 0)) });
            },
          },
          {
            match: (request) =>
              request.method === 'GET' && new URL(request.url).pathname === '/app/printers',
            respond: () =>
              jsonResponse({
                items: [
                  {
                    printerName: 'SYN-PRN-01',
                    displayName: '합성 프린터',
                    status: 'READY',
                    isDefault: true,
                  },
                ],
                page: { page: 1, size: 20, total: 1 },
              }),
          },
          {
            match: (request) =>
              request.method === 'POST' && new URL(request.url).pathname === '/app/document-issues',
            respond: (request) => {
              void request
                .clone()
                .json()
                .then((body: { documentTypeCode: string }) => {
                  issued.push(body.documentTypeCode);
                });

              return jsonResponse(
                {
                  items: [
                    {
                      documentIssueLogId: 1,
                      documentTypeCode: 'PACKING_LABEL',
                      target: {
                        targetId: 4001,
                        targetTypeCode: 'HANDLING_UNIT',
                        displayName: '합성 대상',
                      },
                      issueSeq: 1,
                      issuedAt: '2026-09-09T03:00:00+09:00',
                      printOutcome: 'PENDING',
                    },
                  ],
                },
                { status: 201 },
              );
            },
          },
          {
            /*
             * 포장 라벨은 배포 렌더링을 요청하기 전에 멈춘다. 납품 라벨용 렌더링
             * 스텁은 그 후속 단계가 이 시험에서 실행되지 않음을 확인한다.
             */
            match: (request) => new URL(request.url).pathname.endsWith('/rendition'),
            respond: () => new Response(new Uint8Array([1, 2, 3])),
          },
          {
            match: (request) => new URL(request.url).pathname.endsWith(':report-print'),
            respond: () => jsonResponse({ printOutcome: 'SUCCEEDED' }),
          },
        ]),
      },
    );

    /* 발행 기록은 남는다 — 막힌 것은 그 뒤의 그림 취득뿐이다. */
    expect(await screen.findByText(t.packingFailure(t.failures.render))).toBeInTheDocument();

    await waitFor(() => {
      expect(issued).toEqual(['PACKING_LABEL']);
    });
    /* 앞 단계 포장 라벨 실패로 납품 라벨 후속 발행에는 도달하지 않는다. */
    expect(issued).not.toContain('DELIVERY_LABEL');
    /* ⛔ 그림을 받지 못했으니 셸까지 넘어가지 않는다. */
    expect(save).not.toHaveBeenCalled();
  });

  it('발행 실패는 포장을 다시 만들지 않고 실패한 라벨 발행만 재시도한다', async () => {
    const user = userEvent.setup();
    let attempts = 0;

    renderWithProviders(
      <AutomaticLabels
        run={{ ...run, allocations: [] }}
        workerNo="SYN-W-01"
        onOpenManagement={() => undefined}
      />,
      {
        fetch: createStubFetch([
          {
            match: (request) => new URL(request.url).pathname === '/app/document-issues/summary',
            respond: (request) => {
              const ids = new URL(request.url).searchParams
                .getAll('targetIds')
                .flatMap((value) => value.split(','))
                .map(Number);

              return jsonResponse({ items: ids.map((id) => summary(id, 0)) });
            },
          },
          {
            match: (request) => new URL(request.url).pathname === '/app/printers',
            respond: () => jsonResponse({ items: [], page: { page: 1, size: 20, total: 0 } }),
          },
          {
            match: (request) =>
              request.method === 'POST' && new URL(request.url).pathname === '/app/document-issues',
            respond: () => {
              attempts += 1;

              return attempts === 1
                ? jsonResponse({ message: '합성 실패' }, { status: 500 })
                : jsonResponse(
                    {
                      items: [
                        {
                          documentIssueLogId: 11,
                          documentTypeCode: 'PACKING_LABEL',
                          target: {
                            targetTypeCode: 'HANDLING_UNIT',
                            targetId: 4001,
                            displayName: 'SYN-CTN-4001',
                          },
                          issueSeq: 1,
                          issuedAt: '2026-09-09T03:00:00+09:00',
                          printOutcome: 'PENDING',
                        },
                      ],
                    },
                    { status: 201 },
                  );
            },
          },
          {
            match: (request) => new URL(request.url).pathname.endsWith('/rendition'),
            respond: () => new Response(new Uint8Array([1, 2, 3])),
          },
          {
            match: (request) => new URL(request.url).pathname.endsWith(':report-print'),
            respond: () => jsonResponse({ printOutcome: 'FAILED' }),
          },
        ]),
      },
    );

    expect(await screen.findByText(/발행 기록을 만들지 못했습니다/u)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.retryPackingIssue }));

    await waitFor(() => {
      expect(attempts).toBe(2);
    });
    expect(document.body.textContent).not.toContain('포장을 다시');
  });

  it.each(['PENDING', 'FAILED'] as const)(
    '기발행 포장 라벨의 최근 인쇄가 %s이면 완료로 보지 않고 재출력 흐름으로 보낸다',
    async (outcome) => {
      const issued: Request[] = [];

      renderWithProviders(
        <AutomaticLabels run={run} workerNo="SYN-W-01" onOpenManagement={() => undefined} />,
        {
          fetch: createStubFetch([
            {
              match: (request) => new URL(request.url).pathname === '/app/document-issues/summary',
              respond: (request) => {
                const url = new URL(request.url);
                const ids = url.searchParams
                  .getAll('targetIds')
                  .flatMap((value) => value.split(','))
                  .map(Number);
                const kind = url.searchParams.get('documentTypeCode');

                return jsonResponse({
                  items: ids.map((id) =>
                    kind === 'PACKING_LABEL'
                      ? summary(id, 1, '2026-09-09T03:00:00+09:00', outcome)
                      : summary(id, 0),
                  ),
                });
              },
            },
            {
              match: (request) => new URL(request.url).pathname === '/app/printers',
              respond: () => jsonResponse({ items: [], page: { page: 1, size: 20, total: 0 } }),
            },
            {
              match: (request) =>
                request.method === 'POST' &&
                new URL(request.url).pathname === '/app/document-issues',
              respond: (request) => {
                issued.push(request.clone());

                return jsonResponse({ items: [] }, { status: 201 });
              },
            },
          ]),
        },
      );

      expect(await screen.findByText(t.reissueRequired(1))).toBeInTheDocument();
      expect(screen.queryByText(t.complete)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: t.openReissue })).toBeEnabled();
      expect(issued).toHaveLength(0);
    },
  );
});
