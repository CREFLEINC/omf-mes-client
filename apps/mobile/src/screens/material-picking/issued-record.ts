import { readLocal, writeLocal } from '../../patterns/local-store';
import type { GoodsIssueLineUpsert } from './picking';

/** 단말 저장소에서 쓰는 열쇠. 적는 쪽과 읽는 쪽이 이 상수를 함께 쓴다. */
export const ISSUED_KEY = 'material-picking-issued';

/** 이 지시로 내보낸 한 건. 되돌아온 것을 가려내려면 멱등키가 함께 있어야 한다. */
export interface IssuedRecord {
  idempotencyKey: string;
  pickingOrderId: number;
  lines: GoodsIssueLineUpsert[];
}

/** 앞선 판이나 깨진 값이 섞일 수 있다. 라인이 없는 것을 세면 그 자리에서 멈춘다. */
const isRecord = (value: unknown): value is IssuedRecord => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Partial<IssuedRecord>;

  return (
    typeof record.idempotencyKey === 'string' &&
    typeof record.pickingOrderId === 'number' &&
    Array.isArray(record.lines)
  );
};

/*
 * 얼마나 오래 들고 있을 것인가.
 *
 * 지시가 끝났다는 것을 서버가 말해 주지 않아 지울 때를 알 수 없다. 끝없이 쌓으면 단말
 * 저장소가 차고, 그러면 저장 자체가 실패해 적은 것이 어디에도 남지 않는다.
 *
 * 최근 것부터 이만큼만 남긴다. 한 작업자가 한 교대에 내보내는 지시보다 넉넉하고, 그보다
 * 오래된 지시를 다시 열어 또 내보내려는 일은 서버가 막는다.
 */
const KEEP = 200;

/**
 * 내보낸 기록을 읽는다.
 *
 * 깨진 값은 없는 것으로 본다 - 여기서 멈추면 화면이 아예 안 뜬다. 요소 하나하나도 모양을
 * 본다. 앞선 판의 값이 남아 있을 수 있고, 라인이 빈 채로 들어오면 세는 자리에서 멈춘다.
 */
export const readIssued = async (): Promise<IssuedRecord[]> => {
  const raw = await readLocal(ISSUED_KEY);

  if (raw === null) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
  } catch {
    return [];
  }
};

/** 내보낸 기록을 더한다. */
export const appendIssued = async (record: IssuedRecord): Promise<IssuedRecord[]> => {
  const next = [...(await readIssued()), record].slice(-KEEP);

  await writeLocal(ISSUED_KEY, JSON.stringify(next));

  return next;
};

/**
 * 이 지시의 라인마다 이미 내보낸 양.
 *
 * 되돌아온 것은 나간 적이 없다. 빼 두면 다시 내보낼 길이 사라진다.
 */
export const issuedQtyByLine = (
  records: IssuedRecord[],
  pickingOrderId: number,
  isRejected: (idempotencyKey: string) => boolean,
): Map<number, number> => {
  const byLine = new Map<number, number>();

  for (const record of records) {
    if (record.pickingOrderId !== pickingOrderId || isRejected(record.idempotencyKey)) {
      continue;
    }

    for (const line of record.lines) {
      const lineId = line.pickingLineId;

      if (lineId !== null && lineId !== undefined) {
        byLine.set(lineId, (byLine.get(lineId) ?? 0) + line.issueQty);
      }
    }
  }

  return byLine;
};

/**
 * 출고 확정 응답에서 **서버가 매긴 출고번호**만 꺼낸다.
 *
 * ⭐ 작업자가 방금 만든 전표를 가리키는 번호다. 008 부터 출고 QR 은 발행하지 않고, 부분 출고분은
 *    분할 LOT 라벨을 POP(P-01-02)에서 찍는다(`splitLinesOf`).
 *
 * ⛔ **모양을 믿지 않는다.** 큐를 타는 쓰기라 응답이 없을 수도, 끊긴 자리에서 다른 것이 담길
 *    수도 있다 — 문자열일 때만 받는다. 없으면 `null` 이고, 화면은 그 줄을 세우지 않는다.
 */
export const goodsIssueNoOf = (response: unknown): string | null => {
  if (typeof response !== 'object' || response === null) return null;

  const value = (response as { goodsIssue?: { goodsIssueNo?: unknown } }).goodsIssue?.goodsIssueNo;

  return typeof value === 'string' && value.trim() !== '' ? value : null;
};

/** 부분 출고로 분할 LOT 이 생긴 출고 라인 한 줄(008 · omf-all-around#289). */
export interface SplitIssuedLine {
  pickingLineId: number | null;
  /** 분할 LOT 번호 — 라벨에 찍힐 번호. */
  lotNo: string;
  /** 분할된 원래 LOT 번호. */
  splitFromLotNo: string;
  issueQty: number;
  uomId: number | null;
}

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

/**
 * 출고 확정 응답에서 **분할 LOT 이 생긴 줄**만 꺼낸다 — `splitFromLotNo` 가 있는 라인이다(계약 `GoodsIssueLine`).
 *
 * ⭐ 분할 LOT 번호는 서버가 출고를 받을 때 정한다. 전량 출고한 줄은 붙어 있는 라벨을 그대로 쓰므로 넣지 않는다.
 * ⛔ **모양을 믿지 않는다**(`goodsIssueNoOf` 와 같은 까닭) — 모양이 다른 줄은 건너뛴다. 없으면 빈 목록이고,
 *    화면은 안내를 세우지 않는다.
 */
export const splitLinesOf = (response: unknown): SplitIssuedLine[] => {
  if (typeof response !== 'object' || response === null) return [];

  const lines = (response as { lines?: unknown }).lines;

  if (!Array.isArray(lines)) return [];

  return lines.flatMap((each: unknown) => {
    if (typeof each !== 'object' || each === null) return [];

    const line = each as Record<string, unknown>;

    if (!isText(line.splitFromLotNo) || !isText(line.lotNo) || typeof line.issueQty !== 'number') {
      return [];
    }

    return [
      {
        pickingLineId: typeof line.pickingLineId === 'number' ? line.pickingLineId : null,
        lotNo: line.lotNo,
        splitFromLotNo: line.splitFromLotNo,
        issueQty: line.issueQty,
        uomId: typeof line.uomId === 'number' ? line.uomId : null,
      },
    ];
  });
};
