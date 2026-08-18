import { messages } from '@omf-mes/i18n';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import {
  adjustmentDetailBody,
  balanceFixtures,
  countFixtures,
  countVarianceLineFixtures,
  countVarianceLineResponse,
  itemFixtures,
  locationFixtures,
  lotFixtures,
  uomFixtures,
  warehouseFixtures,
} from './fixtures';
import { StockAdjustScreen } from './screen';

const t = messages.stockAdjust;

/**
 * 조정 사유 값 목록 — **미확정 자리표시를 갈아 끼운다**(전례 `disposal-issue`와 같은 형태).
 *
 * **판정·조립·잠금은 실물 그대로**이고 바뀌는 것은 「값 목록이 왔다」는 사실 하나다. 채웠을 때
 * 등록이 실제로 살아나지 않으면 그 자리표시는 **죽은 가지**이므로, 이 목이 곧 D-9의 시험이다.
 *
 * ⚠ 지어낸 합성 코드다 — **계약의 `@example` 값(`COUNT_VARIANCE`)을 쓰지 않는다.**
 */
const { codeValues } = vi.hoisted(() => ({ codeValues: { reason: [] as string[] } }));

vi.mock('./code-options', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./code-options')>();

  return { ...actual, PLACEHOLDER_STOCK_ADJUST_CODES: codeValues };
});

const SAMPLE_REASON = 'SAMPLE_AR_A';

/** 값 목록이 아직 비어 있는 것이 **지금의 사실**이다 — 채우는 시험이 스스로 채운다. */
beforeEach(() => {
  codeValues.reason = [];
});

const ROUTE = '/logistics/stock-adjust';

const COUNTS_PATH = '/inventory/counts';
const VARIANCE_PATH = '/inventory/counts/9101/lines';
const SECOND_VARIANCE_PATH = '/inventory/counts/9102/lines';
const BALANCES_PATH = '/inventory/balances';
const WAREHOUSES_PATH = '/mdm/warehouses';
const LOCATIONS_PATH = '/mdm/locations';
const ITEMS_PATH = '/mdm/items';
const UOMS_PATH = '/mdm/uoms';
const LOTS_PATH = '/trace/lots';

const COUNT_LABEL = 'SAMPLE-IC-9101 · 2026-08-17';
const WAREHOUSE_LABEL = 'SAMPLE-WH-01 · 합성 창고 가';
const LOCATION_LABEL = 'SAMPLE-LOC-01 · 합성 위치 가';
const ITEM_LABEL = 'SAMPLE-ITEM-A · 합성 품목 가';
const UOM_LABEL = 'SAMPLE-EA · 합성 단위 개';

/** 화면 어디에도 나와서는 안 되는 내부 번호(FK). 픽스처의 번호 대역을 그대로 쓴다. */
const INTERNAL_IDS = ['9101', '9111', '9201', '9401', '9501', '9601', '9701'];

interface RecordedRequest {
  method: string;
  url: URL;
  /**
   * 쓰기 요청의 본문. 읽기에는 `null`이다.
   *
   * **실제로 나간 본문을 본다.** 조립 함수를 단위로 검사하는 것만으로는 「화면이 그 함수를
   * 부르지 않고 다른 값을 보냈다」를 잡을 수 없다.
   */
  body: unknown;
  headers: Headers;
}

/**
 * 요청을 기록하면서 스텁 규칙으로 응답한다.
 *
 * `hold`에 든 경로는 **기록한 뒤에** 붙잡아 둔다 — 「보내는 중에 무엇이 잠기는가」를 재려면
 * 응답이 오기 전 상태가 화면에 남아 있어야 한다.
 *
 * **문을 열면 곧바로 다음 문을 건다.** 한 번 열고 마는 형태면 두 번째 요청이 붙잡히지 않아
 * 「보내는 중에 버린다」를 **두 번 되풀이하는 경로**를 잴 수 없다 — 그 되풀이가 곧 「앞 전표의
 * 사실이 쌓이는가」를 가르는 자리다.
 */
const createRecordingFetch = (
  routes: StubRoute[],
  hold: string[] = [],
): { fetch: StubFetch; requests: RecordedRequest[]; release: () => void } => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch(routes);
  let openGate = (): void => {
    /* 아래 `armGate`가 곧바로 채운다. */
  };
  let gate = Promise.resolve();

  const armGate = (): void => {
    gate = new Promise<void>((resolve) => {
      openGate = resolve;
    });
  };

  armGate();

  return {
    fetch: async (request) => {
      /* 본문은 한 번만 읽을 수 있다 — 복제해 읽어야 스텁이 같은 요청을 다시 다룰 수 있다. */
      const body: unknown = request.method === 'GET' ? null : await request.clone().json();

      requests.push({
        method: request.method,
        url: new URL(request.url),
        body,
        headers: request.headers,
      });

      if (hold.includes(new URL(request.url).pathname)) await gate;

      return stub(request);
    },
    requests,
    release: () => {
      const open = openGate;

      /* 다음 문을 먼저 걸고 연다 — 순서를 뒤집으면 그 사이에 온 요청이 붙잡히지 않는다. */
      armGate();
      open();
    },
  };
};

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const listBody = (items: unknown[], total = items.length) => ({
  items,
  page: { page: 1, size: 50, total },
});

const getRoute = (pathname: string, items: unknown[], total?: number): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse(listBody(items, total)),
});

const failingRoute = (pathname: string, status: number): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse({ message: '' }, { status }),
});

const lookupRoutes = (): StubRoute[] => [
  getRoute(WAREHOUSES_PATH, warehouseFixtures),
  getRoute(LOCATIONS_PATH, locationFixtures),
  getRoute(ITEMS_PATH, itemFixtures),
  getRoute(UOMS_PATH, uomFixtures),
  getRoute(LOTS_PATH, lotFixtures),
];

const allRoutes = (overrides: StubRoute[] = []): StubRoute[] => [
  ...overrides,
  getRoute(COUNTS_PATH, countFixtures),
  getRoute(VARIANCE_PATH, countVarianceLineFixtures),
  getRoute(SECOND_VARIANCE_PATH, []),
  getRoute(BALANCES_PATH, balanceFixtures),
  ...lookupRoutes(),
];

/** 주소가 실제로 어떻게 바뀌는지 본다 — 정리가 히스토리를 늘리는지 판정할 유일한 근거다. */
const LocationProbe = () => {
  const location = useLocation();

  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

/**
 * 한 칸 뒤로 간다. **히스토리가 몇 칸 늘었는지를 판정하는 유일한 수단**이다 —
 * 기억 라우터는 브라우저 히스토리를 쓰지 않아 `window.history.back()`이 닿지 않는다.
 */
const BackProbe = () => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => {
        void navigate(-1);
      }}
    >
      뒤로
    </button>
  );
};

const renderScreen = (routes: StubRoute[], search = '?count=9101', hold: string[] = []) => {
  const { fetch, requests, release } = createRecordingFetch(routes, hold);

  renderWithProviders(
    <>
      <StockAdjustScreen />
      <LocationProbe />
      <BackProbe />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, release, user: userEvent.setup() };
};

const currentLocation = (): string => screen.getByTestId('location').textContent ?? '';

/**
 * 주소가 그 값이 되기를 **기다린다.**
 *
 * `MemoryRouter`는 위치 갱신을 `startTransition`으로 감싼다(라우터 실측) — **전환 갱신은
 * 비긴급이라 부하가 걸리면 늦게 커밋된다.** 같은 문에서 함께 일어난 긴급 갱신(안내 문구)만
 * 기다린 뒤 주소를 동기로 단언하면, 판정 대상은 옳은데 단언이 앞서서 무너진다.
 *
 * **판정 대상을 낮추지 않는다** — 주소가 그 값이 된다는 사실을 그대로 재고, 기다리는 방식만
 * 전환 갱신에 맞춘다. 「주소가 그대로다」를 재는 음성 단언은 이 취약성에 걸리지 않으므로
 * 동기로 둔다(기다릴 전환이 없다).
 */
const waitForLocation = async (expected: string): Promise<void> => {
  await waitFor(() => {
    expect(currentLocation()).toBe(expected);
  });
};

const requestsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === pathname);

const sourcePane = (): HTMLElement => screen.getByRole('region', { name: t.panes.source });

const linesPane = (): HTMLElement => screen.getByRole('region', { name: t.panes.lines });

const countField = (): HTMLElement => within(sourcePane()).getByLabelText(t.source.countField);

const loadButton = (): HTMLElement =>
  within(sourcePane()).getByRole('button', { name: t.actions.loadVariance });

const addLineButton = (): HTMLElement =>
  within(linesPane()).getByRole('button', { name: t.actions.addLine });

const diffBox = (lineNo: number): HTMLElement =>
  screen.getByLabelText(t.lineTable.adjustmentQtyLabel(lineNo));

const bodyRows = (): HTMLElement[] =>
  within(within(linesPane()).getByRole('table')).getAllByRole('row').slice(1);

const cellsOf = (rowIndex: number): string[] =>
  within(bodyRows()[rowIndex] ?? document.createElement('tr'))
    .getAllByRole('cell')
    .map((cell) => cell.textContent ?? '');

/** 실사 목록이 도착한 뒤에 잰다 — 도착 전에 「없다」를 재면 늘 통과하는 단언이 된다. */
const waitForCounts = async (): Promise<void> => {
  await waitFor(() => {
    expect(countField()).toHaveTextContent(COUNT_LABEL);
  });
};

/** 실사 차이를 불러와 조정 대상이 선 상태까지 간다. */
const loadVariance = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await waitForCounts();
  await user.click(loadButton());
  await screen.findByRole('table');
};

/** 직접 등록 갈래에서 창고를 고르고 줄 하나를 더한다. */
const startDirectLine = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByRole('radio', { name: t.source.direct }));
  await user.click(within(sourcePane()).getByLabelText(t.source.warehouseField));
  await user.click(screen.getByRole('option', { name: WAREHOUSE_LABEL }));
  await user.click(addLineButton());
  await screen.findByRole('table');
};

/**
 * **진입 맥락은 주소가 정본이다**(D-2 · C1). 재고실사에서 넘어오는 길이 실재하고,
 * 새로고침·뒤로가기·공유가 같은 실사를 열어야 한다.
 */
describe('StockAdjustScreen — 진입 맥락', () => {
  it('주소가 실사를 가리키면 그 실사가 원천으로 고정된다', async () => {
    renderScreen(allRoutes());

    await waitForCounts();

    expect(screen.getByRole('radio', { name: t.source.count })).toBeChecked();
    expect(countField()).toHaveTextContent(COUNT_LABEL);
  });

  it('맥락이 없으면 직접 등록으로 연다 — 실사를 거치지 않는 것이 정상 경로다', async () => {
    renderScreen(allRoutes(), '');

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: t.source.direct })).toBeChecked();
    });
  });

  it.each(['abc', '0', '-3'])('못 알아듣는 값 %o은 맥락이 아니다', async (raw) => {
    renderScreen(allRoutes(), `?count=${raw}`);

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: t.source.direct })).toBeChecked();
    });
  });

  it('고른 실사가 주소에 실린다 — 새로고침해도 같은 실사가 선다', async () => {
    const { user } = renderScreen(allRoutes());

    await waitForCounts();
    await user.click(countField());
    await user.click(screen.getByRole('option', { name: 'SAMPLE-IC-9102 · 2026-08-18' }));

    await waitForLocation(`${ROUTE}?count=9102`);
  });

  /** 고를 때마다 히스토리가 쌓이면 뒤로가기가 앞선 선택으로 되돌아가 세운 대상이 사라진다. */
  it('실사를 고르는 것이 뒤로가기 기록을 늘리지 않는다', async () => {
    const { user } = renderScreen(allRoutes());

    await waitForCounts();
    await user.click(countField());
    await user.click(screen.getByRole('option', { name: 'SAMPLE-IC-9102 · 2026-08-18' }));
    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitForLocation(`${ROUTE}?count=9102`);
  });
});

