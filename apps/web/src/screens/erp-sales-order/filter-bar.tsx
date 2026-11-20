import { Button, Checkbox, DatePicker, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import {
  FilterMoreButton,
  HiddenFilterChips,
  hasChangedFilters,
  useFilterMore,
  type HiddenFilterChip,
} from '../../patterns/filter-more';
import { PartnerSelect } from '../../patterns/partner-select';
import { Select } from '../../patterns/select';
import { DEFAULT_FILTERS, type SalesOrderFilters } from './filters';
import { ProgressFilterField } from './progress';
import type { SelectOption } from './types';

const t = messages.erpSalesOrder;

/** 「조건 더보기」에 접는 조건 — 진행 · 상태 · 미편성만. */
type HiddenKey = 'progress' | 'status' | 'unassignedOnly';

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
 *
 * **보이는 칸은 셋이다**(C-6) — 수주일 · 고객사 · 수주번호. 칸 폭은 C-19 고정 폭이라 값을 넣어도 그대로다 — 기간 · 고객사는
 * 보통, 수주번호는 좁음이다(보통 셋에 조회 · 초기화 · 조건 더보기를 더하면 1280 에서 한 줄을 넘는다).
 * 진행 · 상태 · 미편성만은 「조건 더보기」에 접고, 접힌 칸에 걸린 조건은 칩으로만 알린다. 「초기화」는 바뀐 것이 있을
 * 때만 보인다.
 */
export const ErpSalesOrderFilterBar = ({
  appliedFilters,
  statusOptions,
  onSearch,
  onReset,
}: ErpSalesOrderFilterBarProps) => {
  const [draft, setDraft] = useState(appliedFilters);
  const periodId = useId();
  const customerId = useId();
  const statusId = useId();
  const more = useFilterMore();
  const { q, customer, status, from, to, unassignedOnly, progress } = appliedFilters;
  /* 주소가 바뀌면(뒤로가기·초기화) 초안도 따라간다. 진행은 초안을 거치지 않아 따라가지 않는다. */
  useEffect(
    () => setDraft((current) => ({ ...current, q, customer, status, from, to, unassignedOnly })),
    [q, customer, status, from, to, unassignedOnly],
  );

  const update = <K extends keyof SalesOrderFilters>(key: K, value: SalesOrderFilters[K]) =>
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
  const hiddenChips: HiddenFilterChip<HiddenKey>[] = [];
  /* 진행은 처음 값(전체)과 다를 때만 칩이 된다 — × 는 처음 값으로 되돌리고 다시 조회한다. */
  if (progress !== DEFAULT_FILTERS.progress) {
    hiddenChips.push({
      key: 'progress',
      label: t.filters.chip(t.fields.progress, t.progress[progress]),
      removeLabel: messages.common.filterMore.remove(t.fields.progress),
    });
  }
  if (status !== '') {
    hiddenChips.push({
      key: 'status',
      /* 칩에는 코드가 아니라 선택지 이름을 낸다. 선택지를 아직 못 받았으면 받은 값 그대로. */
      label: t.filters.chip(
        t.fields.status,
        statusOptions.find((option) => option.value === status)?.label ?? status,
      ),
      removeLabel: messages.common.filterMore.remove(t.fields.status),
    });
  }
  if (unassignedOnly) {
    hiddenChips.push({
      key: 'unassignedOnly',
      label: t.fields.unassignedOnly,
      removeLabel: messages.common.filterMore.remove(t.fields.unassignedOnly),
    });
  }

  return (
    <>
      <div className="filter-bar">
        {/*
         * 기간은 **한 컨트롤**이다(C-12 — 브라우저 날짜 칸을 쓰지 않는다). 컴포넌트가 완결된 쌍만, 그것도
         * 시작 ≤ 종료로만 내보내 이 칸을 거친 역전은 생기지 않는다. 주소 키(`from`·`to`)와 요청 파라미터는 그대로다.
         */}
        <div className="field-cell filter-field-md">
          <label className="field-label" htmlFor={periodId}>
            {t.fields.orderDate}
          </label>
          <DatePicker
            id={periodId}
            mode="range"
            clearable
            value={[draft.from === '' ? null : draft.from, draft.to === '' ? null : draft.to]}
            placeholder={messages.common.selectDate}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                from: value === null ? '' : value[0],
                to: value === null ? '' : value[1],
              }))
            }
          />
        </div>
        <div className="field-cell filter-field-md">
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
        <SearchInput
          label={t.fields.q}
          placeholder={t.values.searchPlaceholder}
          value={draft.q}
          onChange={(event) => update('q', event.target.value)}
          onSearch={search}
          clearLabel={messages.common.clear}
          containerClassName="filter-field-sm erp-order-search"
        />
        <div className="field-cell field-cell-unlabeled">
          <div className="filter-actions">
            <Button onClick={search}>{messages.common.search}</Button>
            {isChanged && (
              <Button variant="outlined" onClick={reset}>
                {messages.common.reset}
              </Button>
            )}
            <FilterMoreButton open={more.isOpen} controlsId={more.id} onToggle={more.toggle} />
          </div>
        </div>
      </div>

      {/* `hidden` 은 감싸는 상자에 둔다 — `.filter-bar` 의 display 가 속성을 덮는다. */}
      <div id={more.id} hidden={!more.isOpen}>
        <div className="filter-bar">
          {/* 진행은 누르는 즉시 건다 — 접힌 칸 안에서도 「조회」를 기다리지 않는다. */}
          <ProgressFilterField
            value={progress}
            onChange={(next) => onSearch({ ...appliedFilters, progress: next })}
          />
          <div className="field-cell filter-field-sm">
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
          {/* 확인칸은 라벨이 오른쪽에 붙어 라벨 층이 없다 — 윗선을 맞추려 라벨 없는 셀에 담는다. */}
          <div className="field-cell field-cell-unlabeled">
            <Checkbox
              checked={draft.unassignedOnly}
              onChange={(event) => update('unassignedOnly', event.target.checked)}
            >
              {t.fields.unassignedOnly}
            </Checkbox>
          </div>
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
