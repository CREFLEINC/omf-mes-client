import { Breadcrumb, Chip, EmptyState, Icon, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { HubActions, useHubActionsTarget } from '../../patterns/hub-actions';
import { usePageHub } from '../../patterns/page-hub';
import type { PageSize } from '../../patterns/page-nav';
import { PaneSplitter, useFitToViewport, usePaneSplit } from '../../patterns/po-board';
import {
  PaneHeightSplitter,
  SplitOrientationToggle,
  useSplitOrientation,
} from '../../patterns/split-orientation';
import {
  ALL_LOT_TYPES,
  EMPTY_HISTORY_FILTERS,
  EMPTY_LOT_FILTERS,
  readHistoryFilters,
  readHistoryPage,
  readLotFilters,
  readLotPage,
  readLotPageSize,
  readMode,
  readSelectedLotId,
  toAppliedHistorySearchParams,
  toAppliedLotSearchParams,
  toModeSearchParams,
  withLotPageSize,
  withSelectedLot,
  type HistoryFilters,
  type LotFilters,
  type LotStatusSort,
  type ScreenMode,
} from './filters';
import { CurrentResults } from './current-results';
import { HistoryFilterBar } from './history-filter-bar';
import { HistoryResults } from './history-results';
import { LotDetailPane } from './lot-detail-pane';
import { LotFilterBar, type FilterOption } from './lot-filter-bar';
import { useLotStatusOptions, useLotTypeOptions, type LotCodeOption } from './options';
import { useWarehouseReferenceOptions, type ReferenceOption } from './reference-options';
import { useLotActorOptions, useLotStatusSummary } from './queries';

const t = messages.lotStatusHistory;
const hubText = messages.common.inspectionHub;

const MODES: readonly ScreenMode[] = ['lot', 'history'];

/* 좌우 · 상하 배치는 검사 조회·판정 묶음과 따로 기억한다. */
const LOT_STATUS_ORIENTATION_KEY = 'omf-mes:lot-status:split-orientation';

interface StatusChipsProps {
  options: readonly FilterOption[];
  /** 상태별 LOT 건수(상태 조건을 뺀 같은 조회). 아직 모르면 `undefined` — 건수 없이 이름만. */
  counts: ReadonlyMap<string, number> | undefined;
  value: string;
  note?: string;
  onChange: (status: string) => void;
}

/**
 * 현재 상태 단추 — 조회 카드 위쪽 줄에서 누르면 바로 그 상태로 거른다(사용자 2026-10-30). 조건 줄의 현재 상태 칸을
 * 대신한다. 「전체」는 상태 조건을 푼다.
 */
const StatusChips = ({ options, counts, value, note, onChange }: StatusChipsProps) => (
  /* 눈에 보이는 「현재 상태」 글자는 두지 않는다(사용자 2026-10-30) — 이름은 화면 읽기용으로만 남긴다. */
  <div className="lot-status-status-chips" role="group" aria-label={t.lotFilter.fields.status}>
    {[{ value: '', label: t.values.all }, ...options].map((option) => (
      <Chip
        key={option.value}
        variant="filter"
        size="sm"
        selected={value === option.value}
        onSelectedChange={() => {
          if (value !== option.value) onChange(option.value);
        }}
      >
        {option.label}
        {/* 건수도 함께(사용자 2026-10-30). 「전체」는 상태별 합이다. */}
        {counts !== undefined && (
          <span className="lot-status-chip-count">
            {option.value === ''
              ? [...counts.values()].reduce((sum, count) => sum + count, 0)
              : (counts.get(option.value) ?? 0)}
          </span>
        )}
      </Chip>
    ))}
    {note !== undefined && <span className="field-note">{note}</span>}
  </div>
);

interface ModeSwitchProps {
  mode: ScreenMode;
  onChange: (mode: ScreenMode) => void;
  /** 방식을 바꾼 직후다 — 단추가 새 카드에 다시 서므로 눌렀던 자리(고른 단추)로 초점을 돌린다. */
  focusOnMount: ScreenMode | null;
  onFocused: () => void;
}

/** 조회 방식(LOT 번호 · 이력) — 조회 조건 카드 맨 위, 아래 조건 줄과 선으로 가른다(사용자 시안 2026-10-30). */
const ModeSwitch = ({ mode, onChange, focusOnMount, onFocused }: ModeSwitchProps) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusOnMount !== mode) return;
    ref.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
    onFocused();
  }, [focusOnMount, mode, onFocused]);

  return (
    <div ref={ref} className="lot-status-mode" role="group" aria-labelledby="lot-status-mode-label">
      <span className="field-label" id="lot-status-mode-label">
        {t.modes.label}
      </span>
      {MODES.map((value) => (
        <Chip
          key={value}
          variant="filter"
          size="sm"
          selected={mode === value}
          onSelectedChange={() => {
            if (value !== mode) onChange(value);
          }}
        >
          {t.modes[value]}
        </Chip>
      ))}
    </div>
  );
};

