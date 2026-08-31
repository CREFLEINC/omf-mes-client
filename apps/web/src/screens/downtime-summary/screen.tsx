import { Breadcrumb, Button, PageHeader, Tabs } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { columnsOf, DistributionTable } from './distribution-table';
import { saveCsv, toCsv, type CsvColumn } from './download';
import { DowntimeFilterBar } from './downtime-filter-bar';
import {
  BUCKET_VALUES,
  EMPTY_FILTERS,
  readBucket,
  readFilters,
  readGroupBy,
  readPeriodParams,
  toFilterQuery,
  toSearchParams,
  type Bucket,
  type DowntimeFilters,
  type GroupBy,
} from './filters';
import { IntervalDialog } from './interval-dialog';
import { LoadErrorBanner } from './load-error-banner';
import {
  lookupNote,
  useEquipmentGroupOptions,
  useEquipmentOptions,
  usePlantOptions,
} from './lookups';
import { defaultPeriod, resolvePeriod, type PeriodInput } from './period';
import { useDowntimeIntervals, useDowntimeSummary, type IntervalKind } from './queries';
import { SelectField } from './select-field';
import { SummaryPanel } from './summary-panel';
import type { DistributionRow, DowntimeIntervalView, SelectOption } from './types';

const t = messages.downtimeSummary;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: DistributionRow[] = [];
const EMPTY_INTERVALS: DowntimeIntervalView[] = [];

const BUCKET_LABELS: Record<Bucket, string> = {
  DAY: t.bucket.day,
  WEEK: t.bucket.week,
  MONTH: t.bucket.month,
};

const TAB_LABELS: Record<GroupBy, string> = {
  REASON: t.tabs.reason,
  EQUIPMENT: t.tabs.equipment,
  PERIOD: t.tabs.period,
};

const toReferenceId = (value: string): number | undefined =>
  value === '' ? undefined : Number(value);

/**
 * W-05-08 컨테이너 — **설비가 얼마나 섰고 왜 섰는지**를 기간으로 묶어 본다.
 *
 * ⭐ **탭 셋이 같은 경로의 묶음 축으로 갈린다.** 사유별·설비별·추이이고 응답의 배열 **하나만**
 * 채워지므로, 탭을 바꾸는 것이 곧 다시 조회하는 것이다. 한 번 받아 화면에서 나누는 길이 없다.
 *
 * ⛔ **설비종합효율을 그리지 않는다** — 세 항의 소유가 세 도메인으로 갈린다. 시간가동률까지만 낸다.
 *
 * **이 화면의 숫자는 대부분 무언가를 빼고 센 값이다.** 끝나지 않은 구간은 빠지고, 겹친 구간은
 * 한 번만 세이며 사유별로는 나눌 수 없고, 설비가 붙지 않은 작업은 설비별 분포에서 빠진다.
 * 그래서 요약이 **빠진 것을 건수로** 보이고, 표가 **무엇이 빠졌는지**를 설명으로 단다.
 *
 * **주소 키의 수명.**
 *
 * | # | 조작 | 무엇이 바뀌나 |
 * | :-: | --- | --- |
 * | 1 | 조회 | 기간·조건이 주소에 실린다 |
 * | 2 | 탭 이동 | 묶음 축이 바뀐다 — 조건은 그대로다 |
 * | 3 | 칸 크기 | 추이 탭에서만 뜻이 있다 |
 *
 * 쪽 개념이 없다 — 집계는 묶은 결과라 줄 수가 조건으로 정해진다.
 */
