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
import { APPROVED_APPROVAL_STATUS_CODES, REJECTION_DECISION_CODES } from './approval-progress';
import {
  adjustmentDetailBody,
  adjustmentListFixtures,
  approvalRequestDetailBody,
  approvalRequestRefBody,
  balanceFixtures,
  countFixtures,
  countVarianceLineFixtures,
  countVarianceLineResponse,
  itemFixtures,
  locationFixtures,
  lotFixtures,
  postedAdjustmentBody,
  reasonCodeValueFixtures,
  reasonGroupFixtures,
  uomFixtures,
  warehouseFixtures,
} from './fixtures';
import { stockAdjustKeys } from './queries';
import { StockAdjustScreen } from './screen';

const t = messages.stockAdjust;

/**
 * 전표 상태 값 목록 — **미확정 자리표시를 갈아 끼운다**(전례 `disposal-issue`와 같은 형태).
 *
 * **판정·조립·잠금은 실물 그대로**이고 바뀌는 것은 「값 목록이 왔다」는 사실 하나다.
 *
 * ⭐ **조정 사유는 여기 없다** — 고객이 공통코드 마스터에 등록하는 값으로 결정돼(#36 회신)
 * 자리표시가 아니라 **실제 조회**로 온다. 그래서 그 목록은 목이 아니라 아래 스텁이 채운다.
 */
const { codeValues } = vi.hoisted(() => ({
  codeValues: { status: [] as string[] },
}));

vi.mock('./code-options', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./code-options')>();

  return { ...actual, PLACEHOLDER_STOCK_ADJUST_CODES: codeValues };
});

/**
 * 고객이 공통코드 마스터에 등록해 둔 조정 사유 — **화면이 조회로 받는다.**
 *
 * ⚠ **값 문면에 뜻을 담지 않는다**(#36 회신 ③). 화면은 어느 값이 와도 같게 돌아야 하므로,
 * 뜻이 읽히는 값을 쓰면 그 뜻에 기댄 시험이 슬며시 생긴다.
 */
const SAMPLE_REASON = 'SYN-RSN-ALPHA';
const SAMPLE_REASON_LABEL = 'SYN-RSN-ALPHA · 합성 사유 가';
const SECOND_REASON = 'SYN-RSN-OMEGA';
const SECOND_REASON_LABEL = 'SYN-RSN-OMEGA · 합성 사유 나';

/**
 * 스텁이 내려 줄 사유 코드값. **라우트를 세우기 전에** 시험이 갈아 끼운다 —
 * 마스터에 값이 있고 없고가 화면에서 어떻게 갈리는지가 이 회차의 요점이다.
 */
let reasonCodeValues: unknown[] = [];

beforeEach(() => {
  codeValues.status = [];
  reasonCodeValues = [];
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
const CODE_GROUPS_PATH = '/mdm/code-groups';
const CODE_VALUES_PATH = '/mdm/code-values';

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
  /*
   * 조정 사유 — **두 걸음이다**(그룹코드로 그룹을 찾고, 그 번호로 코드값을 받는다).
   * 값 목록은 시험이 미리 갈아 끼운 것을 그대로 내려준다.
   */
  getRoute(CODE_GROUPS_PATH, reasonGroupFixtures),
  getRoute(CODE_VALUES_PATH, reasonCodeValues),
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

/**
 * **화면 밖에서 같은 라우트로 미는 이동**(`push`).
 *
 * 라우트와 사이드바가 열린 뒤에 생긴 경로다 — 사이드바의 「재고조정」을 누르면 **같은 라우트로
 * 질의만 다른 주소**가 밀려, 화면이 다시 마운트되지 않은 채 진입 맥락만 바뀐다. 화면 안의
 * 주소 갱신은 전부 `replace`라(히스토리를 늘리지 않는다) 이 경로는 **바깥에서만** 만들어진다.
 */
const MenuProbe = ({ to }: { to: string }) => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => {
        void navigate(to);
      }}
    >
      메뉴
    </button>
  );
};