/**
 * **없는 실사를 가리킨 주소를 정리한다**(사본 체크리스트 1번).
 *
 * 정리가 히스토리에 칸을 쌓으면 뒤로가기가 없는 실사 주소로 되돌아가 같은 정리가 되풀이되고
 * 사용자가 갇힌다 — 그래서 `replace`로 지운다.
 */
describe('StockAdjustScreen — 없는 실사 주소 정리', () => {
  it('목록에 없는 실사를 가리키면 주소에서 지우고 그 사실을 밝힌다', async () => {
    renderScreen(allRoutes(), '?count=9109');

    await screen.findByText(t.source.countNotFoundNote);

    await waitForLocation(ROUTE);
  });

  it('정리가 뒤로가기 기록을 늘리지 않는다', async () => {
    const { user } = renderScreen(allRoutes(), '?count=9109');

    await screen.findByText(t.source.countNotFoundNote);
    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitForLocation(ROUTE);
  });

  /**
   * **잘린 목록에서는 판정하지 않는다** — 못 본 것과 없는 것은 다르다. 정상 실사를 가리킨
   * 주소가 지워지면 재고실사에서 넘어온 사용자가 무엇을 조정하려 했는지 잃는다.
   */
  it('목록이 잘렸으면 지우지 않는다', async () => {
    renderScreen(allRoutes([getRoute(COUNTS_PATH, countFixtures, 9)]), '?count=9109');

    await waitFor(() => {
      expect(screen.getByText(t.lookups.truncated)).toBeInTheDocument();
    });

    expect(currentLocation()).toBe(`${ROUTE}?count=9109`);
    expect(screen.queryByText(t.source.countNotFoundNote)).not.toBeInTheDocument();
  });
});

/**
 * **실사 차이 불러오기**(C2·C3). 차이가 있는 줄만 받아 조정 대상으로 승계한다.
 */
describe('StockAdjustScreen — 실사 차이 승계', () => {
  it('차이가 있는 줄만 부른다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await loadVariance(user);

    const varianceRequests = requestsTo(requests, VARIANCE_PATH);

    expect(varianceRequests).toHaveLength(1);
    expect(varianceRequests[0]?.url.searchParams.get('varianceOnly')).toBe('true');
  });

  it('고르는 것만으로는 부르지 않는다 — 불러오기가 대상을 세우는 조작이다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await waitForCounts();
    await user.click(countField());
    await user.click(screen.getByRole('option', { name: 'SAMPLE-IC-9102 · 2026-08-18' }));

    expect(requestsTo(requests, SECOND_VARIANCE_PATH)).toHaveLength(0);
  });

  it('받은 줄이 조정 대상으로 선다', async () => {
    const { user } = renderScreen(allRoutes());

    await loadVariance(user);

    expect(bodyRows()).toHaveLength(3);
    expect(screen.getByText(t.source.loadedNote(3))).toBeInTheDocument();
  });

  /**
   * **장부·실물·차이가 계약이 준 세 값과 맞는다**(C3). 실물은 `장부 + 차이`로 파생하는데,
   * 계약의 `varianceQty`가 `실물 − 장부`라 처음 승계한 시점에는 파생 값이 곧 계약의 실물이다.
   */
  it('장부·실물·차이가 실사가 준 값과 맞는다', async () => {
    const { user } = renderScreen(allRoutes());

    await loadVariance(user);

    expect(cellsOf(0)[3]).toBe(t.lineTable.qtyWithUom('100', UOM_LABEL));
    expect(cellsOf(0)[4]).toBe(t.lineTable.qtyWithUom('98', UOM_LABEL));
    expect(diffBox(1)).toHaveValue('-2');
  });

  /** 실사 갈래에서는 잔액을 부르지 않는다 — 장부를 실사가 이미 들고 왔다(D-6). */
  it('실사 갈래에서는 잔액을 부르지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await loadVariance(user);

    expect(requestsTo(requests, BALANCES_PATH)).toHaveLength(0);
  });

  /** 실사 갈래에서는 줄을 더하지 않는다 — 더한 줄은 장부를 확인할 길이 없다. */
  it('실사 갈래에서는 라인 추가가 사유와 함께 잠긴다', async () => {
    const { user } = renderScreen(allRoutes());

    await loadVariance(user);

    expect(addLineButton()).toBeDisabled();
    expect(addLineButton()).toHaveAccessibleDescription(
      new RegExp(t.actionReasons.addLineCountSource),
    );
  });
});

/**
 * **원천 전환**(C5). 원천이 바뀌면 세운 대상이 남지 않고, 그 사실을 미리 밝힌다.
 */
describe('StockAdjustScreen — 원천 전환', () => {
  it('바꾸기 전에 무엇을 잃는지 읽힌다', async () => {
    const { user } = renderScreen(allRoutes());

    await loadVariance(user);

    expect(screen.getByText(t.source.changeDiscardNote(3))).toBeInTheDocument();
  });

  it('직접 등록으로 바꾸면 세운 대상이 사라진다', async () => {
    const { user } = renderScreen(allRoutes());

    await loadVariance(user);
    await user.click(screen.getByRole('radio', { name: t.source.direct }));

    expect(within(linesPane()).queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText(t.empty.noLinesTitle)).toBeInTheDocument();
  });

  /** 직접 등록 갈래에는 대상 실사가 없다 — 주소에 남겨 두면 화면과 주소가 다른 말을 한다. */
  it('직접 등록으로 바꾸면 주소의 대상 실사도 지운다', async () => {
    const { user } = renderScreen(allRoutes());

    await waitForCounts();
    await user.click(screen.getByRole('radio', { name: t.source.direct }));

    await waitForLocation(ROUTE);
  });

  it('대상 실사를 바꾸면 세운 대상이 사라진다', async () => {
    const { user } = renderScreen(allRoutes());

    await loadVariance(user);
    await user.click(countField());
    await user.click(screen.getByRole('option', { name: 'SAMPLE-IC-9102 · 2026-08-18' }));

    expect(within(linesPane()).queryByRole('table')).not.toBeInTheDocument();
  });
});

/**
 * ⭐ **실사 참조가 비어 있는 것이 정상이다**(조심 ⑤ · C4).
 */
