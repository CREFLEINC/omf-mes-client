import { messages, vi } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useSearchParams } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi as vitest } from 'vitest';

import { pickDate } from '../../test/date-picker';
import { SYNTHETIC_SESSION } from '../../test/session-harness';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import {
  partnerFixtures,
  pickingRequest,
  shipmentRequest,
  shipmentRequestFixtures,
} from './fixtures';
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
    { fetch, route: `${ROUTE}${search}`, session: SYNTHETIC_SESSION },
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

describe('ShipmentScheduleScreen — 목표/피킹/출하·검사 열', () => {
  /* 피처 010 — 수량 칸은 「목표 / 피킹 / 출하」다(목표 = 배정). 요청은 상세에만. */
  it('Q1 라인 합계를 한 칸에 「목표 / 피킹 / 출하」로 보인다', async () => {
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
    /* 받은 축(목표 = 배정)은 그대로 보이고, 못 받은 두 축만 빈 표기다. */
    expect(listTable()).toHaveTextContent(`500 / ${t.values.empty} / ${t.values.empty}`);
  });

  /*
   * 피처 010 — 검사 칸은 서버 롤업 대신 LOT 판정 요약(lotJudgmentSummary)의 가장 나쁜 판정 하나와
   * 그 수다(불합격 > 보류 > 미검사 > 합격). 피킹 LOT 이 없으면 「—」.
   */
  it('Q4 검사 칸은 가장 나쁜 LOT 판정과 그 수를 보인다', async () => {
    const rows = [
      shipmentRequest({
        shipmentRequestId: 9003,
        lotJudgmentSummary: { notInspected: 2, accepted: 1, rejected: 1, held: 1 },
      }),
      shipmentRequest({
        shipmentRequestId: 9004,
        shipmentRequestNo: 'SAMPLE-SR-0004',
        lotJudgmentSummary: { notInspected: 0, accepted: 3, rejected: 0, held: 0 },
      }),
    ];

    renderScreen([listRoute(rows), ...partnerRoutes()], SHIP_DATE_FROM);

    await screen.findByText('SAMPLE-SR-0004');

    expect(within(listTable()).getByText(t.values.judgmentRejected(1))).toBeInTheDocument();
    expect(within(listTable()).getByText(t.values.judgmentAccepted)).toBeInTheDocument();
  });

  it('피킹 LOT 이 없으면 검사 칸은 「—」다 — 서버 롤업의 「대기」를 보이지 않는다', async () => {
    renderScreen([listRoute(), ...partnerRoutes()], SHIP_DATE_FROM);

    await screen.findByText('SAMPLE-SR-0002');

    const row = within(listTable()).getByText('SAMPLE-SR-0002').closest('tr');
    expect(within(row as HTMLElement).queryByText(t.values.inspectionPending)).toBeNull();
  });

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

describe('ShipmentScheduleScreen — 조건 더보기(C-6)', () => {
  it('출하일 · 검색어만 보이고, 나머지 조건은 「조건 더보기」를 눌러야 보인다', async () => {
    const { user } = renderScreen([listRoute(), ...partnerRoutes()], SHIP_DATE_FROM);

    await screen.findByText('SAMPLE-SR-0001');
    const more = screen.getByRole('button', { name: messages.common.filterMore.open });

    expect(screen.getByLabelText(t.fields.periodFrom)).toBeVisible();
    expect(screen.getByRole('textbox', { name: t.filters.q })).toBeVisible();
    expect(screen.queryByRole('checkbox', { name: t.filters.readyOnly })).toBeNull();
    expect(screen.queryByRole('combobox', { name: t.fields.customer })).toBeNull();
    expect(more).toHaveAttribute('aria-expanded', 'false');

    await user.click(more);

    expect(screen.getByRole('checkbox', { name: t.filters.readyOnly })).toBeVisible();
    expect(screen.getByLabelText(t.fields.customer)).toBeVisible();
    expect(screen.getByLabelText(t.fields.progress)).toBeVisible();
    expect(screen.getByRole('button', { name: messages.common.filterMore.close })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('접힌 칸에 걸린 조건만 칩이 되고, ×가 그 조건만 풀어 다시 조회한다 — 보이는 칸은 칩으로 겹쳐 적지 않는다', async () => {
    const { user } = renderScreen(
      [listRoute(), ...partnerRoutes()],
      `${SHIP_DATE_FROM}&q=SAMPLE&progress=PICKED&ready=true`,
    );

    await screen.findByText('SAMPLE-SR-0001');

    expect(screen.getByRole('button', { name: t.filters.chipRemoveProgress })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.filters.chipRemoveReadyOnly })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.filters.chipRemoveQ })).toBeNull();

    await user.click(screen.getByRole('button', { name: t.filters.chipRemoveProgress }));

    await waitFor(() => {
      expect(currentLocation()).not.toContain('progress=');
    });
    expect(currentLocation()).toContain('q=SAMPLE');
    expect(currentLocation()).toContain('ready=true');
  });

  it('펼치면 칸에 값이 보이므로 칩을 거둔다', async () => {
    const { user } = renderScreen(
      [listRoute(), ...partnerRoutes()],
      `${SHIP_DATE_FROM}&ready=true`,
    );

    await screen.findByText('SAMPLE-SR-0001');
    await user.click(screen.getByRole('button', { name: messages.common.filterMore.open }));

    expect(screen.queryByRole('button', { name: t.filters.chipRemoveReadyOnly })).toBeNull();
    expect(screen.getByRole('checkbox', { name: t.filters.readyOnly })).toBeChecked();
  });

  it('「초기화」는 처음 값과 달라진 것이 있을 때만 보이고, 누르면 처음 값으로 돌아간다', async () => {
    const { user } = renderScreen([listRoute(), ...partnerRoutes()]);

    /* 선행 단언 — 조건 줄이 실제로 그려져야 「초기화가 없다」가 뜻을 갖는다. */
    expect(await screen.findByRole('button', { name: messages.common.search })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.reset })).toBeNull();

    await user.type(screen.getByRole('textbox', { name: t.filters.q }), 'SAMPLE');
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    expect(screen.getByRole('textbox', { name: t.filters.q })).toHaveValue('');
    expect(screen.queryByRole('button', { name: messages.common.reset })).toBeNull();
  });
});

