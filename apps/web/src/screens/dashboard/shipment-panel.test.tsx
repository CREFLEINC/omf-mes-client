import type { DashboardShipment } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ShipmentPanel } from './shipment-panel';

const t = messages.dashboard.shipment;

const shipment = (overrides: Partial<DashboardShipment> = {}): DashboardShipment => ({
  todayShippedQty: 4200,
  todayShipmentCount: 3,
  waitingRequestCount: 5,
  nextShipment: {
    shipmentRequestId: 1,
    shipmentRequestNo: 'SR-1',
    customerName: '고객 A',
    requestedShipDate: '2026-10-17',
    requestedQty: 1500,
  },
  overdueCount: 1,
  ...overrides,
});

describe('ShipmentPanel', () => {
  it('오늘 출하 실적 · 출하 대기 · 다음 출하 · 납기 지연을 서버 값으로 보인다', () => {
    render(<ShipmentPanel view={shipment()} isLoading={false} isFailed={false} />);

    expect(screen.getByText('4,200')).toBeInTheDocument();
    expect(screen.getByText(t.todayShipmentCount('3'))).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('SR-1')).toBeInTheDocument();
    expect(screen.getByText(t.nextDate('2026-10-17'))).toBeInTheDocument();
    /* 다음 출하 수량은 «남은 수량»이다(규격 보정). */
    expect(screen.getByText(t.remainingQty('1,500 EA'))).toBeInTheDocument();
    expect(screen.getByRole('img', { name: t.overdueStatus })).toBeInTheDocument();
  });

  it('다음 출하가 없으면 「예정 없음」, 지연이 0이면 경고를 두지 않는다', () => {
    render(
      <ShipmentPanel
        view={shipment({ nextShipment: null, overdueCount: 0 })}
        isLoading={false}
        isFailed={false}
      />,
    );

    expect(screen.getByText(t.nextNone)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: t.overdueStatus })).not.toBeInTheDocument();
  });

  it('섹션이 오지 않음과 첫 조회 실패를 가른다', () => {
    const { rerender } = render(<ShipmentPanel view={null} isLoading={false} isFailed={false} />);
    expect(screen.getByText(t.absent)).toBeInTheDocument();

    rerender(<ShipmentPanel view={null} isLoading={false} isFailed />);
    expect(screen.getByText(t.failed)).toBeInTheDocument();
  });
});
