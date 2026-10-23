import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { PopIdentityProvider, type PopIdentity } from '../../patterns/pop-identity';
import { lot, receipt, receiptLineFixtures, WORK_ORDER_ID } from './fixtures';
import { MaterialInputScanScreen } from './screen';
import { popGateDeniedText } from '../../patterns/pop-process-gate';

const DENIED_TEXT = popGateDeniedText({ processName: null }, 'canInputMaterial');

const t = messages.materialInputScan;
const unsent = messages.popChrome.header.unsent;

/** 수량 한 줄의 한 칸(「투입한 수량 12 EA」). 이름과 값이 다른 요소라 칸 전체 글자로 찾는다. */
const qtyPart =
  (text: string) =>
  (_content: string, element: Element | null): boolean =>
    element?.classList.contains('material-input-qty-part') === true && element.textContent === text;

const TERMINAL_ID = 7901;
const PROCESS_ID = 7902;
const WORKER_NO = 'SAMPLE-W-0001';

const ROUTE = `/pop/material-input?workOrderId=${String(WORK_ORDER_ID)}`;

/** 셸이 채워 준 단말·공정·사번 — 확정까지 갈 수 있는 유일한 상태다. */
const GATED: PopIdentity = {
  terminalId: TERMINAL_ID,
  processes: [{ processId: PROCESS_ID }],
  equipment: null,
  workerNo: WORKER_NO,
};

const RECEIPTS_PATH = '/logistics/shopfloor-receipts';
const LOTS_PATH = '/trace/lots';
const CODE_VALUES_PATH = '/mdm/code-values';
const CONSUMPTIONS_PATH = '/production/material-consumptions';
const TERMINAL_PROCESSES_PATH = `/mdm/terminals/${String(TERMINAL_ID)}/processes`;
const WORK_SESSIONS_PATH = '/production/work-sessions';
const WORK_SESSION_ID = 7601;

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const isPost = (request: Request, pathname: string): boolean =>
  request.method === 'POST' && new URL(request.url).pathname === pathname;

/** 이 W/O 에서 열려 있는 세션. 인자로 몇 건이 걸리는지를 정한다(스펙 §5-5). */
const sessionsRoute = (items: unknown[]): StubRoute => ({
  match: (request) => isGet(request, WORK_SESSIONS_PATH),
  respond: () => jsonResponse({ items, page: { page: 1, size: 50, total: items.length } }),
});

const openSession = (workSessionId = WORK_SESSION_ID) => ({
  workSessionId,
  workOrderId: WORK_ORDER_ID,
  sessionNo: 2,
  terminalId: TERMINAL_ID,
  shiftId: 1,
  startedAt: '2026-09-01T08:00:00+09:00',
});

/** 확정 이외의 구획은 이 감지기의 관심사가 아니다 — 늘 같은 답을 주고 비켜 둔다. */
const backdrop = (lots: unknown[]): StubRoute[] => [
  sessionsRoute([openSession()]),
  {
    match: (request) => isGet(request, RECEIPTS_PATH),
    respond: () => jsonResponse({ items: [receipt()], page: { page: 1, size: 50, total: 1 } }),
  },
  {
    match: (request) => isGet(request, `${RECEIPTS_PATH}/7001`),
    respond: () => jsonResponse({ shopfloorReceipt: receipt(), lines: receiptLineFixtures }),
  },
  {
    match: (request) => isGet(request, CODE_VALUES_PATH),
    respond: () => jsonResponse({ items: [], page: { page: 1, size: 50, total: 0 } }),
  },
  {
    /* 품목·단위 이름 풀이 — 표시용이라 어느 판정에도 쓰이지 않는다. */
    match: (request) => isGet(request, '/mdm/uoms'),
    respond: () =>
      jsonResponse({
        items: [{ uomId: 7401, uomCode: 'EA', uomName: '개', decimalScale: 0, isActive: true }],
        page: { page: 1, size: 50, total: 1 },
      }),
  },
  {
    match: (request) =>
      request.method === 'GET' && /^\/mdm\/items\/\d+$/.test(new URL(request.url).pathname),
    respond: (request) => {
      const itemId = Number(new URL(request.url).pathname.split('/').pop());

      return jsonResponse({
        item: { itemId, itemCode: `SAMPLE-ITEM-${String(itemId)}`, itemName: '합성 품목' },
        editability: {},
      });
    },
  },
  {
    match: (request) => isGet(request, TERMINAL_PROCESSES_PATH),
    respond: () => jsonResponse({ items: [{ processId: PROCESS_ID, canInputMaterial: true }] }),
  },
  {
    /*
     * 자재LOT 조회 두 축(omf-mes#254 회신 ①). 정확 일치 축은 **계약이 0·1건을 보장**하므로
     * 번호로 걸러 낸다 — 스텁이 그 약속을 어기면 감지기가 있을 수 없는 상태를 재게 된다.
     */
    match: (request) => isGet(request, LOTS_PATH),
    respond: (request) => {
      const lotNo = new URL(request.url).searchParams.get('lotNo');
      const items =
        lotNo === null ? lots : lots.filter((one) => (one as { lotNo?: string }).lotNo === lotNo);

      return jsonResponse({ items, page: { page: 1, size: 50, total: items.length } });
    },
  },
];

interface Sent {
  headers: Headers;
  body: unknown;
}

/**
 * 계약 응답 한 건. 기록만 되는 것(출고 미귀속)은 인자로 켠다.
 *
 * ⭐ **`actualUseProcessId` 를 기본으로 싣는다.** 계약이 그 값을 「화면은 보내지 않는다 —
 *    **서버가 이 W/O 의 공정으로 채운다**」로 정해 두어 실서버는 **정상 투입에도 늘** 실어 준다.
 *    한때 이 스텁이 그 자리를 비워 두어, 「값이 있으면 교차 투입」이라는 틀린 판정이 시험을
 *    통과한 채 배포됐다 — 현장에서는 모든 줄에 「교차 투입」이 붙어 구분이 0 이 됐다
 *    (WIP-CHAIN-01 D8 실측 2026-09-15). 실서버 전제를 스텁이 갖고 있어야 재발하지 않는다.
 */
const consumption = (lotId: number, overrides: Record<string, unknown> = {}) => ({
  materialConsumptionId: 6000 + lotId,
  consumptionNo: `SAMPLE-MC-${String(lotId)}`,
  workOrderId: WORK_ORDER_ID,
  itemId: 7201,
  lotId,
  consumptionTypeCode: 'NORMAL',
  inputQty: 12,
  uomId: 7401,
  occurredAt: '2026-08-28T09:00:00+09:00',
  workerId: 1,
  terminalId: 1,
  actualUseProcessId: 7902,
  statusCode: 'RECORDED',
  ...overrides,
});

