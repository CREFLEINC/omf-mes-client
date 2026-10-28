import { Button, DatePicker, Icon, Radio, RadioGroup, SearchInput } from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { ReferenceField } from '../../patterns/reference-picker';
import {
  useItemLabel,
  useItemSource,
  usePartnerLabel,
  usePartnerSource,
  useWarehouseLabel,
  useWarehouseSource,
} from './queries';
import {
  tracePeriodReason,
  type DateAxis,
  type TraceDirection,
  type TraceFilters,
} from './trace-filters';

const t = messages.lotTrace;

export type TraceDraft = Pick<
  TraceFilters,
  | 'q'
  | 'lot'
  | 'item'
  | 'inbound'
  | 'shipment'
  | 'workOrder'
  | 'from'
  | 'to'
  | 'axis'
  | 'partner'
  | 'warehouse'
>;

/** 서버가 돌려준 칸 오류(400). 진입점과 기간 두 자리로 모은다. */
export interface TraceFieldErrors {
  entry?: string;
  period?: string;
}

export type SearchMode = 'auto' | 'manual';

export interface TraceFilterBarProps {
  direction: TraceDirection;
  applied: TraceFilters;
  serverErrors: TraceFieldErrors;
  /** `auto`는 조건을 바꿔 바로 반영, `manual`은 [조회]나 Enter(같은 조건이면 다시 조회). */
  onSearch: (draft: TraceDraft, mode: SearchMode) => void;
  onReset: () => void;
}

const draftOf = (filters: TraceFilters): TraceDraft => ({
  q: filters.q,
  lot: filters.lot,
  item: filters.item,
  inbound: filters.inbound,
  shipment: filters.shipment,
  workOrder: filters.workOrder,
  from: filters.from,
  to: filters.to,
  axis: filters.axis,
  partner: filters.partner,
  warehouse: filters.warehouse,
});

/**
 * LOT 번호 칸의 글자를 어느 조건으로 보낼지 정한다. 기간이 비면 정확 일치(`lotNo`, 기간 없이 조회),
 * 기간이 있으면 일부 일치(`q`, 기간 필수). 일부 일치만 쓰면 오래된 LOT은 기간을 손으로 넓혀야 하고
 * 366일보다 오래된 LOT은 찾을 수 없다.
 */
export const withLotMatch = (draft: TraceDraft): TraceDraft => {
  const text = draft.lot !== '' ? draft.lot : draft.q;
  const exact = draft.from === '' && draft.to === '';
  return { ...draft, lot: exact ? text : '', q: exact ? '' : text };
};

type Picked = Partial<Record<'item' | 'warehouse' | 'partner', { id: string; label: string }>>;

/**
 * C-6 조회 조건(자재 LOT, 제품 LOT 공용). 기본 줄: LOT 번호(보통), 자재 품목 또는 제품 품목(보통), 기간(넓음, 늘 보임),
 * 제품 LOT은 기간 기준, [상세 조건 펼치기], [초기화], [조회].
 * 상세 조건(처음엔 접힘): 자재 LOT은 입하번호, 공급사, 창고 / 제품 LOT은 출하번호, W/O 번호, 고객.
 * 접혀 있는데 그 안의 조건이 걸려 있으면 버튼 옆 한 줄로 알린다.
 * 기간만으로 조회한다(서버 진입점 완화 대기). 기간이 비어도 정확 일치 번호(LOT 번호, 입하번호, 출하번호, W/O 번호)면 조회한다.
 * 고르면 끝나는 조건(품목, 기간, 기간 기준, 공급사, 고객, 창고)은 바로 반영한다. 글자 칸은 Enter나 칸을 떠날 때,
 * 지우기(×)는 바로 반영한다. [조회]는 같은 조건으로 다시 조회하는 자리로 남는다.
 */
