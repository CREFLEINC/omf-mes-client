import type { InboundLot, InboundLotDetail } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runBackStep } from '../../patterns/back-step';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { useWorkerSession } from '../../patterns/worker-session';
import { shortWhen } from './close';
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
  iqcDefaultSkipApplies: false,
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
  poAllocations: [],
  finalizedByName: null,
  finalizeBlockers: [],
  lotProgress: { received: 0, inIqc: 0, inDisposition: 0, disposed: 0, returned: 0 },
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
    goodsReceived: false,
    dispositionStatusCode: null,
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
  it('US2-10 입하 중은 번호 붙은 표 — 스캔 시각 · 품목코드 · 품목명 · LOT 수 · 수량, 입하 LOT 번호 · 경과일은 줄에 없다', async () => {
    const { sent } = mount();

    /* 줄은 품목으로 찾는다 — 입하 LOT 번호는 줄에서 뺐다(사용자 지시 2026-11-20). */
    const row = (
      await screen.findByRole('button', { name: t.list.open('SYN-ITEM-01', '합성 품목 가') })
    ).closest('tr') as HTMLElement;
    expect(row).toHaveTextContent('SYN-ITEM-01');
    expect(row).toHaveTextContent('합성 품목 가');
    expect(row).toHaveTextContent('2,000 EA');
    expect(within(row).getByText('2')).toBeInTheDocument();
    /* 행 번호 바로 뒤 칸이 스캔 시각(첫 스캔) — 날짜 / 시각(사용자 지시 2026-11-23). */
    const [scanDate = '', scanTime = ''] = shortWhen('2026-11-11T01:05:00Z').split(' ');
    expect(row.children[1]).toHaveClass('close-table__when');
    expect(row.children[1]).toHaveTextContent(`${scanDate}${scanTime}`);
    expect(screen.queryByText('SYN-IL-20261111-0003')).toBeNull();
    /* 공급사는 하나여도 머리 줄로 보인다(사용자 지시 2026-11-20). */
    expect(screen.getByText('합성 공급사 가')).toBeInTheDocument();
    /* 입하 중 · 입하 완료는 탭 — 건수 · 「마감 대상」은 적지 않는다(사용자 지시 2026-11-23). */
    expect(screen.getByRole('tab', { name: t.open.heading })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: t.done.heading })).toBeInTheDocument();
    expect(screen.queryByText(/마감 대상/u)).toBeNull();
    expect(sent.find((each) => each.search.get('closable') === 'true')?.search.get('plantId')).toBe(
      '8301',
    );
  });

  /* 「마감 취소됨」 칩은 두지 않는다(사용자 지시 2026-11-23). */
  it('마감 취소했던 입하 중 줄에도 칩이 없다', async () => {
    mount({ closable: [inboundLot(3, { reopened: true })] });

    const row = (
      await screen.findByRole('button', { name: t.list.open('SYN-ITEM-01', '합성 품목 가') })
    ).closest('tr') as HTMLElement;
    expect(row).not.toHaveTextContent('마감 취소됨');
  });

  it('US2-10 상세에서 자재 관리 LOT 를 보고 마감한다 — 부분 입하 사유를 묻지 않고 결과에 P/O 가 없다', async () => {
    const user = userEvent.setup();
    const { sent } = mount();

    await user.click(
      await screen.findByRole('button', { name: t.list.open('SYN-ITEM-01', '합성 품목 가') }),
    );
    /* 상세는 화면을 바꾸지 않고 「입하 품목」 시트로 뜬다(사용자 지시 2026-11-20). */
    const sheet = await screen.findByRole('dialog', { name: t.sheet.title });
    expect(sheet).toHaveTextContent('합성 공급사 가');
    expect(screen.queryByText(/[MW]-01-\d\d/u)).toBeNull();
    /* 번호 칸은 번호 전체 대신 끝 일련번호(사용자 지시 2026-11-18). */
    expect(
      within(screen.getByRole('table', { name: t.detail.lots(2) })).getByText('0001'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.detail.close }));
    const dialog = await screen.findByRole('dialog', {
      name: t.closeDialog.title('SYN-IL-20261111-0003'),
    });
    expect(dialog).toHaveTextContent(t.closeDialog.withIqc);
    expect(within(dialog).queryByRole('textbox')).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: t.closeDialog.proceed }));

    /* 결과 화면 없이 알림 한 줄 — 목록으로 돌아온다(사용자 결정 2026-11-20). */
    expect(await screen.findByText(t.result.withIqc('SYN-IQC-0013'))).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: t.sheet.title })).toBeNull();
    expect(screen.queryByText(/P\/O/u)).toBeNull();
    const close = sent.find((each) => each.path.endsWith(':close-receipt'));
    expect(close?.body).toMatchObject({ versionNo: 3 });
    expect(close?.body).not.toHaveProperty('partialReason');
    expect(close?.headers.get('X-Worker-No')).toBe('900028');
    expect(close?.headers.get('Idempotency-Key')).not.toBeNull();
  });

  it('G2 L20 상세 LOT 줄 — 수량 뒤 패키징 「· 봉지 10」(이름, 없으면 코드), 한 행에 번호 · 수량 · ✕', async () => {
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
          /* 이름이 빠진 응답(계약 밖)도 코드로 보이는지 지킨다. */
          uomName: names[index] as string,
          count: 10,
          qtyPerPackage: 100,
        },
      })),
    };
    mount({ details: { 3: detail } });

    await user.click(
      await screen.findByRole('button', { name: t.list.open('SYN-ITEM-01', '합성 품목 가') }),
    );
    expect(await screen.findByText('1,000 EA · 봉지 10')).toBeInTheDocument();
    expect(screen.getByText('1,000 EA · SYN-BAG 10')).toBeInTheDocument();

    /*
     * 한 행에 번호(끝 일련번호) · 수량 · ✕ — 번호 전체는 행에 쓰지 않고 확인 창에 보인다(사용자 지시 2026-11-18
     * 「목록과 계층으로 깔끔하게」, 예전 G2 L20 은 번호를 줄 폭 전체로 접어 썼다).
     */
    const row = screen.getByText('0001').closest('tr') as HTMLElement;
    expect(within(row).getByText('1,000 EA · 봉지 10')).toBeInTheDocument();
    expect(screen.queryByText('SYN-ITEM-01|1000|261111|SYN-P-01|0001')).toBeNull();
    /* [해제]는 ✕ 아이콘 단추 — 글자 「해제」는 보이지 않는다(사용자 지시 2026-11-18). */
    const unregister = within(row).getByRole('button', { name: t.detail.unregister });
    expect(within(row).queryByText(t.detail.unregister)).toBeNull();

    await user.click(unregister);
    expect(
      within(await screen.findByRole('dialog')).getByText('SYN-ITEM-01|1000|261111|SYN-P-01|0001'),
    ).toBeInTheDocument();
  });

  it('G2 L15 · US2-7 기본 생략 기준이 없는 검사 불필요 품목은 「IQC 기록이 생기지 않고」로 묻는다', async () => {
    const user = userEvent.setup();
    mount({
      closable: [inboundLot(3, { inspectionRequired: false, iqcDefaultSkipApplies: false })],
      closeResult: { inspectionRequired: false, iqc: null },
    });

    await user.click(
      await screen.findByRole('button', { name: t.list.open('SYN-ITEM-01', '합성 품목 가') }),
    );
    await user.click(await screen.findByRole('button', { name: t.detail.close }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(t.closeDialog.withoutIqcRecord);
    expect(dialog).not.toHaveTextContent(t.closeDialog.withoutIqc);
  });

  it('US2-10 검사 불필요 품목은 「검사 생략」으로 남는다고 묻고, 결과는 「검사 불필요, 자재 관리 LOT 정상」', async () => {
    const user = userEvent.setup();
    /* 「검사 생략」으로 남는 것은 기본 생략 기준이 걸릴 때만(G2 L15). */
    mount({
      closable: [inboundLot(3, { inspectionRequired: false, iqcDefaultSkipApplies: true })],
      closeResult: { inspectionRequired: false, iqc: null },
    });

    await user.click(
      await screen.findByRole('button', { name: t.list.open('SYN-ITEM-01', '합성 품목 가') }),
    );
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

    await user.click(
      await screen.findByRole('button', { name: t.list.open('SYN-ITEM-01', '합성 품목 가') }),
    );
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

describe('입하 중 전체 마감', () => {
  /* 띠 오른쪽 [전체 마감] — 확인 뒤 입하 중인 품목을 차례로 마감한다(사용자 지시 2026-11-23). */
  it('[전체 마감]은 확인 뒤 입하 중인 품목을 모두 마감한다', async () => {
    const user = userEvent.setup();
    const { sent } = mount({ closable: [inboundLot(3), inboundLot(4)], reopenable: [] });

    await user.click(await screen.findByRole('button', { name: t.open.closeAllLabel(2, 4) }));
    const dialog = await screen.findByRole('dialog', { name: t.closeAllDialog.title });
    expect(dialog).toHaveTextContent(t.closeAllDialog.summary(2, 4));
    await user.click(within(dialog).getByRole('button', { name: t.closeAllDialog.proceed }));

    expect(await screen.findByText(t.closeAllDialog.done(2))).toBeInTheDocument();
    expect(
      sent.filter((each) => each.path.endsWith(':close-receipt')).map((each) => each.path),
    ).toEqual([
      '/logistics/inbound-lots/3:close-receipt',
      '/logistics/inbound-lots/4:close-receipt',
    ]);
  });

  it('입하 중이 없으면 [전체 마감]이 없다', async () => {
    mount({ closable: [], reopenable: [] });

    expect(await screen.findByText(t.open.empty)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /전체 마감/u })).toBeNull();
  });
});

/** 입하 완료 탭으로 — 입하 중 · 입하 완료는 탭으로 갈린다(사용자 지시 2026-11-23). */
const openDoneTab = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(await screen.findByRole('tab', { name: t.done.heading }));
};

/** 입하 완료 줄의 [취소] — 낭독 이름은 무엇을 마감 취소하는지까지. */
const REOPEN = t.done.reopenLabel('SYN-ITEM-01', '합성 품목 가');

describe('US2-12 입하 완료 목록', () => {
  it('US2-12 「입하 완료」 탭 줄은 마감 시각 · 품목 · 개수 · 수량 · [취소]만 보이고, 확인 뒤 마감을 취소한다', async () => {
    const user = userEvent.setup();
    const { sent } = mount({
      closable: [],
      reopenable: [done(5, { closedAutomatically: true, supplierId: 8202 })],
    });

    await openDoneTab(user);
    /* 줄 — 마감 시각(날짜 / 시각) · 품목 · 개수 · 수량. 공급사는 머리 줄(사용자 지시 2026-11-23). */
    const row = (await screen.findByRole('button', { name: REOPEN })).closest('tr') as HTMLElement;
    /* 품목코드는 줄이 하이픈에서 꺾이지 않게 붙임표(‑)로 적힌다. */
    expect(row).toHaveTextContent(/SYN.ITEM.01/u);
    const [date = '', time = ''] = shortWhen('2026-11-10T17:00:00Z').split(' ');
    expect(row.querySelector('.close-table__count')).toHaveTextContent('2');
    expect(row.querySelector('.close-table__qty')).toHaveTextContent('2,000EA');
    expect(within(row).getByRole('button', { name: REOPEN })).toHaveTextContent(t.done.reopen);
    /* 행 번호 바로 뒤 칸이 마감 시각(사용자 지시 2026-11-23). */
    expect(row.children[1]).toHaveClass('close-table__when');
    expect(row.children[1]).toHaveTextContent(`${date}${time}`);
    expect(screen.getByText('합성 공급사 가')).toBeInTheDocument();
    /* 까닭 칩 · IQC 요청 번호 · 입하 LOT 번호 · 「마감 취소 가능 N」은 두지 않는다. */
    expect(row).not.toHaveTextContent('IQC 결과');
    expect(row).not.toHaveTextContent('SYN-IQC-5');
    expect(row).not.toHaveTextContent('SYN-IL-');
    expect(screen.queryByText(/마감 취소 가능/u)).toBeNull();

    await user.click(screen.getByRole('button', { name: REOPEN }));
    const dialog = await screen.findByRole('dialog', { name: t.reopenDialog.title });
    /* 무엇을 취소하는지 이름표 칸으로 — 가운데 점으로 잇지 않는다(사용자 지시 2026-11-23). */
    expect(dialog).toHaveTextContent(`${t.sheet.fields.itemCode}SYN-ITEM-01`);
    expect(dialog).toHaveTextContent(`${t.sheet.fields.supplier}합성 공급사 가`);
    expect(dialog).toHaveTextContent(t.sheet.fields.closedAt);
    expect(dialog.textContent).not.toContain('·');
    expect(dialog).toHaveTextContent(t.reopenDialog.effect.NO_IQC_RESULT('SYN-IQC-5'));
    await user.click(within(dialog).getByRole('button', { name: t.reopenDialog.proceed }));

    await waitFor(() =>
      expect(sent.some((each) => each.path.endsWith(':reopen-receipt'))).toBe(true),
    );
    expect(sent.find((each) => each.path.endsWith(':reopen-receipt'))?.body).toEqual({
      versionNo: 3,
    });
    expect(
      await screen.findByText(t.reopenDialog.done('SYN-ITEM-01', '합성 품목 가')),
    ).toBeInTheDocument();
  });

  it('US2-12 긴급 생략 실행 건은 생략이 무효가 된다고 경고한다', async () => {
    const user = userEvent.setup();
    mount({
      closable: [],
      reopenable: [done(6, { reopenReasonCode: 'IQC_SKIPPED' })],
    });

    await openDoneTab(user);
    await user.click(await screen.findByRole('button', { name: REOPEN }));
    expect(await screen.findByRole('dialog')).toHaveTextContent(
      t.reopenDialog.effect.IQC_SKIPPED('SYN-IQC-6'),
    );
  });
});

describe('US2-13 같은 공급사·품목 입하 중이면 마감 취소가 막힌다', () => {
  it('US2-13 줄에는 막힘을 적지 않고, [취소]를 누르면 창에서 까닭과 [입하 중 열기]를 준다', async () => {
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

    await openDoneTab(user);
    await user.click(await screen.findByRole('button', { name: REOPEN }));
    /* 줄에 미리 적던 막힘은 창에서만(사용자 지시 2026-11-23). */
    expect(screen.queryByText(t.blockedDialog.openReceipt, { selector: 'td *' })).toBeNull();

    const dialog = await screen.findByRole('dialog', { name: t.blockedDialog.title });
    expect(dialog).toHaveTextContent(t.blockedDialog.openReceipt);
    expect(dialog).toHaveTextContent(`${t.sheet.fields.itemCode}SYN-ITEM-01`);
    expect(dialog.textContent).not.toContain('·');
    expect(sent.some((each) => each.path.endsWith(':reopen-receipt'))).toBe(false);

    await user.click(within(dialog).getByRole('button', { name: t.blockedDialog.openReceiving }));
    expect(await screen.findByRole('dialog', { name: t.sheet.title })).toBeInTheDocument();
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

    await openDoneTab(user);
    await user.click(await screen.findByRole('button', { name: REOPEN }));
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

    await user.click(
      await screen.findByRole('button', { name: t.list.open('SYN-ITEM-01', '합성 품목 가') }),
    );
    const unregisters = await screen.findAllByRole('button', { name: t.detail.unregister });
    for (const each of unregisters) expect(each).toBeDisabled();
    expect(screen.getByRole('button', { name: t.detail.close })).toBeDisabled();
    act(() => {
      runBackStep();
    });

    await openDoneTab(user);
    expect(await screen.findByRole('button', { name: REOPEN })).toBeDisabled();
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

    await openDoneTab(user);
    await user.click(await screen.findByRole('button', { name: REOPEN }));

    expect(await screen.findByRole('dialog', { name: t.reopenDialog.title })).toBeInTheDocument();
    expect(screen.queryByText(t.blockedDialog.openReceipt)).not.toBeInTheDocument();
  });

  it('G1 막는 입하 LOT 가 지금 목록에 없으면 막힘 창에 [입하 중 열기]를 두지 않는다', async () => {
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

    await openDoneTab(user);
    await user.click(await screen.findByRole('button', { name: REOPEN }));

    const dialog = await screen.findByRole('dialog', { name: t.blockedDialog.title });
    expect(dialog).toHaveTextContent(t.blockedDialog.openReceipt);
    /* 입하 LOT 번호는 창에도 적지 않는다(사용자 지시 2026-11-23). */
    expect(dialog).not.toHaveTextContent('SYN-IL-20261111-0009');
    expect(
      within(dialog).queryByRole('button', { name: t.blockedDialog.openReceiving }),
    ).toBeNull();
  });

  it('G1 화면을 나갔다 다시 들어오면 목록을 새로 읽는다 — 다른 기기에서 마감한 건이 「입하 중」에 남지 않는다', async () => {
    const user = userEvent.setup();
    const closable = [inboundLot(3)];
    mount({ closable, withLeave: true });

    expect(
      await screen.findByRole('button', { name: t.list.open('SYN-ITEM-01', '합성 품목 가') }),
    ).toBeInTheDocument();

    closable.splice(0, closable.length);
    await user.click(screen.getByRole('button', { name: '나가기' }));
    await user.click(screen.getByRole('button', { name: '들어오기' }));

    expect(await screen.findByText(t.open.empty)).toBeInTheDocument();
    expect(screen.queryByText('SYN-ITEM-01')).not.toBeInTheDocument();
  });
});
