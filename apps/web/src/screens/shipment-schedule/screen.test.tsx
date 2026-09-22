import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useSearchParams } from 'react-router';
import { describe, expect, it } from 'vitest';

import { pickDate } from '../../test/date-picker';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { partnerFixtures, shipmentRequest, shipmentRequestFixtures } from './fixtures';
import { ShipmentScheduleScreen } from './screen';

const t = messages.shipmentSchedule;

const ROUTE = '/shipment/shipment-schedule';
const LIST_PATH = '/logistics/shipment-requests';
const PARTNERS_PATH = '/mdm/partners';

const ROWS = shipmentRequestFixtures;

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

const listBody = (
  items: unknown[],
  page: Partial<{ page: number; size: number; total: number }> = {},
) => ({ items, page: { page: 1, size: 50, total: items.length, ...page } });

const listRoute = (
  items: unknown[] = ROWS,
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isGet(request, LIST_PATH),
  respond: () => jsonResponse(listBody(items, page)),
});

const failingListRoute = (status: number, body: unknown = { message: '' }): StubRoute => ({
  match: (request) => isGet(request, LIST_PATH),
  respond: () => jsonResponse(body, { status }),
});

/** 조건이 걸린 조회에는 그 조건에 맞는 행만 돌려준다. */
const filteringListRoute = (): StubRoute => ({
  match: (request) => isGet(request, LIST_PATH),
  respond: (request) => {
    const progress = new URL(request.url).searchParams.get('shipmentProgressCode');
    const items =
      progress === null ? ROWS : ROWS.filter((row) => row.shipmentProgressCode === progress);

    return jsonResponse(listBody(items));
  },
});

const lookupRoute = (
  pathname: string,
  items: unknown[],
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse(listBody(items, page)),
});

const failingLookupRoute = (pathname: string): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse({ message: '' }, { status: 500 }),
});

/** 고객·납품처 둘 다 같은 자원(`/mdm/partners`)에서 온다 — 독립 훅 둘이 같은 경로를 두 번 부른다. */
const partnerRoutes = (): StubRoute[] => [lookupRoute(PARTNERS_PATH, partnerFixtures)];

const LocationProbe = () => {
  const location = useLocation();

  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

const SearchProbe = ({ to }: { to: string }) => {
  const [, setSearchParams] = useSearchParams();

  return (
    <button
      type="button"
      onClick={() => {
        setSearchParams(new URLSearchParams(to));
      }}
    >
      주소 이동
    </button>
  );
};

const renderScreen = (
  routes: StubRoute[],
  search = '',
  navigateTo = '',
): { requests: RecordedRequest[]; user: ReturnType<typeof userEvent.setup> } => {
  const { fetch, requests } = createRecordingFetch(routes);

  renderWithProviders(
    <>
      <ShipmentScheduleScreen />
      <LocationProbe />
      <SearchProbe to={navigateTo} />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, user: userEvent.setup() };
};

const requestsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === pathname);

const currentLocation = (): string => screen.getByTestId('location').textContent ?? '';

const listTable = (): HTMLElement => screen.getAllByRole('table')[0] as HTMLElement;

const SHIP_DATE_FROM = '?shipDateFrom=2026-08-01';

describe('ShipmentScheduleScreen — 출하일 시작 없이는 조회하지 않는다', () => {
  /* L-3 필수 — W-01-09(기간이 완전히 선택)와 반대다. */
  it('출하일 시작 없이 진입하면 요청이 나가지 않고 필수 사유가 보인다', async () => {
    const { requests } = renderScreen([listRoute(), ...partnerRoutes()]);

    await screen.findByText(t.reasons.periodRequired);

    expect(requestsTo(requests, LIST_PATH)).toHaveLength(0);
    expect(screen.getByText(t.empty.notQueriedTitle)).toBeInTheDocument();
  });

  it('출하일 시작을 채우면 조회가 나간다', async () => {
    const { requests } = renderScreen([listRoute(), ...partnerRoutes()], SHIP_DATE_FROM);

    await screen.findByText('SAMPLE-SR-0001');

    expect(requestsTo(requests, LIST_PATH)).toHaveLength(1);
  });

  it('종료만 채우고 시작이 없으면 여전히 조회하지 않는다', async () => {
    const { requests } = renderScreen([listRoute(), ...partnerRoutes()], '?shipDateTo=2026-08-31');

    await screen.findByText(t.reasons.periodRequired);

    expect(requestsTo(requests, LIST_PATH)).toHaveLength(0);
  });

  it('없는 날짜가 시작에 있으면 요청을 보내지 않고 형식 사유를 낸다', async () => {
    const { requests } = renderScreen(
      [listRoute(), ...partnerRoutes()],
      '?shipDateFrom=2026-02-31',
    );

    await screen.findByText(t.reasons.periodInvalid);

    expect(requestsTo(requests, LIST_PATH)).toHaveLength(0);
  });
});

