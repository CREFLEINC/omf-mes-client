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
import { ItemSelect } from '../../patterns/item-select';
import { Select } from '../../patterns/select';
import { DEFAULT_FILTERS, type ErpProductionOrderFilters } from './filters';
import { ProgressFilterField } from './progress';
import type { SelectOption } from './types';

const t = messages.erpProductionOrder;

interface FilterSelectProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
}

/** 접힌 칸의 코드 선택 — 고정 코드라 좁은 폭(C-19). */
const FilterSelect = ({ label, options, value, onChange }: FilterSelectProps) => {
  const id = useId();
  return (
    <div className="field-cell filter-field-sm">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <Select
        id={id}
        options={[{ value: '', label: t.filters.all }, ...options]}
        value={value}
        onChange={onChange}
      />
    </div>
  );
};

interface ItemFieldProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * 품목 조건 — 품목 마스터가 9천여 건이라 칸이 쪽 단위로 받는다(펼칠 때 첫 쪽 · 검색은 서버 · 끝에 닿으면 다음 쪽,
 * 사용자 지시 2026-10-29). 지난 ERP W/O 를 찾는 조건이라 사용 중지 품목까지 찾는다. 고른 품목의 이름은 칸이 번호로
 * 푼다 — 주소로 들어온 값도 이름이 보인다.
 */
const ItemField = ({ value, onChange }: ItemFieldProps) => {
  const id = useId();
  return (
    <div className="field-cell filter-field-md">
      <label className="field-label" htmlFor={id}>
        {t.filters.itemSelect}
      </label>
      <ItemSelect
        id={id}
        includeInactive
        leadingOptions={[{ value: '', label: t.filters.all }]}
        value={value}
        onChange={onChange}
      />
    </div>
  );
};

export interface ErpProductionOrderFilterBarProps {
  appliedFilters: ErpProductionOrderFilters;
  statusOptions: SelectOption[];
  onSearch: (filters: ErpProductionOrderFilters) => void;
  onReset: () => void;
}

/**
 * 조건 줄. 고치는 동안은 초안(`draft`)에만 담고 「조회」를 눌러야 주소로 간다 —
 * 칸 하나를 바꿀 때마다 조회가 나가면 기간을 다 고르기도 전에 엉뚱한 결과가 뜬다.
 * 진행 단추만은 누르는 즉시 건다 — 걸린 조건에 진행만 바꿔 얹고, 고치던 초안은 그대로 둔다.
 *
 * **보이는 칸은 셋이다**(C-6) — 계획 시작일 · 품목 · ERP W/O 번호. 칸 폭은 C-19 고정 폭이라 값을 넣어도 그대로다 —
 * 기간 · 품목은 보통, 번호는 좁음이다(보통 셋에 조회 · 초기화 · 조건 더보기를 더하면 1280 에서 한 줄을 넘는다).
 * 진행 · 상태는 「조건 더보기」에 접고, 걸려 있으면 칩으로만 알린다. 「초기화」는 바뀐 것이 있을 때만 보인다.
 * [조회][초기화][조건 더보기]는 줄 오른쪽 끝(#358).
 */
export const ErpProductionOrderFilterBar = ({
  appliedFilters,
  statusOptions,
  onSearch,
  onReset,
}: ErpProductionOrderFilterBarProps) => {
  const [draft, setDraft] = useState(appliedFilters);
  const searchRef = useFitPlaceholderWidth(t.values.searchPlaceholder);
  const periodId = useId();
  const more = useFilterMore();
  const { q, item, status, from, to, progress } = appliedFilters;
  /* 주소가 바뀌면(뒤로가기·초기화) 초안도 따라간다. 진행은 초안을 거치지 않아 따라가지 않는다. */
  useEffect(
    () => setDraft((current) => ({ ...current, q, item, status, from, to })),
    [q, item, status, from, to],
  );

  const update = <K extends keyof ErpProductionOrderFilters>(
    key: K,
    value: ErpProductionOrderFilters[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));
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
  /* 진행은 처음 값(전체)과 다를 때만 칩이 된다 — × 는 처음 값으로 되돌리고 다시 조회한다. */
  const hiddenChips: HiddenFilterChip<'progress' | 'status'>[] = [
    ...(progress === DEFAULT_FILTERS.progress
      ? []
      : [
          {
            key: 'progress' as const,
            label: t.filters.chip(t.fields.progress, t.progress[progress]),
            removeLabel: messages.common.filterMore.remove(t.fields.progress),
          },
        ]),
    ...(status === ''
      ? []
      : [
          {
            key: 'status' as const,
            /* 칩에는 코드가 아니라 선택지 이름을 낸다. 선택지를 아직 못 받았으면 받은 값 그대로. */
            label: t.filters.chip(
              t.fields.status,
              statusOptions.find((option) => option.value === status)?.label ?? status,
            ),
            removeLabel: messages.common.filterMore.remove(t.fields.status),
          },
        ]),
  ];

  return (
    <>
      <div className="filter-bar erp-data-filter-row">
        {/* 선택 · 검색 · 기간 순서 — 품목 · 거래처 · BOM 탭과 같은 차례(사용자 지시 2026-11-24). */}
        <ItemField value={draft.item} onChange={(value) => update('item', value)} />
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
        {/*
         * 기간은 **한 컨트롤**이다(C-12 — 브라우저 날짜 칸을 쓰지 않는다). 컴포넌트가 완결된 쌍만, 그것도
         * 시작 ≤ 종료로만 내보내 이 칸을 거친 역전은 생기지 않는다. 주소 키(`from`·`to`)와 요청 파라미터는 그대로다.
         */}
        <div className="field-cell filter-field-md">
          <label className="field-label" htmlFor={periodId}>
            {t.fields.plannedStartDate}
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
      <div id={more.id} hidden={!more.isOpen}>
        <div className="filter-bar">
          {/* 진행은 누르는 즉시 건다 — 접힌 칸 안에서도 「조회」를 기다리지 않는다. */}
          <ProgressFilterField
            value={progress}
            onChange={(next) => onSearch({ ...appliedFilters, progress: next })}
          />
          <FilterSelect
            label={t.filters.statusSelect}
            options={statusOptions}
            value={draft.status}
            onChange={(value) => update('status', value)}
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
