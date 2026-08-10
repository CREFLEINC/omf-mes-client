import { Button, Checkbox, Chip, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';

import { toFilterChips, type FilterChipNames, type PoFilters } from './filters';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.overReceiptSplit;

export interface PoFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 조건. 편집 중인 값은 이 부품 안에만 있다. */
  appliedFilters: PoFilters;
  /** 공급사 선택지. 화면이 이름으로 풀어 넘긴다 — 번호를 사용자가 칠 일이 없다. */
  supplierOptions: SelectOption[];
  /** 조건 칩에 실을 참조 이름. 번호를 문구로 만드는 자리를 두지 않기 위한 것이다(#44). */
  chipNames: FilterChipNames;
  /** 참조 선택지의 한계(잘림·실패) 안내. 밝히지 않으면 값이 사라진 것으로 읽힌다. */
  supplierNote?: string;
  onSearch: (filters: PoFilters) => void;
  /** 조건 칩의 ×. 그 조건 하나만 풀고 곧바로 다시 조회한다. */
  onRemoveFilter: (key: 'supplier' | 'q') => void;
  onReset: () => void;
}

/**
 * 대상 발주 조회 조건 줄.
 *
 * 트리거 모델은 「모아서 적용, 해제는 즉시」다 — 조건을 고치는 동안 조회가 나가면
 * 반쯤 지운 검색어로 요청이 나간다. 「조회」를 누를 때만 주소가 바뀌고 그때 조회된다.
 * 조건 칩의 ×는 해제라 즉시 반영한다.
 *
 * **「미완료 발주만」도 「조회」를 눌러야 반영된다.** 확인칸이라 즉시 반영하고 싶어지지만,
 * 그러면 같은 줄의 컨트롤 셋 중 하나만 다르게 움직여 어느 것이 언제 적용되는지 알 수 없다.
 *
 * **조건이 하나도 없어도 조회가 열려 있다** — 이 화면은 들어오자마자 대상 후보를 보여야 한다.
 * 잠글 조건이 없어 「조회」에 비활성 사유가 붙는 자리도 없다.
 */
export const PoFilterBar = ({
  appliedFilters,
  supplierOptions,
  chipNames,
  supplierNote,
  onSearch,
  onRemoveFilter,
  onReset,
}: PoFilterBarProps) => {
  const [filters, setFilters] = useState<PoFilters>(appliedFilters);

  /*
   * 주소가 정본이다 — 뒤로가기·초기화로 주소가 **바뀌면** 편집 중인 값도 그 값으로 되돌아간다.
   *
   * **되돌림을 참조가 아니라 값으로 판정한다.** 부모는 렌더할 때마다 주소에서 값을 새로 읽으므로
   * 내용이 같아도 참조가 달라질 수 있고(조회 응답이 도착해 다시 그려질 때가 그렇다),
   * 참조로 판정하면 그때마다 사용자가 치던 값이 사라진다(#43).
   * 값이 실제로 달라졌을 때만 되돌린다.
   */
  const { supplier: appliedSupplier, q: appliedQ, openOnly: appliedOpenOnly } = appliedFilters;

  useEffect(() => {
    setFilters({ supplier: appliedSupplier, q: appliedQ, openOnly: appliedOpenOnly });
  }, [appliedSupplier, appliedQ, appliedOpenOnly]);

  const search = (): void => {
    onSearch(filters);
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
        {/*
         * 규범 3-2 — 선택칸이 「코드 · 이름」을 고른다. 최소 폭을 주지 않으면
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

        <SearchInput
          label={t.fields.q}
          value={filters.q}
          onChange={(event) => {
            setFilters((prev) => ({ ...prev, q: event.target.value }));
          }}
          /* 엔터로도 조회된다 — 검색칸에서 엔터가 아무 일도 하지 않으면 멈춘 것으로 읽힌다. */
          onSearch={search}
        />

        <div className="field-cell field-cell-unlabeled">
          <div className="check-group">
            <Checkbox
              checked={filters.openOnly}
              onChange={(event) => {
                setFilters((prev) => ({ ...prev, openOnly: event.target.checked }));
              }}
            >
              {t.fields.openOnly}
            </Checkbox>
          </div>
        </div>

        {/*
         * 조회와 초기화는 짝이라 함께 줄바꿈되게 묶는다(배치 규범 2-1).
         * 비활성 사유가 붙는 자리가 없다 — 조건 없이도 조회가 열려 있다.
         */}
        <div className="field-cell field-cell-unlabeled">
          <div className="filter-actions">
            <Button onClick={search}>{messages.common.search}</Button>
            <Button variant="outlined" onClick={onReset}>
              {messages.common.reset}
            </Button>
          </div>
        </div>
      </div>

      {/* 기본이 켬이라는 사실은 화면에서 읽혀야 한다 — 무엇이 빠져 보이는지 설명이 없으면 안 된다. */}
      <p className="field-note">{t.filters.openOnlyNote}</p>

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
