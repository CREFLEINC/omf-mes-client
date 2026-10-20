import type {
  ResourceRecommendationSource,
  ResourceRecommendations,
  WorkerRecommendationSource,
} from '@omf-mes/api-client';

import { formatDateRange, formatTimeOfDay } from '../../patterns/date-display';

/** 칸 아래에 늘어놓는 후보 수 — 그 이상은 찾기 창에서 고른다. */
const CHIP_LIMIT = 3;

/** 칩의 근거 표식. 작업자의 설비·라인·공정 이력은 모두 「최근」 하나로 읽힌다. */
export type RecommendationChipSource = ResourceRecommendationSource | 'QUALIFIED';

export interface ResourceRecommendationChip {
  value: string;
  /** 칩에 보이는 짧은 이름 — 설비·금형은 코드(이름이 길어 칩이 접힌다), 교대·작업자는 이름 */
  code: string;
  /** 「코드 · 이름」 — 칸에 넣을 이름이고, 칩에서는 접근 이름·툴팁으로 쓴다 */
  label: string;
  /** 교대는 근거가 하나뿐이라 표식이 없다 */
  source: RecommendationChipSource | null;
  /** 설비의 라인 — 고르면 라인도 함께 맞춘다. 설비 목록이 라인으로 걸러지기 때문이다. */
  productionLineId: string | null;
  /** `workerBusy` 는 작업자가 그 교대에 이미 담당인 것 — 설비의 「사용 중」과 다른 말로 짧게 보인다 */
  warning: 'busy' | 'workerBusy' | 'outOfService' | null;
}

export type ResourceRecommendationChips = Record<
  'plannedEquipmentId' | 'plannedMoldId' | 'plannedShiftId' | 'responsibleWorkerId',
  ResourceRecommendationChip[]
>;

const workerSource = (source: WorkerRecommendationSource): RecommendationChipSource =>
  source === 'QUALIFIED' ? 'QUALIFIED' : 'RECENT';

export interface RecommendationChipOptions {
  /**
   * 편집 중인 설비·교대·계획 시작이 저장값과 다르다. 서버는 교대·작업자의 사용 중을 «저장된» W/O 로
   * 판정하므로 그때는 표식을 떼어 낡은 경고를 보이지 않는다 — 칩은 그대로 누를 수 있다.
   */
  slotChanged?: boolean;
}

/** 같은 이름이 둘 이상이면 칩만으로 가를 수 없어 사번을 붙인다. */
const workerChipText = (
  workers: readonly { workerNo: string; workerName: string }[],
  worker: { workerNo: string; workerName: string },
): string =>
  workers.filter((item) => item.workerName === worker.workerName).length > 1
    ? `${worker.workerName} (${worker.workerNo})`
    : worker.workerName;

export const toRecommendationChips = (
  data: ResourceRecommendations | undefined,
  { slotChanged = false }: RecommendationChipOptions = {},
): ResourceRecommendationChips => ({
  plannedEquipmentId: (data?.equipments ?? []).slice(0, CHIP_LIMIT).map((item) => ({
    value: String(item.equipmentId),
    code: item.equipmentCode,
    label: `${item.equipmentCode} · ${item.equipmentName}`,
    source: item.source,
    productionLineId: item.productionLineId === null ? null : String(item.productionLineId),
    warning: !item.inService ? 'outOfService' : item.busy ? 'busy' : null,
  })),
  plannedMoldId: (data?.molds ?? []).slice(0, CHIP_LIMIT).map((item) => ({
    value: String(item.moldId),
    code: item.moldCode,
    label: `${item.moldCode} · ${item.moldName}`,
    source: item.source,
    productionLineId: null,
    warning: item.inService ? null : 'outOfService',
  })),
  /* 교대·작업자는 서버가 정한 순서·개수를 그대로 쓴다 — 교대는 공장에 몇 개뿐이고 작업자는 서버가 줄인다. */
  plannedShiftId: (data?.shifts ?? []).map((item) => ({
    value: String(item.shiftId),
    code: item.shiftName,
    /* 교대 선택칸과 같은 이름 — 칩 툴팁이 칸의 선택지와 같은 말을 한다. */
    label: `${item.shiftCode} · ${item.shiftName} (${formatDateRange(formatTimeOfDay(item.startTime), formatTimeOfDay(item.endTime))})`,
    source: null,
    productionLineId: null,
    warning: item.busy && !slotChanged ? 'busy' : null,
  })),
  responsibleWorkerId: (data?.workers ?? []).map((item, _index, workers) => ({
    value: String(item.workerId),
    code: workerChipText(workers, item),
    label: `${item.workerNo} · ${item.workerName}`,
    source: workerSource(item.source),
    productionLineId: null,
    warning: item.busy && !slotChanged ? 'workerBusy' : null,
  })),
});
