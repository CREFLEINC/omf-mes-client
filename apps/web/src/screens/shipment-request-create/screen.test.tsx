import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { SessionProvider, type Session } from '../../patterns/session';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import {
  businessUnitFixtures,
  itemFixtures,
  plantFixtures,
  warehouseFixtures,
  partnerFixtures,
  salesOrderDetailFixture,
  salesOrderListFixtures,
  uomFixtures,
} from './fixtures';
import { ShipmentRequestCreateScreen } from './screen';

const t = messages.shipmentRequestCreate;

const LIST_PATH = '/logistics/sales-orders';
const DETAIL_PATH = '/logistics/sales-orders/8101';
const PARTNERS_PATH = '/mdm/partners';
const ITEMS_PATH = '/mdm/items';
const UOMS_PATH = '/mdm/uoms';
const BALANCES_PATH = '/inventory/balances';
const CODE_VALUES_PATH = '/mdm/code-values';

/** 품목 유형 선택지 — 화면이 값 목록을 갖지 않는다(공유계약 G-32). 서버가 준 것을 그대로 쓴다. */
const itemTypeFixtures = [
  { code: 'FINISHED', codeName: '제품' },
  { code: 'RAW_MATERIAL', codeName: '원자재' },
];

const ROUTE = '/shipment/shipment-request-create';

/** 피처 012 — 계정 범위가 사업부 X 하나인 세션(사업부 자동 채움 · US1-1). */
const ONE_BU_SESSION: Session = { ...SYNTHETIC_SESSION, scopes: [{ businessUnitId: 7001 }] };
/** 사업부 X·Y 둘 — 고르기 전엔 빈 칸(US1-2). */
const TWO_BU_SESSION: Session = {
  ...SYNTHETIC_SESSION,
  scopes: [{ businessUnitId: 7001 }, { businessUnitId: 7002 }],
};

/** 세션을 심어 화면을 세운다 — 사업부·창고 선택지가 계정 범위를 따른다(피처 012). */
const renderScreen = (
  options: { fetch: ReturnType<typeof createStubFetch>; route?: string },
  session: Session = ONE_BU_SESSION,
) =>
  renderWithProviders(
    <SessionProvider>
      <ShipmentRequestCreateScreen />
    </SessionProvider>,
    { ...options, route: options.route ?? ROUTE, session },
  );

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const listBody = (items: unknown[]) => ({
  items,
  page: { page: 1, size: 50, total: items.length },
});

/** 이 화면이 부르는 참조 조회 전부에 응답하는 기본 경로 목록. */
const baseRoutes = (): StubRoute[] => [
  {
    match: (request) => isGet(request, '/mdm/business-units'),
    respond: () => jsonResponse(listBody(businessUnitFixtures)),
  },
  {
    match: (request) => isGet(request, '/mdm/plants'),
    respond: () => jsonResponse(listBody(plantFixtures)),
  },
  {
    match: (request) => isGet(request, '/mdm/warehouses'),
    respond: () => jsonResponse(listBody(warehouseFixtures)),
  },
  {
    match: (request) => isGet(request, LIST_PATH),
    respond: () => jsonResponse(listBody(salesOrderListFixtures)),
  },
  {
    match: (request) => isGet(request, DETAIL_PATH),
    respond: () => jsonResponse(salesOrderDetailFixture),
  },
  {
    match: (request) => isGet(request, PARTNERS_PATH),
    respond: () => jsonResponse(listBody(partnerFixtures)),
  },
  {
    match: (request) => isGet(request, ITEMS_PATH),
    respond: (request) => {
      const term = new URL(request.url).searchParams.get('q');

      /* 검색어가 있을 때만 결과를 준다 — 서버처럼 «거른» 것을 돌려준다. */
      return jsonResponse(
        listBody(
          term === null
            ? itemFixtures
            : itemFixtures.filter(
                (item) => item.itemCode.includes(term) || item.itemName.includes(term),
              ),
        ),
      );
    },
  },
  /* 품목 이름은 번호 하나씩 푼다 — 목록 첫 쪽에 기대지 않는다. 상세는 봉투로 온다. */
  {
    match: (request) =>
      request.method === 'GET' && /^\/mdm\/items\/\d+$/u.test(new URL(request.url).pathname),
    respond: (request) => {
      const itemId = Number(new URL(request.url).pathname.split('/').at(-1));
      const found = itemFixtures.find((item) => item.itemId === itemId);

      return found === undefined
        ? jsonResponse({ message: '없는 품목' }, { status: 404 })
        : jsonResponse({ item: found, editability: {} });
    },
  },
  {
    match: (request) => isGet(request, CODE_VALUES_PATH),
    respond: () => jsonResponse(listBody(itemTypeFixtures)),
  },
  {
    match: (request) => isGet(request, UOMS_PATH),
    respond: () => jsonResponse(listBody(uomFixtures)),
  },
  {
    match: (request) => isGet(request, BALANCES_PATH),
    respond: (request) => {
      const itemId = Number(new URL(request.url).searchParams.get('itemId'));

      return jsonResponse(listBody([{ itemId, availableQty: 60, ownershipTypeCode: 'OWNED' }]));
    },
  },
];

