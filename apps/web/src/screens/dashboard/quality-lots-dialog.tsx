import { Button, Dialog, Skeleton, type ChipStatus } from '@crefle/web-ui';
import type { DashboardQualityLotItem, DashboardQualityLotStatus } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useContext } from 'react';

import { formatPlantDateTime } from '../../patterns/plant-time';
import { FilterQueryContext } from './period';
import { useDashboardQualityLots } from './queries';
import { formatFigure } from './types';

const t = messages.dashboard.quality;

/** 상태별 이름 · 점 색 · 단위 — 「현재 현황」 줄과 같은 말을 쓴다. */
export const QUALITY_LOT_STATUS: Record<
  DashboardQualityLotStatus,
  { label: string; tone: ChipStatus; cases: boolean }
> = {
  INSPECTION_HELD: { label: t.heldLots, tone: 'warning', cases: false },
  RECEIPT_HOLD: { label: t.receiptHold, tone: 'warning', cases: false },
  PQC_PENDING: { label: t.pendingLots, tone: 'idle', cases: false },
  NC_OPEN: { label: t.ncOpen, tone: 'error', cases: true },
};

/** 줄의 보조 정보 — 상태마다 있는 값만(검사 구분 · 상대 · 호기 · 업무 번호 · 설명), 없으면 빈 줄. */
export const lotInfoOf = (item: DashboardQualityLotItem): string =>
  [item.inspectionType, item.counterpartName, item.equipmentCode, item.refNo, item.detail]
    .filter((part): part is string => part !== null && part.trim() !== '')
    .join(' · ');

const qtyOf = (item: DashboardQualityLotItem): string =>
  item.qty === null
    ? t.rateNone
    : `${formatFigure(item.qty)}${item.unitCode === null ? '' : ` ${item.unitCode}`}`;

/**
 * 「현재 현황」 상태별 LOT 목록 창(⭐ 사용자 결정 2026-10-19 「서버 추가 + 팝업」). 대시보드 탭 「외 n대」 창과 같은
 * 목록형 원칙 — 카드가 아니라 줄 구분선 목록, 본문만 스크롤, 좁으면 줄을 내린다. 머리 = 상태 이름 + 건수
 * (`totalCount` — 카드 숫자와 같은 정의), 줄 = LOT 번호(없으면 「LOT 번호 없음」) · 품목 / 상세 / 수량 · 시각.
 * 서버가 200건까지만 주면 「전체 n건 중 200건 표시」. 이동 링크 · 새 동작은 없다.
 */
export const QualityLotsDialog = ({
  status,
  inspectionType = null,
  onClose,
}: {
  status: DashboardQualityLotStatus | null;
  /** 검사 보류를 한 검사 유형으로 좁힌다 — IQC 탭(사용자 지시 2026-10-19). */
  inspectionType?: 'IQC' | 'PQC' | 'OQC' | null;
  onClose: () => void;
}) => {
  const query = useContext(FilterQueryContext);
  const lots = useDashboardQualityLots(status, query, inspectionType);
  const meta = status === null ? null : QUALITY_LOT_STATUS[status];
  const data = lots.data;
  const count = (value: number): string =>
    meta?.cases === true
      ? t.lots.countCases(formatFigure(value))
      : t.lots.countLots(formatFigure(value));

  const body = (() => {
    if (lots.isPending) {
      return (
        <div className="dash-lots-state dash-lots-loading" aria-live="polite">
          <span>{t.lots.loading}</span>
          <Skeleton variant="rect" height="6rem" />
        </div>
      );
    }
    if (lots.isError || data === undefined) {
      return (
        <div className="dash-lots-state" role="alert">
          <span>{t.lots.failed}</span>
          <Button
            variant="outlined"
            size="sm"
            onClick={() => {
              void lots.refetch();
            }}
          >
            {messages.common.retry}
          </Button>
        </div>
      );
    }
    if (data.items.length === 0) {
      return <p className="dash-lots-state">{t.lots.empty}</p>;
    }

    return (
      <>
        {data.totalCount > data.items.length && (
          <p className="dash-lots-truncated">
            {t.lots.truncated(formatFigure(data.totalCount), formatFigure(data.items.length))}
          </p>
        )}
        <div className="dash-lots-list">
          <div className="dash-lots-colhead" aria-hidden="true">
            <span>{t.lots.lotColumn}</span>
            <span>{t.lots.infoColumn}</span>
            <span>{t.lots.qtyColumn}</span>
          </div>
          <ul aria-label={meta === null ? undefined : t.lots.listLabel(meta.label)}>
            {data.items.map((item) => (
              <li key={item.key} className="dash-lots-row">
                <span className="dash-lots-name">
                  <span
                    className={
                      item.lotNo === null ? 'dash-lots-lot dash-lots-lot-none' : 'dash-lots-lot'
                    }
                  >
                    {item.lotNo ?? t.lots.noLot}
                  </span>
                  <span className="dash-lots-item">
                    {item.itemCode} {item.itemName}
                  </span>
                </span>
                <span className="dash-lots-info">{lotInfoOf(item)}</span>
                <span className="dash-lots-qty">
                  <span className="dash-lots-qty-value">{qtyOf(item)}</span>
                  <time className="dash-lots-time" dateTime={item.occurredAt}>
                    {formatPlantDateTime(item.occurredAt) ?? item.occurredAt}
                  </time>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </>
    );
  })();

  return (
    <Dialog
      open={status !== null}
      onClose={onClose}
      title={
        meta === null ? undefined : (
          <span className="dash-detail-head">
            <span className="dash-detail-head-row">
              <span className={`dash-dot dash-dot-${meta.tone}`} aria-hidden="true" />
              {meta.label}
            </span>
            {data !== undefined && (
              <span className="dash-detail-sub">
                {/* LOT 수 · 기록 건수(사용자 결정 2026-10-19) — 서버가 주지 않으면(이전 서버) 기존 건수만. */}
                {meta?.cases !== true &&
                data.lotCount !== undefined &&
                data.recordCount !== undefined
                  ? t.lots.countLotsRecords(
                      formatFigure(data.lotCount),
                      formatFigure(data.recordCount),
                    )
                  : count(data.totalCount)}
              </span>
            )}
          </span>
        )
      }
      size="md"
      className="dash-lots-dialog"
    >
      {status !== null && body}
    </Dialog>
  );
};
