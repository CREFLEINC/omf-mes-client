import { Button, Chip, type Column, EmptyState, Icon, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { useColumnOrder } from '../../patterns/column-grip-order';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnWidths } from '../../patterns/column-resize';
import { PageNav, type PageNavMeta, type PageSize } from '../../patterns/page-nav';
import type { CodeAdapter } from './adapters';
import { DEFAULT_CODE_FILTERS } from './code-options';
import { ORPHAN_GROUP_KEY, groupKeyOf, isCategory } from './hierarchy';
import type { CodeFilters, HierarchyCode } from './types';

const t = messages.defectCauseCode;

export interface CodeListPaneProps {
  /** 탭이 무엇인지는 어댑터만 안다 — 이 부품은 라벨과 화면 표현만 다룬다. */
  adapter: CodeAdapter;
  /** 표시 순서로 이미 정렬된 행. 디자인 시스템 `Table`의 그룹 순서가 이 배열 순서로 정해진다. */
  rows: HierarchyCode[];
  /** 그룹 판정에 쓰는 색인. 상위가 여기 없으면 그 행은 고아 그룹으로 간다. */
  byId: ReadonlyMap<number, HierarchyCode>;
  isLoading: boolean;
  /** 적용된 조건 — 0건 안내를 가른다(조건 줄은 `CodeFilterBar` 가 목록 위에 따로 세운다) */
  appliedFilters: CodeFilters;
  /** 0건 안내의 초기화가 호출한다 */
  onApplyFilters: (next: CodeFilters) => void;
  /** 서버가 준 쪽 정보 — 공용 쪽 이동(총 건수 · 쪽 크기 · 처음/이전/다음/마지막)이 읽는다(#209). */
  pageMeta: PageNavMeta;
  onChangePage: (page: number) => void;
  onChangePageSize: (size: PageSize) => void;
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** 공정 번호 → 「공정코드 · 공정명」. 공정이 없으면 null */
  processLabelOf: (processId: number | null | undefined) => string | null;
  /** 등록된 코드가 없을 때 빈 안내의 단추 */
  onAddCategory: () => void;
  /**
   * 조회 실패 표시. null이 아니면 표·빈 상태 대신 이것을 낸다 —
   * 실패를 「등록된 코드가 없습니다」로 보이면 사실과 다른 안내가 된다.
   */
  loadError: ReactNode;
}

const hasAnyFilter = (filters: CodeFilters): boolean => filters.q !== '' || filters.includeInactive;

/** 둥근 바탕 아이콘 — 검사 기준 탭의 빈 안내와 같은 모양(#196). */
const EmptyIcon = ({ name }: { name: string }) => (
  <span className="inspection-standard-empty-icon">
    <Icon name={name} size={20} />
  </span>
);

