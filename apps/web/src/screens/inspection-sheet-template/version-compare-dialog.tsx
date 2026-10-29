import { Button, Checkbox, Chip, type Column, Dialog, SkeletonText, Table } from '@crefle/web-ui';
import type { InspectionSheetTemplate } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId, useState } from 'react';

import { Select } from '../../patterns/select';
import { useTemplate } from './queries';
import {
  type CompareRow,
  compareItems,
  compareSettings,
  type ItemChange,
  type ItemCompareRow,
} from './version-compare';

const t = messages.inspectionSheetTemplate;

const CHANGE_TONE: Record<ItemChange, 'info' | 'success' | 'error' | 'idle'> = {
  changed: 'info',
  added: 'success',
  removed: 'error',
  same: 'idle',
};

export interface TemplateVersionCompareDialogProps {
  /** 같은 품목의 모든 버전 */
  versions: readonly InspectionSheetTemplate[];
  initialBaseId: number;
  initialTargetId: number;
  onClose: () => void;
}

/**
 * 검사표 기준 버전 비교 — 검사 기준 탭의 「버전 비교」 창과 같은 모양(사용자 지시 · #208).
 * 두 버전의 상세를 받아 상단 정보 · LOT 표시 자재와 검사 항목을 견준다. 같은 버전끼리는 고를 수 없다.
 */
export const TemplateVersionCompareDialog = ({
  versions,
  initialBaseId,
  initialTargetId,
  onClose,
}: TemplateVersionCompareDialogProps) => {
  const baseSelectId = useId();
  const targetSelectId = useId();
  const [baseId, setBaseId] = useState(initialBaseId);
  const [targetId, setTargetId] = useState(initialTargetId);
  const [hideSame, setHideSame] = useState(true);
  const base = useTemplate(baseId);
  const target = useTemplate(targetId);

  const options = [...versions]
    .sort((left, right) => right.templateVersion - left.templateVersion)
    .map((version) => ({
      value: String(version.inspectionSheetTemplateId),
      label: `${t.editor.versionChip(version.templateVersion)} · ${
        t.statuses[version.statusCode] ?? version.statusCode
      }`,
    }));
  const optionsExcept = (id: number) => options.filter((option) => option.value !== String(id));
  const versionLabel = (id: number): string => {
    const version = versions.find((each) => each.inspectionSheetTemplateId === id);
    return version === undefined ? '' : t.editor.versionChip(version.templateVersion);
  };

  const cell = (value: string, tone?: 'changed' | 'added' | 'removed'): ReactNode =>
    tone === undefined ? (
      value
    ) : (
      <span className="inspection-standard-compare-cell" data-tone={tone}>
        {value}
      </span>
    );

  const body = (): ReactNode => {
    if (base.isError || target.isError) {
      return <p className="field-error">{t.editor.loadFailed}</p>;
    }
    if (base.data === undefined || target.data === undefined) {
      return (
        <div role="status" aria-label={t.compare.loading}>
          <SkeletonText lines={6} />
        </div>
      );
    }

    const settingRows = compareSettings(base.data, target.data);
    const allItemRows = compareItems(base.data, target.data);
    const itemRows = hideSame ? allItemRows.filter((row) => row.change !== 'same') : allItemRows;

    const settingColumns: Column<CompareRow>[] = [
      { key: 'label', header: t.compare.fieldColumn, align: 'center', width: '30%' },
      { key: 'base', header: versionLabel(baseId), align: 'center', render: (row) => row.base },
      {
        key: 'target',
        header: versionLabel(targetId),
        align: 'center',
        render: (row) => cell(row.target, row.changed ? 'changed' : undefined),
      },
    ];
    const itemColumns: Column<ItemCompareRow>[] = [
      { key: 'step', header: t.compare.stepColumn, align: 'center', width: '16%' },
      { key: 'code', header: t.compare.codeColumn, align: 'center', width: '14%' },
      { key: 'base', header: versionLabel(baseId), align: 'center', width: '26%' },
      {
        key: 'target',
        header: versionLabel(targetId),
        align: 'center',
        width: '26%',
        render: (row) =>
          cell(
            row.target,
            row.change === 'same' ? undefined : row.change === 'changed' ? 'changed' : row.change,
          ),
      },
      {
        key: 'change',
        header: t.compare.changeColumn,
        align: 'center',
        render: (row) => (
          <Chip variant="status" size="sm" status={CHANGE_TONE[row.change]}>
            {t.compare[row.change]}
          </Chip>
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
                getRowId={(row) => row.key}
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
          {messages.common.close}
        </Button>
      }
    >
      <div className="inspection-standard-compare">
        <div className="form-grid">
          <div className="field-cell">
            <label className="field-label" htmlFor={baseSelectId}>
              {t.compare.base}
            </label>
            <Select
              id={baseSelectId}
              options={optionsExcept(targetId)}
              value={String(baseId)}
              onChange={(value) => setBaseId(Number(value))}
            />
          </div>
          <div className="field-cell">
            <label className="field-label" htmlFor={targetSelectId}>
              {t.compare.target}
            </label>
            <Select
              id={targetSelectId}
              options={optionsExcept(baseId)}
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
