import type { ApiClient, components } from '@omf-mes/api-client';
import { useEffect, useRef } from 'react';

import { useApiClient } from './api-context';
import { isRejected } from './outbox-policy';
import { runRequest, toApiError } from './request';

/**
 * 없앤 POP 화면이 남긴 오프라인 큐를 비운다(omf-all-around#293).
 *
 * 생산 포장(P-02-08)·PQC 제품 검사(P-02-13) 화면은 확정을 단말 저장소에 담고 «그 화면이 떠 있을 때»
 * 보냈다. 화면을 없앤 뒤에는 보낼 곳이 없어, 배포 때 단말에 남아 있던 확정이 조용히 사라진다 —
 * 작업자는 이미 「저장했습니다」를 봤다. POP 이 켜져 있는 동안 여기서 같은 멱등 키로 마저 보낸다.
 *
 * - 서버가 받았거나 거부한 건은 내린다(거부는 다시 보내도 풀리지 않는다 — 공유계약 C-2).
 * - 통신·일시 장애·인증(401)은 남겨 두고 다음 기회(연결 회복·다시 켜기)에 보낸다.
 * - 모양이 깨진 건은 버린다 — 남기면 그 뒤의 정상 건까지 막는다.
 */

type Client = ApiClient['client'];
type InspectionResultCreate = components['schemas']['InspectionResultCreate'];
type HandlingUnitCreate = components['schemas']['HandlingUnitCreate'];
type HandlingUnitPack = components['schemas']['HandlingUnitPack'];

interface LegacyQueue<Entry> {
  storageKey: string;
  parse: (value: unknown) => Entry | null;
  send: (client: Client, entry: Entry) => Promise<unknown>;
}

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

const filled = (value: unknown): value is string => typeof value === 'string' && value !== '';

interface Attributed {
  idempotencyKey: string;
  workerNo: string;
}

const attributionOf = (entry: Record<string, unknown>): Attributed | null =>
  filled(entry.idempotencyKey) && filled(entry.workerNo) && entry.workerNo.trim() !== ''
    ? { idempotencyKey: entry.idempotencyKey, workerNo: entry.workerNo }
    : null;

const headerOf = (entry: Attributed) =>
  ({ 'Idempotency-Key': entry.idempotencyKey, 'X-Worker-No': entry.workerNo }) as const;

interface PqcEntry extends Attributed {
  body: InspectionResultCreate;
}

/** PQC 제품 검사 큐(`omf-mes.pqc-inspection.outbox`) — 계약이 필수로 둔 칸만 확인한다. */
export const pqcQueue: LegacyQueue<PqcEntry> = {
  storageKey: 'omf-mes.pqc-inspection.outbox',
  parse: (value) => {
    const entry = record(value);
    const body = record(entry?.body);
    const attributed = entry === null ? null : attributionOf(entry);

    if (attributed === null || body === null) return null;

    const numbers = [
      'inspectionRequestId',
      'inspectedQty',
      'acceptedQty',
      'rejectedQty',
      'heldQty',
      'uomId',
    ];

    if (!numbers.every((field) => typeof body[field] === 'number')) return null;
    if (!filled(body.inspectedAt) || !filled(body.statusCode)) return null;

    return { ...attributed, body: body as unknown as InspectionResultCreate };
  },
  send: (client, entry) =>
    runRequest(() =>
      client.POST('/quality/inspection-results', {
        params: { header: { 'Idempotency-Key': entry.idempotencyKey } },
        headers: { 'X-Worker-No': entry.workerNo },
        body: entry.body,
      }),
    ),
};

type PackingEntry =
  | (Attributed & { kind: 'pack'; handlingUnitId: number; body: HandlingUnitPack })
  | (Attributed & { kind: 'create'; body: HandlingUnitCreate });

/**
 * 생산 포장 큐(`omf-mes.packing-work.outbox`). `kind` 가 없으면 그보다 앞선 판(포장 생성)이 담은 것이다.
 * 확정은 시각 두 칸이 없으면 보내지 않는다 — 서버가 받은 때로 잡히면 원장이 두 건이 된다(C-8).
 */
