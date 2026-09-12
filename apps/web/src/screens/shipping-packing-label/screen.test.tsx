import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LABEL_RENDITION_NOT_READY_REASON } from '../../patterns/pop-label-rendition';
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
  /** 발행 자체가 실패한다 — 사용자가 그대로 다시 누르는 갈래를 만든다. */
  issueFails?: boolean;
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
      respond: (request) => {
        const requestedIds = new URL(request.url).searchParams
          .getAll('targetIds')
          .flatMap((value) => value.split(','))
          .map(Number);
        const configured = options.summaries ?? [];

        return jsonResponse({
          items: requestedIds.map(
            (targetId) =>
              configured.find((item) => (item as { targetId?: number }).targetId === targetId) ??
              summary(targetId, 0),
          ),
        });
      },
    },
    {
      match: (request) => pathOf(request) === '/app/printers',
      respond: () => jsonResponse({ items: [printer('SYN-PRN-01', true)] }),
    },
    {
      match: (request) => pathOf(request) === '/mdm/code-values',
      respond: () =>
        jsonResponse({
          items: options.reasons ?? [reissueReason('SYN_REASON', '인쇄 실패')],
          page: {
            page: 1,
            size: 20,
            total: (options.reasons ?? [reissueReason('SYN_REASON', '인쇄 실패')]).length,
          },
        }),
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

        return options.issueFails === true
          ? jsonResponse({ message: '실패' }, { status: 500 })
          : jsonResponse({ items: [issueLog(9701, 9401, 'SYN-LOT-0001', 1)] }, { status: 201 });
      },
    },
    {
      match: (request) => request.method === 'GET' && pathOf(request) === '/app/document-issues',
      respond: () => jsonResponse({ items: [], page: { page: 1, size: 20, total: 0 } }),
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

  /**
   * ⭐ **종류를 고르기 전에도 «왜» 못 누르는지 말한다**(#1094 · 88단계 2회차 실기).
   *
   * 종전에는 이 상태에서 발행 버튼이 꺼진 채 아무 말도 하지 않아 현장이 고장으로 읽었다.
   *
   * ⛔ 대상 목록의 「라벨 종류를 먼저 고르세요」와 **같은 문장을 쓰지 않는다** — 한 화면에
   *    같은 말이 둘 서면 어느 쪽을 고쳐야 하는지 흐려진다.
   */
  it('라벨 종류를 고르기 전에는 발행이 왜 막혔는지 말한다', async () => {
    renderScreen();

    expect(await screen.findByText(t.actions.needsKind)).toBeInTheDocument();
    expect(issueButton()).toBeDisabled();
    expect(t.actions.needsKind).not.toBe(t.targets.beforeKind);
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
  it('종류를 고르기 전에는 대상이 서지 않고, 왜 비었는지 말한다', async () => {
    renderScreen();

    expect(await screen.findByText(t.targets.beforeKind)).toBeInTheDocument();
    // ⛔ 「이 출하에 대상이 없다」로 그리지 않는다 — 아직 고르지 않았을 뿐이다.
    expect(screen.queryByText(t.targets.empty)).not.toBeInTheDocument();
  });

  it('고른 종류를 한 번 더 누르면 해제되고 대상도 함께 비워진다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await chooseKind(user, '포장라벨');
    expect(await screen.findByRole('radio', { name: /포장라벨/u })).toBeChecked();

    await chooseKind(user, '포장라벨');

    // ⚠ 점만 꺼지고 값이 남는 갈래가 실제로 있었다 — 표시와 상태를 함께 본다.
    expect(screen.getByRole('radio', { name: /포장라벨/u })).not.toBeChecked();
    expect(await screen.findByText(t.targets.beforeKind)).toBeInTheDocument();
  });

  it('종류를 고르기 전에는 프린터가 «없다»고 단정하지 않는다 — 아직 조회하지 않았다', async () => {
    renderScreen();

    expect(await screen.findByText(t.targets.beforeKind)).toBeInTheDocument();
    expect(screen.queryByText(t.printer.none)).not.toBeInTheDocument();
  });

  it('종류를 고르기 전에도 프린터 자리는 서 있고 잠겨 있다', async () => {
    renderScreen();

    const select = await screen.findByRole('combobox', { name: t.printer.label });

    // 자리를 감췄다 세우면 그 순간 아래가 밀린다 — 자리는 두고 잠근다(사용자 지시).
    expect(select).toBeDisabled();
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

  it('최초 발행과 재출력 대상을 섞어 고르면 같은 사유로 보내지 않고 분리하도록 막는다', async () => {
    const user = userEvent.setup();
    renderScreen({
      allocations: [PASSED, allocation(9402, 9502, 'SYN-LOT-0002', true, 9602)],
      summaries: [summary(9401, 1)],
    });

    await chooseKind(user, '납품라벨');
    await user.click(await screen.findByRole('checkbox', { name: '전체 선택' }));

    expect(await screen.findByText(t.actions.mixedIssueModes)).toBeInTheDocument();
    expect(issueButton()).toBeDisabled();
  });
});

describe('ShippingPackingLabelScreen — 발행과 인쇄', () => {
  it('발행 전에는 미리보기를 열 수 없다 — 그리기 경로가 발행 기록 번호를 받는다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await chooseKind(user, '포장라벨');
    await user.click(await rowCheckbox(0));

    expect(screen.getByRole('button', { name: t.actions.preview })).toBeDisabled();
  });

  it('발행 본문에 고른 대상과 프린터가 실리고, 회차는 싣지 않는다', async () => {
    const user = userEvent.setup();
    const requests: { request: Request; body: string }[] = [];
    renderScreen({ requests });

    await chooseKind(user, '포장라벨');
    await user.click(await rowCheckbox(0));
    await user.click(issueButton());

    await waitFor(() => {
      expect(requests).toHaveLength(1);
    });

    const sent = nth(requests, 0);
    const body = JSON.parse(sent.body) as Record<string, unknown>;

    expect(body).toMatchObject({
      documentTypeCode: 'PACKING_LABEL',
      targets: [{ targetTypeCode: 'HANDLING_UNIT', targetId: 9601 }],
      printerName: 'SYN-PRN-01',
    });
    /* 포장 라벨은 한 포장에 여러 LOT 이 섞일 수 있어 `lotId` 를 비운다(공유계약 A-21). */
    expect((body.targets as Record<string, unknown>[])[0]).not.toHaveProperty('lotId');
    expect(body).not.toHaveProperty('issueSeq');
    expect(body).not.toHaveProperty('reissueReasonCode');
    // 귀속 사번은 헤더로 간다 — 본문이 아니다(공유계약 D-5).
    expect(sent.request.headers.get('X-Worker-No')).toBe(WORKER_NO);
    expect(sent.request.headers.get('Idempotency-Key')).not.toBeNull();

    /*
     * ⛔⛔ **서버에 `GET /app/document-issues/{id}/rendition` 경로가 없다**(대응표 P1
     * 「미구현 5건」). 발행 직후 이 화면은 곧바로 그리기(render)를 시도하는데, 그 요청이
     * 이제 나가지 않아 항상 `renderFailed` 로 멈춘다 — 그래도 **발행 자체(위 단언들)는
     * 그대로 됐다**는 것이 이 시험의 핵심이다.
     */
    expect(await screen.findByText(t.outcome.renderFailed)).toBeInTheDocument();
  });

  it('발행 단추를 연달아 눌러도 발행은 한 번만 나간다 — 회차는 되돌릴 수 없다', async () => {
    const user = userEvent.setup();
    const requests: { request: Request; body: string }[] = [];
    renderScreen({ requests });

    await chooseKind(user, '포장라벨');
    await user.click(await rowCheckbox(0));

    const button = issueButton();

    /*
     * ⛔ 기다리지 않고 두 번 누른다 — 단추의 `disabled` 는 다음 렌더에서야 반영되므로
     * 장갑 낀 손의 연타는 «같은 렌더»에서 두 번 들어온다. 막는 것은 훅 안의 ref 다.
     */
    await Promise.all([user.click(button), user.click(button)]);

    await waitFor(() => {
      expect(requests.length).toBeGreaterThan(0);
    });

    expect(requests.filter((one) => one.request.method === 'POST')).toHaveLength(1);
  });

  it('발행이 실패해 그대로 다시 눌러도 멱등 키가 같다 — 서버가 기록을 두 벌 만들지 않는다', async () => {
    const user = userEvent.setup();
    const requests: { request: Request; body: string }[] = [];
    renderScreen({ requests, issueFails: true });

    await chooseKind(user, '포장라벨');
    await user.click(await rowCheckbox(0));

    await user.click(issueButton());
    expect(await screen.findByText(t.outcome.issueFailed)).toBeInTheDocument();

    // 사용자 눈에는 「다시 시도」다 — 같은 대상·같은 프린터·같은 사유다.
    await user.click(issueButton());

    await waitFor(() => {
      expect(requests).toHaveLength(2);
    });

    const keys = requests.map((one) => one.request.headers.get('Idempotency-Key'));

    expect(keys[0]).not.toBeNull();
    expect(keys[1]).toBe(keys[0]);
  });

  it('발행은 됐는데 그리기가 실패하면 「다시 발행하지 말라」고 말한다 — 회차가 또 오른다', async () => {
    const user = userEvent.setup();
    renderScreen({ renditionFails: true });

    await chooseKind(user, '포장라벨');
    await user.click(await rowCheckbox(0));
    await user.click(issueButton());

    expect(await screen.findByText(t.outcome.renderFailed)).toBeInTheDocument();
  });

  /*
   * ⛔⛔ **서버에 이 경로가 없다**(대응표 P1 「미구현 5건」). 원래 이 시험은 첫 그리기만
   * 실패한 뒤 «라벨 다시 받기»가 같은 발행 ID로 두 번째 시도를 보내 성공하는 것을 쟀다 —
   * 이제는 그 요청 자체가 나가지 않아 몇 번을 다시 눌러도 성공할 수 없다. 대신 **재시도가
   * 새 발행(회차)을 만들지 않는다**는, 이 시험의 핵심 성질은 그대로 지켜지는지를 잰다 —
   * 몇 번을 눌러도 `/app/document-issues` POST 는 처음 한 번뿐이고, 렌디션 경로로는 실제
   * 네트워크 요청이 한 번도 나가지 않는다.
   */
  it('라벨 다시 받기를 여러 번 눌러도 회차를 올리지 않는다 — 네트워크 요청도 나가지 않는다', async () => {
    const user = userEvent.setup();
    const requests: { request: Request; body: string }[] = [];
    const renditionAttempts: number[] = [];
    renderScreen({ requests, renditionAttempts });

    await chooseKind(user, '포장라벨');
    await user.click(await rowCheckbox(0));
    await user.click(issueButton());

    /*
     * ⛔ **단추를 매번 다시 찾는다.** `issuing` 으로 잠깐 넘어가는 사이 이 배너가 통째로
     * 사라졌다 다시 서므로(엘리먼트가 바뀐다), 처음 잡아 둔 참조로 두 번째를 누르면 이미
     * 떨어져 나온 노드를 누르게 된다.
     */
    await user.click(await screen.findByRole('button', { name: t.outcome.retryRendition }));
    await user.click(await screen.findByRole('button', { name: t.outcome.retryRendition }));

    expect(await screen.findByText(t.outcome.renderFailed)).toBeInTheDocument();
    expect(requests).toHaveLength(1);
    expect(renditionAttempts).toEqual([]);
  });

  /*
   * ⛔⛔ **서버에 `GET /app/document-issues/{id}/rendition` 경로가 없다**(대응표 P1
   * 「미구현 5건」). 미리보기 창은 그림을 받았을 때만 열린다(`screen.tsx` 의 `issue.labels`
   * 가 그 조건이다) — 그림을 아예 받지 않으니 이 화면에서 「미리보기」 단추는 계속 잠겨
   * 있고, 그 뒤(인쇄·보고)로는 갈 수조차 없다. 원래 이 시험은 셸이 없을 때 인쇄 «시도»가
   * 실패로 보고되는 것을 쟀다 — 이제는 그 시도 자체가 없다.
   */
  it('그림을 받지 못하면 미리보기가 잠긴 채로 남아 인쇄 보고까지 가지 않는다', async () => {
    const user = userEvent.setup();
    const requests: { request: Request; body: string }[] = [];
    renderScreen({ requests });

    await chooseKind(user, '포장라벨');
    await user.click(await rowCheckbox(0));
    await user.click(issueButton());

    expect(await screen.findByText(t.outcome.renderFailed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.preview })).toBeDisabled();
    /* 발행 하나만 나갔다 — 인쇄 보고는 아예 시도되지 않는다. */
    expect(requests).toHaveLength(1);
  });

  /*
   * ⛔⛔ **서버에 이 경로가 없다**(위와 같음). 원래 이 시험은 셸이 없다는 «구체적 사유»가
   * 인쇄 실패 문구 옆에 드러나는지를 쟀다 — 이제 멈추는 자리가 셸 판정보다 앞이라 그 사유
   * 대신 「그림을 받는 걸음이 준비되지 않았다」는 사유가 대신 선다. 같은 원칙(내부 사유를
   * 삼키지 않는다)이 새 사유에도 지켜지는지를 잰다.
   */
  it('그림을 받지 못한 사유가 화면에 그대로 드러난다 — 삼키지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await chooseKind(user, '포장라벨');
    await user.click(await rowCheckbox(0));
    await user.click(issueButton());

    expect(await screen.findByText(LABEL_RENDITION_NOT_READY_REASON)).toBeInTheDocument();
  });

  /*
   * ⛔⛔ **서버에 이 경로가 없다**(위와 같음). 셸이 있어도(빈 사유로 실패하는 셸이라도) 그림을
   * 받는 걸음에서 이미 멈춰 셸까지 가지 않는다 — 셸의 «어떤» 동작도 이 상황을 바꾸지 못한다는
   * 것을 잰다.
   */
  it('셸이 있어도(빈 사유로 실패하는 셸이라도) 부르지 않는다', async () => {
    const user = userEvent.setup();
    const save = vi.fn<() => Promise<string>>().mockRejectedValue(new Error('   '));
    Object.defineProperty(window, 'pop', { configurable: true, value: { rendition: { save } } });

    const requests: { request: Request; body: string }[] = [];
    renderScreen({ requests });

    await chooseKind(user, '포장라벨');
    await user.click(await rowCheckbox(0));
    await user.click(issueButton());

    expect(await screen.findByText(t.outcome.renderFailed)).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
    expect(requests).toHaveLength(1);
  });

  /*
   * ⛔⛔ **서버에 이 경로가 없다**(위와 같음). 원래 이 시험은 정상 셸이 서버가 그린 바이트를
   * 그대로 받아 성공으로 보고하는 경로를 쟀다 — 그 경로는 더는 없다. 잘 동작하는 셸을
   * 두어도 «부르지조차 않는다»는 사실로 다시 잰다.
   */
  it('셸이 정상이어도 그림을 받지 못하면 셸에 바이트를 넘기지 않는다', async () => {
    const user = userEvent.setup();
    const save = vi.fn<(bytes: Uint8Array) => Promise<string>>().mockResolvedValue('SYN/path');
    Object.defineProperty(window, 'pop', {
      configurable: true,
      value: { rendition: { save } },
    });

    const requests: { request: Request; body: string }[] = [];
    renderScreen({ requests });

    await chooseKind(user, '포장라벨');
    await user.click(await rowCheckbox(0));
    await user.click(issueButton());

    expect(await screen.findByText(t.outcome.renderFailed)).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
    expect(requests).toHaveLength(1);
  });
});

