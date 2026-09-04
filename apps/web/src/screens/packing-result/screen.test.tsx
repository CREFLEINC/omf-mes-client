import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { PopIdentityProvider } from '../../patterns/pop-identity';
import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';

import { PackingResultScreen } from './screen';

const t = messages.packingResult;

const pathOf = (request: Request): string => new URL(request.url).pathname;
const queryOf = (request: Request): URLSearchParams => new URL(request.url).searchParams;

/** 배분 하나. 값은 전부 지어낸 것이다. */
const allocation = (overrides: Record<string, unknown> = {}) => ({
  shipmentLotAllocationId: 9001,
  shipmentId: 501,
  shipmentLineId: 701,
  itemId: 5001,
  itemCode: 'SYN-FG-1001',
  lotId: 8001,
  lotNo: 'SYN-LOT-000123450',
  warehouseId: 1001,
  allocatedQty: 180,
  uomId: 920001,
  oqcPassed: true,
  packedQty: 0,
  ...overrides,
});

interface Options {
  /** 둘째 스캔의 서버 판정. 화면이 스스로 만들지 않는 값이다. */
  match?: { matched: boolean; reasonCode?: string };
  /** 첫 스캔이 아무것도 못 찾은 상태 */
  labelNotFound?: boolean;
  /** 단말 게이팅 플래그 */
  canInputResult?: boolean;
  /** 이 단말에 «그 공정 행이 아예 없는» 상태 — 구성되지 않은 공정은 열려 있지 않다 */
  missingProcessRow?: boolean;
  /** 쓰기 요청을 담아 둔다 — 확정이 세 단계를 도는지 본다 */
  writes?: Request[];
}

const handlingUnitBody = {
  handlingUnit: {
    handlingUnitId: 4001,
    handlingUnitNo: 'SYN-CTN-0091',
    handlingUnitTypeCode: 'CARTON',
    statusCode: 'SYN-OPEN',
  },
  contents: [],
};

const renderScreen = (options: Options = {}) => {
  const routes: StubRoute[] = [
    {
      match: (request) => pathOf(request).endsWith('/processes'),
      respond: () =>
        jsonResponse({
          items:
            options.missingProcessRow === true
              ? [{ processId: 999, canInputResult: true }]
              : [{ processId: 301, canInputResult: options.canInputResult ?? true }],
        }),
    },
    {
      match: (request) => pathOf(request) === '/mdm/code-values',
      respond: () =>
        jsonResponse({
          items: [{ codeValueId: 1, codeGroupId: 9, code: 'CARTON', codeName: '카톤' }],
          page: { page: 1, size: 50, total: 1 },
        }),
    },
    {
      match: (request) =>
        request.method === 'GET' && pathOf(request) === '/inventory/handling-units',
      respond: () => jsonResponse({ items: [], page: { page: 1, size: 50, total: 0 } }),
    },
    {
      match: (request) =>
        request.method === 'POST' && pathOf(request) === '/inventory/handling-units',
      respond: (request) => {
        options.writes?.push(request.clone());

        return jsonResponse(handlingUnitBody, { status: 201, headers: { ETag: '"7"' } });
      },
    },
    {
      match: (request) => pathOf(request) === '/inventory/handling-units/4001:pack',
      respond: (request) => {
        options.writes?.push(request.clone());

        return jsonResponse(handlingUnitBody);
      },
    },
    {
      match: (request) =>
        request.method === 'PUT' &&
        pathOf(request).startsWith('/logistics/shipment-lot-allocations/'),
      respond: (request) => {
        options.writes?.push(request.clone());

        return jsonResponse(allocation({ handlingUnitId: 4001 }));
      },
    },
    {
      match: (request) =>
        request.method === 'GET' && pathOf(request) === '/logistics/shipment-lot-allocations',
      respond: (request) => {
        const query = queryOf(request);
        const page = { page: 1, size: 50, total: 1 };

        /* ① 납품라벨 스캔 — 빈 목록이 「없는 라벨」이다(계약이 404 를 내지 않는다). */
        if (query.has('q')) {
          return options.labelNotFound === true
            ? jsonResponse({ items: [], page })
            : jsonResponse({ items: [allocation()], page });
        }

        /* ② 생산LOT 스캔 — 판정은 서버가 내린다. */
        if (query.has('lotQ')) {
          const match = options.match ?? { matched: true };

          return jsonResponse({ items: match.matched ? [allocation()] : [], page, match });
        }

        return jsonResponse({ items: [allocation()], page });
      },
    },
  ];

  return renderWithProviders(
    <PopIdentityProvider value={{ terminalId: 101, processId: 301, workerNo: '3391' }}>
      <PackingResultScreen />
    </PopIdentityProvider>,
    { fetch: createStubFetch(routes), route: '/pop/packing' },
  );
};