/** 좌 페인 — 코드를 대분류별로 묶어 보이고 골라 상세를 여는 자리. */
export const CodeListPane = ({
  adapter,
  rows,
  byId,
  isLoading,
  appliedFilters,
  onApplyFilters,
  pageMeta,
  onChangePage,
  onChangePageSize,
  selectedId,
  onSelect,
  processLabelOf,
  onAddCategory,
  loadError,
}: CodeListPaneProps) => {
  const orEmpty = (value: string | null | undefined): string =>
    value === null || value === undefined || value === '' ? t.values.empty : value;

  const groupLabel = (groupKey: string): string => {
    if (groupKey === ORPHAN_GROUP_KEY) return t.groupHeaderOrphan;

    const head = byId.get(Number(groupKey));
    return head === undefined ? groupKey : t.values.groupHeader(head.code, head.name);
  };

  const columns: Column<HierarchyCode>[] = [
    {
      key: 'code',
      align: 'center',
      header: adapter.labels.listCode,
      width: '160px',
      /*
       * 코드는 링크 모양을 걷고 본문 글자로 둔다 — 줄 아무 곳이나 눌러 고른다(검사 기준 탭과 같다 · #209).
       * 단추는 남긴다: 키보드·화면 낭독기가 줄을 고르는 길이고, 고른 줄 표시(`aria-current`)가 여기 실린다.
       */
      render: (row) => (
        <button
          type="button"
          className="inspection-standard-plan-open defect-cause-open"
          aria-current={row.id === selectedId ? 'true' : undefined}
          title={row.code}
          onClick={() => onSelect(row.id)}
        >
          {row.code}
        </button>
      ),
    },
    {
      key: 'name',
      align: 'center',
      header: adapter.labels.listName,
      // 폭을 정하지 않는다 — 남는 폭을 이 열이 맡는다(검사 기준 탭과 같다).
      render: (row) => <span title={row.name}>{row.name}</span>,
    },
    /* 서버가 목록에 주는 값을 모두 싣는다(사용자 지시 · #209) — 한국어명 · 베트남어명 · 처분 유형 · 공정. */
    {
      key: 'nameKo',
      align: 'center',
      header: t.fields.nameKo,
      width: '140px',
      render: (row) => <span title={row.nameKo ?? undefined}>{orEmpty(row.nameKo)}</span>,
    },
    {
      key: 'nameVi',
      align: 'center',
      header: t.fields.nameVi,
      width: '140px',
      render: (row) => <span title={row.nameVi ?? undefined}>{orEmpty(row.nameVi)}</span>,
    },
    {
      key: 'kind',
      align: 'center',
      header: t.listColumns.kind,
      width: '96px',
      render: (row) => (isCategory(row) ? t.detail.kindCategory : t.detail.kindChild),
    },
    ...(adapter.hasDisposition
      ? [
          {
            key: 'dispositionTypeCode',
            align: 'center' as const,
            header: t.fields.disposition,
            width: '112px',
            render: (row: HierarchyCode) =>
              row.dispositionTypeCode === null || row.dispositionTypeCode === undefined
                ? t.values.empty
                : t.values.disposition[row.dispositionTypeCode],
          },
        ]
      : []),
    {
      key: 'processId',
      align: 'center',
      header: t.fields.process,
      width: '160px',
      render: (row) => {
        const label = processLabelOf(row.processId);
        return <span title={label ?? undefined}>{orEmpty(label)}</span>;
      },
    },
    {
      key: 'isActive',
      align: 'center',
      header: t.listColumns.isActive,
      width: '96px',
      render: (row) => (
        <Chip variant="status" size="sm" status={row.isActive ? 'success' : 'idle'}>
          {row.isActive ? t.detail.chipActive : t.detail.chipInactive}
        </Chip>
      ),
    },
  ];

  /*
   * 열 순서·폭은 사용자가 바꾸고 브라우저에 남는다 — 검사 기준 탭과 같다(#209). 탭마다 따로 남긴다.
   * `:v2` — 한국어명 · 베트남어명 · 처분 유형 · 공정 칸을 더한 뒤라, 그 전에 남은 순서를 버리고 새로 시작한다.
   */
  const ordered = useColumnOrder(
    `omf-mes:defect-cause-code:columns:${adapter.kind}:order:v2`,
    columns,
  );
  const resizable = useColumnWidths(
    `omf-mes:defect-cause-code:columns:${adapter.kind}:v2`,
    ordered,
    {
      fitContent: true,
    },
  );
  /* 상자 폭을 넘지 않는다 — 넓혀 둔 열이 많으면 비율대로 줄여 맞춘다. 더 넓히면 표 안에서 가로로 구른다. */
  const fit = useFitColumns(resizable.columns, { scrollX: true });

  const emptySlot = hasAnyFilter(appliedFilters) ? (
    <EmptyState
      size="sm"
      live
      icon={<EmptyIcon name="search_off" />}
      title={t.empty.codeNoMatchTitle}
      description={t.empty.codeNoMatchDescription}
      action={
        <Button variant="outlined" onClick={() => onApplyFilters(DEFAULT_CODE_FILTERS)}>
          {messages.common.reset}
        </Button>
      }
    />
  ) : (
    <EmptyState
      size="sm"
      live
      icon={<EmptyIcon name="list_alt" />}
      title={t.empty.codeNoneTitle}
      description={t.empty.codeNoneDescription}
      action={<Button onClick={onAddCategory}>{t.actions.addCategory}</Button>}
    />
  );

  /** 조회 실패 → 로딩 → 표 순서로 하나만 낸다. 실패했는데 빈 표를 함께 보이면 안 된다. */
  const listSlot = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.codes}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      /*
       * 줄 아무 곳이나 눌러도 고른다 — DS 표에 줄 클릭이 없어 눌린 줄의 코드 단추로 넘긴다(검사 기준 탭과 같다).
       * 키보드·화면 낭독기는 그 단추 하나로 고른다(줄마다 탭 멈춤을 늘리지 않는다).
       */
      <div
        ref={fit.ref}
        className="inspection-queue-table inspection-standard-plan-rows inspection-standard-table-box defect-cause-rows"
        style={resizable.style}
        onClick={(event) => {
          const target = event.target as Element;
          if (target.closest('button, a, input, select, textarea') !== null) return;
          target
            .closest('tbody tr')
            ?.querySelector<HTMLButtonElement>('.defect-cause-open')
            ?.click();
        }}
      >
        <Table
          density="compact"
          columns={fit.columns}
          rows={rows}
          getRowId={(row) => String(row.id)}
          // 행 순서 재배치(reorderable)는 쓰지 않는다 — groupBy와 병용하면 조용히 무시된다.
          groupBy={(row) => groupKeyOf(row, byId)}
          renderGroupHeader={(groupKey) => groupLabel(groupKey)}
          empty={emptySlot}
        />
      </div>
    );
  };

  return (
    <section
      className="pane inspection-standard-list-pane defect-cause-list-pane"
      aria-label={t.panes.list(adapter.labels.tab)}
    >
      {listSlot()}

      {(loadError === null || loadError === undefined) && !isLoading && (
        <PageNav
          meta={pageMeta}
          buttonSize="md"
          onChangePage={onChangePage}
          onChangeSize={onChangePageSize}
        />
      )}
    </section>
  );
};
