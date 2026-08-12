import { Button, Checkbox, Chip, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';

import { codeNote, codePlaceholder } from './code-options';
import { DEFAULT_FILTERS, toFilterChips, type FilterKey } from './filters';
import { SelectField } from './select-field';
import type { RouteFilters, SelectOption } from './types';

const t = messages.approvalRoute;

export interface RouteFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 조건. 편집 중인 값은 이 부품 안에만 있다. */
  appliedFilters: RouteFilters;
  /**
   * 승인 유형 선택지. **화면이 넘긴다** — 자리표시 상수를 부품이 직접 읽으면
   * 「값이 확정되면 배열만 채운다」는 전환을 화면 수준에서 잴 수 없다.
   */
  approvalTypeOptions: SelectOption[];
  businessUnitOptions: SelectOption[];
  /** 사업부 선택지의 한계(잘림·실패) 안내. 밝히지 않으면 값이 사라진 것으로 읽힌다. */
  businessUnitNote?: string;
  /** 조건 칩에 실을 사업부 이름. 번호를 문구로 만드는 자리를 두지 않기 위한 것이다. */
  businessUnitLabel: (businessUnitId: string) => string;
  onSearch: (filters: RouteFilters) => void;
  /** 조건 칩의 ×. 그 조건 하나만 풀고 곧바로 다시 조회한다. */
  onRemoveFilter: (key: FilterKey) => void;
  onReset: () => void;
}

/**
 * 결재선 조회 조건 줄.
 *
 * 트리거 모델은 「모아서 적용, 해제는 즉시」다 — 조건을 고치는 동안 조회가 나가면
 * 반쯤 지운 검색어로 요청이 나간다. 「조회」를 누를 때만 주소가 바뀌고 그때 조회된다.
 * 조건 칩의 ×는 해제라 즉시 반영한다.
 *
 * **「미사용 포함」이 화면 어휘다.** 계약 파라미터(`activeOnly`)는 방향이 반대이고 기본값이
 * 없지만, 그것은 계약의 사정이며 뒤집는 자리는 `filters.ts` 한 곳이다.
 *
 * **승인 유형 선택지는 비어 있다**(값 목록 미확정). 값을 지어내지 않고, 왜 비어 있는지를
 * `aria-describedby`로 이어 붙인다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const RouteFilterBar = ({
  appliedFilters,
  approvalTypeOptions,
  businessUnitOptions,
  businessUnitNote,
  businessUnitLabel,
  onSearch,
  onRemoveFilter,
  onReset,
}: RouteFilterBarProps) => {
  const [filters, setFilters] = useState<RouteFilters>(appliedFilters);

  /*
   * 주소가 정본이다 — 뒤로가기·초기화로 주소가 **바뀌면** 편집 중인 값도 그 값으로 되돌아간다.
   *
   * **되돌림을 참조가 아니라 값으로 판정한다.** 부모는 렌더할 때마다 주소에서 값을 새로 읽으므로
   * 내용이 같아도 참조가 달라질 수 있고(조회 응답이 도착해 다시 그려질 때가 그렇다),
   * 참조로 판정하면 그때마다 사용자가 치던 값이 사라진다.
   */
  const {
    approvalTypeCode: appliedType,
    businessUnitId: appliedBusinessUnit,
    includeInactive: appliedIncludeInactive,
    q: appliedQ,
  } = appliedFilters;

  useEffect(() => {
    setFilters({
      approvalTypeCode: appliedType,
      businessUnitId: appliedBusinessUnit,
      includeInactive: appliedIncludeInactive,
      q: appliedQ,
    });
  }, [appliedType, appliedBusinessUnit, appliedIncludeInactive, appliedQ]);

  const search = (): void => {
    onSearch(filters);
  };

  /**
   * 초기화. **자기 편집 상태를 함께 비운다.**
   *
   * 부모에게만 알리면 아직 조회하지 않은 값은 주소가 바뀌지 않아 되돌림 effect도 깨어나지
   * 않는다 — 그러면 「초기화」를 눌렀는데 치던 값이 그대로 남는다.
   */
  const reset = (): void => {
    setFilters(DEFAULT_FILTERS);
    onReset();
  };

  /* 「전체」를 값이 빈 선택지로 둔다 — 두지 않으면 한 번 고른 뒤에 해제할 방법이 칸 안에 없어진다. */
  const withAll = (options: SelectOption[]): SelectOption[] => [
    { value: '', label: t.filters.all },
    ...options,
  ];

  /**
   * 값 목록이 비어 있는 코드 칸은 **「전체」도 붙이지 않는다.** 고를 것이 하나도 없는데
   * 「전체」만 있으면 목록이 준비된 것처럼 보인다 — 왜 비었는지는 안내가 말한다.
   */
  const typeOptions = approvalTypeOptions.length === 0 ? [] : withAll(approvalTypeOptions);

  const chips = toFilterChips(appliedFilters, businessUnitLabel);

  return (
    <>
      <div className="filter-bar">
        <SelectField
          label={t.fields.approvalTypeCode}
          options={typeOptions}
          value={filters.approvalTypeCode}
          note={codeNote(approvalTypeOptions)}
          placeholder={approvalTypeOptions.length === 0 ? codePlaceholder() : t.filters.all}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, approvalTypeCode: value }));
          }}
        />

        {/*
         * 규범 3-2 — 선택칸이 「코드 · 이름」을 고른다. 최소 폭을 주지 않으면
         * 선택지 목록이 트리거 폭에 갇혀 잘리고, 무엇을 고르는지 읽을 수 없다.
         */}
        <SelectField
          wide
          label={t.fields.businessUnit}
          options={withAll(businessUnitOptions)}
          value={filters.businessUnitId}
          note={businessUnitNote}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, businessUnitId: value }));
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
          <Checkbox
            checked={filters.includeInactive}
            onChange={(event) => {
              const { checked } = event.target;
              setFilters((prev) => ({ ...prev, includeInactive: checked }));
            }}
          >
            {messages.common.includeInactive}
          </Checkbox>
        </div>

        {/*
         * 조회와 초기화는 짝이라 함께 줄바꿈되게 묶는다(배치 규범 2-1).
         * 조건 없이도 조회가 열려 있다 — 이 화면은 들어오자마자 결재선을 보여야 한다.
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
