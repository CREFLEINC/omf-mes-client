import { Button, Checkbox, IconButton } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.warehouseLayout;

/**
 * 배율 단계 — 1 은 「창에 맞춤」(판이 남은 칸에 꼭 맞는 크기). 1 아래는 축소(사용자 지시 2026-11-25) — 도면 전체를 작게 보며
 * 표식 사이를 가늠할 때.
 */
export const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_FIT = 1;

export const zoomIn = (zoom: number): number => ZOOM_STEPS.find((step) => step > zoom) ?? zoom;

export const zoomOut = (zoom: number): number =>
  [...ZOOM_STEPS].reverse().find((step) => step < zoom) ?? zoom;

export interface EditorToolbarProps {
  /** [도면 올리기] — 숨긴 파일 입력을 부른다. 글자는 도는 동안 단계 이름. */
  uploadLabel: string;
  uploadLoading: boolean;
  uploadDisabled: boolean;
  onUpload: () => void;
  resetDisabled: boolean;
  onReset: () => void;
  /** 놓은 뒤 다음 놓지 않은 위치를 자동으로 고른다(안 C 에서 가져옴). */
  autoNext: boolean;
  onAutoNextChange: (value: boolean) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

/**
 * 배치도 수정 창의 도면 도구 막대(안 A, 사용자 결정 2026-11-24) — 도면 바로 위 한 줄: 도면 올리기 · 되돌리기 · 다음 위치 자동
 * 고르기 | 축소 · 배율 · 확대 · 창에 맞춤. 저장 · 취소는 창 바닥에만 둔다.
 */
export const EditorToolbar = ({
  uploadLabel,
  uploadLoading,
  uploadDisabled,
  onUpload,
  resetDisabled,
  onReset,
  autoNext,
  onAutoNextChange,
  zoom,
  onZoomChange,
}: EditorToolbarProps) => (
  <div className="layout-editor-toolbar" role="toolbar" aria-label={t.editor.toolbar}>
    <Button
      variant="outlined"
      size="sm"
      loading={uploadLoading}
      disabled={uploadDisabled}
      onClick={onUpload}
    >
      {uploadLabel}
    </Button>
    <Button variant="outlined" size="sm" disabled={resetDisabled} onClick={onReset}>
      {t.map.reset}
    </Button>
    <Checkbox
      checked={autoNext}
      onChange={(event) => {
        onAutoNextChange(event.target.checked);
      }}
    >
      {t.editor.autoNext}
    </Checkbox>
    <span className="layout-editor-toolbar-gap" />
    <IconButton
      size="sm"
      icon="zoom_out"
      aria-label={t.editor.zoomOut}
      disabled={zoom <= ZOOM_MIN}
      onClick={() => {
        onZoomChange(zoomOut(zoom));
      }}
    />
    <output className="layout-editor-zoom" aria-live="polite">
      {t.editor.zoomLevel(Math.round(zoom * 100))}
    </output>
    <IconButton
      size="sm"
      icon="zoom_in"
      aria-label={t.editor.zoomIn}
      disabled={zoom >= ZOOM_MAX}
      onClick={() => {
        onZoomChange(zoomIn(zoom));
      }}
    />
    <IconButton
      size="sm"
      icon="fit_screen"
      aria-label={t.editor.zoomFit}
      disabled={zoom === ZOOM_FIT}
      onClick={() => {
        onZoomChange(ZOOM_FIT);
      }}
    />
  </div>
);
