import { messages } from '@omf-mes/i18n';

import { josa } from '../../../patterns/josa';
import type { ProcessStepKey } from '../worklist-model';

/**
 * 처리 화면 단계 판정(T-W-C, C-5). 화면 데이터에서 단계별 완료 여부와 하단 바 문장을 정한다.
 * 처음 여는 단계는 데이터로 정한 첫 미완료 단계다(T-W-C 처음 여는 단계). 사유와 단계의 대응은 구성안 표와 같다.
 * 문장의 `todo`가 참이면 사용자가 할 일이므로 「남은 일:」 머리말을 붙인다(C-5).
 */
const t = messages.erpWorkOrderFlow.process.remaining;

export const STEP_KEYS: ProcessStepKey[] = ['master', 'plan', 'assign', 'release'];

export interface Guidance {
  text: string;
  todo: boolean;
}

export interface StepJudgment {
  complete: boolean;
  /** 이 단계 하단 바 문장. 불러오는 중이면 null. */
  guidance: Guidance | null;
  /** 사용자가 이 화면에서 고칠 수 없는 사유(C-17 「해결할 수 없음」) */
  blockedOutside?: 'bom' | 'routing';
}

const todo = (text: string): Guidance => ({ text, todo: true });
const info = (text: string): Guidance => ({ text, todo: false });
const proceed = (next: string): Guidance => info(t.canProceed(josa(next, '으로/로')));

export const formatQty = (value: number): string =>
  new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 6 }).format(value);

export interface MasterFacts {
  loading: boolean;
  failed: boolean;
  bomCount: number;
  routingCount: number;
  bomSelected: boolean;
  routingSelected: boolean;
  /**
   * 확정된 계획이 있다. 확정 뒤에는 개정을 바꿀 수 없으므로 그 계획의 BOM과 Routing으로 통과한다.
   * 그 개정이 지금은 쓸 수 없는(작성중, 기간 밖) 개정이어도 같다.
   */
  fixedByPlan?: boolean;
}

export const judgeMaster = (facts: MasterFacts, next: string): StepJudgment => {
  if (facts.loading) return { complete: false, guidance: null };
  if (facts.fixedByPlan === true) return { complete: true, guidance: proceed(next) };
  if (facts.failed) return { complete: false, guidance: todo(t.loadFailed) };
  if (facts.bomCount === 0)
    return { complete: false, guidance: todo(t.bomMissing), blockedOutside: 'bom' };
  if (facts.routingCount === 0)
    return { complete: false, guidance: todo(t.routingMissing), blockedOutside: 'routing' };
  if (!facts.bomSelected)
    return { complete: false, guidance: todo(t.select(josa('BOM', '을/를'))) };
  if (!facts.routingSelected)
    return { complete: false, guidance: todo(t.select(josa('Routing', '을/를'))) };
  return { complete: true, guidance: proceed(next) };
};

export interface PlanFacts {
  loading: boolean;
  rowCount: number;
  /** 확정 전 줄 수(새 줄 포함) */
  unconfirmed: number;
  /** 첫 잘못된 칸(계획 이름과 칸 이름) */
  invalid: { plan: string; field: string } | null;
  /** 라인을 고르지 않은 첫 확정 전 계획 */
  missingLine: string | null;
  totalQty: number;
  confirmedQty: number;
  orderQty: number;
}

export interface PlanJudgment extends StepJudgment {
  /** [전개 확정]을 누를 수 있는가 */
  canConfirm: boolean;
}

