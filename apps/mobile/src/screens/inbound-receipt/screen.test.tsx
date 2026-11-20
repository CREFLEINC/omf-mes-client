import type {
  InboundLotDetail,
  InboundLotMaterialLot,
  InboundLotReceive,
} from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { runBackStep } from '../../patterns/back-step';
import { signal } from '../../patterns/scan-feedback';
import { useWorkerSession } from '../../patterns/worker-session';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { InboundReceiptScreen } from './screen';

/**
 * 005 T055 — M-01-01 입하 등록: 스캔마다 `:receive` 1건 · 방금 찍은 라벨 · 이번 입하 표 · 품목 화면(해제 · 공급사 LOT
 * 시트 · 이 품목만 마감) · 모두 마감 · 오프라인 전송 대기(screens/M-01-01.md · 사용자 지시 2026-11-20). 값은 전부
 * 지어낸 것이다(공개 저장소 경계).
 */

vi.mock('../../patterns/scan-feedback', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../patterns/scan-feedback')>()),
  signal: vi.fn(),
}));

const t = messages.inboundReceipt;
const WORKER = '900028';

/** 라벨 번호 — 품목 · 수량 · 날짜 · 공급사 · 일련(MES 형식). */
const label = (item: string, supplier: string, serial: number): string =>
  `${item}|1000|261111|${supplier}|${String(serial).padStart(4, '0')}`;

const A = (serial: number) => label('SYN-CAP', 'SYN01', serial);
const B = (serial: number) => label('SYN-RES', 'SYN02', serial);

interface Sent {
  method: string;
  path: string;
  headers: Headers;
  body: unknown;
}

interface ServerOptions {
  /** 이 번호는 폐기됨(409). */
  voided?: string[];
  /** 스캔 때 지난 날짜로 자동 마감할 입하 LOT 번호. */
  autoClose?: string;
  /** 공급사 LOT 저장을 409(그사이 마감)로. */
  supplierLotLocked?: boolean;
  /** 이 번호는 자재 관리 LOT 이 아님(409 NOT_MATERIAL_LOT). */
  notMaterial?: string[];
  /** 새 입하 LOT 의 검사 필요 여부(기본 참). */
  inspectionRequired?: boolean;
  /** IQC 기본 생략 기준이 걸리는가(서버 S12 · G2 L15). 주지 않으면 칸을 싣지 않는다. */
  iqcDefaultSkipApplies?: boolean;
  /** 이미 입하된 번호 — 서버가 거부 줄에 그 입하 LOT 번호 · 상태를 싣는다(S8). */
  /** 패키징 단위 이름(S8) — 없으면 칸을 싣지 않는다. */
  packageUomName?: string;
  receivedElsewhere?: Record<string, { inboundLotNo: string; statusCode: string }>;
}

