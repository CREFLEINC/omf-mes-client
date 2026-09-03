import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import {
  allocation,
  handlingUnitDetail,
  issueLog,
  printer,
  reissueReason,
  summary,
  shipment,
  SHIPMENT_ID,
  WORKER_NO,
} from './fixtures';
import { ShippingPackingLabelScreen } from './screen';

/**
 * 발행·인쇄 흐름 — **한 트랜잭션이 아니다.**
 *
 * 여기서 무는 것은 「무엇을 보내는가」와 「어디서 멈췄을 때 무엇이라 말하는가」다. 본문 조립과
 * 줄 변환은 `issue-request.test.ts`·`types.test.ts` 가 따로 문다 — 그쪽은 순수 함수라 화면을
 * 띄우지 않고 잰다.
 *
 * ⛔ **되돌릴 수 없는 쓰기가 걸린 화면이다.** 발행 취소 경로가 없어, 한 번 더 나간 요청은
 * 회차로 남아 지워지지 않는다. 그래서 「보냈는가」보다 **「안 보냈는가」를 더 많이 문다.**
 */

const ALLOCATION_PASSED = 9401;
/** 서버가 아는 대상은 LOT 이다 — 회차 조회와 발행이 이 값으로 나간다. */
const LOT_PASSED = 9801;
const ALLOCATION_WAITING = 9402;
const HANDLING_UNIT_ID = 9501;
const ISSUE_LOG_ID = 9601;

interface Sent {
  method: string;
  path: string;
  headers: Headers;
  body: unknown;
}

interface FlowOptions {
  /** 사번 없이 들어온다 — 진입 주소에 싣지 않는다. */
  withoutWorker?: boolean;
  /** 이 대상들은 이미 발행된 적이 있다 — 재출력 구획이 서는 조건이다. */
  issued?: Record<number, number>;
  /** 셸 인쇄 통로. 없으면 브라우저와 같은 상태다(오류가 아니라 「프린터가 없다」). */
  shellPrint?: (() => Promise<string>) | null;
  /** 진입 주소에 출하를 싣지 않는다 — 골라서 들어오는 화면임을 무는 갈래. */
  withoutShipment?: boolean;
}

