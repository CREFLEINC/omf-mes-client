import { messages } from '@omf-mes/i18n';

import type { PoLineView } from './types';

/**
 * 라인별 입력 초안 — **문자열 그대로 든다.**
 *
 * 사용자가 치는 도중의 값(「6」·「6.」·「abc」)을 수량으로 강제하면 지우는 중간에 값이 튄다.
 * 수량으로 읽는 것은 `parseQty`가 **읽는 자리에서** 한 번 한다.
 *
 * **발주 라인 하나에 전표 줄 하나 · LOT 하나다**(서버 장부 P-100). 발주보다 많이 와도 줄을 가르지 않는다 —
 * LOT 은 IQC 검사 단위라 한 라벨을 둘로 나누지 않고, 그 줄의 초과 몫(`excessQty`)만 P/O 에 넣지 않는다.
 */

const t = messages.overReceiptSplit;

/** 한 전표 줄의 공급사 LOT 입력. */
export interface LotDraft {
  /** 스캔하거나 받아 적은 번호. */
  lotNo: string;
  /**
   * 라벨이 실물에 없다. 번호를 함께 넣었으면 「번호는 알지만 라벨은 안 붙었다」
   * (`supplierLotLabelAttached=false`), 번호도 없으면 「LOT 없음」(`supplierLotMissing=true`)이다.
   */
  labelMissing: boolean;
  /** LOT 없음일 때의 대체 사유(`SUBSTITUTE_LOT_REASON`). */
  reasonCode: string;
}

export const EMPTY_LOT_DRAFT: LotDraft = { lotNo: '', labelMissing: false, reasonCode: '' };

export interface LineDraft {
  qtyText: string;
  lot: LotDraft;
}

export const EMPTY_LINE_DRAFT: LineDraft = { qtyText: '', lot: EMPTY_LOT_DRAFT };

/** 발주 라인 번호 → 초안. 없는 번호는 빈 초안으로 읽는다. */
export type LineDrafts = Readonly<Record<number, LineDraft>>;

export type QtyParse =
  { kind: 'empty' } | { kind: 'invalid'; message: string } | { kind: 'qty'; value: number };

/**
 * 친 글자를 수량으로 읽는다. **빈 칸은 오류가 아니다** — 이번에 받지 않는 줄이다.
 * 0 과 음수는 계약이 막는다(`exclusiveMinimum: 0`).
 */
export const parseQty = (raw: string): QtyParse => {
  const text = raw.trim();

  if (text === '') return { kind: 'empty' };

  const value = Number(text);

  if (!Number.isFinite(value)) return { kind: 'invalid', message: t.errors.qtyNotNumber };
  if (value <= 0) return { kind: 'invalid', message: t.errors.qtyNotPositive };

  return { kind: 'qty', value };
};

/** 라인 응답으로 초안을 새로 만든다 — 앞서 친 값은 남지 않는다(수명 표 4행). */
export const createDrafts = (lines: readonly PoLineView[]): LineDrafts =>
  Object.fromEntries(lines.map((line) => [line.purchaseOrderLineId, EMPTY_LINE_DRAFT]));

export const readDraft = (drafts: LineDrafts, purchaseOrderLineId: number): LineDraft =>
  drafts[purchaseOrderLineId] ?? EMPTY_LINE_DRAFT;

export const readDraftQty = (drafts: LineDrafts, purchaseOrderLineId: number): string =>
  readDraft(drafts, purchaseOrderLineId).qtyText;

export const setDraftQty = (
  drafts: LineDrafts,
  purchaseOrderLineId: number,
  text: string,
): LineDrafts => ({
  ...drafts,
  [purchaseOrderLineId]: { ...readDraft(drafts, purchaseOrderLineId), qtyText: text },
});

export const setDraftLot = (
  drafts: LineDrafts,
  purchaseOrderLineId: number,
  patch: Partial<LotDraft>,
): LineDrafts => {
  const draft = readDraft(drafts, purchaseOrderLineId);

  return { ...drafts, [purchaseOrderLineId]: { ...draft, lot: { ...draft.lot, ...patch } } };
};

/** 수량을 하나라도 넣었는가. */
export const hasAnyQty = (drafts: LineDrafts): boolean =>
  Object.values(drafts).some((draft) => draft.qtyText.trim() !== '');

const hasLotInput = (lot: LotDraft): boolean =>
  lot.lotNo.trim() !== '' || lot.labelMissing || lot.reasonCode !== '';

/** 버릴 것이 있는가 — 수량이든 LOT 이든 한 칸이라도 손댔으면 참이다. */
export const hasAnyLineInput = (drafts: LineDrafts): boolean =>
  Object.values(drafts).some((draft) => draft.qtyText.trim() !== '' || hasLotInput(draft.lot));