describe('ShipmentScheduleScreen — 조건과 주소', () => {
  it('주소의 조건이 요청 쿼리에 그대로 실린다', async () => {
    const { requests } = renderScreen(
      [listRoute(), ...partnerRoutes()],
      '?shipDateFrom=2026-08-01&shipDateTo=2026-08-31&customer=9101&shipToPartner=9111&progress=PARTIALLY_SHIPPED&inspection=true',
    );

    await screen.findByText('SAMPLE-SR-0001');

    const query = requestsTo(requests, LIST_PATH)[0]?.url.searchParams;

    expect(query?.get('shipDateFrom')).toBe('2026-08-01');
    expect(query?.get('shipDateTo')).toBe('2026-08-31');
    expect(query?.get('customerId')).toBe('9101');
    expect(query?.get('shipToPartnerId')).toBe('9111');
    expect(query?.get('shipmentProgressCode')).toBe('PARTIALLY_SHIPPED');
    expect(query?.has('statusCode')).toBe(false);
    expect(query?.get('shippingInspectionRequired')).toBe('true');
  });

  it('조건 줄에서 조회하면 주소와 요청에 함께 나타난다', async () => {
    const { requests, user } = renderScreen([listRoute(), ...partnerRoutes()], SHIP_DATE_FROM);

    await screen.findByText('SAMPLE-SR-0001');

    /* 달력 칸은 글자로 치는 자리가 아니다 — 열어서 고른다(`test/date-picker`). */
    await pickDate(user, screen.getByLabelText(t.fields.periodTo), '2026-08-31');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH)).toHaveLength(2);
    });

    expect(currentLocation()).toContain('shipDateTo=2026-08-31');
  });

  it('정수가 아닌 참조 조건은 버리고 조회한다', async () => {
    const { requests } = renderScreen(
      [listRoute(), ...partnerRoutes()],
      `${SHIP_DATE_FROM}&customer=abc&shipToPartner=1.5&page=0`,
    );

    await screen.findByText('SAMPLE-SR-0001');

    const query = requestsTo(requests, LIST_PATH)[0]?.url.searchParams;

    expect(query?.has('customerId')).toBe(false);
    expect(query?.has('shipToPartnerId')).toBe(false);
    expect(query?.has('page')).toBe(false);
  });

  it('뒤집힌 기간은 요청을 보내지 않는다', async () => {
    const { requests } = renderScreen(
      [listRoute(), ...partnerRoutes()],
      '?shipDateFrom=2026-08-31&shipDateTo=2026-08-01',
    );

    await screen.findByText(t.reasons.periodReversed);

    expect(requestsTo(requests, LIST_PATH)).toHaveLength(0);
  });

  it('조회했는데 0건이면 「결과 없음」이다', async () => {
    renderScreen([listRoute([], { total: 0 }), ...partnerRoutes()], SHIP_DATE_FROM);

    await screen.findByText(t.empty.noResultTitle);

    expect(screen.queryByText(t.empty.notQueriedTitle)).not.toBeInTheDocument();
  });
});