const PLANTS_PATH = '/mdm/plants';
const DETAIL_PATH = `${LIST_PATH}/9001`;

const plantFixtures = [
  { plantId: 9201, plantCode: 'SAMPLE-PLT-01', plantName: '합성 공장 가', isActive: true },
  { plantId: 9202, plantCode: 'SAMPLE-PLT-02', plantName: '합성 공장 나', isActive: true },
];

const PLANT_A = plantFixtures[0] as (typeof plantFixtures)[number];

const plantLabel = (plant: (typeof plantFixtures)[number]): string =>
  `${plant.plantCode} · ${plant.plantName}`;

const plantsRoute = (): StubRoute => lookupRoute(PLANTS_PATH, plantFixtures);

/*
 * ⛔ 「출하 담당 공장」 지정을 없앴다(피처 012 D-1 · FR-007) — 서버가 공장 지정 PUT 을 지웠다.
 *    옛 지시서만 공장이 있고, 그 이름은 그대로 보인다(사업부 칸으로 바꾸는 일은 C3).
 */
describe('ShipmentScheduleScreen — 공장 지정 없음 · 사업부(피처 012)', () => {
  it('FR-007 [공장 지정]·[변경] 단추와 「출하 담당 공장」 칸이 없고, 사업부 칸(없으면 「사업부 미지정」)이 선다', async () => {
    renderScreen(
      [
        listRoute([
          shipmentRequest({
            fulfillmentPlantId: PLANT_A.plantId,
            businessUnit: { businessUnitId: 7001, businessUnitCode: 'SAMPLE-BU-X', businessUnitName: '합성 사업부 X' },
          }),
          shipmentRequest({ shipmentRequestId: 9502, shipmentRequestNo: 'SAMPLE-SR-0002', businessUnit: null }),
        ]),
        plantsRoute(),
        ...partnerRoutes(),
      ],
      SHIP_DATE_FROM,
    );

    await screen.findByText('SAMPLE-SR-0002');
    expect(within(listTable()).getByText('합성 사업부 X')).toBeInTheDocument();
    expect(within(listTable()).getByText(t.bu012.noBusinessUnit)).toBeInTheDocument();
    expect(within(listTable()).queryByRole('button', { name: t.actions.assignPlant })).toBeNull();
    expect(within(listTable()).queryByRole('button', { name: t.actions.changePlant })).toBeNull();
    expect(within(listTable()).queryByText(plantLabel(PLANT_A))).toBeNull();
  });
});

describe('ShipmentScheduleScreen — 피처 010 진행·교체 표시', () => {
  it('US2-7·Q19 초과 · 막힘 n(진짜 이슈 수만, #342) · 피킹 창고 · LOT 교체 n 을 목록에 보인다', async () => {
    renderScreen([listRoute([pickingRequest()]), ...partnerRoutes()], SHIP_DATE_FROM);

    await screen.findByText('SAMPLE-SR-0010');
    const row = within(listTable()).getByText('SAMPLE-SR-0010').closest('tr') as HTMLElement;

    expect(row).toHaveTextContent('100 / 110 / 0');
    expect(within(row).getByText(t.values.over(10))).toBeInTheDocument();
    /* #342 — 미검사는 정상 진행이라 세지 않는다. 수주 라인 취소 하나만. */
    expect(within(row).getByText(t.values.blocked(1))).toBeInTheDocument();
    expect(within(row).getByText(t.values.replacement(1))).toBeInTheDocument();
    expect(row).toHaveTextContent('합성 완제품 창고 A, 합성 완제품 창고 B');
    expect(within(row).getByText(t.values.judgmentNotInspected(1))).toBeInTheDocument();
  });

  it('Q10 막는 이유가 없는 피킹 완료 지시서는 「완료 대기」다', async () => {
    const ready = shipmentRequest({
      shipmentRequestId: 9011,
      shipmentRequestNo: 'SAMPLE-SR-0011',
      shipmentProgressCode: 'PICKED',
      lotJudgmentSummary: { notInspected: 0, accepted: 2, rejected: 0, held: 0 },
    });
    renderScreen([listRoute([ready]), ...partnerRoutes()], SHIP_DATE_FROM);

    await screen.findByText('SAMPLE-SR-0011');
    expect(within(listTable()).getByText(t.values.completionReady)).toBeInTheDocument();
  });

  it('Q10 검색어 · 완료 대기만 · LOT 교체 있음이 요청 쿼리에 실린다', async () => {
    const { requests } = renderScreen(
      [listRoute(), ...partnerRoutes()],
      `${SHIP_DATE_FROM}&q=SAMPLE&ready=true&replaced=true`,
    );

    await screen.findByText('SAMPLE-SR-0001');
    const query = requestsTo(requests, LIST_PATH)[0]?.url.searchParams;

    expect(query?.get('q')).toBe('SAMPLE');
    expect(query?.get('completionReadyOnly')).toBe('true');
    expect(query?.get('hasReplacement')).toBe('true');
  });

  it('Q10 조건 줄의 검색어와 두 체크를 조회하면 주소에 실린다', async () => {
    const { user } = renderScreen([listRoute(), ...partnerRoutes()], SHIP_DATE_FROM);

    await screen.findByText('SAMPLE-SR-0001');
    await user.type(screen.getByRole('textbox', { name: t.filters.q }), 'SAMPLE');
    /* 두 체크는 「조건 더보기」 안에 접혀 있다(C-6). */
    await user.click(screen.getByRole('button', { name: messages.common.filterMore.open }));
    await user.click(screen.getByRole('checkbox', { name: t.filters.readyOnly }));
    await user.click(screen.getByRole('checkbox', { name: t.filters.hasReplacement }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(currentLocation()).toContain('q=SAMPLE');
    });
    expect(currentLocation()).toContain('ready=true');
    expect(currentLocation()).toContain('replaced=true');
  });
});

