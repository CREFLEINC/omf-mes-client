import { Button, Chip, DatePicker, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { codeNote, codePlaceholder } from './code-options';
import { FieldLabel } from './field-label';
import {
  DEFAULT_ISSUE_FILTERS,
  toIssueFilterChips,
  type IssueFilters,
  type RemovableIssueChipKey,
} from './history-filters';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.disposalIssue;

export interface GiFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 조건. 편집 중인 값은 이 부품 안에만 있다. */
  appliedFilters: IssueFilters;
  /**
   * 값 목록이 확정되지 않은 코드 셋. **화면이 넘긴다** — 자리표시 상수를 부품이 직접 읽으면
   * 「값이 확정되면 배열만 채운다」는 전환을 화면 수준에서 잴 수 없다.
   */
  issueTypeOptions: SelectOption[];
  reasonOptions: SelectOption[];
  statusOptions: SelectOption[];
  onSearch: (filters: IssueFilters) => void;
  /** 조건 칩의 ×. 그 조건 하나만 풀고 곧바로 다시 조회한다. **기간은 들어오지 않는다.** */
  onRemoveFilter: (key: RemovableIssueChipKey) => void;
  onReset: () => void;
}

/**
 * 처리 이력 조회 조건 줄.
 *
 * 트리거 모델은 「모아서 적용, 해제는 즉시」다 — 조건을 고치는 동안 조회가 나가면 반쯤 지운
 * 검색어로 요청이 나간다. 「조회」를 누를 때만 주소가 바뀌고 그때 조회된다.
 *
 * **창고 조건이 없다.** 계약의 출고 목록에 창고 조건이 있으나 이 탭의 조건 축은 **폐기 사유**이고
 * 창고는 열로만 보인다(계획 §5.5) — 조건을 늘리는 것보다 줄이는 것이 먼저다.
 *
 * **출고 유형·폐기 사유·상태 선택지는 비어 있다**(값 목록 미확정). 값을 지어내지 않고, 왜 비어
 * 있는지를 안내가 말한다. **비어 있어도 아무것도 잠기지 않는다** — 조회는 조건 없이도 열려 있다.
 *
 * **대상 조건 줄과 부품을 가른다.** 형태가 같아도 문구·주소 키·칩이 다르고, 한 부품이 둘을
 * 겸하면 한쪽 문구를 고칠 때 다른 탭이 조용히 따라 바뀐다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const GiFilterBar = ({
  appliedFilters,
  issueTypeOptions,
  reasonOptions,
  statusOptions,
  onSearch,
  onRemoveFilter,
  onReset,
}: GiFilterBarProps) => {
  const periodId = useId();
  const [filters, setFilters] = useState<IssueFilters>(appliedFilters);

  /*
   * 주소가 정본이다 — 뒤로가기·초기화로 주소가 **바뀌면** 편집 중인 값도 그 값으로 되돌아간다.
   *
   * **되돌림을 참조가 아니라 값으로 판정한다.** 부모는 렌더할 때마다 주소에서 값을 새로 읽으므로
   * 내용이 같아도 참조가 달라질 수 있고(조회 응답이 도착해 다시 그려질 때가 그렇다),
   * 참조로 판정하면 그때마다 사용자가 치던 값이 사라진다(`omf-mes#43`).
   */
  const {
    from: appliedFrom,
    to: appliedTo,
    issueType: appliedIssueType,
    reason: appliedReason,
    status: appliedStatus,
    q: appliedQ,
  } = appliedFilters;

  useEffect(() => {
    setFilters({
      from: appliedFrom,
      to: appliedTo,
      issueType: appliedIssueType,
      reason: appliedReason,
      status: appliedStatus,
      q: appliedQ,
    });
  }, [appliedFrom, appliedTo, appliedIssueType, appliedReason, appliedStatus, appliedQ]);

  const search = (): void => {
    onSearch(filters);
  };

  /**
   * 초기화. **자기 편집 상태를 함께 비운다.**
   *
   * 부모에게만 알리면 아직 조회하지 않은 값은 주소가 바뀌지 않아 되돌림 effect도 깨어나지
   * 않는다 — 그러면 **「초기화」를 눌렀는데 고른 기간이 그대로 남는다.**
   */
  const reset = (): void => {
    setFilters(DEFAULT_ISSUE_FILTERS);
    onReset();
  };

  const chips = toIssueFilterChips(appliedFilters);
  const hasPeriodChip = chips.some((chip) => chip.key === 'period');

  /**
   * 값 목록이 비어 있는 코드 칸은 **「전체」도 붙이지 않는다.** 고를 것이 하나도 없는데
   * 「전체」만 있으면 목록이 준비된 것처럼 보인다 — 왜 비었는지는 안내가 말한다.
   */
  const codeOptions = (options: SelectOption[]): SelectOption[] =>
    options.length === 0 ? options : [{ value: '', label: t.filters.all }, ...options];

  return (
    <>
      <div className="filter-bar">
        {/*
         * 기간은 **한 컨트롤**이다 — `mode="range"` 하나가 두 값을 준다. 주소 키(`ifrom`·`ito`)와
         * 요청 파라미터는 그대로이고 바뀐 것은 고르는 수단뿐이다.
         */}
        <div className="field-cell">
          <FieldLabel htmlFor={periodId} label={t.historyFields.period} />
          <DatePicker
            id={periodId}
            mode="range"
            placeholder={messages.common.selectDate}
            value={[
              filters.from === '' ? null : filters.from,
              filters.to === '' ? null : filters.to,
            ]}
            onChange={([from, to]) => {
              setFilters((prev) => ({ ...prev, from, to }));
            }}
          />
        </div>

        <SelectField
          label={t.historyFields.issueType}
          options={codeOptions(issueTypeOptions)}
          value={filters.issueType}
          note={codeNote(issueTypeOptions)}
          placeholder={issueTypeOptions.length === 0 ? codePlaceholder() : t.filters.all}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, issueType: value }));
          }}
        />

        <SelectField
          label={t.historyFields.reason}
          options={codeOptions(reasonOptions)}
          value={filters.reason}
          note={codeNote(reasonOptions)}
          placeholder={reasonOptions.length === 0 ? codePlaceholder() : t.filters.all}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, reason: value }));
          }}
        />

        <SelectField
          label={t.historyFields.status}
          options={codeOptions(statusOptions)}
          value={filters.status}
          note={codeNote(statusOptions)}
          placeholder={statusOptions.length === 0 ? codePlaceholder() : t.filters.all}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, status: value }));
          }}
        />

        <SearchInput
          label={t.historyFields.q}
          value={filters.q}
          onChange={(event) => {
            setFilters((prev) => ({ ...prev, q: event.target.value }));
          }}
          /* 엔터로도 조회된다 — 검색칸에서 엔터가 아무 일도 하지 않으면 멈춘 것으로 읽힌다. */
          onSearch={search}
        />

        {/* 조회와 초기화는 짝이라 함께 줄바꿈되게 묶는다(배치 규범 2-1). */}
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
      <p className="field-note">{t.historyFilters.periodNote}</p>

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
      {hasPeriodChip && <p className="field-note">{t.historyFilters.periodClearNote}</p>}
    </>
  );
};
