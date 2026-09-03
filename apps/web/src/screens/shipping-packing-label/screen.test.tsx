import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import {
  SHIPMENT_ID,
  WORKER_NO,
  allocation,
  handlingUnitDetail,
  issueLog,
  printer,
  reissueReason,
  summary,
  shipment,
} from './fixtures';
import { ShippingPackingLabelScreen } from './screen';

const t = messages.shippingPackingLabel;

/** 사번은 진입 주소로 온다(전례 `P-02-05`) — 셸이 채우는 자리는 아직 비어 있다. */
const ROUTE = `/pop/shipping-label?shipmentId=${String(SHIPMENT_ID)}&workerNo=${WORKER_NO}`;

/** 사번 없이 들어온 경우. 발행이 열리면 안 된다. */
const ROUTE_WITHOUT_WORKER = `/pop/shipping-label?shipmentId=${String(SHIPMENT_ID)}`;

const pathOf = (request: Request): string => new URL(request.url).pathname;

/** 합격 1건 · 미합격 1건. 두 갈래를 한 목록에서 확인한다. */
const PASSED = allocation(9401, 9501, 'SYN-LOT-0001', true, 9601);
const WAITING = allocation(9402, 9502, 'SYN-LOT-0002', false, 9602);

interface Options {
  allocations?: unknown[];
  /** 발행 현황. 기본은 「한 번도 안 뽑음」 */
  summaries?: unknown[];
  reasons?: unknown[];
  /** 보낸 요청을 담아 둔다 — 무엇을 보냈는지가 이 화면의 핵심이다. */
  requests?: { request: Request; body: string }[];
  /** 셸 인쇄가 실패한다 */
  renditionFails?: boolean;
  renditionFailsOnce?: boolean;
  renditionAttempts?: number[];
}

const routes = (options: Options): StubRoute[] => {
  let renditionAttempt = 0;
  const record = async (request: Request): Promise<void> => {
    options.requests?.push({ request, body: await request.clone().text() });
  };

  return [
    {
      match: (request) => /^\/logistics\/shipments\/\d+$/u.test(pathOf(request)),
      respond: () => jsonResponse(shipment()),
    },
    {
      match: (request) => pathOf(request) === '/logistics/shipment-lot-allocations',
      respond: () =>
        jsonResponse({
          items: options.allocations ?? [PASSED, WAITING],
          page: { page: 1, size: 20, total: 2 },
        }),
    },
    {
      match: (request) => /^\/inventory\/handling-units\/(\d+)$/u.test(pathOf(request)),
      respond: (request) => {
        const id = Number(/(\d+)$/u.exec(pathOf(request))?.[1]);

        return jsonResponse(handlingUnitDetail(id, `SYN-CTN-${String(id)}`));
      },
    },
    {
      match: (request) => pathOf(request) === '/app/document-issues/summary',
      respond: () => jsonResponse({ items: options.summaries ?? [] }),
    },
    {
      match: (request) => pathOf(request) === '/app/printers',
      respond: () => jsonResponse({ items: [printer('SYN-PRN-01', true)] }),
    },
    {
      match: (request) => pathOf(request) === '/mdm/code-values',
      respond: () =>
        jsonResponse({ items: options.reasons ?? [reissueReason('SYN_REASON', '인쇄 실패')] }),
    },
    {
      match: (request) => /\/rendition$/u.test(pathOf(request)),
      respond: () => {
        renditionAttempt += 1;
        options.renditionAttempts?.push(renditionAttempt);

        return options.renditionFails === true ||
          (options.renditionFailsOnce === true && renditionAttempt === 1)
          ? jsonResponse({ message: '실패' }, { status: 500 })
          : new Response(new Uint8Array([1, 2, 3]), {
              headers: { 'Content-Type': 'image/png' },
            });
      },
    },
    {
      match: (request) => /:report-print$/u.test(pathOf(request)),
      respond: (request) => {
        void record(request);

        return jsonResponse({}, { status: 200 });
      },
    },
    {
      match: (request) => request.method === 'POST' && pathOf(request) === '/app/document-issues',
      respond: (request) => {
        void record(request);

        return jsonResponse({ items: [issueLog(9701, 9401, 'SYN-LOT-0001', 1)] }, { status: 201 });
      },
    },
    {
      match: (request) => request.method === 'GET' && pathOf(request) === '/app/document-issues',
      respond: () => jsonResponse({ items: [] }),
    },
  ];
};

const renderScreen = (options: Options = {}, route = ROUTE) =>
  renderWithProviders(<ShippingPackingLabelScreen />, {
    fetch: createStubFetch(routes(options)),
    route,
  });

const chooseKind = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(await screen.findByRole('radio', { name: new RegExp(name, 'u') }));
};

