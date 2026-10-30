import { Button, Checkbox, SearchInput, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { PartnerSelect } from '../../patterns/partner-select';
import { Select } from '../../patterns/select';
import type { SalesOrderFilters } from './filters';
import { ProgressFilterField } from './progress';
import type { SelectOption } from './types';

const t = messages.erpSalesOrder;

export interface ErpSalesOrderFilterBarProps {
  appliedFilters: SalesOrderFilters;
  /** 수주 상태 선택지 — 공통코드 `SALES_ORDER_STATUS`(서버 장부 P-68) */
  statusOptions: SelectOption[];
  onSearch: (filters: SalesOrderFilters) => void;
  onReset: () => void;
}

/**
 * 조건 줄. 고치는 동안은 초안(`draft`)에만 담고 「조회」를 눌러야 주소로 간다.
 *
 * 진행 단추만은 누르는 즉시 건다 — 걸린 조건에 진행만 바꿔 얹고, 고치던 초안은 그대로 둔다.
 *
 * 상태 선택지는 공통코드 `SALES_ORDER_STATUS` 에서 온다(서버 #737 · 장부 P-68). 화면에 값을 박지 않는다.
 */
export const ErpSalesOrderFilterBar = ({
  appliedFilters,
  statusOptions,
  onSearch,
  onReset,
}: ErpSalesOrderFilterBarProps) => {
  const [draft, setDraft] = useState(appliedFilters);
  const reasonId = useId();
  const customerId = useId();
  const statusId = useId();
  const { q, customer, status, from, to, unassignedOnly, progress } = appliedFilters;
  /* 주소가 바뀌면(뒤로가기·초기화) 초안도 따라간다. 진행은 초안을 거치지 않아 따라가지 않는다. */
  useEffect(
    () => setDraft((current) => ({ ...current, q, customer, status, from, to, unassignedOnly })),
    [q, customer, status, from, to, unassignedOnly],
  );

  const reversed = draft.from !== '' && draft.to !== '' && draft.from > draft.to;
  const update = <K extends keyof SalesOrderFilters>(key: K, value: SalesOrderFilters[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const search = (): void => {
    if (!reversed) onSearch({ ...draft, progress });
  };

  return (
    <div className="filter-bar">
      <TextField
        type="date"
        label={t.fields.orderDateFrom}
        value={draft.from}
        onChange={(event) => update('from', event.target.value)}
      />
      <TextField
        type="date"
        label={t.fields.orderDateTo}
        value={draft.to}
        onChange={(event) => update('to', event.target.value)}
      />
      <div className="field-cell">
        <label className="field-label" htmlFor={customerId}>
          {t.fields.customer}
        </label>
        {/* 거래처는 천여 건이라 칸이 쪽 단위로 받는다(사용자 지시 2026-10-29). */}
        <PartnerSelect
          id={customerId}
          includeInactive
          leadingOptions={[{ value: '', label: t.filters.all }]}
          value={draft.customer}
          onChange={(value) => update('customer', value)}
        />
      </div>
      <div className="field-cell">
        <label className="field-label" htmlFor={statusId}>
          {t.fields.status}
        </label>
        <Select
          id={statusId}
          options={[{ value: '', label: t.filters.all }, ...statusOptions]}
          value={draft.status}
          onChange={(value) => update('status', value)}
        />
      </div>
      <SearchInput
        label={t.fields.q}
        placeholder={t.values.searchPlaceholder}
        value={draft.q}
        onChange={(event) => update('q', event.target.value)}
        onSearch={search}
        clearLabel={messages.common.clear}
      />
      {/* 확인칸은 라벨이 오른쪽에 붙어 라벨 층이 없다 — 윗선을 맞추려 라벨 없는 셀에 담는다. */}
      <div className="field-cell field-cell-unlabeled">
        <Checkbox
          checked={draft.unassignedOnly}
          onChange={(event) => update('unassignedOnly', event.target.checked)}
        >
          {t.fields.unassignedOnly}
        </Checkbox>
      </div>
      <ProgressFilterField
        value={progress}
        onChange={(next) => onSearch({ ...appliedFilters, progress: next })}
      />
      <div className="field-cell field-cell-unlabeled">
        {reversed && (
          <span id={reasonId} className="field-error">
            {t.filters.dateRangeError}
          </span>
        )}
        <div className="filter-actions">
          <Button
            disabled={reversed}
            aria-describedby={reversed ? reasonId : undefined}
            onClick={search}
          >
            {messages.common.search}
          </Button>
          <Button variant="outlined" onClick={onReset}>
            {messages.common.reset}
          </Button>
        </div>
      </div>
    </div>
  );
};
