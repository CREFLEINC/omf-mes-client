import { Button, DatePicker } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { FieldLabel } from './field-label';
import type { DowntimeFilters } from './filters';
import { periodLockReason, type PeriodInput } from './period';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.downtimeSummary;

export interface DowntimeFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 값. 편집 중인 값은 이 부품 안에만 있다. */
  appliedPeriod: PeriodInput;
  appliedFilters: DowntimeFilters;
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
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const DowntimeFilterBar = ({
  appliedPeriod,
  appliedFilters,
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

  return (
    <>
      <div className="filter-bar">
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

        <div className="filter-actions">
          <Button
            onClick={search}
            disabled={lockReason !== null}
            aria-describedby={lockReason === null ? undefined : reasonId}
          >
            {t.filters.search}
          </Button>
          <Button variant="outlined" onClick={onReset}>
            {t.filters.reset}
          </Button>
        </div>
      </div>

      {/* 규범 4 — 잠근 이유를 감추지 않는다. 사유는 「어떻게 풀 것인가」를 담는다. */}
      {lockReason !== null && (
        <p id={reasonId} className="pane-lead">
          {lockReason}
        </p>
      )}
    </>
  );
};