/** 없는 것을 조용히 `undefined` 로 넘기지 않는다 — 시험이 엉뚱한 자리에서 실패한다. */
const nth = <T,>(items: readonly T[], index: number): T => {
  const item = items[index];

  if (item === undefined) throw new Error(`${String(index)}번째 항목이 없습니다.`);

  return item;
};

const rowCheckbox = async (index: number) =>
  nth(await screen.findAllByRole('checkbox', { name: '행 선택' }), index);

const issueButton = () => screen.getByRole('button', { name: t.actions.issue });

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, 'pop');
});

describe('ShippingPackingLabelScreen — 진입', () => {
  it('출하가 없으면 목록을 그리지 않고 어디서 들어와야 하는지 말한다', () => {
    renderScreen({}, '/pop/shipping-label');

    expect(screen.getByText(t.shipment.missing)).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /포장라벨/u })).not.toBeInTheDocument();
  });

  it('사번을 모르면 발행하지 않는다 — 서버가 거부할 쓰기를 만들지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({}, ROUTE_WITHOUT_WORKER);

    await chooseKind(user, '납품라벨');

    expect(await screen.findByText(t.actions.needsWorker)).toBeInTheDocument();
    expect(issueButton()).toBeDisabled();
  });
});

describe('ShippingPackingLabelScreen — 대상 목록', () => {
  it('종류를 고르기 전에는 대상이 서지 않는다 — 고르지 않은 종류의 라벨이 나가면 안 된다', async () => {
    renderScreen();

    expect(await screen.findByText(t.targets.empty)).toBeInTheDocument();
  });

  it('종류를 고르기 전에는 프린터가 «없다»고 단정하지 않는다 — 아직 조회하지 않았다', async () => {
    renderScreen();

    expect(await screen.findByText(t.targets.empty)).toBeInTheDocument();
    expect(screen.queryByText(t.printer.none)).not.toBeInTheDocument();
  });

  it('납품라벨은 미합격 건도 목록에 남기되 고를 수 없게 한다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await chooseKind(user, '납품라벨');

    // 빠지지 않는다 — 빠지면 「검사 대기」와 「이 출하에 없다」가 같은 모양이 된다.
    expect(await screen.findByText('SYN-LOT-0002')).toBeInTheDocument();
    expect(screen.getByText(t.targets.status.blocked)).toBeInTheDocument();

    // 미합격 줄(두 번째)을 눌러도 선택으로 남지 않아 발행이 열리지 않는다.
    await user.click(await rowCheckbox(1));

    expect(await screen.findByText(t.actions.needsTarget)).toBeInTheDocument();
    expect(issueButton()).toBeDisabled();
  });

  it('종류를 포장라벨로 바꾸면 대상이 취급 단위로 갈린다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await chooseKind(user, '포장라벨');

    expect(await screen.findByText('SYN-CTN-9601')).toBeInTheDocument();
    expect(screen.queryByText('SYN-LOT-0001')).not.toBeInTheDocument();
  });
});

describe('ShippingPackingLabelScreen — 재발행', () => {
  it('이미 발행된 대상을 고르면 사유 없이 발행하지 못한다', async () => {
    const user = userEvent.setup();
    renderScreen({ summaries: [summary(9401, 2, '2026-09-02T04:20:00Z')] });

    await chooseKind(user, '납품라벨');
    await user.click(await rowCheckbox(0));

    expect(await screen.findByText(t.reissue.notice(1))).toBeInTheDocument();
    expect(screen.getByText(t.actions.needsReason)).toBeInTheDocument();
    expect(issueButton()).toBeDisabled();
  });

  it('고를 수 있는 사유가 없으면 왜 재발행할 수 없는지 말한다', async () => {
    const user = userEvent.setup();
    renderScreen({ summaries: [summary(9401, 1)], reasons: [] });

    await chooseKind(user, '납품라벨');
    await user.click(await rowCheckbox(0));

    expect(await screen.findByText(t.reissue.empty)).toBeInTheDocument();
  });
});

