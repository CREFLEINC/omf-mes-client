import { readLocal, writeLocal } from '../../patterns/local-store';
import type { GoodsIssueLineUpsert } from './picking';

/** 담는 자리의 이름. 적는 쪽과 읽는 쪽이 이 상수를 함께 쓴다. */
export const ISSUED_KEY = 'material-picking-issued';

/** 이 지시로 내보낸 한 건. 되돌아온 것을 가려내려면 멱등키가 함께 있어야 한다. */
export interface IssuedRecord {
  idempotencyKey: string;
  pickingOrderId: number;
  lines: GoodsIssueLineUpsert[];
}

/*
 * 얼마나 오래 들고 있을 것인가.
 *
 * 지시가 끝났다는 것을 서버가 말해 주지 않아 지울 때를 알 수 없다. 무한정 쌓으면 단말
 * 보관소가 찬다 - 그러면 담기 자체가 실패해 적은 것이 어디에도 없게 된다.
 *
 * 최근 것부터 이만큼만 남긴다. 한 작업자가 한 교대에 내보내는 지시보다 넉넉하고, 그보다
 * 오래된 지시를 다시 열어 또 내보내려는 일은 서버가 막는다.
 */
const KEEP = 200;

/** 내보낸 기록을 읽는다. 깨진 값은 없는 것으로 본다 - 여기서 멈추면 화면이 아예 안 뜬다. */
export const readIssued = async (): Promise<IssuedRecord[]> => {
  const raw = await readLocal(ISSUED_KEY);

  if (raw === null) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed) ? (parsed as IssuedRecord[]) : [];
  } catch {
    return [];
  }
};

/** 내보낸 기록을 더한다. 담기지 못하면 알리지 않는다 - 서버가 두 번째 출고를 막는다. */
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