const renderScreen = (
  routes: StubRoute[],
  search = '?count=9101',
  hold: string[] = [],
  menuTo = ROUTE,
) => {
  const { fetch, requests, release } = createRecordingFetch(routes, hold);

  /**
   * **조회 캐시를 내준다** — 사용자 조작이 아닌 **배경 재조회**를 재려면 이 손잡이가 필요하다.
   *
   * 앱 기본값이 `refetchOnReconnect`를 덮지 않아(참) 활성 조회는 재접속 때 스스로 다시 나가고,
   * 조회가 실패한 뒤의 「다시 시도」도 폼 잠금 밖에 있다 — **잠금이 막지 못하는 갱신**이 실재한다.
   * 그 도착을 무효화 한 번으로 재현한다(같은 결과: 활성 조회가 다시 나간다).
   */
  const { queryClient } = renderWithProviders(
    <>
      <StockAdjustScreen />
      <LocationProbe />
      <BackProbe />
      <MenuProbe to={menuTo} />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, release, queryClient, user: userEvent.setup() };
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

  /*
   * ⚠ **이 갈래만 「주소=갈래」의 예외다**(리뷰 R-2). 주소에서 대상이 사라져도 **실사 갈래에
   * 남는다** — 대상을 지운 주체가 사용자가 아니라 화면이고, 직접 등록으로 옮기면 「없는
   * 실사였다」 안내가 **실사 선택칸이 없는 구획**에 서서 화면에 없는 컨트롤을 쓰라고 말한다.
   *
   * 문면(같은 이름의 `screen.tsx` 주석)에만 있고 감지기가 없던 자리라, 그 예외를 여기 고정한다 —
   * 없으면 다음 사람이 「주소가 비면 직접 등록」이라는 일반 규칙을 이 갈래에도 밀어 넣는다.
   */
  it('정리해도 실사 갈래에 남는다 — 고를 자리와 안내를 지킨다', async () => {
    renderScreen(allRoutes(), '?count=9109');

    await screen.findByText(t.source.countNotFoundNote);
    await waitForLocation(ROUTE);

    expect(screen.getByRole('radio', { name: t.source.count })).toBeChecked();
    expect(screen.getByRole('radio', { name: t.source.direct })).not.toBeChecked();
    /* 안내가 가리키는 컨트롤이 실제로 그 자리에 있다 — 갈래가 바뀌면 이 칸이 사라진다. */
    expect(within(sourcePane()).getByLabelText(t.source.countField)).toBeInTheDocument();
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
 * ⭐ **라우트와 사이드바가 열리며 도달 가능해진 경로**(T2 검증 인계 · D-15 초안 세션 축).
 *
 * 여기까지 이 화면의 주소 갱신은 **전부 `replace`**였고 바깥에서 이 주소를 미는 길도 없어,
 * 「같은 라우트로 질의만 다른 `push`」는 **도달할 수 없는 형태**였다. 사이드바 항목이 서면서
 * 그 길이 생긴다 — 실사 맥락으로 세워 둔 대상 위에 **맥락 없는 진입**이 겹치는 자리다.
 *
 * **대상이 바뀌었는데 앞 대상의 줄이 남는 것**이 이 화면이 가장 비싸게 치르는 사고다(실사에서
 * 승계한 줄은 고칠 수 없고 장부가 그 실사에서 온다 — 다른 대상 위에 서면 그 값이 거짓이 된다).
 * 그래서 **주소가 가리키는 대상과 초안의 대상이 갈리면 거둔다** — 조작으로 바꾸는 세 길
 * (원천 전환·실사 바꾸기·창고 바꾸기)이 이미 지나는 `resetDraftForNewTarget` 한 문을 함께 쓴다.
 */
describe('StockAdjustScreen — 메뉴로 다시 들어오기(같은 라우트 · 질의만 다른 push)', () => {
  it('실사 맥락을 지우고 들어오면 앞 대상의 줄이 남지 않는다', async () => {
    const { user } = renderScreen(allRoutes());

    await loadVariance(user);

    /* 짝 양성 — 거두기 전에는 실제로 세 줄이 서 있다. */
    expect(bodyRows()).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: '메뉴' }));

    await waitForLocation(ROUTE);
    await waitFor(() => {
      expect(within(linesPane()).queryByRole('table')).not.toBeInTheDocument();
    });
    expect(screen.getByText(t.empty.noLinesTitle)).toBeInTheDocument();
  });

  /** 맥락 없이 들어온 것이므로 **주소가 말하는 갈래**로 선다 — 화면과 주소가 갈리지 않는다. */
  it('실사 맥락을 지우고 들어오면 직접 등록 갈래로 선다', async () => {
    const { user } = renderScreen(allRoutes());

    await loadVariance(user);
    await user.click(screen.getByRole('button', { name: '메뉴' }));

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: t.source.direct })).toBeChecked();
    });
  });

  /*
   * **다른 실사로 미는 갈래도 같은 문을 지난다.** 사이드바는 맥락 없는 주소를 밀지만,
   * 뒤로가기·앞으로가기·주소 직접 편집은 **다른 실사를 가리키는 같은 라우트**를 만들 수 있다 —
   * 그때 앞 실사의 줄이 남으면 새 실사의 장부 위에 남의 수량이 선다.
   */
  it('다른 실사를 가리키는 주소로 들어오면 앞 실사의 줄이 남지 않는다', async () => {
    const { user } = renderScreen(allRoutes(), '?count=9101', [], `${ROUTE}?count=9102`);

    await loadVariance(user);

    expect(bodyRows()).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: '메뉴' }));

    await waitForLocation(`${ROUTE}?count=9102`);
    await waitFor(() => {
      expect(within(linesPane()).queryByRole('table')).not.toBeInTheDocument();
    });
    /* 갈래는 실사 그대로다 — 주소가 여전히 실사를 가리킨다. */
    expect(screen.getByRole('radio', { name: t.source.count })).toBeChecked();
  });

  /*
   * **뒤로가기로 실사 맥락이 되돌아오는 갈래.** 메뉴로 나갔다가 뒤로 누르면 앞의 실사 주소가
   * 다시 서는데, 그사이 직접 등록으로 친 줄이 남으면 **실사 대상 위에 직접 친 줄**이 선다.
   */
  it('뒤로가기로 실사 맥락이 돌아오면 그사이 친 줄이 남지 않는다', async () => {
    const { user } = renderScreen(allRoutes());

    await waitForCounts();
    await user.click(screen.getByRole('button', { name: '메뉴' }));
    await waitForLocation(ROUTE);

    await startDirectLine(user);

    expect(bodyRows()).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitForLocation(`${ROUTE}?count=9101`);
    await waitFor(() => {
      expect(within(linesPane()).queryByRole('table')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('radio', { name: t.source.count })).toBeChecked();
  });

  /*
   * ⛔ **화면 안의 조작은 이 문을 **두 번** 지나지 않는다.** 세 조작은 이미 스스로 거두고
   * 주소를 `replace`로 갈아 끼우므로, 주소 변화에 반응해 또 거두면 **막 세운 대상이 사라진다.**
   * 실사를 바꾼 직후 불러오기가 정상으로 서는 것이 그 사실이다.
   */
  it('화면에서 실사를 바꾼 뒤에도 불러온 대상이 그대로 선다', async () => {
    const { user } = renderScreen(
      allRoutes([getRoute(SECOND_VARIANCE_PATH, countVarianceLineFixtures)]),
    );

    await waitForCounts();
    await user.click(countField());
    await user.click(screen.getByRole('option', { name: 'SAMPLE-IC-9102 · 2026-08-18' }));
    await waitForLocation(`${ROUTE}?count=9102`);

    await user.click(loadButton());

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(3);
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
 * ⭐ **조정 사유는 고객의 마스터에서 온다**(#36 회신 · 공유계약 `G-31` · 스펙 §8-3).
 *
 * 앞 회차까지 이 자리는 자리표시(빈 배열)였고 「값이 확정될 때까지 등록할 수 없다」고 말했다.
 * 결정은 그 반대였다 — 우리가 정할 값이 아니다. 이 묶음이 재는 것은 셋이다.
 *
 * | # | 잣대 |
 * | :-: | --- |
 * | ⓐ | **값 문면에 갈래가 없다** — 임의의 어느 값이 와도 화면이 같게 돈다 |
 * | ⓑ | ⛔ **「목록 준비 중」도 비활성도 없다** |
 * | ⓒ | 조회가 **실제로** 나간다 — 그룹코드로 찾고 그 번호로 코드값을 받는다 |
 */
describe('StockAdjustScreen — 조정 사유 값 목록', () => {
  it('실행 시점에 공통코드를 부른다 — 그룹코드로 찾고 그 번호로 코드값을 받는다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(allRoutes());

    await chooseReason(user);

    const groupRequest = requests.find((request) => request.url.pathname === CODE_GROUPS_PATH);
    const valueRequest = requests.find((request) => request.url.pathname === CODE_VALUES_PATH);

    expect(groupRequest?.url.searchParams.get('q')).toBe('ADJUST_REASON');
    expect(valueRequest?.url.searchParams.get('codeGroupId')).toBe('9901');
  });

  /**
   * ⛔ **「목록 준비 중」도 비활성도 없다**(#36 회신 ④).
   *
   * 그 표시는 「우리가 정해야 하는데 못 한 값」에만 쓴다. 마스터가 아직 비어 있는 것은
   * 그 경우가 아니다 — 칸은 서고 잠기지 않는다.
   */
  it('마스터가 비어 있어도 준비 중 표시도 비활성도 없다', () => {
    renderScreen(allRoutes(), '');

    expect(reasonField()).toBeEnabled();
    expect(screen.queryByText(t.historyFilters.codePending)).toBeNull();
    /* 문면이 바뀐 같은 뜻의 안내가 되살아나는 자리까지 막는다. */
    expect(registerPane().textContent ?? '').not.toContain('확정');
  });

  it('마스터가 비어 있어도 대상은 세울 수 있다', async () => {
    const { user } = renderScreen(allRoutes());

    await loadVariance(user);

    expect(bodyRows()).toHaveLength(3);
    expect(diffBox(1)).toBeEnabled();
  });

  /**
   * ⭐ **값 문면에 갈래가 없다**(#36 회신 ③). 임의의 두 값 어느 쪽으로도 **같은 자리가 열리고
   * 같은 값이 나간다** — 화면이 특정 값을 알아보면 고객이 값을 바꾸는 날 조용히 다르게 돈다.
   */
  it.each([
    ['SYN-RSN-ALPHA', '합성 사유 가'],
    ['COUNT_VARIANCE', '합성 사유 나'],
  ])('임의 코드 %s를 골라도 같은 경로로 등록된다', async (code, codeName) => {
    withReasonCodes([
      { codeValueId: 9911, codeGroupId: 9901, code, codeName, displayOrder: 1, isActive: true },
    ]);

    const { requests, user } = renderScreen(allRoutes());

    await loadVariance(user);
    await chooseReason(user, `${code} · ${codeName}`);

    expect(registerButton()).toBeEnabled();

    await submitRegister(user);

    await waitFor(() => {
      expect(lastCreateBody(requests).reasonCode).toBe(code);
    });
  });

  /** 실패를 삼키면 선택칸이 이유 없이 비어 보인다 — 다섯 참조와 같은 문구로 말한다. */
  it('사유 조회가 실패하면 그 사실을 그 칸에 적는다', async () => {
    withReasonCodes();

    const { user } = renderScreen(allRoutes([failingRoute(CODE_VALUES_PATH, 500)]));

    await loadVariance(user);

    expect(await within(registerPane()).findByText(t.lookups.failed)).toBeVisible();
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

/**
 * 고객이 사유를 등록해 둔 마스터를 세운다 — **라우트를 만들기 전에** 불러야 한다
 * (`allRoutes()`가 이 값을 그 자리에서 읽어 스텁에 싣는다).
 */
const withReasonCodes = (values = reasonCodeValueFixtures): void => {
  reasonCodeValues = values;
};

const chooseReason = async (
  user: ReturnType<typeof userEvent.setup>,
  label = SAMPLE_REASON_LABEL,
): Promise<void> => {
  await user.click(reasonField());
  await user.click(await screen.findByRole('option', { name: label }));
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
  /**
   * ⭐ **마스터가 비어 있어도 사정은 「아직 안 골랐다」 하나다**(#36 회신 ④ · D-9 개정).
   *
   * 앞 회차에는 여기에 「값 목록이 확정된 뒤에 할 수 있습니다」가 섰다 — 값 목록을 우리가
   * 정할 것으로 보았기 때문이다. 그 문구가 되살아나면 고객이 스스로 넣을 값을 우리가 미루고
   * 있는 것처럼 읽힌다.
   */
  it('마스터가 비어 있어도 사정은 「아직 안 골랐다」다', async () => {
    const { user } = renderScreen(allRoutes());

    await loadVariance(user);

    expect(registerButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.registerNeedsReason)).toBeInTheDocument();
    expect(registerPane().textContent ?? '').not.toContain('확정');
  });

  /** ⭐ **사유가 오면 그것을 고를 수 있다** — 조회가 죽은 통로가 아니라는 증거다. */
  it('마스터에 값이 있으면 그 값이 그대로 선다', async () => {
    withReasonCodes();

    const { user } = renderScreen(allRoutes());

    await loadVariance(user);
    await user.click(reasonField());

    expect(await screen.findByRole('option', { name: SAMPLE_REASON_LABEL })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: SECOND_REASON_LABEL })).toBeInTheDocument();
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
   * ⭐ **비대칭을 닫는다** — 앞 회차들이 「이력 탭이 서면 다시 본다」로 넘긴 자리.
   *
   * 성공은 전표번호로 알리는데 **응답 없음은 침묵**했다. 근거가 「확인할 자리가 화면에
   * 없다」였고, 이력 탭이 서면서 그 근거가 사라졌다 — 이제 그 사실과 확인할 자리를 말한다.
   *
   * **전표번호를 적지 않는다** — 응답을 받지 못해 화면이 그 번호를 모른다.
   */
  it('버린 초안의 응답 없음도 사실과 확인할 자리를 알린다', async () => {
    withReasonCodes();

    const { requests, release, user } = renderScreen(
      allRoutes([offlineCreateRoute()]),
      '?count=9101',
      [ADJUSTMENTS_PATH],
    );

    await registerThenDiscard(user, requests);

    release();

    expect(await screen.findByText(t.notes.unconfirmedRegisterNote)).toBeInTheDocument();
    expect(t.notes.unconfirmedRegisterNote).toContain(t.tabs.history);

    /* 새 초안의 결과로 세우지 않는다 — 결과 구획도 폼 잠금도 서지 않는다. */
    expect(screen.queryByRole('region', { name: t.result.label })).not.toBeInTheDocument();
    expect(screen.queryByText(t.actionReasons.alreadyRegistered)).not.toBeInTheDocument();
  });

  /**
   * 짝 방향 — **서버가 거절한 요청에는 그 안내가 없다.** 거절된 요청은 남는 것이 없어
   * 되찾을 것도 없다. 이 짝이 없으면 「늘 붙인다」로 통과한다.
   */
  it('버린 초안의 400에는 그 안내가 없다', async () => {
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

    await screen.findByText(t.actionReasons.registerNeedsLines);

    expect(screen.queryByText(t.notes.unconfirmedRegisterNote)).not.toBeInTheDocument();
  });

  /** 짝 방향 — **초안을 버리지 않았으면** 그 자리가 아니라 실패 배너 옆의 안내가 맡는다. */
  it('초안을 그대로 둔 응답 없음은 그 자리가 아니라 실패 안내가 맡는다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(allRoutes([offlineCreateRoute()]));

    await setupAndRegister(user);

    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(1);
    });

    expect(await screen.findByText(t.notes.networkUnconfirmed)).toBeVisible();
    expect(screen.queryByText(t.notes.unconfirmedRegisterNote)).not.toBeInTheDocument();
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

  /**
   * ⭐ **매임은 선 뒤에도 끊긴다**(리뷰 R-7 — 앞 회차가 만든 회귀를 닫는 자리).
   *
   * 초안 세션을 올리는 자리가 둘인데 하나는 **조작이 아니라 effect**다(`varianceData`가 바뀌면
   * 돈다) — 폼 잠금은 조작 자리를 막을 뿐 effect를 막지 못한다. 그 갱신이 도착하는 실경로가
   * 둘 있다: **재접속 재조회**(앱 기본값이 `refetchOnReconnect`를 덮지 않는다)와 **조회 실패 뒤
   * 「다시 시도」**(그 배너는 잠금 밖에 선다). 여기서는 무효화로 그 도착을 재현한다.
   *
   * 그때 **되돌릴 수 없는 쓰기의 영수증이 사라지면** 사용자는 앞 전표를 모른 채 같은 실사에
   * 두 번째 조정을 만들 수 있다 — 이 슬라이스에는 그 번호를 되찾을 조회 자리가 없다.
   */
  it('등록 성공 뒤 실사 차이가 달라져도 그 전표번호는 화면에 남는다', async () => {
    withReasonCodes();

    let call = 0;
    const changingVarianceRoute: StubRoute = {
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

    const { queryClient, user } = renderScreen(
      allRoutes([
        changingVarianceRoute,
        createRoute(adjustmentDetailBody({ inventoryAdjustmentNo: 'SAMPLE-IA-9303' })),
      ]),
    );

    await setupAndRegister(user);

    /* 양성 앵커 — 이 초안의 결과가 실제로 섰다. */
    const pane = await screen.findByRole('region', { name: t.result.label });

    expect(within(pane).getByText('SAMPLE-IA-9303')).toBeVisible();

    /* **잠금 밖에서 도는 갱신**이 도착한다 — 사용자가 누른 것이 아니다. */
    await queryClient.invalidateQueries({ queryKey: stockAdjustKeys.varianceLines(9101) });

    /* 달라진 응답이 실제로 대상을 다시 세운 시점을 앵커로 잡는다(줄이 셋 → 하나). */
    await waitFor(() => {
      expect(bodyRows()).toHaveLength(1);
    });

    /*
     * ⭐ **영수증이 남는다** — 결과 구획은 걷혀도(그 초안의 것이 아니다) 번호는 화면에 선다.
     *
     * ⚠ **폼이 다시 열리는 것 자체는 이 회차가 바꾸지 않았다**(앞 회차부터 같은 형태 ·
     * 리뷰 §3-6 참고 — 처리 이력이 서는 회차에서 재판단). 이 시험이 고정하는 것은
     * **열린다면 반드시 앞 전표의 사실이 함께 선다**는 짝이다 — 그것이 이 갈래에서 두 번째
     * 전표를 막는 유일한 방어다.
     */
    expect(screen.getByText(t.result.unboundCreatedNote('SAMPLE-IA-9303'))).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: t.result.label })).not.toBeInTheDocument();
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
   *
   * ⚠ **상신 자리가 생긴 회차에 이 판정을 새 사실로 다시 썼다.** 앞 회차는 「결과 구획에 버튼이
   * 0건」으로 쟀는데, 이 회차부터 상신 버튼이 그 구획에 산다 — 판정 **강도를 유지한 채**
   * 「상신·전기 **표기**가 없다」와 「등록만으로 올라간 것으로 그리지 않는다」로 갈아 쟀다.
   */
  it('결과 구획에 상신·전기 표기가 없다', async () => {
    withReasonCodes();

    const { user } = renderScreen(allRoutes([createRoute()]));

    await setupAndRegister(user);

    const pane = await screen.findByRole('region', { name: t.result.label });

    expect(within(pane).getByText('SAMPLE-IA-9301')).toBeVisible();
    /* 등록만으로는 「올렸습니다」가 서지 않는다 — 그 근거는 202뿐이다. */
    expect(
      within(pane).queryByText(t.result.submittedTitle('SAMPLE-IA-9301')),
    ).not.toBeInTheDocument();
    expect(within(pane).queryByText(t.result.submitting)).not.toBeInTheDocument();
    /*
     * 이 구획의 조작은 **상신 하나**다 — 전기는 **형제 구획**이 제 확인 창과 함께 세운다.
     * (전기 회차에 **사실만 갱신**했다: 앞 회차의 「전기는 아직 없다」가 「전기는 여기 없다」가
     * 됐고, 판정 강도는 그대로다.)
     */
    expect(
      within(pane)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual([t.actions.requestApproval]);
    /* 등록만으로는 「전기했습니다」도 서지 않는다 — 그 근거는 200뿐이다. */
    expect(within(pane).queryByText(t.post.postedTitle('SAMPLE-IA-9301'))).not.toBeInTheDocument();
    for (const id of INTERNAL_IDS) {
      expect(pane.textContent ?? '').not.toContain(`${id} `);
    }
  });

  /**
   * ⭐ **목이 채워 준 승인 요청 번호로 결재 진행을 부르지 않는다**(C36).
   *
   * 목은 등록 201에 그 값을 실어 준다(§5.2.5) — 그 값으로 부르면 **상신하지 않은 전표의 결재
   * 진행**이 열리고, 사용자는 올린 적 없는 요청의 단계를 본다. 상신 여부의 근거는 오직
   * **이 화면이 받은 202**다.
   */
  it('등록 응답에 승인 요청 번호가 실려 와도 결재 진행을 부르지 않는다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(
      allRoutes([
        createRoute(
          adjustmentDetailBody({
            approvalRequestId: 9801,
            adjustedAt: '2026-08-18T09:12:00+09:00',
          }),
        ),
      ]),
    );

    await setupAndRegister(user);

    /* 양성 앵커 — 그 응답이 실제로 도착해 결과 구획이 섰다. */
    await screen.findByRole('region', { name: t.result.label });

    expect(
      requests.filter((request) => request.url.pathname.startsWith('/app/approval-requests')),
    ).toEqual([]);
    expect(screen.queryByRole('group', { name: t.progress.label })).not.toBeInTheDocument();
  });

  /**
   * ⭐ **목이 채워 준 전기 시각으로 「전기했습니다」를 그리지 않는다**(C35 · §5.2.5).
   *
   * 목은 등록 201에 `adjustedAt`을 실어 준다 — 그것을 읽어 그리면 **한 번도 전기한 적 없는
   * 전표가 원장에 잡힌 것처럼** 보이고, 사용자는 이미 움직인 재고로 알고 지나간다.
   * 전기 여부의 근거는 오직 **이 화면이 받은 200**이다.
   */
  it('등록 응답에 전기 시각이 실려 와도 전기됐다고 말하지 않는다', async () => {
    withReasonCodes();

    const { user } = renderScreen(
      allRoutes([
        createRoute(
          adjustmentDetailBody({
            approvalRequestId: 9801,
            adjustedAt: '2026-08-18T09:12:00+09:00',
          }),
        ),
      ]),
    );

    await setupAndRegister(user);

    /* 양성 앵커 — 그 응답이 실제로 도착해 전기 자리가 섰다. */
    const pane = await screen.findByRole('region', { name: t.post.label });

    await user.click(within(pane).getByRole('button', { name: t.actions.togglePost }));

    expect(within(pane).queryByText(t.post.postedTitle('SAMPLE-IA-9301'))).not.toBeInTheDocument();
    expect(within(pane).queryByText('2026-08-18 09:12')).not.toBeInTheDocument();
    /* 전기할 수 있는 상태 그대로다 — 두 칸과 버튼이 선다. */
    expect(within(pane).getByRole('button', { name: t.actions.post })).toBeEnabled();
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
    withReasonCodes();

    const { requests, user } = renderScreen(
      allRoutes([fieldErrorRoute('reasonCode', '합성 사유 오류')]),
    );

    await registerAndFail(user, requests);

    await waitFor(() => {
      expect(screen.getByText('합성 사유 오류')).toBeVisible();
    });

    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));
    await user.click(reasonField());
    await user.click(screen.getByRole('option', { name: SECOND_REASON_LABEL }));

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
   * ⭐ **이 안내의 본체는 여전히 금지다**(전례 `poRegister.notes.networkUnconfirmed`의 잣대).
   *
   * 전표 두 벌을 막는 것은 확인이 아니라 **하지 않는 것**이다 — 훅이 호출마다 새 멱등 키를
   * 만들어 「다시 보내기」가 그대로 두 번째 요청이 되기 때문이다.
   *
   * ✅ **앞 회차의 음성 축(「처리 이력」 0건)을 이 회차가 의도적으로 지웠다** — 그 잣대는
   * 「없는 자리를 가리키지 않는다」였고, 이력 탭이 서면서 **그 자리가 실재하게 됐다.**
   *
   * ⭐ **절이 셋이고 차례가 곧 뜻이다**(T2 R-2의 두 절 잣대를 세 절로 넓힌 형태):
   *
   * | 절 | 무엇을 말하나 | 빠지면 |
   * | :-: | --- | --- |
   * | ① **사실** | 그 요청의 운명을 **모른다** | 「모르니까 하지 말라」의 근거가 사라져 맨 지시가 된다 |
   * | ② **금지** | 바로 다시 보내지 마라 | 완화의 본체가 사라진다 |
   * | ③ **확인 자리** | 어디서 되찾는가 | 사용자가 갇힌다 |
   *
   * **①이 잣대에서 함께 빠졌던 자리다**(검증 문제 ① · 리뷰 R-2). 문면이 「이 화면에서 확인할
   * 수 없습니다」 → 「알 수 없습니다」로 바뀌면서 옛 단언이 살 수 없게 됐는데, **바뀐 문면에
   * 맞춰 다시 세우지 않고 걷혔다.** 절의 **성질**을 재는 형태로 되세운다.
   */
  it('그 안내가 사실·금지·확인 자리를 그 차례로 말한다', () => {
    /* ① 사실 — 요청의 운명을 모른다는 것이 이 완화의 근거다. */
    expect(t.notes.networkUnconfirmed).toContain('알 수 없습니다');
    /* ② 금지 — 완화의 본체. */
    expect(t.notes.networkUnconfirmed).toContain('다시 등록하지 마세요');
    /* ③ 확인 자리 — 이력 탭이 서면서 비로소 말할 수 있게 된 절. */
    expect(t.notes.networkUnconfirmed).toContain(t.tabs.history);

    /*
     * **차례가 뒤집히면 뜻이 뒤집힌다.** 금지가 확인 뒤로 가면 조건부 재전송 허가가 되고,
     * 사실이 금지 뒤로 가면 근거 없는 지시가 된다.
     */
    const factAt = t.notes.networkUnconfirmed.indexOf('알 수 없습니다');
    const banAt = t.notes.networkUnconfirmed.indexOf('다시 등록하지 마세요');
    const placeAt = t.notes.networkUnconfirmed.indexOf(t.tabs.history);

    expect(factAt).toBeLessThan(banAt);
    expect(banAt).toBeLessThan(placeAt);
  });

  /**
   * ⭐ **가리키는 자리가 실제로 선다** — 문구만 고치고 탭이 없으면 그것이 곧 죽은 지시다.
   * 안내가 부르는 이름으로 탭을 찾고, 눌러 보아 그 자리에 조회 조건이 서는지까지 잰다.
   */
  it('안내가 가리키는 탭이 실제로 있고 그 자리에 조회 조건이 선다', async () => {
    const { user } = renderScreen(allRoutes([getRoute(ADJUSTMENTS_PATH, [])]));

    await user.click(screen.getByRole('tab', { name: t.tabs.history }));

    expect(await screen.findByLabelText(t.historyFields.reason)).toBeInTheDocument();
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

/* ────────────────────────────────────────────────────────────────────────────
 * 상신 — **이 화면에서 되돌릴 수 없는 둘째 쓰기**
 * ──────────────────────────────────────────────────────────────────────────── */

const DETAIL_PATH = '/inventory/adjustments/9301';
const SUBMIT_PATH = '/inventory/adjustments/9301:request-approval';
const APPROVAL_PATH = '/app/approval-requests/9801';

/**
 * ⭐ **등록 201과 상세 200의 토큰을 다른 값으로 둔다**(뮤테이션 M-3이 겨누는 자리 · C31).
 *
 * 같은 값을 주면 `etagPath`가 **컬렉션 경로**로 바뀌어도 우연히 통과한다 — 그때 감지기는 아무
 * 말도 하지 않고, 실서버에서만 「눌러도 아무 일이 없다」로 나타난다.
 */
const COLLECTION_ETAG = 'W/"ia-collection-1"';
const DETAIL_ETAG = 'W/"ia-detail-7"';

/** 등록이 성공하되 그 `ETag`가 **컬렉션 경로**에 앉는 경로. */
const etaggedCreateRoute = (body: unknown = adjustmentDetailBody()): StubRoute => ({
  match: (request) => isPost(request, ADJUSTMENTS_PATH),
  respond: () => jsonResponse(body, { status: 201, headers: { ETag: COLLECTION_ETAG } }),
});

const detailRoute = (): StubRoute => ({
  match: (request) => isGet(request, DETAIL_PATH),
  respond: () => jsonResponse(adjustmentDetailBody(), { headers: { ETag: DETAIL_ETAG } }),
});

const submitRoute = (approvalRequestId = 9801): StubRoute => ({
  match: (request) => isPost(request, SUBMIT_PATH),
  respond: () => jsonResponse(approvalRequestRefBody(approvalRequestId), { status: 202 }),
});

const failingSubmitRoute = (status: number, body: unknown = { message: '' }): StubRoute => ({
  match: (request) => isPost(request, SUBMIT_PATH),
  respond: () => jsonResponse(body, { status }),
});

const approvalRoute = (status = 200): StubRoute => ({
  match: (request) => isGet(request, APPROVAL_PATH),
  respond: () =>
    status === 200
      ? jsonResponse(approvalRequestDetailBody())
      : jsonResponse({ message: '' }, { status }),
});

/** 상신까지 갈 수 있는 경로 한 벌. 갈래마다 바꿀 것만 앞에 얹는다. */
const submitRoutes = (overrides: StubRoute[] = []): StubRoute[] =>
  allRoutes([...overrides, etaggedCreateRoute(), detailRoute(), submitRoute(), approvalRoute()]);

/**
 * 응답이 갈리는 실사 차이 경로. 재조회 때마다 줄 수가 달라져 **참조가 실제로 갈린다** —
 * 같은 구조를 되돌리면 구조 공유로 초안 세션이 오르지 않아 시험이 헛통과한다.
 *
 * **잠금 밖에서 도는 갱신을 재현하는 자리다**(재접속 재조회 · 조회 실패 뒤 「다시 시도」).
 */
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
            : [
                countVarianceLineResponse({
                  systemQty: 100,
                  countedQty: 100 - call,
                  varianceQty: -call,
                }),
              ],
        ),
      );
    },
  };
};

/**
 * 부를 때마다 **다른 전표**를 되돌려 주는 등록 경로.
 *
 * 상신 매임의 축이 조정 번호라, **두 번호가 실제로 갈려야** 「앞 전표의 사실이 새 전표 위에
 * 서는가」를 잴 수 있다.
 */
const twoAdjustmentsRoute = (): StubRoute => {
  let created = 0;

  return {
    match: (request) => isPost(request, ADJUSTMENTS_PATH),
    respond: () => {
      created += 1;

      return jsonResponse(
        created === 1
          ? adjustmentDetailBody()
          : adjustmentDetailBody({
              inventoryAdjustmentId: 9302,
              inventoryAdjustmentNo: 'SAMPLE-IA-9302',
            }),
        { status: 201, headers: { ETag: COLLECTION_ETAG } },
      );
    },
  };
};

/** 둘째 전표(9302)의 상세·상신 경로. 두 전표를 이어 다루는 시험이 쓴다. */
const SECOND_DETAIL_PATH = '/inventory/adjustments/9302';
const SECOND_SUBMIT_PATH = '/inventory/adjustments/9302:request-approval';
const SECOND_DETAIL_ETAG = 'W/"ia-detail-8"';

const secondDetailRoute = (): StubRoute => ({
  match: (request) => isGet(request, SECOND_DETAIL_PATH),
  respond: () =>
    jsonResponse(adjustmentDetailBody({ inventoryAdjustmentId: 9302 }), {
      headers: { ETag: SECOND_DETAIL_ETAG },
    }),
});

const secondSubmitRoute = (approvalRequestId = 9802): StubRoute => ({
  match: (request) => isPost(request, SECOND_SUBMIT_PATH),
  respond: () => jsonResponse(approvalRequestRefBody(approvalRequestId), { status: 202 }),
});

const resultPane = (): HTMLElement => screen.getByRole('region', { name: t.result.label });

const submitReasonField = (): HTMLElement => within(resultPane()).getByLabelText(t.submit.reason);

const submitButton = (): HTMLElement =>
  within(resultPane()).getByRole('button', { name: t.actions.requestApproval });

const confirmSubmitButton = (): HTMLElement =>
  screen.getByRole('button', { name: new RegExp(t.actions.confirmSubmit) });

const progressPane = (): HTMLElement => screen.getByRole('group', { name: t.progress.label });

const submitRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === SUBMIT_PATH);

/** 등록까지 끝내 **상신 자리가 선 상태**로 만든다. */
const registerThenReady = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await setupAndRegister(user);
  await screen.findByRole('region', { name: t.result.label });
};

/** 사유를 통째로 넣는다 — 붙여넣기로 여러 줄이 들어오는 길이 실재한다. */
const fillReason = (value: string): void => {
  fireEvent.change(submitReasonField(), { target: { value } });
};

/** 확인 창을 열고 실행까지 누른다. **두 걸음이 갈려 있어야** 창만 열린 상태도 잴 수 있다. */
const submitApproval = async (
  user: ReturnType<typeof userEvent.setup>,
  reason = '실사 차이분 조정',
): Promise<void> => {
  fillReason(reason);
  await user.click(submitButton());
  await user.click(confirmSubmitButton());
};

/**
 * **상신이 막힌 사유**(C29).
 *
 * 공백만인 사유를 **목이 202로 통과시킨다**(실측) — 막는 곳이 화면뿐이라 이 잠금이 곧 「요약이
 * 빈 결재 요청」을 막는 유일한 겹이다.
 */
describe('StockAdjustScreen — 상신이 막힌 사유', () => {
  it('사유가 비면 상신이 잠기고 그 사정을 말한다', async () => {
    withReasonCodes();

    const { user } = renderScreen(submitRoutes());

    await registerThenReady(user);

    expect(submitButton()).toBeDisabled();
    expect(within(resultPane()).getByText(t.actionReasons.submitReasonRequired)).toBeVisible();
  });

  /** ⭐ **공백만은 빈 값과 같다** — 통과하면 결재함 목록의 요약 자리가 빈 채로 올라간다. */
  it.each(['   ', '\n', '\t \n '])('공백만(%j)이면 잠긴 채다', async (raw) => {
    withReasonCodes();

    const { requests, user } = renderScreen(submitRoutes());

    await registerThenReady(user);
    fillReason(raw);

    expect(submitButton()).toBeDisabled();

    await user.click(submitButton());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(submitRequests(requests)).toHaveLength(0);
    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(0);
  });

  /** 짝 방향 — 한 글자만 있어도 열린다. **길이를 화면이 정하지 않는다.** */
  it('한 글자만 쳐도 열리고 잠긴 사유가 사라진다', async () => {
    withReasonCodes();

    const { user } = renderScreen(submitRoutes());

    await registerThenReady(user);
    fillReason('가');

    expect(submitButton()).toBeEnabled();
    expect(
      within(resultPane()).queryByText(t.actionReasons.submitReasonRequired),
    ).not.toBeInTheDocument();
  });

  /**
   * ⭐ **승인 축으로 잠그지 않는다**(D-13 · C37).
   *
   * 자리표시 두 배열이 비어 있는 것이 지금의 사실인데, 그것을 잠금에 쓰면 이 버튼이 **영영
   * 잠긴다** — 승인 축의 잠금은 서버가 400으로 한다(D-12).
   */
  it('승인 판정 자리표시가 비어 있어도 상신이 잠기지 않는다', async () => {
    withReasonCodes();

    const { user } = renderScreen(submitRoutes());

    await registerThenReady(user);
    fillReason('실사 차이분 조정');

    expect(APPROVED_APPROVAL_STATUS_CODES).toEqual([]);
    expect(REJECTION_DECISION_CODES).toEqual([]);
    expect(submitButton()).toBeEnabled();
  });
});

/**
 * **상신 확인 창**(C30 · D-17) — 되돌릴 수 없는 둘째 조작 앞의 마지막 층이다.
 */
describe('StockAdjustScreen — 상신 확인 창', () => {
  it('상신을 누르면 창이 서고 요청은 아직 나가지 않는다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(submitRoutes());

    await registerThenReady(user);
    fillReason('실사 차이분 조정');
    await user.click(submitButton());

    expect(screen.getByRole('dialog')).toBeVisible();
    expect(submitRequests(requests)).toHaveLength(0);
    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(0);
  });

  /**
   * ⭐ **전문과 첫 줄을 나눠 보인다**(C30 · A-12). 창이 다시 뽑지 않고 **화면이 만든 값**을 받는다 —
   * 다시 뽑으면 「사용자가 확인한 글자」와 「요청에 실리는 글자」가 갈린다.
   *
   * 두 자리가 **같은 글자를 보이는 것이 지금의 사실이다** — 이 칸이 한 줄 입력이라 첫 줄이 곧
   * 전문이다(아래 시험). 거짓이 아니고, 여러 줄 입력이 붙는 날 두 자리가 갈린다.
   */
  it('창이 사유 전문과 첫 줄을 나눠 보인다', async () => {
    withReasonCodes();

    const { user } = renderScreen(submitRoutes());

    await registerThenReady(user);
    fillReason('  요약 줄  ');
    await user.click(submitButton());

    const dialog = screen.getByRole('dialog');
    const first = within(dialog).getByRole('region', { name: t.dialog.reasonFirstLine });
    const full = within(dialog).getByRole('region', { name: t.dialog.reasonFull });

    expect(within(dialog).getByText('SAMPLE-IA-9301')).toBeVisible();
    expect(within(first).getByText('요약 줄')).toBeVisible();
    expect(within(full).getByText('요약 줄')).toBeVisible();
    expect(within(first).getByText(t.dialog.reasonSummaryNote)).toBeVisible();
  });

  /**
   * ⚠ **이룰 수 없는 조치를 유도하지 않는다**(전례가 남긴 자리 · T2 리뷰 R-3과 같은 축).
   *
   * 이 칸은 **한 줄 입력**이다 — 디자인 시스템의 `TextField`가 `<input>`이라 붙여넣어도 줄바꿈이
   * 지워진다. 그런데 전례의 자리표시 문구는 「다음 줄부터 근거를 적으세요」로 **여러 줄을
   * 지시한다** — 그대로 베끼면 사용자가 할 수 없는 조치를 찾아 헤맨다.
   *
   * **여러 줄 입력이 붙는 날 이 시험이 함께 바뀐다** — 그때 문구도 갈아야 한다는 것을 이 감지기가
   * 잡는다(지금 문구만 고치면 이 시험이 울지 않으므로, 값 축과 문구 축을 함께 문다).
   */
  it('사유 칸이 한 줄 입력이고 유도 문구가 여러 줄을 지시하지 않는다', async () => {
    withReasonCodes();

    const { user } = renderScreen(submitRoutes());

    await registerThenReady(user);
    fillReason('첫 줄\n둘째 줄');

    expect(submitReasonField()).toHaveValue('첫 줄둘째 줄');
    expect(t.submit.reasonPlaceholder).not.toContain('다음 줄');
  });

  it('계속 입력을 누르면 창이 닫히고 요청이 나가지 않는다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(submitRoutes());

    await registerThenReady(user);
    fillReason('실사 차이분 조정');
    await user.click(submitButton());
    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(submitRequests(requests)).toHaveLength(0);
    /* 친 사유는 남는다 — 닫는 것이 버리는 것이 아니다. */
    expect(submitReasonField()).toHaveValue('실사 차이분 조정');
  });

  /**
   * ⭐ **연쇄가 두 벌 돌지 않는다.** 상세 GET이 먼저 나가는 동안 쓰기 훅은 아직 나가는 중이
   * 아니라(`isSaving === false`) 그 틈에 한 번 더 누르면 결재 요청이 두 건 만들어진다 —
   * 공통 훅이 호출마다 새 멱등 키를 만들기 때문이다.
   */
  it('실행 버튼을 두 번 눌러도 요청은 한 번이다', async () => {
    withReasonCodes();

    const { requests, release, user } = renderScreen(submitRoutes(), '?count=9101', [SUBMIT_PATH]);

    await registerThenReady(user);
    fillReason('실사 차이분 조정');
    await user.click(submitButton());
    await user.click(confirmSubmitButton());
    await user.click(confirmSubmitButton());

    await waitFor(() => {
      expect(submitRequests(requests)).toHaveLength(1);
    });

    release();
  });

  /**
   * **Escape 축**(사본 체크리스트 5번). 디자인 시스템이 그 길을 막을 수단을 주지 않으므로,
   * 규율은 「닫히지 않게」가 아니라 **「닫혀도 나가는 요청이 무너지지 않게」**다 — 여기서
   * 쓰기를 되돌리지 않으므로(`reset` 없음) 응답은 그대로 도착해 결과 구획에 선다.
   */
  it('전송 중 Escape로 창이 닫혀도 상신 결과가 살아 있다', async () => {
    withReasonCodes();

    const { requests, release, user } = renderScreen(submitRoutes(), '?count=9101', [SUBMIT_PATH]);

    await registerThenReady(user);
    await submitApproval(user);

    await waitFor(() => {
      expect(submitRequests(requests)).toHaveLength(1);
    });

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    release();

    expect(await screen.findByText(t.result.submittedTitle('SAMPLE-IA-9301'))).toBeInTheDocument();
  });
});

