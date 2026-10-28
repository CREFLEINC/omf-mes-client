import { Button, Checkbox, type Column, EmptyState, SkeletonText, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useId, useState } from 'react';

import { BoardTable } from '../../patterns/board-table';
import { OneLine } from '../../patterns/po-board';
import { Select } from '../../patterns/select';
import { EMPTY_ITEM_FILTERS, hasAnyFilter } from './filters';
import type { ItemTypeOption } from './item-queries';
import { codeValueName } from './options';
import { PageNav } from './page-nav';
import type { PageView } from './pagination';
import type { Item, ItemFilters } from './types';

const t = messages.itemExtendedAttrs;

const NO_ITEM_TYPES: ItemTypeOption[] = [];

export interface ItemFilterBarProps {
  applied: ItemFilters;
  onApply: (next: ItemFilters) => void;
  /** 품목 유형 선택지. 받기 전·실패 시에는 비어 있고 「전체」만 고를 수 있다 */
  itemTypeOptions?: ItemTypeOption[];
}

/**
 * 위 상자의 조회 조건 — 「BOM 조회 (ERP)」 · 「품목정보 조회 (ERP)」와 같은 줄이다(사용자 지시 2026-10-28).
 * 입력 중인 값은 이 줄이 갖고 「조회」로 주소에 옮긴다. 미사용 포함은 해제 축이라 누르는 즉시 건다.
 *
 * **품목 유형 선택지는 코드 그룹 `ITEM_TYPE`에서 받는다.** 주소에 그 밖의 코드가 실려 오면
 * 그 코드도 선택지에 더해 보인다 — 걸린 조건이 사라진 것처럼 보이지 않게.
 */
export const ItemFilterBar = ({
  applied,
  onApply,
  itemTypeOptions = NO_ITEM_TYPES,
}: ItemFilterBarProps) => {
  const itemTypeId = useId();
  const iqcId = useId();
  const [draft, setDraft] = useState<ItemFilters>(applied);
  const { q, itemType, includeInactive, iqc } = applied;

  // 뒤로가기 등으로 주소가 바뀌면 입력칸도 따라간다.
  useEffect(() => {
    setDraft({ q, itemType, includeInactive, iqc });
  }, [q, itemType, includeInactive, iqc]);

  const typeOptions = itemTypeOptions.map((option) => ({
    value: option.code,
    label: codeValueName(itemTypeOptions, option.code),
  }));
  if (draft.itemType !== '' && !itemTypeOptions.some((option) => option.code === draft.itemType)) {
    typeOptions.push({ value: draft.itemType, label: draft.itemType });
  }

  return (
    <form
      className="filter-bar"
      onSubmit={(event) => {
        event.preventDefault();
        onApply({ ...draft, q: draft.q.trim() });
      }}
    >
      <TextField
        label={t.filters.itemSearchLabel}
        value={draft.q}
        onChange={(event) => {
          setDraft((prev) => ({ ...prev, q: event.target.value }));
        }}
      />
      <div className="field-cell">
        <label className="field-label" htmlFor={itemTypeId}>
          {t.filters.itemTypeLabel}
        </label>
        <Select
          id={itemTypeId}
          value={draft.itemType}
          options={[{ value: '', label: t.filters.itemTypeAll }, ...typeOptions]}
          onChange={(value) => {
            setDraft((prev) => ({ ...prev, itemType: value }));
          }}
        />
      </div>
      {/* IQC 대상 여부 — 품목유형과 같이 「조회」로 건다(사용자 지시 2026-10-28). */}
      <div className="field-cell">
        <label className="field-label" htmlFor={iqcId}>
          {t.filters.iqcLabel}
        </label>
        <Select
          id={iqcId}
          value={draft.iqc}
          options={[
            { value: '', label: t.filters.itemTypeAll },
            { value: 'Y', label: t.values.yes },
            { value: 'N', label: t.values.no },
          ]}
          onChange={(value) => {
            setDraft((prev) => ({ ...prev, iqc: value === 'Y' || value === 'N' ? value : '' }));
          }}
        />
      </div>
      <div className="field-cell field-cell-unlabeled">
        <Checkbox
          checked={applied.includeInactive}
          onChange={(event) => {
            onApply({ ...applied, includeInactive: event.target.checked });
          }}
        >
          {messages.common.includeInactive}
        </Checkbox>
      </div>
      <div className="field-cell field-cell-unlabeled">
        <div className="filter-actions">
          <Button type="submit">{messages.common.search}</Button>
          <Button
            variant="outlined"
            onClick={() => {
              onApply(EMPTY_ITEM_FILTERS);
            }}
          >
            {messages.common.reset}
          </Button>
        </div>
      </div>
    </form>
  );
};

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
  itemTypeOptions?: ItemTypeOption[];
}

