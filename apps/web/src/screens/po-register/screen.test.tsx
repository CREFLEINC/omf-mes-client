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
import { pickDate } from '../../test/date-picker';
import {
  businessUnitFixtures,
  inboundReceiptDetailBody,
  inboundReceiptLineFixtures,
  inboundReceiptLineResponse,
  inboundReceiptNoLineFixtures,
  itemFixtures,
  partnerFixtures,
  plantFixtures,
  uomFixtures,
} from './fixtures';
import { PoRegisterScreen } from './screen';

const t = messages.poRegister;

const ROUTE = '/logistics/po-register';
const RECEIPT_PATH = '/logistics/inbound-receipts/9101';
const PARTNERS_PATH = '/mdm/partners';
const BUSINESS_UNITS_PATH = '/mdm/business-units';
const PLANTS_PATH = '/mdm/plants';
const ITEMS_PATH = '/mdm/items';
const UOMS_PATH = '/mdm/uoms';

/**
 * 이 화면이 **부르지 않는다는 것을 증명하려고** 두는 경로들.
 *
 * 스텁을 두지 않으면 하네스가 던져 「부르지 않았다」와 「불렀는데 실패했다」가 구분되지 않는다.
 * 목록(`/logistics/purchase-orders`)은 이 화면이 그리지 않고(계획 §5.10),
 * 결재 진행(`/app/approval-requests`)은 결재함 소관이다(계획 결정 11).
 */
const PO_LIST_PATH = '/logistics/purchase-orders';
const APPROVAL_PATH = '/app/approval-requests';

const ITEM_LABEL = 'SAMPLE-ITEM-01 · 합성 품목 가';
const SUPPLIER_LABEL = 'SAMPLE-SUP-01 · 합성 공급사 가';

/** 화면 어디에도 나와서는 안 되는 내부 번호(FK). 픽스처의 번호 대역을 그대로 쓴다. */
const INTERNAL_IDS = ['9101', '9111', '9112', '9201', '9301', '9401', '9501', '9601'];

interface RecordedRequest {
  method: string;
  url: URL;
  headers: Headers;
}

const createRecordingFetch = (
  routes: StubRoute[],
): { fetch: StubFetch; requests: RecordedRequest[] } => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch(routes);

  const fetch: StubFetch = async (request) => {
    requests.push({ method: request.method, url: new URL(request.url), headers: request.headers });

    return stub(request);
  };

  return { fetch, requests };
};

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const listBody = (items: unknown[]) => ({
  items,
  page: { page: 1, size: 50, total: items.length },
});

const lookupRoute = (pathname: string, items: unknown[]): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse(listBody(items)),
});

const lookupRoutes = (): StubRoute[] => [
  lookupRoute(PARTNERS_PATH, partnerFixtures),
  lookupRoute(BUSINESS_UNITS_PATH, businessUnitFixtures),
  lookupRoute(PLANTS_PATH, plantFixtures),
  lookupRoute(ITEMS_PATH, itemFixtures),
  lookupRoute(UOMS_PATH, uomFixtures),
];

const failingLookupRoute = (pathname: string): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse({ message: '' }, { status: 500 }),
});

const receiptRoute = (lines = inboundReceiptLineFixtures): StubRoute => ({
  match: (request) => isGet(request, RECEIPT_PATH),
  respond: () => jsonResponse(inboundReceiptDetailBody(lines)),
});

const failingReceiptRoute = (status: number): StubRoute => ({
  match: (request) => isGet(request, RECEIPT_PATH),
  respond: () => jsonResponse({ message: '' }, { status }),
});

/** 부를 수 있게 열어 두는 경로. **0건임을 증명하는 것이 목적이다.** */
const forbiddenRoutes = (): StubRoute[] => [
  {
    match: (request) => new URL(request.url).pathname.startsWith(PO_LIST_PATH),
    respond: () => jsonResponse(listBody([])),
  },
  {
    match: (request) => new URL(request.url).pathname.startsWith(APPROVAL_PATH),
    respond: () => jsonResponse(listBody([])),
  },
];

