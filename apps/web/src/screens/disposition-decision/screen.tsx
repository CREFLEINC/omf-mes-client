import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import {
  PaneLayoutToggle,
  PaneListHead,
  PaneSplitter,
  useFitToViewport,
  usePaneLayout,
  usePaneSplit,
} from '../../patterns/po-board';
import { codeOptionsOf } from './disposition-codes';
import { DispositionBox } from './disposition-box';
import { FilterBar } from './filter-bar';
import {
  readPage,
  readPageSize,
  readPendingFilters,
  readSelectedNonconformanceId,
  toAppliedSearchParams,
  toPendingListQuery,
  withSelectedNonconformance,
  type PendingListQuery,
  withPageSize,
  type PendingFilters,
} from './filters';
import { LoadErrorBanner } from './load-error';
import {
  type DispositionLookup,
  useItemLookupFor,
  useNonconformanceStatusLookup,
  useSeverityLookup,
  useUomLookup,
} from './lookups';
import { NonconformanceList } from './nonconformance-list';
import { toPageView } from './pagination';
import { defaultPeriod } from './period';
import { usePendingNonconformances, usePendingTotals } from './queries';
import { sourceTextOf, toNonconformanceRow, type Nonconformance } from './types';

/** 취소된 부적합 — 처분 목록에 두지 않는다(G2 L10). */
const CANCELLED_NONCONFORMANCE = 'CANCELLED';
const EMPTY_NONCONFORMANCES: Nonconformance[] = [];

/** 조회가 끝나기 전엔 `null` — 주소의 코드를 아직 판정할 수 없다. 끝나면 활성 코드 목록(빈 배열 포함). */
const settledCodes = (lookup: DispositionLookup): readonly string[] | null =>
  lookup.isLoading ? null : codeOptionsOf(lookup).map((option) => option.value);

export interface DispositionDecisionScreenProps {
  /** 검사 건에 묶이지 않은 부적합만 — OQC 탭의 「판정 의뢰」(omf-all-around#354). */
  requestOnly?: boolean;
  dispositionTypeCodes?: readonly string[];
  /** 기본 기간을 정하는 기준 날. 감지기가 실행하는 날에 결과가 좌우되지 않게 밖에서 받는다. */
  today?: Date;
  /** UTC 기준 분. 기본은 브라우저의 시간대다. */
  offsetMinutes?: number;
  /** 맨 위 줄 왼쪽에 둘 것 — OQC 탭의 「구분」 고르기. */
  leading?: ReactNode;
}

/**
 * 부적합 목록 | 부적합 처분 상자. 「부적합 처분 관리」 메뉴(W-03-10)를 없앤 뒤(omf-all-around#354) OQC 탭의 「반품」이 쓴다 —
 * 반품 부적합은 검사를 거치지 않아 검사 목록에 오를 줄이 없다. 처분 이력은 따로 두지 않고, 상태 칩 「판정 완료」로 걸러 연다.
 */