describe('ShipmentScheduleScreen — 정렬', () => {
  it('머리글을 누르면 sort가 요청에 실리고 쪽이 첫 쪽으로 돌아간다', async () => {
    const { requests, user } = renderScreen(
      [listRoute(ROWS, { total: 120 }), ...partnerRoutes()],
      `${SHIP_DATE_FROM}&page=2`,
    );

    await screen.findByText('SAMPLE-SR-0001');
    const header = screen.getByRole('columnheader', { name: t.table.requestedShipDate });
    await user.click(within(header).getByRole('button'));

    await waitFor(() => {
      expect(currentLocation()).toContain('sort=requestedShipDate');
    });

    expect(currentLocation()).not.toContain('page=');
    expect(requestsTo(requests, LIST_PATH).at(-1)?.url.searchParams.get('sort')).toBe(
      'requestedShipDate',
    );
  });

  it('같은 열을 다시 누르면 정렬이 풀린다', async () => {
    const { user } = renderScreen(
      [listRoute(), ...partnerRoutes()],
      `${SHIP_DATE_FROM}&sort=customerId`,
    );

    await screen.findByText('SAMPLE-SR-0001');
    const header = screen.getByRole('columnheader', { name: t.table.customer });
    await user.click(within(header).getByRole('button'));

    await waitFor(() => {
      expect(currentLocation()).not.toContain('sort=');
    });
  });

  /* 「진행」은 계약 정렬 열거값 밖이라 정렬 버튼이 서지 않는다. */
  it('진행 열에는 정렬 버튼이 없다', async () => {
    renderScreen([listRoute(), ...partnerRoutes()], SHIP_DATE_FROM);

    await screen.findByText('SAMPLE-SR-0001');

    const header = screen.getByRole('columnheader', { name: t.table.progress });
    expect(within(header).queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('ShipmentScheduleScreen — 조회 실패', () => {
  it('조회에 실패하면 배너와 다시 시도가 나온다', async () => {
    const { requests, user } = renderScreen(
      [failingListRoute(500), ...partnerRoutes()],
      SHIP_DATE_FROM,
    );

    await screen.findByText(messages.httpError.loadTitle);

    const before = requestsTo(requests, LIST_PATH).length;
    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(before);
    });
  });

  it('권한이 없으면 다시 시도를 내지 않는다', async () => {
    renderScreen([failingListRoute(403), ...partnerRoutes()], SHIP_DATE_FROM);

    await screen.findByText(messages.httpError.forbidden);

    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it('조회에 실패해도 조건 줄은 남는다', async () => {
    renderScreen([failingListRoute(500), ...partnerRoutes()], SHIP_DATE_FROM);

    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.getByRole('button', { name: messages.common.search })).toBeInTheDocument();
  });
});

describe('ShipmentScheduleScreen — 참조 값', () => {
  it('참조 목록이 오면 이름으로 보인다', async () => {
    renderScreen([listRoute(), ...partnerRoutes()], SHIP_DATE_FROM);

    expect(await screen.findAllByText('SAMPLE-CUS-01 · 합성 고객 가')).not.toHaveLength(0);
    expect(await screen.findAllByText('SAMPLE-SHT-01 · 합성 납품처 가')).not.toHaveLength(0);
  });

  it('참조 목록에 없는 번호는 「알 수 없음」이다', async () => {
    renderScreen([listRoute(), ...partnerRoutes()], SHIP_DATE_FROM);

    await screen.findAllByText('SAMPLE-CUS-01 · 합성 고객 가');

    // 9002 행의 customerId(9102)는 목록에 없다.
    expect(listTable()).toHaveTextContent(t.values.unknown);
  });

  it('참조 목록 조회가 실패하면 사유와 다시 시도를 낸다', async () => {
    const { requests, user } = renderScreen(
      [listRoute(), failingLookupRoute(PARTNERS_PATH)],
      SHIP_DATE_FROM,
    );

    await screen.findByText(t.reasons.referencesFailed);

    expect(listTable()).toHaveTextContent(t.values.referenceFailed);

    const before = requestsTo(requests, PARTNERS_PATH).length;
    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, PARTNERS_PATH).length).toBeGreaterThan(before);
    });
  });
});