/*
 * #342 — 「막힘」은 진짜 이슈만, 출하일 지난 피킹 부족은 「지연」. 오늘은 시계를 고정해 정한다.
 */
describe('ShipmentScheduleScreen — #342 막힘 · 지연 · 완료 대기', () => {
  beforeEach(() => {
    vitest.useFakeTimers({ toFake: ['Date'] });
    vitest.setSystemTime(new Date(2026, 10, 20, 9, 0, 0));
  });
  afterEach(() => {
    vitest.useRealTimers();
  });

  const request = (id: number, overrides: Record<string, unknown>) =>
    shipmentRequest({
      shipmentRequestId: id,
      shipmentRequestNo: `SAMPLE-SR-${String(id)}`,
      shipmentProgressCode: 'PICKING',
      requestedShipDate: '2026-11-25',
      ...overrides,
    });

  const rowOf = (no: string): HTMLElement =>
    within(listTable()).getByText(no).closest('tr') as HTMLElement;

  const statusChips = (row: HTMLElement): string[] =>
    [...row.querySelectorAll<HTMLElement>('span[class*="status-"]')].map(
      (chip) => `${/status-([a-z]+)/.exec(chip.className)?.[1] ?? ''}:${chip.textContent ?? ''}`,
    );

  it('#342 확인 1·2·3·4 — 목록 진행 칩 아래 칩을 갈래대로 단다', async () => {
    const rows = [
      /* 1. 피킹 중 — 피킹 부족 · 미검사만, 출하일 전: 칩 없음. */
      request(9301, {
        completionBlockers: [
          { code: 'PICKING_SHORT', lineNo: 1 },
          { code: 'NOT_INSPECTED', lotNo: 'SAMPLE-LOT-0101' },
        ],
      }),
      /* 2. 출하일이 어제인 피킹 부족 — 주황 「지연」. */
      request(9302, {
        requestedShipDate: '2026-11-19',
        completionBlockers: [{ code: 'PICKING_SHORT', lineNo: 1 }],
      }),
      /* 3. 불합격 · 보류 + 피킹 부족(출하일 지남) — 붉은 「막힘 2」가 「지연」보다 앞선다. */
      request(9303, {
        requestedShipDate: '2026-11-19',
        completionBlockers: [
          { code: 'REJECTED', lotNo: 'SAMPLE-LOT-0102' },
          { code: 'HELD', lotNo: 'SAMPLE-LOT-0103' },
          { code: 'PICKING_SHORT', lineNo: 1 },
        ],
      }),
      /* 4. 막는 이유 없음 — 초록 「완료 대기」. */
      request(9304, { shipmentProgressCode: 'PICKED', completionBlockers: [] }),
      /* 4. 출하 완료 — 칩 없음. */
      request(9305, {
        shipmentProgressCode: 'SHIPPED',
        completionBlockers: [{ code: 'ALREADY_COMPLETED' }],
      }),
      /* 오늘이 출하일인 피킹 부족은 아직 지연이 아니다. */
      request(9306, {
        requestedShipDate: '2026-11-20',
        completionBlockers: [{ code: 'PICKING_SHORT', lineNo: 1 }],
      }),
    ];
    renderScreen([listRoute(rows), ...partnerRoutes()], SHIP_DATE_FROM);

    await screen.findByText('SAMPLE-SR-9301');
    /* 진행 칩 아래 칩만 본다(검사 · 진행 칩은 빼고). */
    const marks = [t.values.delayed, t.values.completionReady, ...[1, 2, 3].map(t.values.blocked)];
    const completion = (no: string) =>
      statusChips(rowOf(no)).filter((chip) => marks.some((text) => chip.endsWith(`:${text}`)));

    expect(completion('SAMPLE-SR-9301')).toEqual([]);
    expect(completion('SAMPLE-SR-9302')).toEqual([`warning:${t.values.delayed}`]);
    expect(completion('SAMPLE-SR-9303')).toEqual([`error:${t.values.blocked(2)}`]);
    expect(completion('SAMPLE-SR-9304')).toEqual([`success:${t.values.completionReady}`]);
    expect(completion('SAMPLE-SR-9305')).toEqual([]);
    expect(completion('SAMPLE-SR-9306')).toEqual([]);
  });

  const detailRoute = (body: Record<string, unknown>): StubRoute => ({
    match: (r) => isGet(r, `${LIST_PATH}/${String(body.shipmentRequestId)}`),
    respond: () => jsonResponse(body, { headers: { ETag: '"sample-v1"' } }),
  });

  const openDetailOf = async (body: Record<string, unknown>) => {
    const { user } = renderScreen(
      [listRoute([body]), detailRoute(body), ...partnerRoutes()],
      SHIP_DATE_FROM,
    );
    await user.click(
      await screen.findByRole('button', {
        name: t.table.openDetail(String(body.shipmentRequestNo)),
      }),
    );
    const dialog = await screen.findByRole('dialog', { name: t.detail.title });
    await within(dialog).findByText(String(body.shipmentRequestNo));
    return dialog;
  };

  it('#342 확인 1 — 피킹 부족 · 미검사만이면 상세 띠는 정보(회색) 「출하 완료까지 남은 일」이다', async () => {
    const dialog = await openDetailOf(
      request(9311, {
        completionBlockers: [
          { code: 'PICKING_SHORT', lineNo: 1 },
          { code: 'NOT_INSPECTED', lotNo: 'SAMPLE-LOT-0111' },
        ],
      }),
    );

    const title = within(dialog).getByText(t.detail.remainingTitle(2));
    expect(title.closest('[role]')).toHaveAttribute('role', 'status');
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });

  it('#342 확인 3 — 불합격 · 보류가 있으면 붉은 띠에 이슈를 먼저 나열한다', async () => {
    const dialog = await openDetailOf(
      request(9312, {
        completionBlockers: [
          { code: 'PICKING_SHORT', lineNo: 1 },
          { code: 'HELD', lotNo: 'SAMPLE-LOT-0112' },
          { code: 'NOT_INSPECTED', lotNo: 'SAMPLE-LOT-0113' },
          { code: 'REJECTED', lotNo: 'SAMPLE-LOT-0114' },
        ],
      }),
    );

    const title = within(dialog).getByText(t.detail.remainingTitle(4));
    const band = title.closest('[role]') as HTMLElement;
    expect(band).toHaveAttribute('role', 'alert');
    expect([...band.querySelectorAll('li')].map((item) => item.textContent)).toEqual([
      t.detail.blockers.HELD('SAMPLE-LOT-0112'),
      t.detail.blockers.REJECTED('SAMPLE-LOT-0114'),
      t.detail.blockers.PICKING_SHORT('1'),
      t.detail.blockers.NOT_INSPECTED('SAMPLE-LOT-0113'),
    ]);
  });

  it('#342 확인 4 — 출하 완료한 지시서(「이미 출하 완료」)는 남은 일 칸을 숨긴다', async () => {
    const dialog = await openDetailOf(
      request(9313, {
        shipmentProgressCode: 'SHIPPED',
        completionBlockers: [{ code: 'ALREADY_COMPLETED' }],
      }),
    );

    expect(within(dialog).queryByText(t.detail.blockers.ALREADY_COMPLETED)).toBeNull();
    expect(within(dialog).queryByText(/출하 완료까지 남은 일/)).toBeNull();
  });
});

