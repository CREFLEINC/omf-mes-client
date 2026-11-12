import { useState } from 'react';

import { hasMarker, type LayoutDraft } from './layout-draft';
import type { LocationView } from './types';

/**
 * 배치 대상 — 도면에는 **구역 · 랙만** 둔다(피처 006 2차 · FR-015 · FR-016 · R2-1 · R2-3, 결정 D-6).
 *
 * ⭐ **판정은 이 파일 하나다.** 편집 창 목록 · 찍기 · 불러오기 거르기 · 조회 화면 「도면」 칸이 모두 `isPlaceable` 을 쓴다 —
 * 자리마다 따로 정하면 목록에는 없는데 판에는 그려지는 위치가 생긴다.
 *
 * ⭐ **서버는 거르지 않는다**(사용자 결정, 서버 변경 없음). 이미 저장된 층 · 셀 표식은 화면이 그리지 않고, 편집 창의 다음 저장
 * 본문에서 빠진다.
 */

type PlaceableLocation = Pick<LocationView, 'locationId' | 'locationLevelCode'>;
type TreeLocation = Pick<LocationView, 'locationId' | 'parentLocationId'>;

/** 도면에 둘 수 있는 위치 단계. 서버가 만든 자리(적치 대기 · 창고 전체)도 구역 단계라 여기 든다. */
const PLACEABLE_LEVELS: ReadonlySet<string> = new Set(['ZONE', 'RACK']);

/** 단계를 모르는 위치(`null`)는 대상이 아니다 — 목록에 내지 않는다. */
export const isPlaceable = (location: Pick<LocationView, 'locationLevelCode'>): boolean =>
  location.locationLevelCode !== null && PLACEABLE_LEVELS.has(location.locationLevelCode);

/**
 * 배치에서 층 · 셀 표식을 걷어 낸다.
 *
 * ⚠ **목록에 없는 위치 id(단계가 비어 있는 위치 포함)는 남긴다** — 중지 · 삭제된 위치는 단계를 모른다. 모르는 것을 셀로 쳐서 지우면 「중지된 위치도
 * 보기」를 끈 채 저장할 때 남의 표식이 말없이 사라진다.
 * ⭐ 빠질 것이 없으면 **받은 배열을 그대로** 돌려준다 — 편집 창은 배열이 바뀌면 「서버 배치가 새로 왔다」로 읽는다.
 */
export const splitPlaceable = (
  markers: LayoutDraft,
  locations: readonly PlaceableLocation[],
): { kept: LayoutDraft; dropped: number } => {
  const levelOf = new Map(locations.map((item) => [item.locationId, item.locationLevelCode]));
  const kept = markers.filter((marker) => {
    const level = levelOf.get(marker.locationId);

    /* 단계를 아는 층 · 셀만 뺀다 — 목록에 없거나 단계가 비어 있으면 모르는 것이다. */
    return level === undefined || level === null || PLACEABLE_LEVELS.has(level);
  });

  return kept.length === markers.length
    ? { kept: markers, dropped: 0 }
    : { kept, dropped: markers.length - kept.length };
};

/**
 * 고른 위치를 판에서 어느 표식으로 보일지 — 배치돼 있으면 자기, 아니면 부모를 따라 올라가 처음 만나는 배치된 위치(셀 → 랙 →
 * 구역). 아무것도 없으면 `null`. 부모가 돌아도 한 바퀴에서 멈춘다.
 */
export const highlightTarget = (
  selectedId: number | null,
  markers: LayoutDraft,
  locations: readonly TreeLocation[],
): number | null => {
  const parentOf = new Map(locations.map((item) => [item.locationId, item.parentLocationId]));
  const visited = new Set<number>();
  let current: number | null | undefined = selectedId;

  while (current !== null && current !== undefined && !visited.has(current)) {
    if (hasMarker(markers, current)) return current;
    visited.add(current);
    current = parentOf.get(current);
  }

  return null;
};

/**
 * 한 창고에서 지금까지 본 위치 전부 — 「중지된 위치도 보기」를 켜고 끄는 동안(다시 받는 중) 목록이 잠깐 비어도 단계를
 * 잊지 않는다. 잊으면 그 사이 층 · 셀 표식이 판에 다시 그려진다. 위치의 단계는 바뀌지 않으므로 쌓기만 한다.
 */
export const useKnownLocations = <T extends PlaceableLocation>(
  scope: number | null,
  rows: readonly T[],
): readonly T[] => {
  const [known, setKnown] = useState<{ scope: number | null; list: readonly T[] }>({
    scope,
    list: rows,
  });

  if (known.scope !== scope) {
    const next = { scope, list: rows };

    setKnown(next);
    return next.list;
  }

  const seen = new Set(known.list.map((item) => item.locationId));
  const added = rows.filter((item) => !seen.has(item.locationId));

  if (added.length > 0) {
    const next = { scope, list: [...known.list, ...added] };

    setKnown(next);
    return next.list;
  }

  return known.list;
};
