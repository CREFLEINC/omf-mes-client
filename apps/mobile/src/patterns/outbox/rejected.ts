import type { ApiError } from '@omf-mes/api-client';

import { readLocal, writeLocal } from '../local-store';
import type { OutboxEntry } from './queue';
import type { OutboxRejection } from './send';

/**
 * 서버가 되돌린 건. 큐에서는 빠졌고 다시 보내지 않는다.
 *
 * 거부는 다시 보내서 풀리는 것이 아니라 사람이 무엇을 할지 정해야 하는 결과다. 남겨 두지
 * 않으면 화면에서 사라지고, 적은 사람은 자기 기록이 어디로 갔는지 알 방법이 없다.
 */
export interface RejectedRecord {
  entry: OutboxEntry;
  error: ApiError;
  /** 앞 건이 거부돼 함께 되돌아온 것. 이 건 자체는 서버에 가지 않았다. */
  cascaded: boolean;
  rejectedAt: string;
}

export interface BrokenBatch {
  error: ApiError;
  /**
   * 이 시각보다 앞서 만들어진 건만 딸림으로 본다. 비우면 회차 안의 모든 뒤 건에 걸린다 -
   * 그 건들은 회차가 시작될 때 이미 큐에 있었으므로 따질 것이 없다.
   *
   * 묶음 이름만 기억하면 그 이름을 쓰는 새 시도까지 영영 막힌다 - 사람이 사유를 보고 고쳐
   * 다시 한 것은 앞 거부와 무관한 새 기록이다. 막아야 하는 것은 거부를 알기 전에 만들어져
   * 그 결과를 이미 싣고 있는 건뿐이다.
   */
  since?: string;
}

/**
 * 이미 되돌아온 건이 남긴 딸림 판정.
 *
 * 딸림 되돌리기가 한 번의 보내기 안에서만 걸리면, 앞 건이 앞 회차에 거부돼 큐에서 빠진 뒤
 * 뒤 건이 혼자 나간다 - 그 뒤 건은 앞 건의 결과를 싣고 있어, 서버가 받지 않은 수량이 그대로
 * 기록된다. 되돌아온 건은 사람이 정리할 때까지 남으므로 그것을 회차 너머의 기억으로 쓴다.
 *
 * 한 묶음에 여러 번 거부가 쌓이면 가장 이른 것을 기준으로 둔다. 그보다 뒤에 만든 것은 새
 * 시도이고, 그것이 다시 딸림이 되는 경우는 같은 회차 안에서 걸린다.
 */
export const brokenBatchesOf = (records: RejectedRecord[]): Map<string, BrokenBatch> => {
  const broken = new Map<string, BrokenBatch>();

  for (const record of records) {
    const batchId = record.entry.batchId;

    if (batchId === undefined) {
      continue;
    }

    const previous = broken.get(batchId);

    if (previous?.since === undefined || record.rejectedAt < previous.since) {
      broken.set(batchId, { error: record.error, since: record.rejectedAt });
    }
  }

  return broken;
};

export const OUTBOX_REJECTED_KEY = 'outbox-rejected';

/** 읽지 못한 목록을 옮겨 두는 자리. 다음 저장이 덮어 없애는 것을 막는다. */
export const OUTBOX_REJECTED_BROKEN_KEY = 'outbox-rejected-broken';

/**
 * 남겨 두는 건수의 한도.
 *
 * 계약이 어긋나면 한 교대의 쓰기가 통째로 되돌아온다. 한도가 없으면 그 한 번으로 단말
 * 보관소가 찬다. 넘으면 오래된 것부터 버린다 - 방금 것일수록 아직 손쓸 수 있다.
 */
export const REJECTED_LIMIT = 100;

export const readRejected = async (): Promise<RejectedRecord[]> => {
  const stored = await readLocal(OUTBOX_REJECTED_KEY);

  if (stored === null) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(stored);

    if (Array.isArray(parsed)) {
      return parsed as RejectedRecord[];
    }
  } catch {
    // 아래에서 함께 다룬다.
  }

  /*
   * 읽지 못한 것을 그대로 두면 다음에 되돌아온 건이 덮어 없앤다. 다른 자리로 옮겨 원본을
   * 남긴다 - 무엇이 되돌아왔는지가 이 목록의 전부라, 여기서 버리면 되찾을 자리가 없다.
   */
  await writeLocal(OUTBOX_REJECTED_BROKEN_KEY, stored);

  return [];
};

export const writeRejected = async (records: RejectedRecord[]): Promise<void> => {
  await writeLocal(OUTBOX_REJECTED_KEY, JSON.stringify(records));
};

/*
 * 파일의 몸은 버린다. 다시 보내지 않는 건이라 들고 있을 곳이 없고, 사진 한 장이 수백 KB 라
 * 그대로 두면 큐에서 빠진 뒤에도 보관소를 그만큼 차지한다. 무엇이었는지는 이름이 말한다.
 */
const withoutFileBody = (entry: OutboxEntry): OutboxEntry =>
  entry.file === undefined ? entry : { ...entry, file: { ...entry.file, data: '' } };

export const appendRejected = (
  records: RejectedRecord[],
  rejections: OutboxRejection[],
  rejectedAt: string,
): RejectedRecord[] => {
  const added = rejections.map((rejection) => ({
    entry: withoutFileBody(rejection.entry),
    error: rejection.error,
    cascaded: rejection.cascaded,
    rejectedAt,
  }));

  return [...records, ...added].slice(-REJECTED_LIMIT);
};

export const dropRejected = (records: RejectedRecord[], id: string): RejectedRecord[] =>
  records.filter((record) => record.entry.id !== id);