describe('ShipmentScheduleScreen — 요청/배정/출하·검사 열', () => {
  it('라인 합계를 한 칸에 「요청 / 배정 / 출하」로 보인다', async () => {
    renderScreen([listRoute(), ...partnerRoutes()], SHIP_DATE_FROM);

    await screen.findByText('SAMPLE-SR-0001');

    expect(listTable()).toHaveTextContent('500 / 500 / 500');
  });

  /* ⛔ 화면에 `NaN` 이 나가지 않는다 — 88단계 66번에서 실제로 나갔다(client#1042). */
  it('수량 칸이 비어 온 축은 빈 표기로 그리고 NaN 을 내지 않는다', async () => {
    const broken = [
      {
        ...ROWS[0],
        /* 배정만 오고 요청·출하는 비어 온 응답 — 실측된 모양이다. */
        lines: [
          {
            shipmentRequestLineId: 9701,
            lineNo: 1,
            itemId: 9301,
            allocatedQty: 500,
            uomId: 9501,
            shippingInspectionRequired: false,
          },
        ],
      },
    ];
    renderScreen([listRoute(broken), ...partnerRoutes()], SHIP_DATE_FROM);

    await screen.findByText('SAMPLE-SR-0001');

    expect(listTable()).not.toHaveTextContent('NaN');
    /* 받은 축(배정)은 그대로 보이고, 못 받은 두 축만 빈 표기다. */
    expect(listTable()).toHaveTextContent(`${t.values.empty} / 500 / ${t.values.empty}`);
  });

  it('검사 상태가 PENDING이면 「대기」 배지가 보인다', async () => {
    renderScreen([listRoute(), ...partnerRoutes()], SHIP_DATE_FROM);

    await screen.findByText('SAMPLE-SR-0002');

    const row = within(listTable()).getByText('SAMPLE-SR-0002').closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText(t.values.inspectionPending)).toBeInTheDocument();
  });

  it('검사 상태가 PASSED이면 「합격」 배지가 보인다', async () => {
    const rows = [
      shipmentRequest({ shipmentRequestId: 9003, shippingInspectionStatusCode: 'PASSED' }),
    ];

    renderScreen([listRoute(rows), ...partnerRoutes()], SHIP_DATE_FROM);

    await screen.findByText('SAMPLE-SR-0001');

    expect(within(listTable()).getByText(t.values.inspectionPassed)).toBeInTheDocument();
  });

  /* REJECTED·HELD 전용 배지는 이번 슬라이스에서 두지 않는다(omf-mes#232·#235) — default 분기가
   * 「대기」로 안전하게 떨어지는지 확인한다. 놓치면 빈 배지·예외로 이어진다. */
  it.each(['REJECTED', 'HELD'] as const)(
    '검사 상태가 %s이면 전용 배지 대신 「대기」로 안전하게 떨어진다',
    async (statusCode) => {
      const rows = [
        shipmentRequest({ shipmentRequestId: 9004, shippingInspectionStatusCode: statusCode }),
      ];

      renderScreen([listRoute(rows), ...partnerRoutes()], SHIP_DATE_FROM);

      await screen.findByText('SAMPLE-SR-0001');

      expect(within(listTable()).getByText(t.values.inspectionPending)).toBeInTheDocument();
    },
  );

  /* 코드를 그대로 내지 않고 표시명으로 옮긴다 — 낱말은 출하 처리 화면과 같다(사용자 지시). */
  it('진행 열은 서버의 6개 진행 코드를 모두 표시명으로 보인다', async () => {
    const progressCodes = [
      'NOT_ALLOCATED',
      'PARTIALLY_ALLOCATED',
      'PICKING',
      'PICKED',
      'PARTIALLY_SHIPPED',
      'SHIPPED',
    ] as const;
    const rows = progressCodes.map((shipmentProgressCode, index) =>
      shipmentRequest({
        shipmentRequestId: 9100 + index,
        shipmentRequestNo: `SAMPLE-SR-${String(index + 10)}`,
        shipmentProgressCode,
      }),
    );

    renderScreen([listRoute(rows), ...partnerRoutes()], SHIP_DATE_FROM);

    await screen.findByText('SAMPLE-SR-10');

    for (const code of progressCodes) {
      expect(within(listTable()).getByText(t.progressCodes[code])).toBeInTheDocument();
      /* ⛔ 내부 코드는 화면에 나오지 않는다. */
      expect(within(listTable()).queryByText(code)).toBeNull();
    }
  });

  /*
   * 계약에 값이 늘어도 **빈 칸이 되지 않는다**(공유계약 G-9). 표시명을 모르면 코드를 그대로
   * 남겨 담당자에게 전할 단서를 둔다 — 지우면 「진행 상태가 비었다」로 잘못 보고된다.
   */
  it('표시명을 모르는 진행 코드는 코드를 그대로 보인다', async () => {
    const rows = [shipmentRequest({ shipmentProgressCode: 'SAMPLE_FUTURE_CODE' })];

    renderScreen([listRoute(rows), ...partnerRoutes()], SHIP_DATE_FROM);

    await screen.findByText('SAMPLE-SR-0001');

    expect(within(listTable()).getByText('SAMPLE_FUTURE_CODE')).toBeInTheDocument();
  });
});

