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

import { useWorkerSession } from '../../patterns/worker-session';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { InboundReceiptScreen } from './screen';

/**
 * 005 T055 — M-01-01 입하 등록: 스캔마다 `:receive` 1건 · 입하 LOT 카드 · 해제 · 입하 마감 · 공급사 LOT 시트 · 오프라인
 * 전송 대기(screens/M-01-01.md). 값은 전부 지어낸 것이다(공개 저장소 경계).
 */

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
            supplierId: 1,
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

const scan = async (code: string): Promise<void> => {
  const field = (await screen.findByLabelText(t.scan.label)) as HTMLInputElement;

  field.focus();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, code);
  field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
};

const receives = (sent: readonly Sent[]) =>
  sent.filter((entry) => entry.path === '/logistics/inbound-lots:receive');

const card = (no: string): HTMLElement => screen.getByRole('group', { name: no });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('M-01-01 입하 등록 — 화면에 없는 것', () => {
  it('입하 LOT · P/O 고르기, 「LOT 번호 없음」 대체 사유가 없다 — 스캔 칸 하나', async () => {
    mount(createServer());

    expect(await screen.findByLabelText(t.scan.label)).toBeInTheDocument();
    expect(screen.queryByText(/P\/O/u)).toBeNull();
    expect(screen.queryByText(/LOT 번호 없음/u)).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText(t.cards.empty)).toBeInTheDocument();
  });
});

