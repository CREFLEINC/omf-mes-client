import type { WorkOrder } from './types';

/**
 * 상세 창의 진행 단계 줄 — W/O 가 지나는 길을 순서대로 놓은 것이다.
 *
 * 상태는 시스템이 정한 여덟 가지다(편성 · 확정 · 배포 · 진행 · 완료 · 마감 · 중단 · 취소). 이 가운데 **길 위에 있는 여섯**만
 * 단계로 놓는다. 중단은 진행하다 멈춘 것이라 「진행」 자리에 머물고, 취소는 길에서 벗어난 것이라 자리가 없다 — 둘 다
 * 상태 칩이 말한다.
 *
 * ⛔ 단계의 **이름은 여기서 정하지 않는다.** 코드만 놓고 이름은 공통코드 마스터의 표시명을 쓴다 — 표의 상태 칩과 같은 말이다.
 */
export const STEP_CODES = [
  'PLANNED',
  'CONFIRMED',
  'RELEASED',
  'IN_PROGRESS',
  'COMPLETED',
  'CLOSED',
] as const;

export type StepCode = (typeof STEP_CODES)[number];

export type StepState = 'done' | 'current' | 'todo';

export interface DetailStep {
  code: StepCode;
  state: StepState;
  /** 그 단계에 들어선 시각 — 서버가 남기는 것은 배포 · 완료 · 마감뿐이다. */
  at: string | undefined;
}

/** 길 위의 자리. 중단은 진행 자리에 머문다. */
const POSITION: Record<string, number> = {
  PLANNED: 0,
  CONFIRMED: 1,
  RELEASED: 2,
  IN_PROGRESS: 3,
  SUSPENDED: 3,
  COMPLETED: 4,
  CLOSED: 5,
};

const stampOf = (workOrder: WorkOrder, code: StepCode): string | undefined => {
  if (code === 'RELEASED') return workOrder.releasedAt;
  if (code === 'COMPLETED') return workOrder.completedAt;
  if (code === 'CLOSED') return workOrder.closedAt;

  return undefined;
};

/**
 * 지금 상태가 길 위에 있으면 그 앞은 지난 단계, 그 자리는 지금 단계다.
 *
 * 길 밖의 상태(취소 · 마스터에 새로 생긴 값)는 「지금」 자리가 없다 — 시각이 남은 단계만 지난 것으로 그린다.
 * 어디까지 갔다가 벗어났는지는 그 시각이 말한다.
 */
export const toDetailSteps = (workOrder: WorkOrder): DetailStep[] => {
  const position = POSITION[workOrder.statusCode];

  return STEP_CODES.map((code, index) => {
    const at = stampOf(workOrder, code);

    if (position === undefined) return { code, state: at === undefined ? 'todo' : 'done', at };

    return { code, state: index < position ? 'done' : index === position ? 'current' : 'todo', at };
  });
};
