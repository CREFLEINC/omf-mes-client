import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
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
  shippingUnit,
} from './fixtures';
import { ShippingPackingLabelScreen } from './screen';

const t = messages.shippingPackingLabel;

/** 사번은 진입 주소로 온다(전례 `P-02-05`) — 셸이 채우는 자리는 아직 비어 있다. */
const ROUTE = `/pop/shipping-label?shipmentId=${String(SHIPMENT_ID)}&workerNo=${WORKER_NO}`;

/** 사번 없이 들어온 경우. 발행이 열리면 안 된다. */
const ROUTE_WITHOUT_WORKER = `/pop/shipping-label?shipmentId=${String(SHIPMENT_ID)}`;

const pathOf = (request: Request): string => new URL(request.url).pathname;

/** 포장 둘. 배분은 이제 **포장 라벨 쪽**만 먹인다(납품 라벨의 대상은 출하 단위다). */
const PASSED = allocation(9401, 9501, 'SYN-LOT-0001', true, 9601);
const WAITING = allocation(9402, 9502, 'SYN-LOT-0002', false, 9602);

/** 마감 1건 · 구성 중 1건. 납품 라벨의 두 갈래를 한 목록에서 확인한다. */
const CLOSED_UNIT = shippingUnit(7001, 'SYN-SU-0001', 'CLOSED');
const OPEN_UNIT = shippingUnit(7002, 'SYN-SU-0002', 'OPEN');

