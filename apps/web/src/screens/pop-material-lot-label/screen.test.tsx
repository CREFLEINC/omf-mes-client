import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
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

const line = (id: number, receiptId: number, itemId: number, qty: number, missing: boolean) => ({
  inboundReceiptLineId: id,
  inboundReceiptId: receiptId,
  lineNo: 1,
  itemId,
  receivedQty: qty,
  uomId: 8401,
  supplierLotMissing: missing,
  inspectionRequired: false,
  statusCode: 'SYN_STATUS',
});

const DEFAULT_RECEIPTS = [receipt(8101, 'SYN-IB-0001', 8201, '2026-08-27T09:12:30Z')];
const DEFAULT_LINES = [line(8501, 8101, 8601, 500, true)];

interface StubOptions {
  receipts?: ReturnType<typeof receipt>[];
  lines?: ReturnType<typeof line>[];
  page?: { page: number; size: number; total: number };
  receiptsFail?: boolean;
  linesFail?: boolean;
  printers?: unknown[];
  printersFail?: boolean;
  onReceiptRequest?: (url: URL) => void;
  onLineRequest?: (url: URL) => void;
  onPrinterRequest?: (url: URL) => void;
}

const renderScreen = (options: StubOptions = {}) => {
  const receipts = options.receipts ?? DEFAULT_RECEIPTS;
  const lines = options.lines ?? DEFAULT_LINES;
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
      {
        match: (request) => new URL(request.url).pathname === '/mdm/partners',
        respond: () =>
          jsonResponse({
            items: [
              {
                partnerId: 8201,
                partnerCode: 'SYN-P-01',
                partnerName: '합성 공급사 가',
                isActive: true,
              },
            ],
            page: { page: 1, size: 20, total: 1 },
          }),
      },
      {
        match: (request) => new URL(request.url).pathname === '/mdm/items',
        respond: () =>
          jsonResponse({
            items: [
              { itemId: 8601, itemCode: 'SYN-ITEM-01', itemName: '합성 품목 가', isActive: true },
            ],
            page: { page: 1, size: 20, total: 1 },
          }),
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
    await screen.findByRole('button', { name: 'SYN-IB-0001 SYN-ITEM-01 · 합성 품목 가 선택' }),
  );
};

