import type { ReceiptDraft } from './types';

/**
 * 입고 정보 입력 순서(사용자 지시 2026-09-19) — 앞 칸을 채워야 다음 칸이 열린다.
 *
 * 순서는 입고 처리 버튼이 막힌 이유를 고르는 차례(`postBlockReason`)와 같다: 어디에(창고 → 위치) →
 * 무엇으로(코드 넷) → 언제(일시). 필수값·검증 규칙은 바꾸지 않는다 — 칸을 여는 차례만 정한다.
 * 선택 칸(사유·비고)은 필수 코드를 다 고른 뒤 입고 일시와 함께 열린다.
 */
export const POST_STEPS = [
  'warehouse',
  'location',
  'receiptType',
  'sourceDocumentType',
  'qualityStatus',
  'inventoryStatus',
  'receiptDatetime',
] as const;

export type PostStep = (typeof POST_STEPS)[number];

const isFilled = (draft: ReceiptDraft, step: PostStep): boolean => {
  switch (step) {
    case 'warehouse':
      return draft.warehouse !== '';
    case 'location':
      return draft.location !== '';
    case 'receiptDatetime':
      return draft.receiptDatetime !== '';
    default:
      return draft.codes[step].trim() !== '';
  }
};

/** 지금 채울 칸. 모두 채웠으면 `null`. */
export const currentPostStep = (draft: ReceiptDraft): PostStep | null =>
  POST_STEPS.find((step) => !isFilled(draft, step)) ?? null;

/** 이 칸이 열려 있는가 — 앞 칸이 모두 채워졌으면 열린다(이미 채운 칸은 계속 고칠 수 있다). */
export const isPostStepOpen = (draft: ReceiptDraft, step: PostStep): boolean => {
  const current = currentPostStep(draft);

  return current === null || POST_STEPS.indexOf(step) <= POST_STEPS.indexOf(current);
};

/** 선택 칸(사유·비고)이 열려 있는가 — 입고 일시 칸과 함께 열린다. */
export const isOptionalPostFieldOpen = (draft: ReceiptDraft): boolean =>
  isPostStepOpen(draft, 'receiptDatetime');

/** 칸을 찾는 클래스 — 다음 칸으로 포커스를 옮길 때 쓴다. */
export const postStepClass = (step: PostStep): string => `goods-receipt-step-${step}`;
