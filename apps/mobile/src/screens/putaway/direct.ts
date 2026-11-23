import type { ApiError, components, InboundLotDetail } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { createIdempotencyKey, type OutboxDraft } from '../../patterns/outbox';
import { businessDateOf } from './putaway';

/**
 * 피처 009 — 적치 지시 없는 구매 입고 적치(omf-all-around#294).
 *
 * IQC 판정과 입하 마감이 끝난 자재 관리 LOT 은 지시 없이 「적치 대기」 목록에 선다. LOT 을 스캔하고 위치를
 * 스캔하면 서버가 판정하고(위치 판정은 서버 한 곳 — 단말 위치 조회 정책을 넓히지 않는다, research R-4),
 * 기록은 대기열로 나간다. 적치가 곧 입고다.
 */
export type PendingLot = components['schemas']['PutawayPendingLot'];
export type PendingLotLookup = components['schemas']['PutawayPendingLotLookup'];
export type PendingReason = components['schemas']['PutawayPendingReason'];
export type LocationCheck = components['schemas']['PutawayLocationCheck'];
export type LocationVerdictCode = components['schemas']['PutawayLocationVerdict'];
export type PutawayDirect = components['schemas']['PutawayDirect'];
export type PutawayDirectResult = components['schemas']['PutawayDirectResult'];

const t = messages.putaway.direct;

/** 목록 묶음(표의 한 줄) — 입하 LOT · 품목. 입하 LOT 이 없는 이전 흐름 LOT 은 품목만으로 묶는다. */
export interface PendingLotGroup {
  key: string;
  /** 진척을 읽을 입하 LOT — 이전 흐름 LOT 은 없다. */
  inboundLotId: number | undefined;
  itemCode: string;
  itemName: string;
  /** 표의 공급사 머리 줄 — 없으면 「입하 LOT 없음(이전 흐름)」. */
  supplierName: string;
  lots: PendingLot[];
}

/**
 * 받은 차례(서버 정렬: 입하 마감 오래된 순 → 입하 LOT → LOT 번호)를 지키며 묶는다. 묶음은 처음 나온 자리에
 * 선다 — 다시 정렬하면 서버가 정한 「오래된 것 먼저」가 깨진다.
 */
export const groupPendingLots = (lots: readonly PendingLot[]): PendingLotGroup[] => {
  const groups = new Map<string, PendingLotGroup>();

  for (const lot of lots) {
    const key = `${lot.inboundLotNo ?? ''}|${String(lot.itemId)}`;
    const group = groups.get(key);

    if (group === undefined) {
      groups.set(key, {
        key,
        inboundLotId: lot.inboundLotId,
        itemCode: lot.itemCode,
        itemName: lot.itemName,
        supplierName:
          lot.supplierName === undefined || lot.supplierName === ''
            ? t.noInboundLot
            : lot.supplierName,
        lots: [lot],
      });
    } else {
      group.lots.push(lot);
    }
  }

  return [...groups.values()];
};

/**
 * 입하 LOT 의 적치 진척 — 적치(= 입고)된 자재 관리 LOT 수 / 적치할 자재 관리 LOT 수(사용자 지시 2026-11-23). 등록 대기 ·
 * 해제된 LOT 과 반품 · 폐기로 처분된 LOT 은 적치하지 않으므로 세지 않는다. 검사 보류 LOT 은 아직 남은 것으로 센다.
 */
export const putawayProgressOf = (detail: InboundLotDetail): { done: number; total: number } => {
  const lots = detail.lots.filter(
    (lot) =>
      lot.lifecycleStatusCode !== 'WAITING' &&
      lot.lifecycleStatusCode !== 'VOIDED' &&
      lot.dispositionStatusCode !== 'RETURNED' &&
      lot.dispositionStatusCode !== 'DISPOSED',
  );

  return { done: lots.filter((lot) => lot.goodsReceived).length, total: lots.length };
};

/**
 * 판정이 무엇으로 이어지는가.
 * - `record`: 지정 위치 — 단추 없이 곧바로 기록한다(SC-002).
 * - `confirm`: 지정되지 않은 위치 — 「정말 적치합니까?」 뒤 [미지정 위치 적치].
 * - `blocked`: 그 밖 — [다시 스캔]만. 기록하지 않는다.
 */
export type VerdictKind = 'record' | 'confirm' | 'blocked';

export const verdictKindOf = (code: LocationVerdictCode): VerdictKind =>
  code === 'DESIGNATED' ? 'record' : code === 'UNDESIGNATED' ? 'confirm' : 'blocked';

/** 판정 문구는 판정 코드로 꺼낸다 — 서버 메시지는 한국어 하나라 베트남어 화면에 그대로 쓰지 않는다. */
export const verdictTextOf = (code: string): string | null =>
  code in t.verdict ? t.verdict[code as keyof typeof t.verdict] : null;

export const reasonTextOf = (code: string): string | null =>
  code in t.reason ? t.reason[code as keyof typeof t.reason] : null;

export const modeTextOf = (code: string | null | undefined): string | null =>
  code !== null && code !== undefined && code in t.mode
    ? t.mode[code as keyof typeof t.mode]
    : null;

/** 오류의 코드들 — 봉투 항목의 코드, 없으면 응답의 코드. */
export const errorCodesOf = (error: ApiError): string[] => {
  switch (error.kind) {
    case 'validation':
    case 'stateLocked':
      return error.errors.map((item) => item.code);
    case 'conflict':
    case 'http':
      return error.code === undefined ? [] : [error.code];
    case 'network':
      return [];
  }
};

/**
 * 서버가 거절한 적치 기록의 판정 문구 — 지시 없는 적치의 판정 · 이유 코드와, 지시 적치(`:complete`)가 코어에서 받는
 * `LOCATION_ITEM_RESTRICTED`(「지정 품목만 받기」 위치 · T054). 모르는 코드면 null.
 */
export const rejectionTextOf = (codes: readonly string[]): string | null => {
  for (const code of codes) {
    const text =
      code === 'LOCATION_ITEM_RESTRICTED'
        ? t.verdict.RESTRICTED_LOCATION
        : (verdictTextOf(code) ?? reasonTextOf(code));
    if (text !== null) return text;
  }
  return null;
};

export const DIRECT_PUTAWAY_PATH = /^\/logistics\/putaway-pending-lots\/\d+:putaway(-temporary)?$/;

/**
 * 적치 쓰기(`:putaway`)를 대기열에 담을 건. 수량은 보내지 않는다 — 서버가 입고 가능 수량 전부를 입고한다.
 * 미지정 위치는 사람이 [미지정 위치 적치]를 눌렀을 때만 확인 표시를 싣는다(아니면 서버가 409).
 */
export const toDirectDraft = (
  lot: Pick<PendingLot, 'lotId' | 'lotNo'>,
  check: Pick<LocationCheck, 'locationCode'> & { locationId: number },
  confirmUndesignated: boolean,
  now: Date,
  workerNo: string,
): OutboxDraft => {
  const occurredAt = now.toISOString();
  const body: PutawayDirect = {
    locationId: check.locationId,
    ...(confirmUndesignated ? { confirmUndesignated: true } : {}),
    businessDate: businessDateOf(now),
    occurredAt,
  };

  return {
    label: messages.putaway.record,
    summary: `${lot.lotNo} → ${check.locationCode}`,
    workerNo,
    idempotencyKey: createIdempotencyKey(),
    method: 'POST',
    path: `/logistics/putaway-pending-lots/${String(lot.lotId)}:putaway`,
    body,
    occurredAt,
    confirmation: 'pending',
  };
};