const scan = async (
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  code: string,
): Promise<void> => {
  await user.type(screen.getByLabelText(label), code);
  const buttons = screen.getAllByRole('button', { name: t.scan.submit });
  const index = label === t.scan.label.deliveryLabel ? 0 : 1;

  await user.click(buttons[index] as HTMLElement);
};

describe('PackingResultScreen', () => {
  it('들어오면 두 스캔 칸이 서고 생산LOT 칸은 «잠긴 채» 사유를 말한다', () => {
    renderScreen();

    expect(screen.getByRole('heading', { name: t.title })).toBeTruthy();
    expect(screen.getByLabelText(t.scan.label.deliveryLabel)).toBeTruthy();
    expect(screen.getByLabelText(t.scan.label.productionLot)).toHaveProperty('disabled', true);
    expect(screen.getByText(t.scan.lotLocked)).toBeTruthy();
  });

  it('납품라벨을 읽으면 어느 출하인지 서고 생산LOT 칸이 열린다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scan(user, t.scan.label.deliveryLabel, 'SYN-DL-0455-001');

    expect(await screen.findByText(t.header.shipment(501))).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByLabelText(t.scan.label.productionLot)).toHaveProperty('disabled', false);
    });
  });

  it('없는 납품라벨은 «빈 목록»으로 오고 화면이 그것을 사유로 말한다', async () => {
    const user = userEvent.setup();
    renderScreen({ labelNotFound: true });

    await scan(user, t.scan.label.deliveryLabel, 'SYN-DL-없음');

    expect(await screen.findByText(t.match.labelNotFound)).toBeTruthy();
  });

  it('매칭되면 «서버가 준 판정»을 그대로 보이고 수량 패드가 선다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scan(user, t.scan.label.deliveryLabel, 'SYN-DL-0455-001');
    await scan(user, t.scan.label.productionLot, 'SYN-LOT-000123450');

    expect(await screen.findByText(t.match.ok)).toBeTruthy();
    expect(screen.getByLabelText(t.qty.label)).toBeTruthy();
  });

  it('⛔ 품목이 다르면 «계약이 준 품목 코드»로 막는다 — 화면이 대응표를 갖지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({ match: { matched: false, reasonCode: 'LABEL_ITEM_MISMATCH' } });

    await scan(user, t.scan.label.deliveryLabel, 'SYN-DL-0455-001');
    await scan(user, t.scan.label.productionLot, 'SYN-LOT-다른품목');

    expect(await screen.findByText(t.match.itemMismatch('SYN-FG-1001'))).toBeTruthy();
    expect(screen.queryByLabelText(t.qty.label)).toBeNull();
  });

  it('⛔ 배분에 없는 LOT 은 그 사유로 막는다', async () => {
    const user = userEvent.setup();
    renderScreen({ match: { matched: false, reasonCode: 'LOT_NOT_ALLOCATED' } });

    await scan(user, t.scan.label.deliveryLabel, 'SYN-DL-0455-001');
    await scan(user, t.scan.label.productionLot, 'SYN-LOT-남의것');

    expect(await screen.findByText(t.match.notAllocated)).toBeTruthy();
  });

  it('단말 플래그가 닫혀 있으면 확정을 막고 «권한이 없다»고 말한다', async () => {
    renderScreen({ canInputResult: false });

    expect(await screen.findByText(t.locks.gateDenied)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.actions.confirm })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('⛔ 그 공정 «행이 없으면» 막는다 — 구성되지 않은 공정을 열어 두지 않는다', async () => {
    renderScreen({ missingProcessRow: true });

    expect(await screen.findByText(t.locks.gateDenied)).toBeTruthy();
  });

  it('진행에 «예상 포장 수»와 진행 막대를 그리지 않는다 — 낼 근거가 없다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scan(user, t.scan.label.deliveryLabel, 'SYN-DL-0455-001');

    expect(await screen.findByText(/미포장/u)).toBeTruthy();
    expect(screen.queryByText(/예상/u)).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

/** 매칭까지 마친 상태를 만든다 — 담기·확정 시험의 공통 전제다. */
const scanUntilMatched = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await scan(user, t.scan.label.deliveryLabel, 'SYN-DL-0455-001');
  await scan(user, t.scan.label.productionLot, 'SYN-LOT-000123450');
  await screen.findByText(t.match.ok);
};

/** 키패드로 수량을 치고 담는다. */
const pack = async (user: ReturnType<typeof userEvent.setup>, digits: string): Promise<void> => {
  const pad = screen.getByLabelText(t.qty.label);

  for (const digit of digits) {
    await user.click(within(pad).getByRole('button', { name: digit }));
  }

  await user.click(within(pad).getByRole('button', { name: /확인|담기/u }));
};

describe('PackingResultScreen — 담기와 확정', () => {
  it('키패드로 친 수량이 화면에 보인다 — 누른 값이 어디로 갔는지 보이지 않으면 오입력을 못 알아챈다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scanUntilMatched(user);

    const pad = screen.getByLabelText(t.qty.label);

    await user.click(within(pad).getByRole('button', { name: '1' }));
    await user.click(within(pad).getByRole('button', { name: '2' }));

    expect(screen.getByText('12')).toBeTruthy();
  });


  it('같은 LOT 을 다시 담으면 «합쳤다고 말한다» — 조용히 합치면 중복 스캔을 못 알아챈다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scanUntilMatched(user);
    await pack(user, '120');
    await scanUntilMatched(user);
    await pack(user, '60');

    expect(await screen.findByText(t.qty.merged(120, 60, 180))).toBeTruthy();
  });

  it('⛔ 잔여를 넘기면 한도를 말하고 담기를 잠근다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scanUntilMatched(user);

    const pad = screen.getByLabelText(t.qty.label);
    for (const digit of '181') {
      await user.click(within(pad).getByRole('button', { name: digit }));
    }

    expect(await screen.findByText(t.qty.overRemaining(180))).toBeTruthy();
  });

  it('⭐ 담는 동안 «포장 번호»가 선다 — 번호는 서버가 매기므로 먼저 만들어 받아 온다', async () => {
    const user = userEvent.setup();
    renderScreen();

    /* 담기 전에는 번호가 없다는 사실을 적는다 — 빈 자리로 두지 않는다. */
    expect(screen.getByText(t.fields.handlingUnitPending)).toBeTruthy();

    await scanUntilMatched(user);
    await pack(user, '60');
    await user.click(screen.getByRole('combobox', { name: t.fields.handlingUnitType }));
    await user.click(await screen.findByRole('option', { name: '카톤' }));

    expect(await screen.findByText('SYN-CTN-0091')).toBeTruthy();
  });

  it('확정하면 세 단계를 돌고 «포장 번호»를 말한 뒤 담긴 것을 비운다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];
    renderScreen({ writes });

    await scanUntilMatched(user);
    await pack(user, '120');

    await user.click(screen.getByRole('combobox', { name: t.fields.handlingUnitType }));
    await user.click(await screen.findByRole('option', { name: '카톤' }));

    await user.click(screen.getByRole('button', { name: t.actions.confirm }));

    expect(await screen.findByText(t.confirmed('SYN-CTN-0091'))).toBeTruthy();
    expect(writes.map((request) => `${request.method} ${pathOf(request)}`)).toEqual([
      'POST /inventory/handling-units',
      'POST /inventory/handling-units/4001:pack',
      'PUT /logistics/shipment-lot-allocations/9001',
    ]);
    expect(screen.getByText(t.contents.empty)).toBeTruthy();
  });
});
