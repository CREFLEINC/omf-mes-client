import {
  Breadcrumb,
  Button,
  Checkbox,
  Dialog,
  EmptyState,
  Icon,
  PageHeader,
  useToast,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useId, useState } from 'react';
import { useSearchParams } from 'react-router';

import { DetailFiltersToggle } from '../../patterns/detail-filters';
import {
  InspectionHubCounts,
  type InspectionHubStatus,
} from '../../patterns/inspection-hub-counts';
import { OaOnlyGate } from '../../patterns/oa-only-gate';
import { PageNav } from '../../patterns/page-nav';
import { usePageHub } from '../../patterns/page-hub';
import { PaneSplitter, useFitToViewport, usePaneSplit } from '../../patterns/po-board';
import { toApiError } from '../../patterns/request';
import { sessionKeys, useSession } from '../../patterns/session';
import {
  PaneHeightSplitter,
  SplitOrientationToggle,
  useSplitOrientation,
} from '../../patterns/split-orientation';
import { LotScan } from '../inspection-documents/lot-scan';
import { withDraft, withStatus } from '../oqc-inspection/filters';
import { InspectionDetail } from '../parts-iqc-inspection/inspection-detail';
import { plantTodayRange } from '../parts-iqc-inspection/today';
import { LeaveGuard } from '../routing/leave-guard';
import {
  EMPTY_FILTERS,
  LIST_PAGE_SIZES,
  PAGE_SIZE,
  QUEUE_STATUSES,
  readFilters,
  readPage,
  readPageSize,
  readSelectedId,
  toListQuery,
  toPageParams,
  toPageSizeParams,
  toSearchParams,
  URL_KEYS,
  type QueueFilters,
} from './filters';
import { QueueLoadErrorBanner } from './load-error-banner';
import { toPageView } from './pagination';
import { useInspectionQueue } from './queries';
import { QueueFilterBar } from './queue-filter-bar';
import { QueueTable } from './queue-table';
import { useItemNames, useLotNumbers, useLotSuppliers } from './reference-lookup';

const t = messages.iqcInspection;
/* 상세는 부품 화면과 같은 부품 · 같은 말이다(#247 · 사용자 지시 2026-11-10). */
const parts = messages.partsIqcInspection;
const hubText = messages.common.inspectionHub;

/** 「오늘 입고」 켜짐 — 부품 IQC 화면과 같은 주소 키(omf-all-around#228). */
const TODAY_KEY = 'td';

/**
 * OA 공장 IQC 수입검사·판정. 검색 줄 · 상태 칩 · 목록 표 · 쪽 이동 · 좌우/상하 배치와 오른쪽 상세는 부품 화면과 같다
 * (#247 · 사용자 지시 2026-11-10). 상세에는 OA 만의 「검사 수준」 · 「4M 변경 정보」가 더 선다.
 */
