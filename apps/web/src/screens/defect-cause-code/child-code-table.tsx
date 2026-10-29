import { Chip, type Column, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { CodeAdapter } from './adapters';
import type { HierarchyCode } from './types';

const t = messages.defectCauseCode;

export interface ChildCodeTableProps {
  adapter: CodeAdapter;
  /** 고른 대분류 아래의 상세 코드 — 코드 순으로 정렬해 넘긴다 */
  codes: HierarchyCode[];
  processLabelOf: (processId: number | null | undefined) => string | null;
}

/**
 * 대분류 상세 카드 아래의 상세 코드 표(사용자 지시 · #209) — 대분류를 고르면 그 안의 상세 정보도 함께 본다.
 * 칸은 상세 카드의 이름표와 같은 순서다. 값은 보기만 한다 — 고치려면 목록에서 그 코드를 고른다.
 */
export const ChildCodeTable = ({ adapter, codes, processLabelOf }: ChildCodeTableProps) => {
  const orEmpty = (value: string | null | undefined): string =>
    value === null || value === undefined || value === '' ? t.values.empty : value;

  const columns: Column<HierarchyCode>[] = [
    {
      key: 'code',
      header: adapter.labels.code,
      align: 'center',
      width: '150px',
      render: (row) => row.code,
    },
    { key: 'name', header: adapter.labels.name, align: 'center', render: (row) => row.name },
    {
      key: 'nameKo',
      header: t.fields.nameKo,
      align: 'center',
      render: (row) => orEmpty(row.nameKo),
    },
    {
      key: 'nameVi',
      header: t.fields.nameVi,
      align: 'center',
      render: (row) => orEmpty(row.nameVi),
    },
    ...(adapter.hasDisposition
      ? [
          {
            key: 'disposition',
            header: t.fields.disposition,
            align: 'center' as const,
            render: (row: HierarchyCode) =>
              row.dispositionTypeCode === null || row.dispositionTypeCode === undefined
                ? t.values.empty
                : t.values.disposition[row.dispositionTypeCode],
          },
        ]
      : []),
    {
      key: 'process',
      header: t.fields.process,
      align: 'center',
      render: (row) => orEmpty(processLabelOf(row.processId)),
    },
    {
      key: 'isActive',
      header: t.fields.isActive,
      align: 'center',
      render: (row) => (
        <Chip variant="status" status={row.isActive ? 'success' : 'idle'}>
          {row.isActive ? t.detail.chipActive : t.detail.chipInactive}
        </Chip>
      ),
    },
  ];

  return (
    <section className="defect-cause-children" aria-label={t.detail.childrenTitle}>
      <h3 className="field-label">{t.detail.childrenCount(codes.length)}</h3>
      {codes.length === 0 ? (
        <p className="field-note">{t.detail.childrenEmpty}</p>
      ) : (
        <div className="inspection-queue-table inspection-standard-table-box">
          <Table
            density="compact"
            columns={columns}
            rows={codes}
            getRowId={(row) => String(row.id)}
          />
        </div>
      )}
    </section>
  );
};
