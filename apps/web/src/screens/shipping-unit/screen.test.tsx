import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PopIdentityProvider } from '../../patterns/pop-identity';
import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';

import { ShippingUnitScreen } from './screen';

const t = messages.shippingUnit;

const ROUTE = '/pop/shipping-units';

/** ⚠ 사번은 주소가 아니라 **셸 문맥**에서 온다 — 공급자가 없으면 전부 `null` 이다. */
const IDENTITY = {
  terminalId: 101,
  processes: [{ processId: 301 }],
  equipment: null,
  workerNo: '3391',
} as const;

const pathOf = (request: Request): string => new URL(request.url).pathname;

const SHIPMENT = { shipmentId: 501, shipmentNo: 'SH-20260917-0003', unassignedPackedBoxCount: 4 };

const partner = (code: string, name: string) => ({
  partnerId: 1,
  partnerCode: code,
  partnerName: name,
});

const content = (itemCode: string, lotNo: string) => ({
  itemId: 11,
  itemCode,
  itemName: 'COVER',
  lotId: 21,
  lotNo,
  qty: 240,
  uomId: 1,
  uomCode: 'EA',
});

const unit = (patch: Record<string, unknown> = {}) => ({
  shippingUnitId: 9001,
  shippingUnitNo: 'SU-20260917-0001',
  shippingUnitTypeCode: 'PALLET',
  statusCode: 'OPEN',
  shipmentId: 501,
  shipmentNo: 'SH-20260917-0003',
  customer: partner('100003', 'Samjin'),
  shipTo: partner('901463', 'Ha Noi'),
  boxCount: 0,
  createdAt: '2026-09-17T09:00:00+09:00',
  versionNo: 1,
  boxes: [],
  itemTotals: [],
  ...patch,
});

const box = (handlingUnitId: number, handlingUnitNo: string, seq: number) => ({
  handlingUnitId,
  handlingUnitNo,
  seq,
  contents: [content('F534F50200', 'SEED-0001')],
});

/** 「구성 완료」 탭에 서는 마감한 출하 단위. */
const CLOSED_UNIT = {
  ...unit({ shippingUnitId: 9100, shippingUnitNo: 'SU-20260916-0003', statusCode: 'CLOSED' }),
  boxCount: 1,
  closedAt: '2026-09-16T17:40:00+09:00',
};

interface Options {
  /** 상세가 돌려줄 판들. 부를 때마다 앞에서 하나씩 꺼낸다 — 쓰기 뒤 갱신을 흉내 낸다. */
  details?: Record<string, unknown>[];
  /** `:add-box` 가 거절할 사유. 없으면 받아들인다. */
  reject?: { code: string; field: string; message?: string };
  /** 관찰용 — 나간 요청을 담는다. */
  seen?: { path: string; query: string; method: string; ifMatch: string | null; body: unknown }[];
  /** `:add-box`·상세가 돌려줄 ETag 차례. */
  etags?: string[];
  /** 셸 문맥의 사번. 주지 않으면 `IDENTITY` 의 것. */
  workerNo?: string | null;
  /** 출하 단위 유형(SHIPPING_UNIT_TYPE). 주지 않으면 팔레트 하나. */
  types?: { code: string; codeName: string }[];
}

