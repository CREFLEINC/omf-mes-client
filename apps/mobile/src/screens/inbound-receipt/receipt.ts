import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import {
  codeMismatchOf,
  parseMaterialLotNo,
  type MaterialLotCodeMismatch,
  type MaterialLotCodes,
} from '../../patterns/material-lot-no';
import { createIdempotencyKey, type OutboxDraft } from '../../patterns/outbox';

export type PurchaseOrder = components['schemas']['PurchaseOrder'];
export type PurchaseOrderLine = components['schemas']['PurchaseOrderLine'];
export type InboundReceiptCreate = components['schemas']['InboundReceiptCreate'];
export type InboundReceiptLineUpsert = components['schemas']['InboundReceiptLineUpsert'];
export type InboundReceiptSplitRequest = components['schemas']['InboundReceiptSplitRequest'];
export type SplitMode = InboundReceiptSplitRequest['mode'];

/**
 * 입하 검증 세 갈래.
 *
 * 허용치는 발주 라인이 갖고 있고 서버가 다시 판정하지 않는다. 화면이 판정한 결과를 사람에게
 * 먼저 보인 뒤에 다음으로 넘긴다 - 조용히 넘기면 왜 다른 화면에 왔는지 알 수 없다.
 */
export const NORMAL = 'normal';
export const OVER = 'over';
export const UNDER = 'under';

export type Verdict = typeof NORMAL | typeof OVER | typeof UNDER;

/**
 * 서버가 수량을 담는 자릿수. 여기까지는 값이 살아 있고 그 아래는 서버가 잘라 버린다.
 */
const STORED_SCALE = 1e6;

/**
 * 수량 셈을 정수로 옮겨 한다.
 *
 * 배정밀도에서 8.01 - 8 은 0.009999999999999787 이다. 그 값이 화면에 그대로 나오고 요청
 * 본문의 수량으로도 나가는데, 서버는 6자리로 반올림해 받으므로 잘못된 값이 거절되지 않고
 * 그대로 원장에 남는다.
 */
const exact = (compute: (scale: (value: number) => number) => number): number =>
  compute((value) => Math.round(value * STORED_SCALE)) / STORED_SCALE;

/**
 * 아직 안 온 수량. 한 발주에 여러 번 도착할 수 있어 발주 총량과 견주면 두 방향으로 틀린다.
 *
 * 분할 납품의 마지막 회차가 부족으로 읽히고, 누적이 총량을 넘긴 것도 부족으로 읽힌다.
 * 뒤엣것이 더 무겁다 - 서버가 거부할 초과인데 화면이 입하 오류 등록으로 보낸다.
 */
export const remainingQtyOf = (line: PurchaseOrderLine, queuedQty = 0): number =>
  exact((to) => to(line.orderedQty) - to(line.receivedQty) - to(queuedQty));

/**
 * 이번 도착까지 받고도 남는 몫.
 *
 * 판정이 견주는 남은 예정은 이번 도착을 빼기 전이다. 부족을 알릴 때 보이는 네 수의
 * 마지막은 이번 것까지 받고도 얼마가 남는지라, 둘을 같은 수로 보이면 사람이 무엇을 고르는지
 * 모른 채 고른다.
 */
export const remainingAfterOf = (
  line: PurchaseOrderLine,
  arrivedQty: number,
  queuedQty = 0,
): number => exact((to) => to(remainingQtyOf(line, queuedQty)) - to(arrivedQty));

export const verdictOf = (line: PurchaseOrderLine, arrivedQty: number, queuedQty = 0): Verdict => {
  const remaining = remainingQtyOf(line, queuedQty);

  if (arrivedQty > exact((to) => to(remaining) + to(line.toleranceOverQty))) {
    return OVER;
  }

  return arrivedQty < exact((to) => to(remaining) - to(line.toleranceUnderQty)) ? UNDER : NORMAL;
};

/** 큐에서 이 화면이 셈에 넣을 만큼만 읽는다. 큐는 화면을 가리지 않고 한 줄로 쌓인다. */
export interface QueuedReceipt {
  path: string;
  body: unknown;
}

export const RECEIPT_PATH = '/logistics/inbound-receipts';
export const SPLIT_RECEIPT_PATH = '/logistics/inbound-receipts:split';

