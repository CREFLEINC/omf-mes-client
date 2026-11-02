import type { components } from '@omf-mes/api-client';

/**
 * 배치도의 편집 상태.
 *
 * ⭐ **좌표는 픽셀이 아니라 «비율»이다** — 0 과 1 사이. 픽셀로 두면 도면을 갈거나 창을 줄이는
 * 것만으로 점이 전부 어긋난다. 이 파일은 **비율 밖의 값을 만들지 않는다**: 들어온 값도 나가는
 * 값도 0~1 로 묶는다.
 *
 * ⭐ **저장은 도면과 점을 통째로 바꾼다.** 보내는 것은 「이 창고의 배치 전체」이고 ⛔ **지도에서
 * 뺀 위치는 지워진다** — 점을 하나씩 저장하는 경로가 없다.
 *
 * ⭐ **표식은 크기 · 회전을 가진 사각형이다**(사용자 지시 2026-10-30). 크기도 도면 폭 · 높이에 대한 비율이라 도면을
 * 갈아도 같은 상대 크기다. `x` · `y` 는 사각형의 중심점, 회전은 도(0 이상 360 미만, 시계 방향).
 *
 * **순수 함수만 둔다.** 「지금」을 읽지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export interface MarkerShape {
  /** 도면 폭에 대한 비율 — `MARKER_MIN_SIZE` 이상 1 이하. */
  width: number;
  /** 도면 높이에 대한 비율 — `MARKER_MIN_SIZE` 이상 1 이하. */
  height: number;
  /** 도, 0 이상 360 미만, 시계 방향. */
  rotation: number;
}

export interface MarkerDraft extends MarkerShape {
  locationId: number;
  x: number;
  y: number;
}

/**
 * 새로 찍는 표식의 모양. 서버 기본값(0.05 · 0.05 · 0)보다 넓다 — 서버 기본 크기면 위치 코드가 잘린다(사용자 지시 2026-10-30).
 * 저장 본문에 늘 실어 보내 서버 기본값이 쓰이지 않는다.
 */
export const DEFAULT_MARKER_SHAPE: MarkerShape = { width: 0.12, height: 0.05, rotation: 0 };

/**
 * 이보다 작게는 줄이지 않는다 — 손잡이로 잡을 수 없을 만큼 작아진다. 서버 범위(0 초과 1 이하) 안이다 — 밖이면 서버가
 * 400(`markers[i].width` 식)으로 막는다.
 */
export const MARKER_MIN_SIZE = 0.02;

export type LayoutDraft = MarkerDraft[];

/** 소수점 넷째 자리까지 — 그보다 잘게 저장해 봐야 화면에서 구분되지 않는다. */
const round = (value: number): number => Math.round(value * 10000) / 10000;

/**
 * 비율로 묶는다.
 *
 * ⭐ **밖에서 온 값을 믿지 않는다** — 창 크기가 0이거나 손가락이 판 밖으로 나가면 음수나 1을
 * 넘는 값이 만들어진다. 그대로 보내면 서버가 거부하고, 거부되지 않으면 도면 밖에 점이 남는다.
 */
export const toRatio = (value: number): number => {
  /*
   * 수가 아닌 값은 방향조차 없으니 0으로 둔다 — 판의 크기가 0일 때 나눗셈이 이렇게 무너진다.
   * ⭐ 무한대는 다르다: 「오른쪽으로 한참 나갔다」는 방향이 남아 있으므로 그쪽 끝으로 묶는다.
   */
  if (Number.isNaN(value)) return 0;

  return round(Math.min(1, Math.max(0, value)));
};

/** 크기 비율로 묶는다 — `MARKER_MIN_SIZE` 이상 1 이하. 수가 아니면 기본값의 그 칸. */
export const toSize = (value: number, fallback: number): number => {
  if (!Number.isFinite(value)) return fallback;

  return round(Math.min(1, Math.max(MARKER_MIN_SIZE, value)));
};

/** 회전을 0 이상 360 미만으로 접는다(360 은 0) — 소수 첫째 자리까지. 서버 범위와 같다. */
export const toRotation = (value: number): number => {
  if (!Number.isFinite(value)) return 0;

  const folded = Math.round((((value % 360) + 360) % 360) * 10) / 10;

  return folded === 360 ? 0 : folded;
};

/** 서버가 준 모양을 화면 범위로 접는다. */
export const toShape = (source: MarkerShape): MarkerShape => ({
  width: toSize(source.width, DEFAULT_MARKER_SHAPE.width),
  height: toSize(source.height, DEFAULT_MARKER_SHAPE.height),
  rotation: toRotation(source.rotation),
});

