import {
  AlertBanner,
  Breadcrumb,
  Button,
  Checkbox,
  Chip,
  Dialog,
  EmptyState,
  PageHeader,
  Progress,
  Skeleton,
  Table,
  type Column,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { MarkerOverlay, type OverlayMarker } from '@omf-mes/ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { SaveErrorBanner } from '../../patterns/master';
import {
  checkDrawingFile,
  DRAWING_MIME_TYPES,
  hasMarker,
  isDirty,
  placeMarker,
  removeMarker,
  toReplaceBody,
  type LayoutDraft,
} from './layout-draft';
import { LoadErrorBanner } from './load-error-banner';
import { lookupNote, useWarehouseOptions } from './lookups';
import { useDrawingContent, useLayout, useLayoutReplace, useLocations } from './queries';
import { SelectField } from './select-field';
import type { LocationView, SelectOption } from './types';
import { useDrawingReplace } from './use-drawing-replace';
import { useObjectUrl } from './use-object-url';

const t = messages.warehouseLayout;

const EMPTY_MARKERS: LayoutDraft = [];
const EMPTY_LOCATIONS: LocationView[] = [];

/** 파일 고르기 창이 미리 걸러 줄 형식 — **막지는 못한다.** 판정은 `checkDrawingFile` 과 서버다. */
const DRAWING_ACCEPT = DRAWING_MIME_TYPES.join(',');

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
 * ⭐ **도면은 고르는 즉시 반영된다.** 올리기(첨부)와 저장(배치도)이 이어서 나가고, 끝나면 새
 * 도면이 그대로 보인다 — 「올려 두고 나중에 저장」이 아니다. 그래서 ⛔ **저장하지 않은 점
 * 편집이 있으면 올리기를 막는다**: 바로 반영이면 그 점을 함께 보낼지 버릴지가 갈리는데, 어느
 * 쪽이든 사용자가 모르는 사이에 일어난다. 사유를 적고 막는 편이 낫다.
 *
 * ⭐ **두 호출이 도는 동안을 화면이 말한다.** 누른 자리(버튼)와 결과가 나타날 자리(판)에서
 * 각각 「올리는 중 → 저장하는 중」을 낸다 — 10MB 짜리 도면은 눈에 띄게 오래 걸리고, 아무 말도
 * 없으면 사용자가 같은 파일을 다시 고른다.
 *
 * **고른 창고와 위치는 주소가 소유한다** — 새로고침·공유가 같은 화면을 연다.
 */
export const WarehouseLayoutScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const warehouseParam = searchParams.get('warehouse') ?? '';
  const warehouseId = isPositiveInteger(warehouseParam) ? Number(warehouseParam) : null;

  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [draft, setDraft] = useState<LayoutDraft>(EMPTY_MARKERS);
  const [flash, setFlash] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  /** 사전 검사에서 걸린 파일의 사유. **요청을 보내기 전에** 올리기 자리에 적는다. */
  const [fileNote, setFileNote] = useState<string | null>(null);
  /** 확인을 기다리는 파일 — 있으면 확인 창이 서 있다. 취소하면 아무 요청도 나가지 않는다. */
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);

  const warehouses = useWarehouseOptions();
  const layout = useLayout(warehouseId);
  const locations = useLocations(warehouseId, includeInactive);

  const original = layout.data?.markers ?? EMPTY_MARKERS;
  const rows = locations.data ?? EMPTY_LOCATIONS;
  const drawingAttachmentId = layout.data?.drawingAttachmentId ?? null;

  /*
   * ⭐ **그림은 `<img src>` 가 아니라 계약 클라이언트로 받는다** — 내려받기도 세션 쿠키를
   * 요구해, 주소만 걸면 출처가 다를 때 그림만 조용히 빈다(`queries.ts` 머리말). 받은 덩어리를
   * 주소로 바꾸는 것과 되돌려주는 것은 `useObjectUrl` 이 맡는다.
   */
  const drawingContent = useDrawingContent(drawingAttachmentId);
  const drawingSrc = useObjectUrl(drawingContent.data);

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

  /** 도면 교체 — 올리기와 저장을 잇는 한 흐름. ⚠ 점 저장(`replace`)과 **다른 쓰기**다. */
  const drawing = useDrawingReplace({
    warehouseId,
    currentDrawingAttachmentId: drawingAttachmentId,
    refetchLayout: layout.refetch,
    onReplaced: () => {
      setFlash(t.map.drawingReplaced);
    },
  });

  const draftDirty = isDirty(draft, original);
  /** 지금 도는 단계의 말 — 버튼 글자와 가림막이 **같은 값**을 읽어 서로 어긋나지 않는다. */
  const busyLabel = drawing.phase === 'uploading' ? t.map.uploadingLabel : t.map.savingDrawingLabel;

  const selectWarehouse = (value: string): void => {
    const params = new URLSearchParams();

    if (value !== '') params.set('warehouse', value);
    setSearchParams(params);
    setFlash(null);
    setHint(null);
    setFileNote(null);
    setPendingFile(null);
    setSelectedLocation(null);
    replace.reset();
    /* ⛔ 앞 창고에서 올라간 첨부·멱등 키를 끌고 가지 않는다 — 그 첨부는 남의 창고 것이다. */
    drawing.reset();
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

  /**
   * 파일을 골랐다.
   *
   * ⭐ **입력칸을 비운다.** 비우지 않으면 같은 파일을 다시 고를 때 `change` 가 일어나지 않아,
   * 한 번 실패한 뒤 같은 파일로 다시 시도하는 길이 조용히 막힌다.
   * ⛔ **사전 검사에 걸리면 요청을 만들지 않는다** — 형식·크기는 서버까지 가 보지 않아도 안다.
   */
  const pickFile = (file: File | null, input: HTMLInputElement): void => {
    input.value = '';

    if (file === null) return;

    setFileNote(null);

    const verdict = checkDrawingFile(file);

    if (verdict === 'type') {
      setFileNote(t.map.fileTypeRejected);
      return;
    }

    if (verdict === 'size') {
      setFileNote(t.map.fileTooLarge);
      return;
    }

    /* 첫 도면은 덮어쓸 것이 없다 — 확인 없이 바로 간다(§7 · G-19 는 «교체»에 대한 규정이다). */
    if (drawingAttachmentId === null) {
      drawing.start(file);
      return;
    }

    setPendingFile(file);
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

  /**
   * 판에 그림이 없을 때 그 자리에 설 말.
   *
   * ⭐ **「도면 없음」·「받는 중」·「못 받음」을 가른다.** 셋을 한 문장으로 뭉개면
   * 사용자가 없는 도면을 기다리거나, 있는 도면을 없다고 여기고 새로 올린다. 404 도 여기
   * 「못 받았다」로 온다 — 첨부가 지워졌을 수 있고, 그것은 다시 올리면 풀린다.
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
      <PageHeader
        title={t.title}
        breadcrumb={
          <Breadcrumb
            items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
            aria-label={messages.common.shell.breadcrumb}
          />
        }
      />

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

      <section className="pane" aria-label={t.warehouse.select}>
        <div className="filter-bar">
          <SelectField
            label={t.warehouse.select}
            options={toOptions(warehouses.entries)}
            value={warehouseParam}
            /* ⛔ 도는 동안 창고를 바꾸면 결과가 엉뚱한 화면에 떨어진다 — 사유와 함께 잠근다. */
            disabled={drawing.isBusy}
            note={drawing.isBusy ? busyLabel : lookupNote(warehouses, t.warehouse.lookupFailed)}
            placeholder={t.warehouse.selectPlaceholder}
            wide
            onChange={selectWarehouse}
          />
          <div className="field-cell field-cell-unlabeled check-group">
            <Checkbox
              checked={includeInactive}
              disabled={drawing.isBusy}
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

            {/* 점 저장의 실패 — 충돌이면 다시 읽어 최신 배치 위에서 다시 정하게 한다. */}
            <SaveErrorBanner
              error={replace.error}
              onReload={() => {
                void layout.refetch();
              }}
            />

            {/*
             * 도면 «저장» 단계의 실패. ⭐ 첨부는 이미 올라가 있으므로 **다시 올리지 않고 저장만**
             * 다시 보낼 수 있다 — 다시 올리면 고아 첨부가 하나 더 생긴다.
             */}
            {drawing.errorStep === 'save' && (
              <>
                <SaveErrorBanner
                  error={drawing.error}
                  onReload={() => {
                    void layout.refetch();
                  }}
                />
                {drawing.pendingAttachmentId !== null && (
                  <div className="form-actions">
                    <Button
                      variant="outlined"
                      size="sm"
                      disabled={drawing.isBusy}
                      onClick={() => {
                        drawing.retrySave();
                      }}
                    >
                      {t.map.retrySaveDrawing}
                    </Button>
                  </div>
                )}
              </>
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
              <>
                {/* ⭐ 판을 감싼 자리 — 올리는 동안 이 위에 가림막이 선다. */}
                <div className="drawing-stage">
                  <MarkerOverlay
                    src={drawingSrc}
                    imageLabel={t.map.imageLabel}
                    markers={overlayMarkers}
                    placeholder={drawingPlaceholder}
                    readOnly={replace.isSaving || drawing.isBusy}
                    onPlace={place}
                    onSelect={(id) => {
                      setSelectedLocation(Number(id));
                      setHint(null);
                    }}
                    onMove={(id, x, y) => {
                      setDraft(placeMarker(draft, Number(id), x, y));
                    }}
                  />

                  {drawing.isBusy && (
                    /* ⭐ 화면 낭독기에도 전한다 — 「눌렀는데 아무 일도 없다」는 시각만의 문제가 아니다. */
                    <div className="drawing-busy" role="status">
                      <div className="drawing-busy-note">
                        <Progress indeterminate size="sm" label={busyLabel} />
                        <span>{busyLabel}</span>
                      </div>
                    </div>
                  )}
                </div>

                <p className="field-note">{t.map.move}</p>
                {hint !== null && <p className="field-error">{hint}</p>}

                <div className="form-actions">
                  {replace.isSaving && (
                    <p className="field-note form-actions-secondary">{t.map.saving}</p>
                  )}
                  {/*
                   * ⭐ **DS 에 파일 입력이 없다** — 숨긴 native 입력을 DS `Button` 이 부르는
                   * 조합이다(§8 · `tool-master/file-field.tsx` 와 같은 관용구). `display: none`
                   * 이 아니라 자리만 없애는 이유는 그 파일에 적어 두었다.
                   */}
                  <input
                    ref={fileInput}
                    type="file"
                    accept={DRAWING_ACCEPT}
                    className="file-input"
                    aria-label={t.map.upload}
                    /* ⛔ 버튼만 막으면 자판으로 칸에 닿는 길이 남는다 — 칸도 함께 잠근다. */
                    disabled={draftDirty || replace.isSaving || drawing.isBusy}
                    onChange={(event) => {
                      pickFile(event.target.files?.[0] ?? null, event.target);
                    }}
                  />
                  <Button
                    variant="outlined"
                    loading={drawing.isBusy}
                    /* ⛔ 저장하지 않은 점 편집 위에 도면을 갈지 않는다 — 사유는 아래에 적는다. */
                    disabled={draftDirty || replace.isSaving}
                    onClick={() => {
                      fileInput.current?.click();
                    }}
                  >
                    {drawing.isBusy ? busyLabel : t.map.upload}
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={
                      drawing.isBusy ||
                      selectedLocation === null ||
                      !hasMarker(draft, selectedLocation)
                    }
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
                    disabled={replace.isSaving || drawing.isBusy || !draftDirty}
                    onClick={() => {
                      setDraft(original);
                      setHint(null);
                    }}
                  >
                    {t.map.reset}
                  </Button>
                  <Button
                    disabled={!canSave || drawing.isBusy || !draftDirty}
                    onClick={() => {
                      /* ⛔ 도면 id 를 빼면 서버가 도면을 지운다 — 점만 고치는 저장도 싣는다. */
                      replace.write(toReplaceBody(draft, drawingAttachmentId));
                    }}
                  >
                    {t.map.save}
                  </Button>
                </div>

                {/* 올리기 자리의 말 — 사유·사전 검사·서버가 돌려준 파일 오류가 여기 모인다. */}
                {draftDirty && <p className="field-note">{t.map.uploadNeedsCleanDraft}</p>}
                {fileNote !== null && <p className="field-error">{fileNote}</p>}
                {drawing.fileError !== null && <p className="field-error">{drawing.fileError}</p>}
                {/* 올리기 «단계»의 실패(413·403 등) — 저장 배너와 자리를 가른다. */}
                {drawing.errorStep === 'upload' && <SaveErrorBanner error={drawing.error} />}
              </>
            )}
          </section>
        </div>
      )}

      {/*
       * ⚠ **이미 도면이 있을 때만 선다.** 점은 비율이라 새 도면에서도 같은 상대 위치에 남지만,
       * 그 자리가 새 도면의 실제 자리와 맞는지는 사람만 안다(§7 · G-19).
       */}
      {pendingFile !== null && (
        <Dialog
          open
          size="sm"
          title={t.map.replaceDrawingTitle}
          onClose={() => {
            setPendingFile(null);
          }}
          footer={
            <>
              <Button
                variant="outlined"
                onClick={() => {
                  setPendingFile(null);
                }}
              >
                {t.map.cancel}
              </Button>
              <Button
                onClick={() => {
                  setPendingFile(null);
                  drawing.start(pendingFile);
                }}
              >
                {t.map.confirm}
              </Button>
            </>
          }
        >
          <p className="dialog-lead">{t.map.replaceDrawingLead(original.length)}</p>
        </Dialog>
      )}
    </>
  );
};