/**
 * ⭐ **상신 요청**(C31 · D-14) — 요청이 **둘**이고 순서가 뜻을 정한다.
 *
 * ① 조정 상세를 부른다(잠금 토큰이 그 경로에서만 나온다) ② 사유 한 칸을 실어 상신한다.
 */
describe('StockAdjustScreen — 상신 요청', () => {
  it('상세를 먼저 부르고 그다음 상신한다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(submitRoutes());

    await registerThenReady(user);
    await submitApproval(user);

    await waitFor(() => {
      expect(submitRequests(requests)).toHaveLength(1);
    });

    const order = requests
      .filter(
        (request) => request.url.pathname === DETAIL_PATH || request.url.pathname === SUBMIT_PATH,
      )
      .map((request) => request.url.pathname);

    expect(order).toEqual([DETAIL_PATH, SUBMIT_PATH]);
    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(1);
  });

  /**
   * ⭐⭐ **상세가 준 토큰이 실린다 — 등록 201의 토큰이 아니다**(C31 · D-14 · 뮤테이션 M-3).
   *
   * 등록 201도 `ETag`를 주지만 그 토큰은 **컬렉션 경로**에 앉는다. 두 값을 다르게 두었으므로
   * 컬렉션 쪽을 집는 구현이면 이 단언이 문다.
   */
  it('상세가 준 ETag가 If-Match로 실린다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(submitRoutes());

    await registerThenReady(user);
    await submitApproval(user);

    await waitFor(() => {
      expect(submitRequests(requests)).toHaveLength(1);
    });

    const sent = submitRequests(requests)[0];

    expect(sent?.headers.get('If-Match')).toBe(DETAIL_ETAG);
    expect(sent?.headers.get('If-Match')).not.toBe(COLLECTION_ETAG);
    expect(sent?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/i);
  });

  /** 본문은 **사유 하나뿐이다**(C31) — 승인 유형·결재선·헤더 사유가 실릴 자리가 없다(D-8). */
  it('본문 키 집합이 사유 하나이고 그 값이 다듬어져 있다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(submitRoutes());

    await registerThenReady(user);
    await submitApproval(user, '  실사 차이분 조정  ');

    await waitFor(() => {
      expect(submitRequests(requests)).toHaveLength(1);
    });

    const body = (submitRequests(requests)[0]?.body ?? {}) as Record<string, unknown>;

    expect(Object.keys(body)).toEqual(['reason']);
    expect(body.reason).toBe('실사 차이분 조정');
  });

  /** ⛔ 상신 요청 주소에도 승인 대기 조건이 실리지 않는다(D-3). */
  it('상신 주소에 승인 대기 조건이 없다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(submitRoutes());

    await registerThenReady(user);
    await submitApproval(user);

    await waitFor(() => {
      expect(submitRequests(requests)).toHaveLength(1);
    });

    expect(submitRequests(requests)[0]?.url.search).not.toContain('pendingApprovalOnly');
  });
});

/**
 * **상신 성공**(C36) — 화면이 확인한 것만 말한다.
 */
describe('StockAdjustScreen — 상신 성공', () => {
  it('올렸다고 말하고 사유 칸과 버튼이 걷힌다', async () => {
    withReasonCodes();

    const { user } = renderScreen(submitRoutes());

    await registerThenReady(user);
    await submitApproval(user);

    expect(await screen.findByText(t.result.submittedTitle('SAMPLE-IA-9301'))).toBeInTheDocument();
    expect(screen.queryByLabelText(t.submit.reason)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: t.actions.requestApproval }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /**
   * ⭐ **202가 준 번호로 결재 진행을 한 번 부른다**(C36).
   *
   * 등록 응답에도 같은 이름의 값이 실려 오지만(목이 채워 준다) 그것으로는 부르지 않는다 —
   * 그 짝 시험이 「등록 응답에 승인 요청 번호가 실려 와도 …」다.
   */
  it('상신 뒤 그 번호로 결재 진행을 부른다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(submitRoutes());

    await registerThenReady(user);
    await submitApproval(user);

    expect(await screen.findByText('SAMPLE-AP-0001')).toBeInTheDocument();
    expect(requestsTo(requests, APPROVAL_PATH)).toHaveLength(1);
  });

  /**
   * ⛔ **결재함의 표기를 나르지 않는다**(C36). 픽스처의 `isMyTurn`·`isMine`이 참이라, 나르는
   * 구현이면 이 시험이 문다.
   */
  it('진행 구획에 승인·반려 조작과 내 차례 표기가 없다', async () => {
    withReasonCodes();

    const { user } = renderScreen(submitRoutes());

    await registerThenReady(user);
    await submitApproval(user);

    await screen.findByText('SAMPLE-AP-0001');

    expect(within(progressPane()).queryAllByRole('button')).toHaveLength(0);
    expect(within(progressPane()).queryByText(/승인하기|반려하기|내 차례/)).not.toBeInTheDocument();
  });

  /**
   * ⭐ **자리표시가 잠금이 아니라 안내를 정한다**(D-13 · C37).
   *
   * 비어 있는 동안에는 「판정하지 못합니다」가 서고, 그 사실이 **어떤 버튼도 잠그지 않는다** —
   * 이 구획에는 버튼이 0건이고 화면의 다른 조작도 승인 축으로 잠기지 않는다.
   */
  it('승인 판정을 못 한다는 사실이 안내로만 선다', async () => {
    withReasonCodes();

    const { user } = renderScreen(submitRoutes());

    await registerThenReady(user);
    await submitApproval(user);

    await screen.findByText('SAMPLE-AP-0001');

    expect(within(progressPane()).getByText(t.progress.unjudgeableNote)).toBeVisible();
    expect(within(progressPane()).queryByText(t.progress.approvedNote)).not.toBeInTheDocument();
    expect(within(progressPane()).getByText(t.progress.postSeparateNote)).toBeVisible();
  });

  /** 결재 진행을 못 읽어도 **상신은 이미 접수됐다** — 화면 배너로 번지지 않는다. */
  it('결재 진행이 실패해도 올렸다는 사실은 남는다', async () => {
    withReasonCodes();

    const { user } = renderScreen(
      allRoutes([etaggedCreateRoute(), detailRoute(), submitRoute(), approvalRoute(500)]),
    );

    await registerThenReady(user);
    await submitApproval(user);

    expect(await screen.findByText(t.progress.loadFailedTitle)).toBeInTheDocument();
    expect(screen.getByText(t.result.submittedTitle('SAMPLE-IA-9301'))).toBeInTheDocument();
    expect(screen.getByText(t.progress.loadFailedNote)).toBeInTheDocument();
  });
});

/**
 * **상신 실패**(D-12) — 전표는 남고 상신만 실패한 갈래를 **정확히** 말한다.
 */
describe('StockAdjustScreen — 상신 실패', () => {
  const submitAndFail = async (
    user: ReturnType<typeof userEvent.setup>,
    requests: RecordedRequest[],
  ): Promise<void> => {
    await registerThenReady(user);
    await submitApproval(user);

    await waitFor(() => {
      expect(submitRequests(requests)).toHaveLength(1);
    });
  };

  /**
   * ⭐ **승인 없이 전기하면 400** 계열과 같은 규율 — 서버가 준 문구를 **그대로** 낸다.
   * 코드 문자열로 분기하지 않는다(공유계약 G-2 · D-12).
   */
  it('400이면 서버 문구가 창 안에 그대로 서고 사유가 남는다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(
      allRoutes([
        etaggedCreateRoute(),
        detailRoute(),
        failingSubmitRoute(400, {
          errors: [{ scope: 'screen', code: 'SAMPLE_ERR', message: '합성 상신 거절' }],
        }),
      ]),
    );

    await submitAndFail(user, requests);

    expect(await screen.findByText('합성 상신 거절')).toBeVisible();
    expect(screen.getByRole('dialog')).toBeVisible();

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );

    /* 전표는 남았고 상신만 실패했다 — 그 사실을 정확히 말한다. */
    expect(
      await screen.findByText(t.result.submitFailedTitle('SAMPLE-IA-9301')),
    ).toBeInTheDocument();
    expect(submitReasonField()).toHaveValue('실사 차이분 조정');
  });

  /** 서버가 사유 칸을 지목하면 **그 칸에** 붙는다 — 배너로 옮기면 무엇을 고칠지 가리키지 못한다. */
  it('사유 칸의 400은 그 칸에 붙는다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(
      allRoutes([
        etaggedCreateRoute(),
        detailRoute(),
        failingSubmitRoute(400, {
          errors: [
            { scope: 'field', field: 'reason', code: 'SAMPLE_ERR', message: '합성 사유 오류' },
          ],
        }),
      ]),
    );

    await submitAndFail(user, requests);

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );

    expect(await screen.findByText('합성 사유 오류')).toBeVisible();
    expect(submitReasonField()).toHaveAttribute('aria-invalid', 'true');
  });

  /** 고치는 순간 그 칸의 서버 오류가 걷힌다 — 남겨 두면 고치는 중에도 빨갛게 서 있다. */
  it('사유를 고치면 그 칸의 서버 오류가 걷힌다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(
      allRoutes([
        etaggedCreateRoute(),
        detailRoute(),
        failingSubmitRoute(400, {
          errors: [
            { scope: 'field', field: 'reason', code: 'SAMPLE_ERR', message: '합성 사유 오류' },
          ],
        }),
      ]),
    );

    await submitAndFail(user, requests);

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );

    await screen.findByText('합성 사유 오류');
    fillReason('고친 사유');

    expect(screen.queryByText('합성 사유 오류')).not.toBeInTheDocument();
  });

  /**
   * ⭐ **409에는 「최신 불러오기」가 붙는다** — 이 쓰기에는 잠글 대상이 있고(계약이 `If-Match`를
   * 필수로 두고 409를 낸다) 다시 읽으면 실제로 풀린다.
   */
  it('409면 최신 불러오기가 상세를 다시 부른다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(
      allRoutes([
        etaggedCreateRoute(),
        detailRoute(),
        failingSubmitRoute(409, { conflictCause: 'user', message: '' }),
      ]),
    );

    await submitAndFail(user, requests);

    await screen.findByText(messages.conflict.user);
    await user.click(screen.getByRole('button', { name: messages.conflict.reloadAction }));

    await waitFor(() => {
      expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(2);
    });

    /*
     * ⭐ **친 사유가 사라지지 않는다**(리뷰 R-2 · 전례가 같은 자리에 세운 잣대).
     *
     * 공용 배너의 안내는 「최신 내용을 불러오면 **입력한 내용은 사라집니다**」인데, 이 화면에서
     * 그 버튼이 부르는 것은 **조정 상세 하나**이고 친 사유를 건드리는 자리가 없다 — 그 참인
     * 사실에 잣대를 두어야 「다시 올릴 길」이 실제 길임이 계측된다. 공용 문구를 갈래별로 나누는
     * 것은 이 회차의 범위 밖이다(`patterns/`·`packages/i18n` 소관 · 별건).
     */
    expect(submitReasonField()).toHaveValue('실사 차이분 조정');
  });

  /**
   * ⛔ **코드 문자열로 분기하지 않는다**(공유계약 G-2 · D-12).
   *
   * 결재선 없음(`ROUTE_NOT_FOUND`)을 화면이 코드로 읽으면, 그 코드가 logistics 계약에 없어
   * 조용히 깨진다 — 슬라이스 어디에도 그 비교가 없다.
   */
  it.each(['ROUTE_NOT_FOUND', 'ROUTE_AMBIGUOUS', 'STATE_LOCKED'])(
    '%s를 코드로 읽지 않고 서버 문구를 그대로 낸다',
    async (code) => {
      withReasonCodes();

      const { requests, user } = renderScreen(
        allRoutes([
          etaggedCreateRoute(),
          detailRoute(),
          failingSubmitRoute(400, {
            errors: [{ scope: 'screen', code, message: `합성 거절 — ${code}` }],
          }),
        ]),
      );

      await submitAndFail(user, requests);

      expect(await screen.findByText(`합성 거절 — ${code}`)).toBeVisible();
    },
  );

  /** 실패한 뒤에는 **다시 올릴 수 있다** — 실패가 화면을 잠그지 않는다. */
  it('실패한 뒤 다시 올리면 상세와 상신이 다시 나간다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(
      allRoutes([etaggedCreateRoute(), detailRoute(), failingSubmitRoute(403)]),
    );

    await submitAndFail(user, requests);

    await screen.findByText(messages.httpError.forbidden);
    await user.click(confirmSubmitButton());

    await waitFor(() => {
      expect(submitRequests(requests)).toHaveLength(2);
    });

    /* **매번 다시 부른다** — 낡은 토큰으로 되풀이해 부딪히지 않는다(`staleTime: 0`). */
    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(2);
  });
});

/**
 * ⭐⭐ **상신 사유의 수명**(리뷰 R-1) — 친 글은 **그 전표의 것이다.**
 *
 * 초안 세션을 올리는 문이 **둘**인데(조작 `resetDraftForNewTarget` · **effect**
 * `seedFromVarianceRef`) 사유를 거두는 문은 하나였다 — 뒤쪽으로 대상이 다시 서면 앞 전표를
 * 위해 쓴 문장이 새 전표의 칸에 남고, 그것이 그 전표의 **결재함 요약**(A-12)으로 올라간다.
 *
 * 고친 형태는 **읽는 자리의 판정**이다(D-15의 「판정은 읽는 자리에서 한다」) — 아래 두 시험이
 * 두 축을 갈라 문다: ① 남의 전표에 매인 글은 **보이지 않는다**(파생) ② 사용자가 조작으로
 * 대상을 버리면 그 글도 **버려진다**(거두기).
 */
