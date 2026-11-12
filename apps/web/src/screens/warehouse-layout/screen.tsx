import { AlertBanner, Button, Checkbox, Chip, EmptyState, Skeleton } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { MarkerOverlay, type OverlayMarker } from '@omf-mes/ui';
import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { BoardFrame } from '../../patterns/board-frame';
import { initialExpandedLocationIds } from '../../patterns/location-tree';
import { useSession } from '../../patterns/session';
import { Select } from '../../patterns/select';
import {
  defaultWarehouseFilters,
  useWarehouseFilterOptions,
  WarehouseFilterBar,
  type WarehouseFilters,
} from '../../patterns/warehouse-filter-bar';
import { hasMarker, type LayoutDraft } from './layout-draft';
import { LayoutEditorDialog } from './layout-editor-dialog';
import { LoadErrorBanner } from './load-error-banner';
import { LocationList } from './location-list';
import { useUomOptions } from '../stock-status/lookups';
import { lookupNote, useWarehouseOptions } from './lookups';
import { buildLocationStock } from './location-stock';
import { highlightTarget, splitPlaceable, useKnownLocations } from './placeable';
import {
  useDrawingContent,
  useLayout,
  useLocations,
  useLocationStock,
  useQualityStatusNames,
} from './queries';
import { StockTable } from './stock-table';
import type { LocationView, SelectOption } from './types';
import { useObjectUrl } from './use-object-url';

const t = messages.warehouseLayout;

const EMPTY_MARKERS: LayoutDraft = [];
const EMPTY_LOCATIONS: LocationView[] = [];
const NO_EXPANDED_IDS: ReadonlySet<number> = new Set();

/** 배치도를 고치는 권한 — 화면 권한 그대로다(R-9). 권한이 나뉘면 이 한 줄만 바꾼다. */
const EDIT_PERMISSION = 'W-CO-08';

const isPositiveInteger = (value: string): boolean => /^\d+$/.test(value) && Number(value) > 0;

/**
 * W-CO-08 컨테이너 — 창고 배치도를 **조회**한다(피처 006 · FR-001~FR-003 · FR-012).
 *
 * ⭐ **이 화면에서는 배치가 바뀌지 않는다.** 판은 읽기 전용이라 누르면 고르기만 되고(표식을 끌어도 옮겨지지 않는다), 편집
 * 단추 · 크기 칸 · 파일 입력이 없다. 배치는 [수정]이 여는 편집 창(`layout-editor-dialog.tsx`)에서만 바꾼다 — 상태를
 * 보다가 실수로 배치를 바꾸지 않게(R-1).
 *
 * ⭐ **좌표는 픽셀이 아니라 «비율»이다.** 도면을 갈거나 창을 줄여도 같은 상대 위치를 가리킨다.
 *
 * ⭐ **도면에는 구역 · 랙만 그린다**(2차 · FR-015 · FR-016). 층 · 셀을 고르면 그 위치가 든 랙(없으면 구역) 표식을 강조하고,
 * 재고 표는 고른 위치 기준 그대로다. 목록 「도면」 칸은 구역 · 랙 줄에만 찍음/아직을 보인다.
 *
 * ⭐ **편집 창이 열린 동안 창고 선택은 바뀌지 않는다**(명세 예외 6) — 창고 칸 · 「중지된 위치도 보기」를 잠근다.
 *
 * **고른 창고는 주소가 소유한다** — 새로고침 · 공유가 같은 화면을 연다.
 */
