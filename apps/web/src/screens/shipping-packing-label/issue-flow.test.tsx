import { messages } from '@omf-mes/i18n';
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
  shippingUnit,
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
const ALLOCATION_WAITING = 9402;
/**
 * 납품 라벨 발행과 회차 조회는 **출하 단위** 식별자로 나간다(SHIP-UNIT-01).
 *
 * ⛔ 종전에는 배분이었다 — 서버가 그 대상 유형을 422 INVALID 로 막았다(전달본 v4).
 */
const CLOSED_UNIT_ID = 7001;
const OPEN_UNIT_ID = 7002;
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
  shellPrint?: ((bytes: Uint8Array) => Promise<string>) | null;
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
        match: (request) => new URL(request.url).pathname === '/logistics/shipping-units',
        respond: () =>
          jsonResponse({
            items: [
              shippingUnit(CLOSED_UNIT_ID, 'SYN-SU-0001', 'CLOSED'),
              shippingUnit(OPEN_UNIT_ID, 'SYN-SU-0002', 'OPEN'),
            ],
            page: { page: 1, size: 20, total: 2 },
          }),
      },
      {
        match: (request) =>
          /\/logistics\/shipping-units\/\d+$/u.test(new URL(request.url).pathname),
        respond: (request) => {
          const id = Number(/(\d+)$/u.exec(new URL(request.url).pathname)?.[1]);

          return jsonResponse(
            id === OPEN_UNIT_ID
              ? shippingUnit(OPEN_UNIT_ID, 'SYN-SU-0002', 'OPEN')
              : shippingUnit(CLOSED_UNIT_ID, 'SYN-SU-0001', 'CLOSED'),
          );
        },
      },
      {
        match: (request) => new URL(request.url).pathname === '/mdm/uoms',
        respond: () =>
          jsonResponse({
            items: [{ uomId: 9301, uomCode: 'EA', uomName: 'EA', isActive: true }],
            page: { page: 1, size: 200, total: 1 },
          }),
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
        /* ⚠ 서버처럼 **요청한 대상을 그대로** 돌려준다 — 그러지 않으면 화면이 그릴 줄을 못 찾는다. */
        respond: async (request) => {
          const body = (await request.clone().json()) as { targets: { targetId: number }[] };
          await record(request);

          return jsonResponse({
            items: body.targets.map((target, index) =>
              issueLog(
                ISSUE_LOG_ID + index,
                target.targetId,
                `SYN-ISSUE-${String(target.targetId)}`,
                1,
              ),
            ),
          });
        },
      },
      {
        match: (request) => new URL(request.url).pathname.endsWith('/rendition'),
        respond: (request) => {
          /*
           * ⛔⛔ **서버는 이 화면의 두 종류를 하나도 그려 주지 않는다**(포장 라벨은 준비 목록에
           * 없었고, 납품 라벨은 전달본 v4 에서 422 다). 제품 코드가 부르면 안 된다 — 그래도
           * 응답을 준비해 두는 것은, 회귀로 다시 부르게 되면 이 200 이 조용히 성공 경로를 열어
           * 아래 시험들의 「부르지 않는다」 단언이 실패로 드러나게 하려는 것이다.
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
    expect(screen.queryByText('SYN-SU-0001')).not.toBeInTheDocument();
  });
});

describe('대상 고르기', () => {
  it('마감하지 않은 출하 단위는 골라도 선택으로 남지 않는다', async () => {
    const { user } = renderFlow();

    await user.click(await screen.findByRole('radio', { name: /납품라벨/u }));
    await screen.findByText('SYN-SU-0002');

    const boxes = screen.getAllByRole('checkbox');
    /* 첫 칸은 전체 선택이라 건너뛴다 — 줄 상자는 그 뒤에 온다. */
    const waitingRow = boxes[2];

    expect(waitingRow).toBeDefined();
    await user.click(waitingRow as HTMLElement);

    /*
     * ⛔ 고를 수 없는 대상이 선택으로 남으면 발행 본문에 실려 **전건 실패**가 된다 —
     * 「하나라도 실패하면 전건 실패」라 고를 수 있었던 대상까지 함께 못 나간다.
     */
    /* ⭐ 「발행할 대상을 고르세요」 문구는 적지 않는다 — 발행 단추 잠김으로 본다(사용자 지시 2026-09-17). */
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '발행·인쇄' })).toBeDisabled();
    });
    expect(screen.queryByText('발행할 대상을 고르세요.')).not.toBeInTheDocument();
  });
});