describe('StockAdjustScreen — 직접 등록 갈래', () => {
  it('대상 실사가 빈 값 표식으로 보이고 경고 표식이 붙지 않는다', async () => {
    renderScreen(allRoutes(), '');

    await screen.findByText(t.source.directNote);

    expect(within(sourcePane()).getByText(t.values.empty)).toBeInTheDocument();
    expect(within(sourcePane()).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('창고를 고르기 전에는 라인 추가가 사유와 함께 잠긴다', async () => {
    const { user } = renderScreen(allRoutes(), '');

    await screen.findByText(t.source.directNote);
    await user.click(screen.getByRole('radio', { name: t.source.direct }));

    expect(addLineButton()).toBeDisabled();
    expect(addLineButton()).toHaveAccessibleDescription(
      new RegExp(t.actionReasons.addLineNeedsWarehouse),
    );
  });

  it('줄을 더하면 위치·품목·LOT·단위를 고를 수 있다', async () => {
    const { user } = renderScreen(allRoutes(), '');

    await screen.findByText(t.source.directNote);
    await startDirectLine(user);

    expect(screen.getByLabelText(t.lineTable.locationLabel(1))).toBeInTheDocument();
    expect(screen.getByLabelText(t.lineTable.itemLabel(1))).toBeInTheDocument();
    expect(screen.getByLabelText(t.lineTable.lotLabel(1))).toBeInTheDocument();
    expect(screen.getByLabelText(t.lineTable.uomLabel(1))).toBeInTheDocument();
  });

  /**
   * **위치를 고른 시점에 그 위치당 1회**다(D-6 · C7). 줄마다 부르면 같은 위치의 줄이
   * 늘수록 요청이 그대로 는다.
   */
  it('위치를 고르면 잔액 조회가 그 위치당 1회 나간다', async () => {
    const { requests, user } = renderScreen(allRoutes(), '');

    await screen.findByText(t.source.directNote);
    await startDirectLine(user);

    expect(requestsTo(requests, BALANCES_PATH)).toHaveLength(0);

    await user.click(screen.getByLabelText(t.lineTable.locationLabel(1)));
    await user.click(screen.getByRole('option', { name: LOCATION_LABEL }));

    await waitFor(() => {
      expect(requestsTo(requests, BALANCES_PATH)).toHaveLength(1);
    });

    expect(requestsTo(requests, BALANCES_PATH)[0]?.url.searchParams.get('locationId')).toBe('9401');
  });

  it('같은 위치의 줄이 둘이어도 잔액 조회는 하나다', async () => {
    const { requests, user } = renderScreen(allRoutes(), '');

    await screen.findByText(t.source.directNote);
    await startDirectLine(user);

    await user.click(screen.getByLabelText(t.lineTable.locationLabel(1)));
    await user.click(screen.getByRole('option', { name: LOCATION_LABEL }));
    await user.click(addLineButton());
    await user.click(screen.getByLabelText(t.lineTable.locationLabel(2)));
    await user.click(screen.getByRole('option', { name: LOCATION_LABEL }));

    await waitFor(() => {
      expect(requestsTo(requests, BALANCES_PATH)).toHaveLength(1);
    });
  });

  /** 장부에서 (품목·LOT)을 찾으면 그 값이 서고 실물이 파생한다. */
  it('장부를 찾으면 그 값이 서고 실물이 따라 선다', async () => {
    const { user } = renderScreen(allRoutes(), '');

    await screen.findByText(t.source.directNote);
    await startDirectLine(user);

    await user.click(screen.getByLabelText(t.lineTable.locationLabel(1)));
    await user.click(screen.getByRole('option', { name: LOCATION_LABEL }));
    await user.click(screen.getByLabelText(t.lineTable.itemLabel(1)));
    await user.click(screen.getByRole('option', { name: ITEM_LABEL }));
    await user.click(screen.getByLabelText(t.lineTable.lotLabel(1)));
    await user.click(screen.getByRole('option', { name: 'SAMPLE-LOT-0001' }));
    await user.click(screen.getByLabelText(t.lineTable.uomLabel(1)));
    await user.click(screen.getByRole('option', { name: UOM_LABEL }));
    await user.type(diffBox(1), '-20');

    await waitFor(() => {
      expect(cellsOf(0)[3]).toBe(t.lineTable.qtyWithUom('120', UOM_LABEL));
    });

    expect(cellsOf(0)[4]).toBe(t.lineTable.qtyWithUom('100', UOM_LABEL));
  });

  /**
   * ⭐ **못 찾으면 「—」이고 0이 아니다**(C8). 0으로 메우면 「장부에 없다」가 「장부에 0이 있다」로
   * 바뀌어 차이 계산이 거짓이 된다. 그리고 **그 줄도 조정할 수 있다.**
   */
  it('장부에서 못 찾으면 빈 값 표식이고 그 사실을 적는다', async () => {
    const { user } = renderScreen(allRoutes(), '');

    await screen.findByText(t.source.directNote);
    await startDirectLine(user);

    await user.click(screen.getByLabelText(t.lineTable.locationLabel(1)));
    await user.click(screen.getByRole('option', { name: LOCATION_LABEL }));
    /*
     * 품목은 잔액에 있으나 **그 품목의 LOT 없는 줄은 없다** — LOT까지 맞추지 않으면 남의 LOT
     * 잔액이 이 줄의 장부로 서므로, 못 찾는 것이 맞는 갈래다.
     */
    await user.click(screen.getByLabelText(t.lineTable.itemLabel(1)));
    await user.click(screen.getByRole('option', { name: ITEM_LABEL }));
    await user.click(screen.getByLabelText(t.lineTable.uomLabel(1)));
    await user.click(screen.getByRole('option', { name: UOM_LABEL }));
    await user.type(diffBox(1), '-20');

    await screen.findByText(t.notes.bookQtyOptional);

    expect(cellsOf(0)[3]).toBe(t.values.empty);
    expect(cellsOf(0)[4]).toBe(t.values.empty);
    /* 그 줄이 오류로 막히지 않는다 — 장부를 몰라도 조정할 수 있다. */
    expect(diffBox(1)).toBeValid();
    expect(addLineButton()).toBeEnabled();
  });
});

/**
 * ⭐ **줄이는 조정이 정상 경로다**(조심 ② · C11·C12).
 */
describe('StockAdjustScreen — 차이 수량', () => {
  it('음수를 쳐도 오류가 뜨지 않는다', async () => {
    const { user } = renderScreen(allRoutes());

    await loadVariance(user);
    await user.clear(diffBox(1));
    await user.type(diffBox(1), '-20');

    expect(diffBox(1)).toHaveValue('-20');
    expect(diffBox(1)).toBeValid();
    expect(screen.queryByText(t.errors.adjustmentQtyRequired)).not.toBeInTheDocument();
  });

  it('비우면 그 줄에만 오류가 붙는다', async () => {
    const { user } = renderScreen(allRoutes());

    await loadVariance(user);
    await user.clear(diffBox(1));

    expect(diffBox(1)).toHaveAccessibleDescription(new RegExp(t.errors.adjustmentQtyRequired));
    expect(diffBox(2)).not.toHaveAccessibleDescription(new RegExp(t.errors.adjustmentQtyRequired));
  });

  /** 두 줄이 동시에 잘못돼도 각 칸이 **자기 줄의 사유**를 가리킨다(사본 체크리스트 3번). */
  it('두 줄이 동시에 잘못돼도 사유가 섞이지 않는다', async () => {
    const { user } = renderScreen(allRoutes());

    await loadVariance(user);
    await user.clear(diffBox(1));
    await user.clear(diffBox(2));
    await user.type(diffBox(2), 'abc');

    expect(diffBox(1)).toHaveAccessibleDescription(new RegExp(t.errors.adjustmentQtyRequired));
    expect(diffBox(2)).toHaveAccessibleDescription(new RegExp(t.errors.adjustmentQtyNotNumber));
  });

  /** 차이 0은 **오류가 아니라 제외**다 — 막지 않고 몇 줄이 빠지는지 밝힌다. */
  it('차이가 0인 줄은 제외로 밝히고 막지 않는다', async () => {
    const { user } = renderScreen(allRoutes());

    await loadVariance(user);

    expect(screen.getByText(t.notes.excludedZero(1))).toBeInTheDocument();
    expect(diffBox(3)).toBeValid();
  });

  it('0을 지우면 제외 안내가 함께 걷힌다', async () => {
    const { user } = renderScreen(allRoutes());

    await loadVariance(user);
    await user.clear(diffBox(3));
    await user.type(diffBox(3), '-1');

    expect(screen.queryByText(t.notes.excludedZero(1))).not.toBeInTheDocument();
  });
});

/**
 * ⭐ **잔량을 직접 고치지 않는다**(조심 ③ · C6·C13·C14).
 */
describe('StockAdjustScreen — 세 열과 범위 안내', () => {
  it('수불 원장 안내가 상시 선다', async () => {
    renderScreen(allRoutes(), '');

    expect(screen.getByText(t.scope.title)).toBeInTheDocument();
    expect(screen.getByText(t.scope.description)).toBeInTheDocument();
  });

  it('맥락이 없어도 안내가 접히지 않는다', async () => {
    renderScreen(allRoutes(), '?count=abc');

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: t.source.direct })).toBeChecked();
    });

    expect(screen.getByText(t.scope.title)).toBeInTheDocument();
  });

  it('실물이 파생이라는 사실과 음수가 정상이라는 사실을 적는다', async () => {
    renderScreen(allRoutes(), '');

    expect(screen.getByText(t.notes.actualDerived)).toBeInTheDocument();
    expect(screen.getByText(t.notes.negativeAllowed)).toBeInTheDocument();
  });

  /**
   * ⛔ **결과 수량을 뜻하는 낱말이 슬라이스 어디에도 없다**(C14). 그 말이 한 번이라도 서면
   * 사용자가 이 화면을 잔량 덮어쓰기로 읽는다. 양성 앵커(표가 섰다) 뒤에 잰다.
   */
  it.each(['보유 수량', '재고 수량', '현재 수량'])('%o 라는 낱말이 없다', async (word) => {
    const { user } = renderScreen(allRoutes());

    await loadVariance(user);

    expect(screen.getByText(t.lineTable.bookQty)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(word))).not.toBeInTheDocument();
  });

  it('입력칸이 차이 하나뿐이다 — 실물·장부에는 입력칸이 없다', async () => {
    const { user } = renderScreen(allRoutes());

    await loadVariance(user);

    expect(diffBox(1)).toBeInTheDocument();
    expect(within(within(linesPane()).getByRole('table')).getAllByRole('textbox')).toHaveLength(3);
  });

  /** 내부 번호는 주소와 요청에만 쓴다 — 사람이 읽는 자리로 새지 않는다(`omf-mes#44`). */
  it.each(INTERNAL_IDS)('내부 번호 %o가 화면에 그려지지 않는다', async (id) => {
    const { user } = renderScreen(allRoutes());

    await loadVariance(user);

    expect(screen.getByText(t.lineTable.bookQty)).toBeInTheDocument();
    expect(within(linesPane()).queryByText(new RegExp(`\\b${id}\\b`))).not.toBeInTheDocument();
  });
});

/**
 * ⛔ **승인 대기 탭을 두지 않는다**(조심 ① · D-3).
 */
describe('StockAdjustScreen — 결재는 결재함이 소유한다', () => {
  it('결재함을 가리키는 안내가 상시 선다', () => {
    renderScreen(allRoutes(), '');

    expect(screen.getByText(t.approvalNotice.title)).toBeInTheDocument();
    expect(screen.getByText(t.approvalNotice.description)).toBeInTheDocument();
  });

  it('승인·반려 조작이 0건이다', async () => {
    const { user } = renderScreen(allRoutes());

    await loadVariance(user);

    const buttonNames = screen.getAllByRole('button').map((button) => button.textContent ?? '');

    expect(buttonNames.length).toBeGreaterThan(0);
    expect(buttonNames.filter((name) => /승인|반려/.test(name))).toEqual([]);
  });

  /** 계약에 남아 있는 조건이라 유혹이 실재한다 — 요청 어디에도 싣지 않는다. */
  it('요청 어디에도 승인 대기 조건이 실리지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await loadVariance(user);

    expect(requests.length).toBeGreaterThan(0);
    expect(
      requests.filter((request) => request.url.search.includes('pendingApprovalOnly')),
    ).toEqual([]);
  });
});

/**
 * **자리표시 코드**(D-9 · C10). 값 목록이 비어 있는 동안 무엇이 막히는지 밝힌다 —
 * 대상을 세우는 일은 그 값과 무관하게 열려 있다.
 */
describe('StockAdjustScreen — 조정 사유 값 목록', () => {
  it('값 목록이 비어 있다는 사실과 무엇이 막히는지 적는다', () => {
    renderScreen(allRoutes(), '');

    expect(screen.getByText(t.notes.reasonCodePending)).toBeInTheDocument();
  });

  it('그동안에도 대상은 세울 수 있다', async () => {
    const { user } = renderScreen(allRoutes());

    await loadVariance(user);

    expect(bodyRows()).toHaveLength(3);
    expect(diffBox(1)).toBeEnabled();
  });
});

/**
 * **라인 사유**(D-7 · C9). 조정 라인에 사유를 담을 자리가 아직 없어 보낼 곳이 없다 —
 * 실사에서 실려 온 사유만 읽기 전용 글자로 보인다.
 */
describe('StockAdjustScreen — 라인 사유', () => {
  it('실사에서 온 사유가 글자로 보이고 그 사실을 적는다', async () => {
    const { user } = renderScreen(allRoutes());

    await loadVariance(user);

    expect(screen.getByText(t.lineTable.countReason('SAMPLE_VR_A'))).toBeInTheDocument();
    expect(screen.getByText(t.notes.lineReasonReadOnly)).toBeInTheDocument();
  });

  it('표에 사유 선택칸이 0건이다', async () => {
    const { user } = renderScreen(allRoutes());

    await loadVariance(user);

    expect(screen.getByText(t.lineTable.countReason('SAMPLE_VR_A'))).toBeInTheDocument();
    expect(within(within(linesPane()).getByRole('table')).queryAllByRole('combobox')).toHaveLength(
      0,
    );
  });
});

/**
 * **조회 실패**(C16). 갈래마다 사용자가 할 조치가 다르고, 복구 수단은 **그 실패가 보이는
 * 자리에** 붙는다.
 */
