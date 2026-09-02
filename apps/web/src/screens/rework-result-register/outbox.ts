import type { ApiClient } from '@omf-mes/api-client';

import { runRequest, toApiError } from '../../patterns/request';
import type { ProductionResult, ProductionResultCreate } from './types';

type Client = ApiClient['client'];

export interface ReworkResultOutboxEntry {
  idempotencyKey: string;
  workerNo: string;
  body: ProductionResultCreate;
}

const STORAGE_KEY = 'omf-mes.rework-result-register.outbox';
export interface DrainResult {
  accepted: number;
  rejected: number;
}

let drainInFlight: Promise<DrainResult> | null = null;

const isEntry = (value: unknown): value is ReworkResultOutboxEntry => {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  const body = entry.body;
  if (typeof body !== 'object' || body === null) return false;
  const fields = body as Record<string, unknown>;
  return (
    typeof entry.idempotencyKey === 'string' &&
    entry.idempotencyKey !== '' &&
    typeof entry.workerNo === 'string' &&
    entry.workerNo !== '' &&
    typeof fields.workOrderId === 'number' &&
    typeof fields.uomId === 'number' &&
    typeof fields.resultSourceCode === 'string' &&
    typeof fields.occurredAt === 'string'
  );
};

const readEntries = (): ReworkResultOutboxEntry[] => {
  try {
    const parsed: unknown = JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
};

const writeEntries = (entries: readonly ReworkResultOutboxEntry[]): void => {
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    throw new Error('실적을 단말에 저장하지 못했습니다.');
  }
};

const removeEntry = (idempotencyKey: string): void => {
  writeEntries(readEntries().filter((entry) => entry.idempotencyKey !== idempotencyKey));
};

export const enqueueReworkResult = (
  workerNo: string,
  body: ProductionResultCreate,
): ReworkResultOutboxEntry => {
  const entry = { idempotencyKey: crypto.randomUUID(), workerNo, body };
  writeEntries([...readEntries(), entry]);
  return entry;
};

export const pendingReworkResultCount = (): number => readEntries().length;

export const postReworkResult = async (
  client: Client,
  entry: ReworkResultOutboxEntry,
): Promise<ProductionResult> =>
  runRequest(() =>
    client.POST('/production/production-results', {
      params: {
        header: {
          'Idempotency-Key': entry.idempotencyKey,
          'X-Worker-No': entry.workerNo,
        },
      },
      body: entry.body,
    }),
  );

export const drainReworkResults = (client: Client): Promise<DrainResult> => {
  if (drainInFlight !== null) return drainInFlight;
  drainInFlight = (async () => {
    const entries = readEntries();
    let accepted = 0;
    let rejected = 0;
    for (const entry of entries) {
      try {
        await postReworkResult(client, entry);
        accepted += 1;
      } catch (error) {
        if (toApiError(error).kind === 'network') throw error;
        rejected += 1;
      }
      /* 전송 중 새로 담긴 항목까지 snapshot으로 덮어 지우지 않는다. */
      removeEntry(entry.idempotencyKey);
    }
    return { accepted, rejected };
  })().finally(() => {
    drainInFlight = null;
  });
  return drainInFlight;
};
