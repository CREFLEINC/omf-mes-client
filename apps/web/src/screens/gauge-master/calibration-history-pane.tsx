import { AlertBanner, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { historyLimitNote } from './calibration-history';

type Calibration = components['schemas']['Calibration'];

const t = messages.gaugeMaster.history;

export interface CalibrationHistoryPaneProps {
  items: Calibration[];
  /** 전체 건수. **모르면 `null`** — 계약이 선택으로 두었다 */
  totalCount: number | null;
  pageSize: number;
  isLoading: boolean;
  isError: boolean;
}

/** 값이 없는 칸. 빈칸으로 두지 않고 「기록 없음」을 밝힌다(공유계약 G-9). */
const orNotRecorded = (value: string | null | undefined): string =>
  value === null || value === undefined || value.trim() === ''
    ? messages.gaugeMaster.fields.notRecorded
    : value;

/**
 * 한 계측기의 검교정 이력 — **읽기만 한다.**
 *
 * ⭐ 등록·수정은 검교정 이력 등록 화면(W-05-10)이 한다(공유계약 B-13). 여기에 조작을 두면
 * 같은 자료를 두 화면이 정하게 되고, 그때 어느 쪽이 맞는지 알 수 없다. **그 사실을 밝힌다** —
 * 조작이 없는 것과 「여기서는 못 한다」는 다른 말이다.
 */
export const CalibrationHistoryPane = ({
  items,
  totalCount,
  pageSize,
  isLoading,
  isError,
}: CalibrationHistoryPaneProps) => {
  const columns: Column<Calibration>[] = [
    { key: 'performedOn', header: t.fields.performedOn },
    /*
     * ⚠ **구분·결과의 값 목록이 아직 없다**(설계 추적 `omf-mes#145`). 이름을 지어내지 않고
     * 코드를 그대로 보인다 — 「알 수 없음」으로 그리면 모르는 값과 없는 값이 같은 모양이
     * 된다(공유계약 G-9). 목록이 확정되면 여기 두 칸만 이름 풀이를 얹으면 된다.
     */
    { key: 'historyTypeCode', header: t.fields.historyType },
    { key: 'resultCode', header: t.fields.result },
    {
      key: 'nextDueOn',
      header: t.fields.nextDueOn,
      render: (row) => orNotRecorded(row.nextDueOn),
    },
    {
      key: 'agencyName',
      header: t.fields.agency,
      render: (row) => orNotRecorded(row.agencyName),
    },
    {
      key: 'certificateNo',
      header: t.fields.certificateNo,
      render: (row) => orNotRecorded(row.certificateNo),
    },
  ];

  const limitNote = historyLimitNote(items.length, totalCount, pageSize);

  const body = () => {
    if (isError) {
      return <AlertBanner variant="error">{t.loadFailed}</AlertBanner>;
    }

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={2} />
        </div>
      );
    }

    return (
      <Table
        density="compact"
        columns={columns}
        rows={items}
        getRowId={(row) => String(row.calibrationId)}
        empty={<EmptyState size="sm" live title={t.emptyTitle} description={t.emptyDescription} />}
      />
    );
  };

  return (
    <section className="pane" aria-label={t.title}>
      <h3>{t.title}</h3>
      <p className="field-note">{t.readOnlyNote}</p>
      {limitNote !== null && <AlertBanner variant="warning">{limitNote}</AlertBanner>}
      {body()}
    </section>
  );
};