const tp = messages.itemPicker;

/**
 * 품목 선택 팝업에서 품목을 고른다.
 *
 * ⚠ **「찾기」를 눌러야 결과가 선다** — 검색어를 치는 것만으로는 조회가 나가지 않는다. 그것이
 *   이 창의 규칙이고, 도우미가 그 규칙을 건너뛰면 시험이 규칙을 못 본다.
 */
const pickItems = async (
  user: ReturnType<typeof userEvent.setup>,
  term: string,
  codes: readonly string[],
): Promise<void> => {
  const dialog = within(await screen.findByRole('dialog'));

  await user.type(dialog.getByLabelText(tp.keywordLabel), term);
  await user.click(dialog.getByRole('button', { name: tp.search }));

  for (const code of codes) {
    await user.click(await dialog.findByRole('checkbox', { name: code }));
  }

  await user.click(
    dialog.getByRole('button', { name: new RegExp(`${tp.add}|${tp.replace}`, 'u') }),
  );
};

describe('ShipmentRequestCreateScreen — 좌측 목록(완료 조건 C1)', () => {
  it('목록을 불러와 표에 낸다', async () => {
    renderScreen({ fetch: createStubFetch(baseRoutes()) });

    expect(await screen.findByText('SAMPLE-SO-0001')).toBeInTheDocument();
    expect(screen.getByText('SAMPLE-SO-0002')).toBeInTheDocument();
  });

  it('조회를 누르면 조건이 실린 요청을 다시 보낸다', async () => {
    const requests: URL[] = [];
    const routes = baseRoutes();
    const fetch = createStubFetch(
      routes.map((route) => ({
        ...route,
        respond: (request) => {
          if (isGet(request, LIST_PATH)) requests.push(new URL(request.url));

          return route.respond(request);
        },
      })),
    );

    const user = userEvent.setup();

    renderScreen({ fetch });
    await screen.findByText('SAMPLE-SO-0001');

    await user.click(screen.getByRole('checkbox', { name: t.filters.unassignedOnly }));
    await user.click(screen.getByRole('button', { name: t.filters.search }));

    await waitFor(() => {
      expect(requests.some((url) => url.searchParams.get('unassignedOnly') === 'true')).toBe(true);
    });
  });
});

