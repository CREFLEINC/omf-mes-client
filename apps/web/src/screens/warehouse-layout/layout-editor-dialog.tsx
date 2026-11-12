import {
  AlertBanner,
  Button,
  Checkbox,
  Dialog,
  EmptyState,
  Progress,
  Skeleton,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { MarkerOverlay, type OverlayMarker } from '@omf-mes/ui';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import { initialExpandedLocationIds } from '../../patterns/location-tree';
import { SaveErrorBanner } from '../../patterns/master';
import {
  checkDrawingFile,
  DRAWING_MIME_TYPES,
  hasMarker,
  isDirty,
  placeMarker,
  removeMarker,
  shapeMarker,
  toReplaceBody,
  type LayoutDraft,
} from './layout-draft';
import { LoadErrorBanner } from './load-error-banner';
import { LocationList } from './location-list';
import { MarkerShapeFields } from './marker-shape-fields';
import { isPlaceable, splitPlaceable, useKnownLocations } from './placeable';
import { useDrawingContent, useLayout, useLayoutReplace, useLocations } from './queries';
import type { LocationView } from './types';
import { useDrawingReplace } from './use-drawing-replace';
import { useObjectUrl } from './use-object-url';

const t = messages.warehouseLayout;

const EMPTY_MARKERS: LayoutDraft = [];
const EMPTY_LOCATIONS: LocationView[] = [];

/** 파일 고르기 창이 미리 걸러 줄 형식 — **막지는 못한다.** 판정은 `checkDrawingFile` 과 서버다. */
const DRAWING_ACCEPT = DRAWING_MIME_TYPES.join(',');

export interface LayoutEditorDialogProps {
  warehouseId: number;
  /** 제목에 쓰는 창고 이름(「코드 · 이름」). */
  warehouseLabel: string;
  /** 조회 화면의 「중지된 위치도 보기」를 이어받는다. */
  initialIncludeInactive?: boolean;
  /** 조회 화면의 펼침을 이어받는다(R-10). 없으면 처음 펼침(구역만). */
  initialExpandedIds?: ReadonlySet<number>;
  /** 창을 닫는다 — 변경이 없거나 버리기로 했다. */
  onClose: () => void;
  /** 배치를 저장했다 — 창은 닫히고 조회 화면이 알린다(FR-007). */
  onSaved: () => void;
}

/**
 * W-CO-08 편집 창 — 브라우저 창을 채우는 대화창에서 위치를 배치한다(피처 006 · FR-004~FR-009).
 *
 * ⭐ **편집 규칙은 옮기기만 했다**(R-1). 비율 좌표, 창고 단위 통째 저장 · 잠금 토큰, 도면 교체(올리기 → 저장, 저장 안 한
 * 변경이 있으면 막기, 바꿀 때 확인, 「저장 다시 시도」 · 「내 도면으로 바꾸기」)는 옛 화면(`screen.tsx`) 그대로다. 근거는
 * 각 자리의 주석에 그대로 두었다.
 *
 * ⭐ **편집 상태(`draft`)는 서버 배치가 새로 와도 내 변경을 지킨다**(R-4 · SC-005). 열 때 서버 배치로 만들고, 그 뒤에는
 * 「최신 불러오기」를 누를 때와 변경이 하나도 없을 때(도면 교체 뒤 등)만 서버 배치를 따라간다 — 창을 오가며 다시 읽은
 * 남의 배치가 내 표식을 말없이 덮지 않는다. 변경 여부(`base` 와 비교)는 닫기 확인(FR-008)의 기준이다.
 *
 * ⭐ **닫기는 한 길로 모은다**(R-3). X · ESC(DS 가 `onClose` 로 보낸다) · [취소] 가 모두 `requestClose` 를 부른다. 저장 ·
 * 도면 올리기가 도는 동안은 무시하고 X 를 숨긴다(FR-009). 변경이 있으면 「버리고 닫을까요?」를 묻는다. 창 바깥(스크림)
 * 클릭으로는 닫지 않는다 — 큰 창의 가장자리를 잘못 눌러 묻는 창이 뜨지 않게(plan 확인할 것 3).
 *
 * ⛔ **재고 모양 · 재고 표를 그리지 않는다**(FR-014) — 판에 `tone` 을 주지 않는다.
 *
 * ⭐ **도면에는 구역 · 랙만 둔다**(2차 · FR-015 · FR-016 · R2-1 · R2-2). 목록은 배치 대상만 보이고, 이미 저장된 층 · 셀 표식은
 * 서버 배치에서 걸러 낸 뒤 편집 상태를 만든다 — 원본과 편집 상태가 같이 걸러져 「변경」이 아니고(닫을 때 묻지 않음), 저장
 * 본문이 편집 상태라 다음 저장 때 자연히 빠진다. 걸러 낸 수는 판 위 띠로 알린다.
 *
 * ⭐ **창부터 띄우고 판은 다음 프레임에 붙인다**(2차 · FR-017 · R2-5). 표식 그리기 · 글자 맞추기가 끝날 때까지 판 자리에
 * 「배치를 그리는 중」이 선다 — 계산이 같은 프레임에 있으면 창도 표시도 그려지지 않는다.
 */
export const LayoutEditorDialog = ({
  warehouseId,
  warehouseLabel,
  initialIncludeInactive = false,
  initialExpandedIds,
  onClose,
  onSaved,
}: LayoutEditorDialogProps) => {
  const [includeInactive, setIncludeInactive] = useState(initialIncludeInactive);
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  /** 사전 검사에서 걸린 파일의 사유. **요청을 보내기 전에** 올리기 자리에 적는다. */
  const [fileNote, setFileNote] = useState<string | null>(null);
  /** 확인을 기다리는 파일 — 있으면 확인 창이 서 있다. 취소하면 아무 요청도 나가지 않는다. */
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  /** 「변경을 버리고 닫을까요?」 확인 창이 서 있다. */
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);

  /* 질의는 조회 화면과 같은 키다 — 이미 받은 배치 · 위치 · 그림을 다시 받지 않는다(R-1). */
  const layout = useLayout(warehouseId, false);
  const locations = useLocations(warehouseId, includeInactive);
  const serverMarkers = layout.data?.markers ?? EMPTY_MARKERS;
  const rows = locations.data ?? EMPTY_LOCATIONS;
  /* 단계를 아는 위치 — 「중지된 위치도 보기」를 바꿔 다시 받는 동안에도 잊지 않는다. */
  const knownLocations = useKnownLocations(warehouseId, rows);
  /* 서버 배치에서 층 · 셀 표식을 걷어 낸 것이 편집의 원본이다(R2-2). 걷을 것이 없으면 서버 배치 그대로(같은 배열). */
  const placeable = useMemo(
    () => splitPlaceable(serverMarkers, knownLocations),
    [serverMarkers, knownLocations],
  );
  const original = placeable.kept;
  const placeableRows = useMemo(() => rows.filter(isPlaceable), [rows]);

  /** 판을 붙였는가 — 창 틀 · 목록을 먼저 그리고 다음 프레임에 붙인다(R2-5). */
  const [boardMounted, setBoardMounted] = useState(false);
  /** 판의 이름 글자 맞추기가 끝났는가 — 그때까지 「배치를 그리는 중」. */
  const [labelsFitted, setLabelsFitted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setBoardMounted(true);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);

  /** 편집 상태와 그것을 만든 서버 배치. 둘이 다르면 저장하지 않은 변경이 있다. */
  const [base, setBase] = useState<LayoutDraft>(original);
  const [draft, setDraft] = useState<LayoutDraft>(original);
  const [seenOriginal, setSeenOriginal] = useState<LayoutDraft>(original);
  const draftDirty = isDirty(draft, base);

  const resync = (markers: LayoutDraft): void => {
    setBase(markers);
    setDraft(markers);
    setSeenOriginal(markers);
    setSelectedLocation(null);
    setHint(null);
  };

  /* 서버 배치가 새로 왔다 — 변경이 없을 때만 따라간다(R-4). 변경이 있으면 「최신 불러오기」를 기다린다. */
  if (seenOriginal !== original) {
    if (draftDirty) {
      setSeenOriginal(original);
    } else {
      resync(original);
    }
  }

  const [expandedIds, setExpandedIds] = useState<ReadonlySet<number> | null>(
    initialExpandedIds ?? null,
  );

  if (expandedIds === null && locations.data !== undefined) {
    setExpandedIds(initialExpandedLocationIds(locations.data));
  }

  const drawingAttachmentId = layout.data?.drawingAttachmentId ?? null;
  const drawingContent = useDrawingContent(drawingAttachmentId);
  const drawingSrc = useObjectUrl(drawingContent.data);
  const drawingAspect = useImageAspect(drawingSrc);

  const replace = useLayoutReplace(warehouseId, () => {
    /* 보낸 배치가 이제 서버 배치다 — 변경 없음으로 둔다. 저장할 때의 `draft` 를 쓴다(쓰기와 함께 실려 간 닫힘). */
    setBase(draft);
    /* 저장한 배치를 다시 읽는다 — 새 잠금 토큰이 그 조회에 실려 온다. 창은 닫고 조회 화면이 알린다(FR-007). */
    void layout.refetch();
    onSaved();
  });

  /** 도면 교체 — 올리기와 저장을 잇는 한 흐름. ⚠ 점 저장(`replace`)과 **다른 쓰기**다. 창은 닫지 않는다(R-4). */
  const drawing = useDrawingReplace({
    warehouseId,
    currentDrawingAttachmentId: drawingAttachmentId,
    refetchLayout: layout.refetch,
    onReplaced: () => {
      setFlash(t.map.drawingReplaced);
    },
  });

  const busy = replace.isSaving || drawing.isBusy;
  /** 지금 도는 단계의 말 — 버튼 글자와 가림막이 **같은 값**을 읽어 서로 어긋나지 않는다. */
  const busyLabel = drawing.phase === 'uploading' ? t.map.uploadingLabel : t.map.savingDrawingLabel;

  /**
   * ⛔ **충돌로 멈춘 뒤의 그 버튼은 「방금 실패한 저장을 다시」가 아니다.** 409 뒤 재조회가 이미 남이 올린 새 도면을 화면에
   * 세워 두었으므로, 그대로 다시 보내면 지금 보이는 그 도면을 내 도면으로 **덮는다.** 충돌이 아닌 저장 실패(통신 끊김 ·
   * 5xx)는 덮을 새 도면이 없다 — 그쪽은 그대로 「다시 시도」다.
   */
  const drawingOverwrites =
    drawing.error?.kind === 'conflict' && drawing.pendingAttachmentId !== null;

  /** 「최신 불러오기」 — 내 변경을 버리고 서버의 최신 배치 위에서 다시 시작한다(SC-005). */
  const reloadLatest = (): void => {
    void layout.refetch().then((result) => {
      if (result.isSuccess) resync(result.data.markers);
    });
  };

  /** 닫기 요청 — X · ESC · [취소] 가 모두 여기로 온다(R-3). */
  const requestClose = (): void => {
    if (busy) return;
    if (draftDirty) {
      setConfirmingDiscard(true);
      return;
    }
    onClose();
  };

  const nameOf = (locationId: number): string => {
    const found = rows.find((row) => row.locationId === locationId);

    return found === undefined ? t.locations.unknown(locationId) : found.locationCode;
  };

  const overlayMarkers: OverlayMarker[] = draft.map((marker) => ({
    id: String(marker.locationId),
    x: marker.x,
    y: marker.y,
    label: nameOf(marker.locationId),
    selected: marker.locationId === selectedLocation,
    width: marker.width,
    height: marker.height,
    rotation: marker.rotation,
  }));

  /** 고른 위치의 표식 — 있으면 크기 · 회전 칸이 보인다. */
  const selectedMarker =
    selectedLocation === null
      ? undefined
      : draft.find((marker) => marker.locationId === selectedLocation);

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
   * ⭐ **입력칸을 비운다.** 비우지 않으면 같은 파일을 다시 고를 때 `change` 가 일어나지 않아, 한 번 실패한 뒤 같은 파일로
   * 다시 시도하는 길이 조용히 막힌다.
   * ⛔ **사전 검사에 걸리면 요청을 만들지 않는다** — 형식 · 크기는 서버까지 가 보지 않아도 안다.
   * ⛔ **직전 파일의 서버 오류도 함께 지운다** — 남겨 두면 새 파일의 사유와 나란히 두 줄로 서서, 어느 쪽이 방금 고른
   * 파일의 이야기인지 알 수 없게 된다.
   */
  const pickFile = (file: File | null, input: HTMLInputElement): void => {
    input.value = '';

    if (file === null) return;

    setFileNote(null);
    drawing.clearFileError();

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

  const pickLocation = (locationId: number): void => {
    setSelectedLocation(locationId);
    setHint(null);
  };

  const canSave = !layout.isPending && !layout.isError && !replace.isSaving;

  /**
   * 판에 그림이 없을 때 그 자리에 설 말 — 「도면 없음」 · 「받는 중」 · 「못 받음」을 가른다. 404 도 「못 받았다」로 온다 —
   * 첨부가 지워졌을 수 있고, 그것은 다시 올리면 풀린다.
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

  const footer = (
    <>
      {/*
       * ⭐ **DS 에 파일 입력이 없다** — 숨긴 native 입력을 DS `Button` 이 부르는 조합이다(§8 · `tool-master/file-field.tsx`
       * 와 같은 관용구).
       */}
      <input
        ref={fileInput}
        type="file"
        accept={DRAWING_ACCEPT}
        className="file-input"
        aria-label={t.map.upload}
        /* ⛔ 버튼만 막으면 자판으로 칸에 닿는 길이 남는다 — 칸도 함께 잠근다. */
        disabled={draftDirty || busy}
        onChange={(event) => {
          pickFile(event.target.files?.[0] ?? null, event.target);
        }}
      />
      <Button
        variant="outlined"
        loading={drawing.isBusy}
        /* ⛔ 저장하지 않은 점 편집 위에 도면을 갈지 않는다 — 사유는 판 아래에 적는다. */
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
          drawing.isBusy || selectedLocation === null || !hasMarker(draft, selectedLocation)
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
        disabled={busy || !draftDirty}
        onClick={() => {
          setDraft(base);
          setHint(null);
        }}
      >
        {t.map.reset}
      </Button>
      <span className="layout-editor-footer-gap">
        {replace.isSaving && <span className="field-note">{t.map.saving}</span>}
      </span>
      <Button variant="outlined" disabled={busy} onClick={requestClose}>
        {t.editor.cancel}
      </Button>
      <Button
        // ui-check-ignore: C-4 옛 화면 그대로 옮긴 단추 — 바꾼 표식이 없거나 배치도를 못 받았을 때(판 위 안내 줄) 잠긴다
        disabled={!canSave || drawing.isBusy || !draftDirty}
        onClick={() => {
          /* ⛔ 도면 id 를 빼면 서버가 도면을 지운다 — 점만 고치는 저장도 싣는다. */
          /* 층 · 셀은 한 번 더 거른다 — 위치 목록보다 먼저 고친 편집 상태에도 실려 가지 않게(SC-009). */
          replace.write(
            toReplaceBody(splitPlaceable(draft, knownLocations).kept, drawingAttachmentId),
          );
        }}
      >
        {t.map.save}
      </Button>
    </>
  );

  return (
    <>
      <Dialog
        open
        size="lg"
        className="layout-editor-dialog"
        title={t.editor.title(warehouseLabel)}
        closeOnBackdropClick={false}
        showCloseButton={!busy}
        onClose={requestClose}
        footer={footer}
      >
        <div className="layout-editor-body">
          <section className="layout-editor-list" aria-label={t.panes.locations}>
            <Checkbox
              checked={includeInactive}
              disabled={drawing.isBusy}
              onChange={(event) => {
                setIncludeInactive(event.target.checked);
              }}
            >
              {t.locations.includeInactive}
            </Checkbox>
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
              <LocationList
                /* ⭐ 배치 대상(구역 · 랙)만 — 층 · 셀은 찍을 수 없다(FR-015). */
                locations={placeableRows}
                isPlaced={(locationId) => hasMarker(draft, locationId)}
                selectedLocationId={selectedLocation}
                onPick={pickLocation}
                expandedIds={expandedIds ?? new Set()}
                onExpandedChange={setExpandedIds}
                compact
                empty={
                  rows.length === 0 ? undefined : (
                    <EmptyState size="sm" live title={t.editor.emptyPlaceable} />
                  )
                }
              />
            )}
          </section>

          <section className="layout-editor-map" aria-label={t.panes.map}>
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
            {/* 저장돼 있던 층 · 셀 표식 — 그리지 않고 다음 저장 때 빠진다(FR-016). 이것만으로는 변경이 아니다. */}
            {placeable.dropped > 0 && (
              <div className="banner-slot">
                <AlertBanner variant="info">
                  {t.editor.legacyMarkers(placeable.dropped)}
                </AlertBanner>
              </div>
            )}
            {/* ⭐ 잠금 토큰이 배치도 조회에서 온다 — 받기 전 · 못 받으면 저장을 보낼 수 없다. */}
            {layout.isError && <p className="field-note">{t.map.lockFailed}</p>}
            {layout.isPending && <p className="field-note">{t.map.lockLoading}</p>}
            {/* 점 저장의 실패 — 충돌이면 최신 배치를 불러와 그 위에서 다시 정하게 한다. 그때까지 내 변경은 남는다. */}
            <SaveErrorBanner error={replace.error} onReload={reloadLatest} />

            {/*
             * 도면 «저장» 단계의 실패. ⭐ 첨부는 이미 올라가 있으므로 **다시 올리지 않고 저장만** 다시 보낼 수 있다 —
             * 다시 올리면 고아 첨부가 하나 더 생긴다.
             */}
            {drawing.errorStep === 'save' && (
              <>
                <SaveErrorBanner error={drawing.error} onReload={reloadLatest} />
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
                      {drawingOverwrites ? t.map.overwriteDrawing : t.map.retrySaveDrawing}
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
                {/* ⭐ 판은 남은 높이 · 폭에 도면 비율을 지켜 맞춘다 — 올리는 동안 이 위에 가림막이 선다. */}
                <div className="layout-editor-stage">
                  <div
                    className="drawing-stage layout-editor-board"
                    style={
                      drawingAspect === null
                        ? undefined
                        : ({ '--drawing-aspect': String(drawingAspect) } as CSSProperties)
                    }
                  >
                    {boardMounted && (
                      <MarkerOverlay
                        src={drawingSrc}
                        imageLabel={t.map.imageLabel}
                        markers={overlayMarkers}
                        placeholder={drawingPlaceholder}
                        readOnly={busy}
                        onLabelsFitted={() => {
                          setLabelsFitted(true);
                        }}
                        onPlace={place}
                        onSelect={(id) => {
                          pickLocation(Number(id));
                        }}
                        onMove={(id, x, y) => {
                          setDraft(placeMarker(draft, Number(id), x, y));
                        }}
                        onShape={(id, shape) => {
                          setDraft(shapeMarker(draft, Number(id), shape));
                        }}
                        /* ⭐ 낭독 문구는 화면이 준다 — 판 부품은 표현 전용이라 사람의 말을 갖지 않는다. */
                        describePosition={t.map.markerPosition}
                        describeMove={t.map.markerMoved}
                        /* ⭐ 잠긴 동안 무엇이 막히고 무엇은 되는지 — 눌러 보고 알게 두지 않는다. */
                        describeReadOnly={t.map.boardLocked}
                      />
                    )}

                    {!(boardMounted && labelsFitted) && (
                      <div className="layout-editor-drawing" role="status">
                        <div className="drawing-busy-note">
                          {/* ⛔ 막대에 이름을 주지 않는다 — 옆 글과 같은 말을 낭독기가 두 번 읽는다. */}
                          <Progress indeterminate size="sm" aria-hidden />
                          <span>{t.editor.drawingBoard}</span>
                        </div>
                      </div>
                    )}

                    {drawing.isBusy && (
                      /* ⭐ 화면 낭독기에도 전한다 — 「눌렀는데 아무 일도 없다」는 시각만의 문제가 아니다. */
                      <div className="drawing-busy" role="status">
                        <div className="drawing-busy-note">
                          {/* ⛔ 막대에 이름을 주지 않는다 — 옆 글과 같은 말을 낭독기가 두 번 읽는다. */}
                          <Progress indeterminate size="sm" aria-hidden />
                          <span>{busyLabel}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {hint !== null && <p className="field-error">{hint}</p>}

                {/* 고른 표식의 크기 · 회전 — 자판으로도 바꾼다(판의 손잡이는 포인터 전용). */}
                {selectedMarker !== undefined && (
                  <MarkerShapeFields
                    shape={selectedMarker}
                    disabled={busy}
                    onChange={(shape) => {
                      setDraft(shapeMarker(draft, selectedMarker.locationId, shape));
                    }}
                  />
                )}

                {/* 올리기 자리의 말 — 사유 · 사전 검사 · 서버가 돌려준 파일 오류가 여기 모인다. */}
                {draftDirty && <p className="field-note">{t.map.uploadNeedsCleanDraft}</p>}
                {fileNote !== null && <p className="field-error">{fileNote}</p>}
                {drawing.fileError !== null && <p className="field-error">{drawing.fileError}</p>}
                {/* 올리기 «단계»의 실패(413 · 403 등) — 저장 배너와 자리를 가른다. */}
                {drawing.errorStep === 'upload' && <SaveErrorBanner error={drawing.error} />}
              </>
            )}
          </section>
        </div>
      </Dialog>

      {/*
       * ⚠ **이미 도면이 있을 때만 선다.** 점은 비율이라 새 도면에서도 같은 상대 위치에 남지만, 그 자리가 새 도면의 실제
       * 자리와 맞는지는 사람만 안다(§7 · G-19).
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
          {/* 본문 설명 없이 대상만 — 고른 파일. */}
          <p className="dialog-lead">{pendingFile.name}</p>
        </Dialog>
      )}

      {/* 저장하지 않은 변경을 버리고 닫을지 — 버리면 서버 배치는 그대로다(FR-008). */}
      {confirmingDiscard && (
        <Dialog
          open
          size="sm"
          title={t.editor.discardTitle}
          onClose={() => {
            setConfirmingDiscard(false);
          }}
          footer={
            <>
              <Button
                variant="outlined"
                onClick={() => {
                  setConfirmingDiscard(false);
                }}
              >
                {t.editor.keepEditing}
              </Button>
              <Button
                onClick={() => {
                  setConfirmingDiscard(false);
                  onClose();
                }}
              >
                {t.editor.discard}
              </Button>
            </>
          }
        >
          <p className="dialog-lead">{t.editor.discardBody}</p>
        </Dialog>
      )}
    </>
  );
};

/**
 * 도면의 가로 ÷ 세로. 편집 창의 판이 남은 높이 안에서 도면 비율을 지키며 폭을 정하는 데 쓴다(CSS `--drawing-aspect`).
 * 그림을 못 읽으면 `null` — 판은 폭 전체를 쓴다.
 */
const useImageAspect = (src: string | undefined): number | null => {
  const [aspect, setAspect] = useState<number | null>(null);

  useEffect(() => {
    if (src === undefined || typeof Image === 'undefined') {
      setAspect(null);
      return undefined;
    }

    const image = new Image();
    let alive = true;

    image.onload = () => {
      if (alive && image.naturalWidth > 0 && image.naturalHeight > 0)
        setAspect(image.naturalWidth / image.naturalHeight);
    };
    image.src = src;

    return () => {
      alive = false;
    };
  }, [src]);

  return aspect;
};
