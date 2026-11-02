import { Button, Checkbox, Icon, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { ItemSelect } from '../../patterns/item-select';
import { Select } from '../../patterns/select';
import { periodProblem, type InspectionInsightFilters } from './filters';

const t = messages.inspectionResultInsights.filter;

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
  options: InspectionFilterOptions;
  onSearch: (filters: InspectionInsightFilters) => void;
  onReset: () => void;
}

const optional = (options: readonly InspectionFilterOption[]): InspectionFilterOption[] => [
  { value: '', label: t.all },
  ...options,
];

const ALL_ITEMS: InspectionFilterOption[] = [{ value: '', label: t.all }];

export const InspectionInsightFilterBar = ({
  appliedFilters,
  options,
  onSearch,
  onReset,
}: InspectionInsightFilterBarProps) => {
  const [draft, setDraft] = useState(appliedFilters);
  const id = useId();
  /* 아랫줄(기간 · LOT 밖 조건)은 접어 둔다 — 그 조건이 걸려 있으면 펴서 연다(사용자 2026-10-30). */
  const [isDetailOpen, setIsDetailOpen] = useState(
    () =>
      appliedFilters.inspectionTypeCode !== '' ||
      appliedFilters.itemId !== '' ||
      appliedFilters.processId !== '' ||
      appliedFilters.calibrationExpired !== '',
  );
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

  return (
    <div className="filter-bar inspection-results-filter">
      {/*
       * 윗줄 — 시작일 → 종료일 → LOT 스캔, 오른쪽 끝에 [조회] [초기화] [상세 보기 펼치기](사용자 2026-10-30, LOT 현황 조회 줄과
       * 같은 짜임). 나머지 조건은 아랫줄에서 펴고 접는다.
       */}
      <div className="inspection-results-filter-row">
        <TextField
          type="date"
          label={t.from}
          value={draft.from}
          onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}
        />
        <TextField
          type="date"
          label={t.to}
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
        {/* 조회 → 초기화 → 상세 보기 차례(사용자 지시 · #217). */}
        <div className="form-actions inspection-results-filter-actions">
          <Button disabled={reason !== null} onClick={() => onSearch(draft)}>
            {t.search}
          </Button>
          <Button variant="outlined" onClick={onReset}>
            {t.reset}
          </Button>
          <Button
            variant="text"
            size="sm"
            aria-expanded={isDetailOpen}
            aria-controls={`${id}-detail`}
            onClick={() => setIsDetailOpen((open) => !open)}
          >
            {isDetailOpen ? t.detailClose : t.detailOpen}
          </Button>
        </div>
      </div>
      {/* 아랫줄 — `hidden` 은 감싸는 상자에 둔다. */}
      <div id={`${id}-detail`} className="inspection-results-filter-detail" hidden={!isDetailOpen}>
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
