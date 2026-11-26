import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';

import { DateRangeFields } from '../../patterns/date-range-fields';
import {
  HiddenFilterChips,
  hasChangedFilters,
  type HiddenFilterChip,
} from '../../patterns/filter-more';

import {
  DEFAULT_ADJUSTMENT_FILTERS,
  toAdjustmentFilterChips,
  type AdjustmentChipNames,
  type AdjustmentFilters,
  type RemovableAdjustmentChipKey,
} from './history-filters';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.stockAdjust;

export interface HistoryFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 조건. 편집 중인 값은 이 부품 안에만 있다 */
  appliedFilters: AdjustmentFilters;
  /** 조건 칩이 쓸 참조 이름. **번호가 아니라 이름을 그린다**(`omf-mes#44`) */
  chipNames: AdjustmentChipNames;
  /** 대상 실사 선택지. 등록 탭과 **같은 조회**에서 온다 — 두 번 부르지 않는다 */
  countOptions: SelectOption[];
  /**
   * 조정 사유 선택지 — **고객의 공통코드 마스터에서 온다**(#36 회신 · `reason-options.ts`).
   * 등록 탭과 **같은 조회**에서 온다 — 두 번 부르지 않는다.
   */
  reasonOptions: SelectOption[];
  /**
   * 사유 선택지의 **한계**를 밝히는 보조 문구(불러오기 실패 · 잘림).
   *
   * ⛔ **「목록 준비 중」을 여기 넣지 않는다**(#36 회신 ④).
   */
  reasonNote?: string;
  /** 선택지가 잘렸는가 같은 사정. 밝히지 않으면 불완전한 목록을 완전한 것으로 읽는다 */
  countNote?: string;
  /** 잠겼는가. 조건이 바뀌면 고른 전표가 풀리므로 나가는 중인 쓰기가 있으면 잠근다 */
  isLocked?: boolean;
  onSearch: (filters: AdjustmentFilters) => void;
  /** 조건 칩의 ×. 그 조건 하나만 풀고 곧바로 다시 조회한다. **기간은 들어오지 않는다** */
  onRemoveFilter: (key: RemovableAdjustmentChipKey) => void;
  onReset: () => void;
}

