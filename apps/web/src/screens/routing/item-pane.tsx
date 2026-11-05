import { Button, Chip, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useId, useState } from 'react';

import { useColumnOrder } from '../../patterns/column-grip-order';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnWidths } from '../../patterns/column-resize';
import { TAB_PAGE_SIZES, type TabPageSize } from '../../patterns/client-page';
import { useApiClient } from '../../patterns/api-context';
import { PageNav, type PageNavMeta } from '../../patterns/page-nav';
import { runRequest } from '../../patterns/request';
import { PagedSelect } from '../../patterns/select';
import { HubActions, useHubActionsTarget } from '../../patterns/hub-actions';
import {
  type ItemRevisionSummary,
  type ItemStatusChip,
  toStatusFilters,
  useItemStatusCounts,
} from './queries';
import type { Item, ItemFilters } from './types';
import { resolveRoutingStatus } from './routing-status';
import { centerColumns } from './table-align';

const t = messages.routing;

/** 화면을 처음 열었을 때의 조회 조건. 예시 데이터가 아니라 화면 상수라 여기가 자리다. */
export const DEFAULT_ITEM_FILTERS: ItemFilters = {
  q: '',
  onlyWithoutRouting: false,
  latestStatus: '',
};

/** 검색 칸이 한 번에 받는 건수 — 목록 끝에 닿으면 다음 쪽을 받는다. */
const SEARCH_PAGE_SIZE = 20;

export interface ItemFilterBarProps {
  /** 적용된(URL에 반영된) 조건 — 조건 칩의 렌더 기준 */
  appliedFilters: ItemFilters;
  /** 조회 버튼·Enter·칩 제거·초기화가 호출 */
  onApplyFilters: (next: ItemFilters) => void;
}

export interface ItemPaneProps {
  items: Item[];
  isLoading: boolean;
  /** 적용된 조건 — 빈 목록 안내(조건 없음 / 조건에 맞는 품목 없음)를 가른다. */
  appliedFilters: ItemFilters;
  /** 빈 목록 안내의 「초기화」가 호출 */
  onApplyFilters: (next: ItemFilters) => void;
  selectedItemId: number | null;
  onSelect: (itemId: number) => void;
  /** 품목의 개정 요약(기본 Rev · 작성중 Rev · 개정 수) — undefined 는 아직 받는 중(#231). */
  revisionSummaryOf: (itemId: number) => ItemRevisionSummary | undefined;
  /** 쪽 이동 줄 — 총 건수 · 건수 고르기 · 처음/이전/다음/마지막(#231). */
  pageMeta: PageNavMeta;
  onChangePage: (page: number) => void;
  onChangePageSize: (size: TabPageSize) => void;
  /**
   * 조회 실패 표시. null이 아니면 표·빈 상태 대신 이것을 낸다 —
   * 실패를 「등록된 품목이 없습니다」로 보이면 사실과 다른 안내가 된다.
   */
  loadError: ReactNode;
}

const hasAnyFilter = (filters: ItemFilters): boolean =>
  filters.q !== '' || filters.onlyWithoutRouting || filters.latestStatus !== '';

/**
 * 품목 조회 조건 — 목록 위 조회 상자에 선다(검사 조회·판정과 같은 짜임 · omf-all-around#231).
 * 결과가 없어도 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다.
 */