/** 흉내 서버 — 공장 · 공급사 · 품목마다 「입하 중」 입하 LOT 하나. */
const createServer = (options: ServerOptions = {}) => {
  const sent: Sent[] = [];
  const lots = new Map<number, InboundLotDetail>();
  const registered = new Set<string>();
  let offline = false;
  let nextLot = 6000;
  let nextMaterial = 9000;

  const detailOf = (id: number) => lots.get(id);
  const pairOf = (lotNo: string) => {
    const [item = '', , , supplier = ''] = lotNo.split('|');

    return { item, supplier };
  };

  const record = async (request: Request): Promise<Sent> => {
    const entry: Sent = {
      method: request.method,
      path: new URL(request.url).pathname,
      headers: request.headers,
      body: request.method === 'GET' ? null : await request.clone().json(),
    };
    sent.push(entry);

    return entry;
  };

  const lock = (message: string) =>
    jsonResponse({ errors: [{ scope: 'screen', code: 'STATE_LOCKED', message }] }, { status: 409 });

  /** 받기 거부 — 서버처럼 줄마다 `errors[]` 하나와 `rejectedLots[].reasonCode`(계약 §3). */
  const rejectReceive = (lotNo: string, reasonCode: string, message: string) =>
    jsonResponse(
      {
        errors: [{ scope: 'field', field: 'lots.0', code: 'STATE_LOCKED', message }],
        rejectedLots: [{ index: 0, lotId: 8800, lotNo, reasonCode }],
      },
      { status: 409 },
    );

  const routes = createStubFetch([
    {
      match: (request) => new URL(request.url).pathname === '/logistics/inbound-lots:receive',
      respond: async (request) => {
        const entry = await record(request);
        const body = entry.body as InboundLotReceive;
        const first = body.lots[0];
        const lotNo = first !== undefined && 'lotNo' in first ? first.lotNo : '';

        if (options.voided?.includes(lotNo) === true) {
          return rejectReceive(lotNo, 'VOIDED', '폐기된 LOT 입니다.');
        }
        const elsewhere = options.receivedElsewhere?.[lotNo];
        if (elsewhere !== undefined) {
          return jsonResponse(
            {
              errors: [
                {
                  scope: 'field',
                  field: 'lots.0',
                  code: 'STATE_LOCKED',
                  message: '이미 입하된 LOT 입니다.',
                },
              ],
              rejectedLots: [
                {
                  index: 0,
                  lotId: 8801,
                  lotNo,
                  reasonCode: 'ALREADY_RECEIVED',
                  inboundLotNo: elsewhere.inboundLotNo,
                  inboundLotStatusCode: elsewhere.statusCode,
                },
              ],
            },
            { status: 409 },
          );
        }
        if (options.notMaterial?.includes(lotNo) === true) {
          return rejectReceive(lotNo, 'NOT_MATERIAL_LOT', '자재 관리 LOT 이 아닙니다.');
        }
        if (registered.has(lotNo)) {
          return rejectReceive(lotNo, 'ALREADY_RECEIVED', '이미 입하된 LOT 입니다.');
        }

        const { item, supplier } = pairOf(lotNo);
        let autoClosed: string | null = null;
        let open = [...lots.values()].find(
          (each) =>
            each.statusCode === 'RECEIVING' &&
            each.itemCode === item &&
            each.supplierCode === supplier,
        );

        if (open !== undefined && open.inboundLotNo === options.autoClose) {
          open.statusCode = 'RECEIVED';
          autoClosed = open.inboundLotNo;
          open = undefined;
        }

        const created = open === undefined;

        if (open === undefined) {
          nextLot += 1;
          open = {
            inboundLotId: nextLot,
            inboundLotNo: `SYN-IL-${String(nextLot)}`,
            plantId: 1,
            supplierId: supplier === 'SYN01' ? 1 : 2,
            supplierCode: supplier,
            supplierName: `합성 공급사 ${supplier}`,
            itemId: 1,
            itemCode: item,
            itemName: '합성 자재',
            uomCode: 'EA',
            statusCode: 'RECEIVING',
            receivingDate: '2026-11-11',
            inboundReceiptNo: `SYN-IR-${String(nextLot)}`,
            lotCount: 0,
            receivedQty: 0,
            goodsReceivedQty: 0,
            unallocatedQty: 0,
            iqc: null,
            inspectionRequired: options.inspectionRequired ?? true,
            iqcDefaultSkipApplies: options.iqcDefaultSkipApplies ?? false,
            firstRegisteredAt: '2026-11-11T01:00:00Z',
            receivedClosedAt: null,
            closedAutomatically: false,
            finalizedAt: null,
            reopenable: false,
            reopenReasonCode: null,
            reopenBlockerCode: null,
            openInboundLotNo: null,
            reopened: false,
            finalizable: false,
            erpSendModeCode: 'ON_FINALIZE',
            versionNo: 1,
            poAllocations: [],
            finalizedByName: null,
            finalizeBlockers: [],
            lotProgress: { received: 0, inIqc: 0, inDisposition: 0, disposed: 0, returned: 0 },
            lots: [],
            events: [],
          };
          lots.set(open.inboundLotId, open);
        }

        nextMaterial += 1;
        const material: InboundLotMaterialLot = {
          lotId: nextMaterial,
          lotNo,
          lotQty: 1000,
          package: {
            uomId: 2,
            uomCode: '봉지',
            /* 이름이 없으면 화면은 코드를 쓴다 — 코드와 같은 값을 실어 그 모양을 지킨다. */
            uomName: options.packageUomName ?? '봉지',
            count: 10,
            qtyPerPackage: 100,
          },
          supplierLotNo: null,
          lifecycleStatusCode: 'ACTIVE',
          statusCode: 'INSPECTION_PENDING',
          registeredAt: '2026-11-11T01:05:00Z',
          fromSupplierLabel: false,
          goodsReceived: false,
          dispositionStatusCode: null,
        };
        open.lots.push(material);
        open.lotCount = open.lots.length;
        open.receivedQty += 1000;
        open.versionNo += 1;
        registered.add(lotNo);

        return jsonResponse(
          {
            inboundLots: [
              {
                inboundLotId: open.inboundLotId,
                inboundLotNo: open.inboundLotNo,
                created,
                autoClosedInboundLotNo: autoClosed,
                iqcDefaultSkipApplies: open.iqcDefaultSkipApplies,
                inboundReceiptNo: open.inboundReceiptNo ?? '',
                receivedQty: open.receivedQty,
                lotCount: open.lotCount,
                lots: [
                  {
                    lotId: material.lotId,
                    lotNo,
                    lotQty: 1000,
                    statusCode: 'INSPECTION_PENDING',
                    fromSupplierLabel: false,
                  },
                ],
              },
            ],
          },
          { status: 201 },
        );
      },
    },
    {
      match: (request) => /^\/logistics\/inbound-lots\/\d+$/u.test(new URL(request.url).pathname),
      respond: (request) => {
        const id = Number(/(\d+)$/u.exec(new URL(request.url).pathname)?.[1]);
        const found = detailOf(id);

        return found === undefined
          ? jsonResponse({ message: '없음' }, { status: 404 })
          : jsonResponse(structuredClone(found));
      },
    },
    {
      match: (request) => /:unregister-lots$/u.test(new URL(request.url).pathname),
      respond: async (request) => {
        const entry = await record(request);
        const id = Number(/inbound-lots\/(\d+):/u.exec(entry.path)?.[1]);
        const found = detailOf(id);
        const { lotIds } = entry.body as { lotIds: number[] };

        if (found === undefined) return jsonResponse({}, { status: 404 });
        for (const lotId of lotIds) {
          const lot = found.lots.find((each) => each.lotId === lotId);
          if (lot !== undefined) registered.delete(lot.lotNo);
        }
        found.lots = found.lots.filter((each) => !lotIds.includes(each.lotId));
        found.lotCount = found.lots.length;
        found.receivedQty = found.lots.length * 1000;
        if (found.lots.length === 0) found.statusCode = 'VOIDED';
        found.versionNo += 1;

        return jsonResponse(structuredClone(found));
      },
    },
    {
      match: (request) => /:close-receipt$/u.test(new URL(request.url).pathname),
      respond: async (request) => {
        const entry = await record(request);
        const id = Number(/inbound-lots\/(\d+):/u.exec(entry.path)?.[1]);
        const found = detailOf(id);

        if (found === undefined) return jsonResponse({}, { status: 404 });
        found.statusCode = 'RECEIVED';
        found.iqc = {
          requestId: 7001,
          requestNo: 'SYN-IQC-0001',
          statusCode: 'REQUESTED',
          overallJudgmentCode: null,
        };
        found.versionNo += 1;

        return jsonResponse({ ...structuredClone(found), iqcRequestId: 7001 });
      },
    },
    {
      match: (request) => /\/lots\/supplier-lot-no$/u.test(new URL(request.url).pathname),
      respond: async (request) => {
        const entry = await record(request);

        if (options.supplierLotLocked === true) return lock('입하 LOT 이 마감됐습니다');

        const id = Number(/inbound-lots\/(\d+)\//u.exec(entry.path)?.[1]);
        const found = detailOf(id);
        const { lotIds, supplierLotNo } = entry.body as {
          lotIds: number[];
          supplierLotNo: string | null;
        };

        for (const lot of found?.lots ?? []) {
          if (lotIds.includes(lot.lotId)) lot.supplierLotNo = supplierLotNo;
        }

        return jsonResponse({ lots: [] });
      },
    },
  ]);

  const fetch = async (request: Request): Promise<Response> => {
    if (offline) throw new TypeError('Failed to fetch');

    return routes(request);
  };

  return {
    fetch,
    sent,
    lots,
    setOffline: (value: boolean) => {
      offline = value;
    },
  };
};

const SignedIn = ({ children }: { children: ReactNode }) => {
  const { worker, signIn } = useWorkerSession();

  useEffect(() => {
    if (worker === null) signIn({ workerNo: WORKER, workerName: '합성 작업자' });
  }, [signIn, worker]);

  return worker === null ? null : children;
};

const mount = (server: ReturnType<typeof createServer>) =>
  renderWithProviders(
    <MemoryRouter>
      <SignedIn>
        <InboundReceiptScreen />
      </SignedIn>
    </MemoryRouter>,
    { fetch: server.fetch },
  );

/** 찍고 방금 찍은 칸에 그 번호가 설 때까지 — 앞 스캔이 끝나기 전 스캔은 화면이 받지 않는다. */
const scanDone = async (code: string): Promise<void> => {
  await scan(code);
  await waitFor(() => expect(lastScan()).toHaveTextContent(code));
};

const scan = async (code: string): Promise<void> => {
  const field = (await screen.findByLabelText(t.scan.label)) as HTMLInputElement;

  field.focus();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, code);
  field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
};

