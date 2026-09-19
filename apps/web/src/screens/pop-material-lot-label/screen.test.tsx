import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { ROWS_PER_PAGE } from './pagination';
import { LIST_REFRESH_MS } from './queries';
import { PopMaterialLotLabelScreen } from './screen';

/** 합성값이다 — 계약의 예시값을 쓰지 않는다(공개 저장소 경계). */
const receipt = (id: number, no: string, supplierId: number, at: string) => ({
  inboundReceiptId: id,
  inboundReceiptNo: no,
  supplierId,
  plantId: 8301,
  receiptDatetime: at,
  statusCode: 'SYN_STATUS',
});

const line = (
  id: number,
  receiptId: number,
  itemId: number,
  qty: number,
  attached: boolean,
  /** 이 라인으로 만들어진 자재LOT. 없으면 아직 등록하지 않은 라인이다. */
  lotId: number | null = null,
) => ({
  inboundReceiptLineId: id,
  inboundReceiptId: receiptId,
  lineNo: 1,
  itemId,
  receivedQty: qty,
  uomId: 8401,
  supplierLotMissing: false,
  supplierLotLabelAttached: attached,
  inspectionRequired: false,
  statusCode: 'SYN_STATUS',
  lotId,
});

const DEFAULT_RECEIPTS = [receipt(8101, 'SYN-IB-0001', 8201, '2026-08-27T09:12:30Z')];
const DEFAULT_LINES = [line(8501, 8101, 8601, 500, false)];
const DEFAULT_ITEMS = [
  { itemId: 8601, itemCode: 'SYN-ITEM-01', itemName: '합성 품목 가', isActive: true },
];
const DEFAULT_PARTNERS = [
  { partnerId: 8201, partnerCode: 'SYN-P-01', partnerName: '합성 공급사 가', isActive: true },
];
/** 거래처 목록 스텁의 쪽 크기. 작게 두어 「쪽을 끝까지 받는다」를 실제로 돌린다. */
const PARTNER_STUB_PAGE_SIZE = 1;

interface StubOptions {
  receipts?: ReturnType<typeof receipt>[];
  lines?: ReturnType<typeof line>[];
  page?: { page: number; size: number; total: number };
  receiptsFail?: boolean;
  linesFail?: boolean;
  printers?: unknown[];
  printersFail?: boolean;
  items?: typeof DEFAULT_ITEMS;
  partners?: typeof DEFAULT_PARTNERS;
  onReceiptRequest?: (url: URL) => void;
  onLineRequest?: (url: URL) => void;
  onPrinterRequest?: (url: URL) => void;
  /** 마스터 이름을 어느 경로로 물었는가. 「목록으로 풀지 않는다」를 재는 자리가 쓴다. */
  onMasterRequest?: (url: URL) => void;
}