const allRoutes = (lines = inboundReceiptLineFixtures): StubRoute[] => [
  receiptRoute(lines),
  ...lookupRoutes(),
  ...forbiddenRoutes(),
];

/** 한 줄뿐인 입하 — 대상이 자동으로 확정되는 갈래(계획 결정 4). */
const SINGLE_LINE = [inboundReceiptLineResponse()];

/** 주소가 실제로 어떻게 바뀌는지 본다 — 선택이 주소에 실리는지 판정할 유일한 근거다. */
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

const renderScreen = (
  routes: StubRoute[],
  search = '?receipt=9101',
): { requests: RecordedRequest[]; user: ReturnType<typeof userEvent.setup> } => {
  const { fetch, requests } = createRecordingFetch(routes);

  renderWithProviders(
    <>
      <PoRegisterScreen />
      <LocationProbe />
      <BackProbe />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, user: userEvent.setup() };
};

const requestsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === pathname);

const currentLocation = (): string => screen.getByTestId('location').textContent ?? '';

const sourcePane = (): HTMLElement => screen.getByRole('region', { name: t.panes.source });

const linesPane = (): HTMLElement => screen.getByRole('region', { name: t.panes.lines });

const lineRows = (): HTMLElement[] =>
  within(within(linesPane()).getByRole('table')).getAllByRole('row').slice(1);

const qtyInput = (lineNo: number): HTMLElement =>
  screen.getByLabelText(t.lineTable.orderedQtyLabel(lineNo));

const registerButton = (): HTMLElement => screen.getByRole('button', { name: t.actions.register });

/** 대상 초과분이 선 뒤에 잰다 — 렌더 전에 「없다」를 재면 늘 통과하는 단언이 된다. */
const waitForSource = async (): Promise<void> => {
  await screen.findByText('SAMPLE-IR-9101');
};

describe('W-01-11 신규 P/O 등록 — 진입 맥락(C1)', () => {
  it('맥락이 있으면 입하 상세를 정확히 1회 부르고 전표와 라인을 보인다', async () => {
    const { requests } = renderScreen(allRoutes());

    await waitForSource();

    expect(requestsTo(requests, RECEIPT_PATH)).toHaveLength(1);
    expect(within(sourcePane()).getByText('SAMPLE_IR_STATUS_A')).toBeInTheDocument();
    expect(within(within(sourcePane()).getByRole('table')).getAllByRole('row')).toHaveLength(3);
  });

  it('품목·단위 이름을 참조 조회로 푼다 — 번호를 대신 내지 않는다', async () => {
    renderScreen(allRoutes());

    await waitForSource();

    await waitFor(() => {
      expect(within(sourcePane()).getByText(ITEM_LABEL)).toBeInTheDocument();
    });
    expect(within(sourcePane()).queryByText('9501')).not.toBeInTheDocument();
  });

  it('사람이 읽는 자리에 내부 번호가 새지 않는다', async () => {
    renderScreen(allRoutes());

    await waitForSource();

    /*
     * **업무 번호는 세지 않는다.** 입하번호(`SAMPLE-IR-9101`)는 사용자가 나중에 이 전표를 찾는
     * 값이라 보이는 것이 맞고, 그 글자 안에 전표 번호와 같은 숫자가 들어 있다.
     * 여기서 세는 것은 **업무 번호 밖에서** 내부 번호가 글자로 나타나는가다.
     */
    const text = (sourcePane().textContent ?? '').split('SAMPLE-IR-9101').join('');

    for (const id of INTERNAL_IDS) expect(text).not.toContain(id);
  });
});

