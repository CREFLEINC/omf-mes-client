import { AlertBanner, Button, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { targetTypeLabel, type WorkCalendarApplication } from './application-targets';

const t = messages.workCalendar.applications;

export interface ApplicationPaneProps {
  /** 고른 캘린더의 이름. 아직 안 골랐으면 `null` */
  calendarName: string | null;
  items: readonly WorkCalendarApplication[];
  isLoading: boolean;
  /** 기본 캘린더가 없는 공장 수. **아직 모르면 `null`** — 0 과 다르다 */
  unassignedPlants: number | null;
  onAdd: () => void;
  onRelease: (application: WorkCalendarApplication) => void;
  loadError: ReactNode;
}

/**
 * 이 캘린더를 따르는 대상.
 *
 * ⭐ **해제는 지우는 것이 아니라 «상위 층을 따르게 하는 것»이다**(계약). 그 사실을 말하지
 * 않으면 사용자가 「지운다」로 읽고, 공장 기본을 해제해 놓고 왜 설비가 여전히 달력을 따르는지
 * 묻게 된다.
 */
export const ApplicationPane = ({
  calendarName,
  items,
  isLoading,
  unassignedPlants,
  onAdd,
  onRelease,
  loadError,
}: ApplicationPaneProps) => {
  const columns: Column<WorkCalendarApplication>[] = [
    {
      key: 'targetTypeCode',
      header: t.targetType,
      width: '140px',
      render: (row) => targetTypeLabel(row.targetTypeCode, t.types),
    },
    { key: 'targetName', header: t.target },
    {
      key: 'release',
      header: t.release,
      width: '120px',
      render: (row) => (
        <Button
          variant="outlined"
          size="sm"
          aria-label={t.releaseLabel(row.targetName)}
          onClick={() => onRelease(row)}
        >
          {t.release}
        </Button>
      ),
    },
  ];

  const listSlot = (): ReactNode => {
    if (calendarName === null) {
      return <EmptyState size="sm" live title={t.title} description={t.pickCalendar} />;
    }

    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <div className="wide-table work-calendar-table work-calendar-application-table">
        <Table
          density="compact"
          caption={<span className="work-calendar-table-caption">{t.title}</span>}
          columns={columns}
          rows={[...items]}
          getRowId={(row) => `${row.targetTypeCode}-${String(row.targetId)}`}
          empty={
            <EmptyState size="sm" live title={t.emptyTitle} description={t.emptyDescription} />
          }
        />
      </div>
    );
  };

  return (
    <section className="pane work-calendar-pane" aria-label={t.title}>
      <div className="work-calendar-pane-heading">
        <h2 className="pane-title">{t.title}</h2>
        {calendarName !== null && (
          <Button variant="outlined" onClick={onAdd}>
            {t.add}
          </Button>
        )}
      </div>
      {/*
       * ⭐ **저장을 막지 않고 세어 보인다**(스펙 §6). 공장을 새로 만들면 잠시 기본 캘린더가
       * 없는 것이 정상이다 — 다만 그 공장의 설비는 따를 캘린더가 없으므로 조용히 두지 않는다.
       * ⛔ 아직 모르면(`null`) 아무 말도 하지 않는다 — 0 곳이라고 단언하지 않는다.
       */}
      {unassignedPlants !== null && unassignedPlants > 0 && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.unassignedPlants(unassignedPlants)}</AlertBanner>
        </div>
      )}

      <p className="work-calendar-pane-note">{t.releaseNote}</p>

      {listSlot()}
    </section>
  );
};
