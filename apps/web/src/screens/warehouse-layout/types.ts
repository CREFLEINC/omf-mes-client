import type { components } from '@omf-mes/api-client';

import { toRatio, type MarkerDraft } from './layout-draft';

/**
 * W-CO-08 이 다루는 모양들.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type WarehouseLayout = components['schemas']['WarehouseLayout'];
type Location = components['schemas']['Location'];

export interface LookupEntry {
  value: string;
  label: string;
  isActive: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface LayoutView {
  warehouseId: number;
  /** 없으면 도면이 아직 없다 — 점만 찍어 둘 수는 있다. */
  drawingAttachmentId: number | null;
  markers: MarkerDraft[];
}

export interface LocationView {
  locationId: number;
  locationCode: string;
  locationName: string;
  isActive: boolean;
}

const nullable = <T>(value: T | null | undefined): T | null => value ?? null;

/**
 * ⭐ **서버가 준 좌표도 비율로 묶는다.** 계약이 0~1 로 두었지만 옛 자료가 섞여 있을 수 있고,
 * 묶지 않으면 도면 밖에 점이 그려져 사람이 찾지 못한다.
 */
export const toLayoutView = (source: WarehouseLayout): LayoutView => ({
  warehouseId: source.warehouseId,
  drawingAttachmentId: nullable(source.drawingAttachmentId),
  markers: source.markers.map((marker) => ({
    locationId: marker.locationId,
    x: toRatio(marker.x),
    y: toRatio(marker.y),
  })),
});

export const toLocationView = (source: Location): LocationView => ({
  locationId: source.locationId,
  locationCode: source.locationCode,
  locationName: source.locationName,
  isActive: source.isActive,
});
