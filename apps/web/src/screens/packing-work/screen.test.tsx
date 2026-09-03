import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { PopIdentityProvider, type PopIdentity } from '../../patterns/pop-identity';
import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import {
  BOX_CODE,
  BOX_NAME,
  HANDLING_UNIT_NO,
  ITEM_ID,
  LOT_A_ID,
  LOT_A_NO,
  LOT_B_ID,
  LOT_B_NO,
  PROCESS_ID,
  TERMINAL_ID,
  UOM_ID,
  WORKER_NO,
  WORK_ORDER_ID,
  createdUnit,
  parentUnit,
  targetLots,
  unitTypes,
} from './fixtures';
import { PackingWorkScreen } from './screen';

const t = messages.packingWork;

const ENTRY_ROUTE = `/pop/packing-work?workOrderId=${String(WORK_ORDER_ID)}&workerNo=${WORKER_NO}`;

/** 단말·공정을 아는 상태. 셸이 채우는 값이라 시험에서는 직접 넣는다. */
const IDENTIFIED: PopIdentity = {
  terminalId: TERMINAL_ID,
  processId: PROCESS_ID,
  workerNo: WORKER_NO,
};

const pathOf = (request: Request): string => new URL(request.url).pathname;

interface Options {
  /** 포장 대상 조회가 실패한다 */
  lotsFail?: boolean;
  /** 포장 유형 조회가 실패한다 */
  unitTypesFail?: boolean;
  /** 등록·확정 요청을 담아 둔다 */
  writes?: Request[];
  /** 취급 단위 등록 응답 상태. 기본 201 */
  createStatus?: number;
  /** 포장 확정 응답 상태. 기본 200 */
  packStatus?: number;
  /** 확정 실패 응답 본문 */
  packErrorBody?: unknown;
}

const routes = (options: Options): StubRoute[] => [
  {
    match: (request) => pathOf(request) === '/trace/lots',
    respond: () => {
      if (options.lotsFail === true) {
        return jsonResponse({ message: '조회 실패' }, { status: 500 });
      }

      return jsonResponse({ items: targetLots, page: { page: 1, size: 20, total: 2 } });
    },
  },
  {
    match: (request) => pathOf(request) === '/mdm/code-values',
    respond: () => {
      if (options.unitTypesFail === true) {
        return jsonResponse({ message: '조회 실패' }, { status: 500 });
      }

      return jsonResponse({ items: unitTypes, page: { page: 1, size: 200, total: 1 } });
    },
  },
  {
    match: (request) => request.method === 'GET' && pathOf(request) === '/inventory/handling-units',
    respond: () => jsonResponse({ items: [parentUnit], page: { page: 1, size: 100, total: 1 } }),
  },
  {
    match: (request) =>
      request.method === 'POST' && pathOf(request) === '/inventory/handling-units',
    respond: (request) => {
      options.writes?.push(request.clone());

      if (options.createStatus !== undefined && options.createStatus >= 400) {
        return jsonResponse({ message: '등록 거부' }, { status: options.createStatus });
      }

      return jsonResponse({ handlingUnit: createdUnit, contents: [] }, { status: 201 });
    },
  },
  {
    match: (request) => request.method === 'POST' && pathOf(request).endsWith(':pack'),
    respond: (request) => {
      options.writes?.push(request.clone());

      if (options.packStatus !== undefined && options.packStatus >= 400) {
        return jsonResponse(options.packErrorBody ?? { message: '거부' }, {
          status: options.packStatus,
        });
      }

      return jsonResponse({ handlingUnit: createdUnit, contents: [] });
    },
  },
];

/** 우단 《포장 단위》 안에서만 찾는다 — 같은 LOT 번호가 좌단에도 선다. */
const unitPane = () => within(screen.getByLabelText(t.unit.sectionLabel));
const scanPane = () => within(screen.getByLabelText(t.scan.sectionLabel));

const renderScreen = (options: Options = {}, route = ENTRY_ROUTE, identity = IDENTIFIED) =>
  renderWithProviders(
    <PopIdentityProvider value={identity}>
      <PackingWorkScreen />
    </PopIdentityProvider>,
    { fetch: createStubFetch(routes(options)), route },
  );

/** 유형을 고르고 LOT 하나를 수량과 함께 담는다 — 여러 시험이 같은 자리에서 시작한다. */
const chooseUnitType = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('combobox', { name: t.unit.typeLabel }));
  await user.click(screen.getByRole('option', { name: BOX_NAME }));
};