const IqcInspectionScreenBody = () => {
  const hub = usePageHub();
  const toast = useToast();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  /*
   * 들어올 때 세션을 다시 읽는다(omf-all-around#104) — 다른 관리자가 이 계정의 작업자 지정을 해제·변경했어도
   * 세션 캐시(5분)가 남아 저장이 열려 보이지 않게 한다. 서버도 지정 없는 계정의 저장을 거부한다.
   */
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: sessionKeys.current });
  }, [queryClient]);

  const filters = readFilters(searchParams);
  /* 상세 조건(품목 · 공급사 · 의뢰번호)은 접어 둔다 — 주소에 그 조건이 걸려 있으면 펼친 채로 연다(#225). */
  const hasDetailCondition =
    filters.itemId !== null || filters.supplierId !== null || filters.keyword !== '';
  const [detailOpen, setDetailOpen] = useState(hasDetailCondition);
  const detailFiltersId = useId();
  const page = readPage(searchParams);
  const pageSize = readPageSize(searchParams);
  const selectedId = readSelectedId(searchParams);
  /* 오늘 입고 — 공장 하루로 요청 시각을 자른다(부품 IQC 와 같은 셈 · 서버 P-156). */
  const todayOnly = searchParams.get(TODAY_KEY) === '1';

  const queue = useInspectionQueue({
    ...toListQuery(filters, page, pageSize),
    ...(todayOnly ? plantTodayRange() : {}),
  });
  const rows = queue.data?.rows ?? [];
  const pageView = toPageView(queue.data?.page ?? { page, size: 0, total: 0 }, rows.length);
  const itemNames = useItemNames(rows.map((row) => row.itemId));
  const lotNumbers = useLotNumbers(rows.map((row) => row.lotId));
  const lotSuppliers = useLotSuppliers(rows.map((row) => row.lotId));

  /* 주소를 다시 쓸 때 고른 의뢰 · 쪽 크기 · 오늘 입고를 남긴다. */
  const keep = (params: URLSearchParams): URLSearchParams => {
    if (selectedId !== null) params.set(URL_KEYS.selected, String(selectedId));
    if (pageSize !== PAGE_SIZE) params.set(URL_KEYS.size, String(pageSize));
    if (todayOnly) params.set(TODAY_KEY, '1');
    return params;
  };

  /* 조건 줄의 다른 조건 · 고른 의뢰는 그대로 두고 첫 쪽으로 간다. */
  const toggleToday = (on: boolean): void => {
    const params = keep(toSearchParams(filters));
    if (on) params.set(TODAY_KEY, '1');
    else params.delete(TODAY_KEY);
    setSearchParams(params);
  };

  const applyFilters = (next: QueueFilters): void => {
    // 같은 조건의 '조회'도 서버를 다시 보겠다는 뜻이다 — 키가 같으면 그사이 들어온 입하 의뢰가 캐시에 가려진다.
    if (
      page === 1 &&
      next.itemId === filters.itemId &&
      next.supplierId === filters.supplierId &&
      next.keyword === filters.keyword &&
      next.pendingOnly === filters.pendingOnly &&
      next.statusCode === filters.statusCode
    ) {
      void queue.refetch();
    }
    setSearchParams(keep(toSearchParams(next)));
  };

  const applyStatus = (statusCode: InspectionHubStatus | null): void =>
    setSearchParams(keep(toSearchParams(withStatus(filters, statusCode))));

  const goToPage = (next: number): void => setSearchParams(toPageParams(searchParams, next));

  const openRequest = (inspectionRequestId: number | null): void => {
    const next = new URLSearchParams(searchParams);
    if (inspectionRequestId === null) next.delete(URL_KEYS.selected);
    else next.set(URL_KEYS.selected, String(inspectionRequestId));
    setSearchParams(next);
  };

  /* 입력이 있는 채로 다른 의뢰를 고르거나 닫으면 한 번 묻는다. */
  const [dirty, setDirty] = useState(false);
  /* 제출 뒤 LOT 스캔 칸으로 커서를 옮기는 신호. */
  const [scanFocus, setScanFocus] = useState(0);
  const [leaveTo, setLeaveTo] = useState<{ to: number | null } | null>(null);
  const onDirtyChange = useCallback((next: boolean) => setDirty(next), []);
  const moveTo = (to: number | null): void => {
    if (to === selectedId) return;
    if (selectedId !== null && dirty) setLeaveTo({ to });
    else openRequest(to);
  };
  /* 고른 줄을 다시 누르면 상세가 닫힌다. */
  /* 새 의뢰를 고르면 목록을 접어 상세가 자리를 다 쓴다 — 다시 펼치기는 목록과 상세 사이의 단추(사용자 지시 · #252). */
  const select = (inspectionRequestId: number): void => {
    const next = inspectionRequestId === selectedId ? null : inspectionRequestId;
    moveTo(next);
    if (next !== null && !split.collapsed) split.toggleCollapsed();
  };

  const { splitRef, aboveRef } = useFitToViewport();
  const split = usePaneSplit('omf-mes:iqc-inspection:split', 0.45);
  const layout = useSplitOrientation('omf-mes:inspection-hub:split-orientation');
  /* 목록 접기 단추 — 좌우 배치는 세로 막대, 상하 배치는 가로 막대에 같은 모양으로 선다(사용자 지시 · #252). */
  const listCollapse = {
    collapsed: split.collapsed,
    onToggle: split.toggleCollapsed,
    collapseLabel: hubText.listCollapse,
    expandLabel: hubText.listExpand,
  };

  const emptyContent = queue.isError ? (
    <p className="field-note">{t.queue.unavailable}</p>
  ) : queue.isPending ? (
    <p className="field-note">{t.queue.loading}</p>
  ) : pageView.isBeyondLast ? (
    <p className="field-note">
      {t.pageNav.beyondLast}{' '}
      <Button variant="outlined" size="sm" onClick={() => goToPage(1)}>
        {t.pageNav.toFirstPage}
      </Button>
    </p>
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

  return (
    <>
      {/* 탭 줄 오른쪽 건수 칩(#185) — 탭 묶음 안에서만 선다. */}
      <InspectionHubCounts
        inspectionTypeCode="IQC"
        statuses={QUEUE_STATUSES}
        active={filters.statusCode}
        onChange={applyStatus}
      />
      <SplitOrientationToggle orientation={layout.orientation} onChange={layout.change} />
      {/* 탭 묶음(검사 조회·판정) 안이면 탭 막대가 화면 이름을 말한다 — 경로·제목을 세우지 않는다. */}
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

      {/* 검색 묶음 — 부품 IQC 검색 묶음과 같은 모양(omf-all-around#228). */}
      <section
        ref={aboveRef}
        className="pane iqc-inspection-panes iqc-inspection-search parts-iqc-search"
      >
        <div className="parts-iqc-scan-row">
          {/* LOT 바코드로 대기 의뢰를 바로 연다(#58) — 목록 조건은 그대로 두고 선택만 한다. */}
          <LotScan inspectionTypeCode="IQC" onFound={select} focusSignal={scanFocus} />
          {/* 켜지면 채운 단추 — 걸려 있는지 한눈에 */}
          <Button
            variant={todayOnly ? 'filled' : 'outlined'}
            aria-pressed={todayOnly}
            aria-label={todayOnly ? parts.todayOn : parts.todayOff}
            onClick={() => toggleToday(!todayOnly)}
          >
            {parts.today}
          </Button>
          {/* 켜고 끄면 바로 조회한다. */}
          <div className="field-cell field-cell-unlabeled iqc-inspection-pending-only">
            <Checkbox
              checked={filters.pendingOnly}
              onChange={(event) =>
                applyFilters(withDraft(filters, { ...filters, pendingOnly: event.target.checked }))
              }
            >
              {hubText.pendingOnly}
            </Checkbox>
          </div>
          <DetailFiltersToggle
            open={detailOpen}
            onToggle={() => setDetailOpen((open) => !open)}
            controlsId={detailFiltersId}
            hasCondition={hasDetailCondition}
          />
        </div>
        {/* `hidden` 은 감싸는 상자에 둔다 — `.filter-bar` 의 display 가 속성을 덮는다. */}
        <div id={detailFiltersId} className="inspection-detail-filters" hidden={!detailOpen}>
          <QueueFilterBar
            appliedFilters={filters}
            showPendingOnly={false}
            /* 상태는 탭 줄 칩이 맡는다 — 조회는 걸린 칩을 그대로 두고, 초기화는 함께 푼다. */
            onSearch={(next) =>
              applyFilters(withDraft(filters, { ...next, pendingOnly: filters.pendingOnly }))
            }
            onTogglePendingOnly={(next) =>
              applyFilters(withDraft(filters, { ...filters, pendingOnly: next }))
            }
            onReset={() => applyFilters(EMPTY_FILTERS)}
          />
        </div>
      </section>

      <div
        ref={splitRef}
        className={`po-board-split inspection-split${layout.orientation === 'column' ? ' is-stacked' : ''}`}
        style={{ ...split.style, ...layout.style }}
        data-left-collapsed={split.collapsed ? 'true' : undefined}
      >
        <section
          className="pane iqc-inspection-panes iqc-inspection-queue-pane"
          aria-label={t.queue.heading}
        >
          {queue.isError && (
            <QueueLoadErrorBanner
              error={toApiError(queue.error)}
              onRetry={() => void queue.refetch()}
            />
          )}
          <QueueTable
            /* 좌우 · 상하 배치 모두 열 폭을 끌어 넓히면 줄이지 않고 표 안에서 가로로 구른다(사용자 지시 2026-10-27 · #185). */
            scrollX
            rows={rows}
            itemNames={itemNames}
            lotNumbers={lotNumbers}
            suppliers={lotSuppliers}
            selectedId={selectedId}
            onSelect={select}
            skipWorkerNo={session?.worker?.workerNo ?? null}
            empty={emptyContent}
          />
          {/*
           * ⛔ **셀 것이 없으면 그리지 않는다.** 조회가 끝나기 전이나 실패했을 때는 총계를
           * 모르는데, 그리면 대신 넘긴 0이 「전체 0건」이라는 **사실 주장**이 되어 화면에 선다.
           */}
          {queue.data !== undefined && (
            <PageNav
              meta={queue.data.page}
              sizes={LIST_PAGE_SIZES}
              buttonSize="md"
              onChangePage={goToPage}
              onChangeSize={(next) => setSearchParams(toPageSizeParams(searchParams, next))}
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

        <section
          className="pane iqc-inspection-panes iqc-inspection-detail parts-iqc-detail"
          aria-label={t.detail.heading}
        >
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
            <InspectionDetail
              oa
              inspectionRequestId={selectedId}
              onDirtyChange={onDirtyChange}
              onSubmitted={() => {
                setDirty(false);
                openRequest(null);
                setScanFocus((n) => n + 1);
                toast.show({ variant: 'success', description: parts.footer.submitted });
              }}
            />
          )}
        </section>
      </div>

      {/* 고친 것이 있는 채로 다른 화면으로 가거나 새로 고치면 묻는다. 의뢰를 바꾸는 이동은 아래 창이 묻는다. */}
      <LeaveGuard
        when={dirty}
        discardTitle={parts.dialog.title}
        discardBody={parts.dialog.discardConfirm}
        showCloseButton={false}
      />
      {leaveTo !== null && (
        <Dialog
          open
          size="sm"
          showCloseButton={false}
          title={parts.dialog.title}
          onClose={() => setLeaveTo(null)}
          footer={
            <>
              <Button variant="text" onClick={() => setLeaveTo(null)}>
                {messages.common.cancel}
              </Button>
              <Button
                variant="filled"
                onClick={() => {
                  setDirty(false);
                  openRequest(leaveTo.to);
                  setLeaveTo(null);
                }}
              >
                {messages.common.confirm}
              </Button>
            </>
          }
        >
          <p>{parts.dialog.discardConfirm}</p>
        </Dialog>
      )}
    </>
  );
};

/**
 * OA 공장 전용(사용자 지시 2026-10-29) — 부품 공장은 부품 화면이 선다. 계정 범위에 OA 공장이 없으면 안내만
 * 보이고 조회를 보내지 않는다.
 */
export const IqcInspectionScreen = () => (
  <OaOnlyGate title={t.title} breadcrumbRoot={t.breadcrumbRoot}>
    <IqcInspectionScreenBody />
  </OaOnlyGate>
);
