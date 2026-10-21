import { Button, Checkbox, Chip, SearchInput, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState, type ReactNode } from 'react';

import { toFilterChips, type ChipKey, type FilterChipNames, type ScheduleFilters } from './filters';
import { validatePeriod, type PeriodInput } from './period';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.inboundSchedule;

export interface ScheduleFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 기간. 편집 중인 값은 이 부품 안에만 있다. */
  appliedPeriod: PeriodInput;
  appliedFilters: ScheduleFilters;
  /** 기본 기간(오늘 앞뒤 2주). 이와 다르면 상세 조건을 펼친 채로 들어온다. */
  fallbackPeriod: PeriodInput;
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
  /** 빠른 조회 칸들(공급업체 · 품목코드 · 오늘 도착 · 지연). 납기와 조회 단추 사이에 선다. */
  quick: ReactNode;
}

/**
 * 조회 조건 줄.
 *
 * 트리거 모델은 「모아서 적용, 해제는 즉시」다 — 날짜나 조건을 고치는 동안 조회가 나가면
 * 반쯤 지운 기간으로 요청이 나간다. 「조회」를 누를 때만 주소가 바뀌고 그때 조회된다.
 * 「미완료만」도 같다. 지연은 위 빠른 조회 줄의 확인칸 하나로만 건다(같은 조건이 두 곳에 있지 않게). 조건 칩의 ×는 해제라 즉시 반영한다.
 *
 * **기간이 필수가 아니다.** 비운 채로도 조회가 열려 있다. 잠그는 것은 보내면 반드시 400이 되는
 * 값(없는 날짜·뒤집힌 기간)뿐이다. 안내 문장은 두지 않는다 — 조건 칸만으로 읽히는 화면이다(사용자 결정 2026-10-20).
 */
export const ScheduleFilterBar = ({
  appliedPeriod,
  appliedFilters,
  fallbackPeriod,
  plantOptions,
  chipNames,
  plantNote,
  onSearch,
  onRemoveFilter,
  onReset,
  quick,
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
  const searchReason = filters.overdueOnly ? null : validatePeriod(period);

  const search = (): void => {
    if (searchReason !== null) return;

    onSearch(period, filters);
  };

  /**
   * 납기는 **고르는 즉시 조회한다**(2026-10-21). 같은 줄의 빠른 조회(품목코드 등)는 즉시 적용이라, 납기만
   * 「조회」를 기다리면 화면의 날짜와 실제로 걸린 날짜가 어긋난다 — 날짜를 바꾸고 품목코드를 치면 옛 기간으로
   * 찾아 「기간 안에 있는데 안 나온다」가 된다. 보내면 400이 되는 값(덜 친 날짜·뒤집힌 기간)은 기다린다.
   */
  const changePeriod = (next: PeriodInput): void => {
    setPeriod(next);
    if (validatePeriod(next) === null) onSearch(next, appliedFilters);
  };

  const chips = toFilterChips(appliedFilters, chipNames);

  /*
   * 상세 조건은 접어 둔다 — 늘 쓰는 길은 위 빠른 조회 줄이다. **걸린 상세 조건이 있으면 펼친 채로
   * 들어온다** — 접혀 있으면 무엇으로 걸렀는지 칸에서 보이지 않는다(칩에는 기간이 없다).
   */
  const hasDetail = plant !== '' || q !== '' || !openOnly;
  const [isOpen, setIsOpen] = useState(hasDetail);

  /* 「전체」를 값이 빈 선택지로 둔다 — 두지 않으면 한 번 고른 뒤에 해제할 방법이 칸 안에 없어진다. */
  const withAll = (options: SelectOption[]): SelectOption[] => [
    { value: '', label: t.filters.all },
    ...options,
  ];

  return (
    <>
      {/*
       * 한 줄 — 납기 · 빠른 조회(공급업체 · 품목코드 · 오늘 도착 · 지연) · 조회/초기화(사용자 지시 2026-10-21).
       * 납기는 「모아서 적용」이라 조회 단추로 반영되고, 빠른 조회는 즉시 반영된다.
       */}
      <div className="filter-bar">
        <TextField
          type="date"
          label={t.fields.periodFrom}
          value={period.from}
          disabled={overdueOnly}
          onChange={(event) => {
            changePeriod({ ...period, from: event.target.value });
          }}
        />
        <TextField
          type="date"
          label={t.fields.periodTo}
          value={period.to}
          disabled={overdueOnly}
          onChange={(event) => {
            changePeriod({ ...period, to: event.target.value });
          }}
        />
        {quick}
        {/*
         * 조회와 초기화는 짝이라 함께 줄바꿈되게 묶고(배치 규범 2-1), 비활성 사유는 그 아래에 둔다.
         * 사유는 감추지 않고 항상 보이는 DOM 텍스트로 렌더해 aria-describedby로 잇는다.
         */}
        <div className="field-cell field-cell-unlabeled">
          <div className="filter-actions po-board-actions">
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
            {/* 상세 조건 펼치기는 초기화 오른쪽(사용자 지시 2026-10-21). */}
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
          </div>
          {searchReason !== null && (
            <span id={reasonId} className="field-note">
              {searchReason}
            </span>
          )}
        </div>
      </div>
      {/* `hidden` 은 감싸는 상자에 둔다 — `.filter-bar` 의 display 가 속성을 덮는다. */}
      <div id={detailId} hidden={!isOpen}>
        <div className="filter-bar">
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
            <div className="check-group check-group-row">
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
        </div>
      </div>
      {/* 조회·초기화는 접힌 상세 조건 밖에 둔다 — 접어도 늘 보인다. 펼치면 조건 칸이 이 줄 위에 선다. */}
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
