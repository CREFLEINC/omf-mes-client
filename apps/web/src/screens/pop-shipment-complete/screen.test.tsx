import { messages } from '@omf-mes/i18n';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { PopIdentityProvider, UNKNOWN_POP_IDENTITY } from '../../patterns/pop-identity';
import { setWorkerSession, type WorkerSession } from '../../patterns/worker-session';
import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import {
  blockedCompletion,
  completedShipment,
  completion,
  completionResult,
  requestRow,
} from './fixtures';
import type { Completion } from './model';
import { PopShipmentCompleteScreen } from './screen';

/** P-04-07 출하 완료(POP · 피처 010 · omf-all-around#305 · #334) — 스캔·검색 → 확인 → [출하 완료]. */

const t = messages.popShipmentComplete;
const u = messages.popUniform;

const CODE = 'SHPREQ:SR-261118-001';

interface Stub {
  /** `:lookup` 응답을 차례로 쓴다. 다 쓰면 마지막 것을 되풀이한다. */
  lookups?: (Response | (() => Response))[];
  complete?: Response[];
  list?: Response[];
}

const conflict = (code: string, extra: Record<string, unknown> = {}): Response =>
  jsonResponse({ code, message: '', conflictCause: 'user', ...extra }, { status: 409 });

const errorEnvelope = (code: string, status: number): Response =>
  jsonResponse({ errors: [{ scope: 'screen', code, message: '' }] }, { status });

const renderScreen = (stub: Stub = {}, workerNo: string | null = '100027') => {
  const requests: Request[] = [];
  const lookups = [...(stub.lookups ?? [])];
  let lastLookup: Response | (() => Response) = jsonResponse(completion());

  const stubFetch: StubFetch = async (request) => {
    const url = new URL(request.url);
    const path = decodeURIComponent(url.pathname);
    requests.push(request.clone());

    if (path === '/logistics/shipment-requests:lookup') {
      lastLookup = lookups.shift() ?? lastLookup;
      const next = typeof lastLookup === 'function' ? lastLookup() : lastLookup.clone();
      return next;
    }
    if (request.method === 'POST' && path === '/logistics/shipment-requests/501:complete') {
      return stub.complete?.shift() ?? jsonResponse(completionResult());
    }
    if (path === '/logistics/shipment-requests') {
      return (
        stub.list?.shift() ??
        jsonResponse({ items: [requestRow()], page: { page: 1, size: 20, total: 1 } })
      );
    }
    if (path === '/mdm/partners') {
      return jsonResponse({
        items: [{ partnerId: 71, partnerCode: 'C-GANA', partnerName: '가나전자', isActive: true }],
        page: { page: 1, size: 200, total: 1 },
      });
    }

    throw new Error(`스텁에 없는 요청입니다: ${request.method} ${request.url}`);
  };

  const { queryClient } = renderWithProviders(
    <PopIdentityProvider value={{ ...UNKNOWN_POP_IDENTITY, workerNo }}>
      <PopShipmentCompleteScreen />
    </PopIdentityProvider>,
    { route: '/pop/shipment-complete', fetch: stubFetch },
  );

  const pathOf = (request: Request) => decodeURIComponent(new URL(request.url).pathname);

  return {
    queryClient,
    requests,
    lookupCalls: () => requests.filter((r) => pathOf(r) === '/logistics/shipment-requests:lookup'),
    completeCalls: () => requests.filter((r) => pathOf(r).endsWith(':complete')),
    listCalls: () => requests.filter((r) => pathOf(r) === '/logistics/shipment-requests'),
  };
};

const scan = async (user: ReturnType<typeof userEvent.setup>, value: string) => {
  const field = screen.getByRole('textbox', { name: t.scan.label });
  await user.clear(field);
  await user.type(field, `${value}{Enter}`);
};

/** 출하 불가 사유 줄 수 — 사유 구획 안 빨간 줄(alert)을 센다. */
const blockerRows = () =>
  within(screen.getByRole('region', { name: t.blockers.heading })).getAllByRole('alert');

const completeButton = () => screen.getByRole('button', { name: t.bar.complete });

/** [직접 입력] — 창(제목 없음)을 열어 값을 치고 [확인]을 누른다(스캔 칸 Enter 는 스캔 길이다). */
const typeDirect = async (user: ReturnType<typeof userEvent.setup>, value: string) => {
  await user.click(screen.getByRole('button', { name: u.scan.manual }));
  const dialog = await screen.findByRole('dialog', {
    name: u.scan.manualTitle(t.scan.manualLabel),
  });
  const field = within(dialog).getByRole('textbox', { name: t.scan.manualLabel });
  expect(field).toHaveAttribute('placeholder', u.scan.manualPlaceholder(t.scan.manualLabel));
  await user.type(field, value);
  await user.click(within(dialog).getByRole('button', { name: u.dialog.confirm }));
};

