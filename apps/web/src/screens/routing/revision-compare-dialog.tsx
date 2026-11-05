import { Button, Checkbox, Chip, type Column, Dialog, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId, useState } from 'react';

import { formatPlantDateTime } from '../../patterns/plant-time';
import { Select } from '../../patterns/select';
import { FieldLabel } from './field-label';
import { useRoutingOperations } from './queries';
import {
  changeText,
  compareOperations,
  type OperationCompareRow,
  type OperationCompareStatus,
} from './revision-compare';
import { resolveRoutingStatus } from './routing-status';
import type { Routing } from './types';

const t = messages.routing;

const STATUS_TONE: Record<OperationCompareStatus, 'success' | 'error' | 'info' | 'idle'> = {
  added: 'success',
  removed: 'error',
  changed: 'info',
  same: 'idle',
};

interface HeaderRow {
  key: string;
  label: string;
  base: string;
  target: string;
  changed: boolean;
}

export interface RevisionCompareDialogProps {
  /** 이 품목의 Rev — 서버 순서(최신이 위) 그대로. */
  revisions: Routing[];
  initialBaseId: number;
  initialTargetId: number;
  processLabel: (processId: string) => string;
  /** 조회 실패 표시 — 화면의 조회 실패 배너를 그대로 쓴다. */
  renderLoadError: (error: unknown, onRetry: () => void) => ReactNode;
  onClose: () => void;
}

/**
 * Rev 비교(사용자 지시 · omf-all-around#231) — 두 Rev 의 기본 정보와 공정 구성을 견준다.
 *
 * 서버에 비교 경로가 없다 — 이미 있는 Rev 목록 · 공정 라인 조회로 두 Rev 를 불러 화면이 견준다(검사 기준 버전 비교와 같은 방식).
 * 보기 전용이라 저장할 것이 없다.
 */
