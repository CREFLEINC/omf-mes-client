import { messages } from '@omf-mes/i18n';

import { readDraft, setDraftLot, setDraftQty, type LineDrafts } from './line-draft';
import { parseMaterialLotNo } from './lot-format';
import type { ItemCodeResolver } from './split-calc';
import type { PoLineView } from './types';

/**
 * 라벨 스캔 → 줄 채우기. **스캐너가 이 화면의 주된 입력 길이다** — 라벨의 품목코드로 줄을 찾고,
 * 라벨의 수량과 번호를 그 줄에 담는다. 손으로 치는 길은 그대로 남는다.
 *
 * | 그 줄의 상태 | 담는 곳 |
 * | --- | --- |
 * | LOT 이 비어 있다 | 그 줄의 LOT. 수량이 비어 있으면 라벨 수량을 넣는다 |
 * | LOT 이 찼다 | 담지 않는다 — 줄 하나에 라벨 하나다(서버 장부 P-100). 칸을 비우고 다시 스캔하라고 말한다 |
 *
 * 같은 품목의 줄이 여럿이면 **LOT 이 빈 첫 줄**부터 채운다. 발주보다 많이 온 몫은 수량에서 화면이 가른다 —
 * 라벨을 둘로 나누지 않는다.
 */

const t = messages.overReceiptSplit;

export interface ScanResult {
  drafts: LineDrafts;
  /** 사용자에게 보일 결과 한 줄. 담았으면 어디에, 못 담았으면 왜. */
  note: string;
  /** 담았는가. 거짓이면 `drafts` 는 그대로다. */
  applied: boolean;
}

const formatQty = (value: number): string => value.toLocaleString();

export const applyLotScan = (
  text: string,
  lines: readonly PoLineView[],
  drafts: LineDrafts,
  itemCodeOf: ItemCodeResolver,
): ScanResult => {
  const parsed = parseMaterialLotNo(text);
  if (parsed === null) return { drafts, note: t.scan.invalid, applied: false };

  const candidates = lines.filter((line) => itemCodeOf(line.itemId) === parsed.itemCode);
  if (candidates.length === 0) {
    const pending = lines.some((line) => itemCodeOf(line.itemId) === null);

    return {
      drafts,
      note: pending ? t.scan.itemsPending : t.scan.notFound(parsed.itemCode),
      applied: false,
    };
  }

  const lotNo = text.trim();
  const open = candidates.find(
    (line) => readDraft(drafts, line.purchaseOrderLineId).lot.lotNo.trim() === '',
  );

  if (open === undefined) {
    const first = candidates[0];

    return {
      drafts,
      note: first === undefined ? t.scan.invalid : t.scan.lotFilled(first.lineNo),
      applied: false,
    };
  }

  const draft = readDraft(drafts, open.purchaseOrderLineId);
  const qtyText = draft.qtyText.trim() !== '' ? draft.qtyText : String(parsed.qty);
  const next = setDraftLot(
    setDraftQty(drafts, open.purchaseOrderLineId, qtyText),
    open.purchaseOrderLineId,
    { lotNo, labelMissing: false, reasonCode: '' },
  );

  return { drafts: next, note: t.scan.added(open.lineNo, formatQty(parsed.qty)), applied: true };
};