const receives = (sent: readonly Sent[]) =>
  sent.filter((entry) => entry.path === '/logistics/inbound-lots:receive');

const ITEM = '합성 자재';

const lastScan = (): HTMLElement => screen.getByRole('status', { name: t.scan.results });

const tally = (): HTMLElement => screen.getByRole('region', { name: t.tally.title });

/** 이번 입하 표의 품목 줄 — 품목코드로. */
const rowOf = (itemCode: string): HTMLElement =>
  screen.getByRole('button', { name: t.tally.open(itemCode, ITEM) }).closest('tr') as HTMLElement;

/** 표의 행 번호 · 품목코드 차례. */
const tallyCodes = (): string[] =>
  [...tally().querySelectorAll('tbody tr:not(.receive-tally__group)')].map(
    (tr) =>
      `${tr.querySelector('.receive-tally__no')?.textContent ?? ''} ${
        tr.querySelector('.receive-tally__code')?.firstChild?.textContent ?? ''
      }`,
  );

const openItem = async (user: ReturnType<typeof userEvent.setup>, itemCode: string) => {
  await user.click(await screen.findByRole('button', { name: t.tally.open(itemCode, ITEM) }));

  return screen.findByRole('region', { name: t.lots.label });
};

const signals = (): string[] => vi.mocked(signal).mock.calls.map(([kind]) => kind);

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(signal).mockClear();
});