/**
 * 왼쪽 구획 — 품목을 찾아 고르는 목록. 줄 어디를 눌러도 그 품목을 고른다(`BoardTable` 의 `pick`).
 *
 * **쓰기 액션이 없다.** 계약에 `POST /mdm/items`가 없다 — 품목은 외부 정본이고
 * 이 화면은 확장 속성만 단다. 「품목 추가」를 둘 자리가 아니다.
 *
 * 「사용 여부」는 이름 뒤 접미로 붙인다 — 오른쪽 사실 칸에 사용 여부가 따로 있다.
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
  itemTypeOptions = NO_ITEM_TYPES,
}: ItemListPaneProps) => {
  const columns: Column<Item>[] = [
    /* 고르는 단추 자리 — 품목코드는 굵게(BOM 탭과 같다). */
    {
      key: 'itemCode',
      header: t.origin.fields.itemCode,
      width: '152px',
      render: (row) => <span className="bom-tree-code bom-code-cell">{row.itemCode}</span>,
    },
    {
      key: 'itemName',
      header: t.origin.fields.itemName,
      render: (row) => (
        <OneLine text={row.isActive ? row.itemName : `${row.itemName}${t.values.inactiveSuffix}`} />
      ),
    },
    {
      key: 'itemTypeCode',
      header: t.origin.fields.itemType,
      width: '80px',
      render: (row) => codeValueName(itemTypeOptions, row.itemTypeCode),
    },
    /* IQC 대상 여부(사용자 지시 2026-10-28) — Y / N. */
    {
      key: 'inspectionRequired',
      header: t.attrs.fields.inspectionRequired,
      width: '80px',
      align: 'center',
      render: (row) => (row.inspectionRequired ? t.values.yes : t.values.no),
    },
  ];

  /**
   * 빈 상태는 세 갈래다 — 셋을 뭉치면 사실과 다른 안내가 된다.
   * ① 범위 밖 쪽 ② 조건이 걸린 0건 ③ 조건 없는 0건.
   */
  const emptySlot = ((): ReactNode => {
    if (pageView.isBeyondLast) {
      return (
        <EmptyState
          size="sm"
          live
          title={t.empty.beyondLastTitle}
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
          action={
            <Button variant="outlined" onClick={() => onApplyFilters(EMPTY_ITEM_FILTERS)}>
              {messages.common.reset}
            </Button>
          }
        />
      );
    }

    return <EmptyState size="sm" live title={t.empty.noneTitle} />;
  })();

  /* 조회 실패 → 로딩 → 표 순서로 하나만 낸다. 실패를 「없습니다」로 보이면 안 된다. */
  if (loadError !== null && loadError !== undefined) return loadError;

  if (isLoading) {
    return (
      <div role="status" aria-label={t.loading.items}>
        <SkeletonText lines={4} />
      </div>
    );
  }

  return (
    <>
      <BoardTable
        label={t.panes.item}
        widthKey="omf-mes:item-extended-attrs:columns:items"
        minWidth="26rem"
        columns={columns}
        rows={items}
        getRowId={(row) => String(row.itemId)}
        pick={{
          columnKey: 'itemCode',
          label: (row) => t.pickItem(row.itemCode),
          currentId: selectedItemId === null ? null : String(selectedItemId),
          onPick: (row) => {
            onSelect(row.itemId);
          },
        }}
        empty={emptySlot}
      />
      <PageNav view={pageView} onChange={onChangePage} />
    </>
  );
};
