import { waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../test/api-harness';
import { packingQueue, pqcQueue, useLegacyOutboxDrain } from './pop-legacy-outbox';

/**
 * 없앤 생산 포장·PQC 제품 검사 화면이 단말에 남긴 확정을 마저 보낸다(omf-all-around#293).
 * 작업자는 이미 「저장했습니다」를 봤으므로, 보낼 수 있는 것은 보내고 기다려야 하는 것은 남긴다.
 */

const PQC_KEY = 'omf-mes.pqc-inspection.outbox';
const PACK_KEY = 'omf-mes.packing-work.outbox';

const pqcBody = {
  inspectionRequestId: 1001,
  inspectedQty: 30,
  acceptedQty: 28,
  rejectedQty: 2,
  heldQty: 0,
  uomId: 10,
  inspectedAt: '2026-09-02T10:00:00+09:00',
  statusCode: 'CONFIRMED',
};
const pqcEntry = (key: string) => ({ idempotencyKey: key, workerNo: '900028', body: pqcBody });
const packEntry = {
  idempotencyKey: 'pack-1',
  kind: 'pack',
  handlingUnitId: 55,
  workerNo: '900028',
  body: {
    contents: [{ lotId: 1, qty: 10 }],
    businessDate: '2026-11-17',
    occurredAt: '2026-11-17T09:00:00+07:00',
  },
};

const stored = (key: string): unknown => {
  const raw = globalThis.localStorage.getItem(key);

  return raw === null ? null : JSON.parse(raw);
};

const route = (path: string, respond: (request: Request) => Response, seen: Request[] = []) => ({
  match: (request: Request) => new URL(request.url).pathname === path,
  respond: (request: Request) => {
    seen.push(request);

    return respond(request);
  },
});

beforeEach(() => {
  globalThis.localStorage.clear();
});

afterEach(() => {
  globalThis.localStorage.clear();
  vi.restoreAllMocks();
});

describe('남은 큐의 모양 확인', () => {
  it('PQC 결과는 계약이 필수로 둔 칸이 갖춰져야 보낸다', () => {
    expect(pqcQueue.parse(pqcEntry('k-1'))).not.toBeNull();
    expect(pqcQueue.parse({ ...pqcEntry(''), idempotencyKey: '' })).toBeNull();
    expect(pqcQueue.parse({ ...pqcEntry('k-1'), workerNo: ' ' })).toBeNull();
    expect(
      pqcQueue.parse({ ...pqcEntry('k-1'), body: { ...pqcBody, inspectedAt: '' } }),
    ).toBeNull();
    expect(
      pqcQueue.parse({ ...pqcEntry('k-1'), body: { ...pqcBody, acceptedQty: '28' } }),
    ).toBeNull();
    expect(pqcQueue.parse('broken')).toBeNull();
  });

  it('포장 확정은 시각 두 칸이 없으면 보내지 않는다 — 원장이 두 건이 된다', () => {
    expect(packingQueue.parse(packEntry)).toMatchObject({ kind: 'pack', handlingUnitId: 55 });
    expect(
      packingQueue.parse({ ...packEntry, body: { ...packEntry.body, occurredAt: '' } }),
    ).toBeNull();
    expect(
      packingQueue.parse({ ...packEntry, body: { ...packEntry.body, contents: [] } }),
    ).toBeNull();
  });

  it('`kind` 가 없는 앞선 판의 포장 생성도 보낸다', () => {
    const legacy = {
      idempotencyKey: 'old-1',
      workerNo: '900028',
      body: { handlingUnitTypeCode: 'BOX', contents: [{ lotId: 1, qty: 10 }] },
    };

    expect(packingQueue.parse(legacy)).toMatchObject({ kind: 'create' });
    expect(packingQueue.parse({ ...legacy, body: { contents: legacy.body.contents } })).toBeNull();
  });
});

describe('useLegacyOutboxDrain — 단말에 남은 확정을 마저 보낸다', () => {
  it('같은 멱등 키·사번으로 보내고, 받아지면 큐를 지운다', async () => {
    const pqcSeen: Request[] = [];
    const packSeen: Request[] = [];
    globalThis.localStorage.setItem(PQC_KEY, JSON.stringify([pqcEntry('k-1')]));
    globalThis.localStorage.setItem(PACK_KEY, JSON.stringify([packEntry]));

    renderHookWithProviders(() => useLegacyOutboxDrain(true), {
      fetch: createStubFetch([
        route(
          '/quality/inspection-results',
          () => jsonResponse({ inspectionResultId: 1 }, { status: 201 }),
          pqcSeen,
        ),
        route(
          '/inventory/handling-units/55:pack',
          () => jsonResponse({ handlingUnitId: 55 }),
          packSeen,
        ),
      ]),
    });

    await waitFor(() => {
      expect(stored(PQC_KEY)).toBeNull();
      expect(stored(PACK_KEY)).toBeNull();
    });
    expect(pqcSeen[0]?.headers.get('Idempotency-Key')).toBe('k-1');
    expect(pqcSeen[0]?.headers.get('X-Worker-No')).toBe('900028');
    expect(packSeen[0]?.headers.get('Idempotency-Key')).toBe('pack-1');
  });

  it('서버가 잠시 못 받으면 그 건부터 남겨 두고 멈춘다', async () => {
    const seen: Request[] = [];
    globalThis.localStorage.setItem(PQC_KEY, JSON.stringify([pqcEntry('k-1'), pqcEntry('k-2')]));

    renderHookWithProviders(() => useLegacyOutboxDrain(true), {
      fetch: createStubFetch([
        route(
          '/quality/inspection-results',
          () => jsonResponse({ message: '잠시 뒤' }, { status: 503 }),
          seen,
        ),
      ]),
    });

    await waitFor(() => {
      expect(seen.length).toBeGreaterThan(0);
    });
    expect(seen).toHaveLength(1);
    expect(stored(PQC_KEY)).toEqual([pqcEntry('k-1'), pqcEntry('k-2')]);
  });

  it('인증이 막힌 건(401)은 내리지 않고 남기되 뒤의 건은 보낸다', async () => {
    const seen: Request[] = [];
    globalThis.localStorage.setItem(PQC_KEY, JSON.stringify([pqcEntry('k-1'), pqcEntry('k-2')]));

    renderHookWithProviders(() => useLegacyOutboxDrain(true), {
      fetch: createStubFetch([
        route(
          '/quality/inspection-results',
          (request) =>
            request.headers.get('Idempotency-Key') === 'k-1'
              ? jsonResponse({ message: '인증' }, { status: 401 })
              : jsonResponse({ inspectionResultId: 2 }, { status: 201 }),
          seen,
        ),
      ]),
    });

    await waitFor(() => {
      expect(stored(PQC_KEY)).toEqual([pqcEntry('k-1')]);
    });
    expect(seen.map((each) => each.headers.get('Idempotency-Key'))).toEqual(['k-1', 'k-2']);
  });

  it('서버가 거부한 건은 내리고 다음 건을 보낸다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const seen: Request[] = [];
    globalThis.localStorage.setItem(PQC_KEY, JSON.stringify([pqcEntry('k-1'), pqcEntry('k-2')]));

    renderHookWithProviders(() => useLegacyOutboxDrain(true), {
      fetch: createStubFetch([
        route(
          '/quality/inspection-results',
          (request) =>
            request.headers.get('Idempotency-Key') === 'k-1'
              ? jsonResponse(
                  { code: 'STATE_LOCKED', message: '이미 확정', errors: [] },
                  { status: 409 },
                )
              : jsonResponse({ inspectionResultId: 2 }, { status: 201 }),
          seen,
        ),
      ]),
    });

    await waitFor(() => {
      expect(stored(PQC_KEY)).toBeNull();
    });
    expect(seen.map((each) => each.headers.get('Idempotency-Key'))).toEqual(['k-1', 'k-2']);
  });

  it('단말 등록 전에는 보내지 않는다', async () => {
    const seen: Request[] = [];
    globalThis.localStorage.setItem(PQC_KEY, JSON.stringify([pqcEntry('k-1')]));

    renderHookWithProviders(() => useLegacyOutboxDrain(false), {
      fetch: createStubFetch([
        route('/quality/inspection-results', () => jsonResponse({}, { status: 201 }), seen),
      ]),
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(seen).toHaveLength(0);
    expect(stored(PQC_KEY)).toEqual([pqcEntry('k-1')]);
  });
});