export const ItemFilterBar = ({ appliedFilters, onApplyFilters }: ItemFilterBarProps) => {
  const { client } = useApiClient();
  const searchId = useId();
  // 트리거 모델: 편집은 모아서 적용, 해제는 즉시. 편집 중인 값은 draft에만 있고 조건 칩에 미러하지 않는다.
  const [draft, setDraft] = useState<ItemFilters>(appliedFilters);
  const {
    q: appliedQ,
    onlyWithoutRouting: appliedOnlyWithoutRouting,
    latestStatus: appliedLatestStatus,
  } = appliedFilters;

  useEffect(() => {
    setDraft({
      q: appliedQ,
      onlyWithoutRouting: appliedOnlyWithoutRouting,
      latestStatus: appliedLatestStatus,
    });
  }, [appliedQ, appliedOnlyWithoutRouting, appliedLatestStatus]);

  return (
    <>
      <div className="filter-bar">
        {/*
         * 품목은 칸에서 바로 검색해서 고른다(다른 화면과 같다 · #226 · #231) — 고른 품목코드가 검색어로 들어간다.
         * 「전체」는 조건을 푼다. 조회를 눌러야 목록에 걸린다(종전 검색어와 같은 트리거 · 같은 서버 조건 `q`).
         */}
        <div className="field-cell search-select-cell">
          <label className="field-label" htmlFor={searchId}>
            {t.filters.searchLabel}
          </label>
          <PagedSelect
            id={searchId}
            queryKey={[
              'routing-items',
              'item-select',
              appliedFilters.onlyWithoutRouting,
              appliedFilters.latestStatus,
            ]}
            fetchPage={async (q, page) => {
              const data = await runRequest(() =>
                client.GET('/mdm/items', {
                  params: {
                    query: {
                      ...(q === '' ? {} : { q }),
                      /* 목록과 같은 범위에서 찾는다 — 목록에 없는 품목을 고르지 않게. */
                      ...(appliedFilters.onlyWithoutRouting ? { hasRouting: false } : {}),
                      ...(appliedFilters.latestStatus === ''
                        ? {}
                        : { latestRoutingStatus: appliedFilters.latestStatus }),
                      page,
                      size: SEARCH_PAGE_SIZE,
                    },
                  },
                }),
              );
              return {
                options: data.items.map((item) => ({
                  value: item.itemCode,
                  label: `${item.itemCode} · ${item.itemName}`,
                })),
                total: data.page.total,
              };
            }}
            selectedOption={draft.q === '' ? null : { value: draft.q, label: draft.q }}
            leadingOptions={[{ value: '', label: t.filters.all }]}
            value={draft.q}
            placeholder={t.filters.all}
            onChange={(value) => setDraft((prev) => ({ ...prev, q: value }))}
          />
        </div>

        {/* 「공정 경로 미등록」 체크는 진행 상태 칩 「미등록」으로 옮겼다(#231). */}
        {/* 조회와 초기화는 짝이라 함께 줄바꿈되게 묶는다(배치 규범 2-1). 라벨 층은 묶음이 한 번만 갖는다. */}
        <div className="filter-actions field-cell-unlabeled">
          <Button onClick={() => onApplyFilters(draft)}>{messages.common.search}</Button>
          <Button variant="outlined" onClick={() => onApplyFilters(DEFAULT_ITEM_FILTERS)}>
            {messages.common.reset}
          </Button>
        </div>
      </div>

      {appliedFilters.q !== '' && (
        <div className="filter-bar">
          {appliedFilters.q !== '' && (
            <Chip
              variant="status"
              removeLabel={t.filters.chipRemoveKeyword}
              onRemove={() => onApplyFilters({ ...appliedFilters, q: '' })}
            >
              {t.filters.chipKeyword(appliedFilters.q)}
            </Chip>
          )}
        </div>
      )}
    </>
  );
};

const STATUS_CHIPS: readonly { value: ItemStatusChip; label: string }[] = [
  { value: 'DRAFT', label: t.values.draft },
  { value: 'CONFIRMED', label: t.values.confirmed },
  { value: 'OBSOLETE', label: t.values.obsolete },
  { value: 'NONE', label: t.values.unregistered },
];

const selectedStatusChip = (filters: ItemFilters): ItemStatusChip =>
  filters.onlyWithoutRouting ? 'NONE' : filters.latestStatus;

/**
 * 진행 상태 칩 「작성중 N · 확정 N · 폐기 N · 미등록 N」(사용자 지시 · #231) — 검사 조회·판정의 판정 칩과 같은 자리 · 모양.
 * 누르면 그 상태로 바로 거르고, 고른 칩을 다시 누르면 거르기를 푼다. 건수는 지금 검색어로 센다. 탭 묶음 밖이면 조회 상자 위에 선다.
 */
export const ItemStatusChips = ({ appliedFilters, onApplyFilters }: ItemFilterBarProps) => {
  const target = useHubActionsTarget();
  const counts = useItemStatusCounts(
    appliedFilters.q,
    STATUS_CHIPS.map((chip) => chip.value),
  );
  const selected = selectedStatusChip(appliedFilters);
  const group = (
    <div className="inspection-hub-counts" role="group" aria-label={t.fields.progressStatus}>
      {STATUS_CHIPS.map((chip, index) => {
        const isActive = selected === chip.value;
        const count = counts[index];
        return (
          <Chip
            key={chip.value}
            variant="filter"
            size="sm"
            selected={isActive}
            aria-pressed={isActive}
            /* 고른 칩을 한 번 더 누르면 거르기를 푼다 — 「전체」 칩을 두지 않는다(사용자 지시 · #231). */
            onSelectedChange={() =>
              onApplyFilters({
                ...appliedFilters,
                ...toStatusFilters(isActive ? '' : chip.value),
              })
            }
          >
            {count === undefined
              ? chip.label
              : messages.common.inspectionHub.count(chip.label, count)}
          </Chip>
        );
      })}
    </div>
  );
  return target === null ? group : <HubActions target={target}>{group}</HubActions>;
};

