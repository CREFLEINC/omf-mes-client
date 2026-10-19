import type { DashboardShipment } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import {
  SHIPMENT_CONFIRM_PATH,
  SHIPMENT_SCHEDULE_PATH,
  ShipmentPanel,
  toShipmentCells,
} from './shipment-panel';

const t = messages.dashboard.shipment;

const shipment = (overrides: Partial<DashboardShipment> = {}): DashboardShipment => ({
  todayShippedQty: 4200,
  todayShipmentCount: 3,
  waitingRequestCount: 5,
  oldestWaitingShipDate: '2026-10-04',
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

const renderPanel = (
  view: DashboardShipment | null,
  allows: (path: string) => boolean = () => true,
  isFailed = false,
) =>
  render(
    <MemoryRouter>
      <ShipmentPanel
        view={view}
        baseDate="2026-10-16"
        isLoading={false}
        isFailed={isFailed}
        allows={allows}
      />
    </MemoryRouter>,
  );

const pathOf = (key: string, view = shipment()) =>
  toShipmentCells(view, '2026-10-16').find((cell) => cell.key === key)?.path;

describe('ShipmentPanel — 2×2 요약 · 칸 이동(사용자 지시 2026-10-16)', () => {
  it('네 칸 — 이름 · 핵심 수치 · 보조 한 줄. 다음 출하는 요청일이 수치, 남은 수량은 보조', () => {
    renderPanel(shipment());

    expect(screen.getByText('4,200')).toBeInTheDocument();
    expect(screen.getByText(t.todayShipmentCount('3'))).toBeInTheDocument();
    expect(screen.getByText('10-17')).toBeInTheDocument();
    /* 보조 줄은 조각으로 — 조각 안에서는 줄을 바꾸지 않는다. */
    expect(screen.getByText('고객 A')).toHaveClass('dash-nowrap');
    expect(screen.getByText(t.remainingQty('1,500 EA'))).toBeInTheDocument();
  });

  it('이동 주소 — 확정(조건 없음) · 대기(가장 이른 대기 요청일~기준일) · 다음 출하(그날) · 지연(없음)', () => {
    expect(pathOf('today')).toBe(SHIPMENT_CONFIRM_PATH);
    expect(pathOf('waiting')).toBe(
      `${SHIPMENT_SCHEDULE_PATH}?shipDateFrom=2026-10-04&shipDateTo=2026-10-16`,
    );
    expect(pathOf('next')).toBe(
      `${SHIPMENT_SCHEDULE_PATH}?shipDateFrom=2026-10-17&shipDateTo=2026-10-17`,
    );
    expect(pathOf('overdue')).toBeNull();
  });

  it('가장 이른 대기 요청일이 없으면(대기 0건 · 서버 배포 전) 출하 대기에는 링크가 없다', () => {
    expect(pathOf('waiting', shipment({ oldestWaitingShipDate: null }))).toBeNull();
    expect(pathOf('waiting', shipment({ oldestWaitingShipDate: undefined }))).toBeNull();
  });

  it('권한이 있으면 칸 전체가 링크, 없으면 링크 없이 같은 내용', () => {
    const { unmount } = renderPanel(shipment());
    expect(screen.getAllByRole('link')).toHaveLength(3);
    unmount();

    renderPanel(shipment(), () => false);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByText('4,200')).toBeInTheDocument();
  });

  it('납기 지연이 있을 때만 경고 색', () => {
    expect(toShipmentCells(shipment(), null).find((c) => c.key === 'overdue')?.tone).toBe(
      'warning',
    );
    expect(
      toShipmentCells(shipment({ overdueCount: 0 }), null).find((c) => c.key === 'overdue')?.tone,
    ).toBeUndefined();
  });

  it('섹션이 오지 않음과 첫 조회 실패를 가른다', () => {
    const { unmount } = renderPanel(null);
    expect(screen.getByText(t.absent)).toBeInTheDocument();
    unmount();

    renderPanel(null, () => true, true);
    expect(screen.getByText(t.failed)).toBeInTheDocument();
  });
});
