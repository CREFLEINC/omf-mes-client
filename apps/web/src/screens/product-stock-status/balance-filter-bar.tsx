import { Button, Checkbox } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import {
  FilterMoreButton,
  HiddenFilterChips,
  hasChangedFilters,
  useFilterMore,
  type HiddenFilterChip,
} from '../../patterns/filter-more';

import { EMPTY_FILTERS, type BalanceFilters } from './filters';
import { ItemSelectField, SelectField } from './select-field';
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
  warehouseNote?: string;
  /** 이 구획이 이름을 내는 참조(창고)가 실패했는가. 품목 칸은 고른 품목의 이름을 스스로 받는다. */
  referencesFailed: boolean;
  onRetryReferences: () => void;
  onSearch: (filters: BalanceFilters) => void;
  /** 접힌 조건 칩의 ×. 그 조건 하나만 풀고 곧바로 다시 조회한다. */
  onRemoveFilter: (key: 'availableOnly') => void;
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
 * **보이는 칸은 셋이다**(C-6 · 관리웹 정리 시안 A, 2026-11-20) — 창고(필수) · 품목 · 묶기. 셋이 표의 범위와 모양을 정한다.
 * 가용만은 결과를 더 좁히는 보조 조건이라 「조건 더보기」에 접고, 켜져 있으면 접힌 동안 칩으로 알린다. 칸 폭은 C-19 —
 * 창고 · 품목 보통, 묶기 좁음 — 이라 고른 값에 따라 바뀌지 않는다. 「초기화」는 바뀐 것이 있을 때만 보인다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const BalanceFilterBar = ({
  appliedFilters,
  view,
  canUseLotView,
  onViewChange,
  warehouseOptions,
  warehouseNote,
  referencesFailed,
  onRetryReferences,
  onSearch,
  onRemoveFilter,
  onReset,
}: BalanceFilterBarProps) => {
  const reasonId = useId();
  const more = useFilterMore();

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

  /**
   * 초기화. **자기 편집 상태를 함께 비운다** — 부모에게만 알리면 아직 조회하지 않은 값은 주소가 바뀌지 않아 되돌림
   * effect 도 깨어나지 않고, 「초기화」를 눌렀는데 고르던 값이 그대로 남는다. 묶기는 조건이 아니라 그대로 둔다.
   */
  const reset = (): void => {
    setFilters(EMPTY_FILTERS);
    onReset();
  };

  const isChanged = hasChangedFilters(EMPTY_FILTERS, filters, appliedFilters);

  /* 접힌 가용만이 켜져 있으면 칩으로 알린다 — 보이는 칸의 값은 칩으로 겹쳐 적지 않는다. */
  const hiddenChips: HiddenFilterChip<'availableOnly'>[] = appliedFilters.availableOnly
    ? [
        {
          key: 'availableOnly',
          label: t.filters.chipAvailableOnly,
          removeLabel: t.filters.chipRemoveAvailableOnly,
        },
      ]
    : [];

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
        {/* C-19 — 창고 · 품목은 「코드 · 이름」 참조라 보통 폭, 묶기는 고정 선택지라 좁은 폭이다. */}
        <SelectField
          fieldWidth="md"
          label={t.fields.warehouse}
          options={withAll(warehouseOptions)}
          value={filters.warehouse}
          note={warehouseNote}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, warehouse: value }));
          }}
        />
        {/* 품목은 9천여 건이라 칸이 서버에서 쪽으로 받는다 — 예전 목록처럼 중지 품목은 싣지 않는다. */}
        <ItemSelectField
          label={t.fields.item}
          leadingOptions={withAll([])}
          value={filters.item}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, item: value }));
          }}
        />

        <SelectField
          fieldWidth="sm"
          label={t.fields.groupBy}
          options={viewOptions}
          value={view}
          note={canUseLotView ? undefined : t.reasons.lotViewNeedsItem}
          onChange={(value) => {
            onViewChange(value === 'lot' || value === 'location' ? value : 'item');
          }}
        />

        <div className="field-cell field-cell-unlabeled">
          <div className="filter-actions product-stock-status-actions">
            <Button
              disabled={searchReason !== null}
              aria-describedby={searchReason === null ? undefined : reasonId}
              onClick={search}
            >
              {messages.common.search}
            </Button>
            {isChanged && (
              <Button variant="outlined" onClick={reset}>
                {messages.common.reset}
              </Button>
            )}
            <FilterMoreButton open={more.isOpen} controlsId={more.id} onToggle={more.toggle} />
          </div>
          {searchReason !== null && (
            <span id={reasonId} className="field-note">
              {searchReason}
            </span>
          )}
        </div>
      </div>

      {/* `hidden` 은 감싸는 상자에 둔다 — `.filter-bar` 의 display 가 속성을 덮는다. */}
      <div id={more.id} hidden={!more.isOpen}>
        <div className="filter-bar">
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
        </div>
      </div>

      <HiddenFilterChips open={more.isOpen} chips={hiddenChips} onRemove={onRemoveFilter} />

      {referencesFailed && (
        <div className="field-cell">
          <span className="field-note">{t.reasons.filterReferencesFailed}</span>
          <Button variant="outlined" size="sm" onClick={onRetryReferences}>
            {messages.common.retry}
          </Button>
        </div>
      )}
    </>
  );
};
