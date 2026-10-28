import { Button, DatePicker, Select } from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { ReferenceField } from '../../patterns/reference-picker';
import type { LotTraceFilters } from './filters';
import { validatePeriod } from './period';
import {
  partnerRoleOf,
  useItemLabel,
  useItemSource,
  usePartnerLabel,
  usePartnerSource,
  useStatusCodes,
  useWarehouseLabel,
  useWarehouseSource,
} from './queries';

const t = messages.lotTrace.filters;

export type FilterDraft = Pick<
  LotTraceFilters,
  'from' | 'to' | 'item' | 'warehouse' | 'partner' | 'status'
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
  warehouse: filters.warehouse,
  partner: filters.partner,
  status: filters.status,
});

type Picked = Partial<Record<'item' | 'warehouse' | 'partner', { id: string; label: string }>>;

/**
 * C-6 조회 조건. 기본 줄: 기간(넓음, 필수. 「시작일 ~ 종료일」이 보통 폭에서 잘린다), 품목(보통), [조건 더보기], [초기화], [조회].
 * 조건 더보기: 창고(보통), 공급사 또는 고객(보통, 제품입고에는 없음), 상태(좁음).
 * 구분은 페이지 머리 조건 칩이 맡는다(C-6, C-17). 기간 검증은 실행할 때 한다(C-7).
 * 조건은 고르면 바로 반영한다. 기간이 맞지 않으면 반영하지 않고 사유를 보인다. [조회]는 다시 조회하는 자리로 남는다.
 */
export const FilterBar = ({ applied, onSearch, onReset }: FilterBarProps) => {
  const [draft, setDraft] = useState<FilterDraft>(() => draftOf(applied));
  const [picked, setPicked] = useState<Picked>({});
  const [periodError, setPeriodError] = useState<string | null>(null);
  const hiddenApplied = applied.warehouse !== '' || applied.partner !== '' || applied.status !== '';
  const [moreOpen, setMoreOpen] = useState(hiddenApplied);
  const periodId = useId();
  const periodErrorId = useId();
  const statusId = useId();
  const moreId = useId();

  const { kind, from, to, item, warehouse, partner, status } = applied;
  useEffect(() => {
    setDraft({ from, to, item, warehouse, partner, status });
    setPeriodError(null);
  }, [from, to, item, warehouse, partner, status]);
  useEffect(() => {
    if (hiddenApplied) setMoreOpen(true);
  }, [hiddenApplied]);

  const role = partnerRoleOf(kind);
  const itemSource = useItemSource();
  const warehouseSource = useWarehouseSource();
  const partnerSource = usePartnerSource(role);
  const statusCodes = useStatusCodes(kind);
  const resolvedItem = useItemLabel(draft.item);
  const resolvedWarehouse = useWarehouseLabel(draft.warehouse);
  const resolvedPartner = usePartnerLabel(draft.partner, role);
  const labelOf = (key: keyof Picked, id: string, resolved: string): string =>
    id === '' ? '' : picked[key]?.id === id ? (picked[key]?.label ?? '') : resolved;

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
          onPick={(row) => {
            setPicked((current) => ({
              ...current,
              item: { id: String(row.id), label: named(row.name, row.code) },
            }));
            commit({ item: String(row.id) });
          }}
          onClear={() => commit({ item: '' })}
        />
      </div>
      <div className="field-cell field-cell-unlabeled">
        <Button
          type="button"
          variant="outlined"
          aria-expanded={moreOpen}
          aria-controls={moreOpen ? moreId : undefined}
          onClick={() => setMoreOpen((open) => !open)}
        >
          {moreOpen ? t.less : t.more}
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
      {moreOpen && (
        <div id={moreId} className="lot-trace-filter-more">
          <div className="filter-field-md">
            <ReferenceField
              label={t.warehouse}
              valueLabel={labelOf('warehouse', draft.warehouse, resolvedWarehouse)}
              source={warehouseSource}
              onPick={(row) => {
                setPicked((current) => ({
                  ...current,
                  warehouse: { id: String(row.id), label: named(row.name, row.code) },
                }));
                commit({ warehouse: String(row.id) });
              }}
              onClear={() => commit({ warehouse: '' })}
            />
          </div>
          {role !== null && (
            <div className="filter-field-md">
              <ReferenceField
                label={role === 'SUPPLIER' ? t.supplier : t.customer}
                valueLabel={labelOf('partner', draft.partner, resolvedPartner)}
                source={partnerSource}
                onPick={(row) => {
                  setPicked((current) => ({
                    ...current,
                    partner: { id: String(row.id), label: named(row.name, row.code) },
                  }));
                  commit({ partner: String(row.id) });
                }}
                onClear={() => commit({ partner: '' })}
              />
            </div>
          )}
          <div className="field-cell filter-field-sm">
            <label className="field-label" htmlFor={statusId}>
              {t.status}
            </label>
            <Select
              id={statusId}
              value={draft.status}
              placeholder={t.statusAll}
              options={[{ value: '', label: t.statusAll }, ...statusCodes.options]}
              onChange={(value) => commit({ status: value })}
            />
          </div>
        </div>
      )}
    </form>
  );
};
