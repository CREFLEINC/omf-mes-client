import type { LotProgress } from './types';

/**
 * 두 버튼의 활성을 정하는 자리. **화면이 아니라 여기서 정한다** — 「완료」와 「미달 마감」의
 * 활성 조건이 서로의 여집합이 아니라서, 두 곳에 흩어 두면 **둘 다 열리는 상태**가 생긴다.
 *
 * ⭐ **미달·정상·초과는 서버가 판정한다**(`LotProgress.completionJudgmentCode`). 화면이 누적과
 * 목표를 직접 비교하지 않는다 — 같은 LOT 을 두 화면이 다르게 판정하면 현장이 어느 쪽을 믿을지
 * 알 수 없다(공유계약 L-2 · `omf-mes#269` 회신).
 *
 * ⛔ **「모른다」를 「0」이나 「달성」으로 다루지 않는다.** 진척을 받지 못했으면 둘 다 닫는다 —
 * 완료는 되돌릴 수 없고, 되돌릴 수 없는 것은 모를 때 열지 않는다(공유계약 F-6).
 */

/** 왜 눌 수 없는가. 화면이 문구를 고르는 열쇠이며, 사유마다 사용자가 할 일이 다르다. */
export type BlockReason =
  | 'gate'
  | 'missingWorker'
  | 'notSelected'
  | 'progressUnknown'
  | 'nothingProduced'
  | 'alreadyCompleted'
  | 'reasonRequired'
  | 'targetNotMet'
  | 'targetMet';

/** 달성 판정 — 서버가 준 값을 그대로 옮긴다. 모르면 `null`. */
export type Achievement = 'UNDER' | 'NORMAL' | 'OVER' | null;

export interface JudgmentInput {
  /** 게이팅이 열렸는가. `canCompleteWork === true` 일 때만 참 */
  gateAllowed: boolean;
  /** 귀속 사번이 있는가. 없으면 서버가 쓰기를 거부한다(D-5) */
  hasWorkerNo: boolean;
  /** 고른 LOT 의 진척. 고르지 않았거나 못 받았으면 `null` */
  progress: LotProgress | null;
  /** 이미 완료된 LOT 인가(`completedAt` 이 채워졌다) */
  alreadyCompleted: boolean;
  /** 고른 미달 사유. 안 골랐으면 `null` */
  reasonCode: string | null;
  /** LOT 을 골랐는가 */
  lotSelected: boolean;
}

export interface Judgment {
  achievement: Achievement;
  /** 「완료 처리」를 열 수 있는가 */
  canComplete: boolean;
  /** 「미달 마감」을 열 수 있는가 */
  canCloseUnder: boolean;
  /** 완료가 막힌 사유. 열려 있으면 `null` */
  completeBlockedBy: BlockReason | null;
  /** 미달 마감이 막힌 사유. 열려 있으면 `null` */
  closeUnderBlockedBy: BlockReason | null;
}

/**
 * 두 버튼에 **공통으로** 걸리는 문턱. 여기서 걸리면 둘 다 닫힌다.
 *
 * 순서가 뜻을 갖는다 — 먼저 걸린 것이 사용자가 **먼저 해결해야 하는 것**이다. 게이팅은 담당자
 * 문의, 사번은 인증, 선택은 목록 조작으로 각각 할 일이 다르다.
 */
const commonBlock = (input: JudgmentInput): BlockReason | null => {
  if (!input.gateAllowed) return 'gate';
  if (!input.hasWorkerNo) return 'missingWorker';
  if (!input.lotSelected) return 'notSelected';
  if (input.alreadyCompleted) return 'alreadyCompleted';
  if (input.progress === null) return 'progressUnknown';
  /*
   * §6 — 「아무것도 안 만든 LOT 은 마감할 것이 없다」. 미달 마감도 열지 않는다: 폐번은 W/O
   * 마감(`W-02-05`)이 하는 일이고 이 화면의 것이 아니다.
   */
  if (input.progress.goodQty <= 0) return 'nothingProduced';

  return null;
};

export const judgeCompletion = (input: JudgmentInput): Judgment => {
  const blocked = commonBlock(input);
  const achievement = input.progress?.completionJudgmentCode ?? null;

  if (blocked !== null) {
    return {
      achievement,
      canComplete: false,
      canCloseUnder: false,
      completeBlockedBy: blocked,
      closeUnderBlockedBy: blocked,
    };
  }

  /*
   * ⭐ **초과 달성을 막지 않는다**(§5-4 · R27). 계획 수량은 상한이 아니다 — 시스템이 계획을
   * 상한으로 강제하면 현장이 기록을 안 남긴다.
   */
  const met = achievement === 'NORMAL' || achievement === 'OVER';

  /*
   * 미달인데 사유를 고르지 않았으면 미달 마감을 열지 않는다(§5-3 · §6). 서버도 400 으로 막지만,
   * 화면이 먼저 막아야 사용자가 **보내기 전에** 안다.
   */
  const reasonMissing = input.reasonCode === null || input.reasonCode.trim() === '';

  return {
    achievement,
    canComplete: met,
    canCloseUnder: !met && !reasonMissing,
    completeBlockedBy: met ? null : 'targetNotMet',
    closeUnderBlockedBy: met ? 'targetMet' : reasonMissing ? 'reasonRequired' : null,
  };
};

/**
 * 달성률을 백분율 정수로. 서버가 준 비율(`0.96`)을 화면의 말(`96%`)로 옮기기만 한다.
 *
 * ⛔ **화면이 다시 계산하지 않는다** — 누적÷목표를 여기서 나누면 서버 판정과 어긋나는 순간
 * 사용자가 「96%인데 왜 완료가 안 되나」를 묻게 된다.
 */
export const toAchievementPercent = (progress: LotProgress | null): number | null =>
  progress === null ? null : Math.round(progress.achievementRate * 100);