describe('StockAdjustScreen — 조회 실패', () => {
  it('실사 목록이 500이면 다시 시도를 함께 낸다', async () => {
    renderScreen(allRoutes([failingRoute(COUNTS_PATH, 500)]), '');

    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.getByRole('button', { name: messages.common.retry })).toBeInTheDocument();
  });

  it('실사 목록이 403이면 다른 문구를 내고 다시 시도를 내지 않는다', async () => {
    renderScreen(allRoutes([failingRoute(COUNTS_PATH, 403)]), '');

    await screen.findByText(messages.httpError.forbidden);

    expect(screen.getByText(messages.httpError.title)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  /** 실사 차이 실패의 복구 수단은 **대상 구획**에 붙는다 — 그 자리에서 실패가 보인다. */
  it('실사 차이가 실패하면 대상 구획에 배너와 복구 수단이 선다', async () => {
    const { user } = renderScreen(allRoutes([failingRoute(VARIANCE_PATH, 500)]));

    await waitForCounts();
    await user.click(loadButton());

    await within(linesPane()).findByText(messages.httpError.loadTitle);

    expect(
      within(linesPane()).getByRole('button', { name: messages.common.retry }),
    ).toBeInTheDocument();
  });

  /** 참조가 실패하면 이름 자리에 사유가 서고, 복구 수단이 표 아래에 붙는다. */
  it('참조가 실패하면 이름 자리에 사유가 서고 복구 수단이 붙는다', async () => {
    const { user } = renderScreen(allRoutes([failingRoute(ITEMS_PATH, 500)]));

    await loadVariance(user);

    await screen.findByText(t.reasons.lineReferencesFailed);

    expect(within(linesPane()).getAllByText(t.values.referenceFailed).length).toBeGreaterThan(0);
    expect(
      within(linesPane()).getByRole('button', { name: messages.common.retry }),
    ).toBeInTheDocument();
  });

  /**
   * **참조 복구도 누르면 실제로 되살아난다.** 위 감지기는 버튼이 **서는지**만 재고,
   * 화면이 그 버튼에 매단 함수가 정말 넷을 다시 부르는지는 이 감지기가 가른다 —
   * 배선이 끊기면 안내와 버튼은 그대로인 채 아무 일도 일어나지 않는다.
   */
  it('참조 실패의 다시 시도를 누르면 그 조회가 다시 나간다', async () => {
    const { requests, user } = renderScreen(allRoutes([failingRoute(ITEMS_PATH, 500)]));

    await loadVariance(user);
    await screen.findByText(t.reasons.lineReferencesFailed);

    const before = requestsTo(requests, ITEMS_PATH).length;

    await user.click(within(linesPane()).getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, ITEMS_PATH).length).toBeGreaterThan(before);
    });
  });

  /** 장부 조회가 실패하면 장부 자리에 사유가 서고 그 사실을 밝힌다 — 0으로 접지 않는다. */
  it('장부 조회가 실패하면 장부 자리에 사유가 선다', async () => {
    const { user } = renderScreen(allRoutes([failingRoute(BALANCES_PATH, 500)]), '');

    await screen.findByText(t.source.directNote);
    await startDirectLine(user);

    await user.click(screen.getByLabelText(t.lineTable.locationLabel(1)));
    await user.click(screen.getByRole('option', { name: LOCATION_LABEL }));

    await screen.findByText(t.reasons.balancesFailed);

    expect(cellsOf(0)[3]).toBe(t.bookQty.failed);
  });

  /**
   * **복구 수단이 그 실패가 보이는 자리에 붙는다**(C16). 없으면 사용자에게 남는 조치가
   * 줄을 지웠다 다시 더하거나 새로고침뿐이다 — 같은 위치를 다시 골라도 다시 나가지 않는다.
   */
  it('장부 조회 실패에 다시 시도가 붙고 누르면 다시 나간다', async () => {
    const { requests, user } = renderScreen(allRoutes([failingRoute(BALANCES_PATH, 500)]), '');

    await screen.findByText(t.source.directNote);
    await startDirectLine(user);

    await user.click(screen.getByLabelText(t.lineTable.locationLabel(1)));
    await user.click(screen.getByRole('option', { name: LOCATION_LABEL }));

    await screen.findByText(t.reasons.balancesFailed);

    const before = requestsTo(requests, BALANCES_PATH).length;

    await user.click(within(linesPane()).getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, BALANCES_PATH).length).toBeGreaterThan(before);
    });
  });

  /**
   * ⭐ **창고만 실패해도 막다른 길이 되지 않는다**(리뷰 R-1).
   *
   * 창고 선택지가 0건이면 직접 등록 갈래는 줄을 세울 수 없어 대상 구획이 빈 상태로 선다 —
   * 복구 수단을 그 안쪽에 두면 **화면 전체에 「다시 시도」가 한 개도 없다.**
   */
  it('창고만 실패해도 복구 수단이 서고 그 사실을 창고로 말한다', async () => {
    const { requests, user } = renderScreen(allRoutes([failingRoute(WAREHOUSES_PATH, 500)]), '');

    await screen.findByText(t.reasons.warehousesFailed);

    /* 줄이 0행이라 대상 구획은 빈 상태다 — 그래도 복구가 선다. */
    expect(screen.getByText(t.empty.noLinesTitle)).toBeInTheDocument();

    /*
     * **누르면 실제로 되살아나는지를 잰다.** 「버튼이 서 있다」만 재면 누르기 전에도 참이라
     * 아무것도 재지 않는다 — 배선이 끊겨도 그 막다른 길이 **조용히** 돌아온다.
     * 화면이 prop에 넘긴 함수가 정말 조회를 다시 부르는지는 여기서만 갈린다.
     */
    const before = requestsTo(requests, WAREHOUSES_PATH).length;

    await user.click(within(sourcePane()).getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, WAREHOUSES_PATH).length).toBeGreaterThan(before);
    });
  });

  /**
   * **안내가 말하는 넷과 조건이 보는 넷이 같다.** 창고만 실패했는데 「위치·품목·단위·자재
   * LOT을 불러오지 못했습니다」가 서면 그 넷은 정상이라 **사실이 아닌 문구**가 된다.
   */
  it('창고만 실패하면 라인 참조 안내는 서지 않는다', async () => {
    renderScreen(allRoutes([failingRoute(WAREHOUSES_PATH, 500)]), '');

    await screen.findByText(t.reasons.warehousesFailed);

    expect(screen.queryByText(t.reasons.lineReferencesFailed)).not.toBeInTheDocument();
  });

  /** 짝 방향 — 라인 참조만 실패하면 창고 안내는 서지 않는다. */
  it('라인 참조만 실패하면 창고 안내는 서지 않는다', async () => {
    const { user } = renderScreen(allRoutes([failingRoute(ITEMS_PATH, 500)]));

    await loadVariance(user);
    await screen.findByText(t.reasons.lineReferencesFailed);

    expect(screen.queryByText(t.reasons.warehousesFailed)).not.toBeInTheDocument();
  });
});

/**
 * ⭐ **받은 것이 전부인지를 말한다**(리뷰 R-2).
 *
 * 계약이 이 조회에 페이지네이션을 못 박았다. 잘린 줄 모르고 「N행을 가져왔습니다」로 말하면
 * 조정되지 않은 차이가 남은 채로 전표가 올라간다 — 되돌릴 수 없는 쓰기 앞의 조용한 누락이다.
 */
describe('StockAdjustScreen — 실사 차이 잘림', () => {
  const truncatedVarianceRoutes = (): StubRoute[] =>
    allRoutes([getRoute(VARIANCE_PATH, countVarianceLineFixtures, 12)]);

  it('앞쪽 일부만 왔으면 받은 수와 전체 수를 함께 말한다', async () => {
    const { user } = renderScreen(truncatedVarianceRoutes());

    await loadVariance(user);

    expect(screen.getByText(t.source.loadedTruncatedNote(3, 12))).toBeInTheDocument();
  });

  /** 잘린 상태에서 **완결을 주장하지 않는다** — 이 문구가 서면 사용자가 전부로 읽는다. */
  it('잘렸으면 「전부 가져왔다」로 말하지 않는다', async () => {
    const { user } = renderScreen(truncatedVarianceRoutes());

    await loadVariance(user);

    expect(screen.getByText(t.source.loadedTruncatedNote(3, 12))).toBeInTheDocument();
    expect(screen.queryByText(t.source.loadedNote(3))).not.toBeInTheDocument();
  });

  /** 표를 보지 않는 사용자에게도 닿아야 한다 — 살아 있는 영역으로 알린다. */
  it('잘림을 살아 있는 영역으로 알린다', async () => {
    const { user } = renderScreen(truncatedVarianceRoutes());

    await loadVariance(user);

    expect(within(sourcePane()).getByText(t.source.loadedTruncatedNote(3, 12))).toHaveAttribute(
      'role',
      'status',
    );
  });

  /** 짝 방향 — 전부 왔으면 완결을 말한다. 「늘 잘렸다」로 통과하지 않게 한다. */
  it('전부 왔으면 완결을 말한다', async () => {
    const { user } = renderScreen(allRoutes());

    await loadVariance(user);

    expect(screen.getByText(t.source.loadedNote(3))).toBeInTheDocument();
    expect(screen.queryByText(t.source.loadedTruncatedNote(3, 12))).not.toBeInTheDocument();
  });

  /** 잘림 여부와 무관하게 **받은 줄은 그대로 선다** — 잘렸다고 대상을 비우지 않는다. */
  it('잘려도 받은 줄은 조정 대상으로 선다', async () => {
    const { user } = renderScreen(truncatedVarianceRoutes());

    await loadVariance(user);

    expect(bodyRows()).toHaveLength(3);
  });
});

/**
 * **「없는 실사였다」 안내에 수명이 있다**(리뷰 R-4).
 *
 * 남겨 두면 유효한 실사를 고른 뒤에도 **이미 한 조치를 계속 지시**하고, 직접 등록으로 바꾸면
 * 실사 선택칸이 없는 구획에서 **화면에 없는 컨트롤을 쓰라고** 말한다.
 */
describe('StockAdjustScreen — 정리 안내의 수명', () => {
  it('유효한 실사를 고르면 안내가 걷힌다', async () => {
    const { user } = renderScreen(allRoutes(), '?count=9109');

    await screen.findByText(t.source.countNotFoundNote);

    await user.click(countField());
    await user.click(screen.getByRole('option', { name: COUNT_LABEL }));

    await waitFor(() => {
      expect(screen.queryByText(t.source.countNotFoundNote)).not.toBeInTheDocument();
    });
  });

  it('직접 등록으로 바꾸면 안내가 걷힌다 — 없는 컨트롤을 지시하지 않는다', async () => {
    const { user } = renderScreen(allRoutes(), '?count=9109');

    await screen.findByText(t.source.countNotFoundNote);
    await user.click(screen.getByRole('radio', { name: t.source.direct }));

    await waitFor(() => {
      expect(screen.queryByText(t.source.countNotFoundNote)).not.toBeInTheDocument();
    });
  });
});

/**
 * ⭐ **「다시 불러오기」의 두 방향**(리뷰 R-6 · 사본 체크리스트 11번).
 *
 * 호출 횟수에 따라 **내용이 달라지는 스텁**이 있어야 이 자리가 실제로 물린다 — 같은 구조를
 * 되돌리는 스텁으로는 「값이 바뀌었다」를 재는 감지기가 부분 견줌으로 헛통과한다.
 */
describe('StockAdjustScreen — 같은 실사를 다시 불러오기', () => {
  /** 부를 때마다 다른 본문을 주는 스텁. 두 번째 호출에서 차이가 달라진다. */
  const changingVarianceRoute = (): StubRoute => {
    let call = 0;

    return {
      match: (request) => isGet(request, VARIANCE_PATH),
      respond: () => {
        call += 1;

        return jsonResponse(
          listBody(
            call === 1
              ? countVarianceLineFixtures
              : [countVarianceLineResponse({ systemQty: 100, countedQty: 93, varianceQty: -7 })],
          ),
        );
      },
    };
  };

  /**
   * ⓐ **같은 값이 다시 와도 친 값이 남는다**(수명 표 6행). 여기서 다시 세우면 재조회 한 번에
   * 사용자가 친 차이 수량이 말없이 되돌아간다.
   */
  it('같은 응답으로 다시 불러오면 친 값이 그대로다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await loadVariance(user);
    await user.clear(diffBox(1));
    await user.type(diffBox(1), '-33');

    await user.click(loadButton());

    await waitFor(() => {
      expect(requestsTo(requests, VARIANCE_PATH)).toHaveLength(2);
    });

    expect(diffBox(1)).toHaveValue('-33');
  });

  /**
   * ⓑ **응답이 실제로 달라지면 대상이 다시 선다.** 낡은 장부로 실물을 파생하면 사용자가
   * 확인하지 않은 수가 화면에 선다.
   */
  it('달라진 응답으로 다시 불러오면 대상이 다시 선다', async () => {
    const { user } = renderScreen(allRoutes([changingVarianceRoute()]));

    await loadVariance(user);

    expect(bodyRows()).toHaveLength(3);

    await user.click(loadButton());

    await waitFor(() => {
      expect(bodyRows()).toHaveLength(1);
    });

    expect(diffBox(1)).toHaveValue('-7');
  });

  /** 다시 누르면 **요청이 실제로 나간다** — 아무 일도 하지 않는 버튼이 아니다. */
  it('다시 누르면 조회가 다시 나간다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await loadVariance(user);

    expect(requestsTo(requests, VARIANCE_PATH)).toHaveLength(1);

    await user.click(loadButton());

    await waitFor(() => {
      expect(requestsTo(requests, VARIANCE_PATH)).toHaveLength(2);
    });
  });
});

/**
 * ⭐ **블라인드 실사는 장부를 내려보내지 않는다**(리뷰 R-7).
 *
 * 그대로 믿으면 장부 칸에 「undefined 개」가, 실물 칸에 「NaN 개」가 선다 — 이 슬라이스가
 * 다른 자리마다 「수를 지어내지 않는다」로 막아 둔 바로 그 사고다.
 */