const renderScreen = (options: StubOptions = {}) => {
  const receipts = options.receipts ?? DEFAULT_RECEIPTS;
  const lines = options.lines ?? DEFAULT_LINES;
  const items = options.items ?? DEFAULT_ITEMS;
  const partners = options.partners ?? DEFAULT_PARTNERS;
  const page = options.page ?? { page: 1, size: 20, total: receipts.length };

  const user = userEvent.setup();
  const result = renderWithProviders(<PopMaterialLotLabelScreen />, {
    fetch: createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/logistics/inbound-receipts',
        respond: (request) => {
          options.onReceiptRequest?.(new URL(request.url));

          return options.receiptsFail === true
            ? jsonResponse({ message: '실패' }, { status: 500 })
            : jsonResponse({ items: receipts, page });
        },
      },
      {
        match: (request) =>
          /\/logistics\/inbound-receipts\/(\d+)\/lines$/u.test(new URL(request.url).pathname),
        respond: (request) => {
          options.onLineRequest?.(new URL(request.url));

          if (options.linesFail === true) return jsonResponse({ message: '실패' }, { status: 500 });

          const matched = /\/inbound-receipts\/(\d+)\/lines$/u.exec(new URL(request.url).pathname);
          const receiptId = Number(matched?.[1] ?? 0);

          return jsonResponse({
            items: lines.filter((row) => row.inboundReceiptId === receiptId),
            page: { page: 1, size: 20, total: lines.length },
          });
        },
      },
      {
        match: (request) => new URL(request.url).pathname === '/app/printers',
        respond: (request) => {
          options.onPrinterRequest?.(new URL(request.url));

          return options.printersFail === true
            ? jsonResponse({ message: '실패' }, { status: 500 })
            : jsonResponse({
                items: options.printers ?? [
                  {
                    printerName: 'syn-label-printer',
                    displayName: '합성 라벨 프린터 가',
                    status: 'READY',
                    statusMessage: '대기 중',
                    isDefault: true,
                    supportedDocumentTypeCodes: ['LABEL'],
                  },
                ],
              });
        },
      },
      /*
       * ⭐ **마스터는 단건 경로로만 스텁한다**(omf-all-around#27). 목록 경로(`/mdm/items` ·
       *    `/mdm/partners`)를 남겨 두면, 화면이 목록으로 돌아가도 시험이 통과한다 — 그 목록은
       *    한 쪽만 돌려줘 첫 쪽 밖 품목·공급사가 「알 수 없음」이 되는 자리다. 하네스는 스텁에
       *    없는 요청을 던지므로, 여기 없는 것이 곧 **부르지 않는다는 감지기**다.
       */
      /*
       * ⚠ **거래처는 목록이되 한 쪽이 아니다.** 단건 조회는 단말 토큰에 열려 있지 않아(실측
       *   401) 화면이 쪽을 끝까지 받는다 — 여기서 **쪽 크기를 1 로 낮춰** 그 되돌이를 실제로
       *   돌린다. 서버가 요청한 크기를 낮춰 적용하는 자리도 같은 모양이다.
       */
      {
        match: (request) => new URL(request.url).pathname === '/mdm/partners',
        respond: (request) => {
          const url = new URL(request.url);
          options.onMasterRequest?.(url);
          const page = Number(url.searchParams.get('page') ?? '1');
          const start = (page - 1) * PARTNER_STUB_PAGE_SIZE;

          return jsonResponse({
            items: partners.slice(start, start + PARTNER_STUB_PAGE_SIZE),
            page: { page, size: PARTNER_STUB_PAGE_SIZE, total: partners.length },
          });
        },
      },
      {
        match: (request) => /\/mdm\/items\/(\d+)$/u.test(new URL(request.url).pathname),
        respond: (request) => {
          const url = new URL(request.url);
          options.onMasterRequest?.(url);
          const itemId = Number(/\/mdm\/items\/(\d+)$/u.exec(url.pathname)?.[1] ?? 0);
          const found = items.find((row) => row.itemId === itemId);

          return found === undefined
            ? jsonResponse({ message: '없음' }, { status: 404 })
            : jsonResponse({ item: found });
        },
      },
      {
        match: (request) => new URL(request.url).pathname === '/mdm/uoms',
        respond: () =>
          jsonResponse({
            items: [{ uomId: 8401, uomCode: 'EA', uomName: '개', isActive: true }],
            page: { page: 1, size: 20, total: 1 },
          }),
      },
    ]),
  });

  return { ...result, user };
};

const selectFirst = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(
    await screen.findByRole('button', {
      name: '입하 SYN-IB-0001 · 품목 SYN-ITEM-01 · 합성 품목 가 · 수량 500 EA 선택',
    }),
  );
};

describe('PopMaterialLotLabelScreen — 배포본 대상 조회', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('배포본에서도 미부착·미발행 조건을 서버에 함께 보낸다', async () => {
    vi.stubEnv('MODE', 'production');
    const asked: URL[] = [];
    renderScreen({ onLineRequest: (url) => asked.push(url) });

    await waitFor(() => expect(asked.length).toBeGreaterThan(0));
    expect(asked[0]?.searchParams.get('supplierLotLabelAttached')).toBe('false');
    expect(asked[0]?.searchParams.get('labelIssued')).toBe('false');
    expect(await screen.findByRole('button', { name: /SYN-IB-0001/u })).toBeInTheDocument();
  });
});