describe('StockAdjustScreen — 상신 사유의 수명', () => {
  /**
   * ⭐ **앞 전표를 위해 쓴 사유가 새 전표의 칸에 서지 않는다**(리뷰 탐침 P-1의 승격).
   *
   * 사유를 치고 **올리지 않은 채** 배경 갱신이 대상을 다시 세우면, 앞선 형태에서는 새로 등록한
   * 전표의 사유 칸에 그 문장이 그대로 남고 **버튼까지 열려 있었다**(빈 사유가 아니므로).
   * 그 상태로 확인 창을 열면 전표번호는 새 것인데 「결재함 목록에 요약으로 보일 첫 줄」은 앞
   * 전표의 문장이다 — 되돌릴 수 없는 쓰기에 **다른 전표를 위해 쓴 요약**이 실린다.
   *
   * ⚠ 성공한 상신 뒤에는 이 길이 없다(`onSuccess`가 초안을 비운다) — 그래서 기존 감지기
   * 「앞 전표의 상신이 새로 등록한 전표 위에 서지 않는다」의 `toHaveValue('')`는 **성공 후처리의
   * 부산물**이지 수명 규율의 증거가 아니다. 이 시험은 **올리지 않은 사유**로 그 축을 따로 문다.
   */
  it('올리지 않은 사유가 새로 등록한 전표의 칸에 서지 않는다', async () => {
    withReasonCodes();

    const { queryClient, user } = renderScreen(
      allRoutes([
        changingVarianceRoute(),
        twoAdjustmentsRoute(),
        detailRoute(),
        submitRoute(),
        approvalRoute(),
      ]),
    );

    await registerThenReady(user);

    /* 앞 전표를 위해 쓰기만 하고 **올리지 않는다.** */
    fillReason('앞 전표를 위해 쓴 사유');

    /* 양성 앵커 — 친 글자가 실제로 그 전표의 칸에 섰다. */
    expect(submitReasonField()).toHaveValue('앞 전표를 위해 쓴 사유');

    /* 잠금 밖에서 도는 갱신이 대상을 다시 세운다 — 이 길은 사유를 거두는 문을 지나지 않는다. */
    await queryClient.invalidateQueries({ queryKey: stockAdjustKeys.varianceLines(9101) });

    await waitFor(() => {
      expect(bodyRows()).toHaveLength(1);
    });

    await submitRegister(user);

    const pane = await screen.findByRole('region', { name: t.result.label });

    /* 양성 앵커 — 새 전표의 결과 구획이 실제로 섰다. */
    expect(within(pane).getByText('SAMPLE-IA-9302')).toBeVisible();

    expect(within(pane).getByLabelText(t.submit.reason)).toHaveValue('');
    expect(within(pane).getByRole('button', { name: t.actions.requestApproval })).toBeDisabled();
    expect(within(pane).getByText(t.actionReasons.submitReasonRequired)).toBeVisible();
  });

  /**
   * ⭐ **확인 창이 앞 전표의 문장을 새 전표의 요약으로 되보이지 않는다**(탐침 P-1 관측 ④).
   *
   * 위 시험이 칸과 버튼을 잰다면 이것은 **되돌릴 수 없는 조작의 마지막 층**을 잰다 — 버튼이
   * 잠겨 창이 열리지 않는 것까지가 한 사실이다.
   */
  it('그 사유로 새 전표의 확인 창을 열 수 없다', async () => {
    withReasonCodes();

    const { requests, queryClient, user } = renderScreen(
      allRoutes([
        changingVarianceRoute(),
        twoAdjustmentsRoute(),
        detailRoute(),
        submitRoute(),
        approvalRoute(),
      ]),
    );

    await registerThenReady(user);
    fillReason('앞 전표를 위해 쓴 사유');

    await queryClient.invalidateQueries({ queryKey: stockAdjustKeys.varianceLines(9101) });

    await waitFor(() => {
      expect(bodyRows()).toHaveLength(1);
    });

    await submitRegister(user);
    await screen.findByText(t.result.createdTitle('SAMPLE-IA-9302'));

    await user.click(submitButton());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('앞 전표를 위해 쓴 사유')).not.toBeInTheDocument();
    expect(submitRequests(requests)).toHaveLength(0);
  });

  /**
   * ⭐ **사용자가 명시적으로 버린 글은 되살아나지 않는다** — 읽는 자리의 파생과 **다른 축**이다.
   *
   * 파생이 지키는 것은 「매인 번호가 **다르면** 안 보인다」이고, 이 시험이 지키는 것은
   * 「사용자가 대상을 버렸으면 그 글도 함께 버린다」다 — 그것이 거두는 문
   * (`resetDraftForNewTarget`)이 남아 있는 이유다.
   *
   * **목이 같은 번호를 되돌려 주므로 그 축이 여기서 실제로 재어진다.**
   *
   * ⚠ 이 시험이 「번호 재사용에도 안전하다」를 뜻하지는 않는다 — 매임 자체가 번호의 유일성에
   * 기댄다(계약상 등록은 늘 새 `inventoryAdjustmentId`를 준다). 같은 번호가 다시 오는 조건은
   * **목의 고정 응답이 만드는 것**이고, 그 덕에 이 축을 잴 수 있을 뿐이다(리뷰 R-5).
   */
  it('원천을 바꿔 다시 세우면 앞서 친 사유가 되살아나지 않는다', async () => {
    withReasonCodes();

    const { queryClient, user } = renderScreen(submitRoutes([changingVarianceRoute()]));

    await registerThenReady(user);
    fillReason('버릴 사유');

    /* 등록 성공 뒤에는 폼이 잠긴다 — 배경 갱신이 그 잠금을 푸는 유일한 길이다. */
    await queryClient.invalidateQueries({ queryKey: stockAdjustKeys.varianceLines(9101) });

    await waitFor(() => {
      expect(bodyRows()).toHaveLength(1);
    });

    /* **원천 전환**이 대상을 버리는 한 문을 지난다. */
    await fillDirectLine(user);
    await chooseReason(user);
    await submitRegister(user);

    const pane = await screen.findByRole('region', { name: t.result.label });

    /* 양성 앵커 — 결과 구획이 실제로 다시 섰다(목이 같은 번호를 되돌려 준다). */
    expect(within(pane).getByText('SAMPLE-IA-9301')).toBeVisible();
    expect(within(pane).getByLabelText(t.submit.reason)).toHaveValue('');
  });
});

/**
 * ⭐ **상신의 매임**(D-15) — 늦게 도착한 되먹임이 **남의 전표 위에** 서지 않는다.
 *
 * 이 화면에서 대상이 바뀌는 길은 **잠금 밖에서 도는 effect**다: 배경 재조회가 달라진 실사
 * 차이를 물고 오면 초안 세션이 올라 결과 구획이 걷히고, 그때 나가는 중이던 상신의 응답이
 * 도착한다(등록 갈래가 한 번 겪은 사고와 같은 지형).
 */
describe('StockAdjustScreen — 상신의 매임', () => {
  /** 상신을 보내는 중에 **배경 갱신**이 대상을 다시 세우게 한다. */
  const submitThenRetarget = async (
    user: ReturnType<typeof userEvent.setup>,
    requests: RecordedRequest[],
    queryClient: ReturnType<typeof renderScreen>['queryClient'],
    sent = 1,
  ): Promise<void> => {
    await registerThenReady(user);
    await submitApproval(user);

    await waitFor(() => {
      expect(submitRequests(requests)).toHaveLength(sent);
    });

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );

    await queryClient.invalidateQueries({ queryKey: stockAdjustKeys.varianceLines(9101) });

    /* 달라진 응답이 실제로 대상을 다시 세운 시점을 앵커로 잡는다(줄이 셋 → 하나). */
    await waitFor(() => {
      expect(bodyRows()).toHaveLength(1);
    });
  };

  /**
   * ⭐ **늦은 성공이 남의 전표 위에 서지 않는다.**
   *
   * 서버에는 결재 요청이 실제로 만들어졌으므로 **사실은 밝히되**, 지금 보고 있는 대상의 결과로
   * 세우지 않는다 — 결과 구획도 진행 구획도 서지 않는다.
   *
   * **이 시험이 `resetIfIdle` 규율의 감지기이기도 하다** — 대상을 다시 세울 때 `reset()`을 직접
   * 불렀다면 옵저버가 떨어져 이 성공이 **아예 도착하지 않고**, 아래 안내가 서지 않는다.
   */
  it('늦게 도착한 202가 사실만 알리고 결과 구획을 세우지 않는다', async () => {
    withReasonCodes();

    const { requests, release, queryClient, user } = renderScreen(
      submitRoutes([changingVarianceRoute()]),
      '?count=9101',
      [SUBMIT_PATH],
    );

    await submitThenRetarget(user, requests, queryClient);

    release();

    expect(
      await screen.findByText(t.result.unboundSubmittedNote('SAMPLE-IA-9301')),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: t.result.label })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: t.progress.label })).not.toBeInTheDocument();
  });

  /**
   * ⭐ **늦은 성공이 결재 진행을 열지 않는다**(C36의 매임 몫).
   *
   * 남의 전표의 승인 요청 번호로 진행을 부르면 지금 보고 있는 대상 위에 **다른 문서의 결재
   * 단계**가 선다.
   */
  it('늦게 도착한 202로 결재 진행을 부르지 않는다', async () => {
    withReasonCodes();

    const { requests, release, queryClient, user } = renderScreen(
      submitRoutes([changingVarianceRoute()]),
      '?count=9101',
      [SUBMIT_PATH],
    );

    await submitThenRetarget(user, requests, queryClient);

    release();

    await screen.findByText(t.result.unboundSubmittedNote('SAMPLE-IA-9301'));

    expect(requestsTo(requests, APPROVAL_PATH)).toEqual([]);
  });

  /**
   * ⭐ **늦은 실패도 남의 전표 위에 서지 않는다.** 성공만 매고 실패를 두면 절반만 막힌다 —
   * 사용자는 한 번도 올린 적 없는 대상이 이미 거부된 줄 알게 된다.
   */
  it('늦게 도착한 400이 남의 전표 위에 서지 않는다', async () => {
    withReasonCodes();

    const { requests, release, queryClient, user } = renderScreen(
      allRoutes([
        changingVarianceRoute(),
        etaggedCreateRoute(),
        detailRoute(),
        failingSubmitRoute(400, {
          errors: [{ scope: 'screen', code: 'SAMPLE_ERR', message: '합성 상신 거절' }],
        }),
      ]),
      '?count=9101',
      [SUBMIT_PATH],
    );

    await submitThenRetarget(user, requests, queryClient);

    release();

    /* 응답이 실제로 도착한 시점의 양성 앵커 — 그 뒤에 음성 단언을 잰다. */
    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.actions.register })).toBeEnabled();
    });

    expect(screen.queryByText('합성 상신 거절')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: t.result.label })).not.toBeInTheDocument();
  });

  /**
   * ⭐ **선 뒤에 끊겨도 사실이 남는다**(읽는 자리의 파생).
   *
   * 「올렸습니다」가 선 **뒤에** 같은 effect가 초안 세션을 올리면 결과 구획이 통째로 걷힌다 —
   * 그때 영수증까지 사라지면 사용자는 **결재에 올린 줄 모르는 요청**을 남긴다.
   */
  it('올린 뒤 실사 차이가 달라져도 그 사실이 화면에 남는다', async () => {
    withReasonCodes();

    const { queryClient, user } = renderScreen(submitRoutes([changingVarianceRoute()]));

    await registerThenReady(user);
    await submitApproval(user);

    /* 양성 앵커 — 이 전표의 상신이 실제로 섰다. */
    await screen.findByText(t.result.submittedTitle('SAMPLE-IA-9301'));

    await queryClient.invalidateQueries({ queryKey: stockAdjustKeys.varianceLines(9101) });

    await waitFor(() => {
      expect(bodyRows()).toHaveLength(1);
    });

    expect(screen.getByText(t.result.unboundSubmittedNote('SAMPLE-IA-9301'))).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: t.result.label })).not.toBeInTheDocument();
  });

  /**
   * ⭐⭐ **앞 전표의 상신이 새 전표 위에 서지 않는다** — 이 회차 매임의 **핵심 소비처**다.
   *
   * 배경 재조회가 초안 세션을 올리는 자리(`seedFromVarianceRef`)는 **대상을 버리는 한 문을
   * 지나지 않는다** — 상신 매임이 거둬지지 않은 채 남는다. 그 상태에서 사용자가 다시 등록하면
   * 새 전표의 결과 구획이 서는데, 매임을 지나지 않으면 **한 번도 올린 적 없는 전표가 「결재에
   * 올렸습니다」로 그려진다.**
   *
   * ⚠ 이 감지기는 **뮤테이션이 찾아낸 자리다**(M-3b 초회 사살 1건 — 나머지 갈래는 결과 구획
   * 자체가 걷혀 가려져 있었다). 두 전표의 **내부 번호가 실제로 갈려야** 이 시험이 성립한다.
   */
  it('앞 전표의 상신이 새로 등록한 전표 위에 서지 않는다', async () => {
    withReasonCodes();

    const { queryClient, user } = renderScreen(
      allRoutes([
        changingVarianceRoute(),
        twoAdjustmentsRoute(),
        detailRoute(),
        submitRoute(),
        approvalRoute(),
      ]),
    );

    await registerThenReady(user);
    await submitApproval(user);

    /* 양성 앵커 — 첫 전표의 상신이 실제로 섰다. */
    await screen.findByText(t.result.submittedTitle('SAMPLE-IA-9301'));

    /* 잠금 밖에서 도는 갱신이 대상을 다시 세운다 — 상신 매임은 거둬지지 않는다. */
    await queryClient.invalidateQueries({ queryKey: stockAdjustKeys.varianceLines(9101) });

    await waitFor(() => {
      expect(bodyRows()).toHaveLength(1);
    });

    /* 새 전표를 만든다 — 결과 구획이 그 전표로 다시 선다. */
    await submitRegister(user);

    const pane = await screen.findByRole('region', { name: t.result.label });

    expect(within(pane).getByText('SAMPLE-IA-9302')).toBeVisible();
    /* ⭐ 앞 전표의 상신이 이 전표 위에 서지 않는다. */
    expect(
      within(pane).queryByText(t.result.submittedTitle('SAMPLE-IA-9302')),
    ).not.toBeInTheDocument();
    expect(within(pane).getByLabelText(t.submit.reason)).toHaveValue('');
    expect(
      within(pane).getByRole('button', { name: t.actions.requestApproval }),
    ).toBeInTheDocument();
  });

  /**
   * ⭐⭐ **매임의 실패 축 소비처 둘**(검증 문제 ①) — 배너와 사유 칸 인라인.
   *
   * 앞 회차는 성공 축 둘(갈래 판정·진행 조회)에만 잣대가 섰고, **실패 축 둘은 각각 끊어도
   * 584건이 전부 통과했다**(MB-2·MB-3 생존). 그때 사용자는 **한 번도 올린 적 없는 전표**에
   * 앞 전표의 거절 사유가 서 있는 화면을 본다.
   *
   * 재현은 검증이 밟은 길 그대로다 — 전표 A 상신 400 → 창을 Escape로 닫는다 → 배경 갱신이
   * 초안 세션을 올린다(사유·매임을 거두는 문을 지나지 않는다) → 전표 B를 새로 등록한다.
   */
  const submitFailThenRetarget = async (
    user: ReturnType<typeof userEvent.setup>,
    requests: RecordedRequest[],
    queryClient: ReturnType<typeof renderScreen>['queryClient'],
  ): Promise<void> => {
    await registerThenReady(user);
    await submitApproval(user);

    await waitFor(() => {
      expect(submitRequests(requests)).toHaveLength(1);
    });

    /*
     * **짝 양성**(사본 체크리스트 9번 · 리뷰 R-4). 뒤따르는 음성 단언이 재는 것은 「그 오류가
     * 새 전표로 옮겨 붙지 않는다」인데, **앞 전표 위에 실제로 섰다는 사실**을 같은 시점에 잡지
     * 않으면 오류가 아예 서지 않는 구현에서도 통과한다. 짝인 배너 감지기가 같은 형태를 쓴다.
     */
    expect(await screen.findByText('앞 전표의 사유 오류')).toBeVisible();

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );

    await queryClient.invalidateQueries({ queryKey: stockAdjustKeys.varianceLines(9101) });

    await waitFor(() => {
      expect(bodyRows()).toHaveLength(1);
    });

    await submitRegister(user);
    await screen.findByText(t.result.createdTitle('SAMPLE-IA-9302'));
  };

  /** 400을 **두 갈래로 함께** 준다 — 배너 축과 칸 축을 같은 응답으로 만든다. */
  const bothScopeFailingSubmitRoute = (): StubRoute =>
    failingSubmitRoute(400, {
      errors: [
        { scope: 'screen', code: 'SAMPLE_ERR', message: '앞 전표의 거절 사유' },
        { scope: 'field', field: 'reason', code: 'SAMPLE_ERR', message: '앞 전표의 사유 오류' },
      ],
    });

  const retargetRoutes = (): StubRoute[] =>
    allRoutes([
      changingVarianceRoute(),
      twoAdjustmentsRoute(),
      detailRoute(),
      secondDetailRoute(),
      bothScopeFailingSubmitRoute(),
      approvalRoute(),
    ]);

  it('앞 전표의 상신 실패 배너가 새로 등록한 전표 위에 서지 않는다', async () => {
    withReasonCodes();

    const { requests, queryClient, user } = renderScreen(retargetRoutes());

    /* 양성 앵커 — 그 배너가 앞 전표 위에는 실제로 섰다. */
    await registerThenReady(user);
    await submitApproval(user);
    expect(await screen.findByText('앞 전표의 거절 사유')).toBeVisible();

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );
    await queryClient.invalidateQueries({ queryKey: stockAdjustKeys.varianceLines(9101) });
    await waitFor(() => {
      expect(bodyRows()).toHaveLength(1);
    });
    await submitRegister(user);

    const pane = await screen.findByRole('region', { name: t.result.label });

    expect(within(pane).getByText('SAMPLE-IA-9302')).toBeVisible();
    expect(screen.queryByText('앞 전표의 거절 사유')).not.toBeInTheDocument();
    /* 실패 갈래 자체가 옮겨 붙지 않는다 — 새 전표는 「만들었습니다」로 선다. */
    expect(
      within(pane).queryByText(t.result.submitFailedTitle('SAMPLE-IA-9302')),
    ).not.toBeInTheDocument();
    expect(submitRequests(requests)).toHaveLength(1);
  });

  it('앞 전표의 사유 칸 오류가 새로 등록한 전표의 칸에 서지 않는다', async () => {
    withReasonCodes();

    const { requests, queryClient, user } = renderScreen(retargetRoutes());

    await submitFailThenRetarget(user, requests, queryClient);

    const pane = await screen.findByRole('region', { name: t.result.label });

    expect(within(pane).getByText('SAMPLE-IA-9302')).toBeVisible();
    expect(screen.queryByText('앞 전표의 사유 오류')).not.toBeInTheDocument();
    expect(within(pane).getByLabelText(t.submit.reason)).not.toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  /**
   * ⭐ **끊긴 상신 영수증이 쌓인다 — 둘이면 둘 다 남는다**(검증 문제 ③ · 등록 축과 대칭).
   *
   * 매임은 한 자리라 **뒤이은 상신이 성공하면 앞 요청의 사실이 덮인다** — 그 사고를 막으려고
   * 매임과 다른 자리에 쌓는데, 쌓는 축(`[...prev, x]` 대 `[x]`)은 **끊긴 상신이 둘일 때만**
   * 갈린다. 등록 축의 「버린 초안이 둘이면 두 전표번호가 모두 남는다」의 상신판이다.
   */
  it('끊긴 상신이 둘이면 두 전표번호가 모두 남는다', async () => {
    withReasonCodes();

    const { requests, release, queryClient, user } = renderScreen(
      allRoutes([
        changingVarianceRoute(),
        twoAdjustmentsRoute(),
        detailRoute(),
        secondDetailRoute(),
        submitRoute(),
        secondSubmitRoute(),
        approvalRoute(),
      ]),
      '?count=9101',
      [SUBMIT_PATH, SECOND_SUBMIT_PATH],
    );

    /* ① 전표 A를 상신하는 중에 배경 갱신이 대상을 다시 세운다. */
    await submitThenRetarget(user, requests, queryClient);
    release();

    await screen.findByText(t.result.unboundSubmittedNote('SAMPLE-IA-9301'));

    /* ② 전표 B를 새로 등록해 같은 일을 되풀이한다. */
    await submitRegister(user);
    await screen.findByText(t.result.createdTitle('SAMPLE-IA-9302'));
    await submitApproval(user, '둘째 사유');

    await waitFor(() => {
      expect(
        requests.filter((request) => request.url.pathname === SECOND_SUBMIT_PATH),
      ).toHaveLength(1);
    });

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );
    await queryClient.invalidateQueries({ queryKey: stockAdjustKeys.varianceLines(9101) });
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: t.result.label })).toBeNull();
    });

    release();

    expect(
      await screen.findByText(t.result.unboundSubmittedNote('SAMPLE-IA-9301, SAMPLE-IA-9302')),
    ).toBeInTheDocument();
  });

  /** 짝 방향 — 대상이 그대로면 결과가 **이 전표 위에 선다.** 「늘 감춘다」로 통과하지 않게 한다. */
  it('대상이 그대로면 올렸다는 사실이 결과 구획에 선다', async () => {
    withReasonCodes();

    const { user } = renderScreen(submitRoutes());

    await registerThenReady(user);
    await submitApproval(user);

    expect(await screen.findByText(t.result.submittedTitle('SAMPLE-IA-9301'))).toBeInTheDocument();
    expect(
      screen.queryByText(t.result.unboundSubmittedNote('SAMPLE-IA-9301')),
    ).not.toBeInTheDocument();
  });
});

/* ─────────────────────────────────────────────────────────────────────────────
 * 전기 — **이 화면에서 재고가 실제로 움직이는 유일한 자리**다.
 * ───────────────────────────────────────────────────────────────────────────── */

const POST_PATH = '/inventory/adjustments/9301:post';
const SECOND_POST_PATH = '/inventory/adjustments/9302:post';

const postRoute = (body: unknown = postedAdjustmentBody()): StubRoute => ({
  match: (request) => isPost(request, POST_PATH),
  respond: () => jsonResponse(body),
});

const failingPostRoute = (status: number, body: unknown = { message: '' }): StubRoute => ({
  match: (request) => isPost(request, POST_PATH),
  respond: () => jsonResponse(body, { status }),
});

/** 응답이 아예 오지 않는 갈래 — **재고가 움직였는지 화면이 알 수 없다.** */
const offlinePostRoute = (): StubRoute => ({
  match: (request) => isPost(request, POST_PATH),
  respond: () => {
    throw new TypeError('Failed to fetch');
  },
});

const secondPostRoute = (): StubRoute => ({
  match: (request) => isPost(request, SECOND_POST_PATH),
  respond: () => jsonResponse(postedAdjustmentBody({ statusCode: 'SAMPLE_IA_STATUS_C' })),
});