const renderScreen = (lots: unknown[], postRoute: StubRoute, extra: StubRoute[] = []) => {
  const sent: Sent[] = [];
  /* 앞에 놓인 규칙이 이긴다 — 세션 갈래를 재는 감지기가 배경을 덮어쓸 수 있게 한다. */
  const stub = createStubFetch([...extra, ...backdrop(lots), postRoute]);

  const fetch: StubFetch = async (request) => {
    if (isPost(request, CONSUMPTIONS_PATH)) {
      sent.push({ headers: request.headers, body: await request.clone().json() });
    }

    return stub(request);
  };

  renderWithProviders(
    <PopIdentityProvider value={GATED}>
      <MaterialInputScanScreen />
      <Here />
    </PopIdentityProvider>,
    { fetch, route: ROUTE },
  );

  return sent;
};

/** 지금 어느 주소인지 눈으로 확인할 자리 — 다음 걸음으로 실제로 옮겨 갔는지 잰다(D10). */
const Here = () => {
  const { pathname, search } = useLocation();

  return <p>지금: {`${pathname}${search}`}</p>;
};

/** 담은 자재 목록. 화면에 목록이 여럿이라 이름으로 집는다. */
/** 투입 수량 편집 영역. */
const editor = (): HTMLElement => screen.getByRole('region', { name: t.panes.noSelection });

const scannedList = (): HTMLElement => screen.getByRole('list', { name: t.scanned.materialsLabel });

/**
 * 담긴 LOT이 하나도 없는가. 자재 목록에는 수령한 LOT이 「스캔 전」으로 남으므로, 「기록 전」과
 * 「기록됨」이 하나도 없는지를 본다.
 */
const nothingScanned = (): boolean =>
  within(scannedList()).queryByText(t.scanned.pendingMark) === null &&
  within(scannedList()).queryByText(t.pairs.recordedQty) === null;

const okRoute = (bodies: unknown[]): StubRoute => {
  let call = 0;

  return {
    match: (request) => isPost(request, CONSUMPTIONS_PATH),
    respond: () => {
      const body = bodies[call] ?? bodies[bodies.length - 1];
      call += 1;

      return jsonResponse(body, { status: 201 });
    },
  };
};

/**
 * 스캔 → 수량 → **기록**까지. 스펙 §5-8이 「스캔 한 건이 곧 한 호출」로 못박았으므로
 * 쓰기는 「투입 확정」이 아니라 여기서 일어난다.
 */
const prepare = async (
  user: ReturnType<typeof userEvent.setup>,
  entries: readonly (readonly [string, string])[],
): Promise<void> => {
  for (const [code, qty] of entries) {
    await user.type(screen.getByLabelText(t.scan.label), `${code}{Enter}`);
    await screen.findByLabelText(t.scanned.qtyLabel(code));
    await user.clear(screen.getByLabelText(t.scanned.qtyLabel(code)));
    await user.type(screen.getByLabelText(t.scanned.qtyLabel(code)), qty);
    await user.click(screen.getByRole('button', { name: t.scanned.keypadSubmit }));
  }
};

/** 수량까지만. 기록은 하지 않는다 — 보내지 않는 갈래를 재는 감지기가 쓴다. */
const prepareWithoutRecord = async (
  user: ReturnType<typeof userEvent.setup>,
  code: string,
  qty: string,
): Promise<void> => {
  await user.type(screen.getByLabelText(t.scan.label), `${code}{Enter}`);
  await screen.findByLabelText(t.scanned.qtyLabel(code));
  /* 스캔하면 수령 − 기록 양이 미리 채워진다(PI-05). 감지기가 재는 값으로 바꿔 넣는다. */
  await user.clear(screen.getByLabelText(t.scanned.qtyLabel(code)));
  if (qty !== '') await user.type(screen.getByLabelText(t.scanned.qtyLabel(code)), qty);
};

describe('투입 기록 — 무엇이 나가는가', () => {
  /*
   * ⭐ 계약이 필수로 두는 여섯만 실린다. **보내지 않는 세 칸**(투입 유형·작업자·단말)이
   * 본문에 섞이면 스펙 §5-8을 어긴 것이고, 특히 투입 유형은 승인된 적 없는 값이 되돌릴 수
   * 없는 원장에 남는다.
   */
  it('필수 여섯만 싣고 보내지 않기로 한 칸은 넣지 않는다', async () => {
    const user = userEvent.setup();
    const sent = renderScreen([lot()], okRoute([consumption(7301)]));

    await prepare(user, [['SAMPLE-LOT-0001', '12']]);

    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });

    const body = sent[0]?.body as Record<string, unknown>;
    expect(body).toMatchObject({
      workOrderId: WORK_ORDER_ID,
      itemId: 7201,
      lotId: 7301,
      inputQty: 12,
      uomId: 7401,
    });
    expect(typeof body.occurredAt).toBe('string');

    expect(body).not.toHaveProperty('consumptionTypeCode');
    expect(body).not.toHaveProperty('workerId');
    expect(body).not.toHaveProperty('terminalId');
    /* 계보 정확도는 서버 판정이다(§5-4 정합주) — 계약에 필드조차 없다. */
    expect(body).not.toHaveProperty('traceAccuracyCode');
    expect(body).not.toHaveProperty('allocationMethodCode');
  });

  /* 오프라인 대상 오퍼레이션이라 재전송돼도 전표가 둘이 되지 않아야 한다. */
  it('멱등 키와 귀속 사번을 헤더로 싣는다', async () => {
    const user = userEvent.setup();
    const sent = renderScreen([lot()], okRoute([consumption(7301)]));

    await prepare(user, [['SAMPLE-LOT-0001', '12']]);

    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });

    expect(sent[0]?.headers.get('Idempotency-Key')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(sent[0]?.headers.get('X-Worker-No')).toBe(WORKER_NO);
    /* 큐에 쌓인 요청은 잠금 토큰을 싣지 않는다(C-9) — 계약도 선택으로 두었다. */
    expect(sent[0]?.headers.get('If-Match')).toBeNull();
  });

  /*
   * ⭐ **자재마다 키가 달라야 한다.** 하나의 키로 묶으면 서버가 두 번째 자재를 재전송으로
   * 읽어 **버린다** — 담은 자재가 조용히 투입되지 않는다.
   */
  it('자재가 둘이면 키도 둘이고 서로 다르다', async () => {
    const user = userEvent.setup();
    const sent = renderScreen(
      [lot(), lot({ lotId: 7302, lotNo: 'SAMPLE-LOT-0002' })],
      okRoute([consumption(7301), consumption(7302)]),
    );

    await prepare(user, [
      ['SAMPLE-LOT-0001', '12'],
      ['SAMPLE-LOT-0002', '5'],
    ]);

    await waitFor(() => {
      expect(sent).toHaveLength(2);
    });

    const keys = sent.map((one) => one.headers.get('Idempotency-Key'));
    /* 하나로 묶으면 서버가 둘째를 재전송으로 흡수해 **담은 자재가 조용히 투입되지 않는다.** */
    expect(new Set(keys).size).toBe(2);
  });
});