describe('PopMaterialLotLabelScreen — 입하 목록', () => {
  /**
   * ⛔ **입하 «건»을 미발행으로 거르지 않는다**(#1241). 건 목록의 `labelIssued=false` 는 「발행된
   * 라인이 하나도 없는 건」이라, 일부 자재만 인쇄한 건의 **남은 자재까지** 목록에서 사라졌다.
   * 미발행 여부는 라인 질의가 거른다.
   */
  it('미발행 보기는 입하 건을 발행 여부로 거르지 않고 라인만 미발행으로 거른다', async () => {
    const receiptUrls: URL[] = [];
    const lineUrls: URL[] = [];
    renderScreen({
      onReceiptRequest: (url) => receiptUrls.push(url),
      onLineRequest: (url) => lineUrls.push(url),
    });

    await waitFor(() => {
      expect(lineUrls.length).toBeGreaterThan(0);
    });
    expect(receiptUrls[0]?.searchParams.has('labelIssued')).toBe(false);
    expect(lineUrls[0]?.searchParams.get('labelIssued')).toBe('false');
  });

  /** ⭐ 발행 완료 보기(사용자 지시 2026-09-15 · #1241) — 인쇄를 마친 자재를 다시 고를 길이다. */
  it('발행 완료를 고르면 건과 라인을 발행 조건으로 다시 부르고 고른 줄과 쪽을 푼다', async () => {
    const receiptUrls: URL[] = [];
    const lineUrls: URL[] = [];
    const { user } = renderScreen({
      page: { page: 1, size: 1, total: 3 },
      onReceiptRequest: (url) => receiptUrls.push(url),
      onLineRequest: (url) => lineUrls.push(url),
    });
    const filter = within(await screen.findByRole('group', { name: '발행 여부' }));

    expect(filter.getByRole('button', { name: '미발행' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(await screen.findByRole('button', { name: '다음 ▶' }));
    await selectFirst(user);
    await user.click(filter.getByRole('button', { name: '발행 완료' }));

    expect(filter.getByRole('button', { name: '발행 완료' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await waitFor(() => {
      expect(receiptUrls.at(-1)?.searchParams.get('labelIssued')).toBe('true');
    });
    expect(receiptUrls.at(-1)?.searchParams.has('page')).toBe(false);
    await waitFor(() => {
      expect(lineUrls.at(-1)?.searchParams.get('labelIssued')).toBe('true');
    });
    expect(screen.getByText('왼쪽에서 자재를 고르세요.')).toBeInTheDocument();
  });

  /**
   * ⭐ **목록의 자료를 만드는 것은 이 화면이 아니다**(omf-all-around#29). PDA 로 등록한 입하가
   * 앱을 껐다 켜야 보이던 자리다 — 화면이 떠 있는 동안 다시 부르는 장치가 없었다.
   *
   * 주기 갱신은 다른 자리에서 재고(`queries.test.ts`), 여기서는 **사람이 지금 부르는 길**이
   * 실제로 목록과 라인을 다시 받아 오는지를 본다.
   */
  it('갱신을 누르면 건과 라인을 다시 받는다', async () => {
    const receiptUrls: URL[] = [];
    const lineUrls: URL[] = [];
    const { user } = renderScreen({
      onReceiptRequest: (url) => receiptUrls.push(url),
      onLineRequest: (url) => lineUrls.push(url),
    });

    await screen.findByRole('button', { name: /SYN-IB-0001/u });
    await waitFor(() => {
      expect(lineUrls.length).toBeGreaterThan(0);
    });
    const receiptCalls = receiptUrls.length;
    const lineCalls = lineUrls.length;

    await user.click(screen.getByRole('button', { name: '갱신' }));

    await waitFor(() => {
      expect(receiptUrls.length).toBeGreaterThan(receiptCalls);
    });
    await waitFor(() => {
      expect(lineUrls.length).toBeGreaterThan(lineCalls);
    });
  });

  /**
   * ⭐ **가만히 두어도 목록이 스스로 다시 뜬다**(omf-all-around#29). 간격 자체는 다른 자리에서
   * 재고(`queries.test.ts`), 여기서는 **그 간격이 실제로 조회에 걸려 있는지**를 본다 — 값만
   * 정하고 조회에 매달지 않으면 시험은 통과하는데 현장에서는 그대로 멈춰 있다.
   */
  it('가만히 두어도 목록을 다시 받는다', async () => {
    vi.useFakeTimers();

    try {
      const receiptUrls: URL[] = [];
      const lineUrls: URL[] = [];
      renderScreen({
        onReceiptRequest: (url) => receiptUrls.push(url),
        onLineRequest: (url) => lineUrls.push(url),
      });

      /* 첫 조회가 끝나기를 기다린다 — 가짜 타이머라 마이크로태스크를 직접 흘려보낸다. */
      await vi.advanceTimersByTimeAsync(100);
      const receiptCalls = receiptUrls.length;
      const lineCalls = lineUrls.length;
      expect(receiptCalls).toBeGreaterThan(0);
      expect(lineCalls).toBeGreaterThan(0);

      await vi.advanceTimersByTimeAsync(LIST_REFRESH_MS + 100);

      expect(receiptUrls.length).toBeGreaterThan(receiptCalls);
      expect(lineUrls.length).toBeGreaterThan(lineCalls);
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * ⛔ **세로를 더 먹지 않는 자리에 둔다.** 세로 여유가 119px 뿐인 화면이라(스펙 §4) 제목 줄에
   * 얹으면 목록이 그만큼 짧아진다. 쪽 이동 줄은 이미 단추 높이를 쓰고 있다.
   */
  it('갱신은 쪽 이동과 한 줄을 함께 쓴다', async () => {
    renderScreen();

    const nav = await screen.findByRole('navigation', { name: '쪽 이동' });
    const refresh = screen.getByRole('button', { name: '갱신' });

    expect(refresh.parentElement).toHaveClass('pop-lot-list-foot');
    expect(refresh.parentElement).toBe(nav.parentElement);
  });

  /**
   * ⭐ **잘릴 줄은 다음 쪽으로 넘긴다**(사용자 지시 2026-09-19 · omf-all-around#32). 목록에
   * 스크롤을 두지 않으므로, 잘라 보이면 그 줄에는 닿을 방법이 없다 — 실제로 열한 줄 중 두 줄이
   * 화면 밖에 있었고 쪽 이동은 「1쪽 중 1쪽」으로 꺼져 있었다.
   */
  it('한 쪽에 들어가지 않는 줄은 다음 쪽에서 보인다', async () => {
    const lines = Array.from({ length: ROWS_PER_PAGE + 2 }, (_, index) =>
      line(8600 + index, 8101, 8601, 100 + index, false),
    );
    const { user } = renderScreen({ lines });

    const rows = await screen.findAllByRole('button', { name: /입하 SYN-IB-0001/u });

    expect(rows).toHaveLength(ROWS_PER_PAGE);
    expect(screen.getByText(`2쪽 중 1쪽`)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다음 ▶' }));

    expect(await screen.findByText('2쪽 중 2쪽')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /입하 SYN-IB-0001/u })).toHaveLength(2);
    /* 되돌아가면 앞 쪽 줄이 그대로 선다 — 넘긴 줄이 사라지는 것이 아니다. */
    await user.click(screen.getByRole('button', { name: '◀ 이전' }));
    expect(await screen.findByText('2쪽 중 1쪽')).toBeInTheDocument();
  });

  it('첫 쪽에서는 쪽 조건을 싣지 않는다 — 서버 기본값이 1이다', async () => {
    const seen: URL[] = [];
    renderScreen({ onReceiptRequest: (url) => seen.push(url) });

    await waitFor(() => {
      expect(seen.length).toBeGreaterThan(0);
    });
    expect(seen[0]?.searchParams.has('page')).toBe(false);
  });

  /**
   * ⭐ 목록 한 줄이 **입하일·수량·품목·공급사**를 함께 그린다 — 고르기 전에 이미 다 보여야 한다.
   *
   * ⛔ 입하번호와 공급사 코드는 여기 두지 않는다(사용자 지시 2026-09-19) — 줄을 가리는 값이
   *    아니고, 고른 뒤 채번 대상 카드에서 갈라 본다.
   */
  it('한 줄에 입하일·공급사·수량·품목명·품목코드가 함께 온다', async () => {
    renderScreen();

    const row = await screen.findByRole('button', { name: /SYN-IB-0001/u });

    expect(within(row).getByText('08-27')).toBeInTheDocument();
    expect(within(row).getByText('합성 공급사 가')).toBeInTheDocument();
    expect(within(row).getByText('500 EA')).toBeInTheDocument();
    expect(within(row).getByText('합성 품목 가')).toBeInTheDocument();
    expect(within(row).getByText('SYN-ITEM-01')).toBeInTheDocument();
    /* 붙여 내던 한 줄은 목록에 남아 있으면 안 된다 — 이름과 코드가 제 칸을 갖는다. */
    expect(within(row).queryByText('SYN-ITEM-01 · 합성 품목 가')).not.toBeInTheDocument();
    expect(within(row).queryByText('SYN-P-01 · 합성 공급사 가')).not.toBeInTheDocument();
  });

  /**
   * ⛔ **마스터 목록 첫 쪽에 없는 품목·공급사도 이름이 나와야 한다**(omf-all-around#27).
   *
   * 종전에는 `GET /mdm/items` · `GET /mdm/partners` 를 한 번 받아 그 안에서 식별자를 찾았다.
   * 그 조회는 한 쪽(계약 기본 50건)만 돌려주므로, 품목 9천여 건인 현장에서는 목록에 선 자재의
   * 품목이 거의 언제나 첫 쪽 밖이라 **「알 수 없음」**이 섰다 — 값은 서버에 멀쩡히 있는데도.
   *
   * 여기서 쓰는 식별자는 **기본 시험 자료와 다른 것**이라, 목록 한 벌로 푸는 구현으로 되돌리면
   * 이름을 찾지 못해 이 시험이 깨진다.
   */
  it('마스터 목록 첫 쪽 밖 품목·공급사도 이름이 나온다', async () => {
    const masterUrls: URL[] = [];
    renderScreen({
      receipts: [receipt(8102, 'SYN-IB-0009', 9201, '2026-08-28T01:02:03Z')],
      lines: [line(8502, 8102, 9601, 12, false)],
      items: [
        { itemId: 9601, itemCode: 'SYN-ITEM-99', itemName: '합성 품목 먼쪽', isActive: true },
      ],
      /* 쓰는 공급사를 **둘째 쪽**에 둔다 — 첫 쪽만 받으면 여기서 「알 수 없음」이 선다. */
      partners: [
        { partnerId: 8201, partnerCode: 'SYN-P-01', partnerName: '합성 공급사 가', isActive: true },
        {
          partnerId: 9201,
          partnerCode: 'SYN-P-99',
          partnerName: '합성 공급사 먼쪽',
          isActive: true,
        },
      ],
      onMasterRequest: (url) => masterUrls.push(url),
    });

    const row = await screen.findByRole('button', { name: /SYN-IB-0009/u });

    expect(within(row).getByText('합성 품목 먼쪽')).toBeInTheDocument();
    expect(await within(row).findByText('합성 공급사 먼쪽')).toBeInTheDocument();
    /* 품목은 줄에 선 식별자만 묻는다 — 9천여 건을 다 받아 오지 않는다. */
    expect(masterUrls.map((url) => url.pathname)).toContain('/mdm/items/9601');
    expect(masterUrls.some((url) => url.pathname === '/mdm/items')).toBe(false);
    /* 공급사는 쪽을 끝까지 받는다 — 둘째 쪽을 실제로 물었다. */
    expect(
      masterUrls
        .filter((url) => url.pathname === '/mdm/partners')
        .map((url) => url.searchParams.get('page')),
    ).toEqual(['1', '2']);
  });

  /**
   * ⭐ **값마다 이름이 붙는다**(사용자 지시 2026-09-19). 무엇을 보고 있는지 화면이 말한다 —
   * 읽어 주는 도구가 쓰는 어휘(`selectRow`)와 같은 말이라 보는 사람과 듣는 사람이 같은 것을 듣는다.
   *
   * ⛔ **열 머리글 줄을 되살리는 것이 아니다.** 이름은 값 «옆»에 붙어 세로를 쓰지 않는다 —
   * 머리줄은 그 자체로 한 줄을 먹으면서 값과 같은 말을 되풀이해 걷어 낸 것이다(2026-09-10).
   */
  it('줄의 값마다 이름이 함께 선다', async () => {
    renderScreen();

    const row = await screen.findByRole('button', { name: /SYN-IB-0001/u });

    for (const name of ['입하일', '공급사', '수량', '품목명', '품목코드']) {
      expect(within(row).getByText(name)).toHaveClass('pop-material-lot-line-label');
    }
    /* 이름은 «목록 위»가 아니라 줄 «안»에 있다 — 머리줄이 아니다. */
    expect(within(row).getAllByText('품목명')).toHaveLength(1);
    /* ⛔ 입하번호는 목록에서 뺐다 — 고른 뒤 채번 대상 카드에서 본다(사용자 지시 2026-09-19). */
    expect(within(row).queryByText('SYN-IB-0001')).not.toBeInTheDocument();
  });

  /**
   * ⭐ **품목이 줄 하나를 통째로 쓴다**(사용자 지시 2026-09-19). 첫 줄 가운데 칸에 두었을 때
   * 그 칸이 1024×768 에서 146px 뿐이라 실제 품목이 네 줄로 접혔다(실측) — 줄 높이가 148px 까지
   * 부풀어 405px 짜리 목록에 두세 줄밖에 서지 못했다.
   *
   * ⚠ **수량은 한 덩어리다.** 「150」과 「EA」가 갈려 서면 두 값처럼 읽힌다 — 좁은 창에서
   * 실제로 그렇게 나왔다(사용자 지적 2026-09-10).
   */
  it('품목명은 한 줄을 통째로 쓰고 첫 줄은 입하일·공급사·수량으로 갈린다', async () => {
    renderScreen();

    const itemName = await screen.findByText('합성 품목 가');

    expect(itemName).toHaveClass('pop-material-lot-line-item-value');
    expect(itemName.parentElement).toHaveClass('pop-material-lot-line-item');
    expect(screen.getByText('SYN-ITEM-01')).toHaveClass('pop-material-lot-line-item-code');
    expect(screen.getByText('08-27')).toHaveClass('pop-material-lot-line-date');
    expect(screen.getByText('500 EA')).toHaveClass('pop-material-lot-line-qty');
  });

  /**
   * ⛔ **화면이 거르지 않는다** — 사전부착 라인을 빼는 것은 서버 질의의 몫이다(스펙 §3-6 ·
   * 변경 통지 #534). 화면이 한 번 더 거르면 서버가 이미 좁힌 쪽을 다시 깎아 쪽 크기와 어긋난다.
   * 그래서 잣대는 「무엇이 안 보이나」가 아니라 **「무엇을 요청에 싣나」**를 본다.
   */
  it('사전부착을 거를 조건을 두 요청에 모두 싣는다', async () => {
    const receiptUrls: URL[] = [];
    const lineUrls: URL[] = [];
    renderScreen({
      onReceiptRequest: (url) => receiptUrls.push(url),
      onLineRequest: (url) => lineUrls.push(url),
    });

    await waitFor(() => {
      expect(lineUrls.length).toBeGreaterThan(0);
    });

    for (const url of [receiptUrls[0], lineUrls[0]]) {
      expect(url?.searchParams.get('supplierLotLabelAttached')).toBe('false');
    }
  });

  /** 서버가 이미 거르므로 화면에는 받은 줄이 그대로 선다. */
  it('받은 라인을 화면이 다시 거르지 않는다', async () => {
    renderScreen({
      lines: [line(8501, 8101, 8601, 500, false), line(8502, 8101, 8601, 200, false)],
    });

    expect(await screen.findByText('500 EA')).toBeInTheDocument();
    expect(screen.getByText('200 EA')).toBeInTheDocument();
  });

  /*
   * ⭐ **무엇만 담긴 목록인지는 «제목»이 말한다** — 스펙 §3 도면의 `《입하 라인》 (미부착)`.
   *
   * ⛔ 같은 뜻을 아래 배너로 또 세우지 않는다. 세로 여유가 119px 뿐인 화면이라(§3) 배너 한
   *    줄이 목록에서 그만큼을 가져가고, 제목과 배너가 같은 말을 두 번 한다(사용자 지적).
   */
  it('무엇만 담긴 목록인지를 제목이 말한다 — 배너로 되풀이하지 않는다', async () => {
    renderScreen();

    expect(
      await screen.findByRole('heading', { name: messages.popMaterialLotLabel.receipts.title }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/보이지 않습니다/u)).not.toBeInTheDocument();
  });

  /**
   * ⭐ 고른 것이 **눈에 보여야** 한다. 앞선 판은 눌린 상태를 화면 읽기 프로그램에만 알리고
   * 시각 변화를 두지 않아, 누른 사람이 골랐는지 알 수 없었다(실기에서 드러났다).
   * 스펙의 목록에는 선택 칸이 없으므로 글자로 말할 자리가 없다 — **모양으로 남긴다.**
   */
  it('고르면 그 줄이 고른 모양이 된다 — 보이지 않는 선택은 선택이 아니다', async () => {
    const { user } = renderScreen();

    await selectFirst(user);

    const selected = await screen.findByRole('button', {
      name: '입하 SYN-IB-0001 · 품목 SYN-ITEM-01 · 합성 품목 가 · 수량 500 EA 선택 해제',
    });

    expect(selected).toHaveClass('pop-material-lot-line-on');
    expect(selected).toHaveAttribute('aria-pressed', 'true');
  });

  /**
   * 스펙 §3 의 목록은 한 줄을 상자 하나로 그리고, 장갑 낀 손을 전제하므로(G-5) 타겟을 칸
   * 하나로 좁히지 않는다. 첫 칸에만 조작을 두면 **나머지 칸을 눌러도 아무 일이 없어**
   * 「눌리지 않는다」로 읽힌다.
   */
  it('첫 칸이 아닌 칸을 눌러도 그 줄이 골라진다 — 누르는 자리는 줄 전체다', async () => {
    const { user } = renderScreen();

    // 품목 칸에는 조작이 없다. 그 글자를 눌러도 그 줄의 선택이 뒤집혀야 한다.
    await user.click(await screen.findByText('합성 품목 가'));

    expect(
      await screen.findByRole('button', {
        name: '입하 SYN-IB-0001 · 품목 SYN-ITEM-01 · 합성 품목 가 · 수량 500 EA 선택 해제',
      }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('같은 줄의 다른 칸을 다시 누르면 선택이 풀린다 — 무를 수단이 없으면 갇힌다', async () => {
    const { user } = renderScreen();

    const itemCell = await screen.findByText('합성 품목 가');
    await user.click(itemCell);
    await user.click(itemCell);

    expect(
      await screen.findByRole('button', {
        name: '입하 SYN-IB-0001 · 품목 SYN-ITEM-01 · 합성 품목 가 · 수량 500 EA 선택',
      }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  /**
   * ⛔ **열 머리글 줄을 두지 않는다** — 스펙 §3 도면의 목록은 카드형이고 「입하·품목·수량」
   * 머리줄이 없다(사용자 지적 2026-09-10). 세로 여유가 119px 뿐인 화면이라(§3) 그 한 줄이
   * 목록에서 그만큼을 가져간다.
   */
  it('열 머리글 줄을 두지 않는다', async () => {
    renderScreen();

    await screen.findByRole('button', { name: /SYN-IB-0001/u });

    expect(screen.queryAllByRole('columnheader')).toHaveLength(0);
  });

  it('입하 건이 하나도 없으면 빈 상태를 보인다', async () => {
    renderScreen({ receipts: [], page: { page: 1, size: 20, total: 0 } });

    expect(await screen.findByText('발행할 자재가 없습니다.')).toBeInTheDocument();
  });

  /**
   * ⭐ **입하 건은 있는데 보일 자재가 없는 상태가 정상적으로 생긴다** — 건과 라인을 서버가
   * 각각 거르므로 건은 남고 라인이 0 건으로 오는 쪽이 나온다. 그때 「발행할 자재가 없습니다」만
   * 내면 옆의 「전체 1건」과 나란히 서서 서로 어긋나 보인다(실기에서 그 상태가 그대로 나왔다).
   */
  it('입하 건은 있는데 걸러 내 비었으면 발행 완료 쪽을 보라고 말한다', async () => {
    renderScreen({ lines: [] });

    expect(
      await screen.findByText('미발행 자재가 없습니다. 발행 완료 자재를 확인하세요.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('발행할 자재가 없습니다.')).not.toBeInTheDocument();
  });

  /**
   * ⚠ 미발행 보기는 입하 건을 발행 여부로 거르지 않아 다 발행한 건도 쪽을 차지한다(#1241). 뒤쪽이
   * 남았는데 「발행 완료를 보라」고 하면 뒤쪽의 미발행 자재를 놓친다.
   */
  it('뒤쪽이 남았으면 비어 있는 쪽에서 다음 쪽을 가리킨다', async () => {
    renderScreen({ lines: [], page: { page: 1, size: 1, total: 3 } });

    expect(
      await screen.findByText('이 쪽에는 미발행 자재가 없습니다. 다음 쪽을 확인하세요.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/발행 완료 자재를 확인하세요/u)).not.toBeInTheDocument();
  });

  /** 쪽 나눔은 입하 건 단위다 — 목록 줄(자재) 수로 세면 단위가 섞인다. */
  it('지금 자리를 쪽 번호로 보인다 — 줄 수와 어긋나는 건수를 말하지 않는다', async () => {
    renderScreen({ lines: [] });

    expect(await screen.findByText('1쪽 중 1쪽')).toBeInTheDocument();
  });

  it('입하 목록 조회에 실패하면 사유와 다시 시도 경로를 함께 보인다', async () => {
    renderScreen({ receiptsFail: true });

    // 사번 미확인 띠도 alert 라 문구로 찾는다 — 이 묶음에는 사번 공급자가 없다.
    expect(await screen.findByText('입하 목록을 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 불러오기' })).toBeInTheDocument();
  });

  /** 품목을 못 받으면 목록이 불완전하다 — 일부만 보이는 것을 「전부」로 내지 않는다. */
  it('품목 조회에 실패해도 목록을 반쪽으로 내지 않는다', async () => {
    renderScreen({ linesFail: true });

    // 사번 미확인 띠도 alert 라 문구로 찾는다 — 이 묶음에는 사번 공급자가 없다.
    expect(await screen.findByText('입하 목록을 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('화면 제목이 디자인 시스템 서식을 입는다 — 맨 h1은 다른 화면과 크기가 어긋난다', async () => {
    renderScreen();

    const heading = await screen.findByRole('heading', { name: '자재LOT 등록·라벨 발행' });

    expect(heading.className).not.toBe('');
  });

  it('쪽을 옮기면 그 쪽을 조건에 싣고 고른 줄을 푼다', async () => {
    const seen: URL[] = [];
    const { user } = renderScreen({
      page: { page: 1, size: 1, total: 2 },
      onReceiptRequest: (url) => seen.push(url),
    });

    await selectFirst(user);
    await user.click(await screen.findByRole('button', { name: '다음 ▶' }));

    await waitFor(() => {
      expect(seen.some((url) => url.searchParams.get('page') === '2')).toBe(true);
    });
    expect(await screen.findByText('왼쪽에서 자재를 고르세요.')).toBeInTheDocument();
  });
});

describe('PopMaterialLotLabelScreen — 채번 대상', () => {
  it('고르기 전에는 무엇을 하면 되는지 말한다', async () => {
    renderScreen();

    expect(await screen.findByText('왼쪽에서 자재를 고르세요.')).toBeInTheDocument();
  });

  /**
   * ⭐ **입하번호와 품목코드·품목명이 여기서 갈려 선다**(사용자 지시 2026-09-19). 목록은 품목을
   * 한 줄로 붙여 내고, 무엇을 찍을지 확인하는 이 카드는 칸을 갈라 낸다 — 실물 라벨과 눈으로
   * 대조하는 것은 코드 쪽이다.
   */
  it('고르면 입하번호·품목코드·품목명·수량·공급사코드·공급사명이 뜬다', async () => {
    const { user } = renderScreen();

    await selectFirst(user);
    const target = screen.getByLabelText('채번 대상');

    expect(await within(target).findByText('SYN-ITEM-01')).toBeInTheDocument();
    expect(within(target).getByText('합성 품목 가')).toBeInTheDocument();
    /* 붙여 놓은 한 줄은 카드에 서지 않는다 — 갈라 낸 것이 요구다. */
    expect(within(target).queryByText('SYN-ITEM-01 · 합성 품목 가')).not.toBeInTheDocument();
    expect(within(target).getByText('SYN-IB-0001')).toBeInTheDocument();
    expect(within(target).getByText('500 EA')).toBeInTheDocument();
    expect(within(target).getByText('SYN-P-01')).toBeInTheDocument();
    expect(within(target).getByText('합성 공급사 가')).toBeInTheDocument();
    expect(within(target).queryByText('SYN-P-01 · 합성 공급사 가')).not.toBeInTheDocument();
  });

  /**
   * 스펙은 발번 결과를 등록 전에 미리 보이지만 계약에 채번 경로가 없다.
   * 자리를 두고 왜 비었는지 밝힌다 — 조용히 빼면 만든 줄 안다(공유계약 A-11).
   */
  it('LOT 번호 자리를 두되 비우고 왜 비었는지 밝힌다', async () => {
    const { user } = renderScreen();

    await selectFirst(user);
    const target = screen.getByLabelText('채번 대상');

    expect(await within(target).findByText('LOT 번호')).toBeInTheDocument();
    expect(within(target).getByText('등록 시 서버가 매깁니다.')).toBeInTheDocument();
  });

  /** F-1 — 숨기지 않는다. 왜 못 하는지 알아야 한다. */
  /**
   * 이 화면 묶음에는 **사번 공급자가 없다** — 셸이 채우는 값이라 기본이 「모름」이다.
   * 쓰기가 그 헤더를 요구하므로 감추지 않고 비활성 + 사유로 둔다(공유계약 F-1·F-6).
   */
  it('사번을 모르면 등록·인쇄를 감추지 않고 비활성으로 두며 사유를 맨 위 띠로 밝힌다', async () => {
    const { user } = renderScreen();

    await selectFirst(user);
    const target = screen.getByLabelText('채번 대상');

    expect(await within(target).findByRole('button', { name: '등록·인쇄' })).toBeDisabled();
    // 사유는 화면 맨 위 공용 띠 하나로만 말한다(사용자 지시 2026-09-17).
    expect(screen.getByText(messages.popChrome.workerMissing)).toBeInTheDocument();
    expect(within(target).queryByText(/사번을 확인한 뒤에/u)).not.toBeInTheDocument();
  });

  /** 되돌릴 수 없는 조작이라 터치 등급이 높다. */
  it('등록·인쇄가 핵심 등급 치수를 갖는다', async () => {
    const { user } = renderScreen();

    await selectFirst(user);

    expect(await screen.findByRole('button', { name: '등록·인쇄' })).toHaveClass(
      'pop-touch-critical',
    );
  });

  /**
   * ⛔ 계약의 `Lot.statusCode`는 품질 판정 축이고 `LotCreate`에 그 필드가 없다 —
   * 화면이 보낼 수도 없는 값을 지어내지 않는다(변경 통지 #534).
   */
  it('상태를 지어내 보이지 않는다', async () => {
    const { user } = renderScreen();

    await selectFirst(user);

    expect(screen.queryByText('Hold')).not.toBeInTheDocument();
  });
});

describe('PopMaterialLotLabelScreen — 프린터 상태', () => {
  it('머리에 프린터와 그 상태를 상시 보인다 — 인쇄가 안 될 때 가장 먼저 보는 자리다', async () => {
    renderScreen();

    // 이름만 든다 — 상태 설명은 붙이지 않는다(사용자 지시 2026-09-14).
    expect(await screen.findByText('프린터 합성 라벨 프린터 가')).toBeInTheDocument();
  });

  it('프린터가 한 대도 없으면 빈 상태를 그린다 — 오류로 다루지 않는다', async () => {
    renderScreen({ printers: [] });

    expect(await screen.findByText('사용할 수 있는 프린터가 없습니다.')).toBeInTheDocument();
  });

  it('프린터 조회가 실패해도 입하 목록은 그대로 쓴다 — 머리 하나가 화면을 막지 않는다', async () => {
    renderScreen({ printersFail: true });

    expect(await screen.findByText('프린터 상태를 확인할 수 없습니다.')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /SYN-IB-0001/u })).toBeInTheDocument();
  });

  it('문서 유형으로 프린터를 거르지 않는다', async () => {
    const seen: URL[] = [];
    renderScreen({ onPrinterRequest: (url) => seen.push(url) });

    await waitFor(() => {
      expect(seen.length).toBeGreaterThan(0);
    });
    expect(seen[0]?.searchParams.has('documentTypeCode')).toBe(false);
  });
});

describe('PopMaterialLotLabelScreen — 등록이 어디까지 갔는가', () => {
  const selectRow = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(
      await screen.findByRole('button', {
        name: '입하 SYN-IB-0001 · 품목 SYN-ITEM-01 · 합성 품목 가 · 수량 500 EA 선택',
      }),
    );
  };

  it('아직 등록하지 않은 자재는 「등록·인쇄」로 보인다', async () => {
    const { user } = renderScreen();

    await selectRow(user);

    expect(await screen.findByRole('button', { name: '등록·인쇄' })).toBeInTheDocument();
  });

  /**
   * ⛔ 이미 등록된 자재에 「등록·인쇄」를 보이면 이미 있는 LOT 위에 또 만든다고 읽힌다.
   * 실제로 다시 부르면 같은 자재에 LOT 이 둘 생기고 되돌릴 화면이 없다(변경 통지 #534 §3).
   *
   * ⛔ **문장으로 되풀이하지 않는다** — 단추 이름이 바뀐 것이 곧 그 사실이다. 스펙 §3 이
   *    이 아래를 「하단에 상시 구획을 두지 않는다」로 못박았다(여유 119px).
   */
  it('이미 등록된 자재는 「인쇄」로 보인다 — 문장을 덧붙이지 않는다', async () => {
    const { user } = renderScreen({ lines: [line(8501, 8101, 8601, 500, true, 9001)] });

    await selectRow(user);

    expect(await screen.findByRole('button', { name: '인쇄' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '등록·인쇄' })).not.toBeInTheDocument();
    expect(screen.queryByText(/이미 등록된 자재입니다/u)).not.toBeInTheDocument();
  });
});
