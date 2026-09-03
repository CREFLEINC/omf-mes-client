import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PopIdentityProvider } from '../../patterns/pop-identity';
import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { PopLotLabelPrintScreen } from './screen';

const t = messages.popLotLabelPrint;
const pathOf = (request: Request) => new URL(request.url).pathname;

const routes = (requests: Request[], issueStatus = 201, hasPrinter = true): StubRoute[] => [
  {
    match: (request) => pathOf(request) === '/mdm/terminals/10/processes',
    respond: () => jsonResponse({ items: [{ processId: 20, canPrintLabel: true }] }),
  },
  {
    match: (request) => pathOf(request) === '/trace/lots',
    respond: (request) => {
      requests.push(request.clone());
      return jsonResponse({
        items: [{ lotId: 90101, lotNo: 'LOT-SAMPLE-0001' }],
        page: { page: 1, size: 20, total: 1 },
      });
    },
  },
  {
    match: (request) => pathOf(request) === '/trace/lots/90101',
    respond: () =>
      jsonResponse({
        lot: {
          lotId: 90101,
          lotNo: 'LOT-SAMPLE-0001',
          itemId: 101,
          progress: {
            goodQty: 480,
            achievementRate: 1,
            completionJudgmentCode: 'NORMAL',
          },
        },
      }),
  },
  {
    match: (request) => pathOf(request) === '/mdm/items/101',
    respond: () =>
      jsonResponse({
        item: { itemId: 101, itemCode: 'ITEM-SAMPLE-01', itemName: '합성 품목' },
      }),
  },
  {
    match: (request) => pathOf(request) === '/app/document-issues/summary',
    respond: () =>
      jsonResponse({
        items: [{ targetTypeCode: 'LOT', targetId: 90101, issueCount: 0 }],
      }),
  },
  {
    match: (request) => pathOf(request) === '/app/printers',
    respond: () =>
      jsonResponse({
        items: hasPrinter
          ? [
              {
                printerName: 'printer-a',
                displayName: '라벨 프린터',
                status: 'READY',
                statusMessage: '대기 중',
                isDefault: true,
              },
            ]
          : [],
      }),
  },
  {
    match: (request) => pathOf(request) === '/mdm/code-values',
    respond: () => jsonResponse({ items: [] }),
  },
  {
    match: (request) => request.method === 'POST' && pathOf(request) === '/app/document-issues',
    respond: (request) => {
      requests.push(request.clone());
      return issueStatus === 201
        ? jsonResponse(
            {
              items: [
                {
                  documentIssueLogId: 44001,
                  issueSeq: 1,
                  target: { displayName: 'LOT-SAMPLE-0001' },
                },
              ],
              issuedCount: 1,
            },
            { status: 201 },
          )
        : jsonResponse({ message: '발행 거부' }, { status: issueStatus });
    },
  },
  {
    match: (request) =>
      request.method === 'GET' && pathOf(request) === '/app/document-issues/44001/rendition',
    respond: (request) => {
      requests.push(request.clone());
      return new Response(new Uint8Array([1, 2, 3]));
    },
  },
  {
    match: (request) =>
      request.method === 'POST' && pathOf(request) === '/app/document-issues/44001:report-print',
    respond: (request) => {
      requests.push(request.clone());
      return new Response(null, { status: 204 });
    },
  },
];

const renderScreen = (requests: Request[], issueStatus = 201, hasPrinter = true) =>
  renderWithProviders(
    <PopIdentityProvider value={{ terminalId: 10, processId: 20, workerNo: 'W-SAMPLE-01' }}>
      <PopLotLabelPrintScreen />
    </PopIdentityProvider>,
    {
      route: '/pop/lot-label?workOrderId=701&workerNo=W-SAMPLE-01',
      fetch: createStubFetch(routes(requests, issueStatus, hasPrinter)),
    },
  );

describe('PopLotLabelPrintScreen', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'pop', {
      configurable: true,
      value: { rendition: { save: vi.fn().mockResolvedValue('/tmp/lot-label.png') } },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(window, 'pop');
  });

  it('완료된 생산 LOT을 서버 질의로 좁힌다', async () => {
    const requests: Request[] = [];
    renderScreen(requests);

    await screen.findByRole('button', { name: `LOT-SAMPLE-0001 ${t.lotList.select}` });
    const request = requests.find((item) => pathOf(item) === '/trace/lots');
    const url = new URL(request?.url ?? 'http://localhost');

    expect(url.searchParams.get('workOrderId')).toBe('701');
    expect(url.searchParams.get('lotTypeCode')).toBe('PRODUCTION');
    expect(url.searchParams.get('completed')).toBe('true');
  });

  it('발행 기록이 성공한 뒤 라벨을 인쇄하고 결과를 보고한다', async () => {
    const requests: Request[] = [];
    const user = userEvent.setup();
    renderScreen(requests);

    await user.click(
      await screen.findByRole('button', { name: `LOT-SAMPLE-0001 ${t.lotList.select}` }),
    );
    await user.click(await screen.findByRole('button', { name: t.action.print }));

    expect(await screen.findByText(t.print.succeeded)).toBeInTheDocument();
    const request = requests.find((item) => item.method === 'POST');
    expect(request?.headers.get('X-Worker-No')).toBe('W-SAMPLE-01');
    expect(await request?.json()).toMatchObject({
      documentTypeCode: 'PRODUCTION_LOT_LABEL',
      targets: [{ targetTypeCode: 'LOT', targetId: 90101, lotId: 90101 }],
    });
  });

  it('POP 셸이 없으면 출력 액션을 비활성화하고 발행 기록을 만들지 않는다', async () => {
    Reflect.deleteProperty(window, 'pop');
    const requests: Request[] = [];
    const user = userEvent.setup();
    renderScreen(requests);

    await user.click(
      await screen.findByRole('button', { name: `LOT-SAMPLE-0001 ${t.lotList.select}` }),
    );
    const print = await screen.findByRole('button', { name: t.action.print });

    expect(print).toBeDisabled();
    expect(screen.getByText(t.action.blocked.shellUnavailable)).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'POST')).toBe(false);
  });

  it('프린터 목록이 비면 오류가 아닌 없음 상태로 보이고 발행을 막는다', async () => {
    const requests: Request[] = [];
    const user = userEvent.setup();
    renderScreen(requests, 201, false);

    expect(await screen.findByText(t.printer.none)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: `LOT-SAMPLE-0001 ${t.lotList.select}` }));

    expect(await screen.findByRole('button', { name: t.action.print })).toBeDisabled();
    expect(screen.getByText(t.action.blocked.noPrinter)).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'POST')).toBe(false);
  });

  it('발행 기록이 실패하면 인쇄 성공으로 넘어가지 않는다', async () => {
    const requests: Request[] = [];
    const user = userEvent.setup();
    renderScreen(requests, 403);

    await user.click(
      await screen.findByRole('button', { name: `LOT-SAMPLE-0001 ${t.lotList.select}` }),
    );
    await user.click(await screen.findByRole('button', { name: t.action.print }));

    expect(await screen.findByText(t.action.issueFailed)).toBeInTheDocument();
    expect(screen.getByText('발행 거부')).toBeInTheDocument();
    expect(screen.queryByText(t.print.succeeded)).toBeNull();
    expect(requests.some((request) => pathOf(request).endsWith('/rendition'))).toBe(false);
    expect(requests.some((request) => pathOf(request).endsWith(':report-print'))).toBe(false);
  });
});