describe('M-01-01 입하 등록 — 화면에 없는 것', () => {
  it('입하 LOT · P/O 고르기, 「LOT 번호 없음」 대체 사유, 직접 입력 단추가 없다 — 스캔 칸 하나', async () => {
    mount(createServer());

    expect(await screen.findByLabelText(t.scan.label)).toBeInTheDocument();
    expect(screen.queryByText(/P\/O/u)).toBeNull();
    expect(screen.queryByText(/LOT 번호 없음/u)).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    /* 스캔만 받는다(사용자 지시 2026-11-20 「직접 입력 단추 없애」). */
    expect(screen.queryByRole('button', { name: /직접 입력|입력한 번호/u })).toBeNull();
    expect(screen.getByText(t.tally.empty)).toBeInTheDocument();
  });

  it('화면 코드 · 입하 LOT 번호를 적지 않는다', async () => {
    mount(createServer());

    await scan(A(1));
    await screen.findByRole('button', { name: t.tally.open('SYN-CAP', ITEM) });

    expect(document.body.textContent).not.toMatch(/[MPW]-0\d-\d\d/u);
    /* 작업자가 쓰지 않는 번호다(사용자 지시 2026-11-20). */
    expect(document.body.textContent).not.toMatch(/SYN-IL-/u);
  });
});

