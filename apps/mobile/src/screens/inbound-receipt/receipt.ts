import type {
  ApiError,
  InboundLotDetail,
  InboundLotReceiveRejectionCode,
  InboundLotReceive,
  InboundLotReceiveResult,
} from '@omf-mes/api-client';

import { parseMaterialLotNo } from '../../patterns/material-lot-no';
import type { OutboxDraft, OutboxEntry } from '../../patterns/outbox';
import { plantToday } from '../../patterns/plant-time';

/**
 * M-01-01 입하 등록의 **판정 · 본문 · 카드 상태**(005 · omf-all-around#254 · screens/M-01-01.md).
 *
 * ⭐ 스캔 1건 = `POST /logistics/inbound-lots:receive` 1건(원소 하나, 멱등 키 하나 — 계약 §3). 어느 입하 LOT 에
 *    들어갈지는 **서버가** 정한다(같은 공장·공급사·품목의 「입하 중」에 붙이거나 새로 만든다). 화면은 P/O 도, 입하 LOT
 *    도 고르지 않는다.
 * ⭐ 오프라인 스캔은 등록하지 않고 전송 대기(아웃박스)에 둔다 — 연결되면 스캔 순서대로 같은 키로 나간다.
 */

export const RECEIVE_PATH = '/logistics/inbound-lots:receive';

/**
 * 아웃박스에서 이 화면의 건을 가르는 이름 — 전송 기록 화면에 사람이 읽는 이름으로도 선다.
 * ⛔ 옛 입하(`inbound-receipts`) 건과 같은 이름을 쓰지 않는다 — 배포 전 대기 전송은 비운다(T010 공지).
 */
export const RECEIVE_LABEL = '입하 등록(자재 관리 LOT 받기)';

/** 공장 날짜(YYYY-MM-DD) — 서버가 공장 날짜로 다시 판정한다(지난 날짜 자동 마감). */
export const businessDateOf = (now: Date): string => plantToday(now);

/** 받기 본문 — 스캔 하나(원소 하나). */
export const toReceiveBody = (lotNo: string, now: Date): InboundLotReceive => ({
  receiptDatetime: now.toISOString(),
  businessDate: businessDateOf(now),
  occurredAt: now.toISOString(),
  lots: [{ lotNo }],
});

/** 아웃박스에 담을 건 — 화면에서 바로 보낸 것과 같은 키 · 같은 본문이다. */
export const toReceiveDraft = (
  lotNo: string,
  now: Date,
  idempotencyKey: string,
  workerNo: string,
): OutboxDraft => ({
  label: RECEIVE_LABEL,
  idempotencyKey,
  method: 'POST',
  path: RECEIVE_PATH,
  body: toReceiveBody(lotNo, now),
  occurredAt: now.toISOString(),
  /* 실물이 움직이는 쓰기다 — 서버가 받아야 등록이다. */
  confirmation: 'pending',
  workerNo,
});

/** 담긴 건의 라벨 번호. */
export const queuedLotNoOf = (entry: OutboxEntry): string | null => {
  const lots = (entry.body as Partial<InboundLotReceive> | null)?.lots;
  const first = lots?.[0];

  return first !== undefined && 'lotNo' in first ? first.lotNo : null;
};

/** 라벨 번호에서 공급사 · 품목 코드 — MES 형식이 아니면 null(그 대기 건은 어느 카드도 막지 않는다). */
export const pairOfLotNo = (lotNo: string): { itemCode: string; supplierCode: string } | null => {
  const parsed = parseMaterialLotNo(lotNo);

  return parsed === null ? null : { itemCode: parsed.itemCode, supplierCode: parsed.supplier };
};

/** 이 공급사 · 품목의 전송 대기 수 — 그 카드의 [입하 마감]을 막는다(계약 §3 오프라인). */
export const pendingCountFor = (
  entries: readonly OutboxEntry[],
  pair: { itemCode: string; supplierCode: string },
): number =>
  entries.filter((entry) => {
    const lotNo = queuedLotNoOf(entry);
    const of = lotNo === null ? null : pairOfLotNo(lotNo);

    return of !== null && of.itemCode === pair.itemCode && of.supplierCode === pair.supplierCode;
  }).length;

/** 번호 끝 — 「…|HB01|0002」. 짧으면 그대로. */
export const lotTail = (lotNo: string): string => {
  const parts = lotNo.split('|');

  return parts.length <= 2 ? lotNo : `…|${parts.slice(-2).join('|')}`;
};

/** 화면이 이번에 건드린 입하 LOT 카드 하나 — 맨 위가 마지막으로 건드린 것. */
export interface CardState {
  inboundLotId: number;
  inboundLotNo: string;
  /** 이 화면에서 새로 만들어진 입하 LOT 인가 — 「새 입하 LOT · 입하 중」 칩. */
  created: boolean;
  /** 이번에 이 화면이 등록한 LOT — 마지막 스캔은 `latest`. */
  registered: ReadonlyMap<number, 'latest' | 'session'>;
}

