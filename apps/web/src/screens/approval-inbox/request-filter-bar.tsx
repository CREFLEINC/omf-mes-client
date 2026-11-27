import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';

import { DateRangeFields } from '../../patterns/date-range-fields';
import { hasChangedFilters } from '../../patterns/filter-more';

import { codeNote, codePlaceholder } from './code-options';
import { EMPTY_FILTERS } from './filters';
import { SelectField } from './select-field';
import type { InboxFilters, SelectOption } from './types';

const t = messages.approvalInbox;

export interface RequestFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 조건. 편집 중인 값은 이 부품 안에만 있다. */
  appliedFilters: InboxFilters;
  /**
   * 승인 유형 선택지. **화면이 넘긴다** — 자리표시 상수를 부품이 직접 읽으면
   * 「값이 확정되면 배열만 채운다」는 전환을 화면 수준에서 잴 수 없다.
   */
  approvalTypeOptions: SelectOption[];
  onSearch: (filters: InboxFilters) => void;
  onReset: () => void;
}

/**
 * 결재함 조회 조건 줄.
 *
 * 트리거 모델은 「모아서 적용, 해제는 즉시」다 — 조건을 고치는 동안 조회가 나가면
 * 반쯤 지운 검색어로 요청이 나간다. 「조회」를 누를 때만 주소가 바뀌고 그때 조회된다.
 * 조건 칩의 ×는 해제라 즉시 반영한다.
 *
 * **조회를 조건으로 잠그지 않는다.** 계약이 어느 조건도 필수로 두지 않았고, 결재함은
 * 들어오자마자 내 결재 대기를 보여야 하는 자리다 — 탭이 이미 범위를 좁히고 있다.
 *
 * **상신일은 시작일 · 종료일 두 칸이다**(`patterns/date-range-fields`). 달력 한계가 시작 ≤ 종료를
 * 지켜 이 칸을 거친 역전은 생기지 않는다. 한쪽만 고른 구간도 조건으로 살아 있다 —
 * 그 표기는 조건 칩이 맡는다(`filters.ts`).
 *
 * **칸은 셋이다** — 상신일 · 승인 유형 · 요청번호(#361 차례). 상태는 화면 맨 위 라벨이 맡는다(#361 — 「조건 더보기」의
 * 상태 선택칸을 걷었다). 「초기화」는 바뀐 것이 있을 때만 보이고 상태는 풀지 않는다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const RequestFilterBar = ({
  appliedFilters,
  approvalTypeOptions,
  onSearch,
  onReset,
}: RequestFilterBarProps) => {
  const [filters, setFilters] = useState<InboxFilters>(appliedFilters);

  /*
   * 주소가 정본이다 — 뒤로가기·초기화로 주소가 **바뀌면** 편집 중인 값도 그 값으로 되돌아간다.
   *
   * **되돌림을 참조가 아니라 값으로 판정한다.** 부모는 렌더할 때마다 주소에서 값을 새로 읽으므로
   * 내용이 같아도 참조가 달라질 수 있고(조회 응답이 도착해 다시 그려질 때가 그렇다),
   * 참조로 판정하면 그때마다 사용자가 치던 값이 사라진다(#43).
   */
  const {
    approvalTypeCode: appliedType,
    statusCode: appliedStatus,
    from: appliedFrom,
    to: appliedTo,
    q: appliedQ,
  } = appliedFilters;

  useEffect(() => {
    setFilters({
      approvalTypeCode: appliedType,
      statusCode: appliedStatus,
      from: appliedFrom,
      to: appliedTo,
      q: appliedQ,
    });
  }, [appliedType, appliedStatus, appliedFrom, appliedTo, appliedQ]);

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
    setFilters({ ...EMPTY_FILTERS, statusCode: appliedFilters.statusCode });
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
  const optionsOf = (options: SelectOption[]): SelectOption[] =>
    options.length === 0 ? [] : withAll(options);

  const placeholderOf = (options: SelectOption[]): string =>
    options.length === 0 ? codePlaceholder() : t.filters.all;

  /* 상태는 맨 위 라벨 몫이라 견주지 않는다(#361). */
  const isChanged = hasChangedFilters(
    { ...EMPTY_FILTERS, statusCode: appliedFilters.statusCode },
    filters,
    appliedFilters,
  );

  return (
    <>
      <div className="filter-bar approval-inbox-filter">
        {/* 상신 기간 → 승인 유형 → 요청번호 차례(#361 사용자 지시). */}
        <DateRangeFields
          clearable
          startLabel={t.fields.periodFrom}
          endLabel={t.fields.periodTo}
          placeholder={t.fields.datePlaceholder}
          from={filters.from}
          to={filters.to}
          onChange={(from, to) => {
            setFilters((prev) => ({ ...prev, from, to }));
          }}
        />

        <SelectField
          label={t.fields.approvalTypeCode}
          options={optionsOf(approvalTypeOptions)}
          value={filters.approvalTypeCode}
          note={codeNote(approvalTypeOptions)}
          placeholder={placeholderOf(approvalTypeOptions)}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, approvalTypeCode: value }));
          }}
        />

        {/* 품질 화면(검사 조회·판정)과 같은 입력칸 — 돋보기 없이 흐린 문구로 안내한다(#361). */}
        <TextField
          label={t.fields.q}
          placeholder={t.fields.qPlaceholder}
          value={filters.q}
          onChange={(event) => {
            setFilters((prev) => ({ ...prev, q: event.target.value }));
          }}
          /* 엔터로도 조회된다 — 입력칸에서 엔터가 아무 일도 하지 않으면 멈춘 것으로 읽힌다. */
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault();
              onSearch({ ...filters, q: event.currentTarget.value });
            }
          }}
        />

        {/*
         * 조회와 초기화는 짝이라 함께 줄바꿈되게 묶는다(배치 규범 2-1).
         * 조건 없이도 조회가 열려 있다 — 이 화면은 들어오자마자 내 결재 대기를 보여야 한다.
         */}
        {/* [조회] → [초기화]는 조회 줄 오른쪽 끝에 한 묶음으로(#361 사용자 지시). */}
        <div className="field-cell field-cell-unlabeled approval-inbox-filter-actions approval-inbox-filter-more">
          <div className="filter-actions">
            <Button onClick={search}>{messages.common.search}</Button>
            {isChanged && (
              <Button variant="outlined" onClick={reset}>
                {messages.common.reset}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