const renderScreen = (options: Options = {}) => {
  const details = options.details ?? [unit()];
  const etags = options.etags ?? ['"1"'];
  let detailCall = 0;
  let etagCall = 0;

  const nextEtag = (): string => etags[Math.min(etagCall++, etags.length - 1)] ?? '"1"';

  const record = async (request: Request): Promise<void> => {
    options.seen?.push({
      path: pathOf(request),
      query: new URL(request.url).search,
      method: request.method,
      ifMatch: request.headers.get('If-Match'),
      body: request.body === null ? null : await request.clone().json(),
    });
  };

  const routes: StubRoute[] = [
    {
      match: (request) => pathOf(request) === '/logistics/shipments',
      respond: async (request) => {
        await record(request);

        return jsonResponse({ items: [SHIPMENT], page: { page: 1, size: 50, total: 1 } });
      },
    },
    {
      match: (request) => pathOf(request) === '/mdm/code-values',
      respond: () => {
        const types = options.types ?? [{ code: 'PALLET', codeName: '팔레트' }];

        return jsonResponse({
          items: types.map((type, index) => ({
            codeValueId: index + 1,
            codeGroupId: 1,
            code: type.code,
            codeName: type.codeName,
            displayOrder: index + 1,
            isActive: true,
          })),
          page: { page: 1, size: 100, total: types.length },
        });
      },
    },
    {
      match: (request) => pathOf(request) === '/app/printers',
      respond: () =>
        jsonResponse({
          items: [
            { printerName: 'label-a', displayName: '라벨 A', status: 'READY', isDefault: true },
          ],
        }),
    },
    {
      match: (request) =>
        request.method === 'GET' && pathOf(request) === '/logistics/shipping-units',
      respond: async (request) => {
        await record(request);

        return jsonResponse({
          items: [CLOSED_UNIT],
          page: { page: 1, size: 5, total: 1 },
        });
      },
    },
    {
      match: (request) =>
        request.method === 'POST' && pathOf(request) === '/logistics/shipping-units',
      respond: async (request) => {
        await record(request);

        return jsonResponse(unit(), { status: 201, headers: { ETag: nextEtag() } });
      },
    },
    {
      match: (request) => pathOf(request).endsWith(':add-box'),
      respond: async (request) => {
        await record(request);

        if (options.reject !== undefined) {
          /*
           * ⚠ **`message` 를 반드시 싣는다.** 계약의 `ErrorItem` 이 필수로 두었고, 정규화가
           *   그 키가 없는 항목을 **봉투로 인정하지 않는다**(`api-client/errors.ts` 의
           *   `isErrorItem`) — 빠뜨리면 스텁이 서버보다 너그러워져 갈래가 전부 「모름」으로
           *   떨어지고, 화면이 다섯을 못 가르는데도 시험은 그 사실을 다른 이유로 말한다.
           */
          return jsonResponse(
            { errors: [{ scope: 'field', message: '서버가 거절했습니다', ...options.reject }] },
            { status: 400 },
          );
        }

        return jsonResponse(unit(), { headers: { ETag: nextEtag() } });
      },
    },
    {
      match: (request) => pathOf(request).endsWith(':close'),
      respond: async (request) => {
        await record(request);

        return jsonResponse(unit({ statusCode: 'CLOSED' }), { headers: { ETag: nextEtag() } });
      },
    },
    {
      match: (request) => pathOf(request) === '/app/document-issues',
      respond: async (request) => {
        await record(request);

        return jsonResponse(
          {
            items: [
              {
                documentIssueLogId: 77,
                documentTypeCode: 'DELIVERY_LABEL',
                target: {
                  targetId: 9001,
                  targetTypeCode: 'SHIPPING_UNIT',
                  displayName: 'SU-20260917-0001',
                },
                issueSeq: 1,
                issuedAt: '2026-09-17T10:00:00+09:00',
                printOutcome: 'PENDING',
              },
            ],
          },
          { status: 201 },
        );
      },
    },
    {
      match: (request) => pathOf(request).endsWith(':report-print'),
      respond: async (request) => {
        await record(request);

        return jsonResponse({ printOutcome: 'SUCCEEDED' });
      },
    },
    {
      match: (request) =>
        request.method === 'GET' && /\/logistics\/shipping-units\/\d+$/u.test(pathOf(request)),
      respond: (request) => {
        if (pathOf(request).endsWith(`/${String(CLOSED_UNIT.shippingUnitId)}`)) {
          return jsonResponse(
            unit({ ...CLOSED_UNIT, boxes: [box(7101, 'HU-CLOSED-1', 1)] }),
            { headers: { ETag: '"closed"' } },
          );
        }
        const body = details[Math.min(detailCall++, details.length - 1)] ?? unit();

        return jsonResponse(body, { headers: { ETag: '"detail"' } });
      },
    },
  ];

  return renderWithProviders(
    <PopIdentityProvider
      value={
        options.workerNo === undefined ? IDENTITY : { ...IDENTITY, workerNo: options.workerNo }
      }
    >
      <ShippingUnitScreen />
    </PopIdentityProvider>,
    { fetch: createStubFetch(routes), route: ROUTE },
  );
};

/** 출하는 왼쪽 「구성 대기」 목록 카드를 누르고, 유형은 단추로 고른다(#295 시안). */
const pickShipment = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(await screen.findByRole('button', { name: /SH-20260917-0003/u }));
};

