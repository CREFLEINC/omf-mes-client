import type { components } from '@omf-mes/api-client';

export type WorkOrder = components['schemas']['WorkOrder'];
export type Lot = components['schemas']['Lot'];
export type InspectionRequest = components['schemas']['InspectionRequest'];
export type ProductionResultCreate = components['schemas']['ProductionResultCreate'];

/**
 * 화면이 들고 있는 입력값. **양품수량 하나와 비고뿐이다.**
 *
 * ⛔ 불량·보류·스크랩·재작업 칸을 두지 않는다 — 정본이 「양품만 입력」(R50)이고, 불량은
 * 생산불량LOT 으로 갈라져 이 화면에 오지 않는다. 계약에 다섯 칸이 있다는 것은 **다른 화면도
 * 같은 경로를 쓴다**는 뜻이지 이 화면이 다섯을 받는다는 뜻이 아니다(착수 이슈 §4).
 */
export interface ResultDraft {
  /** 키패드 버퍼. 숫자 문자열이며 빈 문자열이 미입력이다. */
  goodQty: string;
  remarks: string;
}

export const emptyResultDraft: ResultDraft = { goodQty: '', remarks: '' };
