import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import type { HandlingUnitContent, ScannedHandlingUnit } from '../../patterns/handling-units';
import { createIdempotencyKey, type OutboxDraft } from '../../patterns/outbox';

export type HandlingUnitContentUpsert = components['schemas']['HandlingUnitContentUpsert'];
export type HandlingUnitCreate = components['schemas']['HandlingUnitCreate'];

/** 계약이 열어 둔 세 값. 합병·분할·재구성이고 그 밖은 없다. */
export const MERGE = 'MERGE';
export const SPLIT = 'SPLIT';
export const RECONFIGURE = 'RECONFIGURE';

export type RepackType = typeof MERGE | typeof SPLIT | typeof RECONFIGURE;

/** 새 포장에 담을 한 줄. 화면이 수량을 글자로 받으므로 여기서 수로 바꾼다. */
export interface DraftLine {
  itemId: number;
  lotId: number;
  uomId: number;
  qty: string;
}

const keyOf = (line: { itemId: number; lotId: number }): string =>
  `${String(line.itemId)}/${String(line.lotId)}`;

/**
 * 원 포장들의 내용을 한 벌로 모은다.
 *
 * 같은 품목·LOT 이 여러 포장에서 만나면 합친다 - 구성 표가 같은 짝을 두 줄로 갖지 못한다.
 * 합쳤다는 사실은 화면이 말한다. 조용히 합치면 어느 포장에서 얼마가 왔는지 못 본다.
 */
export const pooledContents = (sources: ScannedHandlingUnit[]): HandlingUnitContent[] => {
  const pooled = new Map<string, HandlingUnitContent>();

  for (const source of sources) {
    for (const content of source.contents) {
      const key = keyOf(content);
      const seen = pooled.get(key);

      pooled.set(key, seen === undefined ? content : { ...seen, qty: seen.qty + content.qty });
    }
  }

  return [...pooled.values()];
};

/** 여러 포장에서 만나 합쳐진 짝과 그 조각들. 어디서 얼마가 왔는지를 말할 자리다. */
export interface MergedPair {
  content: HandlingUnitContent;
  parts: number[];
}

export const mergedPairs = (sources: ScannedHandlingUnit[]): MergedPair[] => {
  const parts = new Map<string, number[]>();

  for (const source of sources) {
    for (const content of source.contents) {
      parts.set(keyOf(content), [...(parts.get(keyOf(content)) ?? []), content.qty]);
    }
  }

  return pooledContents(sources)
    .map((content) => ({ content, parts: parts.get(keyOf(content)) ?? [] }))
    .filter((pair) => pair.parts.length > 1);
};

export type QtyProblem = 'notNumber' | 'negative' | 'overPooled';

/**
 * 새 포장에 적은 수량 하나를 본다.
 *
 * 0 을 막지 않는다 - 전량을 새 포장으로 옮기면 잔량이 0 이 되고 그것도 재구성이다. 다만 원
 * 포장에 있는 것보다 많이 담을 수는 없다.
 */
export const qtyProblemOf = (line: DraftLine, pooledQty: number): QtyProblem | null => {
  const trimmed = line.qty.trim();
  const value = Number(trimmed);

  if (trimmed === '' || !Number.isFinite(value)) {
    return 'notNumber';
  }

  if (value < 0) {
    return 'negative';
  }

  return value > pooledQty ? 'overPooled' : null;
};

export const sumOf = (contents: { qty: number }[]): number =>
  contents.reduce((total, content) => total + content.qty, 0);

const drafted = (lines: DraftLine[]): number =>
  lines.reduce((total, line) => total + (Number(line.qty.trim()) || 0), 0);

/** 새 포장에 담고 남는 것. 원 포장 번호를 그대로 쓰는 잔량이다. */
export const remainderOf = (
  sources: ScannedHandlingUnit[],
  lines: DraftLine[],
): HandlingUnitContent[] => {
  const taken = new Map<string, number>();

  for (const line of lines) {
    taken.set(keyOf(line), (taken.get(keyOf(line)) ?? 0) + (Number(line.qty.trim()) || 0));
  }

  return pooledContents(sources)
    .map((content) => ({ ...content, qty: content.qty - (taken.get(keyOf(content)) ?? 0) }))
    .filter((content) => content.qty > 0);
};