describe('PopShipmentCompleteScreen (P-04-07)', () => {
  it('US4-3·W-2 — [직접 입력]은 지시서 번호만 쳐도 연다(앞머리 SHPREQ: 를 붙여 조회) — 「직접 입력으로 조회」(W-6)', async () => {
    const user = userEvent.setup();
    const { lookupCalls } = renderScreen();

    await typeDirect(user, 'SR-261118-001');

    expect(await screen.findByText(t.head.ready)).toBeInTheDocument();
    expect(new URL(lookupCalls()[0]?.url ?? '').searchParams.get('code')).toBe(CODE);
  });

  it('US4-3·W-2 — [직접 입력]에 코드 전체를 쳐도 그대로 연다. 없는 번호면 직접 입력용 문구로 알린다', async () => {
    const user = userEvent.setup();
    const { lookupCalls } = renderScreen({
      lookups: [jsonResponse(completion()), errorEnvelope('SHIPMENT_REQUEST_NOT_FOUND', 404)],
    });

    await typeDirect(user, CODE);
    expect(await screen.findByText(t.head.ready)).toBeInTheDocument();
    expect(new URL(lookupCalls()[0]?.url ?? '').searchParams.get('code')).toBe(CODE);

    await typeDirect(user, 'SR-261118-099');
    expect(await screen.findByText(t.scan.directNotFound('SR-261118-099'))).toBeInTheDocument();
  });

  it('Q10·W-3 — 새 코드가 열리지 않으면 아래 확인 화면이 앞서 연 지시서라는 것을 띠에 밝힌다', async () => {
    const user = userEvent.setup();
    renderScreen({
      lookups: [jsonResponse(completion()), errorEnvelope('NOT_SHIPMENT_REQUEST_CODE', 400)],
    });

    await scan(user, CODE);
    expect(await screen.findByText(t.head.ready)).toBeInTheDocument();
    await scan(user, 'P2611-0001');

    expect(await screen.findByText(t.scan.notCode('P2611-0001'))).toBeInTheDocument();
    expect(screen.getByText(t.scan.previousStill('SR-261118-001'))).toBeInTheDocument();
  });

  it('Q9·W-4·W-5 — 완료하면 단말 작업 수(탭 배지·남은 작업)를 다시 읽고, 결과 수량에 단위를 붙인다', async () => {
    const user = userEvent.setup();
    const { queryClient } = renderScreen();
    const invalidated: unknown[] = [];
    const original = queryClient.invalidateQueries.bind(queryClient);
    queryClient.invalidateQueries = ((filters?: { queryKey?: unknown }) => {
      invalidated.push(filters?.queryKey);
      return original(filters as never);
    }) as typeof queryClient.invalidateQueries;

    await scan(user, CODE);
    await user.click(await screen.findByRole('button', { name: t.bar.complete }));

    expect(await screen.findByText(t.result.title)).toBeInTheDocument();
    expect(invalidated).toContainEqual(['terminal-work-counts', 'pop']);
    expect(screen.getByText(/^160 EA/u)).toBeInTheDocument();
  });

  it('Q8·W-9 — [출하 완료]는 조회 전과 출하 불가일 때 잠기고, 까닭은 위 출하 불가 사유가 말한다(작업 줄에 글 없음)', async () => {
    const user = userEvent.setup();
    renderScreen({ lookups: [jsonResponse(blockedCompletion())] });

    expect(completeButton()).toBeDisabled();

    await scan(user, CODE);
    expect(await screen.findByText(t.blockers.heading)).toBeInTheDocument();
    expect(blockerRows()).toHaveLength(3);
    expect(completeButton()).toBeDisabled();
    expect(
      within(screen.getByRole('region', { name: t.bar.label })).queryByText(
        t.blockers.PICKING_SHORT.title,
      ),
    ).toBeNull();
  });

  it('스캔 대기 — 칸 이름은 「출하 지시서 조회」(칸 안 흐린 안내 없음), [직접 입력]·[지시서 검색], [출하 완료]는 잠겨 있다', () => {
    renderScreen();

    expect(screen.getByRole('heading', { name: t.title })).toBeInTheDocument();
    const field = screen.getByRole('textbox', { name: t.scan.label });
    expect(field).not.toHaveAttribute('placeholder');
    expect(screen.getByRole('button', { name: u.scan.manual })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.scan.search })).toBeInTheDocument();
    expect(completeButton()).toBeDisabled();
  });

  it('US4-5·Q9 — 지시서 코드를 스캔하면 확인 화면에 고객·납품처·수주, 라인 목표/피킹/초과/LOT 수, LOT 판정·코드, 창고가 보인다', async () => {
    const user = userEvent.setup();
    const { lookupCalls } = renderScreen();

    await scan(user, CODE);

    expect(await screen.findByText(t.head.ready)).toBeInTheDocument();
    expect(new URL(lookupCalls()[0]?.url ?? '').searchParams.get('code')).toBe(CODE);
    expect(screen.getByText('SR-261118-001')).toBeInTheDocument();
    expect(screen.getByText('가나전자 (C-GANA)')).toBeInTheDocument();
    expect(screen.getByText('가나전자 2공장 (C-GANA2)')).toBeInTheDocument();
    expect(screen.getByText('SO-T1')).toBeInTheDocument();

    const lines = screen.getByRole('table', { name: t.lines.caption });
    const line1 = within(lines).getAllByRole('row')[1] as HTMLElement;
    expect(within(line1).getByText('FG-A100')).toBeInTheDocument();
    expect(within(line1).getByText('센서 모듈 A')).toBeInTheDocument();
    expect(within(line1).getByText('100')).toBeInTheDocument();
    expect(within(line1).getByText('110')).toBeInTheDocument();
    expect(within(line1).getByText('+10')).toBeInTheDocument();
    expect(within(line1).getByText('3')).toBeInTheDocument();

    const lots = screen.getByRole('table', { name: t.lots.caption });
    const lot1 = within(lots).getByText('P2611-0001').closest('tr') as HTMLElement;
    expect(within(lot1).getByText(t.lots.oqc.ACCEPTED)).toBeInTheDocument();
    expect(within(lot1).getByText('GN-PLT-0007')).toBeInTheDocument();
    const lot4 = within(lots).getByText('P2611-0101').closest('tr') as HTMLElement;
    expect(within(lot4).getByText(t.lots.oqc.NOT_REQUIRED)).toBeInTheDocument();

    /* 머리 카드 한 장에 창고(칩)·합계까지(시안 2026-11-20) — 따로 선 창고 구획은 없다. */
    expect(screen.getByText('완제품 창고 A (WH-FG-A)')).toHaveClass('psc-wh-chip');
    expect(screen.getByText('완제품 창고 B (WH-FG-B)')).toHaveClass('psc-wh-chip');
    expect(screen.getByText(t.head.totalLots(4))).toBeInTheDocument();
    expect(screen.getByText(t.head.totalQty('160 EA'))).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: t.warehouses.heading })).toBeNull();
    /* 피킹 = 지시면 체크, 초과 0 은 흐리게. */
    const line2 = within(lines).getAllByRole('row')[2] as HTMLElement;
    expect(within(line2).getByRole('img', { name: t.lines.matched })).toBeInTheDocument();
    expect(within(line1).queryByRole('img', { name: t.lines.matched })).toBeNull();
    expect(within(line2).getByText('0')).toHaveClass('psc-zero');
    /* LOT 번호 아래 창고별 몫은 늘 보인다 — 「창고 | 수량」. 출하 관리 코드가 없으면 「-」. */
    const lot2 = within(lots).getByText('P2611-0002').closest('tr') as HTMLElement;
    expect(
      within(lot2).getByText(
        `${t.lots.portion('완제품 창고 A', '20')}, ${t.lots.portion('완제품 창고 B', '20')}`,
      ),
    ).toBeInTheDocument();
    expect(within(lot1).getByText(t.lots.portion('완제품 창고 A', '40'))).toBeInTheDocument();
    const lot3 = within(lots).getByText('P2611-0004').closest('tr') as HTMLElement;
    expect(within(lot3).getByText(t.lots.none)).toBeInTheDocument();

    expect(completeButton()).toBeEnabled();
  });

  it('US4-5·US3-5 — 적치 대기 자리 몫은 「적치 대기 n 포함」으로, 교체로 빠진 LOT 은 표 아래 한 줄로 알린다', async () => {
    const user = userEvent.setup();
    const base = completion();
    const lot = base.lots[2] as Completion['lots'][number];
    renderScreen({
      lookups: [
        jsonResponse(
          completion({
            lots: [
              ...base.lots.slice(0, 2),
              {
                ...lot,
                portions: [
                  {
                    ...(lot.portions[0] as Completion['lots'][number]['portions'][number]),
                    qty: 20,
                  },
                  {
                    warehouseId: 11,
                    warehouseCode: 'WH-FG-A',
                    warehouseName: '완제품 창고 A',
                    locationId: 9,
                    locationCode: 'SYS-STAGING',
                    locationSystemRoleCode: 'PUTAWAY_STAGING',
                    qty: 10,
                  },
                ],
              },
              ...base.lots.slice(3),
            ],
            replacedLots: [
              {
                shipmentRequestLotId: 703,
                lineNo: 1,
                lotId: 903,
                lotNo: 'P2611-0003',
                itemId: 3001,
                qty: 30,
                uomCode: 'EA',
                portions: [],
                judgment: 'REJECTED',
                nonconformanceNo: 'NC-261118-0004',
                replacedAt: '2026-11-18T07:22:00Z',
              },
            ],
          }),
        ),
      ],
    });

    await scan(user, CODE);

    const lots = await screen.findByRole('table', { name: t.lots.caption });
    const row = within(lots).getByText('P2611-0004').closest('tr') as HTMLElement;
    expect(
      within(row).getByText(
        `${t.lots.portion('완제품 창고 A', '30')} (${t.lots.staging('10 EA')})`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(t.lots.replaced(1, t.lots.replacedLot('P2611-0003', t.lots.oqc.REJECTED))),
    ).toBeInTheDocument();
    expect(within(lots).queryByText('P2611-0003')).toBeNull();
  });

  it('Q2 — 적치 대기 몫이 창고 1 에만 있으면 「(적치 대기 n 포함)」은 창고 1 몫 바로 뒤에만 붙는다', async () => {
    const user = userEvent.setup();
    const base = completion();
    const lot = base.lots[2] as Completion['lots'][number];
    const first = lot.portions[0] as Completion['lots'][number]['portions'][number];
    renderScreen({
      lookups: [
        jsonResponse(
          completion({
            lots: [
              ...base.lots.slice(0, 2),
              {
                ...lot,
                portions: [
                  { ...first, qty: 25 },
                  {
                    ...first,
                    locationId: 9,
                    locationCode: 'SYS-STAGING',
                    locationSystemRoleCode: 'PUTAWAY_STAGING',
                    qty: 5,
                  },
                  {
                    ...first,
                    warehouseId: 12,
                    warehouseCode: 'WH-FG-B',
                    warehouseName: '완제품 창고 B',
                    locationId: 10,
                    qty: 10,
                  },
                ],
              },
              ...base.lots.slice(3),
            ],
          }),
        ),
      ],
    });

    await scan(user, CODE);

    const lots = await screen.findByRole('table', { name: t.lots.caption });
    const row = within(lots).getByText('P2611-0004').closest('tr') as HTMLElement;
    expect(
      within(row).getByText(
        `${t.lots.portion('완제품 창고 A', '30')} (${t.lots.staging('5 EA')}), ${t.lots.portion('완제품 창고 B', '10')}`,
      ),
    ).toBeInTheDocument();
  });

  it('US7-1·Q15 — 확인 화면에 ERP 송신 표시가 없고, 수주 없는 지시서는 수주 칸만 「없음」이다', async () => {
    const user = userEvent.setup();
    renderScreen({ lookups: [jsonResponse(completion({ salesOrderNo: null }))] });

    await scan(user, CODE);

    expect(await screen.findByText(t.head.noSalesOrder)).toBeInTheDocument();
    expect(screen.queryByText(/ERP/u)).toBeNull();
    expect(completeButton()).toBeEnabled();
  });

  it('Q9 서버가 완료 단말·작업자를 싣지 않으면 작업자는 세션 이름(사번)이다 — 세션 작업자가 같은 사번일 때', async () => {
    setWorkerSession({
      worker: {
        workerId: 1,
        workerNo: '100027',
        workerName: '합성 작업자',
      } as WorkerSession['worker'],
      assignedAt: '2026-11-18T08:00:00+07:00',
      isOtherPlant: false,
    });
    try {
      const user = userEvent.setup();
      const bare = { ...completedShipment, completedTerminal: null, completedWorker: null };
      renderScreen({
        complete: [
          jsonResponse({
            ...completionResult(),
            completion: completion({
              completedShipment: bare,
              blockers: [{ code: 'ALREADY_COMPLETED' }],
            }),
          }),
        ],
      });
      await scan(user, CODE);
      await user.click(await screen.findByRole('button', { name: t.bar.complete }));

      expect(await screen.findByText('합성 작업자 (100027)')).toBeInTheDocument();
    } finally {
      setWorkerSession(null);
    }
  });

  it('US1-3·SC-002·Q9 — [출하 완료] 한 번으로 완료를 보내고(확인 창 없음) 결과가 다음 스캔까지 남는다', async () => {
    const user = userEvent.setup();
    const { completeCalls } = renderScreen();

    await scan(user, CODE);
    await user.click(await screen.findByRole('button', { name: t.bar.complete }));

    expect(await screen.findByText(t.result.title)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    const [call] = completeCalls();
    expect(completeCalls()).toHaveLength(1);
    expect(call?.headers.get('X-Worker-No')).toBe('100027');
    expect(call?.headers.get('Idempotency-Key')).toBeTruthy();
    expect(call?.headers.get('If-Match')).toBe('"3"');
    const body = (await call?.json()) as { businessDate: string; occurredAt: string };
    expect(body.businessDate).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(Number.isNaN(Date.parse(body.occurredAt))).toBe(false);

    expect(screen.getByText(completedShipment.shipmentNo)).toBeInTheDocument();
    expect(completeButton()).toBeDisabled();

    /* 결과는 저절로 사라지지 않는다 — 다음 스캔이 바꾼다. */
    await scan(user, 'SHPREQ:SR-261118-002');
    await waitFor(() => expect(screen.queryByText(t.result.title)).toBeNull());
    expect(await screen.findByText(t.head.ready)).toBeInTheDocument();
  });

  it('US1-4·US1-7·US4-6·Q8 — 막히면 이유마다 무엇·어디·어디서 풀지를 보이고 [출하 완료]를 잠근다', async () => {
    const user = userEvent.setup();
    renderScreen({
      lookups: [jsonResponse(blockedCompletion())],
    });

    await scan(user, CODE);

    expect(await screen.findByText(t.head.blocked)).toBeInTheDocument();
    expect(screen.getByText(t.blockers.heading)).toBeInTheDocument();
    expect(blockerRows()).toHaveLength(3);
    expect(screen.getByText(t.blockers.PICKING_SHORT.title)).toBeInTheDocument();
    expect(screen.getByText(t.blockers.line(2, 'FG-B200', '0', '50'))).toBeInTheDocument();
    expect(screen.getByText(t.blockers.PICKING_SHORT.hint)).toBeInTheDocument();
    expect(screen.getByText(t.blockers.NOT_INSPECTED.title)).toBeInTheDocument();
    expect(screen.getByText(t.blockers.REJECTED.title)).toBeInTheDocument();
    expect(completeButton()).toBeDisabled();

    /* 아래 작업 줄에는 따로 [상태 새로고침]이 없다 — 머리줄 [새로고침] 하나로 다시 읽는다. */
    expect(screen.queryByRole('button', { name: '상태 새로고침' })).not.toBeInTheDocument();
  });

  it('머리줄 [새로고침](전체 무효화)이 연 지시서를 같은 코드로 다시 읽어 그 자리에서 바꾼다 — 화면·검색 창은 닫히지 않는다', async () => {
    const user = userEvent.setup();
    const { queryClient, lookupCalls, listCalls } = renderScreen({
      lookups: [jsonResponse(blockedCompletion()), jsonResponse(completion())],
    });

    await scan(user, CODE);
    expect(await screen.findByText(t.head.blocked)).toBeInTheDocument();
    expect(completeButton()).toBeDisabled();
    await user.click(screen.getByRole('button', { name: t.scan.search }));
    const dialog = await screen.findByRole('dialog', { name: t.search.title });
    await waitFor(() => expect(listCalls()).toHaveLength(1));

    await queryClient.invalidateQueries();

    expect(await screen.findByText(t.head.ready)).toBeInTheDocument();
    expect(lookupCalls()).toHaveLength(2);
    expect(new URL(lookupCalls()[1]?.url ?? '').searchParams.get('code')).toBe(CODE);
    await waitFor(() => expect(listCalls()).toHaveLength(2));
    expect(dialog).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: t.search.close }));
    expect(completeButton()).toBeEnabled();
  });

  it('머리줄 [새로고침]에서 다시 읽지 못하면 앞 값을 그대로 두고 띠로 알린다', async () => {
    const user = userEvent.setup();
    const { queryClient } = renderScreen({
      lookups: [jsonResponse(completion()), errorEnvelope('INTERNAL', 500)],
    });

    await scan(user, CODE);
    expect(await screen.findByText(t.head.ready)).toBeInTheDocument();

    await queryClient.invalidateQueries();

    expect(await screen.findByText(t.scan.failed)).toBeInTheDocument();
    expect(screen.getByText(t.head.ready)).toBeInTheDocument();
    expect(completeButton()).toBeEnabled();
  });

  it('Q9·US1-3 — 완료 결과에 POP 단말과 작업자 이름(사번)이 보인다(시안 ⑥ 「단말 · 작업자」)', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scan(user, CODE);
    await user.click(await screen.findByRole('button', { name: t.bar.complete }));

    expect(await screen.findByText(t.result.completedBy)).toBeInTheDocument();
    expect(screen.getByText(t.result.who('POP-출하-01', '김작업', 'W-0102'))).toBeInTheDocument();
  });

  it('Q11 — 「이미 완료」 화면에도 완료한 POP 단말과 작업자 이름이 보인다(시안 ⑦)', async () => {
    const user = userEvent.setup();
    renderScreen({
      lookups: [
        jsonResponse(completion({ completedShipment, blockers: [{ code: 'ALREADY_COMPLETED' }] })),
      ],
    });

    await scan(user, CODE);

    expect(await screen.findByText(t.already.title)).toBeInTheDocument();
    expect(screen.getByText(t.result.who('POP-출하-01', '김작업', 'W-0102'))).toBeInTheDocument();
  });

  it('R-2·Q2 — 두 창고에 나뉜 LOT 은 머리 카드(「재고가 빠질 창고」 칩 아래)에 양쪽에 모두 센다고 알린다(시안 ③)', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scan(user, CODE);

    const section = await screen.findByRole('region', { name: t.head.request });
    expect(within(section).getByText(t.warehouses.splitLot('P2611-0002'))).toBeInTheDocument();
    expect(within(section).queryByText(t.warehouses.splitLot('P2611-0001'))).toBeNull();
  });

  it('US1-6·Q11 — 이미 완료된 지시서를 다시 스캔하면 노란 안내와 완료된 출하만 보이고 아무것도 보내지 않는다', async () => {
    const user = userEvent.setup();
    const done: Completion = completion({
      completedShipment,
      blockers: [{ code: 'ALREADY_COMPLETED' }],
    });
    const { completeCalls } = renderScreen({ lookups: [jsonResponse(done)] });

    await scan(user, CODE);

    expect(await screen.findByText(t.already.title)).toBeInTheDocument();
    expect(screen.getByText(completedShipment.shipmentNo)).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: t.lines.caption })).toBeNull();
    expect(completeButton()).toBeDisabled();
    expect(completeCalls()).toHaveLength(0);
  });

  it('Q11 — 다른 POP 이 먼저 완료하면(409 ALREADY_COMPLETED) 다시 읽어 「이미 출하 완료」로 보인다', async () => {
    const user = userEvent.setup();
    renderScreen({
      lookups: [
        jsonResponse(completion()),
        jsonResponse(completion({ completedShipment, blockers: [{ code: 'ALREADY_COMPLETED' }] })),
      ],
      complete: [conflict('ALREADY_COMPLETED')],
    });

    await scan(user, CODE);
    await user.click(await screen.findByRole('button', { name: t.bar.complete }));

    expect(await screen.findByText(t.already.title)).toBeInTheDocument();
  });

  it('US4-6·Q8 — 누르는 사이 막는 이유가 생기면(409 COMPLETION_BLOCKED) 응답의 이유를 그대로 보이고 다시 조회하지 않는다', async () => {
    const user = userEvent.setup();
    const { lookupCalls } = renderScreen({
      lookups: [jsonResponse(completion()), jsonResponse(blockedCompletion())],
      complete: [
        conflict('COMPLETION_BLOCKED', { blockers: [{ code: 'PICKING_SHORT', lineNo: 2 }] }),
      ],
    });

    await scan(user, CODE);
    await user.click(await screen.findByRole('button', { name: t.bar.complete }));

    expect(await screen.findByText(t.failure.blocked)).toBeInTheDocument();
    await waitFor(() => expect(blockerRows()).toHaveLength(1));
    expect(screen.getByText(t.blockers.line(2, 'FG-B200', '50', '50'))).toBeInTheDocument();
    expect(completeButton()).toBeDisabled();
    expect(lookupCalls()).toHaveLength(1);
  });

  it('Q8 — 409 에 막는 이유가 없으면(옛 서버) 확인 값을 다시 읽어 이유를 보인다', async () => {
    const user = userEvent.setup();
    const { lookupCalls } = renderScreen({
      lookups: [jsonResponse(completion()), jsonResponse(blockedCompletion())],
      complete: [conflict('COMPLETION_BLOCKED')],
    });

    await scan(user, CODE);
    await user.click(await screen.findByRole('button', { name: t.bar.complete }));

    await waitFor(() => expect(blockerRows()).toHaveLength(3));
    expect(screen.getByText(t.failure.blocked)).toBeInTheDocument();
    expect(lookupCalls()).toHaveLength(2);
  });

  it('Q2·FR-019 — 409 ALREADY_COMPLETED 인데 다시 읽어도 완료되지 않았으면 확인 화면에 서버 문구와 함께 오류를 보인다', async () => {
    const user = userEvent.setup();
    renderScreen({
      lookups: [jsonResponse(completion()), jsonResponse(completion())],
      complete: [conflict('ALREADY_COMPLETED', { message: '이미 출하 완료된 지시서입니다.' })],
    });

    await scan(user, CODE);
    await user.click(await screen.findByRole('button', { name: t.bar.complete }));

    expect(
      await screen.findByText(
        t.failure.withMessage(t.failure.alreadyNotDone, '이미 출하 완료된 지시서입니다.'),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(t.head.ready)).toBeInTheDocument();
  });

  it('Q2 — 다른 409(VERSION_CONFLICT 등)는 서버 문구를 함께 보인다', async () => {
    const user = userEvent.setup();
    renderScreen({
      complete: [conflict('VERSION_CONFLICT', { message: '다른 곳에서 지시서가 바뀌었습니다.' })],
    });

    await scan(user, CODE);
    await user.click(await screen.findByRole('button', { name: t.bar.complete }));

    expect(
      await screen.findByText(
        t.failure.withMessage(t.failure.changed, '다른 곳에서 지시서가 바뀌었습니다.'),
      ),
    ).toBeInTheDocument();
  });

  it('#334 — 라인을 짚지 않은 피킹 부족(낼 피킹 LOT 없음)은 「피킹된 출하 LOT이 없습니다」로, LOT 표 대신 빈 줄로 보인다', async () => {
    const user = userEvent.setup();
    renderScreen({
      lookups: [
        jsonResponse(
          completion({
            lots: [],
            warehouses: [],
            blockers: [{ code: 'PICKING_SHORT' }],
          }),
        ),
      ],
    });

    await scan(user, CODE);

    expect(await screen.findByText(t.blockers.noPickedLot.title)).toBeInTheDocument();
    expect(screen.queryByText(t.blockers.PICKING_SHORT.title)).toBeNull();
    expect(screen.getByText(t.lots.heading(0))).toBeInTheDocument();
    expect(screen.getByText(t.lots.empty)).toBeInTheDocument();
    expect(completeButton()).toBeDisabled();
  });

  it('서버가 응답하지 못해 완료하지 못하면 확인 화면에 남고 같은 멱등 키로 다시 누른다', async () => {
    const user = userEvent.setup();
    const { completeCalls } = renderScreen({
      complete: [jsonResponse({ message: 'down' }, { status: 503 })],
    });

    await scan(user, CODE);
    await user.click(await screen.findByRole('button', { name: t.bar.complete }));
    expect(
      await screen.findByText(t.failure.withMessage(t.failure.other, 'down')),
    ).toBeInTheDocument();

    await user.click(completeButton());
    expect(await screen.findByText(t.result.title)).toBeInTheDocument();
    const [first, second] = completeCalls();
    expect(second?.headers.get('Idempotency-Key')).toBe(first?.headers.get('Idempotency-Key'));
    /* 같은 키면 본문(영업일·시각)도 같아야 한다 — 다르면 서버가 409 DUPLICATE_KEY 로 거절한다(실화면 검증 2026-11-20). */
    expect(await second?.text()).toBe(await first?.text());
  });

  it('[출하 완료]를 빠르게 두 번 눌러도 요청은 하나만 나간다(실화면 검증 2026-11-20)', async () => {
    const user = userEvent.setup();
    const { completeCalls } = renderScreen();

    await scan(user, CODE);
    const button = await screen.findByRole('button', { name: t.bar.complete });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    fireEvent.click(button);

    expect(await screen.findByText(t.result.title)).toBeInTheDocument();
    expect(completeCalls()).toHaveLength(1);
  });

  it('US4-3·Q10 — 지시서 코드가 아닌 값을 스캔하면 읽은 값과 함께 알린다', async () => {
    const user = userEvent.setup();
    renderScreen({ lookups: [errorEnvelope('NOT_SHIPMENT_REQUEST_CODE', 400)] });

    await scan(user, 'P2611-0001');

    expect(await screen.findByText(t.scan.notCode('P2611-0001'))).toBeInTheDocument();
    expect(completeButton()).toBeDisabled();
  });

  it('Q10 — 형식은 맞지만 없는 지시서는 「찾을 수 없는 출하 지시서」다. 열려 있던 확인 화면은 닫지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({
      lookups: [jsonResponse(completion()), errorEnvelope('SHIPMENT_REQUEST_NOT_FOUND', 404)],
    });

    await scan(user, CODE);
    expect(await screen.findByText(t.head.ready)).toBeInTheDocument();
    await scan(user, 'SHPREQ:SR-261118-099');

    expect(await screen.findByText(t.scan.notFound('SHPREQ:SR-261118-099'))).toBeInTheDocument();
    expect(screen.getByText(t.head.ready)).toBeInTheDocument();
  });

  it('사번이 없으면 경고 띠가 서고 [출하 완료]를 누를 수 없다', async () => {
    const user = userEvent.setup();
    renderScreen({}, null);

    await scan(user, CODE);

    expect(await screen.findByText(t.head.ready)).toBeInTheDocument();
    expect(screen.getByText(messages.popChrome.workerMissing)).toBeInTheDocument();
    expect(completeButton()).toBeDisabled();
  });

  it('US4-4·Q10 — 지시서 검색은 「출하 가능만 표시」가 켠 채 열리고, 검색해 고른 지시서는 스캔과 같은 확인 화면으로 간다', async () => {
    const user = userEvent.setup();
    const { listCalls, lookupCalls } = renderScreen();

    await user.click(screen.getByRole('button', { name: t.scan.search }));
    const dialog = await screen.findByRole('dialog', { name: t.search.title });

    expect(within(dialog).getByRole('checkbox', { name: t.search.readyOnly })).toBeChecked();
    await waitFor(() => expect(listCalls()).toHaveLength(1));
    const firstQuery = new URL(listCalls()[0]?.url ?? '').searchParams;
    expect(firstQuery.get('completionReadyOnly')).toBe('true');
    expect(firstQuery.get('shipDateFrom')).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    /* 결과 수는 쪽 넘김의 「총 N건」 한 곳에만 — 거르기 줄에는 없다. 창 안은 구르지 않고 쪽으로 나눈다. */
    expect(await within(dialog).findByText(u.pager.total(1))).toBeInTheDocument();
    expect(within(dialog).getByRole('navigation', { name: t.search.pageNav })).toBeInTheDocument();

    /* 찾기 칸을 누르면 다른 화면과 같은 글자판 창이 뜬다 — 넣고 [검색]. */
    await user.click(within(dialog).getByRole('searchbox', { name: t.search.queryLabel }));
    const keyboard = await screen.findByRole('dialog', {
      name: u.scan.manualTitle(t.search.queryLabel),
    });
    const queryField = within(keyboard).getByRole('textbox', { name: t.search.queryLabel });
    expect(queryField).toHaveAttribute(
      'placeholder',
      u.scan.manualPlaceholder(t.search.queryHeading),
    );
    await user.type(queryField, '가나');
    await user.click(within(keyboard).getByRole('button', { name: u.scan.search }));
    await waitFor(() => expect(listCalls()).toHaveLength(2));
    expect(new URL(listCalls()[1]?.url ?? '').searchParams.get('q')).toBe('가나');

    const row = await within(dialog).findByRole('button', {
      name: t.search.select('SR-261118-001'),
    });
    expect(within(row).getByText(t.search.ready)).toBeInTheDocument();
    /* US4-4·Q10 — 고객 이름은 지시서 행의 customer 를 쓴다(POP 은 거래처 목록을 못 읽는다). */
    expect(within(row).getByText('가나전자(행)')).toBeInTheDocument();
    expect(within(row).getByText(t.search.summaryValue(2, 4, '160', '150'))).toBeInTheDocument();
    expect(
      within(row).getByText(t.search.itemsValue('FG-A100', '센서 모듈 A', 1)),
    ).toBeInTheDocument();
    await user.click(row);

    expect(await screen.findByText(t.head.ready)).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: t.search.title })).toBeNull();
    expect(new URL(lookupCalls()[0]?.url ?? '').searchParams.get('code')).toBe(CODE);
  });

  it('US4-6 — 검색에서 출하 불가 지시서는 사유 요약을 보이고, 빈 목록은 필터 해제 안내를 준다(필터는 체크 칸 하나)', async () => {
    const user = userEvent.setup();
    const { listCalls } = renderScreen({
      list: [
        jsonResponse({ items: [], page: { page: 1, size: 20, total: 0 } }),
        jsonResponse({
          items: [
            requestRow({
              completionBlockers: [
                { code: 'NOT_INSPECTED', lotNo: 'P2611-0002' },
                { code: 'PICKING_SHORT', lineNo: 2 },
              ],
              blockerSummary: { NOT_INSPECTED: 1, PICKING_SHORT: 1 },
            }),
          ],
          page: { page: 1, size: 20, total: 1 },
        }),
      ],
    });

    await user.click(screen.getByRole('button', { name: t.scan.search }));
    const dialog = await screen.findByRole('dialog', { name: t.search.title });

    expect(await within(dialog).findByText(t.search.empty)).toBeInTheDocument();
    expect(within(dialog).getByText(t.search.emptyHintFiltered)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('checkbox', { name: t.search.readyOnly }));

    await waitFor(() => expect(listCalls()).toHaveLength(2));
    const query = new URL(listCalls()[1]?.url ?? '').searchParams;
    expect(query.get('completionReadyOnly')).toBeNull();
    expect(query.get('shippableRemainderOnly')).toBe('true');
    expect(await within(dialog).findByText(t.search.blocked)).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        `${t.search.blockerCount.PICKING_SHORT(1)}, ${t.search.blockerCount.NOT_INSPECTED(1)}`,
      ),
    ).toBeInTheDocument();
  });
});
