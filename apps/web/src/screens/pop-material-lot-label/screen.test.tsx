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
   * 두어, 누른 사람이 골랐는지 알 수 없었다(실기 확인에서 드러났다). 그래서 이 검사는
   * 속성이 아니라 **라벨이 바뀌는 것**을 본다 — 속성만 보면 같은 결함을 다시 통과시킨다.
   */
  it('건을 고르면 버튼 글자가 「선택됨」으로 바뀐다 — 보이지 않는 선택은 선택이 아니다', async () => {
    const { user } = renderScreen();

    const selectButton = await screen.findByRole('button', { name: 'SYN-IB-0001 선택' });
    expect(selectButton).toHaveTextContent('선택');

    await user.click(selectButton);

    const selected = await screen.findByRole('button', { name: 'SYN-IB-0001 선택 해제' });
    expect(selected).toHaveTextContent('선택됨');
    expect(selected).toHaveAttribute('aria-pressed', 'true');
  });

  it('고른 건을 다시 누르면 해제된다 — 무를 수단이 없으면 갇힌다', async () => {
    const { user } = renderScreen();

    await user.click(await screen.findByRole('button', { name: 'SYN-IB-0001 선택' }));
    await user.click(await screen.findByRole('button', { name: 'SYN-IB-0001 선택 해제' }));

    expect(await screen.findByRole('button', { name: 'SYN-IB-0001 선택' })).toBeInTheDocument();
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
