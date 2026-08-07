import { Button, Chip, SearchInput, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { toFilterChips, type AsnFilters, type FilterChipNames } from './filters';
import { validatePeriod, type PeriodInput } from './period';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.inboundSchedule;

export interface AsnFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 기간. 편집 중인 값은 이 부품 안에만 있다. */
  appliedPeriod: PeriodInput;
  appliedFilters: AsnFilters;
  /** 참조 선택지 2종. 화면이 이름으로 풀어 넘긴다 — 번호를 사용자가 칠 일이 없다. */
  supplierOptions: SelectOption[];
  itemOptions: SelectOption[];
  /** 상태 선택지. 값 목록이 확정되지 않아 조회 결과에서 만든다. */
  statusOptions: readonly string[];
  /** 조건 칩에 실을 참조 이름. 번호를 문구로 만드는 자리를 두지 않기 위한 것이다(#44). */
  chipNames: FilterChipNames;
  /** 참조 선택지의 한계(잘림·실패) 안내. 밝히지 않으면 값이 사라진 것으로 읽힌다. */
  supplierNote?: string;
  itemNote?: string;
  onSearch: (period: PeriodInput, filters: AsnFilters) => void;
  /** 조건 칩의 ×. 그 조건 하나만 풀고 곧바로 다시 조회한다. */
  onRemoveFilter: (key: keyof AsnFilters) => void;
  onReset: () => void;
}

/**
 * 조회 조건 줄.
 *
 * 트리거 모델은 「모아서 적용, 해제는 즉시」다 — 날짜나 조건을 고치는 동안 조회가 나가면
 * 반쯤 지운 기간으로 요청이 나간다. 「조회」를 누를 때만 주소가 바뀌고 그때 조회된다.
 * 조건 칩의 ×는 해제라 즉시 반영한다.
 *
 * **기간이 필수가 아니다.** 비운 채로도 조회가 열려 있고, 그 사실을 안내 한 줄이 밝힌다.
 * 잠그는 것은 보내면 반드시 400이 되는 값(없는 날짜·뒤집힌 기간)뿐이다.
 */
export const AsnFilterBar = ({
  appliedPeriod,
  appliedFilters,
  supplierOptions,
  itemOptions,
  statusOptions,
  chipNames,
  supplierNote,
  itemNote,
  onSearch,
  onRemoveFilter,
  onReset,
}: AsnFilterBarProps) => {
  const reasonId = useId();

  const [period, setPeriod] = useState<PeriodInput>(appliedPeriod);
  const [filters, setFilters] = useState<AsnFilters>(appliedFilters);

  /*
   * 주소가 정본이다 — 뒤로가기·초기화로 주소가 **바뀌면** 편집 중인 값도 그 값으로 되돌아간다.
   *
   * **되돌림을 참조가 아니라 값으로 판정한다.** 부모는 렌더할 때마다 주소에서 값을 새로 읽으므로
   * 내용이 같아도 참조가 달라질 수 있고(조회 응답이 도착해 다시 그려질 때가 그렇다),
   * 참조로 판정하면 그때마다 사용자가 치던 값이 사라진다(#43).
   * 값이 실제로 달라졌을 때만 되돌린다.
   */
  const { from: appliedFrom, to: appliedTo } = appliedPeriod;
  const {
    supplier: appliedSupplier,
    status: appliedStatus,
    item: appliedItem,
    q: appliedQ,
  } = appliedFilters;

  useEffect(() => {
    setPeriod({ from: appliedFrom, to: appliedTo });
  }, [appliedFrom, appliedTo]);

  useEffect(() => {
    setFilters({
      supplier: appliedSupplier,
      status: appliedStatus,
      item: appliedItem,
      q: appliedQ,
    });
  }, [appliedSupplier, appliedStatus, appliedItem, appliedQ]);

  /** 보내면 반드시 400이 되는 기간만 막는다. 비어 있는 것은 잘못이 아니다. */
  const searchReason = validatePeriod(period);

  const search = (): void => {
    if (searchReason !== null) return;

    onSearch(period, filters);
  };

  const chips = toFilterChips(appliedFilters, chipNames);

  /* 「전체」를 값이 빈 선택지로 둔다 — 두지 않으면 한 번 고른 뒤에 해제할 방법이 칸 안에 없어진다. */
  const withAll = (options: SelectOption[]): SelectOption[] => [
    { value: '', label: t.filters.all },
    ...options,
  ];

  return (
    <>
      <div className="filter-bar">
        <TextField
          type="date"
          label={t.fields.periodFrom}
          value={period.from}
          onChange={(event) => {
            setPeriod((prev) => ({ ...prev, from: event.target.value }));
          }}
        />
        <TextField
          type="date"
          label={t.fields.periodTo}
          value={period.to}
          onChange={(event) => {
            setPeriod((prev) => ({ ...prev, to: event.target.value }));
          }}
        />

        {/*
         * 규범 3-2 — 세 선택칸 모두 「코드 · 이름」이나 코드값을 고른다. 최소 폭을 주지 않으면
         * 선택지 목록이 트리거 폭에 갇혀 잘리고, 무엇을 고르는지 읽을 수 없다.
         */}
        <SelectField
          wide
          label={t.fields.supplier}
          options={withAll(supplierOptions)}
          value={filters.supplier}
          note={supplierNote}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, supplier: value }));
          }}
        />
        <SelectField
          wide
          label={t.fields.status}
          options={withAll(statusOptions.map((code) => ({ value: code, label: code })))}
          value={filters.status}
          note={t.filters.statusNote}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, status: value }));
          }}
        />
        <SelectField
          wide
          label={t.fields.item}
          options={withAll(itemOptions)}
          value={filters.item}
          note={itemNote}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, item: value }));
          }}
        />

        <SearchInput
          label={t.fields.q}
          value={filters.q}
          onChange={(event) => {
            setFilters((prev) => ({ ...prev, q: event.target.value }));
          }}
          /* 엔터로도 조회된다 — 검색칸에서 엔터가 아무 일도 하지 않으면 멈춘 것으로 읽힌다. */
          onSearch={search}
        />

        {/*
         * 조회와 초기화는 짝이라 함께 줄바꿈되게 묶고(배치 규범 2-1), 비활성 사유는 그 아래에 둔다.
         * 사유는 감추지 않고 항상 보이는 DOM 텍스트로 렌더해 aria-describedby로 잇는다 —
         * 비활성 컨트롤은 포커스를 받지 못해 툴팁만으로는 키보드·보조기술 사용자가 닿을 수 없다.
         */}
        <div className="field-cell field-cell-unlabeled">
          <div className="filter-actions">
            <Button
              disabled={searchReason !== null}
              aria-describedby={searchReason === null ? undefined : reasonId}
              onClick={search}
            >
              {messages.common.search}
            </Button>
            <Button variant="outlined" onClick={onReset}>
              {messages.common.reset}
            </Button>
          </div>
          {searchReason !== null && (
            <span id={reasonId} className="field-note">
              {searchReason}
            </span>
          )}
        </div>
      </div>

      {/* 기간이 필수가 아니라는 사실은 화면에서 읽혀야 한다 — 비워 두면 「빠뜨렸다」로 읽힌다. */}
      <p className="field-note">{t.filters.periodNote}</p>

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