export const judgePlan = (facts: PlanFacts, next: string): PlanJudgment => {
  if (facts.loading) return { complete: false, canConfirm: false, guidance: null };
  if (facts.rowCount === 0)
    return { complete: false, canConfirm: false, guidance: todo(t.addPlan) };
  if (facts.invalid !== null) {
    return {
      complete: false,
      canConfirm: false,
      guidance: todo(t.enter(facts.invalid.plan, josa(facts.invalid.field, '을/를'))),
    };
  }
  if (facts.missingLine !== null) {
    return { complete: false, canConfirm: false, guidance: todo(t.chooseLine(facts.missingLine)) };
  }
  if (facts.totalQty < facts.orderQty) {
    return {
      complete: false,
      canConfirm: false,
      guidance: todo(t.qtyShort(formatQty(facts.orderQty - facts.totalQty))),
    };
  }
  if (facts.unconfirmed > 0) return { complete: false, canConfirm: true, guidance: proceed(next) };
  if (facts.confirmedQty < facts.orderQty) {
    return {
      complete: false,
      canConfirm: false,
      guidance: todo(t.qtyShort(formatQty(facts.orderQty - facts.confirmedQty))),
    };
  }
  return { complete: true, canConfirm: false, guidance: proceed(next) };
};

export interface AssignFacts {
  loading: boolean;
  pending: number;
  blocked: number;
  /** 편집 중인 W/O에 저장하지 않은 변경이 있으면 그 번호 */
  unsaved: string | null;
  /** 첫 미배정 W/O의 공정과 빈 칸, 칸이 다 찼으면 점검 결과 첫 항목 */
  firstBlocked: { operation: string; field: string | null; finding: string | null } | null;
}

export const judgeAssign = (facts: AssignFacts, next: string): StepJudgment => {
  if (facts.loading) return { complete: false, guidance: info(t.checking) };
  if (facts.unsaved !== null)
    return { complete: false, guidance: todo(t.saveChanges(facts.unsaved)) };
  if (facts.pending === 0) return { complete: false, guidance: todo(t.noWorkOrders) };
  if (facts.blocked > 0) {
    const first = facts.firstBlocked;
    const head = t.unassigned(facts.blocked);
    if (first === null) return { complete: false, guidance: todo(`${head} ${t.pickUnassigned}`) };
    if (first.field !== null) {
      return {
        complete: false,
        guidance: todo(`${head} ${t.choose(first.operation, josa(first.field, '을/를'))}`),
      };
    }
    return {
      complete: false,
      guidance: todo(
        `${head} ${t.resolve(josa(`「${(first.finding ?? '').replace(/\.$/, '')}」`, '을/를'))}`,
      ),
    };
  }
  return { complete: true, guidance: proceed(next) };
};

/**
 * 저장한 뒤 열 다음 미완료 W/O(T-W-C 항목 하나씩 끝내는 흐름). 목록은 공정 순서다.
 * 방금 저장한 W/O가 아직 미완료면 그대로 두고(null), 아니면 그 뒤에서 첫 미완료, 없으면 앞에서 첫 미완료를 고른다.
 * `blockedIds`는 저장 전 판정이라 방금 저장한 W/O는 빼고 본다.
 */
export const nextIncompleteId = (
  orderedIds: readonly number[],
  blockedIds: ReadonlySet<number>,
  savedId: number,
  savedReady: boolean,
): number | null => {
  if (!savedReady) return null;
  const at = orderedIds.indexOf(savedId);
  const rotated = [...orderedIds.slice(at + 1), ...orderedIds.slice(0, Math.max(at, 0))];
  return rotated.find((id) => id !== savedId && blockedIds.has(id)) ?? null;
};

export const judgeRelease = (missingLot: string | null): Guidance =>
  missingLot === null ? info(t.releaseFinal) : todo(t.enterLot(missingLot));

/** 첫 미완료 단계. 모두 완료면 마지막(배포 확인). */
export const firstOpenStep = (
  judgments: Record<Exclude<ProcessStepKey, 'release'>, StepJudgment>,
): ProcessStepKey => {
  if (!judgments.master.complete) return 'master';
  if (!judgments.plan.complete) return 'plan';
  if (!judgments.assign.complete) return 'assign';
  return 'release';
};

/** 이 단계로 갈 수 있는가. 앞 단계가 모두 완료여야 한다. */
export const canEnter = (
  step: ProcessStepKey,
  judgments: Record<Exclude<ProcessStepKey, 'release'>, StepJudgment>,
): boolean => {
  const index = STEP_KEYS.indexOf(step);
  return STEP_KEYS.slice(0, index).every(
    (key) => key === 'release' || judgments[key as Exclude<ProcessStepKey, 'release'>].complete,
  );
};
