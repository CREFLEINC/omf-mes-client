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
 * 품목마다 입하 한 건(server #825 · 장부 P-117 · 사용자 결정 2026-10-24 「입하번호는 품목마다 하나」). 본문은 입하 등록과
 * 같고, 줄마다 입하번호가 따로 선다. 모든 건이 한 트랜잭션이라 한 줄이라도 막히면 아무것도 서지 않는다. 라벨 미부착
 * 일괄 입하가 쓴다 — 한 품목씩 받는 입하는 `RECEIPT_PATH` 그대로다.
 */
export const PER_LINE_RECEIPT_PATH = '/logistics/inbound-receipts:per-line';

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

      /* 품목마다 입하(`:per-line`)도 본문 모양이 입하 등록과 같다 — 줄마다 셈에 넣는다. */
      if (entry.path === RECEIPT_PATH || entry.path === PER_LINE_RECEIPT_PATH) {
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
  deliveryNoteNo: string;
  vehicleNo: string;
  receivedQty: string;
  packageCount: string;
  manufacturedDate: string;
  expiryDate: string;
  /** 부족을 부분 입하로 받는 사유(사용자 지시 2026-10-22). `PARTIAL_REASONS` 중 하나, 안 골랐으면 ''. */
  partialReasonCode: string;
  /** 사유가 기타일 때 적은 글. 부족일 때만 헤더 비고로 보낸다. */
  partialReason: string;
}

/** 부분 입하 사유 - 자주 나는 셋과 직접 적는 기타(사용자 지시 2026-10-22). 서버 코드 사전에는 없다. */
export const PARTIAL_REASONS = [
  'SPLIT_SHIPMENT',
  'SUPPLIER_SHORTAGE',
  'IN_TRANSIT',
  'OTHER',
] as const;
export const OTHER_PARTIAL_REASON = 'OTHER';

const isPartialReason = (code: string): code is (typeof PARTIAL_REASONS)[number] =>
  (PARTIAL_REASONS as readonly string[]).includes(code);

/** 비고에 실을 부분 입하 사유 - 고른 이름, 기타면 적은 글. 없으면 `null`. */
export const partialRemarksOf = (draft: ReceiptDraft): string | null => {
  if (!isPartialReason(draft.partialReasonCode)) {
    return null;
  }

  if (draft.partialReasonCode === OTHER_PARTIAL_REASON) {
    const typed = draft.partialReason.trim();

    return typed === '' ? null : typed;
  }

  return messages.inboundReceipt.verdict.partialReasons[draft.partialReasonCode];
};

/** 부분 입하 단추를 잠그는 사유 칸의 빈자리. */
export const partialReasonLockOf = (
  draft: ReceiptDraft,
): 'noPartialReason' | 'noPartialReasonText' | null =>
  !isPartialReason(draft.partialReasonCode)
    ? 'noPartialReason'
    : partialRemarksOf(draft) === null
      ? 'noPartialReasonText'
      : null;

/**
 * 방금 등록한 한 건을 화면에 다시 보이기 위한 요약.
 *
 * ⭐ **적은 값을 등록 뒤에 확인할 수 있어야 한다**(현장 요청 2026-09-21). 전에는 「등록했습니다」
 *    띠와 「다음 입하」 단추뿐이라, 같은 자재 P/O 의 자재를 여러 번 넣을 때 무엇을 얼마나
 *    넣었는지 되짚을 곳이 화면에 없었다.
 *
 * ⛔ **화면이 수량을 다시 셈하지 않는다.** 이 값들은 «담아 보낸 본문»에서 되읽는다 - 따로
 *    셈하면 보낸 것과 보이는 것이 갈려, 확인하려고 보는 수가 도리어 틀린 수가 된다.
 */
export interface RecordedPart {
  /** 한 건이면 `null`, 초과 분리면 정량분·초과분. */
  part: 'normal' | 'excess' | null;
  receivedQty: number;
  packageCount: number | null;
}

export interface RecordedReceipt {
  purchaseOrderNo: string | null;
  lineNo: number | null;
  itemId: number;
  uomId: number;
  supplierLotNo: string | null;
  supplierLotMissing: boolean;
  substituteLotReasonCode: string | null;
  manufacturedDate: string | null;
  expiryDate: string | null;
  parts: RecordedPart[];
  /**
   * 이 입하로 자재 LOT 이 만들어졌는가. 서버는 공급사 라벨이 붙었다고 보낸 줄에만 만든다 - 라벨
   * 미부착이면 만들지 않는다(사용자 확인 2026-10-22, 결과 화면이 만들었다고 잘못 말했다).
   */
  lotCreated: boolean;
}

const firstLineOf = (raw: unknown): ReceiptLineBody | undefined => {
  const line = (raw as { lines?: unknown } | null)?.lines;

  return Array.isArray(line) ? (line[0] as ReceiptLineBody | undefined) : undefined;
};

const partOf = (raw: unknown, part: RecordedPart['part']): RecordedPart | null => {
  const first = firstLineOf(raw);

  return first === undefined
    ? null
    : { part, receivedQty: first.receivedQty, packageCount: first.packageCount ?? null };
};

/**
 * 담아 보낸 본문에서 「무엇을 얼마나 적었는가」를 되읽는다.
 *
 * 경로로 갈린다 - 한 건과 초과 분리는 본문 모양이 다르고, 분리는 모드에 따라 실리는 파트가
 * 다르다. 없는 파트를 0 으로 보이면 보내지 않은 것을 보낸 것처럼 말한다.
 */
export const recordedPartsOf = (path: string, body: unknown): RecordedPart[] => {
  if (path === RECEIPT_PATH) {
    const first = firstLineOf(body);
    const excess = first?.excessQty ?? 0;

    /*
     * 초과분을 나눠 받은 한 건 - 정량분과 초과분으로 나눠 되읽는다(장부 P-100). 받을 것이 남지
     * 않은 라인이면 전부 초과분이다 - 보내지 않은 정량분 0 을 적지 않는다.
     */
    if (first !== undefined && excess > 0) {
      const normal = exact((to) => to(first.receivedQty) - to(excess));
      const excessPart: RecordedPart = { part: 'excess', receivedQty: excess, packageCount: null };

      return normal > 0
        ? [
            { part: 'normal', receivedQty: normal, packageCount: first.packageCount ?? null },
            excessPart,
          ]
        : [excessPart];
    }

    const only = partOf(body, null);

    return only === null ? [] : [only];
  }

  if (path !== SPLIT_RECEIPT_PATH) {
    return [];
  }

  const split = body as { normal?: unknown; excess?: unknown } | null;

  return [partOf(split?.normal, 'normal'), partOf(split?.excess, 'excess')].filter(
    (each): each is RecordedPart => each !== null,
  );
};

export const recordedOf = (
  draft: ReceiptDraft,
  source: ReceiptSource,
  path: string,
  body: unknown,
): RecordedReceipt => ({
  purchaseOrderNo: draft.purchaseOrder?.purchaseOrderNo ?? null,
  lineNo: draft.purchaseOrderLine?.lineNo ?? null,
  itemId: source.itemId,
  uomId: source.uomId,
  supplierLotNo:
    draft.supplierLotMissing || draft.supplierLotNo === '' ? null : draft.supplierLotNo,
  supplierLotMissing: draft.supplierLotMissing,
  substituteLotReasonCode: draft.supplierLotMissing ? draft.substituteLotReasonCode : null,
  manufacturedDate: draft.manufacturedDate.trim() === '' ? null : draft.manufacturedDate.trim(),
  expiryDate: draft.expiryDate.trim() === '' ? null : draft.expiryDate.trim(),
  parts: recordedPartsOf(path, body),
  /* 본문의 줄과 같은 판단(`toLine`) - 미부착이면 부착으로 보내지 않는다. */
  lotCreated: !draft.supplierLotMissing && draft.supplierLotLabelAttached,
});

/**
 * 자재가 바뀌면 함께 비우는 칸들 — 수량·포장 수·제조일·유효기한.
 *
 * ⭐ 이 넷은 «그 자재»의 것이다. 자재 P/O 라인을 다른 자재로 옮겼는데 남겨 두면 앞 자재에
 *    적은 수량이 다음 자재에 그대로 붙는다. 실기기에서 발주량 500 짜리 라인에 500 을 적고
 *    발주량 80 짜리 라인으로 옮겼더니 500 이 남아 초과 판정이 났고, 등록 단추가 사라진 자리에
 *    초과 분리 구획이 섰다(2026-09-21).
 *
 * ⛔ 공급사 LOT 번호·대체 사유·자재 P/O 는 여기 넣지 않는다. 그것들은 «이 도착»의 것이라
 *    자재를 바꿔도 그대로다 - 비우면 같은 자재 P/O 의 다음 자재를 넣을 때마다 다시 스캔한다.
 */
export const LINE_SCOPED_BLANK: Pick<
  ReceiptDraft,
  | 'receivedQty'
  | 'packageCount'
  | 'manufacturedDate'
  | 'expiryDate'
  | 'partialReasonCode'
  | 'partialReason'
> = {
  receivedQty: '',
  packageCount: '',
  manufacturedDate: '',
  expiryDate: '',
  /* 부분 입하 사유도 그 자재의 수량에 붙는다. */
  partialReasonCode: '',
  partialReason: '',
};

/**
 * 등록 단추를 잠근 «한 가지» 이유. 잠글 것이 없으면 `null` 이다.
 *
 * ⭐ **잠근 단추는 왜 잠겼는지 함께 말한다**(공유계약 G-1). 같은 화면의 초과 분리 구획이
 *    이미 그렇게 한다(`excessLocked`) — 그런데 정작 등록 단추는 아무 말도 하지 않아,
 *    다 채웠는데 눌리지 않는다는 말이 현장에서 나왔다(2026-09-20).
 *
 * ⛔ **판정을 두 벌로 적지 않는다.** 아래 `canSubmit` 과 화면의 `ready` 가 이 한 곳에서
 *    나온다 — 따로 적으면 한쪽만 고쳐져 단추는 잠긴 채 「고칠 것이 없다」고 말하게 된다.
 *
 * 차례는 «화면에 선 차례»다. 위에서부터 처음 비어 있는 것을 가리켜야 사람의 눈이 그리로 간다.
 */
export type SubmitLock =
  | 'loading'
  | 'noWorker'
  | 'noOrder'
  | 'noOrderLine'
  | 'noPlant'
  | 'qtyEmpty'
  | 'qtyNotNumber'
  | 'qtyNotPositive'
  | 'packageCount'
  | 'expiryBeforeManufactured'
  | 'labelChecking'
  | 'labelMismatch'
  | 'underUnanswered'
  | 'noSubstituteReason'
  | 'noPartialReason'
  | 'noPartialReasonText';

/** 화면만 아는 것들. 초안에 없어 따로 받는다. */
export interface SubmitGate {
  /** 담긴 것을 다 읽었는가. 읽기 전에는 초과가 초과로 보이지 않아 막아 둔다. */
  loaded: boolean;
  hasWorker: boolean;
  /** 발주에서 승계하거나 기기 토큰이 싣고 온 공장. 모르면 지어내지 않는다. */
  plantId: number | null;
  label: 'ok' | 'checking' | 'mismatch';
  verdict: Verdict | null;
  continueUnder: boolean;
}

/** 초안만 보고 아는 잠금. 화면 밖에서도 같은 답이 나와야 해서 따로 둔다. */
const draftLockOf = (draft: ReceiptDraft, hasWorker: boolean): SubmitLock | null => {
  if (!hasWorker) {
    return 'noWorker';
  }

  /* 입하는 늘 자재 P/O 라인에 단다 - 발주 없는 입하는 PDA 에서 받지 않는다(사용자 결정 2026-10-27). */
  if (draft.purchaseOrder === null) return 'noOrder';
  if (draft.purchaseOrderLine === null) return 'noOrderLine';

  const qty = qtyProblem(draft.receivedQty);

  if (qty !== null) {
    return qty === 'empty' ? 'qtyEmpty' : qty === 'notNumber' ? 'qtyNotNumber' : 'qtyNotPositive';
  }

  if (packageProblem(draft.packageCount) !== null) {
    return 'packageCount';
  }

  if (isExpiryBeforeManufactured(draft.manufacturedDate, draft.expiryDate)) {
    return 'expiryBeforeManufactured';
  }

  /* 번호가 없는데 부착됐다고 보내면 사전부착 스캔 경로와 충돌한다. */
  if (draft.supplierLotMissing && draft.supplierLotLabelAttached) {
    return 'noSubstituteReason';
  }

  /* 미부착 분기는 데이터에 있는 구분이다. 사유 없이 참으로 보내면 서버가 거부한다. */
  return draft.supplierLotMissing && draft.substituteLotReasonCode === ''
    ? 'noSubstituteReason'
    : null;
};

export const submitLockOf = (draft: ReceiptDraft, gate: SubmitGate): SubmitLock | null => {
  if (!gate.loaded) {
    return 'loading';
  }

  const inDraft = draftLockOf(draft, gate.hasWorker);

  /*
   * 공장은 발주 라인을 고른 «뒤»에 정해진다(발주에서 승계한다). 고르기 전에 공장부터 말하면
   * 사람이 고칠 수 없는 것을 가리키게 되므로, 초안이 먼저 가리키는 것을 앞에 둔다.
   */
  if (inDraft !== null && inDraft !== 'noSubstituteReason') {
    return inDraft;
  }

  if (gate.plantId === null) {
    return 'noPlant';
  }

  if (gate.label === 'checking') {
    return 'labelChecking';
  }

  if (gate.label === 'mismatch') {
    return 'labelMismatch';
  }

  if (gate.verdict === UNDER && !gate.continueUnder) {
    return 'underUnanswered';
  }

  return inDraft;
};

export const canSubmit = (draft: ReceiptDraft, hasWorker: boolean): boolean =>
  draftLockOf(draft, hasWorker) === null;

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

/** 이 건이 실을 품목·단위·공급사. 고른 자재 P/O 라인에서 승계한다. */
export interface ReceiptSource {
  itemId: number;
  uomId: number;
  supplierId: number;
}

export const sourceOf = (draft: ReceiptDraft): ReceiptSource | null => {
  const line = draft.purchaseOrderLine;

  return line === null || draft.purchaseOrder === null
    ? null
    : { itemId: line.itemId, uomId: line.uomId, supplierId: draft.purchaseOrder.supplierId };
};

/** 등록 본문의 줄 - 계약의 줄에 초과분(장부 P-100, 계약 밖)을 더한 것. */
type ReceiptLineBody = InboundReceiptLineUpsert & { excessQty?: number };

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
  /**
   * 받은 수량 중 자재 P/O 에 넣지 않는 몫(장부 P-100 · 사용자 결정 2026-10-22). 0 이면 싣지 않는다.
   * LOT 은 줄 전체 수량 그대로 하나이고, 이 몫은 서버의 초과분 목록에 남아 추가 P/O 에 잇는다.
   */
  excessQty = 0,
): OutboxDraft => {
  const occurredAt = now.toISOString();
  const remarks = partialRemarksOf(draft);
  /*
   * 부분 입하 사유는 헤더 비고(remarks)에 싣는다. 서버는 등록 때 이 칸을 저장하지만 계약의
   * InboundReceiptCreate 에는 아직 없어(InboundReceipt · Update 에는 있다) 타입을 넓혀 싣는다.
   * 줄의 초과분(excessQty)도 계약 밖이라 같다.
   */
  const line = toLine(
    draft,
    itemId,
    uomId,
    Number(draft.receivedQty.trim()),
    draft.purchaseOrderLine?.purchaseOrderLineId ?? null,
  );
  const body: Omit<InboundReceiptCreate, 'lines'> & {
    remarks?: string;
    lines: ReceiptLineBody[];
  } = {
    supplierId,
    plantId,
    receiptDatetime: occurredAt,
    deliveryNoteNo: optional(draft.deliveryNoteNo),
    vehicleNo: optional(draft.vehicleNo),
    ...(remarks === null ? {} : { remarks }),
    /* 업무 기준일은 단말이 정한다. 서버가 수신 시각으로 잡으면 날짜 경계에서 이중 계상이 난다. */
    businessDate: businessDateOf(now),
    occurredAt,
    lines: [excessQty > 0 ? { ...line, excessQty } : line],
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

/** 라벨 없이 한꺼번에 받는 라인 하나 - 그 라인과 받을 수량(남은 수량 그대로). */
export interface LotlessPick {
  line: PurchaseOrderLine;
  receivedQty: number;
}

/**
 * 라벨 미부착 일괄 입하 — 한 자재 P/O 에서 체크한 라인들을 **품목마다 입하 한 건**으로 담는다(`:per-line` · 장부 P-117 ·
 * 사용자 결정 2026-10-24 「입하번호는 품목마다 하나」 — 한 품목씩 받을 때와 기준이 같다).
 *
 * 대부분은 문제없이 들어온다(사용자 판단 2026-10-21). 수량 · 상태에 이상이 없는 라인은 체크해
 * 남은 수량 그대로 한 번에 등록하고, 문제가 있는 라인만 한 건씩 수량 단계로 간다. 요청 하나에 모아
 * 담아 함께 들어가거나 함께 되돌아온다(서버가 한 트랜잭션으로 받는다) - 일부만 등록되면 무엇이 남았는지 다시 가려야 한다.
 *
 * 라인마다 LOT 번호 없음 · 라벨 미부착 · 대체 사유를 싣는다. 포장 수 · 날짜는 비운다.
 */
export const toLotlessOutboxDraft = (
  order: PurchaseOrder,
  picks: readonly LotlessPick[],
  substituteLotReasonCode: string,
  now: Date,
  workerNo: string,
): OutboxDraft => {
  const occurredAt = now.toISOString();
  const body: InboundReceiptCreate = {
    supplierId: order.supplierId,
    plantId: order.plantId,
    receiptDatetime: occurredAt,
    deliveryNoteNo: null,
    vehicleNo: null,
    businessDate: businessDateOf(now),
    occurredAt,
    lines: picks.map(({ line, receivedQty }) => ({
      purchaseOrderLineId: line.purchaseOrderLineId,
      itemId: line.itemId,
      receivedQty,
      uomId: line.uomId,
      packageCount: null,
      supplierLotNo: null,
      supplierLotMissing: true,
      supplierLotLabelAttached: false,
      substituteLotReasonCode,
      manufacturedDate: null,
      expiryDate: null,
    })),
  };

  return {
    label: messages.inboundReceipt.record,
    workerNo,
    idempotencyKey: createIdempotencyKey(),
    method: 'POST',
    path: PER_LINE_RECEIPT_PATH,
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

/**
 * 초과 입하에서 정량분만 받는다 - 원 자재 P/O 라인에 넣을 수 있는 만큼만 등록하고 초과분은
 * 싣지 않는다(분리 요청 `:split` 의 NORMAL_ONLY).
 *
 * 초과분 파트는 자재 P/O 라인 없이 나가 발주 없는 입하가 된다 - 초과분 기록이 남지 않아
 * 추가 발주에 연결할 길이 없다. 초과분을 받을 때는 한 건에 `excessQty` 로 싣는다
 * (`toOutboxDraft`, 장부 P-100 · 사용자 결정 2026-10-27).
 */
export const toNormalOnlyOutboxDraft = (
  draft: ReceiptDraft,
  itemId: number,
  uomId: number,
  plantId: number,
  supplierId: number,
  now: Date,
  workerNo: string,
  queuedQty = 0,
): OutboxDraft => {
  const line = draft.purchaseOrderLine;

  if (line === null) {
    throw new Error('정량분만 받기는 자재 P/O 라인을 고른 뒤에만 만들 수 있습니다.');
  }

  const occurredAt = now.toISOString();
  const quantities = splitQuantitiesOf(line, Number(draft.receivedQty.trim()), queuedQty);
  /* 한 건 등록과 같은 머리 칸을 싣는다 - 차량번호는 계약의 분리 파트에 없지만 전부터 함께 보냈다. */
  const normal = {
    supplierId,
    plantId,
    receiptDatetime: occurredAt,
    deliveryNoteNo: optional(draft.deliveryNoteNo),
    vehicleNo: optional(draft.vehicleNo),
    lines: [toLine(draft, itemId, uomId, quantities.normal, line.purchaseOrderLineId)],
  };
  const body: InboundReceiptSplitRequest = {
    businessDate: businessDateOf(now),
    occurredAt,
    mode: 'NORMAL_ONLY',
    normal,
  };

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

/**
 * 입하 등록의 단계. 입력 상태에서 정한다 — 따로 들고 다니면 상태와 단계가 어긋난다.
 *
 * - scan: 라벨을 아직 받지 않았다
 * - line: 라벨은 받았고 자재 P/O 라인을 고를 차례다(라인을 바꾸러 돌아온 때도)
 * - qty: 라인을 골랐고 수량을 확인할 차례다
 */
export type ReceiptStep = 'scan' | 'line' | 'qty';

export const stepOf = (draft: ReceiptDraft, changingLine: boolean): ReceiptStep => {
  if (draft.supplierLotNo === '' && !draft.supplierLotMissing) return 'scan';
  if (draft.purchaseOrderLine === null || changingLine) return 'line';

  return 'qty';
};

/**
 * 고를 것이 하나뿐이면 그것을 고른다.
 *
 * 라벨 품목으로 좁힌 후보에서만 한다 — 좁히지 않은 목록(라벨 미부착·품목을 확인하지 못함)에서
 * 하나를 고르면 라벨과 무관한 발주가 고른 것처럼 선다(omf-all-around#25 와 같은 원칙).
 */
export const autoOrderOf = (
  orders: readonly PurchaseOrder[] | undefined,
  narrowed: boolean,
): PurchaseOrder | null =>
  narrowed && orders !== undefined && orders.length === 1 ? (orders[0] ?? null) : null;

/**
 * 고른 발주에서 라벨 품목의 받을 것이 남은 라인이 하나뿐이면 그 라인이다.
 *
 * 다 받은 라인은 세지 않는다 — 그 라인에 초과로 받을 수도 있지만, 그것을 알아서 고르면 남은
 * 라인이 있는데도 초과 판정부터 선다.
 */
export const autoLineOf = (
  lines: readonly PurchaseOrderLine[] | undefined,
  itemId: number | null,
  queuedFor: (purchaseOrderLineId: number) => number,
): PurchaseOrderLine | null => {
  if (lines === undefined || itemId === null) return null;

  const open = lines.filter(
    (line) =>
      line.itemId === itemId && remainingQtyOf(line, queuedFor(line.purchaseOrderLineId)) > 0,
  );

  return open.length === 1 ? (open[0] ?? null) : null;
};

/**
 * 미리 채운 수량 위에서 친 값.
 *
 * 미리 채운 것은 «예정»이다. 그 뒤에 숫자를 이어 붙이면 500 위에 300 을 친 사람이 500300 을
 * 받는다 - 미리 채운 값 위의 첫 숫자는 새로 치기 시작한 것으로 본다. 지운 것(짧아짐)은 고친 것으로
 * 두고 그대로 받는다.
 */
export const typedOverPlanned = (planned: string, next: string): string =>
  next.length > planned.length && next.startsWith(planned) ? next.slice(planned.length) : next;
