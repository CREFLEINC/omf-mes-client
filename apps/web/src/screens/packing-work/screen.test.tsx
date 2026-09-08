import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
  ITEM_CODE,
  ITEM_ID,
  LOT_A_ID,
  LOT_A_NO,
  LOT_B_ID,
  LOT_B_NO,
  PROCESS_ID,
  TERMINAL_ID,
  UOM_CODE,
  UOM_ID,
  WORKER_NO,
  WORK_ORDER_ID,
  createdUnit,
  parentUnit,
  targetLots,
  unitTypes,
} from './fixtures';
import { STORAGE_KEY as OUTBOX_STORAGE_KEY } from './outbox';
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
  /** 품목 조회가 실패한다 */
  itemFails?: boolean;
  /** 확정 요청을 담아 둔다. **확정은 한 건이다** — 담기는 서버를 부르지 않는다 */
  writes?: Request[];
  /** 확정 응답 상태. 기본 201 */
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
    match: (request) => pathOf(request) === `/mdm/items/${String(ITEM_ID)}`,
    respond: () => {
      if (options.itemFails === true) {
        return jsonResponse({ message: '조회 실패' }, { status: 500 });
      }

      return jsonResponse({
        item: { itemId: ITEM_ID, itemCode: ITEM_CODE, itemName: '샘플 품목' },
        editability: { editableFields: [] },
      });
    },
  },
  {
    match: (request) => pathOf(request) === '/mdm/uoms',
    respond: () =>
      jsonResponse({
        items: [{ uomId: UOM_ID, uomCode: UOM_CODE, uomName: '개', isActive: true }],
        page: { page: 1, size: 20, total: 1 },
      }),
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

      if (options.packStatus !== undefined && options.packStatus >= 400) {
        return jsonResponse(options.packErrorBody ?? { message: '거부' }, {
          status: options.packStatus,
        });
      }

      return jsonResponse({ handlingUnit: createdUnit, contents: [] }, { status: 201 });
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
    /* ⚠ 사번은 주소보다 셸·세션이 먼저다 — 셋 다 없을 때를 잰다(2026-09-08). */
    renderScreen({}, `/pop/packing-work?workOrderId=${String(WORK_ORDER_ID)}`, {
      ...IDENTIFIED,
      workerNo: null,
    });

    expect((await screen.findAllByText(t.entry.missingWorker)).length).toBeGreaterThan(0);
  });

  it('대상 목록이 실패하면 배너로 말한다', async () => {
    renderScreen({ lotsFail: true });

    expect(await screen.findByText(t.lotList.loadFailed)).toBeInTheDocument();
  });

  /*
   * ⛔ **「잔여」라고 적지 않는다.** 계약이 그 값을 안 내려 주는데 그 자리에 최초 수량을 놓으면
   * 두 번 포장한 LOT 이 아직 다 남은 것으로 읽힌다. **열 이름이 다른 값임을 말한다** — 스펙
   * §3 의 좌단은 LOT 과 수량 두 조각뿐이라 따로 문단을 두지 않는다.
   */
  it('「잔여」 대신 「최초 수량」으로 이름을 밝힌다', async () => {
    renderScreen();

    expect(await screen.findByText(LOT_A_NO)).toBeInTheDocument();
    expect(screen.getByText(t.lotList.initialQtyColumn)).toBeInTheDocument();
    expect(screen.queryByText('잔여')).not.toBeInTheDocument();
  });

  /*
   * ⭐ **유형 미선택은 담기를 잠그지 않는다** — 누를 수 있게 두고 «고칠 칸»으로 데려간다.
   * 앞선 판은 담기를 잠그고 그 아래에 사유를 늘 띄웠는데, 말하는 곳(왼쪽)과 고치는 곳
   * (오른쪽 유형 칸)이 갈려 있었다(사용자 지적).
   */
  /*
   * ⛔ **[ 직접 입력 ]은 «제출»이 아니라 «칸으로 옮기는» 버튼이다.** `type="submit"` 이면
   * 빈 코드로 폼이 제출돼 아무 일도 일어나지 않는다 — 손으로 치려고 눌렀는데 커서가 안
   * 간다(사용자 지적). 다른 스캔 화면 셋이 이미 이 동작이다.
   */
  it('[ 직접 입력 ]을 누르면 스캔 칸으로 커서가 간다', async () => {
    const user = userEvent.setup();

    renderScreen();

    const scanInput = await screen.findByLabelText(t.scan.label);
    /* 처음 커서는 이미 칸에 있다 — 다른 곳으로 옮겨 두고 버튼이 되돌리는지 본다. */
    await user.click(screen.getByLabelText(t.scan.quantityLabel));
    expect(scanInput).not.toHaveFocus();

    await user.click(screen.getByRole('button', { name: t.scan.manualEntry }));

    expect(scanInput).toHaveFocus();
  });

  /*
   * ⭐ **가까운 것부터 말한다.** 담기는 대상만 고르면 열리므로 빠진 것이 둘일 수 있다 —
   * 수량(버튼 옆)과 유형(건너편). 유형을 먼저 말하면 옆 칸을 비워 둔 채 건너편으로 보내고,
   * 돌아와 다시 눌러야 수량을 안다(사용자 지적).
   */
  it('수량이 비어 있으면 유형보다 수량을 먼저 말한다', async () => {
    const user = userEvent.setup();

    renderScreen();

    await user.click(
      await scanPane().findByRole('button', { name: `${LOT_A_NO} ${t.lotList.select}` }),
    );
    await user.click(screen.getByRole('button', { name: t.scan.submit }));

    expect(screen.getByText(t.scan.quantityRequired)).toBeInTheDocument();
    expect(screen.queryByText(t.unit.typeRequired)).not.toBeInTheDocument();
  });

  it('유형을 고르기 전에 담기를 누르면 유형 칸이 사유를 말한다', async () => {
    const user = userEvent.setup();

    renderScreen();

    await user.click(
      await scanPane().findByRole('button', { name: `${LOT_A_NO} ${t.lotList.select}` }),
    );
    await user.type(screen.getByLabelText(t.scan.quantityLabel), '100');

    const submit = screen.getByRole('button', { name: t.scan.submit });
    expect(submit).toBeEnabled();
    expect(screen.queryByText(t.unit.typeRequired)).not.toBeInTheDocument();

    await user.click(submit);

    /* DS `Select` 는 트리거를 `combobox` 로 낸다 — 버튼으로 찾으면 못 잡는다. */
    const typeSelect = screen.getByRole('combobox', { name: t.unit.typeLabel });
    expect(screen.getByText(t.unit.typeRequired)).toBeInTheDocument();
    expect(typeSelect).toHaveFocus();
    expect(typeSelect).toHaveAttribute('aria-invalid', 'true');
  });

  it('담기는 서버를 부르지 않고 번호 자리는 언제 생기는지 말한다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });

    await packOneLine(user, LOT_A_NO, '100');

    /*
     * ⭐ **담기는 서버를 부르지 않는다.** 등록을 확정 시점으로 옮겼기 때문이다 — 그래서 담는
     * 동안에는 번호가 없고, 그 자리는 언제 생기는지 말한다(스펙 §3 과 어긋나는 지점이다).
     */
    expect(writes).toHaveLength(0);
    expect(await unitPane().findByText(t.unit.numberPending)).toBeInTheDocument();
    expect(unitPane().queryByText(HANDLING_UNIT_NO)).not.toBeInTheDocument();
  });

  it('같은 LOT 을 다시 담으면 행이 늘지 않고 수량이 합산된다', async () => {
    const user = userEvent.setup();

    renderScreen();

    await packOneLine(user, LOT_A_NO, '100');
    expect(await unitPane().findByText(t.unit.numberPending)).toBeInTheDocument();

    await user.type(screen.getByLabelText(t.scan.quantityLabel), '50');
    await user.click(screen.getByRole('button', { name: t.scan.submit }));

    /* 행의 수량과 아래 합계가 둘 다 150 이다 — 행이 늘었다면 100 과 50 으로 갈라진다 */
    expect(await unitPane().findAllByText(`150 ${UOM_CODE}`)).toHaveLength(2);
    expect(unitPane().getAllByText(LOT_A_NO)).toHaveLength(1);
  });

  /**
   * 스펙 §3 은 내용물 행을 `LOT-…0031  ABC-123  100 EA` 로 그린다 — 「100」과 「100 EA」는
   * 다른 값이다. 단위 없이 숫자만 두면 읽는 사람이 자기가 아는 단위로 채워 읽는다.
   */
  it('담은 줄과 합계에 품목코드와 단위가 붙는다', async () => {
    const user = userEvent.setup();

    renderScreen();

    await packOneLine(user, LOT_A_NO, '100');

    expect(await unitPane().findByText(ITEM_CODE)).toBeInTheDocument();
    expect(unitPane().getAllByText(`100 ${UOM_CODE}`)).toHaveLength(2);
  });

  /* 이름이 아직 오지 않았으면 지어내지 않는다 — 숫자만 보이고 품목 자리는 비운 표를 쓴다. */
  it('품목 이름을 받지 못하면 수량만 보인다', async () => {
    const user = userEvent.setup();

    renderScreen({ itemFails: true });

    await packOneLine(user, LOT_A_NO, '100');

    expect(await unitPane().findByText(LOT_A_NO)).toBeInTheDocument();
    expect(unitPane().queryByText(ITEM_CODE)).not.toBeInTheDocument();
    expect(unitPane().getAllByText(`100 ${UOM_CODE}`)).toHaveLength(2);
  });

  /**
   * ⭐ **담고 나면 포커스가 스캔 칸으로 돌아와야 한다.** 작업자는 화면을 보지 않고 연달아
   * 읽는다 — 포커스가 「담기」 버튼에 남아 있으면 다음 스캔이 아무 데도 들어가지 않고
   * 사라지는데, 작업자는 읽었다고 믿고 넘어간다.
   *
   * 서버를 부르는 첫 담기뿐 아니라 **화면 안에서만 합산하는 두 번째 담기**도 같다.
   */
  it('담을 때마다 포커스가 스캔 칸으로 돌아온다', async () => {
    const user = userEvent.setup();

    renderScreen();

    await packOneLine(user, LOT_A_NO, '100');
    expect(await unitPane().findByText(t.unit.numberPending)).toBeInTheDocument();
    expect(screen.getByLabelText(t.scan.label)).toHaveFocus();

    await user.type(screen.getByLabelText(t.scan.quantityLabel), '50');
    await user.click(screen.getByRole('button', { name: t.scan.submit }));

    expect(await unitPane().findAllByText(`150 ${UOM_CODE}`)).toHaveLength(2);
    expect(screen.getByLabelText(t.scan.label)).toHaveFocus();
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
    expect(await unitPane().findByText(t.unit.numberPending)).toBeInTheDocument();

    await user.click(scanPane().getByRole('button', { name: `${LOT_B_NO} ${t.lotList.select}` }));
    await user.type(screen.getByLabelText(t.scan.quantityLabel), '30');
    await user.click(screen.getByRole('button', { name: t.scan.submit }));

    expect(await screen.findByText(t.contents.mixedTitle)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.confirm.submit })).toBeEnabled();
  });

  /*
   * 스펙 §6 —「포장 유형 미선택 · 내용물 0 → 확정 비활성」. **막는 것과 말하는 것은 다른
   * 축이다** — 둘 다 화면이 이미 말하고 있어(빈 유형 칸 · 「내용물이 비어 있습니다」)
   * 액션바가 되풀이하지 않는다(사용자 지적).
   */
  it('담은 것이 없으면 확정이 막힌다 — 사유를 액션바가 되풀이하지 않는다', async () => {
    renderScreen();

    expect(await screen.findByText(LOT_A_NO)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.confirm.submit })).toBeDisabled();
    /* 사유는 «화면이 이미 말하는 자리»에 있다 — 빈 유형 칸과 이 문장이다. */
    expect(screen.getByText(t.contents.empty)).toBeInTheDocument();
    /* ⛔ 액션바에는 「포장 확정 — …」로 시작하는 사유 문장이 서지 않는다. */
    expect(screen.queryByText(/^포장 확정 —/u)).not.toBeInTheDocument();
  });

  it('확정이 담은 것 전량과 멱등 키·사번을 싣는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });

    await packOneLine(user, LOT_A_NO, '100');
    expect(await unitPane().findByText(t.unit.numberPending)).toBeInTheDocument();

    await user.click(scanPane().getByRole('button', { name: `${LOT_B_NO} ${t.lotList.select}` }));
    await user.type(screen.getByLabelText(t.scan.quantityLabel), '30');
    await user.click(screen.getByRole('button', { name: t.scan.submit }));

    await user.click(await screen.findByRole('button', { name: t.confirm.submit }));

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    const pack = writeAt(writes, 0);

    expect(new URL(pack.url).pathname).toBe('/inventory/handling-units');
    /* ⛔ 「있다」로 보지 않는다 — 빈 키도 헤더로는 실린다. 서버는 그것을 키로 세지 않는다 */
    expect(pack.headers.get('Idempotency-Key') ?? '').not.toBe('');
    expect(pack.headers.get('X-Worker-No')).toBe(WORKER_NO);

    const body = await bodyOf(pack);

    expect(body.handlingUnitTypeCode).toBe(BOX_CODE);
    /* ⚠ 집합을 통째로 치환한다 — 담은 것 «전부»를 싣지 않으면 앞 행이 서버에서 지워진다 */
    expect(body.contents).toEqual([
      { itemId: ITEM_ID, lotId: LOT_A_ID, qty: 100, uomId: UOM_ID },
      { itemId: ITEM_ID, lotId: LOT_B_ID, qty: 30, uomId: UOM_ID },
    ]);
  });

  it('확정이 끝나면 다음 포장을 새로 시작할 수 있다', async () => {
    const user = userEvent.setup();

    renderScreen();

    await packOneLine(user, LOT_A_NO, '100');
    expect(await unitPane().findByText(t.unit.numberPending)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.confirm.submit }));

    expect(await screen.findByText(t.confirm.done)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.confirm.startNext }));

    expect(unitPane().getByText(t.unit.numberPending)).toBeInTheDocument();
    expect(unitPane().getByText(t.contents.empty)).toBeInTheDocument();
  });

  /**
   * 400 은 담은 것을 채우면 풀린다. 서버가 사유를 싣지 않고 되돌릴 때 그 자리를 화면이
   * 채우는지 본다.
   */
  it('빈 내용물로 되돌아온 400 을 그 말로 되돌린다', async () => {
    const user = userEvent.setup();

    renderScreen({ packStatus: 400, packErrorBody: {} });

    await packOneLine(user, LOT_A_NO, '100');
    expect(await unitPane().findByText(t.unit.numberPending)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.confirm.submit }));

    expect(await screen.findByText(t.error.emptyContents)).toBeInTheDocument();
  });

  it('포장 유형 목록이 실패하면 고르지 못하게 하고 그 사실을 말한다', async () => {
    renderScreen({ unitTypesFail: true });

    expect(await screen.findByText(t.unit.typeLoadFailed)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: t.unit.typeLabel })).toBeDisabled();
  });

  /* 확정이 실패해도 담은 것은 화면에 남는다 — 다시 확정할 수 있어야 한다. */
  it('확정이 실패하면 배너로 말하고 담은 것은 남는다', async () => {
    const user = userEvent.setup();

    renderScreen({ packStatus: 500 });

    await packOneLine(user, LOT_A_NO, '100');
    await user.click(screen.getByRole('button', { name: t.confirm.submit }));

    expect(await screen.findByText(t.error.confirmTitle)).toBeInTheDocument();
    expect(unitPane().queryByText(t.contents.empty)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.confirm.submit })).toBeEnabled();
  });

  it('담기 시작하면 유형과 상위 포장을 바꿀 수 없다', async () => {
    const user = userEvent.setup();

    renderScreen();

    await packOneLine(user, LOT_A_NO, '100');

    expect(await unitPane().findByText(t.unit.numberPending)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: t.unit.typeLabel })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: t.unit.parentLabel })).toBeDisabled();
    expect(screen.getByText(t.unit.lockedNotice)).toBeInTheDocument();
  });
});

