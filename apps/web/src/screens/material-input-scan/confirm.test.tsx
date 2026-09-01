import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const t = messages.materialInputScan;

const TERMINAL_ID = 7901;
const PROCESS_ID = 7902;
const WORKER_NO = 'SAMPLE-W-0001';

const ROUTE = `/pop/material-input?workOrderId=${String(WORK_ORDER_ID)}`;

/** 셸이 채워 준 단말·공정·사번 — 확정까지 갈 수 있는 유일한 상태다. */
const GATED: PopIdentity = {
  terminalId: TERMINAL_ID,
  processId: PROCESS_ID,
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

/** 계약 응답 한 건. 기록만 되는 것(출고 미귀속·교차 투입)은 인자로 켠다. */
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
    </PopIdentityProvider>,
    { fetch, route: ROUTE },
  );

  return sent;
};

/** 담은 자재 목록. 화면에 목록이 여럿이라 이름으로 집는다. */
const scannedList = (): HTMLElement => screen.getByRole('list', { name: t.scanned.materialsLabel });

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
    await screen.findByText(t.scan.outcomes.material(code, code));
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
  await screen.findByText(t.scan.outcomes.material(code, code));
  if (qty !== '') await user.type(screen.getByLabelText(t.scanned.qtyLabel(code)), qty);
};

