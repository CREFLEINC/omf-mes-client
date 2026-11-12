import { messages } from '@omf-mes/i18n';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import {
  balance,
  itemFixtures,
  locationFixtures,
  lotFixtures,
  partnerFixtures,
  uomFixtures,
  warehouseFixtures,
} from './fixtures';
import { StockStatusScreen } from './screen';

/*
 * FR-035 W-01-07 재고 현황 — 입하 LOT 칸 · 거르기(005 계약 §13 · screens/W-01-07.md).
 * 값은 전부 지어낸 합성값이다.
 */

const t = messages.stockStatus;

const ROUTE = '/logistics/stock-status';
const BALANCES_PATH = '/inventory/balances';
const IL_NO = 'IL-20261112-0001';

const LOT_ROWS = [
  balance({ groupBy: 'LOT', lotId: 9401, inboundLotId: 9901, inboundLotNo: IL_NO }),
  /* 입하 LOT 이 없는 LOT(생산 · 재생) — 칸은 빈칸이다. */
  balance({ groupBy: 'LOT', lotId: 9402, onHandQty: 30, availableQty: 30, blockedQty: 0 }),
];

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

const routes = (): StubRoute[] => [
  {
    match: (request) => isGet(request, BALANCES_PATH),
    respond: () => jsonResponse(listBody(LOT_ROWS)),
  },
  lookupRoute('/mdm/warehouses', warehouseFixtures),
  lookupRoute('/mdm/locations', locationFixtures),
  lookupRoute('/mdm/items', itemFixtures),
  lookupRoute('/trace/lots', lotFixtures),
  lookupRoute('/mdm/uoms', uomFixtures),
  lookupRoute('/mdm/partners', partnerFixtures),
  {
    match: (request) =>
      request.method === 'GET' && /^\/mdm\/items\/\d+$/.test(new URL(request.url).pathname),
    respond: (request) => {
      const itemId = Number(new URL(request.url).pathname.split('/').at(-1));
      const item = itemFixtures.find((each) => each.itemId === itemId);

      return item === undefined
        ? jsonResponse({ message: '' }, { status: 404 })
        : jsonResponse({ item, editability: { editableFields: [], readOnlyFields: [] } });
    },
  },
  {
    match: (request) =>
      request.method === 'GET' && /^\/trace\/lots\/\d+$/.test(new URL(request.url).pathname),
    respond: () => jsonResponse({ message: '' }, { status: 404 }),
  },
];

const renderScreen = (search: string) => {
  const balanceRequests: URL[] = [];
  const stub = createStubFetch(routes());
  const fetch: StubFetch = async (request) => {
    if (isGet(request, BALANCES_PATH)) balanceRequests.push(new URL(request.url));

    return stub(request);
  };

  renderWithProviders(<StockStatusScreen />, { fetch, route: `${ROUTE}${search}` });

  return { balanceRequests, user: userEvent.setup() };
};

const lastRequest = (requests: URL[]): URL => {
  const last = requests.at(-1);
  if (last === undefined) throw new Error('잔액 요청이 없습니다.');

  return last;
};