describe('투입 기록 — 결과를 어떻게 말하는가', () => {
  /*
   * 스펙 §5-3 — 막는 것은 BOM 불일치 하나뿐이고, **출고 미귀속은 통과하되 기록된다.**
   * 「통과」가 「정상」이 아니라서 화면이 그 구분을 보여야 한다.
   */
  it('서버가 기록만 한 것을 표시한다', async () => {
    const user = userEvent.setup();
    renderScreen([lot()], okRoute([consumption(7301)]));

    await prepare(user, [['SAMPLE-LOT-0001', '12']]);

    expect(await within(scannedList()).findByText(t.scanned.unlinkedIssue)).toBeTruthy();
  });

  /*
   * ⛔ **실사용 공정이 채워져 와도 그것만으로는 표시가 붙지 않는다.** 계약이 그 값을 「서버가 이
   *    W/O 의 공정으로 채운다」로 정해 두어 **정상 투입에도 늘** 실려 온다 — 유무로 「교차 투입」을
   *    세우면 모든 줄에 붙어 구분이 0 이 된다(WIP-CHAIN-01 D8 실측). 되살리려면 서버가 판정
   *    결과를 내려 줄 때다(`mutations.ts` 의 `RecordedNote` 주석).
   *
   * 여기서는 **출고에 귀속된 정상 투입**을 세운다 — 붙을 표시가 하나도 없어야 하는 줄이다.
   */
  it('실사용 공정이 채워져 와도 그것만으로는 표시가 붙지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen([lot()], okRoute([consumption(7301, { shopfloorReceiptLineId: 7101 })]));

    await prepare(user, [['SAMPLE-LOT-0001', '12']]);
    await within(scannedList()).findByText(t.pairs.recordedQty);

    const item = within(scannedList()).getByText('SAMPLE-LOT-0001').closest('li');
    expect(item).not.toBeNull();
    /* 줄에 서는 표시는 「기록됨」 하나뿐이다. */
    expect(within(item as HTMLElement).queryByText(t.scanned.unlinkedIssue)).toBeNull();
    expect(within(item as HTMLElement).getByText(t.pairs.recordedQty)).toBeTruthy();
  });

  /*
   * ⛔ **출고에 귀속된 건에는 그 표시를 붙이지 않는다.** 「통과」와 「기록만 됨」을 가르는
   * 표시라 아무 데나 붙으면 구분이 사라진다 — 나중에 계보를 추적할 때 쓸 수 없게 된다.
   */
  it('출고에 귀속된 건에는 「출고 미귀속」을 붙이지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen([lot()], okRoute([consumption(7301, { shopfloorReceiptLineId: 7101 })]));

    await prepare(user, [['SAMPLE-LOT-0001', '12']]);
    await within(scannedList()).findByText(t.pairs.recordedQty);

    expect(screen.queryByText(t.scanned.unlinkedIssue)).toBeNull();
  });

  it('기록된 줄에 기록 표시가 붙는다', async () => {
    const user = userEvent.setup();
    renderScreen([lot()], okRoute([consumption(7301)]));

    await prepare(user, [['SAMPLE-LOT-0001', '12']]);

    expect(await within(scannedList()).findByText(t.pairs.recordedQty)).toBeTruthy();
  });

  /*
   * ⛔ **지난 기록은 고치지 않는다**(B-3). 기록하면 칸을 비워 같은 양이 한 번 더 나가지 않게 하고,
   * 기록 전이 아니므로 [스캔 취소]도 없다. 더 넣으려면 다시 스캔하거나 줄을 누른다(PI-18).
   */
  it('기록하면 칸이 비고 [스캔 취소]가 없다', async () => {
    const user = userEvent.setup();
    renderScreen([lot()], okRoute([consumption(7301)]));

    await prepare(user, [['SAMPLE-LOT-0001', '12']]);
    await within(scannedList()).findByText(t.pairs.recordedQty);
    /* 결과 한 줄은 품목 이름과 방금 한 일이다. LOT 번호를 다시 쓰지 않는다(C-21). */
    expect(screen.getByText(t.scan.outcomes.recorded('예시 자재 A', '12 EA'))).toBeTruthy();
    expect(screen.queryByText(/SAMPLE-LOT-0001 /)).toBeNull();

    expect(
      screen.queryByRole('button', { name: t.scanned.removeMaterial('SAMPLE-LOT-0001') }),
    ).toBeNull();
    expect(screen.getByLabelText(t.scanned.qtyLabel('SAMPLE-LOT-0001'))).toHaveProperty(
      'value',
      '',
    );
    expect(screen.getByRole('button', { name: t.scanned.keypadSubmit })).toHaveProperty(
      'disabled',
      true,
    );
  });

  /*
   * ⭐ **담은 목록을 지우지 않는다.** 되돌릴 수 없는 기록이라 무엇이 들어갔는지 작업자가
   * 확인할 수 있어야 하고, 화면이 스스로 치우면 확인할 길이 사라진다.
   */
  it('기록한 뒤에도 담은 목록이 남는다', async () => {
    const user = userEvent.setup();
    renderScreen([lot()], okRoute([consumption(7301)]));

    await prepare(user, [['SAMPLE-LOT-0001', '12']]);
    await within(scannedList()).findByText(t.pairs.recordedQty);

    expect(within(scannedList()).getByText('SAMPLE-LOT-0001')).toBeTruthy();
  });

  it('첫 건부터 실패하면 실패로 말한다', async () => {
    const user = userEvent.setup();
    renderScreen([lot()], {
      match: (request) => isPost(request, CONSUMPTIONS_PATH),
      respond: () => new Response(null, { status: 403 }),
    });

    await prepare(user, [['SAMPLE-LOT-0001', '12']]);

    expect(await screen.findByText(t.confirm.failed)).toBeTruthy();
    /* 서버가 게이팅을 집행한 것이라 화면의 잠금 사유와 다른 자리에서 말한다. */
    expect(screen.getByText(messages.httpError.forbidden)).toBeTruthy();

    /*
     * ⭐ **거절된 자재는 목록에서 빠진다** — 서버가 받지 않았으므로 원장에 없다. 남겨 두면
     * 기록된 것처럼 보이고, §6의 「자재LOT 스캔부터 루프백」이 성립하지 않는다.
     */
    expect(within(scannedList()).queryByText(t.pairs.recordedQty)).toBeNull();
    await waitFor(() => {
      expect(nothingScanned()).toBe(true);
    });
  });
});

