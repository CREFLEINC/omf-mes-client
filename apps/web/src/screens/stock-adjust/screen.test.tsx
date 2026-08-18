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

    expect(currentLocation()).toBe(`${ROUTE}?count=9102`);
  });

  /** 고를 때마다 히스토리가 쌓이면 뒤로가기가 앞선 선택으로 되돌아가 세운 대상이 사라진다. */
  it('실사를 고르는 것이 뒤로가기 기록을 늘리지 않는다', async () => {
    const { user } = renderScreen(allRoutes());

    await waitForCounts();
    await user.click(countField());
    await user.click(screen.getByRole('option', { name: 'SAMPLE-IC-9102 · 2026-08-18' }));
    await user.click(screen.getByRole('button', { name: '뒤로' }));

    expect(currentLocation()).toBe(`${ROUTE}?count=9102`);
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

    expect(currentLocation()).toBe(ROUTE);
  });

  it('정리가 뒤로가기 기록을 늘리지 않는다', async () => {
    const { user } = renderScreen(allRoutes(), '?count=9109');

    await screen.findByText(t.source.countNotFoundNote);
    await user.click(screen.getByRole('button', { name: '뒤로' }));

    expect(currentLocation()).toBe(ROUTE);
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

    expect(currentLocation()).toBe(ROUTE);
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
});
