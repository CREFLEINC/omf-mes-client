import { AlertBanner, Button, Checkbox, DatePicker, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import {
  FilterMoreButton,
  HiddenFilterChips,
  hasChangedFilters,
  useFilterMore,
} from '../../patterns/filter-more';

import {
  EMPTY_FILTERS,
  toFilterChips,
  type FilterChip,
  type FilterChipNames,
  type ShipmentFilters,
} from './filters';
import {
  defaultPeriod,
  isPeriodEndReason,
  isPeriodRequiredReason,
  validatePeriod,
  type PeriodInput,
} from './period';
import { SelectField } from './select-field';
import { progressLabel } from './status-options';
import type { SelectOption } from './types';

const t = messages.shipmentSchedule;

/** 「조건 더보기」에 접힌 칸의 조건 — 이 조건만 칩으로 알린다(C-6). */
const FOLDED_KEYS: readonly FilterChip['key'][] = [
  'customer',
  'shipToPartner',
  'progress',
  'inspection',
  'ready',
  'replaced',
];

export interface ShipmentFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 기간. 편집 중인 값은 이 부품 안에만 있다. */
  appliedPeriod: PeriodInput;
  appliedFilters: ShipmentFilters;
  customerOptions: SelectOption[];
  shipToPartnerOptions: SelectOption[];
  /** 피처 012 — 사업부 선택지(계정 데이터 범위 안 · FR-007·008). */
  businessUnitOptions: SelectOption[];
  businessUnitNote?: string;
  /** 고정 계약이 정의한 출하 진행 상태 선택지. */
  progressOptions: readonly string[];
  chipNames: FilterChipNames;
  customerNote?: string;
  shipToPartnerNote?: string;
  onSearch: (period: PeriodInput, filters: ShipmentFilters) => void;
  onRemoveFilter: (key: keyof ShipmentFilters) => void;
  onReset: () => void;
}

/**
 * 조회 조건 줄.
 *
 * 트리거 모델은 「모아서 적용, 해제는 즉시」다(W-01-09와 같다) — 「조회」를 누를 때만 주소가
 * 바뀌고 그때 조회된다. 조건 칩의 ×는 해제라 즉시 반영한다.
 *
 * **출하일 시작이 필수다**(공유계약 L-3) — W-01-09(기간이 완전히 선택)와 반대다. 잠그는 것은
 * 시작일 없음 · 형식 오류 · 뒤집힌 기간 셋뿐이다.
 *
 * **보이는 칸은 둘이다**(C-6) — 출하일 · 검색어. 출하일이 두 칸이라 1280 폭에서 셋째 칸까지 두면
 * 단추가 다음 줄로 밀린다. 검색어가 고객 이름도 찾으므로 고객은 납품처 곁으로 접는다. 고객 · 납품처 ·
 * 진행 상태 · 검사 상태 · 두 체크는 「조건 더보기」에 있고, 걸린 조건은 칩으로만 알린다.
 * 「초기화」는 바뀐 것이 있을 때만 보인다.
 */
