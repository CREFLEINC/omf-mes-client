import { Button, Checkbox, Chip, type Column, Dialog, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId, useState } from 'react';

import { Select } from '../../patterns/select';
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

const STATUS_TONE: Record<ItemCompareStatus, 'success' | 'error' | 'info' | 'idle'> = {
  added: 'success',
  removed: 'error',
  changed: 'info',
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

    /*
     * 칸 강조 — 바뀐 값은 파랑, 추가는 초록, 삭제는 빨강(머리의 범례와 같다 · 사용자 시안 #196).
     * 디자인 시스템 표에 칸 색을 칠할 길이 없어 표시 글자에 이름을 붙이고 CSS 가 그 칸(td)을 칠한다.
     */
    const cell = (value: string, tone?: 'changed' | 'added' | 'removed'): ReactNode =>
      tone === undefined ? (
        value
      ) : (
        <span className="inspection-standard-compare-cell" data-tone={tone}>
          {value}
        </span>
      );

    const settingColumns: Column<SettingRow>[] = [
      { key: 'label', header: t.compare.fieldColumn, align: 'center', width: '30%' },
      {
        key: 'base',
        header: versionLabel(baseId),
        align: 'center',
        render: (row) => cell(row.base),
      },
      {
        key: 'target',
        header: versionLabel(targetId),
        align: 'center',
        render: (row) => cell(row.target, row.changed ? 'changed' : undefined),
      },
    ];
    /* 검사 항목 · 두 버전 값 · 변경 칩(사용자 시안 · #196). 바뀐 칸은 칩에 마우스를 올리면 「전 → 후」로 보인다. */
    const itemColumns: Column<ItemCompareRow>[] = [
      {
        key: 'code',
        header: t.compare.itemColumn,
        align: 'center',
        width: '34%',
        render: (row) => t.values.itemLabel(row.code, row.name),
      },
      { key: 'baseValue', header: versionLabel(baseId), align: 'center', width: '22%' },
      { key: 'targetValue', header: versionLabel(targetId), align: 'center', width: '22%' },
      {
        key: 'status',
        header: t.compare.changesColumn,
        align: 'center',
        render: (row) => (
          <span title={row.changes.length === 0 ? undefined : row.changes.join('\n')}>
            <Chip variant="status" size="sm" status={STATUS_TONE[row.status]}>
              {t.compare[row.status]}
            </Chip>
          </span>
        ),
      },
    ];

    return (
      <>
        <section
          className="inspection-standard-compare-section"
          aria-label={t.compare.settingsTitle}
        >
          <div className="inspection-standard-section-head">
            <h3 className="pane-title">{t.compare.settingsTitle}</h3>
            {/* 범례 — 칸 색의 뜻(사용자 시안 · #196) */}
            <ul className="inspection-standard-compare-legend">
              <li data-tone="changed">{t.compare.legendChanged}</li>
              <li data-tone="added">{t.compare.legendAdded}</li>
              <li data-tone="removed">{t.compare.legendRemoved}</li>
            </ul>
          </div>
          <div className="inspection-queue-table inspection-standard-table-box inspection-standard-compare-table">
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
            <div className="inspection-standard-compare-title">
              <h3 className="pane-title">{t.compare.itemsTitle}</h3>
              <Chip variant="status" size="sm" status="idle">
                {t.compare.count(itemRows.length)}
              </Chip>
            </div>
            <Checkbox checked={hideSame} onChange={(event) => setHideSame(event.target.checked)}>
              {t.compare.hideSame}
            </Checkbox>
          </div>
          {allItemRows.length === 0 ? (
            <p className="field-note">{t.compare.noItems}</p>
          ) : itemRows.length === 0 ? (
            <p className="field-note">{t.compare.noItemDiff}</p>
          ) : (
            <div className="inspection-queue-table inspection-standard-table-box inspection-standard-compare-table">
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