const inactiveLabel = (label: string, isActive: boolean): string =>
  isActive ? label : t.values.inactive(label);

const toCodeOptions = (items: readonly LotCodeOption[] | undefined): FilterOption[] =>
  items?.map((item) => ({
    value: item.code,
    label: inactiveLabel(item.label, item.isActive),
  })) ?? [];

const toReferenceOptions = (items: readonly ReferenceOption[] | undefined): FilterOption[] =>
  items?.map((item) => ({
    value: item.value,
    label: inactiveLabel(item.label, item.isActive),
  })) ?? [];

interface OptionState {
  isPending: boolean;
  isError: boolean;
  data?: { isTruncated: boolean };
}

const optionNote = (state: OptionState, name: string): string | undefined => {
  if (state.isPending) return t.optionNotes.loading(name);
  if (state.isError) return t.optionNotes.failed(name);
  if (state.data?.isTruncated === true) return t.optionNotes.truncated(name);
  return undefined;
};

interface LotModeProps {
  modeSwitch: ReactNode;
  filters: LotFilters;
  page: number;
  selectedLotId: number | null;
  onSearch: (filters: LotFilters) => void;
  onReset: () => void;
  onSortChange: (sort: LotStatusSort) => void;
  onPageChange: (page: number) => void;
  pageSize: PageSize;
  onPageSizeChange: (size: PageSize) => void;
  onSelectLot: (lotId: number | null) => void;
}

