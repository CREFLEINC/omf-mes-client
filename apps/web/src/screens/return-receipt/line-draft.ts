import { messages } from '@omf-mes/i18n';

import { formatQty, type ReturnLineSource } from './types';

/**
 * 반품 라인 초안 — 근원(배분 또는 LOT) + 사용자가 적은 반품 수량.
 *
 * 수량은 **문자열로 든다.** 입력 도중의 「1.」 같은 값을 숫자로 접으면 칸이 사용자와 다투고,
 * 빈 칸과 0 을 가를 수 없다. 숫자로 바꾸는 것은 검증과 본문 조립 때 한 번이다.
 */
export interface LineDraft {
  source: ReturnLineSource;
  qtyText: string;
}

/** 원 출하의 배분은 **비운 채** 시작한다 — 무엇이 돌아왔는지는 사용자가 안다. 전량 반품이 기본이 아니다. */
export const toLineDrafts = (sources: readonly ReturnLineSource[]): LineDraft[] =>
  sources.map((source) => ({ source, qtyText: '' }));

/** 숫자로 읽는다. 비었으면 `null`, 숫자가 아니면 `NaN`. */
export const parseQty = (text: string): number | null => {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  return Number(trimmed.replace(/,/g, ''));
};

/** 줄마다 잘못된 것. 키는 줄의 `source.key`. 비거나 0 인 줄은 오류가 아니다 — 「이 줄은 안 돌아왔다」다. */
export const validateLines = (drafts: readonly LineDraft[]): Record<string, string> => {
  const t = messages.returnReceipt.lines;
  const errors: Record<string, string> = {};

  for (const draft of drafts) {
    const qty = parseQty(draft.qtyText);
    if (qty === null || qty === 0) continue;
    if (Number.isNaN(qty)) {
      errors[draft.source.key] = t.qtyNotNumber;
    } else if (qty < 0) {
      errors[draft.source.key] = t.qtyTooSmall;
    } else if (draft.source.shippedQty !== null && qty > draft.source.shippedQty) {
      errors[draft.source.key] = t.qtyExceeds(formatQty(draft.source.shippedQty));
    }
  }

  return errors;
};

export interface ActiveLine {
  source: ReturnLineSource;
  qty: number;
}

/** 실제로 보낼 줄 — 수량이 1 이상이고 오류가 없는 줄. */
export const activeLines = (drafts: readonly LineDraft[]): ActiveLine[] => {
  const errors = validateLines(drafts);

  return drafts.flatMap((draft) => {
    const qty = parseQty(draft.qtyText);
    if (qty === null || Number.isNaN(qty) || qty <= 0) return [];
    if (errors[draft.source.key] !== undefined) return [];
    return [{ source: draft.source, qty }];
  });
};

/** 늘어날 재고 — 단위가 하나일 때만 합이 뜻을 갖는다. 단위가 섞이면 `null`. */
export const totalQty = (lines: readonly ActiveLine[]): { qty: number; uomId: number } | null => {
  if (lines.length === 0) return null;
  const uomId = lines[0]?.source.uomId;
  if (uomId === undefined || lines.some((line) => line.source.uomId !== uomId)) return null;

  return { qty: lines.reduce((sum, line) => sum + line.qty, 0), uomId };
};

export const setLineQty = (
  drafts: readonly LineDraft[],
  key: string,
  qtyText: string,
): LineDraft[] => drafts.map((draft) => (draft.source.key === key ? { ...draft, qtyText } : draft));

/** 직접 찾은 LOT 을 줄에 더한다. **같은 LOT 은 두 번 더하지 않는다** — 더했으면 `null`, 있었으면 그 줄. */
export const addLineSource = (
  drafts: readonly LineDraft[],
  source: ReturnLineSource,
): { drafts: LineDraft[]; duplicate: LineDraft | null } => {
  const existing = drafts.find((draft) => draft.source.lotId === source.lotId);
  if (existing !== undefined) return { drafts: [...drafts], duplicate: existing };

  return { drafts: [...drafts, { source, qtyText: '' }], duplicate: null };
};

export const removeLine = (drafts: readonly LineDraft[], key: string): LineDraft[] =>
  drafts.filter((draft) => draft.source.key !== key);

export const hasLineInput = (drafts: readonly LineDraft[]): boolean =>
  drafts.some((draft) => draft.qtyText.trim() !== '');
