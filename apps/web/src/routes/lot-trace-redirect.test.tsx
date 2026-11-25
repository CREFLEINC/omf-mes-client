import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { LotTraceLegacyRedirect } from '../screens/material-trace/legacy-redirect';
import { appRouter } from './index';

const Where = () => {
  const location = useLocation();
  return <p data-testid="where">{`${location.pathname}${location.search}`}</p>;
};

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/production/lot-trace" element={<LotTraceLegacyRedirect />} />
        <Route path="/production/material-trace" element={<Where />} />
        <Route path="/production/product-trace" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

/* 피처 015 FR-018 · SC-005 — W-02-09 옛 주소는 LOT 종류에 맞는 새 화면에서 그 LOT 을 골라 연다. */
describe('옛 주소 /production/lot-trace', () => {
  it('Q21 mlot + selected → 자재 기준 생산 추적 ?lot=', () => {
    renderAt('/production/lot-trace?mlot=ITEM-A%7C1&selected=201&from=2026-11-01');
    expect(screen.getByTestId('where')).toHaveTextContent('/production/material-trace?lot=201');
  });

  it('Q21 plot + selected → 제품 기준 역추적 ?lot=', () => {
    renderAt('/production/lot-trace?plot=P-1&selected=303');
    expect(screen.getByTestId('where')).toHaveTextContent('/production/product-trace?lot=303');
  });

  it('Q21 tab=backward&lot=번호 → 그 번호를 스캔한 것처럼 연다', () => {
    renderAt('/production/lot-trace?tab=backward&lot=P-1');
    expect(screen.getByTestId('where')).toHaveTextContent('/production/product-trace?q=P-1');
  });

  it('Q21 LOT 이 정해지지 않은 주소는 자재 기준 최근 목록', () => {
    renderAt('/production/lot-trace?from=2026-11-01&to=2026-11-07');
    expect(screen.getByTestId('where').textContent).toBe('/production/material-trace');
  });

  it('라우트 표에 새 두 화면과 옛 주소 넘기기가 있다', () => {
    const paths = (appRouter.routes[0]?.children ?? []).map((route) => route.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'production/material-trace',
        'production/product-trace',
        'production/lot-trace',
      ]),
    );
  });
});