const pickType = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(await screen.findByRole('radio', { name: '팔레트' }));
};

const openUnit = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await pickShipment(user);
  await pickType(user);
  await user.click(screen.getByRole('button', { name: t.unit.create }));
};

/** ① 유형·상자 등록에서 [다음] → ② 마감 단계. */
const toCloseStep = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: t.actions.next })).toBeEnabled();
  });
  await user.click(screen.getByRole('button', { name: t.actions.next }));
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('P-04-05 출하 단위 구성', () => {
  it('출하와 유형을 모두 골라야 새 단위를 만들 수 있다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await pickShipment(user);
    expect(await screen.findByRole('button', { name: t.unit.create })).toBeDisabled();

    await pickType(user);
    expect(screen.getByRole('button', { name: t.unit.create })).toBeEnabled();
  });

  /*
   * ⛔ **목록에 기간을 주지 않는다.** 「구성할 것이 남았나」는 날짜와 무관한 물음이라, 창을
   *    끼우면 어제 출하한 건의 남은 상자가 창 밖으로 빠져 이 화면에서 영영 안 보인다. 기간이
   *    **선택이 되는 조건이 `hasUnassignedPackedBox`** 이므로 그 축이 사라지면 기간은 다시
   *    필수다 — 둘을 한 시험에서 함께 붙든다.
   */
  it('미구성 상자 축만 걸고 기간은 주지 않는다', async () => {
    const seen: Options['seen'] = [];
    renderScreen({ seen });

    await screen.findByRole('button', { name: /SH-20260917-0003/u });

    const list = seen.find((call) => call.path === '/logistics/shipments');
    expect(list).toBeDefined();

    const query = new URLSearchParams(list?.query ?? '');
    expect(query.get('hasUnassignedPackedBox')).toBe('true');
    expect([...query.keys()].filter((key) => key.startsWith('shipDate'))).toEqual([]);
  });

  /*
   * ⛔ **단위를 만들기 전에는 상자를 읽을 수 없다.** 스캔 칸은 유형 바로 아래에 서지만 단위가 없으면
   *    잠겨 있고, 마감 단계로 갈 길(단계 줄 · [다음])도 없다 — 담당이 상자 앞에서 읽고 나서야 막힌
   *    것을 알지 않게. 단위는 지금처럼 [새 출하 단위] 를 눌렀을 때만 만든다.
   */
  it('단위를 만들기 전에는 스캔 칸이 잠겨 있고 마감 단계로 갈 수 없다', async () => {
    const user = userEvent.setup();
    const seen: Options['seen'] = [];
    renderScreen({ seen });

    await pickShipment(user);
    await pickType(user);

    expect(screen.getByLabelText(t.scan.label)).toBeDisabled();
    expect(screen.queryByRole('button', { name: new RegExp(t.steps.close, 'u') })).toBeNull();
    expect(screen.queryByRole('button', { name: t.actions.next })).toBeNull();
    /* 유형만 골라서는 아무것도 만들지 않는다. */
    expect(seen.some((call) => call.method === 'POST')).toBe(false);
  });

  /* ⛔ 단위를 만들면 유형은 그 단위의 것이다 — 같은 단계에 남은 유형 단추를 잠근다. */
  it('단위를 만들면 같은 단계의 유형 단추가 잠기고 스캔 칸이 열린다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await openUnit(user);

    await waitFor(() => {
      expect(screen.getByLabelText(t.scan.label)).toBeEnabled();
    });
    expect(screen.getByRole('radio', { name: '팔레트' })).toBeDisabled();
  });

  /*
   * ⭐ 유형은 고객사가 늘리는 코드다 — 5개까지는 한 줄 단추, 넘으면 칸 하나(고르기 창)로 접어
   *    아래 상자 자리를 지킨다.
   */
  it('유형이 5개를 넘으면 단추 대신 고르기 칸 하나로 보인다', async () => {
    const user = userEvent.setup();
    renderScreen({
      types: [
        { code: 'PALLET', codeName: '팔레트' },
        { code: 'BUNDLE', codeName: '번들' },
        { code: 'CASE', codeName: '케이스' },
        { code: 'DRUM', codeName: '드럼' },
        { code: 'BAG', codeName: '포대' },
        { code: 'CRATE', codeName: '크레이트' },
      ],
    });

    await pickShipment(user);

    expect(await screen.findByRole('combobox', { name: t.unit.typeLabel })).toBeInTheDocument();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('유형이 5개면 한 줄 단추로 보인다', async () => {
    const user = userEvent.setup();
    renderScreen({
      types: [
        { code: 'PALLET', codeName: '팔레트' },
        { code: 'BUNDLE', codeName: '번들' },
        { code: 'CASE', codeName: '케이스' },
        { code: 'DRUM', codeName: '드럼' },
        { code: 'BAG', codeName: '포대' },
      ],
    });

    await pickShipment(user);

    expect(await screen.findAllByRole('radio')).toHaveLength(5);
    expect(screen.queryByRole('combobox', { name: t.unit.typeLabel })).toBeNull();
  });

  /* ⭐ 사번 미확인은 모든 POP 화면이 같은 맨 위 띠로 말한다(사용자 지시 2026-09-17). */
  it('사번이 없으면 맨 위에 공용 사번 미확인 띠가 선다', async () => {
    renderScreen({ workerNo: null });

    expect(await screen.findByText(messages.popChrome.workerMissing)).toBeInTheDocument();
  });

  it('사번이 있으면 사번 미확인 띠가 없다', async () => {
    renderScreen();

    await screen.findByRole('button', { name: /SH-20260917-0003/u });
    expect(screen.queryByText(messages.popChrome.workerMissing)).not.toBeInTheDocument();
  });

  it('단위를 만들면 스캔 칸이 열린다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await openUnit(user);

    await waitFor(() => {
      expect(screen.getByLabelText(t.scan.label)).toBeEnabled();
    });
  });

  /*
   * ⛔⛔ **거절 다섯 갈래가 «서로 다른» 말을 해야 한다.** 코드만 보면 「마감된 단위」와
   *    「포장 안 된 상자」가 둘 다 `STATE_LOCKED` 로 뭉개진다 — `field` 를 함께 봐야 갈린다.
   *    뭉개지면 담당은 할 수 없는 조치를 되풀이한다.
   */
  it.each([
    ['STATE_LOCKED', 'shippingUnitId', t.rejection.unitClosed],
    ['STATE_LOCKED', 'handlingUnitNo', t.rejection.notPacked],
    ['INVALID', 'handlingUnitNo', t.rejection.noAllocation],
    ['PAIR', 'handlingUnitNo', t.rejection.otherShipment],
    ['UNIQUE_VIOLATION', 'handlingUnitNo', t.rejection.alreadyAssigned],
  ])('거절 %s/%s 을 그 사유로 말한다', async (code, field, text) => {
    /* ⭐ 서버가 제 말을 보내와도 «아는 갈래»는 화면의 안내가 이긴다 — 담당이 할 일이 그 말이다. */
    const user = userEvent.setup();
    renderScreen({ reject: { code, field } });

    await openUnit(user);
    await waitFor(() => {
      expect(screen.getByLabelText(t.scan.label)).toBeEnabled();
    });
    await user.type(screen.getByLabelText(t.scan.label), 'HU-20260917-0002{Enter}');

    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  /* ⭐ 스캐너가 Enter 를 붙이지 않아도 포장 라벨이 읽힌다(사용자 지시 2026-09-17). */
  it('포장 라벨은 Enter 없이 스캐너 속도로 들어오면 등록한다', async () => {
    const user = userEvent.setup();
    /*
     * 키 사이 간격을 0 으로 고정한다 — 실제 시계면 부하에 따라 손 속도로 읽힌다. 호출마다
     * 늘리지 않는 것은 React 스케줄러도 이 시계를 불러 키 사이 간격이 부하만큼 벌어지기 때문이다.
     */
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
    const seen: Options['seen'] = [];
    renderScreen({ seen });

    await openUnit(user);
    await waitFor(() => {
      expect(screen.getByLabelText(t.scan.label)).toBeEnabled();
    });
    await user.type(screen.getByLabelText(t.scan.label), 'HU-2026-000070');

    await waitFor(() => {
      expect(seen.some((call) => call.path.endsWith(':add-box'))).toBe(true);
    });
    now.mockRestore();
  });

  /* ⚠ 스캐너가 끊긴 짧은 조각은 Enter 없이 제출하지 않는다(리뷰 M4 · 6자 미만). */
  it('짧은 조각은 스캐너 속도로 들어와도 Enter 없이 등록하지 않는다', async () => {
    const user = userEvent.setup();
    /*
     * 키 사이 간격을 0 으로 고정한다 — 실제 시계면 부하에 따라 손 속도로 읽힌다. 호출마다
     * 늘리지 않는 것은 React 스케줄러도 이 시계를 불러 키 사이 간격이 부하만큼 벌어지기 때문이다.
     */
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
    const seen: Options['seen'] = [];
    renderScreen({ seen });

    await openUnit(user);
    await waitFor(() => {
      expect(screen.getByLabelText(t.scan.label)).toBeEnabled();
    });
    await user.type(screen.getByLabelText(t.scan.label), 'HU-1');
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(seen.some((call) => call.path.endsWith(':add-box'))).toBe(false);
    now.mockRestore();
  });

  it('모르는 사유는 서버가 준 말을 그대로 보인다', async () => {
    const user = userEvent.setup();
    renderScreen({ reject: { code: 'NEW_RULE', field: 'x', message: '아직 모르는 규칙입니다' } });

    await openUnit(user);
    await waitFor(() => {
      expect(screen.getByLabelText(t.scan.label)).toBeEnabled();
    });
    await user.type(screen.getByLabelText(t.scan.label), 'HU-1{Enter}');

    expect(
      await screen.findByText(t.rejection.spoken('아직 모르는 규칙입니다')),
    ).toBeInTheDocument();
  });

  /*
   * ⛔⛔ **상자가 없으면 마감하지 않는다**(설계 §4-6 — 서버가 400). 화면이 먼저 막아, 되돌릴
   *    수 없는 조작을 눌렀다가 거절당하는 일을 없앤다.
   */
  it('상자가 하나도 없으면 마감 단계로 넘어가지 못한다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await openUnit(user);

    await waitFor(() => {
      expect(screen.getByLabelText(t.scan.label)).toBeEnabled();
    });
    expect(screen.getByRole('button', { name: t.actions.next })).toBeDisabled();
    expect(screen.queryByRole('button', { name: t.close.action })).toBeNull();
  });

  /* ⛔ 되돌릴 수 없다 — 확인창이 그 사실을 «먼저» 말한다. */
  /* ⭐ 되묻지 않고 바로 마감한다(사용자 지시 2026-09-17). */
  it('마감을 누르면 되묻지 않고 바로 마감 요청이 나간다', async () => {
    const user = userEvent.setup();
    const seen: Options['seen'] = [];
    renderScreen({ seen, details: [unit({ boxes: [box(7001, 'HU-1', 1)], boxCount: 1 })] });

    await openUnit(user);
    await toCloseStep(user);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.close.action })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: t.close.action }));

    await waitFor(() => {
      expect(seen.some((call) => call.path.endsWith(':close'))).toBe(true);
    });
  });

  /*
   * ⛔⛔ **마감의 `If-Match` 는 «마지막 쓰기»가 준 값이어야 한다.** 생성 때 받은 것을 들고
   *    있으면 상자를 넣은 만큼 판이 올라 409 로 막힌다 — 상자를 넣고 마감하는 정상 흐름이
   *    통째로 서지 않는다.
   */
  it('마감이 상자를 넣은 «뒤»의 판 번호를 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Options['seen'] = [];
    renderScreen({
      seen,
      etags: ['"1"', '"2"', '"3"'],
      details: [
        unit(),
        unit({ boxes: [box(7001, 'HU-1', 1)], boxCount: 1 }),
        unit({ boxes: [box(7001, 'HU-1', 1)], boxCount: 1 }),
        unit({ statusCode: 'CLOSED', boxes: [box(7001, 'HU-1', 1)], boxCount: 1 }),
      ],
    });

    await openUnit(user);
    await waitFor(() => {
      expect(screen.getByLabelText(t.scan.label)).toBeEnabled();
    });
    await user.type(screen.getByLabelText(t.scan.label), 'HU-1{Enter}');

    await toCloseStep(user);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.close.action })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: t.close.action }));

    await waitFor(() => {
      expect(seen.some((call) => call.path.endsWith(':close'))).toBe(true);
    });

    const close = seen.find((call) => call.path.endsWith(':close'));
    /* 생성이 `"1"`, 상자 넣기가 `"2"` 를 줬다 — 마감은 뒤엣것을 써야 한다. */
    expect(close?.ifMatch).toBe('"2"');
  });

  /*
   * ⭐ **마감과 발행을 갈라 둔다.** 마감은 되돌릴 수 없으므로 라벨이 안 나왔다고 마감을 없던
   *    일로 만들 수 없다. 발행 대상은 `SHIPPING_UNIT` 이다(대상이 배분에서 바뀐 것이 이번
   *    작업의 핵심이다).
   */
  it('마감 뒤 납품 라벨을 출하 단위 대상으로 발행하고 인쇄 결과를 보고한다', async () => {
    const user = userEvent.setup();
    const seen: Options['seen'] = [];
    const save = vi.fn(async () => 'syn://printed');
    const keep = vi.fn(async () => 'SYN/kept');
    Object.defineProperty(window, 'pop', {
      configurable: true,
      value: { rendition: { save, keep } },
    });

    renderScreen({
      seen,
      details: [
        unit({ boxes: [box(7001, 'HU-1', 1)], boxCount: 1 }),
        unit({ statusCode: 'CLOSED', boxes: [box(7001, 'HU-1', 1)], boxCount: 1 }),
      ],
    });

    await openUnit(user);
    await toCloseStep(user);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.close.action })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: t.close.action }));

    await waitFor(() => {
      expect(save).toHaveBeenCalled();
    });

    const issue = seen.find((call) => call.path === '/app/document-issues');
    expect(issue?.body).toMatchObject({
      documentTypeCode: 'DELIVERY_LABEL',
      targets: [{ targetTypeCode: 'SHIPPING_UNIT', targetId: 9001 }],
    });

    /*
     * ⭐ 종이는 80 × 30 mm TSPL 로 나간다 — 점판을 BITMAP 으로 통째 싣는다(사용자 지시 2026-09-17).
     *    그림(PNG)은 인쇄 없이 단말에 따로 남긴다.
     */
    const [bytes, , , format] = save.mock.calls[0] as unknown as [
      Uint8Array,
      string,
      string,
      string,
    ];
    expect(format).toBe('tspl');
    const command = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
    expect(command.startsWith('SIZE 80 mm,30 mm\r\n')).toBe(true);
    expect(command).toContain('BITMAP 0,0,80,240,0,');

    const [kept, , , keptFormat] = keep.mock.calls[0] as unknown as [
      Uint8Array,
      string,
      string,
      string,
    ];
    expect(keptFormat).toBe('png');
    expect([...kept.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    /* ⛔ 종이가 나왔으면 그 사실을 서버에 보고한다 — 보고가 없으면 회차가 PENDING 으로 남는다. */
    await waitFor(() => {
      expect(seen.some((call) => call.path.endsWith(':report-print'))).toBe(true);
    });
    expect(seen.find((call) => call.path.endsWith(':report-print'))?.body).toMatchObject({
      outcome: 'SUCCEEDED',
    });

    Reflect.deleteProperty(window, 'pop');
  });

  /*
   * ⭐ 「구성 완료」 탭은 마감한 출하 단위 목록(`statusCode=CLOSED`)을 보이고, 고르면 마감 결과만
   *    보인다 — 단계 줄 · 스캔 칸 · 입력 단추가 없다(#295 시안).
   */
  it('구성 완료 탭은 마감한 단위를 묻고, 고르면 결과만 보인다', async () => {
    const user = userEvent.setup();
    const seen: Options['seen'] = [];
    renderScreen({ seen });

    await user.click(await screen.findByRole('tab', { name: new RegExp(t.tabs.done, 'u') }));
    await user.click(await screen.findByRole('button', { name: /SU-20260916-0003/u }));

    expect(await screen.findByText('HU-CLOSED-1')).toBeInTheDocument();
    const list = seen.find(
      (call) => call.method === 'GET' && call.path === '/logistics/shipping-units',
    );
    expect(new URLSearchParams(list?.query ?? '').get('statusCode')).toBe('CLOSED');
    expect(screen.queryByLabelText(t.scan.label)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.close.action })).toBeNull();
    expect(screen.queryByRole('button', { name: t.unit.create })).toBeNull();
  });
});
