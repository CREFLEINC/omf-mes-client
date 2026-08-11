import { Button, Chip, DatePicker, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { codeNote, codePlaceholder } from './code-options';
import { FieldLabel } from './field-label';
import {
  DEFAULT_FILTERS,
  toFilterChips,
  type FilterChipNames,
  type ReceiptFilters,
  type RemovableChipKey,
} from './filters';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.supplierReturn;

export interface GrFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 조건. 편집 중인 값은 이 부품 안에만 있다. */
  appliedFilters: ReceiptFilters;
  /** 창고 선택지. 화면이 이름으로 풀어 넘긴다 — 번호를 사용자가 칠 일이 없다. */
  warehouseOptions: SelectOption[];
  /** 창고 선택지의 한계(잘림·실패) 안내. 밝히지 않으면 값이 사라진 것으로 읽힌다. */
  warehouseNote?: string;
  /**
   * 값 목록이 확정되지 않은 코드 둘. **화면이 넘긴다** — 자리표시 상수를 부품이 직접 읽으면
   * 「값이 확정되면 배열만 채운다」는 전환을 화면 수준에서 잴 수 없다.
   */
  receiptTypeOptions: SelectOption[];
  statusOptions: SelectOption[];
  /** 조건 칩에 실을 참조 이름. 번호를 문구로 만드는 자리를 두지 않기 위한 것이다(#44). */
  chipNames: FilterChipNames;
  onSearch: (filters: ReceiptFilters) => void;
  /** 조건 칩의 ×. 그 조건 하나만 풀고 곧바로 다시 조회한다. **기간은 들어오지 않는다.** */
  onRemoveFilter: (key: RemovableChipKey) => void;
  onReset: () => void;
}

