import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { receipt, receiptLineFixtures, WORK_ORDER_ID } from './fixtures';
import { MaterialInputScanScreen } from './screen';

const t = messages.materialInputScan;

const ROUTE = `/pop/material-input?workOrderId=${String(WORK_ORDER_ID)}`;
const LIST_PATH = '/logistics/shopfloor-receipts';
const detailPath = (receiptId: number): string => `${LIST_PATH}/${String(receiptId)}`;

interface RecordedRequest {
  method: string;
  url: URL;
}

const createRecordingFetch = (
  routes: StubRoute[],
): { fetch: StubFetch; requests: RecordedRequest[] } => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch(routes);

  const fetch: StubFetch = async (request) => {
    requests.push({ method: request.method, url: new URL(request.url) });

    return stub(request);
  };

  return { fetch, requests };
};

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const listRoute = (items: unknown[] = [receipt()]): StubRoute => ({
  match: (request) => isGet(request, LIST_PATH),
  respond: () => jsonResponse({ items, page: { page: 1, size: 50, total: items.length } }),
});

const detailRoute = (receiptId: number, lines: unknown[], init: ResponseInit = {}): StubRoute => ({
  match: (request) => isGet(request, detailPath(receiptId)),
  respond: () =>
    jsonResponse(
      init.status === undefined
        ? { shopfloorReceipt: receipt({ shopfloorReceiptId: receiptId }), lines }
        : { errors: [{ scope: 'screen', code: 'SAMPLE_FAIL', message: '합성 실패' }] },
      init,
    ),
});

const renderScreen = (routes: StubRoute[], route = ROUTE) => {
  const { fetch, requests } = createRecordingFetch(routes);
  const result = renderWithProviders(<MaterialInputScanScreen />, { fetch, route });

  return { ...result, requests };
};

/** 표의 몸통 — 빈 상태 슬롯과 데이터 줄을 같은 잣대로 재지 않도록 행 조회를 한 곳에 모은다. */
const bodyRows = (): HTMLElement[] => screen.getAllByRole('row').slice(1);

describe('MaterialInputScanScreen — 계획 대비 수령', () => {
  it('작업지시가 실린 주소면 전표 목록과 상세를 부른다', async () => {
    const { requests } = renderScreen([listRoute(), detailRoute(7001, receiptLineFixtures)]);

    await waitFor(() => {
      expect(bodyRows()).toHaveLength(receiptLineFixtures.length);
    });

    const listRequest = requests.find((request) => request.url.pathname === LIST_PATH);
    expect(listRequest?.url.searchParams.get('workOrderId')).toBe(String(WORK_ORDER_ID));
    expect(requests.some((request) => request.url.pathname === detailPath(7001))).toBe(true);
  });

  it('수령 상태 세 갈래를 각 줄에 그린다', async () => {
    renderScreen([listRoute(), detailRoute(7001, receiptLineFixtures)]);

    await waitFor(() => {
      expect(bodyRows()).toHaveLength(3);
    });

    const rows = bodyRows();
    expect(within(rows[0] as HTMLElement).getByText(t.receiptStatus.matched)).toBeTruthy();
    expect(within(rows[1] as HTMLElement).getByText(t.receiptStatus.short)).toBeTruthy();
    expect(within(rows[2] as HTMLElement).getByText(t.receiptStatus.none)).toBeTruthy();
  });

  /* 부족·미수령이 투입을 막지 않는다는 사실을 화면이 말하지 않으면 작업자가 그 자리에서 멈춘다. */
  it('부족·미수령이 있어도 투입할 수 있다는 안내를 함께 낸다', async () => {
    renderScreen([listRoute(), detailRoute(7001, receiptLineFixtures)]);

    expect(await screen.findByText(t.notes.shortAllowed)).toBeTruthy();
  });

  it('전표가 여럿이면 상세를 각각 불러 줄을 모은다', async () => {
    renderScreen([
      listRoute([receipt(), receipt({ shopfloorReceiptId: 7002 })]),
      detailRoute(7001, [receiptLineFixtures[0]]),
      detailRoute(7002, [receiptLineFixtures[1]]),
    ]);

    await waitFor(() => {
      expect(bodyRows()).toHaveLength(2);
    });
  });

  /*
   * ⭐ 이 화면의 핵심 감지기다.
   *
   * 전표 둘 중 하나의 상세가 실패했는데 성공한 쪽만 그리면 화면은 「이게 전부」라고 말하게
   * 된다 — 작업자는 받은 자재를 못 받은 것으로 읽고 결품 처리를 시작한다.
   */
  it('전표 상세가 하나라도 실패하면 남은 줄을 성공으로 그리지 않는다', async () => {
    renderScreen([
      listRoute([receipt(), receipt({ shopfloorReceiptId: 7002 })]),
      detailRoute(7001, [receiptLineFixtures[0]]),
      detailRoute(7002, [], { status: 500 }),
    ]);

    expect(await screen.findByText(messages.httpError.loadTitle)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('목록 조회가 실패하면 실패 배너를 낸다', async () => {
    renderScreen([
      {
        match: (request) => isGet(request, LIST_PATH),
        respond: () =>
          jsonResponse(
            { errors: [{ scope: 'screen', code: 'X', message: '합성 실패' }] },
            { status: 500 },
          ),
      },
    ]);

    expect(await screen.findByText(messages.httpError.loadTitle)).toBeTruthy();
  });

  it('수령 내역이 없으면 빈 상태를 낸다 — 실패와 다른 말을 한다', async () => {
    renderScreen([listRoute([])]);

    expect(await screen.findByText(t.empty.receiptTitle)).toBeTruthy();
    expect(screen.queryByText(messages.httpError.loadTitle)).toBeNull();
  });
});

describe('MaterialInputScanScreen — 작업지시가 없을 때', () => {
  /*
   * 작업지시 없이 조회가 나가면 서버가 거절할 요청을 화면이 한 번 더 만든다. 그보다 나쁜 것은
   * 그 응답을 「수령 내역 없음」으로 그리는 것이다 — 무엇을 투입하는 화면인지 모르는 채로 선다.
   */
  it('조회를 부르지 않는다', async () => {
    const { requests } = renderScreen([listRoute()], '/pop/material-input');

    expect(await screen.findByText(t.header.workOrderMissing)).toBeTruthy();
    expect(requests).toHaveLength(0);
  });

  it('작업지시 표시를 세우지 않는다', async () => {
    renderScreen([listRoute()], '/pop/material-input');

    await screen.findByText(t.header.workOrderMissing);
    expect(screen.queryByText(t.header.workOrder(WORK_ORDER_ID))).toBeNull();
  });

  it('있을 수 없는 값이 실려 있어도 조회하지 않는다', async () => {
    const { requests } = renderScreen([listRoute()], '/pop/material-input?workOrderId=0');

    expect(await screen.findByText(t.header.workOrderMissing)).toBeTruthy();
    expect(requests).toHaveLength(0);
  });
});
