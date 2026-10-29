import { Button, DatePicker, Icon, SearchInput } from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { ReferenceField } from '../../patterns/reference-picker';
import type { LotTraceFilters } from './filters';
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
  | 'workOrder'
  | 'shipment'
  | 'supplier'
  | 'customer'
>;

export type FilterSearchMode = 'auto' | 'manual';

export interface FilterBarProps {
  applied: LotTraceFilters;
  /** `auto`는 조건을 바꿔 바로 반영, `manual`은 [조회](같은 조건이면 다시 조회). */
  onSearch: (draft: FilterDraft, mode: FilterSearchMode) => void;
  onReset: () => void;
}

const draftOf = (filters: LotTraceFilters): FilterDraft => ({
  from: filters.from,
  to: filters.to,
  item: filters.item,
  materialLot: filters.materialLot,
  productLot: filters.productLot,
  inbound: filters.inbound,
  workOrder: filters.workOrder,
  shipment: filters.shipment,
  supplier: filters.supplier,
  customer: filters.customer,
});

type TextKey = 'materialLot' | 'productLot' | 'inbound' | 'workOrder' | 'shipment';
type PickKey = 'item' | 'supplier' | 'customer';
type Picked = Partial<Record<PickKey, { id: string; label: string }>>;

/**
 * C-6 조회 조건. 기본 줄: 기간(넓음, 필수, 늘 보임), 품목(보통), [상세 조건 펼치기], [초기화], [조회].
 * 상세 조건(처음엔 접힘): 자재 LOT 번호, 제품 LOT 번호, 입하번호, W/O 번호, 출하번호, 공급사, 고객.
 * 접혀 있는데 그 안의 조건이 걸려 있으면 버튼 옆 한 줄로 알린다.
 * 고르면 끝나는 조건(기간, 품목, 공급사, 고객)은 바로 반영한다. 글자 칸은 Enter나 칸을 떠날 때, 지우기(×)는 바로
 * 반영한다. 기간이 맞지 않으면 반영하지 않고 기간 칸 아래 사유를 보인다(C-7). [조회]는 다시 조회하는 자리로 남는다.
 */
export const FilterBar = ({ applied, onSearch, onReset }: FilterBarProps) => {
  const [draft, setDraft] = useState<FilterDraft>(() => draftOf(applied));
  const [picked, setPicked] = useState<Picked>({});
  const [periodError, setPeriodError] = useState<string | null>(null);
  /* 상세 조건은 늘 접힌 채 시작한다. */
  const [moreOpen, setMoreOpen] = useState(false);
  const periodId = useId();
  const periodErrorId = useId();
  const moreId = useId();

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

  const hiddenConditions = [
    applied.materialLot === '' ? '' : `${t.materialLot} ${applied.materialLot}`,
    applied.productLot === '' ? '' : `${t.productLot} ${applied.productLot}`,
    applied.inbound === '' ? '' : `${t.inboundNo} ${applied.inbound}`,
    applied.workOrder === '' ? '' : `${t.workOrderNo} ${applied.workOrder}`,
    applied.shipment === '' ? '' : `${t.shipmentNo} ${applied.shipment}`,
    applied.supplier === ''
      ? ''
      : `${t.supplier} ${labelOf('supplier', applied.supplier, resolvedSupplier)}`,
    applied.customer === ''
      ? ''
      : `${t.customer} ${labelOf('customer', applied.customer, resolvedCustomer)}`,
  ].filter((value) => value !== '');

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
    <form
      className="filter-bar lot-trace-filter"
      aria-label={t.pane}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="field-cell filter-field-lg">
        <label className="field-label" htmlFor={periodId}>
          {t.period}
          <span className="required-mark" aria-hidden="true">
            {' '}
            *
          </span>
        </label>
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
      <div className="field-cell field-cell-unlabeled">
        <Button
          type="button"
          variant="outlined"
          className="lot-trace-more-toggle"
          aria-expanded={moreOpen}
          aria-controls={moreOpen ? moreId : undefined}
          onClick={() => setMoreOpen((open) => !open)}
        >
          {moreOpen ? t.less : t.more}
          <Icon name={moreOpen ? 'expand_less' : 'expand_more'} size={18} />
        </Button>
      </div>
      <div className="field-cell field-cell-unlabeled filter-actions-end">
        <div className="filter-actions">
          <Button type="button" variant="outlined" onClick={onReset}>
            {messages.common.reset}
          </Button>
          <Button type="submit">{messages.common.search}</Button>
        </div>
      </div>
      {!moreOpen && hiddenConditions.length > 0 && (
        <p className="lot-trace-hidden-summary">{t.hiddenApplied(hiddenConditions.join(', '))}</p>
      )}
      {moreOpen && (
        <div id={moreId} className="lot-trace-filter-more">
          {textField('materialLot', t.materialLot, t.exactPlaceholder)}
          {textField('productLot', t.productLot, t.exactPlaceholder)}
          {textField('inbound', t.inboundNo, t.exactPlaceholder)}
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
      )}
    </form>
  );
};
