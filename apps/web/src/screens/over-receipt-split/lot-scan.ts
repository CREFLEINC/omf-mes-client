import { messages } from '@omf-mes/i18n';

import { readDraft, setDraftLot, setDraftQty, type LineDrafts, type LotPart } from './line-draft';
import { parseMaterialLotNo } from './lot-format';
import type { ItemCodeResolver } from './split-calc';
import type { PoLineView } from './types';

/**
 * 라벨 스캔 → 줄 채우기. **스캐너가 이 화면의 주된 입력 길이다** — 라벨의 품목코드로 줄을 찾고,
 * 라벨의 수량과 번호를 그 줄에 담는다. 손으로 치는 길은 그대로 남는다.
 *
 * | 그 줄의 상태 | 담는 곳 |
 * | --- | --- |
 * | 정량분 LOT 이 비어 있다 | 정량분 LOT. 수량이 비어 있으면 라벨 수량을 넣는다 |
 * | 정량분은 찼고 초과분 LOT 이 비어 있다 | 초과분 LOT. **라벨 수량을 더한다** — 둘째 라벨은 더 온 꾸러미다 |
 * | 둘 다 찼다 | 담지 않는다 — 칸을 비우고 다시 스캔하라고 말한다 |
 *
 * 같은 품목의 줄이 여럿이면 **정량분 LOT 이 빈 첫 줄**부터 채운다.
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

const addQtyText = (current: string, add: number): string => {
  const base = Number(current.trim());

  return Number.isFinite(base) && base > 0 ? String(base + add) : String(add);
};

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
  const place = (line: PoLineView, part: LotPart): ScanResult => {
    const draft = readDraft(drafts, line.purchaseOrderLineId);
    const qtyText =
      part === 'normal' && draft.qtyText.trim() !== ''
        ? draft.qtyText
        : part === 'normal'
          ? String(parsed.qty)
          : addQtyText(draft.qtyText, parsed.qty);
    const next = setDraftLot(
      setDraftQty(drafts, line.purchaseOrderLineId, qtyText),
      line.purchaseOrderLineId,
      part,
      { lotNo, labelMissing: false, reasonCode: '' },
    );

    return {
      drafts: next,
      note: t.scan.added(line.lineNo, formatQty(parsed.qty), part),
      applied: true,
    };
  };

  const normalOpen = candidates.find(
    (line) => readDraft(drafts, line.purchaseOrderLineId).lot.lotNo.trim() === '',
  );
  if (normalOpen !== undefined) return place(normalOpen, 'normal');

  const excessOpen = candidates.find(
    (line) => readDraft(drafts, line.purchaseOrderLineId).excessLot.lotNo.trim() === '',
  );
  if (excessOpen !== undefined) return place(excessOpen, 'excess');

  const first = candidates[0];

  return {
    drafts,
    note: first === undefined ? t.scan.invalid : t.scan.bothFilled(first.lineNo),
    applied: false,
  };
};