const LotMode = ({
  modeSwitch,
  filters,
  page,
  selectedLotId,
  onSearch,
  onReset,
  onSortChange,
  onPageChange,
  pageSize,
  onPageSizeChange,
  onSelectLot,
}: LotModeProps) => {
  const lotTypes = useLotTypeOptions();
  const lotStatuses = useLotStatusOptions();
  const warehouses = useWarehouseReferenceOptions();

  const { splitRef, aboveRef } = useFitToViewport();
  const split = usePaneSplit('omf-mes:lot-status:split', 0.5);
  const layout = useSplitOrientation(LOT_STATUS_ORIENTATION_KEY);

  const lotStatusNote =
    lotStatuses.data?.isSeeded === false
      ? t.lotFilter.notes.lotStatusUnseeded
      : optionNote(lotStatuses, t.lotFilter.fields.status);

  /* 칩 건수는 상태 조건만 뺀 같은 조회의 요약이다 — 한 상태를 골라도 다른 상태 건수가 0 이 되지 않게. */
  const chipSummary = useLotStatusSummary({
    ...filters,
    status: '',
    lotType: filters.lotType === '' ? ALL_LOT_TYPES : filters.lotType,
  });
  const chipCounts = useMemo(() => {
    if (chipSummary.data === undefined) return undefined;
    const counts = new Map<string, number>();
    for (const row of chipSummary.data.counts) {
      counts.set(row.statusCode, (counts.get(row.statusCode) ?? 0) + row.lotCount);
    }
    return counts;
  }, [chipSummary.data]);
  const hubTarget = useHubActionsTarget();
  const statusChips = (
    <StatusChips
      options={toCodeOptions(lotStatuses.data?.items)}
      counts={chipCounts}
      value={filters.status}
      note={lotStatusNote}
      onChange={(status) =>
        onSearch({
          ...filters,
          status,
          /* 아직 조회 전이면 유형은 「전체」로 조회한다 — 조회 단추와 같다. */
          lotType: filters.lotType === '' ? ALL_LOT_TYPES : filters.lotType,
        })
      }
    />
  );

  return (
    <div className="lot-status-workspace">
      {/*
       * 현재 상태 단추는 탭 막대 오른쪽, 좌우 · 상하 배치 단추 왼쪽이다(사용자 2026-10-30). 탭 막대가 없으면(묶음 밖)
       * 조회 카드 위쪽 줄에 둔다.
       */}
      {hubTarget !== null && <HubActions target={hubTarget}>{statusChips}</HubActions>}
      {/* 좌우 · 상하 배치 단추 — 탭 막대 오른쪽 끝(검사 조회·판정과 같다 · 사용자 2026-10-30). */}
      <SplitOrientationToggle orientation={layout.orientation} onChange={layout.change} />
      <section ref={aboveRef} className="pane lot-status-search" aria-label={t.lotFilter.pane}>
        <div className="lot-status-search-head">
          {modeSwitch}
          {hubTarget === null && statusChips}
        </div>
        <LotFilterBar
          appliedFilters={filters}
          lotTypeOptions={toCodeOptions(lotTypes.data?.items)}
          warehouseOptions={toReferenceOptions(warehouses.data?.entries)}
          lotTypeNote={
            lotTypes.data?.isSeeded === false
              ? t.lotFilter.notes.lotTypeUnseeded
              : lotTypes.data?.isTruncated === true
                ? t.lotFilter.notes.lotTypeTruncated
                : optionNote(lotTypes, t.lotFilter.fields.lotType)
          }
          warehouseNote={optionNote(warehouses, t.lotFilter.fields.warehouse)}
          onSearch={onSearch}
          onReset={onReset}
        />
      </section>
      {/* 목록과 LOT 상세를 나란히(상하 배치면 위아래로) 둔다 — 종전에는 상세가 창으로 떴다(사용자 2026-10-30). */}
      <div
        ref={splitRef}
        className={`po-board-split inspection-split lot-status-split${layout.orientation === 'column' ? ' is-stacked' : ''}`}
        style={{ ...split.style, ...layout.style }}
      >
        <CurrentResults
          filters={filters}
          page={page}
          statusOptions={toCodeOptions(lotStatuses.data?.items)}
          lotTypeOptions={toCodeOptions(lotTypes.data?.items)}
          onSortChange={onSortChange}
          onPageChange={onPageChange}
          pageSize={pageSize}
          onPageSizeChange={onPageSizeChange}
          onSelectLot={onSelectLot}
          selectedLotId={selectedLotId}
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
          className="pane lot-status-pane lot-status-detail-dialog"
          aria-labelledby="lot-status-detail-title"
        >
          {selectedLotId === null ? (
            /* 고른 LOT 이 없어도 칸 제목은 선다 — 안내는 아이콘과 한 줄(사용자 시안 2026-10-30). */
            <>
              <h2 className="pane-title" id="lot-status-detail-title">
                {t.detail.title}
              </h2>
              <EmptyState
                size="sm"
                icon={<Icon name="arrow_selector_tool" size={24} />}
                title={t.detail.pick}
              />
            </>
          ) : (
            <LotDetailPane
              key={selectedLotId}
              lotId={selectedLotId}
              lotTypeOptions={toCodeOptions(lotTypes.data?.items)}
              statusOptions={toCodeOptions(lotStatuses.data?.items)}
            />
          )}
        </section>
      </div>
    </div>
  );
};

interface HistoryModeProps {
  modeSwitch: ReactNode;
  filters: HistoryFilters;
  page: number;
  onSearch: (filters: HistoryFilters) => void;
  onReset: () => void;
  onPageChange: (page: number) => void;
}

