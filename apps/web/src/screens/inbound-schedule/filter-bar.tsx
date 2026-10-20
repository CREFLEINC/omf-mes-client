import { Button, Checkbox, Chip, SearchInput, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { toFilterChips, type ChipKey, type FilterChipNames, type ScheduleFilters } from './filters';
import { validatePeriod, type PeriodInput } from './period';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.inboundSchedule;

export interface ScheduleFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 기간. 편집 중인 값은 이 부품 안에만 있다. */
  appliedPeriod: PeriodInput;
  appliedFilters: ScheduleFilters;
  /** 공장 선택지. 화면이 이름으로 풀어 넘긴다 — 번호를 사용자가 칠 일이 없다. */
  plantOptions: SelectOption[];
  /** 조건 칩에 실을 참조 이름. 번호를 문구로 만드는 자리를 두지 않기 위한 것이다(#44). */
  chipNames: FilterChipNames;
  /** 참조 선택지의 한계(잘림·실패) 안내. 밝히지 않으면 값이 사라진 것으로 읽힌다. */
  plantNote?: string;
  onSearch: (period: PeriodInput, filters: ScheduleFilters) => void;
  /** 조건 칩의 ×. 그 조건 하나만 풀고 곧바로 다시 조회한다. */
  onRemoveFilter: (key: ChipKey) => void;
  onReset: () => void;
}

/**
 * 조회 조건 줄.
 *
 * 트리거 모델은 「모아서 적용, 해제는 즉시」다 — 날짜나 조건을 고치는 동안 조회가 나가면
 * 반쯤 지운 기간으로 요청이 나간다. 「조회」를 누를 때만 주소가 바뀌고 그때 조회된다.
 * 두 켜짐 표시(미완료만·납기 지난 것만)도 같다. 조건 칩의 ×는 해제라 즉시 반영한다.
 *
 * **기간이 필수가 아니다.** 비운 채로도 조회가 열려 있다. 잠그는 것은 보내면 반드시 400이 되는
 * 값(없는 날짜·뒤집힌 기간)뿐이다. 안내 문장은 두지 않는다 — 조건 칸만으로 읽히는 화면이다(사용자 결정 2026-10-20).
 */
export const ScheduleFilterBar = ({
  appliedPeriod,
  appliedFilters,
  plantOptions,
  chipNames,
  plantNote,
  onSearch,
  onRemoveFilter,
  onReset,
}: ScheduleFilterBarProps) => {
  const reasonId = useId();
  const detailId = useId();

  const [period, setPeriod] = useState<PeriodInput>(appliedPeriod);
  const [filters, setFilters] = useState<ScheduleFilters>(appliedFilters);

  /*
   * 주소가 정본이다 — 뒤로가기·초기화로 주소가 **바뀌면** 편집 중인 값도 그 값으로 되돌아간다.
   *
   * **되돌림을 참조가 아니라 값으로 판정한다.** 부모는 렌더할 때마다 주소에서 값을 새로 읽으므로
   * 내용이 같아도 참조가 달라질 수 있고(조회 응답이 도착해 다시 그려질 때가 그렇다),
   * 참조로 판정하면 그때마다 사용자가 치던 값이 사라진다(#43).
   */
  const { from: appliedFrom, to: appliedTo } = appliedPeriod;
  const { supplier, plant, item, q, openOnly, overdueOnly } = appliedFilters;

  useEffect(() => {
    setPeriod({ from: appliedFrom, to: appliedTo });
  }, [appliedFrom, appliedTo]);

  useEffect(() => {
    setFilters({ supplier, plant, item, q, openOnly, overdueOnly });
  }, [supplier, plant, item, q, openOnly, overdueOnly]);

  /** 보내면 반드시 400이 되는 기간만 막는다. 비어 있는 것은 잘못이 아니다. */
  const searchReason = validatePeriod(period);

  const search = (): void => {
    if (searchReason !== null) return;

    onSearch(period, filters);
  };

  const chips = toFilterChips(appliedFilters, chipNames);

  /*
   * 상세 조건은 접어 둔다 — 늘 쓰는 길은 위 빠른 조회 줄이다. **걸린 상세 조건이 있으면 펼친 채로
   * 들어온다** — 접혀 있으면 무엇으로 걸렀는지 칸에서 보이지 않는다(칩에는 기간이 없다).
   */
  const hasDetail =
    appliedPeriod.from !== '' || appliedPeriod.to !== '' || plant !== '' || q !== '' || !openOnly;
  const [isOpen, setIsOpen] = useState(hasDetail);

  /* 「전체」를 값이 빈 선택지로 둔다 — 두지 않으면 한 번 고른 뒤에 해제할 방법이 칸 안에 없어진다. */
  const withAll = (options: SelectOption[]): SelectOption[] => [
    { value: '', label: t.filters.all },
    ...options,
  ];

  return (
    <>
      <Button
        variant="text"
        size="sm"
        aria-expanded={isOpen}
        aria-controls={detailId}
        onClick={() => {
          setIsOpen((open) => !open);
        }}
      >
        {isOpen ? t.quick.detailClose : t.quick.detailOpen}
      </Button>

      {/* `hidden` 은 감싸는 상자에 둔다 — `.filter-bar` 의 display 가 속성을 덮는다. */}
      <div id={detailId} hidden={!isOpen}>
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

          {/* 규범 3-2 — 「코드 · 이름」을 고르는 칸이라 최소 폭을 준다(선택지 목록이 잘리지 않게). */}
          <SelectField
            wide
            label={t.fields.plant}
            options={withAll(plantOptions)}
            value={filters.plant}
            note={plantNote}
            onChange={(value) => {
              setFilters((prev) => ({ ...prev, plant: value }));
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
              <Checkbox
                checked={filters.overdueOnly}
                onChange={(event) => {
                  setFilters((prev) => ({ ...prev, overdueOnly: event.target.checked }));
                }}
              >
                {t.fields.overdueOnly}
              </Checkbox>
            </div>
          </div>

          {/*
           * 조회와 초기화는 짝이라 함께 줄바꿈되게 묶고(배치 규범 2-1), 비활성 사유는 그 아래에 둔다.
           * 사유는 감추지 않고 항상 보이는 DOM 텍스트로 렌더해 aria-describedby로 잇는다.
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
