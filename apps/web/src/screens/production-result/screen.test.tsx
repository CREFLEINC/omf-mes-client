import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PopIdentityProvider, type PopIdentity } from '../../patterns/pop-identity';
import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { STORAGE_KEY } from './outbox';
import { ProductionResultScreen } from './screen';
import {
  LOT_NO,
  PROCESS_ID,
  TERMINAL_ID,
  UOM_ID,
  WORKER_NO,
  WORK_ORDER_ID,
  makeLot,
  makePendingPqc,
  makeWorkOrder,
} from './fixtures';

const t = messages.productionResult;

const ENTRY_ROUTE = `/pop/production-result?workOrderId=${String(WORK_ORDER_ID)}&workerNo=${WORKER_NO}`;

/** 단말·공정을 아는 상태. 셸이 채우는 값이라 시험에서는 직접 넣는다. */
const IDENTIFIED: PopIdentity = {
  terminalId: TERMINAL_ID,
  processId: PROCESS_ID,
  workerNo: WORKER_NO,
};

const pathOf = (request: Request): string => new URL(request.url).pathname;

interface Options {
  canInputResult?: boolean;
  /** 이 공정의 기능 구성 행이 아예 없다 */
  noProcessRow?: boolean;
  /** 게이팅 조회가 실패한다 */
  gateFails?: boolean;
  /** 아직 끝나지 않은 PQC 의뢰가 있다 */
  hasPendingPqc?: boolean;
  /** 검사 의뢰 조회가 실패한다 — 「모르는 것」을 「통과」로 처리하지 않는지 본다 */
  pqcFails?: boolean;
  /** `withProgress` 응답의 양품 누계. `null` 이면 진척 자체가 없다 */
  goodQty?: number | null;
  /** 저장 요청을 담아 둔다 */
  writes?: Request[];
  /** 저장 응답 상태. 기본 201 */
  saveStatus?: number;
  /** 앞의 몇 번을 통신 실패로 만들 것인가. 재전송이 같은 키로 나가는지 볼 때 쓴다 */
  networkFailures?: number;
  /** 단위 조회가 실패한다 — 이름을 모를 때 숫자를 보이지 않는지 본다 */
  uomsFail?: boolean;
}

const routes = (options: Options): StubRoute[] => [
  {
    match: (request) => pathOf(request).startsWith('/mdm/terminals/'),
    respond: () => {
      if (options.gateFails === true)
        return jsonResponse({ message: '조회 실패' }, { status: 500 });
      /* 이 공정의 구성 자체가 없는 상태 — 「없음」과 「닫힘」이 같아야 한다 */
      if (options.noProcessRow === true) return jsonResponse({ items: [] });

      return jsonResponse({
        items: [{ processId: PROCESS_ID, canInputResult: options.canInputResult ?? true }],
      });
    },
  },
  {
    match: (request) => pathOf(request).startsWith('/production/work-orders/'),
    respond: () =>
      jsonResponse(makeWorkOrder(options.goodQty === undefined ? 120 : options.goodQty)),
  },
  {
    match: (request) => pathOf(request) === '/mdm/uoms',
    respond: () =>
      options.uomsFail === true
        ? jsonResponse({ message: '조회 실패' }, { status: 500 })
        : jsonResponse({ items: [{ uomId: UOM_ID, uomCode: 'EA', uomName: '개' }] }),
  },
  {
    match: (request) => request.method === 'GET' && pathOf(request) === '/trace/lots',
    respond: () => jsonResponse({ items: [makeLot()], page: { page: 1, size: 20, total: 1 } }),
  },
  {
    match: (request) => pathOf(request) === '/quality/inspection-requests',
    respond: () => {
      if (options.pqcFails === true) return jsonResponse({ message: '조회 실패' }, { status: 500 });

      return jsonResponse({
        items: options.hasPendingPqc === true ? [makePendingPqc()] : [],
        page: { page: 1, size: 20, total: 0 },
      });
    },
  },
  {
    match: (request) =>
      request.method === 'POST' && pathOf(request) === '/production/production-results',
    respond: (request) => {
      options.writes?.push(request.clone());

      /*
       * 통신이 끊긴 실패는 «응답이 없는» 실패다 — 상태 코드로 흉내 내면 큐가 그것을 거부로
       * 읽어 항목을 내려 버린다. 그래서 던진다(`runRequest` 가 network 로 정규화한다).
       */
      if (options.networkFailures !== undefined && options.writes !== undefined) {
        if (options.writes.length <= options.networkFailures) {
          throw new TypeError('Failed to fetch');
        }
      }

      const status = options.saveStatus ?? 201;

      return status === 201
        ? jsonResponse({ productionResultId: 1 }, { status: 201 })
        : jsonResponse({ message: '거부' }, { status });
    },
  },
];