describe('StockAdjustScreen — 장부가 없이 오는 실사', () => {
  const blindVarianceRoute = (): StubRoute => {
    const line: Record<string, unknown> = { ...countVarianceLineResponse() };

    delete line.systemQty;

    return {
      match: (request) => isGet(request, VARIANCE_PATH),
      respond: () => jsonResponse(listBody([line])),
    };
  };

  it('장부와 실물이 빈 값 표식이고 수를 지어내지 않는다', async () => {
    const { user } = renderScreen(allRoutes([blindVarianceRoute()]));

    await loadVariance(user);

    expect(cellsOf(0)[3]).toBe(t.values.empty);
    expect(cellsOf(0)[4]).toBe(t.values.empty);
  });

  /**
   * **이유 없는 대시를 남기지 않는다**(리뷰 N-3 — 장부를 `null`로 받게 한 수정의 2차 효과).
   *
   * 승계 줄은 사용자가 채울 것이 아무것도 없는데 두 열이 통째로 비어 있다 — 왜 비었는지와
   * 그래도 조정할 수 있다는 것을 함께 말하지 않으면 사용자가 화면을 고장으로 읽는다.
   */
  it('왜 비었는지와 그래도 조정할 수 있다는 것을 함께 말한다', async () => {
    const { user } = renderScreen(allRoutes([blindVarianceRoute()]));

    await loadVariance(user);

    expect(screen.getByText(t.notes.bookQtyOptional)).toBeInTheDocument();
  });

  /**
   * ⛔ **짝 방향 — 갓 더한 빈 줄에는 서지 않는다.** 승계 줄이 아닌 `notAsked`까지 더하면
   * 줄을 더할 때마다 안내가 떠서 정상 상태가 사고처럼 보인다.
   */
  it('갓 더한 빈 줄에는 그 안내가 서지 않는다', async () => {
    const { user } = renderScreen(allRoutes(), '');

    await screen.findByText(t.source.directNote);
    await startDirectLine(user);

    expect(screen.getByText(t.lineTable.bookQty)).toBeInTheDocument();
    expect(screen.queryByText(t.notes.bookQtyOptional)).not.toBeInTheDocument();
  });

  it.each(['undefined', 'NaN'])('%o가 화면에 서지 않는다', async (word) => {
    const { user } = renderScreen(allRoutes([blindVarianceRoute()]));

    await loadVariance(user);

    expect(screen.getByText(t.lineTable.bookQty)).toBeInTheDocument();
    expect(within(linesPane()).queryByText(new RegExp(word))).not.toBeInTheDocument();
  });

  /** 그 줄도 조정할 수 있다 — 장부를 모르는 것과 조정할 수 없는 것은 다르다. */
  it('장부를 몰라도 그 줄을 조정할 수 있다', async () => {
    const { user } = renderScreen(allRoutes([blindVarianceRoute()]));

    await loadVariance(user);

    expect(diffBox(1)).toBeEnabled();
    expect(diffBox(1)).toBeValid();
  });
});

/* ────────────────────────────────────────────────────────────────────────────
 * 등록 — **이 화면에서 되돌릴 수 없는 첫 쓰기**
 * ──────────────────────────────────────────────────────────────────────────── */

const ADJUSTMENTS_PATH = '/inventory/adjustments';

const isPost = (request: Request, pathname: string): boolean =>
  request.method === 'POST' && new URL(request.url).pathname === pathname;

/**
 * 등록이 성공하는 경로. 응답 본문은 계약과 같은 모양(머리 + 라인)이다.
 *
 * **201도 `ETag`를 준다**(계약) — 그 토큰은 **컬렉션 경로**에 앉으므로 상신·전기가 집어 가면
 * 안 된다. 그 배선은 뒤따르는 회차의 것이고, 여기서는 값이 오는 사실만 재현한다.
 */
const createRoute = (body: unknown = adjustmentDetailBody()): StubRoute => ({
  match: (request) => isPost(request, ADJUSTMENTS_PATH),
  respond: () => jsonResponse(body, { status: 201, headers: { ETag: 'W/"ia-9301"' } }),
});

/**
 * 부를 때마다 **다른 전표**를 되돌려 주는 경로.
 *
 * 「앞 전표의 사실이 새 등록에 덮이지 않는다」를 재려면 두 번호가 실제로 갈려야 한다 —
 * 같은 번호를 두 번 주면 덮였는지 남았는지 화면에서 가릴 수 없다.
 */
const sequencedCreateRoute = (adjustmentNos: string[]): StubRoute => {
  let call = 0;

  return {
    match: (request) => isPost(request, ADJUSTMENTS_PATH),
    respond: () => {
      const inventoryAdjustmentNo = adjustmentNos[call] ?? adjustmentNos.at(-1) ?? '';

      call += 1;

      return jsonResponse(adjustmentDetailBody({ inventoryAdjustmentNo }), { status: 201 });
    },
  };
};

/** 등록이 서버에 거절되는 경로. 갈래마다 화면이 하는 말이 달라야 한다(C27). */
const failingCreateRoute = (status: number, body: unknown = { message: '' }): StubRoute => ({
  match: (request) => isPost(request, ADJUSTMENTS_PATH),
  respond: () => jsonResponse(body, { status }),
});

/** 서버가 **한 칸을 지목해** 거절하는 갈래. 그 칸에 그릴 자리가 있는지에 따라 서는 곳이 갈린다. */
const fieldErrorRoute = (field: string, message: string): StubRoute =>
  failingCreateRoute(400, {
    errors: [{ scope: 'field', field, code: 'SAMPLE_ERR', message }],
  });

/** 응답이 아예 오지 않는 갈래 — **보내지지 않았다고 단정할 수 없다.** */
const offlineCreateRoute = (): StubRoute => ({
  match: (request) => isPost(request, ADJUSTMENTS_PATH),
  respond: () => {
    throw new TypeError('Failed to fetch');
  },
});

const createRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => isPostRecord(request));

const isPostRecord = (request: RecordedRequest): boolean =>
  request.method === 'POST' && request.url.pathname === ADJUSTMENTS_PATH;

/** 나간 등록 본문. **실제로 나간 것을 본다.** */
const lastCreateBody = (requests: RecordedRequest[]): Record<string, unknown> =>
  (createRequests(requests).at(-1)?.body ?? {}) as Record<string, unknown>;

const sentLines = (requests: RecordedRequest[]): Record<string, unknown>[] =>
  (lastCreateBody(requests).lines ?? []) as Record<string, unknown>[];

const registerPane = (): HTMLElement => screen.getByRole('region', { name: t.panes.register });

const registerButton = (): HTMLElement =>
  within(registerPane()).getByRole('button', { name: t.actions.register });

const discardButton = (): HTMLElement =>
  within(registerPane()).getByRole('button', { name: t.actions.discard });

const confirmRegisterButton = (): HTMLElement =>
  screen.getByRole('button', { name: new RegExp(t.actions.confirmRegister) });

const reasonField = (): HTMLElement => within(registerPane()).getByLabelText(t.fields.reasonCode);

/** 값 목록이 확정된 뒤의 화면을 만든다 — **자리표시를 채우면 등록이 살아나는지**가 요점이다. */
const withReasonCodes = (): void => {
  codeValues.reason = [SAMPLE_REASON];
};

const chooseReason = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(reasonField());
  await user.click(screen.getByRole('option', { name: SAMPLE_REASON }));
};

/** 실사 차이를 불러오고 사유까지 골라 **보낼 수 있는 상태**로 만든다. */
const readyToRegister = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await loadVariance(user);
  await chooseReason(user);
};

/**
 * 직접 등록 갈래에서 줄 하나를 **끝까지 채운다.**
 *
 * 승계 줄과 달리 위치·품목·단위가 비어 있으므로, 채우지 않으면 등록이 「표의 오류」로 잠긴다 —
 * 그 상태로 등록 갈래를 재면 재려던 것과 다른 사정을 재게 된다.
 */
const fillDirectLine = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await startDirectLine(user);

  await user.click(screen.getByLabelText(t.lineTable.locationLabel(1)));
  await user.click(screen.getByRole('option', { name: LOCATION_LABEL }));
  await user.click(screen.getByLabelText(t.lineTable.itemLabel(1)));
  await user.click(screen.getByRole('option', { name: ITEM_LABEL }));
  await user.click(screen.getByLabelText(t.lineTable.uomLabel(1)));
  await user.click(screen.getByRole('option', { name: UOM_LABEL }));
  await user.type(diffBox(1), '-20');
};

/** 확인 창을 열고 실행까지 누른다. **두 걸음이 갈려 있어야** 창만 열린 상태도 잴 수 있다. */
const submitRegister = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(registerButton());
  await user.click(confirmRegisterButton());
};

const setupAndRegister = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await readyToRegister(user);
  await submitRegister(user);
};

/**
 * **등록이 막힌 사유**(C17).
 *
 * 순서가 뜻을 정한다 — 먼저 **고쳐도 풀리지 않는 사정**을 말하고, 그다음이 지금 고칠 수 있는
 * 것들이다. 뒤집으면 사용자가 고칠 수 있는 것을 다 고친 뒤에야 막다른 벽을 만난다.
 */
describe('StockAdjustScreen — 등록이 막힌 사유', () => {
  it('값 목록이 비어 있으면 등록이 잠기고 그 사정을 말한다', async () => {
    const { user } = renderScreen(allRoutes());

    await loadVariance(user);

    expect(registerButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.registerReasonPending)).toBeInTheDocument();
  });

  /** ⭐ **자리표시가 죽은 가지가 아니라는 증거** — 배열을 채우면 사유 갈래가 바뀐다(D-9). */
  it('값 목록이 채워지면 사정이 「아직 안 골랐다」로 바뀐다', async () => {
    withReasonCodes();

    const { user } = renderScreen(allRoutes());

    await loadVariance(user);

    expect(registerButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.registerNeedsReason)).toBeInTheDocument();
    expect(screen.queryByText(t.actionReasons.registerReasonPending)).not.toBeInTheDocument();
  });

  /** 짝 양성 — 사유를 고르면 **등록이 실제로 열린다.** */
  it('사유를 고르면 등록이 열리고 잠긴 사유가 사라진다', async () => {
    withReasonCodes();

    const { user } = renderScreen(allRoutes());

    await readyToRegister(user);

    expect(registerButton()).toBeEnabled();
    expect(registerButton()).not.toHaveAccessibleDescription();
  });

  it('조정 대상이 없으면 등록이 잠기고 그 사정을 말한다', async () => {
    withReasonCodes();

    const { user } = renderScreen(allRoutes(), '');

    await screen.findByText(t.source.directNote);
    await chooseReason(user);

    expect(registerButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.registerNeedsLines)).toBeInTheDocument();
  });

  /** 잘못 친 값이 **아직 안 친 칸보다 먼저**다 — 지금 고칠 수 있는 것을 먼저 말한다. */
  it('줄에 오류가 있으면 등록이 잠기고 그 사정을 말한다', async () => {
    withReasonCodes();

    const { user } = renderScreen(allRoutes());

    await readyToRegister(user);
    await user.clear(diffBox(1));

    expect(registerButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.registerLineInvalid)).toBeInTheDocument();
  });

  /**
   * **줄은 있는데 보낼 줄이 없는 갈래.** 계약이 최소 1행을 요구하므로 이대로는 만들 수 없다 —
   * 「줄이 없습니다」로 말하면 표에 줄이 보이는 사용자가 화면을 고장으로 읽는다.
   */
  it('모든 줄이 차이 0이면 등록이 잠기고 그 사정을 말한다', async () => {
    withReasonCodes();

    const { user } = renderScreen(allRoutes());

    await readyToRegister(user);

    for (const lineNo of [1, 2, 3]) {
      await user.clear(diffBox(lineNo));
      await user.type(diffBox(lineNo), '0');
    }

    expect(registerButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.registerAllExcluded)).toBeInTheDocument();
  });
});

/**
 * ⭐ **잘린 목록으로 등록하지 않는다**(앞 회차가 세운 `truncated` 판정의 소비처).
 *
 * 못 받은 줄은 조정 대상에 실리지 않고 그 차이는 **조정되지 않은 채 남는다** — 되돌릴 수 없는
 * 쓰기 앞의 조용한 누락이라, 화면은 사실을 밝히는 데서 멈추지 않고 **막는다.**
 */