describe('ShipmentRequestCreateScreen — 지시서 경유(완료 조건 C2)', () => {
  it('지시서를 고르면 고객·납품처가 잠기고 잔여 라인이 채워진다', async () => {
    const user = userEvent.setup();

    renderScreen({ fetch: createStubFetch(baseRoutes()) });

    await user.click(
      await screen.findByRole('button', { name: t.table.selectRow('SAMPLE-SO-0001') }),
    );

    const headerPane = await screen.findByRole('region', { name: t.panes.header });
    const linesPane = await screen.findByRole('region', { name: t.panes.lines });

    /* 고객·납품처는 값 표기다 — 선택칸이 아니다. */
    expect(within(headerPane).getByText('SAMPLE-CUST-01 · 합성 고객 가')).toBeInTheDocument();
    expect(within(headerPane).getByText('SAMPLE-SHIP-01 · 합성 납품처 가')).toBeInTheDocument();
    expect(within(headerPane).queryByRole('combobox', { name: /고객/ })).not.toBeInTheDocument();

    /*
     * 라인 8602(잔여 0)는 빠지고 8601(잔여 80)만 남는다.
     *
     * ⛔ **아래 두 줄의 순서를 바꾸거나 `findBy`를 `getBy`로 되돌리지 않는다.** 머리와 라인은
     * 서로 다른 부품이고(`screen.tsx` 대 `assignment-form-pane.tsx`) 채워지는 시점도 다르다 —
     * 머리만 기다리고 라인을 동기로 조회하면, 아직 비어 있는 라인을 보고 **부정 단언이 헛되이
     * 통과**하고 긍정 단언만 깨진다. 실제로 그 모양으로 `web-v0.3.12` 이미지 빌드가 CI 에서만
     * 멈췄다(로컬은 초록). 먼저 나타날 것을 기다린 뒤에 없어야 할 것을 본다.
     */
    expect(await within(linesPane).findByText('SAMPLE-ITEM-01 · 합성 품목 가')).toBeInTheDocument();
    expect(within(linesPane).queryByText('SAMPLE-ITEM-02 · 합성 품목 나')).not.toBeInTheDocument();
  });
});

