import { Button, Skeleton, StatCard } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { formatCount, formatDecimal, formatDuration, type DowntimeSummaryView } from './types';

const t = messages.downtimeSummary;

interface FigureProps {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  action?: ReactNode;
}

/**
 * 요약 칸 하나. 값 아래에 **무엇이 빠졌는지**를 적을 자리를 항상 갖는다 — 이 화면의 숫자는
 * 대부분 무언가를 빼고 센 값이라, 적을 자리가 없으면 사용자가 합계를 전부로 읽는다.
 */
const Figure = ({ label, value, unit, note, action }: FigureProps) => (
  <StatCard label={label} value={value} unit={unit} bordered>
    {note === undefined && action === undefined ? null : (
      <span className="kpi-card-note">
        {note === undefined ? null : <span>{note}</span>}
        {action}
      </span>
    )}
  </StatCard>
);

export interface SummaryPanelProps {
  view: DowntimeSummaryView | null;
  isLoading: boolean;
  onOpenIntervals: (kind: 'open' | 'overlapping') => void;
}

/**
 * 집계 요약.
 *
 * ⛔ **설비종합효율을 그리지 않는다** — 세 항의 소유가 세 도메인으로 갈려 이 화면이 맡을 수
 * 없다. 시간가동률까지만 내고 그 사실을 화면에 적는다.
 *
 * ⭐ **빠진 것을 숫자로 보인다.** 열린 구간·겹친 구간·설비 미귀속 작업은 전부 「합계에 이렇게
 * 반영됐다」가 서로 다른데, 건수를 감추면 합계만 남아 그 차이가 사라진다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const SummaryPanel = ({ view, isLoading, onOpenIntervals }: SummaryPanelProps) => {
  if (isLoading) {
    return (
      <div className="kpi-grid downtime-summary-kpi-grid" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((slot) => (
          <Skeleton key={slot} variant="rect" height="6.5rem" />
        ))}
      </div>
    );
  }

  if (view === null) return null;

  return (
    <>
      <div className="kpi-grid downtime-summary-kpi-grid">
        <Figure
          label={t.summary.operating}
          value={formatCount(view.operatingMinutes)}
          unit={t.summary.unitMinutes}
          note={formatDuration(view.operatingMinutes)}
        />
        {/* 계획 비가동은 작업 캘린더가 정한다 — 오지 않으면 지어내지 않는다. */}
        <Figure
          label={t.summary.plannedDowntime}
          value={
            view.plannedDowntimeMinutes === null
              ? t.table.notAvailable
              : formatCount(view.plannedDowntimeMinutes)
          }
          unit={view.plannedDowntimeMinutes === null ? undefined : t.summary.unitMinutes}
          note={
            view.plannedDowntimeMinutes === null
              ? undefined
              : formatDuration(view.plannedDowntimeMinutes)
          }
        />
        <Figure
          label={t.summary.actualDowntime}
          value={formatCount(view.actualDowntimeMinutes)}
          unit={t.summary.unitMinutes}
          note={formatDuration(view.actualDowntimeMinutes)}
        />
        {/*
         * ⛔ 조업 시간이 0이면 0%가 아니라 「산출 불가」다. 0%로 그리면 「하루 종일 섰다」로
         * 읽히는데, 실제로는 「잰 시간 자체가 없다」는 뜻이다.
         */}
        <Figure
          label={t.summary.availability}
          value={
            view.availabilityPercent === null
              ? t.summary.availabilityUnavailable
              : formatDecimal(view.availabilityPercent)
          }
          unit={view.availabilityPercent === null ? undefined : '%'}
          note={
            view.availabilityPercent === null ? t.summary.availabilityUnavailableNote : undefined
          }
        />
        <Figure
          label={t.summary.openIntervals}
          value={formatCount(view.openIntervalCount)}
          unit={t.summary.unitCount}
          note={t.summary.openIntervalsNote}
          action={
            view.openIntervalCount === 0 ? undefined : (
              <Button
                variant="text"
                size="sm"
                onClick={() => {
                  onOpenIntervals('open');
                }}
              >
                {t.summary.openIntervalsOpen}
              </Button>
            )
          }
        />
        <Figure
          label={t.summary.overlappingIntervals}
          value={formatCount(view.overlappingIntervalCount)}
          unit={t.summary.unitCount}
          note={t.summary.overlappingIntervalsNote}
          action={
            view.overlappingIntervalCount === 0 ? undefined : (
              <Button
                variant="text"
                size="sm"
                onClick={() => {
                  onOpenIntervals('overlapping');
                }}
              >
                {t.summary.overlappingIntervalsOpen}
              </Button>
            )
          }
        />
        {/*
         * ⭐ 경미 정지는 **걸러 빼지 않고 줄을 나눈다.** 잦다는 것 자체가 신호라 감추면 안 된다.
         * 판정에 쓴 임계는 응답이 함께 내려 주므로 그 값을 문구에 그대로 쓴다 — 화면이 5분을
         * 지어 적으면 서버가 다른 값으로 판정한 날 근거가 어긋난다.
         */}
        {view.minorStopCount === null ? null : (
          <Figure
            label={t.summary.minorStops}
            value={formatCount(view.minorStopCount)}
            unit={t.summary.unitCount}
            note={
              view.minorStopThresholdMinutes === null
                ? t.summary.minorStopsThresholdUnknown
                : t.summary.minorStopsNote(view.minorStopThresholdMinutes)
            }
          />
        )}
        {view.sessionsWithoutEquipmentCount === null ? null : (
          <Figure
            label={t.summary.sessionsWithoutEquipment}
            value={formatCount(view.sessionsWithoutEquipmentCount)}
            unit={t.summary.unitCount}
            note={t.summary.sessionsWithoutEquipmentNote}
          />
        )}
        {view.correctiveMaintenanceCount === null ? null : (
          <Figure
            label={t.summary.corrective}
            value={formatCount(view.correctiveMaintenanceCount)}
            unit={t.summary.unitCount}
          />
        )}
        {view.preventiveMaintenanceCount === null ? null : (
          <Figure
            label={t.summary.preventive}
            value={formatCount(view.preventiveMaintenanceCount)}
            unit={t.summary.unitCount}
          />
        )}
        {view.breakdownsClosedWithoutOrderCount === null ? null : (
          <Figure
            label={t.summary.breakdownsWithoutOrder}
            value={formatCount(view.breakdownsClosedWithoutOrderCount)}
            unit={t.summary.unitCount}
            note={t.summary.breakdownsWithoutOrderNote}
          />
        )}
      </div>
      <p className="pane-lead">{t.summary.scopeNote}</p>
    </>
  );
};
