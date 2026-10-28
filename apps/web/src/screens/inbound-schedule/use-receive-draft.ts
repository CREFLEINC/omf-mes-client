import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';

import { checkQty, isCheckable, isEditable, selectAllOf, type ReceivePick } from './receive-entry';
import type { InboundScheduleLine } from './types';

const t = messages.inboundSchedule;

/** 행을 눌러 받는 중인 줄 — 그 줄의 이번 입하 수량 입력. */
export interface ReceiveEditing {
  purchaseOrderLineId: number;
  qtyText: string;
}

export interface ReceiveDraft {
  checked: ReadonlySet<number>;
  /** 라벨이 발행된 줄 — 행을 눌러 받지 못한다. */
  isLabeled: (purchaseOrderLineId: number) => boolean;
  editing: ReceiveEditing | null;
  /** 표 위 한 줄 — 「모두 선택」이 뺀 부분 입하 수. */
  note: string | null;
  /** 머리칸 체크 — 「모두 선택」이 고를 줄이 다 체크됐는가 · 하나라도 체크됐는가. */
  allChecked: boolean;
  someChecked: boolean;
  toggle: (purchaseOrderLineId: number) => void;
  toggleAll: () => void;
  startEdit: (line: InboundScheduleLine) => void;
  changeQty: (text: string) => void;
  cancelEdit: () => void;
  /** 체크한 줄 — 남은 수량 그대로. */
  checkedPicks: () => ReceivePick[];
  /** 편집 중인 줄 — 수량이 맞지 않으면 그 사유. */
  editPick: () => { pick: ReceivePick } | { error: string } | null;
  reset: () => void;
}

const NONE: ReadonlySet<number> = new Set();
const NO_LABELED: ReadonlySet<number> = new Set();

/**
 * 라인 표에서 바로 받는 입하의 **초안** — 체크한 줄과 행을 눌러 고친 줄 하나. 고른 발주가 바뀌면 비운다(앞 발주의 체크가
 * 다음 발주에 남지 않는다). 등록이 끝나면 부르는 쪽이 `reset` 한다.
 *
 * 한 줄을 눌러 고치기 시작하면 그 줄의 체크는 푼다 — 같은 줄이 두 수량으로 두 번 들어가지 않게.
 */
export const useReceiveDraft = (
  lines: readonly InboundScheduleLine[],
  orderId: number | null,
  /** 라벨이 발행된(LOT 이 붙은) 발주 라인(`stage.ts` `labeledLineIds`). 진행 자료가 없으면 빈 묶음이다. */
  labeled: ReadonlySet<number> = NO_LABELED,
): ReceiveDraft => {
  const [checkedIds, setChecked] = useState<ReadonlySet<number>>(NONE);
  const [editing, setEditing] = useState<ReceiveEditing | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const reset = (): void => {
    setChecked(NONE);
    setEditing(null);
    setNote(null);
  };

  /* 발주가 바뀔 때만 비운다 — `reset` 은 렌더마다 새 함수라 의존성에 두면 매 렌더 비운다. */
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 발주가 바뀔 때만 비운다(위 주석)
  }, [orderId]);

  /*
   * 체크는 **지금 라인으로 다시 거른다.** 다시 불러온 뒤 체크할 수 없게 된 줄(다른 곳에서 받았거나 초과분을 연결해 남은
   * 수량이 0)은 체크로 보이지 않는다 — 체크칸은 잠겨 풀 수 없는데 「선택 N건」과 등록 단추만 남는 일이 없게.
   */
  const checked: ReadonlySet<number> = new Set(
    lines
      .filter((line) => checkedIds.has(line.purchaseOrderLineId) && isCheckable(line))
      .map((line) => line.purchaseOrderLineId),
  );
  const selectable = selectAllOf(lines);
  const allChecked = selectable.ids.length > 0 && selectable.ids.every((id) => checked.has(id));
  const lineOf = (id: number): InboundScheduleLine | undefined =>
    lines.find((line) => line.purchaseOrderLineId === id);

  return {
    checked,
    isLabeled: (id) => labeled.has(id),
    editing,
    note,
    allChecked,
    someChecked: checked.size > 0,
    toggle: (id) => {
      const line = lineOf(id);
      if (line === undefined || !isCheckable(line)) return;
      setNote(null);
      if (editing?.purchaseOrderLineId === id) setEditing(null);
      setChecked((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);

        return next;
      });
    },
    toggleAll: () => {
      if (allChecked) {
        setChecked(NONE);
        setNote(null);

        return;
      }
      setChecked((prev) => new Set([...prev, ...selectable.ids]));
      if (editing !== null && selectable.ids.includes(editing.purchaseOrderLineId)) {
        setEditing(null);
      }
      setNote(
        selectable.skippedPartial > 0 ? t.receive.partialSkipped(selectable.skippedPartial) : null,
      );
    },
    startEdit: (line) => {
      if (!isEditable(line, labeled.has(line.purchaseOrderLineId))) return;
      if (editing?.purchaseOrderLineId === line.purchaseOrderLineId) return;
      setNote(null);
      setEditing({
        purchaseOrderLineId: line.purchaseOrderLineId,
        /* 흔한 경우(남은 수량 그대로)를 채워 둔다. 다 받은 줄은 비운다 — 넣는 수가 곧 초과분이다. */
        qtyText: line.remainingQty > 0 ? String(line.remainingQty) : '',
      });
      setChecked((prev) => {
        if (!prev.has(line.purchaseOrderLineId)) return prev;
        const next = new Set(prev);
        next.delete(line.purchaseOrderLineId);

        return next;
      });
    },
    changeQty: (text) => {
      setEditing((prev) => (prev === null ? prev : { ...prev, qtyText: text }));
    },
    cancelEdit: () => {
      setEditing(null);
    },
    checkedPicks: () =>
      lines
        .filter((line) => checked.has(line.purchaseOrderLineId))
        .map((line) => ({ line, qty: line.remainingQty })),
    editPick: () => {
      if (editing === null) return null;
      const line = lineOf(editing.purchaseOrderLineId);
      if (line === undefined) return null;
      /* 고치는 사이에 라벨이 발행됐다(다시 읽은 진행) — 수량을 정해 받지 않는다. */
      if (labeled.has(line.purchaseOrderLineId)) return { error: t.receive.errors.labelIssued };
      const qty = checkQty(editing.qtyText);

      switch (qty.kind) {
        case 'qty':
          return { pick: { line, qty: qty.value } };
        case 'empty':
          return { error: t.receive.errors.qtyEmpty };
        case 'notNumber':
          return { error: t.receive.errors.qtyNotNumber };
        case 'notPositive':
          return { error: t.receive.errors.qtyNotPositive };
      }
    },
    reset,
  };
};
