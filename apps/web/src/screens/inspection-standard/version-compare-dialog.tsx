import {
  Button,
  Checkbox,
  Chip,
  type Column,
  Dialog,
  Select,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId, useState } from 'react';

import { FieldLabel } from './field-label';
import { LoadErrorBanner } from './load-error-banner';
import { resolveVersionStatus } from './plan-version-status';
import { useInspectionItemSpecs, useInspectionPlanVersionDetail } from './queries';
import type { InspectionPlanVersion } from './types';
import {
  compareItems,
  compareSettings,
  type CompareLabels,
  type ItemCompareRow,
  type ItemCompareStatus,
  type SettingRow,
} from './version-compare';
import { versionToFormValues } from './version-mappers';

const t = messages.inspectionStandard;

const STATUS_TONE: Record<ItemCompareStatus, 'success' | 'error' | 'warning' | 'idle'> = {
  added: 'success',
  removed: 'error',
  changed: 'warning',
  same: 'idle',
};

export interface VersionCompareDialogProps {
  /** 이 기준의 버전 — 서버 순서(최신이 위) 그대로. */
  versions: InspectionPlanVersion[];
  initialBaseId: number;
  initialTargetId: number;
  labels: CompareLabels;
  onClose: () => void;
}

/**
 * 버전 비교(사용자 지시 · omf-all-around#196) — 두 버전의 설정과 검사 항목을 견준다.
 *
 * 서버에 비교 경로가 없다 — 이미 있는 버전 상세 · 검사 항목 조회로 두 버전을 불러 화면이 견준다.
 * 보기 전용이라 저장할 것이 없다. 창은 「닫기」로만 닫는다.
 */