export const WarehouseLayoutScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { session } = useSession();
  /* 세션을 아직 모르면 서버가 막는다 — 단추는 세운다(입고 일정 화면과 같은 관용구). */
  const canEdit =
    session?.permissions === undefined || session.permissions.includes(EDIT_PERMISSION);

  const warehouseParam = searchParams.get('warehouse') ?? '';
  const warehouseId = isPositiveInteger(warehouseParam) ? Number(warehouseParam) : null;

  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const warehouseNoteId = useId();

  /* 창고 조회 조건 — 창고·Location 과 같은 조건 상자(사용자 지시 2026-10-30). 화면을 떠나면 처음 값으로 돌아간다. */
  const [filters, setFilters] = useState<WarehouseFilters>(defaultWarehouseFilters);
  const filterOptions = useWarehouseFilterOptions(filters);
  const warehouses = useWarehouseOptions(filters);
  /*
   * 고른 창고가 조건에 걸러져 빠져도 선택칸이 비지 않게 — 한 번 본 창고의 이름을 기억해 두고 선택지 끝에 남긴다.
   */
  const seenWarehouseLabels = useRef(new Map<string, string>());
  for (const entry of warehouses.entries) seenWarehouseLabels.current.set(entry.value, entry.label);
  const layout = useLayout(warehouseId);
  const locations = useLocations(warehouseId, includeInactive);

  const serverMarkers = layout.data?.markers ?? EMPTY_MARKERS;
  const rows = locations.data ?? EMPTY_LOCATIONS;
  /*
   * ⭐ 도면에는 구역 · 랙만 그린다(2차 · FR-016). 이미 저장된 층 · 셀 표식은 그리지 않는다 — 편집 창의 다음 저장 때 빠진다.
   * 단계는 지금까지 본 위치로 판정한다(「중지된 위치도 보기」를 바꿔 다시 받는 동안에도 잊지 않게).
   */
  const knownLocations = useKnownLocations(warehouseId, rows);
  const markers = useMemo(
    () => splitPlaceable(serverMarkers, knownLocations).kept,
    [serverMarkers, knownLocations],
  );
  /** 판에서 강조할 표식 — 고른 위치가 배치돼 있지 않으면(층 · 셀) 가장 가까운 배치된 조상(R2-3). */
  const highlighted = highlightTarget(selectedLocation, markers, knownLocations);

  /*
   * 재고 — 창고 단위로 한 번 받아 위치별로 나눈다(피처 006 R-7). ⛔ 못 받았으면 표식 모양을 나누지 않는다 — 「비어 있음」으로
   * 그리면 모르는 것을 없다고 말하게 된다(명세 가정).
   */
  const stock = useLocationStock(warehouseId);
  const uomLookup = useUomOptions();
  const qualityStatusName = useQualityStatusNames();
  const stockData = stock.data;
  const locationStock = useMemo(
    () =>
      stockData === undefined
        ? null
        : buildLocationStock(stockData.items, rows, stockData.truncated),
    [stockData, rows],
  );
  const shownStock = stock.isError ? null : locationStock;

  /*
   * 위치 목록은 창고·Location 의 Location 목록과 같은 계층이다(사용자 지시 2026-10-30) — 처음엔 구역만 펼쳐 랙까지
   * 보이고, 창고가 바뀌면 다시 정한다. 「중지된 위치도 보기」를 켜고 꺼도 사용자가 펼친 것은 지킨다.
   */
  const [expansion, setExpansion] = useState<{
    warehouseId: number;
    ids: ReadonlySet<number>;
  } | null>(null);

  if (
    locations.data !== undefined &&
    warehouseId !== null &&
    expansion?.warehouseId !== warehouseId
  ) {
    setExpansion({ warehouseId, ids: initialExpandedLocationIds(locations.data) });
  }

  const expandedIds = expansion?.ids ?? NO_EXPANDED_IDS;
  const drawingAttachmentId = layout.data?.drawingAttachmentId ?? null;

  /*
   * ⭐ **그림은 `<img src>` 가 아니라 계약 클라이언트로 받는다** — 내려받기도 세션 쿠키를
   * 요구해, 주소만 걸면 출처가 다를 때 그림만 조용히 빈다(`queries.ts` 머리말). 받은 덩어리를
   * 주소로 바꾸는 것과 되돌려주는 것은 `useObjectUrl` 이 맡는다.
   */
  const drawingContent = useDrawingContent(drawingAttachmentId);
  const drawingSrc = useObjectUrl(drawingContent.data);

  const selectWarehouse = (value: string): void => {
    const params = new URLSearchParams();

    if (value !== '') params.set('warehouse', value);
    setSearchParams(params);
    setFlash(null);
    setSelectedLocation(null);
  };

  const nameOf = (locationId: number): string => {
    const found = rows.find((row) => row.locationId === locationId);

    return found === undefined ? t.locations.unknown(locationId) : found.locationCode;
  };

  const overlayMarkers: OverlayMarker[] = markers.map((marker) => ({
    id: String(marker.locationId),
    x: marker.x,
    y: marker.y,
    label: nameOf(marker.locationId),
    selected: marker.locationId === highlighted,
    width: marker.width,
    height: marker.height,
    rotation: marker.rotation,
    /* 재고 있음 = 지금 모양, 비어 있음 = 옅은 모양(FR-011 · R-6). */
    ...(shownStock === null
      ? {}
      : {
          tone: shownStock.stockedLocationIds.has(marker.locationId)
            ? ('default' as const)
            : ('muted' as const),
        }),
  }));

  const pickLocation = (locationId: number): void => {
    setSelectedLocation(locationId);
  };

  /** 창고 칸 밑의 한 줄 — 목록의 한계(불러오기 실패 · 잘림). */
  const warehouseNote = lookupNote(warehouses, t.warehouse.lookupFailed);

  const toOptions = (entries: { value: string; label: string }[]): SelectOption[] => {
    const options = entries.map((entry) => ({ value: entry.value, label: entry.label }));
    const keptLabel = seenWarehouseLabels.current.get(warehouseParam);

    return warehouseParam === '' ||
      keptLabel === undefined ||
      options.some((option) => option.value === warehouseParam)
      ? options
      : [...options, { value: warehouseParam, label: keptLabel }];
  };

  const warehouseLabel = seenWarehouseLabels.current.get(warehouseParam) ?? warehouseParam;

  /**
   * 판에 그림이 없을 때 그 자리에 설 말 — 「도면 없음」 · 「받는 중」 · 「못 받음」을 가른다. 404 도 「못 받았다」로 온다 —
   * 첨부가 지워졌을 수 있고, 그것은 편집 창에서 다시 올리면 풀린다.
   */
  const drawingPlaceholder: ReactNode =
    drawingAttachmentId === null ? (
      t.map.noDrawing
    ) : drawingContent.isError ? (
      <span>
        {t.map.drawingLoadFailed}{' '}
        <Button
          variant="outlined"
          size="sm"
          onClick={() => {
            void drawingContent.refetch();
          }}
        >
          {t.map.drawingRetry}
        </Button>
      </span>
    ) : (
      t.map.drawingLoading
    );

  return (
    <>
      <BoardFrame
        splitKey="omf-mes:warehouse-layout:split"
        initialRatio={0.45}
        splitter={{ label: t.splitter, collapseLabel: t.listCollapse, expandLabel: t.listExpand }}
        list={{
          label: t.panes.locations,
          content:
            (
              /*
               * 창고·Location 과 같은 짜임(사용자 지시 2026-10-30) — 조회 조건은 왼쪽 구획 위에 좁게, 그 아래 위치 계층이
               * 늘 보인다. 표는 구획의 바로 아래 자식이라 남은 높이에서 스크롤한다.
               */
              <>
                <WarehouseFilterBar
                  appliedFilters={filters}
                  onApplyFilters={setFilters}
                  plantOptions={filterOptions.plantOptions}
                  warehouseTypeOptions={filterOptions.warehouseTypeOptions}
                />
                {/* 걸러진 창고 가운데 하나를 고르면 그 아래 위치 계층이 늘 보인다. */}
                <div className="warehouse-location-filter">
                  <div className="warehouse-location-filter-row">
                    <Select
                      aria-label={t.warehouse.select}
                      aria-describedby={warehouseNote === undefined ? undefined : warehouseNoteId}
                      options={toOptions(warehouses.entries)}
                      value={warehouseParam === '' ? null : warehouseParam}
                      placeholder={t.warehouse.selectPlaceholder}
                      /* ⛔ 편집 창이 열린 동안 창고를 바꾸지 않는다(명세 예외 6). */
                      disabled={editing}
                      onChange={selectWarehouse}
                    />
                    <Checkbox
                      checked={includeInactive}
                      disabled={editing}
                      onChange={(event) => {
                        setIncludeInactive(event.target.checked);
                      }}
                    >
                      {t.locations.includeInactive}
                    </Checkbox>
                  </div>
                  {warehouseNote !== undefined && (
                    <span id={warehouseNoteId} className="field-note">
                      {warehouseNote}
                    </span>
                  )}
                </div>

                {warehouseId === null ? (
                  <EmptyState size="sm" title={t.warehouse.emptyTitle} />
                ) : locations.isError ? (
                  <LoadErrorBanner
                    error={locations.error}
                    onRetry={() => {
                      void locations.refetch();
                    }}
                  />
                ) : locations.isPending ? (
                  <Skeleton variant="rect" height="12rem" />
                ) : (
                  <LocationList
                    locations={rows}
                    isPlaced={(locationId) => hasMarker(markers, locationId)}
                    selectedLocationId={selectedLocation}
                    onPick={pickLocation}
                    expandedIds={expandedIds}
                    onExpandedChange={(ids) => {
                      setExpansion((prev) => (prev === null ? prev : { ...prev, ids }));
                    }}
                    /* ⛔ 위치는 이 화면에서 만들지 않는다 — 등록하는 화면을 알린다(FR-012). */
                    empty={
                      <EmptyState
                        size="sm"
                        live
                        title={t.locations.emptyTitle}
                        description={t.locations.emptyGuide(messages.warehouseLocation.title)}
                      />
                    }
                  />
                )}
              </>
            ),
        }}
        detail={{
          label: t.panes.map,
          content:
            warehouseId === null ? null : (
              <>
                {/* 제목과 [수정] — 고치는 일은 편집 창에서만 한다(FR-003 · R-9). */}
                <div className="pane-heading-row">
                  <h2 className="pane-title">{t.panes.map}</h2>
                  {canEdit && (
                    <Button
                      variant="outlined"
                      disabled={layout.isPending || layout.isError}
                      onClick={() => {
                        setFlash(null);
                        setEditing(true);
                      }}
                    >
                      {t.editor.open}
                    </Button>
                  )}
                </div>
                {flash !== null && (
                  <div className="banner-slot">
                    <AlertBanner
                      variant="success"
                      onDismiss={() => {
                        setFlash(null);
                      }}
                      dismissLabel={messages.common.close}
                    >
                      {flash}
                    </AlertBanner>
                  </div>
                )}

                {layout.isError ? (
                  <LoadErrorBanner
                    error={layout.error}
                    onRetry={() => {
                      void layout.refetch();
                    }}
                  />
                ) : layout.isPending ? (
                  <Skeleton variant="rect" height="16rem" />
                ) : (
                  <div className="drawing-stage">
                    {/* ⛔ 놓기 · 옮기기 · 크기 처리기를 주지 않는다 — 판을 누르면 고르기만 된다(FR-001). */}
                    <MarkerOverlay
                      src={drawingSrc}
                      imageLabel={t.map.imageLabel}
                      markers={overlayMarkers}
                      placeholder={drawingPlaceholder}
                      readOnly
                      onSelect={(id) => {
                        pickLocation(Number(id));
                      }}
                      /* ⭐ 낭독 문구는 화면이 준다 — 판 부품은 표현 전용이라 사람의 말을 갖지 않는다. */
                      describePosition={t.map.markerPosition}
                      describeMove={t.map.markerMoved}
                    />
                  </div>
                )}

                {/* 판 아래 — 범례, 재고 받기 실패 · 잘림(FR-011). */}
                {stock.isError ? (
                  <div className="banner-slot">
                    <AlertBanner
                      variant="error"
                      action={
                        <Button
                          variant="outlined"
                          size="sm"
                          onClick={() => {
                            void stock.refetch();
                          }}
                        >
                          {t.stock.retry}
                        </Button>
                      }
                    >
                      {t.stock.loadFailed}
                    </AlertBanner>
                  </div>
                ) : (
                  shownStock !== null && (
                    <p className="layout-stock-legend">
                      <span className="layout-stock-legend-stocked">{t.stock.legendStocked}</span>
                      <span className="layout-stock-legend-empty">{t.stock.legendEmpty}</span>
                      <span className="field-note">{t.stock.legendNote}</span>
                    </p>
                  )
                )}
                {shownStock?.truncated === true && (
                  <p className="field-note">{t.stock.truncated}</p>
                )}

                {/* 고른 위치의 재고 — 하위 위치는 위치별 줄(FR-013). 안 찍은 위치면 「도면에 없음」(FR-002). */}
                {selectedLocation === null ? (
                  shownStock !== null && <p className="field-note">{t.stock.pickHint}</p>
                ) : (
                  <>
                    <h3 className="layout-selection-title">
                      {t.stock.title(nameOf(selectedLocation))}
                      {/* 층 · 셀이면 그 위치가 든 표식을 말한다(R2-3). 그것도 없으면 「도면에 없음」. */}
                      {!hasMarker(markers, selectedLocation) && (
                        <Chip size="sm">
                          {highlighted === null
                            ? t.locations.notOnDrawing
                            : t.locations.insideOnDrawing(nameOf(highlighted))}
                        </Chip>
                      )}
                    </h3>
                    {shownStock !== null &&
                      (shownStock.rowsFor(selectedLocation).length === 0 ? (
                        <EmptyState size="sm" title={t.stock.empty} />
                      ) : (
                        <StockTable
                          label={t.stock.title(nameOf(selectedLocation))}
                          rows={shownStock.rowsFor(selectedLocation)}
                          uomLookup={uomLookup}
                          qualityStatusName={qualityStatusName}
                        />
                      ))}
                  </>
                )}
              </>
            ),
        }}
      />

      {editing && warehouseId !== null && (
        <LayoutEditorDialog
          warehouseId={warehouseId}
          warehouseLabel={warehouseLabel}
          initialIncludeInactive={includeInactive}
          initialExpandedIds={expandedIds}
          onClose={() => {
            setEditing(false);
          }}
          onSaved={() => {
            setEditing(false);
            setFlash(t.map.saved);
            /* 배치는 편집 창이 다시 읽는다 — 재고도 다시 읽는다(명세 가정: 저장한 시점의 값). */
            void stock.refetch();
          }}
        />
      )}
    </>
  );
};