/** 전기까지 갈 수 있는 경로 한 벌. 갈래마다 바꿀 것만 앞에 얹는다. */
const postRoutes = (overrides: StubRoute[] = []): StubRoute[] =>
  allRoutes([
    ...overrides,
    etaggedCreateRoute(),
    detailRoute(),
    submitRoute(),
    approvalRoute(),
    postRoute(),
  ]);

const postPane = (): HTMLElement => screen.getByRole('region', { name: t.post.label });

const togglePostButton = (): HTMLElement =>
  within(postPane()).getByRole('button', { name: t.actions.togglePost });

const postButton = (): HTMLElement =>
  within(postPane()).getByRole('button', { name: t.actions.post });

const confirmPostButton = (): HTMLElement =>
  screen.getByRole('button', { name: new RegExp(t.actions.confirmPost) });

const businessDateField = (): HTMLElement => within(postPane()).getByLabelText(t.post.businessDate);

const occurredAtField = (): HTMLElement => within(postPane()).getByLabelText(t.post.occurredAt);

const postRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === POST_PATH);

const lastPostBody = (requests: RecordedRequest[]): Record<string, unknown> =>
  (postRequests(requests).at(-1)?.body ?? {}) as Record<string, unknown>;

/** 등록까지 끝내 **전기 자리가 선 상태**로 만든다. */
const registerThenPostReady = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await setupAndRegister(user);
  await screen.findByRole('region', { name: t.post.label });
};

/** 접힌 두 번째 선택지를 편다 — **펼쳐야 두 칸과 버튼이 나온다**(D-12). */
const expandPost = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(togglePostButton());
  await within(postPane()).findByLabelText(t.post.businessDate);
};

/** 확인 창을 열고 실행까지 누른다. **두 걸음이 갈려 있어야** 창만 열린 상태도 잴 수 있다. */
const postAdjustment = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(postButton());
  await user.click(confirmPostButton());
};

/**
 * 오늘 날짜를 **다른 식으로** 만든다 — 제품과 같은 식을 쓰면 자기참조라 아무것도 재지 않는다.
 * `sv-SE`는 지역 시각을 `YYYY-MM-DD`로 낸다.
 */
const localToday = (): string => new Date().toLocaleDateString('sv-SE');

/**
 * ⭐ **접힌 두 번째 선택지**(D-12 · C33) — 앞자리 주 버튼은 「조정 상신」이고 이 길은 펼쳐야 나온다.
 *
 * 결재선이 있는지 화면이 알 통로가 계약에 없어(§5.2.4) **화면이 앞서 판정하지 않는다** —
 * 틀린 길은 서버가 400으로 막는다.
 */
describe('StockAdjustScreen — 전기 자리', () => {
  it('등록하기 전에는 전기 자리가 없다', async () => {
    withReasonCodes();

    const { user } = renderScreen(postRoutes());

    await readyToRegister(user);

    /* 짝 양성 — 등록 자리는 실제로 섰다(그 뒤에 없음을 잰다). */
    expect(registerButton()).toBeEnabled();
    expect(screen.queryByRole('region', { name: t.post.label })).not.toBeInTheDocument();
  });

  /**
   * ⭐ **접혀 있어도 상시 사유가 선다**(D-12). 이 길이 누구의 것인지 밝히지 않으면 결재선이
   * 있는 조정도 여기로 오고, 그때 사용자가 만나는 것은 이유를 알 수 없는 400이다.
   */
  it('등록하면 접힌 채로 서고 이 길이 누구의 것인지 밝힌다', async () => {
    withReasonCodes();

    const { user } = renderScreen(postRoutes());

    await registerThenPostReady(user);

    expect(within(postPane()).getByText(t.post.onlyWithoutRoute)).toBeVisible();
    expect(togglePostButton()).toHaveAttribute('aria-expanded', 'false');
    expect(within(postPane()).queryByLabelText(t.post.businessDate)).not.toBeInTheDocument();
    expect(
      within(postPane()).queryByRole('button', { name: t.actions.post }),
    ).not.toBeInTheDocument();
  });

  /**
   * ⭐ **두 값이 제출 순간으로 채워진다**(공유계약 C-8·C-1의 기본값).
   *
   * 기본값이라 대부분 그대로 지나가고, 자정을 넘겨 일한 사람만 고친다 — 비워 두면 되돌릴 수
   * 없는 조작 앞에서 사용자가 매번 날짜를 지어내야 한다.
   */
  it('펼치면 두 칸이 제출 순간으로 채워진다', async () => {
    withReasonCodes();

    const { user } = renderScreen(postRoutes());

    await registerThenPostReady(user);
    await expandPost(user);

    expect(togglePostButton()).toHaveAttribute('aria-expanded', 'true');
    expect(businessDateField()).toHaveValue(localToday());
    /* 발생 일시는 분까지라 값을 통째로 견줄 수 없다 — **날짜 조각과 형식**을 잰다. */
    expect((occurredAtField() as HTMLInputElement).value).toMatch(
      new RegExp(`^${localToday()}T\\d{2}:\\d{2}$`),
    );
  });

  /** 접었다 다시 펴면 **치던 값이 그대로다** — 같은 전표라면 사용자가 버린 적이 없다. */
  it('접었다 다시 펴도 고친 값이 남는다', async () => {
    withReasonCodes();

    const { user } = renderScreen(postRoutes());

    await registerThenPostReady(user);
    await expandPost(user);
    fireEvent.change(businessDateField(), { target: { value: '2026-08-17' } });

    await user.click(togglePostButton());
    await user.click(togglePostButton());

    expect(businessDateField()).toHaveValue('2026-08-17');
  });

  /**
   * ⭐⭐ **승인 축으로 잠그지 않는다**(D-13 · C33·C37).
   *
   * 자리표시(`APPROVED_APPROVAL_STATUS_CODES`)가 비어 있는 채로 그것을 잠금에 쓰면 이 버튼이
   * **영영 잠긴다** — 승인 축의 잠금은 서버가 400으로 한다(D-12).
   */
  it('승인 판정 자리표시가 비어 있어도 전기가 잠기지 않는다', async () => {
    withReasonCodes();

    const { user } = renderScreen(postRoutes());

    /* 자리표시가 실제로 비어 있는 것이 이 시험의 전제다. */
    expect(APPROVED_APPROVAL_STATUS_CODES).toEqual([]);
    expect(REJECTION_DECISION_CODES).toEqual([]);

    await registerThenPostReady(user);
    await expandPost(user);

    expect(postButton()).toBeEnabled();
  });

  /** 상신하지 않은 전표에서도 열려 있다 — 「결재선이 없는 조정」이 이 길의 정상 경로다. */
  it('상신하지 않은 전표에서도 전기가 열려 있다', async () => {
    withReasonCodes();

    const { user } = renderScreen(postRoutes());

    await registerThenPostReady(user);
    await expandPost(user);

    expect(screen.queryByRole('group', { name: t.progress.label })).not.toBeInTheDocument();
    expect(postButton()).toBeEnabled();
  });

  /**
   * ⭐⭐ **상신에 성공한 뒤에도 전기 자리가 남는다** — 이 구획을 결과 구획의 **형제로 둔 근거다.**
   *
   * 결과 구획의 사유 칸·버튼·배너는 상신 성공과 함께 걷히는 한 덩어리(`canSubmit`)라, 전기를
   * 그 안에 얹으면 **상신에 성공한 순간 전기 길이 화면에서 사라진다.** 스펙 §5-6이 전기의 활성
   * 조건을 「승인 후」로 두었으므로 그것은 정상 경로를 지우는 것이 된다.
   */
  it('상신에 성공한 뒤에도 전기 자리가 남는다', async () => {
    withReasonCodes();

    const { user } = renderScreen(postRoutes());

    await registerThenPostReady(user);
    await submitApproval(user);

    /* 양성 앵커 — 상신이 실제로 성공해 결과 구획의 사유 칸과 버튼이 걷혔다. */
    await screen.findByText(t.result.submittedTitle('SAMPLE-IA-9301'));
    expect(
      within(resultPane()).queryByRole('button', { name: t.actions.requestApproval }),
    ).not.toBeInTheDocument();

    await expandPost(user);

    expect(postButton()).toBeEnabled();
  });
});

/**
 * ⭐ **전기 요청**(C32) — 상신과 **같은 토큰 원천**을 쓴다(D-14).
 */
describe('StockAdjustScreen — 전기 요청', () => {
  it('상세를 먼저 부르고 그다음 전기한다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(postRoutes());

    await registerThenPostReady(user);
    await expandPost(user);
    await postAdjustment(user);

    await waitFor(() => {
      expect(postRequests(requests)).toHaveLength(1);
    });

    const paths = requests
      .filter((request) => request.url.pathname.startsWith('/inventory/adjustments'))
      .map((request) => `${request.method} ${request.url.pathname}`);

    expect(paths.slice(-2)).toEqual([`GET ${DETAIL_PATH}`, `POST ${POST_PATH}`]);
  });

  /**
   * ⭐ **상세가 준 토큰이 실린다**(C32 · 뮤테이션 M-3b의 대조군).
   *
   * 등록 201이 남긴 토큰은 **컬렉션 경로**에 앉는다 — 두 값을 다르게 두었으므로 컬렉션 쪽을
   * 집는 구현이면 이 시험이 문다.
   */
  it('상세가 준 ETag가 If-Match로 실리고 멱등 키가 함께 간다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(postRoutes());

    await registerThenPostReady(user);
    await expandPost(user);
    await postAdjustment(user);

    await waitFor(() => {
      expect(postRequests(requests)).toHaveLength(1);
    });

    const sent = postRequests(requests)[0];

    expect(sent?.headers.get('If-Match')).toBe(DETAIL_ETAG);
    expect(sent?.headers.get('If-Match')).not.toBe(COLLECTION_ETAG);
    expect(sent?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/i);
  });

  /**
   * ⭐⭐ **본문 키 집합이 영업일과 발생 시각 둘이다**(C32 · 뮤테이션 M-3b가 겨누는 자리).
   *
   * 영업일이 빠지면 서버가 수신 시각으로 다시 잡아 **날짜 경계에서 멱등이 뚫린다**
   * (공유계약 C-8) — 그 순간 같은 조정이 두 번 원장에 잡힐 수 있다.
   */
  it('본문 키 집합이 영업일과 발생 시각 둘이다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(postRoutes());

    await registerThenPostReady(user);
    await expandPost(user);
    await postAdjustment(user);

    await waitFor(() => {
      expect(postRequests(requests)).toHaveLength(1);
    });

    expect(Object.keys(lastPostBody(requests)).sort()).toEqual(['businessDate', 'occurredAt']);
  });

  /**
   * ⭐ **고친 영업일이 그대로 실린다** — 화면이 다시 계산하지 않는다.
   *
   * 자정을 넘겨 일한 사람이 어제 자로 고친 값이 실행 시각의 날짜로 덮이면, 그 조정은 **틀린
   * 영업일로 원장에 남는다**(공유계약 C-8).
   */
  it('고친 영업일이 그대로 실리고 발생 시각과 갈린다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(postRoutes());

    await registerThenPostReady(user);
    await expandPost(user);
    fireEvent.change(businessDateField(), { target: { value: '2026-08-17' } });
    fireEvent.change(occurredAtField(), { target: { value: '2026-08-18T00:30' } });
    await postAdjustment(user);

    await waitFor(() => {
      expect(postRequests(requests)).toHaveLength(1);
    });

    const body = lastPostBody(requests);

    expect(body.businessDate).toBe('2026-08-17');
    expect(String(body.occurredAt)).toMatch(/^2026-08-18T00:30:00[+-]\d{2}:\d{2}$/);
  });

  /** ⛔ 승인 대기 조건을 싣지 않는다(D-3) — 전기 주소에도 그 조건이 없다. */
  it('전기 주소에 승인 대기 조건이 없다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(postRoutes());

    await registerThenPostReady(user);
    await expandPost(user);
    await postAdjustment(user);

    await waitFor(() => {
      expect(postRequests(requests)).toHaveLength(1);
    });

    for (const request of requests) {
      expect(request.url.search).not.toContain('pendingApprovalOnly');
    }
  });
});

/**
 * ⭐ **전기 확인 창**(D-17 · C38) — 재고를 움직이는 조작 앞의 마지막 층이다.
 */
describe('StockAdjustScreen — 전기 확인 창', () => {
  it('전기를 누르면 창이 서고 요청은 아직 나가지 않는다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(postRoutes());

    await registerThenPostReady(user);
    await expandPost(user);
    await user.click(postButton());

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(postRequests(requests)).toHaveLength(0);
  });

  /** 창이 **무엇이 언제 자로 잡히는지**와 「일어나는 일」 세 문장을 함께 되보인다. */
  it('창이 두 값과 일어나는 일 세 문장을 되보인다', async () => {
    withReasonCodes();

    const { user } = renderScreen(postRoutes());

    await registerThenPostReady(user);
    await expandPost(user);
    fireEvent.change(businessDateField(), { target: { value: '2026-08-17' } });
    fireEvent.change(occurredAtField(), { target: { value: '2026-08-18T00:30' } });
    await user.click(postButton());

    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText('SAMPLE-IA-9301')).toBeVisible();
    expect(within(dialog).getByText('2026-08-17')).toBeVisible();
    expect(within(dialog).getByText('2026-08-18T00:30')).toBeVisible();
    /* 두 날짜가 갈렸다는 사실을 밝히되 막지 않는다(공유계약 C-8). */
    expect(within(dialog).getByText(t.dialog.postDatesApart)).toBeVisible();

    const effects = within(dialog).getByRole('region', { name: t.post.effectsLabel });

    expect(within(effects).getByText(t.post.effectMovesStock)).toBeVisible();
    expect(within(effects).getByText(t.post.effectApprovalIsNotPosting)).toBeVisible();
    expect(within(effects).getByText(t.post.effectNoUndoHere)).toBeVisible();
  });

  /**
   * ⭐ **실행을 두 번 눌러도 요청은 한 번이다.**
   *
   * 상세 조회와 전기 사이의 틈에서 한 번 더 누르면 연쇄가 두 벌 돌고, 공통 훅이 호출마다 새
   * 멱등 키를 만들어 그것이 그대로 **재고를 두 번 움직인다.**
   */
  it('실행 버튼을 두 번 눌러도 요청은 한 번이다', async () => {
    withReasonCodes();

    const { requests, release, user } = renderScreen(postRoutes(), '?count=9101', [POST_PATH]);

    await registerThenPostReady(user);
    await expandPost(user);
    await user.click(postButton());
    await user.click(confirmPostButton());
    await user.click(confirmPostButton());

    await waitFor(() => {
      expect(postRequests(requests)).toHaveLength(1);
    });

    release();

    await screen.findByText(t.post.postedTitle('SAMPLE-IA-9301'));

    expect(postRequests(requests)).toHaveLength(1);
  });

  /**
   * ⭐ **Escape로 닫혀도 나가는 요청이 무너지지 않는다**(3방어의 셋째 축 · `resetIfIdle`).
   *
   * 창은 닫힘을 알리기만 하고 되돌리는 일을 하지 않는다 — 응답은 그대로 도착해 매임을 지나
   * 전기 구획에 선다.
   */
  it('전송 중 Escape로 창이 닫혀도 전기 결과가 살아 있다', async () => {
    withReasonCodes();

    const { requests, release, user } = renderScreen(postRoutes(), '?count=9101', [POST_PATH]);

    await registerThenPostReady(user);
    await expandPost(user);
    await postAdjustment(user);

    await waitFor(() => {
      expect(postRequests(requests)).toHaveLength(1);
    });

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    release();

    expect(await screen.findByText(t.post.postedTitle('SAMPLE-IA-9301'))).toBeVisible();
  });
});

/**
 * ⭐ **전기 성공**(C35) — 화면이 받은 200이 근거다.
 */