export const DispositionDecisionScreen = ({
  requestOnly = false,
  dispositionTypeCodes,
  today,
  offsetMinutes,
  leading,
}: DispositionDecisionScreenProps = {}) => {
  const { splitRef, aboveRef } = useFitToViewport();
  const paneLayout = usePaneLayout('omf-mes:dispositions:layout');
  const sideSplit = usePaneSplit('omf-mes:dispositions:split', 0.5);
  const stackSplit = usePaneSplit('omf-mes:dispositions:stack-split', 0.5);
  const split = paneLayout.layout === 'stack' ? stackSplit : sideSplit;
  const t = messages.dispositionDecision;
  const [searchParams, setSearchParams] = useSearchParams();
  const baseDate = useMemo(() => today ?? new Date(), [today]);
  const zone = useMemo(
    () => offsetMinutes ?? -baseDate.getTimezoneOffset(),
    [baseDate, offsetMinutes],
  );

  /* 심각도·상태 선택지는 공통코드 조회가 채운다(G-32). 주소의 코드는 목록이 서기 전(null)엔 버리지 않는다. */
  const severity = useSeverityLookup();
  const status = useNonconformanceStatusLookup();
  const severityCodes = useMemo(
    () => settledCodes(severity),
    [severity.entries, severity.isLoading],
  );
  const statusCodes = useMemo(() => settledCodes(status), [status.entries, status.isLoading]);
  const filters = useMemo(
    () => readPendingFilters(searchParams, baseDate, severityCodes, statusCodes),
    [baseDate, searchParams, severityCodes, statusCodes],
  );
  /* 판정 의뢰 갈래 — 서버가 검사 건 없는 부적합만 거른다(쪽 단위 · 화면이 응답을 거르지 않는다). */
  const scoped = useCallback(
    (next: PendingListQuery | null): PendingListQuery | null =>
      next === null || !requestOnly ? next : { ...next, withoutInspectionRequestOnly: true },
    [requestOnly],
  );
  const page = readPage(searchParams);
  const size = readPageSize(searchParams);
  const selectedId = readSelectedNonconformanceId(searchParams);
  /* 항목을 골라도 목록은 그대로 둔다 — 「목록 접기」로 접는다(통일 배치 · #350). */
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const query = useMemo(
    () => scoped(toPendingListQuery(filters, page, zone, size)),
    [filters, page, scoped, size, zone],
  );
  /* 처음 값 — 초기화가 되돌리는 값이고, 「초기화」는 이것과 다를 때만 보인다(C-6). */
  const pendingDefaults = useMemo(
    () => ({
      ...defaultPeriod(baseDate),
      itemId: '',
      severityCode: '',
      statusCode: '',
      sourceCode: '',
    }),
    [baseDate],
  );

  const list = usePendingNonconformances(query);
  /* 취소된 부적합(CANCELLED)은 목록에서 뺀다(G2 L10) — 숫자도 그만큼 덜어 행 수와 맞춘다. */
  const cancelledIn = (items: readonly Nonconformance[] | undefined): number =>
    (items ?? []).filter((item) => item.statusCode === CANCELLED_NONCONFORMANCE).length;
  /* 상태 칩 — 공통코드 상태마다 지금 조건(상태는 빼고)의 건수. */
  const statusOptions = codeOptionsOf(status).filter(
    (option) => option.value !== CANCELLED_NONCONFORMANCE,
  );
  const statusTotals = usePendingTotals(
    useMemo(
      () =>
        statusOptions.flatMap((option) => {
          const next = scoped(
            toPendingListQuery({ ...filters, statusCode: option.value }, 1, zone, size),
          );
          return next === null ? [] : [next];
        }),
      // eslint-disable-next-line react-hooks/exhaustive-deps -- 선택지는 상태 조회가 바뀔 때만 바뀐다.
      [filters, scoped, size, zone, status.entries],
    ),
  );
  /* 줄에 보이는 품목은 첫 쪽 밖이어도 이름으로(G2 L-c). */
  const items = useItemLookupFor((list.data?.items ?? []).map((item) => item.itemId));
  const uoms = useUomLookup();

  const rows = useMemo(
    () =>
      (list.data?.items ?? EMPTY_NONCONFORMANCES)
        .filter((item) => item.statusCode !== CANCELLED_NONCONFORMANCE)
        .map(toNonconformanceRow),
    [list.data],
  );
  /* 005 목록 「원천」 칸(G2 L8) — 행 모양은 그대로 두고 따로 넘긴다. */
  const sourceTexts = useMemo(
    () =>
      new Map(
        (list.data?.items ?? EMPTY_NONCONFORMANCES).map(
          (item) => [item.nonconformanceId, sourceTextOf(item)] as const,
        ),
      ),
    [list.data],
  );
  const listMeta =
    list.data === undefined
      ? { page, size: 0, total: 0 }
      : {
          ...list.data.page,
          total: Math.max(0, list.data.page.total - cancelledIn(list.data.items)),
        };
  const pageView = toPageView(listMeta, rows.length);

  const apply = (next: PendingFilters, nextPage = 1): void => {
    setSearchParams((current) => toAppliedSearchParams(current, next, nextPage));
  };
  const openNonconformance = (id: number | null): void => {
    setSearchParams((current) => withSelectedNonconformance(current, id));
  };

  /* 목록 제목 줄 「이름 · 건수 · 목록 접기」 — 고른 것과 상관없이 늘 선다(통일 배치 · #350). */
  const listCollapse = {
    collapsed: isListCollapsed,
    onToggle: () => setIsListCollapsed(!isListCollapsed),
    collapseLabel: t.listCollapse,
    expandLabel: t.listExpand,
    count: list.data === undefined ? undefined : listMeta.total,
  };
  return (
    <>
      {/* 맨 위 한 줄 — 왼쪽 「구분」(넘겨받으면), 오른쪽 상태 칩(건수 · 누르면 그 값만, 다시 누르면 풀림)과 배치 고르기. */}
      <div className="quality-approval-type-bar">
        {leading}
        <div className="quality-approval-type-bar-tools">
          <div
            className="quality-approval-status-chips"
            role="group"
            aria-label={t.fields.statusCode}
          >
            {statusOptions.map((option, index) => {
              const isActive = filters.statusCode === option.value;
              /* 0건 칩은 감춘다 — 걸린 칩은 남겨 풀 수 있게(사용자 지시 2026-11-24). */
              if (statusTotals[index] === 0 && !isActive) return null;
              return (
                <Chip
                  key={option.value}
                  variant="filter"
                  size="sm"
                  selected={isActive}
                  aria-pressed={isActive}
                  onClick={() => apply({ ...filters, statusCode: isActive ? '' : option.value })}
                >
                  {t.statusChip(option.label, statusTotals[index])}
                </Chip>
              );
            })}
          </div>
          <PaneLayoutToggle
            layout={paneLayout.layout}
            onChange={paneLayout.change}
            labels={t.layout}
          />
        </div>
      </div>
      <section ref={aboveRef} className="pane po-board-filter" aria-label={t.panes.filter}>
        <FilterBar
          applied={filters}
          defaults={pendingDefaults}
          severity={severity}
          onApply={(next) => apply(next)}
          onReset={() => apply(pendingDefaults)}
        />
      </section>
      <div
        ref={splitRef}
        className={`${paneLayout.className} disposition-split`}
        style={split.style}
        data-left-collapsed={isListCollapsed ? 'true' : undefined}
      >
        <section
          className="pane po-board-pane po-board-scroll disposition-pane disposition-list-pane"
          aria-label={t.panes.list}
        >
          <PaneListHead title={t.panes.list} collapse={listCollapse} />
          <NonconformanceList
            rows={rows}
            sourceTexts={sourceTexts}
            items={items}
            uoms={uoms}
            severity={severity}
            status={status}
            isLoading={list.isPending}
            error={
              list.isError ? (
                <LoadErrorBanner error={list.error} onRetry={() => void list.refetch()} />
              ) : null
            }
            page={pageView}
            meta={listMeta}
            selectedId={selectedId}
            onSelect={(id) => openNonconformance(selectedId === id ? null : id)}
            onChangeSize={(next) => setSearchParams((current) => withPageSize(current, next))}
            onChangePage={(nextPage) => apply(filters, nextPage)}
          />
        </section>
        <PaneSplitter
          label={t.splitter}
          ratio={split.ratio}
          onChange={split.commit}
          orientation={paneLayout.layout === 'stack' ? 'horizontal' : 'vertical'}
          collapse={listCollapse}
        />
        <section
          className="pane po-board-pane po-board-scroll disposition-pane disposition-side"
          aria-label={t.panes.detailDecision}
        >
          <DispositionBox
            nonconformanceId={selectedId}
            onOpenNonconformance={openNonconformance}
            dispositionTypeCodes={dispositionTypeCodes}
            today={today}
          />
        </section>
      </div>
    </>
  );
};
