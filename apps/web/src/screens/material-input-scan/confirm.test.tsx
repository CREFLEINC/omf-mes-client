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
import { lot, receipt, receiptLineFixtures, WORK_ORDER_ID } from './fixtures';
import { MaterialInputScanScreen } from './screen';

const t = messages.materialInputScan;

const TERMINAL_ID = 7901;
const PROCESS_ID = 7902;
const WORKER_NO = 'SAMPLE-W-0001';

const ROUTE =
  `/pop/material-input?workOrderId=${String(WORK_ORDER_ID)}` +
  `&terminalId=${String(TERMINAL_ID)}&processId=${String(PROCESS_ID)}&workerNo=${WORKER_NO}`;

const RECEIPTS_PATH = '/logistics/shopfloor-receipts';
const LOTS_PATH = '/trace/lots';
const CODE_VALUES_PATH = '/mdm/code-values';
const CONSUMPTIONS_PATH = '/production/material-consumptions';
const TERMINAL_PROCESSES_PATH = `/mdm/terminals/${String(TERMINAL_ID)}/processes`;

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const isPost = (request: Request, pathname: string): boolean =>
  request.method === 'POST' && new URL(request.url).pathname === pathname;

/** 확정 이외의 구획은 이 감지기의 관심사가 아니다 — 늘 같은 답을 주고 비켜 둔다. */
const backdrop = (lots: unknown[]): StubRoute[] => [
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
    match: (request) => isGet(request, TERMINAL_PROCESSES_PATH),
    respond: () => jsonResponse({ items: [{ processId: PROCESS_ID, canInputMaterial: true }] }),
  },
  {
    match: (request) => isGet(request, LOTS_PATH),
    respond: () => jsonResponse({ items: lots, page: { page: 1, size: 50, total: lots.length } }),
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

const renderScreen = (lots: unknown[], postRoute: StubRoute) => {
  const sent: Sent[] = [];
  const stub = createStubFetch([...backdrop(lots), postRoute]);

  const fetch: StubFetch = async (request) => {
    if (isPost(request, CONSUMPTIONS_PATH)) {
      sent.push({ headers: request.headers, body: await request.clone().json() });
    }

    return stub(request);
  };

  renderWithProviders(<MaterialInputScanScreen />, { fetch, route: ROUTE });

  return sent;
};

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

/** 스캔 → 수량 입력까지. 확정을 누를 수 있는 상태로 만든다. */
const prepare = async (
  user: ReturnType<typeof userEvent.setup>,
  entries: readonly (readonly [string, string])[],
): Promise<void> => {
  for (const [code, qty] of entries) {
    await user.type(screen.getByLabelText(t.scan.label), `${code}{Enter}`);
    await screen.findByText(t.scan.outcomes.material(code, code));
    await user.type(screen.getByLabelText(t.scanned.qtyLabel(code)), qty);
  }
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
    await user.click(screen.getByRole('button', { name: t.confirm.action }));

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
    await user.click(screen.getByRole('button', { name: t.confirm.action }));

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
    const sent = renderScreen([lot()], okRoute([consumption(7301), consumption(7302)]));

    await prepare(user, [['SAMPLE-LOT-0001', '12']]);
    await user.click(screen.getByRole('button', { name: t.confirm.action }));
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });

    const keys = sent.map((one) => one.headers.get('Idempotency-Key'));
    expect(new Set(keys).size).toBe(keys.length);
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
    await user.click(screen.getByRole('button', { name: t.confirm.action }));

    expect(await screen.findByText(t.scanned.crossProcess)).toBeTruthy();
    /* 출고 귀속이 있는 건에는 그 표시를 붙이지 않는다. */
    expect(screen.queryByText(t.scanned.unlinkedIssue)).toBeTruthy();
  });

  it('기록되면 몇 건인지 말한다', async () => {
    const user = userEvent.setup();
    renderScreen([lot()], okRoute([consumption(7301)]));

    await prepare(user, [['SAMPLE-LOT-0001', '12']]);
    await user.click(screen.getByRole('button', { name: t.confirm.action }));

    expect(await screen.findByText(t.confirm.recorded(1))).toBeTruthy();
  });

  /*
   * ⭐ **담은 목록을 지우지 않는다.** 되돌릴 수 없는 기록이라 무엇이 들어갔는지 작업자가
   * 확인할 수 있어야 하고, 화면이 스스로 치우면 확인할 길이 사라진다.
   */
  it('기록한 뒤에도 담은 목록이 남는다', async () => {
    const user = userEvent.setup();
    renderScreen([lot()], okRoute([consumption(7301)]));

    await prepare(user, [['SAMPLE-LOT-0001', '12']]);
    await user.click(screen.getByRole('button', { name: t.confirm.action }));
    await screen.findByText(t.confirm.recorded(1));

    expect(screen.getByText('SAMPLE-LOT-0001')).toBeTruthy();
  });

  it('첫 건부터 실패하면 실패로 말한다', async () => {
    const user = userEvent.setup();
    renderScreen([lot()], {
      match: (request) => isPost(request, CONSUMPTIONS_PATH),
      respond: () => new Response(null, { status: 403 }),
    });

    await prepare(user, [['SAMPLE-LOT-0001', '12']]);
    await user.click(screen.getByRole('button', { name: t.confirm.action }));

    expect(await screen.findByText(t.confirm.failed)).toBeTruthy();
    /* 서버가 게이팅을 집행한 것이라 화면의 잠금 사유와 다른 자리에서 말한다. */
    expect(screen.getByText(messages.httpError.forbidden)).toBeTruthy();
    expect(screen.queryByText(t.confirm.recorded(0))).toBeNull();
  });
});

