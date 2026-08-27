import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useSearchParams } from 'react-router';
import { describe, expect, it } from 'vitest';

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
    const status = new URL(request.url).searchParams.get('statusCode');
    const items = status === null ? ROWS : ROWS.filter((row) => row.statusCode === status);

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
      '?shipDateFrom=2026-08-01&shipDateTo=2026-08-31&customer=9101&shipToPartner=9111&status=SAMPLE_STATUS_A&inspection=true',
    );

    await screen.findByText('SAMPLE-SR-0001');

    const query = requestsTo(requests, LIST_PATH)[0]?.url.searchParams;

    expect(query?.get('shipDateFrom')).toBe('2026-08-01');
    expect(query?.get('shipDateTo')).toBe('2026-08-31');
    expect(query?.get('customerId')).toBe('9101');
    expect(query?.get('shipToPartnerId')).toBe('9111');
    expect(query?.get('statusCode')).toBe('SAMPLE_STATUS_A');
    expect(query?.get('shippingInspectionRequired')).toBe('true');
  });

  it('조건 줄에서 조회하면 주소와 요청에 함께 나타난다', async () => {
    const { requests, user } = renderScreen([listRoute(), ...partnerRoutes()], SHIP_DATE_FROM);

    await screen.findByText('SAMPLE-SR-0001');

    const toField = screen.getByLabelText(t.fields.periodTo);
    await user.type(toField, '2026-08-31');
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

  /* 값 집합이 확정되지 않아 「진행」 열은 원문 코드를 그대로 낸다. */
  it('진행 열은 상태 코드를 그대로 보인다', async () => {
    renderScreen([listRoute(), ...partnerRoutes()], SHIP_DATE_FROM);

    await screen.findByText('SAMPLE-SR-0001');

    expect(within(listTable()).getAllByText('SAMPLE_STATUS_A').length).toBeGreaterThan(0);
  });
});

describe('ShipmentScheduleScreen — 조건 초안의 수명', () => {
  /* 바깥에서 주소가 바뀌면(뒤로가기·앞으로가기·직접 편집) 조건 줄이 그 값으로 되돌아간다. */
  it('바깥에서 주소가 바뀌면 조건 줄이 따라간다', async () => {
    const { user } = renderScreen(
      [filteringListRoute(), ...partnerRoutes()],
      SHIP_DATE_FROM,
      `shipDateFrom=2026-08-01&status=SAMPLE_STATUS_B`,
    );

    await screen.findByText('SAMPLE-SR-0001');
    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await waitFor(() => {
      expect(currentLocation()).toContain('status=SAMPLE_STATUS_B');
    });
  });
});