describe('ShipmentScheduleScreen — 조건 초안의 수명', () => {
  /* 바깥에서 주소가 바뀌면(뒤로가기·앞으로가기·직접 편집) 조건 줄이 그 값으로 되돌아간다. */
  it('바깥에서 주소가 바뀌면 조건 줄이 따라간다', async () => {
    const { user } = renderScreen(
      [filteringListRoute(), ...partnerRoutes()],
      SHIP_DATE_FROM,
      `shipDateFrom=2026-08-01&progress=PICKED`,
    );

    await screen.findByText('SAMPLE-SR-0001');
    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await waitFor(() => {
      expect(currentLocation()).toContain('progress=PICKED');
    });
  });
});

const PLANTS_PATH = '/mdm/plants';
const DETAIL_PATH = `${LIST_PATH}/9001`;

const plantFixtures = [
  { plantId: 9201, plantCode: 'SAMPLE-PLT-01', plantName: '합성 공장 가', isActive: true },
  { plantId: 9202, plantCode: 'SAMPLE-PLT-02', plantName: '합성 공장 나', isActive: true },
];

const PLANT_A = plantFixtures[0] as (typeof plantFixtures)[number];
const PLANT_B = plantFixtures[1] as (typeof plantFixtures)[number];

const plantLabel = (plant: (typeof plantFixtures)[number]): string =>
  `${plant.plantCode} · ${plant.plantName}`;

const plantsRoute = (): StubRoute => lookupRoute(PLANTS_PATH, plantFixtures);

/** 상세는 **ETag 를 낸다** — 없으면 저장 요청이 나가기 전에 화면이 멈춘다. */
const detailRoute = (fulfillmentPlantId: number | null = null): StubRoute => ({
  match: (request) => isGet(request, DETAIL_PATH),
  respond: () =>
    jsonResponse(shipmentRequest({ fulfillmentPlantId }), {
      headers: { ETag: '"sample-shipment-request-v1"' },
    }),
});

const savePlantRoute = (status = 200): StubRoute => ({
  match: (request) => request.method === 'PUT' && new URL(request.url).pathname === DETAIL_PATH,
  respond: () =>
    status === 200
      ? jsonResponse(shipmentRequest({ fulfillmentPlantId: 9202 }))
      : jsonResponse({ message: '' }, { status }),
});

/** 창을 열고 공장을 고른다. 디자인 시스템의 고르는 칸은 목록 단추라 `selectOptions` 가 안 먹는다. */
const openPlantDialogAndPick = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<HTMLElement> => {
  await user.click(
    screen.getAllByRole('button', { name: t.actions.assignPlant })[0] as HTMLElement,
  );
  const dialog = await screen.findByRole('dialog');

  await user.click(await within(dialog).findByRole('combobox'));
  await user.click(await screen.findByRole('option', { name: plantLabel(PLANT_B) }));

  return dialog;
};

describe('ShipmentScheduleScreen — 출하 담당 공장 지정', () => {
  const rows = [shipmentRequest({ fulfillmentPlantId: null })];

  it('지정이 끝난 줄은 공장 이름과 「변경」을 보인다', async () => {
    renderScreen(
      [
        listRoute([shipmentRequest({ fulfillmentPlantId: PLANT_A.plantId })]),
        plantsRoute(),
        ...partnerRoutes(),
      ],
      SHIP_DATE_FROM,
    );

    /* ⛔ 「지정됨」처럼 여부만 말하지 않는다 — 어느 공장인지 적는다. */
    expect(await screen.findByText(plantLabel(PLANT_A))).toBeInTheDocument();
    expect(
      within(listTable()).getByRole('button', { name: t.actions.changePlant }),
    ).toBeInTheDocument();
  });

  it('저장이 끝나면 창이 닫힌다', async () => {
    const { user } = renderScreen(
      [listRoute(rows), detailRoute(), savePlantRoute(), plantsRoute(), ...partnerRoutes()],
      SHIP_DATE_FROM,
    );

    await screen.findByText('SAMPLE-SR-0001');
    const dialog = await openPlantDialogAndPick(user);
    await user.click(within(dialog).getByRole('button', { name: t.actions.savePlant }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('저장이 실패하면 창이 닫히지 않는다', async () => {
    const { user } = renderScreen(
      [listRoute(rows), detailRoute(), savePlantRoute(500), plantsRoute(), ...partnerRoutes()],
      SHIP_DATE_FROM,
    );

    await screen.findByText('SAMPLE-SR-0001');
    const dialog = await openPlantDialogAndPick(user);
    await user.click(within(dialog).getByRole('button', { name: t.actions.savePlant }));

    /* 실패를 삼키고 닫으면 저장된 줄 안다 — 고칠 자리를 그대로 열어 둔다. */
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