export const VersionCompareDialog = ({
  versions,
  initialBaseId,
  initialTargetId,
  labels,
  onClose,
}: VersionCompareDialogProps) => {
  const baseSelectId = useId();
  const targetSelectId = useId();
  const [baseId, setBaseId] = useState(initialBaseId);
  const [targetId, setTargetId] = useState(initialTargetId);
  const [hideSame, setHideSame] = useState(true);

  const baseDetail = useInspectionPlanVersionDetail(baseId);
  const targetDetail = useInspectionPlanVersionDetail(targetId);
  const baseItems = useInspectionItemSpecs(baseId);
  const targetItems = useInspectionItemSpecs(targetId);

  const options = versions.map((version) => ({
    value: String(version.inspectionPlanVersionId),
    label: `${t.values.version(version.planVersion)} · ${resolveVersionStatus(version.statusCode).label}`,
  }));
  const versionLabel = (id: number): string => {
    const version = versions.find((each) => each.inspectionPlanVersionId === id);
    return version === undefined ? '' : t.values.version(version.planVersion);
  };

  const queries = [baseDetail, targetDetail, baseItems, targetItems];
  const failed = queries.find((query) => query.isError);

  const body = (): ReactNode => {
    if (baseId === targetId) return <p className="field-note">{t.compare.sameVersion}</p>;
    if (failed !== undefined) {
      return (
        <LoadErrorBanner
          error={failed.error}
          onRetry={() => {
            queries.forEach((query) => {
              if (query.isError) void query.refetch();
            });
          }}
        />
      );
    }
    if (
      baseDetail.data === undefined ||
      targetDetail.data === undefined ||
      baseItems.data === undefined ||
      targetItems.data === undefined
    ) {
      return (
        <div role="status" aria-label={t.compare.loading}>
          <SkeletonText lines={6} />
        </div>
      );
    }

    const settingRows = compareSettings(
      versionToFormValues(baseDetail.data.inspectionPlanVersion),
      versionToFormValues(targetDetail.data.inspectionPlanVersion),
      labels,
    );
    const allItemRows = compareItems(baseItems.data.items, targetItems.data.items, labels);
    const itemRows = hideSame ? allItemRows.filter((row) => row.status !== 'same') : allItemRows;

    /* 값이 다른 칸은 글자를 강조한다 — 표 줄에 색을 칠할 길이 디자인 시스템에 없다. */
    const marked = (row: SettingRow, value: string): ReactNode => (
      <span className={row.changed ? 'inspection-standard-compare-changed' : undefined}>
        {value}
      </span>
    );
    const settingColumns: Column<SettingRow>[] = [
      {
        key: 'label',
        header: t.compare.fieldColumn,
        align: 'center',
        width: '180px',
        render: (row) => marked(row, row.label),
      },
      {
        key: 'base',
        header: versionLabel(baseId),
        align: 'center',
        render: (row) => marked(row, row.base),
      },
      {
        key: 'target',
        header: versionLabel(targetId),
        align: 'center',
        render: (row) => marked(row, row.target),
      },
    ];
    const itemColumns: Column<ItemCompareRow>[] = [
      {
        key: 'status',
        header: t.compare.statusColumn,
        align: 'center',
        width: '88px',
        render: (row) => (
          <Chip variant="status" size="sm" status={STATUS_TONE[row.status]}>
            {t.compare[row.status]}
          </Chip>
        ),
      },
      {
        key: 'code',
        header: t.compare.itemColumn,
        align: 'center',
        width: '220px',
        render: (row) => t.values.itemLabel(row.code, row.name),
      },
      {
        key: 'changes',
        header: t.compare.changesColumn,
        align: 'start',
        render: (row) =>
          row.changes.length === 0 ? (
            t.values.empty
          ) : (
            <ul className="inspection-standard-compare-changes">
              {row.changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          ),
      },
    ];

    return (
      <>
        <section
          className="inspection-standard-compare-section"
          aria-label={t.compare.settingsTitle}
        >
          <h3 className="pane-subtitle">{t.compare.settingsTitle}</h3>
          <div className="inspection-queue-table inspection-standard-table-box inspection-standard-compare-settings">
            <Table
              density="compact"
              columns={settingColumns}
              rows={settingRows}
              getRowId={(row) => row.key}
            />
          </div>
        </section>

        <section className="inspection-standard-compare-section" aria-label={t.compare.itemsTitle}>
          <div className="inspection-standard-section-head">
            <h3 className="pane-subtitle">{t.compare.itemsTitle}</h3>
            <Checkbox checked={hideSame} onChange={(event) => setHideSame(event.target.checked)}>
              {t.compare.hideSame}
            </Checkbox>
          </div>
          {allItemRows.length === 0 ? (
            <p className="field-note">{t.compare.noItems}</p>
          ) : itemRows.length === 0 ? (
            <p className="field-note">{t.compare.noItemDiff}</p>
          ) : (
            <div className="inspection-queue-table inspection-standard-table-box">
              <Table
                density="compact"
                columns={itemColumns}
                rows={itemRows}
                getRowId={(row) => `${row.status}:${row.code}`}
              />
            </div>
          )}
        </section>
      </>
    );
  };

  return (
    <Dialog
      open
      size="lg"
      showCloseButton={false}
      closeOnBackdropClick={false}
      title={t.compare.title}
      onClose={onClose}
      footer={
        <Button variant="outlined" onClick={onClose}>
          {t.versionBar.close}
        </Button>
      }
    >
      <div className="inspection-standard-compare">
        <div className="form-grid">
          <div className="field-cell">
            <FieldLabel htmlFor={baseSelectId} label={t.compare.base} />
            <Select
              id={baseSelectId}
              options={options}
              value={String(baseId)}
              onChange={(value) => setBaseId(Number(value))}
            />
          </div>
          <div className="field-cell">
            <FieldLabel htmlFor={targetSelectId} label={t.compare.target} />
            <Select
              id={targetSelectId}
              options={options}
              value={String(targetId)}
              onChange={(value) => setTargetId(Number(value))}
            />
          </div>
        </div>
        {body()}
      </div>
    </Dialog>
  );
};
