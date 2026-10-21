import { messages } from '@omf-mes/i18n';

import type { SplitCounts } from './validation';

/**
 * 단계 안내 — **화면 상태에서 지금 할 일을 정한다**(사용자 지시 2026-10-21 「절차를 몰라도 진행」).
 *
 * 단계는 안내일 뿐이다 — 어떤 단추도 숨기거나 잠그지 않는다. 사람이 뒤 단계의 칸을 먼저 채워도
 * 아무 일도 막지 않고, 안내만 그 사람이 서 있는 자리로 따라간다.
 *
 * | 단계 | 조건 |
 * | --- | --- |
 * | 발주 선택 | 고른 발주가 없다 |
 * | 도착 수량 · LOT | 실릴 줄이 없거나, 수량·LOT 에 고칠 것이 있다 |
 * | 입하 정보 | 머리 입력(입하 일시 등)이 아직 모자라다 |
 * | 등록 | 다 찼다 — 누르면 된다 |
 */

const t = messages.overReceiptSplit;

export type GuideStep = 'select' | 'lines' | 'info' | 'register';

export const GUIDE_STEPS: readonly GuideStep[] = ['select', 'lines', 'info', 'register'];

export interface GuideInput {
  hasOrder: boolean;
  counts: SplitCounts;
  hasLineError: boolean;
  /** 머리 입력을 지금 검증한 결과. 비어 있으면 모자란 것이 없다. */
  headerErrorCount: number;
}

export const guideStep = (input: GuideInput): GuideStep => {
  if (!input.hasOrder) return 'select';
  if (input.counts.lines === 0 || input.hasLineError) return 'lines';
  if (input.headerErrorCount > 0) return 'info';

  return 'register';
};

export type GuideStatus = 'complete' | 'current' | 'pending';

/** 단계마다 완료 · 진행 중 · 대기 — 지금 단계보다 앞이면 완료, 뒤면 대기. */
export const guideStatuses = (current: GuideStep): Record<GuideStep, GuideStatus> => {
  const index = GUIDE_STEPS.indexOf(current);

  return Object.fromEntries(
    GUIDE_STEPS.map((step, at) => [
      step,
      at < index ? 'complete' : at === index ? 'current' : 'pending',
    ]),
  ) as Record<GuideStep, GuideStatus>;
};

export const guideHint = (step: GuideStep): string => t.guide.hints[step];