describe('투입 기록 — 보내지 않는 경우', () => {
  /*
   * ⭐ **버튼 잠금과 별개의 겹이다.** 잠금이 뚫려도 갖춰지지 않은 값이 되돌릴 수 없는 기록에
   * 실리지 않아야 한다 — 보내는 자리에서 본문을 다시 만들고, 만들 수 없으면 보내지 않는다.
   */
  it('수량이 없으면 기록을 눌러도 나가지 않는다', async () => {
    const user = userEvent.setup();
    const sent = renderScreen([lot()], okRoute([consumption(7301)]));

    await prepareWithoutRecord(user, 'SAMPLE-LOT-0001', '');
    await user.click(screen.getByRole('button', { name: t.scanned.keypadSubmit }));

    expect(sent).toHaveLength(0);

    /* 확정은 잠긴 채다. 「기록되지 않은 자재」 띠는 맨 위에 세우지 않는다(사용자 지시 2026-09-19). */
    expect(screen.getByRole('button', { name: t.confirm.goToProductionResult })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.queryByText(t.confirm.reasons.qtyMissing)).toBeNull();
  });

  /*
   * ⭐ **보내는 중에 또 누를 수 없다.** 되돌릴 수 없는 기록이라 두 번 나가면 같은 자재가 두
   * 번 투입된다 — 멱등 키는 시도마다 새로 만들므로 서버가 걸러 주지도 않는다.
   *
   * 실제로 막는 층은 **버튼 잠금**이다. 보내는 자리의 진행 중 검사는 버튼을 지나지 않는
   * 호출을 막는 둘째 겹이라 이 경로에서는 떼어내도 결과가 같다(등가).
   */
  it('기록한 직후 같은 칸으로 한 번 더 기록되지 않는다', async () => {
    const user = userEvent.setup();

    let releasePost = (): void => undefined;
    const postHeld = new Promise<void>((resolve) => {
      releasePost = resolve;
    });

    const sent: Sent[] = [];
    const stub = createStubFetch([...backdrop([lot()]), okRoute([consumption(7301)])]);
    const fetch: StubFetch = async (request) => {
      if (isPost(request, CONSUMPTIONS_PATH)) {
        sent.push({ headers: request.headers, body: await request.clone().json() });
        await postHeld;
      }

      return stub(request);
    };

    renderWithProviders(
      <PopIdentityProvider value={GATED}>
        <MaterialInputScanScreen />
      </PopIdentityProvider>,
      { fetch, route: ROUTE },
    );

    await prepareWithoutRecord(user, 'SAMPLE-LOT-0001', '12');
    await user.click(screen.getByRole('button', { name: t.scanned.keypadSubmit }));

    /* 큐에 담기는 즉시 「기록됨」이다(C-1 #2) — 통신을 기다리지 않는다. */
    await within(scannedList()).findByText(t.pairs.recordedQty);

    /*
     * 기록하면 칸이 비어 [투입 기록]이 잠긴다. 같은 칸으로 한 번 더 눌러 같은 양이 두 번 들어가지
     * 않는다(추가 투입은 다시 스캔해 남은 수량을 채운 뒤의 새 기록이다, PI-18).
     */
    const record = screen.getByRole('button', { name: t.scanned.keypadSubmit });
    expect(record).toHaveProperty('disabled', true);
    await user.click(record);

    releasePost();
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
  });

  /* 0은 있을 수 없는 값이다 — 계약이 `qty_t > 0` 을 건다. */
  it('0을 치면 오류를 말하고 나가지 않는다', async () => {
    const user = userEvent.setup();
    const sent = renderScreen([lot()], okRoute([consumption(7301)]));

    await prepareWithoutRecord(user, 'SAMPLE-LOT-0001', '0');

    expect(screen.getByText(t.scanned.qtyProblems.notPositive)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: t.scanned.keypadSubmit }));

    expect(sent).toHaveLength(0);
  });
});

describe('투입 기록 — 담은 목록의 표시', () => {
  it('기록 전에는 기록 표시가 붙지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen([lot()], okRoute([consumption(7301)]));

    await prepareWithoutRecord(user, 'SAMPLE-LOT-0001', '12');

    const item = within(scannedList()).getByText('SAMPLE-LOT-0001').closest('li');
    expect(item).not.toBeNull();
    expect(within(item as HTMLElement).queryByText(t.scanned.unlinkedIssue)).toBeNull();
  });
});

/**
 * 세션 — **투입을 매다는 값이지 여는 조건이 아니다**(스펙 §5-5).
 *
 * 계약이 `workSessionId`를 nullable로 두었으므로 없어도 투입은 선다. 화면이 이 값을 필수처럼
 * 다루면 세션을 열지 않은 긴급 투입·사후 입력이 통째로 막힌다.
 */
describe('MaterialInputScanScreen — 세션', () => {
  const confirmOnce = (user: ReturnType<typeof userEvent.setup>): Promise<void> =>
    prepare(user, [['SAMPLE-LOT-0001', '12']]);

  it('열린 세션이 하나면 그 번호를 싣는다', async () => {
    const user = userEvent.setup();
    const sent = renderScreen([lot()], okRoute([consumption(7301)]));

    await confirmOnce(user);

    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]?.body).toHaveProperty('workSessionId', WORK_SESSION_ID);
  });

  /* 세션이 없어도 투입은 선다 — 없는 것을 값으로 채우지 않는다. */
  it('열린 세션이 없으면 칸을 싣지 않는다', async () => {
    const user = userEvent.setup();
    const sent = renderScreen([lot()], okRoute([consumption(7301)]), [sessionsRoute([])]);

    await confirmOnce(user);

    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]?.body).not.toHaveProperty('workSessionId');
  });

  /*
   * ⭐ **여럿이면 고르지 않는다.** 그중 하나를 화면이 집으면 투입이 엉뚱한 구간에 붙고,
   * 되돌릴 수 없는 기록이라(B-3) 그 잘못이 그대로 남는다.
   */
  it('열린 세션이 여럿이면 매달지 않는다', async () => {
    const user = userEvent.setup();
    const sent = renderScreen([lot()], okRoute([consumption(7301)]), [
      sessionsRoute([openSession(), openSession(7602)]),
    ]);

    await confirmOnce(user);

    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]?.body).not.toHaveProperty('workSessionId');
  });

  /* 세션 조회 실패는 게이팅과 다른 축이다 — 모르면 매달지 않을 뿐 막지 않는다. */
  it('세션 조회가 실패해도 투입을 막지 않는다', async () => {
    const user = userEvent.setup();
    const sent = renderScreen([lot()], okRoute([consumption(7301)]), [
      {
        match: (request) => isGet(request, WORK_SESSIONS_PATH),
        respond: () => new Response(null, { status: 500 }),
      },
    ]);

    await confirmOnce(user);

    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]?.body).not.toHaveProperty('workSessionId');
  });
});

/**
 * 저장은 LOT마다 [투입 기록] 하나다. 따로 닫는 확정 동작은 없고(사용자 화면 확인 결정 2026-10-23),
 * 하단 바 주 동작은 같은 작업지시의 생산 작업으로 가는 [생산 작업으로]다(C-9).
 */