/**
 * 받기 결과를 카드에 넣는다 — 그 입하 LOT 카드를 맨 위로 올리고, 이번 LOT 을 「방금 등록」으로, 앞선 「방금」은
 * 「이번에 등록」으로 내린다.
 */
export const applyReceive = (
  cards: readonly CardState[],
  result: InboundLotReceiveResult,
): CardState[] => {
  let next: CardState[] = cards.map((card) => ({
    ...card,
    registered: new Map<number, 'latest' | 'session'>(
      [...card.registered].map(([lotId]) => [lotId, 'session'] as const),
    ),
  }));

  for (const lot of result.inboundLots) {
    const existing = next.find((card) => card.inboundLotId === lot.inboundLotId);
    const registered = new Map<number, 'latest' | 'session'>(existing?.registered ?? []);

    for (const each of lot.lots) registered.set(each.lotId, 'latest');

    const card: CardState = {
      inboundLotId: lot.inboundLotId,
      inboundLotNo: lot.inboundLotNo,
      created: (existing?.created ?? false) || lot.created,
      registered,
    };

    next = [card, ...next.filter((each) => each.inboundLotId !== lot.inboundLotId)];
  }

  return next;
};

/** 카드에 무엇을 할 수 있는가 — 막히면 그 까닭(버튼 아래 한 줄). */
export type CardLock = 'offline' | 'pending' | null;

export const cardLockOf = (online: boolean, pendingCount: number): CardLock =>
  !online ? 'offline' : pendingCount > 0 ? 'pending' : null;

/** 입하 중(마감 전)인가 — 해제 · 공급사 LOT · 입하 마감은 이때만. */
export const isReceiving = (detail: Pick<InboundLotDetail, 'statusCode'>): boolean =>
  detail.statusCode === 'RECEIVING';

/** 마지막 스캔 결과 줄 · 거부 줄. */
export type ScanLine =
  | {
      kind: 'ok';
      id: string;
      lotNo: string;
      inboundLotNo: string;
      created: boolean;
      count: number;
      fromSupplierLabel: boolean;
    }
  | { kind: 'offline'; id: string; lotNo: string }
  | { kind: 'reject'; id: string; lotNo: string; reason: string; body: string }
  | { kind: 'closed'; id: string; lotNo: string; inboundLotNo: string };

/** 서버가 실어 준 이유 문구(검증 · 잠김 · 충돌) — 없으면 null. */
export const serverMessageOf = (error: ApiError): string | null => {
  const lines =
    error.kind === 'validation' || error.kind === 'stateLocked'
      ? error.errors.map((item) => item.message)
      : error.kind === 'conflict'
        ? [error.message ?? '']
        : [];
  const text = lines
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .join(' ');

  return text === '' ? null : text;
};

/** 오류 코드가 이것인가(검증 · 잠김 봉투의 `errors[].code`). */
export const hasErrorCode = (error: ApiError, code: string): boolean =>
  (error.kind === 'validation' || error.kind === 'stateLocked') &&
  error.errors.some((item) => item.code === code);

const REJECTION_CODES: readonly InboundLotReceiveRejectionCode[] = [
  'ALREADY_RECEIVED',
  'VOIDED',
  'NOT_MATERIAL_LOT',
];

/**
 * 받기 거부(409)의 까닭 — 서버 `rejectedLots[].reasonCode`(G1). 스캔 하나 = 원소 하나라 첫 줄을 본다.
 * 그 칸이 없는 거부(검증 · 다른 잠김)는 null — 화면은 서버 문구를 그대로 쓴다.
 */
export const rejectionCodeOf = (error: ApiError): InboundLotReceiveRejectionCode | null => {
  const code = error.kind === 'stateLocked' ? error.rejectedLots?.[0]?.reasonCode : undefined;

  return REJECTION_CODES.find((each) => each === code) ?? null;
};

/**
 * 이미 입하된 라벨이 이 화면의 어느 카드에 있는가 — 거부 줄 「{IL}(입하 중|입하 완료)에 이미 등록된…」.
 * 서버 거부 응답에는 입하 LOT 번호가 없어, 화면이 불러 둔 카드에서만 찾는다(없으면 null).
 */
export const registeredInOf = (
  details: readonly (InboundLotDetail | undefined)[],
  lotNo: string,
): { inboundLotNo: string; receiving: boolean } | null => {
  for (const detail of details) {
    if (detail === undefined) continue;
    if (detail.lots.some((lot) => lot.lotNo === lotNo && lot.lifecycleStatusCode !== 'WAITING')) {
      return { inboundLotNo: detail.inboundLotNo, receiving: isReceiving(detail) };
    }
  }

  return null;
};
