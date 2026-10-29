import { Breadcrumb, Button, Dialog, EmptyState, Icon, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { LeaveGuardProvider } from '../../patterns/leave-guard';
import { PageNav } from '../../patterns/page-nav';
import { toApiError } from '../../patterns/request';
import { usePageHub } from '../../patterns/page-hub';
import {
  InspectionHubCounts,
  type InspectionHubStatus,
} from '../../patterns/inspection-hub-counts';
import { PaneSplitter, useFitToViewport, usePaneSplit } from '../../patterns/po-board';
import {
  PaneHeightSplitter,
  SplitOrientationToggle,
  useSplitOrientation,
} from '../../patterns/split-orientation';
import { LotScan } from '../inspection-documents/lot-scan';
import {
  LIST_PAGE_SIZES,
  PAGE_SIZE,
  QUEUE_STATUSES,
  type ListPageSize,
} from '../oqc-inspection/filters';
import { QueueLoadErrorBanner } from '../oqc-inspection/load-error-banner';
import { useInspectionQueue } from '../oqc-inspection/queries';
import { useDirectSubmitter } from '../pqc-panel/direct-submitter';
import { PqcPanel } from '../pqc-panel/panel';
import { EMPTY_PQC_FILTERS, PqcFilterBar, type PqcFilters } from './filter-bar';
import { PqcQueueTable } from './queue-table';

const t = messages.pqcInspectionRegister;
const hubText = messages.common.inspectionHub;

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
  /* 탭 줄 상태 칩(#185) — 비면 거르지 않는다. */
  const [statusCode, setStatusCode] = useState<InspectionHubStatus | null>(null);
  const [page, setPage] = useState(1);
  /* 목록 쪽 크기 — IQC 목록과 같은 10 · 20 · 50건(사용자 지시 2026-10-28 · #197). */
  const [pageSize, setPageSize] = useState<ListPageSize>(PAGE_SIZE);
  const [filters, setFilters] = useState<PqcFilters>(EMPTY_PQC_FILTERS);
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

  const queue = useInspectionQueue({
    inspectionTypeCode: PQC,
    pendingOnly,
    ...(statusCode === null ? {} : { statusCode }),
    ...(filters.itemId === null ? {} : { itemId: filters.itemId }),
    ...(filters.workOrderId === null ? {} : { workOrderId: filters.workOrderId }),
    ...(filters.keyword === '' ? {} : { q: filters.keyword }),
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
      icon={<Icon name="search_off" size={40} />}
      title={t.queue.empty}
      description={t.queue.emptyHint}
    />
  );

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
        <PqcFilterBar
          applied={filters}
          pendingOnly={pendingOnly}
          onTogglePendingOnly={(next) => {
            /* 조건이 바뀌면 결과가 통째로 달라진다 — 첫 쪽으로 간다. */
            setPendingOnly(next);
            /* 다시 켜면 「완료」 칩은 푼다(같은 AND 이유). */
            if (next && statusCode === 'COMPLETED') setStatusCode(null);
            setPage(1);
          }}
          onSearch={(next) => {
            setFilters(next);
            setPage(1);
          }}
          onReset={() => {
            /* 처음 연 상태로 — 「대기·진행만 보기」도 켠다(OQC 화면과 같다). */
            setFilters(EMPTY_PQC_FILTERS);
            setPendingOnly(true);
            setStatusCode(null);
            setPage(1);
          }}
        />
      </section>

      <div
        ref={splitRef}
        className={`po-board-split inspection-split${layout.orientation === 'column' ? ' is-stacked' : ''}`}
        style={{ ...split.style, ...layout.style }}
      >
        <section className="pane pqc-web-list" aria-label={t.queue.heading}>
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
              controlSize="md"
              onChangePage={setPage}
              sizes={LIST_PAGE_SIZES}
              onChangeSize={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          )}
        </section>

        <PaneSplitter label={hubText.splitter} ratio={split.ratio} onChange={split.commit} />
        {layout.orientation === 'column' && (
          <PaneHeightSplitter
            label={hubText.heightSplitter}
            height={layout.listHeight}
            onChange={layout.changeListHeight}
          />
        )}

        <section className="pane pqc-web-detail" aria-label={t.detail.paneLabel}>
          {selectedId === null ? (
            <EmptyState
              size="sm"
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
                />
              </LeaveGuardProvider>
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
