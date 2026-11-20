import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { ShipmentConfirmRedirect } from '../screens/shipment-schedule/shipment-confirm-redirect';

const Where = () => {
  const location = useLocation();
  return <p data-testid="where">{`${location.pathname}${location.search}`}</p>;
};

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/shipment/shipment-confirm" element={<ShipmentConfirmRedirect />} />
        <Route path="/shipment/shipment-schedule" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

/* 피처 012 FR-023 · R-7 — 옛 출하 내역 주소는 출하 예정 목록으로 넘어가고, 출하 · 결재 번호를 그대로 싣는다. */
describe('옛 주소 /shipment/shipment-confirm', () => {
  it('US5-3·Q15 shipmentId 를 실어 W-04-02 로 넘긴다', () => {
    renderAt('/shipment/shipment-confirm?shipmentId=7701');

    expect(screen.getByTestId('where')).toHaveTextContent('/shipment/shipment-schedule?shipmentId=7701');
  });

  it('US5-3 approvalRequestId 도 함께 싣고, 다른 조건 · 숫자 아닌 값은 버린다', () => {
    renderAt('/shipment/shipment-confirm?approvalRequestId=9001&shipmentId=x&erp=SENT');

    expect(screen.getByTestId('where')).toHaveTextContent(
      '/shipment/shipment-schedule?approvalRequestId=9001',
    );
  });

  it('조건이 없으면 W-04-02 첫 화면으로 간다', () => {
    renderAt('/shipment/shipment-confirm');

    expect(screen.getByTestId('where').textContent).toBe('/shipment/shipment-schedule');
  });
});