const renderScreen = (
  options: Options = {},
  route: string = ENTRY_ROUTE,
  identity: PopIdentity = IDENTIFIED,
) =>
  renderWithProviders(
    <PopIdentityProvider value={identity}>
      <ProductionResultScreen />
    </PopIdentityProvider>,
    { fetch: createStubFetch(routes(options)), route },
  );

/** 목록을 열어 LOT 하나를 고른다. 목록은 「변경」을 눌렀을 때만 나온다. */
const selectLot = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: t.lot.change }));
  await user.click(await screen.findByRole('button', { name: `${LOT_NO} ${t.lot.select}` }));
};

const saveButton = () => screen.getByRole('button', { name: t.actions.save });

beforeEach(() => {
  globalThis.localStorage.clear();
});

afterEach(() => {
  globalThis.localStorage.clear();
});

describe('ProductionResultScreen 단말 게이팅', () => {
  it('플래그가 열려 있어야 저장이 열린다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await selectLot(user);
    await user.type(screen.getByLabelText(t.quantity.goodQtyLabel), '10');

    await waitFor(() => {
      expect(saveButton()).toBeEnabled();
    });
  });

  it('플래그가 닫혀 있으면 사유를 말하고 막는다', async () => {
    renderScreen({ canInputResult: false });

    expect(await screen.findByText(t.gate.denied)).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  /*
   * ⭐ **행이 없는 것과 닫힌 것이 같아야 한다.** 계약이 8플래그를 `required` 로 두지 않아
   * 「없음」이 흔하고, 그것을 통과로 읽으면 없는 장비의 버튼이 현장에서 열린다.
   */
  it('이 공정의 행이 아예 없어도 닫힘이다', async () => {
    renderScreen({ noProcessRow: true });

    expect(await screen.findByText(t.gate.denied)).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  /* ⛔ 「판정할 수 없음」을 「통과」로 처리하지 않는다(F-6). 문구도 「없다」와 구분한다. */
  it('조회가 실패하면 «확인할 수 없다»고 말하고 다시 시도를 준다', async () => {
    renderScreen({ gateFails: true });

    expect(await screen.findByText(t.gate.unavailable)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.gate.retry })).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it('단말을 모르면 사유를 말하고 막는다', async () => {
    renderScreen({}, ENTRY_ROUTE, { terminalId: null, processId: null, workerNo: null });

    expect(await screen.findByText(t.gate.unidentified)).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });
});

describe('ProductionResultScreen 진입값', () => {
  it('사번이 없으면 저장을 시도조차 하지 않는다', async () => {
    const writes: Request[] = [];
    renderScreen({ writes }, `/pop/production-result?workOrderId=${String(WORK_ORDER_ID)}`);

    expect(await screen.findByText(t.entry.missingWorker)).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(writes).toHaveLength(0);
  });
});

describe('ProductionResultScreen 검사 선행 (R54)', () => {
  it('끝나지 않은 PQC 의뢰가 있으면 실적 입력을 막는다', async () => {
    renderScreen({ hasPendingPqc: true });

    expect(await screen.findByText(t.pqc.blockedTitle)).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  /*
   * ⛔ **「판정할 수 없음」을 「통과」로 처리하지 않는다**(공유계약 F-6). 조회가 실패했는데
   * 실적을 열면 R54 를 어긴 실적이 조용히 들어간다.
   */
  it('검사 의뢰 조회가 실패하면 실적 입력을 열지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({ pqcFails: true });

    expect(await screen.findByText(t.pqc.loadFailed)).toBeInTheDocument();

    await selectLot(user);
    await user.type(screen.getByLabelText(t.quantity.goodQtyLabel), '10');

    expect(saveButton()).toBeDisabled();
  });

  it('의뢰가 없으면 생략 대상이라 실적으로 직행한다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await selectLot(user);
    await user.type(screen.getByLabelText(t.quantity.goodQtyLabel), '10');

    await waitFor(() => {
      expect(saveButton()).toBeEnabled();
    });
    expect(screen.queryByText(t.pqc.blockedTitle)).not.toBeInTheDocument();
  });
});

describe('ProductionResultScreen 수량 입력', () => {
  it('LOT 을 고르지 않으면 그 사유를 말한다', async () => {
    renderScreen();

    expect(await screen.findByText(t.lot.unselected)).toBeInTheDocument();
  });

  it('수량이 비어 있으면 저장이 열리지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await selectLot(user);

    expect(await screen.findByText(t.quantity.empty)).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it('0 은 «0보다 커야 한다»고 말한다 — 빈 것과 다른 사유다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await selectLot(user);
    await user.type(screen.getByLabelText(t.quantity.goodQtyLabel), '0');

    expect(await screen.findByText(t.quantity.zero)).toBeInTheDocument();
  });

  it('빠른 입력은 이어 붙이지 않고 더한다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await selectLot(user);
    const field = screen.getByLabelText(t.quantity.goodQtyLabel);
    await user.type(field, '12');
    await user.click(screen.getByRole('button', { name: t.quantity.quickAdd(10) }));

    expect(field).toHaveValue('22');
  });

  /* 스펙 §3-2 가 「양품수량 [ 120 ] EA」로 단위를 칸에 붙였다. */
  it('양품수량 칸에 단위를 붙인다', async () => {
    renderScreen();

    expect(await screen.findByText('EA')).toBeInTheDocument();
  });

  /*
   * ⛔ 단위 이름을 못 받았다고 숫자 식별자를 대신 붙이지 않는다 — 「120 10」으로 읽힌다.
   * 식별자는 W/O 응답에서 바로 오므로 잔여수량이 뜬 시점이면 새어 나올 자리는 이미 그려져 있다.
   */
  it('단위 조회가 실패하면 아무것도 붙이지 않는다 — 식별자로 대신하지 않는다', async () => {
    renderScreen({ uomsFail: true });

    await screen.findByText(t.quantity.remainingValue('380', '500'));

    expect(screen.queryByText('EA')).not.toBeInTheDocument();
    expect(screen.queryByText(String(UOM_ID))).not.toBeInTheDocument();
  });

  it('잔여수량을 잔여 / 지시로 보인다', async () => {
    renderScreen({ goodQty: 120 });

    expect(await screen.findByText(t.quantity.remainingValue('380', '500'))).toBeInTheDocument();
  });

  it('진척이 없으면 «확인할 수 없다»고 말한다 — 0 으로 접지 않는다', async () => {
    renderScreen({ goodQty: null });

    expect(await screen.findByText(t.quantity.remainingUnknown)).toBeInTheDocument();
  });
});

describe('ProductionResultScreen 저장', () => {
  it('보내는 본문이 계약대로다 — 빼야 할 값이 실리지 않는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];
    renderScreen({ writes });

    await selectLot(user);
    await user.type(screen.getByLabelText(t.quantity.goodQtyLabel), '10');
    await user.click(saveButton());

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    const request = writes[0];
    if (request === undefined) throw new Error('저장 요청이 없습니다.');

    const body: Record<string, unknown> = await request.json();

    expect(body.workOrderId).toBe(WORK_ORDER_ID);
    expect(body.goodQty).toBe(10);
    expect(body.lotAllocations).toEqual([{ lotId: 2002, allocatedQty: 10 }]);
    for (const field of ['workerId', 'terminalId', 'shiftId', 'defectQty']) {
      expect(Object.keys(body)).not.toContain(field);
    }
  });

  /* ⛔ 없으면 서버가 거부한다. 인증이 아니라 귀속이다(D-5). */
  it('사번 헤더와 멱등 키를 함께 싣는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];
    renderScreen({ writes });

    await selectLot(user);
    await user.type(screen.getByLabelText(t.quantity.goodQtyLabel), '10');
    await user.click(saveButton());

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    const request = writes[0];
    if (request === undefined) throw new Error('저장 요청이 없습니다.');

    expect(request.headers.get('X-Worker-No')).toBe(WORKER_NO);
    expect(request.headers.get('Idempotency-Key')).not.toBe(null);
    /* ⛔ 오프라인 대상 쓰기라 낙관적 잠금 토큰을 싣지 않는다(C-9). */
    expect(request.headers.get('If-Match')).toBe(null);
  });

  it('잔여가 남으면 이어서 입력하라고 말한다', async () => {
    const user = userEvent.setup();
    renderScreen({ goodQty: 120 });

    await selectLot(user);
    await user.type(screen.getByLabelText(t.quantity.goodQtyLabel), '10');
    await user.click(saveButton());

    expect(await screen.findByText(t.save.continueBody)).toBeInTheDocument();
  });

  it('잔여가 0 이 되면 LOT 완료로 넘어가라고 말한다', async () => {
    const user = userEvent.setup();
    renderScreen({ goodQty: 120 });

    await selectLot(user);
    /* 잔여 380 을 정확히 채운다 — 넘지 않으므로 확인을 묻지 않는다. */
    await user.type(screen.getByLabelText(t.quantity.goodQtyLabel), '380');
    await user.click(saveButton());

    expect(await screen.findByText(t.save.lotDoneTitle)).toBeInTheDocument();
  });

  /*
   * ⭐ **초과 생산은 허용이다**(✓확정 QA #27) — 막지 않고 확인만 한 번 받는다.
   */
  it('잔여를 넘으면 확인을 받은 뒤에 보낸다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];
    renderScreen({ writes, goodQty: 120 });

    await selectLot(user);
    await user.type(screen.getByLabelText(t.quantity.goodQtyLabel), '400');
    await user.click(saveButton());

    expect(await screen.findByText(t.overrun.title)).toBeInTheDocument();
    expect(writes).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: t.overrun.confirm }));

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });
  });

  it('확인을 물렀으면 보내지 않는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];
    renderScreen({ writes, goodQty: 120 });

    await selectLot(user);
    await user.type(screen.getByLabelText(t.quantity.goodQtyLabel), '400');
    await user.click(saveButton());
    await user.click(await screen.findByRole('button', { name: t.overrun.cancel }));

    expect(writes).toHaveLength(0);
  });

  /*
   * ⭐ **큐에 담기는 순간이 성공이다**(C-1 #2). 저장이 거부돼도 화면은 이미 성공을 말한 뒤라,
   * 거부는 배너로 따로 올라온다.
   */
  it('서버가 거부하면 그 사실을 배너로 말한다', async () => {
    const user = userEvent.setup();
    renderScreen({ saveStatus: 403 });

    await selectLot(user);
    await user.type(screen.getByLabelText(t.quantity.goodQtyLabel), '10');
    await user.click(saveButton());

    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
  });
});