describe('승계(C2)', () => {
  it('라인이 한 줄이면 대상이 확정되고 발주 라인 1행이 승계된 값으로 선다', async () => {
    renderScreen(allRoutes(SINGLE_LINE));

    await waitForSource();

    expect(within(sourcePane()).getByText(t.source.singleLineNote)).toBeInTheDocument();
    expect(lineRows()).toHaveLength(1);
    expect(qtyInput(1)).toHaveValue(12);
    await waitFor(() => {
      expect(within(linesPane()).getByText(ITEM_LABEL)).toBeInTheDocument();
    });
  });

  it('한 줄뿐이면 고르는 버튼을 두지 않는다 — 고를 것이 없다', async () => {
    renderScreen(allRoutes(SINGLE_LINE));

    await waitForSource();

    expect(within(sourcePane()).getByText(t.source.chosen)).toBeInTheDocument();
    expect(
      within(sourcePane()).queryByRole('button', { name: t.source.chooseRow(1) }),
    ).not.toBeInTheDocument();
  });
});

describe('대상 선택(C3·C4)', () => {
  it('라인이 두 줄이면 고르기 전에는 등록이 잠기고 사유가 보인다', async () => {
    renderScreen(allRoutes());

    await waitForSource();

    expect(registerButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.sourceLineNotChosen)).toBeInTheDocument();
    expect(within(linesPane()).queryByRole('table')).not.toBeInTheDocument();
  });

  it('대상을 고르면 주소에 실리고 그 줄이 발주 라인으로 승계된다', async () => {
    const { user } = renderScreen(allRoutes());

    await waitForSource();
    await user.click(screen.getByRole('button', { name: t.source.chooseRow(2) }));

    expect(currentLocation()).toBe(`${ROUTE}?receipt=9101&line=9112`);
    expect(qtyInput(1)).toHaveValue(4);
  });

  it('선택은 뒤로가기 기록을 늘리지 않는다(사본 체크리스트 1번)', async () => {
    const { user } = renderScreen(allRoutes());

    await waitForSource();
    await user.click(screen.getByRole('button', { name: t.source.chooseRow(1) }));
    await user.click(screen.getByRole('button', { name: t.source.chooseRow(2) }));

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    expect(currentLocation()).toBe(`${ROUTE}?receipt=9101&line=9112`);
  });

  it('주소가 가리키는 줄이 목록에 없으면 고르지 않은 것으로 본다', async () => {
    renderScreen(allRoutes(), '?receipt=9101&line=9999');

    await waitForSource();

    expect(registerButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.sourceLineNotChosen)).toBeInTheDocument();
  });

  /**
   * **고를 줄이 하나도 없는 갈래**(리뷰 R-1).
   *
   * 이 갈래에서 「위 구획에서 줄을 하나 고르세요」라고 말하면 사용자가 **할 수 없는 조치**를
   * 지시하게 된다. 사유·빈 상태 둘 다 0행 전용 문구로 갈리는지 재고, 「고르세요」 문구가
   * 화면 어디에도 없는지 함께 잰다.
   */
  it('라인이 0행이면 「고르세요」가 아니라 승계할 줄이 없다고 말한다', async () => {
    renderScreen(allRoutes(inboundReceiptNoLineFixtures));

    await waitForSource();

    expect(screen.getByText(t.actionReasons.noSourceLines)).toBeInTheDocument();
    expect(registerButton()).toBeDisabled();
    /* 대상 구획의 빈 상태와 발주 라인 구획의 빈 상태가 같은 사실을 말한다. */
    expect(screen.getAllByText(t.empty.noSourceLinesTitle)).toHaveLength(2);
    expect(screen.queryByText(t.actionReasons.sourceLineNotChosen)).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.noTargetTitle)).not.toBeInTheDocument();
  });
});

