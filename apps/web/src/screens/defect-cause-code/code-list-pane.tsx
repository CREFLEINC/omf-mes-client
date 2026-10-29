import { Button, Chip, type Column, EmptyState, Icon, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useMemo, useState } from 'react';

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

/** 표의 한 줄 — 대분류(머리)이거나 그 아래 상세(가지). 머리의 `code` 가 없으면 대분류를 못 찾은 묶음이다. */
interface TreeRow {
  key: string;
  groupKey: string;
  role: 'head' | 'child';
  code: HierarchyCode | null;
  /** 머리 — 이 대분류에 딸린 상세 수(전체 목록 기준) */
  childCount: number;
  /** 가지 — 묶음의 마지막 줄이면 세로선을 여기서 끝낸다 */
  isLast: boolean;
}

/**
 * 묶음 순서로 정렬된 행(`orderForGrouping`)을 머리 · 가지 줄로 편다.
 * 대분류가 이 쪽에 없으면 색인에서 찾아 머리로 세운다 — 찾지 못하면 이름 없는 머리 아래 모은다.
 */
const buildTree = (
  rows: readonly HierarchyCode[],
  byId: ReadonlyMap<number, HierarchyCode>,
  collapsed: ReadonlySet<string>,
): TreeRow[] => {
  const all = [...byId.values()];
  const out: TreeRow[] = [];
  let current: string | null = null;

  for (const row of rows) {
    const groupKey = groupKeyOf(row, byId);
    if (groupKey !== current) {
      current = groupKey;
      const head = groupKey === ORPHAN_GROUP_KEY ? null : (byId.get(Number(groupKey)) ?? null);
      out.push({
        key: `head:${groupKey}`,
        groupKey,
        role: 'head',
        code: head,
        childCount:
          head === null
            ? rows.filter((item) => groupKeyOf(item, byId) === ORPHAN_GROUP_KEY).length
            : all.filter((item) => item.parentId === head.id && item.id !== head.id).length,
        isLast: false,
      });
    }
    if (String(row.id) === groupKey) continue; // 대분류 자신은 머리 줄이 이미 그렸다.
    if (collapsed.has(groupKey)) continue;
    out.push({
      key: `row:${String(row.id)}`,
      groupKey,
      role: 'child',
      code: row,
      childCount: 0,
      isLast: false,
    });
  }

  for (let index = 0; index < out.length; index += 1) {
    const row = out[index];
    const next = out[index + 1];
    if (row !== undefined && row.role === 'child')
      row.isLast = next === undefined || next.role === 'head';
  }

  return out;
};

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

  /* 접어 둔 대분류(그룹 키). 이 화면에 머무는 동안만 기억한다. */
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (key: string): void =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  /*
   * 대분류 줄이 곧 그룹 머리다 — 따로 머리글 줄을 두지 않고, 상세는 선으로 이어 그 아래에 둔다(사용자 지시 · #209).
   * 대분류가 다른 쪽에 있으면 그 대분류를 머리로 세워(값 표시 · 고를 수 있다) 관계가 끊겨 보이지 않게 한다.
   */
  const tree = useMemo(() => buildTree(rows, byId, collapsed), [rows, byId, collapsed]);

  const codeCell = (row: TreeRow): ReactNode => {
    const open =
      row.code === null ? (
        <span className="defect-cause-orphan">{t.groupHeaderOrphan}</span>
      ) : (
        /*
         * 코드는 링크 모양을 걷고 본문 글자로 둔다 — 줄 아무 곳이나 눌러 고른다(검사 기준 탭과 같다 · #209).
         * 단추는 남긴다: 키보드·화면 낭독기가 줄을 고르는 길이고, 고른 줄 표시(`aria-current`)가 여기 실린다.
         */
        <button
          type="button"
          className="inspection-standard-plan-open defect-cause-open"
          aria-current={row.code.id === selectedId ? 'true' : undefined}
          title={row.code.code}
          onClick={() => {
            if (row.code !== null) onSelect(row.code.id);
          }}
        >
          {row.code.code}
        </button>
      );

    if (row.role === 'child') {
      return (
        <span className="defect-cause-tree-child" data-last={row.isLast ? 'true' : undefined}>
          {open}
        </span>
      );
    }

    const isOpen = !collapsed.has(row.groupKey);
    return (
      <span className="defect-cause-tree-head">
        <button
          type="button"
          className="defect-cause-fold"
          aria-expanded={isOpen}
          aria-label={isOpen ? t.tree.collapse : t.tree.expand}
          disabled={row.childCount === 0}
          onClick={() => toggle(row.groupKey)}
        >
          <Icon name={isOpen ? 'expand_more' : 'chevron_right'} size={18} />
        </button>
        <span className="defect-cause-head-text">
          {open}
          <span className="defect-cause-child-count">{t.tree.childCount(row.childCount)}</span>
        </span>
      </span>
    );
  };

  /** 대분류를 못 찾은 머리 줄(`code` 없음)은 다른 칸을 비운다. */
  const cell = (render: (code: HierarchyCode) => ReactNode) => (row: TreeRow) =>
    row.code === null ? null : render(row.code);

  const columns: Column<TreeRow>[] = [
    {
      key: 'code',
      align: 'start',
      header: adapter.labels.listCode,
      width: '200px',
      render: codeCell,
    },
    {
      key: 'name',
      align: 'center',
      header: adapter.labels.listName,
      // 폭을 정하지 않는다 — 남는 폭을 이 열이 맡는다(검사 기준 탭과 같다).
      render: cell((row) => <span title={row.name}>{row.name}</span>),
    },
    /* 서버가 목록에 주는 값을 모두 싣는다(사용자 지시 · #209) — 한국어명 · 베트남어명 · 처분 유형 · 공정. */
    {
      key: 'nameKo',
      align: 'center',
      header: t.fields.nameKo,
      width: '140px',
      render: cell((row) => <span title={row.nameKo ?? undefined}>{orEmpty(row.nameKo)}</span>),
    },
    {
      key: 'nameVi',
      align: 'center',
      header: t.fields.nameVi,
      width: '140px',
      render: cell((row) => <span title={row.nameVi ?? undefined}>{orEmpty(row.nameVi)}</span>),
    },
    {
      key: 'kind',
      align: 'center',
      header: t.listColumns.kind,
      width: '96px',
      render: cell((row) => (isCategory(row) ? t.detail.kindCategory : t.detail.kindChild)),
    },
    ...(adapter.hasDisposition
      ? [
          {
            key: 'dispositionTypeCode',
            align: 'center' as const,
            header: t.fields.disposition,
            width: '112px',
            render: cell((row) =>
              row.dispositionTypeCode === null || row.dispositionTypeCode === undefined
                ? t.values.empty
                : t.values.disposition[row.dispositionTypeCode],
            ),
          },
        ]
      : []),
    {
      key: 'processId',
      align: 'center',
      header: t.fields.process,
      width: '160px',
      render: cell((row) => {
        const label = processLabelOf(row.processId);
        return <span title={label ?? undefined}>{orEmpty(label)}</span>;
      }),
    },
    {
      key: 'isActive',
      align: 'center',
      header: t.listColumns.isActive,
      width: '96px',
      render: cell((row) => (
        <Chip variant="status" size="sm" status={row.isActive ? 'success' : 'idle'}>
          {row.isActive ? t.detail.chipActive : t.detail.chipInactive}
        </Chip>
      )),
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
          rows={tree}
          getRowId={(row) => row.key}
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