describe('StockAdjustScreen — 전기 성공', () => {
  it('전기했다고 말하고 전기 시각과 상태를 서버가 준 그대로 낸다', async () => {
    withReasonCodes();

    const { user } = renderScreen(postRoutes());

    await registerThenPostReady(user);
    await expandPost(user);
    await postAdjustment(user);

    expect(await screen.findByText(t.post.postedTitle('SAMPLE-IA-9301'))).toBeVisible();
    expect(within(postPane()).getByText('2026-08-18 14:05')).toBeVisible();
    expect(within(postPane()).getByText('SAMPLE_IA_STATUS_B')).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /** 전기한 뒤에는 **칠 수 있는데 보낼 수 없는 칸**을 남기지 않는다. */
  it('전기한 뒤에는 두 칸과 버튼이 걷힌다', async () => {
    withReasonCodes();

    const { user } = renderScreen(postRoutes());

    await registerThenPostReady(user);
    await expandPost(user);
    await postAdjustment(user);

    await screen.findByText(t.post.postedTitle('SAMPLE-IA-9301'));

    expect(within(postPane()).queryByLabelText(t.post.businessDate)).not.toBeInTheDocument();
    expect(
      within(postPane()).queryByRole('button', { name: t.actions.post }),
    ).not.toBeInTheDocument();
  });

  /**
   * ⭐ **200은 왔는데 전기 시각이 비어 온 갈래**(계약이 nullable로 두었다).
   *
   * 빈 자리로 두면 「불러오지 못한 것」처럼 보이고, 「전기되지 않았다」로 접으면 **움직인
   * 재고를 안 움직였다고** 말하게 된다.
   */
  it('전기 시각이 오지 않아도 전기됐다고 말한다', async () => {
    withReasonCodes();

    const { user } = renderScreen(
      allRoutes([
        etaggedCreateRoute(),
        detailRoute(),
        postRoute(postedAdjustmentBody({ adjustedAt: null })),
      ]),
    );

    await registerThenPostReady(user);
    await expandPost(user);
    await postAdjustment(user);

    expect(await screen.findByText(t.post.postedTitle('SAMPLE-IA-9301'))).toBeVisible();
    expect(within(postPane()).getByText(t.post.adjustedAtUnknown)).toBeVisible();
  });

  /**
   * ⭐ **이미 전기한 전표는 결재에 올리지 않는다**(구현 판단 · 근거는 이 화면이 받은 200이다).
   *
   * 재고가 이미 움직인 조정에 결재를 올리면 결재함에 **무엇을 승인하는지 없는** 요청이 남는다.
   * 상태 코드를 읽어 판정하지 않는다(C35).
   */
  it('전기한 뒤에는 상신이 잠기고 그 사정을 말한다', async () => {
    withReasonCodes();

    const { user } = renderScreen(postRoutes());

    await registerThenPostReady(user);
    await expandPost(user);
    await postAdjustment(user);

    await screen.findByText(t.post.postedTitle('SAMPLE-IA-9301'));

    expect(
      within(resultPane()).getByRole('button', { name: t.actions.requestApproval }),
    ).toBeDisabled();
    expect(within(resultPane()).getByText(t.actionReasons.submitAfterPosted)).toBeVisible();
  });

  /** 등록 사실은 그대로 남는다 — 전기가 그 위를 덮지 않는다(두 사실이 각자 자리에 선다). */
  it('전기해도 등록 결과 구획은 그대로 남는다', async () => {
    withReasonCodes();

    const { user } = renderScreen(postRoutes());

    await registerThenPostReady(user);
    await expandPost(user);
    await postAdjustment(user);

    await screen.findByText(t.post.postedTitle('SAMPLE-IA-9301'));

    expect(within(resultPane()).getByText(t.result.createdTitle('SAMPLE-IA-9301'))).toBeVisible();
    expect(within(postPane()).getByText(t.post.bookQtyStale)).toBeVisible();
  });
});

/**
 * **전기가 막힌 사유** — 잠갔으면 사유가 반드시 함께 선다.
 */
describe('StockAdjustScreen — 전기가 막힌 사유', () => {
  it('영업일을 비우면 잠기고 그 칸과 버튼이 사정을 말한다', async () => {
    withReasonCodes();

    const { user } = renderScreen(postRoutes());

    await registerThenPostReady(user);
    await expandPost(user);
    fireEvent.change(businessDateField(), { target: { value: '' } });

    expect(postButton()).toBeDisabled();
    expect(within(postPane()).getByText(t.actionReasons.postDraftInvalid)).toBeVisible();
    expect(within(postPane()).getByText(t.errors.businessDateRequired)).toBeVisible();
  });

  it('발생 일시를 비우면 잠기고 그 칸이 사정을 말한다', async () => {
    withReasonCodes();

    const { user } = renderScreen(postRoutes());

    await registerThenPostReady(user);
    await expandPost(user);
    fireEvent.change(occurredAtField(), { target: { value: '' } });

    expect(postButton()).toBeDisabled();
    expect(within(postPane()).getByText(t.errors.occurredAtRequired)).toBeVisible();
  });

  /**
   * ⭐ **되돌릴 수 없는 쓰기 둘이 서로를 막는다.** 두 요청이 함께 나가면 재고가 움직이는
   * 순간과 결재가 시작되는 순간이 겹치고, 어느 쪽이 먼저 닿는지 화면이 알 수 없다.
   */
  it('상신을 보내는 중에는 전기가 잠기고 그 사정을 말한다', async () => {
    withReasonCodes();

    const { requests, release, user } = renderScreen(postRoutes(), '?count=9101', [SUBMIT_PATH]);

    await registerThenPostReady(user);
    await expandPost(user);
    await submitApproval(user);

    await waitFor(() => {
      expect(submitRequests(requests)).toHaveLength(1);
    });

    expect(postButton()).toBeDisabled();
    expect(within(postPane()).getByText(t.actionReasons.postWhileSubmitting)).toBeVisible();

    release();
  });

  it('전기를 보내는 중에는 상신이 잠기고 그 사정을 말한다', async () => {
    withReasonCodes();

    const { requests, release, user } = renderScreen(postRoutes(), '?count=9101', [POST_PATH]);

    await registerThenPostReady(user);
    await expandPost(user);
    await postAdjustment(user);

    await waitFor(() => {
      expect(postRequests(requests)).toHaveLength(1);
    });

    expect(
      within(resultPane()).getByRole('button', { name: t.actions.requestApproval }),
    ).toBeDisabled();
    expect(within(resultPane()).getByText(t.actionReasons.submitWhilePosting)).toBeVisible();

    release();
  });

  /** 나가는 중에는 두 칸도 함께 잠근다 — 보낸 값과 화면의 값이 갈리지 않게 한다. */
  it('전기를 보내는 중에는 두 칸이 잠기고 사유가 보인다', async () => {
    withReasonCodes();

    const { requests, release, user } = renderScreen(postRoutes(), '?count=9101', [POST_PATH]);

    await registerThenPostReady(user);
    await expandPost(user);
    await postAdjustment(user);

    await waitFor(() => {
      expect(postRequests(requests)).toHaveLength(1);
    });

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );

    expect(businessDateField()).toBeDisabled();
    expect(occurredAtField()).toBeDisabled();
    expect(within(postPane()).getByText(t.actionReasons.posting)).toBeVisible();

    release();
  });
});

/**
 * ⭐⭐ **전기 실패**(C34) — 서버 문구를 **그대로** 낸다.
 *
 * ⛔ 코드 문자열로 분기하지 않는다(공유계약 G-2 · §5.2.3): 계약이 400에 붙는 `code` 값을 못
 * 박지 않았고 「승인이 끝나지 않았다」를 뜻하는 코드도 보장되지 않는다.
 */
describe('StockAdjustScreen — 전기 실패', () => {
  const postAndFail = async (
    user: ReturnType<typeof userEvent.setup>,
    requests: RecordedRequest[],
  ): Promise<void> => {
    await registerThenPostReady(user);
    await expandPost(user);
    fireEvent.change(businessDateField(), { target: { value: '2026-08-17' } });
    await postAdjustment(user);

    await waitFor(() => {
      expect(postRequests(requests)).toHaveLength(1);
    });
  };

  /** 승인 완료 전 전기가 400으로 되돌아오는 갈래(§6 · 계약이 그렇게 적었다). */
  const approvalPendingRoute = (): StubRoute =>
    failingPostRoute(400, {
      errors: [
        { scope: 'screen', code: 'SAMPLE_ERR_A', message: '승인이 끝나지 않아 전기할 수 없습니다' },
      ],
    });

  it('400이면 서버 문구가 창 안에 그대로 서고 두 값이 남는다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(
      allRoutes([etaggedCreateRoute(), detailRoute(), approvalPendingRoute()]),
    );

    await postAndFail(user, requests);

    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText('승인이 끝나지 않아 전기할 수 없습니다')).toBeVisible();

    await user.click(screen.getByRole('button', { name: t.actions.keepReviewing }));

    /* 입력이 유지된다 — 고쳐 다시 보낼 수 있어야 한다. */
    expect(businessDateField()).toHaveValue('2026-08-17');
  });

  /** 전표는 남는다 — 통째로 실패라고 말하면 사용자가 다시 만들어 전표가 두 벌 남는다. */
  it('전기가 실패해도 전표가 남았다는 사실을 말한다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(
      allRoutes([etaggedCreateRoute(), detailRoute(), approvalPendingRoute()]),
    );

    await postAndFail(user, requests);
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: t.actions.keepReviewing }));

    expect(within(postPane()).getByText(t.post.failedTitle('SAMPLE-IA-9301'))).toBeVisible();
    expect(within(resultPane()).getByText(t.result.createdTitle('SAMPLE-IA-9301'))).toBeVisible();
    expect(postButton()).toBeEnabled();
  });

  /**
   * ⭐⭐ **코드가 달라도 같은 자리에 서버 문구가 그대로 선다**(C34 · G-2).
   *
   * 코드 문자열로 갈래를 만들면 서버가 코드를 바꾸는 날 **조용히 깨진다** — 화면은 받은 것을
   * 그대로 보인다.
   */
  it.each([
    ['SAMPLE_ERR_A', '합성 거절 사유 가'],
    ['ROUTE_NOT_FOUND', '합성 거절 사유 나'],
  ])('코드가 %s이어도 서버 문구를 그대로 낸다', async (code, message) => {
    withReasonCodes();

    const { requests, user } = renderScreen(
      allRoutes([
        etaggedCreateRoute(),
        detailRoute(),
        failingPostRoute(400, { errors: [{ scope: 'screen', code, message }] }),
      ]),
    );

    await postAndFail(user, requests);

    expect(await within(screen.getByRole('dialog')).findByText(message)).toBeVisible();
  });

  /**
   * ⭐⭐ **두 칸이 대칭이다**(검증 문제 ② — 「인자 반쪽 베끼기」 지형).
   *
   * 앞 회차는 영업일 축만 태웠고, 발생 일시 쪽 걷힘을 지워도 전건 통과했다(뮤테이션 V-8 생존).
   * 그 축이 깨지면 사용자가 발생 일시를 고쳐도 **낡은 서버 문구와 `aria-invalid`가 칸에 남아**
   * 무엇을 더 고쳐야 하는지 화면이 거짓으로 말한다. 두 칸을 **같은 잣대로** 함께 문다.
   */
  it.each([
    {
      field: 'businessDate',
      message: '영업일이 마감된 기간입니다',
      fix: (): void => {
        fireEvent.change(businessDateField(), { target: { value: '2026-08-16' } });
      },
      changed: businessDateField,
    },
    {
      field: 'occurredAt',
      message: '발생 일시가 마감된 기간입니다',
      fix: (): void => {
        fireEvent.change(occurredAtField(), { target: { value: '2026-08-16T09:00' } });
      },
      changed: occurredAtField,
    },
  ])('$field 칸의 400은 그 칸에 붙고 고치면 걷힌다', async ({ field, message, fix, changed }) => {
    withReasonCodes();

    const { requests, user } = renderScreen(
      allRoutes([
        etaggedCreateRoute(),
        detailRoute(),
        failingPostRoute(400, {
          errors: [{ scope: 'field', field, code: 'SAMPLE_ERR', message }],
        }),
      ]),
    );

    await postAndFail(user, requests);
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: t.actions.keepReviewing }));

    expect(within(postPane()).getByText(message)).toBeVisible();
    expect(changed()).toHaveAttribute('aria-invalid', 'true');

    fix();

    expect(within(postPane()).queryByText(message)).not.toBeInTheDocument();
    expect(changed()).not.toHaveAttribute('aria-invalid', 'true');
  });

  /**
   * ⭐⭐ **인라인으로 소화된 실패도 실패다**(검증 문제 ①).
   *
   * 두 칸의 400은 배너가 아니라 **칸에 붙으므로**(`fieldErrors`) 배너만 보면 「아직 아무 일도
   * 없었다」로 읽힌다 — 그러면 되돌릴 수 없는 쓰기가 한 번 튕긴 사실이 화면 어디에도 남지
   * 않고, 사용자는 **전표가 남은 줄 모르고 다시 등록해 전표를 두 벌** 만든다.
   *
   * 앞 회차의 실패 시험은 전부 `scope: 'screen'`을 함께 주어 `post.error`가 참이었다 — 그래서
   * 이 축을 지워도 전건 통과했다(뮤테이션 V-7 생존). **칸 범위 하나뿐인 400**으로 문다.
   */
  it('칸 범위 하나뿐인 400에도 전표가 남았다는 사실이 선다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(
      allRoutes([
        etaggedCreateRoute(),
        detailRoute(),
        failingPostRoute(400, {
          errors: [
            {
              scope: 'field',
              field: 'businessDate',
              code: 'SAMPLE_ERR',
              message: '영업일이 마감된 기간입니다',
            },
          ],
        }),
      ]),
    );

    await postAndFail(user, requests);
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: t.actions.keepReviewing }));

    /* 짝 양성 — 그 400이 실제로 칸에만 붙었다(공통 배너 자리에는 아무것도 없다). */
    expect(within(postPane()).getByText('영업일이 마감된 기간입니다')).toBeVisible();
    expect(screen.queryByText(messages.httpError.title)).not.toBeInTheDocument();

    expect(within(postPane()).getByText(t.post.failedTitle('SAMPLE-IA-9301'))).toBeVisible();
  });

  /**
   * ⭐⭐ **응답을 받지 못한 요청은 실패가 아니다**(리뷰 R-1 Blocker · 멱등 완화의 마지막 층).
   *
   * 이 화면의 세 쓰기 가운데 **하중이 가장 크다**: 그 전기는 서버에 닿아 **이미 재고를 움직였을
   * 수 있고**, 되돌리는 경로가 이 화면에 없다. 쓰기 훅이 호출마다 새 멱등 키를 만들고 다시
   * 누르는 길이 상세 GET을 먼저 지나 **새 잠금 토큰을 앉히므로**, 두 번째 전기를 막는 것은
   * 이 안내뿐이다.
   */
  it('네트워크가 끊기면 재고가 움직였는지 알 수 없다는 사실을 말한다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(
      allRoutes([etaggedCreateRoute(), detailRoute(), offlinePostRoute()]),
    );

    await postAndFail(user, requests);

    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText(messages.httpError.offline)).toBeVisible();
    expect(within(dialog).getByText(t.post.networkUnconfirmed)).toBeVisible();

    await user.click(screen.getByRole('button', { name: t.actions.keepReviewing }));

    /* 창을 닫아도 그 사실은 구획에 남는다 — 사라지는 글자는 아무것도 막지 못한다. */
    expect(within(postPane()).getByText(t.post.networkUnconfirmed)).toBeVisible();
  });

  /**
   * ⭐⭐ **그때 「재고는 움직이지 않았습니다」를 말하지 않는다**(리뷰 R-1의 본체).
   *
   * 그 문장은 **서버가 요청을 되돌려 준 것**을 근거로 하는 말이라, 응답이 오지 않은 갈래에서는
   * 화면이 확인하지 않은 사실을 **단언**하는 것이 된다. 함께 붙은 「사정을 고쳐 다시 전기할 수
   * 있습니다」는 그 위에 **재시도를 권하기**까지 한다.
   */
  it('네트워크 갈래에서는 재고가 그대로라고 단언하지 않는다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(
      allRoutes([etaggedCreateRoute(), detailRoute(), offlinePostRoute()]),
    );

    await postAndFail(user, requests);
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: t.actions.keepReviewing }));

    /* 양성 앵커 — 그 갈래가 실제로 화면에 섰다(그 뒤에 음성 단언을 잰다). */
    expect(within(postPane()).getByText(t.post.networkUnconfirmed)).toBeVisible();

    expect(screen.queryByText(t.post.failedTitle('SAMPLE-IA-9301'))).not.toBeInTheDocument();
    expect(screen.queryByText(t.post.failedDescription)).not.toBeInTheDocument();
  });

  /**
   * ⭐ **이 안내의 본체는 여전히 금지다**(등록 축 `notes.networkUnconfirmed`와 같은 잣대).
   *
   * 재고 이중 이동을 막는 것은 확인이 아니라 **하지 않는 것**이다 — 다시 누르는 길이 상세
   * GET을 먼저 지나 **새 잠금 토큰을 앉히므로** 낙관적 잠금도 두 번째 전기를 막지 못한다.
   *
   * ✅ **앞 회차의 음성 축(「처리 이력」 0건)을 이 회차가 의도적으로 지웠다** — 이력 탭이
   * 서면서 그 자리가 실재하게 됐다.
   *
   * ⭐ **절 셋과 차례를 등록 축과 같은 형태로 잰다**(검증 문제 ① · 리뷰 R-2). 여기서는
   * ③이 한 겹 더 무겁다 — 가리키는 것이 탭 이름만이 아니라 **이력 상세가 실제로 그리는 값**
   * (전기일)이라, 그 라벨 상수를 함께 담는지까지 본다.
   */
  it('그 안내가 사실·금지·확인 자리를 그 차례로 말한다', () => {
    /* ① 사실 — 재고가 움직였는지 모른다는 것이 이 완화의 근거다. */
    expect(t.post.networkUnconfirmed).toContain('알 수 없습니다');
    /* ② 금지 — 다시 누르면 낙관적 잠금도 막지 못한다. */
    expect(t.post.networkUnconfirmed).toContain('바로 다시 전기하지 마세요');
    /* ③ 확인 자리 — 탭과 **그 탭이 실제로 그리는 값**을 함께 가리킨다. */
    expect(t.post.networkUnconfirmed).toContain(t.tabs.history);
    expect(t.post.networkUnconfirmed).toContain(t.historySummary.adjustedAt);

    const factAt = t.post.networkUnconfirmed.indexOf('알 수 없습니다');
    const banAt = t.post.networkUnconfirmed.indexOf('바로 다시 전기하지 마세요');
    const placeAt = t.post.networkUnconfirmed.indexOf(t.tabs.history);

    expect(factAt).toBeLessThan(banAt);
    expect(banAt).toBeLessThan(placeAt);
  });

  /** 짝 방향 — 서버가 거절한 요청에는 그 안내가 없다. 전달된 것이 확실하기 때문이다. */
  it('서버가 거절한 전기에는 그 안내가 없다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(
      allRoutes([etaggedCreateRoute(), detailRoute(), failingPostRoute(403)]),
    );

    await postAndFail(user, requests);
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: t.actions.keepReviewing }));

    /* 양성 앵커 — 거절 갈래가 실제로 섰고 「전표는 남았다」가 여기서는 참이다. */
    expect(within(postPane()).getByText(t.post.failedTitle('SAMPLE-IA-9301'))).toBeVisible();
    expect(screen.queryByText(t.post.networkUnconfirmed)).not.toBeInTheDocument();
  });

  /** 409는 **다시 읽으면 풀린다** — 최신 불러오기가 상세를 다시 부른다(D-14). */
  it('409면 최신 불러오기가 상세를 다시 부른다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(
      allRoutes([
        etaggedCreateRoute(),
        detailRoute(),
        failingPostRoute(409, { conflictCause: 'user', message: '합성 충돌' }),
      ]),
    );

    await postAndFail(user, requests);
    await screen.findByText(messages.conflict.user);

    const before = requestsTo(requests, DETAIL_PATH).length;

    /* 배너는 **창 안에만** 선다 — 두 자리에 두면 스크림 뒤의 사본을 누르게 된다. */
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: messages.conflict.reloadAction,
      }),
    );

    await waitFor(() => {
      expect(requestsTo(requests, DETAIL_PATH).length).toBe(before + 1);
    });

    /* 친 값이 사라지지 않는다 — 다시 전기할 길이 실제 길이어야 한다. */
    expect(businessDateField()).toHaveValue('2026-08-17');
  });
});

/**
 * ⭐⭐ **전기의 매임**(D-15 · C39) — 늦게 도착한 되먹임이 **남의 전표 위에** 서지 않는다.
 *
 * 상신과 같은 지형이되 무게가 다르다: 여기서 어긋나면 화면은 **움직이지 않은 재고를 움직였다고**
 * 말하고, 사용자는 그것을 믿고 지나간다.
 */
