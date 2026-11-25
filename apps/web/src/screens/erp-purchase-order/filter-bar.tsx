import { Button, DatePicker, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import {
  FilterMoreButton,
  HiddenFilterChips,
  hasChangedFilters,
  useFilterMore,
  type HiddenFilterChip,
} from '../../patterns/filter-more';
import {
  FIT_PLACEHOLDER_CLASS,
  useFitPlaceholderWidth,
} from '../../patterns/fit-placeholder-width';
import { PartnerSelect } from '../../patterns/partner-select';
import { Select } from '../../patterns/select';
import { DEFAULT_FILTERS, type PurchaseOrderFilters } from './filters';
import type { SelectOption } from './types';

const t = messages.erpPurchaseOrder;

interface FilterSelectProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** 거래처 칸 — 선택지를 받지 않고 쪽 단위로 찾는다(`PartnerSelect`, 사용자 지시 2026-10-29). */
  partners?: boolean;
  /** 선택지가 적어도 맨 위에 검색창을 세운다(공장 검색 · 사용자 지시 2026-11-24). */
  searchable?: boolean;
}

const FilterSelect = ({
  label,
  options,
  value,
  onChange,
  className,
  partners = false,
  searchable = false,
}: FilterSelectProps) => {
  const id = useId();
  return (
    <div className={className === undefined ? 'field-cell' : `field-cell ${className}`}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {partners ? (
        <PartnerSelect
          id={id}
          includeInactive
          leadingOptions={[{ value: '', label: t.filters.all }]}
          value={value}
          onChange={onChange}
        />
      ) : (
        <Select
          id={id}
          searchable={searchable}
          options={[{ value: '', label: t.filters.all }, ...options]}
          value={value}
          onChange={onChange}
        />
      )}
    </div>
  );
};

/** 「조건 더보기」에 접는 조건 — 공장 · 상태 · 발주 유형. 진행은 탭 줄 위 라벨이다(#358). */
type HiddenKey = 'plant' | 'status' | 'orderType';

/** 칩에는 코드가 아니라 선택지 이름을 낸다. 선택지를 아직 못 받았으면 받은 값 그대로. */
const optionLabel = (options: SelectOption[], value: string): string =>
  options.find((option) => option.value === value)?.label ?? value;

export interface ErpPurchaseOrderFilterBarProps {
  appliedFilters: PurchaseOrderFilters;
  plantOptions: SelectOption[];
  statusOptions: SelectOption[];
  /** 발주 유형 — 공통코드 `ORDER_TYPE` */
  orderTypeOptions: SelectOption[];
  onSearch: (filters: PurchaseOrderFilters) => void;
  onReset: () => void;
}

/**
 * 조건 줄. 고치는 동안은 초안(`draft`)에만 담고 「조회」를 눌러야 주소로 간다 —
 * 칸 하나를 바꿀 때마다 조회가 나가면 기간을 다 고르기도 전에 엉뚱한 결과가 뜬다.
 * 진행은 탭 줄 위 라벨(`ProgressHubChips`)이 누르는 즉시 건다 — 걸린 조건에 진행만 바꿔 얹는다(#358).
 *
 * **보이는 칸은 셋이다**(C-6) — 발주일 · 공급사 · 발주번호. 칸 폭은 C-19 고정 폭이라 값을 넣어도 그대로다 — 기간 · 공급사는
 * 보통, 발주번호는 좁음이다(보통 셋에 조회 · 초기화 · 조건 더보기를 더하면 1280 에서 한 줄을 넘는다).
 * 공장 · 상태 · 발주 유형은 「조건 더보기」에 접고, 접힌 칸에 걸린 조건은 칩으로만 알린다. 「초기화」는 바뀐 것이 있을
 * 때만 보인다. [조회][초기화][조건 더보기]는 줄 오른쪽 끝(#358).
 */
