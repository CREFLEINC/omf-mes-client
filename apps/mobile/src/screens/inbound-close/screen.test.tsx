import type { InboundLot, InboundLotDetail } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { useWorkerSession } from '../../patterns/worker-session';
import { InboundCloseScreen } from './screen';

/**
 * M-01-03 입하 마감(005 · T057 · screens/M-01-03.md). 값은 전부 지어낸 것이다(공개 저장소 경계).
 */

const t = messages.inboundClose;

const store = vi.hoisted(() => new Map<string, string>());
const claims = vi.hoisted(() => ({ plantId: 8301 as number | null }));

vi.mock('../../patterns/local-store', () => ({
  readLocal: (key: string) => Promise.resolve(store.get(key) ?? null),
  writeLocal: (key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve();
  },
  removeLocal: (key: string) => {
    store.delete(key);
    return Promise.resolve();
  },
}));

vi.mock('../../patterns/plant', () => ({
  currentPlantId: () => claims.plantId,
  /* 셸이 기동할 때 부른다. 빠뜨리면 모의가 실제 모듈과 어긋나 처리되지 않은 오류가 난다. */
  readPlantId: () => Promise.resolve(null),
  rememberPlant: () => Promise.resolve(),
  forgetPlant: () => Promise.resolve(),
}));

const inboundLot = (id: number, over: Partial<InboundLot> = {}): InboundLot => ({
  inboundLotId: id,
  inboundLotNo: `SYN-IL-20261111-${String(id).padStart(4, '0')}`,
  plantId: 8301,
  supplierId: 8201,
  supplierCode: 'SYN-P-01',
  supplierName: '합성 공급사 가',
  itemId: 8601,
  itemCode: 'SYN-ITEM-01',
  itemName: '합성 품목 가',
  uomCode: 'EA',
  statusCode: 'RECEIVING',
  receivingDate: '2026-11-11',
  inboundReceiptNo: `SYN-IR-${String(id)}`,
  lotCount: 2,
  receivedQty: 2000,
  goodsReceivedQty: 0,
  unallocatedQty: 0,
  iqc: null,
  inspectionRequired: true,
  firstRegisteredAt: '2026-11-11T01:05:00Z',
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
  versionNo: 3,
  ...over,
});

const detailOf = (lot: InboundLot, count = 2): InboundLotDetail => ({
  ...lot,
  lots: Array.from({ length: count }, (_, index) => ({
    lotId: 9001 + index,
    lotNo: `SYN-ITEM-01|1000|261111|SYN-P-01|000${String(index + 1)}`,
    lotQty: 1000,
    package: null,
    supplierLotNo: null,
    lifecycleStatusCode: 'ACTIVE',
    statusCode: 'INSPECTION_PENDING',
    registeredAt: '2026-11-11T01:05:00Z',
    fromSupplierLabel: false,
  })),
  events: [],
});

interface Sent {
  path: string;
  method: string;
  body: unknown;
  headers: Headers;
  search: URLSearchParams;
}

interface Options {
  closable?: InboundLot[];
  reopenable?: InboundLot[];
  details?: Record<number, InboundLotDetail>;
  reopenFail?: { status: number; body: unknown };
  closeResult?: Partial<InboundLot> & { iqc?: InboundLot['iqc'] };
  unregisterResult?: Partial<InboundLot>;
  /** 화면을 나갔다 들어오는 단추를 둔다(같은 질의 저장소 그대로). */
  withLeave?: boolean;
}

/** 화면을 내렸다 다시 올린다 — 질의 저장소는 그대로라 「들어올 때 다시 읽는가」를 본다. */
const LeaveAndReturn = ({ children }: { children: ReactNode }) => {
  const [shown, setShown] = useState(true);

  return (
    <>
      <button type="button" onClick={() => setShown((value) => !value)}>
        {shown ? '나가기' : '들어오기'}
      </button>
      {shown ? children : null}
    </>
  );
};