const detailOf = (body: unknown): StubRoute => ({
  match: (request) => isGet(request, `${LIST_PATH}/9010`),
  respond: () => jsonResponse(body, { headers: { ETag: '"sample-v1"' } }),
});

const itemRoute = (): StubRoute => ({
  match: (request) =>
    request.method === 'GET' && new URL(request.url).pathname === '/mdm/items/9301',
  respond: () =>
    jsonResponse({
      item: { itemId: 9301, itemCode: 'SAMPLE-FG-A100', itemName: '합성 센서 모듈' },
    }),
});

const openDetail = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(
    await screen.findByRole('button', { name: t.table.openDetail('SAMPLE-SR-0010') }),
  );
  return screen.findByRole('dialog', { name: t.detail.title });
};

describe('ShipmentScheduleScreen — 피처 010 지시서 상세', () => {
  it('US2-7·Q19 지시서 번호를 누르면 상세 창에 피킹 LOT · 위치별 몫 · 교체 이력 · 막는 이유가 보인다', async () => {
    const { user } = renderScreen(
      [listRoute([pickingRequest()]), detailOf(pickingRequest()), itemRoute(), ...partnerRoutes()],
      SHIP_DATE_FROM,
    );

    const dialog = await openDetail(user);

    expect(await within(dialog).findByText('SHPREQ:SAMPLE-SR-0010')).toBeInTheDocument();
    /* #342 — 진짜 이슈(수주 라인 취소)가 있어 붉은 띠, 제목은 남은 일 전부. */
    expect(within(dialog).getByText(t.detail.remainingTitle(2))).toBeInTheDocument();
    expect(within(dialog).getByText(t.detail.remainingTitle(2)).closest('[role]')).toHaveAttribute(
      'role',
      'alert',
    );
    expect(
      within(dialog).getByText(t.detail.blockers.NOT_INSPECTED('SAMPLE-LOT-0004')),
    ).toBeInTheDocument();
    /* FR-028b — 수주 라인 취소는 푸는 길이 없어 「담당자에게 문의」만. */
    expect(
      within(dialog).getByText(t.detail.blockers.SALES_ORDER_LINE_CANCELLED('1')),
    ).toBeInTheDocument();
    /* 출하 완료를 어디서 하는지는 「진행」 옆 ⓘ 로 읽힌다(관리웹 정리 시안 A). */
    expect(within(dialog).getByRole('button', { name: t.detail.popOnly })).toBeInTheDocument();

    const lot1 = within(dialog).getAllByText('SAMPLE-LOT-0001')[0]?.closest('tr') as HTMLElement;
    expect(lot1).toHaveTextContent('SAMPLE-A-01-01');
    expect(lot1).toHaveTextContent('SAMPLE-B-02-01');
    expect(lot1).toHaveTextContent('SAMPLE-PLT-0007');
    expect(lot1).toHaveTextContent(t.detail.oqc.ACCEPTED);

    const replaced = within(dialog)
      .getAllByText('SAMPLE-LOT-0003')[0]
      ?.closest('tr') as HTMLElement;
    expect(replaced).toHaveTextContent(t.detail.lotStatus.REPLACED);
    expect(replaced).toHaveTextContent('SAMPLE-NC-0003');

    const history = within(dialog).getByRole('table', { name: t.detail.replacements });
    /* 근거 결과는 회차로 보인다(시안 「결과 #2」). */
    expect(history).toHaveTextContent(t.detail.resultRound(2));
    expect(history).toHaveTextContent('SAMPLE-NC-0003');

    expect(await within(dialog).findAllByText(/SAMPLE-FG-A100/)).not.toHaveLength(0);
    /* ⛔ 출하 완료 단계 화면에는 ERP 송신 여부를 보이지 않는다. */
    expect(dialog).not.toHaveTextContent('송신');
  });

  it('US2-7·Q19·Q11 완료된 지시서 상세 — 출하 번호(피처 012: 링크 없이 「출하」 칸), 완료 시각·POP 단말·작업자, 코드 옆 자물쇠', async () => {
    const base = pickingRequest();
    const request = {
      ...base,
      shipmentProgressCode: 'SHIPPED',
      completionBlockers: [],
      blockerSummary: {},
      completedShipment: {
        shipmentId: 7701,
        shipmentNo: 'SAMPLE-SH-0001',
        completedAt: '2026-11-18T14:05:00+07:00',
        completedTerminal: { terminalId: 61, terminalCode: 'SAMPLE-POP-01' },
        completedWorker: { workerId: 9601, workerNo: 'SAMPLE-W-01', workerName: '합성 작업자' },
      },
    };
    const { user } = renderScreen(
      [listRoute([request]), detailOf(request), itemRoute(), ...partnerRoutes()],
      SHIP_DATE_FROM,
    );

    const dialog = await openDetail(user);

    /* 피처 012 — 출하 번호는 더 이상 출하 내역으로 넘어가지 않는다(US5-4 · T061). */
    expect(await within(dialog).findByText('SAMPLE-SH-0001')).toBeInTheDocument();
    expect(within(dialog).queryByRole('link', { name: /SAMPLE-SH-0001/ })).toBeNull();
    expect(within(dialog).queryByText(/출하 내역/)).toBeNull();
    expect(
      within(dialog).getByText(
        t.detail.completedBy('2026-11-18 14:05', 'SAMPLE-POP-01', '합성 작업자 (SAMPLE-W-01)'),
      ),
    ).toBeInTheDocument();
    const lot1 = within(dialog).getAllByText('SAMPLE-LOT-0001')[0]?.closest('tr') as HTMLElement;
    expect(within(lot1).getByRole('img', { name: t.detail.codeLocked })).toBeInTheDocument();
  });

  it('US5-4 완료된 지시서 상세의 완료 띠 안내는 취소를 아래 「출하」 칸에서 하라고 말한다(출하 내역 아님)', async () => {
    const request = {
      ...pickingRequest(),
      shipmentProgressCode: 'SHIPPED',
      completionBlockers: [],
      blockerSummary: {},
      completedShipment: {
        shipmentId: 7701,
        shipmentNo: 'SAMPLE-SH-0001',
        completedAt: '2026-11-18T14:05:00+07:00',
        completedTerminal: { terminalId: 61, terminalCode: 'SAMPLE-POP-01' },
        completedWorker: { workerId: 9601, workerNo: 'SAMPLE-W-01', workerName: '합성 작업자' },
      },
    };
    const { user } = renderScreen(
      [listRoute([request]), detailOf(request), itemRoute(), ...partnerRoutes()],
      SHIP_DATE_FROM,
    );

    const dialog = await openDetail(user);

    const band = await within(dialog).findByText(t.bu012.completedBand('SAMPLE-SH-0001', '2026-11-18 14:05'));
    expect(band).toHaveTextContent('취소는 아래 「출하」 칸에서 요청합니다.');
    expect(band).not.toHaveTextContent('출하 내역');
  });

  it('US2-7·Q19 「LOT 교체 이력」의 「다음 피킹 LOT」 — 같은 라인에서 교체 뒤 처음 피킹한 LOT, 없으면 「—」', async () => {
    const base = pickingRequest();
    const line = (base.lines as Record<string, unknown>[])[0] as Record<string, unknown>;
    const lots = line.lots as Record<string, unknown>[];
    const request = {
      ...base,
      lines: [
        {
          ...line,
          lots: lots.map((lot) =>
            lot.lotNo === 'SAMPLE-LOT-0004'
              ? { ...lot, pickedAt: '2026-11-18T10:50:00+07:00' }
              : lot,
          ),
        },
      ],
    };
    const { user } = renderScreen(
      [listRoute([request]), detailOf(request), itemRoute(), ...partnerRoutes()],
      SHIP_DATE_FROM,
    );

    const dialog = await openDetail(user);
    const history = await within(dialog).findByRole('table', { name: t.detail.replacements });

    expect(
      within(history).getByRole('columnheader', { name: t.detail.replacementColumns.next }),
    ).toBeInTheDocument();
    const row = within(history)
      .getByText(/SAMPLE-LOT-0003/)
      .closest('tr') as HTMLElement;
    expect(row).toHaveTextContent('SAMPLE-LOT-0004');
  });

  it('US2-7 피킹 전 지시서 상세는 시안의 안내 띠를 보이고, [지시서 인쇄]는 창 머리에 있다', async () => {
    const request = shipmentRequest({
      shipmentRequestId: 9010,
      shipmentRequestNo: 'SAMPLE-SR-0010',
    });
    const { user } = renderScreen(
      [listRoute([request]), detailOf(request), itemRoute(), ...partnerRoutes()],
      SHIP_DATE_FROM,
    );

    const dialog = await openDetail(user);

    expect(await within(dialog).findByText(t.detail.noLotsBanner)).toBeInTheDocument();
    const print = within(dialog).getByRole('button', { name: t.detail.print });
    expect(print.closest('.ship-request-head-actions')).not.toBeNull();
  });

  it('US4-2·Q10 인쇄본 머리 표에 수주, 품목 표에 단위, 인쇄한 사람(관리웹 · 세션 사용자)과 아래 안내 문장', async () => {
    const request = { ...pickingRequest(), salesOrderNo: 'SAMPLE-SO-0001' };
    const { user } = renderScreen(
      [listRoute([request]), detailOf(request), itemRoute(), ...partnerRoutes()],
      SHIP_DATE_FROM,
    );
    const dialog = await openDetail(user);
    await within(dialog).findByText('SHPREQ:SAMPLE-SR-0010');
    await user.click(within(dialog).getByRole('button', { name: t.detail.print }));

    const preview = await screen.findByRole('dialog', { name: t.printPreview.title });
    const sheet = within(preview);
    expect(sheet.getByRole('rowheader', { name: t.print.salesOrder })).toBeInTheDocument();
    expect(sheet.getByText('SAMPLE-SO-0001')).toBeInTheDocument();
    expect(sheet.getByRole('columnheader', { name: t.print.uom })).toBeInTheDocument();
    expect(sheet.getByText(/합성 사용자 가/)).toBeInTheDocument();
    expect(sheet.getByText(t.print.footnote)).toBeInTheDocument();
  });

  it('D-16·Q3 상세 머리에 수주 번호, 라인에 단위·수주 라인·수주 잔량 — 넘으면 「0 + 초과 n」, 적치 대기 몫은 따로 적는다', async () => {
    const base = pickingRequest();
    const line = (base.lines as Record<string, unknown>[])[0] as Record<string, unknown>;
    const lots = line.lots as Record<string, unknown>[];
    const request = {
      ...base,
      salesOrderNo: 'SAMPLE-SO-0001',
      lines: [
        {
          ...line,
          shippedQty: 110,
          salesOrderLine: {
            salesOrderLineId: 9951,
            salesOrderNo: 'SAMPLE-SO-0001',
            lineNo: 1,
            orderedQty: 100,
            shippedQty: 110,
            cancelled: false,
          },
          lots: lots.map((lot) =>
            lot.lotNo === 'SAMPLE-LOT-0004'
              ? {
                  ...lot,
                  portions: [
                    {
                      warehouseId: 9401,
                      warehouseCode: 'SAMPLE-WH-A',
                      warehouseName: '합성 완제품 창고 A',
                      locationId: 9419,
                      locationCode: 'SAMPLE-STAGING',
                      locationSystemRoleCode: 'PUTAWAY_STAGING',
                      qty: 30,
                    },
                  ],
                }
              : lot,
          ),
        },
      ],
    };
    const { user } = renderScreen(
      [listRoute([request]), detailOf(request), itemRoute(), ...partnerRoutes()],
      SHIP_DATE_FROM,
    );

    const dialog = await openDetail(user);

    expect(await within(dialog).findAllByText('SAMPLE-SO-0001, 1')).not.toHaveLength(0);
    expect(within(dialog).getByText('SAMPLE-SO-0001')).toBeInTheDocument();
    expect(within(dialog).getByText('SAMPLE-EA')).toBeInTheDocument();
    expect(within(dialog).getByText(t.detail.salesOrderOver(10))).toBeInTheDocument();
    expect(within(dialog).getByText(t.detail.salesOrderQtyShipped(100, 110))).toBeInTheDocument();
    expect(
      within(dialog).getByText(`합성 완제품 창고 A SAMPLE-STAGING 30 (${t.detail.staging})`),
    ).toBeInTheDocument();
  });

  it('D-16 수주 잔량이 남으면 그 수량과 수주 수량을 보인다', async () => {
    const base = pickingRequest();
    const line = (base.lines as Record<string, unknown>[])[0] as Record<string, unknown>;
    const request = {
      ...base,
      salesOrderNo: 'SAMPLE-SO-0002',
      lines: [
        {
          ...line,
          salesOrderLine: {
            salesOrderLineId: 9952,
            salesOrderNo: 'SAMPLE-SO-0002',
            lineNo: 3,
            orderedQty: 150,
            shippedQty: 13,
            cancelled: false,
          },
        },
      ],
    };
    const { user } = renderScreen(
      [listRoute([request]), detailOf(request), itemRoute(), ...partnerRoutes()],
      SHIP_DATE_FROM,
    );

    const dialog = await openDetail(user);

    expect(await within(dialog).findByText(t.detail.salesOrderRemaining(137))).toBeInTheDocument();
    expect(within(dialog).getByText(t.detail.salesOrderQty(150))).toBeInTheDocument();
  });

  it('US4-2 [지시서 인쇄]는 A4 미리 보기에 QR 과 번호, 교체 LOT 을 뺀 피킹 LOT, 서명 칸 넷을 보인다', async () => {
    const { user } = renderScreen(
      [listRoute([pickingRequest()]), detailOf(pickingRequest()), itemRoute(), ...partnerRoutes()],
      SHIP_DATE_FROM,
    );
    const dialog = await openDetail(user);
    await within(dialog).findByText('SHPREQ:SAMPLE-SR-0010');
    await user.click(within(dialog).getByRole('button', { name: t.detail.print }));

    const preview = await screen.findByRole('dialog', { name: t.printPreview.title });
    const sheet = within(preview);
    expect(sheet.getByRole('img', { name: t.print.qrLabel })).toBeInTheDocument();
    expect(sheet.getAllByText('SHPREQ:SAMPLE-SR-0010').length).toBeGreaterThan(0);
    expect(sheet.getByText('SAMPLE-LOT-0001')).toBeInTheDocument();
    expect(sheet.getByText('SAMPLE-LOT-0004')).toBeInTheDocument();
    expect(sheet.queryByText('SAMPLE-LOT-0003')).toBeNull();
    /* 시안 Print-Preview — 피킹 LOT 표의 OQC 판정 칸과 라인 합계·초과 줄. */
    expect(sheet.getByRole('columnheader', { name: t.print.oqc })).toBeInTheDocument();
    expect(sheet.getByText('SAMPLE-LOT-0001').closest('tr')).toHaveTextContent(
      t.print.oqcStatus.ACCEPTED,
    );
    expect(sheet.getByText('SAMPLE-LOT-0004').closest('tr')).toHaveTextContent(
      t.print.oqcStatus.NOT_INSPECTED,
    );
    expect(sheet.getByText(t.print.lineTotal(110, 10))).toBeInTheDocument();
    for (const signature of t.print.signatures) {
      expect(sheet.getAllByRole('columnheader', { name: signature }).length).toBeGreaterThan(0);
    }
    expect(preview).not.toHaveTextContent('ERP');
  });

  it('US4-2 출력 언어를 베트남어로 바꾸면 양식 글이 베트남어로 바뀌고, [인쇄]는 브라우저 인쇄를 부른다', async () => {
    const printed: number[] = [];
    const original = window.print;
    window.print = () => {
      printed.push(1);
    };
    try {
      const { user } = renderScreen(
        [
          listRoute([pickingRequest()]),
          detailOf(pickingRequest()),
          itemRoute(),
          ...partnerRoutes(),
        ],
        SHIP_DATE_FROM,
      );
      const dialog = await openDetail(user);
      await within(dialog).findByText('SHPREQ:SAMPLE-SR-0010');
      await user.click(within(dialog).getByRole('button', { name: t.detail.print }));
      const preview = await screen.findByRole('dialog', { name: t.printPreview.title });

      await user.click(within(preview).getByRole('radio', { name: 'Tiếng Việt' }));
      expect(within(preview).getByText(vi.shipmentSchedule.print.title)).toBeInTheDocument();

      await user.click(within(preview).getByRole('button', { name: t.printPreview.print }));
      expect(printed).toHaveLength(1);
    } finally {
      window.print = original;
    }
  });
});