describe('StockAdjustScreen — 실사 차이가 잘린 채로는 등록하지 않는다', () => {
  const truncatedVarianceRoute = (): StubRoute => ({
    match: (request) => isGet(request, VARIANCE_PATH),
    respond: () => jsonResponse(listBody(countVarianceLineFixtures, 12)),
  });

  it('잘린 채로는 등록이 잠기고 무엇이 남는지 말한다', async () => {
    withReasonCodes();

    const { user } = renderScreen(allRoutes([truncatedVarianceRoute()]));

    await readyToRegister(user);

    expect(registerButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.registerVarianceTruncated)).toBeInTheDocument();
  });

  /** 짝 방향 — 온전히 받았으면 열린다. 「늘 막는다」로 통과하지 않게 한다. */
  it('온전히 받았으면 등록이 열린다', async () => {
    withReasonCodes();

    const { user } = renderScreen(allRoutes());

    await readyToRegister(user);

    expect(registerButton()).toBeEnabled();
  });

  /**
   * **직접 등록 갈래는 이 판정에 걸리지 않는다** — 실사 목록이 대상이 아니다.
   * 잘림 판정을 갈래로 좁히지 않으면 실사와 무관한 조정이 영영 막힌다.
   */
  it('직접 등록 갈래는 실사 목록이 잘려도 막히지 않는다', async () => {
    withReasonCodes();

    const { user } = renderScreen(
      allRoutes([truncatedVarianceRoute(), getRoute(COUNTS_PATH, countFixtures, 9)]),
      '',
    );

    await screen.findByText(t.source.directNote);
    await fillDirectLine(user);
    await chooseReason(user);

    expect(registerButton()).toBeEnabled();
  });
});

/**
 * **확인 창**(C25) — 되돌릴 수 없는 조작 앞의 마지막 층.
 */
describe('StockAdjustScreen — 등록 확인 창', () => {
  it('등록을 누르면 확인 창이 서고 요청은 아직 나가지 않는다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(allRoutes([createRoute()]));

    await readyToRegister(user);
    await user.click(registerButton());

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(createRequests(requests)).toHaveLength(0);
  });

  /** **창이 되보이는 값이 실제로 나가는 값과 같다** — 창이 따로 세지 않는다. */
  it('확인 창이 실릴 줄과 빠질 줄을 밝힌다', async () => {
    withReasonCodes();

    const { user } = renderScreen(allRoutes([createRoute()]));

    await readyToRegister(user);
    await user.click(registerButton());

    const dialog = screen.getByRole('dialog');

    /* 픽스처 세 줄 가운데 하나가 차이 0이다 — 실릴 줄 둘, 빠질 줄 하나. */
    expect(within(dialog).getByText(t.dialog.includedLineCount(2))).toBeVisible();
    expect(within(dialog).getByText(t.dialog.excludedLineCount(1))).toBeVisible();
  });

  it('계속 입력을 누르면 창이 닫히고 요청이 나가지 않는다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(allRoutes([createRoute()]));

    await readyToRegister(user);
    await user.click(registerButton());
    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(createRequests(requests)).toHaveLength(0);
  });

  /** 두 번 눌러도 **요청은 한 번**이다 — 잠금이 표시만이면 두 번째 클릭이 그대로 통한다. */
  it('실행 버튼을 두 번 눌러도 요청은 한 번이다', async () => {
    withReasonCodes();

    const { requests, release, user } = renderScreen(allRoutes([createRoute()]), '?count=9101', [
      ADJUSTMENTS_PATH,
    ]);

    await setupAndRegister(user);

    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(1);
    });

    await user.click(confirmRegisterButton());

    expect(createRequests(requests)).toHaveLength(1);

    release();

    await screen.findByText(t.result.createdTitle('SAMPLE-IA-9301'));
  });

  /**
   * **「닫혀도 나가는 요청이 무너지지 않게」의 본체**(사본 체크리스트 5번의 셋째 방어).
   *
   * Escape는 막을 수 없다 — native `<dialog>`가 `cancel`을 내고 디자인 시스템이 그것을 닫기
   * 요청으로 잇는다. 규율이 실제로 걸리는 것은 **나가는 중**이다: 그때 `onClose`가 `reset()`을
   * 부르면 공통 훅의 옵저버가 떨어져 **성공도 잠금 해제도 오지 않는다.** 그러면 사용자는
   * 만들어진 전표를 못 본 채 폼이 다시 열린 화면을 보고 한 번 더 등록한다 — **전표 두 벌**이다.
   *
   * jsdom은 Escape 키를 native 취소로 잇지 않으므로 브라우저가 내는 이벤트를 직접 만든다.
   */
  it('전송 중 Escape로 창이 닫혀도 등록 결과가 살아 있다', async () => {
    withReasonCodes();

    const { requests, release, user } = renderScreen(allRoutes([createRoute()]), '?count=9101', [
      ADJUSTMENTS_PATH,
    ]);

    await setupAndRegister(user);

    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(1);
    });

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    /* ① 창을 닫는 것이 요청을 다시 내지도, 되돌리지도 않는다. */
    expect(createRequests(requests)).toHaveLength(1);
    /* ② 잠금이 살아 있다 — 요청은 아직 날아가는 중이다. */
    expect(registerButton()).toBeDisabled();
    expect(screen.getAllByText(t.actionReasons.saving).length).toBeGreaterThan(0);

    release();

    /* ③ 성공이 사라지지 않는다 — 결과 구획이 실제로 선다. */
    expect(await screen.findByText(t.result.createdTitle('SAMPLE-IA-9301'))).toBeVisible();
    /* ④ 성공 뒤 잠금·사유도 그대로 온다 — 창을 닫은 것이 그 길을 끊지 않았다. */
    expect(screen.getAllByText(t.actionReasons.alreadyRegistered).length).toBeGreaterThan(0);
  });
});

/**
 * **등록 요청**(C18·C20·C21·C22) — 실제로 나간 것을 본다.
 */
describe('StockAdjustScreen — 등록 요청', () => {
  const registerRoutes = (create: StubRoute = createRoute()): StubRoute[] => allRoutes([create]);

  it('확인하면 등록이 정확히 1회 나가고 경로가 컬렉션이다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(registerRoutes());

    await setupAndRegister(user);

    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(1);
    });
    expect(createRequests(requests)[0]?.url.pathname).toBe(ADJUSTMENTS_PATH);
  });

  /**
   * **멱등 키는 실리고 잠금 토큰은 실리지 않는다**(C18 · D-14).
   *
   * 계약 parameters에 `If-Match`가 없고 응답에 409가 없다 — 새 전표라 견줄 판이 없다.
   */
  it('멱등 키를 싣고 If-Match는 싣지 않는다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(registerRoutes());

    await setupAndRegister(user);

    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(1);
    });

    const sent = createRequests(requests)[0];

    expect(sent?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/i);
    expect(sent?.headers.has('If-Match')).toBe(false);
  });

  /** ⭐ **차이 0인 줄이 빠진다**(C19) — 표에 셋이 보였고 나가는 것은 둘이다. */
  it('차이가 0인 줄이 본문에서 빠진다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(registerRoutes());

    await readyToRegister(user);

    expect(bodyRows()).toHaveLength(3);

    await submitRegister(user);

    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(1);
    });
    expect(sentLines(requests)).toHaveLength(2);
  });

  /** ⭐ **줄이는 조정이 정상 경로다**(C21 · 조심 ② · 뮤테이션 M-2). */
  it('음수 차이가 그대로 실린다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(registerRoutes());

    await readyToRegister(user);
    await user.clear(diffBox(1));
    await user.type(diffBox(1), '-20');
    await submitRegister(user);

    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(1);
    });
    expect(sentLines(requests)[0]?.adjustmentQty).toBe(-20);
  });

  /** **라인 사유를 싣지 않는다**(C20 · D-7 · 미결 #87). 승계 줄에는 실사 사유가 실려 있다. */
  it('본문의 라인 키 집합에 사유가 없다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(registerRoutes());

    await setupAndRegister(user);

    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(1);
    });

    const lines = sentLines(requests);

    /* 짝 양성 — 줄은 실제로 실렸고 원천 라인 번호도 함께 갔다. */
    expect(lines).toHaveLength(2);
    expect(lines[0]?.inventoryCountLineId).toBe(9111);
    expect(Object.keys(lines[0] ?? {})).not.toContain('reasonCode');
  });

  /** **ERP 송신 기본값이 참이다**(C22 · D-11) — 계약 기본값과 같다. */
  it('ERP 송신이 기본으로 참으로 실린다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(registerRoutes());

    await setupAndRegister(user);

    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(1);
    });
    expect(lastCreateBody(requests).sendToErp).toBe(true);
  });

  it('ERP 송신을 끄면 거짓으로 실린다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(registerRoutes());

    await readyToRegister(user);
    await user.click(within(registerPane()).getByLabelText(t.fields.sendToErp));
    await submitRegister(user);

    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(1);
    });
    expect(lastCreateBody(requests).sendToErp).toBe(false);
  });

  /** 실사에서 불러왔으면 그 실사가 헤더에 남는다 — 승계 근거가 전표에 남는 자리다. */
  it('불러온 실사가 본문에 실린다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(registerRoutes());

    await setupAndRegister(user);

    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(1);
    });
    expect(lastCreateBody(requests).inventoryCountId).toBe(9101);
  });

  /** **실사 참조가 비어 있는 것이 정상이다**(조심 ⑤) — 직접 등록에는 그 키가 없다. */
  it('직접 등록이면 실사 참조 키가 본문에 없다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(registerRoutes(), '');

    await screen.findByText(t.source.directNote);
    await fillDirectLine(user);
    await chooseReason(user);
    await submitRegister(user);

    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(1);
    });

    /* 짝 양성 — 본문은 실제로 만들어졌다. */
    expect(lastCreateBody(requests).reasonCode).toBe(SAMPLE_REASON);
    expect(Object.keys(lastCreateBody(requests))).not.toContain('inventoryCountId');
  });

  /** ⛔ **승인 대기 조건을 등록에도 싣지 않는다**(D-3) — 이 화면의 모든 요청에서 0건이다. */
  it('등록 요청 주소에 승인 대기 조건이 없다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(registerRoutes());

    await setupAndRegister(user);

    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(1);
    });
    expect(
      requests.filter((request) => request.url.search.includes('pendingApprovalOnly')),
    ).toEqual([]);
  });
});

/**
 * **전송 중**(C28의 앞 절반) — 응답이 오기 전 상태에서 조작 자리가 하나라도 열려 있으면
 * 그 자리가 전표 한 벌이다.
 */
describe('StockAdjustScreen — 보내는 중', () => {
  it('보내는 중에는 폼·표·대상 전환이 잠기고 사유가 보인다', async () => {
    withReasonCodes();

    const { requests, release, user } = renderScreen(allRoutes([createRoute()]), '?count=9101', [
      ADJUSTMENTS_PATH,
    ]);

    await setupAndRegister(user);

    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(1);
    });

    expect(screen.getAllByText(t.actionReasons.saving).length).toBeGreaterThan(0);
    expect(reasonField()).toBeDisabled();
    expect(within(registerPane()).getByLabelText(t.fields.sendToErp)).toBeDisabled();
    expect(diffBox(1)).toBeDisabled();
    expect(addLineButton()).toBeDisabled();
    expect(registerButton()).toBeDisabled();
    expect(countField()).toBeDisabled();
    expect(screen.getByRole('radio', { name: t.source.direct })).toBeDisabled();
    /* 확인 창의 실행 버튼도 잠긴다 — 창은 아직 열려 있다(실패했을 때 사유를 낼 자리다). */
    expect(confirmRegisterButton()).toBeDisabled();

    release();

    await screen.findByText(t.result.createdTitle('SAMPLE-IA-9301'));
  });

  /**
   * ⭐ **버리기만은 열려 있다** — 서버를 부르지 않는 조작이라 응답을 기다리는 동안 사용자를
   * 묶어 둘 이유가 없다. 대신 창이 **보낸 등록은 되돌아가지 않는다**는 사실을 밝힌다.
   */
  it('보내는 중에도 초안 버리기는 열려 있고 창이 사실을 밝힌다', async () => {
    withReasonCodes();

    const { requests, release, user } = renderScreen(allRoutes([createRoute()]), '?count=9101', [
      ADJUSTMENTS_PATH,
    ]);

    await setupAndRegister(user);

    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(1);
    });

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    expect(discardButton()).toBeEnabled();

    await user.click(discardButton());

    expect(screen.getByText(t.dialog.discardWhileSaving)).toBeVisible();

    release();
  });
});