const packOneLine = async (
  user: ReturnType<typeof userEvent.setup>,
  lotNo: string,
  qty: string,
) => {
  await chooseUnitType(user);
  await user.click(await scanPane().findByRole('button', { name: `${lotNo} ${t.lotList.select}` }));
  await user.type(screen.getByLabelText(t.scan.quantityLabel), qty);
  await user.click(screen.getByRole('button', { name: t.scan.submit }));
};

/** 담아 둔 요청 하나를 꺼낸다 — 없으면 그 자리에서 멈춘다. */
const writeAt = (writes: readonly Request[], index: number): Request => {
  const request = writes[index];

  if (request === undefined) throw new Error(`${String(index)}번째 요청이 없습니다.`);

  return request;
};

const bodyOf = async (request: Request): Promise<Record<string, unknown>> =>
  (await request.json()) as Record<string, unknown>;

describe('P-02-08 포장 작업', () => {
  it('작업지시의 완료 LOT 을 완료 축으로 좁혀 세운다', async () => {
    const seen: string[] = [];

    renderWithProviders(
      <PopIdentityProvider value={IDENTIFIED}>
        <PackingWorkScreen />
      </PopIdentityProvider>,
      {
        fetch: createStubFetch([
          ...routes({}).map((route) => ({
            ...route,
            respond: (request: Request) => {
              seen.push(request.url);

              return route.respond(request);
            },
          })),
        ]),
        route: ENTRY_ROUTE,
      },
    );

    expect(await screen.findByText(LOT_A_NO)).toBeInTheDocument();

    const lotsCall = seen.find((url) => new URL(url).pathname === '/trace/lots');

    expect(lotsCall).toBeDefined();

    const query = new URL(lotsCall ?? '').searchParams;

    expect(query.get('workOrderId')).toBe(String(WORK_ORDER_ID));
    expect(query.get('completed')).toBe('true');
  });

  it('작업지시를 모르면 대상을 부르지 않고 그 사실을 말한다', async () => {
    renderScreen({}, `/pop/packing-work?workerNo=${WORKER_NO}`);

    /* 배너와 담기 아래 사유가 같은 말을 한다 — 둘 다 이 사실을 말해야 한다 */
    expect((await screen.findAllByText(t.entry.missingWorkOrder)).length).toBeGreaterThan(0);
  });

  it('사번이 없으면 포장을 시작할 수 없다고 말한다', async () => {
    renderScreen({}, `/pop/packing-work?workOrderId=${String(WORK_ORDER_ID)}`);

    expect((await screen.findAllByText(t.entry.missingWorker)).length).toBeGreaterThan(0);
  });

  it('대상 목록이 실패하면 배너로 말한다', async () => {
    renderScreen({ lotsFail: true });

    expect(await screen.findByText(t.lotList.loadFailed)).toBeInTheDocument();
  });

  it('「잔여」 열을 세우지 않고 그 사실을 밝힌다', async () => {
    renderScreen();

    expect(await screen.findByText(LOT_A_NO)).toBeInTheDocument();
    expect(screen.getByText(t.lotList.remainingPending)).toBeInTheDocument();
    expect(screen.getByText(t.lotList.initialQtyColumn)).toBeInTheDocument();
  });

  it('유형을 고르기 전에는 담기가 막히고 사유가 보인다', async () => {
    const user = userEvent.setup();

    renderScreen();

    await user.click(
      await scanPane().findByRole('button', { name: `${LOT_A_NO} ${t.lotList.select}` }),
    );

    expect(screen.getByRole('button', { name: t.scan.submit })).toBeDisabled();
    expect(screen.getByText(t.scan.blockedNoType)).toBeInTheDocument();
  });

  it('첫 담기가 포장 단위를 만들고 번호를 보인다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });

    expect(unitPane().getByText(t.unit.numberPending)).toBeInTheDocument();

    await packOneLine(user, LOT_A_NO, '100');

    expect(await unitPane().findByText(HANDLING_UNIT_NO)).toBeInTheDocument();
    expect(writes).toHaveLength(1);

    const created = writeAt(writes, 0);
    const body = await bodyOf(created);

    expect(body.handlingUnitTypeCode).toBe(BOX_CODE);
    /* ⛔ 등록에 내용물을 싣지 않는다 — 전량은 확정 한 번이 싣는다 */
    expect(body.contents).toBeUndefined();
    /* ⛔ 「있다」로 보지 않는다 — 빈 키도 헤더로는 실린다. 서버는 그것을 키로 세지 않는다 */
    expect(created.headers.get('Idempotency-Key') ?? '').not.toBe('');
    expect(created.headers.get('X-Worker-No')).toBe(WORKER_NO);
  });

  it('같은 LOT 을 다시 담으면 행이 늘지 않고 수량이 합산된다', async () => {
    const user = userEvent.setup();

    renderScreen();

    await packOneLine(user, LOT_A_NO, '100');
    expect(await unitPane().findByText(HANDLING_UNIT_NO)).toBeInTheDocument();

    await user.type(screen.getByLabelText(t.scan.quantityLabel), '50');
    await user.click(screen.getByRole('button', { name: t.scan.submit }));

    /* 행의 수량과 아래 합계가 둘 다 150 이다 — 행이 늘었다면 100 과 50 으로 갈라진다 */
    expect(await unitPane().findAllByText('150')).toHaveLength(2);
    expect(unitPane().getAllByText(LOT_A_NO)).toHaveLength(1);
  });

  it('스캔 칸으로 읽은 코드가 목록에 없으면 인라인으로 말한다', async () => {
    const user = userEvent.setup();

    renderScreen();

    expect(await screen.findByText(LOT_A_NO)).toBeInTheDocument();

    await user.type(screen.getByLabelText(t.scan.label), 'LOT-SAMPLE-9999{enter}');

    expect(screen.getByText(t.scan.unknownLot)).toBeInTheDocument();
  });

  it('스캔한 코드가 목록에 있으면 그 LOT 이 담을 대상이 된다', async () => {
    const user = userEvent.setup();

    renderScreen();

    await chooseUnitType(user);
    await user.type(screen.getByLabelText(t.scan.label), `${LOT_A_NO}{enter}`);
    await user.type(screen.getByLabelText(t.scan.quantityLabel), '100');
    await user.click(screen.getByRole('button', { name: t.scan.submit }));

    expect(await unitPane().findByText(LOT_A_NO)).toBeInTheDocument();
  });

  it('수량이 비었거나 0 이하면 담지 않고 사유를 가른다', async () => {
    const user = userEvent.setup();

    renderScreen();

    await chooseUnitType(user);
    await user.click(scanPane().getByRole('button', { name: `${LOT_A_NO} ${t.lotList.select}` }));
    await user.click(screen.getByRole('button', { name: t.scan.submit }));

    expect(screen.getByText(t.scan.quantityRequired)).toBeInTheDocument();

    await user.type(screen.getByLabelText(t.scan.quantityLabel), '0');
    await user.click(screen.getByRole('button', { name: t.scan.submit }));

    expect(screen.getByText(t.scan.quantityPositive)).toBeInTheDocument();
    expect(unitPane().getByText(t.unit.numberPending)).toBeInTheDocument();
  });

  it('LOT 이 둘 이상 담기면 혼적을 경고하되 확정을 막지 않는다', async () => {
    const user = userEvent.setup();

    renderScreen();

    await packOneLine(user, LOT_A_NO, '100');
    expect(await unitPane().findByText(HANDLING_UNIT_NO)).toBeInTheDocument();

    await user.click(scanPane().getByRole('button', { name: `${LOT_B_NO} ${t.lotList.select}` }));
    await user.type(screen.getByLabelText(t.scan.quantityLabel), '30');
    await user.click(screen.getByRole('button', { name: t.scan.submit }));

    expect(await screen.findByText(t.contents.mixedTitle)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.confirm.submit })).toBeEnabled();
  });

  it('담은 것이 없으면 확정이 막히고 사유가 보인다', async () => {
    renderScreen();

    expect(await screen.findByText(LOT_A_NO)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.confirm.submit })).toBeDisabled();
    expect(screen.getByText(t.confirm.blockedNoType)).toBeInTheDocument();
  });

  it('확정이 담은 것 전량과 멱등 키·사번을 싣는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });

    await packOneLine(user, LOT_A_NO, '100');
    expect(await unitPane().findByText(HANDLING_UNIT_NO)).toBeInTheDocument();

    await user.click(scanPane().getByRole('button', { name: `${LOT_B_NO} ${t.lotList.select}` }));
    await user.type(screen.getByLabelText(t.scan.quantityLabel), '30');
    await user.click(screen.getByRole('button', { name: t.scan.submit }));

    await user.click(await screen.findByRole('button', { name: t.confirm.submit }));

    await waitFor(() => {
      expect(writes).toHaveLength(2);
    });

    const pack = writeAt(writes, 1);

    expect(new URL(pack.url).pathname).toBe(
      `/inventory/handling-units/${String(createdUnit.handlingUnitId)}:pack`,
    );
    expect(pack.headers.get('Idempotency-Key') ?? '').not.toBe('');
    expect(pack.headers.get('X-Worker-No')).toBe(WORKER_NO);

    const body = await bodyOf(pack);

    /* ⚠ 집합을 통째로 치환한다 — 담은 것 «전부»를 싣지 않으면 앞 행이 서버에서 지워진다 */
    expect(body.contents).toEqual([
      { itemId: ITEM_ID, lotId: LOT_A_ID, qty: 100, uomId: UOM_ID },
      { itemId: ITEM_ID, lotId: LOT_B_ID, qty: 30, uomId: UOM_ID },
    ]);
    expect(body.businessDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  });

  it('확정이 끝나면 다음 포장을 새로 시작할 수 있다', async () => {
    const user = userEvent.setup();

    renderScreen();

    await packOneLine(user, LOT_A_NO, '100');
    expect(await unitPane().findByText(HANDLING_UNIT_NO)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.confirm.submit }));

    expect(await screen.findByText(t.confirm.done)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.confirm.startNext }));

    expect(unitPane().getByText(t.unit.numberPending)).toBeInTheDocument();
    expect(unitPane().getByText(t.contents.empty)).toBeInTheDocument();
  });

  /**
   * ⛔ **확정을 마친 포장을 다시 확정하지 않는다.** 확정해도 담은 것은 화면에 남아 있어,
   * 막지 않으면 버튼이 계속 눌린다 — 두 번째 요청은 «새» 멱등 키로 나가 서버가 앞 쓰기와
   * 묶어 주지 못하고, 성공 배너가 서 있는 동안에는 그 실패도 화면에 서지 않는다.
   */
  it('확정을 마치면 확정 버튼이 잠기고 다시 보내지 않는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });

    await packOneLine(user, LOT_A_NO, '100');
    expect(await unitPane().findByText(HANDLING_UNIT_NO)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.confirm.submit }));

    expect(await screen.findByText(t.confirm.done)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.confirm.submit })).toBeDisabled();
    expect(screen.getByText(t.confirm.blockedPacked)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.confirm.submit }));

    /* 등록 1건 + 확정 1건. 세 번째가 있으면 같은 포장을 두 번 확정한 것이다 */
    expect(writes).toHaveLength(2);
  });

  it('이미 확정된 409 를 그 말로 되돌린다', async () => {
    const user = userEvent.setup();

    renderScreen({ packStatus: 409 });

    await packOneLine(user, LOT_A_NO, '100');
    expect(await unitPane().findByText(HANDLING_UNIT_NO)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.confirm.submit }));

    expect(await screen.findByText(t.error.alreadyPacked)).toBeInTheDocument();
    expect(screen.queryByText(t.error.emptyContents)).not.toBeInTheDocument();
  });

  /**
   * 400 은 사용자가 할 일이 409 와 다르다 — 담은 것을 채우면 풀린다. 서버가 사유를 싣지
   * 않고 되돌릴 때 그 자리를 화면이 채우는지 본다.
   */
  it('빈 내용물로 되돌아온 400 을 409 와 다르게 말한다', async () => {
    const user = userEvent.setup();

    renderScreen({ packStatus: 400, packErrorBody: {} });

    await packOneLine(user, LOT_A_NO, '100');
    expect(await unitPane().findByText(HANDLING_UNIT_NO)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.confirm.submit }));

    expect(await screen.findByText(t.error.emptyContents)).toBeInTheDocument();
    expect(screen.queryByText(t.error.alreadyPacked)).not.toBeInTheDocument();
  });

  it('포장 유형 목록이 실패하면 고르지 못하게 하고 그 사실을 말한다', async () => {
    renderScreen({ unitTypesFail: true });

    expect(await screen.findByText(t.unit.typeLoadFailed)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: t.unit.typeLabel })).toBeDisabled();
  });

  it('취급 단위 등록이 실패하면 담기지 않고 배너로 말한다', async () => {
    const user = userEvent.setup();

    renderScreen({ createStatus: 500 });

    await packOneLine(user, LOT_A_NO, '100');

    expect(await screen.findByText(t.unit.createFailed)).toBeInTheDocument();
    expect(unitPane().getByText(t.unit.numberPending)).toBeInTheDocument();
    expect(unitPane().getByText(t.contents.empty)).toBeInTheDocument();
  });

  it('담기 시작하면 유형과 상위 포장을 바꿀 수 없다', async () => {
    const user = userEvent.setup();

    renderScreen();

    await packOneLine(user, LOT_A_NO, '100');

    expect(await unitPane().findByText(HANDLING_UNIT_NO)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: t.unit.typeLabel })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: t.unit.parentLabel })).toBeDisabled();
    expect(screen.getByText(t.unit.lockedNotice)).toBeInTheDocument();
  });
});