const mount = (options: Options = {}) => {
  const sent: Sent[] = [];
  const record = async (request: Request): Promise<void> => {
    const url = new URL(request.url);
    sent.push({
      path: url.pathname,
      method: request.method,
      headers: request.headers,
      search: url.searchParams,
      body: request.method === 'GET' ? null : await request.clone().json(),
    });
  };
  const path = (request: Request) => new URL(request.url).pathname;
  const closable = options.closable ?? [inboundLot(3)];
  const reopenable = options.reopenable ?? [];

  const fetch = createStubFetch([
    {
      match: (request) => path(request) === '/logistics/inbound-lots',
      respond: async (request) => {
        await record(request);
        const url = new URL(request.url);
        const items = url.searchParams.get('closable') === 'true' ? closable : reopenable;

        return jsonResponse({ items, page: { page: 1, size: 100, total: items.length } });
      },
    },
    {
      match: (request) => /^\/logistics\/inbound-lots\/\d+$/u.test(path(request)),
      respond: (request) => {
        const id = Number(/(\d+)$/u.exec(path(request))?.[1]);
        const found =
          options.details?.[id] ??
          detailOf(closable.find((each) => each.inboundLotId === id) ?? inboundLot(id));

        return jsonResponse(found);
      },
    },
    {
      match: (request) => /:unregister-lots$/u.test(path(request)),
      respond: async (request) => {
        await record(request);

        return jsonResponse(
          inboundLot(3, { lotCount: 1, receivedQty: 1000, ...options.unregisterResult }),
        );
      },
    },
    {
      match: (request) => /:close-receipt$/u.test(path(request)),
      respond: async (request) => {
        await record(request);

        return jsonResponse({
          ...inboundLot(3, { statusCode: 'RECEIVED' }),
          iqc: {
            requestId: 71,
            requestNo: 'SYN-IQC-0013',
            statusCode: 'REQUESTED',
            overallJudgmentCode: null,
          },
          iqcRequestId: 71,
          ...options.closeResult,
        });
      },
    },
    {
      match: (request) => /:reopen-receipt$/u.test(path(request)),
      respond: async (request) => {
        await record(request);

        return options.reopenFail === undefined
          ? jsonResponse(inboundLot(5, { statusCode: 'RECEIVING', reopened: true }))
          : jsonResponse(options.reopenFail.body, { status: options.reopenFail.status });
      },
    },
  ]);

  const SignedIn = ({ children }: { children: ReactNode }) => {
    const { worker, signIn } = useWorkerSession();

    useEffect(() => {
      if (worker === null) signIn({ workerNo: '900028', workerName: '합성 작업자' });
    }, [signIn, worker]);

    return worker === null ? null : children;
  };

  renderWithProviders(
    <MemoryRouter>
      <SignedIn>
        {options.withLeave === true ? (
          <LeaveAndReturn>
            <InboundCloseScreen />
          </LeaveAndReturn>
        ) : (
          <InboundCloseScreen />
        )}
      </SignedIn>
    </MemoryRouter>,
    { fetch },
  );

  return { sent };
};

const done = (id: number, over: Partial<InboundLot> = {}): InboundLot =>
  inboundLot(id, {
    statusCode: 'RECEIVED',
    reopenable: true,
    reopenReasonCode: 'NO_IQC_RESULT',
    receivedClosedAt: '2026-11-10T17:00:00Z',
    iqc: {
      requestId: 61,
      requestNo: `SYN-IQC-${String(id)}`,
      statusCode: 'REQUESTED',
      overallJudgmentCode: null,
    },
    ...over,
  });

