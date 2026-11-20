/**
 * 재발행 사유 중 **서버만 쓰는 것** — 사람이 고르는 목록에서 뺀다(피처 013 · research R-7).
 *
 * `LOT_SPLIT`(「LOT 분리」)은 생산 LOT 분리(P-04-08)가 원래 LOT 라벨을 다시 발행할 때 서버가 자동으로 붙인다.
 * 사람 요청이 보내면 서버가 거절하므로(422 INVALID), 고를 수 있게 두면 누른 뒤에야 막힌다.
 *
 * ⭐ 코드 사전(`REISSUE_REASON`)은 고객이 늘리는 값이라 화면이 이름을 지어내지 않는다 — 여기서는 빼기만 한다.
 */
export const SYSTEM_REISSUE_REASON_CODES: ReadonlySet<string> = new Set(['LOT_SPLIT']);

/** 사람이 고르는 재발행 사유만 남긴다. */
export const withoutSystemReissueReasons = <T extends { code: string }>(
  reasons: readonly T[],
): T[] => reasons.filter((reason) => !SYSTEM_REISSUE_REASON_CODES.has(reason.code));
