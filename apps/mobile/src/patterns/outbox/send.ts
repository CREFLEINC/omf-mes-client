import type { ApiError } from '@omf-mes/api-client';

import { ApiRequestError } from '../request';
import type { OutboxEntry } from './queue';

/** 한 건을 실제로 보내는 자리. 실패는 던져 올린다. */
export type OutboxTransport = (entry: OutboxEntry) => Promise<void>;

export interface OutboxRejection {
  entry: OutboxEntry;
  /** 이 건이 거부된 이유. 딸려 되돌아온 건에는 앞 건의 이유가 들어 있다. */
  error: ApiError;
  /** 앞 건이 거부돼 함께 되돌아온 것. 이 건 자체는 서버에 가지 않았다. */
  cascaded: boolean;
}

export interface FlushResult {
  sent: number;
  rejected: OutboxRejection[];
  remaining: OutboxEntry[];
  /** 큐를 비운 것과 도중에 멈춘 것은 다르다. 뒤엣것은 남은 것을 그대로 둔다. */
  outcome: 'drained' | 'unreachable';
}

/**
 * 담긴 순서대로 보낸다.
 *
 * 병렬로 보내지 않는다 — 앞 건이 만든 식별자를 뒤 건이 참조하는 묶음이 있어, 순서가 뒤집히면
 * 뒤 건이 가리킬 것이 없다.
 *
 * 거부는 그 건만 빼고 나머지를 계속 보낸다. 마흔 건 중 하나가 거부됐다고 서른아홉을 되돌리면
 * 현장이 멈춘다. 다만 묶음의 앞이 거부되면 딸린 뒤는 반드시 실패하므로 함께 되돌린다.
 *
 * 서버가 판정해 거부한 것만 큐에서 뺀다. 닿지 못했거나 무엇인지 모를 실패는 거기서 멈추고
 * 남은 것을 그대로 둔다 — 판정을 받지 못한 기록을 버리면 되찾을 자리가 없다.
 */
export const flushQueue = async (
  entries: OutboxEntry[],
  send: OutboxTransport,
): Promise<FlushResult> => {
  const rejected: OutboxRejection[] = [];
  const brokenBatches = new Map<string, ApiError>();
  let sent = 0;

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];

    if (entry === undefined) {
      continue;
    }

    const brokenBy = entry.batchId === undefined ? undefined : brokenBatches.get(entry.batchId);

    if (brokenBy !== undefined) {
      rejected.push({ entry, error: brokenBy, cascaded: true });
      continue;
    }

    try {
      await send(entry);
      sent += 1;
    } catch (cause) {
      const stop = (): FlushResult => ({
        sent,
        rejected,
        remaining: entries.slice(index),
        outcome: 'unreachable',
      });

      if (!(cause instanceof ApiRequestError)) {
        return stop();
      }

      const error = cause.apiError;

      if (error.kind === 'network') {
        return stop();
      }

      rejected.push({ entry, error, cascaded: false });

      if (entry.batchId !== undefined) {
        brokenBatches.set(entry.batchId, error);
      }
    }
  }

  return { sent, rejected, remaining: [], outcome: 'drained' };
};
