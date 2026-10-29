import { Breadcrumb, Button, Dialog, EmptyState, Icon, PageHeader, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router';

import {
  InspectionHubCounts,
  type InspectionHubStatus,
} from '../../patterns/inspection-hub-counts';
import type { ScopedPlant } from '../../patterns/oa-access';
import { PageNav } from '../../patterns/page-nav';
import { usePageHub } from '../../patterns/page-hub';
import { PaneSplitter, useFitToViewport, usePaneSplit } from '../../patterns/po-board';
import { toApiError } from '../../patterns/request';
import { Select } from '../../patterns/select';
import {
  PaneHeightSplitter,
  SplitOrientationToggle,
  useSplitOrientation,
} from '../../patterns/split-orientation';
import { LotScan } from '../inspection-documents/lot-scan';
import {
  EMPTY_FILTERS,
  LIST_PAGE_SIZES,
  PAGE_SIZE,
  QUEUE_STATUSES,
  URL_KEYS,
  readFilters,
  readPage,
  readPageSize,
  readSelectedId,
  toListQuery,
  toPageParams,
  toPageSizeParams,
  toSearchParams,
  type QueueFilters,
} from '../iqc-inspection/filters';
import { QueueLoadErrorBanner } from '../iqc-inspection/load-error-banner';
import { toPageView } from '../iqc-inspection/pagination';
import { QueueFilterBar } from '../iqc-inspection/queue-filter-bar';
import { QueueTable } from '../iqc-inspection/queue-table';
import { useItemNames, useLotNumbers, useLotSuppliers } from '../iqc-inspection/reference-lookup';
import { withDraft, withStatus } from '../oqc-inspection/filters';
import { InspectionDetail } from './inspection-detail';
import { usePartsQueue } from './queries';

const t = messages.partsIqcInspection;
/* 목록 · 검색 조건은 OA 화면과 같은 부품 · 같은 말이다(사용자 지시 2026-10-29). */
const oa = messages.iqcInspection;
const hubText = messages.common.inspectionHub;
/* 공장 고름은 주소에 싣는다 — 새로고침해도 같은 공장 목록이 선다. 공장이 하나면 싣지 않는다. */
const PLANT_KEY = 'pl';

export interface PartsIqcInspectionScreenProps {
  /** 계정 범위의 부품 공장 — 하나면 고르는 칸이 없다. */
  plants: ScopedPlant[];
}

/**
 * 부품 공장 IQC 수입검사·판정(omf-all-around#211). 계정 공장이 부품이면 「검사 조회·판정 > IQC」 탭이 이 화면을 연다.
 * 검색 줄 · 상태 칩 · 목록 표 · 쪽 이동 · 좌우/상하 배치는 OA 화면과 같은 부품이고, 상세 구획에 레퍼런스 화면의
 * 「IQC 수입검사」가 선다. 목록은 부품 공장 LOT 의 의뢰만 낸다.
 */
export const PartsIqcInspectionScreen = ({ plants }: PartsIqcInspectionScreenProps) => {
  const hub = usePageHub();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = readFilters(searchParams);
  const page = readPage(searchParams);
  const pageSize = readPageSize(searchParams);
  const selectedId = readSelectedId(searchParams);
  const plantParam = Number(searchParams.get(PLANT_KEY));
  const plantId =
    plants.find((plant) => plant.plantId === plantParam)?.plantId ?? plants[0]?.plantId ?? 0;

  const queue = usePartsQueue({ ...toListQuery(filters, page, pageSize), plantId });
  const rows = queue.data?.rows ?? [];
  const pageView = toPageView(queue.data?.page ?? { page, size: 0, total: 0 }, rows.length);
  const itemNames = useItemNames(rows.map((row) => row.itemId));
  const lotNumbers = useLotNumbers(rows.map((row) => row.lotId));
  const lotSuppliers = useLotSuppliers(rows.map((row) => row.lotId));

  /* 주소를 다시 쓸 때 고른 의뢰 · 쪽 크기 · 공장을 남긴다(OA 화면 `applyFilters` 와 같다). */
  const keep = (params: URLSearchParams): URLSearchParams => {
    if (selectedId !== null) params.set(URL_KEYS.selected, String(selectedId));
    if (pageSize !== PAGE_SIZE) params.set(URL_KEYS.size, String(pageSize));
    if (plants.length > 1) params.set(PLANT_KEY, String(plantId));
    return params;
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

  const changePlant = (next: number): void => {
    const params = toSearchParams(filters);
    params.set(PLANT_KEY, String(next));
    if (pageSize !== PAGE_SIZE) params.set(URL_KEYS.size, String(pageSize));
    setSearchParams(params);
  };

  const openRequest = (inspectionRequestId: number | null): void => {
    const next = new URLSearchParams(searchParams);
    if (inspectionRequestId === null) next.delete(URL_KEYS.selected);
    else next.set(URL_KEYS.selected, String(inspectionRequestId));
    setSearchParams(next);
  };

  /* 입력이 있는 채로 다른 의뢰를 고르거나 닫으면 한 번 묻는다 — OA 화면의 「저장하지 않고 이동」과 같다. */
  const [dirty, setDirty] = useState(false);
  const [leaveTo, setLeaveTo] = useState<{ to: number | null } | null>(null);
  const onDirtyChange = useCallback((next: boolean) => setDirty(next), []);
  const moveTo = (to: number | null): void => {
    if (to === selectedId) return;
    if (selectedId !== null && dirty) setLeaveTo({ to });
    else openRequest(to);
  };
  /* 고른 줄을 다시 누르면 상세가 닫힌다(OA 화면과 같다). */
  const select = (inspectionRequestId: number): void =>
    moveTo(inspectionRequestId === selectedId ? null : inspectionRequestId);

  const { splitRef, aboveRef } = useFitToViewport();
  const split = usePaneSplit('omf-mes:parts-iqc-inspection:split', 0.45);
  const layout = useSplitOrientation('omf-mes:inspection-hub:split-orientation');

  const emptyContent = queue.isError ? (
    <p className="field-note">{oa.queue.unavailable}</p>
  ) : queue.isPending ? (
    <p className="field-note">{oa.queue.loading}</p>
  ) : pageView.isBeyondLast ? (
    <p className="field-note">
      {oa.pageNav.beyondLast}{' '}
      <Button variant="outlined" size="sm" onClick={() => goToPage(1)}>
        {oa.pageNav.toFirstPage}
      </Button>
    </p>
  ) : (
    <EmptyState
      size="sm"
      live
      icon={<Icon name="search_off" size={40} />}
      title={oa.queue.empty}
      description={oa.queue.emptyHint}
    />
  );

  return (
    <>
      <InspectionHubCounts
        inspectionTypeCode="IQC"
        statuses={QUEUE_STATUSES}
        active={filters.statusCode}
        onChange={applyStatus}
        plantId={plantId}
      />
      <SplitOrientationToggle orientation={layout.orientation} onChange={layout.change} />
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

      <section ref={aboveRef} className="pane iqc-inspection-panes iqc-inspection-search">
        {plants.length > 1 && (
          <div className="field-cell parts-iqc-plant">
            <span className="field-label" id="parts-iqc-plant">
              {t.plant}
            </span>
            <Select
              aria-labelledby="parts-iqc-plant"
              value={String(plantId)}
              options={plants.map((plant) => ({
                value: String(plant.plantId),
                label: `${plant.plantCode} · ${plant.plantName}`,
              }))}
              onChange={(value) => changePlant(Number(value))}
            />
          </div>
        )}
        <LotScan inspectionTypeCode="IQC" onFound={select} />
        <QueueFilterBar
          appliedFilters={filters}
          onSearch={(next) =>
            applyFilters(withDraft(filters, { ...next, pendingOnly: filters.pendingOnly }))
          }
          onTogglePendingOnly={(next) =>
            applyFilters(withDraft(filters, { ...filters, pendingOnly: next }))
          }
          onReset={() => applyFilters(EMPTY_FILTERS)}
        />
      </section>

      <div
        ref={splitRef}
        className={`po-board-split inspection-split${layout.orientation === 'column' ? ' is-stacked' : ''}`}
        style={{ ...split.style, ...layout.style }}
      >
        <section
          className="pane iqc-inspection-panes iqc-inspection-queue-pane"
          aria-label={oa.queue.heading}
        >
          {queue.isError && (
            <QueueLoadErrorBanner
              error={toApiError(queue.error)}
              onRetry={() => void queue.refetch()}
            />
          )}
          <QueueTable
            scrollX
            rows={rows}
            itemNames={itemNames}
            lotNumbers={lotNumbers}
            suppliers={lotSuppliers}
            selectedId={selectedId}
            onSelect={select}
            empty={emptyContent}
          />
          {queue.data !== undefined && (
            <PageNav
              meta={queue.data.page}
              sizes={LIST_PAGE_SIZES}
              controlSize="md"
              onChangePage={goToPage}
              onChangeSize={(next) => setSearchParams(toPageSizeParams(searchParams, next))}
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

        <section
          className="pane iqc-inspection-panes iqc-inspection-detail parts-iqc-detail"
          aria-label={t.dialog.title}
        >
          {selectedId === null ? (
            <EmptyState
              size="sm"
              title={hubText.pickRequest}
              description={hubText.pickRequestHint}
            />
          ) : (
            <InspectionDetail
              inspectionRequestId={selectedId}
              onClose={() => moveTo(null)}
              onDirtyChange={onDirtyChange}
              onSubmitted={() => {
                setDirty(false);
                openRequest(null);
                toast.show({ variant: 'success', description: t.footer.submitted });
              }}
            />
          )}
        </section>
      </div>

      {leaveTo !== null && (
        <Dialog
          open
          size="sm"
          showCloseButton={false}
          title={t.dialog.title}
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
          <p>{t.dialog.discardConfirm}</p>
        </Dialog>
      )}
    </>
  );
};
