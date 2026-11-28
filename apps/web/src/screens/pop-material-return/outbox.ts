import type { ApiClient, ApiError, components } from '@omf-mes/api-client';

import { isRejected } from '../../patterns/outbox-policy';
import { runRequest, toApiError } from '../../patterns/request';
import type { MaterialReturnReceive } from './lines';

/**
 * P-01-03 반납 입고의 보낼 대기열 — 다른 POP 화면과 같은 방식(재작업 실적 `rework-result-register/outbox`).
 *
 * ⭐ 연결이 없거나 응답을 못 받으면 누른 순간의 본문(업무일 · 발생 시각 포함)과 멱등 키를 단말에 남기고, 연결이
 *    돌아오면 같은 키로 다시 보낸다. 귀속은 서버에 도착한 때 정해진다(spec 「오프라인」).
 * ⛔ 기다리면 풀리는 실패(연결 · 5xx)에서 항목을 내리지 않는다 — 내리면 작업자가 담은 반납이 사라진다(#772).
 */

type Client = ApiClient['client'];
export type MaterialReturn = components['schemas']['MaterialReturn'];

export interface MaterialReturnOutboxEntry {
  idempotencyKey: string;
  workerNo: string;
  body: MaterialReturnReceive;
}

const STORAGE_KEY = 'omf-mes.pop-material-return.outbox';

export interface DrainResult {
  accepted: number;
  rejected: number;
  /** 마지막으로 거부된 까닭. 화면이 서버 문구를 그대로 보인다. */
  lastRejection: ApiError | null;
}

let drainInFlight: Promise<DrainResult> | null = null;

const isEntry = (value: unknown): value is MaterialReturnOutboxEntry => {
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
    typeof fields.businessDate === 'string' &&
    typeof fields.occurredAt === 'string' &&
    Array.isArray(fields.lines) &&
    fields.lines.length > 0
  );
};

const readEntries = (): MaterialReturnOutboxEntry[] => {
  try {
    const parsed: unknown = JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
};

const writeEntries = (entries: readonly MaterialReturnOutboxEntry[]): void => {
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    throw new Error('반납 입고를 단말에 저장하지 못했습니다.');
  }
};

const removeEntry = (idempotencyKey: string): void => {
  writeEntries(readEntries().filter((entry) => entry.idempotencyKey !== idempotencyKey));
};

/** 대기열에 넣는다 — 이미 보낸 적 있는 시도면 그 멱등 키를 그대로 쓴다(서버가 받았을 수 있다). */
export const enqueueMaterialReturn = (entry: MaterialReturnOutboxEntry): void => {
  const rest = readEntries().filter((each) => each.idempotencyKey !== entry.idempotencyKey);
  writeEntries([...rest, entry]);
};

export const pendingMaterialReturnCount = (): number => readEntries().length;

export const postMaterialReturn = (
  client: Client,
  entry: MaterialReturnOutboxEntry,
): Promise<MaterialReturn> =>
  runRequest(() =>
    client.POST('/production/material-returns', {
      params: {
        header: { 'Idempotency-Key': entry.idempotencyKey, 'X-Worker-No': entry.workerNo },
      },
      body: entry.body,
    }),
  );

export const drainMaterialReturns = (client: Client): Promise<DrainResult> => {
  if (drainInFlight !== null) return drainInFlight;
  drainInFlight = (async () => {
    const entries = readEntries();
    let accepted = 0;
    let rejected = 0;
    let lastRejection: ApiError | null = null;
    for (const entry of entries) {
      try {
        await postMaterialReturn(client, entry);
        accepted += 1;
      } catch (error) {
        /* 기다리면 풀리는 실패는 던져 이 회차를 멈춘다 — 항목은 남아 다음 계기에 같은 키로 나간다. */
        if (!isRejected(error)) throw error;
        rejected += 1;
        lastRejection = toApiError(error);
      }
      /* 전송 중 새로 담긴 항목까지 snapshot 으로 덮어 지우지 않는다. */
      removeEntry(entry.idempotencyKey);
    }
    return { accepted, rejected, lastRejection };
  })().finally(() => {
    drainInFlight = null;
  });
  return drainInFlight;
};
