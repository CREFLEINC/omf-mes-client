import { Button, DatePicker } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import {
  FilterMoreButton,
  HiddenFilterChips,
  hasChangedFilters,
  useFilterMore,
} from '../../patterns/filter-more';

import { FieldLabel } from './field-label';
import { EMPTY_FILTERS, type DowntimeFilters } from './filters';
import { periodLockReason, type PeriodInput } from './period';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.downtimeSummary;

export interface DowntimeFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 값. 편집 중인 값은 이 부품 안에만 있다. */
  appliedPeriod: PeriodInput;
  appliedFilters: DowntimeFilters;
  /** 처음 기간(최근 한 달) — 「초기화」를 세울지 견줄 처음 값이다. 화면이 한 번 만든 것을 받는다. */
  defaultPeriod: PeriodInput;
  plantOptions: SelectOption[];
  equipmentGroupOptions: SelectOption[];
  equipmentOptions: SelectOption[];
  plantNote?: string;
  equipmentGroupNote?: string;
  equipmentNote?: string;
  onSearch: (period: PeriodInput, filters: DowntimeFilters) => void;
  onReset: () => void;
}

/**
 * 조회 조건 줄. 트리거 모델은 「모아서 적용」이다 — 「조회」를 누를 때만 주소가 바뀌고 그때
 * 조회된다.
 *
 * **기간이 필수다**(공유계약 L-3). 잠그는 것은 빈 값 · 달력에 없는 날 · 뒤집힌 기간 셋뿐이고,
 * 셋의 해법이 서로 달라 사유도 따로 낸다.
 *
 * ⭐ **공장을 바꾸면 그룹·설비 선택을 비운다.** 비우지 않으면 다른 공장의 설비가 걸린 채로
 * 남아 결과가 늘 비고, 사용자는 「이 공장에 자료가 없다」로 읽는다.
 *
 * **보이는 칸은 셋이다**(C-6) — 기간 · 설비 그룹 · 설비. 공장은 「조건 더보기」에 접고, 걸려 있으면
 * 칩으로 알린다. 「초기화」는 바뀐 것이 있을 때만 보인다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const DowntimeFilterBar = ({
  appliedPeriod,
  appliedFilters,
  defaultPeriod,
  plantOptions,
  equipmentGroupOptions,
  equipmentOptions,
  plantNote,
  equipmentGroupNote,
  equipmentNote,
  onSearch,
  onReset,
}: DowntimeFilterBarProps) => {
  const periodId = useId();
  const reasonId = `${periodId}-reason`;
  const more = useFilterMore();

  const [period, setPeriod] = useState<PeriodInput>(appliedPeriod);
  const [filters, setFilters] = useState<DowntimeFilters>(appliedFilters);

  /*
   * 주소가 정본이다 — 되돌림을 참조가 아니라 값으로 판정한다. 값이 실제로 달라졌을 때만
   * 편집 중인 값을 되돌린다.
   */
  const { from: appliedFrom, to: appliedTo } = appliedPeriod;
  const {
    plant: appliedPlant,
    equipmentGroup: appliedEquipmentGroup,
    equipment: appliedEquipment,
  } = appliedFilters;

  useEffect(() => {
    setPeriod({ from: appliedFrom, to: appliedTo });
  }, [appliedFrom, appliedTo]);

  useEffect(() => {
    setFilters({
      plant: appliedPlant,
      equipmentGroup: appliedEquipmentGroup,
      equipment: appliedEquipment,
    });
  }, [appliedPlant, appliedEquipmentGroup, appliedEquipment]);

  const lockReason = periodLockReason(period);

  const search = (): void => {
    if (lockReason !== null) return;

    onSearch(period, filters);
  };

  /* 접힌 칸(공장)에 걸린 조건만 칩으로 — 보이는 칸의 값은 칩으로 겹쳐 적지 않는다. */
  const hiddenChips =
    appliedFilters.plant === ''
      ? []
      : [
          {
            key: 'plant' as const,
            label: t.filters.chipPlant(
              plantOptions.find((option) => option.value === appliedFilters.plant)?.label ??
                appliedFilters.plant,
            ),
            removeLabel: messages.common.filterMore.remove(t.filters.plant),
          },
        ];

  const isChanged = hasChangedFilters(
    { ...defaultPeriod, ...EMPTY_FILTERS },
    { ...period, ...filters },
    { ...appliedPeriod, ...appliedFilters },
  );

  return (
    <>
      <div className="filter-bar downtime-summary-filter">
        <div className="field-cell">
          <FieldLabel htmlFor={periodId} label={t.filters.period} />
          {/* 기간은 **한 컨트롤**이다 — `mode="range"` 하나가 두 값을 준다. */}
          <DatePicker
            id={periodId}
            mode="range"
            placeholder={messages.common.selectDate}
            invalid={lockReason !== null}
            aria-describedby={lockReason === null ? undefined : reasonId}
            value={[period.from === '' ? null : period.from, period.to === '' ? null : period.to]}
            onChange={([from, to]) => {
              setPeriod({ from, to });
            }}
          />
        </div>

        <SelectField
          label={t.filters.equipmentGroup}
          options={[{ value: '', label: t.filters.all }, ...equipmentGroupOptions]}
          value={filters.equipmentGroup}
          note={equipmentGroupNote}
          placeholder={t.filters.all}
          wide
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, equipmentGroup: value }));
          }}
        />

        <SelectField
          label={t.filters.equipment}
          options={[{ value: '', label: t.filters.all }, ...equipmentOptions]}
          value={filters.equipment}
          note={equipmentNote}
          placeholder={t.filters.all}
          wide
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, equipment: value }));
          }}
        />

        <div className="field-cell field-cell-unlabeled downtime-summary-filter-actions">
          <div className="filter-actions">
            <Button
              onClick={search}
              disabled={lockReason !== null}
              aria-describedby={lockReason === null ? undefined : reasonId}
            >
              {t.filters.search}
            </Button>
            {isChanged && (
              <Button variant="outlined" onClick={onReset}>
                {t.filters.reset}
              </Button>
            )}
            <FilterMoreButton open={more.isOpen} controlsId={more.id} onToggle={more.toggle} />
          </div>
        </div>
      </div>

      {/* `hidden` 은 감싸는 상자에 둔다 — `.filter-bar` 의 display 가 속성을 덮는다. */}
      <div id={more.id} hidden={!more.isOpen}>
        <div className="filter-bar downtime-summary-filter">
          <SelectField
            label={t.filters.plant}
            options={[{ value: '', label: t.filters.all }, ...plantOptions]}
            value={filters.plant}
            note={plantNote}
            placeholder={t.filters.all}
            wide
            onChange={(value) => {
              /* 공장이 바뀌면 그 아래 선택은 뜻을 잃는다 — 남겨 두면 결과가 늘 빈다. */
              setFilters({ plant: value, equipmentGroup: '', equipment: '' });
            }}
          />
        </div>
      </div>

      {/* 칩의 × 는 공장 조건만 풀어 곧바로 다시 조회한다 — 그룹 · 설비는 공장을 풀어도 뜻이 남는다. */}
      <HiddenFilterChips
        open={more.isOpen}
        chips={hiddenChips}
        onRemove={() => {
          onSearch(appliedPeriod, { ...appliedFilters, plant: '' });
        }}
      />

      {/* 규범 4 — 잠근 이유를 감추지 않는다. 사유는 「어떻게 풀 것인가」를 담는다. */}
      {lockReason !== null && (
        <p id={reasonId} className="pane-lead">
          {lockReason}
        </p>
      )}
    </>
  );
};
