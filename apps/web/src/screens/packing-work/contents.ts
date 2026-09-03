import type { HandlingUnitContentUpsert, Lot, PackingLine } from './types';

/**
 * 내용물을 담고 세는 규칙. **화면 밖에서 검사할 수 있게 떼어 둔다** — 합산과 혼적 판정이
 * 이 화면의 업무 규칙이고, 렌더 안에 섞이면 그 규칙만 따로 확인할 수 없다.
 */

/** 수량 입력을 읽은 결과. **못 읽은 것과 0 이하를 가른다** — 사용자에게 할 말이 다르다. */
export type QuantityVerdict =
  { ok: true; qty: number } | { ok: false; reason: 'empty' | 'notNumber' | 'notPositive' };

/**
 * 손으로 친 수량을 읽는다.
 *
 * ⛔ **`Number('')` 가 `0` 인 것에 기대지 않는다.** 빈 칸을 0 으로 읽으면 「아직 안 넣었다」가
 * 「0 개를 담겠다」가 되어, 사용자는 왜 막혔는지 모른 채 「0보다 커야 한다」를 본다.
 */
export const judgeQuantity = (raw: string): QuantityVerdict => {
  const text = raw.trim();

  if (text === '') return { ok: false, reason: 'empty' };

  const parsed = Number(text);

  if (!Number.isFinite(parsed)) return { ok: false, reason: 'notNumber' };
  if (parsed <= 0) return { ok: false, reason: 'notPositive' };

  return { ok: true, qty: parsed };
};

/**
 * 같은 품목·LOT 을 다시 담으면 **행을 늘리지 않고 수량을 합산한다**(스펙 §6 · `uq_handling_unit_content`).
 *
 * ⛔ **덮어쓰지 않는다.** 작업자는 박스에 100 개를 넣고 다시 50 개를 넣은 것이지 「50 개로
 * 고친다」고 한 것이 아니다. 덮어쓰면 실물과 기록이 갈리고, 되돌릴 화면이 없다(§8-4).
 *
 * ⛔ **원본 배열을 고치지 않는다** — 담기 실패로 되돌려야 할 때 앞 상태가 남아 있어야 한다.
 */
export const addLine = (lines: readonly PackingLine[], next: PackingLine): PackingLine[] => {
  const index = lines.findIndex((line) => line.lotId === next.lotId && line.itemId === next.itemId);

  if (index === -1) return [...lines, next];

  return lines.map((line, at) => (at === index ? { ...line, qty: line.qty + next.qty } : line));
};

/** 담은 것의 합계. 표 아래 한 줄로 보인다(스펙 §3). */
export const totalQty = (lines: readonly PackingLine[]): number =>
  lines.reduce((sum, line) => sum + line.qty, 0);

/**
 * 혼적 — 한 포장에 **여러 LOT** 이 들어갔는가(스펙 §5-5).
 *
 * ⛔ **막지 않는다.** 경고만 보인다 — 추적은 내용물 행으로 남는다. 여기서 막으면 실물로는
 * 가능한 포장을 화면이 거부하게 된다.
 */
export const isMixedLot = (lines: readonly PackingLine[]): boolean =>
  new Set(lines.map((line) => line.lotId)).size > 1;

/**
 * 확정 요청에 실을 내용물.
 *
 * ⚠ **집합을 통째로 치환한다** — 계약이 「요청에서 빠진 기존 행은 삭제한다」고 못박았다
 * (공유계약 A-5). 그래서 담은 것 **전부**를 매번 싣는다. 마지막에 담은 것만 보내면 앞서
 * 담은 행이 서버에서 지워진다.
 */
export const toContentUpserts = (lines: readonly PackingLine[]): HandlingUnitContentUpsert[] =>
  lines.map((line) => ({
    itemId: line.itemId,
    lotId: line.lotId,
    qty: line.qty,
    uomId: line.uomId,
  }));

/**
 * 스캔한 코드로 포장 대상 LOT 을 찾는다.
 *
 * ⚠ **목록 밖의 LOT 은 담지 않는다.** 이 화면의 대상은 「이 작업지시의 완료된 생산LOT」이고
 * (스펙 §0 · §4-B), 목록에 없는 번호를 담으면 화면이 그 LOT 의 품목·단위를 모르는 채로
 * 값을 지어내야 한다.
 */
export const findScannedLot = (lots: readonly Lot[], code: string): Lot | null => {
  const text = code.trim();

  if (text === '') return null;

  return lots.find((lot) => lot.lotNo === text) ?? null;
};

/** LOT 한 건을 담을 줄로 옮긴다. 품목·단위는 **LOT 이 알려 준다** — 화면이 고르지 않는다. */
export const toPackingLine = (lot: Lot, qty: number): PackingLine => ({
  lotId: lot.lotId,
  lotNo: lot.lotNo,
  itemId: lot.itemId,
  uomId: lot.uomId,
  qty,
});