export const canConfirm = (
  sources: ScannedHandlingUnit[],
  lines: DraftLine[],
  hasWorker: boolean,
): boolean => {
  if (!hasWorker || sources.length === 0 || lines.length === 0) {
    return false;
  }

  const pooled = pooledContents(sources);

  const everyLineFits = lines.every((line) => {
    const pool = pooled.find((content) => keyOf(content) === keyOf(line));

    return pool !== undefined && qtyProblemOf(line, pool.qty) === null;
  });

  /* 아무것도 옮기지 않으면 바뀌는 것이 없다. 빈 재구성을 기록으로 남기지 않는다. */
  const moved = drafted(lines) > 0;

  return everyLineFits && moved;
};

const asUpsert = (content: { itemId: number; lotId: number; qty: number; uomId: number }) => ({
  itemId: content.itemId,
  lotId: content.lotId,
  qty: content.qty,
  uomId: content.uomId,
});

/**
 * 새 포장을 만든다.
 *
 * 발번은 서버가 한다. 라벨은 여기서 뽑지 않는다 - 프린터가 POP 스테이션에 있다.
 *
 * 원 포장 치환과 한 묶음이고 이것이 앞이다. 이것이 거부되면 뒤가 함께 되돌아간다 - 순서가
 * 뒤집히거나 앞만 빠지면 원 포장에서 물건이 빠져나가고 갈 곳이 없다.
 */
export const toCreateDraft = (
  sources: ScannedHandlingUnit[],
  lines: DraftLine[],
  batchId: string,
  now: Date,
  workerNo: string,
): OutboxDraft => {
  const first = sources[0]?.handlingUnit;
  const body: HandlingUnitCreate = {
    /*
     * 원 포장과 같은 유형이다. 카톤을 갈라도 카톤이고 팔레트를 갈라도 팔레트다. 값 목록을
     * 따로 받아 고르게 하면 작업자가 원 포장과 다른 것을 고를 수 있다.
     */
    handlingUnitTypeCode: first?.handlingUnitTypeCode ?? '',
    warehouseId: first?.warehouseId ?? null,
    locationId: first?.locationId ?? null,
    contents: lines
      .filter((line) => (Number(line.qty.trim()) || 0) > 0)
      .map((line) => asUpsert({ ...line, qty: Number(line.qty.trim()) })),
  };

  return {
    label: messages.packingRepack.record.created,
    workerNo,
    idempotencyKey: createIdempotencyKey(),
    method: 'POST',
    path: '/inventory/handling-units',
    body,
    batchId,
    occurredAt: now.toISOString(),
    confirmation: 'pending',
  };
};

/**
 * 원 포장의 구성을 남는 것으로 치환한다.
 *
 * 치환이라 요청에서 빠진 줄은 지워진다. 잔량이 없으면 빈 목록을 보내고, 그것이 원 포장을
 * 비운다는 뜻이다.
 *
 * 낙관적 잠금 토큰을 싣지 않는다 - 오프라인 큐에 쌓인 요청의 토큰은 이미 낡았고, 충돌 화면을
 * 볼 사람이 그 자리에 없다.
 */
export const toReplaceDraft = (
  source: ScannedHandlingUnit,
  remainder: HandlingUnitContent[],
  batchId: string,
  now: Date,
  workerNo: string,
): OutboxDraft => ({
  label: messages.packingRepack.record.replaced,
  workerNo,
  idempotencyKey: createIdempotencyKey(),
  method: 'PUT',
  path: `/inventory/handling-units/${String(source.handlingUnit.handlingUnitId)}/contents`,
  body: { items: remainder.map(asUpsert) },
  batchId,
  occurredAt: now.toISOString(),
  confirmation: 'pending',
});