/**
 * 처리 이력 조회 조건 줄.
 *
 * 트리거 모델은 「모아서 적용, 해제는 즉시」다 — 조건을 고치는 동안 조회가 나가면 반쯤 고른
 * 기간으로 요청이 나간다. 「조회」를 누를 때만 주소가 바뀌고 그때 조회된다.
 *
 * ⛔ **승인 대기 조건 칸이 없다**(조심 ① · D-3 · C41). 계약에 그 조건이 남아 있으나 이 화면에는
 * 그 탭이 없다 — 칸을 만들면 그 조건이 요청에 실린다.
 *
 * **검색어 칸이 없다.** 계약의 조정 목록 조회에 검색어 조건이 **없다**(실측) — 만들면 쳐도
 * 아무것도 좁혀지지 않는 칸이 된다.
 *
 * **사유는 고객의 공통코드 마스터에서 오는 실제 목록이다**(#36 회신 · D-9 개정) — ⛔ 사유 칸에
 * 「목록 준비 중」을 붙이면 고객이 스스로 넣을 값을 우리가 미루고 있는 것처럼 읽힌다.
 * **비어도 아무것도 잠기지 않는다** — 조회는 조건 없이도 열려 있다.
 *
 * 선택지가 늘 비어 쓰이지 않던 상태 조건과 그 「값 목록 미확정」 안내, 기간 안내 두 줄
 * (비우면 전기 전 전표도 보인다 · 「초기화」로만 푼다)은 걷었다(사용자 지시 2026-11-18).
 *
 * **조건 셋이 모두 이 줄에 보인다**(C-6) — 접을 조건이 없어 「조건 더보기」를 두지 않고, 칸의 값을 칩으로 겹쳐 적지
 * 않는다. 칩은 칸이 값을 보일 수 없을 때만 선다 — 걸린 실사 · 사유가 선택지에 없을 때(실사 목록이 잘렸거나 다른 화면이
 * 넘긴 값). 「초기화」는 바뀐 것이 있을 때만 보인다(관리웹 정리 시안 A, 2026-11-20).
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const HistoryFilterBar = ({
  appliedFilters,
  chipNames,
  countOptions,
  reasonOptions,
  reasonNote,
  countNote,
  isLocked = false,
  onSearch,
  onRemoveFilter,
  onReset,
}: HistoryFilterBarProps) => {
  const [filters, setFilters] = useState<AdjustmentFilters>(appliedFilters);

  /*
   * 주소가 정본이다 — 뒤로가기·초기화로 주소가 **바뀌면** 편집 중인 값도 그 값으로 되돌아간다.
   *
   * **되돌림을 참조가 아니라 값으로 판정한다.** 부모는 렌더할 때마다 주소에서 값을 새로 읽으므로
   * 내용이 같아도 참조가 달라질 수 있고(조회 응답이 도착해 다시 그려질 때가 그렇다),
   * 참조로 판정하면 그때마다 사용자가 고르던 값이 사라진다(`omf-mes#43`).
   */
  const {
    count: appliedCount,
    reason: appliedReason,
    from: appliedFrom,
    to: appliedTo,
  } = appliedFilters;

  useEffect(() => {
    setFilters({
      count: appliedCount,
      reason: appliedReason,
      from: appliedFrom,
      to: appliedTo,
    });
  }, [appliedCount, appliedReason, appliedFrom, appliedTo]);

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
    setFilters(DEFAULT_ADJUSTMENT_FILTERS);
    onReset();
  };

  /* 선택지에 없는 값은 칸이 보일 수 없다 — 그때만 칩으로 알린다(C-6). */
  const isShownIn = (options: SelectOption[], value: string): boolean =>
    options.some((option) => option.value === value);
  const hiddenChips = toAdjustmentFilterChips(appliedFilters, chipNames).flatMap(
    (chip): HiddenFilterChip<RemovableAdjustmentChipKey>[] =>
      chip.removeLabel !== null &&
      !isShownIn(chip.key === 'count' ? countOptions : reasonOptions, appliedFilters[chip.key])
        ? [{ key: chip.key, label: chip.label, removeLabel: chip.removeLabel }]
        : [],
  );
  const isChanged = hasChangedFilters(DEFAULT_ADJUSTMENT_FILTERS, filters, appliedFilters);

  const allOption: SelectOption = { value: '', label: t.historyFilters.all };

  /**
   * **고를 값이 하나도 없는 칸**은 「전체」도 붙이지 않는다. 「전체」만 있으면 목록이 준비된
   * 것처럼 보인다.
   */
  const withAll = (options: SelectOption[]): SelectOption[] =>
    options.length === 0 ? options : [allOption, ...options];

  /**
   * ⚠ **사유 칸만 「전체」를 언제나 붙인다**(#36 회신 ④).
   *
   * 사유의 「없음」은 미확정이 아니라 **고객의 마스터가 아직 그렇다**는 사실이라, 그때도
   * 「전체」는 고를 수 있는 정상 조건이다 — 빼면 그 칸이 준비되지 않은 것처럼 읽힌다.
   */
  const reasonSelectOptions: SelectOption[] = [allOption, ...reasonOptions];

  return (
    <>
      <div className="filter-bar">
        <DateRangeFields
          clearable
          startLabel={t.historyFields.periodFrom}
          endLabel={t.historyFields.periodTo}
          placeholder={messages.common.selectDate}
          disabled={isLocked}
          from={filters.from}
          to={filters.to}
          onChange={(from, to) => {
            setFilters((prev) => ({ ...prev, from, to }));
          }}
        />

        <SelectField
          label={t.historyFields.count}
          options={withAll(countOptions)}
          value={filters.count}
          note={countNote}
          placeholder={t.historyFilters.all}
          disabled={isLocked}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, count: value }));
          }}
        />

        {/*
         * 사유는 **실제 목록**이라 「전체」가 언제나 서고, 보조 문구는 선택지의 한계
         * (불러오기 실패·잘림)만 말한다 — ⛔ 「목록 준비 중」은 여기 오지 않는다(#36 회신 ④).
         */}
        <SelectField
          label={t.historyFields.reason}
          options={reasonSelectOptions}
          value={filters.reason}
          note={reasonNote}
          placeholder={t.historyFilters.all}
          disabled={isLocked}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, reason: value }));
          }}
        />

        {/* 조회와 초기화는 짝이라 함께 줄바꿈되게 묶는다. */}
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
          </div>
        </div>
      </div>

      <HiddenFilterChips open={false} chips={hiddenChips} onRemove={onRemoveFilter} />
    </>
  );
};
