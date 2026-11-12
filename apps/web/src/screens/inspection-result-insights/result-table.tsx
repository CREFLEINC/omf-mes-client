import { type Column, EmptyState, type SortState, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { useColumnOrder } from '../../patterns/column-grip-order';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnWidths } from '../../patterns/column-resize';
import { lookupDisplayLabelWithInactive, type LookupSource } from '../../patterns/lookup-display';
import { formatPlantDateTime } from '../../patterns/plant-time';
import type { InspectionResultTreeRow } from './reinspection-chain';
import { useItemNames } from './item-names';
import { useUomCodeOf } from './uoms';

const t = messages.inspectionResultInsights.overview;
const EMPTY = t.unknown;
/* 목록의 유형 열은 요약·추이의 모집단 이름과 같은 말을 쓴다. */
const TYPE_LABELS = new Map<string, string>(
  Object.entries(messages.inspectionResultInsights.inspectionTypes),
);

const dateTime = (value: string): string => formatPlantDateTime(value) ?? value;
const number = (value: number): string => new Intl.NumberFormat('ko-KR').format(value);

interface ResultTableProps {
  rows: InspectionResultTreeRow[];
  labels: { item: LookupSource; judgment: LookupSource };
  sort: SortState;
  onSortChange: (sort: SortState | null) => void;
  /** 지금 상세에 연 검사 결과 — 그 줄을 파란 바탕으로 표시한다. */
  selectedId: number | null;
  onSelect: (inspectionResultId: number) => void;
  /** 좌우 배치라 칸이 좁으면 열을 줄이지 않고 표 안에서 가로로 구른다. */
  scrollX: boolean;
  isBusy: boolean;
}

/**
 * 검사 결과 목록 — 검사 조회·판정의 대기 목록과 같은 표(사용자 2026-10-30 · #217).
 * 열 폭은 px 로 두고 머리 경계를 끌어 바꾸며, 손잡이로 열 순서를 옮긴다(둘 다 브라우저에 남는다).
 * 의뢰번호 · 품목 · LOT 번호는 왼쪽, 나머지는 가운데. 줄 아무 곳이나 눌러 상세를 연다(키보드는 의뢰번호 단추 하나로).
 */
export const ResultTable = ({
  rows,
  labels,
  sort,
  onSortChange,
  selectedId,
  onSelect,
  scrollX,
  isBusy,
}: ResultTableProps) => {
  const uomCodeOf = useUomCodeOf();
  const itemNames = useItemNames(rows.map((row) => row.result.itemId));
  const columns: Column<InspectionResultTreeRow>[] = [
    {
      key: 'inspectionRequestNo',
      header: t.columns.inspectionRequestNo,
      align: 'start',
      width: '180px',
      sortable: true,
      /* 의뢰번호는 글자 — 줄 아무 곳이나 눌러 상세를 연다(사용자 2026-11-02, PQC 검사 대기 목록과 같다). 재검 회차는 들여 쓴다. */
      render: (row) => (
        <span
          className="tree-toggle inspection-results-request-no"
          data-depth={row.depth}
          style={{ paddingInlineStart: `${String(row.depth)}rem` }}
          title={row.result.inspectionRequestNo ?? EMPTY}
          aria-current={row.result.inspectionResultId === selectedId ? 'true' : undefined}
        >
          {row.result.inspectionRequestNo ?? EMPTY}
        </span>
      ),
    },
    {
      key: 'inspectionTypeCode',
      header: t.columns.inspectionType,
      align: 'center',
      width: '140px',
      render: (row) => TYPE_LABELS.get(row.result.inspectionTypeCode ?? '') ?? EMPTY,
    },
    {
      key: 'item',
      header: t.columns.item,
      align: 'start',
      width: '220px',
      render: (row) =>
        (row.result.itemId === undefined ? undefined : itemNames.get(row.result.itemId)?.label) ??
        lookupDisplayLabelWithInactive(labels.item, row.result.itemId),
    },
    {
      key: 'lotNo',
      header: t.columns.lotNo,
      align: 'start',
      width: '280px',
      render: (row) => row.result.lotNo ?? EMPTY,
    },
    {
      key: 'rejectedQty',
      header: t.columns.quantities,
      align: 'center',
      width: '200px',
      sortable: true,
      /* 수량 뒤에 그 줄의 단위(예: 100 / 98 / 2 EA) — 단위를 못 풀면 수량만(사용자 2026-10-30). */
      render: (row) => {
        const quantities = `${number(row.result.inspectedQty)} / ${number(row.result.acceptedQty)} / ${number(row.result.rejectedQty)}`;
        const unit = uomCodeOf(row.result.uomId);
        return unit === null ? quantities : `${quantities} ${unit}`;
      },
    },
    {
      key: 'overallJudgmentCode',
      header: t.columns.judgment,
      align: 'center',
      width: '110px',
      render: (row) =>
        lookupDisplayLabelWithInactive(labels.judgment, row.result.overallJudgmentCode),
    },
    {
      key: 'inspector',
      header: t.columns.inspector,
      align: 'center',
      width: '150px',
      render: (row) => row.result.inspectorName ?? EMPTY,
    },
    {
      key: 'inspectedAt',
      header: t.columns.inspectedAt,
      align: 'center',
      width: '220px',
      sortable: true,
      /* 005 D-18 — 확정 주기가 있으면 「처음」·「재검 n차」, 없으면(옛 IQC · PQC · OQC) 지금처럼 회차. */
      render: (row) =>
        row.cycleLabel === null
          ? t.inspectedAtWithRound(dateTime(row.result.inspectedAt), row.result.inspectionRound)
          : t.inspectedAtWithCycle(dateTime(row.result.inspectedAt), row.cycleLabel),
    },
  ];
  /* 순서를 먼저 정하고 그 위에 폭 손잡이를 단다 — 검사 조회·판정 목록과 같다. */
  const ordered = useColumnOrder('omf-mes:inspection-results:columns:list:order', columns);
  const resizable = useColumnWidths('omf-mes:inspection-results:columns:list', ordered, {
    fitContent: scrollX,
  });
  const fit = useFitColumns(resizable.columns, { scrollX });

  return (
    <div
      ref={fit.ref}
      className="wide-table inspection-results-table inspection-results-list inspection-queue-table"
      style={resizable.style}
      aria-busy={isBusy}
      onClick={(event) => {
        const target = event.target as Element;
        if (target.closest('button, a, input, select, textarea') !== null) return;
        const row = target.closest('tbody tr');
        if (row === null || row.parentElement === null) return;
        const picked = rows[Array.from(row.parentElement.children).indexOf(row)];
        if (picked !== undefined) onSelect(picked.result.inspectionResultId);
      }}
    >
      <Table
        density="compact"
        caption={t.caption}
        columns={fit.columns}
        rows={rows}
        getRowId={(row) => String(row.result.inspectionResultId)}
        sort={sort}
        onSortChange={onSortChange}
        empty={<EmptyState size="sm" title={t.empty} />}
      />
    </div>
  );
};
