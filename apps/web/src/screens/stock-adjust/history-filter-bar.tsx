import { Button, Chip, DatePicker } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { FieldLabel } from './field-label';
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
   * ⛔ **「목록 준비 중」을 여기 넣지 않는다**(#36 회신 ④) — 아래 상태 칸과 갈리는 자리다.
   */
  reasonNote?: string;
  /**
   * 전표 상태 선택지. **값 목록이 아직 확정되지 않았다**(자리표시 · `code-options.ts`) —
   * 화면이 넘긴다. 부품이 상수를 직접 읽으면 그 전환을 화면 수준에서 잴 수 없다.
   */
  statusOptions: SelectOption[];
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
 * **사유와 상태는 이제 갈린다**(#36 회신 · D-9 개정). 사유는 고객의 공통코드 마스터에서 오는
 * 실제 목록이고, 상태는 아직 설계가 정할 자리표시다 — ⛔ 사유 칸에 「목록 준비 중」을 붙이면
 * 고객이 스스로 넣을 값을 우리가 미루고 있는 것처럼 읽힌다.
 * **어느 쪽이 비어도 아무것도 잠기지 않는다** — 조회는 조건 없이도 열려 있다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const HistoryFilterBar = ({
  appliedFilters,
  chipNames,
  countOptions,
  reasonOptions,
  reasonNote,
  statusOptions,
  countNote,
  isLocked = false,
  onSearch,
  onRemoveFilter,
  onReset,
}: HistoryFilterBarProps) => {
  const periodId = useId();
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
    status: appliedStatus,
    from: appliedFrom,
    to: appliedTo,
  } = appliedFilters;

  useEffect(() => {
    setFilters({
      count: appliedCount,
      reason: appliedReason,
      status: appliedStatus,
      from: appliedFrom,
      to: appliedTo,
    });
  }, [appliedCount, appliedReason, appliedStatus, appliedFrom, appliedTo]);

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

  const chips = toAdjustmentFilterChips(appliedFilters, chipNames);
  const hasPeriodChip = chips.some((chip) => chip.key === 'period');

  const allOption: SelectOption = { value: '', label: t.historyFilters.all };

  /**
   * **고를 값이 하나도 없는 칸**은 「전체」도 붙이지 않는다. 「전체」만 있으면 목록이 준비된
   * 것처럼 보인다 — 왜 비었는지는 안내가 말한다.
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

  const codeNote = (options: SelectOption[]): string | undefined =>
    options.length === 0 ? t.historyFilters.codePending : undefined;

  const codePlaceholder = (options: SelectOption[]): string =>
    options.length === 0 ? t.historyFilters.codePlaceholder : t.historyFilters.all;

  return (
    <>
      <div className="filter-bar">
        {/*
         * 기간은 **한 컨트롤**이다 — `mode="range"` 하나가 두 값을 준다. 주소 키(`hfrom`·`hto`)와
         * 요청 파라미터는 그대로이고 바뀐 것은 고르는 수단뿐이다.
         */}
        <div className="field-cell">
          <FieldLabel htmlFor={periodId} label={t.historyFields.period} />
          <DatePicker
            id={periodId}
            mode="range"
            placeholder={messages.common.selectDate}
            disabled={isLocked}
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

        <SelectField
          label={t.historyFields.status}
          options={withAll(statusOptions)}
          value={filters.status}
          note={codeNote(statusOptions)}
          placeholder={codePlaceholder(statusOptions)}
          disabled={isLocked}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, status: value }));
          }}
        />

        {/* 조회와 초기화는 짝이라 함께 줄바꿈되게 묶는다. */}
        <div className="field-cell field-cell-unlabeled">
          <div className="filter-actions">
            <Button disabled={isLocked} onClick={search}>
              {messages.common.search}
            </Button>
            <Button variant="outlined" disabled={isLocked} onClick={reset}>
              {messages.common.reset}
            </Button>
          </div>
        </div>
      </div>

      {/* 기본 기간이 없다는 사실은 화면에서 읽혀야 한다 — 빈 칸이 고장으로 읽히지 않게 한다. */}
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