describe('라인 추가·삭제(C5)', () => {
  it('줄을 더할 수 있고 한 줄뿐일 때는 삭제가 잠긴다', async () => {
    const { user } = renderScreen(allRoutes(SINGLE_LINE));

    await waitForSource();

    expect(screen.getByRole('button', { name: t.actions.removeLine(1) })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: t.actions.addLine }));

    expect(lineRows()).toHaveLength(2);
    expect(screen.getByRole('button', { name: t.actions.removeLine(2) })).toBeEnabled();
  });

  /**
   * **가운데 줄을 지워도 뒤 줄의 DOM 노드가 살아남는다**(사본 체크리스트 2번).
   *
   * 행 식별자를 떼면 React key가 인덱스가 되어 뒤 줄의 노드가 대신 지워지고, 그때 친 값이
   * 말없이 다른 줄로 옮겨 붙는다. 포커스가 그 노드에 남는지는 부품 감지기가 잰다 —
   * 여기서는 삭제 버튼을 누르는 조작 자체가 포커스를 가져가므로 값과 노드 동일성을 잰다.
   */
  it('가운데 줄을 지워도 남은 줄의 값이 옮겨 붙지 않는다(사본 체크리스트 2번)', async () => {
    const { user } = renderScreen(allRoutes(SINGLE_LINE));

    await waitForSource();
    await user.click(screen.getByRole('button', { name: t.actions.addLine }));
    await user.click(screen.getByRole('button', { name: t.actions.addLine }));

    await user.type(qtyInput(3), '7');
    const third = qtyInput(3);

    expect(third).toHaveFocus();

    await user.click(screen.getByRole('button', { name: t.actions.removeLine(2) }));

    expect(lineRows()).toHaveLength(2);
    expect(qtyInput(2)).toBe(third);
    expect(qtyInput(2)).toHaveValue(7);
  });
});

describe('발주수량 하한과 경고(C6·C7)', () => {
  it('승계 줄을 승계 수량보다 적게 치면 그 줄에 오류가 붙고 등록이 잠긴다', async () => {
    const { user } = renderScreen(allRoutes(SINGLE_LINE));

    await waitForSource();
    await user.clear(qtyInput(1));
    await user.type(qtyInput(1), '11');

    expect(
      within(lineRows()[0] as HTMLElement).getByText(t.errors.qtyBelowSource(12)),
    ).toBeInTheDocument();
    expect(registerButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.lineInvalid)).toBeInTheDocument();
  });

  it('두 줄이 동시에 오류면 각 줄의 칸이 자기 줄의 오류를 가리킨다(사본 체크리스트 3번)', async () => {
    const { user } = renderScreen(allRoutes(SINGLE_LINE));

    await waitForSource();
    await user.clear(qtyInput(1));
    await user.type(qtyInput(1), '11');
    await user.click(screen.getByRole('button', { name: t.actions.addLine }));
    await user.type(qtyInput(2), '0');

    /* **접근 이름이 아니라 설명을 잰다** — 오류가 자기 줄의 칸에 이어졌는지가 요점이다. */
    expect(qtyInput(1)).toHaveAccessibleDescription(new RegExp(t.errors.qtyBelowSource(12)));
    expect(qtyInput(2)).toHaveAccessibleDescription(new RegExp(t.errors.qtyNotPositive));
  });

  it('초과 허용치가 0보다 크면 경고가 보이되 등록을 막지 않는다', async () => {
    const { user } = renderScreen(allRoutes(SINGLE_LINE));

    await waitForSource();
    await user.clear(screen.getByLabelText(t.lineTable.toleranceOverLabel(1)));
    await user.type(screen.getByLabelText(t.lineTable.toleranceOverLabel(1)), '5');

    expect(screen.getByText(t.warnings.toleranceOverPositive)).toBeInTheDocument();
    expect(screen.queryByText(t.actionReasons.lineInvalid)).not.toBeInTheDocument();
  });
});

