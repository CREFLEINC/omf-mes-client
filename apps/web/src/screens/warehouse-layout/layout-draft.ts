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
 * **순수 함수만 둔다.** 「지금」을 읽지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type WarehouseLayoutReplace = components['schemas']['WarehouseLayoutReplace'];

export interface MarkerDraft {
  locationId: number;
  x: number;
  y: number;
}

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

export const hasMarker = (draft: LayoutDraft, locationId: number): boolean =>
  draft.some((marker) => marker.locationId === locationId);

/** 위치 하나를 도면에 찍는다. **이미 찍혀 있으면 자리를 옮긴다** — 같은 위치를 두 번 찍지 않는다. */
export const placeMarker = (
  draft: LayoutDraft,
  locationId: number,
  x: number,
  y: number,
): LayoutDraft => {
  const next = { locationId, x: toRatio(x), y: toRatio(y) };

  if (!hasMarker(draft, locationId)) return [...draft, next];

  return draft.map((marker) => (marker.locationId === locationId ? next : marker));
};

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

    return before.x !== marker.x || before.y !== marker.y;
  });
};

/**
 * 배치를 저장 본문으로 옮긴다.
 *
 * ⛔ **위치 이름을 싣지 않는다** — 마스터가 가진 값이고 여기서 보내면 두 곳에서 갈린다.
 * ⛔ **도면이 없으면 도면 칸을 싣지 않는다** — 비운 것과 「바꾸지 않는다」를 가른다.
 */
export const toReplaceBody = (
  draft: LayoutDraft,
  drawingAttachmentId: number | null,
): WarehouseLayoutReplace => ({
  markers: draft.map((marker) => ({
    locationId: marker.locationId,
    x: marker.x,
    y: marker.y,
  })),
  ...(drawingAttachmentId === null ? {} : { drawingAttachmentId }),
});
