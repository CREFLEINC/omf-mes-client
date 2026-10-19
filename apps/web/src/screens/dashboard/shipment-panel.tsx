import { Icon, Skeleton } from '@crefle/web-ui';
import type { DashboardShipment } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { Link } from 'react-router';

import { formatFigure } from './types';
import { EmptyLine, Panel } from './viz';

const t = messages.dashboard.shipment;

/** 이동 대상 화면(웹 화면 목록의 주소 그대로). */
export const SHIPMENT_CONFIRM_PATH = '/shipment/shipment-confirm';
export const SHIPMENT_SCHEDULE_PATH = '/shipment/shipment-schedule';

export interface ShipmentCell {
  key: 'today' | 'waiting' | 'next' | 'overdue';
  label: string;
  value: string;
  unit?: string;
  /** 값 바로 옆의 짧은 보조(「남은 200 EA」) — 값과 함께 먼저 읽혀야 하는 것. */
  valueNote?: string;
  /**
   * 보조 줄 조각 — 「번호 · 고객 · 남은 수량」처럼 나눠 둔다. 조각 안에서는 줄을 바꾸지 않는다(원칙 a — 고객명
   * 「Cong Nghi?p」이 「?」 뒤에서 끊겼다). 줄은 조각 사이에서만 바뀐다.
   */
  sub?: readonly string[];
  tone?: 'warning';
  /** 눌러서 갈 화면. 맞는 화면이 없으면 `null` — 엉뚱한 화면으로 보내지 않는다. */
  path: string | null;
}

/** 출하 예정 목록(W-04-02)을 그 기간으로 연다 — 그 화면이 주소에서 읽는 키(`shipDateFrom` · `shipDateTo`). */
const schedulePath = (from: string, to: string): string =>
  `${SHIPMENT_SCHEDULE_PATH}?${new URLSearchParams({ shipDateFrom: from, shipDateTo: to }).toString()}`;

/**
 * 출하 현황 네 칸(사용자 지시 2026-10-16 — 2×2 요약 · 칸 클릭 이동).
 *
 * 이동:
 * - 오늘 출하 실적 → 출하 확정·취소(W-04-12). 그 화면은 주소 조건을 읽지 않아 그냥 연다.
 * - 출하 대기 → 출하 예정 목록, **가장 이른 대기 요청일 ~ 기준일**(서버 `oldestWaitingShipDate`) — 대시보드
 *   건수와 같은 범위가 열린다. 그 화면은 시작일이 필수라, 값이 없으면(대기 0건 · 서버 배포 전) 링크를 두지 않는다.
 * - 다음 출하 → 출하 예정 목록 그 요청일 하루.
 * - 납기 지연 → 수주 줄 납기를 보는 화면이 없어 링크 없음.
 * 공장은 두 화면 모두 주소로 받지 않아 넘기지 않는다.
 *
 * `baseDate` — 응답이 알려 준 기준일(YYYY-MM-DD). 화면이 「오늘」을 계산하지 않는다.
 */
export const toShipmentCells = (
  view: DashboardShipment,
  baseDate: string | null,
): ShipmentCell[] => {
  const next = view.nextShipment;
  const oldest = view.oldestWaitingShipDate ?? null;

  return [
    {
      key: 'today',
      label: t.todayShipped,
      value: formatFigure(view.todayShippedQty),
      unit: t.qtyUnit,
      sub: [t.todayShipmentCount(formatFigure(view.todayShipmentCount))],
      path: SHIPMENT_CONFIRM_PATH,
    },
    {
      key: 'waiting',
      label: t.waiting,
      value: formatFigure(view.waitingRequestCount),
      unit: t.countUnit,
      sub: [t.waitingNote],
      path: oldest === null || baseDate === null ? null : schedulePath(oldest, baseDate),
    },
    next === null
      ? { key: 'next', label: t.next, value: t.nextNone, path: null }
      : {
          key: 'next',
          label: t.next,
          /* 날짜는 `yyyy-MM-dd`(⭐ 관리웹 날짜 표기 통일 · 사용자 지시 2026-10-19). */
          value: next.requestedShipDate,
          /*
           * ⭐ 수량은 요청 수량이 아니라 **남은 수량**이다(규격 보정 2026-10-16). 날짜와 남은 수량을 먼저 보이고
           * (값 줄), 요청 번호 · 고객은 보조 줄로(사용자 지시 2026-10-16).
           */
          valueNote: t.remainingQty(`${formatFigure(next.requestedQty)} ${t.qtyUnit}`),
          sub: [next.shipmentRequestNo, next.customerName ?? t.customerUnknown],
          path: schedulePath(next.requestedShipDate, next.requestedShipDate),
        },
    {
      key: 'overdue',
      label: t.overdue,
      value: formatFigure(view.overdueCount),
      unit: t.countUnit,
      sub: [t.overdueNote],
      tone: view.overdueCount > 0 ? 'warning' : undefined,
      path: null,
    },
  ];
};