describe('ShipmentRequestCreateScreen — 단독 생성(완료 조건 C3)', () => {
  it('단독 생성을 시작하면 고객·납품처가 선택칸이고 라인을 추가·삭제할 수 있다', async () => {
    const user = userEvent.setup();

    renderScreen({ fetch: createStubFetch(baseRoutes()) });

    await user.click(await screen.findByRole('button', { name: t.actions.startStandalone }));

    const headerPane = await screen.findByRole('region', { name: t.panes.header });

    expect(within(headerPane).getByRole('combobox', { name: /고객/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.removeLine(1) })).toBeDisabled();

    /* ⭐ 「라인 추가」가 곧바로 줄을 붙이지 않는다 — 팝업에서 품목을 골라야 줄이 생긴다. */
    await user.click(screen.getByRole('button', { name: t.actions.addLine }));
    await pickItems(user, 'SAMPLE-ITEM-02', ['SAMPLE-ITEM-02']);

    expect(screen.getByRole('button', { name: t.actions.removeLine(1) })).toBeEnabled();
    expect(screen.getByRole('button', { name: t.actions.removeLine(2) })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: t.actions.removeLine(2) }));

    expect(screen.queryByRole('button', { name: t.actions.removeLine(2) })).not.toBeInTheDocument();
  });

  /*
   * ⭐ **팝업이 라인을 만든다**(사용자 결정 2026-09-18). 품목 마스터가 9,269건이라 표 안
   *    선택칸으로는 감당할 수 없었다 — 첫 쪽 밖의 품목은 고를 방법이 아예 없었다.
   * ⭐ **기준 단위도 함께 채운다** — 서버가 준 `baseUomId` 다. 담당이 줄마다 단위를 고르지 않는다.
   */
  /*
   * ⛔ **빈 줄에 경고가 먼저 서지 않는다**(사용자 지시 2026-09-18). 라인을 막 추가한 사람에게
   *    붉은 문구가 두 개 먼저 뜨면, 아무것도 안 했는데 잘못한 것처럼 읽힌다.
   * ⭐ **그래도 편성은 막힌다** — 막는 것과 「줄마다 붉게 적는 것」은 다른 일이다. 사유는 편성
   *    단추 옆에 한 번 선다.
   */
  it('아직 안 채운 줄에 붉은 문구를 띄우지 않되 편성은 막는다', async () => {
    const user = userEvent.setup();

    renderScreen({ fetch: createStubFetch(baseRoutes()) });

    await user.click(await screen.findByRole('button', { name: t.actions.startStandalone }));
    await screen.findByRole('region', { name: t.panes.lines });

    expect(screen.queryByText('품목을 선택하세요.')).not.toBeInTheDocument();
    expect(screen.queryByText('요청 수량을 입력하세요.')).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: t.actions.submit })).toBeDisabled();
  });

  /*
   * ⛔ **친 값이 잘못된 것은 그대로 짚는다.** 「아직 안 쳤다」와 「잘못 쳤다」는 다른 사실이고,
   *    뒤엣것까지 감추면 사용자는 왜 막혔는지 알 길이 없다.
   */
  it('잘못 친 값은 그 자리에서 짚는다', async () => {
    const user = userEvent.setup();

    renderScreen({ fetch: createStubFetch(baseRoutes()) });

    await user.click(await screen.findByRole('button', { name: t.actions.startStandalone }));
    await user.type(screen.getByLabelText(t.lineTable.requestedQtyLabel(1)), '0');

    expect(await screen.findByText(t.errors.requestedQtyNotPositive)).toBeInTheDocument();
  });

  it('팝업에서 여러 품목을 고르면 그만큼 라인이 붙고 기준 단위가 채워진다', async () => {
    const user = userEvent.setup();

    renderScreen({ fetch: createStubFetch(baseRoutes()) });

    await user.click(await screen.findByRole('button', { name: t.actions.startStandalone }));
    await user.click(screen.getByRole('button', { name: t.actions.addLine }));
    await pickItems(user, 'SAMPLE-ITEM', ['SAMPLE-ITEM-01', 'SAMPLE-ITEM-02']);

    /* 빈 줄 하나 + 고른 둘 = 셋. */
    expect(
      await screen.findByRole('button', { name: t.actions.removeLine(3) }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: t.lineTable.itemLabel(2) })).toHaveTextContent(
      'SAMPLE-ITEM-01 · 합성 품목 가',
    );
    expect(screen.getAllByRole('combobox', { name: t.lineTable.uomLabel(2) })[0]).toHaveTextContent(
      /개/u,
    );
  });

  /*
   * ⭐ **품목 셀을 눌러도 같은 팝업이 열린다** — 잘못 고른 줄을 지우고 다시 만들지 않아도 된다.
   *    이때는 «바꾸기»라 하나만 고른다.
   */
  it('품목 셀을 누르면 그 줄의 품목을 바꾼다', async () => {
    const user = userEvent.setup();

    renderScreen({ fetch: createStubFetch(baseRoutes()) });

    await user.click(await screen.findByRole('button', { name: t.actions.startStandalone }));
    await user.click(screen.getByRole('button', { name: t.lineTable.itemLabel(1) }));
    await pickItems(user, 'SAMPLE-ITEM-01', ['SAMPLE-ITEM-01']);

    expect(await screen.findByRole('button', { name: t.lineTable.itemLabel(1) })).toHaveTextContent(
      'SAMPLE-ITEM-01 · 합성 품목 가',
    );

    await user.click(screen.getByRole('button', { name: t.lineTable.itemLabel(1) }));
    await pickItems(user, 'SAMPLE-ITEM-02', ['SAMPLE-ITEM-02']);

    /* 줄이 늘지 않는다 — 바꾼 것이지 더한 것이 아니다. */
    expect(screen.queryByRole('button', { name: t.actions.removeLine(2) })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.lineTable.itemLabel(1) })).toHaveTextContent(
      'SAMPLE-ITEM-02 · 합성 품목 나',
    );
  });
});

describe('ShipmentRequestCreateScreen — 배정 수량 검증(완료 조건 C4)', () => {
  it('배정 수량이 요청 수량을 넘으면 인라인 오류로 막힌다', async () => {
    const user = userEvent.setup();

    renderScreen({ fetch: createStubFetch(baseRoutes()) });

    await user.click(await screen.findByRole('button', { name: t.actions.startStandalone }));

    await user.click(screen.getByRole('button', { name: t.lineTable.itemLabel(1) }));
    await pickItems(user, 'SAMPLE-ITEM-01', ['SAMPLE-ITEM-01']);

    const requestedInput = screen.getByLabelText(t.lineTable.requestedQtyLabel(1));

    await user.type(requestedInput, '10');

    const allocatedInput = screen.getByLabelText(t.lineTable.allocatedQtyLabel(1));

    await user.type(allocatedInput, '11');

    expect(await screen.findByText(t.errors.allocatedQtyOverRequested(10))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.submit })).toBeDisabled();
  });
});

