import type { AutoPlanReason, AutoPlanStatus } from '@omf-mes/api-client';

import type { ProductionOrderFact } from './types';

/**
 * ERP W/O 작업함의 처리 상태(규범 C-17 잠정 규칙).
 *
 * 조건, 머리 건수, 행 상태 칩은 같은 기준이어야 한다. 서버가 배포 가능 여부로 거르고 세지 못하므로(서버 계약 대기)
 * 셋 다 서버 자동 계획 결과(`autoPlan.status`)를 쓰고, 다음 단계(배포)를 막는 사유는 사유 칩으로만 보인다.
 * 작업함이 판정할 수 있는 막힘은 배포 전 W/O의 「생산 라인 미정」뿐이다(배포 전 W/O 목록 한 번, C-15 2).
 */
export type ProcessState = 'NOT_PLANNED' | 'NEEDS_REVIEW' | 'DONE' | 'RELEASED' | 'CANCELLED';

/** 서버 사유와 화면이 판정한 막힘 사유 하나. */
export type WorklistReason = AutoPlanReason | 'ASSIGNMENT_INCOMPLETE';

export type ProcessStepKey = 'master' | 'plan' | 'assign' | 'release';

/** ERP W/O 한 건의 배포 대기 W/O 집계. 목록 한 번으로 만든다(행마다 부르지 않는다, C-15 2). */
export interface ReleaseBacklog {
  /** 배포 전 W/O 수 */
  pending: number;
  /** 그중 배포 불가로 판정한 수(작업함은 라인 미정만) */
  blocked: number;
}

export interface WorklistDerived {
  state: ProcessState;
  reasons: WorklistReason[];
}

export const deriveWorklistState = (
  order: Pick<ProductionOrderFact, 'statusCode' | 'autoPlan'> & {
    expandedWorkOrderCount?: number | null;
  },
  backlog: ReleaseBacklog | undefined,
): WorklistDerived => {
  if (order.statusCode === 'CANCELLED') return { state: 'CANCELLED', reasons: [] };
  const autoPlan = order.autoPlan;
  if (autoPlan === null) return { state: 'NOT_PLANNED', reasons: [] };
  if (autoPlan.status === 'NEEDS_REVIEW')
    return { state: 'NEEDS_REVIEW', reasons: [...autoPlan.reasons] };
  /*
   * 배포 대기가 0이고 전개된 W/O가 있으면 배포가 끝난 건이다(배포 전 W/O 목록 한 번으로 계산, C-15 2).
   * 서버 조건 「자동 계획 완료」에 속하는 다음 상태라 조건은 그대로 두고 칩만 「배포 완료」로 보인다(G-63).
   */
  if (backlog !== undefined && backlog.pending === 0 && (order.expandedWorkOrderCount ?? 0) > 0) {
    return { state: 'RELEASED', reasons: [] };
  }
  return {
    state: 'DONE',
    reasons: backlog !== undefined && backlog.blocked > 0 ? ['ASSIGNMENT_INCOMPLETE'] : [],
  };
};

/** 사유와 단계의 대응(C-17). 처리 화면은 데이터의 첫 미완료 단계로 열고, 이 표는 구성안과 시험이 쓴다. */
export const REASON_STEP: Record<WorklistReason, ProcessStepKey> = {
  BOM_MISSING: 'master',
  ROUTING_MISSING: 'master',
  ROUTING_AMBIGUOUS: 'master',
  LINE_UNKNOWN: 'plan',
  PLAN_NOT_CONFIRMED: 'plan',
  QTY_REMAINING: 'plan',
  ASSIGNMENT_INCOMPLETE: 'assign',
};

/** 작업함 조회 조건의 자동 계획 값. 서버 필터 `autoPlanStatus`로 간다. */
export type AutoPlanFilter = AutoPlanStatus | 'ALL';

export const DEFAULT_AUTO_PLAN_FILTER: AutoPlanFilter = 'NEEDS_REVIEW';

export interface BacklogWorkOrder {
  productionOrderId: number;
}

/** W/O 목록 두 개를 ERP W/O별 집계로 묶는다. */
export const toReleaseBacklog = (
  pending: readonly BacklogWorkOrder[],
  blocked: readonly BacklogWorkOrder[],
): Map<number, ReleaseBacklog> => {
  const map = new Map<number, ReleaseBacklog>();
  const entry = (id: number): ReleaseBacklog => {
    const current = map.get(id) ?? { pending: 0, blocked: 0 };
    map.set(id, current);
    return current;
  };
  pending.forEach((item) => {
    entry(item.productionOrderId).pending += 1;
  });
  blocked.forEach((item) => {
    entry(item.productionOrderId).blocked += 1;
  });
  return map;
};
