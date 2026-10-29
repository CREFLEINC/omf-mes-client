import { Chip, type Column, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { CodeAdapter } from './adapters';
import type { HierarchyCode } from './types';

const t = messages.defectCauseCode;

export interface ChildCodeTableProps {
  adapter: CodeAdapter;
  /** 이 대분류에 딸린 하위 코드(미사용 포함, 코드 순) */
  codes: readonly HierarchyCode[];
  processLabelOf: (processId: number | null | undefined) => string | null;
  onSelect: (id: number) => void;
}

/**
 * 대분류 상세 카드 아래 하위 코드 목록(사용자 지시 2026-10-29 · #209) — 대분류를 고르면 딸린 상세 코드를 함께 본다.
 * 값 표기만 한다. 코드를 누르면 그 하위 코드를 고른다(목록에서 고른 것과 같다).
 */
export const ChildCodeTable = ({
  adapter,
  codes,
  processLabelOf,
  onSelect,
}: ChildCodeTableProps) => {
  const orEmpty = (value: string | null | undefined): string =>
    value === null || value === undefined || value === '' ? t.values.empty : value;

  const columns: Column<HierarchyCode>[] = [
    {
      key: 'code',
      align: 'center',
      header: adapter.labels.listCode,
      render: (row) => (
        <button
          type="button"
          className="inspection-standard-plan-open defect-cause-child-open"
          title={row.code}
          onClick={() => onSelect(row.id)}
        >
          {row.code}
        </button>
      ),
    },
    { key: 'name', align: 'center', header: adapter.labels.listName, render: (row) => row.name },
    ...(adapter.hasDisposition
      ? [
          {
            key: 'disposition',
            align: 'center' as const,
            header: t.fields.disposition,
            render: (row: HierarchyCode) =>
              row.dispositionTypeCode === null || row.dispositionTypeCode === undefined
                ? t.values.empty
                : t.values.disposition[row.dispositionTypeCode],
          },
        ]
      : []),
    {
      key: 'process',
      align: 'center',
      header: t.fields.process,
      render: (row) => orEmpty(processLabelOf(row.processId)),
    },
    {
      key: 'isActive',
      align: 'center',
      header: t.listColumns.isActive,
      render: (row) => (
        <Chip variant="status" size="sm" status={row.isActive ? 'success' : 'idle'}>
          {row.isActive ? t.detail.chipActive : t.detail.chipInactive}
        </Chip>
      ),
    },
  ];

  return (
    <section className="defect-cause-children" aria-label={t.detail.childrenTitle}>
      <h3 className="defect-cause-children-title">
        {t.detail.childrenTitle}
        <span className="defect-cause-child-count">{t.values.referenceCount(codes.length)}</span>
      </h3>
      <div className="inspection-queue-table inspection-standard-table-box">
        <Table
          density="compact"
          columns={columns}
          rows={[...codes]}
          getRowId={(row) => String(row.id)}
          empty={<p className="field-note defect-cause-children-empty">{t.detail.childrenNone}</p>}
        />
      </div>
    </section>
  );
};