beforeEach(() => {
  store.clear();
  claims.plantId = 8301;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('US2-10 입하 중 목록 · 상세 · 해제 · 마감', () => {
  it('US2-10 입하 중 카드는 번호 · 품목 · 공급사 · LOT 수 · 합계 · 첫 등록을 보이고 경과일 강조는 없다', async () => {
    const { sent } = mount();

    const card = await screen.findByRole('button', { name: /SYN-IL-20261111-0003/u });
    expect(card).toHaveTextContent(t.open.receiving);
    expect(card).toHaveTextContent('SYN-ITEM-01 합성 품목 가 · 합성 공급사 가');
    expect(card).toHaveTextContent(t.card.total(2, '2,000 EA'));
    expect(card).toHaveTextContent(/첫 등록 \d\d-\d\d \d\d:\d\d/u);
    expect(screen.getByText(t.open.heading(1))).toBeInTheDocument();
    expect(sent.find((each) => each.search.get('closable') === 'true')?.search.get('plantId')).toBe(
      '8301',
    );
  });

  it('US2-10 상세에서 자재 관리 LOT 를 보고 마감한다 — 부분 입하 사유를 묻지 않고 결과에 P/O 가 없다', async () => {
    const user = userEvent.setup();
    const { sent } = mount();

    await user.click(await screen.findByRole('button', { name: /SYN-IL-20261111-0003/u }));
    expect(await screen.findByText(t.detail.statusValue)).toBeInTheDocument();
    expect(screen.getByText('SYN-ITEM-01|1000|261111|SYN-P-01|0001')).toBeInTheDocument();
    expect(screen.getAllByText(t.detail.pending)).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: t.detail.close }));
    const dialog = await screen.findByRole('dialog', {
      name: t.closeDialog.title('SYN-IL-20261111-0003'),
    });
    expect(dialog).toHaveTextContent(t.closeDialog.withIqc);
    expect(within(dialog).queryByRole('textbox')).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: t.closeDialog.proceed }));

    expect(await screen.findByText(t.result.withIqc('SYN-IQC-0013'))).toBeInTheDocument();
    expect(screen.queryByText(/P\/O/u)).toBeNull();
    const close = sent.find((each) => each.path.endsWith(':close-receipt'));
    expect(close?.body).toMatchObject({ versionNo: 3 });
    expect(close?.body).not.toHaveProperty('partialReason');
    expect(close?.headers.get('X-Worker-No')).toBe('900028');
    expect(close?.headers.get('Idempotency-Key')).not.toBeNull();
  });

  it('G2 L20 상세 LOT 줄 — 수량 뒤 패키징 「· 봉지 10」(이름, 없으면 코드), LOT 번호는 [해제]와 다른 줄', async () => {
    const user = userEvent.setup();
    const base = detailOf(inboundLot(3), 2);
    const names = ['봉지', null];
    const detail: InboundLotDetail = {
      ...base,
      lots: base.lots.map((lot, index) => ({
        ...lot,
        package: {
          uomId: 8402,
          uomCode: 'SYN-BAG',
          uomName: names[index],
          count: 10,
          qtyPerPackage: 100,
        },
      })),
    };
    mount({ details: { 3: detail } });

    await user.click(await screen.findByRole('button', { name: /SYN-IL-20261111-0003/u }));
    expect(await screen.findByText('1,000 EA · 봉지 10')).toBeInTheDocument();
    expect(screen.getByText('1,000 EA · SYN-BAG 10')).toBeInTheDocument();

    /* LOT 번호 줄에는 [해제]가 끼지 않는다 — 번호가 줄 폭을 다 쓴다. */
    const lotNo = screen.getByText('SYN-ITEM-01|1000|261111|SYN-P-01|0001');
    expect(lotNo).toHaveClass('inbound-close__lot-no');
    expect(lotNo.parentElement?.children[0]).toBe(lotNo);
    expect(
      within(lotNo.nextElementSibling as HTMLElement).getByRole('button', {
        name: t.detail.unregister,
      }),
    ).toBeInTheDocument();
  });

  it('US2-10 검사 불필요 품목은 「검사 생략」으로 남는다고 묻고, 결과는 「검사 불필요, 자재 관리 LOT 정상」', async () => {
    const user = userEvent.setup();
    mount({
      closable: [inboundLot(3, { inspectionRequired: false })],
      closeResult: { inspectionRequired: false, iqc: null },
    });

    await user.click(await screen.findByRole('button', { name: /SYN-IL-20261111-0003/u }));
    await user.click(await screen.findByRole('button', { name: t.detail.close }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(t.closeDialog.withoutIqc);
    await user.click(within(dialog).getByRole('button', { name: t.closeDialog.proceed }));

    expect(await screen.findByText(t.result.noInspection)).toBeInTheDocument();
  });

  it('US2-10 [해제]는 확인 뒤 그 LOT 만 풀고, 마지막 LOT 면 입하 LOT 가 없어진다고 미리 말한다', async () => {
    const user = userEvent.setup();
    const { sent } = mount({
      details: { 3: detailOf(inboundLot(3, { lotCount: 1, receivedQty: 1000 }), 1) },
    });

    await user.click(await screen.findByRole('button', { name: /SYN-IL-20261111-0003/u }));
    await user.click(await screen.findByRole('button', { name: t.detail.unregister }));
    const dialog = await screen.findByRole('dialog', { name: t.unregisterDialog.title });
    expect(dialog).toHaveTextContent(t.unregisterDialog.body('1,000 EA'));
    expect(dialog).toHaveTextContent(t.unregisterDialog.last);
    await user.click(within(dialog).getByRole('button', { name: t.unregisterDialog.proceed }));

    await waitFor(() =>
      expect(sent.some((each) => each.path.endsWith(':unregister-lots'))).toBe(true),
    );
    expect(sent.find((each) => each.path.endsWith(':unregister-lots'))?.body).toEqual({
      lotIds: [9001],
      versionNo: 3,
    });
  });
});