/**
 * 담긴 채 아직 못 간 입하 수량.
 *
 * 서버가 주는 누적 입하에는 큐에 있는 것이 없다. 셈에 넣지 않으면 오프라인에서 같은 발주
 * 라인에 두 번 적었을 때 둘 다 남은 예정 안으로 읽혀, 서버가 거부할 초과가 정상으로 보인다.
 */
export const queuedQtyOf = (entries: QueuedReceipt[], purchaseOrderLineId: number): number =>
  entries
    .flatMap((entry) => {
      const body = entry.body as { lines?: unknown; normal?: { lines?: unknown } } | null;

      if (entry.path === RECEIPT_PATH) {
        return Array.isArray(body?.lines) ? body.lines : [];
      }

      if (entry.path === SPLIT_RECEIPT_PATH) {
        return Array.isArray(body?.normal?.lines) ? body.normal.lines : [];
      }

      return [];
    })
    .reduce((sum: number, raw) => {
      const line = raw as { purchaseOrderLineId?: unknown; receivedQty?: unknown };

      if (line.purchaseOrderLineId !== purchaseOrderLineId) {
        return sum;
      }

      return sum + (typeof line.receivedQty === 'number' ? line.receivedQty : 0);
    }, 0);

export type QtyProblem = 'empty' | 'notNumber' | 'notPositive';

export const qtyProblem = (text: string): QtyProblem | null => {
  const trimmed = text.trim();

  if (trimmed === '') {
    return 'empty';
  }

  const value = Number(trimmed);

  if (!Number.isFinite(value)) {
    return 'notNumber';
  }

  return value <= 0 ? 'notPositive' : null;
};

/** 포장 수는 비워도 되지만 적었다면 0보다 커야 한다. */
export const packageProblem = (text: string): QtyProblem | null =>
  text.trim() === '' ? null : qtyProblem(text);

/**
 * 유효기한이 제조일보다 앞서는가.
 *
 * 둘 다 있을 때만 순서를 본다 - 한쪽이 비어 있으면 견줄 것이 없다.
 */
export const isExpiryBeforeManufactured = (manufactured: string, expiry: string): boolean =>
  manufactured.trim() !== '' && expiry.trim() !== '' && expiry < manufactured;