export const hasMarker = (draft: LayoutDraft, locationId: number): boolean =>
  draft.some((marker) => marker.locationId === locationId);

/**
 * 위치 하나를 도면에 찍는다. **이미 찍혀 있으면 자리를 옮긴다** — 같은 위치를 두 번 찍지 않는다. 옮길 때 크기 · 회전은
 * 그대로, 새로 찍으면 기본 모양.
 */
export const placeMarker = (
  draft: LayoutDraft,
  locationId: number,
  x: number,
  y: number,
): LayoutDraft => {
  if (!hasMarker(draft, locationId)) {
    return [...draft, { locationId, x: toRatio(x), y: toRatio(y), ...DEFAULT_MARKER_SHAPE }];
  }

  return draft.map((marker) =>
    marker.locationId === locationId ? { ...marker, x: toRatio(x), y: toRatio(y) } : marker,
  );
};

/** 찍힌 표식의 크기 · 회전을 바꾼다 — 준 칸만. 자리(중심)는 그대로. 없는 위치면 그대로 돌려준다. */
export const shapeMarker = (
  draft: LayoutDraft,
  locationId: number,
  shape: Partial<MarkerShape>,
): LayoutDraft =>
  draft.map((marker) =>
    marker.locationId === locationId
      ? {
          ...marker,
          ...(shape.width === undefined ? {} : { width: toSize(shape.width, marker.width) }),
          ...(shape.height === undefined ? {} : { height: toSize(shape.height, marker.height) }),
          ...(shape.rotation === undefined ? {} : { rotation: toRotation(shape.rotation) }),
        }
      : marker,
  );

export const removeMarker = (draft: LayoutDraft, locationId: number): LayoutDraft =>
  draft.filter((marker) => marker.locationId !== locationId);

/**
 * 바뀐 것이 있는가.
 *
 * ⭐ **점의 순서는 견주지 않는다** — 서버가 준 순서와 화면이 더한 순서가 달라도 같은 배치다.
 */
export const isDirty = (draft: LayoutDraft, original: LayoutDraft): boolean => {
  if (draft.length !== original.length) return true;

  const byId = new Map(original.map((marker) => [marker.locationId, marker]));

  return draft.some((marker) => {
    const before = byId.get(marker.locationId);

    if (before === undefined) return true;

    return (
      before.x !== marker.x ||
      before.y !== marker.y ||
      before.width !== marker.width ||
      before.height !== marker.height ||
      before.rotation !== marker.rotation
    );
  });
};

/**
 * 배치를 저장 본문으로 옮긴다.
 *
 * ⛔ **위치 이름을 싣지 않는다** — 마스터가 가진 값이고 여기서 보내면 두 곳에서 갈린다.
 * ⛔ **도면이 없으면 도면 칸을 싣지 않는다** — 비운 것과 「바꾸지 않는다」를 가른다.
 * ⛔ **통째 교체라 이 값을 빼면 서버가 도면을 지운다(#1064)** — 그래서 필수 인자다. 지금
 * 도면이 있으면 그 id를, 없으면 `null`을 반드시 명시로 넘긴다. 기본값을 두지 않는다.
 */
export const toReplaceBody = (
  draft: LayoutDraft,
  drawingAttachmentId: number | null,
): components['schemas']['WarehouseLayoutReplace'] => ({
  markers: draft.map((marker) => ({
    locationId: marker.locationId,
    x: marker.x,
    y: marker.y,
    width: marker.width,
    height: marker.height,
    rotation: marker.rotation,
  })),
  ...(drawingAttachmentId === null ? {} : { drawingAttachmentId }),
});

/** 서버가 실제로 받는 형식 — 이 밖은 요청 전에 화면이 막는다. */
export const DRAWING_MIME_TYPES = ['image/png', 'image/jpeg'] as const;

/**
 * 서버 상한 10MB — 최종 판정은 서버가 파일 «내용»으로 한다. 여기는 요청 전에 미리 거르는 것뿐.
 */
export const DRAWING_MAX_BYTES = 10 * 1024 * 1024;

/**
 * 도면 올리기 전 사전 검사.
 *
 * ⭐ **형식을 크기보다 먼저 본다** — 형식부터 어긋나면 크기까지 잴 필요가 없다.
 * `File` 이 아니라 `{ type, size }` 로 받는다 — jsdom 없이도 시험할 수 있게.
 */
export const checkDrawingFile = (file: { type: string; size: number }): 'ok' | 'type' | 'size' => {
  if (!DRAWING_MIME_TYPES.includes(file.type as (typeof DRAWING_MIME_TYPES)[number])) return 'type';
  if (file.size > DRAWING_MAX_BYTES) return 'size';

  return 'ok';
};
