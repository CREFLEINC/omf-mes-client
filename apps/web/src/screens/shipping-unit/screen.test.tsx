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

const partner = (code: string, name: string) => ({ partnerId: 1, partnerCode: code, partnerName: name });

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

interface Options {
  /** 상세가 돌려줄 판들. 부를 때마다 앞에서 하나씩 꺼낸다 — 쓰기 뒤 갱신을 흉내 낸다. */
  details?: Record<string, unknown>[];
  /** `:add-box` 가 거절할 사유. 없으면 받아들인다. */
  reject?: { code: string; field: string; message?: string };
  /** 관찰용 — 나간 요청을 담는다. */
  seen?: { path: string; method: string; ifMatch: string | null; body: unknown }[];
  /** `:add-box`·상세가 돌려줄 ETag 차례. */
  etags?: string[];
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
      method: request.method,
      ifMatch: request.headers.get('If-Match'),
      body: request.body === null ? null : await request.clone().json(),
    });
  };

  const routes: StubRoute[] = [
    {
      match: (request) => pathOf(request) === '/logistics/shipments',
      respond: () => jsonResponse({ items: [SHIPMENT], page: { page: 1, size: 50, total: 1 } }),
    },
    {
      match: (request) => pathOf(request) === '/mdm/code-values',
      respond: () =>
        jsonResponse({
          items: [
            {
              codeValueId: 1,
              codeGroupId: 1,
              code: 'PALLET',
              codeName: '팔레트',
              displayOrder: 1,
              isActive: true,
            },
          ],
          page: { page: 1, size: 100, total: 1 },
        }),
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
      respond: () => {
        const body = details[Math.min(detailCall++, details.length - 1)] ?? unit();

        return jsonResponse(body, { headers: { ETag: '"detail"' } });
      },
    },
  ];

  return renderWithProviders(
    <PopIdentityProvider value={IDENTITY}>
      <ShippingUnitScreen />
    </PopIdentityProvider>,
    { fetch: createStubFetch(routes), route: ROUTE },
  );
};

/** POP 의 고르는 자리는 드롭다운이 아니라 팝업이다(G-34) — 여는 것은 `combobox` 다. */
const pick = async (
  user: ReturnType<typeof userEvent.setup>,
  field: string,
  option: RegExp | string,
): Promise<void> => {
  await user.click(await screen.findByRole('combobox', { name: field }));
  await user.click(await screen.findByRole('option', { name: option }));
};

const openUnit = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await pick(user, t.entry.label, /SH-20260917-0003/u);
  await pick(user, t.unit.typeLabel, '팔레트');
  await user.click(screen.getByRole('button', { name: t.unit.create }));
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('P-04-05 출하 단위 구성', () => {
  it('출하와 유형을 모두 골라야 새 단위를 만들 수 있다', async () => {
    const user = userEvent.setup();
    renderScreen();

    expect(await screen.findByRole('button', { name: t.unit.create })).toBeDisabled();

    await pick(user, t.entry.label, /SH-20260917-0003/u);
    expect(screen.getByRole('button', { name: t.unit.create })).toBeDisabled();

    await pick(user, t.unit.typeLabel, '팔레트');
    expect(screen.getByRole('button', { name: t.unit.create })).toBeEnabled();
  });

  /*
   * ⚠ **창을 늘 적는다.** 계약이 기간을 필수로 두어 창 밖의 미구성 출하는 목록에 서지 않는다 —
   *   적지 않으면 담당은 남은 것이 없다고 읽는다.
   */
  it('목록이 훑는 창을 함께 적는다', async () => {
    renderScreen();

    expect(await screen.findByText(t.entry.window(30))).toBeInTheDocument();
  });

  /*
   * ⛔ **단위를 만들기 전에는 스캔 칸이 잠긴다.** 열어 두면 담당이 상자 앞에서 읽고 나서야
   *    막힌 것을 안다 — 스캐너를 든 사람에게 그 한 번은 큰 낭비다.
   */
  it('단위를 만들기 전에는 스캔 칸이 잠기고 사유를 말한다', async () => {
    renderScreen();

    const field = await screen.findByLabelText(t.scan.label);
    expect(field).toBeDisabled();
    expect(field).toHaveAttribute('placeholder', t.scan.locked);
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

  it('모르는 사유는 서버가 준 말을 그대로 보인다', async () => {
    const user = userEvent.setup();
    renderScreen({ reject: { code: 'NEW_RULE', field: 'x', message: '아직 모르는 규칙입니다' } });

    await openUnit(user);
    await waitFor(() => {
      expect(screen.getByLabelText(t.scan.label)).toBeEnabled();
    });
    await user.type(screen.getByLabelText(t.scan.label), 'HU-1{Enter}');

    expect(await screen.findByText(t.rejection.spoken('아직 모르는 규칙입니다'))).toBeInTheDocument();
  });

  /*
   * ⛔⛔ **상자가 없으면 마감하지 않는다**(설계 §4-6 — 서버가 400). 화면이 먼저 막아, 되돌릴
   *    수 없는 조작을 눌렀다가 거절당하는 일을 없앤다.
   */
  it('상자가 하나도 없으면 마감이 잠기고 사유를 말한다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await openUnit(user);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.close.action })).toBeDisabled();
    });
    expect(screen.getByText(t.close.needsBox)).toBeInTheDocument();
  });

  /* ⛔ 되돌릴 수 없다 — 확인창이 그 사실을 «먼저» 말한다. */
  it('마감을 누르면 되돌릴 수 없다는 말이 먼저 선다', async () => {
    const user = userEvent.setup();
    renderScreen({ details: [unit({ boxes: [box(7001, 'HU-1', 1)], boxCount: 1 })] });

    await openUnit(user);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.close.action })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: t.close.action }));

    expect(await screen.findByText(t.close.confirmBody)).toBeInTheDocument();
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

    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.close.action })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: t.close.action }));
    await user.click(await screen.findByRole('button', { name: t.close.confirmAction }));

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
    Object.defineProperty(window, 'pop', { configurable: true, value: { rendition: { save } } });

    renderScreen({
      seen,
      details: [
        unit({ boxes: [box(7001, 'HU-1', 1)], boxCount: 1 }),
        unit({ statusCode: 'CLOSED', boxes: [box(7001, 'HU-1', 1)], boxCount: 1 }),
      ],
    });

    await openUnit(user);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.close.action })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: t.close.action }));
    await user.click(await screen.findByRole('button', { name: t.close.confirmAction }));

    await waitFor(() => {
      expect(save).toHaveBeenCalled();
    });

    const issue = seen.find((call) => call.path === '/app/document-issues');
    expect(issue?.body).toMatchObject({
      documentTypeCode: 'DELIVERY_LABEL',
      targets: [{ targetTypeCode: 'SHIPPING_UNIT', targetId: 9001 }],
    });

    /* POP 이 그린 것은 언제나 그림이다 — PNG 머리 여덟 바이트로 확인한다. */
    const [bytes, , , format] = save.mock.calls[0] as unknown as [
      Uint8Array,
      string,
      string,
      string,
    ];
    expect(format).toBe('png');
    expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    /* ⛔ 종이가 나왔으면 그 사실을 서버에 보고한다 — 보고가 없으면 회차가 PENDING 으로 남는다. */
    await waitFor(() => {
      expect(seen.some((call) => call.path.endsWith(':report-print'))).toBe(true);
    });
    expect(seen.find((call) => call.path.endsWith(':report-print'))?.body).toMatchObject({
      outcome: 'SUCCEEDED',
    });

    Reflect.deleteProperty(window, 'pop');
  });
});