describe('PopMaterialLotLabelScreen — 입하 목록', () => {
  it('라벨을 발행하지 않은 입하 건만 조회한다', async () => {
    const seen: URL[] = [];
    renderScreen({ onReceiptRequest: (url) => seen.push(url) });

    await waitFor(() => {
      expect(seen.length).toBeGreaterThan(0);
    });
    expect(seen[0]?.searchParams.get('labelIssued')).toBe('false');
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
   * ⭐ 스펙 §3 은 목록 한 줄에 입하번호·품목·수량·공급사·입하일을 함께 그린다. 계약이 그것을
   * 두 경로로 나눠 주므로 화면이 합친다 — **고르기 전에 이미 다 보여야 한다.**
   */
  it('한 줄에 입하번호·공급사·품목·수량·입하일이 함께 온다', async () => {
    renderScreen();

    const row = await screen.findByRole('row', { name: /SYN-IB-0001/u });

    expect(within(row).getByText('SYN-IB-0001')).toBeInTheDocument();
    expect(within(row).getByText('SYN-P-01 · 합성 공급사 가')).toBeInTheDocument();
    expect(within(row).getByText('SYN-ITEM-01 · 합성 품목 가')).toBeInTheDocument();
    expect(within(row).getByText('500 EA')).toBeInTheDocument();
    expect(within(row).getByText('2026-08-27')).toBeInTheDocument();
  });

  /**
   * 칸은 오른쪽 정렬인데 쌓는 줄이 왼쪽에 붙어, 머리글과 값이 어긋나 보였다(실기에서
   * 드러났다). `.stacked-cell`의 기본값이 칸 정렬을 거스르는 자리다.
   */
  it('수량 칸의 쌓인 두 줄이 칸 정렬을 따른다', async () => {
    renderScreen();

    const quantity = await screen.findByText('500 EA');

    expect(quantity.closest('.stacked-cell')).toHaveClass('pop-stacked-end');
  });

  /**
   * ⛔ **화면이 거르지 않는다** — 사전부착 라인을 빼는 것은 서버 질의의 몫이다(스펙 §3-6 ·
   * 변경 통지 #534). 화면이 한 번 더 거르면 서버가 이미 좁힌 쪽을 다시 깎아 쪽 크기와 어긋난다.
   * 그래서 잣대는 「무엇이 안 보이나」가 아니라 **「무엇을 요청에 싣나」**를 본다.
   */
  it('사전부착·발행완료를 거를 조건을 두 요청에 모두 싣는다', async () => {
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
      expect(url?.searchParams.get('supplierLotMissing')).toBe('true');
      expect(url?.searchParams.get('labelIssued')).toBe('false');
    }
  });

  /** 서버가 이미 거르므로 화면에는 받은 줄이 그대로 선다. */
  it('받은 라인을 화면이 다시 거르지 않는다', async () => {
    renderScreen({ lines: [line(8501, 8101, 8601, 500, true), line(8502, 8101, 8601, 200, true)] });

    expect(await screen.findByText('500 EA')).toBeInTheDocument();
    expect(screen.getByText('200 EA')).toBeInTheDocument();
  });

  it('거른다는 사실을 화면이 밝힌다 — 보이는 것을 전부로 오해하지 않게 한다', async () => {
    renderScreen();

    expect(await screen.findByRole('status')).toHaveTextContent(
      /공급사 LOT 이 붙어 온 자재와 이미 발행한 자재는 보이지 않습니다/u,
    );
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
      name: 'SYN-IB-0001 SYN-ITEM-01 · 합성 품목 가 선택 해제',
    });

    expect(selected).toHaveClass('pop-row-select-on');
    expect(selected).toHaveAttribute('aria-pressed', 'true');
  });

  /** 스펙 §3 의 목록은 입하·품목·수량 세 칸이다. 선택 칸을 따로 두지 않는다. */
  it('목록이 스펙의 세 칸으로 선다', async () => {
    renderScreen();

    const headers = await screen.findAllByRole('columnheader');

    expect(headers.map((header) => header.textContent)).toEqual(['입하', '품목', '수량']);
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
  it('입하 건은 있는데 걸러 내 비었으면 왜 비었는지와 다음 쪽을 말한다', async () => {
    renderScreen({ lines: [] });

    expect(
      await screen.findByText(/이 쪽의 입하 건에는 발행할 자재가 없습니다/u),
    ).toBeInTheDocument();
    expect(screen.queryByText('발행할 자재가 없습니다.')).not.toBeInTheDocument();
  });

  /** 쪽 나눔은 입하 건 단위다 — 목록 줄(자재) 수로 세면 단위가 섞인다. */
  it('쪽 위치를 입하 건 단위로 세고 그 단위를 밝힌다', async () => {
    renderScreen({ lines: [] });

    expect(await screen.findByText('입하 건 1–1 / 전체 1건')).toBeInTheDocument();
  });

  it('입하 목록 조회에 실패하면 사유와 다시 시도 경로를 함께 보인다', async () => {
    renderScreen({ receiptsFail: true });

    expect(await screen.findByRole('alert')).toHaveTextContent('입하 목록을 불러오지 못했습니다.');
    expect(screen.getByRole('button', { name: '다시 불러오기' })).toBeInTheDocument();
  });

  /** 품목을 못 받으면 목록이 불완전하다 — 일부만 보이는 것을 「전부」로 내지 않는다. */
  it('품목 조회에 실패해도 목록을 반쪽으로 내지 않는다', async () => {
    renderScreen({ linesFail: true });

    expect(await screen.findByRole('alert')).toHaveTextContent('입하 목록을 불러오지 못했습니다.');
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

  it('고르면 품목·수량·공급사가 뜬다', async () => {
    const { user } = renderScreen();

    await selectFirst(user);
    const target = screen.getByLabelText('채번 대상');

    expect(await within(target).findByText('SYN-ITEM-01 · 합성 품목 가')).toBeInTheDocument();
    expect(within(target).getByText('500 EA')).toBeInTheDocument();
    expect(within(target).getByText('SYN-P-01 · 합성 공급사 가')).toBeInTheDocument();
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
  it('등록·인쇄와 재인쇄를 감추지 않고 비활성으로 두며 사유를 밝힌다', async () => {
    const { user } = renderScreen();

    await selectFirst(user);
    const target = screen.getByLabelText('채번 대상');

    expect(await within(target).findByRole('button', { name: '등록·인쇄' })).toBeDisabled();
    expect(within(target).getByRole('button', { name: '재인쇄' })).toBeDisabled();
    /*
     * 구획 폭을 그대로 쓴다 — `.field-note`의 20rem 제한에 갇히면 가로 여유가 남는데도
     * 두 줄로 접힌다(실기에서 드러났다).
     */
    expect(within(target).getByText(/아직 사용할 수 없습니다/u)).toHaveClass('pop-wide-note');
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

    expect(await screen.findByText('합성 라벨 프린터 가')).toBeInTheDocument();
    expect(screen.getByText('대기 중')).toBeInTheDocument();
  });

  it('프린터가 한 대도 없으면 빈 상태를 그린다 — 오류로 다루지 않는다', async () => {
    renderScreen({ printers: [] });

    expect(await screen.findByText('사용할 수 있는 프린터가 없습니다.')).toBeInTheDocument();
  });

  it('프린터 조회가 실패해도 입하 목록은 그대로 쓴다 — 머리 하나가 화면을 막지 않는다', async () => {
    renderScreen({ printersFail: true });

    expect(await screen.findByText('프린터 상태를 확인할 수 없습니다.')).toBeInTheDocument();
    expect(await screen.findByText('SYN-IB-0001')).toBeInTheDocument();
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