describe('MaterialInputScanScreen — 투입 기록과 다음 작업', () => {
  /** 이 W/O에 이미 기록된 투입 목록. 인자로 줄을 준다. */
  const recordedRoute = (items: unknown[], onCall?: () => void): StubRoute => ({
    match: (request) => isGet(request, CONSUMPTIONS_PATH),
    respond: () => {
      onCall?.();

      return jsonResponse({ items, page: { page: 1, size: 200, total: items.length } });
    },
  });

  it('기록하면 그것으로 끝나고 [생산 작업으로]가 열린다', async () => {
    const user = userEvent.setup();
    const sent = renderScreen([lot()], okRoute([consumption(7301)]), [recordedRoute([])]);

    const next = await screen.findByRole('button', { name: t.confirm.goToProductionResult });
    expect(next).toHaveProperty('disabled', true);
    expect(await screen.findByText(t.remaining.scan)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '투입 확정' })).toBeNull();

    await prepare(user, [['SAMPLE-LOT-0001', '12']]);
    await within(scannedList()).findByText(t.pairs.recordedQty);
    expect(sent).toHaveLength(1);

    expect(next).toHaveProperty('disabled', false);
    expect(screen.getByText(t.remaining.done)).toBeTruthy();

    /* ⛔ 작업지시를 주소로 싣는다 — 실적 화면은 그 값을 주소에서만 읽는다. */
    await user.click(next);
    expect(
      screen.getByText(`지금: /pop/production-result?workOrderId=${String(WORK_ORDER_ID)}`),
    ).toBeInTheDocument();
    expect(sent).toHaveLength(1);
  });

  /* 스캔했지만 기록하지 않은 LOT이 있으면 다음 작업으로 가지 않는다. 남은 일은 품목 이름으로 말한다. */
  it('기록하지 않은 LOT이 남으면 [생산 작업으로]가 잠기고 품목 이름으로 말한다', async () => {
    const user = userEvent.setup();
    renderScreen(
      [lot(), lot({ lotId: 7302, lotNo: 'SAMPLE-LOT-0002', itemId: 7202 })],
      okRoute([consumption(7301)]),
      [recordedRoute([])],
    );

    await prepare(user, [['SAMPLE-LOT-0001', '12']]);
    await within(scannedList()).findByText(t.pairs.recordedQty);
    await prepareWithoutRecord(user, 'SAMPLE-LOT-0002', '5');

    expect(screen.getByRole('button', { name: t.confirm.goToProductionResult })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByText(t.remaining.record('예시 자재 B'))).toBeTruthy();
  });

  /*
   * 이 W/O에 이미 기록된 투입(PI-13). 화면을 다시 열어도 그 LOT은 「기록됨」과 투입 합으로 서고,
   * 스캔하면 투입 수량 칸에 수령 − 기록 양이 미리 채워진다(PI-05).
   */
  it('이미 기록된 투입을 줄에 보이고, 스캔하면 남은 수령 양을 미리 채운다', async () => {
    const user = userEvent.setup();
    renderScreen([lot()], okRoute([consumption(7301)]), [
      recordedRoute([consumption(7301, { inputQty: 30 })]),
    ]);

    const row = (): HTMLElement =>
      within(scannedList()).getByText('SAMPLE-LOT-0001').closest('li') as HTMLElement;
    expect(await screen.findByText(qtyPart(`${t.pairs.recordedQty} 30 EA`))).toBeTruthy();
    expect(within(row()).getByText(t.pairs.recordedQty)).toBeTruthy();
    /* 이미 기록된 것이 있으니 다음 작업으로 갈 수 있다. */
    expect(screen.getByRole('button', { name: t.confirm.goToProductionResult })).toHaveProperty(
      'disabled',
      false,
    );

    await user.type(screen.getByLabelText(t.scan.label), 'SAMPLE-LOT-0001{Enter}');
    const field = await screen.findByLabelText(t.scanned.qtyLabel('SAMPLE-LOT-0001'));
    expect(field).toHaveProperty('value', '70');
    /* 편집 영역에 투입 누계와 남은 수량이 선다. */
    expect(within(editor()).getByText(t.pairs.recordedQty)).toBeTruthy();
    expect(within(editor()).getByText('30 EA')).toBeTruthy();
    expect(within(editor()).getByText('70 EA')).toBeTruthy();
  });

  it('기록 목록을 못 받으면 수령 수량을 미리 채운다', async () => {
    const user = userEvent.setup();
    renderScreen([lot()], okRoute([consumption(7301)]), [
      {
        match: (request) => isGet(request, CONSUMPTIONS_PATH),
        respond: () => new Response(null, { status: 500 }),
      },
    ]);

    await user.type(screen.getByLabelText(t.scan.label), 'SAMPLE-LOT-0001{Enter}');
    const field = await screen.findByLabelText(t.scanned.qtyLabel('SAMPLE-LOT-0001'));
    await waitFor(() => {
      expect(field).toHaveProperty('value', '100');
    });
  });

  /*
   * 추가 투입(PI-18). 기록된 LOT을 다시 스캔하면 남은 수량(수령 − 누계)을 채우고, 기록하면 새 기록이
   * 덧붙어 누계가 는다. 지난 기록은 고치지 않는다(B-3).
   */
  it('기록된 LOT을 다시 스캔하면 남은 수량을 채우고, 다시 기록하면 누계가 는다', async () => {
    const user = userEvent.setup();
    const sent = renderScreen([lot()], okRoute([consumption(7301), consumption(7301)]), [
      recordedRoute([]),
    ]);

    await prepare(user, [['SAMPLE-LOT-0001', '12']]);
    expect(
      await within(scannedList()).findByText(qtyPart(`${t.pairs.recordedQty} 12 EA`)),
    ).toBeTruthy();

    await user.type(screen.getByLabelText(t.scan.label), 'SAMPLE-LOT-0001{Enter}');
    expect(await screen.findByText(t.scan.outcomes.again('예시 자재 A'))).toBeTruthy();
    const field = screen.getByLabelText(t.scanned.qtyLabel('SAMPLE-LOT-0001'));
    expect(field).toHaveProperty('value', '88');
    expect(within(editor()).getByText('12 EA')).toBeTruthy();
    expect(within(editor()).getByText('88 EA')).toBeTruthy();
    /* 다시 스캔한 LOT은 기록 전이다 — 다음 작업으로 가지 않고 품목 이름으로 말한다. */
    expect(screen.getByRole('button', { name: t.confirm.goToProductionResult })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByText(t.remaining.record('예시 자재 A'))).toBeTruthy();

    await user.clear(field);
    await user.type(field, '8');
    await user.click(screen.getByRole('button', { name: t.scanned.keypadSubmit }));

    expect(
      await within(scannedList()).findByText(qtyPart(`${t.pairs.recordedQty} 20 EA`)),
    ).toBeTruthy();
    await waitFor(() => {
      expect(sent).toHaveLength(2);
    });
    /* 지난 기록은 그대로이고 새 기록이 덧붙었다. */
    expect(sent.map((one) => (one.body as { inputQty: number }).inputQty)).toEqual([12, 8]);
    expect(screen.getByRole('button', { name: t.confirm.goToProductionResult })).toHaveProperty(
      'disabled',
      false,
    );
  });

  /*
   * 줄만 눌러 연 기록된 LOT은 기록 전이 아니다. 다음 작업을 막는 것은 다시 스캔한(더 넣으려는) LOT
   * 뿐이다(PI-18, 사용자 확인 2026-10-23).
   */
  it('기록된 LOT의 줄을 누르기만 하면 다음 작업을 막지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen([lot()], okRoute([consumption(7301)]), [recordedRoute([])]);

    await prepare(user, [['SAMPLE-LOT-0001', '12']]);
    await within(scannedList()).findByText(t.pairs.recordedQty);

    const row = within(scannedList()).getByText('SAMPLE-LOT-0001').closest('button') as HTMLElement;
    await user.click(row);
    const field = screen.getByLabelText(t.scanned.qtyLabel('SAMPLE-LOT-0001'));
    expect(field).toHaveProperty('value', '88');
    const next = screen.getByRole('button', { name: t.confirm.goToProductionResult });
    expect(next).toHaveProperty('disabled', false);
    expect(screen.getByText(t.remaining.done)).toBeTruthy();
    /* [스캔 취소]는 기록 전인 LOT에만 선다. */
    expect(
      screen.queryByRole('button', { name: t.scanned.removeMaterial('SAMPLE-LOT-0001') }),
    ).toBeNull();
  });

  /* 서버가 받아 준 기록이 늘면 투입 합을 다시 읽는다. */
  it('기록이 받아들여지면 투입 기록을 다시 읽는다', async () => {
    const user = userEvent.setup();
    let reads = 0;
    renderScreen([lot()], okRoute([consumption(7301)]), [
      recordedRoute([], () => {
        reads += 1;
      }),
    ]);

    await waitFor(() => {
      expect(reads).toBe(1);
    });
    await prepare(user, [['SAMPLE-LOT-0001', '12']]);

    await waitFor(() => {
      expect(reads).toBeGreaterThanOrEqual(2);
    });
  });
});