describe('StockAdjustScreen — 전기의 매임', () => {
  /** 전기를 보내는 중에 **배경 갱신**이 대상을 다시 세우게 한다. */
  const postThenRetarget = async (
    user: ReturnType<typeof userEvent.setup>,
    requests: RecordedRequest[],
    queryClient: ReturnType<typeof renderScreen>['queryClient'],
  ): Promise<void> => {
    await registerThenPostReady(user);
    await expandPost(user);
    await postAdjustment(user);

    await waitFor(() => {
      expect(postRequests(requests)).toHaveLength(1);
    });

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );

    await queryClient.invalidateQueries({ queryKey: stockAdjustKeys.varianceLines(9101) });

    /* 달라진 응답이 실제로 대상을 다시 세운 시점을 앵커로 잡는다(줄이 셋 → 하나). */
    await waitFor(() => {
      expect(bodyRows()).toHaveLength(1);
    });
  };

  /**
   * ⭐ **늦은 200이 남의 전표 위에 서지 않는다 — 그러나 사실은 남는다.**
   *
   * 서버에서는 **재고가 실제로 움직였다.** 감추면 사용자가 모르는 재고 이동이 남고, 지금 보고
   * 있는 대상의 결과로 세우면 시도한 적 없는 전표가 원장에 잡힌 것처럼 보인다.
   */
  it('늦게 도착한 200이 사실만 알리고 전기 결과를 세우지 않는다', async () => {
    withReasonCodes();

    const { requests, release, queryClient, user } = renderScreen(
      postRoutes([changingVarianceRoute()]),
      '?count=9101',
      [POST_PATH],
    );

    await postThenRetarget(user, requests, queryClient);

    release();

    expect(await screen.findByText(t.post.unboundPostedNote('SAMPLE-IA-9301'))).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: t.post.label })).not.toBeInTheDocument();
    expect(screen.queryByText(t.post.postedTitle('SAMPLE-IA-9301'))).not.toBeInTheDocument();
  });

  /** ⭐ **늦은 실패도 남의 전표 위에 서지 않는다.** 성공만 매고 실패를 두면 절반만 막힌다. */
  it('늦게 도착한 400이 남의 전표 위에 서지 않는다', async () => {
    withReasonCodes();

    const { requests, release, queryClient, user } = renderScreen(
      allRoutes([
        changingVarianceRoute(),
        etaggedCreateRoute(),
        detailRoute(),
        failingPostRoute(400, {
          errors: [{ scope: 'screen', code: 'SAMPLE_ERR', message: '앞 전표의 전기 거절' }],
        }),
      ]),
      '?count=9101',
      [POST_PATH],
    );

    await postThenRetarget(user, requests, queryClient);

    release();

    /* 응답이 실제로 도착한 시점의 양성 앵커 — 그 뒤에 음성 단언을 잰다. */
    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.actions.register })).toBeEnabled();
    });

    expect(screen.queryByText('앞 전표의 전기 거절')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: t.post.label })).not.toBeInTheDocument();
  });

  /**
   * ⭐ **선 뒤에 끊겨도 사실이 남는다**(읽는 자리의 파생).
   *
   * 「전기했습니다」가 선 **뒤에** 같은 effect가 초안 세션을 올리면 전기 구획이 통째로 걷힌다 —
   * 그때 영수증까지 사라지면 사용자는 **자기가 움직인 줄 모르는 재고**를 남긴다.
   */
  it('전기한 뒤 실사 차이가 달라져도 그 사실이 화면에 남는다', async () => {
    withReasonCodes();

    const { queryClient, user } = renderScreen(postRoutes([changingVarianceRoute()]));

    await registerThenPostReady(user);
    await expandPost(user);
    await postAdjustment(user);

    /* 양성 앵커 — 이 전표의 전기가 실제로 섰다. */
    await screen.findByText(t.post.postedTitle('SAMPLE-IA-9301'));

    await queryClient.invalidateQueries({ queryKey: stockAdjustKeys.varianceLines(9101) });

    await waitFor(() => {
      expect(bodyRows()).toHaveLength(1);
    });

    expect(screen.getByText(t.post.unboundPostedNote('SAMPLE-IA-9301'))).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: t.post.label })).not.toBeInTheDocument();
  });

  /**
   * ⭐⭐ **앞 전표의 전기가 새 전표 위에 서지 않는다** — 이 회차 매임의 **핵심 소비처**다.
   *
   * 배경 재조회가 초안 세션을 올리는 자리(`seedFromVarianceRef`)는 **대상을 버리는 한 문을
   * 지나지 않는다.** 그 상태에서 다시 등록하면 새 전표의 전기 자리가 서는데, 매임을 지나지
   * 않으면 **한 번도 전기한 적 없는 전표가 「전기했습니다」로 그려진다.**
   */
  it('앞 전표의 전기가 새로 등록한 전표 위에 서지 않는다', async () => {
    withReasonCodes();

    const { queryClient, user } = renderScreen(
      allRoutes([
        changingVarianceRoute(),
        twoAdjustmentsRoute(),
        detailRoute(),
        secondDetailRoute(),
        postRoute(),
        secondPostRoute(),
      ]),
    );

    await registerThenPostReady(user);
    await expandPost(user);
    await postAdjustment(user);

    /* 양성 앵커 — 첫 전표의 전기가 실제로 섰다. */
    await screen.findByText(t.post.postedTitle('SAMPLE-IA-9301'));

    /* 잠금 밖에서 도는 갱신이 대상을 다시 세운다 — 전기 매임은 거둬지지 않는다. */
    await queryClient.invalidateQueries({ queryKey: stockAdjustKeys.varianceLines(9101) });

    await waitFor(() => {
      expect(bodyRows()).toHaveLength(1);
    });

    /* 새 전표를 만든다 — 전기 자리가 그 전표로 다시 선다. */
    await submitRegister(user);
    await screen.findByText(t.result.createdTitle('SAMPLE-IA-9302'));

    const pane = await screen.findByRole('region', { name: t.post.label });

    /* 새 전표의 자리는 **접힌 채로** 선다 — 앞 전표를 위해 연 자리가 따라오지 않는다. */
    expect(within(pane).getByRole('button', { name: t.actions.togglePost })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    /*
     * ⭐ **펼쳐서 잰다.** 접힘이 성공 갈래를 가리므로, 펼치지 않고 재면 매임 가드를 통째로
     * 지운 구현에서도 통과한다(대조 뮤턴트 실측) — 재려는 것은 **매임**이지 접힘이 아니다.
     */
    await user.click(within(pane).getByRole('button', { name: t.actions.togglePost }));

    /* ⭐ 앞 전표의 전기가 이 전표 위에 서지 않는다. */
    expect(within(pane).queryByText(t.post.postedTitle('SAMPLE-IA-9302'))).not.toBeInTheDocument();
    expect(within(pane).queryByText(t.post.postedTitle('SAMPLE-IA-9301'))).not.toBeInTheDocument();
    expect(within(pane).queryByText('2026-08-18 14:05')).not.toBeInTheDocument();
    /* 새 전표는 **전기할 수 있는 상태**로 선다 — 칠 칸과 누를 버튼이 있다. */
    expect(within(pane).getByLabelText(t.post.businessDate)).toHaveValue(localToday());
    expect(within(pane).getByRole('button', { name: t.actions.post })).toBeEnabled();
  });

  /**
   * ⭐⭐ **앞 전표의 전기 실패가 새 전표 위에 서지 않는다** — 매임의 **실패 축** 소비처 셋.
   *
   * 성공만 매고 실패를 두면 절반만 막힌다: 사용자는 **한 번도 전기한 적 없는 전표**에 앞
   * 전표의 거절 사유가 붙은 화면을 보고, 그 조정이 원장에 못 갔다고 읽는다. 배너 · 실패
   * 갈래(「전표는 남았습니다」) · 칸의 서버 오류 셋이 같은 매임을 지나야 한다.
   */
  it('앞 전표의 전기 실패가 새로 등록한 전표 위에 서지 않는다', async () => {
    withReasonCodes();

    const { queryClient, user } = renderScreen(
      allRoutes([
        changingVarianceRoute(),
        twoAdjustmentsRoute(),
        detailRoute(),
        secondDetailRoute(),
        failingPostRoute(400, {
          errors: [
            { scope: 'screen', code: 'SAMPLE_ERR', message: '앞 전표의 전기 거절' },
            {
              scope: 'field',
              field: 'businessDate',
              code: 'SAMPLE_ERR',
              message: '앞 전표의 영업일 오류',
            },
          ],
        }),
      ]),
    );

    await registerThenPostReady(user);
    await expandPost(user);
    await postAdjustment(user);

    /* 짝 양성 — 두 오류가 앞 전표 위에는 실제로 섰다. */
    expect(await screen.findByText('앞 전표의 전기 거절')).toBeVisible();

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );

    expect(within(postPane()).getByText('앞 전표의 영업일 오류')).toBeVisible();
    expect(within(postPane()).getByText(t.post.failedTitle('SAMPLE-IA-9301'))).toBeVisible();

    await queryClient.invalidateQueries({ queryKey: stockAdjustKeys.varianceLines(9101) });
    await waitFor(() => {
      expect(bodyRows()).toHaveLength(1);
    });

    await submitRegister(user);
    await screen.findByText(t.result.createdTitle('SAMPLE-IA-9302'));

    const pane = await screen.findByRole('region', { name: t.post.label });

    await user.click(within(pane).getByRole('button', { name: t.actions.togglePost }));

    expect(screen.queryByText('앞 전표의 전기 거절')).not.toBeInTheDocument();
    expect(screen.queryByText('앞 전표의 영업일 오류')).not.toBeInTheDocument();
    expect(within(pane).queryByText(t.post.failedTitle('SAMPLE-IA-9302'))).not.toBeInTheDocument();
    expect(within(pane).getByLabelText(t.post.businessDate)).not.toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  /**
   * ⭐⭐ **앞 전표를 위해 확인한 두 값이 새 전표의 칸에 서지 않는다**(리뷰 R-1의 형태 · 전기 축).
   *
   * 앞 전표의 영업일이 새 전표의 칸에 남아 있으면 그대로 확인 창을 지나 **틀린 날짜로 원장에**
   * 잡힌다 — 되돌릴 수 없다. **펼침 상태도 함께 거둔다**: 남의 전표를 위해 연 자리가 새 전표
   * 위에서 이미 열린 채로 서면, 사용자가 「내가 연 자리」로 읽고 그 값을 확인한 것으로 여긴다.
   */
  it('앞 전표를 위해 확인한 영업일이 새로 등록한 전표의 칸에 서지 않는다', async () => {
    withReasonCodes();

    const { queryClient, user } = renderScreen(
      allRoutes([
        changingVarianceRoute(),
        twoAdjustmentsRoute(),
        detailRoute(),
        secondDetailRoute(),
        postRoute(),
        secondPostRoute(),
      ]),
    );

    await registerThenPostReady(user);
    await expandPost(user);

    /* 앞 전표를 위해 고치기만 하고 **보내지 않는다.** */
    fireEvent.change(businessDateField(), { target: { value: '2026-08-17' } });

    /* 양성 앵커 — 고친 값이 실제로 그 전표의 칸에 섰다. */
    expect(businessDateField()).toHaveValue('2026-08-17');

    /* 잠금 밖에서 도는 갱신이 대상을 다시 세운다 — 이 길은 거두는 문을 지나지 않는다. */
    await queryClient.invalidateQueries({ queryKey: stockAdjustKeys.varianceLines(9101) });

    await waitFor(() => {
      expect(bodyRows()).toHaveLength(1);
    });

    await submitRegister(user);
    await screen.findByText(t.result.createdTitle('SAMPLE-IA-9302'));

    const pane = await screen.findByRole('region', { name: t.post.label });

    /* 펼침이 함께 거둬졌다 — 두 칸이 아예 서지 않는다. */
    expect(within(pane).queryByLabelText(t.post.businessDate)).not.toBeInTheDocument();

    await user.click(within(pane).getByRole('button', { name: t.actions.togglePost }));

    /* 다시 펴면 **제출 순간**으로 채워진다 — 앞 전표의 값이 아니다. */
    expect(within(pane).getByLabelText(t.post.businessDate)).toHaveValue(localToday());
  });

  /**
   * ⭐ **끊긴 전기 영수증이 쌓인다 — 둘이면 둘 다 남는다**(등록·상신 축과 대칭).
   *
   * 매임은 한 자리라 **뒤이은 전기가 성공하면 앞 전표의 사실이 덮인다** — 그때 사라지는 것은
   * 「사용자가 모르는 재고 이동」의 마지막 흔적이다.
   */
  it('끊긴 전기가 둘이면 두 전표번호가 모두 남는다', async () => {
    withReasonCodes();

    const { requests, release, queryClient, user } = renderScreen(
      allRoutes([
        changingVarianceRoute(),
        twoAdjustmentsRoute(),
        detailRoute(),
        secondDetailRoute(),
        postRoute(),
        secondPostRoute(),
      ]),
      '?count=9101',
      [POST_PATH, SECOND_POST_PATH],
    );

    /* ① 전표 A를 전기하는 중에 배경 갱신이 대상을 다시 세운다. */
    await postThenRetarget(user, requests, queryClient);
    release();

    await screen.findByText(t.post.unboundPostedNote('SAMPLE-IA-9301'));

    /* ② 전표 B를 새로 등록해 같은 일을 되풀이한다. */
    await submitRegister(user);
    await screen.findByText(t.result.createdTitle('SAMPLE-IA-9302'));
    await expandPost(user);
    await postAdjustment(user);

    await waitFor(() => {
      expect(requests.filter((request) => request.url.pathname === SECOND_POST_PATH)).toHaveLength(
        1,
      );
    });

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );
    await queryClient.invalidateQueries({ queryKey: stockAdjustKeys.varianceLines(9101) });
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: t.post.label })).toBeNull();
    });

    release();

    expect(
      await screen.findByText(t.post.unboundPostedNote('SAMPLE-IA-9301, SAMPLE-IA-9302')),
    ).toBeInTheDocument();
  });

  /** 짝 방향 — 대상이 그대로면 결과가 **이 전표 위에 선다.** 「늘 감춘다」로 통과하지 않게 한다. */
  it('대상이 그대로면 전기했다는 사실이 전기 구획에 선다', async () => {
    withReasonCodes();

    const { user } = renderScreen(postRoutes());

    await registerThenPostReady(user);
    await expandPost(user);
    await postAdjustment(user);

    expect(await screen.findByText(t.post.postedTitle('SAMPLE-IA-9301'))).toBeInTheDocument();
    expect(screen.queryByText(t.post.unboundPostedNote('SAMPLE-IA-9301'))).not.toBeInTheDocument();
  });
});

/* ────────────────────────────────────────────────────────────────────────────
 * 처리 이력 — **보낸 것을 되찾는 자리**
 * ──────────────────────────────────────────────────────────────────────────── */

const ADJUSTMENT_DETAIL_PATH = '/inventory/adjustments/9302';

const historyPane = (): HTMLElement => screen.getByRole('region', { name: t.panes.history });

const historyDetailPane = (): HTMLElement =>
  screen.getByRole('region', { name: t.panes.historyDetail });

const adjustmentsRoute = (items: unknown[] = adjustmentListFixtures, total?: number): StubRoute =>
  getRoute(ADJUSTMENTS_PATH, items, total);

const adjustmentDetailRoute = (
  body: unknown = adjustmentDetailBody({ lineCount: 2 }),
): StubRoute => ({
  match: (request) => isGet(request, ADJUSTMENT_DETAIL_PATH),
  respond: () => jsonResponse(body),
});

const missingDetailRoute = (): StubRoute => ({
  match: (request) => isGet(request, ADJUSTMENT_DETAIL_PATH),
  respond: () => jsonResponse({ message: '' }, { status: 404 }),
});

const historyRoutes = (overrides: StubRoute[] = []): StubRoute[] =>
  allRoutes([...overrides, adjustmentsRoute(), adjustmentDetailRoute()]);

const historyTab = (): HTMLElement => screen.getByRole('tab', { name: t.tabs.history });

const openHistoryTab = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(historyTab());
  await screen.findByRole('region', { name: t.panes.history });
};

const historyRows = (): HTMLElement[] =>
  within(within(historyPane()).getByRole('table')).getAllByRole('row').slice(1);

const historyCells = (rowIndex: number): string[] =>
  within(historyRows()[rowIndex] ?? document.createElement('tr'))
    .getAllByRole('cell')
    .map((cell) => cell.textContent ?? '');

const adjustmentRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter(
    (request) => request.method === 'GET' && request.url.pathname === ADJUSTMENTS_PATH,
  );

/**
 * ⛔ **탭이 둘이다**(조심 ① · D-3 · C40).
 *
 * 승인 대기 탭을 두지 않는다 — 승인·반려는 결재함(W-CO-09)이 소유한다.
 */
describe('StockAdjustScreen — 탭', () => {
  it('탭이 둘이고 셋째 자리가 없다', async () => {
    const { user } = renderScreen(historyRoutes());

    await waitForCounts();

    const tabs = screen.getAllByRole('tab');

    expect(tabs.map((tab) => tab.textContent ?? '')).toEqual([t.tabs.register, t.tabs.history]);

    await openHistoryTab(user);

    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  /** 승인 대기 탭이 이름으로도 되살아나지 않는다 — 양성 앵커 뒤에 잰다. */
  it('승인 대기 탭이 없다', async () => {
    renderScreen(historyRoutes());

    await waitForCounts();

    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.textContent ?? '').not.toContain('승인');
      expect(tab.textContent ?? '').not.toContain('대기');
    }
  });

  it('처음 열면 조정 등록 탭이 서고 이력 구획은 렌더되지 않는다', async () => {
    renderScreen(historyRoutes());

    await waitForCounts();

    expect(screen.getByRole('region', { name: t.panes.source })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: t.panes.history })).not.toBeInTheDocument();
  });

  /**
   * ⭐ **숨은 탭의 내용은 DOM에도 없다.**
   *
   * 디자인 시스템 `Tabs`는 패널을 전부 렌더하고 비활성만 감춘다 — **역할 질의는 감춰진 것을
   * 건너뛰므로**(접근성 트리에서 빠진다) 「구획이 없다」만 재면 두 패널에 내용을 담은 형태가
   * 그대로 통과한다. 글자 질의는 감춰진 노드도 잡으므로 **그쪽으로 잰다**: 같은 뜻의 안내가
   * 두 벌 서면 이름으로 집는 조작이 어느 것을 집을지 갈린다.
   */
  it('숨은 탭의 내용은 DOM에도 서지 않는다', async () => {
    const { user } = renderScreen(historyRoutes());

    await waitForCounts();

    expect(screen.queryByText(t.historyFilters.periodNote)).not.toBeInTheDocument();

    await openHistoryTab(user);

    expect(screen.getByText(t.historyFilters.periodNote)).toBeInTheDocument();
    expect(screen.queryByText(t.notes.actualDerived)).not.toBeInTheDocument();
  });

  /** 주소가 정본이다 — 공유한 주소가 같은 탭을 연다. */
  it('주소가 이력 탭을 가리키면 그 탭이 선다', async () => {
    renderScreen(historyRoutes(), '?tab=history');

    expect(await screen.findByRole('region', { name: t.panes.history })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: t.panes.source })).not.toBeInTheDocument();
  });

  /**
   * 주소는 손으로 고쳐지는 자리다 — 모르는 값에 아무 탭도 서지 않으면 고장으로 읽힌다.
   *
   * **없는 탭 이름(`approval`)으로 재는 것이 요점이다** — 그 값이 살아남으면 승인 대기 자리를
   * 주소로 켜는 길이 생긴다.
   */
  it('모르는 탭 값이면 조정 등록 탭이 선다', async () => {
    renderScreen(historyRoutes(), '?count=9101&tab=approval');

    await waitForCounts();

    expect(screen.getByRole('region', { name: t.panes.source })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: t.panes.history })).not.toBeInTheDocument();
  });

  /** C45 — 탭이 주소에 실리고 뒤로가기가 한 칸이다. */
  it('탭 전환이 주소에 실리고 뒤로가기가 한 칸이다', async () => {
    const { user } = renderScreen(historyRoutes());

    await waitForCounts();
    await openHistoryTab(user);
    await waitForLocation(`${ROUTE}?count=9101&tab=history`);

    await user.click(screen.getByRole('button', { name: '뒤로' }));
    await waitForLocation(`${ROUTE}?count=9101`);

    expect(screen.getByRole('region', { name: t.panes.source })).toBeInTheDocument();
  });

  /** 기본 탭은 주소에 적지 않는다 — 같은 화면의 주소가 두 가지가 되지 않게. */
  it('등록 탭으로 돌아오면 주소에서 탭 값이 사라진다', async () => {
    const { user } = renderScreen(historyRoutes());

    await waitForCounts();
    await openHistoryTab(user);
    await user.click(screen.getByRole('tab', { name: t.tabs.register }));

    await waitForLocation(`${ROUTE}?count=9101`);
  });

  /**
   * ⭐ **탭은 보는 자리를 바꿀 뿐 대상을 바꾸지 않는다.** 이력을 잠깐 확인하고 돌아왔을 때
   * 세우던 초안이 사라지면 「보내 놓고 이력에서 확인한다」가 성립하지 않는다.
   */
  it('탭을 오갔다 와도 세우던 조정 대상이 그대로다', async () => {
    const { user } = renderScreen(historyRoutes());

    await loadVariance(user);
    await user.clear(diffBox(1));
    await user.type(diffBox(1), '-7');

    await openHistoryTab(user);
    await user.click(screen.getByRole('tab', { name: t.tabs.register }));

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(diffBox(1)).toHaveValue('-7');
  });

  /** 두 탭에 함께 걸리는 사실은 탭 위에 선다(C42 · C13). */
  it('결재함 안내와 범위 안내가 두 탭에서 모두 선다', async () => {
    const { user } = renderScreen(historyRoutes());

    await waitForCounts();

    expect(screen.getByText(t.approvalNotice.description)).toBeVisible();
    expect(screen.getByText(t.scope.description)).toBeVisible();

    await openHistoryTab(user);

    expect(screen.getByText(t.approvalNotice.description)).toBeVisible();
    expect(screen.getByText(t.scope.description)).toBeVisible();
  });

  /**
   * ⭐ **확인 창은 자기 탭에서만 선다**(구현 판단 5 · 리뷰 R-3).
   *
   * 확인 창은 탭 패널 **밖**(페이지 수준)에 있어, 탭 조건이 없으면 이력 탭 위에 등록 확인 창이
   * 그대로 선다 — **보이지 않는 자리의 값을 확인하는 창**이 된다. 닿는 경로는 창이 열린 채
   * **뒤로/앞으로**로 탭 질의가 바뀌는 자리다(핸들러를 지나지 않는다).
   *
   * **두 방향을 한 시험이 잰다** — 사라지는 쪽과 되돌아오는 쪽. 뒤엣것까지 재야 「표시를 지우지
   * 않는다」(그 조작이 취소된 것은 아니다)가 함께 고정된다.
   */
  it('확인 창을 연 채 탭이 바뀌면 그 창이 서지 않고 돌아오면 다시 선다', async () => {
    withReasonCodes();

    const { user } = renderScreen(historyRoutes());

    await readyToRegister(user);
    await user.click(registerButton());

    /* 양성 앵커 — 등록 탭에서 그 창이 실제로 섰다. */
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await openHistoryTab(user);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    /* 표시를 지우지 않았으므로 되돌아오면 같은 창이 다시 선다. */
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: new RegExp(t.actions.confirmRegister) }),
    ).toBeEnabled();
  });
});

/**
 * ⛔ **C41 — 이력 탭의 모든 조회 요청 URL에 `pendingApprovalOnly`가 0건이다.**
 *
 * 계약에 그 조건이 **남아 있어서** 어딘가에서 실릴 수 있다 — 뮤테이션 M-4가 겨누는 자리다.
 */
