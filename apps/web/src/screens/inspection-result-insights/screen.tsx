import { EmptyState, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import { selectableLookupOptions } from '../../patterns/lookup-display';
import { plantToday } from '../../patterns/plant-time';
import { PaneSplitter, useFitToViewport, usePaneSplit } from '../../patterns/po-board';
import {
  PaneHeightSplitter,
  SplitOrientationToggle,
  useSplitOrientation,
} from '../../patterns/split-orientation';
import { InspectionInsightFilterBar } from './filter-bar';
import {
  EMPTY_INSPECTION_INSIGHT_FILTERS,
  readInspectionInsightFilters,
  readInspectionResultPage,
  readInspectionResultPageSize,
  readInspectionResultSort,
  type InspectionInsightFilters,
  type InspectionResultSort,
} from './filters';
import { InsightTabs } from './insight-tabs';
import { JudgmentChips } from './judgment-chips';
import type { InspectionLookup } from './lookups';
import { ResultDetailDialog } from './result-detail-dialog';
import { ResultOverview } from './result-overview';
import { SUMMARY_ALL } from './summary-panels';

const t = messages.inspectionResultInsights;
const hubText = messages.common.inspectionHub;
const TYPE_LABELS = new Map<string, string>(
  Object.entries(messages.inspectionResultInsights.inspectionTypes),
);

/** 처음 열 때 · 초기화할 때의 조건 — 시작일 · 종료일은 오늘(공장 날짜)이다(사용자 지시 · omf-all-around#217). */
const todayFilters = (): InspectionInsightFilters => {
  const today = plantToday();
  return { ...EMPTY_INSPECTION_INSIGHT_FILTERS, from: today, to: today };
};

export interface InspectionResultLookupSources {
  inspectionType: InspectionLookup;
  item: InspectionLookup;
  process: InspectionLookup;
  judgment: InspectionLookup;
}

interface InspectionResultInsightsScreenProps {
  lookups: InspectionResultLookupSources;
}

const FILTER_KEYS = [
  ['from', 'from'],
  ['to', 'to'],
  ['inspectionTypeCode', 'type'],
  ['itemId', 'item'],
  ['processId', 'process'],
  ['overallJudgmentCode', 'judgment'],
  ['lotNo', 'lot'],
  ['calibrationExpired', 'calibration'],
] as const;

const withFilters = (
  current: URLSearchParams,
  filters: InspectionInsightFilters,
): URLSearchParams => {
  const next = new URLSearchParams(current);
  for (const [field, key] of FILTER_KEYS) {
    const value = filters[field].trim();
    if (value === '') next.delete(key);
    else next.set(key, value);
  }
  if (filters.finalRoundOnly) next.delete('rounds');
  else next.set('rounds', 'all');
  next.delete('page');
  next.delete('selected');
  return next;
};

const selectedResult = (params: URLSearchParams): number | null => {
  const raw = params.get('selected');
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id >= 1 ? id : null;
};

export const InspectionResultInsightsScreen = ({
  lookups,
}: InspectionResultInsightsScreenProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  /*
   * 조건 없이 들어오면 기간을 오늘로 채운다(사용자 지시 · #217). 주소에 기간 · LOT 이 이미 있으면(다른 화면에서 건 연결 ·
   * 새로 고침) 그대로 둔다. 기록을 늘리지 않게 주소를 바꿔 끼운다.
   */
  useEffect(() => {
    if (searchParams.has('from') || searchParams.has('to') || searchParams.has('lot')) return;
    setSearchParams((current) => withFilters(current, todayFilters()), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 열 때 한 번만 채운다.
  }, []);
  /* 검사 실적 요약 | 불량 분석 배치 — 검사 조회·판정과 같은 좌우 · 상하 고름과 막대(사용자 지시 · #217). */
  const { splitRef, aboveRef } = useFitToViewport();
  const split = usePaneSplit('omf-mes:inspection-results:split', 0.55);
  const layout = useSplitOrientation('omf-mes:inspection-results:split-orientation');
  const filterState = readInspectionInsightFilters(searchParams, {
    inspectionTypeCodes: new Set(lookups.inspectionType.entries.map(({ value }) => value)),
    judgmentCodes: new Set(lookups.judgment.entries.map(({ value }) => value)),
    inspectionTypeReady:
      !lookups.inspectionType.isLoading &&
      !lookups.inspectionType.isError &&
      !lookups.inspectionType.truncated,
    judgmentReady:
      !lookups.judgment.isLoading && !lookups.judgment.isError && !lookups.judgment.truncated,
  });
  const filters = filterState.filters;
  const queriesEnabled = filterState.kind === 'VALID';
  const insightsReady = queriesEnabled && filters.from !== '' && filters.to !== '';
  /*
   * 요약의 유형 탭(전체 · 수입 · 공정 · 출하)을 불량 분석도 따른다 — 수입을 고르면 수입검사 불량률 추이 · 불량 분포
   * (사용자 2026-11-02). 조회 조건에서 유형을 하나 골랐으면 탭 없이 그 유형이다.
   */
  const [summaryType, setSummaryType] = useState(SUMMARY_ALL);
  const analysisFilters =
    filters.inspectionTypeCode !== '' || summaryType === SUMMARY_ALL
      ? filters
      : { ...filters, inspectionTypeCode: summaryType };
  const options = {
    /* 검사 유형 이름은 화면 안 다른 자리와 같은 말 — 「IQC (수입검사)」(사용자 2026-10-30). 모르는 코드는 기준정보 이름 그대로. */
    inspectionType: selectableLookupOptions(lookups.inspectionType, filters.inspectionTypeCode).map(
      (option) =>
        lookups.inspectionType.entries.some((entry) => entry.value === option.value)
          ? { ...option, label: TYPE_LABELS.get(option.value) ?? option.label }
          : option,
    ),
    process: selectableLookupOptions(lookups.process, filters.processId),
    judgment: selectableLookupOptions(lookups.judgment, filters.overallJudgmentCode),
  };
  const sort = readInspectionResultSort(searchParams);
  const page = readInspectionResultPage(searchParams);
  const pageSize = readInspectionResultPageSize(searchParams);
  const selected = selectedResult(searchParams);
  const update = (key: string, value: string | null, clearSelection = true): void => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value === null) next.delete(key);
      else next.set(key, value);
      if (clearSelection) next.delete('selected');
      return next;
    });
  };

  return (
    <section className="inspection-results-workspace" aria-label={t.title}>
      {/*
       * 좌우 · 상하 배치 단추 — 탭 묶음 안이면 탭 줄 오른쪽(검사 조회·판정과 같다), 밖이면(볼 수 있는 탭이 하나) 조회 조건 위
       * 오른쪽 끝에 선다(#217).
       */}
      {/* 종합 판정 칩 — 배치 단추 왼쪽(검사 조회·판정의 상태 칩과 같은 자리 · #217). */}
      <JudgmentChips
        filters={filters}
        options={options.judgment.filter((option) => option.value !== '')}
        isEnabled={queriesEnabled}
        onChange={(overallJudgmentCode) =>
          setSearchParams((current) => withFilters(current, { ...filters, overallJudgmentCode }))
        }
      />
      <SplitOrientationToggle orientation={layout.orientation} onChange={layout.change} inline />
      <section ref={aboveRef} className="pane inspection-results-pane" aria-label={t.filter.pane}>
        <InspectionInsightFilterBar
          appliedFilters={filters}
          options={options}
          onSearch={(next) => setSearchParams((current) => withFilters(current, next))}
          onReset={() => setSearchParams((current) => withFilters(current, todayFilters()))}
        />
      </section>
      <div
        ref={splitRef}
        className={`po-board-split inspection-split inspection-results-split${layout.orientation === 'column' ? ' is-stacked' : ''}`}
        style={{ ...split.style, ...layout.style }}
      >
        <ResultOverview
          filters={filters}
          queriesEnabled={queriesEnabled}
          validationPending={filterState.kind === 'PENDING'}
          sort={sort}
          page={page}
          labels={{ item: lookups.item, judgment: lookups.judgment }}
          onSortChange={(next: InspectionResultSort) => {
            setSearchParams((current) => {
              const params = new URLSearchParams(current);
              params.set('sort', next);
              params.delete('page');
              params.delete('selected');
              return params;
            });
          }}
          onPageChange={(next) => update('page', String(next))}
          pageSize={pageSize}
          onPageSizeChange={(size) =>
            setSearchParams((current) => {
              const params = new URLSearchParams(current);
              params.set('size', String(size));
              params.delete('page');
              params.delete('selected');
              return params;
            })
          }
          selectedId={selected}
          scrollX={layout.orientation === 'row'}
          onSelectResult={(id) => update('selected', String(id), false)}
          onViewExpiredCalibration={() =>
            setSearchParams((current) =>
              withFilters(current, { ...filters, calibrationExpired: 'only' }),
            )
          }
          summaryType={summaryType}
          onSummaryTypeChange={setSummaryType}
        />
        <PaneSplitter label={hubText.splitter} ratio={split.ratio} onChange={split.commit} />
        {layout.orientation === 'column' && (
          <PaneHeightSplitter
            label={hubText.heightSplitter}
            height={layout.listHeight}
            onChange={layout.changeListHeight}
          />
        )}
        <section
          className={`pane inspection-results-pane inspection-results-insights-pane${insightsReady ? '' : ' inspection-results-insights-pane-empty'}`}
          aria-label={t.tabs.pane}
        >
          <h2 className="pane-title">{t.tabs.paneTitle}</h2>
          <InsightTabs
            filters={analysisFilters}
            sourceAxisCode={analysisFilters.inspectionTypeCode}
            queriesEnabled={queriesEnabled}
          />
          {/* 조회 전에는 탭 아래 빈 자리에 안내 — 아이콘 + 한 줄(사용자 시안 · omf-all-around#217). */}
          {!insightsReady && (
            <EmptyState
              size="sm"
              icon={<Icon name="bar_chart" size={32} />}
              title={t.tabs.notReady}
            />
          )}
        </section>
      </div>
      {queriesEnabled && selected !== null && (
        <ResultDetailDialog
          inspectionResultId={selected}
          labels={{ item: lookups.item, judgment: lookups.judgment }}
          onClose={() => update('selected', null, false)}
        />
      )}
    </section>
  );
};
