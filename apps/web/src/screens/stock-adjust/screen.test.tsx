import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useNavigate } from 'react-router';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import {
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
}

const createRecordingFetch = (
  routes: StubRoute[],
): { fetch: StubFetch; requests: RecordedRequest[] } => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch(routes);

  return {
    fetch: async (request) => {
      requests.push({ method: request.method, url: new URL(request.url) });

      return stub(request);
    },
    requests,
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

const renderScreen = (routes: StubRoute[], search = '?count=9101') => {
  const { fetch, requests } = createRecordingFetch(routes);

  renderWithProviders(
    <>
      <StockAdjustScreen />
      <LocationProbe />
      <BackProbe />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, user: userEvent.setup() };
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
