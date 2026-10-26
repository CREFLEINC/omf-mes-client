import type { components } from '@omf-mes/api-client';

import { toMaterialConsumption } from './post-request';
import type { ScannedMaterial } from './scan';

type MaterialConsumptionCreate = components['schemas']['MaterialConsumptionCreate'];

/**
 * 스캔했지만 아직 보내지 않은 투입 「보낼 예정」(PI-26, `send-timing`의 `next-action`).
 *
 * 단말 저장소에 둔다 — 다시 불러오거나 단말이 꺼져도 남는다. 보내는 길은 outbox 하나이고, 보내는
 * 순간 이 저장소에서 지운다(두 번 보내지 않는다). [되돌리기]는 여기서 지울 뿐 아무것도 보내지 않는다.
 *
 * 저장소에는 기록 본문을 다시 만들 수 있는 것(W/O, 사번, 세션, 스캔한 LOT, 수량, 스캔 시각)을 둔다.
 */
export interface PendingInput {
  id: string;
  workOrderId: number;
  workerNo: string;
  workSessionId: number | null;
  material: ScannedMaterial;
  /** 이번 투입 수량 초안(작업자가 고친 값). */
  qty: string;
  /** 스캔한 시각(ISO). 투입 발생 시각으로 싣는다. */
  scannedAt: string;
}

const PENDING_KEY = 'omf-mes.material-input-scan.pending';

const isPendingInput = (value: unknown): value is PendingInput => {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  const material = item.material as Record<string, unknown> | null | undefined;

  return (
    typeof item.id === 'string' &&
    typeof item.workOrderId === 'number' &&
    typeof item.workerNo === 'string' &&
    item.workerNo !== '' &&
    typeof item.qty === 'string' &&
    typeof item.scannedAt === 'string' &&
    typeof material === 'object' &&
    material !== null &&
    typeof material.lotId === 'number' &&
    typeof material.itemId === 'number' &&
    typeof material.uomId === 'number' &&
    typeof material.lotNo === 'string'
  );
};

/** 저장된 「보낼 예정」. 못 읽거나 모양이 깨진 항목은 버린다(화면을 세우지 못하게 하지 않는다). */
export const readPendingInputs = (): PendingInput[] => {
  try {
    const raw = globalThis.localStorage.getItem(PENDING_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed.filter(isPendingInput) : [];
  } catch {
    return [];
  }
};

const writePendingInputs = (items: readonly PendingInput[]): void => {
  try {
    globalThis.localStorage.setItem(PENDING_KEY, JSON.stringify(items));
  } catch {
    /* 저장에 실패해도 화면은 메모리의 「보낼 예정」으로 계속 간다. */
  }
};

/** 같은 id면 바꾸고, 없으면 덧붙인다. */
export const savePendingInput = (item: PendingInput): void => {
  writePendingInputs([...readPendingInputs().filter((one) => one.id !== item.id), item]);
};

export const removePendingInput = (id: string): void => {
  writePendingInputs(readPendingInputs().filter((one) => one.id !== id));
};

/** 「보낼 예정」 한 건의 기록 본문. 수량이 쓸 수 없는 값이면 `null`(보내지 않는다). */
export const toPendingBody = (item: PendingInput): MaterialConsumptionCreate | null =>
  toMaterialConsumption(
    item.workOrderId,
    item.material,
    { [item.material.lotId]: item.qty },
    new Date(item.scannedAt),
    item.workSessionId,
  );

let counter = 0;

/** 「보낼 예정」 식별자. 저장소 안에서만 쓴다. */
export const newPendingId = (): string => {
  counter += 1;

  return `${String(Date.now())}-${String(counter)}`;
};
