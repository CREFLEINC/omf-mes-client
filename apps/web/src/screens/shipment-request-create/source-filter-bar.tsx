import { Button, Checkbox, Chip, DatePicker } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { FieldLabel } from './field-label';
import type { FilterChip, SourceFilters } from './filters';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.shipmentRequestCreate;

/** 적용된 조건마다 칩 하나. 순서는 조건 줄의 컨트롤 순서와 같다. */
const toFilterChips = (filters: SourceFilters, customerName: string): FilterChip[] => {
  const chips: FilterChip[] = [];

  if (filters.customer !== '') {
    chips.push({
      key: 'customer',
      label: t.filters.chipCustomer(customerName),
      removeLabel: t.filters.chipRemoveCustomer,
    });
  }

  if (filters.orderDateFrom !== '' || filters.orderDateTo !== '') {
    chips.push({
      key: 'period',
      label: t.filters.chipPeriod(filters.orderDateFrom, filters.orderDateTo),
      removeLabel: t.filters.chipRemovePeriod,
    });
  }

  if (filters.unassignedOnly) {
    chips.push({
      key: 'unassignedOnly',
      label: t.filters.chipUnassignedOnly,
      removeLabel: t.filters.chipRemoveUnassignedOnly,
    });
  }

  return chips;
};

export interface SourceFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 조건. 고르는 중인 값은 이 부품 안에만 있다. */
  appliedFilters: SourceFilters;
  customerOptions: SelectOption[];
  customerName: string;
  customerNote?: string;
  onSearch: (filters: SourceFilters) => void;
  onRemoveFilter: (key: FilterChip['key']) => void;
  onReset: () => void;
}

/**
 * 좌측 목록의 조회 조건 줄 — 고객·주문일(범위)·미편성만 셋뿐이다(계획서 「필터+페이지이동」).
 *
 * 트리거 모델은 「모아서 적용, 해제는 즉시」다 — 「조회」를 누를 때만 주소가 바뀌고, 조건 칩의
 * ×는 그 조건 하나만 풀고 곧바로 다시 조회한다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const SourceFilterBar = ({
  appliedFilters,
  customerOptions,
  customerName,
  customerNote,
  onSearch,
  onRemoveFilter,
  onReset,
}: SourceFilterBarProps) => {
  const periodId = useId();

  const [filters, setFilters] = useState<SourceFilters>(appliedFilters);

  /*
   * 주소가 정본이다 — 뒤로가기·초기화로 주소가 바뀌면 고르던 값도 그 값으로 되돌아간다.
   * 원시 필드를 의존성에 풀어 둔다(전례 `omf-mes#43`과 같은 갈래) — 부모가 다시 그려질 때마다
   * 새 객체가 만들어져도 값이 같으면 되돌리지 않는다.
   */
  const {
    customer: appliedCustomer,
    orderDateFrom: appliedFrom,
    orderDateTo: appliedTo,
    unassignedOnly: appliedUnassignedOnly,
  } = appliedFilters;

  useEffect(() => {
    setFilters({
      customer: appliedCustomer,
      orderDateFrom: appliedFrom,
      orderDateTo: appliedTo,
      unassignedOnly: appliedUnassignedOnly,
    });
  }, [appliedCustomer, appliedFrom, appliedTo, appliedUnassignedOnly]);

  const withAll = (options: readonly SelectOption[]): SelectOption[] => [
    { value: '', label: t.filters.all },
    ...options,
  ];

  const chips = toFilterChips(appliedFilters, customerName);

  return (
    <>
      <div className="filter-bar">
        <SelectField
          wide
          label={t.filters.customer}
          options={withAll(customerOptions)}
          value={filters.customer}
          note={customerNote}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, customer: value }));
          }}
        />

        <div className="field-cell">
          <FieldLabel htmlFor={periodId} label={t.filters.period} />
          <DatePicker
            id={periodId}
            mode="range"
            placeholder={messages.common.selectDate}
            value={[
              filters.orderDateFrom === '' ? null : filters.orderDateFrom,
              filters.orderDateTo === '' ? null : filters.orderDateTo,
            ]}
            onChange={([from, to]) => {
              setFilters((prev) => ({ ...prev, orderDateFrom: from, orderDateTo: to }));
            }}
          />
        </div>

        {/* 확인칸은 라벨이 오른쪽에 붙어 라벨 층이 없다 — 윗선을 맞추려 라벨 없는 셀에 담는다. */}
        <div className="field-cell field-cell-unlabeled">
          <Checkbox
            checked={filters.unassignedOnly}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, unassignedOnly: event.target.checked }));
            }}
          >
            {t.filters.unassignedOnly}
          </Checkbox>
        </div>

        <div className="field-cell field-cell-unlabeled">
          <div className="filter-actions">
            <Button
              onClick={() => {
                onSearch(filters);
              }}
            >
              {t.filters.search}
            </Button>
            <Button variant="outlined" onClick={onReset}>
              {t.filters.reset}
            </Button>
          </div>
        </div>
      </div>

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