/**
 * 담은 자재 한 줄이 **무엇을 얼마나**인지 말한다 — 스펙 §3의 `LOT-…0031  MAT-A  100 EA`.
 * 줄에는 LOT 번호, 품목 코드, 수령 수량, 투입 수량이 「라벨 값」으로 선다(가운뎃점 없음, C-10).
 *
 * LOT 번호만 보이면 잘못 읽힌 자재를 작업자가 알아채지 못한다. 스캔은 번호의 일부나 외부
 * 식별자로도 걸리므로 **읽은 것과 담긴 것이 다를 수 있다.**
 */
describe('MaterialInputScanScreen — 담은 자재의 품목·수량', () => {
  it('LOT 번호와 함께 품목·수량·단위를 보인다', async () => {
    const user = userEvent.setup();
    renderScreen([lot()], okRoute([consumption(7301)]));

    await prepareWithoutRecord(user, 'SAMPLE-LOT-0001', '12');

    const row = within(scannedList()).getByText('SAMPLE-LOT-0001').closest('li') as HTMLElement;
    /* 한 줄 안의 품목은 「이름 (코드)」다(C-10). */
    expect(within(row).getByText('예시 자재 A (SAMPLE-MAT-A)')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: t.scanned.keypadSubmit }));
    expect(await within(row).findByText(qtyPart(`${t.pairs.recordedQty} 12 EA`))).toBeTruthy();
  });

  /* 단위를 못 풀면 **빈 자리로 둔다** — 수량 뒤에 번호가 붙으면 그것이 값처럼 읽힌다. */
  it('단위를 풀지 못하면 수량 뒤에 번호를 붙이지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen([lot()], okRoute([consumption(7301)]), [
      {
        match: (request) => isGet(request, '/mdm/uoms'),
        respond: () => new Response(null, { status: 500 }),
      },
    ]);

    await prepareWithoutRecord(user, 'SAMPLE-LOT-0001', '12');

    const row = within(scannedList()).getByText('SAMPLE-LOT-0001').closest('li') as HTMLElement;
    await user.click(screen.getByRole('button', { name: t.scanned.keypadSubmit }));
    expect(await within(row).findByText(qtyPart(`${t.pairs.recordedQty} 12`))).toBeTruthy();
    expect(screen.queryByText(/7401/)).toBeNull();
  });
});

/**
 * 오프라인 outbox — **공유계약 C-1**(✓확정) · 스펙 §5-7. 이 화면이 POP 폴백의 첫 사례다.
 */