describe('US2-12 마감 취소 가능 목록', () => {
  it('US2-12 「입하 완료 · 마감 취소 가능」에 까닭 칩 · 「자동 마감」을 보이고, 확인 뒤 마감을 취소한다', async () => {
    const user = userEvent.setup();
    const { sent } = mount({
      closable: [],
      reopenable: [done(5, { closedAutomatically: true, supplierId: 8202 })],
    });

    expect(await screen.findByText(t.done.heading(1))).toBeInTheDocument();
    expect(screen.getByText(t.done.autoChip)).toBeInTheDocument();
    expect(screen.getByText(t.done.reason.NO_IQC_RESULT.chip)).toBeInTheDocument();
    expect(screen.getByText(/날짜 바뀜 자동 마감/u)).toBeInTheDocument();
    expect(screen.getByText(t.open.empty)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.done.reopen }));
    const dialog = await screen.findByRole('dialog', { name: t.reopenDialog.title });
    expect(dialog).toHaveTextContent(t.reopenDialog.effect.NO_IQC_RESULT('SYN-IQC-5'));
    await user.click(within(dialog).getByRole('button', { name: t.reopenDialog.proceed }));

    await waitFor(() =>
      expect(sent.some((each) => each.path.endsWith(':reopen-receipt'))).toBe(true),
    );
    expect(sent.find((each) => each.path.endsWith(':reopen-receipt'))?.body).toEqual({
      versionNo: 3,
    });
    expect(
      await screen.findByText(t.reopenDialog.done('SYN-IL-20261111-0005')),
    ).toBeInTheDocument();
  });

  it('US2-12 긴급 생략 실행 건은 생략이 무효가 된다고 경고한다', async () => {
    const user = userEvent.setup();
    mount({
      closable: [],
      reopenable: [done(6, { reopenReasonCode: 'IQC_SKIPPED' })],
    });

    await user.click(await screen.findByRole('button', { name: t.done.reopen }));
    expect(await screen.findByRole('dialog')).toHaveTextContent(
      t.reopenDialog.effect.IQC_SKIPPED('SYN-IQC-6'),
    );
  });
});

describe('US2-13 같은 공급사·품목 입하 중이면 마감 취소가 막힌다', () => {
  it('US2-13 카드에 미리 막힘을 보이고, 누르면 먼저 마감할 입하 LOT 번호와 [열기]를 준다', async () => {
    const user = userEvent.setup();
    /* 서버가 「같은 공급사·품목 입하 중」 하나로만 막힌 건도 싣고 막힘 칸을 준다(G1). */
    const { sent } = mount({
      closable: [inboundLot(3)],
      reopenable: [
        done(2, {
          reopenable: false,
          reopenReasonCode: null,
          reopenBlockerCode: 'OPEN_RECEIPT_EXISTS',
          openInboundLotNo: 'SYN-IL-20261111-0003',
        }),
      ],
    });

    expect(await screen.findByText(t.done.blocked('SYN-IL-20261111-0003'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.done.reopen }));

    const dialog = await screen.findByRole('dialog', { name: t.blockedDialog.title });
    expect(dialog).toHaveTextContent(
      t.blockedDialog.openReceipt('합성 공급사 가', 'SYN-ITEM-01', 'SYN-IL-20261111-0003'),
    );
    expect(sent.some((each) => each.path.endsWith(':reopen-receipt'))).toBe(false);

    await user.click(within(dialog).getByRole('button', { name: t.card.open('0003') }));
    expect(await screen.findByText(t.detail.statusValue)).toBeInTheDocument();
  });

  it('US2-13 그사이 생긴 막힘(409 `blockers`)은 코드별 문구로 막힘 창에 보인다', async () => {
    const user = userEvent.setup();
    mount({
      closable: [],
      reopenable: [done(5)],
      reopenFail: {
        status: 409,
        body: {
          errors: [{ scope: 'screen', code: 'IQC_RECORDED', message: 'IQC 결과가 있습니다.' }],
        },
      },
    });

    await user.click(await screen.findByRole('button', { name: t.done.reopen }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: t.reopenDialog.proceed,
      }),
    );

    const blocked = await screen.findByRole('dialog', { name: t.blockedDialog.title });
    expect(blocked).toHaveTextContent(t.blockedDialog.codes.IQC_RECORDED ?? '');
  });
});