describe('ShippingPackingLabelScreen — 재진입 복구', () => {
  /*
   * ⛔⛔ **`DELIVERY_LABEL` 발행은 서버가 항상 422 `INVALID` 로 거부한다**(대응표 P1
   * 「공용 문서 발행」· I-27 마감 결정 · `codes.ts` 의 `DELIVERY_LABEL_ISSUE_LOCKED`).
   * 대상 유형 `SHIPMENT_LOT_ALLOCATION` 도 계약 enum 에서 빠졌다 — 원래 이 시험은 복구
   * 액션이 누락된 OQC 통과 납품 라벨을 자동으로 발행·인쇄까지 잇는 것을 쟀다. 그 발행
   * 동작 자체를 잠갔으므로, 이제는 «몇 건이 빠졌는지»는 그대로 안내하되 복구 단추는
   * 눌러도 반응하지 않는지를 잰다 — 눌러도 요청이 나가지 않아야 한다(완료 조건).
   */
  it('summary에서 누락된 OQC 통과 납품 라벨의 건수는 안내하지만, 복구 단추는 잠겨 있어 요청을 보내지 않는다', async () => {
    const user = userEvent.setup();
    const requests: { request: Request; body: string }[] = [];
    const save = vi.fn(async () => 'syn://printed');
    Object.defineProperty(window, 'pop', {
      configurable: true,
      value: { rendition: { save } },
    });

    renderWithProviders(
      <ShippingPackingLabelScreen embedded shipmentId={SHIPMENT_ID} workerNo={WORKER_NO} />,
      {
        fetch: createStubFetch(
          routes({
            requests,
            summaries: [
              summary(9601, 1, '2026-09-09T01:00:00Z', 'SUCCEEDED'),
              summary(9602, 1, '2026-09-09T01:00:00Z', 'SUCCEEDED'),
              summary(9401, 0),
              summary(9402, 0),
            ],
          }),
        ),
      },
    );

    /*
     * 「몇 건 빠졌는지」는 계약과 무관한 안내다 — 그대로 남는다. 건수는 이름·수·단위가 갈린
     * 카드로 서므로(`StatCard`) 카드를 이름으로 찾아 그 «안»의 수를 본다 — 화면 어딘가의
     * 「1」을 집으면 다른 구획의 수와 구분되지 않는다.
     *
     * ⚠ **카드가 서는 것과 수가 채워지는 것은 다른 순간이다.** 이름은 첫 렌더부터 있고 수는
     *   발행 현황이 온 뒤에 바뀐다 — 이름만 기다리고 수를 바로 읽으면 0 을 본다(실측).
     */
    await waitFor(() => {
      const card = screen.getByText(t.recovery.deliveryLabel).closest('[role="group"]');

      if (!(card instanceof HTMLElement)) throw new Error('건수 카드를 찾지 못했다');

      expect(within(card).getByText('1')).toBeInTheDocument();
    });

    const deliveryAction = screen.getByRole('button', { name: t.recovery.deliveryAction });
    expect(deliveryAction).toBeDisabled();

    await user.click(deliveryAction);

    expect(
      requests.some(
        ({ request }) => request.method === 'POST' && pathOf(request) === '/app/document-issues',
      ),
    ).toBe(false);
    expect(save).not.toHaveBeenCalled();
    expect(requests.some(({ request }) => pathOf(request).endsWith(':report-print'))).toBe(false);
  });
});