describe('ShippingPackingLabelScreen — 발행과 인쇄', () => {
  it('발행 전에는 미리보기를 열 수 없다 — 그리기 경로가 발행 기록 번호를 받는다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await chooseKind(user, '납품라벨');
    await user.click(await rowCheckbox(0));

    expect(screen.getByRole('button', { name: t.actions.preview })).toBeDisabled();
  });

  it('발행 본문에 고른 대상과 프린터가 실리고, 회차는 싣지 않는다', async () => {
    const user = userEvent.setup();
    const requests: { request: Request; body: string }[] = [];
    renderScreen({ requests });

    await chooseKind(user, '납품라벨');
    await user.click(await rowCheckbox(0));
    await user.click(issueButton());

    await waitFor(() => {
      expect(requests).toHaveLength(1);
    });

    const sent = nth(requests, 0);
    const body = JSON.parse(sent.body) as Record<string, unknown>;

    expect(body).toMatchObject({
      documentTypeCode: 'DELIVERY_LABEL',
      targets: [{ targetId: 9401, lotId: 9501 }],
      printerName: 'SYN-PRN-01',
    });
    expect(body).not.toHaveProperty('issueSeq');
    expect(body).not.toHaveProperty('reissueReasonCode');
    // 귀속 사번은 헤더로 간다 — 본문이 아니다(공유계약 D-5).
    expect(sent.request.headers.get('X-Worker-No')).toBe(WORKER_NO);
    expect(sent.request.headers.get('Idempotency-Key')).not.toBeNull();

    expect(await screen.findByText(t.outcome.issued(1))).toBeInTheDocument();
  });

  it('발행은 됐는데 그리기가 실패하면 「다시 발행하지 말라」고 말한다 — 회차가 또 오른다', async () => {
    const user = userEvent.setup();
    renderScreen({ renditionFails: true });

    await chooseKind(user, '납품라벨');
    await user.click(await rowCheckbox(0));
    await user.click(issueButton());

    expect(await screen.findByText(t.outcome.renderFailed)).toBeInTheDocument();
  });

  it('라벨 다시 받기는 기존 발행 ID로 그리기만 재시도한다 — 회차를 올리지 않는다', async () => {
    const user = userEvent.setup();
    const requests: { request: Request; body: string }[] = [];
    const renditionAttempts: number[] = [];
    renderScreen({ requests, renditionFailsOnce: true, renditionAttempts });

    await chooseKind(user, '납품라벨');
    await user.click(await rowCheckbox(0));
    await user.click(issueButton());
    await user.click(await screen.findByRole('button', { name: t.outcome.retryRendition }));

    expect(await screen.findByText(t.outcome.issued(1))).toBeInTheDocument();
    expect(requests).toHaveLength(1);
    expect(renditionAttempts).toEqual([1, 2]);
  });

  it('셸 인쇄 통로가 없으면 인쇄를 실패로 «보고»한다 — 안 나온 라벨이 나온 것으로 남지 않는다', async () => {
    const user = userEvent.setup();
    const requests: { request: Request; body: string }[] = [];
    renderScreen({ requests });

    await chooseKind(user, '납품라벨');
    await user.click(await rowCheckbox(0));
    await user.click(issueButton());

    await user.click(await screen.findByRole('button', { name: t.actions.preview }));
    await user.click(await screen.findByRole('button', { name: t.preview.print }));

    await waitFor(() => {
      expect(requests).toHaveLength(2);
    });

    const report = JSON.parse(nth(requests, 1).body) as Record<string, unknown>;

    expect(report.outcome).toBe('FAILED');
    // ⛔ FAILED 인데 사유가 없으면 서버가 422 로 막는다.
    expect(report.failureReason).toEqual(expect.any(String));
  });

  it('셸이 말 없이 실패해도 사유를 채워 보고한다 — 빈 사유는 서버가 422 로 막는다', async () => {
    const user = userEvent.setup();
    // 사유를 말하지 않는 실패. `message` 가 빈 문자열이라 그대로 실으면 「사유 없음」이 된다.
    const save = vi.fn<() => Promise<string>>().mockRejectedValue(new Error('   '));
    Object.defineProperty(window, 'pop', { configurable: true, value: { rendition: { save } } });

    const requests: { request: Request; body: string }[] = [];
    renderScreen({ requests });

    await chooseKind(user, '납품라벨');
    await user.click(await rowCheckbox(0));
    await user.click(issueButton());

    await user.click(await screen.findByRole('button', { name: t.actions.preview }));
    await user.click(await screen.findByRole('button', { name: t.preview.print }));

    await waitFor(() => {
      expect(requests).toHaveLength(2);
    });

    const report = JSON.parse(nth(requests, 1).body) as { outcome: string; failureReason: string };

    expect(report.outcome).toBe('FAILED');
    expect(report.failureReason.trim()).not.toBe('');
  });

  it('셸이 있으면 서버가 그린 바이트를 그대로 넘기고 성공으로 보고한다', async () => {
    const user = userEvent.setup();
    const save = vi.fn<(bytes: Uint8Array) => Promise<string>>().mockResolvedValue('SYN/path');
    Object.defineProperty(window, 'pop', {
      configurable: true,
      value: { rendition: { save } },
    });

    const requests: { request: Request; body: string }[] = [];
    renderScreen({ requests });

    await chooseKind(user, '납품라벨');
    await user.click(await rowCheckbox(0));
    await user.click(issueButton());

    await user.click(await screen.findByRole('button', { name: t.actions.preview }));
    await user.click(await screen.findByRole('button', { name: t.preview.print }));

    await waitFor(() => {
      expect(requests).toHaveLength(2);
    });

    expect(save).toHaveBeenCalledOnce();
    expect(Array.from(nth(save.mock.calls, 0)[0])).toEqual([1, 2, 3]);
    expect(JSON.parse(nth(requests, 1).body)).toEqual({ outcome: 'SUCCEEDED' });
  });
});
