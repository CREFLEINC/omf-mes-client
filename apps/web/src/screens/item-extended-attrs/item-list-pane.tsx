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

import { EMPTY_ITEM_FILTERS, clearFilter, hasAnyFilter, toFilterChips } from './filters';
import { PageNav } from './page-nav';
import type { PageView } from './pagination';
import type { Item, ItemFilters } from './types';

const t = messages.itemExtendedAttrs;

export interface ItemListPaneProps {
  items: Item[];
  isLoading: boolean;
  appliedFilters: ItemFilters;
  onApplyFilters: (next: ItemFilters) => void;
  pageView: PageView;
  onChangePage: (page: number) => void;
  selectedItemId: number | null;
  onSelect: (itemId: number) => void;
  loadError: ReactNode;
}

/**
 * 좌 페인 — 품목을 찾아 고르는 자리. **탭 밖에 있다.**
 *
 * 세 탭이 전부 「지금 고른 품목」의 다른 면이라, 목록을 탭 안에 넣으면 탭을 옮길 때마다
 * 품목을 다시 골라야 한다(결정 2).
 *
 * **쓰기 액션이 없다.** 계약에 `POST /mdm/items`가 없다 — 품목은 외부 정본이고
 * 이 화면은 확장 속성만 단다. 「품목 추가」를 둘 자리가 아니다.
 *
 * **열은 둘뿐이다**(품목코드·품목명). 「사용 여부」는 이름 뒤 접미로 붙인다 —
 * 좁은 좌 페인에서 열 하나를 더 두면 이름 열이 짓눌린다(결정 11).
 *
 * **품목 유형 필터를 두지 않는다** — 값 목록이 미정이라 선택지를 만들 수 없고,
 * 자유 입력 필터는 바로 옆 검색어 칸과 구분되지 않는다.
 */
export const ItemListPane = ({
  items,
  isLoading,
  appliedFilters,
  onApplyFilters,
  pageView,
  onChangePage,
  selectedItemId,
  onSelect,
  loadError,
}: ItemListPaneProps) => {
  /* 트리거 모델: 편집은 모아서 적용, 해제는 즉시. */
  const [draft, setDraft] = useState<ItemFilters>(appliedFilters);
  const { q: appliedQ, includeInactive: appliedIncludeInactive } = appliedFilters;

  useEffect(() => {
    setDraft({ q: appliedQ, includeInactive: appliedIncludeInactive });
  }, [appliedQ, appliedIncludeInactive]);

  const columns: Column<Item>[] = [
    {
      key: 'itemCode',
      header: t.origin.fields.itemCode,
      width: '160px',
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
    {
      key: 'itemName',
      header: t.origin.fields.itemName,
      render: (row) => (row.isActive ? row.itemName : `${row.itemName}${t.values.inactiveSuffix}`),
    },
  ];

  /**
   * 빈 상태는 세 갈래다 — 셋을 뭉치면 사실과 다른 안내가 된다.
   * ① 범위 밖 쪽 ② 조건이 걸린 0건 ③ 조건 없는 0건.
   *
   * ③의 안내가 다른 화면과 다르다 — **여기서 만들 수 없는 자료**라 「추가하세요」가 아니라
   * 「원본 시스템을 확인하세요」다.
   */
  const emptySlot = ((): ReactNode => {
    if (pageView.isBeyondLast) {
      return (
        <EmptyState
          size="sm"
          live
          title={t.empty.beyondLastTitle}
          description={t.empty.beyondLastDescription}
          action={
            <Button variant="outlined" onClick={() => onChangePage(1)}>
              {t.actions.goFirstPage}
            </Button>
          }
        />
      );
    }

    if (hasAnyFilter(appliedFilters)) {
      return (
        <EmptyState
          size="sm"
          live
          title={t.empty.noMatchTitle}
          description={t.empty.noMatchDescription}
          action={
            <Button variant="outlined" onClick={() => onApplyFilters(EMPTY_ITEM_FILTERS)}>
              {messages.common.reset}
            </Button>
          }
        />
      );
    }

    return (
      <EmptyState size="sm" live title={t.empty.noneTitle} description={t.empty.noneDescription} />
    );
  })();

  /** 조회 실패 → 로딩 → 표 순서로 하나만 낸다. */
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
      <>
        <Table
          density="compact"
          columns={columns}
          rows={items}
          getRowId={(row) => String(row.itemId)}
          empty={emptySlot}
        />
        <PageNav view={pageView} onChange={onChangePage} />
      </>
    );
  };

  const chips = toFilterChips(appliedFilters);

  return (
    <section className="pane" aria-label={t.panes.item}>
      <div className="filter-bar">
        <SearchInput
          label={t.filters.itemSearchLabel}
          placeholder={t.filters.itemSearchPlaceholder}
          value={draft.q}
          onChange={(event) => setDraft((prev) => ({ ...prev, q: event.target.value }))}
          onSearch={(value) => onApplyFilters({ ...draft, q: value })}
        />

        {/* 해제 축이라 변경 즉시 적용한다. */}
        <div className="field-cell field-cell-unlabeled">
          <Checkbox
            checked={appliedFilters.includeInactive}
            onChange={(event) =>
              onApplyFilters({ ...appliedFilters, includeInactive: event.target.checked })
            }
          >
            {messages.common.includeInactive}
          </Checkbox>
        </div>

        <div className="filter-actions field-cell-unlabeled">
          <Button onClick={() => onApplyFilters(draft)}>{messages.common.search}</Button>
          <Button variant="outlined" onClick={() => onApplyFilters(EMPTY_ITEM_FILTERS)}>
            {messages.common.reset}
          </Button>
        </div>
      </div>

      <div className="filter-bar">
        {chips.map((chip) => (
          <Chip
            key={chip.key}
            variant="status"
            removeLabel={chip.removeLabel}
            onRemove={() => onApplyFilters(clearFilter(appliedFilters, chip.key))}
          >
            {chip.label}
          </Chip>
        ))}
      </div>

      {listSlot()}
    </section>
  );
};