describe('StockAdjustScreen — 이력 조회', () => {
  it('이력 탭이 서면 목록을 부르고 등록 탭에서는 부르지 않는다', async () => {
    const { requests, user } = renderScreen(historyRoutes());

    await waitForCounts();

    expect(adjustmentRequests(requests)).toHaveLength(0);

    await openHistoryTab(user);

    await waitFor(() => {
      expect(adjustmentRequests(requests)).toHaveLength(1);
    });
  });

  it('조건 없이 첫 조회가 나간다 — 무엇이 있는지 먼저 보인다', async () => {
    const { requests, user } = renderScreen(historyRoutes());

    await waitForCounts();
    await openHistoryTab(user);

    await waitFor(() => {
      expect(adjustmentRequests(requests)).toHaveLength(1);
    });

    expect([...(adjustmentRequests(requests)[0]?.url.searchParams.keys() ?? [])]).toEqual([]);
  });

  /** ⛔ C41 — 조건을 걸어도 그 문자열이 URL에 서지 않는다. */
  it('이력 탭의 모든 요청 URL에 승인 대기 조건이 0건이다', async () => {
    const { requests, user } = renderScreen(historyRoutes());

    await waitForCounts();
    await openHistoryTab(user);

    await user.click(within(historyPane()).getByLabelText(t.historyFields.count));
    await user.click(screen.getByRole('option', { name: COUNT_LABEL }));
    await user.click(within(historyPane()).getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(adjustmentRequests(requests)).toHaveLength(2);
    });

    for (const request of requests) {
      expect(request.url.search).not.toContain('pendingApprovalOnly');
    }
  });

  it('고른 조건이 계약 이름으로 실리고 주소에도 남는다', async () => {
    const { requests, user } = renderScreen(historyRoutes());

    await waitForCounts();
    await openHistoryTab(user);

    await user.click(within(historyPane()).getByLabelText(t.historyFields.count));
    await user.click(screen.getByRole('option', { name: COUNT_LABEL }));
    await user.click(within(historyPane()).getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(adjustmentRequests(requests)).toHaveLength(2);
    });

    expect(adjustmentRequests(requests)[1]?.url.searchParams.get('inventoryCountId')).toBe('9101');
    await waitForLocation(`${ROUTE}?count=9101&tab=history&hc=9101`);
  });

  /**
   * ⭐ **사유 조건이 실제로 실린다**(#36 회신 · D-9 개정).
   *
   * 앞 회차에는 이 경로를 화면 수준에서 잴 수 없었다 — 고를 값이 하나도 없어 **조건을 고르는
   * 걸음 자체가 없었다.** 목록이 살아난 지금 그 걸음이 생겼고, 여기서 끊기면 사용자가 고른
   * 조건이 조용히 버려진다.
   */
  it('고른 사유가 계약 이름으로 요청에 실리고 주소에도 남는다', async () => {
    withReasonCodes();

    const { requests, user } = renderScreen(historyRoutes());

    await waitForCounts();
    await openHistoryTab(user);

    await user.click(within(historyPane()).getByLabelText(t.historyFields.reason));
    await user.click(await screen.findByRole('option', { name: SAMPLE_REASON_LABEL }));
    await user.click(within(historyPane()).getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(adjustmentRequests(requests)).toHaveLength(2);
    });

    expect(adjustmentRequests(requests)[1]?.url.searchParams.get('reasonCode')).toBe(SAMPLE_REASON);
    await waitForLocation(`${ROUTE}?count=9101&tab=history&hrs=${SAMPLE_REASON}`);
  });

  /**
   * ⚠ **상태는 그대로 기다린다**(#36 회신 ⚠). 조정 상태·문서 유형은 전이·분기가 걸려 설계가
   * 정해서 내려 준다 — 사유가 살아났다고 그 둘까지 함께 걷으면 값을 지어내게 된다.
   *
   * 사유 칸과 **나란히** 잰다. 한쪽만 재면 둘이 같은 처리로 되돌아가도 잡히지 않는다.
   */
  it('상태 칸은 자리표시 그대로다 — 사유 칸과 갈린다', async () => {
    withReasonCodes();

    const { user } = renderScreen(historyRoutes());

    await waitForCounts();
    await openHistoryTab(user);

    const bar = historyPane();

    await waitFor(() => {
      expect(within(bar).getByText(t.historyFilters.codePending)).toBeVisible();
    });

    /* 「준비 중」은 하나뿐이다 — 사유 칸에 되살아나면 둘이 된다. */
    expect(within(bar).getAllByText(t.historyFilters.codePending)).toHaveLength(1);
    expect(within(bar).getByLabelText(t.historyFields.status)).toHaveTextContent(
      t.historyFilters.codePlaceholder,
    );
    expect(within(bar).getByLabelText(t.historyFields.reason)).toHaveTextContent(
      t.historyFilters.all,
    );
  });

  /** C45 — 조건을 바꿔도 뒤로가기가 한 칸이다(조건과 쪽을 한 번에 갱신한다). */
  it('조건 적용 뒤 뒤로가기가 한 칸이다', async () => {
    const { user } = renderScreen(historyRoutes());

    await waitForCounts();
    await openHistoryTab(user);

    await user.click(within(historyPane()).getByLabelText(t.historyFields.count));
    await user.click(screen.getByRole('option', { name: COUNT_LABEL }));
    await user.click(within(historyPane()).getByRole('button', { name: messages.common.search }));

    await waitForLocation(`${ROUTE}?count=9101&tab=history&hc=9101`);

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitForLocation(`${ROUTE}?count=9101&tab=history`);
  });

  it('쪽을 옮기면 요청과 주소에 그 쪽이 실린다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([adjustmentsRoute(adjustmentListFixtures, 120), adjustmentDetailRoute()]),
    );

    await waitForCounts();
    await openHistoryTab(user);

    await user.click(await screen.findByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(adjustmentRequests(requests)).toHaveLength(2);
    });

    expect(adjustmentRequests(requests)[1]?.url.searchParams.get('page')).toBe('2');
    await waitForLocation(`${ROUTE}?count=9101&tab=history&hpage=2`);
  });

  it('조회가 실패하면 사유와 복구 경로가 선다 — 빈 상태로 보이지 않는다', async () => {
    const { user } = renderScreen(allRoutes([failingRoute(ADJUSTMENTS_PATH, 500)]));

    await waitForCounts();
    await openHistoryTab(user);

    expect(await screen.findByText(messages.httpError.loadTitle)).toBeVisible();
    expect(screen.queryByText(t.empty.historyNoResultTitle)).not.toBeInTheDocument();
  });
});

/**
 * ⭐ **C43 — 실사 참조가 없는 줄은 「—」이고 경고 표식이 붙지 않는다.**
 * 원천이 셋이고 그중 둘(현장 실측 · 직접 등록)은 실사를 거치지 않는 정상 경로다.
 */
describe('StockAdjustScreen — 이력 목록의 줄', () => {
  it('실사 참조가 있는 줄은 이름으로, 없는 줄은 「—」로 선다', async () => {
    const { user } = renderScreen(historyRoutes());

    await waitForCounts();
    await openHistoryTab(user);

    await waitFor(() => {
      expect(historyRows()).toHaveLength(3);
    });

    expect(historyCells(1)[1]).toBe(COUNT_LABEL);
    expect(historyCells(0)[1]).toBe(t.values.empty);
  });

  it('실사 참조가 없는 줄에 경고 표식이 붙지 않는다', async () => {
    const { user } = renderScreen(historyRoutes());

    await waitForCounts();
    await openHistoryTab(user);

    await waitFor(() => {
      expect(historyRows()).toHaveLength(3);
    });

    const row = historyRows()[0] ?? document.createElement('tr');

    expect(within(row).queryAllByRole('alert')).toHaveLength(0);
    expect(within(row).getAllByRole('cell')[1]?.textContent).not.toBe(t.values.unknown);
  });

  /** 전기 여부의 판정 근거가 **전기 시각의 유무 하나다**(C35 · D-13). */
  it('전기되지 않은 줄은 「전기 전」으로 선다', async () => {
    const { user } = renderScreen(historyRoutes());

    await waitForCounts();
    await openHistoryTab(user);

    await waitFor(() => {
      expect(historyRows()).toHaveLength(3);
    });

    expect(historyCells(0)[4]).toBe(t.historyTable.notPosted);
    expect(historyCells(1)[4]).toBe('2026-08-18 14:05');
  });

  /** ⛔ C42 — 이력 탭 어디에도 승인·반려 조작이 없다(양성 앵커 뒤에 잰다). */
  it('이력 탭에 승인·반려 조작이 0건이다', async () => {
    const { user } = renderScreen(historyRoutes());

    await waitForCounts();
    await openHistoryTab(user);

    await waitFor(() => {
      expect(historyRows()).toHaveLength(3);
    });

    for (const button of screen.getAllByRole('button')) {
      const name = button.getAttribute('aria-label') ?? button.textContent ?? '';

      expect(name).not.toContain('승인');
      expect(name).not.toContain('반려');
    }
  });
});

/**
 * ⭐ **C44 — 상세를 열면 요청 한 번으로 머리와 라인이 함께 서고, 라인이 세 열로 보인다.**
 */
describe('StockAdjustScreen — 이력 상세', () => {
  const selectSecondRow = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
    await user.click(
      await screen.findByRole('button', {
        name: t.actions.selectAdjustmentRow('SAMPLE-IA-9302'),
      }),
    );
  };

  it('고르기 전에는 무엇을 하면 되는지 말한다', async () => {
    const { user } = renderScreen(historyRoutes());

    await waitForCounts();
    await openHistoryTab(user);

    expect(within(historyDetailPane()).getByText(t.empty.historyNoSelectionTitle)).toBeVisible();
  });

  it('고르면 상세 한 번으로 머리와 라인이 함께 선다', async () => {
    const { requests, user } = renderScreen(historyRoutes());

    await waitForCounts();
    await openHistoryTab(user);
    await selectSecondRow(user);

    expect(
      await within(historyDetailPane()).findByRole('group', { name: t.historySummary.label }),
    ).toBeInTheDocument();

    expect(
      requests.filter((request) => request.url.pathname === ADJUSTMENT_DETAIL_PATH),
    ).toHaveLength(1);
    expect(requests.filter((request) => request.url.pathname.endsWith('/lines'))).toHaveLength(0);
  });

  /**
   * ⭐ **404가 아닌 실패는 사유와 복구 경로를 낸다**(리뷰 R-1 · 사본원 `stocktaking`의 갈래).
   *
   * 이 판정이 로딩보다 **뒤**에 서면 `data === undefined` 하나가 실패를 삼켜 **영원한
   * 「불러오는 중」**이 된다 — 앱의 조회 기본값이 `retry: 0`이라 그것은 재시도 중인 상태가
   * 아니라 정착한 실패다. 양성 앵커(사유 배너가 실제로 섰다) 뒤에 「로딩 뼈대가 없다」를 잰다.
   *
   * **목록 축의 같은 감지기와 짝이다** — 두 구획의 규칙이 갈리지 않는지 함께 본다.
   */
  it('상세가 500으로 실패하면 사유와 다시 시도가 서고 로딩 뼈대가 남지 않는다', async () => {
    const { user } = renderScreen(
      allRoutes([adjustmentsRoute(), failingRoute(ADJUSTMENT_DETAIL_PATH, 500)]),
    );

    await waitForCounts();
    await openHistoryTab(user);
    await selectSecondRow(user);

    expect(
      await within(historyDetailPane()).findByText(messages.httpError.loadTitle),
    ).toBeVisible();
    expect(
      within(historyDetailPane()).getByRole('button', { name: messages.common.retry }),
    ).toBeEnabled();

    expect(
      screen.queryByRole('status', { name: t.loading.adjustmentDetail }),
    ).not.toBeInTheDocument();
    expect(
      within(historyDetailPane()).queryByRole('group', { name: t.historySummary.label }),
    ).not.toBeInTheDocument();
  });

  /** 응답이 오지 않은 갈래도 같은 자리로 간다 — 「끊겼다」가 「불러오는 중」으로 읽히면 안 된다. */
  it('상세가 네트워크로 끊겨도 사유와 다시 시도가 선다', async () => {
    const { user } = renderScreen(
      allRoutes([
        adjustmentsRoute(),
        {
          match: (request: Request) => isGet(request, ADJUSTMENT_DETAIL_PATH),
          respond: () => {
            throw new TypeError('Failed to fetch');
          },
        },
      ]),
    );

    await waitForCounts();
    await openHistoryTab(user);
    await selectSecondRow(user);

    expect(await within(historyDetailPane()).findByText(messages.httpError.offline)).toBeVisible();
    expect(
      screen.queryByRole('status', { name: t.loading.adjustmentDetail }),
    ).not.toBeInTheDocument();
  });

  /** 「다시 시도」가 실제로 그 전표를 다시 부른다 — 눌러도 아무 일이 없으면 복구가 아니다. */
  it('다시 시도가 그 전표의 상세를 다시 부른다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([adjustmentsRoute(), failingRoute(ADJUSTMENT_DETAIL_PATH, 500)]),
    );

    await waitForCounts();
    await openHistoryTab(user);
    await selectSecondRow(user);

    await within(historyDetailPane()).findByText(messages.httpError.loadTitle);

    await user.click(
      within(historyDetailPane()).getByRole('button', { name: messages.common.retry }),
    );

    await waitFor(() => {
      expect(
        requests.filter((request) => request.url.pathname === ADJUSTMENT_DETAIL_PATH),
      ).toHaveLength(2);
    });
  });

  /**
   * 짝 방향 — **404는 배너로 가지 않는다.** 그것은 다시 시도로 풀리지 않고 주소 정리가 맡는다.
   * 이 짝이 없으면 「모든 실패를 배너로」가 통과하고, 없는 전표에 「다시 시도」가 붙는다.
   */
  it('404는 배너가 아니라 찾을 수 없다는 안내로 간다', async () => {
    renderScreen(allRoutes([adjustmentsRoute(), missingDetailRoute()]), '?tab=history&ia=9302');

    expect(await screen.findByText(t.empty.historyNotFoundTitle)).toBeVisible();
    expect(
      within(historyDetailPane()).queryByRole('button', { name: messages.common.retry }),
    ).not.toBeInTheDocument();
  });

  /**
   * ⭐ **이 구획의 참조는 셋뿐이다**(구현 판단 7 · 리뷰 R-4).
   *
   * 위치 조회는 **등록 탭의 것**이고 이 구획에는 위치 열이 없다 — 넷으로 판정하면 **있지도
   * 않은 참조의 실패**로 안내가 서고, 복구를 눌러도 이 표에는 아무 변화가 없다.
   *
   * 양성 앵커(상세 표가 실제로 섰다) 뒤에 「그 안내가 없다」를 잰다.
   */
  it('등록 탭의 위치 조회만 실패한 상태에서는 이력 상세에 참조 안내가 서지 않는다', async () => {
    const { user } = renderScreen(
      allRoutes([failingRoute(LOCATIONS_PATH, 500), adjustmentsRoute(), adjustmentDetailRoute()]),
    );

    await waitForCounts();
    await openHistoryTab(user);
    await selectSecondRow(user);

    expect(await within(historyDetailPane()).findByRole('table')).toBeInTheDocument();
    expect(
      within(historyDetailPane()).queryByText(t.reasons.historyReferencesFailed),
    ).not.toBeInTheDocument();
    expect(
      within(historyDetailPane()).queryByText(t.reasons.lineReferencesFailed),
    ).not.toBeInTheDocument();
  });

  /** 짝 양성 — **셋 중 하나가 실패하면** 그 안내와 복구가 함께 선다. 「늘 침묵」으로 통과하지 않게. */
  it('품목 조회가 실패하면 이력 상세에 사유와 복구가 함께 선다', async () => {
    const { user } = renderScreen(
      allRoutes([failingRoute(ITEMS_PATH, 500), adjustmentsRoute(), adjustmentDetailRoute()]),
    );

    await waitForCounts();
    await openHistoryTab(user);
    await selectSecondRow(user);

    expect(
      await within(historyDetailPane()).findByText(t.reasons.historyReferencesFailed),
    ).toBeVisible();
    expect(
      within(historyDetailPane()).getByRole('button', { name: messages.common.retry }),
    ).toBeEnabled();
  });

  /** ⭐ 세 열이 그대로 선다 — 차이가 결과 수량으로 읽히지 않게 하는 자리다. */
  it('라인이 장부·실물·차이 세 열로 서고 장부·실물은 「—」다', async () => {
    const { user } = renderScreen(historyRoutes());

    await waitForCounts();
    await openHistoryTab(user);
    await selectSecondRow(user);

    const table = await within(historyDetailPane()).findByRole('table');
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((header) => header.textContent ?? '');

    expect(headers).toEqual([
      t.historyLineTable.lineNo,
      t.historyLineTable.item,
      t.historyLineTable.lot,
      t.historyLineTable.bookQty,
      t.historyLineTable.actualQty,
      t.historyLineTable.adjustmentQty,
    ]);

    const cells = within(within(table).getAllByRole('row')[1] ?? document.createElement('tr'))
      .getAllByRole('cell')
      .map((cell) => cell.textContent ?? '');

    expect(cells[5]).toContain('-20');
    expect(cells[3]).toBe(t.values.empty);
    expect(cells[4]).toBe(t.values.empty);
    expect(within(historyDetailPane()).getByText(t.historyLineTable.qtyNote)).toBeVisible();
  });

  it('고른 전표가 주소에 실린다 — 새로고침해도 같은 전표가 열린다', async () => {
    const { user } = renderScreen(historyRoutes());

    await waitForCounts();
    await openHistoryTab(user);
    await selectSecondRow(user);

    await waitForLocation(`${ROUTE}?count=9101&tab=history&ia=9302`);
  });

  /** 조건이 바뀌면 그 전표가 새 결과에 없을 수 있다 — 함께 풀린다. */
  it('조건을 바꾸면 고른 전표가 함께 풀린다', async () => {
    const { user } = renderScreen(historyRoutes());

    await waitForCounts();
    await openHistoryTab(user);
    await selectSecondRow(user);
    await waitForLocation(`${ROUTE}?count=9101&tab=history&ia=9302`);

    await user.click(within(historyPane()).getByLabelText(t.historyFields.count));
    await user.click(screen.getByRole('option', { name: COUNT_LABEL }));
    await user.click(within(historyPane()).getByRole('button', { name: messages.common.search }));

    await waitForLocation(`${ROUTE}?count=9101&tab=history&hc=9101`);
    expect(within(historyDetailPane()).getByText(t.empty.historyNoSelectionTitle)).toBeVisible();
  });

  /**
   * 없는 전표를 가리키면 주소에서 지우고 **그 사실을 남긴다** — 지우고 나면 「아직 고르지
   * 않았다」와 글자가 같아져 사용자가 자기가 무엇을 눌렀는지 되짚을 수 없다.
   */
  it('없는 전표를 가리키면 주소에서 지우고 그 사실을 밝힌다', async () => {
    renderScreen(allRoutes([adjustmentsRoute(), missingDetailRoute()]), '?tab=history&ia=9302');

    expect(await screen.findByText(t.empty.historyNotFoundTitle)).toBeVisible();
    await waitForLocation(`${ROUTE}?tab=history`);
  });

  /** 사본 체크리스트 1번 — 정리가 뒤로가기 기록을 늘리지 않는다. */
  it('그 정리가 뒤로가기 기록을 늘리지 않는다', async () => {
    const { user } = renderScreen(
      allRoutes([adjustmentsRoute(), missingDetailRoute()]),
      '?tab=history&ia=9302',
    );

    await screen.findByText(t.empty.historyNotFoundTitle);
    await waitForLocation(`${ROUTE}?tab=history`);

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    expect(currentLocation()).not.toContain('ia=9302');
  });
});

/**
 * ⭐ **묶음 재판단** — 이력 탭이 서면서 앞 회차들이 「그때 다시 본다」로 넘긴 자리들.
 *
 * | 넘긴 것 | 이 회차의 판정 |
 * | --- | --- |
 * | 네트워크 미확인 안내 둘 | **가리킬 자리가 생겼다** — 문구를 갱신하고 그 탭이 실재함을 잰다 |
 * | 매임 끊긴 성공의 지속성 | **이력이 대신한다** — 문구가 그 자리를 가리킨다 |
 * | 성공/실패 비대칭 | **닫는다** — 응답 없음 갈래도 사실을 말한다 |
 */
describe('StockAdjustScreen — 이력이 대신하는 자리', () => {
  it('매임이 끊긴 성공의 안내가 이력 탭을 가리킨다', () => {
    expect(t.result.unboundCreatedNote('SAMPLE-IA-9301')).toContain(t.tabs.history);
    expect(t.result.unboundSubmittedNote('SAMPLE-IA-9301')).toContain(t.tabs.history);
    expect(t.post.unboundPostedNote('SAMPLE-IA-9301')).toContain(t.tabs.history);
  });

  /**
   * ⛔ **잔액 낡음만 이력을 가리키지 않는다.** 계약의 조정 라인에 장부가 없어 이력 상세가 그
   * 낡음을 풀어 주지 못한다 — 가리키면 그 지시가 곧 죽은 문구가 된다.
   *
   * **양성 앵커를 같은 시점에 둔다**(리뷰 R-6). 음성 하나만 두면 그 문구가 **빈 문자열이 돼도**
   * 통과한다 — 짝 양성이 다른 `it`에 있으면 도구가 그 짝을 보장하지 않는다.
   */
  it('전기 뒤 장부 낡음 안내는 사실을 말하되 이력을 가리키지 않는다', () => {
    expect(t.post.bookQtyStale).toContain('등록할 때 받은 값');
    expect(t.post.bookQtyStale).not.toContain(t.tabs.history);
  });
});
