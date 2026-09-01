import {
  AlertBanner,
  Breadcrumb,
  Button,
  Checkbox,
  Chip,
  EmptyState,
  PageHeader,
  Skeleton,
  Table,
  type Column,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { MarkerOverlay, type OverlayMarker } from '@omf-mes/ui';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner } from '../../patterns/master';
import {
  hasMarker,
  isDirty,
  placeMarker,
  removeMarker,
  toReplaceBody,
  type LayoutDraft,
} from './layout-draft';
import { LoadErrorBanner } from './load-error-banner';
import { lookupNote, useWarehouseOptions } from './lookups';
import { drawingUrl, useLayout, useLayoutReplace, useLocations } from './queries';
import { SelectField } from './select-field';
import type { LocationView, SelectOption } from './types';

const t = messages.warehouseLayout;

const EMPTY_MARKERS: LayoutDraft = [];
const EMPTY_LOCATIONS: LocationView[] = [];

const isPositiveInteger = (value: string): boolean => /^\d+$/.test(value) && Number(value) > 0;

/**
 * W-CO-08 컨테이너 — 도면 위에 위치를 찍어 둔다.
 *
 * ⭐ **좌표는 픽셀이 아니라 «비율»이다.** 도면을 갈거나 창을 줄여도 같은 상대 위치를 가리킨다 —
 * 픽셀로 두면 창을 줄이는 것만으로 점이 전부 어긋나고, 그 어긋남은 화면에서 보이지 않는다.
 *
 * ⭐ **저장은 도면과 점을 통째로 바꾼다.** 보내는 것은 「이 창고의 배치 전체」이고 **지도에서 뺀
 * 위치는 지워진다** — 그래서 잠금 토큰을 배치도 조회에서 받아 「내가 본 배치 위에 적는다」를
 * 지킨다.
 *
 * ⛔ **도면 올리기를 이번에 열지 않았다.** 첨부를 어떤 대상 유형으로 붙일지가 아직 정해지지
 * 않았다 — 값을 지어내면 서버가 거부하거나, 더 나쁘게는 엉뚱한 대상에 붙는다. 감추지 않고
 * 비활성으로 두고 사유를 적는다.
 *
 * **고른 창고와 위치는 주소가 소유한다** — 새로고침·공유가 같은 화면을 연다.
 */
