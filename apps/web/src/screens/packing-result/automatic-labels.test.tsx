import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { summary } from '../shipping-packing-label/fixtures';

import { AutomaticLabels, type AutomaticLabelRun } from './automatic-labels';

const t = messages.packingResult.automaticLabels;

/*
 * ⛔ `shipmentRequestNo`·`customerName`·`shippingInspectionStatusCode` 를 더는 싣지 않는다 —
 * 셋 다 계약에서 빠졌다(2026-09-11 전달본). 이 시험은 애초에 그 값을 읽지도 않았다.
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
   * ⚠ **동작이 바뀌었다.** 이 시험은 원래 「포장 라벨 뒤 OQC 통과 납품 라벨도 함께 낸다」였다.
   *
   * ① `shipping-packing-label/codes.ts` 의 `DELIVERY_LABEL_ISSUE_LOCKED` 가 서버 결정
   *    (대응표 P1 「공용 문서 발행」· I-27 마감 결정 — `DELIVERY_LABEL` 은 항상 422
   *    `INVALID`)을 반영해 참으로 잠긴 뒤, 자동 출력도 `deliveryRows` 를 비워 납품 라벨
   *    발행 자체를 시도하지 않는다(`automatic-labels.tsx`). `POST /app/document-issues`
   *    는 포장 라벨 한 번만 나가는 것이 이제 맞는 동작이다.
   *
   * ② **포장 라벨도 인쇄까지 이어지지 않는다** — 이건 ①과 별개로, `GET
   *    /app/document-issues/{id}/rendition` 경로 자체가 서버에 없다(대응표 P1 「미구현
   *    5건」· `patterns/pop-label-rendition` 머리말). 그림을 받는 걸음이 셸을 보기도
   *    전에 막혀 `shipping-packing-label/issue-flow.test.tsx` 의 같은 시험들과 같은
   *    사유로 멈춘다 — Electron 인쇄 통로(`window.pop.rendition.save`)는 아예 불리지
   *    않는다. 그래서 이 시험은 «발행 요청이 무엇을 실었는가»와 «셸을 부르지 않았는가»만
   *    잰다.
   */
  it('납품 라벨은 발행 자체를 시도하지 않는다 — 포장 라벨도 그림을 받지 못해 인쇄로 가지 못한다', async () => {
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
             * ⛔ **닿을 일이 없다.** 그림을 받는 걸음이 `client.GET` 을 아예 부르지 않고
             * `LabelRenditionNotReadyError` 로 곧바로 거부한다(`shipping-packing-label/
             * mutations.ts` 의 `fetchRendition`). 스텁은 그대로 두어, 서버가 이 경로를
             * 구현해 되돌릴 때 이 목도 다시 살아나게 한다.
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
    /* ⛔ 납품 라벨은 절대 요청되지 않는다 — 잠긴 문서 유형을 서버에 묻지 않는다. */
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