export const ShipmentFilterBar = ({
  appliedPeriod,
  appliedFilters,
  customerOptions,
  shipToPartnerOptions,
  businessUnitOptions,
  businessUnitNote,
  progressOptions,
  chipNames,
  customerNote,
  shipToPartnerNote,
  onSearch,
  onRemoveFilter,
  onReset,
}: ShipmentFilterBarProps) => {
  const reasonId = useId();
  const periodLabelId = useId();
  const more = useFilterMore();

  const [period, setPeriod] = useState<PeriodInput>(appliedPeriod);
  const [filters, setFilters] = useState<ShipmentFilters>(appliedFilters);

  /*
   * 주소가 정본이다 — 되돌림을 참조가 아니라 값으로 판정한다(#43과 같은 사정을 막는다).
   * 값이 실제로 달라졌을 때만 편집 중인 값을 되돌린다.
   */
  const { from: appliedFrom, to: appliedTo } = appliedPeriod;
  const {
    customer: appliedCustomer,
    shipToPartner: appliedShipToPartner,
    progress: appliedProgress,
    inspection: appliedInspection,
    q: appliedQ,
    ready: appliedReady,
    replaced: appliedReplaced,
    businessUnit: appliedBusinessUnit,
    erp: appliedErp,
  } = appliedFilters;

  useEffect(() => {
    setPeriod({ from: appliedFrom, to: appliedTo });
  }, [appliedFrom, appliedTo]);

  useEffect(() => {
    setFilters({
      customer: appliedCustomer,
      shipToPartner: appliedShipToPartner,
      progress: appliedProgress,
      inspection: appliedInspection,
      q: appliedQ,
      ready: appliedReady,
      replaced: appliedReplaced,
      businessUnit: appliedBusinessUnit,
      erp: appliedErp,
    });
  }, [
    appliedBusinessUnit,
    appliedErp,
    appliedCustomer,
    appliedShipToPartner,
    appliedProgress,
    appliedInspection,
    appliedQ,
    appliedReady,
    appliedReplaced,
  ]);

  const searchReason = validatePeriod(period);

  const search = (): void => {
    if (searchReason !== null) return;

    onSearch(period, filters);
  };

  /*
   * 초기화. **편집 중인 값도 함께 비운다** — 조회한 값이 이미 처음 값이면 주소가 바뀌지 않아
   * 되돌림 effect 가 깨어나지 않고, 치던 값이 그대로 남는다.
   */
  const reset = (): void => {
    setPeriod(defaultPeriod());
    setFilters(EMPTY_FILTERS);
    onReset();
  };

  /* 접힌 칸의 조건만 칩으로 — 보이는 칸(출하일 · 검색어)의 값을 칩으로 겹쳐 적지 않는다. */
  const hiddenChips = toFilterChips(appliedFilters, chipNames).filter((chip) =>
    FOLDED_KEYS.includes(chip.key),
  );
  const isChanged = hasChangedFilters(
    { ...defaultPeriod(), ...EMPTY_FILTERS },
    { ...period, ...filters },
    { ...appliedPeriod, ...appliedFilters },
  );

  /* 「전체」를 값이 빈 선택지로 둔다 — 두지 않으면 한 번 고른 뒤에 해제할 방법이 칸 안에 없어진다. */
  const withAll = (options: SelectOption[]): SelectOption[] => [
    { value: '', label: t.filters.all },
    ...options,
  ];

  const inspectionOptions: SelectOption[] = [
    { value: '', label: t.filters.all },
    { value: 'true', label: t.filters.inspectionRequired },
    { value: 'false', label: t.filters.inspectionNotRequired },
  ];

  return (
    <>
      <div className="filter-bar shipment-schedule-filters">
        {/*
          출하일은 두 칸이지만 **한 조건**이다 — 이름을 하나로 묶고 사이에 「~」를 두어 범위로
          읽히게 한다(사용자 지시 2026-09-22). 칸마다의 이름은 보조기술에 남긴다.
        */}
        <div className="field-cell" role="group" aria-labelledby={periodLabelId}>
          {/*
            ⭐ 필수라는 사실은 **표식**으로 말한다(사용자 지시 2026-09-22) — 단추 아래에 문장을
            두면 다 채우고 나서야 읽게 되고, 그 자리는 조회가 정말 막혔을 때 쓸 자리다.
          */}
          <span className="field-label" id={periodLabelId}>
            {t.fields.period}
            <span className="required-mark" aria-hidden="true">
              {' '}
              *
            </span>
          </span>
          <div className="shipment-schedule-date-range-row">
            {/*
              브라우저 기본 날짜 칸은 값이 비면 「연도. 월. 일.」을 스스로 그려, 무엇을 고르는
              자리인지 말해 주지 못한다(사용자 지시 2026-09-22). 다른 화면이 쓰는 달력 칸으로
              맞춘다 — 보내는 값(`YYYY-MM-DD`)과 조회 규칙은 그대로다.
            */}
            <DatePicker
              className="shipment-schedule-date-field"
              aria-label={t.fields.periodFrom}
              placeholder={t.fields.periodFromPlaceholder}
              aria-required="true"
              /* 비어 있으면 붉은 테두리로 어디를 채워야 하는지 보인다(사용자 지시). */
              invalid={period.from === '' || (searchReason !== null && !isPeriodEndReason(period))}
              value={period.from === '' ? null : period.from}
              onChange={(value) => {
                setPeriod((prev) => ({ ...prev, from: value }));
              }}
            />
            <span className="shipment-schedule-date-range-separator" aria-hidden="true">
              {t.fields.periodSeparator}
            </span>
            <DatePicker
              className="shipment-schedule-date-field"
              aria-label={t.fields.periodTo}
              placeholder={t.fields.periodToPlaceholder}
              /* 종료일 쪽이 막은 것이면 그 칸을 짚는다 — 시작일에 테두리를 두르면 엉뚱하다. */
              invalid={isPeriodEndReason(period)}
              /*
               * 종료일은 **혼자 지울 수 있어야 한다** — 지우는 길이 없으면 기간을 좁혔다 다시
               * 넓히려고 「초기화」를 눌러야 하고, 그러면 고객·진행·검사 조건까지 함께 날아간다.
               */
              clearable
              value={period.to === '' ? null : period.to}
              onChange={(value) => {
                setPeriod((prev) => ({ ...prev, to: value ?? '' }));
              }}
            />
          </div>
        </div>

        {/* 피처 010 — 지시서 번호 · 고객 · 품목 부분 일치(계약 `q`). */}
        <div className="field-cell shipment-schedule-q">
          <TextField
            label={t.filters.q}
            value={filters.q}
            placeholder={t.filters.qPlaceholder}
            onChange={(event) => {
              const q = event.target.value;
              setFilters((prev) => ({ ...prev, q }));
            }}
          />
        </div>
        {/* 피처 012 — 사업부는 조회 조건 셋째 칸(시안 W0402-After ①). 「전체」는 계정 범위 안 사업부 모두. */}
        <SelectField
          wide
          label={t.bu012.businessUnit}
          options={withAll(businessUnitOptions)}
          value={filters.businessUnit}
          note={businessUnitNote}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, businessUnit: value }));
          }}
        />
        <div className="field-cell field-cell-unlabeled shipment-schedule-filter-actions">
          <div className="filter-actions">
            <Button
              disabled={searchReason !== null}
              aria-describedby={searchReason === null ? undefined : reasonId}
              onClick={search}
            >
              {messages.common.search}
            </Button>
            {isChanged && (
              <Button variant="outlined" onClick={reset}>
                {messages.common.reset}
              </Button>
            )}
            <FilterMoreButton open={more.isOpen} controlsId={more.id} onToggle={more.toggle} />
          </div>
          {/*
            ⛔ 막힌 사유를 문장으로 되풀이하지 않는다 — 별표와 붉은 테두리가 같은 말을 한다.
            보조기술에는 남긴다(단추의 `aria-describedby`).
          */}
          {searchReason !== null && (
            <span
              id={reasonId}
              className={
                isPeriodRequiredReason(searchReason)
                  ? 'shipment-schedule-visually-hidden'
                  : 'field-note'
              }
            >
              {searchReason}
            </span>
          )}
        </div>
      </div>

      {/* `hidden` 은 감싸는 상자에 둔다 — `.filter-bar` 의 display 가 속성을 덮는다. */}
      <div id={more.id} hidden={!more.isOpen}>
        <div className="filter-bar shipment-schedule-filters">
          <SelectField
            wide
            label={t.fields.customer}
            options={withAll(customerOptions)}
            value={filters.customer}
            note={customerNote}
            onChange={(value) => {
              setFilters((prev) => ({ ...prev, customer: value }));
            }}
          />
          <SelectField
            wide
            label={t.fields.shipToPartner}
            options={withAll(shipToPartnerOptions)}
            value={filters.shipToPartner}
            note={shipToPartnerNote}
            onChange={(value) => {
              setFilters((prev) => ({ ...prev, shipToPartner: value }));
            }}
          />
          <SelectField
            wide
            label={t.fields.progress}
            /* 고르는 자리도 표와 같은 말을 쓴다 — 보내는 값은 코드 그대로다. */
            options={withAll(
              progressOptions.map((code) => ({ value: code, label: progressLabel(code) })),
            )}
            value={filters.progress}
            onChange={(value) => {
              setFilters((prev) => ({ ...prev, progress: value as ShipmentFilters['progress'] }));
            }}
          />
          <SelectField
            label={t.fields.inspection}
            options={inspectionOptions}
            value={filters.inspection}
            onChange={(value) => {
              setFilters((prev) => ({ ...prev, inspection: value }));
            }}
          />

          {/* 피처 010 — 「완료 대기만」(completionReadyOnly) · 「LOT 교체 있음」(hasReplacement). */}
          <div className="field-cell field-cell-unlabeled shipment-schedule-flags">
            <Checkbox
              checked={filters.ready === 'true'}
              onChange={(event) => {
                const ready = event.target.checked ? 'true' : '';
                setFilters((prev) => ({ ...prev, ready }));
              }}
            >
              {t.filters.readyOnly}
            </Checkbox>
            <Checkbox
              checked={filters.replaced === 'true'}
              onChange={(event) => {
                const replaced = event.target.checked ? 'true' : '';
                setFilters((prev) => ({ ...prev, replaced }));
              }}
            >
              {t.filters.hasReplacement}
            </Checkbox>
          </div>
        </div>
      </div>

      <HiddenFilterChips open={more.isOpen} chips={hiddenChips} onRemove={onRemoveFilter} />
    </>
  );
};