export const RevisionCompareDialog = ({
  revisions,
  initialBaseId,
  initialTargetId,
  processLabel,
  renderLoadError,
  onClose,
}: RevisionCompareDialogProps) => {
  const baseSelectId = useId();
  const targetSelectId = useId();
  const [baseId, setBaseId] = useState(initialBaseId);
  const [targetId, setTargetId] = useState(initialTargetId);
  const [hideSame, setHideSame] = useState(true);

  const baseOperations = useRoutingOperations(baseId);
  const targetOperations = useRoutingOperations(targetId);

  const options = revisions.map((revision) => ({
    value: String(revision.routingId),
    label: `${t.values.revision(revision.routingVersion)} · ${resolveRoutingStatus(revision.statusCode).label}`,
  }));
  /* 같은 Rev 끼리는 견줄 것이 없다 — 반대쪽에서 고른 Rev 는 선택지에서 뺀다. */
  const optionsExcept = (id: number) => options.filter((option) => option.value !== String(id));
  const revisionOf = (id: number) => revisions.find((revision) => revision.routingId === id);
  const labelOf = (id: number): string => {
    const revision = revisionOf(id);
    return revision === undefined ? '' : t.values.revision(revision.routingVersion);
  };

  const body = (): ReactNode => {
    const failed = [baseOperations, targetOperations].find((query) => query.isError);
    if (failed !== undefined) {
      return renderLoadError(failed.error, () => {
        if (baseOperations.isError) void baseOperations.refetch();
        if (targetOperations.isError) void targetOperations.refetch();
      });
    }
    if (baseOperations.data === undefined || targetOperations.data === undefined) {
      return (
        <div role="status" aria-label={t.compare.loading}>
          <SkeletonText lines={6} />
        </div>
      );
    }

    const base = revisionOf(baseId);
    const target = revisionOf(targetId);
    const headerRows: HeaderRow[] = [
      {
        key: 'routingCode',
        label: t.fields.routingCode,
        base: base?.routingCode ?? t.values.empty,
        target: target?.routingCode ?? t.values.empty,
      },
      {
        key: 'statusCode',
        label: t.fields.status,
        base: base === undefined ? t.values.empty : resolveRoutingStatus(base.statusCode).label,
        target:
          target === undefined ? t.values.empty : resolveRoutingStatus(target.statusCode).label,
      },
      {
        key: 'confirmedAt',
        label: t.fields.confirmedAt,
        base: formatPlantDateTime(base?.confirmedAt) ?? t.values.empty,
        target: formatPlantDateTime(target?.confirmedAt) ?? t.values.empty,
      },
    ].map((row) => ({ ...row, changed: row.base !== row.target }));

    const allRows = compareOperations(baseOperations.data.items, targetOperations.data.items);
    const rows = hideSame ? allRows.filter((row) => row.status !== 'same') : allRows;

    /* 바뀐 값은 파랑, 추가는 초록, 삭제는 빨강 — 검사 기준 버전 비교와 같은 칸 색(CSS 가 td 를 칠한다). */
    const cell = (value: string, tone?: 'changed' | 'added' | 'removed'): ReactNode =>
      tone === undefined ? (
        value
      ) : (
        <span className="inspection-standard-compare-cell" data-tone={tone}>
          {value}
        </span>
      );

    const headerColumns: Column<HeaderRow>[] = [
      { key: 'label', header: t.compare.fieldColumn, align: 'center', width: '30%' },
      { key: 'base', header: labelOf(baseId), align: 'center', render: (row) => cell(row.base) },
      {
        key: 'target',
        header: labelOf(targetId),
        align: 'center',
        render: (row) => cell(row.target, row.changed ? 'changed' : undefined),
      },
    ];
    /* 공정 · 두 Rev 의 공정명 · 변경 칩 — 검사 기준 버전 비교와 같은 칸 구성 · 너비(사용자 지시 · #231).
     * 바뀐 칸은 칩에 마우스를 올리면 「이름: 전 → 후」로 보인다. */
    const operationName = (operation: OperationCompareRow['base']): string =>
      operation === null ? t.values.empty : operation.operationName;
    const operationColumns: Column<OperationCompareRow>[] = [
      {
        key: 'process',
        header: t.compare.processColumn,
        align: 'center',
        width: '34%',
        render: (row) => processLabel(String(row.processId)),
      },
      {
        key: 'base',
        header: labelOf(baseId),
        align: 'center',
        width: '22%',
        render: (row) => operationName(row.base),
      },
      {
        key: 'target',
        header: labelOf(targetId),
        align: 'center',
        width: '22%',
        render: (row) => operationName(row.target),
      },
      {
        key: 'status',
        header: t.compare.changesColumn,
        align: 'center',
        render: (row) => (
          <span
            title={row.changes.length === 0 ? undefined : row.changes.map(changeText).join('\n')}
          >
            <Chip variant="status" size="sm" status={STATUS_TONE[row.status]}>
              {t.compare[row.status]}
            </Chip>
          </span>
        ),
      },
    ];

    return (
      <>
        <section className="inspection-standard-compare-section" aria-label={t.compare.headerTitle}>
          <div className="inspection-standard-section-head">
            <h3 className="pane-title">{t.compare.headerTitle}</h3>
            <ul className="inspection-standard-compare-legend">
              <li data-tone="changed">{t.compare.changed}</li>
              <li data-tone="added">{t.compare.added}</li>
              <li data-tone="removed">{t.compare.removed}</li>
            </ul>
          </div>
          <div className="inspection-queue-table inspection-standard-table-box inspection-standard-compare-table">
            <Table
              density="compact"
              columns={headerColumns}
              rows={headerRows}
              getRowId={(row) => row.key}
            />
          </div>
        </section>

        <section
          className="inspection-standard-compare-section"
          aria-label={t.compare.operationsTitle}
        >
          <div className="inspection-standard-section-head">
            <div className="inspection-standard-compare-title">
              <h3 className="pane-title">{t.compare.operationsTitle}</h3>
              <Chip variant="status" size="sm" status="idle">
                {t.compare.count(rows.length)}
              </Chip>
            </div>
            <Checkbox checked={hideSame} onChange={(event) => setHideSame(event.target.checked)}>
              {t.compare.hideSame}
            </Checkbox>
          </div>
          {allRows.length === 0 ? (
            <p className="field-note">{t.compare.noOperations}</p>
          ) : rows.length === 0 ? (
            <p className="field-note">{t.compare.noDiff}</p>
          ) : (
            <div className="inspection-queue-table inspection-standard-table-box inspection-standard-compare-table">
              <Table
                density="compact"
                columns={operationColumns}
                rows={rows}
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
      closeOnBackdropClick={false}
      showCloseButton={false}
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
            <FieldLabel htmlFor={baseSelectId} label={t.compare.base} />
            <Select
              id={baseSelectId}
              options={optionsExcept(targetId)}
              value={String(baseId)}
              onChange={(value) => {
                if (value !== null) setBaseId(Number(value));
              }}
            />
          </div>
          <div className="field-cell">
            <FieldLabel htmlFor={targetSelectId} label={t.compare.target} />
            <Select
              id={targetSelectId}
              options={optionsExcept(baseId)}
              value={String(targetId)}
              onChange={(value) => {
                if (value !== null) setTargetId(Number(value));
              }}
            />
          </div>
        </div>
        {body()}
      </div>
    </Dialog>
  );
};
