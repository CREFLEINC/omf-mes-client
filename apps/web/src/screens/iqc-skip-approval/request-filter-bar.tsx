import { Button, Chip, DatePicker, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { EMPTY_FILTERS, toFilterChips, type FilterChipKey } from './filters';
import type { RequestFilters } from './types';

const t = messages.iqcSkipApproval;

export interface RequestFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 조건. 편집 중인 값은 이 부품 안에만 있다. */
  appliedFilters: RequestFilters;
  onSearch: (filters: RequestFilters) => void;
  /** 조건 칩의 ×. 그 조건 하나만 풀고 곧바로 다시 조회한다. */
  onRemoveFilter: (key: FilterChipKey) => void;
  onReset: () => void;
}

/**
 * 조회 조건 줄.
 *
 * **트리거 모델이 둘이고 그것이 의도다.**
 *
 * | 컨트롤 | 언제 반영되나 | 왜 |
 * | --- | --- | --- |
 * | 상신일 · 요청번호 | **조회를 누를 때** | 고치는 동안 조회가 나가면 반쯤 지운 검색어로 요청이 나간다 |
 * | 조건 칩의 × | 즉시 | 해제는 「푼다」는 뜻이라 확인을 받을 것이 없다 |
 * | 탭 줄 상태 칩(#186) | 즉시 | 조건이 아니라 **조회 범위**다 — 이 부품 밖(화면)이 걸고, 조회할 때 그대로 실린다 |
 *
 * **조회를 조건으로 잠그지 않는다.** 계약이 어느 조건도 필수로 두지 않았고, 이 화면은
 * 들어오자마자 내가 판정할 것을 보여야 하는 자리다 — 고정 축이 이미 범위를 좁히고 있다.
 *
 * **승인 유형 칸이 없다.** 그것은 사용자가 고르는 조건이 아니라 **이 화면의 정체**이며
 * 값이 확정되기 전까지 좁혀지지 않는다는 사실은 목록 위 안내가 말한다(`code-options.ts`).
 *
 * **상신일은 한 컨트롤이다**(`mode="range"`). 컴포넌트가 완결된 쌍만, 그것도 `from ≤ to`로만
 * 방출하므로 이 칸을 거친 역전은 생기지 않는다. 그래도 주소로 들어온 한쪽만의 구간은
 * 조건으로 살아 있다 — 그 표기는 조건 칩이 맡는다(`filters.ts`).
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const RequestFilterBar = ({
  appliedFilters,
  onSearch,
  onRemoveFilter,
  onReset,
}: RequestFilterBarProps) => {
  const periodId = useId();
  const [filters, setFilters] = useState<RequestFilters>(appliedFilters);

  /*
   * 주소가 정본이다 — 뒤로가기·초기화로 주소가 **바뀌면** 편집 중인 값도 그 값으로 되돌아간다.
   *
   * **되돌림을 참조가 아니라 값으로 판정한다.** 부모는 렌더할 때마다 주소에서 값을 새로 읽으므로
   * 내용이 같아도 참조가 달라질 수 있고(조회 응답이 도착해 다시 그려질 때가 그렇다),
   * 참조로 판정하면 그때마다 사용자가 치던 값이 사라진다(#43).
   */
  const { from: appliedFrom, to: appliedTo, q: appliedQ } = appliedFilters;

  /* 상태는 탭 줄 칩이 바꾼다 — 칩을 눌러도 치던 날짜·검색어가 지워지지 않게 되돌림에서 뺀다(#186 리뷰). */
  useEffect(() => {
    setFilters((current) => ({ ...current, from: appliedFrom, to: appliedTo, q: appliedQ }));
  }, [appliedFrom, appliedTo, appliedQ]);

  const searchWith = (next: RequestFilters): void => {
    onSearch({ ...next, statusCode: appliedFilters.statusCode });
  };
  const search = (): void => {
    searchWith(filters);
  };

  /**
   * 초기화. **자기 편집 상태를 함께 비운다.**
   *
   * 부모에게만 알리면 아직 조회하지 않은 값은 주소가 바뀌지 않아 되돌림 effect도 깨어나지
   * 않는다 — 그러면 「초기화」를 눌렀는데 치던 값이 그대로 남는다.
   */
  const reset = (): void => {
    setFilters(EMPTY_FILTERS);
    onReset();
  };

  const chips = toFilterChips(appliedFilters);

  return (
    <>
      <div className="filter-bar iqc-skip-approval-filter">
        {/* 상태는 탭 줄 오른쪽 상태 칩으로 거른다(#186) — 조건 칸에는 두지 않는다. 고른 상태는 조회해도 그대로다. */}

        {/*
         * 상신일은 **한 컨트롤**이다 — 시작·종료 두 칸이 아니라 `mode="range"` 하나다.
         * 주소 키(`from`·`to`)와 요청 파라미터는 그대로다. 바뀐 것은 고르는 수단뿐이다.
         *
         * 계약이 이 두 파라미터를 **`format: date`**로 두었다 — 값이 `YYYY-MM-DD` 그대로 나간다.
         */}
        <div className="field-cell">
          <label className="field-label" htmlFor={periodId}>
            {t.fields.period}
          </label>
          <DatePicker
            id={periodId}
            mode="range"
            value={[
              filters.from === '' ? null : filters.from,
              filters.to === '' ? null : filters.to,
            ]}
            placeholder={messages.common.selectDate}
            onChange={([from, to]) => {
              setFilters((prev) => ({ ...prev, from, to }));
            }}
          />
        </div>

        <SearchInput
          label={t.fields.q}
          value={filters.q}
          onChange={(event) => {
            setFilters((prev) => ({ ...prev, q: event.target.value }));
          }}
          /* 엔터로도 조회된다 — 검색칸에서 엔터가 아무 일도 하지 않으면 멈춘 것으로 읽힌다. */
          onSearch={(value) => {
            searchWith({ ...filters, q: value });
          }}
          clearLabel={messages.common.clear}
        />

        {/*
         * 조회와 초기화는 짝이라 함께 줄바꿈되게 묶는다(배치 규범 2-1).
         * 조건 없이도 조회가 열려 있다 — 이 화면은 들어오자마자 내가 판정할 것을 보여야 한다.
         */}
        <div className="field-cell field-cell-unlabeled">
          <div className="filter-actions">
            {/* 품질 승인 처리의 다른 탭과 같은 조회 단추다(#186 — 탭을 옮겨도 조건 줄이 같아 보인다). */}
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