/* ── 피처 012 — ERP 송신 칩 · 사업부 거르기 · 결재에서 열림 · 출고 창고(US4 · US6 · quickstart Q13·Q15·Q16) ── */

describe('ShipmentScheduleScreen — 피처 012 목록', () => {
  const countedListRoute = (counts: Record<string, number>, items: unknown[] = ROWS): StubRoute => ({
    match: (request) => isGet(request, LIST_PATH),
    respond: () => jsonResponse({ ...listBody(items), erpSendStatusCounts: counts }),
  });

  it('US4-1·Q13 ERP 송신 칩은 건수를 붙이고 0 건 칩은 세우지 않으며, 누르면 erpSendStatus 로 거른다', async () => {
    const { requests, user } = renderScreen(
      [countedListRoute({ PENDING: 2, SENT: 15, NOT_QUEUED: 1, NO_SHIPMENT: 14 }), ...partnerRoutes()],
      SHIP_DATE_FROM,
    );

    const chips = await screen.findByRole('group', { name: t.bu012.erpChipsLabel });

    expect(await within(chips).findByRole('button', { name: t.bu012.erpChip(t.bu012.erpAll, 32) })).toHaveAttribute('aria-pressed', 'true');
    expect(within(chips).getByRole('button', { name: t.bu012.erpChip(t.bu012.erpStatus.NOT_QUEUED, 1) })).toBeInTheDocument();
    expect(within(chips).getByRole('button', { name: t.bu012.erpChip(t.bu012.erpStatus.SENT, 15) })).toBeInTheDocument();
    /* 0 건 — 송신 오류 · 송신 안 함 · 취소됨 칩은 없다. */
    expect(within(chips).queryByRole('button', { name: new RegExp(t.bu012.erpStatus.SEND_ERROR, 'u') })).toBeNull();

    await user.click(within(chips).getByRole('button', { name: t.bu012.erpChip(t.bu012.erpStatus.PENDING, 2) }));

    await waitFor(() => {
      expect(
        requestsTo(requests, LIST_PATH).some((request) => request.url.searchParams.get('erpSendStatus') === 'PENDING'),
      ).toBe(true);
    });
    expect(currentLocation()).toContain('erp=PENDING');
  });

  it('US4-1 고른 칩은 0 건이 돼도 남아 눌러 풀 수 있고, 빈 문구가 ERP 송신 거르기를 풀라고 말한다', async () => {
    renderScreen([countedListRoute({ NO_SHIPMENT: 3 }, []), ...partnerRoutes()], `${SHIP_DATE_FROM}&erp=SEND_ERROR`);

    const chips = await screen.findByRole('group', { name: t.bu012.erpChipsLabel });

    expect(await within(chips).findByRole('button', { name: t.bu012.erpChip(t.bu012.erpStatus.SEND_ERROR, 0) })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByText(t.bu012.erpEmptyHint)).toBeInTheDocument();
  });

  it('FR-018·빈 곳 ⑧ 검색어 안내가 출하 번호도 찾는다고 말한다', async () => {
    renderScreen([listRoute(), ...partnerRoutes()], SHIP_DATE_FROM);

    expect(await screen.findByPlaceholderText(t.filters.qPlaceholder)).toBeInTheDocument();
    expect(t.filters.qPlaceholder).toContain('출하 번호');
  });

  it('FR-007·FR-008 사업부는 조회 조건 셋째 칸이고, 고르면 businessUnitId 로 거른다', async () => {
    const { requests, user } = renderScreen(
      [
        listRoute(),
        lookupRoute('/mdm/business-units', [
          { businessUnitId: 8301, legalEntityId: 1, businessUnitCode: 'SYN-BU', businessUnitName: '합성 사업부 X', isActive: true },
          { businessUnitId: 8399, legalEntityId: 1, businessUnitCode: 'SYN-BU-OUT', businessUnitName: '범위 밖 사업부', isActive: true },
        ]),
        ...partnerRoutes(),
      ],
      SHIP_DATE_FROM,
    );

    await user.click(await screen.findByRole('combobox', { name: t.bu012.businessUnit }));
    /* 세션 범위(사업부 8301) 밖 사업부는 고를 수 없다. */
    expect(screen.queryByRole('option', { name: '범위 밖 사업부' })).toBeNull();
    await user.click(await screen.findByRole('option', { name: '합성 사업부 X' }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(
        requestsTo(requests, LIST_PATH).some((request) => request.url.searchParams.get('businessUnitId') === '8301'),
      ).toBe(true);
    });
  });

  it('US6-1·Q16 줄 창고가 없는 옛 지시서는 출고 창고 칸에 「창고 미지정」, 있으면 창고와 아래 줄 공장', async () => {
    renderScreen([listRoute([shipmentRequest(), pickingRequest()]), ...partnerRoutes()], SHIP_DATE_FROM);

    await screen.findByText('SAMPLE-SR-0010');
    const old = within(listTable()).getByText('SAMPLE-SR-0001').closest('tr') as HTMLElement;
    const fresh = within(listTable()).getByText('SAMPLE-SR-0010').closest('tr') as HTMLElement;

    expect(within(old).getByText(t.bu012.warehouseUnassigned)).toBeInTheDocument();
    expect(fresh).toHaveTextContent('합성 완제품 창고 A, 합성 완제품 창고 B');
    expect(fresh).toHaveTextContent('합성 공장 가, 합성 공장 나');
  });
});

