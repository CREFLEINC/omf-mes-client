import type { AutoPlanReason, WorklistReasonCode, WorklistState } from '@omf-mes/api-client';

import type { ProductionOrderFact } from './types';

/**
 * ERP W/O 작업함의 처리 상태(규범 C-17).
 *
 * 조건, 머리 건수, 행 상태 칩은 같은 기준이어야 한다. 셋 다 서버가 같은 식으로 계산한 `worklistState`를 쓴다
 * (질의 `worklistState`로 거르고 세며, 행에도 같은 값이 실린다). 화면은 상태를 따로 판정하지 않는다.
 */
export type ProcessState = WorklistState;

/** 사유 코드. 자동 계획 확인 필요의 사유와, 자동 계획은 끝났지만 배포가 막힌 사유 둘 다다. */
export type WorklistReason = AutoPlanReason | WorklistReasonCode;

/** 사유 하나. 화면이 모르는 코드가 와도 칩을 그릴 수 있게 코드는 문자열로 받는다. */
export interface WorklistReasonItem {
  code: string;
  /** 그 사유에 걸린 배포 전 W/O 수. 자동 계획 사유에는 없다. */
  workOrderCount?: number;
}

export type ProcessStepKey = 'master' | 'plan' | 'assign' | 'release';

export interface WorklistDerived {
  state: ProcessState;
  reasons: WorklistReasonItem[];
}

/**
 * 서버 판정을 화면 모양으로 옮긴다. 「조치 필요」의 사유는 자동 계획이 끝났으면 `worklistReasons`, 아니면
 * `autoPlan.reasons`다. `worklistState`를 싣지 않는 서버에서는 자동 계획 결과로만 가른다.
 */
export const deriveWorklistState = (
  order: Pick<ProductionOrderFact, 'statusCode' | 'autoPlan' | 'worklistState' | 'worklistReasons'>,
): WorklistDerived => {
  const autoPlan = order.autoPlan;
  const state: ProcessState =
    order.worklistState ??
    (order.statusCode === 'CANCELLED'
      ? 'CANCELLED'
      : autoPlan === null
        ? 'BEFORE_PLAN'
        : autoPlan.status === 'NEEDS_REVIEW'
          ? 'ACTION_REQUIRED'
          : 'RELEASE_PENDING');
  if (state !== 'ACTION_REQUIRED') return { state, reasons: [] };
  if (order.worklistReasons.length > 0) return { state, reasons: [...order.worklistReasons] };
  return { state, reasons: (autoPlan?.reasons ?? []).map((code) => ({ code })) };
};

/** 사유와 단계의 대응(C-17). 처리 화면은 데이터의 첫 미완료 단계로 열고, 이 표는 구성안과 시험이 쓴다. */
export const REASON_STEP: Record<WorklistReason, ProcessStepKey> = {
  BOM_MISSING: 'master',
  ROUTING_MISSING: 'master',
  ROUTING_AMBIGUOUS: 'master',
  LINE_UNKNOWN: 'plan',
  PLAN_NOT_CONFIRMED: 'plan',
  QTY_REMAINING: 'plan',
  AUTO_PLAN_RERUN_NEEDED: 'plan',
  NO_LIVE_WORK_ORDER: 'plan',
  WORK_ORDER_LINE_MISSING: 'assign',
  WORK_ORDER_LOCATION_MISSING: 'assign',
  LINE_PLANT_MISMATCH: 'assign',
};

/** 작업함 조회 조건. 「전체」는 거르지 않는다. 서버 질의 `worklistState`로 간다. */
export type WorklistFilter = 'ALL' | 'ACTION_REQUIRED' | 'RELEASE_PENDING';

export const DEFAULT_WORKLIST_FILTER: WorklistFilter = 'ACTION_REQUIRED';