describe('ProductionResultScreen 오프라인 (공유계약 C-1)', () => {
  /** 연결 상태를 이 시험이 정한다 — 실제 단말의 값에 기대지 않는다. */
  const setOnline = (value: boolean): void => {
    vi.spyOn(globalThis.navigator, 'onLine', 'get').mockReturnValue(value);
  };

  const readQueue = (): { idempotencyKey: string; workerNo: string }[] => {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);

    return raw === null ? [] : (JSON.parse(raw) as { idempotencyKey: string; workerNo: string }[]);
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /* ⭐ 큐에 담기는 순간이 성공이다 — 통신을 기다리지 않는다(C-1 #2). */
  it('끊긴 채 저장해도 즉시 성공이고 요청은 나가지 않는다', async () => {
    setOnline(false);
    const user = userEvent.setup();
    const writes: Request[] = [];
    renderScreen({ writes, goodQty: 120 });

    await selectLot(user);
    await user.type(screen.getByLabelText(t.quantity.goodQtyLabel), '10');
    await user.click(saveButton());

    expect(await screen.findByText(t.save.continueBody)).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  /* ⭐ 미전송 건수가 없으면 서버에 닿지 않은 사실을 알 방법이 사라진다(C-1 #4). */
  it('미전송 건수를 상시 보인다', async () => {
    setOnline(false);
    const user = userEvent.setup();
    renderScreen({ goodQty: 120 });

    await selectLot(user);
    await user.type(screen.getByLabelText(t.quantity.goodQtyLabel), '10');
    await user.click(saveButton());

    expect(await screen.findByText(t.sync.pending(1))).toBeInTheDocument();
  });

  /* ⚠ 재전송은 화면이 다시 그려진 뒤에 일어날 수 있다 — 그때 사번이 없으면 서버가 거부한다. */
  it('큐에 담긴 항목이 사번과 멱등 키를 함께 들고 있다', async () => {
    setOnline(false);
    const user = userEvent.setup();
    renderScreen({ goodQty: 120 });

    await selectLot(user);
    await user.type(screen.getByLabelText(t.quantity.goodQtyLabel), '10');
    await user.click(saveButton());

    await waitFor(() => {
      expect(readQueue()).toHaveLength(1);
    });

    const entry = readQueue()[0];
    if (entry === undefined) throw new Error('큐가 비어 있습니다.');

    expect(entry.workerNo).toBe(WORKER_NO);
    expect(entry.idempotencyKey).not.toBe('');
  });

  it('연결이 살아나면 담아 둔 건을 그대로 보낸다', async () => {
    setOnline(false);
    const user = userEvent.setup();
    const writes: Request[] = [];
    renderScreen({ writes, goodQty: 120 });

    await selectLot(user);
    await user.type(screen.getByLabelText(t.quantity.goodQtyLabel), '10');
    await user.click(saveButton());

    await waitFor(() => {
      expect(readQueue()).toHaveLength(1);
    });

    const queuedKey = readQueue()[0]?.idempotencyKey;

    setOnline(true);
    globalThis.dispatchEvent(new Event('online'));

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    expect(writes[0]?.headers.get('Idempotency-Key')).toBe(queuedKey);
  });

  /*
   * ⭐ **재전송이 같은 키로 나가야 한다**(C-1 #5). 시도마다 새 키를 만들면 통신이 끊긴 뒤
   * 다시 갔을 때 서버가 다른 쓰기로 보고 **같은 실적을 두 건 만든다.**
   */
  /*
   * ⚠ **넉넉한 시한을 준다.** 이 시험만 «두 번째» 요청을 기다리는데, 그 사이에 큐의 재시도
   * 타이머(5초)가 함께 돌아 기본 시한(1초·5초)으로는 부하가 걸린 기계에서 간헐로 넘어간다.
   * 동작이 아니라 대기 시간의 문제라 시한만 늘린다.
   */
  it('통신 실패 뒤 재전송이 같은 멱등 키로 나간다', { timeout: 20_000 }, async () => {
    setOnline(true);
    const user = userEvent.setup();
    const writes: Request[] = [];
    renderScreen({ writes, goodQty: 120, networkFailures: 1 });

    await selectLot(user);
    await user.type(screen.getByLabelText(t.quantity.goodQtyLabel), '10');
    await user.click(saveButton());

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    /* 연결이 살아난 계기를 만든다 — 5초 대기 대신 같은 경로를 깨운다. */
    globalThis.dispatchEvent(new Event('online'));

    await waitFor(
      () => {
        expect(writes).toHaveLength(2);
      },
      { timeout: 10_000 },
    );

    expect(writes[1]?.headers.get('Idempotency-Key')).toBe(
      writes[0]?.headers.get('Idempotency-Key'),
    );
  });
});
