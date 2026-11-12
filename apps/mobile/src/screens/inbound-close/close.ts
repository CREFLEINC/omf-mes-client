import type { ApiError, InboundLot, InboundLotReopenReasonCode } from '@omf-mes/api-client';

/**
 * M-01-03 입하 마감의 판정 · 표기 — 화면이 그리기만 하게 여기 모은다(005 · screens/M-01-03.md).
 */

/** 수량 — 천 단위 쉼표, 소수는 받은 만큼. */
export const formatQty = (qty: number, uomCode: string): string =>
  `${qty.toLocaleString('ko-KR', { maximumFractionDigits: 6 })} ${uomCode}`;

const pad = (value: number): string => String(value).padStart(2, '0');

/** 「11-11 08:05」 — 기기 시각(공장 기기). 읽지 못하면 받은 그대로. */
export const shortWhen = (iso: string | null): string => {
  if (iso === null) return '';

  const at = new Date(iso);

  if (Number.isNaN(at.getTime())) return iso;

  return `${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
};

/** 「2026-11-11 08:05」. */
export const fullWhen = (iso: string | null): string => {
  if (iso === null) return '';

  const at = new Date(iso);

  if (Number.isNaN(at.getTime())) return iso;

  return `${String(at.getFullYear())}-${shortWhen(iso)}`;
};

/** LOT 번호 끝 칸(일련번호) — 「…|0003」의 0003. */
export const lotTail = (lotNo: string): string => lotNo.split('|').at(-1) ?? lotNo;

/** 입하 LOT 번호 끝 4자리 — 막힘 창의 [0003 열기]. */
export const inboundTail = (inboundLotNo: string): string => inboundLotNo.slice(-4);

/**
 * 같은 공급사·품목의 **다른** 입하 중 입하 LOT — 있으면 마감 취소가 막힌다(`OPEN_RECEIPT_EXISTS`).
 * 입하 중 입하 LOT 는 공급사·품목마다 하나뿐이라 목록에서 미리 찾는다(screens/M-01-03.md 「막힘 줄」).
 */
export const openBlockerOf = (
  target: InboundLot,
  receiving: readonly InboundLot[],
): InboundLot | null =>
  receiving.find(
    (each) =>
      each.inboundLotId !== target.inboundLotId &&
      each.statusCode === 'RECEIVING' &&
      each.supplierId === target.supplierId &&
      each.itemId === target.itemId,
  ) ?? null;

/** 마감 취소를 막는 서버 코드(계약 §3 `:reopen-receipt` 409 `blockers[]` — `errors[].code`). */
export const REOPEN_BLOCKER_CODES = [
  'OPEN_RECEIPT_EXISTS',
  'IQC_RECORDED',
  'GOODS_RECEIVED',
  'SKIP_PENDING',
  'INBOUND_LOT_FINALIZED',
  'LEGACY_INBOUND_LOT',
] as const;

export type ReopenBlockerCode = (typeof REOPEN_BLOCKER_CODES)[number];

const codesOf = (error: ApiError): string[] =>
  error.kind === 'validation' || error.kind === 'stateLocked'
    ? error.errors.map((item) => item.code)
    : [];

/** 409 의 막힘 코드들 — 계약에 적힌 것만. */
export const reopenBlockersOf = (error: ApiError): ReopenBlockerCode[] =>
  codesOf(error).filter((code): code is ReopenBlockerCode =>
    (REOPEN_BLOCKER_CODES as readonly string[]).includes(code),
  );

/** 판(버전)이 낡았는가 — 다른 기기가 먼저 바꿨다. */
export const isVersionConflict = (error: ApiError): boolean =>
  error.kind === 'conflict' || codesOf(error).includes('VERSION_CONFLICT');

/** 상태가 바뀌어 잠겼는가(그사이 마감 · 최종 마감 등). */
export const isStateLocked = (error: ApiError): boolean =>
  error.kind === 'stateLocked' || codesOf(error).includes('STATE_LOCKED');

/** 마감 취소 가능 건의 까닭 — 서버가 비워 보내면 IQC 결과 0건으로 읽는다(목록 조건이 그것만 낸다). */
export const reopenReasonOf = (lot: InboundLot): InboundLotReopenReasonCode =>
  lot.reopenReasonCode ?? (lot.inspectionRequired ? 'NO_IQC_RESULT' : 'INSPECTION_NOT_REQUIRED');