describe('MaterialInputScanScreen — 미전송 큐', () => {
  /*
   * ⭐ **미전송 건수는 필수 요건이다**(C-1 #4). 결정 기록이 「즉시 성공 표시」를 택하면서
   * 이 표시가 그 결정의 전제라고 못박았다 — 없으면 서버에 도달하지 않은 사실을 알 방법이 없다.
   */
  it('보내는 동안 미전송 건수를 헤더가 낸다', async () => {
    const user = userEvent.setup();

    let releasePost = (): void => undefined;
    const postHeld = new Promise<void>((resolve) => {
      releasePost = resolve;
    });

    const stub = createStubFetch([...backdrop([lot()]), okRoute([consumption(7301)])]);
    const fetch: StubFetch = async (request) => {
      if (isPost(request, CONSUMPTIONS_PATH)) await postHeld;

      return stub(request);
    };

    renderWithProviders(
      <PopIdentityProvider value={GATED}>
        <MaterialInputScanScreen />
      </PopIdentityProvider>,
      { fetch, route: ROUTE },
    );

    /* 담기 전에는 보낼 것이 없다. 미전송이 없으면 칩을 세우지 않는다(PG-24). */
    await screen.findByLabelText(t.scan.label);
    expect(screen.queryByText(unsent(1))).toBeNull();

    await prepareWithoutRecord(user, 'SAMPLE-LOT-0001', '12');
    await user.click(screen.getByRole('button', { name: t.scanned.keypadSubmit }));

    /* 담는 즉시 성공이고(C-1 #2), 아직 닿지 않았다는 사실은 건수가 말한다(C-1 #4). */
    expect(await within(scannedList()).findByText(t.pairs.recordedQty)).toBeTruthy();
    expect(await screen.findByText(unsent(1))).toBeTruthy();

    releasePost();
    await waitFor(() => {
      expect(screen.queryByText(unsent(1))).toBeNull();
    });
  });

  /*
   * ⛔ **재전송은 같은 키로**(C-1 #5). 시도마다 새 키를 만들면 재전송이 새 전표가 되고,
   * 작업자에게는 같은 자재가 두 번 투입된 것으로 남는다 — 되돌릴 수 없다.
   */
  it('키는 큐 항목에 붙어 있어 재전송해도 바뀌지 않는다', async () => {
    const user = userEvent.setup();

    let attempt = 0;
    const sent: Sent[] = [];
    const stub = createStubFetch([...backdrop([lot()])]);
    const fetch: StubFetch = async (request) => {
      if (isPost(request, CONSUMPTIONS_PATH)) {
        sent.push({ headers: request.headers, body: await request.clone().json() });
        attempt += 1;

        /* 첫 시도는 통신이 끊긴 것으로 둔다 — 기다리면 풀리는 갈래다. */
        if (attempt === 1) throw new TypeError('Failed to fetch');

        return jsonResponse(consumption(7301), { status: 201 });
      }

      return stub(request);
    };

    renderWithProviders(
      <PopIdentityProvider value={GATED}>
        <MaterialInputScanScreen />
      </PopIdentityProvider>,
      { fetch, route: ROUTE },
    );

    await prepareWithoutRecord(user, 'SAMPLE-LOT-0001', '12');
    await user.click(screen.getByRole('button', { name: t.scanned.keypadSubmit }));

    /* 끊긴 건은 큐에 남는다 — 재전송을 유발한다. */
    await screen.findByText(unsent(1));
    globalThis.dispatchEvent(new Event('online'));

    await waitFor(() => {
      expect(sent.length).toBeGreaterThanOrEqual(2);
    });

    const keys = sent.map((one) => one.headers.get('Idempotency-Key'));
    expect(new Set(keys).size).toBe(1);
  });

  /*
   * ⛔ **전체 롤백 금지**(C-2). 서버가 거부하면 그 건만 되돌린다 — 40건 중 1건 때문에 39건을
   * 버리면 현장이 마비된다.
   */
  it('단말 권한으로 서버가 거부하면(401) 서버 문구를 그대로 보인다', async () => {
    const user = userEvent.setup();
    renderScreen([lot()], {
      match: (request) => isPost(request, CONSUMPTIONS_PATH),
      respond: () =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'screen',
                code: 'PERMISSION_DENIED',
                message:
                  '이 단말에는 이 W/O 공정의 자재 투입 권한이 없습니다. 관리웹 단말 관리에서 해당 공정의 「자재 투입」을 켜세요.',
              },
            ],
          },
          { status: 401 },
        ),
    });

    await prepare(user, [['SAMPLE-LOT-0001', '12']]);

    expect(
      await screen.findByText(
        '이 단말에는 이 W/O 공정의 자재 투입 권한이 없습니다. 관리웹 단말 관리에서 해당 공정의 「자재 투입」을 켜세요.',
        { exact: false },
      ),
    ).toBeTruthy();
  });

  it('401 이 아닌 거부(404)의 서버 몸체는 보이지 않고 일반 문구를 쓴다', async () => {
    const user = userEvent.setup();
    renderScreen([lot()], {
      match: (request) => isPost(request, CONSUMPTIONS_PATH),
      respond: () => jsonResponse({ message: 'Not Found' }, { status: 404 }),
    });

    await prepare(user, [['SAMPLE-LOT-0001', '12']]);

    expect(await screen.findByText(messages.httpError.description, { exact: false })).toBeTruthy();
    expect(screen.queryByText(/Not Found/)).toBeNull();
  });

  it('서버가 거부하면 그 건만 목록에서 내린다', async () => {
    const user = userEvent.setup();

    /*
     * 첫 건은 받고 **둘째만 거부**한다 — 「그 건만」이 성립하는지 재려면 둘이 갈려야 한다.
     *
     * ⚠ **거부는 4xx 로 흉내 낸다.** 5xx 는 「기다리면 풀림」이라 큐에 남는다(#772) — 그것으로
     * 흉내 내면 이 시험이 재는 것이 「거부」가 아니라 「보류」가 된다.
     */
    let call = 0;
    renderScreen([lot(), lot({ lotId: 7302, lotNo: 'SAMPLE-LOT-0002' })], {
      match: (request) => isPost(request, CONSUMPTIONS_PATH),
      respond: () => {
        call += 1;

        return call === 1
          ? jsonResponse(consumption(7301), { status: 201 })
          : new Response(null, { status: 409 });
      },
    });

    await prepare(user, [
      ['SAMPLE-LOT-0001', '12'],
      ['SAMPLE-LOT-0002', '5'],
    ]);

    /*
     * 거부된 둘째는 원장에 없으므로 담은 자재에서 내려간다 — §6 「자재LOT 스캔부터 루프백」.
     * 수령한 LOT이라 목록에는 「스캔 전」으로 돌아간다.
     */
    const rowOf = (lotNo: string): HTMLElement =>
      within(scannedList()).getByText(lotNo).closest('li') as HTMLElement;
    await waitFor(() => {
      expect(within(rowOf('SAMPLE-LOT-0002')).getByText(t.scanned.notScannedMark)).toBeTruthy();
    });

    /*
     * ⛔ **전체 롤백 금지**(C-2). 40건 중 1건 때문에 39건을 버리면 현장이 마비된다 —
     * 받아들여진 첫 건은 목록에 그대로 남아 있어야 한다.
     */
    expect(within(scannedList()).getByText('SAMPLE-LOT-0001')).toBeTruthy();
    expect(within(scannedList()).getByText(t.pairs.recordedQty)).toBeTruthy();
  });
});

/**
 * ⭐ **게이트는 「투입 확정」이 아니라 «쓰기»를 막아야 한다**(스펙 §5-1 · 조항 F-1).
 *
 * 스펙이 「「투입 확정」을 비활성」이라 적은 것은 확정이 곧 쓰기이던 시점의 문장이다. §5-8
 * 건별 저장을 채택한 뒤로 원장에 남기는 것은 키패드 「기록」이고, 확정은 목록만 닫는다 —
 * 잠금을 확정에만 두면 **닫힌 단말에서 자재가 그대로 기록된다.**
 */
