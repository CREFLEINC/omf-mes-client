import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { PopMaterialLotLabelScreen } from './screen';

/**
 * 합성값이다 — 계약의 예시값을 쓰지 않는다(공개 저장소 경계).
 */
const receipt = (id: number, no: string, supplierId: number, at: string) => ({
  inboundReceiptId: id,
  inboundReceiptNo: no,
  supplierId,
  plantId: 8301,
  receiptDatetime: at,
  statusCode: 'SYN_STATUS',
});

const partner = (id: number, code: string, name: string, isActive = true) => ({
  partnerId: id,
  partnerCode: code,
  partnerName: name,
  isActive,
});

const line = (id: number, itemId: number, qty: number, missing: boolean) => ({
  inboundReceiptLineId: id,
  inboundReceiptId: 8101,
  lineNo: 1,
  itemId,
  receivedQty: qty,
  uomId: 8401,
  supplierLotMissing: missing,
  inspectionRequired: false,
  statusCode: 'SYN_STATUS',
});

interface StubOptions {
  receipts?: ReturnType<typeof receipt>[];
  lines?: ReturnType<typeof line>[];
  page?: { page: number; size: number; total: number };
  receiptsFail?: boolean;
  linesFail?: boolean;
  printers?: unknown[];
  printersFail?: boolean;
  onReceiptRequest?: (url: URL) => void;
  onPrinterRequest?: (url: URL) => void;
}

const renderScreen = (options: StubOptions = {}) => {
  const rows = options.receipts ?? [
    receipt(8101, 'SYN-IB-0001', 8201, '2026-08-27T09:12:30Z'),
    receipt(8102, 'SYN-IB-0002', 8202, '2026-08-26T10:30:00Z'),
  ];
  const page = options.page ?? { page: 1, size: 20, total: rows.length };

  const user = userEvent.setup();
  const result = renderWithProviders(<PopMaterialLotLabelScreen />, {
    fetch: createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/logistics/inbound-receipts',
        respond: (request) => {
          options.onReceiptRequest?.(new URL(request.url));

          return options.receiptsFail === true
            ? jsonResponse({ message: '실패' }, { status: 500 })
            : jsonResponse({ items: rows, page });
        },
      },
      {
        match: (request) =>
          /\/logistics\/inbound-receipts\/\d+\/lines$/u.test(new URL(request.url).pathname),
        respond: () =>
          options.linesFail === true
            ? jsonResponse({ message: '실패' }, { status: 500 })
            : jsonResponse({
                items: options.lines ?? [line(8501, 8601, 500, true)],
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
              partner(8201, 'SYN-P-01', '합성 공급사 가'),
              partner(8202, 'SYN-P-02', '합성 공급사 나'),
            ],
            page: { page: 1, size: 20, total: 2 },
          }),
      },
    ]),
  });

  return { ...result, user };
};

