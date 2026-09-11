import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LABEL_RENDITION_NOT_READY_REASON } from '../../patterns/pop-label-rendition';
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
/** 납품 라벨 발행과 회차 조회는 출하 LOT 배분 식별자로 나간다. */
const DELIVERY_TARGET_PASSED = ALLOCATION_PASSED;
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
        respond: (request) => {
          /*
           * ⛔⛔ **서버에 이 경로가 없다**(대응표 P1 「미구현 5건」). 제품 코드가 부르면 안
           * 된다 — 그래도 응답을 준비해 두는 것은, 회귀로 다시 부르게 되면 이 200 이 조용히
           * 성공 경로를 열어 아래 시험들의 「부르지 않는다」 단언이 실패로 드러나게 하려는
           * 것이다.
           */
          void record(request);

          return new Response(new Uint8Array([1, 2, 3]), {
            headers: { 'Content-Type': 'image/png' },
          });
        },
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

    expect(
      await screen.findByText(messages.shippingPackingLabel.shipment.missing),
    ).toBeInTheDocument();
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
  /*
   * ⛔⛔ **여기서부터는 포장라벨로 부른다.** `DELIVERY_LABEL`(납품라벨) 발행은 서버가 항상
   * 422 `INVALID` 로 거부하고, 대상 유형 `SHIPMENT_LOT_ALLOCATION` 도 계약 enum에서 아예
   * 빠졌다(대응표 P1 「공용 문서 발행」· I-27 마감 결정 · `codes.ts` 의
   * `DELIVERY_LABEL_ISSUE_LOCKED`) — 그래서 발행(«쓰기»)까지 실제로 이어가는 시험은 계약이
   * 살아 있는 포장라벨로 진행한다. 종류 선택 자체(«대상 고르기» 위 describe)는 납품라벨로도
   * 여전히 살아 있다 — 막힌 자리는 발행 단추뿐이다.
   */
  it('발행은 인쇄를 부르지 않는다 — 기록과 종이는 따로 간다', async () => {
    const { user, sent } = renderFlow();

    await user.click(await screen.findByRole('radio', { name: /포장라벨/u }));
    await screen.findByText('SYN-HU-0001');
    await user.click(screen.getAllByRole('checkbox')[1] as HTMLElement);
    await user.click(
      screen.getByRole('button', { name: messages.shippingPackingLabel.actions.issue }),
    );

    await waitFor(() => {
      expect(sentTo(sent, '/app/document-issues')).toBeDefined();
    });

    expect(sentTo(sent, '/app/document-issues')?.body).toMatchObject({
      documentTypeCode: 'PACKING_LABEL',
      targets: [{ targetId: HANDLING_UNIT_ID }],
    });
    /* ⛔ 인쇄 결과 보고가 여기서 나가면 「나오지 않은 라벨」이 나온 것으로 남는다. */
    expect(sentTo(sent, ':report-print')).toBeUndefined();
  });

  /*
   * ⛔⛔ **서버에 `GET /app/document-issues/{id}/rendition` 경로가 없다**(`patterns/
   * pop-label-rendition` 머리말 · 대응표 P1 「미구현 5건」). 원래 이 시험은 셸이 없을 때
   * 인쇄 «시도»가 실패로 보고되는 것을 쟀다 — 이제는 그림을 받는 걸음이 셸을 보기도 «전»에
   * 막혀 있어 미리보기 단추 자체가 켜지지 않고(`issue.labels` 가 결코 채워지지 않는다),
   * 인쇄 결과 보고까지도 가지 않는다. 셸 유무와 무관하게 같은 사유로 멈추고, 그 사유가
   * 「준비 중」임이 동적 문구(`failureReason`)로 드러나는지를 잰다.
   */
  it('그림을 받지 못하면 미리보기·인쇄로 가지 못한다 — 셸이 없어도 같은 이유다', async () => {
    const { user, sent } = renderFlow({ shellPrint: null });

    await user.click(await screen.findByRole('radio', { name: /포장라벨/u }));
    await screen.findByText('SYN-HU-0001');
    await user.click(screen.getAllByRole('checkbox')[1] as HTMLElement);
    await user.click(
      screen.getByRole('button', { name: messages.shippingPackingLabel.actions.issue }),
    );

    expect(
      await screen.findByText(messages.shippingPackingLabel.outcome.renderFailed),
    ).toBeInTheDocument();
    expect(await screen.findByText(LABEL_RENDITION_NOT_READY_REASON)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '미리보기' })).toBeDisabled();
    expect(sentTo(sent, ':report-print')).toBeUndefined();
  });

  /*
   * ⛔⛔ **서버에 이 경로가 없다**(위와 같음). 셸이 있어도 `render` 걸음에서 이미 막혀 셸까지
   * 넘어가지 않는다 — 「셸이 있어도 소용없다」는 사실 자체를 잰다.
   */
  it('셸이 있어도 그림을 받지 못해 셸을 부르지 않는다', async () => {
    const save = vi.fn(async () => 'syn://printed');
    const { user, sent } = renderFlow({ shellPrint: save });

    await user.click(await screen.findByRole('radio', { name: /포장라벨/u }));
    await screen.findByText('SYN-HU-0001');
    await user.click(screen.getAllByRole('checkbox')[1] as HTMLElement);
    await user.click(
      screen.getByRole('button', { name: messages.shippingPackingLabel.actions.issue }),
    );

    expect(
      await screen.findByText(messages.shippingPackingLabel.outcome.renderFailed),
    ).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
    expect(sentTo(sent, ':report-print')).toBeUndefined();
  });

  /*
   * ⭐ **`DELIVERY_LABEL` 은 발행 단추 자리에서 막힌다.** 종류는 고를 수 있지만(대상 고르기는
   * 계약과 무관하다) 발행을 누르면 요청 자체가 나가지 않는다 — «잠겼다»가 눈에 보이는
   * 자리를 하나는 남겨 둔다.
   */
  it('납품라벨은 종류를 고르고 대상을 선택해도 발행 요청을 보내지 않는다', async () => {
    const { user, sent } = renderFlow();

    await user.click(await screen.findByRole('radio', { name: /납품라벨/u }));
    await screen.findByText('SYN-LOT-0001');
    await user.click(screen.getAllByRole('checkbox')[1] as HTMLElement);
    await user.click(
      screen.getByRole('button', { name: messages.shippingPackingLabel.actions.issue }),
    );

    expect(sentTo(sent, '/app/document-issues')).toBeUndefined();
  });
});

describe('재발행', () => {
  it('이미 발행된 대상을 고르면 사유를 받기 전까지 발행이 막힌다', async () => {
    const { user, sent } = renderFlow({ issued: { [DELIVERY_TARGET_PASSED]: 1 } });

    await user.click(await screen.findByRole('radio', { name: /납품라벨/u }));
    await screen.findByText('SYN-LOT-0001');
    await user.click(screen.getAllByRole('checkbox')[1] as HTMLElement);

    expect(await screen.findByText('재발행 사유를 고르면 발행할 수 있습니다.')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: messages.shippingPackingLabel.actions.issue }),
    );

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
    await user.click(
      screen.getByRole('button', { name: messages.shippingPackingLabel.actions.issue }),
    );

    expect(sentTo(sent, '/app/document-issues')).toBeUndefined();
    expect(screen.getByText('사번을 확인한 뒤에 발행할 수 있습니다.')).toBeInTheDocument();
  });
});