describe('US2-1 스캔마다 바로 등록', () => {
  it('US2-1 스캔마다 `:receive` 1건(원소 하나 · 멱등 키 하나 · 사번) — 방금 찍은 칸과 이번 입하 개수', async () => {
    const server = createServer();
    mount(server);

    await scan(A(1));
    await waitFor(() => expect(lastScan()).toHaveTextContent(ITEM));
    await scan(A(2));
    await waitFor(() => expect(tally()).toHaveTextContent(t.tally.total(2)));

    const sent = receives(server.sent);
    expect(sent).toHaveLength(2);
    expect((sent[0]?.body as InboundLotReceive).lots).toEqual([{ lotNo: A(1) }]);
    expect(sent[0]?.headers.get('X-Worker-No')).toBe(WORKER);
    expect(sent[0]?.headers.get('Idempotency-Key')).not.toBe(
      sent[1]?.headers.get('Idempotency-Key'),
    );

    /* 방금 찍은 라벨 — 품목코드 · 품목명 · 수량 · 번호 끝. 공급사는 표에 있어 되풀이하지 않는다. */
    const last = within(lastScan());
    expect(last.getByText(t.last.ok)).toBeInTheDocument();
    expect(last.getByText('SYN-CAP')).toBeInTheDocument();
    expect(last.getByText('1,000')).toBeInTheDocument();
    expect(last.queryByText('합성 공급사 SYN01')).toBeNull();
    /* 번호는 줄이지 않고 전체를. */
    expect(last.getByText(A(2))).toBeInTheDocument();
    /* 같은 품목을 이어 찍으면 「새 품목」은 없다. */
    expect(last.queryByText(t.last.newItem)).toBeNull();

    /* 이번 입하 표 — 품목 줄 하나, 개수 2 · 수량 2,000, 방금 찍은 줄. */
    const row = rowOf('SYN-CAP');
    expect(row).toHaveAttribute('data-current', 'true');
    expect(within(row).getByText('2')).toBeInTheDocument();
    expect(row).toHaveTextContent('2,000EA');
    expect(signals()).toEqual(['confirm', 'confirm']);
  });

  it('US2-4 공급사·품목이 섞이면 공급사 묶음 아래 줄이 늘고, 줄은 처음 찍은 차례에 행 번호로 선다 — 다른 품목은 「새 품목」', async () => {
    mount(createServer());

    await scan(A(1));
    await screen.findByRole('button', { name: t.tally.open('SYN-CAP', ITEM) });
    await scan(B(1));
    await screen.findByRole('button', { name: t.tally.open('SYN-RES', ITEM) });

    expect(within(lastScan()).getByText(t.last.newItem)).toBeInTheDocument();
    await scan(A(2));
    await waitFor(() => expect(rowOf('SYN-CAP')).toHaveAttribute('data-current', 'true'));

    /* 마지막에 찍은 것이 위로 올라오지 않는다 — 행 번호로 센다. */
    expect(tallyCodes()).toEqual(['1 SYN-CAP', '2 SYN-RES']);
    expect(
      within(tally())
        .getAllByRole('columnheader')
        .filter((th) => th.getAttribute('scope') === 'colgroup')
        .map((th) => th.textContent),
    ).toEqual(['합성 공급사 SYN01', '합성 공급사 SYN02']);
    expect(tally()).toHaveTextContent(t.tally.total(3));
    expect(signals()).toEqual(['confirm', 'warn', 'warn']);
  });

  it('US2-5 폐기 라벨은 빨간 거부 — 까닭은 서버 reasonCode 로 가른다(G1)', async () => {
    mount(createServer({ voided: [A(9)] }));

    await scan(A(9));

    const last = within(await screen.findByRole('region', { name: t.last.rejected }));
    expect(last.getByText(t.reject.voided)).toBeInTheDocument();
    expect(last.getByText(A(9))).toBeInTheDocument();
    expect(signals()).toEqual(['reject']);
  });

  it('이번 입하 표에 이미 있는 라벨은 서버에 보내지 않고 회색으로 몇 번 줄인지 알린다', async () => {
    const server = createServer();
    mount(server);

    await scan(A(1));
    await screen.findByRole('button', { name: t.tally.open('SYN-CAP', ITEM) });
    await scan(A(1));

    const last = await screen.findByRole('region', { name: t.last.duplicate });
    expect(last).toHaveTextContent(t.last.duplicateRow(1));
    expect(rowOf('SYN-CAP')).toHaveAttribute('data-duplicate', 'true');
    expect(rowOf('SYN-CAP')).toHaveAttribute('data-current', 'false');
    expect(receives(server.sent)).toHaveLength(1);
    expect(signals()).toEqual(['confirm', 'warn']);
  });

  it('방금 찍은 칸은 늘 하나 — 앞선 거부는 쌓이지 않고 덮인다', async () => {
    mount(createServer({ voided: [A(8), A(9)] }));

    await scan(A(8));
    await screen.findByText(A(8));
    await scan(A(9));
    await screen.findByText(A(9));
    await scan(A(1));
    await screen.findByRole('region', { name: t.last.ok });

    expect(lastScan().querySelectorAll('.last-scan')).toHaveLength(1);
    expect(screen.queryByText(t.reject.voided)).toBeNull();
  });

  it('G1 자재 관리 LOT 이 아닌 라벨도 까닭별 문구로 거부한다', async () => {
    mount(createServer({ notMaterial: [B(5)] }));

    await scan(B(5));

    expect(await screen.findByText(t.reject.notMaterialLot)).toBeInTheDocument();
  });

  it('G1 이미 입하된 라벨 — 서버가 상태를 주면 이 화면에 없어도 「입하가 끝난 라벨」', async () => {
    mount(
      createServer({
        receivedElsewhere: { [B(7)]: { inboundLotNo: 'SYN-IL-5000', statusCode: 'RECEIVED' } },
      }),
    );

    await scan(B(7));

    expect(await screen.findByText(t.reject.alreadyReceived)).toBeInTheDocument();
    expect(screen.getByText(t.reject.alreadyReceivedIn(false))).toBeInTheDocument();
  });

  it('날짜가 바뀌어 자동 마감된 입하가 있으면 방금 찍은 칸에 적고, 마감된 줄은 「마감됨」으로 남는다', async () => {
    mount(createServer({ autoClose: 'SYN-IL-6001' }));

    await scan(A(1));
    await screen.findByRole('button', { name: t.tally.open('SYN-CAP', ITEM) });
    await scan(A(2));

    expect(await screen.findByText(t.last.autoClosed)).toBeInTheDocument();
    await waitFor(() => expect(tallyCodes()).toEqual(['1 SYN-CAP', '2 SYN-CAP']));
    expect(within(tally()).getByText(t.tally.closed)).toBeInTheDocument();
  });
});