export const WarehouseLayoutScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { baseUrl } = useApiClient();

  const warehouseParam = searchParams.get('warehouse') ?? '';
  const warehouseId = isPositiveInteger(warehouseParam) ? Number(warehouseParam) : null;

  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [draft, setDraft] = useState<LayoutDraft>(EMPTY_MARKERS);
  const [flash, setFlash] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const warehouses = useWarehouseOptions();
  const layout = useLayout(warehouseId);
  const locations = useLocations(warehouseId, includeInactive);

  const original = layout.data?.markers ?? EMPTY_MARKERS;
  const rows = locations.data ?? EMPTY_LOCATIONS;

  /* 서버가 준 배치가 새로 오면 편집 상태를 그것으로 되돌린다. */
  useEffect(() => {
    setDraft(original);
    setSelectedLocation(null);
    setHint(null);
  }, [original]);

  const replace = useLayoutReplace(warehouseId, () => {
    setFlash(t.map.saved);
    /* 저장한 배치를 다시 읽는다 — 새 잠금 토큰이 그 조회에 실려 온다. */
    void layout.refetch();
  });

  const selectWarehouse = (value: string): void => {
    const params = new URLSearchParams();

    if (value !== '') params.set('warehouse', value);
    setSearchParams(params);
    setFlash(null);
    setHint(null);
    setSelectedLocation(null);
    replace.reset();
  };

  const nameOf = (locationId: number): string => {
    const found = rows.find((row) => row.locationId === locationId);

    return found === undefined ? t.locations.unknown(locationId) : found.locationCode;
  };

  /** ⚠ 목록에서 이름을 찾지 못한 표식이 있는가 — 중지·삭제된 위치일 수 있다. */
  const hasOrphan =
    !locations.isPending &&
    draft.some((marker) => !rows.some((row) => row.locationId === marker.locationId));

  const overlayMarkers: OverlayMarker[] = draft.map((marker) => ({
    id: String(marker.locationId),
    x: marker.x,
    y: marker.y,
    label: nameOf(marker.locationId),
    selected: marker.locationId === selectedLocation,
  }));

  const place = (x: number, y: number): void => {
    if (selectedLocation === null) {
      setHint(t.map.placeNeedsLocation);
      return;
    }

    setHint(null);
    setDraft(placeMarker(draft, selectedLocation, x, y));
  };

  const columns: Column<LocationView>[] = [
    {
      key: 'code',
      header: t.locations.code,
      render: (row) => (
        <Button
          variant="text"
          size="sm"
          onClick={() => {
            setSelectedLocation(row.locationId);
            setHint(null);
          }}
        >
          {row.locationCode}
        </Button>
      ),
    },
    { key: 'name', header: t.locations.name, render: (row) => row.locationName },
    {
      key: 'placed',
      header: t.locations.placed,
      render: (row) =>
        hasMarker(draft, row.locationId) ? (
          <Chip size="sm" status="success">
            {t.locations.onMap}
          </Chip>
        ) : (
          <Chip size="sm">{t.locations.notOnMap}</Chip>
        ),
    },
  ];

  const toOptions = (entries: { value: string; label: string }[]): SelectOption[] =>
    entries.map((entry) => ({ value: entry.value, label: entry.label }));

  const canSave = warehouseId !== null && !layout.isPending && !layout.isError && !replace.isSaving;

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {flash !== null && (
        <div className="banner-slot">
          <AlertBanner
            variant="success"
            onDismiss={() => {
              setFlash(null);
            }}
          >
            {flash}
          </AlertBanner>
        </div>
      )}

      <section className="pane" aria-label={t.warehouse.select}>
        <div className="filter-bar">
          <SelectField
            label={t.warehouse.select}
            options={toOptions(warehouses.entries)}
            value={warehouseParam}
            note={lookupNote(warehouses, t.warehouse.lookupFailed)}
            placeholder={t.warehouse.selectPlaceholder}
            wide
            onChange={selectWarehouse}
          />
          <div className="field-cell field-cell-unlabeled check-group">
            <Checkbox
              checked={includeInactive}
              onChange={(event) => {
                setIncludeInactive(event.target.checked);
              }}
            >
              {t.locations.includeInactive}
            </Checkbox>
          </div>
        </div>
        {/* ⭐ 잠금 토큰이 이 조회에서 온다 — 실패하면 저장을 보낼 수 없다. */}
        {layout.isError && <p className="pane-lead">{t.map.lockFailed}</p>}
        {warehouseId !== null && layout.isPending && (
          <p className="pane-lead">{t.map.lockLoading}</p>
        )}
      </section>

      {warehouseId === null ? (
        <section className="pane" aria-label={t.panes.map}>
          <EmptyState size="sm" title={t.warehouse.emptyTitle} description={t.warehouse.empty} />
        </section>
      ) : (
        <div className="two-pane">
          <section className="pane" aria-label={t.panes.locations}>
            <h2>{t.panes.locations}</h2>
            <p className="pane-lead">{t.map.placeHint}</p>

            {locations.isError ? (
              <LoadErrorBanner
                error={locations.error}
                onRetry={() => {
                  void locations.refetch();
                }}
              />
            ) : locations.isPending ? (
              <Skeleton variant="rect" height="12rem" />
            ) : (
              <div className="wide-table">
                <Table
                  columns={columns}
                  rows={rows}
                  getRowId={(row) => String(row.locationId)}
                  density="compact"
                  empty={
                    <EmptyState
                      size="sm"
                      live
                      title={t.locations.emptyTitle}
                      description={t.locations.empty}
                    />
                  }
                />
              </div>
            )}
            {/* ⚠ 이름을 못 찾은 표식이 있으면 그 사실을 적는다 — 코드만 보이는 이유다. */}
            {hasOrphan && <p className="field-note">{t.locations.orphanNote}</p>}
          </section>

          <section className="pane" aria-label={t.panes.map}>
            <h2>{t.panes.map}</h2>
            {/* ⭐ 비율이라는 사실과 통째로 바뀐다는 사실을 판 위에 먼저 적는다. */}
            <p className="pane-lead">{t.map.ratioNote}</p>
            <p className="pane-lead">{t.map.replaceNote}</p>

            <SaveErrorBanner error={replace.error} />

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
              <>
                <MarkerOverlay
                  src={
                    layout.data?.drawingAttachmentId == null
                      ? undefined
                      : drawingUrl(baseUrl, layout.data.drawingAttachmentId)
                  }
                  imageLabel={t.map.imageLabel}
                  markers={overlayMarkers}
                  placeholder={t.map.noDrawing}
                  readOnly={replace.isSaving}
                  onPlace={place}
                  onSelect={(id) => {
                    setSelectedLocation(Number(id));
                    setHint(null);
                  }}
                  onMove={(id, x, y) => {
                    setDraft(placeMarker(draft, Number(id), x, y));
                  }}
                />

                <p className="field-note">{t.map.move}</p>
                {hint !== null && <p className="field-error">{hint}</p>}

                <div className="form-actions">
                  {replace.isSaving && (
                    <p className="field-note form-actions-secondary">{t.map.saving}</p>
                  )}
                  {/* ⛔ 도면 올리기는 아직 열 수 없다 — 감추지 않고 사유를 적는다. */}
                  <Button variant="outlined" disabled>
                    {t.map.upload}
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={selectedLocation === null || !hasMarker(draft, selectedLocation)}
                    onClick={() => {
                      if (selectedLocation === null) {
                        setHint(t.map.removeNeedsMarker);
                        return;
                      }
                      setDraft(removeMarker(draft, selectedLocation));
                    }}
                  >
                    {t.map.remove}
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={replace.isSaving || !isDirty(draft, original)}
                    onClick={() => {
                      setDraft(original);
                      setHint(null);
                    }}
                  >
                    {t.map.reset}
                  </Button>
                  <Button
                    disabled={!canSave || !isDirty(draft, original)}
                    onClick={() => {
                      replace.write(toReplaceBody(draft, layout.data?.drawingAttachmentId ?? null));
                    }}
                  >
                    {t.map.save}
                  </Button>
                </div>
                <p className="field-note">{t.map.uploadLocked}</p>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
};