/* 지시서 가져오기는 파일 형식이 정해지지 않아 쓸 수 없다 — 쓸 수 없는 단추는 세우지 않는다(C-4 · 관리웹 정리 시안 A). */
describe('ShipmentRequestCreateScreen — 지시서 가져오기(완료 조건 C7)', () => {
  it('쓸 수 없는 「지시서 가져오기」 단추를 세우지 않는다', async () => {
    renderScreen({ fetch: createStubFetch(baseRoutes()) });

    expect(await screen.findByRole('heading', { name: t.title })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '지시서 가져오기' })).toBeNull();
    expect(screen.getByRole('button', { name: t.actions.startStandalone })).toBeInTheDocument();
    expect(t.actions.startStandalone).toBe('ERP S/O 없이 생성');
    expect(screen.queryByRole('button', { name: /가져오기|Import/i })).not.toBeInTheDocument();
    expect(t.title).toBe('출하작업지시 생성');
  });
});

describe('ShipmentRequestCreateScreen — 시간대 입력란 없음(완료 조건 C8)', () => {
  it('날짜만 있고 시간 입력칸이 없다', async () => {
    const user = userEvent.setup();

    renderScreen({ fetch: createStubFetch(baseRoutes()) });

    await user.click(await screen.findByRole('button', { name: t.actions.startStandalone }));

    expect(screen.getByLabelText(t.fields.requestedShipDate)).toBeInTheDocument();
    expect(screen.queryByLabelText(/시간/)).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });
});

/* ── 피처 012 — 사업부·줄 출고 창고·S/O 줄 나누기(US1 · quickstart Q1~Q5) ───────────── */

