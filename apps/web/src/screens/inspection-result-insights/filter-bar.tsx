import { Button, Checkbox, Icon, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import {
  FilterMoreButton,
  HiddenFilterChips,
  hasChangedFilters,
  useFilterMore,
  type HiddenFilterChip,
} from '../../patterns/filter-more';
import { ItemSelect } from '../../patterns/item-select';
import { Select } from '../../patterns/select';
import { periodProblem, type InspectionInsightFilters } from './filters';
import { useItemNames } from './item-names';

const t = messages.inspectionResultInsights.filter;
/* 접힌 칸 칩의 라벨 — 대상 이름(목록 머리글 · 상세 라벨)이다. 칸 라벨의 「선택 · 검색」 같은 동작 낱말을 싣지 않는다. */
const chipLabels = {
  inspectionType: messages.inspectionResultInsights.overview.columns.inspectionType,
  process: messages.inspectionResultInsights.detail.fields.process,
  calibration: messages.inspectionResultInsights.measurement.columns.calibration,
  item: messages.inspectionResultInsights.overview.columns.item,
};

export interface InspectionFilterOption {
  value: string;
  label: string;
}

export interface InspectionFilterOptions {
  inspectionType: readonly InspectionFilterOption[];
  process: readonly InspectionFilterOption[];
  judgment: readonly InspectionFilterOption[];
}

interface InspectionInsightFilterBarProps {
  appliedFilters: InspectionInsightFilters;
  /** 처음 값 — 초기화가 되돌리는 값(오늘 · 오늘). 「초기화」는 이것과 다를 때만 보인다(C-6). */
  defaults: InspectionInsightFilters;
  options: InspectionFilterOptions;
  onSearch: (filters: InspectionInsightFilters) => void;
  onReset: () => void;
}

const optional = (options: readonly InspectionFilterOption[]): InspectionFilterOption[] => [
  { value: '', label: t.all },
  ...options,
];

const ALL_ITEMS: InspectionFilterOption[] = [{ value: '', label: t.all }];

type HiddenKey = 'inspectionTypeCode' | 'processId' | 'calibrationExpired' | 'itemId';

/** 접힌 칸 칩 한 개 — 「라벨: 값」 한 줄, × 의 접근명은 「〈라벨〉 조건 제거」. */
const chipOf = (key: HiddenKey, label: string, value: string): HiddenFilterChip<HiddenKey> => ({
  key,
  label: `${label}: ${value}`,
  removeLabel: messages.common.filterMore.remove(label),
});

export const InspectionInsightFilterBar = ({
  appliedFilters,
  defaults,
  options,
  onSearch,
  onReset,
}: InspectionInsightFilterBarProps) => {
  const [draft, setDraft] = useState(appliedFilters);
  const id = useId();
  /*
   * 아랫줄(기간 · LOT 밖 조건)은 「조건 더보기」로 접어 둔다(사용자 2026-10-30 · C-6). 늘 접힌 채로 들어오고, 걸린 조건은
   * 아래 칩으로 알린다 — × 는 그 조건만 풀어 바로 조회한다.
   */
  const more = useFilterMore();
  const {
    from,
    to,
    inspectionTypeCode,
    itemId,
    processId,
    overallJudgmentCode,
    lotNo,
    calibrationExpired,
    finalRoundOnly,
  } = appliedFilters;

  useEffect(() => {
    setDraft({
      from,
      to,
      inspectionTypeCode,
      itemId,
      processId,
      overallJudgmentCode,
      lotNo,
      finalRoundOnly,
      calibrationExpired,
    });
  }, [
    from,
    to,
    inspectionTypeCode,
    itemId,
    processId,
    overallJudgmentCode,
    lotNo,
    calibrationExpired,
    finalRoundOnly,
  ]);

  /* LOT 번호가 있으면 기간을 비워 둘 수 있다(omf-all-around#85). 한쪽만 고르면 막는다. */
  const problem = periodProblem(draft);
  const reason =
    problem === 'REQUIRED'
      ? t.periodRequired
      : problem === 'PAIR'
        ? t.periodPair
        : problem === 'REVERSED'
          ? t.periodReversed
          : null;
  /*
   * 안내 줄(LOT · 회차 · 검사 유형 안내)은 뺐다(사용자 2026-11-02). 기간이 잘못돼 [조회]가 막힐 때만 그 까닭을 보인다.
   */
  const note = reason;
  const selects = [
    [t.inspectionType, 'inspectionTypeCode', optional(options.inspectionType), false],
    [t.process, 'processId', optional(options.process), false],
  ] as const;

  /* 접힌 칸 칩의 값 — 펼친 칸이 보이는 글자와 같다(품목은 품목코드 · 품목명). */
  const appliedItemId = itemId === '' ? undefined : Number(itemId);
  const itemNames = useItemNames([appliedItemId]);
  const labelIn = (values: readonly InspectionFilterOption[], value: string): string =>
    values.find((option) => option.value === value)?.label ?? value;
  const hiddenChips: HiddenFilterChip<HiddenKey>[] = [
    ...(inspectionTypeCode === ''
      ? []
      : [
          chipOf(
            'inspectionTypeCode',
            chipLabels.inspectionType,
            labelIn(options.inspectionType, inspectionTypeCode),
          ),
        ]),
    ...(processId === ''
      ? []
      : [chipOf('processId', chipLabels.process, labelIn(options.process, processId))]),
    ...(calibrationExpired === ''
      ? []
      : [
          chipOf(
            'calibrationExpired',
            chipLabels.calibration,
            calibrationExpired === 'only' ? t.calibrationOnly : t.calibrationExclude,
          ),
        ]),
    ...(appliedItemId === undefined
      ? []
      : [
          chipOf(
            'itemId',
            chipLabels.item,
            itemNames.get(appliedItemId)?.label ?? messages.common.reference.loading,
          ),
        ]),
  ];

  /* 「초기화」는 바뀐 것이 있을 때만(C-6) — 편집 중인 값이나 조회에 쓰인 값(판정 칩 포함)이 처음 값과 다를 때. */
  const isChanged = hasChangedFilters(defaults, draft, appliedFilters);
  /* 편집 상태도 함께 처음으로 — 조회에 쓰인 값이 이미 처음 값이면 주소가 바뀌지 않아 되돌림이 깨어나지 않는다. */
  const reset = (): void => {
    setDraft(defaults);
    onReset();
  };

  return (
    <div className="filter-bar inspection-results-filter">
      {/*
       * 윗줄 — 시작일 → 종료일 → LOT 스캔, 오른쪽 끝에 [조회] [초기화] [조건 더보기](사용자 2026-10-30, LOT 현황 조회 줄과
       * 같은 짜임). 나머지 조건은 아랫줄에서 펴고 접는다.
       */}
      <div className="inspection-results-filter-row">
        <TextField
          type="date"
          label={t.from}
          /* LOT 번호가 없으면 기간 없이 조회하지 못한다(`periodProblem`) — 그때만 필수 표시. */
          required={draft.lotNo.trim() === ''}
          value={draft.from}
          onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}
        />
        <TextField
          type="date"
          label={t.to}
          required={draft.lotNo.trim() === ''}
          value={draft.to}
          onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))}
        />
        {/*
         * LOT 칸 — 검사 조회·판정의 LOT 스캔 칸과 같은 모양, 바로 옆 「검색」(사용자 지시 · omf-all-around#217).
         * 바코드 스캐너는 번호 뒤에 Enter 를 보낸다 — 「검색」과 같이 지금 조건으로 바로 조회한다.
         */}
        <div className="inspection-results-lot-scan">
          <TextField
            label={t.lotNo}
            placeholder={t.lotNoPlaceholder}
            value={draft.lotNo}
            onChange={(event) => setDraft((current) => ({ ...current, lotNo: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && reason === null) onSearch(draft);
            }}
          />
          <Button variant="outlined" disabled={reason !== null} onClick={() => onSearch(draft)}>
            {t.lotSearch}
          </Button>
        </div>
        {/* 최종 회차는 LOT 스캔 · 검색 바로 옆(사용자 2026-10-30). */}
        <div className="inspection-results-final-round">
          <Checkbox
            checked={draft.finalRoundOnly}
            onChange={(event) =>
              setDraft((current) => ({ ...current, finalRoundOnly: event.target.checked }))
            }
          >
            {t.finalRoundOnly}
          </Checkbox>
        </div>
        {/* 조회 → 초기화 → 조건 더보기 차례(사용자 지시 · #217). */}
        <div className="form-actions inspection-results-filter-actions">
          <Button disabled={reason !== null} onClick={() => onSearch(draft)}>
            {t.search}
          </Button>
          {isChanged && (
            <Button variant="outlined" onClick={reset}>
              {t.reset}
            </Button>
          )}
          <FilterMoreButton open={more.isOpen} controlsId={more.id} onToggle={more.toggle} />
        </div>
      </div>
      {/* 아랫줄 — `hidden` 은 감싸는 상자에 둔다. */}
      <div id={more.id} className="inspection-results-filter-detail" hidden={!more.isOpen}>
        {/* 검사 유형 → 공정 → 교정 상태 → 품목 차례(사용자 2026-10-30). */}
        {selects.map(([label, key, values, required]) => (
          <div className="field-cell wide-select" key={key}>
            <label className="field-label" htmlFor={`${id}-${key}`}>
              {label}
            </label>
            <Select
              id={`${id}-${key}`}
              value={draft[key] === '' && required ? null : draft[key]}
              placeholder={required ? t.select : undefined}
              options={[...values]}
              onChange={(value) => setDraft((current) => ({ ...current, [key]: value }))}
            />
          </div>
        ))}
        <div className="field-cell wide-select">
          <label className="field-label" htmlFor={`${id}-calibration`}>
            {t.calibration}
          </label>
          <Select
            id={`${id}-calibration`}
            value={draft.calibrationExpired}
            options={[
              { value: '', label: t.all },
              { value: 'only', label: t.calibrationOnly },
              { value: 'exclude', label: t.calibrationExclude },
            ]}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                calibrationExpired: value as InspectionInsightFilters['calibrationExpired'],
              }))
            }
          />
        </div>
        {/* 품목은 9천여 건이라 칸이 서버에서 쪽으로 받아 칸 안에서 검색해 고른다(`ItemSelect` · omf-all-around#226). */}
        <div className="field-cell wide-select inspection-results-filter-item">
          <label className="field-label" htmlFor={`${id}-itemId`}>
            {t.item}
          </label>
          <ItemSelect
            id={`${id}-itemId`}
            includeInactive
            leadingOptions={ALL_ITEMS}
            value={draft.itemId}
            onChange={(itemId) => setDraft((current) => ({ ...current, itemId }))}
          />
        </div>
      </div>
      <HiddenFilterChips
        open={more.isOpen}
        chips={hiddenChips}
        onRemove={(key) => onSearch({ ...appliedFilters, [key]: '' })}
      />
      {/* 안내가 없으면 줄을 두지 않는다 — 빈 줄이 칸 사이 간격만큼 아래 여백을 늘렸다(사용자 2026-10-30). */}
      {note !== null && (
        <div className="inspection-results-filter-footer">
          {/* 안내는 정보 안내 줄 모양(사용자 지시 · omf-all-around#217). */}
          <p className="iqc-inspection-action-note" data-tone="info" role="status">
            <Icon name="info" size={14} aria-hidden />
            {note}
          </p>
        </div>
      )}
    </div>
  );
};