describe('ShipmentScheduleScreen — 피처 012 결재에서 열림 · 옛 주소', () => {
  const linkRoutes = (shipDate = '2026-08-13'): StubRoute[] => [
    {
      match: (request) => isGet(request, '/app/approval-requests/9001'),
      respond: () =>
        jsonResponse({
          request: {
            approvalRequestId: 9001,
            target: { targetTypeCode: 'SHIPMENT', targetId: 7701, displayName: '출하', openable: true, screenId: 'W-04-02' },
          },
        }),
    },
    {
      match: (request) => isGet(request, '/logistics/shipments/7701'),
      respond: () => jsonResponse({ shipmentId: 7701, shipmentNo: 'SAMPLE-SH-0001', shipmentRequestId: 9010 }),
    },
    detailOf({ ...pickingRequest(), requestedShipDate: shipDate }),
    itemRoute(),
  ];

  it('US4-4·Q13 결재함 [열기](approvalRequestId)로 오면 그 지시서 상세가 「결재에서 열림」 띠와 함께 열린다', async () => {
    renderScreen([listRoute(), ...partnerRoutes(), ...linkRoutes()], `${SHIP_DATE_FROM}&approvalRequestId=9001`);

    const dialog = await screen.findByRole('dialog', { name: t.detail.title });

    expect(await within(dialog).findByText(t.bu012.fromApproval)).toBeInTheDocument();
    expect(within(dialog).getByText('SAMPLE-SR-0010')).toBeInTheDocument();
  });

  it('US5-3·Q15 옛 주소의 shipmentId 로 와도 그 지시서 상세를 연다(결재 띠는 없다)', async () => {
    renderScreen([listRoute(), ...partnerRoutes(), ...linkRoutes()], `${SHIP_DATE_FROM}&shipmentId=7701`);

    const dialog = await screen.findByRole('dialog', { name: t.detail.title });

    expect(await within(dialog).findByText('SAMPLE-SR-0010')).toBeInTheDocument();
    expect(within(dialog).queryByText(t.bu012.fromApproval)).toBeNull();
  });

  it('E-7·빈 곳 ⑦ 목록 기간 밖 지시서면 상세는 열고 목록에 「목록 기간 밖 지시서」 띠', async () => {
    renderScreen(
      [listRoute(), ...partnerRoutes(), ...linkRoutes('2026-07-01')],
      `?shipDateFrom=2026-08-01&shipDateTo=2026-08-31&approvalRequestId=9001`,
    );

    expect(await screen.findByRole('dialog', { name: t.detail.title })).toBeInTheDocument();
    expect(await screen.findByText(t.bu012.outOfPeriod('SAMPLE-SR-0010'))).toBeInTheDocument();
  });

  it('FR-007 상세 머리 「사업부」 · 「출고 창고」(창고별 라인), 라인 표에 출고 창고(공장)', async () => {
    const line = (pickingRequest().lines as Record<string, unknown>[])[0] as Record<string, unknown>;
    const body = {
      ...pickingRequest(),
      businessUnit: { businessUnitId: 8301, businessUnitCode: 'SYN-BU', businessUnitName: '합성 사업부 X' },
      lines: [
        { ...line, warehouse: { warehouseId: 9401, warehouseCode: 'SAMPLE-WH-A', warehouseName: '합성 완제품 창고 A', plantId: 9201, plantName: '합성 공장 가' } },
      ],
    };
    const { user } = renderScreen([listRoute([pickingRequest()]), detailOf(body), itemRoute(), ...partnerRoutes()], SHIP_DATE_FROM);

    const dialog = await openDetail(user);

    expect(await within(dialog).findByText('합성 사업부 X')).toBeInTheDocument();
    expect(within(dialog).getByText(t.bu012.warehouseLines('합성 완제품 창고 A (합성 공장 가)', '1'))).toBeInTheDocument();
    expect(within(dialog).getAllByText('합성 완제품 창고 A (합성 공장 가)').length).toBeGreaterThan(0);
    expect(within(dialog).queryByText('출하 담당 공장')).toBeNull();
  });
});

