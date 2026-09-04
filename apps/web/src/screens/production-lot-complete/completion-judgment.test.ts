import { describe, expect, it } from 'vitest';

import { judgeCompletion, toAchievementPercent, type JudgmentInput } from './completion-judgment';
import type { LotProgress } from './types';

const progress = (goodQty: number, code: LotProgress['completionJudgmentCode']): LotProgress => ({
  goodQty,
  achievementRate: goodQty / 500,
  varianceQty: goodQty - 500,
  completionJudgmentCode: code,
});

/** 전부 열린 상태. 각 시험이 **한 칸만** 바꿔 그 칸의 힘을 잰다. */
const open = (overrides: Partial<JudgmentInput> = {}): JudgmentInput => ({
  gateAllowed: true,
  hasWorkerNo: true,
  progress: progress(500, 'NORMAL'),
  alreadyCompleted: false,
  reasonCode: null,
  lotSelected: true,
  ...overrides,
});

describe('judgeCompletion — 공통 문턱', () => {
  it('게이팅이 닫히면 두 버튼이 모두 막힌다', () => {
    const judgment = judgeCompletion(open({ gateAllowed: false }));

    expect(judgment.canComplete).toBe(false);
    expect(judgment.canCloseUnder).toBe(false);
    expect(judgment.completeBlockedBy).toBe('gate');
    expect(judgment.closeUnderBlockedBy).toBe('gate');
  });

  it('사번이 없으면 두 버튼이 모두 막힌다', () => {
    const judgment = judgeCompletion(open({ hasWorkerNo: false }));

    expect(judgment.canComplete).toBe(false);
    expect(judgment.canCloseUnder).toBe(false);
    expect(judgment.completeBlockedBy).toBe('missingWorker');
  });

  it('LOT 을 고르지 않으면 두 버튼이 모두 막힌다', () => {
    const judgment = judgeCompletion(open({ lotSelected: false }));

    expect(judgment.completeBlockedBy).toBe('notSelected');
  });

  it('이미 완료된 LOT 은 두 버튼이 모두 막힌다', () => {
    const judgment = judgeCompletion(open({ alreadyCompleted: true }));

    expect(judgment.completeBlockedBy).toBe('alreadyCompleted');
  });

  /** ⛔ 「모른다」를 「통과」로 다루지 않는다(F-6) — 완료는 되돌릴 수 없다. */
  it('진척을 받지 못하면 두 버튼이 모두 막힌다', () => {
    const judgment = judgeCompletion(open({ progress: null }));

    expect(judgment.canComplete).toBe(false);
    expect(judgment.canCloseUnder).toBe(false);
    expect(judgment.completeBlockedBy).toBe('progressUnknown');
  });

  /** §6 — 아무것도 안 만든 LOT 은 마감할 것이 없다. 폐번은 W/O 마감 소관이다. */
  it('누적 양품이 0 이면 미달 마감도 열지 않는다', () => {
    const judgment = judgeCompletion(open({ progress: progress(0, 'UNDER'), reasonCode: 'SHORT' }));

    expect(judgment.canComplete).toBe(false);
    expect(judgment.canCloseUnder).toBe(false);
    expect(judgment.closeUnderBlockedBy).toBe('nothingProduced');
  });
});

describe('judgeCompletion — 두 결말이 갈리는 자리', () => {
  it('목표를 채우면 완료만 열린다', () => {
    const judgment = judgeCompletion(open({ progress: progress(500, 'NORMAL') }));

    expect(judgment.canComplete).toBe(true);
    expect(judgment.canCloseUnder).toBe(false);
    expect(judgment.closeUnderBlockedBy).toBe('targetMet');
  });

  /** §5-4 · R27 — 계획값은 상한이 아니다. 막으면 현장이 기록을 안 남긴다. */
  it('초과 달성도 완료를 막지 않는다', () => {
    const judgment = judgeCompletion(open({ progress: progress(520, 'OVER') }));

    expect(judgment.canComplete).toBe(true);
    expect(judgment.achievement).toBe('OVER');
  });

  it('미달이면 완료를 열지 않는다', () => {
    const judgment = judgeCompletion(open({ progress: progress(480, 'UNDER') }));

    expect(judgment.canComplete).toBe(false);
    expect(judgment.completeBlockedBy).toBe('targetNotMet');
  });

  it('미달인데 사유를 고르지 않으면 미달 마감도 열지 않는다', () => {
    const judgment = judgeCompletion(open({ progress: progress(480, 'UNDER'), reasonCode: null }));

    expect(judgment.canCloseUnder).toBe(false);
    expect(judgment.closeUnderBlockedBy).toBe('reasonRequired');
  });

  it('공백만 고른 사유는 고르지 않은 것으로 본다', () => {
    const judgment = judgeCompletion(open({ progress: progress(480, 'UNDER'), reasonCode: '   ' }));

    expect(judgment.canCloseUnder).toBe(false);
    expect(judgment.closeUnderBlockedBy).toBe('reasonRequired');
  });

  it('미달에 사유를 고르면 미달 마감만 열린다', () => {
    const judgment = judgeCompletion(
      open({ progress: progress(480, 'UNDER'), reasonCode: 'MATERIAL_SHORTAGE' }),
    );

    expect(judgment.canCloseUnder).toBe(true);
    expect(judgment.canComplete).toBe(false);
  });

  /** ⛔ 두 결말이 동시에 열리는 상태가 있으면 안 된다 — 그것이 버튼을 나눈 이유를 무너뜨린다. */
  it('어느 경우에도 두 버튼이 동시에 열리지 않는다', () => {
    const cases: JudgmentInput[] = [
      open({ progress: progress(480, 'UNDER'), reasonCode: 'SHORT' }),
      open({ progress: progress(500, 'NORMAL'), reasonCode: 'SHORT' }),
      open({ progress: progress(520, 'OVER'), reasonCode: 'SHORT' }),
      open({ progress: progress(480, 'UNDER') }),
      open({ progress: null }),
    ];

    for (const input of cases) {
      const judgment = judgeCompletion(input);

      expect(judgment.canComplete && judgment.canCloseUnder).toBe(false);
    }
  });
});

describe('toAchievementPercent', () => {
  it('서버가 준 비율을 백분율로 옮긴다', () => {
    expect(toAchievementPercent(progress(480, 'UNDER'))).toBe(96);
  });

  it('진척이 없으면 null 이다 — 0% 가 아니다', () => {
    expect(toAchievementPercent(null)).toBeNull();
  });
});