describe('PopMaterialLotLabelScreen', () => {
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

  it('공급사를 식별자가 아니라 이름으로 보인다', async () => {
    renderScreen();

    expect(await screen.findByText('SYN-P-01 · 합성 공급사 가')).toBeInTheDocument();
  });

  it('입하일을 날짜까지만 보인다 — 시각을 넣을 가로 여유가 없다', async () => {
    renderScreen();

    expect(await screen.findByText('2026-08-27')).toBeInTheDocument();
    expect(screen.getByText('2026-08-26')).toBeInTheDocument();
  });

  /**
   * 문구가 있는지만이 아니라 **어디에 놓였는지**를 본다. 앞선 판은 이 문구를 `.field-note`에
   * 실었는데 그 클래스는 규범 4가 비활성 사유용으로 정의한 것이라 `max-width: 20rem`에 갇혀,
   * 가로 여유가 남는데도 두 줄로 접혔다(실기 확인에서 드러났다).
   */
  it('미부착 필터가 없다는 사실을 구획 전체에 걸리는 안내로 밝힌다', async () => {
    renderScreen();

    const notice = await screen.findByText(/부착 여부는 품목 줄에서 확인하세요/u);

    expect(notice.closest('.field-note')).toBeNull();
    expect(await screen.findByRole('status')).toHaveTextContent(/부착 여부는/u);
  });

  /**
   * ⭐ 고른 것이 **눈에 보여야** 한다. 앞선 판은 `aria-pressed`만 바꾸고 글자·모양을 그대로
   * 두어, 누른 사람이 골랐는지 알 수 없었다(실기 확인에서 드러났다).
   *
   * 입하 건을 고르면 **그 건의 품목 줄로 넘어간다** — 고른 결과가 화면 전체로 드러나므로
   * 이 자리에서는 넘어갔는지를 본다. 품목 줄의 선택 표시는 아래 묶음이 따로 본다.
   */
  it('입하 건을 고르면 그 건의 품목 줄로 넘어간다', async () => {
    const { user } = renderScreen();

    await user.click(await screen.findByRole('button', { name: 'SYN-IB-0001 선택' }));

    expect(await screen.findByRole('button', { name: '◀ 입하 건 목록' })).toBeInTheDocument();
  });

  it('선택 버튼이 터치 등급 치수를 갖는다', async () => {
    renderScreen();

    expect(await screen.findByRole('button', { name: 'SYN-IB-0001 선택' })).toHaveClass(
      'pop-touch',
    );
  });

  it('결과가 없으면 빈 상태를 보인다', async () => {
    renderScreen({ receipts: [], page: { page: 1, size: 20, total: 0 } });

    expect(await screen.findByText('발행할 입하 건이 없습니다.')).toBeInTheDocument();
  });

  it('결과는 있는데 이 쪽에 없으면 다른 안내를 보인다', async () => {
    renderScreen({ receipts: [], page: { page: 9, size: 20, total: 45 } });

    expect(await screen.findByText(/이전 쪽으로 돌아가세요/u)).toBeInTheDocument();
  });

  it('다음 쪽으로 옮기면 그 쪽을 조건에 싣는다', async () => {
    const seen: URL[] = [];
    const { user } = renderScreen({
      page: { page: 1, size: 1, total: 2 },
      receipts: [receipt(8101, 'SYN-IB-0001', 8201, '2026-08-27T09:12:30Z')],
      onReceiptRequest: (url) => seen.push(url),
    });

    await user.click(await screen.findByRole('button', { name: '다음 ▶' }));

    await waitFor(() => {
      expect(seen.some((url) => url.searchParams.get('page') === '2')).toBe(true);
    });
  });

  it('첫 쪽에서는 이전 버튼이 비활성이다', async () => {
    renderScreen({ page: { page: 1, size: 1, total: 2 } });

    expect(await screen.findByRole('button', { name: '◀ 이전' })).toBeDisabled();
  });

  it('조회에 실패하면 사유와 다시 시도 경로를 함께 보인다', async () => {
    renderScreen({ receiptsFail: true });

    expect(await screen.findByRole('alert')).toHaveTextContent('입하 목록을 불러오지 못했습니다.');
    expect(screen.getByRole('button', { name: '다시 불러오기' })).toBeInTheDocument();
  });

  it('조회에 실패하면 표를 그리지 않는다 — 빈 표는 「없음」으로 읽힌다', async () => {
    renderScreen({ receiptsFail: true });

    await screen.findByText('입하 목록을 불러오지 못했습니다.');

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  /**
   * **역할만 보면 부족하다** — 맨 `<h1>`도 `heading` 역할이라 그대로 통과한다(뮤테이션으로
   * 확인했다). 앞선 판이 맨 `<h1>`을 써서 이 화면만 제목이 브라우저 기본 크기로 나왔고,
   * 다른 화면과 크기가 어긋났다(실기에서 드러났다).
   *
   * 그래서 **서식이 입혀졌는지**를 본다. 디자인 시스템 머리는 제목에 자기 클래스를 주고,
   * 맨 `<h1>`은 클래스가 비어 있다. 해시된 클래스 이름 자체는 판마다 달라지므로 값으로
   * 단언하지 않는다.
   */
  it('화면 제목이 디자인 시스템 서식을 입는다 — 맨 h1은 다른 화면과 크기가 어긋난다', async () => {
    renderScreen();

    const heading = await screen.findByRole('heading', { name: '자재LOT 등록·라벨 발행' });

    expect(heading.className).not.toBe('');
  });

  it('쪽 이동 버튼이 터치 등급 치수를 갖는다', async () => {
    renderScreen({ page: { page: 1, size: 1, total: 2 } });

    const nav = await screen.findByRole('navigation', { name: '쪽 이동' });

    expect(within(nav).getByRole('button', { name: '다음 ▶' })).toHaveClass('pop-touch');
  });
});

describe('PopMaterialLotLabelScreen — 품목 줄과 발번 대상', () => {
  const selectReceipt = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: 'SYN-IB-0001 선택' }));
  };

  it('입하 건을 고르면 그 건의 품목 줄로 바뀐다 — 두 표를 세로로 쌓지 않는다', async () => {
    const { user } = renderScreen();

    await selectReceipt(user);

    expect(await screen.findByText('SYN-ITEM-01 · 합성 품목 가')).toBeInTheDocument();
    expect(screen.queryByText('IR-2026-000210')).not.toBeInTheDocument();
  });

  it('입하 건 목록으로 되돌아갈 길을 준다 — 들어가면 못 나오는 자리를 만들지 않는다', async () => {
    const { user } = renderScreen();

    await selectReceipt(user);
    await user.click(await screen.findByRole('button', { name: '◀ 입하 건 목록' }));

    expect(await screen.findByRole('button', { name: 'SYN-IB-0001 선택' })).toBeInTheDocument();
  });

  /** 걸러 내지 못하는 값이라 줄마다 보인다 — 검토 요청 omf-mes#245 ③. */
  it('부착 여부를 품목 줄에 보인다', async () => {
    const { user } = renderScreen();

    await selectReceipt(user);

    expect(await screen.findByText('미부착')).toBeInTheDocument();
  });

  it('공급사 LOT 이 붙어 온 품목은 발번 대상이 아님을 밝힌다 — 감추지 않는다', async () => {
    const { user } = renderScreen({ lines: [line(8501, 8601, 500, false)] });

    await selectReceipt(user);
    await user.click(
      await screen.findByRole('button', { name: 'SYN-ITEM-01 · 합성 품목 가 선택' }),
    );

    expect(await screen.findByText(/이 화면의 발번 대상이 아닙니다/u)).toBeInTheDocument();
  });

  it('품목을 고르면 발번 대상에 품목·수량·공급사가 뜬다', async () => {
    const { user } = renderScreen();

    await selectReceipt(user);
    await user.click(
      await screen.findByRole('button', { name: 'SYN-ITEM-01 · 합성 품목 가 선택' }),
    );

    const target = screen.getByLabelText('발번 대상');

    expect(await within(target).findByText('500 EA')).toBeInTheDocument();
    expect(await within(target).findByText('SYN-P-01 · 합성 공급사 가')).toBeInTheDocument();
    /**
     * ⛔ 상태를 보이지 않는다 — 계약의 `Lot.statusCode`는 품질 판정 축이고 스펙이 그린
     * 「Hold」는 다른 축(`lot_hold`)이다. `LotCreate`에 그 필드가 없어 화면이 보낼 수도
     * 없다. 어느 축의 어떤 값인지가 정해지기 전에 지어내지 않는다(omf-mes#245 ⑤).
     */
    expect(within(target).queryByText('Hold')).not.toBeInTheDocument();
  });

  it('고르기 전에는 무엇을 하면 되는지 말한다', async () => {
    renderScreen();

    expect(await screen.findByText('왼쪽에서 품목을 고르세요.')).toBeInTheDocument();
  });

  /** 다른 건의 품목이 남아 있으면 발번 대상이 엉뚱한 것을 가리킨다. */
  it('입하 건 선택을 풀면 고른 품목도 함께 풀린다', async () => {
    const { user } = renderScreen();

    await selectReceipt(user);
    await user.click(
      await screen.findByRole('button', { name: 'SYN-ITEM-01 · 합성 품목 가 선택' }),
    );
    await user.click(await screen.findByRole('button', { name: '◀ 입하 건 목록' }));

    expect(await screen.findByText('왼쪽에서 품목을 고르세요.')).toBeInTheDocument();
  });

  it('품목 조회에 실패하면 사유와 다시 시도 경로를 함께 보인다', async () => {
    const { user } = renderScreen({ linesFail: true });

    await selectReceipt(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('품목을 불러오지 못했습니다.');
  });
});