const renderFlow = (options: FlowOptions = {}) => {
  const sent: Sent[] = [];
  const issued = options.issued ?? {};

  const record = async (request: Request): Promise<void> => {
    sent.push({
      method: request.method,
      path: new URL(request.url).pathname,
      headers: request.headers,
      body: request.body === null ? null : await request.clone().json(),
    });
  };

  if (options.shellPrint != null) {
    vi.stubGlobal('pop', { rendition: { save: options.shellPrint } });
  }

  const worker = options.withoutWorker === true ? '' : `&workerNo=${WORKER_NO}`;

  const result = renderWithProviders(<ShippingPackingLabelScreen />, {
    route:
      options.withoutShipment === true
        ? '/pop/shipping-label'
        : `/pop/shipping-label?shipmentId=${String(SHIPMENT_ID)}${worker}`,
    fetch: createStubFetch([
      {
        match: (request) => /\/logistics\/shipments\/\d+$/u.test(new URL(request.url).pathname),
        respond: () => jsonResponse(shipment()),
      },
      {
        match: (request) => new URL(request.url).pathname === '/logistics/shipment-lot-allocations',
        respond: () =>
          jsonResponse({
            items: [
              allocation(ALLOCATION_PASSED, 9801, 'SYN-LOT-0001', true, HANDLING_UNIT_ID),
              allocation(ALLOCATION_WAITING, 9802, 'SYN-LOT-0002', false, HANDLING_UNIT_ID),
            ],
            page: { page: 1, size: 20, total: 2 },
          }),
      },
      {
        match: (request) =>
          /\/inventory\/handling-units\/\d+$/u.test(new URL(request.url).pathname),
        respond: () => jsonResponse(handlingUnitDetail(HANDLING_UNIT_ID, 'SYN-HU-0001')),
      },
      {
        match: (request) => new URL(request.url).pathname === '/app/document-issues/summary',
        respond: (request) => {
          /*
           * 배열 질의는 반복 키로도 쉼표 묶음으로도 실려 올 수 있다 — 스텁이 한 모양만
           * 알면 직렬화 방식이 바뀌었을 때 **조회가 빈 채로 통과한다.**
           */
          const ids = new URL(request.url).searchParams
            .getAll('targetIds')
            .flatMap((value) => value.split(','))
            .map(Number);

          return jsonResponse({
            items: ids.map((id) => summary(id, issued[id] ?? 0, null)),
          });
        },
      },
      {
        match: (request) => new URL(request.url).pathname === '/app/printers',
        respond: () => jsonResponse({ items: [printer('SYN-PRN-01', true)] }),
      },
      {
        match: (request) => new URL(request.url).pathname === '/mdm/code-values',
        respond: () =>
          jsonResponse({
            items: [reissueReason('SYN_PRINT_FAILED', '인쇄 실패')],
            page: { page: 1, size: 20, total: 1 },
          }),
      },
      {
        match: (request) =>
          request.method === 'POST' && new URL(request.url).pathname === '/app/document-issues',
        respond: (request) => {
          void record(request);

          return jsonResponse({
            items: [issueLog(ISSUE_LOG_ID, ALLOCATION_PASSED, 'SYN-LOT-0001', 1)],
          });
        },
      },
      {
        match: (request) => new URL(request.url).pathname.endsWith('/rendition'),
        respond: () =>
          new Response(new Uint8Array([1, 2, 3]), {
            headers: { 'Content-Type': 'image/png' },
          }),
      },
      {
        match: (request) => new URL(request.url).pathname.endsWith(':report-print'),
        respond: (request) => {
          void record(request);

          return jsonResponse({ documentIssueLogId: ISSUE_LOG_ID, printOutcome: 'SUCCEEDED' });
        },
      },
    ]),
  });

  return { ...result, sent, user: userEvent.setup() };
};

const sentTo = (sent: Sent[], suffix: string): Sent | undefined =>
  sent.find((one) => one.path.endsWith(suffix));

beforeEach(() => {
  /* jsdom 에는 객체 주소가 없다. 미리보기가 그것을 쓰므로 자리만 채운다. */
  URL.createObjectURL = vi.fn(() => 'blob:syn-preview');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('진입', () => {
  it('출하 없이 들어오면 대상을 조회하지 않는다 — 남의 출하 라벨을 뽑게 된다', async () => {
    renderFlow({ withoutShipment: true });

    expect(await screen.findByText(/포장 실적 등록 화면에서/u)).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /포장라벨/u })).not.toBeInTheDocument();
  });

  it('라벨 종류를 고르기 전에는 대상이 서지 않는다', async () => {
    renderFlow();

    await screen.findByRole('radio', { name: /포장라벨/u });
    expect(screen.queryByText('SYN-LOT-0001')).not.toBeInTheDocument();
  });
});

describe('대상 고르기', () => {
  it('출하검사에 합격하지 않은 대상은 골라도 선택으로 남지 않는다', async () => {
    const { user } = renderFlow();

    await user.click(await screen.findByRole('radio', { name: /납품라벨/u }));
    await screen.findByText('SYN-LOT-0002');

    const boxes = screen.getAllByRole('checkbox');
    /* 첫 칸은 전체 선택이라 건너뛴다 — 줄 상자는 그 뒤에 온다. */
    const waitingRow = boxes[2];

    expect(waitingRow).toBeDefined();
    await user.click(waitingRow as HTMLElement);

    /*
     * ⛔ 고를 수 없는 대상이 선택으로 남으면 발행 본문에 실려 **전건 실패**가 된다 —
     * 「하나라도 실패하면 전건 실패」라 고를 수 있었던 대상까지 함께 못 나간다.
     */
    expect(await screen.findByText('발행할 대상을 고르세요.')).toBeInTheDocument();
  });
});