const HistoryMode = ({
  modeSwitch,
  filters,
  page,
  onSearch,
  onReset,
  onPageChange,
}: HistoryModeProps) => {
  const actors = useLotActorOptions(true);
  const lotStatuses = useLotStatusOptions();
  const appUserName = (appUserId: number): string | null => {
    const actor = actors.data?.items.find((item) => item.appUserId === appUserId);
    if (actor === undefined) return null;
    return actor.userName === '' ? actor.loginId : actor.userName;
  };
  const actorOptions: FilterOption[] =
    actors.data?.items.map((actor) => ({
      value: String(actor.appUserId),
      label: inactiveLabel(actor.userName === '' ? actor.loginId : actor.userName, actor.isActive),
    })) ?? [];
  const actorNote = actors.isPending
    ? t.optionNotes.loading(t.historyFilter.fields.actor)
    : actors.isError
      ? t.optionNotes.failed(t.historyFilter.fields.actor)
      : actors.data !== undefined && actors.data.page.total > actors.data.items.length
        ? t.optionNotes.truncated(t.historyFilter.fields.actor)
        : filters.actor !== '' && !actorOptions.some((option) => option.value === filters.actor)
          ? t.historyFilter.actorUnknownNote
          : undefined;

  return (
    <div className="lot-status-workspace">
      <section className="pane lot-status-search" aria-label={t.historyFilter.pane}>
        <div className="lot-status-search-head">{modeSwitch}</div>
        <HistoryFilterBar
          appliedFilters={filters}
          actorOptions={actorOptions}
          actorNote={actorNote}
          onSearch={onSearch}
          onReset={onReset}
        />
      </section>
      <HistoryResults
        filters={filters}
        page={page}
        offsetMinutes={-new Date().getTimezoneOffset()}
        statusOptions={toCodeOptions(lotStatuses.data?.items)}
        appUserName={appUserName}
        onPageChange={onPageChange}
      />
    </div>
  );
};

export const LotStatusHistoryScreen = () => {
  const hub = usePageHub();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = readMode(searchParams);
  const filters = useMemo(() => readLotFilters(searchParams), [searchParams]);
  const historyFilters = useMemo(() => readHistoryFilters(searchParams), [searchParams]);
  const page = readLotPage(searchParams);
  const pageSize = readLotPageSize(searchParams);
  const historyPage = readHistoryPage(searchParams);
  const selectedLotId = readSelectedLotId(searchParams);

  const apply = (next: LotFilters): void => {
    setSearchParams((current) => toAppliedLotSearchParams(current, next, 1));
  };
  const changePage = (nextPage: number): void => {
    setSearchParams((current) => toAppliedLotSearchParams(current, filters, nextPage));
  };
  const changeSort = (sort: LotStatusSort): void => {
    setSearchParams((current) => toAppliedLotSearchParams(current, { ...filters, sort }, 1));
  };
  /* 방식을 바꾸면 단추가 다른 카드에 다시 서서 초점을 잃는다 — 바꾼 직후 한 번만 고른 단추로 돌린다(헤더 점검 #210). */
  const [focusModeSwitch, setFocusModeSwitch] = useState<ScreenMode | null>(null);
  const changeMode = (next: ScreenMode): void => {
    setFocusModeSwitch(next);
    setSearchParams((current) => toModeSearchParams(current, next));
  };
  const modeSwitch = (
    <ModeSwitch
      mode={mode}
      onChange={changeMode}
      focusOnMount={focusModeSwitch}
      onFocused={() => setFocusModeSwitch(null)}
    />
  );
  const applyHistory = (next: HistoryFilters): void => {
    setSearchParams((current) => toAppliedHistorySearchParams(current, next, 1));
  };
  const changeHistoryPage = (nextPage: number): void => {
    setSearchParams((current) => toAppliedHistorySearchParams(current, historyFilters, nextPage));
  };

  const content =
    mode === 'lot' ? (
      <LotMode
        modeSwitch={modeSwitch}
        filters={filters}
        page={page}
        selectedLotId={selectedLotId}
        onSearch={apply}
        onReset={() => apply(EMPTY_LOT_FILTERS)}
        onSortChange={changeSort}
        onPageChange={changePage}
        pageSize={pageSize}
        onPageSizeChange={(size) => setSearchParams((current) => withLotPageSize(current, size))}
        onSelectLot={(lotId) => setSearchParams((current) => withSelectedLot(current, lotId))}
      />
    ) : (
      <HistoryMode
        modeSwitch={modeSwitch}
        filters={historyFilters}
        page={historyPage}
        onSearch={applyHistory}
        onReset={() => applyHistory(EMPTY_HISTORY_FILTERS)}
        onPageChange={changeHistoryPage}
      />
    );

  return (
    <>
      {/* 탭 묶음 안이면 탭 막대가 화면 이름을 말한다 — 경로·제목을 세우지 않는다(omf-all-around#210). */}
      {hub === null && (
        <PageHeader
          title={t.title}
          breadcrumb={
            <Breadcrumb
              items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
              aria-label={messages.common.shell.breadcrumb}
            />
          }
        />
      )}
      {content}
    </>
  );
};