describe('US2-1 스캔마다 바로 등록', () => {
  it('US2-1 스캔마다 `:receive` 1건(원소 하나 · 멱등 키 하나 · 사번), 첫 스캔은 새 입하 LOT, 다음은 추가', async () => {
    const server = createServer();
    mount(server);

    await scan(A(1));
    expect(
      await screen.findAllByText(new RegExp(t.result.created('SYN-IL-6001'), 'u')),
    ).not.toHaveLength(0);
    await scan(A(2));
    expect(
      await screen.findAllByText(
        new RegExp(t.result.added('SYN-IL-6001', 2).replace(/[()]/gu, '\\$&'), 'u'),
      ),
    ).not.toHaveLength(0);

    const sent = receives(server.sent);
    expect(sent).toHaveLength(2);
    expect((sent[0]?.body as InboundLotReceive).lots).toEqual([{ lotNo: A(1) }]);
    expect(sent[0]?.headers.get('X-Worker-No')).toBe(WORKER);
    expect(sent[0]?.headers.get('Idempotency-Key')).not.toBe(
      sent[1]?.headers.get('Idempotency-Key'),
    );

    const lotCard = await screen.findByRole('group', { name: 'SYN-IL-6001' });
    await waitFor(() =>
      expect(within(lotCard).getByText(t.card.summary(2, '2,000 EA'))).toBeInTheDocument(),
    );
    expect(within(lotCard).getByText(t.card.statusNew)).toBeInTheDocument();
    expect(within(lotCard).getByText(t.card.justNow)).toBeInTheDocument();
    expect(within(lotCard).getByText(t.card.thisVisit)).toBeInTheDocument();
  });

  it('US2-4 공급사·품목이 섞이면 카드가 두 장 — 마지막에 건드린 것이 위', async () => {
    mount(createServer());

    await scan(A(1));
    await screen.findByRole('group', { name: 'SYN-IL-6001' });
    await scan(B(1));
    await screen.findByRole('group', { name: 'SYN-IL-6002' });

    const cards = screen
      .getAllByRole('group')
      .filter((each) => each.classList.contains('receive-card'));
    expect(cards.map((each) => each.getAttribute('aria-label'))).toEqual([
      'SYN-IL-6002',
      'SYN-IL-6001',
    ]);
    expect(screen.getByText(t.cards.title(2))).toBeInTheDocument();
  });

  it('US2-5 폐기 · 이미 등록된 라벨은 거부 줄로 쌓이고 등록되지 않는다 — 까닭은 서버 reasonCode 로 가른다(G1)', async () => {
    mount(createServer({ voided: [A(9)] }));

    await scan(A(9));
    expect(
      await screen.findByText(t.reject.title(t.reject.voided, '…|SYN01|0009')),
    ).toBeInTheDocument();
    expect(screen.getByText(t.reject.voidedBody)).toBeInTheDocument();
    await scan(A(1));
    await screen.findByRole('group', { name: 'SYN-IL-6001' });
    await waitFor(() => expect(within(card('SYN-IL-6001')).getByText(A(1))).toBeInTheDocument());
    await scan(A(1));

    expect(
      await screen.findByText(t.reject.alreadyReceivedIn('SYN-IL-6001', true)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(t.reject.title(t.reject.alreadyReceived, '…|SYN01|0001')),
    ).toBeInTheDocument();
    expect(screen.getAllByText(new RegExp('등록 안 됨', 'u'))).toHaveLength(2);
  });

  it('G1 이 화면 카드에 없는 이미 입하된 라벨 · 자재 관리 LOT 이 아닌 라벨도 까닭별 문구로 거부한다', async () => {
    const server = createServer({ notMaterial: [B(5)] });
    mount(server);

    await scan(B(5));
    expect(await screen.findByText(t.reject.notMaterialLotBody)).toBeInTheDocument();
    expect(
      screen.getByText(t.reject.title(t.reject.notMaterialLot, '…|SYN02|0005')),
    ).toBeInTheDocument();
  });

  it('G1 이미 입하된 라벨 — 서버가 입하 LOT 번호 · 상태를 주면 카드에 없어도 「{IL}(입하 완료)에 이미 등록된…」', async () => {
    mount(
      createServer({
        receivedElsewhere: { [B(7)]: { inboundLotNo: 'SYN-IL-5000', statusCode: 'RECEIVED' } },
      }),
    );

    await scan(B(7));

    expect(
      await screen.findByText(t.reject.alreadyReceivedIn('SYN-IL-5000', false)),
    ).toBeInTheDocument();
  });

  it('G1 패키징은 단위 이름으로, 카드 부제는 낱말 조각으로 그린다', async () => {
    mount(createServer({ packageUomName: '봉지 포장' }));

    await scan(A(1));
    const lotCard = await screen.findByRole('group', { name: 'SYN-IL-6001' });

    expect(await within(lotCard).findByText(/봉지 포장 10/u)).toBeInTheDocument();
    const pair = lotCard.querySelector('.receive-card__pair');
    expect(pair?.querySelectorAll('.receive-card__word').length).toBeGreaterThan(1);
    expect(pair).toHaveTextContent(t.card.pair('합성 공급사 SYN01', 'SYN-CAP', '합성 자재'));
  });

  it('G1 성공은 결과 줄 한 번만 — 알림 줄에 같은 문구를 또 띄우지 않는다', async () => {
    mount(createServer());

    await scan(A(1));
    await screen.findByRole('group', { name: 'SYN-IL-6001' });

    expect(screen.getAllByText(new RegExp(t.result.created('SYN-IL-6001'), 'u'))).toHaveLength(1);
  });

  it('날짜가 바뀌어 자동 마감된 입하 LOT 이 있으면 띠로 알린다', async () => {
    mount(createServer({ autoClose: 'SYN-IL-6001' }));

    await scan(A(1));
    await screen.findByRole('group', { name: 'SYN-IL-6001' });
    await scan(A(2));

    expect(await screen.findByText(t.autoClosed('SYN-IL-6001'))).toBeInTheDocument();
    expect(await screen.findByRole('group', { name: 'SYN-IL-6002' })).toBeInTheDocument();
  });
});

describe('US2-2 입하 마감', () => {
  it('US2-2 [입하 마감] → 확인 창 → 「마감됨 · IQC 요청됨」, P/O 결과는 띄우지 않는다', async () => {
    const user = userEvent.setup();
    const server = createServer();
    mount(server);

    await scan(A(1));
    const lotCard = await screen.findByRole('group', { name: 'SYN-IL-6001' });
    await user.click(await within(lotCard).findByRole('button', { name: t.card.close }));
    const dialog = await screen.findByRole('dialog', { name: t.closeDialog.title('SYN-IL-6001') });
    await user.click(within(dialog).getByRole('button', { name: t.closeDialog.confirm }));

    expect(
      await screen.findByText(t.closeDialog.toast('SYN-IL-6001', 'SYN-IQC-0001')),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(within(card('SYN-IL-6001')).getByText(t.card.statusClosed)).toBeInTheDocument(),
    );
    expect(within(card('SYN-IL-6001')).queryByRole('button', { name: t.card.close })).toBeNull();
    expect(
      within(card('SYN-IL-6001')).queryByRole('button', { name: t.card.unregister }),
    ).toBeNull();
    expect(screen.queryByText(/P\/O/u)).toBeNull();
    expect(server.sent.find((each) => each.path.endsWith(':close-receipt'))?.body).toMatchObject({
      versionNo: 2,
    });
  });

  it('G2 L15 · US2-7 기본 생략 기준이 없는 검사 불필요 품목은 「IQC 기록이 생기지 않고」 — 「검사 생략」이라 하지 않는다', async () => {
    const user = userEvent.setup();
    mount(createServer({ inspectionRequired: false, iqcDefaultSkipApplies: false }));

    await scan(A(1));
    const lotCard = await screen.findByRole('group', { name: 'SYN-IL-6001' });
    await user.click(await within(lotCard).findByRole('button', { name: t.card.close }));
    const dialog = await screen.findByRole('dialog', { name: t.closeDialog.title('SYN-IL-6001') });

    expect(dialog).toHaveTextContent(t.closeDialog.bodyNoIqcRecord);
    expect(dialog).not.toHaveTextContent('검사 생략');
  });

  it('G1 검사 불필요 품목의 마감 확인 창은 「검사 생략」 문구 — IQC 요청이 생긴다고 하지 않는다', async () => {
    const user = userEvent.setup();
    /* 「검사 생략」으로 남는 것은 기본 생략 기준이 걸릴 때만(G2 L15). */
    mount(createServer({ inspectionRequired: false, iqcDefaultSkipApplies: true }));

    await scan(A(1));
    const lotCard = await screen.findByRole('group', { name: 'SYN-IL-6001' });
    await user.click(await within(lotCard).findByRole('button', { name: t.card.close }));
    const dialog = await screen.findByRole('dialog', { name: t.closeDialog.title('SYN-IL-6001') });

    expect(dialog).toHaveTextContent(t.closeDialog.bodyNoInspection);
    expect(dialog).not.toHaveTextContent(t.closeDialog.body);
  });

  it('US2-3 마감 뒤 같은 공급사·품목을 스캔하면 새 입하 LOT 카드가 생긴다', async () => {
    const user = userEvent.setup();
    mount(createServer());

    await scan(A(1));
    const lotCard = await screen.findByRole('group', { name: 'SYN-IL-6001' });
    await user.click(await within(lotCard).findByRole('button', { name: t.card.close }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: t.closeDialog.confirm,
      }),
    );
    await waitFor(() =>
      expect(within(card('SYN-IL-6001')).getByText(t.card.statusClosed)).toBeInTheDocument(),
    );
    await scan(A(2));

    expect(await screen.findByRole('group', { name: 'SYN-IL-6002' })).toBeInTheDocument();
  });

  /* 실기 접근성 트리에서 이름 없는 단추로 보고됐다 — 역할 · 이름으로 찾혀야 한다(G2 L22). */
  it('G2 L22 카드의 [해제] · [입하 마감]은 이름 있는 단추다', async () => {
    const server = createServer();
    mount(server);

    await scan(A(1));
    const lotCard = await screen.findByRole('group', { name: 'SYN-IL-6001' });

    expect(
      await within(lotCard).findByRole('button', { name: t.card.unregister }),
    ).toHaveAccessibleName('해제');
    expect(within(lotCard).getByRole('button', { name: t.card.close })).toHaveAccessibleName(
      '입하 마감',
    );
  });

  it('US2-9 [해제]는 확인 없이 바로 — 마지막 LOT 을 풀면 카드가 사라진다', async () => {
    const user = userEvent.setup();
    const server = createServer();
    mount(server);

    await scan(A(1));
    const lotCard = await screen.findByRole('group', { name: 'SYN-IL-6001' });
    await user.click(await within(lotCard).findByRole('button', { name: t.card.unregister }));

    expect(await screen.findByText(t.unregistered.lastToast('SYN-IL-6001'))).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'SYN-IL-6001' })).toBeNull();
    expect(server.sent.find((each) => each.path.endsWith(':unregister-lots'))?.body).toMatchObject({
      lotIds: [9001],
    });
  });
});