describe('발행 → 미리보기 → 인쇄', () => {
  it('발행은 인쇄를 부르지 않는다 — 기록과 종이는 따로 간다', async () => {
    const { user, sent } = renderFlow();

    await user.click(await screen.findByRole('radio', { name: /납품라벨/u }));
    await screen.findByText('SYN-LOT-0001');
    await user.click(screen.getAllByRole('checkbox')[1] as HTMLElement);
    await user.click(screen.getByRole('button', { name: '발행' }));

    await waitFor(() => {
      expect(sentTo(sent, '/app/document-issues')).toBeDefined();
    });

    expect(sentTo(sent, '/app/document-issues')?.body).toMatchObject({
      documentTypeCode: 'DELIVERY_LABEL',
      targets: [{ targetId: LOT_PASSED }],
    });
    /* ⛔ 인쇄 결과 보고가 여기서 나가면 「나오지 않은 라벨」이 나온 것으로 남는다. */
    expect(sentTo(sent, ':report-print')).toBeUndefined();
  });

  it('셸 통로가 없으면 인쇄 실패로 «보고»한다 — 모르는 것을 통과로 두지 않는다', async () => {
    const { user, sent } = renderFlow({ shellPrint: null });

    await user.click(await screen.findByRole('radio', { name: /납품라벨/u }));
    await screen.findByText('SYN-LOT-0001');
    await user.click(screen.getAllByRole('checkbox')[1] as HTMLElement);
    await user.click(screen.getByRole('button', { name: '발행' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '미리보기' })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: '미리보기' }));
    await user.click(await screen.findByRole('button', { name: '인쇄' }));

    await waitFor(() => {
      expect(sentTo(sent, ':report-print')).toBeDefined();
    });

    expect(sentTo(sent, ':report-print')?.body).toMatchObject({ outcome: 'FAILED' });
  });

  it('셸이 받으면 성공으로 보고한다', async () => {
    const save = vi.fn(async () => 'syn://printed');
    const { user, sent } = renderFlow({ shellPrint: save });

    await user.click(await screen.findByRole('radio', { name: /납품라벨/u }));
    await screen.findByText('SYN-LOT-0001');
    await user.click(screen.getAllByRole('checkbox')[1] as HTMLElement);
    await user.click(screen.getByRole('button', { name: '발행' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '미리보기' })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: '미리보기' }));
    await user.click(await screen.findByRole('button', { name: '인쇄' }));

    await waitFor(() => {
      expect(sentTo(sent, ':report-print')?.body).toMatchObject({ outcome: 'SUCCEEDED' });
    });

    expect(save).toHaveBeenCalledOnce();
  });
});

describe('재발행', () => {
  it('이미 발행된 대상을 고르면 사유를 받기 전까지 발행이 막힌다', async () => {
    const { user, sent } = renderFlow({ issued: { [LOT_PASSED]: 1 } });

    await user.click(await screen.findByRole('radio', { name: /납품라벨/u }));
    await screen.findByText('SYN-LOT-0001');
    await user.click(screen.getAllByRole('checkbox')[1] as HTMLElement);

    expect(await screen.findByText('재발행 사유를 고르면 발행할 수 있습니다.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '발행' }));

    /* ⛔ 사유 없이 나가면 DB 제약이 저장을 막는다 — 화면이 먼저 멈춰야 한다. */
    expect(sentTo(sent, '/app/document-issues')).toBeUndefined();
  });
});

describe('사번', () => {
  it('사번을 모르면 발행을 부르지 않는다 — 서버가 거부한다', async () => {
    const { user, sent } = renderFlow({ withoutWorker: true });

    await user.click(await screen.findByRole('radio', { name: /납품라벨/u }));
    await screen.findByText('SYN-LOT-0001');
    await user.click(screen.getAllByRole('checkbox')[1] as HTMLElement);
    await user.click(screen.getByRole('button', { name: '발행' }));

    expect(sentTo(sent, '/app/document-issues')).toBeUndefined();
    expect(screen.getByText('사번을 확인한 뒤에 발행할 수 있습니다.')).toBeInTheDocument();
  });
});