export const TraceFilterBar = ({
  direction,
  applied,
  serverErrors,
  onSearch,
  onReset,
}: TraceFilterBarProps) => {
  const [draft, setDraft] = useState<TraceDraft>(() => draftOf(applied));
  const [picked, setPicked] = useState<Picked>({});
  const [periodError, setPeriodError] = useState<string | null>(null);
  /* 상세 조건은 늘 접힌 채 시작한다. 그 안의 조건이 걸려 있으면 버튼 옆 한 줄(`hiddenConditions`)로 알린다. */
  const [moreOpen, setMoreOpen] = useState(false);
  const periodId = useId();
  const periodErrorId = useId();
  const entryErrorId = useId();
  const moreId = useId();

  const appliedKey = JSON.stringify(draftOf(applied));
  useEffect(() => {
    setDraft(JSON.parse(appliedKey) as TraceDraft);
    setPeriodError(null);
  }, [appliedKey]);

  const forward = direction === 'forward';
  const role = forward ? 'SUPPLIER' : 'CUSTOMER';
  const itemSource = useItemSource();
  const warehouseSource = useWarehouseSource();
  const partnerSource = usePartnerSource(role);
  const resolvedItem = useItemLabel(draft.item);
  const resolvedWarehouse = useWarehouseLabel(draft.warehouse);
  const resolvedPartner = usePartnerLabel(draft.partner, role);
  const labelOf = (key: keyof Picked, id: string, resolved: string): string =>
    id === '' ? '' : picked[key]?.id === id ? (picked[key]?.label ?? '') : resolved;

  const set = (patch: Partial<TraceDraft>) => setDraft((current) => ({ ...current, ...patch }));
  /**
   * 바꾼 조건을 바로 반영한다. 기간이 맞지 않으면 반영하지 않고 기간 칸 아래 사유를 보인다.
   */
  const commit = (patch: Partial<TraceDraft>) => {
    const next = withLotMatch({ ...draft, ...patch });
    setDraft(next);
    const reason = tracePeriodReason({ ...applied, ...next });
    setPeriodError(reason);
    /* 고른 기간이 틀리면 반영하지 않는다. 기간이 비면 반영하고, 목록 자리가 기간을 고르라고 말한다. */
    if (reason !== null && (next.from !== '' || next.to !== '')) return;
    onSearch(next, 'auto');
  };
  const pick = (key: keyof Picked, row: { id: number; code: string; name: string }) => {
    setPicked((current) => ({
      ...current,
      [key]: { id: String(row.id), label: named(row.name, row.code) },
    }));
    commit({ [key]: String(row.id) });
  };

  const periodMessage = periodError ?? serverErrors.period ?? null;
  const open = moreOpen;
  const hiddenConditions = [
    forward && applied.inbound !== '' ? `${t.trace.inboundNo} ${applied.inbound}` : '',
    !forward && applied.shipment !== '' ? `${t.trace.shipmentNo} ${applied.shipment}` : '',
    !forward && applied.workOrder !== '' ? `${t.trace.workOrderNo} ${applied.workOrder}` : '',
    applied.partner !== ''
      ? `${forward ? t.filters.supplier : t.filters.customer} ${labelOf('partner', applied.partner, resolvedPartner)}`
      : '',
    forward && applied.warehouse !== ''
      ? `${t.filters.warehouse} ${labelOf('warehouse', applied.warehouse, resolvedWarehouse)}`
      : '',
  ].filter((text) => text !== '');
  const submit = () => {
    const next = withLotMatch(draft);
    const reason = tracePeriodReason({ ...applied, ...next });
    setPeriodError(reason);
    if (reason === null) onSearch(next, 'manual');
  };
  /* 글자 칸은 칠 때마다가 아니라 Enter나 칸을 떠날 때 반영한다. 일부 LOT 번호로 부르면 기간이 필요해진다. */
  const lotText = (value: Pick<TraceDraft, 'lot' | 'q'>) =>
    value.lot !== '' ? value.lot : value.q;
  const leaveText = (key: 'inbound' | 'shipment' | 'workOrder' | 'lot') => {
    const changed =
      key === 'lot' ? lotText(draft) !== lotText(applied) : draft[key] !== applied[key];
    if (changed) commit({});
  };

  const textField = (
    key: 'inbound' | 'shipment' | 'workOrder',
    label: string,
    placeholder: string,
  ) => (
    <div className="field-cell filter-field-md">
      <SearchInput
        fullWidth
        label={label}
        placeholder={placeholder}
        value={draft[key]}
        clearLabel={messages.common.clear}
        onChange={(event) => set({ [key]: event.target.value.trim() })}
        onSearch={submit}
        onBlur={() => leaveText(key)}
        onClear={() => commit({ [key]: '' })}
      />
    </div>
  );

  return (
    <form
      className="filter-bar lot-trace-filter"
      aria-label={t.filters.pane}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="field-cell filter-field-md">
        <SearchInput
          fullWidth
          label={t.trace.lotNo}
          placeholder={t.trace.lotNoPlaceholder}
          value={draft.lot !== '' ? draft.lot : draft.q}
          clearLabel={messages.common.clear}
          aria-describedby={serverErrors.entry === undefined ? undefined : entryErrorId}
          onChange={(event) => set({ q: event.target.value.trim(), lot: '' })}
          onSearch={submit}
          onBlur={() => leaveText('lot')}
          onClear={() => commit({ q: '', lot: '' })}
        />
        {serverErrors.entry !== undefined && (
          <span id={entryErrorId} className="field-error" role="alert">
            {serverErrors.entry}
          </span>
        )}
      </div>
      <div className="filter-field-md">
        <ReferenceField
          label={forward ? t.trace.materialItem : t.trace.productItem}
          valueLabel={labelOf('item', draft.item, resolvedItem)}
          source={itemSource}
          onPick={(row) => pick('item', row)}
          onClear={() => commit({ item: '' })}
        />
      </div>
      <div className="field-cell filter-field-lg">
        <label className="field-label" htmlFor={periodId}>
          {forward ? t.trace.receiptPeriod : t.trace.period}
        </label>
        <DatePicker
          id={periodId}
          mode="range"
          clearable
          value={[draft.from === '' ? null : draft.from, draft.to === '' ? null : draft.to]}
          placeholder={t.filters.periodPlaceholder}
          invalid={periodMessage !== null}
          aria-describedby={periodMessage === null ? undefined : periodErrorId}
          onChange={(value) =>
            commit({ from: value === null ? '' : value[0], to: value === null ? '' : value[1] })
          }
        />
        {periodMessage !== null && (
          <span id={periodErrorId} className="field-error" role="alert">
            {periodMessage}
          </span>
        )}
      </div>
      {!forward && (
        <div className="field-cell">
          <span className="field-label" id={`${periodId}-axis`}>
            {t.trace.dateAxis}
          </span>
          <RadioGroup
            name={`${periodId}-axis`}
            orientation="horizontal"
            aria-labelledby={`${periodId}-axis`}
            value={draft.axis}
            onChange={(next) => commit({ axis: next as DateAxis })}
            className="lot-trace-axis"
          >
            <Radio value="PRODUCED">{t.trace.dateAxisProduced}</Radio>
            <Radio value="SHIPPED">{t.trace.dateAxisShipped}</Radio>
          </RadioGroup>
        </div>
      )}
      <div className="field-cell field-cell-unlabeled">
        <Button
          type="button"
          variant="outlined"
          className="lot-trace-more-toggle"
          aria-expanded={open}
          aria-controls={open ? moreId : undefined}
          onClick={() => setMoreOpen(!open)}
        >
          {open ? t.filters.less : t.filters.more}
          <Icon name={open ? 'expand_less' : 'expand_more'} size={18} />
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
      {!open && hiddenConditions.length > 0 && (
        <p className="lot-trace-hidden-summary">
          {t.filters.hiddenApplied(hiddenConditions.join(', '))}
        </p>
      )}
      {open && (
        <div id={moreId} className="lot-trace-filter-more">
          {forward
            ? textField('inbound', t.trace.inboundNo, t.trace.inboundNoPlaceholder)
            : textField('shipment', t.trace.shipmentNo, t.trace.shipmentNoPlaceholder)}
          {!forward && textField('workOrder', t.trace.workOrderNo, t.trace.workOrderNoPlaceholder)}
          <div className="filter-field-md">
            <ReferenceField
              label={forward ? t.filters.supplier : t.filters.customer}
              valueLabel={labelOf('partner', draft.partner, resolvedPartner)}
              source={partnerSource}
              onPick={(row) => pick('partner', row)}
              onClear={() => commit({ partner: '' })}
            />
          </div>
          {forward && (
            <div className="filter-field-md">
              <ReferenceField
                label={t.filters.warehouse}
                valueLabel={labelOf('warehouse', draft.warehouse, resolvedWarehouse)}
                source={warehouseSource}
                onPick={(row) => pick('warehouse', row)}
                onClear={() => commit({ warehouse: '' })}
              />
            </div>
          )}
        </div>
      )}
    </form>
  );
};