const CellBody = ({ cell }: { cell: ShipmentCell }) => (
  <>
    <span className="dash-mini-label">{cell.label}</span>
    <span className="dash-mini-value-row">
      <span
        className={
          cell.tone === undefined ? 'dash-mini-value' : 'dash-mini-value dash-tone-warning'
        }
      >
        {cell.value}
      </span>
      {cell.unit !== undefined && <span className="dash-kpi-unit">{cell.unit}</span>}
      {cell.valueNote !== undefined && (
        <span className="dash-mini-value-note">{cell.valueNote}</span>
      )}
    </span>
    {cell.sub !== undefined && (
      <span className="dash-mini-sub">
        {/* 조각이 하나면 설명 문장이다 — 단어 단위로 줄을 바꾼다. 여럿이면 번호 · 이름 조각이라 붙여 둔다. */}
        {cell.sub.length === 1
          ? cell.sub[0]
          : cell.sub.map((part, index) => (
              <span key={part}>
                {index > 0 && ' · '}
                <span className="dash-nowrap">{part}</span>
              </span>
            ))}
      </span>
    )}
  </>
);

export interface ShipmentPanelProps {
  view: DashboardShipment | null;
  /** 응답이 알려 준 기준일. 아직 없으면 `null`. */
  baseDate: string | null;
  isLoading: boolean;
  /** 첫 조회가 실패해 보일 값이 없다. 재시도는 화면 위 오류 배너가 맡는다. */
  isFailed: boolean;
  /** 이 사용자가 그 화면을 볼 수 있는가(사이드바와 같은 판정). 못 보면 링크 없이 보인다. */
  allows: (path: string) => boolean;
}

/** 링크 주소에서 화면 주소만 — 권한은 화면 단위로 판정한다. */
const screenPathOf = (path: string): string => path.split('?')[0] ?? path;

/**
 * 출하 현황(omf-all-around#114) — 대시보드 탭 오른쪽 열(⭐ 사용자 지시 2026-10-16, 2×2 요약). summary 의
 * `shipment` 섹션이라 자동 갱신 · 「갱신」 · 공장 전환이 그대로 걸린다. 칸 전체가 링크다 — 키보드로도
 * 닿고, 칸의 글이 곧 링크 이름이 된다.
 */
export const ShipmentPanel = ({
  view,
  baseDate,
  isLoading,
  isFailed,
  allows,
}: ShipmentPanelProps) => (
  <Panel title={messages.dashboard.panes.shipment} tag={t.tagToday}>
    {isLoading ? (
      <Skeleton variant="rect" height="8rem" />
    ) : view === null ? (
      <EmptyLine live text={isFailed ? t.failed : t.absent} />
    ) : (
      <div className="dash-mini-grid">
        {toShipmentCells(view, baseDate).map((cell) => {
          const path = cell.path !== null && allows(screenPathOf(cell.path)) ? cell.path : null;

          return path === null ? (
            <div key={cell.key} className="dash-mini-cell">
              <CellBody cell={cell} />
            </div>
          ) : (
            <Link key={cell.key} className="dash-mini-cell dash-mini-link" to={path}>
              <CellBody cell={cell} />
              <Icon name="chevron_right" size={18} className="dash-mini-arrow" aria-hidden="true" />
            </Link>
          );
        })}
      </div>
    )}
  </Panel>
);