describe('US2-10 온라인에서만', () => {
  it('US2-10 오프라인이면 안내하고 마감 · 해제 · 마감 취소를 막는다', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const user = userEvent.setup();
    mount({ closable: [inboundLot(3)], reopenable: [done(5, { supplierId: 8202 })] });

    expect(await screen.findByText(t.offline)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: t.done.reopen })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /SYN-IL-20261111-0003/u }));
    const unregisters = await screen.findAllByRole('button', { name: t.detail.unregister });
    for (const each of unregisters) expect(each).toBeDisabled();
    expect(screen.getByRole('button', { name: t.detail.close })).toBeDisabled();
  });

  it('기기의 공장을 모르면 목록을 부르지 않는다', async () => {
    claims.plantId = null;
    const { sent } = mount();

    expect(await screen.findByText(t.noPlant)).toBeInTheDocument();
    expect(sent).toHaveLength(0);
  });
});

describe('G1 입하 마감 목록', () => {
  it('G1 막힘 줄은 서버 칸(reopenBlockerCode)만 읽는다 — 칸이 없으면 같은 공급사·품목 입하 중이 있어도 막지 않는다', async () => {
    const user = userEvent.setup();
    mount({ closable: [inboundLot(3)], reopenable: [done(2)] });

    await user.click(await screen.findByRole('button', { name: t.done.reopen }));

    expect(await screen.findByRole('dialog', { name: t.reopenDialog.title })).toBeInTheDocument();
    expect(screen.queryByText(t.done.blocked('SYN-IL-20261111-0003'))).not.toBeInTheDocument();
  });

  it('G1 막는 입하 LOT 가 지금 목록에 없으면 막힘 창은 번호만 보이고 [열기]를 두지 않는다', async () => {
    const user = userEvent.setup();
    mount({
      closable: [],
      reopenable: [
        done(2, {
          reopenable: false,
          reopenReasonCode: null,
          reopenBlockerCode: 'OPEN_RECEIPT_EXISTS',
          openInboundLotNo: 'SYN-IL-20261111-0009',
        }),
      ],
    });

    expect(await screen.findByText(t.done.blocked('SYN-IL-20261111-0009'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.done.reopen }));

    const dialog = await screen.findByRole('dialog', { name: t.blockedDialog.title });
    expect(dialog).toHaveTextContent('SYN-IL-20261111-0009');
    expect(within(dialog).queryByRole('button', { name: t.card.open('0009') })).toBeNull();
  });

  it('G1 화면을 나갔다 다시 들어오면 목록을 새로 읽는다 — 다른 기기에서 마감한 건이 「입하 중」에 남지 않는다', async () => {
    const user = userEvent.setup();
    const closable = [inboundLot(3)];
    mount({ closable, withLeave: true });

    expect(await screen.findByText('SYN-IL-20261111-0003')).toBeInTheDocument();

    closable.splice(0, closable.length);
    await user.click(screen.getByRole('button', { name: '나가기' }));
    await user.click(screen.getByRole('button', { name: '들어오기' }));

    expect(await screen.findByText(t.open.empty)).toBeInTheDocument();
    expect(screen.queryByText('SYN-IL-20261111-0003')).not.toBeInTheDocument();
  });
});
