import { Skeleton } from '@crefle/web-ui';
import type { DashboardShipment } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { shortDate } from './quality';
import { formatFigure } from './types';
import { EmptyLine, Panel, StatusList, type StatusItem } from './viz';

const t = messages.dashboard.shipment;

export interface ShipmentPanelProps {
  view: DashboardShipment | null;
  isLoading: boolean;
  /** 첫 조회가 실패해 보일 값이 없다. 재시도는 화면 위 오류 배너가 맡는다. */
  isFailed: boolean;
}

/** 출하 현황 네 줄. 납기 지연이 있으면 그 줄만 warning — 0에 색을 주면 늘 문제가 있는 것처럼 보인다. */
export const toShipmentItems = (view: DashboardShipment): StatusItem[] => {
  const next = view.nextShipment;

  return [
    {
      key: 'today',
      label: t.todayShipped,
      note: t.todayShipmentCount(formatFigure(view.todayShipmentCount)),
      value: formatFigure(view.todayShippedQty),
      unit: t.qtyUnit,
    },
    {
      key: 'waiting',
      label: t.waiting,
      note: t.waitingNote,
      value: formatFigure(view.waitingRequestCount),
      unit: t.countUnit,
    },
    next === null
      ? { key: 'next', label: t.next, value: t.nextNone }
      : {
          key: 'next',
          label: t.next,
          /* ⭐ 수량은 요청 수량이 아니라 **남은 수량**이다(규격 보정 2026-10-16). */
          note: [
            next.shipmentRequestNo,
            next.customerName ?? t.customerUnknown,
            t.remainingQty(`${formatFigure(next.requestedQty)} ${t.qtyUnit}`),
          ].join(' · '),
          value: shortDate(next.requestedShipDate),
        },
    {
      key: 'overdue',
      label: t.overdue,
      note: t.overdueNote,
      value: formatFigure(view.overdueCount),
      unit: t.countUnit,
      tone: view.overdueCount > 0 ? 'warning' : undefined,
    },
  ];
};

/**
 * 출하 현황(omf-all-around#114) — 대시보드 탭 오른쪽 열, 시안의 「제품군별」 자리
 * (⭐ 사용자 지시 2026-10-16, 시안 v1.3 기준 재구성). summary 의 `shipment` 섹션이라 자동 갱신 ·
 * 「갱신」 · 공장 전환이 그대로 걸린다.
 */
export const ShipmentPanel = ({ view, isLoading, isFailed }: ShipmentPanelProps) => (
  <Panel title={messages.dashboard.panes.shipment} tag={t.tagToday}>
    {isLoading ? (
      <Skeleton variant="rect" height="10rem" />
    ) : view === null ? (
      <EmptyLine live text={isFailed ? t.failed : t.absent} />
    ) : (
      <StatusList items={toShipmentItems(view)} />
    )}
  </Panel>
);
