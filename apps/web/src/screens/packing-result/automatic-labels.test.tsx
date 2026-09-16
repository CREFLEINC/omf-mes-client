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
  shipmentNo: 'SH-20260916-0003',
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
   * ⭐ **포장 라벨은 POP 이 스스로 그린다**(SHIP-UNIT-01 P2).
   *
   * 그전에는 서버 렌디션을 받으려 했는데 `PACKING_LABEL` 이 준비 목록에 없어 **배포본에서
   * 요청이 만들어지기도 전에 막혔다** — 셸 저장과 인쇄 결과 보고까지 한 번도 닿지 못했고,
   * 발행 기록만 `PENDING` 으로 쌓였다. 이 시험은 그때의 동작을 「막혀 있다」로 못박고
   * 있었는데, 그것이 고쳐야 할 결함이었다.
   *
   * ⛔ **`/rendition` 을 부르지 않는 것이 이 시험의 핵심이다.** 다시 부르기 시작하면 배포본에서
   *    또 같은 자리에 걸린다.
   */
  it('포장 라벨을 POP 이 그려 셸까지 보내고, 그 뒤 납품 라벨로 이어진다', async () => {
    const issued: string[] = [];
    /*
     * ⚠ **경로로는 두 종류를 못 가른다** — 스텁이 둘에 같은 발행 번호를 준다. 그래서 «순서»로
     *   묻는다: 포장 라벨이 셸로 나가는 것이 **어떤 렌디션 요청보다 먼저**여야 한다.
     */
    const events: string[] = [];
    const save = vi.fn(async () => {
      events.push('save');

      return 'syn://printed';
    });
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
            /* 단위 코드 — 포장 라벨의 수량 줄이 쓴다. */
            match: (request) => new URL(request.url).pathname === '/mdm/uoms',
            respond: () =>
              jsonResponse({
                items: [{ uomId: 9301, uomCode: 'EA', uomName: '개', decimalScale: 0 }],
                page: { page: 1, size: 200, total: 1 },
              }),
          },
          {
            /* ⛔ 포장 라벨은 이 경로로 오면 «안 된다» — 왔는지를 기록해 아래에서 단언한다. */
            match: (request) => new URL(request.url).pathname.endsWith('/rendition'),
            respond: () => {
              events.push('rendition');

              return new Response(new Uint8Array([1, 2, 3]));
            },
          },
          {
            match: (request) => new URL(request.url).pathname.endsWith(':report-print'),
            respond: () => jsonResponse({ printOutcome: 'SUCCEEDED' }),
          },
        ]),
      },
    );

    /* ⭐ 종이까지 갔다 — 그전에는 여기 한 번도 닿지 못했다. */
    await waitFor(() => {
      expect(save).toHaveBeenCalled();
    });

    /* POP 이 그린 것은 언제나 그림이다 — 명령형(TSPL)은 win32 의 RAW 자리로만 나간다. */
    const [bytes, , , format] = save.mock.calls[0] as unknown as [
      Uint8Array,
      string,
      string,
      string,
    ];
    expect(format).toBe('png');
    /* PNG 머리 여덟 바이트 — 「무언가 보냈다」가 아니라 그림을 보냈는지를 묻는다. */
    expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    /*
     * ⛔⛔ **포장 라벨이 서버 렌디션보다 먼저 종이로 나갔다.** 포장 라벨이 그 경로를 다시
     *    타기 시작하면 배포본에서 또 준비 목록에 걸려 종이가 안 나온다.
     */
    expect(events[0]).toBe('save');

    /* 포장 라벨이 끝났으니 납품 라벨로 이어진다. */
    await waitFor(() => {
      expect(issued).toContain('DELIVERY_LABEL');
    });
    expect(issued[0]).toBe('PACKING_LABEL');
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