describe('투입 확정 — 무엇이 나가는가', () => {
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

describe('투입 확정 — 결과를 어떻게 말하는가', () => {
  /*
   * 스펙 §5-3 — 막는 것은 BOM 불일치 하나뿐이고, **출고 미귀속·교차 투입은 통과하되
   * 기록된다.** 「통과」가 「정상」이 아니라서 화면이 그 구분을 보여야 한다.
   */
  it('서버가 기록만 한 것을 표시한다', async () => {
    const user = userEvent.setup();
    renderScreen([lot()], okRoute([consumption(7301, { actualUseProcessId: 7902 })]));

    await prepare(user, [['SAMPLE-LOT-0001', '12']]);

    expect(await screen.findByText(t.scanned.crossProcess)).toBeTruthy();
  });

  /*
   * ⛔ **출고에 귀속된 건에는 그 표시를 붙이지 않는다.** 「통과」와 「기록만 됨」을 가르는
   * 표시라 아무 데나 붙으면 구분이 사라진다 — 나중에 계보를 추적할 때 쓸 수 없게 된다.
   */
  it('출고에 귀속된 건에는 「출고 미귀속」을 붙이지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen([lot()], okRoute([consumption(7301, { shopfloorReceiptLineId: 7101 })]));

    await prepare(user, [['SAMPLE-LOT-0001', '12']]);
    await screen.findByText(t.scanned.recordedMark);

    expect(screen.queryByText(t.scanned.unlinkedIssue)).toBeNull();
  });

  it('기록된 줄에 기록 표시가 붙는다', async () => {
    const user = userEvent.setup();
    renderScreen([lot()], okRoute([consumption(7301)]));

    await prepare(user, [['SAMPLE-LOT-0001', '12']]);

    expect(await screen.findByText(t.scanned.recordedMark)).toBeTruthy();
  });

  /*
   * ⛔ **기록된 줄은 잠근다.** 투입은 정정이 아니라 새 기록으로만 고칠 수 있는데(B-3) 계약에
   * 그 경로가 없다(§8 미결 9) — 빼거나 고칠 수 있는 것처럼 두면 작업자가 그렇게 했다고 믿는다.
   */
  it('기록된 줄은 빼거나 고칠 수 없다', async () => {
    const user = userEvent.setup();
    renderScreen([lot()], okRoute([consumption(7301)]));

    await prepare(user, [['SAMPLE-LOT-0001', '12']]);
    await screen.findByText(t.scanned.recordedMark);

    expect(
      screen.queryByRole('button', { name: t.scanned.removeMaterial('SAMPLE-LOT-0001') }),
    ).toBeNull();
    expect(screen.getByLabelText(t.scanned.qtyLabel('SAMPLE-LOT-0001'))).toHaveProperty(
      'readOnly',
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
    await screen.findByText(t.scanned.recordedMark);

    expect(screen.getByText('SAMPLE-LOT-0001')).toBeTruthy();
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
    expect(screen.queryByText(t.scanned.recordedMark)).toBeNull();
    await waitFor(() => {
      expect(screen.getByText(t.scanned.empty)).toBeTruthy();
    });
  });
});

describe('투입 확정 — 보내지 않는 경우', () => {
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

    /* 담아 둔 줄이 있으므로 사유는 「담아라」가 아니라 「그것을 기록해라」다. */
    expect(screen.getByRole('button', { name: t.confirm.action })).toHaveProperty('disabled', true);
    expect(screen.getByText(t.confirm.reasons.qtyMissing)).toBeTruthy();
  });

  /*
   * ⭐ **보내는 중에 또 누를 수 없다.** 되돌릴 수 없는 기록이라 두 번 나가면 같은 자재가 두
   * 번 투입된다 — 멱등 키는 시도마다 새로 만들므로 서버가 걸러 주지도 않는다.
   *
   * 실제로 막는 층은 **버튼 잠금**이다. 보내는 자리의 진행 중 검사는 버튼을 지나지 않는
   * 호출을 막는 둘째 겹이라 이 경로에서는 떼어내도 결과가 같다(등가).
   */
  it('담긴 자재는 다시 담기지 않는다', async () => {
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
    await screen.findByText(t.scanned.recordedMark);

    /*
     * 담긴 뒤에는 키패드가 사라지므로 다시 담을 길이 없다. 큐에 같은 자재가 두 번 들어가면
     * 같은 자재가 두 번 투입되고, 되돌릴 수 없다.
     */
    expect(screen.queryByRole('button', { name: t.scanned.keypadSubmit })).toBeNull();

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

describe('투입 확정 — 담은 목록의 표시', () => {
  it('기록 전에는 기록 표시가 붙지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen([lot()], okRoute([consumption(7301)]));

    await prepareWithoutRecord(user, 'SAMPLE-LOT-0001', '12');

    const item = screen.getByText('SAMPLE-LOT-0001').closest('li');
    expect(item).not.toBeNull();
    expect(within(item as HTMLElement).queryByText(t.scanned.unlinkedIssue)).toBeNull();
    expect(within(item as HTMLElement).queryByText(t.scanned.crossProcess)).toBeNull();
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
 * 「투입 확정」 — **그날 목록을 닫는 완료 동작**이지 저장을 모아 보내는 버튼이 아니다(§5-8).
 *
 * 기록은 이미 건별로 끝나 있으므로 이 버튼은 서버를 부르지 않는다. 계약에 대응하는
 * 오퍼레이션이 없는 것도 그래서다.
 */
describe('MaterialInputScanScreen — 목록 닫기', () => {
  it('확정은 서버를 부르지 않고 목록만 닫는다', async () => {
    const user = userEvent.setup();
    const sent = renderScreen([lot()], okRoute([consumption(7301)]));

    await prepare(user, [['SAMPLE-LOT-0001', '12']]);
    await screen.findByText(t.scanned.recordedMark);
    expect(sent).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: t.confirm.action }));

    /* 닫아도 요청이 더 나가지 않는다 — 기록은 이미 끝나 있다. */
    expect(sent).toHaveLength(1);
    expect(await screen.findByText(t.confirm.closed(1))).toBeTruthy();
    expect(screen.getByText(t.scanned.empty)).toBeTruthy();
  });

  /*
   * ⭐ **기록되지 않은 줄을 남긴 채 닫지 않는다.** 확정은 서버를 부르지 않으므로 닫는 순간
   * 그 줄은 아무 데도 남지 않고 사라진다 — 작업자는 다 넣었다고 믿는다.
   */
  it('기록되지 않은 줄이 남으면 닫지 못한다', async () => {
    const user = userEvent.setup();
    renderScreen(
      [lot(), lot({ lotId: 7302, lotNo: 'SAMPLE-LOT-0002' })],
      okRoute([consumption(7301), consumption(7302)]),
    );

    await prepare(user, [['SAMPLE-LOT-0001', '12']]);
    await screen.findByText(t.scanned.recordedMark);

    /* 둘째를 담기만 하고 기록하지 않는다. */
    await prepareWithoutRecord(user, 'SAMPLE-LOT-0002', '5');

    expect(screen.getByRole('button', { name: t.confirm.action })).toHaveProperty('disabled', true);
    expect(screen.getByText(t.confirm.reasons.qtyMissing)).toBeTruthy();
  });
});

/**
 * 담은 자재 한 줄이 **무엇을 얼마나**인지 말한다 — 스펙 §3의 `LOT-…0031  MAT-A  100 EA`.
 *
 * LOT 번호만 보이면 잘못 읽힌 자재를 작업자가 알아채지 못한다. 스캔은 번호의 일부나 외부
 * 식별자로도 걸리므로 **읽은 것과 담긴 것이 다를 수 있다.**
 */
describe('MaterialInputScanScreen — 담은 자재의 품목·수량', () => {
  it('LOT 번호와 함께 품목·수량·단위를 보인다', async () => {
    const user = userEvent.setup();
    renderScreen([lot()], okRoute([consumption(7301)]));

    await prepareWithoutRecord(user, 'SAMPLE-LOT-0001', '12');

    expect(
      await screen.findByText(t.scanned.itemAndQty('SAMPLE-ITEM-7201', '12', 'EA')),
    ).toBeTruthy();
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

    expect(
      await screen.findByText(t.scanned.itemAndQty('SAMPLE-ITEM-7201', '12', '')),
    ).toBeTruthy();
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

    /* 담기 전에는 보낼 것이 없다. */
    expect(await screen.findByText(t.header.synced)).toBeTruthy();

    await prepareWithoutRecord(user, 'SAMPLE-LOT-0001', '12');
    await user.click(screen.getByRole('button', { name: t.scanned.keypadSubmit }));

    /* 담는 즉시 성공이고(C-1 #2), 아직 닿지 않았다는 사실은 건수가 말한다(C-1 #4). */
    expect(await screen.findByText(t.scanned.recordedMark)).toBeTruthy();
    expect(await screen.findByText(t.header.unsynced(1))).toBeTruthy();

    releasePost();
    expect(await screen.findByText(t.header.synced)).toBeTruthy();
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
    await screen.findByText(t.header.unsynced(1));
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
  it('서버가 거부하면 그 건만 목록에서 내린다', async () => {
    const user = userEvent.setup();

    /* 첫 건은 받고 **둘째만 거부**한다 — 「그 건만」이 성립하는지 재려면 둘이 갈려야 한다. */
    let call = 0;
    renderScreen([lot(), lot({ lotId: 7302, lotNo: 'SAMPLE-LOT-0002' })], {
      match: (request) => isPost(request, CONSUMPTIONS_PATH),
      respond: () => {
        call += 1;

        return call === 1
          ? jsonResponse(consumption(7301), { status: 201 })
          : new Response(null, { status: 500 });
      },
    });

    await prepare(user, [
      ['SAMPLE-LOT-0001', '12'],
      ['SAMPLE-LOT-0002', '5'],
    ]);

    /* 거부된 둘째는 원장에 없으므로 목록에서 내려간다 — §6 「자재LOT 스캔부터 루프백」. */
    await waitFor(() => {
      expect(within(scannedList()).queryByText('SAMPLE-LOT-0002')).toBeNull();
    });

    /*
     * ⛔ **전체 롤백 금지**(C-2). 40건 중 1건 때문에 39건을 버리면 현장이 마비된다 —
     * 받아들여진 첫 건은 목록에 그대로 남아 있어야 한다.
     */
    expect(within(scannedList()).getByText('SAMPLE-LOT-0001')).toBeTruthy();
    expect(screen.getByText(t.scanned.recordedMark)).toBeTruthy();
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

    await screen.findByText(t.confirm.reasons.denied);
    await prepareWithoutRecord(user, 'SAMPLE-LOT-0001', '12');

    /* 「기록」이 잠겨 있고, 눌러도 원장에 닿지 않는다 — 잠금과 보내는 자리가 각각 막는다. */
    const record = screen.getByRole('button', { name: t.scanned.keypadSubmit });
    expect(record).toHaveProperty('disabled', true);

    await user.click(record);
    expect(sent).toHaveLength(0);
    expect(screen.queryByText(t.scanned.recordedMark)).toBeNull();
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

    await screen.findByText(t.confirm.reasons.denied);
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

/** 회차를 닫은 뒤 같은 자재를 다시 담았을 때, 지난 회차의 결과가 딸려오지 않아야 한다. */
describe('MaterialInputScanScreen — 회차 격리(리뷰 확인)', () => {
  it('닫고 같은 LOT을 다시 담아도 표시가 겹치지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen(
      [lot()],
      okRoute([
        consumption(7301, { actualUseProcessId: 7902 }),
        consumption(7301, { actualUseProcessId: 7902 }),
      ]),
    );

    await prepare(user, [['SAMPLE-LOT-0001', '12']]);
    await screen.findByText(t.scanned.crossProcess);

    await user.click(screen.getByRole('button', { name: t.confirm.action }));
    await screen.findByText(t.scanned.empty);

    /* 새 회차 — 같은 LOT을 다시 담는다. */
    await prepare(user, [['SAMPLE-LOT-0001', '7']]);

    await waitFor(() => {
      expect(screen.getAllByText(t.scanned.crossProcess)).toHaveLength(1);
    });
  });
});