describe('투입 확정 — 보내지 않는 경우', () => {
  /*
   * ⭐ **버튼 잠금과 별개의 겹이다.** 잠금이 뚫려도 갖춰지지 않은 값이 되돌릴 수 없는 기록에
   * 실리지 않아야 한다 — 보내는 자리에서 본문을 다시 만들고, 만들 수 없으면 보내지 않는다.
   */
  it('수량이 없으면 눌러도 나가지 않는다', async () => {
    const user = userEvent.setup();
    const sent = renderScreen([lot()], okRoute([consumption(7301)]));

    await user.type(screen.getByLabelText(t.scan.label), 'SAMPLE-LOT-0001{Enter}');
    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001', 'SAMPLE-LOT-0001'));

    const button = screen.getByRole('button', { name: t.confirm.action });
    expect(button).toHaveProperty('disabled', true);
    await user.click(button);

    expect(sent).toHaveLength(0);
  });

  /*
   * ⭐ **보내는 중에 또 누를 수 없다.** 되돌릴 수 없는 기록이라 두 번 나가면 같은 자재가 두
   * 번 투입된다 — 멱등 키는 시도마다 새로 만들므로 서버가 걸러 주지도 않는다.
   *
   * 실제로 막는 층은 **버튼 잠금**이다. 보내는 자리의 진행 중 검사는 버튼을 지나지 않는
   * 호출을 막는 둘째 겹이라 이 경로에서는 떼어내도 결과가 같다(등가).
   */
  it('보내는 중에는 확정을 다시 누를 수 없다', async () => {
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

    renderWithProviders(<MaterialInputScanScreen />, { fetch, route: ROUTE });

    await prepare(user, [['SAMPLE-LOT-0001', '12']]);
    await user.click(screen.getByRole('button', { name: t.confirm.action }));

    await waitFor(() => {
      expect(screen.getByText(t.confirm.reasons.sending)).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: t.confirm.action })).toHaveProperty('disabled', true);

    await user.click(screen.getByRole('button', { name: t.confirm.action }));
    expect(sent).toHaveLength(1);

    releasePost();
    await screen.findByText(t.confirm.recorded(1));
  });

  /* 0은 있을 수 없는 값이다 — 계약이 `qty_t > 0` 을 건다. */
  it('0을 치면 오류를 말하고 나가지 않는다', async () => {
    const user = userEvent.setup();
    const sent = renderScreen([lot()], okRoute([consumption(7301)]));

    await prepare(user, [['SAMPLE-LOT-0001', '0']]);

    expect(screen.getByText(t.scanned.qtyProblems.notPositive)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: t.confirm.action }));

    expect(sent).toHaveLength(0);
  });
});

describe('투입 확정 — 담은 목록의 표시', () => {
  it('기록 전에는 기록 표시가 붙지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen([lot()], okRoute([consumption(7301)]));

    await prepare(user, [['SAMPLE-LOT-0001', '12']]);

    const item = screen.getByText('SAMPLE-LOT-0001').closest('li');
    expect(item).not.toBeNull();
    expect(within(item as HTMLElement).queryByText(t.scanned.unlinkedIssue)).toBeNull();
    expect(within(item as HTMLElement).queryByText(t.scanned.crossProcess)).toBeNull();
  });
});