describe('ShipmentRequestCreateScreen — 사업부·출고 창고(피처 012)', () => {
  const openOrder = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(
      await screen.findByRole('button', { name: t.table.selectRow('SAMPLE-SO-0001') }),
    );
    await screen.findByRole('region', { name: t.panes.lines });
  };

  const chooseWarehouse = async (
    user: ReturnType<typeof userEvent.setup>,
    rowIndex: number,
    label: string,
  ) => {
    await user.click(screen.getByRole('combobox', { name: t.lineTable.warehouseLabel(rowIndex) }));
    await user.click(await screen.findByRole('option', { name: label }));
  };

  const reasonText = (): string =>
    screen.getByRole('button', { name: t.actions.submit }).getAttribute('aria-describedby') === null
      ? ''
      : (document.getElementById(
          screen.getByRole('button', { name: t.actions.submit }).getAttribute('aria-describedby')!,
        )?.textContent ?? '');

  it('US1-1·Q1 계정 범위의 사업부가 하나면 사업부 칸이 채워져 있고 그 사실을 적는다', async () => {
    const user = userEvent.setup();

    renderScreen({ fetch: createStubFetch(baseRoutes()) });
    await openOrder(user);

    const headerPane = screen.getByRole('region', { name: t.panes.header });

    expect(
      await within(headerPane).findByRole('combobox', { name: new RegExp(t.fields.businessUnit, 'u') }),
    ).toHaveTextContent('합성 사업부 X');
    expect(within(headerPane).getByText(t.notes.businessUnitAutoFilled)).toBeInTheDocument();
    /* 「출하 담당 공장」 칸은 없다(FR-007). */
    expect(within(headerPane).queryByText('출하 담당 공장')).not.toBeInTheDocument();
  });

  it('US1-2·Q2 범위에 사업부가 둘이면 빈 칸으로 열리고 창고 칸·[나누기]가 잠기며 「사업부를 고르세요」로 막힌다', async () => {
    const user = userEvent.setup();

    renderScreen({ fetch: createStubFetch(baseRoutes()) }, TWO_BU_SESSION);
    await openOrder(user);

    await waitFor(() => {
      expect(reasonText()).toBe(t.actionReasons.businessUnitMissing);
    });
    expect(screen.getByRole('button', { name: t.actions.submit })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: t.lineTable.warehouseLabel(1) })).toHaveTextContent(
      t.lineTable.warehouseNeedsBusinessUnit,
    );
    expect(screen.getByRole('button', { name: t.actions.splitLineLabel(1) })).toBeDisabled();
  });

  it('US1-3·Q1 창고 선택지는 그 사업부의 활성 창고(공장 이름 함께)뿐이고 불량창고·다른 사업부 창고는 없다', async () => {
    const user = userEvent.setup();

    renderScreen({ fetch: createStubFetch(baseRoutes()) });
    await openOrder(user);
    await screen.findByText(t.notes.businessUnitAutoFilled);

    await user.click(screen.getByRole('combobox', { name: t.lineTable.warehouseLabel(1) }));

    expect(await screen.findByRole('option', { name: '합성 창고 A (합성 1공장)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '합성 창고 C (합성 1공장)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '합성 창고 B (합성 2공장)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /불량창고/u })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /창고 Y/u })).not.toBeInTheDocument();
  });

  it('FR-006 S/O 줄 옆에 ERP 창고 코드를 참고로만 보이고 창고를 자동으로 고르지 않는다', async () => {
    const user = userEvent.setup();

    renderScreen({ fetch: createStubFetch(baseRoutes()) });
    await openOrder(user);

    expect(await screen.findByText(t.lineTable.erpWarehouseHint('SAMPLE-ERP-WH'))).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: t.lineTable.warehouseLabel(1) })).not.toHaveTextContent(
      /합성 창고/u,
    );
  });

  it('US1-6·Q5 창고를 고르지 않은 줄이 있으면 「출고 창고를 고르세요: 라인 1」로 막힌다', async () => {
    const user = userEvent.setup();

    renderScreen({ fetch: createStubFetch(baseRoutes()) });
    await openOrder(user);
    await screen.findByText(t.notes.businessUnitAutoFilled);

    await waitFor(() => {
      expect(reasonText()).toBe(t.actionReasons.warehouseMissing('1'));
    });
  });

  it('US1-5·Q4 [나누기] 로 창고 A 40·B 40 이면 잔여 합 줄이 서고, 50·40 이면 붉게 막힌다', async () => {
    const user = userEvent.setup();

    renderScreen({ fetch: createStubFetch(baseRoutes()) });
    await openOrder(user);
    await screen.findByText(t.notes.businessUnitAutoFilled);
    await chooseWarehouse(user, 1, '합성 창고 A (합성 1공장)');

    await user.click(screen.getByRole('button', { name: t.actions.splitLineLabel(1) }));

    /* 나눈 줄은 첫 줄 창고(A)로 시작한다 — 나누는 까닭대로 B 로 바꾼다. */
    expect(screen.getByRole('combobox', { name: t.lineTable.warehouseLabel(2) })).toHaveTextContent(
      '합성 창고 A (합성 1공장)',
    );
    await chooseWarehouse(user, 2, '합성 창고 B (합성 2공장)');

    const origin = screen.getByLabelText(t.lineTable.allocatedQtyLabel(1));
    const split = screen.getByLabelText(t.lineTable.allocatedQtyLabel(2));

    await user.clear(origin);
    await user.type(origin, '40');
    await user.clear(split);
    await user.type(split, '40');

    expect(
      screen.getByText(
        t.lineTable.splitTotal('SAMPLE-SO-0001 1행', 80, 80, '합성 창고 A 40, 합성 창고 B 40'),
      ),
    ).toBeInTheDocument();
    /* 합은 맞다 — 남은 막힘은 출하요청일 하나다. */
    expect(reasonText()).toBe(t.actionReasons.headerIncomplete);

    await user.clear(origin);
    await user.type(origin, '50');

    expect(
      screen.getByText(t.errors.splitOverRemaining(90, 80, '합성 창고 A 50, 합성 창고 B 40')),
    ).toBeInTheDocument();
    expect(reasonText()).toBe(t.actionReasons.splitOverRemaining('SAMPLE-SO-0001 1행'));
    expect(screen.getByRole('button', { name: t.actions.submit })).toBeDisabled();

    /* 나눈 줄을 지우면 묶음이 사라진다. */
    await user.click(screen.getByRole('button', { name: t.actions.removeSplitLine(2) }));
    expect(screen.queryByLabelText(t.lineTable.allocatedQtyLabel(2))).not.toBeInTheDocument();
  });

  it('US1-4·Q3 첫 줄 창고를 고르면 새로 담은 줄이 그 창고로 시작하고 「첫 줄 창고로 채움」을 적는다', async () => {
    const user = userEvent.setup();

    renderScreen({ fetch: createStubFetch(baseRoutes()) });

    await user.click(await screen.findByRole('button', { name: t.actions.startStandalone }));
    await screen.findByText(t.notes.businessUnitAutoFilled);
    await user.click(screen.getByRole('button', { name: t.lineTable.itemLabel(1) }));
    await pickItems(user, 'SAMPLE-ITEM-01', ['SAMPLE-ITEM-01']);
    await chooseWarehouse(user, 1, '합성 창고 C (합성 1공장)');

    await user.click(screen.getByRole('button', { name: t.actions.addLine }));
    await pickItems(user, 'SAMPLE-ITEM-02', ['SAMPLE-ITEM-02']);

    expect(
      await screen.findByRole('combobox', { name: t.lineTable.warehouseLabel(2) }),
    ).toHaveTextContent('합성 창고 C (합성 1공장)');
    expect(screen.getByText(t.lineTable.warehouseFilledFromFirst)).toBeInTheDocument();
    /* 새 줄 창고 규칙 · 고를 수 있는 창고 규칙은 늘 보이는 문장이 아니라 ⓘ 다(관리웹 정리 시안 A). */
    expect(screen.getByRole('button', { name: t.notes.addLineWarehouse })).toBeInTheDocument();
    expect(screen.queryByText(t.notes.addLineWarehouse)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.notes.warehouseRule })).toBeInTheDocument();
  });

  it('US1-7·Q5 사업부를 바꾸면 다른 사업부 창고를 고른 줄을 비우고 띠로 다시 고르라 한다', async () => {
    const user = userEvent.setup();

    renderScreen({ fetch: createStubFetch(baseRoutes()) }, TWO_BU_SESSION);
    await openOrder(user);

    const businessUnit = await screen.findByRole('combobox', {
      name: new RegExp(t.fields.businessUnit, 'u'),
    });

    await user.click(businessUnit);
    await user.click(await screen.findByRole('option', { name: '합성 사업부 X' }));
    await chooseWarehouse(user, 1, '합성 창고 A (합성 1공장)');

    await user.click(businessUnit);
    await user.click(await screen.findByRole('option', { name: '합성 사업부 Y' }));

    expect(await screen.findByText(t.warehouseCleared.title(1))).toBeInTheDocument();
    expect(screen.getByText(t.warehouseCleared.description('합성 사업부 Y'))).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: t.lineTable.warehouseLabel(1) })).toHaveTextContent(
      t.lineTable.warehouseReselect,
    );

    /* 다시 고르면 띠가 걷힌다. */
    await chooseWarehouse(user, 1, '합성 창고 Y (합성 3공장)');
    expect(screen.queryByText(t.warehouseCleared.title(1))).not.toBeInTheDocument();
  });

  it('FR-006a 가용 수량은 고른 창고로 묻는다(warehouseId)', async () => {
    const user = userEvent.setup();
    const balanceQueries: URLSearchParams[] = [];
    const fetch = createStubFetch(
      baseRoutes().map((route) => ({
        ...route,
        respond: (request: Request) => {
          if (isGet(request, BALANCES_PATH)) balanceQueries.push(new URL(request.url).searchParams);

          return route.respond(request);
        },
      })),
    );

    renderScreen({ fetch });
    await openOrder(user);
    await screen.findByText(t.notes.businessUnitAutoFilled);

    /* 창고를 고르기 전에는 묻지 않는다 — 다른 창고 재고로 넉넉해 보이지 않게. */
    expect(balanceQueries).toHaveLength(0);

    await chooseWarehouse(user, 1, '합성 창고 B (합성 2공장)');

    await waitFor(() => {
      expect(balanceQueries.some((query) => query.get('warehouseId') === '9102')).toBe(true);
    });
  });
});