describe('PopMaterialLotLabelScreen — 프린터 상태', () => {
  it('머리에 프린터와 그 상태를 상시 보인다 — 인쇄가 안 될 때 가장 먼저 보는 자리다', async () => {
    renderScreen();

    expect(await screen.findByText('합성 라벨 프린터 가')).toBeInTheDocument();
    expect(screen.getByText('대기 중')).toBeInTheDocument();
  });

  /** 서버가 무엇을 보고 목록을 만드는지가 미결이라 비어 올 수 있다(착수 이슈 6항). */
  it('프린터가 한 대도 없으면 빈 상태를 그린다 — 오류로 다루지 않는다', async () => {
    renderScreen({ printers: [] });

    expect(await screen.findByText('사용할 수 있는 프린터가 없습니다.')).toBeInTheDocument();
  });

  it('프린터 조회가 실패해도 입하 목록은 그대로 쓴다 — 머리 하나가 화면을 막지 않는다', async () => {
    renderScreen({ printersFail: true });

    expect(await screen.findByText('프린터 상태를 확인할 수 없습니다.')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'SYN-IB-0001 선택' })).toBeInTheDocument();
  });

  /** 문서 유형 값 목록이 미확정이라 값을 실으면 목록이 통째로 비어 올 수 있다. */
  it('문서 유형으로 프린터를 거르지 않는다', async () => {
    const seen: URL[] = [];
    renderScreen({ onPrinterRequest: (url) => seen.push(url) });

    await waitFor(() => {
      expect(seen.length).toBeGreaterThan(0);
    });
    expect(seen[0]?.searchParams.has('documentTypeCode')).toBe(false);
  });
});
