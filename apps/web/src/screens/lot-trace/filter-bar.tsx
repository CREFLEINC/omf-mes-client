import { Button, DatePicker, SearchInput } from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import {
  FilterMoreButton,
  HiddenFilterChips,
  hasChangedFilters,
  useFilterMore,
  type HiddenFilterChip,
} from '../../patterns/filter-more';
import { ReferenceField } from '../../patterns/reference-picker';
import { DEFAULT_SIZE, toInboundLotRef, type LotTraceFilters } from './filters';
import { validatePeriod } from './period';
import { useItemLabel, useItemSource, usePartnerLabel, usePartnerSource } from './queries';

const t = messages.lotTrace.filters;

export type FilterDraft = Pick<
  LotTraceFilters,
  | 'from'
  | 'to'
  | 'item'
  | 'materialLot'
  | 'productLot'
  | 'inbound'
  | 'inboundLotNo'
  | 'workOrder'
  | 'shipment'
  | 'supplier'
  | 'customer'
>;

export type FilterSearchMode = 'auto' | 'manual';

export interface FilterBarProps {
  applied: LotTraceFilters;
  /** 처음 값 — 초기화가 되돌리는 값(기본 기간 · 나머지 비움). 「초기화」는 이것과 다를 때만 보인다(C-6). */
  defaults: LotTraceFilters;
  /** `auto`는 조건을 바꿔 바로 반영, `manual`은 [조회](같은 조건이면 다시 조회). */
  onSearch: (draft: FilterDraft, mode: FilterSearchMode) => void;
  onReset: () => void;
  /** 행의 입하 LOT 으로 건 거르기를 푼다(005 FR-035) — 칸이 없는 조건이라 칩의 × 로만 푼다. */
  onClearInboundLot: () => void;
}

const draftOf = (filters: LotTraceFilters): FilterDraft => ({
  from: filters.from,
  to: filters.to,
  item: filters.item,
  materialLot: filters.materialLot,
  productLot: filters.productLot,
  inbound: filters.inbound,
  inboundLotNo: filters.inboundLotNo,
  workOrder: filters.workOrder,
  shipment: filters.shipment,
  supplier: filters.supplier,
  customer: filters.customer,
});

type TextKey = 'materialLot' | 'productLot' | 'inbound' | 'inboundLotNo' | 'workOrder' | 'shipment';
type PickKey = 'item' | 'supplier' | 'customer';
type Picked = Partial<Record<PickKey, { id: string; label: string }>>;
type ChipKey = TextKey | 'supplier' | 'customer' | 'inboundLot';

/** 「초기화」를 세울지 견줄 꼴 — 쪽 번호 · 쪽 크기는 조회 조건이 아니라 같은 값으로 둔다. */
const conditionsOf = (filters: LotTraceFilters): LotTraceFilters => ({
  ...filters,
  page: 1,
  size: DEFAULT_SIZE,
});

/**
 * C-6 조회 조건. 기본 줄: 기간(넓음, 필수, 늘 보임), 품목(보통), [초기화], [조회], [조건 더보기].
 * 조건 더보기(늘 접힌 채 시작): 자재 LOT 번호, 제품 LOT 번호, 입하번호, 입하 LOT 번호(005 FR-035), W/O 번호, 출하번호, 공급사, 고객.
 * 접혀 있는데 그 안의 조건이 걸려 있으면 조건 줄 아래 칩으로 알린다 — × 는 그 조건만 풀어 다시 조회한다.
 * 고르면 끝나는 조건(기간, 품목, 공급사, 고객)은 바로 반영한다. 글자 칸은 Enter나 칸을 떠날 때, 지우기(×)는 바로
 * 반영한다. 기간이 맞지 않으면 반영하지 않고 기간 칸 아래 사유를 보인다(C-7). [조회]는 다시 조회하는 자리로 남는다.
 */
