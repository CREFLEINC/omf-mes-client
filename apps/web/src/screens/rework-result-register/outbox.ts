import type { ApiClient } from '@omf-mes/api-client';

import { isRejected } from '../../patterns/outbox-policy';
import { runRequest } from '../../patterns/request';
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
        /*
         * ⛔ **기다리면 풀리는 실패에서 항목을 내리지 않는다.** 던지면 이 회차가 멈추고 항목이
         * 큐에 남아, 다음 계기(연결 복구·화면 재진입)에 같은 멱등 키로 다시 나간다. 내려 버리면
         * 작업자가 남긴 재작업 실적이 사라지고, 화면은 이미 성공을 말한 뒤다(#772).
         */
        if (!isRejected(error)) throw error;
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
