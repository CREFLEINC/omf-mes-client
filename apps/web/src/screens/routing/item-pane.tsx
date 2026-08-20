import {
  Button,
  Checkbox,
  Chip,
  type Column,
  EmptyState,
  SearchInput,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useState } from 'react';

import type { Item, ItemFilters } from './types';

const t = messages.routing;

/** 화면을 처음 열었을 때의 조회 조건. 예시 데이터가 아니라 화면 상수라 여기가 자리다. */
export const DEFAULT_ITEM_FILTERS: ItemFilters = { q: '', onlyWithoutRouting: false };

export interface ItemPaneProps {
  items: Item[];
  isLoading: boolean;
  /** 적용된(URL에 반영된) 조건 — 조건 칩의 렌더 기준 */
  appliedFilters: ItemFilters;
  /** 조회 버튼·Enter·칩 제거·초기화가 호출 */
  onApplyFilters: (next: ItemFilters) => void;
  selectedItemId: number | null;
  onSelect: (itemId: number) => void;
  /**
   * 조회 실패 표시. null이 아니면 표·빈 상태 대신 이것을 낸다 —
   * 실패를 「등록된 품목이 없습니다」로 보이면 사실과 다른 안내가 된다.
   */
  loadError: ReactNode;
}

const hasAnyFilter = (filters: ItemFilters): boolean =>
  filters.q !== '' || filters.onlyWithoutRouting;

/** 좌 페인 — 품목을 찾아 고르는 자리. Routing은 품목에 매달리므로 이 선택이 화면 전체의 출발점이다. */
export const ItemPane = ({
  items,
  isLoading,
  appliedFilters,
  onApplyFilters,
  selectedItemId,
  onSelect,
  loadError,
}: ItemPaneProps) => {
  // 트리거 모델: 편집은 모아서 적용, 해제는 즉시. 편집 중인 값은 draft에만 있고 조건 칩에 미러하지 않는다.
  const [draft, setDraft] = useState<ItemFilters>(appliedFilters);
  const { q: appliedQ, onlyWithoutRouting: appliedOnlyWithoutRouting } = appliedFilters;

  useEffect(() => {
    setDraft({ q: appliedQ, onlyWithoutRouting: appliedOnlyWithoutRouting });
  }, [appliedQ, appliedOnlyWithoutRouting]);

  const columns: Column<Item>[] = [
    {
      key: 'itemCode',
      header: t.fields.itemCode,
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-current={row.itemId === selectedItemId ? 'true' : undefined}
          onClick={() => onSelect(row.itemId)}
        >
          {row.itemCode}
        </button>
      ),
    },
    { key: 'itemName', header: t.fields.itemName },
  ];

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
      <Table
        density="compact"
        columns={columns}
        rows={items}
        getRowId={(row) => String(row.itemId)}
        empty={emptySlot}
      />
    );
  };

  return (
    <section className="pane" aria-label={t.panes.item}>
      {/* 결과가 없어도 필터 바는 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. */}
      <div className="filter-bar">
        <SearchInput
          label={t.filters.searchLabel}
          placeholder={t.filters.searchPlaceholder}
          value={draft.q}
          onChange={(event) => setDraft((prev) => ({ ...prev, q: event.target.value }))}
          onSearch={(value) => onApplyFilters({ ...draft, q: value })}
        />
        {/* 해제 축이라 변경 즉시 적용한다. */}
        <div className="field-cell field-cell-unlabeled">
          <Checkbox
            checked={appliedFilters.onlyWithoutRouting}
            onChange={(event) =>
              onApplyFilters({ ...appliedFilters, onlyWithoutRouting: event.target.checked })
            }
          >
            {t.filters.onlyWithoutRouting}
          </Checkbox>
        </div>
        {/*
         * 조회와 초기화는 짝이라 함께 줄바꿈되게 묶는다(배치 규범 2-1).
         * 좌 페인이 좁아 줄바꿈 자체는 피할 수 없지만, 갈라지면 남은 버튼이 무엇에 딸린 것인지 읽히지 않는다.
         * 라벨 층은 묶음이 한 번만 갖는다 — 버튼마다 붙이면 두 번 적용된다.
         */}
        <div className="filter-actions field-cell-unlabeled">
          <Button onClick={() => onApplyFilters(draft)}>{messages.common.search}</Button>
          <Button variant="outlined" onClick={() => onApplyFilters(DEFAULT_ITEM_FILTERS)}>
            {messages.common.reset}
          </Button>
        </div>
      </div>

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
        {appliedFilters.onlyWithoutRouting && (
          <Chip
            variant="status"
            removeLabel={t.filters.chipRemoveOnlyWithoutRouting}
            onRemove={() => onApplyFilters({ ...appliedFilters, onlyWithoutRouting: false })}
          >
            {t.filters.onlyWithoutRouting}
          </Chip>
        )}
      </div>

      {listSlot()}
    </section>
  );
};