describe('맥락 없음과 범위 안내(C8·C9)', () => {
  it('맥락이 없으면 등록이 잠기고 사유가 보이며 입하 상세를 부르지 않는다', async () => {
    const { requests } = renderScreen(allRoutes(), '');

    expect(await screen.findByText(t.empty.noContextTitle)).toBeInTheDocument();
    expect(registerButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.noContext)).toBeInTheDocument();
    expect(requestsTo(requests, RECEIPT_PATH)).toHaveLength(0);
  });

  it('범위 안내는 맥락이 있든 없든 늘 보인다', async () => {
    renderScreen(allRoutes(), '');

    expect(await screen.findByText(t.scope.title)).toBeInTheDocument();
    expect(screen.getByText(t.scope.description)).toBeInTheDocument();
  });

  it('맥락이 있어도 범위 안내가 그대로 선다', async () => {
    renderScreen(allRoutes());

    await waitForSource();

    expect(screen.getByText(t.scope.title)).toBeInTheDocument();
  });
});

describe('이 화면에 두지 않는 것(C10)', () => {
  it('발주 목록·검색·결재 진행이 없다', async () => {
    const { requests } = renderScreen(allRoutes());

    await waitForSource();

    expect(requestsTo(requests, PO_LIST_PATH)).toHaveLength(0);
    expect(requestsTo(requests, APPROVAL_PATH)).toHaveLength(0);
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('표는 대상 초과분과 발주 라인 둘뿐이다', async () => {
    const { user } = renderScreen(allRoutes());

    await waitForSource();
    await user.click(screen.getByRole('button', { name: t.source.chooseRow(1) }));

    expect(screen.getAllByRole('table')).toHaveLength(2);
  });
});

describe('조회 실패(C11)', () => {
  it('입하 상세가 실패하면 빈 상태가 아니라 배너와 다시 시도가 선다', async () => {
    renderScreen([failingReceiptRoute(500), ...lookupRoutes(), ...forbiddenRoutes()]);

    expect(await screen.findByText(messages.httpError.loadTitle)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.common.retry })).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noContextTitle)).not.toBeInTheDocument();
  });

  it('권한 없음에는 다시 시도를 내지 않는다', async () => {
    renderScreen([failingReceiptRoute(403), ...lookupRoutes(), ...forbiddenRoutes()]);

    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it('조회에 실패하면 등록이 잠기고 사유가 보인다', async () => {
    renderScreen([failingReceiptRoute(500), ...lookupRoutes(), ...forbiddenRoutes()]);

    await screen.findByText(messages.httpError.loadTitle);

    expect(registerButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.sourceNotLoaded)).toBeInTheDocument();
  });

  /**
   * **사업부 단독 실패**(리뷰 R-2).
   *
   * 사업부는 승계 원천이 없는 유일한 필수 값이라 선택지가 비면 채울 방법이 없다.
   * 그 실패에 복구 버튼이 서지 않으면 등록이 `headerIncomplete`로 영구 잠긴다 —
   * 다른 넷은 정상인 상태에서 복구 수단이 실제로 서는지 잰다.
   */
  it('사업부 조회만 실패해도 복구 수단이 선다', async () => {
    const { user } = renderScreen([
      receiptRoute(),
      failingLookupRoute(BUSINESS_UNITS_PATH),
      lookupRoute(PARTNERS_PATH, partnerFixtures),
      lookupRoute(PLANTS_PATH, plantFixtures),
      lookupRoute(ITEMS_PATH, itemFixtures),
      lookupRoute(UOMS_PATH, uomFixtures),
      ...forbiddenRoutes(),
    ]);

    await waitForSource();

    /* 짝 양성 — 다른 넷은 정상이라 이름이 실제로 풀린다. */
    await waitFor(() => {
      expect(within(sourcePane()).getByText(ITEM_LABEL)).toBeInTheDocument();
    });

    expect(screen.getByText(t.reasons.referencesFailed)).toBeInTheDocument();
    expect(
      within(sourcePane()).getByRole('button', { name: messages.common.retry }),
    ).toBeInTheDocument();
    /* 사업부 칸에는 선택지를 불러오지 못했다는 안내가 붙는다. */
    expect(screen.getByText(t.lookups.failed)).toBeInTheDocument();

    await user.click(within(sourcePane()).getByRole('button', { name: messages.common.retry }));
  });

  it('참조 조회가 실패하면 이름 자리에 사유가 서고 복구 수단이 함께 있다', async () => {
    renderScreen([
      receiptRoute(),
      failingLookupRoute(ITEMS_PATH),
      lookupRoute(PARTNERS_PATH, partnerFixtures),
      lookupRoute(BUSINESS_UNITS_PATH, businessUnitFixtures),
      lookupRoute(PLANTS_PATH, plantFixtures),
      lookupRoute(UOMS_PATH, uomFixtures),
      ...forbiddenRoutes(),
    ]);

    await waitForSource();

    await waitFor(() => {
      expect(within(sourcePane()).getAllByText(t.values.referenceFailed).length).toBeGreaterThan(0);
    });
    expect(screen.getByText(t.reasons.referencesFailed)).toBeInTheDocument();
  });
});