interface Options {
  allocations?: unknown[];
  /** 출하 단위 상세들. 기본은 마감 1 · 구성 중 1. */
  units?: { shippingUnitId: number }[];
  /** 출하 문맥 조회가 실패한다 — 출하번호를 모르면 포장 라벨을 그릴 수 없다. */
  shipmentFails?: boolean;
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
      respond: () =>
        options.shipmentFails === true
          ? jsonResponse({ message: '실패' }, { status: 500 })
          : jsonResponse(shipment()),
    },
    {
      match: (request) => pathOf(request) === '/logistics/shipping-units',
      respond: () => {
        const items = options.units ?? [CLOSED_UNIT, OPEN_UNIT];

        return jsonResponse({ items, page: { page: 1, size: 20, total: items.length } });
      },
    },
    {
      match: (request) => /^\/logistics\/shipping-units\/\d+$/u.test(pathOf(request)),
      respond: (request) => {
        const id = Number(/(\d+)$/u.exec(pathOf(request))?.[1]);
        const found = (options.units ?? [CLOSED_UNIT, OPEN_UNIT]).find(
          (unit) => unit.shippingUnitId === id,
        );

        return found === undefined
          ? jsonResponse({ message: '없음' }, { status: 404 })
          : jsonResponse(found);
      },
    },
    /* 포장 라벨의 수량 줄이 단위 «코드»를 쓴다 — 못 풀면 수만 적는다. */
    {
      match: (request) => pathOf(request) === '/mdm/uoms',
      respond: () =>
        jsonResponse({
          items: [{ uomId: 9301, uomCode: 'EA', uomName: 'EA', isActive: true }],
          page: { page: 1, size: 200, total: 1 },
        }),
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
    /*
     * ⚠ **요청한 대상을 그대로 되돌려준다.** 서버가 그렇게 답한다 — 한때 이 스텁은 무엇을
     *   보내든 배분 하나(9401)를 돌려줬고, 화면은 그 `targetId` 로 목록 줄을 못 찾아 **늘 그리기
     *   전에 멈췄다.** 그래서 「그리기 실패」를 기대하는 시험이 여럿 섰는데, 그것은 제품이 아니라
     *   스텁의 성질이었다.
     */
    {
      match: (request) => request.method === 'POST' && pathOf(request) === '/app/document-issues',
      respond: async (request) => {
        await record(request);

        if (options.issueFails === true) return jsonResponse({ message: '실패' }, { status: 500 });

        const body = (await request.clone().json()) as { targets: { targetId: number }[] };

        return jsonResponse(
          {
            items: body.targets.map((target, index) =>
              issueLog(9701 + index, target.targetId, `SYN-ISSUE-${String(target.targetId)}`, 1),
            ),
          },
          { status: 201 },
        );
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
  /* ⭐ 막힌 사유 문구는 적지 않고 발행 단추 잠김만 둔다(사용자 지시 2026-09-17). */
  it('라벨 종류를 고르기 전에는 발행이 잠긴다', async () => {
    renderScreen();

    await waitFor(() => {
      expect(issueButton()).toBeDisabled();
    });
    expect(screen.queryByText(t.actions.needsKind)).not.toBeInTheDocument();
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

  it('납품라벨은 구성 중인 단위도 목록에 남기되 고를 수 없게 한다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await chooseKind(user, '납품라벨');

    // 빠지지 않는다 — 빠지면 「구성 중」과 「이 출하에 없다」가 같은 모양이 된다.
    expect(await screen.findByText('SYN-SU-0002')).toBeInTheDocument();
    expect(screen.getByText(t.targets.status.blocked)).toBeInTheDocument();

    // 구성 중인 줄(두 번째)을 눌러도 선택으로 남지 않아 발행이 열리지 않는다.
    await user.click(await rowCheckbox(1));

    await waitFor(() => {
      expect(issueButton()).toBeDisabled();
    });
    expect(screen.queryByText(t.actions.needsTarget)).not.toBeInTheDocument();
  });

  it('납품라벨은 마감된 단위를 고르면 발행 단추가 열린다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await chooseKind(user, '납품라벨');
    await user.click(await rowCheckbox(0));

    await waitFor(() => expect(issueButton()).toBeEnabled());
  });

  /*
   * ⛔ **배분으로 발행하지 않는다**(SHIP-UNIT-01 P5 · 전달본 v4). 서버가 그 대상 유형을
   *    422 INVALID 로 거부하므로, 옛 대상이 남아 있으면 이 화면의 납품 라벨은 한 장도 나가지
   *    않는다 — 화면에는 그저 「발행 실패」로만 보인다.
   */
  it('납품라벨은 출하 단위를 대상으로 발행한다 — 배분이 아니다', async () => {
    const user = userEvent.setup();
    const requests: { request: Request; body: string }[] = [];
    renderScreen({ requests });

    await chooseKind(user, '납품라벨');
    await user.click(await rowCheckbox(0));
    await user.click(issueButton());

    await waitFor(() => {
      expect(requests.length).toBeGreaterThan(0);
    });

    const body = JSON.parse(nth(requests, 0).body) as Record<string, unknown>;

    expect(body).toMatchObject({
      documentTypeCode: 'DELIVERY_LABEL',
      targets: [{ targetTypeCode: 'SHIPPING_UNIT', targetId: 7001 }],
    });
    expect((body.targets as Record<string, unknown>[])[0]).not.toHaveProperty('lotId');
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
    renderScreen({ summaries: [summary(7001, 2, '2026-09-02T04:20:00Z')] });

    await chooseKind(user, '납품라벨');
    await user.click(await rowCheckbox(0));

    expect(await screen.findByText(t.reissue.notice(1))).toBeInTheDocument();
    expect(screen.getByText(t.actions.needsReason)).toBeInTheDocument();
    expect(issueButton()).toBeDisabled();
  });

  it('고를 수 있는 사유가 없으면 왜 재발행할 수 없는지 말한다', async () => {
    const user = userEvent.setup();
    renderScreen({ summaries: [summary(7001, 1)], reasons: [] });

    await chooseKind(user, '납품라벨');
    await user.click(await rowCheckbox(0));

    expect(await screen.findByText(t.reissue.empty)).toBeInTheDocument();
  });

  it('최초 발행과 재출력 대상을 섞어 고르면 같은 사유로 보내지 않고 분리하도록 막는다', async () => {
    const user = userEvent.setup();
    renderScreen({
      units: [CLOSED_UNIT, shippingUnit(7002, 'SYN-SU-0002', 'CLOSED')],
      summaries: [summary(7001, 1)],
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
      expect(requests.length).toBeGreaterThan(0);
    });

    /* 발행 뒤 곧바로 인쇄 보고가 뒤따르므로(사용자 지시 2026-09-17) 첫 요청이 발행이다. */
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
     * ⭐ **발행 다음 걸음이 실제로 선다**(SHIP-UNIT-01 P2·P5). POP 이 그리므로 그리기는 서버
     *    사정을 타지 않는다 — 한때 이 자리가 늘 「그림을 못 받았다」였고, 그 탓에 인쇄·보고까지
     *    한 번도 닿지 못했다.
     */
    await waitFor(() => {
      expect(requests.some((one) => one.request.url.endsWith(':report-print'))).toBe(true);
    });
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

    expect(
      requests.filter((one) => new URL(one.request.url).pathname === '/app/document-issues'),
    ).toHaveLength(1);
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

  /*
   * ⛔ **값이 모자라면 그리지 않고 멈춘다.** 출하번호를 못 받았는데 그리면 그 칸이 빈 라벨이
   *    종이로 나가고, 그것은 되돌릴 수 없다 — 기록은 이미 남았으므로 「다시 발행하지 말라」를
   *    말해야 회차가 또 오르지 않는다.
   */
  it('발행은 됐는데 그리기가 실패하면 「다시 발행하지 말라」고 말한다 — 회차가 또 오른다', async () => {
    const user = userEvent.setup();
    renderScreen({ shipmentFails: true });

    await chooseKind(user, '포장라벨');
    await user.click(await rowCheckbox(0));
    await user.click(issueButton());

    expect(await screen.findByText(t.outcome.renderFailed)).toBeInTheDocument();
  });

  /*
   * ⛔ **다시 그려도 회차는 오르지 않는다.** 그리기는 발행 «밖»이므로, 다시 그리는 것이 새
   *    기록을 만들면 종이 한 장 때문에 회차가 쌓인다 — 그리고 그 회차는 되돌릴 수 없다.
   * ⛔ **렌디션 경로로 요청이 한 번도 나가지 않는다.** 서버는 이 화면의 두 종류를 하나도 그려
   *    주지 않는다(전달본 v4 — 납품 라벨은 422).
   */
  it('라벨 다시 그리기를 여러 번 눌러도 회차를 올리지 않는다 — 렌디션 요청도 나가지 않는다', async () => {
    const user = userEvent.setup();
    const requests: { request: Request; body: string }[] = [];
    const renditionAttempts: number[] = [];
    renderScreen({ requests, renditionAttempts, shipmentFails: true });

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
   * ⭐ **발행하면 미리보기가 열린다**(SHIP-UNIT-01 P2·P5). 한때 이 자리는 「그림을 받지 못해
   *    잠긴 채로 남는다」였다 — 서버가 이 종류들을 그려 주지 않아서다. 지금은 POP 이 그리므로
   *    확인하고 인쇄까지 간다.
   */
  /* ⭐ 발행 뒤 곧바로 인쇄까지 가고, 미리보기는 그 뒤에도 열린다(사용자 지시 2026-09-17). */
  it('발행하면 곧바로 인쇄까지 가고 미리보기가 열린다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await chooseKind(user, '포장라벨');
    await user.click(await rowCheckbox(0));
    await user.click(issueButton());

    await waitFor(() =>
      expect(screen.getByRole('button', { name: t.actions.preview })).toBeEnabled(),
    );
  });

  /*
   * ⛔ **통로가 없는 것을 인쇄 성공으로 보고하지 않는다**(공유계약 F-6). 기록은 이미 남았으므로
   *    실패로 보고해야 「나오지 않은 라벨」이 나온 것으로 남지 않는다.
   */
  it('셸이 빈 사유로 실패해도 그 사실을 사유와 함께 보고한다', async () => {
    const user = userEvent.setup();
    const save = vi.fn<() => Promise<string>>().mockRejectedValue(new Error('   '));
    Object.defineProperty(window, 'pop', { configurable: true, value: { rendition: { save } } });

    const requests: { request: Request; body: string }[] = [];
    renderScreen({ requests });

    await chooseKind(user, '포장라벨');
    await user.click(await rowCheckbox(0));
    await user.click(issueButton());
    await user.click(await screen.findByRole('button', { name: t.actions.preview }));
    await user.click(await screen.findByRole('button', { name: t.preview.print }));

    await waitFor(() => {
      expect(save).toHaveBeenCalled();
    });

    const report = requests.find(({ request }) => /:report-print$/u.test(pathOf(request)));

    expect(report).toBeDefined();

    const body = JSON.parse(report?.body ?? '{}') as Record<string, unknown>;

    expect(body.outcome).toBe('FAILED');
    /* ⛔ 빈 사유로 보고하면 서버가 422 로 막는다 — 말 없는 실패에도 말을 붙인다. */
    expect(String(body.failureReason ?? '')).not.toBe('');
  });

  it('셸이 정상이면 POP 이 그린 바이트를 그대로 넘기고 성공으로 보고한다', async () => {
    const user = userEvent.setup();
    const save = vi
      .fn<(bytes: Uint8Array, label: string, now: string, format: string) => Promise<string>>()
      .mockResolvedValue('SYN/path');
    Object.defineProperty(window, 'pop', {
      configurable: true,
      value: { rendition: { save } },
    });

    const requests: { request: Request; body: string }[] = [];
    renderScreen({ requests });

    await chooseKind(user, '포장라벨');
    await user.click(await rowCheckbox(0));
    await user.click(issueButton());
    await user.click(await screen.findByRole('button', { name: t.actions.preview }));
    await user.click(await screen.findByRole('button', { name: t.preview.print }));

    await waitFor(() => {
      expect(save).toHaveBeenCalled();
    });

    /* ⭐ 포장 라벨 종이는 80 × 30 mm TSPL 로 나간다 — 그림은 크기가 어긋났다(2026-09-17). */
    const [bytes, , , format] = save.mock.calls[0] ?? [];

    expect(format).toBe('tspl');
    expect(new TextDecoder().decode(bytes)).toMatch(/^SIZE 80 mm,30 mm\r\n/u);

    const report = requests.find(({ request }) => /:report-print$/u.test(pathOf(request)));

    expect(JSON.parse(report?.body ?? '{}')).toMatchObject({ outcome: 'SUCCEEDED' });
  });
});

describe('ShippingPackingLabelScreen — 재진입 복구', () => {
  it('summary에서 누락된 마감 단위의 납품 라벨 복구 요청을 보낸다', async () => {
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
              /* 마감 단위만 후보다 — 구성 중(7002)은 세지 않는다. */
              summary(7001, 0),
              summary(7002, 0),
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
    await waitFor(() => expect(deliveryAction).toBeEnabled());

    await user.click(deliveryAction);

    await waitFor(() =>
      expect(
        requests.some(
          ({ request }) => request.method === 'POST' && pathOf(request) === '/app/document-issues',
        ),
      ).toBe(true),
    );
  });
});
