import { Button, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';

import { DateRangeFields } from '../../patterns/date-range-fields';
import {
  FilterMoreButton,
  HiddenFilterChips,
  hasChangedFilters,
  useFilterMore,
  type HiddenFilterChip,
} from '../../patterns/filter-more';

import { codeNote, codePlaceholder } from './code-options';
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
  /**
   * 전송 중인가. **조회와 초기화만 잠근다** — 둘은 고른 전표를 푸는 길이라 전송 중에 열어
   * 두면 앞 요청의 결과가 다른 맥락에 나타난다.
   *
   * **조건 칸은 잠그지 않는다**(배치 규범 3) — 잠그면 지금 걸린 조건을 읽을 수만 있고 고칠 수
   * 없는 상태가 된다. 고쳐도 「조회」를 누르기 전에는 아무것도 나가지 않는다.
   *
   * **조건 칩의 ×도 잠기지 않는다** — 디자인 시스템 `Chip`이 그 prop을 갖고 있지 않다(실측).
   * 그 길은 화면의 핸들러 가드(둘째 겹)가 막는다.
   */
  isLocked: boolean;
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
 * **보이는 칸은 셋이다**(C-6 · 관리웹 정리 시안 A, 2026-11-20) — 창고 · 입고일 · 입고번호. 입고 유형 · 상태는 값 목록이
 * 아직 비어 있어 고를 것이 없으므로 「조건 더보기」에 접는다(주소로 걸린 값은 칩으로 보인다). 보이는 칸의 조건은 칩으로
 * 겹쳐 적지 않는다 — 다만 창고 선택지에 없는 창고(좁힘 밖 · 이름을 못 푼 창고)는 칸이 값을 보일 수 없어 칩이 남는다.
 * 「초기화」는 바뀐 것이 있을 때만 보인다.
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
  isLocked,
  onSearch,
  onRemoveFilter,
  onReset,
}: GrFilterBarProps) => {
  const more = useFilterMore();
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

  /*
   * 접힌 칸(입고 유형 · 상태)의 조건만 칩으로. 펼치면 칸에 값이 보이므로 그 칩은 거둔다. 창고는 보이는 칸이지만 선택지에
   * 없는 창고는 칸이 값을 보일 수 없어 칩이 남는다(좁힘 밖 창고를 주소로 건 경우).
   */
  const isWarehouseShown =
    appliedFilters.warehouse === '' ||
    warehouseOptions.some((option) => option.value === appliedFilters.warehouse);
  const isHidden = (key: RemovableChipKey): boolean =>
    key === 'warehouse'
      ? !isWarehouseShown
      : !more.isOpen && (key === 'receiptType' || key === 'status');
  const hiddenChips = toFilterChips(appliedFilters, chipNames).flatMap(
    (chip): HiddenFilterChip<RemovableChipKey>[] =>
      chip.removeLabel !== null && isHidden(chip.key)
        ? [{ key: chip.key, label: chip.label, removeLabel: chip.removeLabel }]
        : [],
  );
  const isChanged = hasChangedFilters(DEFAULT_FILTERS, filters, appliedFilters);

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

        <DateRangeFields
          clearable
          startLabel={t.fields.periodFrom}
          endLabel={t.fields.periodTo}
          info={t.filters.periodNote}
          placeholder={messages.common.selectDate}
          from={filters.from}
          to={filters.to}
          onChange={(from, to) => {
            setFilters((prev) => ({ ...prev, from, to }));
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
          clearLabel={messages.common.clear}
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
            {isChanged && (
              <Button variant="outlined" disabled={isLocked} onClick={reset}>
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
        </div>
      </div>

      <HiddenFilterChips open={false} chips={hiddenChips} onRemove={onRemoveFilter} />
    </>
  );
};