describe('발행 → 미리보기 → 인쇄', () => {
  /*
   * ⭐ **두 종류 모두 발행까지 간다**(SHIP-UNIT-01). 한때 납품 라벨은 서버가 항상 422 로
   *    거부해 발행 시험을 포장 라벨로만 세웠는데, 대상이 출하 단위가 되며 그 벽이 사라졌다.
   */
  /* ⭐ [발행·인쇄]는 발행 뒤 곧바로 인쇄까지 간다(사용자 지적 2026-09-17 — 전에는 발행에서 멈췄다). */
  it('발행·인쇄는 발행한 뒤 곧바로 인쇄하고 결과를 보고한다', async () => {
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
    await waitFor(() => {
      expect(sentTo(sent, ':report-print')).toBeDefined();
    });
  });

  /*
   * ⛔ **통로가 없는 것을 인쇄 성공으로 보고하지 않는다**(공유계약 F-6). 라벨은 POP 이 이미
   *    그렸으므로 미리보기까지는 열리고, 막히는 자리는 셸 하나다 — 기록은 남았고 종이만 안
   *    나왔다는 사실을 그대로 보고해야 「나오지 않은 라벨」이 나온 것으로 남지 않는다.
   */
  it('셸이 없으면 미리보기는 열리되 인쇄를 실패로 보고한다', async () => {
    const { user, sent } = renderFlow({ shellPrint: null });

    await user.click(await screen.findByRole('radio', { name: /포장라벨/u }));
    await screen.findByText('SYN-HU-0001');
    await user.click(screen.getAllByRole('checkbox')[1] as HTMLElement);
    await user.click(
      screen.getByRole('button', { name: messages.shippingPackingLabel.actions.issue }),
    );

    const preview = await screen.findByRole('button', { name: '미리보기' });
    await waitFor(() => {
      expect(preview).toBeEnabled();
    });

    await user.click(preview);
    await user.click(
      await screen.findByRole('button', { name: messages.shippingPackingLabel.preview.print }),
    );

    await waitFor(() => {
      expect(sentTo(sent, ':report-print')?.body).toMatchObject({ outcome: 'FAILED' });
    });
  });

  it('셸이 있으면 POP 이 그린 바이트를 셸로 넘긴다 — 렌디션은 부르지 않는다', async () => {
    const save = vi.fn(async () => 'syn://printed');
    const { user, sent } = renderFlow({ shellPrint: save });

    await user.click(await screen.findByRole('radio', { name: /포장라벨/u }));
    await screen.findByText('SYN-HU-0001');
    await user.click(screen.getAllByRole('checkbox')[1] as HTMLElement);
    await user.click(
      screen.getByRole('button', { name: messages.shippingPackingLabel.actions.issue }),
    );

    await user.click(await screen.findByRole('button', { name: '미리보기' }));
    await user.click(
      await screen.findByRole('button', { name: messages.shippingPackingLabel.preview.print }),
    );

    await waitFor(() => {
      expect(save).toHaveBeenCalled();
    });

    expect(sentTo(sent, '/rendition')).toBeUndefined();
    await waitFor(() => {
      expect(sentTo(sent, ':report-print')?.body).toMatchObject({ outcome: 'SUCCEEDED' });
    });
  });

  /*
   * ⛔ **배분으로 발행하지 않는다**(전달본 v4 — 422 INVALID). 되돌리면 납품 라벨이 한 장도
   *    나가지 않고, 화면에는 그저 「발행 실패」로만 보인다.
   * ⛔ **그리고 렌디션도 부르지 않는다** — 서버가 납품 라벨을 그려 주지 않는다(422).
   */
  it('납품라벨은 출하 단위를 대상으로 발행하고 POP 이 그려 셸로 넘긴다', async () => {
    const save = vi.fn<(bytes: Uint8Array) => Promise<string>>().mockResolvedValue('syn://printed');
    const { user, sent } = renderFlow({ shellPrint: save });

    await user.click(await screen.findByRole('radio', { name: /납품라벨/u }));
    await screen.findByText('SYN-SU-0001');
    await user.click(screen.getAllByRole('checkbox')[1] as HTMLElement);
    await user.click(
      screen.getByRole('button', { name: messages.shippingPackingLabel.actions.issue }),
    );

    await waitFor(() => {
      expect(sentTo(sent, '/app/document-issues')?.body).toMatchObject({
        documentTypeCode: 'DELIVERY_LABEL',
        targets: [{ targetTypeCode: 'SHIPPING_UNIT', targetId: CLOSED_UNIT_ID }],
      });
    });

    /*
     * ⛔ **그려서 종이까지 가는지 본다.** 발행 본문만 보면, 그리기가 통째로 비어도 시험은
     *    통과한다 — 현장에서는 기록만 쌓이고 라벨이 한 장도 안 나오는 그 모양이다(P2 전례).
     */
    await user.click(await screen.findByRole('button', { name: '미리보기' }));
    await user.click(
      await screen.findByRole('button', { name: messages.shippingPackingLabel.preview.print }),
    );

    await waitFor(() => {
      expect(save).toHaveBeenCalled();
    });

    /* PNG 매직 바이트 — 셸로 나간 것이 정말 납품 라벨 그림이다. */
    const bytes = save.mock.calls[0]?.[0];

    expect(bytes?.[0]).toBe(137);
    expect(bytes?.[1]).toBe(80);
    expect(sentTo(sent, '/rendition')).toBeUndefined();
    await waitFor(() => {
      expect(sentTo(sent, ':report-print')?.body).toMatchObject({ outcome: 'SUCCEEDED' });
    });
  });
});

describe('재발행', () => {
  it('이미 발행된 대상을 고르면 사유를 받기 전까지 발행이 막힌다', async () => {
    const { user, sent } = renderFlow({ issued: { [CLOSED_UNIT_ID]: 1 } });

    await user.click(await screen.findByRole('radio', { name: /납품라벨/u }));
    await screen.findByText('SYN-SU-0001');
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
    await screen.findByText('SYN-SU-0001');
    await user.click(screen.getAllByRole('checkbox')[1] as HTMLElement);
    await user.click(
      screen.getByRole('button', { name: messages.shippingPackingLabel.actions.issue }),
    );

    expect(sentTo(sent, '/app/document-issues')).toBeUndefined();
    expect(screen.getByText('사번을 확인한 뒤에 발행할 수 있습니다.')).toBeInTheDocument();
  });
});