describe('US2-6 공급사 LOT 번호 시트', () => {
  it('US2-6 줄마다 「공급사 LOT 없음」 · 줄을 누르면 시트 · 「나머지에도」 저장이 바로 반영된다', async () => {
    const user = userEvent.setup();
    const server = createServer();
    mount(server);

    await scan(A(1));
    await screen.findByRole('group', { name: 'SYN-IL-6001' });
    await scan(A(2));
    await waitFor(() =>
      expect(within(card('SYN-IL-6001')).getAllByText(t.card.noSupplierLot)).toHaveLength(2),
    );

    await user.click(
      within(card('SYN-IL-6001')).getByRole('button', { name: t.card.editSupplierLot(A(1)) }),
    );
    const sheet = await screen.findByRole('dialog', { name: t.sheet.title });
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
    await waitFor(() =>
      expect(
        within(card('SYN-IL-6001')).getAllByText(t.card.supplierLot('SYN-SL-77')),
      ).toHaveLength(2),
    );
  });

  it('US2-6 늦은 저장(그사이 마감) 409 — 시트를 닫고 거부 줄을 보인다', async () => {
    const user = userEvent.setup();
    mount(createServer({ supplierLotLocked: true }));

    await scan(A(1));
    await screen.findByRole('group', { name: 'SYN-IL-6001' });
    await user.click(
      await within(card('SYN-IL-6001')).findByRole('button', {
        name: t.card.editSupplierLot(A(1)),
      }),
    );
    const sheet = await screen.findByRole('dialog', { name: t.sheet.title });
    await user.type(within(sheet).getByRole('textbox', { name: t.sheet.label }), 'X');
    await user.click(within(sheet).getByRole('button', { name: t.sheet.save }));

    expect(await screen.findByText(t.reject.closedBody('SYN-IL-6001'))).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: t.sheet.title })).toBeNull();
  });

  it('US2-6 마감 뒤에는 읽기 전용 — 줄을 눌러도 시트가 열리지 않는다', async () => {
    const user = userEvent.setup();
    mount(createServer());

    await scan(A(1));
    await user.click(
      await within(await screen.findByRole('group', { name: 'SYN-IL-6001' })).findByRole('button', {
        name: t.card.close,
      }),
    );
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: t.closeDialog.confirm,
      }),
    );
    await waitFor(() =>
      expect(within(card('SYN-IL-6001')).getByText(t.card.readOnlySupplierLot)).toBeInTheDocument(),
    );

    expect(
      within(card('SYN-IL-6001')).getByRole('button', { name: t.card.editSupplierLot(A(1)) }),
    ).toBeDisabled();
  });
});