/** 단말이 정하는 업무 기준일. 서버가 수신 시각으로 다시 잡지 않는다. */
export const businessDateOf = (now: Date): string => {
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

export interface ReceiptDraft {
  /** 스캔 또는 수기로 받은 공급사 LOT 원문. 번호가 없으면 비어 있다. */
  supplierLotNo: string;
  supplierLotMissing: boolean;
  /** 공급사가 준 LOT 라벨이 물건에 실제 부착됐는가. */
  supplierLotLabelAttached: boolean;
  substituteLotReasonCode: string;
  purchaseOrder: PurchaseOrder | null;
  purchaseOrderLine: PurchaseOrderLine | null;
  /**
   * 발주 없이 도착한 건인가.
   *
   * 발주가 없으면 공급사도 품목도 단위도 승계할 곳이 없어 담당자가 고른다. 발주를 고르지
   * 않은 것과 무발주로 넣겠다는 것은 다른 상태다 - 앞엣것은 아직 안 고른 것이고 뒤엣것은
   * 고를 발주가 없다는 뜻이라, 하나로 뭉치면 덜 고른 채로 등록이 열린다.
   */
  unordered: boolean;
  supplierId: number | null;
  itemId: number | null;
  uomId: number | null;
  exceptionTypeCode: string;
  exceptionReason: string;
  deliveryNoteNo: string;
  vehicleNo: string;
  receivedQty: string;
  packageCount: string;
  manufacturedDate: string;
  expiryDate: string;
}

export const canSubmit = (draft: ReceiptDraft, hasWorker: boolean): boolean => {
  if (!hasWorker) {
    return false;
  }

  if (qtyProblem(draft.receivedQty) !== null || packageProblem(draft.packageCount) !== null) {
    return false;
  }

  if (isExpiryBeforeManufactured(draft.manufacturedDate, draft.expiryDate)) {
    return false;
  }

  /* 미부착 분기는 데이터에 있는 구분이다. 사유 없이 참으로 보내면 서버가 거부한다. */
  if (draft.supplierLotMissing && draft.substituteLotReasonCode === '') {
    return false;
  }

  /* 번호가 없는데 부착됐다고 보내면 사전부착 스캔 경로와 충돌한다. */
  if (draft.supplierLotMissing && draft.supplierLotLabelAttached) {
    return false;
  }

  /*
   * 무발주는 승계할 곳이 없어 셋을 사람이 고른다. 하나라도 비면 서버가 거부하는데, 그 거부는
   * 담아 둔 뒤에야 오므로 화면에서 막는다.
   */
  if (draft.unordered) {
    return (
      draft.supplierId !== null &&
      draft.itemId !== null &&
      draft.uomId !== null &&
      draft.exceptionTypeCode.trim() !== '' &&
      draft.exceptionReason.trim() !== ''
    );
  }

  return draft.purchaseOrder !== null && draft.purchaseOrderLine !== null;
};

/**
 * 대체 LOT 사유 선택칸의 **기본값** — 「라벨 미부착」(사용자 지시 2026-09-19 · omf-all-around#34).
 *
 * ⭐ 이 현장에서 사유는 거의 언제나 「라벨이 붙어 오지 않았다」다. 미리 골라 두면 고르는 손을
 *    한 번 던다 — 다른 사유면 그 자리에서 바꾸면 된다.
 *
 * ⛔ **값을 지어내지 않는다.** `NO_LABEL` 은 계약이 적은 초기 시드의 하나이고(공유계약 G-31),
 *    **고객이 값을 늘리거나 줄인다.** 그래서 서버가 준 목록에 그 값이 실제로 있을 때만 고른다
 *    (`defaultSubstituteLotReason`) — 없으면 아무것도 고르지 않고 사람이 고른다.
 */
export const DEFAULT_SUBSTITUTE_LOT_REASON = 'NO_LABEL';

/**
 * 미리 골라 둘 사유. 고를 것이 없으면 `null` 이다.
 *
 * ⛔ **이미 고른 값을 덮지 않는다.** 목록이 다시 오는 일이 있고(재조회), 그때 사람이 고른 사유가
 *    기본값으로 되돌아가면 무엇을 보낼지가 조용히 바뀐다.
 */
export const defaultSubstituteLotReason = (
  reasons: readonly { code: string }[],
  picked: string,
): string | null => {
  if (picked !== '') return null;

  return reasons.some((each) => each.code === DEFAULT_SUBSTITUTE_LOT_REASON)
    ? DEFAULT_SUBSTITUTE_LOT_REASON
    : null;
};

/** 스캔한 사전부착 라벨이 있는가. 외부 LOT 직접 입력과 미부착은 라벨 대조를 하지 않는다 - 서버도 보지 않는다. */
export const hasScannedLabel = (draft: ReceiptDraft): boolean =>
  !draft.supplierLotMissing && draft.supplierLotLabelAttached && draft.supplierLotNo !== '';

/**
 * 스캔한 라벨의 제품코드가 이 건의 품목과 다른가.
 *
 * 서버가 등록할 때 같은 대조로 거부한다(400). 담아 둔 뒤에 되돌아오면 한참 뒤 전송 실패로만
 * 보이므로 등록 전에 막는다. 견줄 코드를 모르면 판정하지 않는다. 공급사 칸은 단말이 거래처코드를
 * 읽을 경로가 없어 서버 대조에 맡긴다(#1292).
 */
export const labelMismatchOf = (
  draft: ReceiptDraft,
  codes: MaterialLotCodes | null,
): MaterialLotCodeMismatch | null => {
  if (codes === null || !hasScannedLabel(draft)) {
    return null;
  }

  const segments = parseMaterialLotNo(draft.supplierLotNo);

  return segments === null ? null : codeMismatchOf(segments, codes);
};

/** 이 건이 실을 품목·단위·공급사. 발주가 있으면 승계하고 없으면 고른 값을 쓴다. */
export interface ReceiptSource {
  itemId: number;
  uomId: number;
  supplierId: number;
}

export const sourceOf = (draft: ReceiptDraft): ReceiptSource | null => {
  if (draft.unordered) {
    return draft.supplierId === null || draft.itemId === null || draft.uomId === null
      ? null
      : { itemId: draft.itemId, uomId: draft.uomId, supplierId: draft.supplierId };
  }

  const line = draft.purchaseOrderLine;

  return line === null || draft.purchaseOrder === null
    ? null
    : { itemId: line.itemId, uomId: line.uomId, supplierId: draft.purchaseOrder.supplierId };
};

const optional = (value: string): string | null => (value.trim() === '' ? null : value.trim());

const toLine = (
  draft: ReceiptDraft,
  itemId: number,
  uomId: number,
  receivedQty: number,
  purchaseOrderLineId: number | null,
): InboundReceiptLineUpsert => ({
  purchaseOrderLineId,
  itemId,
  receivedQty,
  uomId,
  packageCount: draft.packageCount.trim() === '' ? null : Number(draft.packageCount.trim()),
  supplierLotNo: draft.supplierLotMissing ? null : optional(draft.supplierLotNo),
  supplierLotMissing: draft.supplierLotMissing,
  supplierLotLabelAttached: draft.supplierLotMissing ? false : draft.supplierLotLabelAttached,
  substituteLotReasonCode: draft.supplierLotMissing ? draft.substituteLotReasonCode : null,
  manufacturedDate: optional(draft.manufacturedDate),
  expiryDate: optional(draft.expiryDate),
});

export const toOutboxDraft = (
  draft: ReceiptDraft,
  itemId: number,
  uomId: number,
  plantId: number,
  supplierId: number,
  now: Date,
  workerNo: string,
): OutboxDraft => {
  const occurredAt = now.toISOString();
  const body: InboundReceiptCreate = {
    supplierId,
    plantId,
    receiptDatetime: occurredAt,
    deliveryNoteNo: optional(draft.deliveryNoteNo),
    vehicleNo: optional(draft.vehicleNo),
    ...(draft.unordered
      ? {
          exceptionTypeCode: draft.exceptionTypeCode.trim(),
          exceptionReason: draft.exceptionReason.trim(),
        }
      : {}),
    /* 업무 기준일은 단말이 정한다. 서버가 수신 시각으로 잡으면 날짜 경계에서 이중 계상이 난다. */
    businessDate: businessDateOf(now),
    occurredAt,
    lines: [
      toLine(
        draft,
        itemId,
        uomId,
        Number(draft.receivedQty.trim()),
        draft.purchaseOrderLine?.purchaseOrderLineId ?? null,
      ),
    ],
  };

  return {
    label: messages.inboundReceipt.record,
    workerNo,
    idempotencyKey: createIdempotencyKey(),
    method: 'POST',
    path: RECEIPT_PATH,
    body,
    occurredAt,
    confirmation: 'pending',
  };
};

/**
 * 받을 것이 남은 줄을 위로 올린다.
 *
 * 후보 목록은 발주 단위로 열림을 판정하므로, 그 품목의 라인이 다 찼어도 같은 발주의 다른
 * 라인이 열려 있으면 후보로 선다. 그때 다 받은 줄이 맨 위에 서면 작업자가 그것부터 고르고
 * 초과 판정을 받는다 - 실기기에서 그 차례로 나왔다.
 *
 * ⛔ 다 받은 줄을 감추지 않는다. 그 줄에도 초과 입하가 들어오고, 감추면 초과분만 등록하는
 *    길이 화면에서 사라져 담당자가 무발주로 돌아가 공급사·품목·단위를 손으로 고르게 된다.
 *
 * 같은 무리 안에서는 받은 차례를 지킨다 - ES2019 부터 sort 가 안정이라 등급이 같으면
 * 받은 차례로 남는다. 흔들면 고르던 자리가 회차마다 바뀐다.
 */
export const openLinesFirst = (
  lines: readonly PurchaseOrderLine[],
  queuedFor: (purchaseOrderLineId: number) => number,
): PurchaseOrderLine[] => {
  const isClosed = (line: PurchaseOrderLine) =>
    remainingQtyOf(line, queuedFor(line.purchaseOrderLineId)) <= 0;

  /*
   * 줄마다 한 번만 센다. 비교 안에서 세면 큐를 O(n log n) 번 훑는다.
   *
   * 조회가 준 배열을 제자리에서 뒤집으면 캐시에 담긴 것이 함께 바뀐다.
   */
  return [...lines]
    .map((line) => ({ line, closed: Number(isClosed(line)) }))
    .sort((left, right) => left.closed - right.closed)
    .map((each) => each.line);
};

export interface SplitQuantities {
  remaining: number;
  normal: number;
  excess: number;
}

/** 초과 허용치까지는 자재 P/O에 귀속하고, 그보다 많이 온 수량만 비귀속으로 가른다. */
export const splitQuantitiesOf = (
  line: PurchaseOrderLine,
  arrivedQty: number,
  queuedQty = 0,
): SplitQuantities => {
  const remaining = remainingQtyOf(line, queuedQty);
  const room = exact((to) => Math.max(0, to(remaining) + to(line.toleranceOverQty)));
  const normal = Math.min(arrivedQty, room);

  return { remaining, normal, excess: exact((to) => to(arrivedQty) - to(normal)) };
};

const splitPart = (
  draft: ReceiptDraft,
  itemId: number,
  uomId: number,
  plantId: number,
  supplierId: number,
  receiptDatetime: string,
  receivedQty: number,
  purchaseOrderLineId: number | null,
) => ({
  supplierId,
  plantId,
  receiptDatetime,
  deliveryNoteNo: optional(draft.deliveryNoteNo),
  vehicleNo: optional(draft.vehicleNo),
  lines: [toLine(draft, itemId, uomId, receivedQty, purchaseOrderLineId)],
});

/**
 * 모바일 초과 입하를 한 트랜잭션 요청으로 만든다.
 *
 * 정량분만 원 자재 P/O 라인에 귀속한다. 초과분에 그 식별자를 싣으면 초과가 원 발주 누적에
 * 다시 더해져 분리 자체가 무효가 된다.
 */
export const toSplitOutboxDraft = (
  draft: ReceiptDraft,
  itemId: number,
  uomId: number,
  plantId: number,
  supplierId: number,
  now: Date,
  workerNo: string,
  mode: SplitMode,
  exceptionTypeCode: string,
  exceptionReason: string,
  queuedQty = 0,
): OutboxDraft => {
  const line = draft.purchaseOrderLine;

  if (line === null) {
    throw new Error('초과 입하 분리는 자재 P/O 라인을 고른 뒤에만 만들 수 있습니다.');
  }

  const occurredAt = now.toISOString();
  const quantities = splitQuantitiesOf(line, Number(draft.receivedQty.trim()), queuedQty);
  const normal = splitPart(
    draft,
    itemId,
    uomId,
    plantId,
    supplierId,
    occurredAt,
    quantities.normal,
    line.purchaseOrderLineId,
  );
  const excessPart = splitPart(
    draft,
    itemId,
    uomId,
    plantId,
    supplierId,
    occurredAt,
    quantities.excess,
    null,
  );
  /*
   * 초과분은 라벨 «미부착»으로 보낸다(omf-all-around#21 · 사용자 결정 2026-09-18). 스캔한 사전부착
   * LOT 은 정량분만 쓴다 — 두 파트가 같은 부착 LOT 을 실으면 서버가 「한 요청 안에서 겹칩니다」로
   * 거부해 사전부착 라벨이면 분리 등록이 늘 400 이었다. 공급사 LOT 번호는 추적용으로 남기고
   * `supplierLotMissing` 은 그대로라 대체 사유가 필요 없다. 초과분 LOT 처리의 최종 설계는
   * omf-all-around#23 대기 — 그때 다시 본다.
   */
  const excess = {
    ...excessPart,
    lines: excessPart.lines.map((excessLine) => ({
      ...excessLine,
      supplierLotLabelAttached: false,
    })),
    exceptionTypeCode: exceptionTypeCode.trim(),
    exceptionReason: exceptionReason.trim(),
  };
  const shared = { businessDate: businessDateOf(now), occurredAt };
  const body: InboundReceiptSplitRequest =
    mode === 'BOTH'
      ? { ...shared, mode: 'BOTH', normal, excess }
      : mode === 'NORMAL_ONLY'
        ? { ...shared, mode: 'NORMAL_ONLY', normal }
        : { ...shared, mode: 'EXCESS_ONLY', excess };

  return {
    label: messages.inboundReceipt.record,
    workerNo,
    idempotencyKey: createIdempotencyKey(),
    method: 'POST',
    path: SPLIT_RECEIPT_PATH,
    body,
    occurredAt,
    confirmation: 'pending',
  };
};
