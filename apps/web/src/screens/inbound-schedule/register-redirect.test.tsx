import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { OverReceiptSplitRedirect } from './register-redirect';

/** 옮겨 간 자리의 주소를 그대로 글자로 낸다. */
const Landing = () => {
  const location = useLocation();

  return <p>{`${location.pathname}${location.search}`}</p>;
};

const landAt = async (entry: string): Promise<string> => {
  const router = createMemoryRouter(
    [
      { path: '/logistics/over-receipt-split', element: <OverReceiptSplitRedirect /> },
      { path: '/logistics/inbound-schedule', element: <Landing /> },
    ],
    { initialEntries: [entry] },
  );
  render(<RouterProvider router={router} />);

  return (await screen.findByText(/^\/logistics\/inbound-schedule/)).textContent ?? '';
};

/*
 * 옛 「초과 입하 분리」 주소 — 입하 등록은 입고 관리의 라인 표에서 바로 한다(사용자 지시 2026-10-24).
 * 즐겨찾기·공유한 주소가 죽지 않고, 발주를 고른 주소면 그 발주를 고른 채 선다.
 */
describe('OverReceiptSplitRedirect — 옛 주소를 입고 관리로 옮긴다', () => {
  it('발주를 고른 주소면 그 발주를 고른 채로 간다', async () => {
    expect(await landAt('/logistics/over-receipt-split?q=SAMPLE-PO-0001&open=0&po=7101')).toBe(
      '/logistics/inbound-schedule?po=7101',
    );
  });

  it.each(['/logistics/over-receipt-split', '/logistics/over-receipt-split?po=abc'])(
    '고른 발주가 없으면(%s) 입하 예정 조회로만 간다',
    async (entry) => {
      expect(await landAt(entry)).toBe('/logistics/inbound-schedule');
    },
  );
});