describe('ShipmentScheduleScreen — 피처 012 인쇄', () => {
  it('FR-007·US4-6 인쇄본 머리 표에 사업부, 품목 표에 출고 창고(공장) — ERP 송신 표시는 없다', async () => {
    const base = pickingRequest();
    const line = (base.lines as Record<string, unknown>[])[0] as Record<string, unknown>;
    const request = {
      ...base,
      businessUnit: { businessUnitId: 8301, businessUnitCode: 'SYN-BU', businessUnitName: '합성 사업부 X' },
      erpSendStatus: 'PENDING',
      lines: [
        { ...line, warehouse: { warehouseId: 9401, warehouseCode: 'SAMPLE-WH-A', warehouseName: '합성 완제품 창고 A', plantId: 9201, plantName: '합성 공장 가' } },
      ],
    };
    const { user } = renderScreen(
      [listRoute([request]), detailOf(request), itemRoute(), ...partnerRoutes()],
      SHIP_DATE_FROM,
    );
    const dialog = await openDetail(user);
    await within(dialog).findByText('SHPREQ:SAMPLE-SR-0010');
    await user.click(within(dialog).getByRole('button', { name: t.detail.print }));

    const preview = within(await screen.findByRole('dialog', { name: t.printPreview.title }));

    expect(preview.getByRole('rowheader', { name: t.bu012.printBusinessUnit })).toBeInTheDocument();
    expect(preview.getByText('합성 사업부 X')).toBeInTheDocument();
    expect(preview.getByRole('columnheader', { name: t.bu012.printWarehouse })).toBeInTheDocument();
    expect(preview.getByText('합성 완제품 창고 A (합성 공장 가)')).toBeInTheDocument();
    expect(preview.queryByText(/ERP/)).toBeNull();
  });
});