/**
 * ⭐ **초안 세션**(C28 · D-15) — 등록에는 아직 자원 번호가 없어 두 초안을 가르는 축이 이것뿐이다.
 *
 * 되먹임 셋(성공·나가는 중·실패)이 **같은 문**을 지나는지 두 방향으로 잰다.
 */
describe('StockAdjustScreen — 버린 초안의 되먹임', () => {
  /**
   * 나가는 중에 초안을 버리고 응답을 받는 자리까지 간다.
   *
   * `sent`는 **이 시점까지 나갔어야 할 등록 요청 수**다 — 되풀이해 부를 때 앞 요청까지 함께
   * 세지 않으면 「아직 안 나갔는데 나간 줄 알고」 다음 걸음으로 넘어간다.
   */
  const registerThenDiscard = async (
    user: ReturnType<typeof userEvent.setup>,
    requests: RecordedRequest[],
    sent = 1,
  ): Promise<void> => {
    await setupAndRegister(user);

    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(sent);
    });

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    await user.click(discardButton());
    await user.click(screen.getByRole('button', { name: t.actions.confirmDiscard }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  };

  /**
   * **늦은 실패가 새 초안 위에 서지 않는다.**
   *
   * 앞 초안에서 보낸 요청이 거절돼도 새 초안은 그 거절을 물려받지 않는다 — 사용자는 한 글자도
   * 치지 않은 초안이 이미 거부된 줄 알게 된다.
   */
  it('버린 초안의 400이 새 초안 위에 서지 않는다', async () => {
    withReasonCodes();

    const { requests, release, user } = renderScreen(
      allRoutes([
        failingCreateRoute(400, {
          errors: [{ scope: 'screen', code: 'SAMPLE_ERR', message: '합성 등록 거절' }],
        }),
      ]),
      '?count=9101',
      [ADJUSTMENTS_PATH],
    );

    await registerThenDiscard(user, requests);

    release();

    /*
     * **응답이 실제로 도착한 시점 뒤에 잰다**(사본 체크리스트 9번). 「보내는 중」 사유가
     * 새 초안의 사유(줄이 없다)로 갈리는 것이 그 시점의 양성 앵커다 — 도착 전에 「배너가
     * 없다」를 재면 아직 아무 일도 없는 화면에서 늘 통과한다.
     */
    await screen.findByText(t.actionReasons.registerNeedsLines);

    expect(screen.getByText(t.empty.noLinesTitle)).toBeInTheDocument();
    expect(screen.queryByText('합성 등록 거절')).not.toBeInTheDocument();
  });

  /**
   * ⭐ **늦은 성공은 감추지 않되 새 초안의 결과로 세우지 않는다.**
   *
   * 서버에는 전표가 실제로 만들어졌으므로 사실을 밝히고(사용자가 모르는 전표가 남으면 안 된다),
   * 결과 구획과 폼 잠금은 **지금 초안의 것이 아니므로** 서지 않는다.
   *
   * **이 시험이 `resetIfIdle` 규율의 감지기이기도 하다** — 초안을 버릴 때 `reset()`을 직접
   * 불렀다면 옵저버가 떨어져 이 성공이 **아예 도착하지 않고**, 아래 안내가 서지 않는다.
   */
  it('버린 초안의 201은 사실만 알리고 결과 구획을 세우지 않는다', async () => {
    withReasonCodes();

    const { requests, release, user } = renderScreen(allRoutes([createRoute()]), '?count=9101', [
      ADJUSTMENTS_PATH,
    ]);

    await registerThenDiscard(user, requests);

    release();

    expect(
      await screen.findByText(t.result.unboundCreatedNote('SAMPLE-IA-9301')),
    ).toBeInTheDocument();

    expect(screen.queryByRole('region', { name: t.result.label })).not.toBeInTheDocument();
    expect(screen.queryByText(t.actionReasons.alreadyRegistered)).not.toBeInTheDocument();
  });

  /**
   * ⭐ **매임 소비처 넷째 — 사유 칸의 서버 오류**(D-15의 「한 자리라도 빠지면 샌다」).
   *
   * 앞 세 갈래(결과 구획·실패 배너·「이미 등록했다」 잠금)는 화면 수준 오류로 재어지는데,
   * **칸 오류는 다른 통로를 지난다**(공통 훅이 `fieldErrors`로 돌린다) — 그 통로만 매임을
   * 빠뜨려도 앞 시험들은 전부 통과한다. 그때 사용자는 **한 글자도 치지 않은 새 초안의 사유
   * 칸이 빨갛게 서 있는** 화면을 본다.
   */
  it('버린 초안의 칸 400이 새 초안의 사유 칸에 서지 않는다', async () => {
    withReasonCodes();

    const { requests, release, user } = renderScreen(
      allRoutes([fieldErrorRoute('reasonCode', '합성 사유 오류')]),
      '?count=9101',
      [ADJUSTMENTS_PATH],
    );

    await registerThenDiscard(user, requests);

    release();

    /* 응답이 실제로 도착한 시점의 양성 앵커 — 위 400 시험과 같은 형태다. */
    await screen.findByText(t.actionReasons.registerNeedsLines);

    expect(screen.queryByText('합성 사유 오류')).not.toBeInTheDocument();
    expect(reasonField()).not.toHaveAttribute('aria-invalid', 'true');
  });

  /**
   * ⭐ **앞 전표의 사실은 새 등록이 성공해도 남는다**(리뷰 R-4).
   *
   * 매임은 한 자리라, 매임 자체에 이 사실을 실으면 다음 등록이 성공하는 순간 앞 전표의 번호가
   * 화면에서 사라진다 — 이 갈래를 만든 이유(사용자가 **모르는 전표**가 서버에 남는다)가 그대로
   * 되돌아온다. 이 슬라이스에는 그 번호를 되찾을 조회 자리가 아직 없다.
   */
  it('버린 초안의 전표번호가 다음 등록 성공에 덮이지 않는다', async () => {
    withReasonCodes();

    const { requests, release, user } = renderScreen(
      allRoutes([sequencedCreateRoute(['SAMPLE-IA-9301', 'SAMPLE-IA-9302'])]),
      '?count=9101',
      [ADJUSTMENTS_PATH],
    );

    await registerThenDiscard(user, requests);

    release();

    await screen.findByText(t.result.unboundCreatedNote('SAMPLE-IA-9301'));

    /* 새 초안을 다시 세워 등록한다 — 이번에는 버리지 않으므로 결과 구획이 선다. */
    await user.click(loadButton());
    await screen.findByRole('table');
    await chooseReason(user);
    await submitRegister(user);
    release();

    const pane = await screen.findByRole('region', { name: t.result.label });

    expect(within(pane).getByText('SAMPLE-IA-9302')).toBeVisible();
    /* 앞 전표의 사실이 그대로 남아 있다 — 덮이지 않는다. */
    expect(screen.getByText(t.result.unboundCreatedNote('SAMPLE-IA-9301'))).toBeInTheDocument();
  });

  /**
   * ⭐ **버린 초안이 둘이면 두 번호가 **모두** 남는다**(리뷰 R-4의 축 — 쌓기).
   *
   * 앞 시험은 「매임과 다른 자리에 있는가」를 재고, 이 시험은 「그 자리가 **덮이지 않고
   * 쌓이는가**」를 잰다 — 하나만 들면 둘째 사고가 첫째 번호를 지운다. 이 경로는 실재한다:
   * 보내는 중 버리기가 열려 있어(그 자체가 이 화면의 판단이다) 되풀이할 수 있다.
   */
  it('버린 초안이 둘이면 두 전표번호가 모두 남는다', async () => {
    withReasonCodes();

    const { requests, release, user } = renderScreen(
      allRoutes([sequencedCreateRoute(['SAMPLE-IA-9301', 'SAMPLE-IA-9302'])]),
      '?count=9101',
      [ADJUSTMENTS_PATH],
    );

    await registerThenDiscard(user, requests);
    release();
    await screen.findByText(t.result.unboundCreatedNote('SAMPLE-IA-9301'));

    /* 같은 일을 한 번 더 — 대상을 다시 세우고 보내는 중에 또 버린다. */
    await user.click(loadButton());
    await screen.findByRole('table');
    await registerThenDiscard(user, requests, 2);
    release();

    expect(
      await screen.findByText(t.result.unboundCreatedNote('SAMPLE-IA-9301, SAMPLE-IA-9302')),
    ).toBeInTheDocument();
  });

  /** 짝 방향 — 버리지 않았으면 결과가 **이 초안 위에 선다.** 「늘 감춘다」로 통과하지 않게 한다. */
  it('초안을 그대로 두면 결과 구획이 선다', async () => {
    withReasonCodes();

    const { user } = renderScreen(allRoutes([createRoute()]));

    await setupAndRegister(user);

    expect(await screen.findByRole('region', { name: t.result.label })).toBeInTheDocument();
    expect(
      screen.queryByText(t.result.unboundCreatedNote('SAMPLE-IA-9301')),
    ).not.toBeInTheDocument();
  });
});

/**
 * **초안 버리기** — 서버를 부르지 않는 조작이다.
 */
describe('StockAdjustScreen — 초안 버리기', () => {
  it('버릴 값이 없으면 잠기고 그 사정을 말한다', async () => {
    renderScreen(allRoutes(), '');

    await screen.findByText(t.source.directNote);

    expect(discardButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.discardNothing)).toBeInTheDocument();
  });

  it('세운 줄이 있으면 버리기가 열린다', async () => {
    const { user } = renderScreen(allRoutes());

    await loadVariance(user);

    expect(discardButton()).toBeEnabled();
  });

  /** 고른 사유만 있어도 버릴 것이 있다 — 머리와 줄을 함께 본다. */
  it('사유만 골라도 버리기가 열린다', async () => {
    withReasonCodes();

    const { user } = renderScreen(allRoutes(), '');

    await screen.findByText(t.source.directNote);
    await chooseReason(user);

    expect(discardButton()).toBeEnabled();
  });

  it('버리면 세운 줄과 고른 사유가 함께 사라진다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(allRoutes([createRoute()]));

    await readyToRegister(user);
    await user.click(discardButton());
    await user.click(screen.getByRole('button', { name: t.actions.confirmDiscard }));

    await screen.findByText(t.empty.noLinesTitle);

    expect(reasonField()).toHaveTextContent(t.fields.reasonCodePlaceholder);
    /* 서버를 부르지 않는 조작이다 — 버리기가 요청을 내지 않는다. */
    expect(createRequests(requests)).toHaveLength(0);
  });

  /** 버린 뒤 **다시 불러올 수 있다** — 실사 차이는 서버에 그대로 있다. */
  it('버린 뒤에도 실사 차이를 다시 불러올 수 있다', async () => {
    const { user } = renderScreen(allRoutes());

    await loadVariance(user);
    await user.click(discardButton());
    await user.click(screen.getByRole('button', { name: t.actions.confirmDiscard }));
    await screen.findByText(t.empty.noLinesTitle);

    await user.click(loadButton());

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(3);
  });
});

