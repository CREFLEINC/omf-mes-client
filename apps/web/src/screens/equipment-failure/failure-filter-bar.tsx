import { Button, Checkbox } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { DateRangeFields } from '../../patterns/date-range-fields';
import {
  FilterMoreButton,
  HiddenFilterChips,
  type HiddenFilterChip,
  hasChangedFilters,
  useFilterMore,
} from '../../patterns/filter-more';

import { DEFAULT_FILTERS, periodLockReason, STATUS_CODES, type FailureFilters } from './filters';
import { SelectField } from './select-field';
import { statusLabel, type SelectOption } from './types';

const t = messages.equipmentFailure;

/** 「조건 더보기」에 접힌 체크칸. */
type HiddenFlag = 'openOnly' | 'withoutOrder';

export interface FailureFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 조건. 편집 중인 값은 이 부품 안에만 있다. */
  appliedFilters: FailureFilters;
  equipmentOptions: SelectOption[];
  equipmentNote?: string;
  onSearch: (filters: FailureFilters) => void;
  onReset: () => void;
}

/**
 * 조회 조건 줄. 트리거 모델은 「모아서 적용」이다.
 *
 * ⭐ **기본이 「미처리만」 켜짐이다** — 이 화면은 밀린 것을 보는 자리다. 그 사실을 조건 줄에
 * 적는다: 적지 않으면 완료된 건이 왜 안 보이는지 알 수 없고, 사용자는 자료가 없다고 읽는다.
 *
 * **보이는 칸은 셋이다**(C-6) — 설비 · 상태 · 보고 기간. 체크칸 둘은 「조건 더보기」에 접고,
 * 걸려 있으면 칩으로 알린다. 「미처리만」은 기본이 켜짐이라 처음부터 칩이 보인다 — 완료된 건이
 * 왜 안 보이는지가 접혀서도 드러난다. 「초기화」는 바뀐 것이 있을 때만 보인다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const FailureFilterBar = ({
  appliedFilters,
  equipmentOptions,
  equipmentNote,
  onSearch,
  onReset,
}: FailureFilterBarProps) => {
  const periodId = useId();
  const reasonId = `${periodId}-reason`;
  const more = useFilterMore();

  const [filters, setFilters] = useState<FailureFilters>(appliedFilters);

  /* 주소가 정본이다 — 되돌림을 참조가 아니라 값으로 판정한다. */
  const {
    equipment: appliedEquipment,
    status: appliedStatus,
    openOnly: appliedOpenOnly,
    withoutOrder: appliedWithoutOrder,
    from: appliedFrom,
    to: appliedTo,
  } = appliedFilters;

  useEffect(() => {
    setFilters({
      equipment: appliedEquipment,
      status: appliedStatus,
      openOnly: appliedOpenOnly,
      withoutOrder: appliedWithoutOrder,
      from: appliedFrom,
      to: appliedTo,
    });
  }, [
    appliedEquipment,
    appliedStatus,
    appliedOpenOnly,
    appliedWithoutOrder,
    appliedFrom,
    appliedTo,
  ]);

  const lockReason = periodLockReason(filters);

  const search = (): void => {
    if (lockReason !== null) return;

    onSearch(filters);
  };

  /* 접힌 칸(체크칸 둘)에 걸린 조건만 칩으로 — 보이는 칸의 값은 칩으로 겹쳐 적지 않는다. */
  const hiddenChips: HiddenFilterChip<HiddenFlag>[] = [
    ...(appliedFilters.openOnly ? [{ key: 'openOnly' as const, label: t.filters.openOnly }] : []),
    ...(appliedFilters.withoutOrder
      ? [{ key: 'withoutOrder' as const, label: t.filters.withoutOrder }]
      : []),
  ];

  const isChanged = hasChangedFilters(DEFAULT_FILTERS, filters, appliedFilters);

  return (
    <>
      <div className="filter-bar equipment-failure-filter">
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

        <SelectField
          label={t.filters.status}
          options={[
            { value: '', label: t.filters.all },
            ...STATUS_CODES.map((code) => ({ value: code, label: statusLabel(code) })),
          ]}
          value={filters.status}
          placeholder={t.filters.all}
          wide
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, status: value }));
          }}
        />

        <DateRangeFields
          clearable
          startLabel={t.filters.periodFrom}
          endLabel={t.filters.periodTo}
          placeholder={messages.common.selectDate}
          invalid={lockReason !== null}
          describedBy={lockReason === null ? undefined : reasonId}
          from={filters.from}
          to={filters.to}
          onChange={(from, to) => {
            setFilters((prev) => ({ ...prev, from, to }));
          }}
        />

        <div className="field-cell field-cell-unlabeled equipment-failure-filter-actions">
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
        <div className="filter-bar equipment-failure-filter-more">
          <div className="check-group check-group-row">
            <Checkbox
              checked={filters.openOnly}
              onChange={(event) => {
                setFilters((prev) => ({ ...prev, openOnly: event.target.checked }));
              }}
            >
              {t.filters.openOnly}
            </Checkbox>
            <Checkbox
              checked={filters.withoutOrder}
              onChange={(event) => {
                setFilters((prev) => ({ ...prev, withoutOrder: event.target.checked }));
              }}
            >
              {t.filters.withoutOrder}
            </Checkbox>
          </div>
        </div>
      </div>

      {/* 칩의 × 는 그 조건만 풀어 곧바로 다시 조회한다 — 주소가 정본이라 편집 중인 칸도 따라간다. */}
      <HiddenFilterChips
        open={more.isOpen}
        chips={hiddenChips}
        onRemove={(key) => {
          onSearch({ ...appliedFilters, [key]: false });
        }}
      />

      {lockReason === null ? (
        <p className="pane-lead">{t.filters.defaultNote}</p>
      ) : (
        <p id={reasonId} className="pane-lead">
          {lockReason}
        </p>
      )}
    </>
  );
};