describe('방금 찍은 칸의 [취소]', () => {
  it('[취소]는 그 라벨 하나를 확인 없이 푼다 — 마지막 LOT 을 풀면 품목 줄이 사라진다', async () => {
    const user = userEvent.setup();
    const server = createServer();
    mount(server);

    await scanDone(A(1));
    await scan(A(2));
    await waitFor(() => expect(tally()).toHaveTextContent(t.tally.total(2)));
    await user.click(await screen.findByRole('button', { name: t.last.undoLabel(A(2)) }));

    expect(
      await screen.findByText(t.unregistered.toast('…|SYN01|0002', '1,000 EA')),
    ).toBeInTheDocument();
    expect(server.sent.find((each) => each.path.endsWith(':unregister-lots'))?.body).toMatchObject({
      lotIds: [9002],
    });
    await waitFor(() => expect(tally()).toHaveTextContent(t.tally.total(1)));

    await scan(A(3));
    await user.click(await screen.findByRole('button', { name: t.last.undoLabel(A(3)) }));
    await waitFor(() => expect(tally()).toHaveTextContent(t.tally.total(1)));
  });
});

describe('품목 시트', () => {
  it('품목 줄을 누르면 그 품목의 자재 관리 LOT 시트 — 패키징은 단위 이름, 뒤로가기로 닫힌다', async () => {
    const user = userEvent.setup();
    mount(createServer({ packageUomName: '봉지 포장' }));

    await scan(A(1));
    const lots = await openItem(user, 'SYN-CAP');

    expect(screen.getByRole('dialog', { name: t.lots.title })).toContainElement(lots);
    expect(within(lots).getByText('SYN-CAP')).toBeInTheDocument();
    expect(lots).toHaveTextContent(`${t.lots.fields.itemName}${ITEM}`);
    expect(within(lots).getByText(/봉지 포장 10/u)).toBeInTheDocument();
    /* 화면은 그대로 — 시트만 위에 선다. */
    expect(screen.getByRole('region', { name: t.tally.title })).toBeInTheDocument();

    act(() => {
      runBackStep();
    });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: t.lots.title })).toBeNull());
  });

  it('공급사가 하나뿐이면 공급사 머리 줄이 없다 — 표 머리 줄은 낭독기에만', async () => {
    mount(createServer());

    await scanDone(A(1));
    await screen.findByRole('button', { name: t.tally.open('SYN-CAP', ITEM) });

    expect(tally().querySelector('.receive-tally__group')).toBeNull();
    expect(within(tally()).getByRole('columnheader', { name: t.tally.columns.no })).toBeInTheDocument();
  });

  it('시트가 열려 있어도 찍으면 등록되고 시트가 닫힌다', async () => {
    const user = userEvent.setup();
    mount(createServer());

    await scan(A(1));
    await openItem(user, 'SYN-CAP');
    await scan(A(2));

    expect(await screen.findByRole('region', { name: t.last.ok })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: t.lots.title })).toBeNull());
  });

  it('US2-9 ✕ 는 확인 없이 바로 푼다 — 마지막 LOT 을 풀면 시트가 닫히고 줄이 사라진다', async () => {
    const user = userEvent.setup();
    const server = createServer();
    mount(server);

    await scan(A(1));
    const lots = await openItem(user, 'SYN-CAP');
    /* 이름 있는 단추다(G2 L22) — 글자로는 ✕ 아이콘. */
    const x = await within(lots).findByRole('button', { name: t.lots.unregister });
    expect(x).toHaveAccessibleName('해제');
    await user.click(x);

    expect(await screen.findByText(t.unregistered.lastToast(ITEM))).toBeInTheDocument();
    expect(await screen.findByText(t.tally.empty)).toBeInTheDocument();
    expect(server.sent.find((each) => each.path.endsWith(':unregister-lots'))?.body).toMatchObject({
      lotIds: [9001],
    });
  });
});

