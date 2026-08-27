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

interface StubOptions {
  receipts?: ReturnType<typeof receipt>[];
  page?: { page: number; size: number; total: number };
  receiptsFail?: boolean;
  onReceiptRequest?: (url: URL) => void;
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

  it('미부착 필터가 없다는 사실을 화면이 밝힌다 — 보이는 것을 확정처럼 두지 않는다', async () => {
    renderScreen();

    expect(await screen.findByText(/부착 여부는 품목 줄에서 확인하세요/u)).toBeInTheDocument();
  });

  it('건을 고르면 그 줄이 눌린 상태가 된다', async () => {
    const { user } = renderScreen();

    const row = await screen.findByRole('button', { name: 'SYN-IB-0001' });
    expect(row).toHaveAttribute('aria-pressed', 'false');

    await user.click(row);

    expect(row).toHaveAttribute('aria-pressed', 'true');
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

    expect(await screen.findByText('입하 목록을 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 불러오기' })).toBeInTheDocument();
  });

  it('조회에 실패하면 표를 그리지 않는다 — 빈 표는 「없음」으로 읽힌다', async () => {
    renderScreen({ receiptsFail: true });

    await screen.findByText('입하 목록을 불러오지 못했습니다.');

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('쪽 이동 버튼이 터치 등급 치수를 갖는다', async () => {
    renderScreen({ page: { page: 1, size: 1, total: 2 } });

    const nav = await screen.findByRole('navigation', { name: '쪽 이동' });

    expect(within(nav).getByRole('button', { name: '다음 ▶' })).toHaveClass('pop-touch');
  });
});
