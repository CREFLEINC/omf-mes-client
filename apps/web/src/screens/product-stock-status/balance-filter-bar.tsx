import { Button, Checkbox, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { toFilterChips, type BalanceFilters, type FilterChipNames } from './filters';
import { SelectField } from './select-field';
import type { SelectOption } from './types';
import { VIEW_AXES, type ViewAxis } from './view-axis';

const t = messages.productStockStatus;

export interface BalanceFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 조건. 고르는 중인 값은 이 부품 안에만 있다. */
  appliedFilters: BalanceFilters;
  /** 묶기(groupBy)는 조건과 달리 즉시 반영된다 — 표 열 구성 자체를 바꾸는 축이다. */
  view: ViewAxis;
  canUseLotView: boolean;
  onViewChange: (view: ViewAxis) => void;
  warehouseOptions: SelectOption[];
  itemOptions: SelectOption[];
  /** 조건 칩에 실을 참조 이름. 번호를 문구로 만드는 자리를 두지 않기 위한 것이다. */
  chipNames: FilterChipNames;
  warehouseNote?: string;
  itemNote?: string;
  /** 이 구획이 이름을 내는 참조(창고·품목)가 실패했는가. */
  referencesFailed: boolean;
  onRetryReferences: () => void;
  onSearch: (filters: BalanceFilters) => void;
  /** 조건 칩의 ×. 그 조건 하나만 풀고 곧바로 다시 조회한다. */
  onRemoveFilter: (key: keyof BalanceFilters) => void;
  onReset: () => void;
}

/**
 * 조회 조건 줄.
 *
 * 트리거 모델은 「모아서 적용, 해제는 즉시」다(창고·품목·가용만) — 「조회」를 누를 때만 주소가
 * 바뀐다. **묶기만 예외다** — 표를 어떤 축으로 볼지는 선택 즉시 반영된다(W-01-07의 보기 탭과
 * 같은 동작이며, 이 화면은 탭 대신 선택칸으로 같은 자리를 채운다).
 *
 * **창고가 필수다.** 고르기 전에는 조회를 잠그고 사유를 `aria-describedby`로 잇는다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const BalanceFilterBar = ({
  appliedFilters,
  view,
  canUseLotView,
  onViewChange,
  warehouseOptions,
  itemOptions,
  chipNames,
  warehouseNote,
  itemNote,
  referencesFailed,
  onRetryReferences,
  onSearch,
  onRemoveFilter,
  onReset,
}: BalanceFilterBarProps) => {
  const reasonId = useId();

  const [filters, setFilters] = useState<BalanceFilters>(appliedFilters);

  /*
   * 주소가 정본이다 — 뒤로가기·초기화로 주소가 **바뀌면** 고르던 값도 그 값으로 되돌아간다.
   * 되돌림을 참조가 아니라 값으로 판정한다(W-01-07 #43과 같은 갈래) — 원시 필드를 의존성에
   * 풀어 둔다.
   */
  const {
    warehouse: appliedWarehouse,
    item: appliedItem,
    availableOnly: appliedAvailableOnly,
  } = appliedFilters;

  useEffect(() => {
    setFilters({
      warehouse: appliedWarehouse,
      item: appliedItem,
      availableOnly: appliedAvailableOnly,
    });
  }, [appliedWarehouse, appliedItem, appliedAvailableOnly]);

  /** 조회를 잠그는 사유. `null`이면 조회할 수 있다. 막는 것은 창고 하나뿐이다. */
  const searchReason = filters.warehouse === '' ? t.reasons.warehouseRequired : null;

  const search = (): void => {
    if (searchReason !== null) return;

    onSearch(filters);
  };

  const chips = toFilterChips(appliedFilters, chipNames);

  /* 「전체」를 값이 빈 선택지로 둔다 — 두지 않으면 한 번 고른 뒤에 해제할 방법이 칸 안에 없어진다. */
  const withAll = (options: readonly SelectOption[]): SelectOption[] => [
    { value: '', label: t.filters.all },
    ...options,
  ];

  const viewOptions: SelectOption[] = VIEW_AXES.map((axis) => ({
    value: axis,
    label: t.views[axis],
  }));

  return (
    <>
      <div className="filter-bar">
        {/*
         * 규범 3-2 — 최소 폭을 주지 않으면 선택지 목록이 트리거 폭에 갇혀 잘린다. 창고·품목은
         * 「코드 · 이름」 형이라 `codeName`(18.5rem)을 쓴다.
         */}
        <SelectField
          optionWidth="codeName"
          label={t.fields.warehouse}
          options={withAll(warehouseOptions)}
          value={filters.warehouse}
          note={warehouseNote}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, warehouse: value }));
          }}
        />
        <SelectField
          optionWidth="codeName"
          label={t.fields.item}
          options={withAll(itemOptions)}
          value={filters.item}
          note={itemNote}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, item: value }));
          }}
        />

        <SelectField
          label={t.fields.groupBy}
          options={viewOptions}
          value={view}
          note={canUseLotView ? undefined : t.reasons.lotViewNeedsItem}
          onChange={(value) => {
            onViewChange(value === 'lot' || value === 'location' ? value : 'item');
          }}
        />

        {/* 확인칸은 라벨이 오른쪽에 붙어 라벨 층이 없다 — 윗선을 맞추려 라벨 없는 셀에 담는다. */}
        <div className="field-cell field-cell-unlabeled">
          <Checkbox
            checked={filters.availableOnly}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, availableOnly: event.target.checked }));
            }}
          >
            {t.fields.availableOnly}
          </Checkbox>
        </div>

        <div className="field-cell field-cell-unlabeled">
          <div className="filter-actions">
            <Button
              disabled={searchReason !== null}
              aria-describedby={searchReason === null ? undefined : reasonId}
              onClick={search}
            >
              {messages.common.search}
            </Button>
            <Button variant="outlined" onClick={onReset}>
              {messages.common.reset}
            </Button>
          </div>
          {searchReason !== null && (
            <span id={reasonId} className="field-note">
              {searchReason}
            </span>
          )}
        </div>
      </div>

      {referencesFailed && (
        <div className="field-cell">
          <span className="field-note">{t.reasons.filterReferencesFailed}</span>
          <Button variant="outlined" size="sm" onClick={onRetryReferences}>
            {messages.common.retry}
          </Button>
        </div>
      )}

      {chips.length > 0 && (
        <div className="filter-bar">
          {chips.map((chip) => (
            <Chip
              key={chip.key}
              variant="status"
              removeLabel={chip.removeLabel}
              onRemove={() => {
                onRemoveFilter(chip.key);
              }}
            >
              {chip.label}
            </Chip>
          ))}
        </div>
      )}
    </>
  );
};