export const DowntimeSummaryScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  /*
   * 기본 기간(최근 한 달)을 **한 번만** 만든다. 렌더마다 「오늘」을 다시 읽으면 자정을 넘기는
   * 순간 조회 조건이 사용자 몰래 바뀐다.
   */
  const [fallbackPeriod] = useState<PeriodInput>(() => defaultPeriod(new Date()));

  const urlPeriod = useMemo(() => readPeriodParams(searchParams), [searchParams]);
  /* 주소에 기간이 없으면 기본값이 들어 있는 것으로 본다 — 계약이 기간을 필수로 두었다. */
  const period: PeriodInput =
    urlPeriod.from === '' || urlPeriod.to === '' ? fallbackPeriod : urlPeriod;

  const filters = useMemo<DowntimeFilters>(() => readFilters(searchParams), [searchParams]);
  const groupBy = readGroupBy(searchParams.get('tab'));
  const bucket = readBucket(searchParams.get('bucket'));

  const [openKind, setOpenKind] = useState<IntervalKind | null>(null);

  const periodState = resolvePeriod(period);
  const filterQuery = useMemo(() => toFilterQuery(filters), [filters]);

  const summaryQuery =
    periodState.kind === 'ready'
      ? {
          ...periodState.query,
          ...filterQuery,
          groupBy,
          /* 칸 크기는 추이 탭에서만 싣는다 — 그 밖에는 서버가 무시하므로 캐시 키만 갈라진다. */
          ...(groupBy === 'PERIOD' ? { bucket } : {}),
        }
      : null;

  const summary = useDowntimeSummary(summaryQuery);
  const view = summary.data ?? null;
  const rows = view?.rows ?? EMPTY_ROWS;

  const intervals = useDowntimeIntervals(
    openKind,
    periodState.kind === 'ready' ? periodState.query : null,
    filterQuery,
  );

  const plantId = toReferenceId(filters.plant);
  const plants = usePlantOptions();
  const equipmentGroups = useEquipmentGroupOptions(plantId);
  const equipments = useEquipmentOptions(plantId);

  const toOptions = (entries: { value: string; label: string }[]): SelectOption[] =>
    entries.map((entry) => ({ value: entry.value, label: entry.label }));

  const apply = (
    nextPeriod: PeriodInput,
    nextFilters: DowntimeFilters,
    nextGroupBy: GroupBy,
    nextBucket: Bucket,
  ): void => {
    setSearchParams(toSearchParams(nextPeriod, nextFilters, nextGroupBy, nextBucket));
  };

  /**
   * 내려받기 — **지금 표에 있는 줄을 그대로** 파일로 만든다.
   *
   * 서버에 내려받기 경로가 없어 화면이 만든다. 열 구성은 표와 같은 자리에서 가져오므로 표에
   * 열이 늘면 파일에도 늘고, 표에 없는 열이 파일에만 생기는 일이 없다.
   */
  const download = (): void => {
    const columns: CsvColumn[] = columnsOf(groupBy).map((column) => ({
      header: typeof column.header === 'string' ? column.header : column.key,
      value: (row) => {
        const rendered = column.render?.(row, 0);

        return typeof rendered === 'string' ? rendered : '';
      },
    }));

    saveCsv(t.download.fileName(TAB_LABELS[groupBy], period.from, period.to), toCsv(rows, columns));
  };

  const canDownload = periodState.kind === 'ready' && !summary.isPending && rows.length > 0;
  /* 요약은 값이 왔거나 오는 중일 때만 선다 — 조회 자체가 막혔으면 그릴 것이 없다. */
  const isSummaryVisible = summaryQuery !== null && (view !== null || summary.isPending);

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {summary.isError && (
        <LoadErrorBanner
          error={summary.error}
          onRetry={() => {
            void summary.refetch();
          }}
        />
      )}

      <section className="pane" aria-label={t.panes.filters}>
        <DowntimeFilterBar
          appliedPeriod={period}
          appliedFilters={filters}
          plantOptions={toOptions(plants.entries)}
          equipmentGroupOptions={toOptions(equipmentGroups.entries)}
          equipmentOptions={toOptions(equipments.entries)}
          plantNote={lookupNote(plants, t.filters.plant)}
          equipmentGroupNote={lookupNote(equipmentGroups, t.filters.equipmentGroup)}
          equipmentNote={lookupNote(equipments, t.filters.equipment)}
          onSearch={(nextPeriod, nextFilters) => {
            apply(nextPeriod, nextFilters, groupBy, bucket);
          }}
          onReset={() => {
            apply(fallbackPeriod, EMPTY_FILTERS, groupBy, bucket);
          }}
        />
      </section>

      {!summary.isError && (
        <>
          {/*
           * ⛔ 그릴 것이 없으면 **구획째 그리지 않는다.** 페인만 남기면 빈 테두리 상자가 서고,
           * 브라우저 확인에서 그것이 「자료가 안 왔다」가 아니라 **화면이 덜 그려진 것**으로
           * 보였다. 조회를 막고 있는 사유는 이미 조건 줄이 말하고 있다.
           */}
          {isSummaryVisible && (
            <section className="pane" aria-label={t.panes.summary}>
              <SummaryPanel
                view={view}
                isLoading={summary.isPending && summaryQuery !== null}
                onOpenIntervals={setOpenKind}
              />
            </section>
          )}

          <section className="pane" aria-label={t.panes.detail}>
            <Tabs
              aria-label={t.panes.detail}
              value={groupBy}
              onChange={(value) => {
                apply(period, filters, readGroupBy(value), bucket);
              }}
              items={[
                { value: 'REASON', label: TAB_LABELS.REASON, content: null },
                { value: 'EQUIPMENT', label: TAB_LABELS.EQUIPMENT, content: null },
                { value: 'PERIOD', label: TAB_LABELS.PERIOD, content: null },
              ]}
            />

            {/*
             * 칸 크기는 **추이 탭에서만** 뜻이 있다. 다른 탭에서도 보이면 사용자가 그 값이
             * 결과를 바꾼다고 읽지만 서버는 무시한다.
             */}
            {groupBy === 'PERIOD' && (
              <div className="filter-bar">
                <SelectField
                  label={t.bucket.label}
                  options={BUCKET_VALUES.map((value) => ({
                    value,
                    label: BUCKET_LABELS[value],
                  }))}
                  value={bucket}
                  onChange={(value) => {
                    apply(period, filters, groupBy, readBucket(value));
                  }}
                />
              </div>
            )}

            <DistributionTable
              rows={rows}
              groupBy={groupBy}
              isLoading={summary.isPending && summaryQuery !== null}
              hasQuery={summaryQuery !== null}
            />

            <div className="form-actions">
              <Button variant="outlined" onClick={download} disabled={!canDownload}>
                {t.filters.download}
              </Button>
            </div>
            <p className="pane-lead">{canDownload ? t.download.note : t.download.disabled}</p>
          </section>
        </>
      )}

      <IntervalDialog
        kind={openKind}
        isScopeNarrowed={filters.plant !== '' || filters.equipmentGroup !== ''}
        rows={intervals.data?.items ?? EMPTY_INTERVALS}
        isLoading={intervals.isPending && openKind !== null}
        isError={intervals.isError}
        error={intervals.error}
        onRetry={() => {
          void intervals.refetch();
        }}
        onClose={() => {
          setOpenKind(null);
        }}
      />
    </>
  );
};