describe('MaterialInputScanScreen — 게이트와 쓰기', () => {
  const deniedBackdrop = (lots: unknown[]): StubRoute[] => [
    {
      match: (request) => isGet(request, TERMINAL_PROCESSES_PATH),
      respond: () => jsonResponse({ items: [{ processId: PROCESS_ID, canInputMaterial: false }] }),
    },
    ...backdrop(lots),
  ];

  it('권한이 닫힌 단말에서는 기록이 나가지 않는다', async () => {
    const user = userEvent.setup();
    const sent: Sent[] = [];
    const stub = createStubFetch([...deniedBackdrop([lot()]), okRoute([consumption(7301)])]);
    const fetch: StubFetch = async (request) => {
      if (isPost(request, CONSUMPTIONS_PATH)) {
        sent.push({ headers: request.headers, body: await request.clone().json() });
      }

      return stub(request);
    };

    renderWithProviders(
      <PopIdentityProvider value={GATED}>
        <MaterialInputScanScreen />
      </PopIdentityProvider>,
      { fetch, route: ROUTE },
    );

    await screen.findByText(DENIED_TEXT);
    await prepareWithoutRecord(user, 'SAMPLE-LOT-0001', '12');

    /* 「기록」이 잠겨 있고, 눌러도 원장에 닿지 않는다 — 잠금과 보내는 자리가 각각 막는다. */
    const record = screen.getByRole('button', { name: t.scanned.keypadSubmit });
    expect(record).toHaveProperty('disabled', true);

    await user.click(record);
    expect(sent).toHaveLength(0);
    expect(within(scannedList()).queryByText(t.pairs.recordedQty)).toBeNull();
  });

  /*
   * ⛔ **숫자 키까지 잠그지 않는다.** 값을 고칠 수 없게 만들면 왜 못 보내는지 알아보려던
   * 작업자가 입력까지 막힌 것으로 읽는다 — 사유는 확정 구획이 문장으로 말한다.
   */
  it('권한이 닫혀도 수량은 칠 수 있다', async () => {
    const user = userEvent.setup();
    const stub = createStubFetch([...deniedBackdrop([lot()]), okRoute([consumption(7301)])]);

    renderWithProviders(
      <PopIdentityProvider value={GATED}>
        <MaterialInputScanScreen />
      </PopIdentityProvider>,
      { fetch: stub, route: ROUTE },
    );

    await screen.findByText(DENIED_TEXT);
    await prepareWithoutRecord(user, 'SAMPLE-LOT-0001', '');

    await user.click(screen.getByRole('button', { name: '7' }));
    expect(screen.getByLabelText(t.scanned.qtyLabel('SAMPLE-LOT-0001'))).toHaveProperty(
      'value',
      '7',
    );
  });
});

/**
 * 큐가 **사라지지도 멈추지도 않는지** — 공유계약 C-1. 둘 다 「이미 성공을 본」 작업자가
 * 알아챌 수 없는 형태로 실패하는 자리다.
 */
describe('MaterialInputScanScreen — 큐가 살아남는가', () => {
  it('담은 건이 브라우저 저장소에 남는다', async () => {
    const user = userEvent.setup();
    globalThis.localStorage.clear();

    const stub = createStubFetch([...backdrop([lot()])]);
    const fetch: StubFetch = async (request) => {
      if (isPost(request, CONSUMPTIONS_PATH)) throw new TypeError('Failed to fetch');

      return stub(request);
    };

    renderWithProviders(
      <PopIdentityProvider value={GATED}>
        <MaterialInputScanScreen />
      </PopIdentityProvider>,
      { fetch, route: ROUTE },
    );

    await prepareWithoutRecord(user, 'SAMPLE-LOT-0001', '12');
    await user.click(screen.getByRole('button', { name: t.scanned.keypadSubmit }));

    /*
     * ⭐ 메모리에만 있으면 화면을 한 번 되살리는 것으로 기록이 사라지고, 작업자는 이미 성공을
     * 보았으므로 **사라진 줄 모른다.**
     */
    await waitFor(() => {
      const stored: unknown = JSON.parse(
        globalThis.localStorage.getItem('omf-mes.material-input-scan.outbox') ?? '[]',
      );
      expect(Array.isArray(stored) && stored.length).toBe(1);
    });

    globalThis.localStorage.clear();
  });

  /*
   * ⭐ **연결 이벤트만 믿지 않는다.** 「끊긴 적 없이 실패한」 요청은 그 이벤트를 일으키지
   * 않으므로, 스스로 깨우지 않으면 큐가 연결이 살아 있는데도 영원히 멈춰 선다.
   */
  it('통신 실패 뒤 스스로 다시 시도한다', async () => {
    const user = userEvent.setup();
    globalThis.localStorage.clear();

    let attempt = 0;
    const stub = createStubFetch([...backdrop([lot()])]);
    const fetch: StubFetch = async (request) => {
      if (isPost(request, CONSUMPTIONS_PATH)) {
        attempt += 1;
        if (attempt === 1) throw new TypeError('Failed to fetch');

        return jsonResponse(consumption(7301), { status: 201 });
      }

      return stub(request);
    };

    renderWithProviders(
      <PopIdentityProvider value={GATED}>
        <MaterialInputScanScreen />
      </PopIdentityProvider>,
      { fetch, route: ROUTE },
    );

    await prepareWithoutRecord(user, 'SAMPLE-LOT-0001', '12');
    await user.click(screen.getByRole('button', { name: t.scanned.keypadSubmit }));

    await waitFor(() => {
      expect(attempt).toBe(1);
    });

    /*
     * ⛔ 연결 이벤트를 «보내지 않는다» — 재시도 타이머만으로 깨어나야 한다. 실제 간격(5초)을
     * 그대로 기다리므로 이 감지기만 제한 시간을 늘린다.
     */
    await waitFor(
      () => {
        expect(attempt).toBe(2);
      },
      { timeout: 12_000 },
    );

    globalThis.localStorage.clear();
  }, 15_000);
});

/**
 * 저장소에서 되살린 큐 — **끝에 있는 것이 되돌릴 수 없는 원장 쓰기**라 모양을 확인한다.
 *
 * 지난 판의 화면이 썼거나 손으로 고쳐진 값이 들어올 수 있고, 모양이 깨진 항목을 남겨 두면
 * 큐 맨 앞에서 매번 거부돼 **그 뒤에 쌓인 정상 건까지 함께 막는다.**
 */
describe('MaterialInputScanScreen — 저장소에서 되살린 큐', () => {
  it('모양이 깨진 항목은 버리고 성한 것만 보낸다', async () => {
    globalThis.localStorage.setItem(
      'omf-mes.material-input-scan.outbox',
      JSON.stringify([
        /* 본문이 없다 — 무엇을 기록할지 알 수 없다. */
        { idempotencyKey: 'broken-1', workerNo: WORKER_NO },
        /* 사번이 없다 — 귀속 헤더를 만들 수 없다(D-5). */
        { idempotencyKey: 'broken-2', body: { workOrderId: 1, itemId: 1, lotId: 1 } },
        {
          idempotencyKey: 'sound-1',
          workerNo: WORKER_NO,
          body: {
            workOrderId: WORK_ORDER_ID,
            itemId: 7201,
            lotId: 7301,
            inputQty: 3,
            uomId: 7401,
            occurredAt: '2026-09-01T09:00:00+09:00',
          },
        },
      ]),
    );

    const sent = renderScreen([lot()], okRoute([consumption(7301)]));

    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]?.headers.get('Idempotency-Key')).toBe('sound-1');

    /* 깨진 둘은 큐에서 사라져 머리줄의 미전송 칩이 없어진다 — 맨 앞에서 막히지 않는다. */
    await waitFor(() => {
      expect(screen.queryByText(/미전송/)).toBeNull();
    });

    globalThis.localStorage.clear();
  });
});
