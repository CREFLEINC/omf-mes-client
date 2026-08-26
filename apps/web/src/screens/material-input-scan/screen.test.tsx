import { messages } from '@omf-mes/i18n';
import { act, screen, waitFor, within } from '@testing-library/react';
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

/**
 * 대기 중인 되먹임을 화면에 앉힌다.
 *
 * **음성 단언에는 시점이 필요하다.** 「없다」를 렌더 직후에 재면 아직 아무것도 도착하지
 * 않은 화면에서 언제나 통과한다 — 뒤늦게 도착하는 실패를 그대로 통과시킨다.
 */
const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
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
    /*
     * ⚠ **요청이 0회인 것만으로는 부족하다.** 조회를 막는 겹이 둘인데(`enabled`와 queryFn의
     * 가드) 앞의 겹이 사라져도 뒤의 겹이 던져 요청은 여전히 0회다 — 대신 그 예외가 **빨간
     * 조회 실패 배너**가 되어, 「무엇을 볼지 정하지 않았다」 자리에 「불러오지 못했다」가 함께 선다.
     */
    await flush();
    expect(screen.queryByText(messages.httpError.loadTitle)).toBeNull();
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
    await flush();
    expect(screen.queryByText(messages.httpError.loadTitle)).toBeNull();
  });
});

describe('MaterialInputScanScreen — 상세를 기다리는 동안', () => {
  /*
   * ⭐ **최종 상태만 재는 감지기가 놓치는 자리다.**
   *
   * 전표 목록은 도착했는데 그 전표의 상세가 아직 오지 않은 찰나 — 이때 「불러오는 중」이
   * 아니라 「수령 내역이 없습니다」를 내면, 그 빈 상태는 `live` 영역이라 **스크린리더가
   * 소리 내어 읽는다.** 작업자는 받은 자재를 못 받은 것으로 듣는다.
   *
   * 목록만 즉시 답하고 상세는 붙잡아 두어 그 찰나를 실제로 만든다.
   */
  it('목록만 도착한 찰나에 「없습니다」를 내지 않는다', async () => {
    let releaseDetail = (): void => undefined;
    const detailHeld = new Promise<void>((resolve) => {
      releaseDetail = resolve;
    });

    /*
     * 규칙 목록(`createStubFetch`)은 즉시 답하므로 이 찰나를 만들 수 없다 — 상세만
     * 붙잡아 두는 fetch를 직접 짠다.
     */
    const requests: RecordedRequest[] = [];
    const fetch: StubFetch = async (request) => {
      requests.push({ method: request.method, url: new URL(request.url) });

      if (isGet(request, LIST_PATH)) {
        return jsonResponse({ items: [receipt()], page: { page: 1, size: 50, total: 1 } });
      }

      await detailHeld;

      return jsonResponse({ shopfloorReceipt: receipt(), lines: receiptLineFixtures });
    };

    renderWithProviders(<MaterialInputScanScreen />, { fetch, route: ROUTE });

    /*
     * **목록이 도착한 뒤에 재야 한다.** 렌더 직후에 재면 아직 목록조차 오지 않은 상태를
     * 재는 것이라, 빈 상태가 그 뒤에 스쳐도 통과한다.
     */
    await waitFor(() => {
      expect(requests.some((request) => request.url.pathname === detailPath(7001))).toBe(true);
    });
    await flush();

    // 상세가 붙잡혀 있는 동안 화면이 무엇을 말하는지 잰다.
    expect(screen.getByRole('status', { name: t.loading.receipt })).toBeTruthy();
    expect(screen.queryByText(t.empty.receiptTitle)).toBeNull();

    releaseDetail();

    // 붙잡은 것을 놓으면 실제로 줄이 선다 — 위 단언이 「영영 로딩」을 통과시키지 않게 한다.
    await waitFor(() => {
      expect(bodyRows()).toHaveLength(receiptLineFixtures.length);
    });
  });
});
