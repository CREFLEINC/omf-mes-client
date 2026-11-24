import {
  Breadcrumb,
  Button,
  Checkbox,
  Dialog,
  EmptyState,
  Icon,
  PageHeader,
  Tabs,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { itemOptionLabel } from '../../patterns/item-select';
import { LeaveGuardProvider } from '../../patterns/leave-guard';
import { PageNav } from '../../patterns/page-nav';
import { toApiError } from '../../patterns/request';
import { usePageHub } from '../../patterns/page-hub';
import {
  InspectionHubCounts,
  type InspectionHubStatus,
} from '../../patterns/inspection-hub-counts';
import {
  PaneListHead,
  PaneSplitter,
  useFitToViewport,
  usePaneSplit,
} from '../../patterns/po-board';
import {
  PaneHeightSplitter,
  SplitOrientationToggle,
  useSplitOrientation,
} from '../../patterns/split-orientation';
import {
  FilterMoreButton,
  HiddenFilterChips,
  useFilterMore,
  type HiddenFilterChip,
} from '../../patterns/filter-more';
import { LotScan } from '../inspection-documents/lot-scan';
import { plantTodayRange } from '../parts-iqc-inspection/today';
import {
  LIST_PAGE_SIZES,
  PAGE_SIZE,
  QUEUE_STATUSES,
  type ListPageSize,
} from '../oqc-inspection/filters';
import { JudgmentFilter } from '../oqc-inspection/judgment-filter';
import { QueueLoadErrorBanner } from '../oqc-inspection/load-error-banner';
import { useInspectionQueue } from '../oqc-inspection/queries';
import { useDirectSubmitter } from '../pqc-panel/direct-submitter';
import { PqcPanel } from '../pqc-panel/panel';
import { InspectionHistoryPanel, useInspectionHistory } from '../inspection-history/panel';
import { labelOfCode } from '../oqc-inspection/code-options';
import { CODE_GROUPS, toCodeOptions } from '../pqc-inspection/code-options';
import { useCodeValues, useInspectionRequestDetail } from '../pqc-inspection/queries';
import { useItem } from '../production-result/flow-queries';
import { EMPTY_PQC_FILTERS, PqcFilterBar, type PqcFilters } from './filter-bar';
import { PqcQueueTable } from './queue-table';

const t = messages.pqcInspectionRegister;
/* 검사 이력 제목 · 건수는 OQC 와 같은 말을 쓴다. */
const tOqc = messages.oqcInspection;
const todayText = messages.partsIqcInspection;
const hubText = messages.common.inspectionHub;
const referenceText = messages.common.reference;

type HiddenChipKey = 'itemId' | 'workOrder' | 'keyword';

/** 접힌 칸 칩 한 개 — 「라벨: 값」 한 줄, × 의 접근명은 「〈라벨〉 조건 제거」. */
const chipOf = (
  key: HiddenChipKey,
  label: string,
  value: string,
): HiddenFilterChip<HiddenChipKey> => ({
  key,
  label: `${label}: ${value}`,
  removeLabel: messages.common.filterMore.remove(label),
});

/** 이 화면이 무엇인지의 정의 — 조건이 아니다. */
const PQC = 'PQC';
/** 고른 의뢰는 주소에 둔다 — 새로 고쳐도 같은 의뢰가 열린다(IQC #133 과 같은 `ir`). */
const SELECTED_KEY = 'ir';

const toSelectedId = (raw: string | null): number | null => {
  const value = Number(raw);
  return raw !== null && Number.isInteger(value) && value > 0 ? value : null;
};

/**
 * W-03-11 PQC 검사 등록·조회(관리웹 · omf-all-around#107 · UI/UX #135).
 *
 * 목록 → 상세 한 화면씩(IQC 판정 화면 #133 과 같은 짜임). 상세의 입력은 POP 생산 실적 분할 화면과 **같은 패널**
 * (`pqc-panel`)이 맡는다 — 현장과 사무실이 같은 규칙으로 판정한다. 다른 점은 모양과 저장 길뿐이다(관리웹은 바로 저장).
 *
 * ⚠ 목록 질의·쪽 넘김은 W-04-03(OQC)의 것을 쓴다 — 검사 유형만 다르다.
 */
export const PqcInspectionRegisterScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  /* 검사 조회·판정 묶음(사이드바 한 줄 · 제목 아래 탭) 안이면 셸이 준다 — 셸 밖이면 `null`. */
  const hub = usePageHub();
  const selectedId = toSelectedId(searchParams.get(SELECTED_KEY));
  const [pendingOnly, setPendingOnly] = useState(true);
  /* 「오늘 입고」 — 오늘 들어온 의뢰만(사용자 지시 2026-11-02 · #225). */
  const [todayOnly, setTodayOnly] = useState(false);
  /* 탭 줄 상태 칩(#185) — 비면 거르지 않는다. */
  const [statusCode, setStatusCode] = useState<InspectionHubStatus | null>(null);
  /* 종합 판정(omf-all-around#356) — 비면 거르지 않는다. */
  const [judgmentCode, setJudgmentCode] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  /* 목록 쪽 크기 — IQC 목록과 같은 10 · 20 · 50건(사용자 지시 2026-10-28 · #197). */
  const [pageSize, setPageSize] = useState<ListPageSize>(PAGE_SIZE);
  const [filters, setFilters] = useState<PqcFilters>(EMPTY_PQC_FILTERS);
  /*
   * 품목 · 작업지시 · 의뢰번호는 「조건 더보기」로 접어 둔다(사용자 지시 2026-11-02 · #225 · C-6). 늘 접힌 채로 들어오고,
   * 접힌 칸에 걸린 조건은 칩으로 알린다 — × 는 그 조건만 풀어 바로 다시 조회한다.
   */
  const fold = useFilterMore();
  const filterItem = useItem(filters.itemId);
  /* 칩의 값은 펼친 칸이 보이는 글자와 같다(품목코드 · 품목명). */
  const filterItemLabel =
    filterItem.data !== undefined
      ? itemOptionLabel(filterItem.data)
      : filterItem.isError
        ? referenceText.failed
        : referenceText.loading;
  /* 칩 라벨은 대상 이름(표 머리글 · 상세 라벨)이다 — 칸 라벨의 「검색」 같은 동작 낱말을 싣지 않는다. */
  const hiddenChips: HiddenFilterChip<HiddenChipKey>[] = [
    ...(filters.itemId === null ? [] : [chipOf('itemId', t.columns.item, filterItemLabel)]),
    ...(filters.workOrderNo === ''
      ? []
      : [chipOf('workOrder', t.columns.workOrder, filters.workOrderNo)]),
    ...(filters.keyword === ''
      ? []
      : [chipOf('keyword', t.web.summary.inspectionRequestNo, filters.keyword)]),
  ];
  const removeChip = (key: HiddenChipKey): void => {
    setFilters((current) =>
      key === 'itemId'
        ? { ...current, itemId: null }
        : key === 'workOrder'
          ? { ...current, workOrderId: null, workOrderNo: '' }
          : { ...current, keyword: '' },
    );
    setPage(1);
  };
  const [dirty, setDirty] = useState(false);
  /* 저장하지 않은 입력을 두고 옮기려 할 때 묻는 자리(#133 · #185). `to` 가 `null` 이면 상세 닫기다. */
  const [leaveTo, setLeaveTo] = useState<{ to: number | null; href?: string } | null>(null);
  /* 다른 화면으로 옮기기(기준 조회 창의 [수정] · #197) — 저장 안 한 입력이 있으면 먼저 묻는다. */
  const navigate = useNavigate();
  const leaveFor = (href: string): void => {
    if (selectedId !== null && dirty) {
      setLeaveTo({ to: selectedId, href });
      return;
    }
    void navigate(href);
  };
  const submitter = useDirectSubmitter();
  /* 검사 이력 — OQC 와 같은 탭 상자(사용자 지시 2026-11-16 · #274). 저장할 때마다 다시 부른다. */
  const judgmentOptions = toCodeOptions(useCodeValues(CODE_GROUPS.overallJudgment).data ?? []);
  const historyRevision = String(submitter.sentCount);
  const historyCount = useInspectionHistory(selectedId, historyRevision).data?.events.length;
  /* 생략 건은 이력을 상세 안 「검사 이력」 탭으로(IQC 와 같다 · 사용자 지시 2026-11-23 · #353). 캐시를 패널과 같이 쓴다. */
  const selectedSkipped = useInspectionRequestDetail(selectedId).data?.statusCode === 'SKIPPED';
  const historyTab = {
    value: 'history',
    label: messages.inspectionHistory.heading,
    content: (
      <div className="oqc-inspection-tab-body">
        <div className="oqc-inspection-tab-head">
          <h3>{tOqc.detail.historyTitle}</h3>
          {historyCount !== undefined && (
            <span className="oqc-inspection-fold-chip">
              {tOqc.detail.historyCount(historyCount)}
            </span>
          )}
        </div>
        {selectedId !== null && (
          <InspectionHistoryPanel
            hideSourceLot
            inspectionRequestId={selectedId}
            judgmentLabelOf={(code) => labelOfCode(judgmentOptions, code)}
            revision={historyRevision}
          />
        )}
      </div>
    ),
  };

  const queue = useInspectionQueue({
    inspectionTypeCode: PQC,
    pendingOnly,
    ...(statusCode === null ? {} : { statusCode }),
    ...(judgmentCode === null ? {} : { overallJudgmentCode: judgmentCode }),
    ...(filters.itemId === null ? {} : { itemId: filters.itemId }),
    ...(filters.workOrderId === null ? {} : { workOrderId: filters.workOrderId }),
    ...(filters.keyword === '' ? {} : { q: filters.keyword }),
    ...(todayOnly ? plantTodayRange() : {}),
    page,
    size: pageSize,
  });
  const rows = queue.data?.rows ?? [];

  const openRequest = (inspectionRequestId: number | null): void => {
    setDirty(false);
    setLeaveTo(null);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (inspectionRequestId === null) next.delete(SELECTED_KEY);
      else next.set(SELECTED_KEY, String(inspectionRequestId));
      return next;
    });
  };
  const onDirtyChange = useCallback((next: boolean) => setDirty(next), []);

  /*
   * 목록과 상세가 한 화면에 나란히 선다(#185) — 상세를 쓰는 중에 다른 줄을 누르거나 상세를 닫으면,
   * 저장하지 않은 입력이 있을 때 바로 옮기지 않고 한 번 묻는다.
   */
  const moveTo = (to: number | null): void => {
    if (to === selectedId) return;
    if (selectedId !== null && dirty) {
      setLeaveTo({ to });
      return;
    }
    openRequest(to);
  };
  /* 고른 줄을 다시 누르면 고르지 않은 상태로 — 상세가 닫힌다(저장 안 한 입력이 있으면 먼저 묻는다 · 사용자 지시 2026-10-28 · #197). */
  const select = (inspectionRequestId: number): void =>
    moveTo(inspectionRequestId === selectedId ? null : inspectionRequestId);

  /* 목록 · 상세 배치 — 입하 예정 조회와 같은 좌우 분할, 가운데 막대로 폭을 나눈다(비율은 브라우저에 남는다). */
  const { splitRef, aboveRef } = useFitToViewport();
  const split = usePaneSplit('omf-mes:pqc-inspection-register:split', 0.45);
  const listCollapse = {
    collapsed: split.collapsed,
    onToggle: split.toggleCollapsed,
    collapseLabel: hubText.listCollapse,
    expandLabel: hubText.listExpand,
    count: queue.data?.page.total,
  };
  /* 좌우 · 상하 배치(사용자 지시 2026-10-26) — 세 탭이 같은 고름을 쓴다. */
  const layout = useSplitOrientation('omf-mes:inspection-hub:split-orientation');

  const emptyContent = queue.isError ? (
    <p className="field-note">{t.queue.unavailable}</p>
  ) : queue.isPending ? (
    <p className="field-note">{t.queue.loading}</p>
  ) : (
    <EmptyState
      size="sm"
      live
      icon={
        <span className="inspection-standard-empty-icon">
          <Icon name="assignment" size={20} />
        </span>
      }
      title={t.queue.empty}
      description={t.queue.emptyHint}
    />
  );

  /* 「대기·진행만 보기」 — 조건이 바뀌면 결과가 통째로 달라진다 — 첫 쪽으로 간다. 다시 켜면 「완료」 칩은 푼다(같은 AND 이유). */
  const toggleToday = (next: boolean): void => {
    setTodayOnly(next);
    setPage(1);
  };

  const togglePendingOnly = (next: boolean): void => {
    setPendingOnly(next);
    if (next && statusCode === 'COMPLETED') setStatusCode(null);
    setPage(1);
  };

  return (
    <>
      {/* 탭 줄 오른쪽 건수 칩(#185) — 탭 묶음 안에서만 선다. */}
      <InspectionHubCounts
        inspectionTypeCode="PQC"
        statuses={QUEUE_STATUSES}
        active={statusCode}
        onChange={(next) => {
          /* 「완료」는 「대기·진행만 보기」를 함께 끈다 — 서버가 두 조건을 AND 로 묶어 그대로 두면 늘 빈 목록이다. */
          if (next === 'COMPLETED') setPendingOnly(false);
          setStatusCode(next);
          setPage(1);
        }}
      />
      <SplitOrientationToggle orientation={layout.orientation} onChange={layout.change} />
      {/* 탭 묶음(검사 조회·판정) 안이면 탭 막대가 화면 이름을 말한다 — 경로·제목을 세우지 않는다(입하 예정 조회와 같다). */}
      {hub === null && (
        <PageHeader
          /* 상세를 열면 머리 제목도 지금 자리(「검사 기본 정보」)를 말한다 — 경로의 마지막 마디와 같다(#135). */
          title={selectedId === null ? t.title : t.detail.sectionTitle}
          breadcrumb={
            <Breadcrumb
              items={[
                { label: t.breadcrumbRoot },
                { label: t.title },
                ...(selectedId === null ? [] : [{ label: t.detail.sectionTitle }]),
              ]}
              aria-label={messages.common.shell.breadcrumb}
            />
          }
        />
      )}

      {/* 목록과 상세(판정)를 한 화면에 나란히 둔다(#185 · 입하 예정 조회와 같다) — 의뢰를 고르면 오른쪽에 상세가 선다. */}
      {/* 검색 묶음 — 입하 예정 조회처럼 표와 다른 카드에 둔다(#185). 생산 LOT 의 작업지시로 대기 의뢰를 바로 연다. */}
      <section ref={aboveRef} className="pane pqc-web-search">
        <LotScan
          inspectionTypeCode={PQC}
          matchBy="workOrder"
          noRequestMessage={t.filters.lotNoRequest}
          onFound={select}
        />
        {/* 「오늘 입고」 — 오늘 들어온 의뢰만(부품 IQC 와 같은 단추 · 사용자 지시 2026-11-02 · #225). 켜지면 채운 단추. */}
        <Button
          variant={todayOnly ? 'filled' : 'outlined'}
          aria-pressed={todayOnly}
          aria-label={todayOnly ? todayText.todayOn : todayText.todayOff}
          onClick={() => toggleToday(!todayOnly)}
        >
          {todayText.today}
        </Button>
        {/* 「대기·진행만 보기」는 스캔 줄에 늘 보인다 — 상세 조건을 접어도 켜고 끌 수 있게(#225). */}
        <div className="field-cell field-cell-unlabeled inspection-pending-only">
          <Checkbox
            checked={pendingOnly}
            onChange={(event) => togglePendingOnly(event.target.checked)}
          >
            {messages.pqcInspectionRegister.queue.pendingOnly}
          </Checkbox>
        </div>
        {/* 종합 판정 — 고르면 바로 조회한다. 판정은 확정 건에만 있어 「대기·진행만 보기」를 함께 끈다(omf-all-around#356). */}
        <JudgmentFilter
          value={judgmentCode}
          onChange={(code) => {
            setJudgmentCode(code);
            if (code !== null) setPendingOnly(false);
            setPage(1);
          }}
        />
        <div className="inspection-filter-more">
          <FilterMoreButton open={fold.isOpen} controlsId={fold.id} onToggle={fold.toggle} />
        </div>
        {/* `hidden` 은 감싸는 상자에 둔다 — `.filter-bar` 의 display 가 속성을 덮는다. */}
        <div id={fold.id} className="inspection-detail-filters" hidden={!fold.isOpen}>
          <PqcFilterBar
            applied={filters}
            showPendingOnly={false}
            statusCode={statusCode}
            pendingOnly={pendingOnly}
            onTogglePendingOnly={togglePendingOnly}
            onSearch={(next) => {
              setFilters(next);
              setPage(1);
            }}
            onReset={() => {
              /* 처음 연 상태로 — 「대기·진행만 보기」도 켠다(OQC 화면과 같다). */
              setFilters(EMPTY_PQC_FILTERS);
              setPendingOnly(true);
              setStatusCode(null);
              setJudgmentCode(null);
              setPage(1);
            }}
          />
        </div>
        <HiddenFilterChips open={fold.isOpen} chips={hiddenChips} onRemove={removeChip} />
      </section>

      <div
        ref={splitRef}
        className={`po-board-split inspection-split${layout.orientation === 'column' ? ' is-stacked' : ''}`}
        style={{ ...split.style, ...layout.style }}
        data-left-collapsed={split.collapsed ? 'true' : undefined}
      >
        <section className="pane pqc-web-list" aria-label={t.queue.heading}>
          <PaneListHead title={t.queue.heading} collapse={listCollapse} />
          {queue.isError && (
            <QueueLoadErrorBanner
              error={toApiError(queue.error)}
              onRetry={() => void queue.refetch()}
            />
          )}

          <PqcQueueTable
            scrollX={layout.orientation === 'row'}
            rows={rows}
            onSelect={select}
            selectedId={selectedId}
            empty={emptyContent}
          />

          {/* 쪽 이동은 IQC 목록과 같은 모양 — 총 건수 · [처음] [이전] n/N [다음] [마지막](사용자 지시 2026-10-28 · #197). */}
          {queue.data !== undefined && (
            <PageNav
              meta={queue.data.page}
              buttonSize="md"
              onChangePage={setPage}
              sizes={LIST_PAGE_SIZES}
              onChangeSize={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          )}
        </section>

        <PaneSplitter
          label={hubText.splitter}
          ratio={split.ratio}
          onChange={split.commit}
          collapse={listCollapse}
        />
        {layout.orientation === 'column' && (
          <PaneHeightSplitter
            label={hubText.heightSplitter}
            height={layout.listHeight}
            onChange={layout.changeListHeight}
            collapse={listCollapse}
          />
        )}

        <section className="pane pqc-web-detail" aria-label={t.detail.paneLabel}>
          {selectedId === null ? (
            <EmptyState
              size="sm"
              icon={
                <span className="inspection-standard-empty-icon">
                  <Icon name="layers" size={20} />
                </span>
              }
              title={hubText.pickRequest}
              description={hubText.pickRequestHint}
            />
          ) : (
            <>
              <LeaveGuardProvider value={leaveFor}>
                <PqcPanel
                  /* 의뢰마다 새로 세운다 — 앞 의뢰의 입력이 다음 의뢰에 남지 않게. */
                  key={selectedId}
                  inspectionRequestId={selectedId}
                  submitter={submitter}
                  workerNo={null}
                  requiresWorker={false}
                  withKeypad={false}
                  variant="web"
                  onDirtyChange={onDirtyChange}
                  skippedTabs={[historyTab]}
                />
              </LeaveGuardProvider>
              {!selectedSkipped && (
                <div className="oqc-inspection-aux">
                  <section className="pane oqc-inspection-fold oqc-inspection-history-card">
                    <Tabs
                      key={selectedId}
                      aria-label={messages.inspectionHistory.heading}
                      items={[historyTab]}
                    />
                  </section>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {leaveTo !== null && (
        <Dialog
          open
          onClose={() => setLeaveTo(null)}
          showCloseButton={false}
          title={t.detail.leaveUnsaved}
          footer={
            <>
              <Button
                variant="outlined"
                className="app-button-neutral"
                onClick={() => setLeaveTo(null)}
              >
                {t.detail.keepEditing}
              </Button>
              <Button
                variant="filled"
                onClick={() =>
                  leaveTo.href === undefined ? openRequest(leaveTo.to) : void navigate(leaveTo.href)
                }
              >
                {t.detail.leaveAnyway}
              </Button>
            </>
          }
        >
          <p>{t.detail.leaveUnsavedNote}</p>
        </Dialog>
      )}
    </>
  );
};