/**
 * 대상 입고 전표 조회 조건 줄.
 *
 * 트리거 모델은 「모아서 적용, 해제는 즉시」다 — 조건을 고치는 동안 조회가 나가면
 * 반쯤 지운 검색어로 요청이 나간다. 「조회」를 누를 때만 주소가 바뀌고 그때 조회된다.
 * 조건 칩의 ×는 해제라 즉시 반영한다.
 *
 * **기본 기간을 심지 않는다.** 비어 있는 것이 고장으로 읽히지 않도록 그 사실을 줄 아래
 * 안내가 밝힌다.
 *
 * **입고 유형·상태 선택지는 비어 있다**(값 목록 미확정). 값을 지어내지 않고, 왜 비어 있는지를
 * `aria-describedby`로 이어 붙인다.
 *
 * **조건이 하나도 없어도 조회가 열려 있다** — 이 화면은 들어오자마자 대상 후보를 보여야 한다.
 * 잠글 조건이 없어 「조회」에 비활성 사유가 붙는 자리도 없다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const GrFilterBar = ({
  appliedFilters,
  warehouseOptions,
  warehouseNote,
  receiptTypeOptions,
  statusOptions,
  chipNames,
  onSearch,
  onRemoveFilter,
  onReset,
}: GrFilterBarProps) => {
  const periodId = useId();
  const [filters, setFilters] = useState<ReceiptFilters>(appliedFilters);

  /*
   * 주소가 정본이다 — 뒤로가기·초기화로 주소가 **바뀌면** 편집 중인 값도 그 값으로 되돌아간다.
   *
   * **되돌림을 참조가 아니라 값으로 판정한다.** 부모는 렌더할 때마다 주소에서 값을 새로 읽으므로
   * 내용이 같아도 참조가 달라질 수 있고(조회 응답이 도착해 다시 그려질 때가 그렇다),
   * 참조로 판정하면 그때마다 사용자가 치던 값이 사라진다(#43). 값이 실제로 달라졌을 때만 되돌린다.
   */
  const {
    warehouse: appliedWarehouse,
    from: appliedFrom,
    to: appliedTo,
    receiptType: appliedReceiptType,
    status: appliedStatus,
    q: appliedQ,
  } = appliedFilters;

  useEffect(() => {
    setFilters({
      warehouse: appliedWarehouse,
      from: appliedFrom,
      to: appliedTo,
      receiptType: appliedReceiptType,
      status: appliedStatus,
      q: appliedQ,
    });
  }, [appliedWarehouse, appliedFrom, appliedTo, appliedReceiptType, appliedStatus, appliedQ]);

  const search = (): void => {
    onSearch(filters);
  };

  /**
   * 초기화. **자기 편집 상태를 함께 비운다.**
   *
   * 부모에게만 알리면 아직 조회하지 않은 값은 주소가 바뀌지 않아 되돌림 effect도 깨어나지
   * 않는다 — 그러면 **「초기화」를 눌렀는데 고른 기간이 그대로 남는다.** 날짜 컨트롤에는
   * 값 비우기가 없어(설치본 실측) 이 부품이 비우지 않으면 비울 다른 길이 없다.
   */
  const reset = (): void => {
    setFilters(DEFAULT_FILTERS);
    onReset();
  };

  const chips = toFilterChips(appliedFilters, chipNames);
  const hasPeriodChip = chips.some((chip) => chip.key === 'period');

  /* 「전체」를 값이 빈 선택지로 둔다 — 두지 않으면 한 번 고른 뒤에 해제할 방법이 칸 안에 없어진다. */
  const withAll = (options: SelectOption[]): SelectOption[] => [
    { value: '', label: t.filters.all },
    ...options,
  ];

  /**
   * 값 목록이 비어 있는 코드 칸은 **「전체」도 붙이지 않는다.** 고를 것이 하나도 없는데
   * 「전체」만 있으면 목록이 준비된 것처럼 보인다 — 왜 비었는지는 안내가 말한다.
   */
  const codeOptions = (options: SelectOption[]): SelectOption[] =>
    options.length === 0 ? options : withAll(options);

  return (
    <>
      <div className="filter-bar">
        {/*
         * 규범 3-2 — 선택칸이 「코드 · 이름」을 고른다. 최소 폭을 주지 않으면
         * 선택지 목록이 트리거 폭에 갇혀 잘리고, 무엇을 고르는지 읽을 수 없다.
         */}
        <SelectField
          wide
          label={t.fields.warehouse}
          options={withAll(warehouseOptions)}
          value={filters.warehouse}
          note={warehouseNote}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, warehouse: value }));
          }}
        />

        {/*
         * 기간은 **한 컨트롤**이다 — 시작·종료 두 칸이 아니라 `mode="range"` 하나다.
         * 주소 키(`from`·`to`)와 요청 파라미터는 그대로다. 바뀐 것은 고르는 수단뿐이다.
         *
         * 컴포넌트가 **완결된 쌍만, 그것도 from ≤ to로만** 방출한다. 그래서 이 컨트롤을 거친
         * 역전은 생기지 않지만 `filters.ts`의 날짜 판정은 그대로 둔다 — 조회 조건의 정본은
         * 주소이고 주소는 사용자가 직접 고칠 수 있다. 컨트롤이 막는 것과 화면이 막는 것은
         * 다른 층이다.
         */}
        <div className="field-cell">
          <FieldLabel htmlFor={periodId} label={t.fields.period} />
          <DatePicker
            id={periodId}
            mode="range"
            placeholder={messages.common.selectDate}
            value={[filters.from === '' ? null : filters.from, filters.to === '' ? null : filters.to]}
            onChange={([from, to]) => {
              setFilters((prev) => ({ ...prev, from, to }));
            }}
          />
        </div>

        <SelectField
          label={t.fields.receiptType}
          options={codeOptions(receiptTypeOptions)}
          value={filters.receiptType}
          note={codeNote(receiptTypeOptions)}
          placeholder={receiptTypeOptions.length === 0 ? codePlaceholder() : t.filters.all}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, receiptType: value }));
          }}
        />

        <SelectField
          label={t.fields.status}
          options={codeOptions(statusOptions)}
          value={filters.status}
          note={codeNote(statusOptions)}
          placeholder={statusOptions.length === 0 ? codePlaceholder() : t.filters.all}
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
            <Button onClick={search}>{messages.common.search}</Button>
            <Button variant="outlined" onClick={reset}>
              {messages.common.reset}
            </Button>
          </div>
        </div>
      </div>

      {/* 기본 기간이 없다는 사실은 화면에서 읽혀야 한다 — 비어 있는 칸이 고장으로 읽히지 않게 한다. */}
      <p className="field-note">{t.filters.periodNote}</p>

      {chips.length > 0 && (
        <div className="filter-bar">
          {chips.map((chip) =>
            chip.removeLabel === null ? (
              /*
               * **기간 칩에는 ×가 없다.** 날짜 컨트롤이 값을 개별로 비우는 수단을 주지 않아
               * 눌러도 값이 남는다 — 그러면 칩은 사라졌는데 조건은 걸려 있는 상태가 된다.
               */
              <Chip key={chip.key} variant="status">
                {chip.label}
              </Chip>
            ) : (
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
            ),
          )}
        </div>
      )}

      {/* ×가 하나만 없는 이유를 밝힌다 — 없으면 사용자가 ×를 찾다가 화면을 고장으로 읽는다. */}
      {hasPeriodChip && <p className="field-note">{t.filters.periodClearNote}</p>}
    </>
  );
};