/**
 * 오프라인 — 스펙 §6 「오프라인 → 큐잉」 · 공유계약 C-1.
 *
 * ⭐ **쓰기가 확정 한 건이라 오프라인이 온전히 선다.** 앞뒤가 매인 호출이 없어 끊긴 채로도
 * 포장을 시작해 확정까지 마칠 수 있다 — 앞선 판이 막던 자리다.
 */
describe('P-02-08 포장 작업 — 오프라인', () => {
  const setOnline = (value: boolean): void => {
    Object.defineProperty(globalThis.navigator, 'onLine', { value, configurable: true });
  };

  afterEach(() => {
    setOnline(true);
    globalThis.localStorage.clear();
    vi.useRealTimers();
  });

  /*
   * ⭐ **끊긴 채로도 포장을 새로 시작해 확정까지 마친다.** 등록을 확정 시점으로 옮기면서
   * 열린 자리다 — 앞선 판은 여기서 「연결이 끊겨 새 포장을 시작할 수 없습니다」로 막았다.
   */
  it('끊겨 있어도 새 포장을 시작해 확정까지 마친다', async () => {
    setOnline(false);

    const writes: Request[] = [];
    const user = userEvent.setup();

    renderScreen({ writes });

    await packOneLine(user, LOT_A_NO, '100');

    /*
     * ⛔ **보낼 것이 없는데 건수를 제목으로 내지 않는다.** 「미전송 0건」은 무엇이 0건이라는
     * 것인지 읽을 수 없는 말이다 — 끊겼을 뿐이면 끊겼다고 말한다(실측).
     */
    expect(screen.getByText(messages.common.connection.offline)).toBeInTheDocument();
    expect(screen.queryByText(t.outbox.pending(0))).not.toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: t.confirm.submit }));

    expect(await screen.findByText(t.confirm.done)).toBeInTheDocument();
    /* 담긴 순간이 곧 확정이다 — 다만 아직 닿지 않았다는 사실을 함께 말한다(C-1 #2 · #4). */
    expect(screen.getByText(t.outbox.pending(1))).toBeInTheDocument();
    /* 담기에서도 확정에서도 서버로 나간 것이 없다 — 전부 큐에 있다. */
    expect(writes).toHaveLength(0);
  });

  /*
   * ⭐ **담긴 순간이 곧 확정이다**(C-1 #2). 통신을 기다리게 하면 포장대 앞에서 손이 멈춘다.
   */
  it('담는 중에 끊기면 확정이 큐로 가고 화면은 확정으로 본다', async () => {
    const writes: Request[] = [];
    const user = userEvent.setup();

    renderScreen({ writes });

    await packOneLine(user, LOT_A_NO, '100');
    await unitPane().findByText(t.unit.numberPending);

    /* 여기서 망이 끊긴다. */
    setOnline(false);
    act(() => {
      globalThis.dispatchEvent(new Event('offline'));
    });

    await user.click(screen.getByRole('button', { name: t.confirm.submit }));

    expect(await screen.findByText(t.confirm.done)).toBeInTheDocument();
    /* 아직 닿지 않았다는 사실을 함께 말한다 — 건수를 감추면 보냈다고 믿는다(C-1 #4). */
    expect(screen.getByText(t.outbox.pending(1))).toBeInTheDocument();
    /* 담는 동안에도 확정에서도 서버로 나간 것이 없다 — 전부 큐에 있다. */
    expect(writes).toHaveLength(0);
  });

  it('연결이 돌아오면 큐에 담긴 확정이 같은 멱등 키로 나간다', async () => {
    const writes: Request[] = [];
    const user = userEvent.setup();

    renderScreen({ writes });

    await packOneLine(user, LOT_A_NO, '100');
    await unitPane().findByText(t.unit.numberPending);

    setOnline(false);
    act(() => {
      globalThis.dispatchEvent(new Event('offline'));
    });

    await user.click(screen.getByRole('button', { name: t.confirm.submit }));
    await screen.findByText(t.confirm.done);

    setOnline(true);
    act(() => {
      globalThis.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    const packRequest = writeAt(writes, 0);

    expect(new URL(packRequest.url).pathname).toBe('/inventory/handling-units');
    expect(packRequest.headers.get('X-Worker-No')).toBe(WORKER_NO);
    /* ⛔ 큐에 쌓인 요청은 잠금 토큰을 싣지 않는다(C-9). */
    expect(packRequest.headers.get('If-Match')).toBeNull();

    const body = await bodyOf(packRequest);

    expect(body.contents).toHaveLength(1);
    expect(body.handlingUnitTypeCode).toBe(BOX_CODE);
  });

  /*
   * ⭐ **온라인 확정이 적용 여부를 모른 채 끝나면 큐가 «그 시도»를 그대로 이어받는다.** 새 키로
   * 보내면 서버가 두 요청을 묶어 주지 못한다 — 첫 요청이 닿아 있었다면 확정이 두 번 서고,
   * 포장을 해체할 화면은 없다(스펙 §8-4 · C-1 #5).
   */
  it('온라인 확정이 실패한 뒤 큐로 넘어가도 멱등 키와 본문이 함께 이어진다', async () => {
    const writes: Request[] = [];
    const user = userEvent.setup();

    /* 5xx — 서버가 받았는지 알 수 없는 실패다. */
    renderScreen({ writes, packStatus: 503 });

    await packOneLine(user, LOT_A_NO, '100');
    await unitPane().findByText(t.unit.numberPending);

    await user.click(screen.getByRole('button', { name: t.confirm.submit }));

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    const attempt = writeAt(writes, 0);
    const attemptBody = await bodyOf(attempt);

    setOnline(false);
    act(() => {
      globalThis.dispatchEvent(new Event('offline'));
    });

    await user.click(screen.getByRole('button', { name: t.confirm.submit }));
    await screen.findByText(t.confirm.done);

    setOnline(true);
    act(() => {
      globalThis.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(writes).toHaveLength(2);
    });

    const queued = writeAt(writes, 1);

    expect(queued.headers.get('Idempotency-Key')).toBe(attempt.headers.get('Idempotency-Key'));
    /*
     * ⛔ **본문도 그때 것이어야 한다.** 키만 같고 값이 다르면 서버가 앞 쓰기의 중복으로 보고
     * 흡수해, 나중에 담은 줄이 사라진다.
     */
    expect(await bodyOf(queued)).toEqual(attemptBody);
  });

  /*
   * ⛔ **담은 것이 달라졌으면 그 키를 이어받지 않는다.** 그 키는 이미 다른 쓰기의 키라, 그대로
   * 보내면 나중에 담은 줄이 서버에서 흡수돼 사라진다.
   */
  it('실패한 뒤 LOT 을 더 담으면 앞 시도의 키를 쓰지 않는다', async () => {
    const writes: Request[] = [];
    const user = userEvent.setup();

    renderScreen({ writes, packStatus: 503 });

    await packOneLine(user, LOT_A_NO, '100');
    await unitPane().findByText(t.unit.numberPending);

    await user.click(screen.getByRole('button', { name: t.confirm.submit }));

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    const attempt = writeAt(writes, 0);

    /* 확정이 실패한 뒤 작업자가 한 줄 더 담는다 — 뜻이 달라졌다. */
    await user.click(
      await scanPane().findByRole('button', { name: `${LOT_B_NO} ${t.lotList.select}` }),
    );
    await user.type(screen.getByLabelText(t.scan.quantityLabel), '30');
    await user.click(screen.getByRole('button', { name: t.scan.submit }));

    setOnline(false);
    act(() => {
      globalThis.dispatchEvent(new Event('offline'));
    });

    await user.click(screen.getByRole('button', { name: t.confirm.submit }));
    await screen.findByText(t.confirm.done);

    setOnline(true);
    act(() => {
      globalThis.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(writes).toHaveLength(2);
    });

    const queued = writeAt(writes, 1);

    expect(queued.headers.get('Idempotency-Key')).not.toBe(attempt.headers.get('Idempotency-Key'));
    /* 나중에 담은 줄이 살아 있어야 한다. */
    expect((await bodyOf(queued)).contents).toHaveLength(2);
  });

  /*
   * ⛔ **앞 포장의 키가 다음 포장으로 새면 큐 항목 둘이 같은 키를 갖는다.** 큐는 키로 항목을
   * 지우므로 앞 건이 성공하는 순간 뒤엣것까지 함께 내려간다 — 서버에 닿은 적 없는 확정이
   * 사라지는 자리다.
   */
  it('다음 포장의 오프라인 확정이 앞 포장의 키를 쓰지 않는다', async () => {
    const writes: Request[] = [];
    const user = userEvent.setup();

    renderScreen({ writes, packStatus: 503 });

    await packOneLine(user, LOT_A_NO, '100');
    await unitPane().findByText(t.unit.numberPending);

    await user.click(screen.getByRole('button', { name: t.confirm.submit }));

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    const firstAttempt = writeAt(writes, 0);

    setOnline(false);
    act(() => {
      globalThis.dispatchEvent(new Event('offline'));
    });

    await user.click(screen.getByRole('button', { name: t.confirm.submit }));
    await screen.findByText(t.confirm.done);

    /* 앞 포장을 두고 다음 포장을 시작한다. */
    setOnline(true);
    act(() => {
      globalThis.dispatchEvent(new Event('online'));
    });
    await user.click(screen.getByRole('button', { name: t.confirm.startNext }));

    await packOneLine(user, LOT_B_NO, '30');
    await unitPane().findByText(t.unit.numberPending);

    setOnline(false);
    act(() => {
      globalThis.dispatchEvent(new Event('offline'));
    });

    await user.click(screen.getByRole('button', { name: t.confirm.submit }));
    await screen.findByText(t.confirm.done);

    const queued: { idempotencyKey: string }[] = JSON.parse(
      globalThis.localStorage.getItem(OUTBOX_STORAGE_KEY) ?? '[]',
    ) as { idempotencyKey: string }[];
    const keys = queued.map((one) => one.idempotencyKey);

    /* 두 건이 같은 키를 가지면 앞 건이 성공하는 순간 뒤엣것까지 큐에서 내려간다. */
    expect(new Set(keys).size).toBe(keys.length);
    /* 앞 포장은 자기 시도를 이어받는 것이 맞다 — 다음 포장이 그것을 물려받으면 안 된다. */
    expect(keys[0]).toBe(firstAttempt.headers.get('Idempotency-Key'));
    expect(keys[1]).not.toBe(firstAttempt.headers.get('Idempotency-Key'));
  });

  /*
   * ⛔ **다음 포장이 앞 포장과 «같은 것»을 담아도 키를 물려받으면 안 된다.** 담은 것이 같으면
   * 내용 대조로는 갈라지지 않는다 — 포장이 바뀔 때 키를 버려야만 갈라진다.
   */
  it('앞 포장과 같은 것을 담아도 다음 포장은 새 키로 담긴다', async () => {
    const writes: Request[] = [];
    const user = userEvent.setup();

    renderScreen({ writes, packStatus: 503 });

    await packOneLine(user, LOT_A_NO, '100');
    await unitPane().findByText(t.unit.numberPending);

    await user.click(screen.getByRole('button', { name: t.confirm.submit }));

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    setOnline(false);
    act(() => {
      globalThis.dispatchEvent(new Event('offline'));
    });

    await user.click(screen.getByRole('button', { name: t.confirm.submit }));
    await screen.findByText(t.confirm.done);

    setOnline(true);
    act(() => {
      globalThis.dispatchEvent(new Event('online'));
    });
    await user.click(screen.getByRole('button', { name: t.confirm.startNext }));

    /* 다음 포장에 «같은 LOT 을 같은 수량으로» 담는다. */
    await packOneLine(user, LOT_A_NO, '100');
    await unitPane().findByText(t.unit.numberPending);

    setOnline(false);
    act(() => {
      globalThis.dispatchEvent(new Event('offline'));
    });

    await user.click(screen.getByRole('button', { name: t.confirm.submit }));
    await screen.findByText(t.confirm.done);

    const queued: { idempotencyKey: string }[] = JSON.parse(
      globalThis.localStorage.getItem(OUTBOX_STORAGE_KEY) ?? '[]',
    ) as { idempotencyKey: string }[];
    const keys = queued.map((one) => one.idempotencyKey);

    expect(keys).toHaveLength(2);
    /* 같은 키면 앞 건이 성공하는 순간 뒤엣것까지 큐에서 내려간다. */
    expect(new Set(keys).size).toBe(2);
  });

  /*
   * ⛔ **연결된 채로 확정해도 앞 포장의 키가 따라오면 안 된다.** 앞 포장이 큐를 거쳐 이미
   * 나갔는데 다음 포장이 «같은 것»을 담으면 본문 지문이 같아, 키를 버리지 않는 한 쓰기가 앞
   * 포장의 키로 나간다 — 서버는 실행 없이 앞 응답을 되돌려 주고 **다음 포장이 조용히 사라진다.**
   * 앞선 두 시험은 둘 다 오프라인 확정으로 끝나 이 온라인 경로를 지나지 않는다.
   */
  it('앞 포장이 나간 뒤 같은 것을 담아도 온라인 확정은 새 키로 나간다', async () => {
    const writes: Request[] = [];
    const user = userEvent.setup();
    /* 응답을 도중에 바꾼다 — 앞 포장은 적용 여부를 모른 채 끝나고, 뒤엣것은 그대로 선다. */
    const options = { writes, packStatus: 503 };

    renderScreen(options);

    await packOneLine(user, LOT_A_NO, '100');
    await unitPane().findByText(t.unit.numberPending);

    await user.click(screen.getByRole('button', { name: t.confirm.submit }));

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    const firstKey = writeAt(writes, 0).headers.get('Idempotency-Key');

    setOnline(false);
    act(() => {
      globalThis.dispatchEvent(new Event('offline'));
    });

    await user.click(screen.getByRole('button', { name: t.confirm.submit }));
    await screen.findByText(t.confirm.done);

    options.packStatus = 201;
    setOnline(true);
    act(() => {
      globalThis.dispatchEvent(new Event('online'));
    });

    /* 앞 포장이 큐에서 빠져나갈 때까지 기다린다 — 뒤엣것의 쓰기와 섞이지 않게 한다. */
    await waitFor(() => {
      expect(globalThis.localStorage.getItem(OUTBOX_STORAGE_KEY) ?? '[]').toBe('[]');
    });

    await user.click(screen.getByRole('button', { name: t.confirm.startNext }));

    /* 다음 포장에 «같은 LOT 을 같은 수량으로» 담고, 이번에는 연결된 채로 확정한다. */
    await packOneLine(user, LOT_A_NO, '100');
    await unitPane().findByText(t.unit.numberPending);

    await user.click(screen.getByRole('button', { name: t.confirm.submit }));

    await waitFor(() => {
      expect(writes).toHaveLength(3);
    });

    expect(writeAt(writes, 2).headers.get('Idempotency-Key')).not.toBe(firstKey);
  });

  /*
   * ⛔ **앞 포장의 거부를 새 포장이 물려받지 않는다.** 큐가 거부한 사실은 그 포장의 것이라,
   * 남겨 두면 아직 아무것도 담지 않은 화면이 「받지 않았습니다」를 띄운다.
   */
  it('다음 포장을 시작하면 앞 포장의 거부가 화면에서 사라진다', async () => {
    const user = userEvent.setup();

    renderScreen({ packStatus: 400 });

    await packOneLine(user, LOT_A_NO, '100');
    await unitPane().findByText(t.unit.numberPending);

    setOnline(false);
    act(() => {
      globalThis.dispatchEvent(new Event('offline'));
    });

    await user.click(screen.getByRole('button', { name: t.confirm.submit }));
    await screen.findByText(t.confirm.done);

    setOnline(true);
    act(() => {
      globalThis.dispatchEvent(new Event('online'));
    });

    expect(await screen.findByText(t.outbox.rejected)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.confirm.startNext }));

    expect(screen.queryByText(t.outbox.rejected)).not.toBeInTheDocument();
  });
});