describe('US2-2 입하 마감', () => {
  it('US2-2 품목 시트 [이 품목만 마감] → 확인 창 → 마감, 품목은 「마감됨」 · ✕ 와 단추가 사라진다', async () => {
    const user = userEvent.setup();
    const server = createServer();
    mount(server);

    await scan(A(1));
    await openItem(user, 'SYN-CAP');
    await user.click(await screen.findByRole('button', { name: t.close.one(1) }));
    const dialog = await screen.findByRole('dialog', { name: t.closeDialog.titleOne(ITEM) });
    expect(dialog).toHaveTextContent('합성 공급사 SYN01');
    expect(dialog).toHaveTextContent(t.closeDialog.summaryOne(1, '1,000 EA'));
    await user.click(within(dialog).getByRole('button', { name: t.closeDialog.confirm }));

    expect(await screen.findByText(t.closeDialog.toastOne(ITEM))).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: t.close.one(1) })).toBeNull(),
    );
    expect(screen.queryByRole('button', { name: t.lots.unregister })).toBeNull();
    expect(screen.getByRole('button', { name: t.lots.editSupplierLot(A(1)) })).toBeDisabled();
    expect(screen.queryByText(/P\/O|IQC 요청 SYN/u)).toBeNull();
    expect(server.sent.find((each) => each.path.endsWith(':close-receipt'))?.body).toMatchObject({
      versionNo: 2,
    });

    expect(within(tally()).getByText(t.tally.closed)).toBeInTheDocument();
  });

  it('[모두 입하 마감]은 입하 중인 품목을 모두 마감한다 — 마감 뒤 같은 품목을 찍으면 새 줄', async () => {
    const user = userEvent.setup();
    const server = createServer();
    mount(server);

    await scanDone(A(1));
    await scanDone(B(1));
    await user.click(await screen.findByRole('button', { name: t.close.all(2, 2) }));
    const dialog = await screen.findByRole('dialog', { name: t.closeDialog.titleAll });
    expect(dialog).toHaveTextContent(t.closeDialog.summaryAll(2, 2));
    expect(within(dialog).getByRole('button', { name: t.closeDialog.cancel })).toHaveTextContent(
      '계속 찍기',
    );
    await user.click(within(dialog).getByRole('button', { name: t.closeDialog.confirm }));

    expect(await screen.findByText(t.closeDialog.toastAll(2))).toBeInTheDocument();
    expect(server.sent.filter((each) => each.path.endsWith(':close-receipt'))).toHaveLength(2);
    await waitFor(() => expect(within(tally()).getAllByText(t.tally.closed)).toHaveLength(2));
    expect(screen.queryByRole('button', { name: /모두 입하 마감/u })).toBeNull();

    await scan(A(2));
    await waitFor(() =>
      expect(tallyCodes()).toEqual(['1 SYN-CAP', '2 SYN-CAP', '3 SYN-RES']),
    );
  });

  it('G2 L15 · US2-7 기본 생략 기준이 없는 검사 불필요 품목은 「IQC 기록이 생기지 않고」 — 「검사 생략」이라 하지 않는다', async () => {
    const user = userEvent.setup();
    mount(createServer({ inspectionRequired: false, iqcDefaultSkipApplies: false }));

    await scan(A(1));
    await openItem(user, 'SYN-CAP');
    await user.click(await screen.findByRole('button', { name: t.close.one(1) }));
    const dialog = await screen.findByRole('dialog', { name: t.closeDialog.titleOne(ITEM) });

    expect(dialog).toHaveTextContent(t.closeDialog.bodyNoIqcRecord);
    expect(dialog).not.toHaveTextContent(t.closeDialog.bodyNoInspection);
  });

  it('G1 검사 불필요 품목의 마감 확인 창은 「검사 생략」 문구 — IQC 요청이 생긴다고 하지 않는다', async () => {
    const user = userEvent.setup();
    /* 「검사 생략」으로 남는 것은 기본 생략 기준이 걸릴 때만(G2 L15). */
    mount(createServer({ inspectionRequired: false, iqcDefaultSkipApplies: true }));

    await scan(A(1));
    await openItem(user, 'SYN-CAP');
    await user.click(await screen.findByRole('button', { name: t.close.one(1) }));
    const dialog = await screen.findByRole('dialog', { name: t.closeDialog.titleOne(ITEM) });

    expect(dialog).toHaveTextContent(t.closeDialog.bodyNoInspection);
    expect(dialog).not.toHaveTextContent(t.closeDialog.body);
  });
});

