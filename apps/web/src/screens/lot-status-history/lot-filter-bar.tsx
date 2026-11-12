import { Button, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { PagedSelect, Select } from '../../patterns/select';
import { ALL_LOT_TYPES, type LotFilters } from './filters';
import { ItemFilterField } from './item-filter-field';
import { useLocationReferenceOptions } from './reference-options';

const t = messages.lotStatusHistory;

export interface FilterOption {
  value: string;
  label: string;
}

export interface LotFilterBarProps {
  appliedFilters: LotFilters;
  lotTypeOptions: readonly FilterOption[];
  warehouseOptions: readonly FilterOption[];
  lotTypeNote?: string;
  warehouseNote?: string;
  onSearch: (filters: LotFilters) => void;
  onReset: () => void;
}

interface SelectFieldProps {
  label: string;
  options: readonly FilterOption[];
  value: string;
  note?: string;
  /** 칸 폭 규칙(app.css). */
  className: string;
  /** 먼저 골라야 할 것이 남아 잠겨 있다. */
  disabled?: boolean;
  /** 고를 값이 없을 때 칸 안에 보이는 글자 — 잠긴 까닭을 여기에 둔다(사용자 2026-10-30). */
  placeholder?: string;
  /** 칸 안에서 글자로 찾는다(위치 · omf-all-around#228). */
  searchable?: boolean;
  onChange: (value: string) => void;
}

/**
 * 펼친 선택 목록을 칸과 같은 폭으로 맞춘다(사용자 2026-10-30) — 디자인 시스템 목록(`{id}-listbox`)은 body 에 떠서
 * 긴 값(「창고코드 · 창고명」)만큼 칸보다 넓어진다. 긴 값은 목록 안에서 줄을 바꾼다(app.css).
 */
const useListboxWidthOfTrigger = (id: string): void => {
  useEffect(() => {
    const trigger = document.getElementById(id);
    if (trigger === null) return;
    let waiting: MutationObserver | null = null;
    const stopWaiting = (): void => {
      waiting?.disconnect();
      waiting = null;
    };
    const apply = (): boolean => {
      const listbox = document.getElementById(`${id}-listbox`);
      if (listbox === null) return false;
      const box = trigger.getBoundingClientRect();
      const width = `${String(box.width)}px`;
      listbox.classList.add('lot-status-fit-listbox');
      listbox.style.width = width;
      listbox.style.minWidth = width;
      listbox.style.maxWidth = width;
      /* 오른쪽 끝에서 왼쪽으로 펼친 목록은 줄어든 만큼 밀린다 — 칸 왼쪽 선에 다시 맞춘다. */
      const shift = box.left - listbox.getBoundingClientRect().left;
      if (shift !== 0)
        listbox.style.left = `${String(parseFloat(listbox.style.left || '0') + shift)}px`;
      return true;
    };
    const fit = (): void => {
      stopWaiting();
      if (trigger.getAttribute('aria-expanded') !== 'true' || apply()) return;
      waiting = new MutationObserver(() => {
        if (apply()) stopWaiting();
      });
      waiting.observe(document.body, { childList: true, subtree: true });
    };
    const observer = new MutationObserver(fit);
    observer.observe(trigger, { attributes: true, attributeFilter: ['aria-expanded'] });
    return () => {
      observer.disconnect();
      stopWaiting();
    };
  }, [id]);
};

const SelectField = ({
  label,
  options,
  value,
  note,
  className,
  disabled = false,
  placeholder,
  searchable = false,
  onChange,
}: SelectFieldProps) => {
  const id = useId();
  const noteId = `${id}-note`;
  useListboxWidthOfTrigger(id);

  return (
    <div className={`field-cell ${className}`}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <Select
        id={id}
        options={[...options]}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        searchable={searchable}
        onChange={onChange}
        aria-describedby={note === undefined ? undefined : noteId}
      />
      {note !== undefined && (
        <span id={noteId} className="field-note">
          {note}
        </span>
      )}
    </div>
  );
};

const withAll = (options: readonly FilterOption[]): FilterOption[] => [
  { value: '', label: t.values.all },
  ...options,
];

const toIdentifier = (value: string): number | null => (value === '' ? null : Number(value));

export const LotFilterBar = ({
  appliedFilters,
  lotTypeOptions,
  warehouseOptions,
  lotTypeNote,
  warehouseNote,
  onSearch,
  onReset,
}: LotFilterBarProps) => {
  const [filters, setFilters] = useState<LotFilters>(appliedFilters);

  const {
    lotType: appliedLotType,
    q: appliedQ,
    item: appliedItem,
    status: appliedStatus,
    warehouse: appliedWarehouse,
    location: appliedLocation,
    sort: appliedSort,
    inboundLotNo: appliedInboundLotNo = '',
    inboundLot: appliedInboundLot = '',
  } = appliedFilters;

  useEffect(() => {
    setFilters({
      lotType: appliedLotType,
      q: appliedQ,
      item: appliedItem,
      status: appliedStatus,
      warehouse: appliedWarehouse,
      location: appliedLocation,
      sort: appliedSort,
      inboundLotNo: appliedInboundLotNo,
      inboundLot: appliedInboundLot,
    });
  }, [
    appliedLotType,
    appliedQ,
    appliedItem,
    appliedStatus,
    appliedWarehouse,
    appliedLocation,
    appliedSort,
    appliedInboundLotNo,
    appliedInboundLot,
  ]);

  /*
   * 상세 조건(품목 · 창고 · 위치)은 접어 둔다 — **걸린 상세 조건이 있으면 펼친 채로 들어온다**. 접혀 있으면 무엇으로
   * 걸렀는지 칸에서 보이지 않는다(입하 예정 조회와 같다).
   */
  const detailId = useId();
  const [isDetailOpen, setIsDetailOpen] = useState(
    appliedItem !== '' ||
      appliedWarehouse !== '' ||
      appliedLocation !== '' ||
      appliedInboundLotNo !== '',
  );

  const locations = useLocationReferenceOptions(toIdentifier(filters.warehouse));
  const locationOptions =
    locations.data?.entries.map((entry) => ({
      value: entry.value,
      label: entry.isActive ? entry.label : t.values.inactive(entry.label),
    })) ?? [];
  /*
   * ⭐ 위치는 창고를 고른 뒤에 연다(사용자 지시 2026-09-19) — 그 전에는 잠그고 까닭은 칸 안 글자로 둔다
   * (사용자 2026-10-30 · 조회 줄을 한 줄로 펴면서 라벨 옆 글자가 칸을 넘친다).
   */
  /* 창고 목록은 이미 받아 두었다 — 팝업은 그 안에서 코드·이름으로 찾는다. 「코드 · 이름」 표시명을 나눠 열에 싣는다. */
  const warehouseFieldId = useId();
  const isLocationLocked = filters.warehouse === '';
  const locationNote = isLocationLocked
    ? undefined
    : locations.isError
      ? t.lotFilter.notes.locationFailed
      : locations.data?.isTruncated === true
        ? t.lotFilter.notes.locationTruncated
        : undefined;

  /* 아직 조회 전('')이면 초안은 「전체」다 — 유형을 고르지 않고 조회해도 된다(사용자 지시 2026-09-19). */
  const lotType = filters.lotType === '' ? ALL_LOT_TYPES : filters.lotType;
  // 창고가 비면 위치는 잠겨 있다 — 주소로 들어온 위치 값이 잠긴 채 조회에 실리지 않게 비운다.
  const search = (): void =>
    onSearch({ ...filters, lotType, location: filters.warehouse === '' ? '' : filters.location });

  return (
    <>
      {/*
       * 첫 줄 — LOT 유형 · LOT 번호 스캔 · 조회/초기화/상세 조건 펼치기. 품목 · 창고 · 위치는 아래 줄(상세 조건)로
       * 접어 둔다 — 입하 예정 조회와 같다(사용자 2026-10-30). 현재 상태는 탭 막대의 상태 단추가 맡는다.
       */}
      <div className="filter-bar lot-status-filter">
        <SelectField
          className="lot-status-filter-lot-type"
          label={t.lotFilter.labels.lotType}
          options={[{ value: ALL_LOT_TYPES, label: t.values.all }, ...lotTypeOptions]}
          value={lotType}
          note={lotTypeNote}
          onChange={(lotType) => setFilters((current) => ({ ...current, lotType }))}
        />
        {/*
         * LOT 번호 — 디자인 시스템 검색 칸(돋보기 · 지우기)으로 LOT 상태 묶음의 네 탭을 맞춘다(사용자 2026-10-30).
         * 스캐너의 Enter 가 지금 조건으로 바로 조회한다 — 따로 두었던 [검색] 단추는 뺐다.
         */}
        <SearchInput
          containerClassName="lot-status-filter-lot-no"
          label={t.lotFilter.lotScanLabel}
          placeholder={t.lotFilter.lotNoScanPlaceholder}
          value={filters.q}
          onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
          onSearch={() => search()}
          clearLabel={messages.common.clear}
        />
        {/* 조회·초기화 — [조회](주 동작) → [초기화], 상세 조건 펼치기는 초기화 오른쪽(입하 예정 조회와 같다). */}
        <div className="filter-actions field-cell-unlabeled lot-status-filter-actions">
          <Button variant="filled" onClick={search}>
            {t.actions.search}
          </Button>
          <Button variant="outlined" onClick={onReset}>
            {t.actions.reset}
          </Button>
          <Button
            variant="text"
            size="sm"
            aria-expanded={isDetailOpen}
            aria-controls={detailId}
            onClick={() => setIsDetailOpen((open) => !open)}
          >
            {isDetailOpen ? t.lotFilter.detailClose : t.lotFilter.detailOpen}
          </Button>
        </div>
      </div>
      {/* `hidden` 은 감싸는 상자에 둔다 — `.filter-bar` 의 display 가 속성을 덮는다. */}
      <div id={detailId} hidden={!isDetailOpen}>
        {/* 창고 → 위치 → 품목 순(사용자 2026-10-30). */}
        <div className="filter-bar lot-status-filter">
          {/*
           * 창고는 칸에서 바로 검색해서 고른다(omf-all-around#226 · 종전 검색 팝업과 같은 범위 · 코드 · 이름 일부로 거른다).
           * 다른 창고를 고르면 위치 조건은 비운다. 「전체」는 종전 × 자리다 — 창고 · 위치를 함께 푼다.
           */}
          <div className="field-cell lot-status-filter-place search-select-cell">
            <label className="field-label" htmlFor={warehouseFieldId}>
              {t.lotFilter.labels.warehouse}
            </label>
            <PagedSelect
              id={warehouseFieldId}
              queryKey={['lot-status-history', 'warehouse-select', warehouseOptions]}
              fetchPage={(q) => {
                const keyword = q.toLowerCase();
                const options = warehouseOptions
                  .filter((option) => option.label.toLowerCase().includes(keyword))
                  .map((option) => ({ value: option.value, label: option.label }));
                return Promise.resolve({ options, total: options.length });
              }}
              selectedOption={
                warehouseOptions.find((option) => option.value === filters.warehouse) ?? null
              }
              leadingOptions={[{ value: '', label: t.values.all }]}
              value={filters.warehouse}
              placeholder={t.values.all}
              onChange={(warehouse) =>
                setFilters((current) =>
                  warehouse === ''
                    ? { ...current, warehouse: '', location: '' }
                    : {
                        ...current,
                        warehouse,
                        location: warehouse === current.warehouse ? current.location : '',
                      },
                )
              }
            />
            {warehouseNote !== undefined && <span className="field-note">{warehouseNote}</span>}
          </div>
          <SelectField
            className="lot-status-filter-place lot-status-filter-location"
            label={t.lotFilter.labels.location}
            options={isLocationLocked ? [] : withAll(locationOptions)}
            placeholder={t.lotFilter.notes.locationNeedsWarehouse}
            value={filters.location}
            note={locationNote}
            disabled={isLocationLocked}
            searchable
            onChange={(location) => setFilters((current) => ({ ...current, location }))}
          />
          <ItemFilterField
            value={filters.item}
            onChange={(item) => setFilters((current) => ({ ...current, item }))}
          />
          {/* 005 FR-035 — 입하 LOT 번호(정확 일치). Enter 로 지금 조건을 조회한다. */}
          <SearchInput
            containerClassName="lot-status-filter-inbound-lot"
            label={t.lotFilter.labels.inboundLotNo}
            placeholder={t.lotFilter.inboundLotNoPlaceholder}
            value={filters.inboundLotNo ?? ''}
            onChange={(event) => {
              const inboundLotNo = event.target.value;
              setFilters((current) => ({ ...current, inboundLotNo }));
            }}
            onSearch={() => search()}
            clearLabel={messages.common.clear}
          />
        </div>
      </div>
    </>
  );
};
