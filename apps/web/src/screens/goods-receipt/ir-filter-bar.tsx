import { Button, Chip, SearchInput, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';

import {
  toFilterChips,
  type ChipFilterKey,
  type FilterChipNames,
  type IrFilters,
} from './filters';
import { SelectField } from './select-field';
import { irStatusNote, irStatusOptions, irStatusPlaceholder } from './status-options';
import type { SelectOption } from './types';

const t = messages.goodsReceipt;

export interface IrFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 조건. 편집 중인 값은 이 부품 안에만 있다. */
  appliedFilters: IrFilters;
  /** 공급사 선택지. 화면이 이름으로 풀어 넘긴다 — 번호를 사용자가 칠 일이 없다. */
  supplierOptions: SelectOption[];
  /** 조건 칩에 실을 참조 이름. 번호를 문구로 만드는 자리를 두지 않기 위한 것이다(#44). */
  chipNames: FilterChipNames;
  /** 참조 선택지의 한계(잘림·실패) 안내. 밝히지 않으면 값이 사라진 것으로 읽힌다. */
  supplierNote?: string;
  /**
   * 입고 처리를 보내는 중인가.
   *
   * 참이면 **조회·초기화를 닫는다** — 조건을 다시 걸면 고른 전표가 풀려 앞 전표의 처리 결과가
   * 다른 맥락에 나타난다. **조건 칸 자체는 잠그지 않는다**(배치 규범 3) — 잠그면 지금 걸린
   * 조건을 읽을 수만 있고 고칠 수 없는 상태가 되는데, 조건을 고쳐도 누르기 전에는 아무 일도
   * 일어나지 않는다. 칩의 ×는 디자인 시스템이 잠금을 받지 않아 화면의 경로 가드가 막는다.
   */
  isLocked: boolean;
  onSearch: (filters: IrFilters) => void;
  /** 조건 칩의 ×. 그 조건 하나만 풀고 곧바로 다시 조회한다. */
  onRemoveFilter: (key: ChipFilterKey) => void;
  onReset: () => void;
}

/**
 * 대상 입하 전표 조회 조건 줄.
 *
 * 트리거 모델은 「모아서 적용, 해제는 즉시」다 — 조건을 고치는 동안 조회가 나가면
 * 반쯤 지운 검색어로 요청이 나간다. 「조회」를 누를 때만 주소가 바뀌고 그때 조회된다.
 * 조건 칩의 ×는 해제라 즉시 반영한다.
 *
 * **기본 기간을 심지 않는다**(계획 결정 6). 비어 있는 것이 고장으로 읽히지 않도록
 * 그 사실을 줄 아래 안내가 밝힌다.
 *
 * **상태 선택지는 비어 있다**(결정 18 · `omf-mes#64`). 값 목록이 확정되지 않아 값을 지어내지
 * 않고, 왜 비어 있는지를 `aria-describedby`로 이어 붙인다.
 *
 * **조건이 하나도 없어도 조회가 열려 있다** — 이 화면은 들어오자마자 대상 후보를 보여야 한다.
 * 잠글 조건이 없어 「조회」에 비활성 사유가 붙는 자리도 없다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const IrFilterBar = ({
  appliedFilters,
  supplierOptions,
  chipNames,
  supplierNote,
  isLocked,
  onSearch,
  onRemoveFilter,
  onReset,
}: IrFilterBarProps) => {
  const [filters, setFilters] = useState<IrFilters>(appliedFilters);

  /*
   * 주소가 정본이다 — 뒤로가기·초기화로 주소가 **바뀌면** 편집 중인 값도 그 값으로 되돌아간다.
   *
   * **되돌림을 참조가 아니라 값으로 판정한다.** 부모는 렌더할 때마다 주소에서 값을 새로 읽으므로
   * 내용이 같아도 참조가 달라질 수 있고(조회 응답이 도착해 다시 그려질 때가 그렇다),
   * 참조로 판정하면 그때마다 사용자가 치던 값이 사라진다(#43). 값이 실제로 달라졌을 때만 되돌린다.
   */
  const {
    supplier: appliedSupplier,
    from: appliedFrom,
    to: appliedTo,
    status: appliedStatus,
    q: appliedQ,
  } = appliedFilters;

  useEffect(() => {
    setFilters({
      supplier: appliedSupplier,
      from: appliedFrom,
      to: appliedTo,
      status: appliedStatus,
      q: appliedQ,
    });
  }, [appliedSupplier, appliedFrom, appliedTo, appliedStatus, appliedQ]);

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

        {/* 설치본에 `DatePicker`가 없다 — 네이티브 타입으로 대체한다(W-01-07이 세운 처리). */}
        <TextField
          type="date"
          label={t.fields.receiptDateFrom}
          value={filters.from}
          onChange={(event) => {
            setFilters((prev) => ({ ...prev, from: event.target.value }));
          }}
        />
        <TextField
          type="date"
          label={t.fields.receiptDateTo}
          value={filters.to}
          onChange={(event) => {
            setFilters((prev) => ({ ...prev, to: event.target.value }));
          }}
        />

        {/*
         * 값 목록이 확정되지 않아 **선택지가 비어 있다.** 자리표시 값을 하나 넣어 두지 않는다 —
         * 넣으면 서버가 모르는 코드가 조건에 실려 결과가 늘 비어 보인다.
         */}
        <SelectField
          label={t.fields.status}
          options={irStatusOptions()}
          value={filters.status}
          note={irStatusNote()}
          placeholder={irStatusPlaceholder()}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, status: value }));
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
         * 조회와 초기화는 짝이라 함께 줄바꿈되게 묶는다(배치 규범 2-1).
         * 비활성 사유가 붙는 자리가 없다 — 조건 없이도 조회가 열려 있다.
         */}
        <div className="field-cell field-cell-unlabeled">
          <div className="filter-actions">
            <Button disabled={isLocked} onClick={search}>
              {messages.common.search}
            </Button>
            <Button variant="outlined" disabled={isLocked} onClick={onReset}>
              {messages.common.reset}
            </Button>
          </div>
        </div>
      </div>

      {/* 기본 기간이 없다는 사실은 화면에서 읽혀야 한다 — 비어 있는 칸이 고장으로 읽히지 않게 한다. */}
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