describe('발주 정보', () => {
  it('공급사·공장은 넘어온 전표에서 승계되고 사업부·발주일은 비어 있다', async () => {
    const { user } = renderScreen(allRoutes(SINGLE_LINE));

    await waitForSource();

    await waitFor(() => {
      expect(screen.getByLabelText(t.fields.supplier)).toHaveTextContent(SUPPLIER_LABEL);
    });
    /* 사업부는 승계할 원천이 없다 — 어떤 사업부도 골라져 있지 않아야 한다. */
    expect(screen.getByLabelText(t.fields.businessUnit)).not.toHaveTextContent('합성 사업부 가');
    expect(registerButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.headerIncomplete)).toBeInTheDocument();

    /* 더한 줄은 비어 있다 — **잘못 친 값이 아직 안 친 칸보다 먼저** 사유가 된다. */
    await user.click(screen.getByRole('button', { name: t.actions.addLine }));

    expect(screen.getByText(t.actionReasons.lineInvalid)).toBeInTheDocument();
  });

  it('승계값과 다른 공급사를 고르면 경고가 보이되 막지 않는다', async () => {
    const { user } = renderScreen(allRoutes(SINGLE_LINE));

    await waitForSource();
    await waitFor(() => {
      expect(screen.getByLabelText(t.fields.supplier)).toHaveTextContent(SUPPLIER_LABEL);
    });

    await user.click(screen.getByLabelText(t.fields.supplier));
    await user.click(screen.getByRole('option', { name: 'SAMPLE-SUP-02 · 합성 공급사 나' }));

    expect(screen.getByText(t.warnings.supplierChanged)).toBeInTheDocument();
    expect(screen.queryByText(t.actionReasons.lineInvalid)).not.toBeInTheDocument();
  });

  it('값을 다 채우면 사유가 「아직 보낼 수 없다」로 바뀐다 — 이 회차는 보내지 않는다', async () => {
    const { user } = renderScreen(allRoutes(SINGLE_LINE));

    await waitForSource();
    await waitFor(() => {
      expect(screen.getByLabelText(t.fields.supplier)).toHaveTextContent(SUPPLIER_LABEL);
    });

    await user.click(screen.getByLabelText(t.fields.businessUnit));
    await user.click(screen.getByRole('option', { name: 'SAMPLE-BU-01 · 합성 사업부 가' }));
    await pickDate(user, screen.getByLabelText(t.fields.orderDate), '2026-08-17');

    expect(screen.getByText(t.actionReasons.unavailable)).toBeInTheDocument();
    expect(registerButton()).toBeDisabled();
  });

  it('ERP 발주번호와 상태 입력칸을 두지 않는다(계획 결정 6·7)', async () => {
    renderScreen(allRoutes(SINGLE_LINE));

    await waitForSource();

    expect(screen.getByLabelText(t.fields.supplier)).toBeInTheDocument();
    expect(screen.queryByLabelText(/ERP/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/상태/)).not.toBeInTheDocument();
  });
});
