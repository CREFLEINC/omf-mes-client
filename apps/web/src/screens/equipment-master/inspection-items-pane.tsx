import { AlertBanner, Button, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { cycleText } from './inspection-assignment';
import type { InspectionItemAssignment } from './types';

const t = messages.equipmentMaster.inspection;
const tv = messages.equipmentMaster.values;

export interface InspectionItemsPaneProps {
  assignments: InspectionItemAssignment[];
  isLoading: boolean;
  /** 주기 단위 코드 → 이름. 모르는 코드는 담기지 않는다 */
  cycleLabels: ReadonlyMap<string, string>;
  /** 점검 유형 코드 → 이름. 모르는 코드는 담기지 않는다 */
  typeLabels: ReadonlyMap<string, string>;
  /** 부여를 고칠 수 있는가. 못 하면 감추지 않고 사유와 함께 잠근다(G-2) */
  canEdit: boolean;
  editDisabledReason?: string;
  onEdit: () => void;
  loadError: ReactNode;
}

/**
 * 이 그룹에 부여된 점검 항목.
 *
 * ⭐ **마스터가 아니라 부여를 보인다**(공유계약 B-6) — 항목이 «무엇인가»가 아니라 「이 그룹이
 * 그 항목을 **얼마 만에** 도는가」다. 그래서 주기 열이 있고 판정 방식·상하한 열은 없다.
 */
export const InspectionItemsPane = ({
  assignments,
  isLoading,
  cycleLabels,
  typeLabels,
  canEdit,
  editDisabledReason,
  onEdit,
  loadError,
}: InspectionItemsPaneProps) => {
  const columns: Column<InspectionItemAssignment>[] = [
    { key: 'itemCode', header: t.fields.itemCode, width: '132px' },
    { key: 'itemName', header: t.fields.itemName },
    {
      key: 'inspectionTypeCode',
      header: t.fields.inspectionType,
      width: '108px',
      /* ⛔ 이름을 모르면 코드를 그대로 쓴다 — 지어내지 않는다(G-9). */
      render: (row) => typeLabels.get(row.inspectionTypeCode) ?? row.inspectionTypeCode,
    },
    {
      key: 'cycle',
      header: t.fields.cycle,
      width: '116px',
      render: (row) => cycleText(row, cycleLabels),
    },
    {
      key: 'isActive',
      header: t.fields.activation,
      width: '84px',
      render: (row) => (row.isActive ? tv.active : tv.inactive),
    },
  ];

  const listSlot = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <div className="equipment-master-table equipment-master-inspection-table">
        <Table
          density="compact"
          caption={<span className="equipment-master-table-caption">{t.paneTitle}</span>}
          columns={columns}
          rows={assignments}
          getRowId={(row) => String(row.equipmentInspectionItemId)}
          empty={
            <EmptyState size="sm" live title={t.emptyTitle} description={t.emptyDescription} />
          }
        />
      </div>
    );
  };

  return (
    /* ⛔ `.pane` 을 두르지 않는다 — 탭 내용은 이미 페인 «안»이라 상자가 겹쳐 보인다. */
    <section className="equipment-master-tab-content" aria-label={t.paneTitle}>
      <h3 className="equipment-master-subtitle">{t.paneTitle}</h3>
      <p className="dialog-lead">{t.description}</p>

      <div className="equipment-master-subsection-actions">
        <div className="filter-actions">
          <Button variant="outlined" onClick={onEdit} disabled={!canEdit}>
            {t.editAction}
          </Button>
        </div>
        {/* ⛔ 감추지 않고 사유를 말한다(G-2) — 왜 못 누르는지 모르면 사용자는 헤맨다. */}
        {!canEdit && editDisabledReason !== undefined && (
          <span className="field-note">{editDisabledReason}</span>
        )}
      </div>

      {listSlot()}
    </section>
  );
};

export const InspectionLoadBanner = ({ message }: { message: string }) => (
  <AlertBanner variant="error">{message}</AlertBanner>
);