export const FilterBar = ({
  applied,
  defaults,
  onSearch,
  onReset,
  onClearInboundLot,
}: FilterBarProps) => {
  const [draft, setDraft] = useState<FilterDraft>(() => draftOf(applied));
  const [picked, setPicked] = useState<Picked>({});
  const [periodError, setPeriodError] = useState<string | null>(null);
  const more = useFilterMore();
  const periodId = useId();
  const periodErrorId = useId();

  const appliedKey = JSON.stringify(draftOf(applied));
  useEffect(() => {
    setDraft(JSON.parse(appliedKey) as FilterDraft);
    setPeriodError(null);
  }, [appliedKey]);

  const itemSource = useItemSource();
  const supplierSource = usePartnerSource('SUPPLIER');
  const customerSource = usePartnerSource('CUSTOMER');
  const resolvedItem = useItemLabel(draft.item);
  const resolvedSupplier = usePartnerLabel(draft.supplier, 'SUPPLIER');
  const resolvedCustomer = usePartnerLabel(draft.customer, 'CUSTOMER');
  const labelOf = (key: PickKey, id: string, resolved: string): string =>
    id === '' ? '' : picked[key]?.id === id ? (picked[key]?.label ?? '') : resolved;

  /* 접힌 칸에 걸린 조건 — 칩 하나에 「라벨: 값」, 값은 펼친 칸이 보이는 글자와 같다. */
  const chipOf = (key: ChipKey, label: string, value: string): HiddenFilterChip<ChipKey>[] =>
    value === ''
      ? []
      : [
          {
            key,
            label: `${label}: ${value}`,
            removeLabel: messages.common.filterMore.remove(label),
          },
        ];
  const fieldChips: HiddenFilterChip<ChipKey>[] = [
    ...chipOf('materialLot', t.materialLot, applied.materialLot),
    ...chipOf('productLot', t.productLot, applied.productLot),
    ...chipOf('inbound', t.inboundNo, applied.inbound),
    ...chipOf('inboundLotNo', t.inboundLotNo, applied.inboundLotNo),
    ...chipOf('workOrder', t.workOrderNo, applied.workOrder),
    ...chipOf('shipment', t.shipmentNo, applied.shipment),
    ...chipOf('supplier', t.supplier, labelOf('supplier', applied.supplier, resolvedSupplier)),
    ...chipOf('customer', t.customer, labelOf('customer', applied.customer, resolvedCustomer)),
  ];
  /* 005 FR-035 — 행의 입하 LOT 으로 건 거르기는 칸이 없다 — 펼쳐도 칩으로 남는다. */
  const inboundLot = toInboundLotRef(applied.inboundLot);
  const noFieldChips: HiddenFilterChip<ChipKey>[] =
    inboundLot === null
      ? []
      : [
          {
            key: 'inboundLot',
            label: t.inboundLotChip(inboundLot.inboundLotNo),
            removeLabel: t.inboundLotChipRemove,
          },
        ];
  const removeChip = (key: ChipKey): void => {
    if (key === 'inboundLot') onClearInboundLot();
    else onSearch({ ...draftOf(applied), [key]: '' }, 'manual');
  };

  /* 「초기화」는 바뀐 것이 있을 때만(C-6) — 편집 중인 값이나 조회에 쓰인 값(종류 칩 포함)이 처음 값과 다를 때. */
  const isChanged = hasChangedFilters(
    conditionsOf(defaults),
    conditionsOf(applied),
    conditionsOf({ ...applied, ...draft }),
  );
  /* 편집 상태도 함께 처음으로 — 조회에 쓰인 값이 이미 처음 값이면 주소가 바뀌지 않아 되돌림이 깨어나지 않는다. */
  const reset = (): void => {
    setDraft(draftOf(defaults));
    setPeriodError(null);
    onReset();
  };

  const set = (patch: Partial<FilterDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const submit = () => {
    const reason = validatePeriod(draft);
    setPeriodError(reason);
    if (reason === null) onSearch(draft, 'manual');
  };
  const commit = (patch: Partial<FilterDraft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    const reason = validatePeriod(next);
    setPeriodError(reason);
    if (reason === null) onSearch(next, 'auto');
  };
  const pick = (key: PickKey, row: { id: number; code: string; name: string }) => {
    setPicked((current) => ({
      ...current,
      [key]: { id: String(row.id), label: named(row.name, row.code) },
    }));
    commit({ [key]: String(row.id) });
  };
  const leave = (key: TextKey) => {
    if (draft[key] !== applied[key]) commit({});
  };

  const textField = (key: TextKey, label: string, placeholder: string) => (
    <div className="field-cell filter-field-md">
      <SearchInput
        fullWidth
        label={label}
        placeholder={placeholder}
        value={draft[key]}
        clearLabel={messages.common.clear}
        onChange={(event) => set({ [key]: event.target.value.trim() })}
        onSearch={submit}
        onBlur={() => leave(key)}
        onClear={() => commit({ [key]: '' })}
      />
    </div>
  );

  return (
    <>
      <form
        className="filter-bar lot-trace-filter"
        aria-label={t.pane}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="field-cell filter-field-lg">
          <span className="field-label">
            <label htmlFor={periodId}>{t.period}</label>
            <span className="required-mark" aria-hidden="true">
              {' *'}
            </span>
          </span>
          <DatePicker
            id={periodId}
            mode="range"
            clearable
            value={[draft.from === '' ? null : draft.from, draft.to === '' ? null : draft.to]}
            placeholder={t.periodPlaceholder}
            aria-required
            invalid={periodError !== null}
            aria-describedby={periodError === null ? undefined : periodErrorId}
            onChange={(value) =>
              commit({ from: value === null ? '' : value[0], to: value === null ? '' : value[1] })
            }
          />
          {periodError !== null && (
            <span id={periodErrorId} className="field-error" role="alert">
              {periodError}
            </span>
          )}
        </div>
        <div className="filter-field-md">
          <ReferenceField
            label={t.item}
            valueLabel={labelOf('item', draft.item, resolvedItem)}
            source={itemSource}
            onPick={(row) => pick('item', row)}
            onClear={() => commit({ item: '' })}
          />
        </div>
        <div className="field-cell field-cell-unlabeled filter-actions-end">
          <div className="filter-actions">
            {isChanged && (
              <Button type="button" variant="outlined" onClick={reset}>
                {messages.common.reset}
              </Button>
            )}
            <Button type="submit">{messages.common.search}</Button>
            <FilterMoreButton open={more.isOpen} controlsId={more.id} onToggle={more.toggle} />
          </div>
        </div>
        {/* `hidden` 은 감싸는 상자에 둔다 — `.lot-trace-filter-more` 의 display 가 속성을 덮는다. */}
        <div id={more.id} className="lot-trace-filter-more-wrap" hidden={!more.isOpen}>
          <div className="lot-trace-filter-more">
            {textField('materialLot', t.materialLot, t.exactPlaceholder)}
            {textField('productLot', t.productLot, t.exactPlaceholder)}
            {textField('inbound', t.inboundNo, t.exactPlaceholder)}
            {/* 005 FR-035 — 입하 LOT 번호(번호 조건 · 자재 입고 · 투입만). */}
            {textField('inboundLotNo', t.inboundLotNo, t.exactPlaceholder)}
            {textField('workOrder', t.workOrderNo, t.exactPlaceholder)}
            {textField('shipment', t.shipmentNo, t.exactPlaceholder)}
            <div className="filter-field-md">
              <ReferenceField
                label={t.supplier}
                valueLabel={labelOf('supplier', draft.supplier, resolvedSupplier)}
                source={supplierSource}
                onPick={(row) => pick('supplier', row)}
                onClear={() => commit({ supplier: '' })}
              />
            </div>
            <div className="filter-field-md">
              <ReferenceField
                label={t.customer}
                valueLabel={labelOf('customer', draft.customer, resolvedCustomer)}
                source={customerSource}
                onPick={(row) => pick('customer', row)}
                onClear={() => commit({ customer: '' })}
              />
            </div>
          </div>
        </div>
      </form>
      {/*
       * 접힌 칸의 칩과 칸 없는 조건(입하 LOT 거르기)의 칩을 한 줄에 — 펼치면 칸에 값이 보이므로 칸 없는 조건만 남긴다.
       * 그래서 펼침 여부는 여기서 가르고 칩 줄에는 늘 「접힘」을 넘긴다.
       */}
      <HiddenFilterChips
        open={false}
        chips={more.isOpen ? noFieldChips : [...fieldChips, ...noFieldChips]}
        onRemove={removeChip}
      />
    </>
  );
};