export const ErpPurchaseOrderFilterBar = ({
  appliedFilters,
  plantOptions,
  statusOptions,
  orderTypeOptions,
  onSearch,
  onReset,
}: ErpPurchaseOrderFilterBarProps) => {
  const [draft, setDraft] = useState(appliedFilters);
  const searchRef = useFitPlaceholderWidth(t.values.searchPlaceholder);
  const periodId = useId();
  const more = useFilterMore();
  const { q, supplier, plant, status, orderType, from, to, progress } = appliedFilters;
  /* 주소가 바뀌면(뒤로가기·초기화) 초안도 따라간다. 진행은 초안을 거치지 않아 따라가지 않는다. */
  useEffect(
    () => setDraft((current) => ({ ...current, q, supplier, plant, status, orderType, from, to })),
    [q, supplier, plant, status, orderType, from, to],
  );

  const update = <K extends keyof PurchaseOrderFilters>(key: K, value: PurchaseOrderFilters[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const search = (): void => {
    onSearch({ ...draft, progress });
  };
  /*
   * 초기화는 초안도 함께 비운다 — 주소가 이미 처음 값이면 주소가 바뀌지 않아 따라가는 effect 가
   * 깨어나지 않고, 치던 값이 그대로 남는다.
   */
  const reset = (): void => {
    setDraft(DEFAULT_FILTERS);
    onReset();
  };

  /* 진행은 초안을 거치지 않으므로 걸린 값으로 견준다 — 초안에 남은 옛 진행이 「바뀜」으로 읽히지 않게. */
  const isChanged = hasChangedFilters(DEFAULT_FILTERS, { ...draft, progress }, appliedFilters);
  const codeChips: HiddenFilterChip<HiddenKey>[] = (
    [
      ['plant', t.fields.plant, plantOptions],
      ['status', t.fields.status, statusOptions],
      ['orderType', t.fields.orderType, orderTypeOptions],
    ] as const
  )
    .filter(([key]) => appliedFilters[key] !== '')
    .map(([key, label, options]) => ({
      key,
      label: t.filters.chip(label, optionLabel(options, appliedFilters[key])),
      removeLabel: messages.common.filterMore.remove(label),
    }));
  /* 진행은 탭 줄 위 라벨이 보여 주므로 칩으로 다시 알리지 않는다(#358). */
  const hiddenChips = codeChips;

  return (
    <>
      <div className="filter-bar erp-data-filter-row">
        {/* 발주일 · 공급사 검색 · 발주 번호 검색 순서(사용자 지시 2026-11-24). */}
        {/*
         * 기간은 **한 컨트롤**이다(C-12 — 브라우저 날짜 칸을 쓰지 않는다). 컴포넌트가 완결된 쌍만, 그것도
         * 시작 ≤ 종료로만 내보내 이 칸을 거친 역전은 생기지 않는다. 주소 키(`from`·`to`)와 요청 파라미터는 그대로다.
         */}
        <div className="field-cell erp-po-period-field">
          <label className="field-label" htmlFor={periodId}>
            {t.filters.orderDateSearch}
          </label>
          <DatePicker
            id={periodId}
            mode="range"
            clearable
            value={[draft.from === '' ? null : draft.from, draft.to === '' ? null : draft.to]}
            placeholder={t.filters.orderDatePlaceholder}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                from: value === null ? '' : value[0],
                to: value === null ? '' : value[1],
              }))
            }
          />
        </div>
        <FilterSelect
          partners
          label={t.filters.supplierSelect}
          className="erp-po-supplier-field"
          options={[]}
          value={draft.supplier}
          onChange={(value) => update('supplier', value)}
        />
        <SearchInput
          label={t.fields.q}
          placeholder={t.values.searchPlaceholder}
          ref={searchRef}
          value={draft.q}
          onChange={(event) => update('q', event.target.value)}
          onSearch={search}
          clearLabel={messages.common.clear}
          containerClassName={`filter-field-sm erp-order-search ${FIT_PLACEHOLDER_CLASS}`}
        />
        {/* 조회 · 초기화 · 조건 더보기는 줄 오른쪽 끝(단말 관리와 같다 · #358). 초기화는 바뀐 것이 있을 때만. */}
        <div className="filter-actions field-cell-unlabeled">
          <Button onClick={search}>{messages.common.search}</Button>
          {isChanged && (
            <Button variant="outlined" onClick={reset}>
              {messages.common.reset}
            </Button>
          )}
          <FilterMoreButton open={more.isOpen} controlsId={more.id} onToggle={more.toggle} />
        </div>
      </div>

      {/* `hidden` 은 감싸는 상자에 둔다 — `.filter-bar` 의 display 가 속성을 덮는다. */}
      <div id={more.id} className="erp-po-more" hidden={!more.isOpen}>
        <div className="filter-bar">
          <FilterSelect
            searchable
            label={t.filters.plantSelect}
            className="erp-po-supplier-field"
            options={plantOptions}
            value={draft.plant}
            onChange={(value) => update('plant', value)}
          />
          <FilterSelect
            label={t.filters.statusSelect}
            className="erp-po-supplier-field"
            options={statusOptions}
            value={draft.status}
            onChange={(value) => update('status', value)}
          />
          {/* 발주 유형(사용자 지시 2026-10-28) — 외자 · 내자 · 위탁가공 등을 갈라 본다. */}
          <FilterSelect
            label={t.filters.orderTypeSelect}
            className="erp-po-supplier-field"
            options={orderTypeOptions}
            value={draft.orderType}
            onChange={(value) => update('orderType', value)}
          />
        </div>
      </div>

      <HiddenFilterChips
        open={more.isOpen}
        chips={hiddenChips}
        onRemove={(key) => onSearch({ ...appliedFilters, [key]: DEFAULT_FILTERS[key] })}
      />
    </>
  );
};