describe('FR-035 W-01-07 재고 현황 — 입하 LOT 칸 · 거르기', () => {
  it('FR-035 LOT별 표에 「입하 LOT」 칸이 있고, 입하 LOT 이 없는 줄은 빈칸이다', async () => {
    renderScreen('?wh=9101&view=lot&item=9301');

    expect(await screen.findByRole('columnheader', { name: t.table.inboundLot })).toBeVisible();
    expect(
      screen.getByRole('button', { name: t.actions.filterInboundLot(IL_NO) }),
    ).toHaveTextContent(IL_NO);
    /* 둘째 줄(입하 LOT 없음)에는 번호도 대시도 없다 — 단추는 하나뿐이다. */
    expect(screen.getAllByRole('button', { name: /^입하 LOT .+로 거르기$/ })).toHaveLength(1);
  });

  it('G2 L21 입하 LOT 칸에 번호를 넣고 Enter 를 누르면 그 번호로 조회한다', async () => {
    const { balanceRequests, user } = renderScreen('');

    const field = await screen.findByRole('searchbox', { name: t.fields.inboundLotNo });
    await user.type(field, `${IL_NO}{Enter}`);

    await waitFor(() =>
      expect(lastRequest(balanceRequests).searchParams.get('inboundLotNo')).toBe(IL_NO),
    );
  });

  it('G2 L21 번호와 Enter 가 한꺼번에 와도(스캐너 · 붙여 넣기) 칸에 든 번호로 조회한다', async () => {
    const { balanceRequests } = renderScreen('');

    const field = (await screen.findByRole('searchbox', {
      name: t.fields.inboundLotNo,
    })) as HTMLInputElement;
    /* 화면 상태가 따라오기 전에 Enter 가 닿은 셈 — 칸의 글자만 바뀌어 있다. */
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, IL_NO);
    fireEvent.keyDown(field, { key: 'Enter' });

    await waitFor(() =>
      expect(lastRequest(balanceRequests).searchParams.get('inboundLotNo')).toBe(IL_NO),
    );
  });

  it('FR-035 품목별 보기에는 「입하 LOT」 칸이 없다', async () => {
    renderScreen('?wh=9101');

    await screen.findAllByRole('row');
    expect(screen.queryByRole('columnheader', { name: t.table.inboundLot })).toBeNull();
  });

  it('FR-035 「입하 LOT 번호」 칸만 채워도 창고 없이 조회되고 요청에 inboundLotNo 가 실린다', async () => {
    const { balanceRequests, user } = renderScreen('');

    await user.type(screen.getByRole('searchbox', { name: t.fields.inboundLotNo }), IL_NO);

    /* 범위 안내(창고 필수)가 사라지고 조회가 풀린다. */
    expect(screen.queryByText(t.reasons.warehouseRequired)).toBeNull();
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(balanceRequests.length).toBeGreaterThan(0);
    });
    const request = lastRequest(balanceRequests);
    expect(request.searchParams.get('inboundLotNo')).toBe(IL_NO);
    expect(request.searchParams.has('warehouseId')).toBe(false);
    expect(await screen.findByText(t.filters.chipInboundLotNo(IL_NO))).toBeInTheDocument();
  });

  it('FR-035 주소에 입하 LOT 조건만 있어도 조회된다 — 범위 안내 없음', async () => {
    const { balanceRequests } = renderScreen(`?il=9901:${IL_NO}`);

    await waitFor(() => {
      expect(balanceRequests.length).toBeGreaterThan(0);
    });
    expect(lastRequest(balanceRequests).searchParams.get('inboundLotId')).toBe('9901');
    expect(lastRequest(balanceRequests).searchParams.has('warehouseId')).toBe(false);
    expect(screen.queryByText(t.reasons.warehouseRequired)).toBeNull();
  });

  it('FR-035 행의 입하 LOT 번호를 누르면 inboundLotId 로 거르고, 거르기 칩 「입하 LOT {번호}」의 ✕ 로 푼다', async () => {
    const { balanceRequests, user } = renderScreen('?wh=9101&view=lot&item=9301');

    await user.click(
      await screen.findByRole('button', { name: t.actions.filterInboundLot(IL_NO) }),
    );

    await waitFor(() => {
      expect(lastRequest(balanceRequests).searchParams.get('inboundLotId')).toBe('9901');
    });
    /* 다른 조건은 그대로다. */
    expect(lastRequest(balanceRequests).searchParams.get('warehouseId')).toBe('9101');
    expect(lastRequest(balanceRequests).searchParams.get('groupBy')).toBe('LOT');

    const chip = screen.getByText(t.filters.chipInboundLot(IL_NO));
    expect(chip).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.filters.chipRemoveInboundLot }));

    await waitFor(() => {
      expect(lastRequest(balanceRequests).searchParams.has('inboundLotId')).toBe(false);
    });
    expect(screen.queryByText(t.filters.chipInboundLot(IL_NO))).toBeNull();
    expect(within(document.body).queryByText(t.reasons.warehouseRequired)).toBeNull();
  });
});
