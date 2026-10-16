import type { DashboardShipment } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ShipmentPanel, toShipmentItems } from './shipment-panel';

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
  it('오늘 출하 실적 · 출하 대기 · 다음 출하(요청일 · 번호 · 고객 · 남은 수량) · 납기 지연', () => {
    render(<ShipmentPanel view={shipment()} isLoading={false} isFailed={false} />);

    expect(screen.getByText('4,200')).toBeInTheDocument();
    expect(screen.getByText(t.todayShipmentCount('3'))).toBeInTheDocument();
    expect(screen.getByText('10-17')).toBeInTheDocument();
    /* 다음 출하 수량은 «남은 수량»이다(규격 보정). */
    expect(screen.getByText(`SR-1 · 고객 A · ${t.remainingQty('1,500 EA')}`)).toBeInTheDocument();
  });

  it('납기 지연이 있을 때만 경고 색 — 0이면 색을 주지 않는다', () => {
    expect(toShipmentItems(shipment()).find((item) => item.key === 'overdue')?.tone).toBe(
      'warning',
    );
    expect(
      toShipmentItems(shipment({ overdueCount: 0 })).find((item) => item.key === 'overdue')?.tone,
    ).toBeUndefined();
  });

  it('다음 출하가 없으면 「예정 없음」', () => {
    render(
      <ShipmentPanel view={shipment({ nextShipment: null })} isLoading={false} isFailed={false} />,
    );

    expect(screen.getByText(t.nextNone)).toBeInTheDocument();
  });

  it('섹션이 오지 않음과 첫 조회 실패를 가른다', () => {
    const { rerender } = render(<ShipmentPanel view={null} isLoading={false} isFailed={false} />);
    expect(screen.getByText(t.absent)).toBeInTheDocument();

    rerender(<ShipmentPanel view={null} isLoading={false} isFailed />);
    expect(screen.getByText(t.failed)).toBeInTheDocument();
  });
});