describe('US2-14 오프라인', () => {
  it('US2-14 오프라인 스캔은 등록하지 않고 전송 대기 — 그 공급사·품목 카드는 막히고, 연결되면 같은 키로 보내 카드에 넣는다', async () => {
    const user = userEvent.setup();
    const server = createServer();
    mount(server);

    await scan(A(1));
    await screen.findByRole('group', { name: 'SYN-IL-6001' });
    await waitFor(() =>
      expect(within(card('SYN-IL-6001')).getByRole('button', { name: t.card.close })).toBeEnabled(),
    );

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    server.setOffline(true);
    await act(async () => {
      window.dispatchEvent(new Event('offline'));
    });
    await scan(A(2));

    expect(await screen.findByText(t.offline.title(1))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(t.offline.scanned, 'u'))).toBeInTheDocument();
    expect(within(card('SYN-IL-6001')).getByRole('button', { name: t.card.close })).toBeDisabled();
    expect(within(card('SYN-IL-6001')).getByText(t.card.blockedOffline)).toBeInTheDocument();

    expect(
      within(card('SYN-IL-6001')).getByRole('button', { name: t.card.close }),
    ).toHaveAccessibleDescription(t.card.blockedOffline);

    /* 같은 라벨을 또 찍으면 「이미 전송 대기」. */
    await scan(A(2));
    expect(await screen.findByText(t.reject.alreadyQueuedBody)).toBeInTheDocument();

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    server.setOffline(false);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    expect(await screen.findByText(t.offline.flushed(1, 1, 0))).toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(card('SYN-IL-6001')).getByText(t.card.summary(2, '2,000 EA')),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText(t.offline.title(1))).toBeNull();
    /* 보낸 라벨의 「오프라인」 · 「이미 전송 대기」 줄은 내린다(G1). */
    expect(screen.queryByText(t.reject.alreadyQueuedBody)).toBeNull();
    expect(screen.queryByText(t.offline.scanned)).toBeNull();
    /* 화면이 직접 보낸 1건 + 아웃박스가 보낸 1건 — 오프라인 때 실패한 시도는 서버에 닿지 않았다. */
    expect(receives(server.sent)).toHaveLength(2);
    await user.click(within(card('SYN-IL-6001')).getByRole('button', { name: t.card.close }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