describe('US2-6 공급사 LOT 번호 시트', () => {
  it('US2-6 품목 화면 줄마다 「없음」 · 누르면 시트 · 「나머지에도」 저장이 바로 반영된다', async () => {
    const user = userEvent.setup();
    const server = createServer();
    mount(server);

    await scanDone(A(1));
    await scan(A(2));
    await waitFor(() => expect(tally()).toHaveTextContent(t.tally.total(2)));
    const lots = await openItem(user, 'SYN-CAP');
    expect(within(lots).getAllByText(t.lots.noSupplierLot)).toHaveLength(2);
    /* 번호 칸은 끝 일련번호, 행 번호 · 수량 · 공급사 LOT · ✕ 가 같은 행이다. */
    const row = within(lots).getByText('0001').closest('tr') as HTMLElement;
    expect(within(row).getByText('1')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: t.lots.unregister })).toBeInTheDocument();
    expect(within(lots).queryByText(A(1))).toBeNull();

    await user.click(within(row).getByRole('button', { name: t.lots.editSupplierLot(A(1)) }));
    const sheet = await screen.findByRole('dialog', { name: t.sheet.title });
    expect(sheet).toHaveTextContent(`SYN-CAP ${ITEM}`);
    await user.type(within(sheet).getByRole('textbox', { name: t.sheet.label }), 'SYN-SL-77');
    await user.click(
      within(sheet).getByRole('checkbox', { name: new RegExp(t.sheet.applyRest(1), 'u') }),
    );
    await user.click(within(sheet).getByRole('button', { name: t.sheet.save }));

    expect(await screen.findByText(t.sheet.saved('SYN-SL-77', 2))).toBeInTheDocument();
    expect(server.sent.find((each) => each.method === 'PATCH')?.body).toEqual({
      lotIds: [9001, 9002],
      supplierLotNo: 'SYN-SL-77',
    });
    /* 시트를 닫은 사이 품목 시트는 내려갔다가 다시 선다. */
    await waitFor(() =>
      expect(
        within(screen.getByRole('region', { name: t.lots.label })).getAllByText('SYN-SL-77'),
      ).toHaveLength(2),
    );
  });

  it('US2-6 늦은 저장(그사이 마감) 409 — 시트를 닫고 스캔 화면에 「이미 마감된 입하」', async () => {
    const user = userEvent.setup();
    mount(createServer({ supplierLotLocked: true }));

    await scan(A(1));
    const lots = await openItem(user, 'SYN-CAP');
    await user.click(
      await within(lots).findByRole('button', { name: t.lots.editSupplierLot(A(1)) }),
    );
    const sheet = await screen.findByRole('dialog', { name: t.sheet.title });
    await user.type(within(sheet).getByRole('textbox', { name: t.sheet.label }), 'X');
    await user.click(within(sheet).getByRole('button', { name: t.sheet.save }));

    expect(await screen.findByText(t.last.closedBody)).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: t.sheet.title })).toBeNull();
  });
});

describe('US2-14 오프라인', () => {
  it('US2-14 오프라인 스캔은 등록하지 않고 전송 대기 — 마감은 막히고, 연결되면 같은 키로 보내 표에 넣는다', async () => {
    const user = userEvent.setup();
    const server = createServer();
    mount(server);

    await scan(A(1));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: t.close.all(1, 1) })).toBeEnabled(),
    );

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    server.setOffline(true);
    await act(async () => {
      window.dispatchEvent(new Event('offline'));
    });
    await scan(A(2));

    expect(await screen.findByText(t.offline.title(1))).toBeInTheDocument();
    expect(screen.getByRole('region', { name: t.last.offline })).toHaveTextContent(
      t.last.offlineBody,
    );
    const closeAll = screen.getByRole('button', { name: t.close.all(1, 1) });
    expect(closeAll).toBeDisabled();
    expect(closeAll).toHaveAccessibleDescription(t.close.blockedOffline);

    /* 같은 라벨을 또 찍으면 「이미 전송 대기」. */
    await scan(A(2));
    expect(await screen.findByText(t.reject.alreadyQueued)).toBeInTheDocument();

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    server.setOffline(false);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    expect(await screen.findByText(t.offline.flushed(1, 1, 0))).toBeInTheDocument();
    await waitFor(() => expect(rowOf('SYN-CAP')).toHaveTextContent('2,000EA'));
    expect(screen.queryByText(t.offline.title(1))).toBeNull();
    expect(screen.queryByText(t.reject.alreadyQueued)).toBeNull();
    /* 화면이 직접 보낸 1건 + 아웃박스가 보낸 1건 — 오프라인 때 실패한 시도는 서버에 닿지 않았다. */
    expect(receives(server.sent)).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: t.close.all(1, 2) }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