export const packingQueue: LegacyQueue<PackingEntry> = {
  storageKey: 'omf-mes.packing-work.outbox',
  parse: (value) => {
    const entry = record(value);
    const body = record(entry?.body);
    const attributed = entry === null ? null : attributionOf(entry);

    if (attributed === null || body === null) return null;
    if (!Array.isArray(body.contents) || body.contents.length === 0) return null;

    if (entry?.kind === 'pack') {
      if (typeof entry.handlingUnitId !== 'number') return null;
      if (!filled(body.businessDate) || !filled(body.occurredAt)) return null;

      return {
        ...attributed,
        kind: 'pack',
        handlingUnitId: entry.handlingUnitId,
        body: body as unknown as HandlingUnitPack,
      };
    }

    if (entry?.kind !== undefined && entry.kind !== 'create') return null;
    if (!filled(body.handlingUnitTypeCode)) return null;

    return { ...attributed, kind: 'create', body: body as unknown as HandlingUnitCreate };
  },
  send: (client, entry) =>
    entry.kind === 'pack'
      ? runRequest(() =>
          client.POST('/inventory/handling-units/{handlingUnitId}:pack', {
            params: { path: { handlingUnitId: entry.handlingUnitId }, header: headerOf(entry) },
            body: entry.body,
          }),
        )
      : runRequest(() =>
          client.POST('/inventory/handling-units', {
            params: { header: headerOf(entry) },
            body: entry.body,
          }),
        ),
};

const readQueue = (storageKey: string): unknown[] => {
  try {
    const raw = globalThis.localStorage.getItem(storageKey);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueue = (storageKey: string, rest: readonly unknown[]): void => {
  try {
    if (rest.length === 0) globalThis.localStorage.removeItem(storageKey);
    else globalThis.localStorage.setItem(storageKey, JSON.stringify(rest));
  } catch {
    /* 저장소를 못 쓰면 다음에 다시 보낸다 — 멱등 키가 같아 서버가 두 번 세우지 않는다. */
  }
};

/** 기다리면 풀리는 실패인가 — 인증(401)은 단말 토큰이 다시 서면 풀린다. */
const shouldWait = (error: unknown): boolean => {
  const apiError = toApiError(error);

  return !isRejected(error) || (apiError.kind === 'http' && apiError.status === 401);
};

/** 큐 하나를 앞에서부터 한 건씩 보낸다. 기다려야 하는 실패를 만나면 그 건부터 남기고 멈춘다. */
export const drainLegacyQueue = async <Entry>(
  client: Client,
  queue: LegacyQueue<Entry>,
): Promise<void> => {
  const stored = readQueue(queue.storageKey);
  let sentUpTo = 0;

  for (const value of stored) {
    const entry = queue.parse(value);

    if (entry !== null) {
      try {
        await queue.send(client, entry);
      } catch (error) {
        if (shouldWait(error)) break;
        console.warn(
          `[pop-legacy-outbox] ${queue.storageKey} 의 한 건을 서버가 거부해 내렸습니다`,
          error,
        );
      }
    }

    sentUpTo += 1;
  }

  if (stored.length > 0) writeQueue(queue.storageKey, stored.slice(sentUpTo));
};

/**
 * 단말이 등록돼 있으면 켜질 때와 연결이 돌아올 때 남은 큐를 비운다.
 * 겹쳐 돌면 같은 건이 두 번 나간다 — 멱등 키가 같아 서버가 흡수하지만 굳이 겹치지 않는다.
 */
export const useLegacyOutboxDrain = (registered: boolean): void => {
  const { client } = useApiClient();
  const draining = useRef(false);

  useEffect(() => {
    if (!registered) return;

    const drain = (): void => {
      if (draining.current) return;
      draining.current = true;
      void drainLegacyQueue(client, pqcQueue)
        .then(() => drainLegacyQueue(client, packingQueue))
        .finally(() => {
          draining.current = false;
        });
    };

    drain();
    globalThis.addEventListener('online', drain);

    return () => globalThis.removeEventListener('online', drain);
  }, [client, registered]);
};
