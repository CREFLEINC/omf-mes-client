import type {
  ProductionResultCreateForward,
  WorkOrderForward,
  components,
} from '@omf-mes/api-client';

export type WorkOrder = WorkOrderForward;
export type Lot = components['schemas']['Lot'];
export type InspectionRequest = components['schemas']['InspectionRequest'];
export type ProductionResultCreate = ProductionResultCreateForward;

/**
 * 화면이 들고 있는 양품 입력값. 불량은 유형별 줄(`defect-draft`)로 따로 든다.
 *
 * ⛔ 보류·스크랩·재작업 칸은 두지 않는다 — 불량 수량도 칸 하나가 아니라 유형별 줄의 합이다.
 */
export interface ResultDraft {
  /** 키패드 버퍼. 숫자 문자열이며 빈 문자열이 미입력이다. */
  goodQty: string;
  remarks: string;
}

export const emptyResultDraft: ResultDraft = { goodQty: '', remarks: '' };