/** 품목 목록 — Routing은 품목에 매달리므로 이 선택이 화면 전체의 출발점이다. */
export const ItemPane = ({
  items,
  isLoading,
  appliedFilters,
  onApplyFilters,
  selectedItemId,
  onSelect,
  revisionSummaryOf,
  pageMeta,
  onChangePage,
  onChangePageSize,
  loadError,
}: ItemPaneProps) => {
  const columns: Column<Item>[] = [
    {
      key: 'itemCode',
      header: t.fields.itemCode,
      /* 짧은 칸은 기본 폭을 준다 — 폭이 없으면 모든 칸이 똑같이 줄어 상태 라벨까지 잘렸다(#231). 품목명이 남는 폭을 가진다. */
      width: '120px',
      /*
       * 코드는 링크 모양 없이 본문 글자 — 줄 아무 곳이나 눌러 고른다(검사 기준 탭과 같다 · #231).
       * 단추는 남긴다: 키보드·화면 낭독기가 줄을 고르는 길이고, 고른 줄 표시(`aria-current`)가 여기 실린다.
       */
      render: (row) => (
        <button
          type="button"
          className="inspection-standard-plan-open routing-item-open"
          aria-current={row.itemId === selectedItemId ? 'true' : undefined}
          title={row.itemCode}
          onClick={() => onSelect(row.itemId)}
        >
          {row.itemCode}
        </button>
      ),
    },
    { key: 'itemName', header: t.fields.itemName },
    /*
     * 최신 Rev · 진행 상태 · 개정 수 · 기본 Rev(사용자 시안 · #231).
     * 받는 중이면 비워 둔다 — 「아직 모른다」와 「없다(—·미등록)」가 같아 보이지 않게.
     */
    {
      key: 'latestRevision',
      header: t.fields.latestRevision,
      width: '80px',
      render: (row) => {
        const summary = revisionSummaryOf(row.itemId);
        if (summary === undefined) return '';
        const revision = summary.latestRevision;
        return revision === null ? t.values.empty : t.values.revision(revision.routingVersion);
      },
    },
    {
      key: 'progressStatus',
      header: t.fields.progressStatus,
      width: '88px',
      render: (row) => {
        const summary = revisionSummaryOf(row.itemId);
        if (summary === undefined) return '';
        const revision = summary.latestRevision;
        /* 라벨로 낸다 — 개정 목록의 상태 열과 같은 작은 칩(사용자 지시 · #231). 미등록은 노랑 — 등록할 일이 남았다. */
        if (revision === null) {
          return (
            <Chip variant="status" size="sm" status="warning">
              {t.values.unregistered}
            </Chip>
          );
        }
        const status = resolveRoutingStatus(revision.statusCode);
        return (
          <Chip variant="status" size="sm" status={status.tone}>
            {status.label}
          </Chip>
        );
      },
    },
    {
      key: 'revisionCount',
      header: t.fields.revisionCount,
      width: '80px',
      render: (row) => {
        const summary = revisionSummaryOf(row.itemId);
        return summary === undefined ? '' : String(summary.revisionCount);
      },
    },
    {
      key: 'defaultRevision',
      header: t.fields.defaultRevision,
      width: '80px',
      render: (row) => {
        const summary = revisionSummaryOf(row.itemId);
        if (summary === undefined) return '';
        const revision = summary.defaultRevision;
        return revision === null ? t.values.empty : t.values.revision(revision.routingVersion);
      },
    },
  ];

  /* 열 순서·폭은 사용자가 바꾸고 브라우저에 남는다(표 공통 · #231). */
  const ordered = useColumnOrder('omf-mes:routing:item-columns:order', centerColumns(columns));
  const resizable = useColumnWidths('omf-mes:routing:item-columns', ordered, { fitContent: true });
  /* 상자 폭을 넘지 않는다 — 넓혀 둔 열이 많으면 비율대로 줄여 맞춘다. 더 넓히면 표 안에서 가로로 구른다. */
  const fit = useFitColumns(resizable.columns, { scrollX: true });

  const emptySlot = hasAnyFilter(appliedFilters) ? (
    <EmptyState
      size="sm"
      live
      title={t.empty.itemNoMatchTitle}
      description={t.empty.itemNoMatchDescription}
      action={
        <Button variant="outlined" onClick={() => onApplyFilters(DEFAULT_ITEM_FILTERS)}>
          {messages.common.reset}
        </Button>
      }
    />
  ) : (
    <EmptyState
      size="sm"
      live
      title={t.empty.itemNoneTitle}
      description={t.empty.itemNoneDescription}
    />
  );

  /** 조회 실패 → 로딩 → 표 순서로 하나만 낸다. 실패했는데 빈 표를 함께 보이면 안 된다. */
  const listSlot = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.items}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      /* 줄 아무 곳이나 눌러도 고른다 — DS 표에 줄 클릭이 없어 눌린 줄의 코드 단추로 넘긴다. */
      <div
        ref={fit.ref}
        className="inspection-queue-table inspection-standard-plan-rows inspection-standard-table-box wide-table"
        style={resizable.style}
        onClick={(event) => {
          const target = event.target as Element;
          if (target.closest('button, a, input, select, textarea') !== null) return;
          target
            .closest('tbody tr')
            ?.querySelector<HTMLButtonElement>('.routing-item-open')
            ?.click();
        }}
      >
        <Table
          density="compact"
          columns={fit.columns}
          rows={items}
          getRowId={(row) => String(row.itemId)}
          empty={emptySlot}
        />
      </div>
    );
  };

  return (
    <section
      className="pane inspection-standard-list-pane routing-item-pane"
      aria-label={t.panes.item}
    >
      {listSlot()}

      {(loadError === null || loadError === undefined) && !isLoading && (
        <PageNav
          meta={pageMeta}
          buttonSize="md"
          sizes={TAB_PAGE_SIZES}
          onChangePage={onChangePage}
          onChangeSize={onChangePageSize}
        />
      )}
    </section>
  );
};
