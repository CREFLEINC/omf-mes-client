import type { ResourceRecommendationSource, ResourceRecommendations } from '@omf-mes/api-client';

/** 칸 아래에 늘어놓는 후보 수 — 그 이상은 선택 목록에서 고른다. */
const CHIP_LIMIT = 3;

export interface ResourceRecommendationChip {
  value: string;
  label: string;
  source: ResourceRecommendationSource;
  /** 설비의 라인 — 고르면 라인도 함께 맞춘다. 설비 목록이 라인으로 걸러지기 때문이다. */
  productionLineId: string | null;
  warning: 'busy' | 'outOfService' | null;
}

export type ResourceRecommendationChips = Record<
  'plannedEquipmentId' | 'plannedMoldId',
  ResourceRecommendationChip[]
>;

export const toRecommendationChips = (
  data: ResourceRecommendations | undefined,
): ResourceRecommendationChips => ({
  plannedEquipmentId: (data?.equipments ?? []).slice(0, CHIP_LIMIT).map((item) => ({
    value: String(item.equipmentId),
    label: `${item.equipmentCode} · ${item.equipmentName}`,
    source: item.source,
    productionLineId: item.productionLineId === null ? null : String(item.productionLineId),
    warning: !item.inService ? 'outOfService' : item.busy ? 'busy' : null,
  })),
  plannedMoldId: (data?.molds ?? []).slice(0, CHIP_LIMIT).map((item) => ({
    value: String(item.moldId),
    label: `${item.moldCode} · ${item.moldName}`,
    source: item.source,
    productionLineId: null,
    warning: item.inService ? null : 'outOfService',
  })),
});