/**
 * **등록 성공**(C23·C24·C26).
 */
describe('StockAdjustScreen — 등록 성공', () => {
  it('결과 구획에 전표번호와 등록 시점의 상태가 서고 확인 창이 닫힌다', async () => {
    withReasonCodes();

    const { user } = renderScreen(allRoutes([createRoute()]));

    await setupAndRegister(user);

    const pane = await screen.findByRole('region', { name: t.result.label });

    expect(within(pane).getByText('SAMPLE-IA-9301')).toBeVisible();
    expect(within(pane).getByText('SAMPLE_IA_STATUS_A')).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /** **서버가 저장한 줄 수**를 낸다 — 화면이 보낸 줄 수(둘)와 갈린 값(셋)으로 잰다. */
  it('서버가 되돌려 준 줄 수를 낸다 — 화면이 센 수가 아니다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(
      allRoutes([createRoute(adjustmentDetailBody({ lineCount: 3 }))]),
    );

    await setupAndRegister(user);

    const pane = await screen.findByRole('region', { name: t.result.label });

    expect(sentLines(requests)).toHaveLength(2);
    expect(within(pane).getByText(t.result.lineCount(3))).toBeVisible();
  });

  /** ERP 적재 여부가 **오지 않는 갈래**가 화면까지 이어진다(C23) — 거짓으로 접지 않는다. */
  it('ERP 적재 여부가 오지 않으면 알 수 없다고 말한다', async () => {
    withReasonCodes();

    const { user } = renderScreen(
      allRoutes([createRoute(adjustmentDetailBody({ erpMessageQueued: null }))]),
    );

    await setupAndRegister(user);

    const pane = await screen.findByRole('region', { name: t.result.label });

    expect(within(pane).getByText(t.result.erpUnknown)).toBeVisible();
    expect(within(pane).queryByText(t.result.erpNotQueued)).not.toBeInTheDocument();
  });

  /**
   * **성공 뒤 폼과 대상 전환이 잠긴다**(C26).
   *
   * 되돌릴 경로가 없어 두 번째 전표를 지울 수 없다 — 그리고 대상을 바꾸면 만들어진 전표를
   * 보이는 구획이 사라져 사용자가 전표번호를 잃는다.
   */
  it('성공 뒤 폼·표·대상 전환이 잠기고 사유가 붙는다', async () => {
    withReasonCodes();

    const { user } = renderScreen(allRoutes([createRoute()]));

    await setupAndRegister(user);
    await screen.findByRole('region', { name: t.result.label });

    expect(screen.getAllByText(t.actionReasons.alreadyRegistered).length).toBeGreaterThan(0);
    expect(reasonField()).toBeDisabled();
    expect(diffBox(1)).toBeDisabled();
    expect(addLineButton()).toBeDisabled();
    expect(registerButton()).toBeDisabled();
    expect(discardButton()).toBeDisabled();
    expect(countField()).toBeDisabled();
    expect(loadButton()).toBeDisabled();
  });

  /** 성공해도 **같은 요청을 다시 내지 않는다** — 다시 부를 조회가 없다. */
  it('성공 뒤 실사 차이를 다시 부르지 않는다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(allRoutes([createRoute()]));

    await setupAndRegister(user);
    await screen.findByRole('region', { name: t.result.label });

    expect(requestsTo(requests, VARIANCE_PATH)).toHaveLength(1);
  });

  /**
   * ⛔ **목이 채워 준 값에 기대지 않는다**(§5.2.5 실측).
   *
   * 목은 등록 응답에 승인 요청 번호와 전기 시각을 계약 예시값으로 채워 준다 — 화면이 그것을
   * 읽어 「상신됨」·「전기됨」을 그리면 **확인하지 않은 사실**을 말하게 된다.
   */
  it('결과 구획에 상신·전기 표기가 없다', async () => {
    withReasonCodes();

    const { user } = renderScreen(allRoutes([createRoute()]));

    await setupAndRegister(user);

    const pane = await screen.findByRole('region', { name: t.result.label });

    expect(within(pane).getByText('SAMPLE-IA-9301')).toBeVisible();
    expect(within(pane).queryAllByRole('button')).toHaveLength(0);
    for (const id of INTERNAL_IDS) {
      expect(pane.textContent ?? '').not.toContain(`${id} `);
    }
  });
});

/**
 * **실패 네 갈래**(C27) — 문구가 갈리고 **입력이 유지된다.**
 */
describe('StockAdjustScreen — 등록 실패', () => {
  const registerAndFail = async (
    user: ReturnType<typeof userEvent.setup>,
    requests: RecordedRequest[],
  ): Promise<void> => {
    await setupAndRegister(user);

    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(1);
    });
  };

  it('400이면 서버 문구가 창 안에 그대로 서고 입력이 남는다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(
      allRoutes([
        failingCreateRoute(400, {
          errors: [{ scope: 'screen', code: 'SAMPLE_ERR', message: '합성 등록 거절' }],
        }),
      ]),
    );

    await registerAndFail(user, requests);

    expect(await screen.findByText('합성 등록 거절')).toBeVisible();
    /* 창은 닫히지 않는다 — 무엇이 막았는지 읽고 다시 시도할 자리다. */
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));

    expect(bodyRows()).toHaveLength(3);
    expect(diffBox(1)).toHaveValue('-2');
  });

  /**
   * **화면이 아는 칸의 오류는 그 칸에 붙는다** — 배너로 밀면 어느 칸인지 알 수 없다.
   *
   * 아래 「그릴 자리가 없는 칸」 시험의 **대조군**이다. 둘이 함께 있어야 「서는 자리가 갈린다」가
   * 재어지고, 한쪽만 있으면 하네스 탓인지 배선 탓인지 가릴 수 없다.
   */
  it('사유 칸의 400은 그 칸에 붙는다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(
      allRoutes([fieldErrorRoute('reasonCode', '합성 사유 오류')]),
    );

    await registerAndFail(user, requests);

    await waitFor(() => {
      expect(screen.getByText('합성 사유 오류')).toBeVisible();
    });

    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));

    expect(reasonField()).toHaveAttribute('aria-invalid', 'true');
  });

  /**
   * ⭐ **그릴 자리가 없는 칸의 400은 배너로 떨어진다** — 어디에도 서지 않고 사라지면 안 된다.
   *
   * 공통 훅은 「화면이 아는 칸」으로 선언된 이름을 **배너에서 빼고** 인라인용으로 돌린다.
   * 그래서 그리는 자리가 없는 이름을 그 목록에 넣으면 서버가 준 거절 사유가 **통째로 사라지고**,
   * 사용자에게는 「눌렀는데 아무 일도 없다」로 보인다 — 되돌릴 수 없는 쓰기에서 가장 나쁜
   * 표시 상태다. ERP 송신은 토글이라 오류 슬롯이 없으므로 **배너가 그 자리를 진다.**
   */
  it('그릴 자리가 없는 칸의 400은 배너로 선다 — 사라지지 않는다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(
      allRoutes([fieldErrorRoute('sendToErp', '합성 ERP 송신 거절')]),
    );

    await registerAndFail(user, requests);

    /* 창 안 배너가 그 자리다 — 확인 창은 실패해도 닫히지 않는다. */
    const dialog = await screen.findByRole('dialog');

    expect(await within(dialog).findByText('합성 ERP 송신 거절')).toBeVisible();
  });

  /** 고친 칸의 **서버 오류를 함께 지운다** — 안 지우면 방금 고친 칸에 옛 문구가 되살아난다. */
  it('사유를 다시 고르면 그 칸의 서버 오류가 걷힌다', async () => {
    codeValues.reason = [SAMPLE_REASON, 'SAMPLE_AR_B'];

    const { requests, user } = renderScreen(
      allRoutes([fieldErrorRoute('reasonCode', '합성 사유 오류')]),
    );

    await registerAndFail(user, requests);

    await waitFor(() => {
      expect(screen.getByText('합성 사유 오류')).toBeVisible();
    });

    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));
    await user.click(reasonField());
    await user.click(screen.getByRole('option', { name: 'SAMPLE_AR_B' }));

    expect(screen.queryByText('합성 사유 오류')).not.toBeInTheDocument();
  });

  it('403이면 권한 문구가 선다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(allRoutes([failingCreateRoute(403)]));

    await registerAndFail(user, requests);

    expect(await screen.findByText(messages.httpError.forbidden)).toBeVisible();
  });

  /**
   * **409에는 「최신 불러오기」를 내지 않는다.**
   *
   * 계약에 `If-Match`도 409도 없는 쓰기라 잠글 대상이 없다 — 재조회 수단을 내면 입력만 버리게
   * 된다. 서버가 그래도 409를 주면 문구는 내되 수단은 내지 않는다.
   */
  it('409면 충돌 문구가 서고 최신 불러오기를 내지 않는다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(
      allRoutes([failingCreateRoute(409, { conflictCause: 'user', message: '' })]),
    );

    await registerAndFail(user, requests);

    expect(await screen.findByText(messages.conflict.user)).toBeVisible();
    expect(
      screen.queryByRole('button', { name: messages.conflict.reloadAction }),
    ).not.toBeInTheDocument();
  });

  /**
   * ⭐ **응답이 오지 않은 요청은 실패가 아니다**(멱등 세 겹의 셋째).
   *
   * 훅이 호출마다 새 멱등 키를 만들어, 그대로 다시 보내면 서버에는 다른 요청으로 보인다 —
   * 전표가 두 벌 남을 수 있다.
   */
  it('네트워크가 끊기면 보내졌는지 알 수 없다는 사실을 함께 말한다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(allRoutes([offlineCreateRoute()]));

    await registerAndFail(user, requests);

    expect(await screen.findByText(messages.httpError.offline)).toBeVisible();
    expect(screen.getByText(t.notes.networkUnconfirmed)).toBeVisible();
  });

  /**
   * ⭐ **이 안내의 본체는 금지다**(전례 `poRegister.notes.networkUnconfirmed`가 세운 잣대).
   *
   * 전표 두 벌을 막는 것은 확인이 아니라 **하지 않는 것**이다 — 훅이 호출마다 새 멱등 키를
   * 만들어 「다시 보내기」가 그대로 두 번째 요청이 되기 때문이다. 금지를 선행 확인에 매달면
   * 「확인하면 다시 보내도 된다」로 읽히고, **확인할 자리가 없는 이 화면에서는 그 조치 자체가
   * 실행 불가능**하다. 문구를 고칠 때 이 두 성질이 함께 유지되는지를 이 잣대가 잡는다.
   */
  it('그 안내가 확인이 아니라 금지를 말한다', () => {
    expect(t.notes.networkUnconfirmed).toContain('다시 등록하지 마세요');
    expect(t.notes.networkUnconfirmed).toContain('이 화면에서 확인할 수 없습니다');
  });

  /** 짝 방향 — 서버가 거절한 요청에는 그 안내가 없다. 전달된 것이 확실하기 때문이다. */
  it('서버가 거절한 요청에는 그 안내가 없다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(allRoutes([failingCreateRoute(403)]));

    await registerAndFail(user, requests);

    expect(await screen.findByText(messages.httpError.forbidden)).toBeVisible();
    expect(screen.queryByText(t.notes.networkUnconfirmed)).not.toBeInTheDocument();
  });

  /** 실패한 뒤에는 **다시 보낼 수 있다** — 실패가 화면을 잠그지 않는다. */
  it('실패한 뒤 다시 보내면 요청이 다시 나간다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(allRoutes([failingCreateRoute(403)]));

    await registerAndFail(user, requests);

    await screen.findByText(messages.httpError.forbidden);
    await user.click(confirmRegisterButton());

    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(2);
    });
  });
});
