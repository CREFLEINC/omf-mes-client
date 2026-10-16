import { EmptyState, Skeleton, StatCard } from '@crefle/web-ui';
import type { DashboardShipment } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { formatFigure } from './types';

const t = messages.dashboard.shipment;

export interface ShipmentPanelProps {
  view: DashboardShipment | null;
  isLoading: boolean;
  /** 첫 조회가 실패해 보일 값이 없다. 재시도는 화면 위 오류 배너가 맡는다. */
  isFailed: boolean;
}

/**
 * 출하 현황(omf-all-around#114) — 오늘 출하 실적 · 출하 대기 · 다음 출하 · 납기 지연.
 *
 * ⭐ **집계와 같은 응답에 온다**(summary 의 `shipment` 섹션) — 자동 갱신 · 「갱신」 · 공장 전환이 그대로 걸린다.
 *
 * ⭐ 다음 출하의 수량은 **남은 수량**이다(규격 보정 2026-10-16) — 요청 수량으로 읽히지 않게 라벨에 적는다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const ShipmentPanel = ({ view, isLoading, isFailed }: ShipmentPanelProps) => {
  if (isLoading) {
    return (
      <div className="kpi-grid" aria-hidden="true">
        {[0, 1, 2, 3].map((slot) => (
          <Skeleton key={slot} variant="rect" height="6.5rem" />
        ))}
      </div>
    );
  }

  if (view === null) {
    return (
      <EmptyState
        size="sm"
        live
        title={t.absentTitle}
        description={isFailed ? t.failed : t.absent}
      />
    );
  }

  const next = view.nextShipment;

  return (
    <div className="kpi-grid">
      <StatCard
        label={t.todayShipped}
        value={formatFigure(view.todayShippedQty)}
        unit={t.qtyUnit}
        bordered
      >
        <span className="kpi-card-note">
          <span>{t.todayShipmentCount(formatFigure(view.todayShipmentCount))}</span>
        </span>
      </StatCard>
      <StatCard
        label={t.waiting}
        value={formatFigure(view.waitingRequestCount)}
        unit={t.countUnit}
        bordered
      >
        <span className="kpi-card-note">
          <span>{t.waitingNote}</span>
        </span>
      </StatCard>
      <StatCard label={t.next} value={next === null ? t.nextNone : next.shipmentRequestNo} bordered>
        {next !== null && (
          <span className="kpi-card-note">
            <span>{next.customerName ?? t.customerUnknown}</span>
            <span>{t.nextDate(next.requestedShipDate)}</span>
            <span>{t.remainingQty(`${formatFigure(next.requestedQty)} ${t.qtyUnit}`)}</span>
          </span>
        )}
      </StatCard>
      <StatCard
        label={t.overdue}
        value={formatFigure(view.overdueCount)}
        unit={t.countUnit}
        status={view.overdueCount > 0 ? 'warning' : undefined}
        statusLabel={view.overdueCount > 0 ? t.overdueStatus : undefined}
        bordered
      >
        <span className="kpi-card-note">
          <span>{t.overdueNote}</span>
        </span>
      </StatCard>
    </div>
  );
};
