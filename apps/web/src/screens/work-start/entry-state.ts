/**
 * 홈 「다음 작업」에서 작업 지시 목록으로 올 때 함께 넘기는 것(#291) — 그 W/O 를 고른 채로 연다.
 *
 * 주소가 아니라 이동 상태(state)로 넘긴다 — 주소의 `workOrderId` 는 단계 줄이 「작업지시를 골랐다」로 읽어
 * 시작 전부터 다음 단계를 연다.
 */
export interface WorkStartEntryState {
  workOrderId: number;
  /** 홈에서 「전체 설비」로 보고 있었다(또는 설비 없는 단말) — 목록도 전체 설비로 연다. */
  allEquipment: boolean;
}

export const entryStateOf = (value: unknown): WorkStartEntryState | null => {
  if (typeof value !== 'object' || value === null) return null;
  const { workOrderId, allEquipment } = value as Partial<WorkStartEntryState>;
  return typeof workOrderId === 'number' && Number.isInteger(workOrderId) && workOrderId > 0
    ? { workOrderId, allEquipment: allEquipment === true }
    : null;
};
